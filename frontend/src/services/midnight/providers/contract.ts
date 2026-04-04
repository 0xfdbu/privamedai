/**
 * Contract Provider
 * 
 * Compiled contract instance management
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { Contract } from '@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js';
import { witnesses, PrivaMedAIPrivateState } from '../witnesses';

const ZK_CONFIG_BASE_URL = '/managed/PrivaMedAI';

// Cache for the compiled contract instance
let compiledContractCache: any = null;
let ContractClass: typeof Contract | null = null;

/**
 * Get or create the compiled contract instance
 * This must be called after window is available (in browser context)
 */
export async function getCompiledContract() {
  if (compiledContractCache) {
    return compiledContractCache;
  }

  // Dynamically import the Contract class (browser-compatible)
  if (!ContractClass) {
    const module = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    ContractClass = module.Contract;
  }

  // Path to ZK config files - must contain zkir/ and keys/ subdirectories
  const zkConfigBaseUrl = `${window.location.protocol}//${window.location.host}${ZK_CONFIG_BASE_URL}`;
  
  console.log('Building CompiledContract with ZK config at:', zkConfigBaseUrl);
  
  // Build the proper CompiledContract instance using the builder pattern
  // Use actual witnesses instead of vacant witnesses - the contract has a
  // get_private_health_claim witness that must be provided
  const baseContract = CompiledContract.make<Contract<PrivaMedAIPrivateState>>(
    'PrivaMedAI',
    ContractClass
  );
  
  // Apply pipe operations with actual witnesses
  compiledContractCache = baseContract.pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigBaseUrl)
  );
  
  return compiledContractCache;
}

/**
 * Clear the compiled contract cache
 * Useful for testing or when switching networks
 */
export function clearContractCache() {
  compiledContractCache = null;
  console.log('Contract cache cleared');
}

// Re-export witnesses for use in other modules
export { witnesses, createInitialPrivateState } from '../witnesses';
export type { PrivaMedAIPrivateState } from '../witnesses';
