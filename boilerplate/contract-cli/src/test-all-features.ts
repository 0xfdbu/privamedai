#!/usr/bin/env node
/**
 * Test all PrivaMedAI contract features on testnet
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPaths = [
  path.join(__dirname, '..', '..', '..', '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
];
let envLoaded = false;
for (const envPath of envPaths) {
  if (envLoaded) break;
  const result = dotenv.config({ path: envPath });
  if (result.parsed) {
    envLoaded = true;
    console.log(`🔧 Loaded environment from: ${envPath}`);
  }
}

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { contracts, witnesses, createPrivaMedAIPrivateState } from '@midnight-ntwrk/contract';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { mnemonicToSeed } from '@scure/bip39';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { PrivaMedAIPrivateState, PrivaMedAIProviders, DeployedPrivaMedAIContract } from './common-types';

const currentDir = __dirname;

// @ts-expect-error: Required for WebSocket
globalThis.WebSocket = WebSocket;

let logger: Logger;

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: any;
}

const contractConfig = {
  privateStateStoreName: 'privamedai-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', '..', 'contract', 'src', 'managed', 'PrivaMedAI'),
};

// Auto-detect contract
const contractNames = Object.keys(contracts);
const contractModule = contracts[contractNames[0]];
console.log(`🔍 Using contract: ${contractNames[0]}`);

// Pre-compile contract
const privaMedAICompiledContract = CompiledContract.make('PrivaMedAI', contractModule.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

const buildShieldedConfig = (config: any) => ({
  networkId: 'preprod',
  indexerClientConnection: { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS },
  provingServerUrl: new URL(config.proofServer),
  relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = (config: any) => ({
  networkId: 'preprod',
  indexerClientConnection: { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = (config: any) => ({
  networkId: 'preprod',
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS },
  provingServerUrl: new URL(config.proofServer),
  relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

const mnemonicToHexSeed = async (mnemonic: string): Promise<string> => {
  const seedBytes = await mnemonicToSeed(mnemonic.trim());
  return Buffer.from(seedBytes).toString('hex');
};

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Failed to initialize HDWallet');
  const derivationResult = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (derivationResult.type !== 'keysDerived') throw new Error('Failed to derive keys');
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced)));

const buildWalletFromSeed = async (config: any, seed: string): Promise<WalletContext> => {
  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const wallet = await WalletFacade.init({
    configuration: { ...buildShieldedConfig(config), ...buildUnshieldedConfig(config), ...buildDustConfig(config) },
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Wallet Overview                            Network: ' + getNetworkId());
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Unshielded Address: ' + unshieldedKeystore.getBech32Address());
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('⏳ Waiting for wallet to sync...');
  await waitForSync(wallet);
  console.log('✅ Wallet synced\n');

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

const createWalletAndMidnightProvider = async (ctx: WalletContext): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() { return state.shielded.coinPublicKey.toHexString(); },
    getEncryptionPublicKey() { return state.shielded.encryptionPublicKey.toHexString(); },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey }, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) { return ctx.wallet.submitTransaction(tx) as any; },
  };
};

const configureProviders = async (ctx: WalletContext): Promise<PrivaMedAIProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider(contractConfig.zkConfigPath);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${accountId}!A`;
  
  return {
    privateStateProvider: levelPrivateStateProvider<typeof contractConfig.privateStateStoreName>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }) as any,
    publicDataProvider: indexerPublicDataProvider('https://indexer.preprod.midnight.network/api/v4/graphql', 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider('http://127.0.0.1:6300', zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

// Test results tracker
const testResults: { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; txId?: string; block?: number; error?: string }[] = [];

const recordResult = (name: string, status: 'PASS' | 'FAIL' | 'SKIP', txId?: string, block?: number, error?: string) => {
  testResults.push({ name, status, txId, block, error });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${txId ? ` (Tx: ${txId.slice(0, 16)}...)` : ''}${error ? ` - Error: ${error}` : ''}`);
};

async function main() {
  const contractAddress = process.argv[2];
  if (!contractAddress) {
    console.error('Usage: node test-all-features.js <contract-address>');
    console.error('Example: node test-all-features.js 3bbe38546b2c698379620495dfb7ffc8e39d52441b1ad8bad17f7893db94cf46');
    process.exit(1);
  }

  console.log('🧪 PrivaMedAI Feature Testing');
  console.log('==============================');
  console.log(`Contract: ${contractAddress}`);
  console.log('');

  const walletSeed = process.env.WALLET_SEED;
  if (!walletSeed) {
    console.error('❌ WALLET_SEED not set');
    process.exit(1);
  }

  const isHexSeed = /^[a-f0-9]{128}$/i.test(walletSeed.trim());
  const seed = isHexSeed ? walletSeed.trim() : await mnemonicToHexSeed(walletSeed);

  try {
    const config = new PreprodRemoteConfig();
    const walletCtx = await buildWalletFromSeed(config, seed);
    const providers = await configureProviders(walletCtx);

    // Join existing contract
    console.log('⏳ Connecting to contract...');
    const privateState = createPrivaMedAIPrivateState(new Uint8Array(32).fill(1));
    const contract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: privaMedAICompiledContract as any,
      privateStateId: 'privamedaiPrivateState',
      initialPrivateState: privateState,
    });
    console.log('✅ Connected to contract\n');

    const adminPubKeyHex = walletCtx.unshieldedKeystore.getPublicKey();
    const adminPubKeyBytes = Uint8Array.from(Buffer.from(adminPubKeyHex, 'hex'));

    // Generate test data
    const issuerPubKey = Uint8Array.from(Buffer.from('525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362', 'hex'));
    const nameHash = Uint8Array.from(Buffer.from('19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12', 'hex'));
    const claimHash = Uint8Array.from(Buffer.from('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'hex'));
    const credentialData = Uint8Array.from(Buffer.from('cafebabe1234567890cafebabe1234567890cafebabe1234567890cafebabe12', 'hex'));

    // Test 1: getAdmin (query)
    console.log('\n📋 Test 1: getAdmin (query)');
    try {
      const result = await (contract.callTx as any).getAdmin();
      recordResult('getAdmin', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('getAdmin', 'FAIL', undefined, undefined, e.message);
    }

    // Test 2: getIssuerInfo (query)
    console.log('\n📋 Test 2: getIssuerInfo (query)');
    try {
      const result = await (contract.callTx as any).getIssuerInfo(issuerPubKey);
      recordResult('getIssuerInfo', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('getIssuerInfo', 'FAIL', undefined, undefined, e.message);
    }

    // First: Register and activate the issuer
    console.log('\n🔧 Setup: Ensuring issuer is registered and active...');
    try {
      // Try to register issuer (may already be registered)
      try {
        await (contract.callTx as any).registerIssuer(adminPubKeyBytes, issuerPubKey, nameHash);
        console.log('   Issuer registered');
      } catch (e: any) {
        if (e.message?.includes('already registered')) {
          console.log('   Issuer already registered');
        }
      }
      
      // Update issuer status to ACTIVE (1)
      const result = await (contract.callTx as any).updateIssuerStatus(adminPubKeyBytes, issuerPubKey, 1);
      console.log(`   Issuer activated (Block ${result.public.blockHeight})`);
    } catch (e: any) {
      console.log('   Setup warning:', e.message);
    }

    // Test 3: updateIssuerStatus
    console.log('\n📋 Test 3: updateIssuerStatus');
    try {
      const result = await (contract.callTx as any).updateIssuerStatus(adminPubKeyBytes, issuerPubKey, 2); // SUSPENDED = 2
      recordResult('updateIssuerStatus -> SUSPENDED', 'PASS', result.public.txId, result.public.blockHeight);
      
      // Reactivate
      const result2 = await (contract.callTx as any).updateIssuerStatus(adminPubKeyBytes, issuerPubKey, 1); // ACTIVE = 1
      recordResult('updateIssuerStatus -> ACTIVE', 'PASS', result2.public.txId, result2.public.blockHeight);
    } catch (e: any) {
      recordResult('updateIssuerStatus', 'FAIL', undefined, undefined, e.message);
    }

    // Test 4: issueCredential (using issuer as caller)
    console.log('\n📋 Test 4: issueCredential');
    let commitment1: Uint8Array;
    try {
      commitment1 = Uint8Array.from(Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'));
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400); // 1 day from now
      // Note: Using issuerPubKey as caller (they are the issuer)
      const result = await (contract.callTx as any).issueCredential(issuerPubKey, commitment1, issuerPubKey, claimHash, expiry);
      recordResult('issueCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('issueCredential', 'FAIL', undefined, undefined, e.message);
      commitment1 = Uint8Array.from(Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'));
    }

    // Test 5: batchIssue3Credentials
    console.log('\n📋 Test 5: batchIssue3Credentials');
    try {
      const commitment2 = Uint8Array.from(Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'));
      const commitment3 = Uint8Array.from(Buffer.from('3333333333333333333333333333333333333333333333333333333333333333', 'hex'));
      const claimHash2 = Uint8Array.from(Buffer.from('bbbbbb1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'hex'));
      const claimHash3 = Uint8Array.from(Buffer.from('cccccc1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'hex'));
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
      // Use issuer as caller
      const result = await (contract.callTx as any).batchIssue3Credentials(
        issuerPubKey, commitment1, claimHash, expiry,
        commitment2, claimHash2, expiry,
        commitment3, claimHash3, expiry
      );
      recordResult('batchIssue3Credentials', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('batchIssue3Credentials', 'FAIL', undefined, undefined, e.message);
    }

    // Test 6: verifyCredential
    console.log('\n📋 Test 6: verifyCredential');
    try {
      const result = await (contract.callTx as any).verifyCredential(commitment1, credentialData);
      recordResult('verifyCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('verifyCredential', 'FAIL', undefined, undefined, e.message);
    }

    // Test 7: bundledVerify2Credentials
    console.log('\n📋 Test 7: bundledVerify2Credentials');
    try {
      const commitment2 = Uint8Array.from(Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'));
      const data2 = Uint8Array.from(Buffer.from('dddddddd1234567890abcdef1234567890abcdef1234567890abcdef12345678', 'hex'));
      const result = await (contract.callTx as any).bundledVerify2Credentials(
        commitment1, credentialData, commitment2, data2
      );
      recordResult('bundledVerify2Credentials', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('bundledVerify2Credentials', 'FAIL', undefined, undefined, e.message);
    }

    // Test 8: bundledVerify3Credentials
    console.log('\n📋 Test 8: bundledVerify3Credentials');
    try {
      const commitment2 = Uint8Array.from(Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'));
      const commitment3 = Uint8Array.from(Buffer.from('3333333333333333333333333333333333333333333333333333333333333333', 'hex'));
      const data2 = Uint8Array.from(Buffer.from('dddddddd1234567890abcdef1234567890abcdef1234567890abcdef12345678', 'hex'));
      const data3 = Uint8Array.from(Buffer.from('eeeeeeee1234567890abcdef1234567890abcdef1234567890abcdef12345678', 'hex'));
      const result = await (contract.callTx as any).bundledVerify3Credentials(
        commitment1, credentialData, commitment2, data2, commitment3, data3
      );
      recordResult('bundledVerify3Credentials', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('bundledVerify3Credentials', 'FAIL', undefined, undefined, e.message);
    }

    // Test 9: checkCredentialStatus
    console.log('\n📋 Test 9: checkCredentialStatus');
    try {
      const result = await (contract.callTx as any).checkCredentialStatus(commitment1);
      recordResult('checkCredentialStatus', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('checkCredentialStatus', 'FAIL', undefined, undefined, e.message);
    }

    // Test 10: revokeCredential (issuer revokes their own credential)
    console.log('\n📋 Test 10: revokeCredential');
    try {
      const result = await (contract.callTx as any).revokeCredential(issuerPubKey, commitment1);
      recordResult('revokeCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('revokeCredential', 'FAIL', undefined, undefined, e.message);
    }

    // Test 11: adminRevokeCredential
    console.log('\n📋 Test 11: adminRevokeCredential');
    try {
      const commitment2 = Uint8Array.from(Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'));
      const reasonHash = Uint8Array.from(Buffer.from('ffffffff1234567890abcdef1234567890abcdef1234567890abcdef12345678', 'hex'));
      const result = await (contract.callTx as any).adminRevokeCredential(adminPubKeyBytes, commitment2, reasonHash);
      recordResult('adminRevokeCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('adminRevokeCredential', 'FAIL', undefined, undefined, e.message);
    }

    // Print summary
    console.log('\n==============================');
    console.log('📊 TEST SUMMARY');
    console.log('==============================');
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    const skipped = testResults.filter(r => r.status === 'SKIP').length;
    
    testResults.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${icon} ${r.name}`);
    });
    
    console.log('\n------------------------------');
    console.log(`Total: ${testResults.length} | ✅ Pass: ${passed} | ❌ Fail: ${failed} | ⏭️ Skip: ${skipped}`);
    console.log('==============================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
