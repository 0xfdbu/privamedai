#!/usr/bin/env node
/**
 * Quick setup script to initialize contract and register issuer
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
import { witnesses, createPrivaMedAIPrivateState } from '../contract/src/witnesses-privamedai.js';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

setNetworkId('preprod');

const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

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
  } else {
    console.log('🔄 Starting wallet from scratch...');
    wallet = await WalletFacade.init({
      configuration: walletConfig,
      shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (config) => UnshieldedWallet({
        networkId,
        indexerClientConnection: config.indexerClientConnection,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (config) => DustWallet({
        ...config,
        costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
      }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
    });
  }
  
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, restored: fs.existsSync(walletStatePath) };
}

async function createProviders(walletCtx: any, zkConfigPath: string) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));

  const coinPublicKey = state.shielded.coinPublicKey.toHexString();
  const encPublicKey = state.shielded.encryptionPublicKey.toHexString();

  const walletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
  };

  const midnightProvider = {
    submitTx: async (tx: any) => {
      return await walletCtx.wallet.submitTransaction(tx);
    },
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-private-state',
      walletProvider,
      privateStoragePasswordProvider: async () => 'PrivaMedAI-Secure-Store-2025!',
      accountId: coinPublicKey,
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      PrivaMedAI Setup - Initialize & Register Issuer         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaMedAI');
  const walletStatePath = path.join(repoRoot, '.wallet-state-setup.json');
  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');

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

  // Load deployment
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found. Deploy first: npm run deploy:privamedai');
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  console.log(`📄 Contract: ${deployment.contractAddress}\n`);

  // Load contract
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled!');
    process.exit(1);
  }
  const PrivaMedAI = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAI.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // Create wallet
  console.log('👛 Setting up wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  // Wait for sync
  console.log('⏳ Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  console.log('✅ Wallet synced!\n');

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

  // Create providers
  const providers = await createProviders(walletCtx, zkConfigPath);

  // Join contract
  console.log('🔗 Connecting to contract...');
  const contract = await findDeployedContract(providers, {
    compiledContract,
    contractAddress: deployment.contractAddress,
    privateStateId: 'privaMedAISetupState',
    initialPrivateState: createPrivaMedAIPrivateState(),
  });
  console.log('✅ Connected to contract!\n');

  // Get the shielded coin public key from wallet state
  const state = await Rx.firstValueFrom(walletCtx.wallet.state());
  // The coinPublicKey is a ShieldedCoinPublicKey object with toHexString() and bytes property
  const publicKeyHex = state.shielded.coinPublicKey.toHexString();
  // Remove '0x' prefix if present and get raw bytes
  const publicKeyBytes = Buffer.from(publicKeyHex.replace('0x', ''), 'hex');

  // Step 1: Initialize contract
  console.log('Step 1: Initializing contract with admin...');
  try {
    const initTx = await submitCallTx(providers, {
      compiledContract,
      contractAddress: deployment.contractAddress,
      circuitId: 'initialize',
      privateStateId: 'privaMedAISetupState',
      args: [publicKeyBytes],
    });
    console.log('✅ Contract initialized!\n');
  } catch (err: any) {
    if (err.message?.includes('Contract is already initialized')) {
      console.log('ℹ️  Contract already initialized\n');
    } else {
      console.warn('⚠️  Initialize error:', err.message);
    }
  }

  // Step 2: Register issuer
  console.log('Step 2: Registering wallet as issuer...');
  try {
    // Create a simple name hash (32 bytes)
    const nameHashBytes = Buffer.alloc(32);
    nameHashBytes.write('Admin Issuer');
    const nameHash = { bytes: nameHashBytes };
    const registerTx = await submitCallTx(providers, {
      compiledContract,
      contractAddress: deployment.contractAddress,
      circuitId: 'registerIssuer',
      privateStateId: 'privaMedAISetupState',
      args: [publicKeyBytes, publicKeyBytes, nameHashBytes],
    });
    console.log('✅ Issuer registered!\n');
  } catch (err: any) {
    if (err.message?.includes('Issuer already registered')) {
      console.log('ℹ️  Issuer already registered\n');
    } else {
      console.warn('⚠️  Register error:', err.message);
    }
  }

  // Step 3: Activate issuer
  console.log('Step 3: Activating issuer...');
  try {
    const activateTx = await submitCallTx(providers, {
      compiledContract,
      contractAddress: deployment.contractAddress,
      circuitId: 'updateIssuerStatus',
      privateStateId: 'privaMedAISetupState',
      args: [publicKeyBytes, publicKeyBytes, 1], // 1 = ACTIVE
    });
    console.log('✅ Issuer activated!\n');
  } catch (err: any) {
    if (err.message?.includes('Status is already')) {
      console.log('ℹ️  Issuer already active\n');
    } else {
      console.warn('⚠️  Activate error:', err.message);
    }
  }

  console.log('🎉 Setup complete! Your wallet is now ready to issue credentials.');
  console.log(`\nIssuer Public Key: ${publicKeyHex}`);
  console.log(`Contract Address: ${deployment.contractAddress}\n`);

  await walletCtx.wallet.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
