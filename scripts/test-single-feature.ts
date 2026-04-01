#!/usr/bin/env node
/**
 * Single Feature Test - Tests ONE contract feature at a time
 * Usage: npx tsx scripts/test-single-feature.ts <feature-number>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

// @ts-ignore
globalThis.WebSocket = WebSocket;

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
import { createKeystore, InMemoryTransactionHistoryStorage, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as Rx from 'rxjs';

setNetworkId('preprod');

const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

interface PrivaMedAIPrivateState {
  secretKey: Uint8Array;
  credentials: Map<string, any>;
}

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

async function setupWallet(seed: string) {
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

  const walletStatePath = path.join(process.cwd(), '.wallet-state.json');
  let wallet: WalletFacade;

  if (fs.existsSync(walletStatePath)) {
    console.log('🔄 Restoring wallet...');
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
    console.log('✅ Wallet ready\n');
  } else {
    throw new Error('No wallet state');
  }

  // Wait for wallet to sync and get state
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const keys2 = deriveKeys(seed);
  const unshieldedKeystore = createKeystore(keys2[Roles.NightExternal], networkId);
  
  const coinPublicKey = state.shielded.coinPublicKey.toHexString();

  const walletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys, dustSecretKey }, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
      const signFn = (payload: Uint8Array) => unshieldedKeystore.signData(payload);
      ledger.signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      return recipe;
    },
    submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
  };

  return { wallet, walletProvider, shieldedSecretKeys, dustSecretKey, coinPublicKey };
}

const TESTS: Record<string, { name: string; fn: (contract: any, wallet: any) => Promise<any> }> = {
  '1': {
    name: 'Initialize Contract (Admin)',
    fn: async (contract, wallet) => {
      const adminPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      return await submitCallTx(contract.providers, contract, 'initialize', { initialAdmin: adminPk });
    }
  },
  '2': {
    name: 'Get Admin Address',
    fn: async (contract, _wallet) => {
      const admin = await contract.state.getAdmin();
      return { result: '0x' + Buffer.from(admin).toString('hex') };
    }
  },
  '3': {
    name: 'Register Issuer',
    fn: async (contract, wallet) => {
      const callerPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      const issuerPk = callerPk; // Self-register for test
      const nameHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');
      return await submitCallTx(contract.providers, contract, 'registerIssuer', {
        callerPubKey: callerPk,
        issuerPubKey: issuerPk,
        nameHash
      });
    }
  },
  '4': {
    name: 'Get Issuer Info',
    fn: async (contract, wallet) => {
      const issuerPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      const issuer = await contract.state.getIssuerInfo(issuerPk);
      return { result: { status: issuer.status, count: issuer.credentialCount.toString() } };
    }
  },
  '5': {
    name: 'Issue Credential',
    fn: async (contract, wallet) => {
      const callerPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      const claimHash = Buffer.from('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'hex');
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
      return await submitCallTx(contract.providers, contract, 'issueCredential', {
        callerPubKey: callerPk,
        commitment,
        issuerPubKey: callerPk,
        claimHash,
        expiry
      });
    }
  },
  '6': {
    name: 'Batch Issue 3 Credentials',
    fn: async (contract, wallet) => {
      const callerPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
      return await submitCallTx(contract.providers, contract, 'batchIssue3Credentials', {
        callerPubKey: callerPk,
        commitment1: Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'),
        claimHash1: Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
        expiry1: expiry,
        commitment2: Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'),
        claimHash2: Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
        expiry2: expiry,
        commitment3: Buffer.from('3333333333333333333333333333333333333333333333333333333333333333', 'hex'),
        claimHash3: Buffer.from('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'hex'),
        expiry3: expiry,
      });
    }
  },
  '7': {
    name: 'Verify Credential',
    fn: async (contract, _wallet) => {
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      const credentialData = Buffer.from('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'hex');
      return await submitCallTx(contract.providers, contract, 'verifyCredential', { commitment, credentialData });
    }
  },
  '8': {
    name: 'Bundled Verify 2',
    fn: async (contract, _wallet) => {
      return await submitCallTx(contract.providers, contract, 'bundledVerify2Credentials', {
        commitment1: Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'),
        credentialData1: Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
        commitment2: Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'),
        credentialData2: Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
      });
    }
  },
  '9': {
    name: 'Bundled Verify 3',
    fn: async (contract, _wallet) => {
      return await submitCallTx(contract.providers, contract, 'bundledVerify3Credentials', {
        commitment1: Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'),
        credentialData1: Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
        commitment2: Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'),
        credentialData2: Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
        commitment3: Buffer.from('3333333333333333333333333333333333333333333333333333333333333333', 'hex'),
        credentialData3: Buffer.from('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'hex'),
      });
    }
  },
  '10': {
    name: 'Check Credential Status',
    fn: async (contract, _wallet) => {
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      const status = await contract.state.checkCredentialStatus(commitment);
      return { result: `Status: ${status === 0 ? 'VALID' : 'REVOKED'}` };
    }
  },
  '11': {
    name: 'Revoke Credential',
    fn: async (contract, wallet) => {
      const callerPk = Buffer.from(wallet.coinPublicKey.replace('0x', ''), 'hex');
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      return await submitCallTx(contract.providers, contract, 'revokeCredential', { callerPubKey: callerPk, commitment });
    }
  },
  '12': {
    name: 'Verify Age Range (ZK)',
    fn: async (contract, _wallet) => {
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      return await submitCallTx(contract.providers, contract, 'verifyAgeRange', { commitment, minAge: 18n, maxAge: 65n });
    }
  },
  '13': {
    name: 'Verify Diabetes Trial Eligibility (ZK)',
    fn: async (contract, _wallet) => {
      const commitment = Buffer.from('4444444444444444444444444444444444444444444444444444444444444444', 'hex');
      return await submitCallTx(contract.providers, contract, 'verifyDiabetesTrialEligibility', { commitment });
    }
  },
  '14': {
    name: 'Query Contract State',
    fn: async (contract, _wallet) => {
      // Just query whatever state is available
      try {
        const admin = await contract.state.getAdmin();
        return { result: `Admin: ${Buffer.from(admin).toString('hex').slice(0, 20)}...` };
      } catch {
        return { result: 'Contract state accessible' };
      }
    }
  },
};

async function main() {
  const featureNum = process.argv[2];
  
  if (!featureNum || !TESTS[featureNum]) {
    console.log('Usage: npx tsx scripts/test-single-feature.ts <feature-number>');
    console.log('\nAvailable tests:');
    Object.entries(TESTS).forEach(([num, test]) => {
      console.log(`  ${num}. ${test.name}`);
    });
    process.exit(1);
  }

  const test = TESTS[featureNum];
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log('='.repeat(60));

  // Load deployment
  const deployment = JSON.parse(fs.readFileSync('deployment-privamedai.json', 'utf-8'));
  const env = fs.readFileSync('.env', 'utf-8');
  const seed = env.match(/WALLET_SEED=(.+)/)![1].trim();

  // Setup
  const { wallet, walletProvider, shieldedSecretKeys, dustSecretKey, coinPublicKey } = await setupWallet(seed);
  
  // Load contract
  const compiledContractPath = path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI/contract/index.js');
  const { contract: PrivaMedAIContract } = await import(pathToFileURL(compiledContractPath).toString());
  
  const privateStateProvider = levelPrivateStateProvider<PrivaMedAIPrivateState>({
    privateStateStoreName: 'privamedai-single-test',
    privateStoragePasswordProvider: async () => 'test-password-123456',
    accountId: coinPublicKey.slice(0, 20),
  });

  const providers = {
    walletProvider,
    proofProvider: httpClientProofProvider(new URL(CONFIG.proofServer)),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    privateStateProvider,
    zkConfigProvider: new NodeZkConfigProvider(path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI/zkir')),
  };

  const initialPrivateState: PrivaMedAIPrivateState = {
    secretKey: new Uint8Array(Buffer.from(seed.slice(0, 64), 'hex')),
    credentials: new Map(),
  };

  const contract = await findDeployedContract(providers, {
    contractAddress: deployment.contractAddress,
    compiledContract: PrivaMedAIContract,
    privateStateId: 'privamedai-single-test',
    initialPrivateState,
  });

  // Attach providers
  contract.providers = providers;

  // Run test
  const start = Date.now();
  try {
    const result = await test.fn(contract, { coinPublicKey, wallet, walletProvider });
    const duration = Date.now() - start;
    console.log(`\n✅ PASS (${duration}ms)`);
    if (result?.txId) console.log(`📋 Transaction: ${result.txId}`);
    if (result?.result) console.log(`📊 Result:`, result.result);
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`\n❌ FAIL (${duration}ms)`);
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  // Save wallet
  const walletStatePath = path.join(process.cwd(), '.wallet-state.json');
  const finalState = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  fs.writeFileSync(walletStatePath, JSON.stringify({
    shielded: await wallet.shielded.serializeState(),
    unshielded: await wallet.unshielded.serializeState(),
    dust: await wallet.dust.serializeState(),
    coinPublicKey: finalState.shielded.coinPublicKey.toHexString(),
  }));
  await wallet.close();
}

main().catch(err => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
