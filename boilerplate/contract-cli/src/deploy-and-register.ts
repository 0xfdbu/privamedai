#!/usr/bin/env node
/**
 * Deploy fresh contract and register an issuer
 * 
 * Uses the new modular wallet SDK pattern from example-counter
 * Supports BIP39 mnemonics and proper Preprod address derivation
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try loading .env from multiple locations (repo root or parent of dist/)
const envPaths = [
  path.join(__dirname, '..', '..', '..', '.env'),  // From dist/ to repo root
  path.join(__dirname, '..', '.env'),              // From src/ to repo root
  path.join(process.cwd(), '.env'),                // Current working directory
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
if (!envLoaded) {
  console.warn('⚠️  No .env file found');
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
import { ContractAnalyzer } from './contract-analyzer.js';
import type { PrivaMedAIPrivateState, PrivaMedAIProviders, DeployedPrivaMedAIContract } from './common-types';

const currentDir = __dirname;

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: It's needed to enable WebSocket usage through apollo
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

// Auto-detect contract from source
const contractNames = Object.keys(contracts);
if (contractNames.length === 0) {
  throw new Error('No contract found in @midnight-ntwrk/contract');
}
const contractModule = contracts[contractNames[0]];
console.log(`🔍 Using contract: ${contractNames[0]}`);

// Pre-compile contract with ZK circuit assets (defined at module level per example-counter pattern)
const privaMedAICompiledContract = CompiledContract.make('PrivaMedAI', contractModule.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

const buildShieldedConfig = (config: any) => ({
  networkId: 'preprod',
  indexerClientConnection: {
    indexerHttpUrl: config.indexer,
    indexerWsUrl: config.indexerWS,
  },
  provingServerUrl: new URL(config.proofServer),
  relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = (config: any) => ({
  networkId: 'preprod',
  indexerClientConnection: {
    indexerHttpUrl: config.indexer,
    indexerWsUrl: config.indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = (config: any) => ({
  networkId: 'preprod',
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: config.indexer,
    indexerWsUrl: config.indexerWS,
  },
  provingServerUrl: new URL(config.proofServer),
  relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

/**
 * Convert BIP39 mnemonic to hex seed
 */
const mnemonicToHexSeed = async (mnemonic: string): Promise<string> => {
  const seedBytes = await mnemonicToSeed(mnemonic.trim());
  return Buffer.from(seedBytes).toString('hex'); // 128 chars = 64 bytes
};

/**
 * Derive HD wallet keys from hex seed
 */
const deriveKeysFromSeed = (seed: string) => {
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
};

/** Wait until the wallet has fully synced with the network */
const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

/** Wait until the wallet has a non-zero unshielded balance */
const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

/**
 * Build wallet from hex seed
 */
