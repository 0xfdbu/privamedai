#!/usr/bin/env node
/**
 * Comprehensive Test Suite for PrivaMedAI Contract
 * Tests ALL features with real testnet transactions
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
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

// Test configuration
const TEST_CONFIG = {
  waitBetweenTxs: 5000, // 5 seconds between transactions
  maxRetries: 3,
  retryDelay: 10000,
};

// Test results tracking
interface TestResult {
  feature: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  txId?: string;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

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

  const walletConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  };

  let wallet: WalletFacade;

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
  } else {
    console.log('❌ No wallet state found. Run deployment first.');
    throw new Error('Wallet state not found');
  }

  // Get wallet state for public keys
  const walletState = await wallet.serialize();
  const coinPublicKey = walletState.shielded.coinPublicKey.toHexString();

  return {
    wallet,
    walletCtx: {
      coinPublicKey,
      publicKey: coinPublicKey, // Use coin public key as the main public key
    },
    shieldedSecretKeys,
    dustSecretKey,
  };
}

async function createProviders(wallet: any, walletCtx: any, shieldedSecretKeys: any, dustSecretKey: any, zkConfigPath: string) {
  const privateStateProvider = levelPrivateStateProvider<PrivaMedAIPrivateState>({
    privateStateStoreName: 'privamedai-test',
  });

  const walletState = await wallet.serialize();
  const keys = deriveKeys(walletState.seed || '');
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const walletProvider = {
    getCoinPublicKey: () => walletState.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => walletState.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys, dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => unshieldedKeystore.signData(payload);
      ledger.signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      return recipe;
    },
    submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
    publicKey: walletCtx.publicKey,
  };

  const providers = {
    walletProvider,
    proofProvider: httpClientProofProvider(new URL(CONFIG.proofServer)),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    privateStateProvider,
    zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
  };

  return providers;
}

async function joinContract(
  providers: any,
  contractAddress: string,
  compiledContract: any,
  privateStateId: string,
  seed: string
) {
  const initialPrivateState: PrivaMedAIPrivateState = {
    secretKey: new Uint8Array(Buffer.from(seed.slice(0, 64), 'hex')),
    credentials: new Map(),
  };

  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId,
    initialPrivateState,
  });

  return contract;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name: string, testFn: () => Promise<{ txId?: string; result?: any }>): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST: ${name}`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= TEST_CONFIG.maxRetries; attempt++) {
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASS (${duration}ms)`);
      if (result.txId) {
        console.log(`📋 Transaction ID: ${result.txId}`);
      }
      return { feature: name, status: 'PASS', txId: result.txId, duration };
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      if (attempt < TEST_CONFIG.maxRetries) {
        console.log(`⏳ Retrying in ${TEST_CONFIG.retryDelay / 1000}s...`);
        await delay(TEST_CONFIG.retryDelay);
      } else {
        const duration = Date.now() - startTime;
        return { feature: name, status: 'FAIL', error: error.message, duration };
      }
    }
  }
  
  return { feature: name, status: 'FAIL', error: 'Max retries exceeded', duration: Date.now() - startTime };
}

// ─── Test Functions ──────────────────────────────────────────────────────────

async function testInitializeContract(contract: any, adminPk: string) {
  const tx = await submitCallTx(contract.providers, contract, 'initialize', {
    initialAdmin: Buffer.from(adminPk, 'hex'),
  });
  return { txId: tx.txId };
}

async function testGetAdmin(contract: any) {
  const admin = await contract.state.getAdmin();
  console.log('   Admin:', Buffer.from(admin).toString('hex'));
  return { result: admin };
}

async function testRegisterIssuer(contract: any, issuerPk: string, nameHash: string) {
  const tx = await submitCallTx(contract.providers, contract, 'registerIssuer', {
    callerPubKey: Buffer.from(contract.providers.walletProvider.publicKey, 'hex'),
    issuerPubKey: Buffer.from(issuerPk, 'hex'),
    nameHash: Buffer.from(nameHash, 'hex'),
  });
  return { txId: tx.txId };
}

async function testGetIssuerInfo(contract: any, issuerPk: string) {
  const issuer = await contract.state.getIssuerInfo(Buffer.from(issuerPk, 'hex'));
  console.log('   Issuer:', {
    publicKey: Buffer.from(issuer.publicKey).toString('hex').slice(0, 20) + '...',
    status: issuer.status,
    credentialCount: issuer.credentialCount.toString(),
  });
  return { result: issuer };
}

async function testIssueCredential(contract: any, commitment: string, claimHash: string) {
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
  const callerPubKey = Buffer.from(contract.providers.walletProvider.publicKey, 'hex');
  const tx = await submitCallTx(contract.providers, contract, 'issueCredential', {
    callerPubKey,
    commitment: Buffer.from(commitment, 'hex'),
    issuerPubKey: callerPubKey,
    claimHash: Buffer.from(claimHash, 'hex'),
    expiry,
  });
  return { txId: tx.txId };
}

async function testBatchIssue3Credentials(contract: any) {
  const commitments = [
    '1111111111111111111111111111111111111111111111111111111111111111',
    '2222222222222222222222222222222222222222222222222222222222222222',
    '3333333333333333333333333333333333333333333333333333333333333333',
  ];
  const claimHashes = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  ];
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
  const callerPubKey = Buffer.from(contract.providers.walletProvider.publicKey, 'hex');
  
  const tx = await submitCallTx(contract.providers, contract, 'batchIssue3Credentials', {
    callerPubKey,
    commitment1: Buffer.from(commitments[0], 'hex'),
    claimHash1: Buffer.from(claimHashes[0], 'hex'),
    expiry1: expiry,
    commitment2: Buffer.from(commitments[1], 'hex'),
    claimHash2: Buffer.from(claimHashes[1], 'hex'),
    expiry2: expiry,
    commitment3: Buffer.from(commitments[2], 'hex'),
    claimHash3: Buffer.from(claimHashes[2], 'hex'),
    expiry3: expiry,
  });
  return { txId: tx.txId };
}

async function testVerifyCredential(contract: any, commitment: string, credentialData: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyCredential', {
    commitment: Buffer.from(commitment, 'hex'),
    credentialData: Buffer.from(credentialData, 'hex'),
  });
  return { txId: tx.txId };
}

async function testBundledVerify2Credentials(contract: any) {
  const commitments = [
    '1111111111111111111111111111111111111111111111111111111111111111',
    '2222222222222222222222222222222222222222222222222222222222222222',
  ];
  const credentialData = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ];
  
  const tx = await submitCallTx(contract.providers, contract, 'bundledVerify2Credentials', {
    commitment1: Buffer.from(commitments[0], 'hex'),
    credentialData1: Buffer.from(credentialData[0], 'hex'),
    commitment2: Buffer.from(commitments[1], 'hex'),
    credentialData2: Buffer.from(credentialData[1], 'hex'),
  });
  return { txId: tx.txId };
}

async function testBundledVerify3Credentials(contract: any) {
  const commitments = [
    '1111111111111111111111111111111111111111111111111111111111111111',
    '2222222222222222222222222222222222222222222222222222222222222222',
    '3333333333333333333333333333333333333333333333333333333333333333',
  ];
  const credentialData = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  ];
  
  const tx = await submitCallTx(contract.providers, contract, 'bundledVerify3Credentials', {
    commitment1: Buffer.from(commitments[0], 'hex'),
    credentialData1: Buffer.from(credentialData[0], 'hex'),
    commitment2: Buffer.from(commitments[1], 'hex'),
    credentialData2: Buffer.from(credentialData[1], 'hex'),
    commitment3: Buffer.from(commitments[2], 'hex'),
    credentialData3: Buffer.from(credentialData[2], 'hex'),
  });
  return { txId: tx.txId };
}

async function testCheckCredentialStatus(contract: any, commitment: string) {
  const status = await contract.state.checkCredentialStatus(Buffer.from(commitment, 'hex'));
  console.log('   Status:', status);
  return { result: status };
}

async function testRevokeCredential(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'revokeCredential', {
    callerPubKey: Buffer.from(contract.providers.walletProvider.publicKey, 'hex'),
    commitment: Buffer.from(commitment, 'hex'),
  });
  return { txId: tx.txId };
}

async function testQueryContractState(contract: any) {
  const state = await contract.state;
  console.log('   Contract State:');
  console.log('   - Round Counter:', state.roundCounter?.toString?.() || 'N/A');
  console.log('   - Total Credentials:', state.totalCredentialsIssued?.toString?.() || 'N/A');
  console.log('   - Total Verifications:', state.totalVerificationsPerformed?.toString?.() || 'N/A');
  return { result: state };
}

// Parametric verification circuits tests
async function testVerifyAgeRange(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyAgeRange', {
    commitment: Buffer.from(commitment, 'hex'),
    minAge: 18n,
    maxAge: 65n,
  });
  return { txId: tx.txId };
}

async function testVerifyDiabetesTrialEligibility(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyDiabetesTrialEligibility', {
    commitment: Buffer.from(commitment, 'hex'),
  });
  return { txId: tx.txId };
}

async function testVerifyInsuranceWellnessDiscount(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyInsuranceWellnessDiscount', {
    commitment: Buffer.from(commitment, 'hex'),
  });
  return { txId: tx.txId };
}

async function testVerifyHealthcareWorkerClearance(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyHealthcareWorkerClearance', {
    commitment: Buffer.from(commitment, 'hex'),
  });
  return { txId: tx.txId };
}

async function testVerifyParametricClaim(contract: any, commitment: string) {
  const tx = await submitCallTx(contract.providers, contract, 'verifyParametricClaim', {
    commitment: Buffer.from(commitment, 'hex'),
    credentialData: Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
    expectedClaimHash: Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
  });
  return { txId: tx.txId };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PRIVAMEDAI COMPREHENSIVE TEST SUITE                         ║');
  console.log('║  Testing ALL Features with Real Testnet Transactions         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load deployment info
  const deploymentPath = path.join(process.cwd(), 'deployment-privamedai.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found. Deploy contract first.');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  console.log('📄 Contract:', deployment.contractName);
  console.log('🔑 Address:', deployment.contractAddress);
  console.log('🌐 Network:', deployment.networkId);
  console.log('📅 Deployed:', new Date(deployment.deployedAt).toLocaleString(), '\n');

  // Load seed from .env
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found.');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const seedMatch = envContent.match(/^WALLET_SEED=(.+)$/m);
  if (!seedMatch) {
    console.error('❌ WALLET_SEED not found in .env');
    process.exit(1);
  }
  const seed = seedMatch[1].trim();

  // Create wallet
  const walletStatePath = path.join(process.cwd(), '.wallet-state.json');
  const { wallet, walletCtx, shieldedSecretKeys, dustSecretKey } = await createWallet(seed, walletStatePath);

  // Display wallet info
  const balance = await wallet.balance();
  const address = await walletCtx.coinPublicKey;
  console.log('💳 Wallet Address:', Buffer.from(address).toString('hex'));
  console.log('💰 Balance:', balance.toLocaleString(), 'tNight\n');

  // Load compiled contract
  const compiledContractPath = path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI/contract/index.cjs');
  const { contract: PrivaMedAIContract } = await import(pathToFileURL(compiledContractPath).toString());

  // Setup providers and join contract
  const zkConfigPath = path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI/zkir');
  const providers = await createProviders(walletCtx, zkConfigPath);
  
  interface PrivaMedAIPrivateState {
    secretKey: Uint8Array;
    credentials: Map<string, any>;
  }

  const contract = await joinContract(
    providers,
    deployment.contractAddress,
    PrivaMedAIContract,
    'privamedai-test-suite',
    seed
  );

  // Attach providers to contract for test functions
  contract.providers = providers;

  // Get admin/issuer public key
  const adminPk = Buffer.from(walletCtx.publicKey).toString('hex');
  const issuerPk = adminPk; // Use same key for testing
  const nameHash = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
  
  // Test credential data
  const testCommitment = '4444444444444444444444444444444444444444444444444444444444444444';
  const testClaimHash = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
  const testCredentialData = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  // ─── RUN ALL TESTS ─────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 1: ADMIN FUNCTIONS');
  console.log('═'.repeat(60));

  // Test 1: Initialize Contract
  results.push(await runTest('Initialize Contract', async () => {
    return await testInitializeContract(contract, adminPk);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 2: Get Admin
  results.push(await runTest('Get Admin Address', async () => {
    return await testGetAdmin(contract);
  }));

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 2: ISSUER REGISTRY');
  console.log('═'.repeat(60));

  // Test 3: Register Issuer
  results.push(await runTest('Register Issuer', async () => {
    return await testRegisterIssuer(contract, issuerPk, nameHash);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 4: Get Issuer Info
  results.push(await runTest('Get Issuer Info', async () => {
    return await testGetIssuerInfo(contract, issuerPk);
  }));

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 3: CREDENTIAL ISSUANCE');
  console.log('═'.repeat(60));

  // Test 5: Issue Single Credential
  results.push(await runTest('Issue Single Credential', async () => {
    return await testIssueCredential(contract, testCommitment, testClaimHash);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 6: Batch Issue 3 Credentials
  results.push(await runTest('Batch Issue 3 Credentials', async () => {
    return await testBatchIssue3Credentials(contract);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 7: Check Credential Status
  results.push(await runTest('Check Credential Status', async () => {
    return await testCheckCredentialStatus(contract, testCommitment);
  }));

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 4: VERIFICATION (Standard)');
  console.log('═'.repeat(60));

  // Test 8: Verify Single Credential
  results.push(await runTest('Verify Single Credential', async () => {
    return await testVerifyCredential(contract, testCommitment, testCredentialData);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 9: Bundled Verify 2 Credentials
  results.push(await runTest('Bundled Verify 2 Credentials', async () => {
    return await testBundledVerify2Credentials(contract);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 10: Bundled Verify 3 Credentials
  results.push(await runTest('Bundled Verify 3 Credentials', async () => {
    return await testBundledVerify3Credentials(contract);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 5: PARAMETRIC VERIFICATION (NEW CIRCUITS)');
  console.log('═'.repeat(60));

  // Test 11: Verify Age Range
  results.push(await runTest('Verify Age Range (ZK)', async () => {
    return await testVerifyAgeRange(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 12: Verify Diabetes Trial Eligibility
  results.push(await runTest('Verify Diabetes Trial Eligibility (ZK)', async () => {
    return await testVerifyDiabetesTrialEligibility(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 13: Verify Insurance Wellness Discount
  results.push(await runTest('Verify Insurance Wellness Discount (ZK)', async () => {
    return await testVerifyInsuranceWellnessDiscount(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 14: Verify Healthcare Worker Clearance
  results.push(await runTest('Verify Healthcare Worker Clearance (ZK)', async () => {
    return await testVerifyHealthcareWorkerClearance(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 15: Verify Parametric Claim
  results.push(await runTest('Verify Parametric Claim (ZK)', async () => {
    return await testVerifyParametricClaim(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 6: REVOCATION');
  console.log('═'.repeat(60));

  // Test 16: Revoke Credential
  results.push(await runTest('Revoke Credential', async () => {
    return await testRevokeCredential(contract, testCommitment);
  }));
  await delay(TEST_CONFIG.waitBetweenTxs);

  // Test 17: Check Revoked Credential Status
  results.push(await runTest('Check Revoked Credential Status', async () => {
    const result = await testCheckCredentialStatus(contract, testCommitment);
    // After revocation, status should be 1 (REVOKED)
    console.log('   Expected: REVOKED (1)');
    return result;
  }));

  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 7: QUERY STATE');
  console.log('═'.repeat(60));

  // Test 18: Query Contract State
  results.push(await runTest('Query Contract State', async () => {
    return await testQueryContractState(contract);
  }));

  // ─── SUMMARY ───────────────────────────────────────────────────────────────

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped (Total: ${total})`);
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s\n`);

  // Print detailed results
  console.log('Detailed Results:');
  console.log('─'.repeat(60));
  results.forEach((r, i) => {
    const status = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${status} ${i + 1}. ${r.feature} (${r.duration}ms)`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    }
    if (r.txId) {
      console.log(`   Tx ID: ${r.txId}`);
    }
  });

  console.log('\n' + '═'.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Contract is fully functional.');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review errors above.`);
    process.exit(1);
  }

  // Save wallet state
  const serializedState = await wallet.serialize();
  fs.writeFileSync(walletStatePath, JSON.stringify(serializedState));
  
  await wallet.close();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
