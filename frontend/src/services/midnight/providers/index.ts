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

// Private state storage with contract address scoping
const privateStates = new Map<string, any>();
const signingKeys = new Map<string, any>();
let currentContractAddress: string | null = null;

export interface MidnightProviders {
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

  const compiledContract = await getCompiledContract();
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

  // Proper private state provider with contract address scoping
  const privateStateProvider = {
    // setContractAddress MUST be synchronous
    setContractAddress(address: string): void {
      currentContractAddress = address;
    },
    async get(key: string): Promise<any> {
      const scoped = currentContractAddress ? `${currentContractAddress}:${key}` : key;
      return privateStates.get(scoped) ?? null;
    },
    async set(key: string, value: any): Promise<void> {
      const scoped = currentContractAddress ? `${currentContractAddress}:${key}` : key;
      privateStates.set(scoped, value);
    },
    async remove(key: string): Promise<void> {
      const scoped = currentContractAddress ? `${currentContractAddress}:${key}` : key;
      privateStates.delete(scoped);
    },
    async clear(): Promise<void> {
      privateStates.clear();
    },
    async getSigningKey(address: string): Promise<any> {
      return signingKeys.get(address) ?? null;
    },
    async setSigningKey(address: string, key: any): Promise<void> {
      signingKeys.set(address, key);
    },
    async removeSigningKey(address: string): Promise<void> {
      signingKeys.delete(address);
    },
    async clearSigningKeys(): Promise<void> {
      signingKeys.clear();
    },
    async getAllSigningKeys(): Promise<[string, any][]> {
      return Array.from(signingKeys.entries());
    },
    async exportPrivateStates(): Promise<any> {
      throw new Error('Not supported');
    },
    async importPrivateStates(_states: any): Promise<any> {
      throw new Error('Not supported');
    },
    async exportSigningKeys(): Promise<any> {
      throw new Error('Not supported');
    },
    async importSigningKeys(_keys: Record<string, any>): Promise<any> {
      throw new Error('Not supported');
    },
  };

  return {
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
