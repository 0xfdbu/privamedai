/**
 * Contract Interaction Service (Legacy Export)
 * 
 * This file is kept for backwards compatibility.
 * All functionality has been moved to the modular structure in ./midnight/
 * 
 * New code should import directly from ./midnight/
 */

// Re-export everything from the modular midnight service
export * from './midnight';

// Legacy specific exports for backwards compatibility
export { 
  registerIssuerOnChain,
  checkIssuerOnChain, 
  getContractAdmin 
} from './midnight/circuits/issuer';
export { 
  issueCredentialOnChain, 
  revokeCredentialOnChain,
  checkCredentialOnChain,
  queryCredentialsOnChain 
} from './midnight/circuits/credential';
export { verifyCredentialOnChain, submitProofVerification } from './midnight/circuits/verification';
export { deployNewContract } from './midnight/circuits/deploy';
export { 
  hashString, 
  hexToBytes32, 
  hexToBytes, 
  hexStringToBytes32, 
  bech32mToBytes32 
} from './midnight/utils/bytes';
export { initializeProviders, getCompiledContract, clearContractCache } from './midnight/providers';
export { CONTRACT_ADDRESS, CIRCUITS, NETWORK_CONFIG } from './midnight/config';
