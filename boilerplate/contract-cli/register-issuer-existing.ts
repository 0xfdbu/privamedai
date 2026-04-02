#!/usr/bin/env node
/**
 * Register an issuer on the existing PrivaMedAI contract
 * Uses the admin hex seed from root .env
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import { contracts, witnesses } from '@midnight-ntwrk/contract';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { PrivaMedAIProviders, DeployedPrivaMedAIContract } from './common-types';

globalThis.WebSocket = WebSocket;

const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Failed to initialize HDWallet');
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== 'keysDerived') throw new Error('Failed to derive keys');
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const buildWalletConfig = () => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  },
  provingServerUrl: new URL('https://proof-server.preprod.midnight.network'),
  relayURL: new URL('wss://rpc.preprod.midnight.network'),
});

const buildUnshieldedConfig = () => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = () => ({
  networkId: getNetworkId(),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: {
    indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  },
  provingServerUrl: new URL('https://proof-server.preprod.midnight.network'),
  relayURL: new URL('wss://rpc.preprod.midnight.network'),
});

async function main() {
  const issuerPubKey = process.argv[2] || '525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362';
  const nameHash = process.argv[3] || '19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12';
  
  console.log('📝 Register Issuer on Existing PrivaMedAI Contract');
  console.log('==================================================');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Issuer: ${issuerPubKey}`);
  console.log('');

  const adminSeed = process.env.WALLET_SEED;
  if (!adminSeed) {
    console.error('❌ WALLET_SEED not found in .env');
    process.exit(1);
  }

  console.log('⏳ Building wallet from admin seed...');
  const keys = deriveKeysFromSeed(adminSeed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  console.log('Admin address:', unshieldedKeystore.getBech32Address());
  console.log('');

  const wallet = await WalletFacade.init({
    configuration: { ...buildWalletConfig(), ...buildUnshieldedConfig(), ...buildDustConfig() },
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  console.log('⏳ Waiting for sync...');
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  console.log('✅ Wallet synced');
  console.log('');

  // Configure providers
  const zkConfigPath = path.resolve(__dirname, '..', '..', '..', 'contract', 'dist', 'managed', 'PrivaMedAI', 'contract', '.compact-circuit-outputs');
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = 'admin';
  
  const providers: PrivaMedAIProviders = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-private-state',
      accountId,
      privateStoragePasswordProvider: () => 'password123!',
    }) as any,
    publicDataProvider: indexerPublicDataProvider(
      'https://indexer.preprod.midnight.network/api/v4/graphql',
      'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'
    ),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider('https://proof-server.preprod.midnight.network', zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => 'admin',
      getEncryptionPublicKey: () => 'admin',
      balanceTx: async (tx: any) => tx,
      submitTx: async (tx: any) => 'tx-hash',
    } as any,
    midnightProvider: {
      submitTx: async (tx: any) => 'tx-hash',
    } as any,
  };

  // Join contract
  console.log('⏳ Connecting to contract...');
  const contractNames = Object.keys(contracts);
  const contractModule = contracts[contractNames[0]];
  
  const contract = await findDeployedContract(providers, {
    contractAddress: CONTRACT_ADDRESS,
    compiledContract: new contractModule.Contract(witnesses),
  } as any);
  
  console.log('✅ Connected to contract');
  console.log('');

  // Register issuer
  console.log('⏳ Registering issuer...');
  const issuerPubKeyBytes = Uint8Array.from(Buffer.from(issuerPubKey, 'hex'));
  const nameHashBytes = Uint8Array.from(Buffer.from(nameHash, 'hex'));
  
  const result = await (contract.callTx as any).registerIssuer(issuerPubKeyBytes, nameHashBytes);
  
  console.log('✅ Issuer registered!');
  console.log(`   Tx ID: ${result.public.txId}`);
  console.log(`   Block: ${result.public.blockHeight}`);

  await wallet.stop();
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
