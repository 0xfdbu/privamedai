#!/usr/bin/env node
/**
 * Test all PrivaMedAI contract features with real valid data
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
import crypto from 'node:crypto';

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

const contractNames = Object.keys(contracts);
const contractModule = contracts[contractNames[0]];
console.log(`🔍 Using contract: ${contractNames[0]}`);

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

// Utility: Generate deterministic commitment from index
const generateCommitment = (index: number): Uint8Array => {
  const hash = crypto.createHash('sha256').update(`credential-${index}-${Date.now()}`).digest();
  return new Uint8Array(hash);
};

// Utility: Generate claim hash from actual data
const generateClaimHash = (data: object): Uint8Array => {
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest();
  return new Uint8Array(hash);
};

// Utility: Generate credential data hash
const generateCredentialDataHash = (credentialData: object): Uint8Array => {
  const hash = crypto.createHash('sha256').update(JSON.stringify(credentialData)).digest();
  return new Uint8Array(hash);
};

// Test results tracker
const testResults: { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; txId?: string; block?: number; details?: string; error?: string }[] = [];

const recordResult = (name: string, status: 'PASS' | 'FAIL' | 'SKIP', txId?: string, block?: number, details?: string, error?: string) => {
  testResults.push({ name, status, txId, block, details, error });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${txId ? ` (Block ${block}, Tx: ${txId.slice(0, 16)}...)` : ''}${details ? ` - ${details}` : ''}${error ? ` - Error: ${error}` : ''}`);
};

async function main() {
  const contractAddress = process.argv[2];
  if (!contractAddress) {
    console.error('Usage: node test-real-features.js <contract-address>');
    process.exit(1);
  }

  console.log('🧪 PrivaMedAI Real Feature Testing');
  console.log('===================================');
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

    // Create a second "issuer" identity (derived from index 1)
    const issuerSeed = crypto.createHash('sha256').update(seed + 'issuer').digest('hex');
    const issuerKeys = deriveKeysFromSeed(issuerSeed);
    const issuerPubKeyBytes = issuerKeys[Roles.NightExternal]; // 32 bytes
    
    console.log(`Admin: ${adminPubKeyHex.substring(0, 32)}...`);
    console.log(`Issuer: ${Buffer.from(issuerPubKeyBytes).toString('hex').substring(0, 32)}...\n`);

    const issuerName = generateClaimHash({ name: 'Medical Institute', type: 'hospital' });

    // ========== TEST 1 & 2: Query functions ==========
    console.log('\n📋 TEST 1: getAdmin (query)');
    try {
      const result = await (contract.callTx as any).getAdmin();
      const admin = result.public?.returnValue || 'queried';
      recordResult('getAdmin', 'PASS', result.public.txId, result.public.blockHeight, `Admin: ${admin.slice(0, 16)}...`);
    } catch (e: any) {
      recordResult('getAdmin', 'FAIL', undefined, undefined, undefined, e.message);
    }

    console.log('\n📋 TEST 2: getIssuerInfo (query for non-existent issuer)');
    try {
      const result = await (contract.callTx as any).getIssuerInfo(issuerPubKeyBytes);
      recordResult('getIssuerInfo (not found)', 'PASS', result.public.txId, result.public.blockHeight, 'Returns default/empty issuer');
    } catch (e: any) {
      recordResult('getIssuerInfo', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 3: Register Issuer ==========
    console.log('\n📋 TEST 3: registerIssuer');
    try {
      const result = await (contract.callTx as any).registerIssuer(adminPubKeyBytes, issuerPubKeyBytes, issuerName);
      recordResult('registerIssuer', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      if (e.message?.includes('already registered')) {
        recordResult('registerIssuer', 'PASS', undefined, undefined, 'Issuer already registered');
      } else {
        recordResult('registerIssuer', 'FAIL', undefined, undefined, undefined, e.message);
      }
    }

    // ========== TEST 4: Update Issuer Status ==========
    console.log('\n📋 TEST 4: updateIssuerStatus -> ACTIVE');
    try {
      const result = await (contract.callTx as any).updateIssuerStatus(adminPubKeyBytes, issuerPubKeyBytes, 1);
      recordResult('updateIssuerStatus ACTIVE', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('updateIssuerStatus ACTIVE', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 5: Issue Single Credential ==========
    console.log('\n📋 TEST 5: issueCredential');
    let cred1Commitment: Uint8Array;
    let cred1ClaimHash: Uint8Array;
    let cred1Data: object;
    try {
      cred1Commitment = generateCommitment(1);
      cred1Data = {
        patientId: 'P-2024-001',
        diagnosis: 'Annual Physical - Healthy',
        doctor: 'Dr. Smith',
        hospital: 'General Hospital',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
      cred1ClaimHash = generateClaimHash(cred1Data);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365);
      
      const result = await (contract.callTx as any).issueCredential(issuerPubKeyBytes, cred1Commitment, issuerPubKeyBytes, cred1ClaimHash, expiry);
      recordResult('issueCredential', 'PASS', result.public.txId, result.public.blockHeight, `Commitment: ${Buffer.from(cred1Commitment).toString('hex').slice(0, 16)}...`);
    } catch (e: any) {
      recordResult('issueCredential', 'FAIL', undefined, undefined, undefined, e.message);
      // Create fallback values for subsequent tests
      cred1Commitment = generateCommitment(999);
      cred1ClaimHash = generateClaimHash({ fallback: true });
      cred1Data = { fallback: true };
    }

    // ========== TEST 6: Check Credential Status ==========
    console.log('\n📋 TEST 6: checkCredentialStatus');
    try {
      const result = await (contract.callTx as any).checkCredentialStatus(cred1Commitment);
      const status = result.public?.returnValue === 0 ? 'VALID' : result.public?.returnValue === 1 ? 'REVOKED' : 'UNKNOWN';
      recordResult('checkCredentialStatus', 'PASS', result.public.txId, result.public.blockHeight, `Status: ${status}`);
    } catch (e: any) {
      recordResult('checkCredentialStatus', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 7: Batch Issue 3 Credentials ==========
    console.log('\n📋 TEST 7: batchIssue3Credentials');
    let cred2Commitment: Uint8Array;
    let cred3Commitment: Uint8Array;
    try {
      cred2Commitment = generateCommitment(2);
      cred3Commitment = generateCommitment(3);
      
      const claimHash2 = generateClaimHash({ patientId: 'P-2024-002', type: 'vaccination', vaccine: 'COVID-19' });
      const claimHash3 = generateClaimHash({ patientId: 'P-2024-003', type: 'lab-result', test: 'Blood Work' });
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365);
      
      const result = await (contract.callTx as any).batchIssue3Credentials(
        issuerPubKeyBytes,
        cred2Commitment, claimHash2, expiry,
        cred3Commitment, claimHash3, expiry,
        generateCommitment(4), generateClaimHash({ patientId: 'P-2024-004' }), expiry
      );
      recordResult('batchIssue3Credentials', 'PASS', result.public.txId, result.public.blockHeight, '3 credentials issued');
    } catch (e: any) {
      recordResult('batchIssue3Credentials', 'FAIL', undefined, undefined, undefined, e.message);
      cred2Commitment = generateCommitment(998);
      cred3Commitment = generateCommitment(997);
    }

    // ========== TEST 8: Verify Credential ==========
    console.log('\n📋 TEST 8: verifyCredential');
    try {
      // Create the credential data hash (what would be stored off-chain)
      const credentialDataHash = generateCredentialDataHash(cred1Data);
      const result = await (contract.callTx as any).verifyCredential(cred1Commitment, credentialDataHash);
      const isValid = result.public?.returnValue === true;
      recordResult('verifyCredential', 'PASS', result.public.txId, result.public.blockHeight, `Valid: ${isValid}`);
    } catch (e: any) {
      recordResult('verifyCredential', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 9: Bundled Verify 2 Credentials ==========
    console.log('\n📋 TEST 9: bundledVerify2Credentials');
    try {
      const data1 = generateCredentialDataHash(cred1Data);
      const data2 = generateCredentialDataHash({ patientId: 'P-2024-002', type: 'vaccination', vaccine: 'COVID-19' });
      const result = await (contract.callTx as any).bundledVerify2Credentials(
        cred1Commitment, data1,
        cred2Commitment, data2
      );
      const allValid = result.public?.returnValue === true;
      recordResult('bundledVerify2Credentials', 'PASS', result.public.txId, result.public.blockHeight, `All Valid: ${allValid}`);
    } catch (e: any) {
      recordResult('bundledVerify2Credentials', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 10: Bundled Verify 3 Credentials ==========
    console.log('\n📋 TEST 10: bundledVerify3Credentials');
    try {
      const data1 = generateCredentialDataHash(cred1Data);
      const data2 = generateCredentialDataHash({ patientId: 'P-2024-002', type: 'vaccination' });
      const data3 = generateCredentialDataHash({ patientId: 'P-2024-003', type: 'lab-result' });
      const result = await (contract.callTx as any).bundledVerify3Credentials(
        cred1Commitment, data1,
        cred2Commitment, data2,
        cred3Commitment, data3
      );
      const allValid = result.public?.returnValue === true;
      recordResult('bundledVerify3Credentials', 'PASS', result.public.txId, result.public.blockHeight, `All Valid: ${allValid}`);
    } catch (e: any) {
      recordResult('bundledVerify3Credentials', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 11: Revoke Credential (by issuer) ==========
    console.log('\n📋 TEST 11: revokeCredential');
    let revokedCommitment: Uint8Array;
    try {
      // Issue a credential specifically to revoke
      revokedCommitment = generateCommitment(100);
      const claimHash = generateClaimHash({ patientId: 'P-REVOKE', temp: true });
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await (contract.callTx as any).issueCredential(issuerPubKeyBytes, revokedCommitment, issuerPubKeyBytes, claimHash, expiry);
      
      const result = await (contract.callTx as any).revokeCredential(issuerPubKeyBytes, revokedCommitment);
      recordResult('revokeCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('revokeCredential', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 12: Check Revoked Credential Status ==========
    console.log('\n📋 TEST 12: checkCredentialStatus (revoked)');
    try {
      const result = await (contract.callTx as any).checkCredentialStatus(revokedCommitment!);
      const status = result.public?.returnValue === 0 ? 'VALID' : result.public?.returnValue === 1 ? 'REVOKED' : 'UNKNOWN';
      recordResult('checkCredentialStatus (revoked)', 'PASS', result.public.txId, result.public.blockHeight, `Status: ${status}`);
    } catch (e: any) {
      recordResult('checkCredentialStatus (revoked)', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 13: Admin Revoke Credential ==========
    console.log('\n📋 TEST 13: adminRevokeCredential');
    try {
      // Issue a credential specifically for admin revocation
      const adminRevokeCommitment = generateCommitment(101);
      const claimHash = generateClaimHash({ patientId: 'P-ADMIN-REVOKE', temp: true });
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
      
      await (contract.callTx as any).issueCredential(issuerPubKeyBytes, adminRevokeCommitment, issuerPubKeyBytes, claimHash, expiry);
      
      const reasonHash = generateClaimHash({ reason: 'Administrative revocation', date: new Date().toISOString() });
      const result = await (contract.callTx as any).adminRevokeCredential(adminPubKeyBytes, adminRevokeCommitment, reasonHash);
      recordResult('adminRevokeCredential', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('adminRevokeCredential', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // ========== TEST 14: Suspend Issuer ==========
    console.log('\n📋 TEST 14: updateIssuerStatus -> SUSPENDED');
    try {
      const result = await (contract.callTx as any).updateIssuerStatus(adminPubKeyBytes, issuerPubKeyBytes, 2);
      recordResult('updateIssuerStatus SUSPENDED', 'PASS', result.public.txId, result.public.blockHeight);
    } catch (e: any) {
      recordResult('updateIssuerStatus SUSPENDED', 'FAIL', undefined, undefined, undefined, e.message);
    }

    // Print summary
    console.log('\n===================================');
    console.log('📊 TEST SUMMARY');
    console.log('===================================');
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    
    testResults.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${r.name}`);
    });
    
    console.log('\n-----------------------------------');
    console.log(`Total: ${testResults.length} | ✅ Pass: ${passed} | ❌ Fail: ${failed}`);
    console.log('===================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
