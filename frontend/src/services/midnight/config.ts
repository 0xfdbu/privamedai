/**
 * Midnight Configuration
 * 
 * Network and contract configuration
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Set network ID immediately
setNetworkId('preprod');

// Circuit IDs
export const CIRCUITS = {
  ISSUE_CREDENTIAL: 'issueCredential',
  REGISTER_ISSUER: 'registerIssuer',
  REVOKE_CREDENTIAL: 'revokeCredential',
  VERIFY_CREDENTIAL: 'verifyCredential',
} as const;

// Contract address
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || 
  'dfd5cc3242d5958bababee206981c7327be0a8f60d6669fca2488e34cad8755b';

// Network configuration
export const NETWORK_CONFIG = {
  indexer: 'https://indexer.midnight.network/preprod/',
  indexerWS: 'wss://indexer.midnight.network/preprod/ws/',
  proofServer: import.meta.env.VITE_PROOF_SERVER || 'http://localhost:6300',
};

// ZK Config paths
export const ZK_CONFIG = {
  baseUrl: '/managed/PrivaMedAI',
};
