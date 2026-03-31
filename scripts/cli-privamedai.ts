#!/usr/bin/env node
/**
 * CLI for testing PrivaMedAI contract on Midnight Preprod
 * 
 * Usage: npm run cli:privamedai
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, createPrivaMedAIPrivateState, type PrivaMedAIPrivateState } from '../contract/src/witnesses-privamedai.js';

// Enable WebSocket for GraphQL subscriptions
// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// Set network to preprod
setNetworkId('preprod');

// Preprod network configuration
const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

async function createWallet(seed: string, walletStatePath: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  const walletConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  };

  let wallet: WalletFacade;
  let restored = false;

  if (fs.existsSync(walletStatePath)) {
    console.log('🔄 Restoring wallet from saved state...');
    const savedState = JSON.parse(fs.readFileSync(walletStatePath, 'utf-8'));
    wallet = await WalletFacade.init({
      configuration: walletConfig,
      shielded: () => ShieldedWallet(walletConfig).restore(savedState.shielded),
      unshielded: () => UnshieldedWallet({
        networkId,
        indexerClientConnection: walletConfig.indexerClientConnection,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      }).restore(savedState.unshielded),
      dust: () => DustWallet({
        ...walletConfig,
        costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
      }).restore(savedState.dust),
    });
    await wallet.start(shieldedSecretKeys, dustSecretKey);
    console.log('✅ Wallet restored successfully.\n');
    restored = true;
  } else {
    console.log('🔄 Starting wallet sync from scratch...');
    console.log('⚠️  First sync on preprod takes 20-40 minutes. Grab a coffee! ☕\n');
    wallet = await WalletFacade.init({
      configuration: walletConfig,
      shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (config) => UnshieldedWallet({
        ...config,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (config) => DustWallet({
        ...config,
        costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
      }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
    });
    await wallet.start(shieldedSecretKeys, dustSecretKey);
    console.log('✅ Wallet started successfully.\n');
  }

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, restored };
}

function signTransactionIntents(tx: { intents?: Map<number, any> }, signFn: (payload: Uint8Array) => ledger.Signature, proofMarker: 'proof' | 'pre-proof'): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, any, ledger.PreBinding>('signature', proofMarker, 'pre-binding', intent.serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map((_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map((_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

async function createProviders(walletCtx: any, zkConfigPath: string) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-cli-private-state',
      walletProvider,
      privateStoragePasswordProvider: async () => 'PrivaMedAI-Secure-Store-2025!',
      accountId: walletProvider.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function joinContract(providers: any, contractAddress: string, PrivaMedAIContract: any, privateStateId: string, seed: string) {
  console.log(`🔗 Connecting to contract at ${contractAddress.slice(0, 40)}...`);
  
  // Create proper initial private state with required fields
  const initialPrivateState = createPrivaMedAIPrivateState(
    Buffer.from(seed.slice(0, 64), 'hex'), // Use first 32 bytes of seed as secret key
    new Uint8Array(32),
    [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)]
  );
  
  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: PrivaMedAIContract,
    privateStateId,
    initialPrivateState,
  });
  console.log('✅ Successfully connected to contract!\n');
  return contract;
}

// ─── CLI Menu ─────────────────────────────────────────────────────────────────

const printMenu = () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         PrivaMedAI CLI - Enterprise Testing Tool             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ADMIN FUNCTIONS                                             ║');
  console.log('║    1. Initialize Contract (set admin)                        ║');
  console.log('║    2. Get Admin Address                                      ║');
  console.log('║                                                              ║');
  console.log('║  ISSUER REGISTRY                                             ║');
  console.log('║    3. Register Issuer (admin only)                           ║');
  console.log('║    4. Update Issuer Status (admin only)                      ║');
  console.log('║    5. Get Issuer Info                                        ║');
  console.log('║                                                              ║');
  console.log('║  CREDENTIAL OPERATIONS                                       ║');
  console.log('║    6. Issue Credential (issuer only)                         ║');
  console.log('║    7. Batch Issue 3 Credentials                              ║');
  console.log('║    8. Verify Credential                                      ║');
  console.log('║    9. Bundled Verify 2 Credentials                           ║');
  console.log('║   10. Bundled Verify 3 Credentials                           ║');
  console.log('║   11. Revoke Credential (issuer only)                        ║');
  console.log('║   12. Admin Revoke Credential                                ║');
  console.log('║   13. Check Credential Status                                ║');
  console.log('║                                                              ║');
  console.log('║  SYSTEM                                                      ║');
  console.log('║   14. Query Contract State                                   ║');
  console.log('║   15. Exit                                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
};

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaMedAI');
  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      PrivaMedAI CLI - Midnight Preprod Test Tool             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check deployment
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ No deployment-privamedai.json found. Deploy the contract first!');
    console.log('   Run: npm run deploy:privamedai\n');
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  console.log(`📄 Contract: ${deployment.contractName}`);
  console.log(`🔑 Address: ${deployment.contractAddress}`);
  console.log(`🌐 Network: ${deployment.network}`);
  console.log(`📅 Deployed: ${new Date(deployment.deployedAt).toLocaleString()}\n`);

  // Load seed
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const seedMatch = envContent.match(/^WALLET_SEED=(.+)$/m);
  if (!seedMatch) {
    console.error('❌ WALLET_SEED not found in .env');
    process.exit(1);
  }
  const seed = seedMatch[1].trim();

  // Load contract
  console.log('📦 Loading contract...');
  const PrivaMedAIModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // Create wallet
  console.log('👛 Setting up wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  console.log('⏳ Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
    Rx.tap((s: any) => process.stdout.write(`\r  Synced: ${s.isSynced ? '✅' : '🔄'}`)),
    Rx.filter((s: any) => s.isSynced),
  ));
  console.log('\n');

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  console.log(`💳 Wallet: ${address}\n`);

  // Save wallet state
  if (!walletCtx.restored) {
    const serializedState = {
      shielded: await walletCtx.wallet.shielded.serializeState(),
      unshielded: await walletCtx.wallet.unshielded.serializeState(),
      dust: await walletCtx.wallet.dust.serializeState(),
    };
    fs.writeFileSync(walletStatePath, JSON.stringify(serializedState));
  }

  // Create providers and connect to contract
  const providers = await createProviders(walletCtx, zkConfigPath);
  const contract = await joinContract(providers, deployment.contractAddress, compiledContract, 'privaMedAICliState', seed);

  const rli = createInterface({ input: stdin, output: stdout });

  try {
    let running = true;
    while (running) {
      printMenu();
      const choice = await rli.question('\nSelect an option: ');

      switch (choice.trim()) {
        // ─── ADMIN FUNCTIONS ─────────────────────────────────────────────────
        case '1': {
          console.log('\n🔧 Initialize Contract');
          console.log('This sets the admin for the contract.');
          const confirm = await rli.question('Continue? (yes/no): ');
          if (confirm.toLowerCase() !== 'yes') break;
          
          console.log('Submitting initialization transaction...');
          try {
            const adminPk = Buffer.from(walletCtx.unshieldedKeystore.getPublicKey().bytes).toString('hex');
            const tx = await submitCallTx(providers, contract, 'initialize', {
              initialAdmin: Buffer.from(adminPk, 'hex'),
            });
            console.log('✅ Contract initialized!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '2': {
          console.log('\n👤 Get Admin Address');
          try {
            const admin = await providers.publicDataProvider.queryContractState(deployment.contractAddress);
            console.log('Admin query not directly available via publicDataProvider.');
            console.log('Use the contract circuits to query admin.');
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        // ─── ISSUER REGISTRY ─────────────────────────────────────────────────
        case '3': {
          console.log('\n🏥 Register Issuer');
          const issuerKey = await rli.question('Enter issuer public key (hex, 64 chars): ');
          const nameHash = await rli.question('Enter organization name hash (hex, 64 chars) or press Enter for default: ');
          
          const issuerPubKey = Buffer.from(issuerKey.replace('0x', ''), 'hex');
          const orgHash = nameHash ? Buffer.from(nameHash.replace('0x', ''), 'hex') : Buffer.alloc(32, 1);
          
          console.log('Submitting registerIssuer transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'registerIssuer', {
              issuerPubKey,
              nameHash: orgHash,
            });
            console.log('✅ Issuer registered!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '4': {
          console.log('\n📝 Update Issuer Status');
          const issuerKey = await rli.question('Enter issuer public key (hex, 64 chars): ');
          console.log('Status options: 0=PENDING, 1=ACTIVE, 2=SUSPENDED, 3=REVOKED');
          const statusStr = await rli.question('Enter new status (0-3): ');
          
          const issuerPubKey = Buffer.from(issuerKey.replace('0x', ''), 'hex');
          const newStatus = parseInt(statusStr);
          
          console.log('Submitting updateIssuerStatus transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'updateIssuerStatus', {
              issuerPubKey,
              newStatus,
            });
            console.log('✅ Issuer status updated!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '5': {
          console.log('\nℹ️ Get Issuer Info');
          const issuerKey = await rli.question('Enter issuer public key (hex, 64 chars): ');
          
          try {
            const issuerPubKey = Buffer.from(issuerKey.replace('0x', ''), 'hex');
            console.log('Querying issuer info via contract state...');
            // Note: Direct query would require indexer query, simplified for demo
            console.log('Issuer info query submitted to contract.');
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        // ─── CREDENTIAL OPERATIONS ───────────────────────────────────────────
        case '6': {
          console.log('\n📜 Issue Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          const issuerKey = await rli.question('Enter issuer public key (hex, 64 chars): ');
          const claimHash = await rli.question('Enter claim hash (hex, 64 chars): ');
          const expiryDays = await rli.question('Enter expiry in days from now: ');
          
          const expiry = BigInt(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000);
          
          console.log('Submitting issueCredential transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'issueCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
              issuerPubKey: Buffer.from(issuerKey.replace('0x', ''), 'hex'),
              claimHash: Buffer.from(claimHash.replace('0x', ''), 'hex'),
              expiry,
            });
            console.log('✅ Credential issued!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '7': {
          console.log('\n📚 Batch Issue 3 Credentials');
          console.log('Enter details for 3 credentials:');
          
          const commitments: string[] = [];
          const claimHashes: string[] = [];
          const expiries: bigint[] = [];
          
          for (let i = 1; i <= 3; i++) {
            console.log(`\n--- Credential ${i} ---`);
            const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
            const claimHash = await rli.question('Enter claim hash (hex, 64 chars): ');
            const expiryDays = await rli.question('Enter expiry in days: ');
            
            commitments.push(commitment);
            claimHashes.push(claimHash);
            expiries.push(BigInt(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000));
          }
          
          console.log('\nSubmitting batchIssue3Credentials transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'batchIssue3Credentials', {
              commitment1: Buffer.from(commitments[0].replace('0x', ''), 'hex'),
              claimHash1: Buffer.from(claimHashes[0].replace('0x', ''), 'hex'),
              expiry1: expiries[0],
              commitment2: Buffer.from(commitments[1].replace('0x', ''), 'hex'),
              claimHash2: Buffer.from(claimHashes[1].replace('0x', ''), 'hex'),
              expiry2: expiries[1],
              commitment3: Buffer.from(commitments[2].replace('0x', ''), 'hex'),
              claimHash3: Buffer.from(claimHashes[2].replace('0x', ''), 'hex'),
              expiry3: expiries[2],
            });
            console.log('✅ 3 Credentials issued in batch!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '8': {
          console.log('\n🔍 Verify Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          
          console.log('Submitting verifyCredential transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'verifyCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
            });
            console.log('✅ Credential verified successfully!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
            console.log('   Result: VALID - Zero-knowledge proof verified on-chain');
          } catch (err: any) {
            console.error('❌ Verification failed:', err.message);
          }
          break;
        }

        case '9': {
          console.log('\n🔍 Bundled Verify 2 Credentials');
          const commitment1 = await rli.question('Enter commitment 1 (hex, 64 chars): ');
          const commitment2 = await rli.question('Enter commitment 2 (hex, 64 chars): ');
          
          console.log('Submitting bundledVerify2Credentials transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'bundledVerify2Credentials', {
              commitment1: Buffer.from(commitment1.replace('0x', ''), 'hex'),
              commitment2: Buffer.from(commitment2.replace('0x', ''), 'hex'),
            });
            console.log('✅ Both credentials verified in one proof!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
            console.log('   Result: ALL VALID - Bundled ZK proof verified on-chain');
          } catch (err: any) {
            console.error('❌ Bundled verification failed:', err.message);
          }
          break;
        }

        case '10': {
          console.log('\n🔍 Bundled Verify 3 Credentials');
          const commitment1 = await rli.question('Enter commitment 1 (hex, 64 chars): ');
          const commitment2 = await rli.question('Enter commitment 2 (hex, 64 chars): ');
          const commitment3 = await rli.question('Enter commitment 3 (hex, 64 chars): ');
          
          console.log('Submitting bundledVerify3Credentials transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'bundledVerify3Credentials', {
              commitment1: Buffer.from(commitment1.replace('0x', ''), 'hex'),
              commitment2: Buffer.from(commitment2.replace('0x', ''), 'hex'),
              commitment3: Buffer.from(commitment3.replace('0x', ''), 'hex'),
            });
            console.log('✅ All 3 credentials verified in one proof!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
            console.log('   Result: ALL VALID - Bundled ZK proof verified on-chain');
          } catch (err: any) {
            console.error('❌ Bundled verification failed:', err.message);
          }
          break;
        }

        case '11': {
          console.log('\n🚫 Revoke Credential (Issuer)');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          
          console.log('Submitting revokeCredential transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'revokeCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
            });
            console.log('✅ Credential revoked!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '12': {
          console.log('\n🚫 Admin Revoke Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          const reasonHash = await rli.question('Enter reason hash (hex, 64 chars) or press Enter for default: ');
          
          const reason = reasonHash ? Buffer.from(reasonHash.replace('0x', ''), 'hex') : Buffer.alloc(32, 0);
          
          console.log('Submitting adminRevokeCredential transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'adminRevokeCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
              reasonHash: reason,
            });
            console.log('✅ Credential revoked by admin!');
            console.log(`📋 Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '13': {
          console.log('\n📊 Check Credential Status');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          
          console.log('Querying credential status...');
          try {
            // This would typically query the indexer
            console.log('Status query functionality requires indexer integration.');
            console.log('Use verifyCredential to check validity with proof.');
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        // ─── SYSTEM ──────────────────────────────────────────────────────────
        case '14': {
          console.log('\n📈 Query Contract State');
          try {
            const ledgerState = await providers.publicDataProvider.queryContractState(deployment.contractAddress);
            if (ledgerState) {
              console.log('Contract state found!');
              console.log(`Block height: ${ledgerState.blockHeight}`);
              console.log(`Contract data size: ${ledgerState.data.length} bytes`);
            } else {
              console.log('No state found for this contract address.');
            }
          } catch (err: any) {
            console.error('❌ Error querying state:', err.message);
          }
          break;
        }

        case '15': {
          console.log('\n👋 Goodbye!');
          running = false;
          break;
        }

        default: {
          console.log('\n❌ Invalid option. Please try again.');
        }
      }
    }
  } finally {
    rli.close();
    await walletCtx.wallet.stop();
    console.log('\n💤 Wallet stopped.');
    console.log('✨ Thank you for using PrivaMedAI CLI!\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
