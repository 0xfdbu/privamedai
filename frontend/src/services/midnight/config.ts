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
  // Admin/Issuer management circuits
  ISSUE_CREDENTIAL: 'issueCredential',
  REGISTER_ISSUER: 'registerIssuer',
  REVOKE_CREDENTIAL: 'revokeCredential',
  // Selective disclosure circuits (verification) - These are the ZK proof circuits
  VERIFY_FREE_HEALTH_CLINIC: 'verifyForFreeHealthClinic',
  VERIFY_PHARMACY: 'verifyForPharmacy',
  VERIFY_HOSPITAL: 'verifyForHospital',
} as const;

// Contract address - PrivaMedAI deployed on Preprod
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || 
  '18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31';

// Network configuration
export const NETWORK_CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServer: import.meta.env.VITE_PROOF_SERVER || 'http://localhost:6300',
};

// ZK Config paths
export const ZK_CONFIG = {
  baseUrl: '/managed/PrivaMedAI',
};