const buildWalletFromSeed = async (config: any, seed: string): Promise<WalletContext> => {
  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const wallet = await WalletFacade.init({
    configuration: {
      ...buildShieldedConfig(config),
      ...buildUnshieldedConfig(config),
      ...buildDustConfig(config),
    },
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  // Show address for funding
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Wallet Overview                            Network: ' + getNetworkId());
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Unshielded Address (send tDUST here):');
  console.log('  ' + unshieldedKeystore.getBech32Address());
  console.log('');
  console.log('  Fund your wallet with tDUST from the Preprod faucet:');
  console.log('  https://faucet.preprod.midnight.network/');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');

  // Wait for sync
  console.log('⏳ Waiting for wallet to sync...');
  const syncedState = await waitForSync(wallet);
  console.log('✅ Wallet synced');
  console.log('');

  // Check balance
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    console.log('⏳ Waiting for funds...');
    await waitForFunds(wallet);
    console.log('✅ Funds received');
    console.log('');
  } else {
    console.log(`💰 Balance: ${balance.toLocaleString()} tDUST`);
    console.log('');
  }

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

/**
 * Build wallet from BIP39 mnemonic
 */
const buildWalletFromMnemonic = async (config: any, mnemonic: string): Promise<WalletContext> => {
  console.log('⏳ Converting BIP39 mnemonic to seed...');
  const seed = await mnemonicToHexSeed(mnemonic);
  console.log(`   Seed derived: ${seed.substring(0, 32)}... (${seed.length/2} bytes)`);
  console.log('');
  return buildWalletFromSeed(config, seed);
};

/**
 * Create the unified WalletProvider & MidnightProvider for midnight-js.
 */
const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
};

/**
 * Configure all midnight-js providers.
 */
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
    publicDataProvider: indexerPublicDataProvider(
      'https://indexer.preprod.midnight.network/api/v4/graphql',
      'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'
    ),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider('http://127.0.0.1:6300', zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

/**
 * Deploy contract using CompiledContract pattern from example-counter
 */
const deployContractFn = async (
  providers: PrivaMedAIProviders,
  privateState: PrivaMedAIPrivateState,
): Promise<DeployedPrivaMedAIContract> => {
  logger.info('Deploying PrivaMedAI contract...');
  
  const deployed = await deployContract(providers, {
    compiledContract: privaMedAICompiledContract,
    privateStateId: 'privamedaiPrivateState',
    initialPrivateState: privateState,
    args: [],
  } as any);
  
  logger.info(`Deployed at: ${deployed.deployTxData.public.contractAddress}`);
  return deployed;
};

/**
 * Register an issuer on the deployed contract
 */
const registerIssuer = async (
  contract: DeployedPrivaMedAIContract,
  walletCtx: WalletContext,
  issuerPubKeyBytes: Uint8Array,
  nameHashBytes: Uint8Array,
): Promise<void> => {
  logger.info('Registering issuer...');
  
  // Get caller's public key from the wallet (returns hex string, convert to bytes)
  const callerPubKeyHex = walletCtx.unshieldedKeystore.getPublicKey();
  const callerPubKeyBytes = Uint8Array.from(Buffer.from(callerPubKeyHex, 'hex'));
  
  // Use type assertion to work around TypeScript inference issues
  const result = await (contract.callTx as any).registerIssuer(callerPubKeyBytes, issuerPubKeyBytes, nameHashBytes);
  
  logger.info(`Issuer registered in block ${result.public.blockHeight}`);
  logger.info(`Transaction ID: ${result.public.txId}`);
};

async function main() {
  const issuerPubKey = process.argv[2] || '525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362';
  const nameHash = process.argv[3] || '19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12';
  
  console.log('🚀 PrivaMedAI Deployment & Issuer Registration');
  console.log('==============================================');
  console.log(`Issuer to register: ${issuerPubKey}`);
  console.log('');

  // Setup logging
  const logDir = path.resolve(currentDir, '..', 'logs', 'deploy', `${new Date().toISOString()}.log`);
  logger = await createLogger(logDir);

  // Get admin seed/mnemonic
  const walletSeed = process.env.WALLET_SEED;
  if (!walletSeed) {
    console.error('❌ WALLET_SEED environment variable not set (should contain BIP39 mnemonic or hex seed)');
    process.exit(1);
  }

  // Detect if it's a hex seed (128 hex chars = 64 bytes) or BIP39 mnemonic
  const isHexSeed = /^[a-f0-9]{128}$/i.test(walletSeed.trim());

  try {
    const config = new PreprodRemoteConfig();
    
    // Build wallet from BIP39 mnemonic or hex seed
    let walletCtx: WalletContext;
    if (isHexSeed) {
      console.log('🔑 Using hex seed for wallet derivation');
      const seed = walletSeed.trim();
      console.log(`   Seed: ${seed.substring(0, 32)}... (${seed.length/2} bytes)`);
      walletCtx = await buildWalletFromSeed(config, seed);
    } else {
      console.log('🔑 Using BIP39 mnemonic for wallet derivation');
      walletCtx = await buildWalletFromMnemonic(config, walletSeed);
    }
    
    // Configure providers
    console.log('⏳ Configuring providers...');
    const providers = await configureProviders(walletCtx);
    console.log('✅ Providers configured');
    console.log('');

    // Deploy contract
    console.log('⏳ Deploying PrivaMedAI contract...');
    const privateState = createPrivaMedAIPrivateState(new Uint8Array(32).fill(1));
    const contract = await deployContractFn(providers, privateState);
    const contractAddress = contract.deployTxData.public.contractAddress;
    console.log('✅ Contract deployed!');
    console.log(`   Address: ${contractAddress}`);
    console.log(`   Tx ID: ${contract.deployTxData.public.txId}`);
    console.log('');
    
    // Initialize contract with admin
    console.log('⏳ Initializing contract with admin...');
    const adminPubKeyHex = walletCtx.unshieldedKeystore.getPublicKey();
    const adminPubKeyBytes = Uint8Array.from(Buffer.from(adminPubKeyHex, 'hex'));
    
    const initResult = await (contract.callTx as any).initialize(adminPubKeyBytes);
    console.log('✅ Contract initialized!');
    console.log(`   Block: ${initResult.public.blockHeight}`);
    console.log('');
    console.log('✅ Contract deployed!');
    console.log(`   Address: ${contractAddress}`);
    console.log(`   Tx ID: ${contract.deployTxData.public.txId}`);
    console.log('');

    // Register the issuer
    console.log('⏳ Registering issuer...');
    const issuerPubKeyBytes = Uint8Array.from(Buffer.from(issuerPubKey, 'hex'));
    const nameHashBytes = Uint8Array.from(Buffer.from(nameHash, 'hex'));
    
    await registerIssuer(contract, walletCtx, issuerPubKeyBytes, nameHashBytes);
    console.log('✅ Issuer registered successfully!');
    console.log('');

    console.log('==============================================');
    console.log('🎉 Deployment and registration complete!');
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Issuer: ${issuerPubKey}`);
    console.log('==============================================');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
