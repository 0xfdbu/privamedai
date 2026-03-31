#!/usr/bin/env node
/**
 * Sequential test script - one transaction at a time with delays
 * FIXED: Proper key derivation for witness authentication
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

import { findDeployedContract, submitCallTx, type CallTxOptions } from '@midnight-ntwrk/midnight-js-contracts';
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
import { witnesses, createPrivaMedAIPrivateState, type PrivaMedAIPrivateState } from '../contract/dist/witnesses-privamedai.js';
import { createHash } from 'crypto';

globalThis.WebSocket = WebSocket as any;
setNetworkId('preprod');

const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Derive keys from seed - returns the key material for each role
function deriveRoleKeys(seed: string): { zswapKey: Buffer; nightKey: Buffer; dustKey: Buffer } | null {
  try {
    const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
    if (hdWallet.type !== 'seedOk') {
      log('❌ Invalid seed');
      return null;
    }
    
    const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
    if (result.type !== 'keysDerived') {
      log('❌ Key derivation failed');
      return null;
    }
    
    hdWallet.hdWallet.clear();
    
    return {
      zswapKey: result.keys[Roles.Zswap],
      nightKey: result.keys[Roles.NightExternal],
      dustKey: result.keys[Roles.Dust],
    };
  } catch (e) {
    log(`❌ Key derivation error: ${e}`);
    return null;
  }
}

async function createWallet(seed: string, walletStatePath: string) {
  const keys = deriveRoleKeys(seed);
  if (!keys) throw new Error('Failed to derive keys');
  
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys.zswapKey);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys.dustKey);
  const unshieldedKeystore = createKeystore(keys.nightKey, networkId);

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

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, restored, keys };
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
    privateStateProvider: levelPrivateStateProvider<PrivaMedAIPrivateState>({
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

async function runSingleTest(
  name: string,
  providers: any,
  createCallOptions: any,
  circuitId: string,
  args: any[]
): Promise<boolean> {
  log(`\n🧪 TEST: ${name}`);
  log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    const txData = await submitCallTx(providers, createCallOptions(circuitId, args));
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const txId = txData?.public?.txId;
    const txHash = txId ? (typeof txId === 'bigint' ? txId.toString(16) : String(txId)) : 'unknown';
    
    log(`✅ PASSED (${duration}s)`);
    log(`   TX Hash: ${txHash.slice(0, 64)}...`);
    log(`   Status: ${txData?.public?.status || 'unknown'}`);
    return true;
  } catch (err: any) {
    log(`❌ FAILED`);
    log(`   Error: ${err.message?.slice(0, 200)}`);
    return false;
  }
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════╗');
  log('║  PrivaMedAI - Sequential Transaction Testing (FIXED)         ║');
  log('╚══════════════════════════════════════════════════════════════╝\n');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'dist', 'managed', 'PrivaMedAI');
  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  if (!fs.existsSync(deploymentPath)) {
    log('❌ No deployment-privamedai.json found');
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  log(`📄 Contract: ${deployment.contractName}`);
  log(`🔑 Address: ${deployment.contractAddress}`);
  log(`🌐 Network: ${deployment.network}\n`);

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

  log('📦 Loading contract...');
  const PrivaMedAIModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  log('👛 Setting up wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  log('⏳ Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
    Rx.tap((s: any) => process.stdout.write(`\r  Synced: ${s.isSynced ? '✅' : '🔄'}`)),
    Rx.filter((s: any) => s.isSynced),
  ));
  console.log('\n');

  const walletState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const coinPublicKey = walletState.shielded.coinPublicKey.toHexString();
  log(`💳 Wallet: ${walletCtx.unshieldedKeystore.getBech32Address()}`);
  log(`🔑 Coin Public Key: ${coinPublicKey}`);
  log(`🔑 Zswap Key (first 64 chars): ${walletCtx.keys.zswapKey.toString('hex').slice(0, 64)}...\n`);

  const providers = await createProviders(walletCtx, zkConfigPath);
  
  // FIXED: Use the zswap key and compute the derived admin key
  // The contract's get_public_key() hashes the secret key with a prefix
  // We need to use the derived key as admin for authentication to work
  const secretKey = walletCtx.keys.zswapKey;
  
  // Compute the admin key that would be derived from this secret key
  // Contract: persistentHash([pad(32, "privamed:pk:"), sk])
  const prefix = Buffer.alloc(32);
  Buffer.from("privamed:pk:").copy(prefix);
  const derivedAdminKey = createHash('sha256').update(Buffer.concat([prefix, secretKey])).digest('hex');
  
  log(`🔧 Secret key: ${secretKey.toString('hex').slice(0, 32)}...`);
  log(`🔧 Derived admin key: ${derivedAdminKey.slice(0, 32)}...`);
  log(`⚠️  Using derived key for admin (not coin public key)`);
  
  const initialPrivateState = createPrivaMedAIPrivateState(
    secretKey,
    new Uint8Array(32),
    [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)]
  );
  
  log(`🔗 Connecting to contract...`);
  const contract = await findDeployedContract(providers, {
    contractAddress: deployment.contractAddress,
    compiledContract,
    privateStateId: 'privaMedAITestState',
    initialPrivateState,
  });
  log('✅ Connected to contract!\n');

  const createCallOptions = (circuitId: string, args: unknown[]): CallTxOptions<any, any, any, any> => ({
    contractAddress: deployment.contractAddress,
    compiledContract,
    circuitId,
    args,
  });

  // Test data
  const testCommitment1 = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  const testCommitment2 = 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456a1';
  const testCommitment3 = 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456a1b2';
  const testClaimHash = 'd4e5f6789012345678901234567890abcdef1234567890abcdef123456a1b2c3';
  const testNameHash = 'e5f6789012345678901234567890abcdef1234567890abcdef123456a1b2c3d4';
  const callerPubKey = derivedAdminKey; // Admin/Caller public key (derived)
  const issuerPubKey = derivedAdminKey; // Same as admin for testing
  const expiry = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const results: { name: string; passed: boolean }[] = [];

  // TEST 1: Initialize with derived admin key
  results.push({
    name: 'Initialize Contract',
    passed: await runSingleTest('Initialize Contract (Set Admin)', providers, createCallOptions, 'initialize', [
      Buffer.from(derivedAdminKey, 'hex')
    ])
  });

  if (results[0].passed) {
    log('\n⏳ Waiting 10s for state propagation...');
    await delay(10000);
  }

  // TEST 2: Register Issuer
  results.push({
    name: 'Register Issuer',
    passed: await runSingleTest('Register Issuer', providers, createCallOptions, 'registerIssuer', [
      Buffer.from(callerPubKey, 'hex'), // callerPubKey (admin)
      Buffer.from(issuerPubKey, 'hex'), // issuerPubKey
      Buffer.from(testNameHash, 'hex'), // nameHash
    ])
  });

  if (results[1].passed) {
    log('\n⏳ Waiting 10s for state propagation...');
    await delay(10000);
  }

  // TEST 3: Issue Credential
  results.push({
    name: 'Issue Single Credential',
    passed: await runSingleTest('Issue Single Credential', providers, createCallOptions, 'issueCredential', [
      Buffer.from(callerPubKey, 'hex'), // callerPubKey (issuer)
      Buffer.from(testCommitment1, 'hex'), // commitment
      Buffer.from(issuerPubKey, 'hex'), // issuerPubKey
      Buffer.from(testClaimHash, 'hex'), // claimHash
      expiry, // expiry
    ])
  });

  if (results[2].passed) {
    log('\n⏳ Waiting 10s for state propagation...');
    await delay(10000);
  }

  // TEST 4: Batch Issue
  const batchCommitment1 = 'f1e2d3c4b5a69788990011223344556677889900aabbccdd1122334455667788';
  const batchCommitment2 = 'f2e3d4c5b6a79888990011223344556677889900aabbccdd1122334455667789';
  const batchCommitment3 = 'f3e4d5c6b7a89888990011223344556677889900aabbccdd112233445566778a';
  
  results.push({
    name: 'Batch Issue 3 Credentials',
    passed: await runSingleTest('Batch Issue 3 Credentials', providers, createCallOptions, 'batchIssue3Credentials', [
      Buffer.from(callerPubKey, 'hex'), // callerPubKey (issuer)
      Buffer.from(batchCommitment1, 'hex'),
      Buffer.from(testClaimHash, 'hex'),
      expiry,
      Buffer.from(batchCommitment2, 'hex'),
      Buffer.from(testClaimHash, 'hex'),
      expiry,
      Buffer.from(batchCommitment3, 'hex'),
      Buffer.from(testClaimHash, 'hex'),
      expiry,
    ])
  });

  if (results[3].passed) {
    log('\n⏳ Waiting 10s for state propagation...');
    await delay(10000);
  }

  // TEST 5: Verify Credential
  results.push({
    name: 'Verify Single Credential',
    passed: await runSingleTest('Verify Single Credential', providers, createCallOptions, 'verifyCredential', [
      Buffer.from(testCommitment1, 'hex'),
    ])
  });

  if (results[4].passed) {
    log('\n⏳ Waiting 5s for state propagation...');
    await delay(5000);
  }

  // TEST 6: Bundled Verify 2
  results.push({
    name: 'Bundled Verify 2 Credentials',
    passed: await runSingleTest('Bundled Verify 2 Credentials', providers, createCallOptions, 'bundledVerify2Credentials', [
      Buffer.from(batchCommitment1, 'hex'),
      Buffer.from(batchCommitment2, 'hex'),
    ])
  });

  if (results[5].passed) {
    log('\n⏳ Waiting 5s for state propagation...');
    await delay(5000);
  }

  // TEST 7: Revoke Credential
  results.push({
    name: 'Revoke Credential (Issuer)',
    passed: await runSingleTest('Revoke Credential (Issuer)', providers, createCallOptions, 'revokeCredential', [
      Buffer.from(callerPubKey, 'hex'), // callerPubKey (issuer)
      Buffer.from(testCommitment1, 'hex'), // commitment
    ])
  });

  if (results[6].passed) {
    log('\n⏳ Waiting 5s for state propagation...');
    await delay(5000);
  }

  // TEST 8: Update Issuer Status
  results.push({
    name: 'Update Issuer Status',
    passed: await runSingleTest('Update Issuer Status', providers, createCallOptions, 'updateIssuerStatus', [
      Buffer.from(callerPubKey, 'hex'), // callerPubKey (admin)
      Buffer.from(issuerPubKey, 'hex'), // issuerPubKey
      2, // SUSPENDED
    ])
  });

  // Summary
  log('\n' + '═'.repeat(64));
  log('                      TEST SUMMARY                              ');
  log('═'.repeat(64) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });

  log('\n' + '─'.repeat(64));
  log(`Total: ${results.length} | Passed: ${passed} ✅ | Failed: ${failed} ❌`);
  log('─'.repeat(64) + '\n');

  await walletCtx.wallet.stop();
  log('💤 Wallet stopped.');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
