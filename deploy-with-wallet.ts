#!/usr/bin/env node
/**
 * PrivaMedAI Contract Deployment Script with Wallet
 * Uses 24-word BIP39 mnemonic to deploy contract
 * 
 * Based on:
 * - https://github.com/midnightntwrk/midnight-js/blob/main/testkit-js/testkit-js/src/wallet/wallet-seed.ts
 * - https://github.com/midnightntwrk/example-counter/blob/main/counter-cli/src/api.ts
 */

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { mnemonicToSeedSync } from '@scure/bip39';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import * as fs from 'fs';

// @ts-expect-error - Polyfill WebSocket for Node.js
globalThis.WebSocket = WebSocket;

// Network configuration
const NETWORK_CONFIG = {
  networkId: 'preprod' as const,
  indexerUri: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  proofServerUri: 'http://localhost:6300',
  relayUri: 'wss://rpc.preprod.midnight.network',
};

setNetworkId(NETWORK_CONFIG.networkId);

// Your 24-word mnemonic
const MNEMONIC = 'jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular';

// Convert BIP39 mnemonic to hex seed
// Reference: https://github.com/midnightntwrk/midnight-js/blob/main/testkit-js/testkit-js/src/wallet/wallet-seed.ts
function mnemonicToHexSeed(mnemonic: string): string {
  return Buffer.from(mnemonicToSeedSync(mnemonic)).toString('hex');
}

// Derive HD wallet keys for all three roles (Zswap, NightExternal, Dust)
// Reference: https://github.com/midnightntwrk/example-counter/blob/main/counter-cli/src/api.ts
function deriveKeysFromSeed(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
}

// Build wallet from mnemonic
async function buildWallet() {
  console.log('🔐 Converting BIP39 mnemonic to seed...');
  const seed = mnemonicToHexSeed(MNEMONIC);
  console.log(`   Seed derived: ${seed.slice(0, 32)}... (${seed.length / 2} bytes)`);
  
  console.log('🔐 Deriving wallet keys...');
  const keys = deriveKeysFromSeed(seed);
  
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], NETWORK_CONFIG.networkId);

  console.log('🔐 Initializing wallet...');
  const wallet = await WalletFacade.init({
    configuration: {
      networkId: NETWORK_CONFIG.networkId,
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
      relayURL: new URL(NETWORK_CONFIG.relayUri),
      provingServerUrl: new URL(NETWORK_CONFIG.proofServerUri),
      indexerClientConnection: {
        indexerHttpUrl: NETWORK_CONFIG.indexerUri,
        indexerWsUrl: NETWORK_CONFIG.indexerWsUri,
      },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    },
    shielded: (config: any) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config: any) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config: any) => DustWallet(config).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });

  await wallet.start(shieldedSecretKeys, dustSecretKey);

  console.log('✅ Wallet initialized');
  console.log('   Address:', unshieldedKeystore.getBech32Address());

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

// Wait for wallet sync
async function waitForSync(wallet: any) {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced)
    )
  );
}

// Deploy the contract
async function deploy() {
  try {
    console.log('🚀 Starting PrivaMedAI contract deployment...\n');

    // Initialize wallet
    const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await buildWallet();

    // Wait for wallet to sync
    console.log('\n⏳ Waiting for wallet to sync...');
    const syncedState = await waitForSync(wallet);
    console.log('✅ Wallet synced\n');

    // Check balance
    const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log('💰 Wallet balance:', balance.toLocaleString(), 'tDUST\n');

    if (balance === 0n) {
      console.warn('⚠️  Wallet shows 0 balance.');
      console.warn('   Please get tDUST tokens from:');
      console.warn('   https://faucet.preprod.midnight.network/');
      console.warn('   Your address:', unshieldedKeystore.getBech32Address());
      console.warn('\n   Continuing anyway...\n');
    }

    // Load compiled contract
    console.log('📦 Loading compiled contract...');
    const contractModule = await import('./contract/dist/managed/PrivaMedAI/contract/index.js');
    console.log('✅ Contract loaded\n');

    // Create compiled contract
    const zkConfigPath = './contract/dist/managed/PrivaMedAI';
    const compiledContract = CompiledContract.make('PrivaMedAI', contractModule.Contract).pipe(
      CompiledContract.withCompiledFileAssets(zkConfigPath),
      CompiledContract.withWitnesses({
        local_secret_key: () => new Uint8Array(32),
      }),
    );

    // Create wallet and midnight provider
    // Reference: https://github.com/midnightntwrk/example-counter/blob/main/counter-cli/src/api.ts
    console.log('🔌 Setting up providers...');
    const walletProvider = {
      getCoinPublicKey: () => syncedState.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => syncedState.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx: any, ttl?: Date) {
        const recipe = await wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys, dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
        );
        return wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => wallet.submitTransaction(tx),
    };

    // Create providers
    const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
    const publicDataProvider = indexerPublicDataProvider(
      NETWORK_CONFIG.indexerUri,
      NETWORK_CONFIG.indexerWsUri,
    );
    const proofProvider = httpClientProofProvider(NETWORK_CONFIG.proofServerUri, zkConfigProvider);

    const providers = {
      privateStateProvider: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
        setContractAddress: async () => {},
        setSigningKey: async () => {},
      },
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider: walletProvider,
    };
    console.log('✅ Providers ready\n');

    console.log('👤 Admin public key:', syncedState.shielded.coinPublicKey.toHexString().slice(0, 32) + '...');

    // Deploy contract
    console.log('\n🚀 Deploying contract (this may take 30-60 seconds)...');
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'privamedai-private-state',
      initialPrivateState: {},
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    const txId = deployed.deployTxData.public.txId;
    const blockHeight = deployed.deployTxData.public.blockHeight;

    console.log('\n✅ Contract deployed successfully!');
    console.log('═══════════════════════════════════════════════════');
    console.log('Contract Address:', contractAddress);
    console.log('Transaction ID:', txId);
    console.log('Block Height:', blockHeight.toString());
    console.log('═══════════════════════════════════════════════════\n');

    // Save deployment info
    const deploymentInfo = {
      network: NETWORK_CONFIG.networkId,
      contractAddress,
      contractName: 'PrivaMedAI',
      txId,
      blockHeight: blockHeight.toString(),
      adminAddress: unshieldedKeystore.getBech32Address(),
      deployedAt: new Date().toISOString(),
      features: [
        'Issuer Registry with open registration',
        'Privacy-preserving credentials',
        'Batch credential issuance',
        'Credential verification',
      ],
    };

    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('💾 Deployment info saved to deployment.json\n');

    console.log('📝 Next steps:');
    console.log('   1. Update frontend/.env with VITE_CONTRACT_ADDRESS=' + contractAddress);
    console.log('   2. Update root .env with CONTRACT_ADDRESS=' + contractAddress);
    console.log('   3. Restart the frontend: npm run dev');
    console.log('   4. Go to Registration tab and register as issuer\n');

    // Stop wallet
    await wallet.stop();
    console.log('👋 Done!');

  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deploy();
