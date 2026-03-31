#!/usr/bin/env node
/**
 * CLI for testing PrivaCred contract on Midnight Preprod
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
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

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
    console.log('Restoring wallet from saved state...');
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
    console.log('Wallet restored successfully.');
    restored = true;
  } else {
    console.log('Starting wallet sync from scratch...');
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
    console.log('Wallet started successfully.');
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
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

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
      privateStateStoreName: 'priva-cred-cli-private-state',
      walletProvider,
      privateStoragePasswordProvider: async () => 'PrivaCred-Secure-Store-2025!',
      accountId: walletProvider.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Contract Interaction ─────────────────────────────────────────────────────

async function joinContract(providers: any, contractAddress: string, PrivaCredContract: any, privateStateId: string) {
  console.log(`Joining contract at ${contractAddress}...`);
  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: PrivaCredContract,
    privateStateId,
    initialPrivateState: {},
  });
  console.log('Successfully connected to contract!');
  return contract;
}

// ─── CLI Menu ─────────────────────────────────────────────────────────────────

const printMenu = () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            PrivaCred CLI - Preprod Test Tool                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  1. Issue Credential                                         ║');
  console.log('║  2. Verify Credential                                        ║');
  console.log('║  3. Revoke Credential                                        ║');
  console.log('║  4. Query Contract State                                     ║');
  console.log('║  5. Exit                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
};

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const deploymentPath = path.join(repoRoot, 'deployment.json');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaCred');
  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         PrivaCred CLI - Midnight Preprod                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check deployment
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ No deployment.json found. Deploy the contract first!');
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  console.log(`Contract Address: ${deployment.contractAddress}`);
  console.log(`Deployed At: ${deployment.deployedAt}\n`);

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
  const PrivaCredModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  const compiledContract = CompiledContract.make('priva-cred', PrivaCredModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: (...args: any[]) => new Uint8Array(32),
      get_credential_data: (...args: any[]) => new TextEncoder().encode(JSON.stringify({ age: 21 })),
    }),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // Create wallet
  console.log('Creating wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  console.log('Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
    Rx.tap((s) => process.stdout.write(`\r  synced: ${s.isSynced}`)),
    Rx.filter((s) => s.isSynced),
  ));
  console.log('\n');

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  console.log(`Wallet Address: ${address}`);

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
  const contract = await joinContract(providers, deployment.contractAddress, compiledContract, 'privaCredCliState');

  const rli = createInterface({ input: stdin, output: stdout });

  try {
    let running = true;
    while (running) {
      printMenu();
      const choice = await rli.question('\nSelect an option: ');

      switch (choice.trim()) {
        case '1': {
          console.log('\n📋 Issue Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');
          const issuer = await rli.question('Enter issuer public key (hex, 64 chars): ');
          const claimHash = await rli.question('Enter claim hash (hex, 64 chars): ');
          const expiry = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);

          console.log('Submitting transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'issueCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
              issuer: Buffer.from(issuer.replace('0x', ''), 'hex'),
              claimHash: Buffer.from(claimHash.replace('0x', ''), 'hex'),
              expiry,
            });
            console.log('✅ Credential issued!');
            console.log(`Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '2': {
          console.log('\n🔍 Verify Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');

          console.log('Submitting transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'verifyCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
            });
            console.log('✅ Credential verification submitted!');
            console.log(`Transaction ID: ${tx.txId}`);
            console.log('Result will be available on-chain.');
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '3': {
          console.log('\n🚫 Revoke Credential');
          const commitment = await rli.question('Enter commitment (hex, 64 chars): ');

          console.log('Submitting transaction...');
          try {
            const tx = await submitCallTx(providers, contract, 'revokeCredential', {
              commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
            });
            console.log('✅ Credential revoked!');
            console.log(`Transaction ID: ${tx.txId}`);
          } catch (err: any) {
            console.error('❌ Error:', err.message);
          }
          break;
        }

        case '4': {
          console.log('\n📊 Querying Contract State...');
          const ledgerState = await providers.publicDataProvider.queryContractState(deployment.contractAddress);
          if (ledgerState) {
            console.log('Contract state found!');
            console.log(`Block height: ${ledgerState.blockHeight}`);
            console.log(`Contract data size: ${ledgerState.data.length} bytes`);
          } else {
            console.log('No state found for this contract address.');
          }
          break;
        }

        case '5': {
          console.log('\n👋 Goodbye!');
          running = false;
          break;
        }

        default: {
          console.log('Invalid option. Please try again.');
        }
      }
    }
  } finally {
    rli.close();
    await walletCtx.wallet.stop();
    console.log('Wallet stopped.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
