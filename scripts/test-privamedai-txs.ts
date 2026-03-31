#!/usr/bin/env node
/**
 * Automated test script for PrivaMedAI contract on Midnight Preprod
 * Tests all major functions with real transactions
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// Test results tracker
const testResults: { name: string; status: 'PASS' | 'FAIL'; txId?: string; error?: string }[] = [];

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function runTest(name: string, testFn: () => Promise<string>): Promise<void> {
  log(`🧪 Running: ${name}`);
  try {
    const txId = await testFn();
    testResults.push({ name, status: 'PASS', txId });
    log(`✅ PASSED: ${name} (TX: ${txId.slice(0, 40)}...)`);
  } catch (err: any) {
    testResults.push({ name, status: 'FAIL', error: err.message });
    log(`❌ FAILED: ${name} - ${err.message}`);
  }
}

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
    log('Restoring wallet from saved state...');
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
    restored = true;
  } else {
    log('Starting wallet sync from scratch...');
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
      privateStateStoreName: 'privamedai-test-private-state',
      walletProvider,
      privateStoragePasswordProvider: async () => 'PrivaMedAI-Test-Store-2025!',
      accountId: walletProvider.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main Test Script ─────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════╗');
  log('║  PrivaMedAI Contract - Real Transaction Test Suite           ║');
  log('╚══════════════════════════════════════════════════════════════╝\n');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaMedAI');
  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  // Check deployment
  if (!fs.existsSync(deploymentPath)) {
    log('❌ No deployment-privamedai.json found. Deploy the contract first!');
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  log(`📄 Contract: ${deployment.contractName}`);
  log(`🔑 Address: ${deployment.contractAddress}`);
  log(`🌐 Network: ${deployment.network}\n`);

  // Load seed
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const seedMatch = envContent.match(/^WALLET_SEED=(.+)$/m);
  if (!seedMatch) {
    log('❌ WALLET_SEED not found in .env');
    process.exit(1);
  }
  const seed = seedMatch[1].trim();

  // Load contract
  log('📦 Loading contract...');
  const PrivaMedAIModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: (...args: any[]) => new Uint8Array(32),
      get_credential_data: (...args: any[]) => new TextEncoder().encode(JSON.stringify({ test: true })),
      get_bundled_credential_data: (...args: any[]) => new TextEncoder().encode(JSON.stringify({ test: true })),
    }),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // Create wallet
  log('👛 Setting up wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  log('⏳ Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
    Rx.tap((s: any) => process.stdout.write(`\r  Synced: ${s.isSynced ? '✅' : '🔄'}`)),
    Rx.filter((s: any) => s.isSynced),
  ));
  console.log('\n');

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const pubKeyObj = walletCtx.unshieldedKeystore.getPublicKey();
  const publicKey = typeof pubKeyObj === 'string' ? pubKeyObj : pubKeyObj?.asString?.() || pubKeyObj?.toString?.() || '';
  log(`💳 Wallet: ${address}`);
  log(`🔑 Public Key: ${publicKey.slice(0, 64)}...\n`);

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
  log(`🔗 Connecting to contract...`);
  const contract = await findDeployedContract(providers, {
    contractAddress: deployment.contractAddress,
    compiledContract,
    privateStateId: 'privaMedAITestState',
    initialPrivateState: {},
  });
  log('✅ Connected to contract!\n');

  // Generate unique test data
  const timestamp = Date.now();
  const testCommitment1 = Buffer.from(`test_commitment_1_${timestamp}`, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
  const testCommitment2 = Buffer.from(`test_commitment_2_${timestamp}`, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
  const testCommitment3 = Buffer.from(`test_commitment_3_${timestamp}`, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
  const testClaimHash = Buffer.from(`claim_hash_${timestamp}`, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
  const testNameHash = Buffer.from(`Hospital_${timestamp}`, 'utf8').toString('hex').padEnd(64, '0').slice(0, 64);
  const issuerPubKey = publicKey.slice(0, 64);
  const expiry = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);

  log('═══════════════════════════════════════════════════════════════');
  log('                    RUNNING TEST TRANSACTIONS                   ');
  log('═══════════════════════════════════════════════════════════════\n');

  // Test 1: Initialize Contract
  await runTest('Initialize Contract (Set Admin)', async () => {
    const tx = await submitCallTx(providers, contract, 'initialize', {
      initialAdmin: Buffer.from(issuerPubKey, 'hex'),
    });
    return tx.txId;
  });

  // Test 2: Register Issuer
  await runTest('Register Issuer', async () => {
    const tx = await submitCallTx(providers, contract, 'registerIssuer', {
      issuerPubKey: Buffer.from(issuerPubKey, 'hex'),
      nameHash: Buffer.from(testNameHash, 'hex'),
    });
    return tx.txId;
  });

  // Test 3: Issue Single Credential
  await runTest('Issue Single Credential', async () => {
    const tx = await submitCallTx(providers, contract, 'issueCredential', {
      commitment: Buffer.from(testCommitment1, 'hex'),
      issuerPubKey: Buffer.from(issuerPubKey, 'hex'),
      claimHash: Buffer.from(testClaimHash, 'hex'),
      expiry,
    });
    return tx.txId;
  });

  // Test 4: Batch Issue 3 Credentials
  await runTest('Batch Issue 3 Credentials', async () => {
    const tx = await submitCallTx(providers, contract, 'batchIssue3Credentials', {
      commitment1: Buffer.from(testCommitment1 + '00', 'hex').slice(0, 32),
      claimHash1: Buffer.from(testClaimHash, 'hex'),
      expiry1: expiry,
      commitment2: Buffer.from(testCommitment2, 'hex'),
      claimHash2: Buffer.from(testClaimHash, 'hex'),
      expiry2: expiry,
      commitment3: Buffer.from(testCommitment3, 'hex'),
      claimHash3: Buffer.from(testClaimHash, 'hex'),
      expiry3: expiry,
    });
    return tx.txId;
  });

  // Test 5: Verify Credential
  await runTest('Verify Single Credential', async () => {
    const tx = await submitCallTx(providers, contract, 'verifyCredential', {
      commitment: Buffer.from(testCommitment2, 'hex'),
    });
    return tx.txId;
  });

  // Test 6: Bundled Verify 2 Credentials
  await runTest('Bundled Verify 2 Credentials', async () => {
    const tx = await submitCallTx(providers, contract, 'bundledVerify2Credentials', {
      commitment1: Buffer.from(testCommitment2, 'hex'),
      commitment2: Buffer.from(testCommitment3, 'hex'),
    });
    return tx.txId;
  });

  // Test 7: Revoke Credential
  await runTest('Revoke Credential (Issuer)', async () => {
    const tx = await submitCallTx(providers, contract, 'revokeCredential', {
      commitment: Buffer.from(testCommitment2, 'hex'),
    });
    return tx.txId;
  });

  // Test 8: Update Issuer Status
  await runTest('Update Issuer Status', async () => {
    const tx = await submitCallTx(providers, contract, 'updateIssuerStatus', {
      issuerPubKey: Buffer.from(issuerPubKey, 'hex'),
      newStatus: 1, // ACTIVE
    });
    return tx.txId;
  });

  // Print summary
  log('\n═══════════════════════════════════════════════════════════════');
  log('                      TEST SUMMARY                              ');
  log('═══════════════════════════════════════════════════════════════\n');

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;

  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    log(`${icon} ${result.name}`);
    if (result.txId) {
      log(`   TX: ${result.txId}`);
    }
    if (result.error) {
      log(`   Error: ${result.error}`);
    }
  });

  log('\n────────────────────────────────────────────────────────────────');
  log(`Total: ${testResults.length} | Passed: ${passed} ✅ | Failed: ${failed} ❌`);
  log('────────────────────────────────────────────────────────────────\n');

  // Cleanup
  await walletCtx.wallet.stop();
  log('💤 Wallet stopped.');
  log('✨ Test complete!\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
