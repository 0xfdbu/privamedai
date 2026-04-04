/**
 * Midnight Providers
 * 
 * Wallet, network, and state providers for blockchain interaction
 */

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { toHex, fromHex } from '@midnight-ntwrk/compact-runtime';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { getWalletState, getLaceAPI, CONFIG } from '../../contractService';
import { getCompiledContract } from './contract';

// Private state storage (in-memory for demo)
const privateStateStore: Record<string, any> = {};
const signingKeys: Record<string, any> = {};

export interface MidnightProviders {
  compiledContract: any;
  zkConfigProvider: any;
  publicDataProvider: any;
  proofProvider: any;
  walletProvider: any;
  midnightProvider: any;
  privateStateProvider: any;
  fetchZkConfig: (circuitId: string) => Promise<any>;
}

/**
 * Initialize all required providers
 */
export async function initializeProviders(): Promise<MidnightProviders> {
  const wallet = getWalletState();
  if (!wallet.isConnected) {
    throw new Error('Wallet not connected');
  }

  const compiledContract = getCompiledContract();
  const zkConfigBaseUrl = `${window.location.protocol}//${window.location.host}/managed/PrivaMedAI`;
  
  const zkConfigProvider = new FetchZkConfigProvider(
    zkConfigBaseUrl,
    fetch.bind(window)
  );

  const publicDataProvider = indexerPublicDataProvider(
    CONFIG.indexer,
    CONFIG.indexerWS
  );

  const proofProvider = httpClientProofProvider(
    CONFIG.proofServer,
    zkConfigProvider
  );

  const laceAPI = getLaceAPI();

  const walletProvider = {
    getCoinPublicKey() {
      return wallet.coinPublicKey || '';
    },
    getEncryptionPublicKey() {
      return wallet.encryptionPublicKey || '';
    },
    async balanceTx(tx: any, _ttl?: Date) {
      if (!laceAPI) {
        throw new Error('No wallet connected');
      }
      const serializedTx = toHex(tx.serialize());
      const received = await laceAPI.balanceUnsealedTransaction(serializedTx);
      return ledger.Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        fromHex(received.tx),
      ) as any;
    },
  };

  const midnightProvider = {
    async submitTx(tx: any) {
      if (!laceAPI) {
        throw new Error('No wallet connected');
      }
      const serialized = toHex(tx.serialize());
      await laceAPI.submitTransaction(serialized);
      const txIdentifiers = tx.identifiers();
      return txIdentifiers[0];
    },
  };

  const privateStateProvider = {
    async get(id: string) {
      return privateStateStore[id] || {};
    },
    async set(id: string, state: any) {
      privateStateStore[id] = state;
    },
    async remove(id: string) {
      delete privateStateStore[id];
    },
    async clear() {
      Object.keys(privateStateStore).forEach(k => delete privateStateStore[k]);
    },
    setContractAddress(_address: string) {},
    async setSigningKey(id: string, key: any) {
      signingKeys[id] = key;
    },
    async getSigningKey(id: string) {
      return signingKeys[id];
    },
    async removeSigningKey(id: string) {
      delete signingKeys[id];
    },
    async clearSigningKeys() {
      Object.keys(signingKeys).forEach(k => delete signingKeys[k]);
    },
    async getAllSigningKeys() {
      return Object.entries(signingKeys);
    },
    async exportPrivateStates() {
      return { 
        format: 'midnight-private-state-export' as const,
        encryptedPayload: '',
        salt: '',
      };
    },
    async importPrivateStates(_states: any) {
      return { imported: 0, failed: 0, skipped: 0, overwritten: 0 };
    },
    async exportSigningKeys() {
      return { 
        format: 'midnight-signing-key-export' as const,
        encryptedPayload: '',
        salt: '',
      };
    },
    async importSigningKeys(_keys: Record<string, any>) {
      return { imported: 0, failed: 0, skipped: 0, overwritten: 0 };
    },
  };

  return {
    compiledContract,
    zkConfigProvider,
    publicDataProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
    privateStateProvider,
    fetchZkConfig: zkConfigProvider.get.bind(zkConfigProvider),
  };
}

export * from './contract';
