#!/usr/bin/env node
/**
 * PrivaMedAI Contract Deployment Script
 * Compatible with midnight-js 4.x and Compact runtime 0.15.0
 */

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from './contract/dist/managed/PrivaMedAI/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { inMemoryPrivateStateProvider } from '@midnight-ntwrk/midnight-js-in-memory-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex } from '@midnight-ntwrk/compact-runtime';

// Network configuration
const NETWORKS = {
  preprod: {
    networkId: 'preprod',
    indexerUri: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
  preview: {
    networkId: 'preview',
    indexerUri: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
  testnet: {
    networkId: 'testnet',
    indexerUri: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
    indexerWsUri: 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
};

// Parse command line arguments
const networkName = process.argv[2] || 'preprod';
const network = NETWORKS[networkName];

if (!network) {
  console.error(`Unknown network: ${networkName}`);
  console.error(`Available networks: ${Object.keys(NETWORKS).join(', ')}`);
  process.exit(1);
}

console.log(`Deploying to ${networkName}...`);
console.log(`Indexer: ${network.indexerUri}`);
console.log(`Proof Server: ${network.proofServerUri}`);

// Set network
setNetworkId(network.networkId);

// Create witnesses
const witnesses = {
  local_secret_key: () => new Uint8Array(32),
  get_credential_data: () => new Uint8Array(32),
};

// Create contract instance
const contractInstance = new Contract(witnesses);

// Create providers
const zkConfigProvider = new NodeZkConfigProvider('./contract/dist/managed/PrivaMedAI');
const proofProvider = httpClientProofProvider(network.proofServerUri, zkConfigProvider);
const publicDataProvider = indexerPublicDataProvider(network.indexerUri, network.indexerWsUri);
const privateStateProvider = inMemoryPrivateStateProvider();

// Mock wallet provider (replace with actual wallet integration)
const walletProvider = {
  getCoinPublicKey: () => 'mock-coin-public-key',
  getEncryptionPublicKey: () => 'mock-encryption-public-key',
  balanceTx: async (tx) => tx,
};

const midnightProvider = {
  submitTx: async (tx) => {
    console.log('Submitting transaction:', tx);
    return 'mock-tx-id';
  },
};

const providers = {
  privateStateProvider,
  zkConfigProvider,
  proofProvider,
  publicDataProvider,
  walletProvider,
  midnightProvider,
};

// Deploy contract
async function deploy() {
  try {
    console.log('Creating deployment transaction...');
    
    // Initial admin public key (32 bytes)
    const initialAdmin = fromHex('0000000000000000000000000000000000000000000000000000000000000001');
    
    const deployed = await deployContract(providers, {
      privateStateKey: 'privamed-private-state',
      contract: contractInstance,
      initialPrivateState: {},
      args: [initialAdmin],
    });

    console.log('\n✅ Contract deployed successfully!');
    console.log('Contract Address:', deployed.deployTxData.public.contractAddress);
    console.log('Block Height:', deployed.deployTxData.public.blockHeight);
    console.log('Transaction ID:', deployed.deployTxData.public.txId);
    
    // Save deployment info
    const deploymentInfo = {
      network: networkName,
      contractAddress: deployed.deployTxData.public.contractAddress,
      blockHeight: deployed.deployTxData.public.blockHeight.toString(),
      txId: deployed.deployTxData.public.txId,
      timestamp: new Date().toISOString(),
    };
    
    console.log('\nDeployment Info:');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deploy();
