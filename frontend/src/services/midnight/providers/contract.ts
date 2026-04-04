/**
 * Contract Provider
 * 
 * Compiled contract instance management
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { contracts } from '@midnight-ntwrk/contract/dist/index.browser.js';

const ZK_CONFIG_BASE_URL = '/managed/PrivaMedAI';

// Cache for the compiled contract instance
let compiledContractCache: any = null;

/**
 * Get or create the compiled contract instance
 * This must be called after window is available (in browser context)
 */
export function getCompiledContract() {
  if (compiledContractCache) {
    return compiledContractCache;
  }

  // Path to ZK config files - must contain zkir/ and keys/ subdirectories
  const zkConfigBaseUrl = `${window.location.protocol}//${window.location.host}${ZK_CONFIG_BASE_URL}`;
  
  console.log('Building CompiledContract with ZK config at:', zkConfigBaseUrl);
  
  // Build the proper CompiledContract instance using the builder pattern
  const baseContract = CompiledContract.make(
    'PrivaMedAI',
    contracts.PrivaMedAI.Contract
  );
  
  // Apply pipe operations
  compiledContractCache = baseContract.pipe(
    CompiledContract.withVacantWitnesses,
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
