/**
 * Standalone ZK Proof Generator for Testing
 * 
 * This script generates ZK proofs using the compiled contract
 * to test proof generation outside the browser environment.
 */

import { 
  toHex, 
  createCircuitContext, 
  ChargedState, 
  StateValue, 
  StateMap,
  bigIntToValue,
  persistentHash,
  CompactTypeVector,
  CompactTypeBytes,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { proofDataIntoSerializedPreimage } from '@midnight-ntwrk/ledger-v8';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { contracts } from '@midnight-ntwrk/contract';
import fetch from 'cross-fetch';

// Configuration
const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServer: 'http://localhost:6300',
  contractAddress: 'dfd5cc3242d5958bababee206981c7327be0a8f60d6669fca2488e34cad8755b',
  zkConfigBaseUrl: 'http://localhost:3000/managed/PrivaMedAI',
};

/**
 * Fetch on-chain contract state
 */
async function fetchContractState() {
  console.log('Fetching contract state from indexer...');
  
  const publicDataProvider = indexerPublicDataProvider(
    CONFIG.indexer,
    CONFIG.indexerWS
  );
  
  const contractState = await publicDataProvider.queryContractState(CONFIG.contractAddress);
  
  if (!contractState) {
    throw new Error('Contract not found');
  }
  
  // Parse ledger state
  const ledger = contracts.PrivaMedAI.ledger;
  const state = ledger(contractState.data);
  
  console.log('Contract state loaded:');
  console.log('  - Credentials:', state.credentials?.size?.() || 0);
  console.log('  - Issuers:', state.issuerRegistry?.size?.() || 0);
  
  return { contractState, parsedState: state };
}

/**
 * Look up a credential and get its claimHash
 */
async function getCredentialInfo(commitmentHex: string) {
  const { parsedState } = await fetchContractState();
  
  const commitmentBytes = hexToBytes(commitmentHex);
  const exists = parsedState.credentials.member(commitmentBytes);
  
  if (!exists) {
    throw new Error(`Credential not found: ${commitmentHex}`);
  }
  
  const credential = parsedState.credentials.lookup(commitmentBytes);
  
  console.log('Credential found:');
  console.log('  - Issuer:', toHex(credential.issuer));
  console.log('  - ClaimHash:', toHex(credential.claimHash));
  console.log('  - Expiry:', credential.expiry);
  console.log('  - Status:', credential.status);
  
  return {
    commitmentBytes,
    claimHash: credential.claimHash,
    issuer: credential.issuer,
    expiry: credential.expiry,
    status: credential.status,
  };
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Test different approaches to generate matching hash
 */
async function testHashApproaches(claimHash: Uint8Array) {
  console.log('\n=== Testing hash approaches ===');
  console.log('Target claimHash:', toHex(claimHash));
  
  // Approach 1: Try raw UTF-8 bytes of common JSON patterns
  const testPatterns = [
    // Try various JSON structures that might have been used
    JSON.stringify({ type: "MedicalCredential" }),
    JSON.stringify({ type: "MedicalCredential", data: {} }),
    JSON.stringify({ type: "MedicalCredential", data: "", expiry: 0 }),
    // Try with actual expiry timestamps around current time
    JSON.stringify({ type: "MedicalCredential", expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
  ];
  
  const bytes32Type = new CompactTypeBytes(32);
  const vectorType = new CompactTypeVector(1, bytes32Type);
  
  for (const pattern of testPatterns) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(pattern);
    const rawBytes = new Uint8Array(32);
    rawBytes.set(dataBytes.slice(0, 32));
    
    const hash = persistentHash(vectorType, [rawBytes]);
    
    console.log(`\nPattern: ${pattern.slice(0, 60)}...`);
    console.log(`  Raw bytes: ${toHex(rawBytes)}`);
    console.log(`  persistentHash: ${toHex(hash)}`);
    console.log(`  Match: ${toHex(hash) === toHex(claimHash)}`);
    
    if (toHex(hash) === toHex(claimHash)) {
      console.log('  ✓ MATCH FOUND!');
      return rawBytes;
    }
  }
  
  console.log('\nNo matching pattern found with persistentHash.');
  console.log('The claimHash may have been created with a different method.');
  
  // Check if claimHash itself looks like UTF-8 text
  try {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(claimHash);
    console.log('\nclaimHash as UTF-8 text:', text);
  } catch (e) {
    console.log('\nclaimHash is not valid UTF-8');
  }
  
  return null;
}

/**
 * Main test function
 */
async function main() {
  const commitmentHex = process.argv[2];
  
  if (!commitmentHex) {
    console.log('Usage: npx tsx test-proof-gen.ts <commitment_hex>');
    console.log('Example: npx tsx test-proof-gen.ts 5293c0dd15769db1e6a7b79245057081df663664148982c41c3331f9a0b6feb2');
    process.exit(1);
  }
  
  try {
    const credential = await getCredentialInfo(commitmentHex);
    const matchingBytes = await testHashApproaches(credential.claimHash);
    
    if (!matchingBytes) {
      console.log('\n❌ Could not determine original credentialData bytes.');
      console.log('The credential may need to be re-issued with proper hashing.');
      process.exit(1);
    }
    
    console.log('\n✓ Found matching credentialData bytes!');
    console.log('Bytes to use for proof generation:', toHex(matchingBytes));
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
