#!/usr/bin/env node
/**
 * Deploy PrivaMedAI contract to Midnight Preprod network
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForProofServer(maxAttempts = 30, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(CONFIG.proofServer, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch (err: any) {
      const errMsg = err?.cause?.code || err?.code || '';
      if (errMsg !== 'ECONNREFUSED' && errMsg !== 'UND_ERR_CONNECT_TIMEOUT') {
        return true;
      }
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`\r  Waiting for proof server... (${attempt}/${maxAttempts})   `);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

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
    console.log('Restoring wallet from saved state...');
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
    console.log('Wallet restored successfully.');
    restored = true;
  } else {
    console.log('Starting wallet sync from scratch...');
    console.log('⚠️  First sync on preprod takes 20-40 minutes. Grab a coffee! ☕');
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
    console.log('Wallet started successfully.');
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

async function createProviders(walletCtx: ReturnType<typeof createWallet> extends Promise<infer T> ? T : never, zkConfigPath: string) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

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
      privateStateStoreName: 'privamedai-private-state',
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

// ─── Main Deploy Script ───────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      Deploy PrivaMedAI to Midnight Preprod                   ║');
  console.log('║      Enterprise Health Credentials Platform                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaMedAI');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }

  // Load seed from .env
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at', envPath);
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const seedMatch = envContent.match(/^WALLET_SEED=(.+)$/m);
  if (!seedMatch) {
    console.error('❌ WALLET_SEED not found in .env');
    process.exit(1);
  }
  const seed = seedMatch[1].trim();

  // Load compiled contract
  const PrivaMedAI = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAI.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: (...args: any[]) => new Uint8Array(32),
      get_credential_data: (...args: any[]) => new Uint8Array(32),
      get_bundled_credential_data: (...args: any[]) => new Uint8Array(32),
    }),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  // Create wallet
  console.log('Creating wallet...');
  const walletCtx = await createWallet(seed, walletStatePath);

  console.log('Syncing with network...');
  const keepAlive = setInterval(() => {}, 10000);

  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
    Rx.tap({
      next: (s) => {
        const sp = s.shielded.state.progress;
        const up = s.unshielded.progress;
        const dp = s.dust.state.progress;
        console.log(`  synced:${s.isSynced} sh:${sp.isConnected} ${sp.appliedIndex}/${sp.highestRelevantWalletIndex} un:${up.isConnected} ${up.appliedIndex}/${up.highestRelevantWalletIndex} dust:${dp.isConnected} ${dp.appliedIndex}/${dp.highestRelevantWalletIndex}`);
      },
      error: (e) => console.log('  wallet state error:', e),
      complete: () => console.log('  wallet state complete'),
    }),
    Rx.throttleTime(5000),
    Rx.filter((s) => s.isSynced),
  ));

  clearInterval(keepAlive);

  // Save wallet state for faster future restarts
  if (!walletCtx.restored) {
    console.log('Saving wallet state...');
    const serializedState = {
      shielded: await walletCtx.wallet.shielded.serializeState(),
      unshielded: await walletCtx.wallet.unshielded.serializeState(),
      dust: await walletCtx.wallet.dust.serializeState(),
    };
    fs.writeFileSync(walletStatePath, JSON.stringify(serializedState));
    console.log('Wallet state saved.');
  }

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  console.log(`\nWallet Address: ${address}`);
  console.log(`Balance: ${balance.toLocaleString()} tNight\n`);

  if (balance === 0n) {
    console.error('❌ Wallet has zero balance. Fund it first via the preprod faucet.');
    await walletCtx.wallet.stop();
    process.exit(1);
  }

  // DUST setup
  console.log('Checking DUST tokens...');
  const dustState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (dustState.dust.balance(new Date()) === 0n) {
    const nightUtxos = dustState.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
    if (nightUtxos.length > 0) {
      console.log('Registering for DUST generation...');
      const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
        nightUtxos,
        walletCtx.unshieldedKeystore.getPublicKey(),
        (payload) => walletCtx.unshieldedKeystore.signData(payload),
      );
      await walletCtx.wallet.submitTransaction(await walletCtx.wallet.finalizeRecipe(recipe));
    }

    console.log('Waiting for DUST tokens...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    );
  }
  console.log('DUST tokens ready!\n');

  // Check proof server
  console.log('Checking proof server...');
  const proofServerReady = await waitForProofServer();
  if (!proofServerReady) {
    console.log('\n❌ Proof server not responding at', CONFIG.proofServer);
    console.log('Start a local proof server on port 6300 and retry.\n');
    await walletCtx.wallet.stop();
    process.exit(1);
  }
  console.log('Proof server ready!\n');

  // Deploy
  console.log('Setting up providers...');
  const providers = await createProviders(walletCtx, zkConfigPath);

  console.log('Deploying PrivaMedAI contract...\n');

  const MAX_RETRIES = 8;
  const RETRY_DELAY_MS = 15000;
  let deployed: Awaited<ReturnType<typeof deployContract>> | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract,
        privateStateId: 'privaMedAIState',
        initialPrivateState: {},
      });
      break;
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || '';
      const errCause = err?.cause?.message || err?.cause?.toString() || '';
      const fullError = `${errMsg} ${errCause}`;

      if (fullError.includes('Failed to connect to Proof Server') ||
          fullError.includes('Failed to prove') ||
          fullError.includes('127.0.0.1:6300')) {
        console.log('❌ Proof server error');
        await walletCtx.wallet.stop();
        process.exit(1);
      }

      if (fullError.includes('disconnected from wss://rpc.preprod.midnight.network') ||
          fullError.includes('SubmissionError') ||
          fullError.includes('Transaction submission failed')) {
        if (attempt < MAX_RETRIES) {
          console.log(`⏳ RPC disconnected during submission. Retrying...`);
          console.log(`   Attempt ${attempt}/${MAX_RETRIES} - waiting ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          console.log('❌ RPC connection too unstable to complete deployment');
          await walletCtx.wallet.stop();
          process.exit(1);
        }
      } else if (fullError.includes('Not enough Dust')) {
        const currentState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
        const dustBalance = currentState.dust.balance(new Date());

        if (attempt < MAX_RETRIES) {
          console.log(`⏳ DUST balance: ${dustBalance.toLocaleString()} (need more for tx fees)`);
          console.log(`   Attempt ${attempt}/${MAX_RETRIES} - waiting...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          console.log('❌ Not enough DUST for transaction fees');
          await walletCtx.wallet.stop();
          process.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  if (!deployed) {
    throw new Error('Deployment failed after all retries');
  }

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log('✅ PrivaMedAI Contract deployed successfully!\n');
  console.log(`Contract Address: ${contractAddress}\n`);

  // Initialize the contract and register deployer as issuer
  console.log('Initializing contract and registering deployer as issuer...\n');
  
  try {
    const providers = await createProviders(walletCtx, zkConfigPath);
    const coinPublicKey = walletCtx.unshieldedKeystore.getPublicKey();
    
    // Initialize contract with admin
    console.log('1. Initializing contract with admin...');
    const initTx = await deployed.circuits.initialize(coinPublicKey);
    console.log(`   Admin set: ${coinPublicKey}\n`);
    
    // Register deployer as issuer
    console.log('2. Registering deployer as issuer...');
    const nameHash = ledger.Digest.fromString('Admin Issuer');
    const registerTx = await deployed.circuits.registerIssuer(coinPublicKey, coinPublicKey, nameHash);
    console.log(`   Issuer registered\n`);
    
    // Activate issuer
    console.log('3. Activating issuer...');
    const activateTx = await deployed.circuits.updateIssuerStatus(coinPublicKey, coinPublicKey, 1); // 1 = ACTIVE
    console.log(`   Issuer activated ✅\n`);
    
    console.log('Contract is ready for credential issuance!\n');
  } catch (err) {
    console.warn('⚠️  Could not auto-initialize/activate (contract may need manual setup):', err.message);
  }

  const deploymentInfo = {
    contractAddress,
    network: 'preprod',
    contractName: 'PrivaMedAI',
    deployedAt: new Date().toISOString(),
    features: [
      'Issuer Registry with governance',
      'Batch credential issuance',
      'Bundled verification (2 and 3 credentials)',
      'Admin emergency revocation',
      'Credential status queries'
    ]
  };

  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Saved to ${deploymentPath}\n`);

  await walletCtx.wallet.stop();
  console.log('Deployment complete!\n');
  
  console.log('Next steps:');
  console.log('1. Initialize the contract with admin rights');
  console.log('2. Register issuers (hospitals, clinics)');
  console.log('3. Start issuing credentials\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
