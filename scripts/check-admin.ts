import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';
import { findDeployedContract, submitQueryTx } from '@midnight-ntwrk/midnight-js-contracts';
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

globalThis.WebSocket = WebSocket as any;
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

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = path.join(repoRoot, '.env');
  const deploymentPath = path.join(repoRoot, 'deployment-privamedai.json');
  const zkConfigPath = path.resolve(repoRoot, 'contract', 'src', 'managed', 'PrivaMedAI');
  const walletStatePath = path.join(repoRoot, '.wallet-state.json');

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const seed = envContent.match(/^WALLET_SEED=(.+)$/m)![1].trim();

  console.log('Loading contract...');
  const PrivaMedAIModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

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

  const savedState = JSON.parse(fs.readFileSync(walletStatePath, 'utf-8'));
  const wallet = await WalletFacade.init({
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

  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  
  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) { return tx; },
    submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
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

  const initialPrivateState = createPrivaMedAIPrivateState(
    Buffer.from(seed.slice(0, 64), 'hex'),
    new Uint8Array(32),
    [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)]
  );

  console.log('Connecting to contract...');
  const contract = await findDeployedContract(providers, {
    contractAddress: deployment.contractAddress,
    compiledContract,
    privateStateId: 'privaMedAITestState',
    initialPrivateState,
  });

  console.log('\n=== Querying Contract State ===');
  console.log('Wallet coin public key:', walletProvider.getCoinPublicKey());
  console.log('Wallet encryption key:', walletProvider.getEncryptionPublicKey().slice(0, 64) + '...');
  
  // Try to get admin
  try {
    console.log('\nQuerying getAdmin...');
    const adminResult = await submitQueryTx(providers, {
      contractAddress: deployment.contractAddress,
      compiledContract,
      circuitId: 'getAdmin',
      args: [],
    });
    console.log('Admin query result:', JSON.stringify(adminResult, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e: any) {
    console.log('Admin query error:', e.message);
  }

  await wallet.stop();
  console.log('\nDone!');
}

main().catch(console.error);
