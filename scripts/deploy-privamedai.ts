#!/usr/bin/env node
/**
 * PrivaMedAI Contract Deployment Script with Retry Logic
 * Uses 24-word BIP39 mnemonic to deploy to Preprod
 * 
 * Usage: npx tsx scripts/deploy-privamedai.ts
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
import * as bip39 from '@scure/bip39';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

// @ts-expect-error - Polyfill WebSocket for Node.js
globalThis.WebSocket = WebSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const NETWORK_CONFIG = {
  networkId: 'preprod' as const,
  indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServerUri: 'http://localhost:6300',
  relayUri: 'wss://rpc.preprod.midnight.network',
};

setNetworkId(NETWORK_CONFIG.networkId);

// Your 24-word mnemonic
const MNEMONIC = 'jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Convert BIP39 mnemonic to hex seed (async - matches Lace wallet derivation)
async function mnemonicToHexSeed(mnemonic: string): Promise<string> {
  const words = mnemonic.trim().split(/\s+/);
  const seed = await bip39.mnemonicToSeed(words.join(' '));
  return Buffer.from(seed).toString('hex');
}

// Derive HD wallet keys
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

// Retry wrapper for async operations
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    operationName: string;
  }
): Promise<T> {
  const { maxRetries = 5, delayMs = 5000, backoffMultiplier = 1.5, operationName } = options;
  
  let lastError: Error | undefined;
  let currentDelay = delayMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  [${operationName}] Attempt ${attempt}/${maxRetries}...`);
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.log(`  [${operationName}] Failed: ${error.message?.slice(0, 100) || error}`);
      
      if (attempt < maxRetries) {
        console.log(`  [${operationName}] Retrying in ${currentDelay/1000}s...`);
        await sleep(currentDelay);
        currentDelay = Math.min(currentDelay * backoffMultiplier, 60000); // Max 60s delay
      }
    }
  }
  
  throw new Error(`[${operationName}] Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SETUP
// ═══════════════════════════════════════════════════════════════════════════════

async function buildWallet() {
  console.log('\n🔐 Converting BIP39 mnemonic to seed...');
  const seed = await mnemonicToHexSeed(MNEMONIC);
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
      relayURL: new URL(NETWORK_CONFIG.relayUri.replace(/\/$/, '')),
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

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, seed };
}

// Wait for wallet sync with timeout
async function waitForSync(wallet: any, timeoutMs: number = 300000) {
  console.log('\n⏳ Waiting for wallet to sync...');
  
  return withRetry(async () => {
    const syncedState = await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(3000),
        Rx.filter((s: any) => s.isSynced),
        Rx.timeout({ first: timeoutMs })
      )
    );
    return syncedState;
  }, { operationName: 'WalletSync', maxRetries: 5, delayMs: 15000 });
}

// Check balances
async function ensureDustRegistered(wallet: any, syncedState: any) {
  console.log('\n💰 Checking balances...');
  
  // Check unshielded tDUST balance (for fees)
  const tDustBalance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log('   tDUST balance:', tDustBalance.toLocaleString());
  
  if (tDustBalance > 0n) {
    console.log('✅ Sufficient balance for deployment');
    return;
  }
  
  console.log('⚠️  Low tDUST balance. You may need tokens from faucet:');
  console.log('   https://faucet.preprod.midnight.network/');
  console.log('   Your address:', syncedState.unshielded.address);
  
  // Continue anyway - deployment might still work
  console.log('   Continuing with deployment attempt...');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function deploy() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   PrivaMedAI Contract Deployment - Preprod Network           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  let wallet: any;
  
  try {
    // Initialize wallet
    const { wallet: w, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, seed } = await buildWallet();
    wallet = w;

    // Wait for wallet to sync with retry
    const syncedState = await waitForSync(wallet);
    console.log('✅ Wallet synced');

    // Check unshielded balance
    const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log('   tDUST balance:', balance.toLocaleString());

    // Ensure DUST is available
    await ensureDustRegistered(wallet, syncedState);

    // Load compiled contract
    console.log('\n📦 Loading compiled contract...');
    const contractPath = path.resolve(process.cwd(), 'contract/dist/managed/PrivaMedAI/contract/index.js');
    
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Contract not found at ${contractPath}. Run: npm run build in contract/`);
    }
    
    const contractModule = await import(contractPath);
    console.log('✅ Contract loaded');

    // Create compiled contract
    const zkConfigPath = path.resolve(process.cwd(), 'contract/dist/managed/PrivaMedAI');
    const compiledContract = CompiledContract.make('PrivaMedAI', contractModule.Contract).pipe(
      CompiledContract.withWitnesses({
        local_secret_key: ({ privateState }: any) => [privateState, new Uint8Array(32)],
        get_private_health_claim: ({ privateState }: any) => [
          privateState,
          { age: 0n, conditionCode: 0n, prescriptionCode: 0n }
        ],
      }),
      CompiledContract.withCompiledFileAssets(zkConfigPath),
    );

    // Create providers
    console.log('🔌 Setting up providers...');
    const walletProvider = {
      getCoinPublicKey: () => shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => shieldedSecretKeys.encryptionPublicKey,
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
    console.log('✅ Providers ready');

    console.log('\n👤 Admin public key:', syncedState.shielded.coinPublicKey.toHexString().slice(0, 32) + '...');

    // Deploy contract with retry
    console.log('\n🚀 Deploying contract (this may take 60-120 seconds)...');
    console.log('   ⏳ Generating ZK proofs and submitting transaction...\n');
    
    const deployed = await withRetry(async () => {
      return deployContract(providers, {
        compiledContract,
        privateStateId: 'privamedai-private-state',
        initialPrivateState: {},
      });
    }, { operationName: 'ContractDeployment', maxRetries: 3, delayMs: 10000 });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    const txId = deployed.deployTxData.public.txId;
    const blockHeight = deployed.deployTxData.public.blockHeight;

    console.log('\n✅ Contract deployed successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Contract Address:', contractAddress);
    console.log('Transaction ID:', txId);
    console.log('Block Height:', blockHeight.toString());
    console.log('═══════════════════════════════════════════════════════════════');

    // Save deployment info
    const deploymentInfo = {
      network: NETWORK_CONFIG.networkId,
      contractAddress,
      contractName: 'PrivaMedAI',
      txId,
      blockHeight: blockHeight.toString(),
      adminAddress: unshieldedKeystore.getBech32Address(),
      adminPubKey: syncedState.shielded.coinPublicKey.toHexString(),
      deployedAt: new Date().toISOString(),
      features: [
        'Issuer Registry with open registration',
        'Privacy-preserving credentials with selective disclosure',
        'Batch credential issuance',
        'Credential verification',
        'Role-specific verification: FreeHealthClinic (age only)',
        'Role-specific verification: Pharmacy (prescription only)', 
        'Role-specific verification: Hospital (age + condition)',
      ],
    };

    const deploymentPath = path.resolve(process.cwd(), 'scripts/deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log('\n💾 Deployment info saved to scripts/deployment.json');

    // Update environment files
    console.log('\n📝 Updating environment files...');
    
    const rootEnvPath = path.resolve(process.cwd(), '.env');
    const frontendEnvPath = path.resolve(process.cwd(), 'frontend/.env');
    
    // Update root .env
    if (fs.existsSync(rootEnvPath)) {
      let rootEnv = fs.readFileSync(rootEnvPath, 'utf8');
      rootEnv = rootEnv.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${contractAddress}`);
      fs.writeFileSync(rootEnvPath, rootEnv);
      console.log('   ✅ Updated .env');
    }
    
    // Update frontend .env
    if (fs.existsSync(frontendEnvPath)) {
      let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
      frontendEnv = frontendEnv.replace(/VITE_CONTRACT_ADDRESS=.*/g, `VITE_CONTRACT_ADDRESS=${contractAddress}`);
      fs.writeFileSync(frontendEnvPath, frontendEnv);
      console.log('   ✅ Updated frontend/.env');
    }

    // Save seed securely info
    console.log('\n🔐 IMPORTANT: Seed backup (store securely!):');
    console.log(`   ${seed.slice(0, 16)}...${seed.slice(-16)} (${seed.length/2} bytes)`);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 Deployment Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nNext steps:');
    console.log('   1. Verify contract on explorer (when available)');
    console.log('   2. Register as issuer: npm run cli');
    console.log('   3. Start frontend: cd frontend && npm run dev');
    console.log('\n');

  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.message?.includes('WebSocket is not connected') || 
        error.message?.includes('1006')) {
      console.error('\n⚠️  Network connectivity issue detected.');
      console.error('   This is likely a temporary Preprod network issue.');
      console.error('   Please wait a few minutes and try again.');
    }
    process.exit(1);
  } finally {
    if (wallet) {
      console.log('👋 Stopping wallet...');
      await wallet.stop().catch(() => {});
    }
  }
}

// Run deployment
deploy();
