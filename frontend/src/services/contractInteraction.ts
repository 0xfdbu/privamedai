/**
 * Contract Interaction Service
 * 
 * Main entry point for blockchain interactions
 */

export { 
  registerIssuerOnChain,
  checkIssuerOnChain, 
  getContractAdmin 
} from './midnight/circuits/issuer';
export { 
  issueCredentialOnChain, 
  queryCredentialsOnChain,
  checkCredentialOnChain,
  revokeCredentialOnChain
} from './midnight/circuits/credential';
export { submitProofVerification, type VerifierType } from './midnight/circuits/verification';
export { 
  hashString, 
  hexToBytes32 
} from './midnight/utils/bytes';
export { initializeProviders, getCompiledContract, clearContractCache } from './midnight/providers';
export { CONTRACT_ADDRESS, CIRCUITS, NETWORK_CONFIG } from './midnight/config';
