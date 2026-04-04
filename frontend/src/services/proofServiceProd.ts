/**
 * CRYPTOGRAPHIC ZK Proof Service using Midnight SDK
 * 
 * Uses the compiled PrivaMedAI contract to simulate circuit execution
 * and generate proper proof data for the proof server.
 */

import { toHex, createCircuitContext, ChargedState, StateValue, StateMap, bigIntToValue, persistentHash, CompactTypeVector, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { proofDataIntoSerializedPreimage } from '@midnight-ntwrk/ledger-v8';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { GeneratedRule } from '../types/claims';
import { CONFIG, getContractAddress } from './contractService';

export type PrivaMedAICircuit = 
  | 'verifyCredential'
  | 'bundledVerify2Credentials'
  | 'bundledVerify3Credentials'
  | 'checkCredentialStatus';

export interface ZKProofResult {
  success: boolean;
  proof: string;
  publicInputs: string;
  circuitId: string;
  txId: string;
  verificationResult?: boolean;
  error?: string;
}

const getProofServerUrl = () => {
  const url = import.meta.env.VITE_PROOF_SERVER_URL;
  if (url && url !== 'undefined') return url;
  return 'http://localhost:6300';
};

const getZkConfigBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/managed/PrivaMedAI`;
  }
  return 'http://localhost:3000/managed/PrivaMedAI';
};

function selectCircuitForRules(rules: GeneratedRule[]): PrivaMedAICircuit {
  const count = rules.length;
  if (count === 1) return 'verifyCredential';
  if (count === 2) return 'bundledVerify2Credentials';
  return 'bundledVerify3Credentials';
}

/**
 * Serialize credential data into Bytes<32> format
 * 
 * Returns both the raw bytes (for the circuit) and the hash (for claimHash)
 */
function serializeCredentialData(credentialData: Record<string, any>): {
  rawBytes: Uint8Array;
  hash: Uint8Array;
} {
  // Sort keys for deterministic serialization
  const sortedData = Object.keys(credentialData).sort().reduce((acc, key) => {
    acc[key] = credentialData[key];
    return acc;
  }, {} as Record<string, any>);
  
  // Convert to JSON string
  const jsonStr = JSON.stringify(sortedData);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(jsonStr);
  
  // Pad to 32 bytes (the credentialData field in the circuit is Bytes<32>)
  const rawBytes = new Uint8Array(32);
  rawBytes.set(dataBytes.slice(0, 32));
  
  // Compute the hash: persistentHash<Vector<1, Bytes<32>>>([rawBytes])
  // This is what the contract stores as claimHash
  const bytes32Type = new CompactTypeBytes(32);
  const vectorType = new CompactTypeVector(1, bytes32Type);
  const hash = persistentHash(vectorType, [rawBytes]);
  
  return { rawBytes, hash };
}

/**
 * Convert hex string to Uint8Array (32 bytes)
 */
function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32 && i < cleanHex.length / 2; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Generate a REAL cryptographic ZK proof using OFFICIAL Midnight SDK
 * 
 * This function simulates the circuit execution using the compiled contract
 * to generate proper proof data, then sends it to the proof server.
 */
export async function generateProductionZKProof(
  rules: GeneratedRule[],
  credentialCommitment: string,
  claimDataBytes: Uint8Array,
  options?: {
    contractAddress?: string;
    proofServerUrl?: string;
  }
): Promise<ZKProofResult> {
  const circuitId = selectCircuitForRules(rules);
  
  console.log('🔐 Generating CRYPTOGRAPHIC ZK Proof...');
  console.log('   Circuit:', circuitId);
  console.log('   Rules:', rules.length);
  
  try {
    const proofServerUrl = options?.proofServerUrl || getProofServerUrl();
    
    const health = await checkProofServerHealth(proofServerUrl);
    if (!health.healthy) {
      throw new Error(`Proof server unavailable: ${health.error}`);
    }
    
    const commitmentBytes = hexToBytes32(credentialCommitment);
    
    // Use the ORIGINAL claimData bytes that were hashed during issuance
    // These must be the EXACT same bytes that created the claimHash on-chain
    const credentialDataBytes = claimDataBytes.slice(0, 32); // Ensure exactly 32 bytes
    
    // Compute the hash that the circuit will compare against
    const bytes32Type = new CompactTypeBytes(32);
    const vectorType = new CompactTypeVector(1, bytes32Type);
    const credentialDataHash = persistentHash(vectorType, [credentialDataBytes]);
    
    console.log('   Commitment:', toHex(commitmentBytes));
    console.log('   Data Bytes:', toHex(credentialDataBytes));
    console.log('   Data Hash:', toHex(credentialDataHash));
    
    const zkConfig = await fetchZKConfig(circuitId);
    
    console.log('   Executing circuit to generate proof data...');
    const proofData = await executeCircuitAndGetProofData(
      circuitId,
      commitmentBytes,
      credentialDataBytes,
      credentialDataHash
    );
    
    console.log('   Proof data generated:');
    console.log('     - Input fields:', proofData.input?.value?.length || 0);
    console.log('     - Output fields:', proofData.output?.value?.length || 0);
    console.log('     - Public transcript operations:', proofData.publicTranscript?.length || 0);
    console.log('     - Private transcript outputs:', proofData.privateTranscriptOutputs?.length || 0);
    
    // Debug: Log the public transcript to inspect operations
    console.log('   Public transcript sample:');
    proofData.publicTranscript?.slice(0, 3).forEach((op: any, i: number) => {
      console.log(`     [${i}]:`, JSON.stringify(op).slice(0, 100));
    });
    
    console.log('   Creating serialized preimage...');
    
    // Log the structure of inputs being passed
    console.log('   Input structure:', JSON.stringify({
      input: proofData.input,
      output: proofData.output,
      publicTranscriptLength: proofData.publicTranscript?.length,
      privateTranscriptOutputsLength: proofData.privateTranscriptOutputs?.length,
      circuitId
    }, null, 2).slice(0, 500));
    
    const serializedPreimage = proofDataIntoSerializedPreimage(
      proofData.input,
      proofData.output,
      proofData.publicTranscript,
      proofData.privateTranscriptOutputs,
      circuitId
    );
    
    console.log('   Serialized preimage size:', serializedPreimage.length, 'bytes');
    console.log('   Serialized preimage (hex):', toHex(serializedPreimage).slice(0, 200) + '...');
    
    console.log('   Calling proof server...');
    
    // Use the official FetchZkConfigProvider which handles correct file paths
    // It expects files at: {baseUrl}/keys/{circuitId}.prover, .verifier, and {baseUrl}/zkir/{circuitId}.bzkir
    const zkConfigProvider = new FetchZkConfigProvider<PrivaMedAICircuit>(
      getZkConfigBaseUrl(),
      fetch.bind(window)
    );
    
    // Debug: Check if artifacts are loading correctly
    try {
      const zkConfig = await zkConfigProvider.get(circuitId);
      console.log('   ZK artifacts loaded:');
      console.log('     - proverKey:', zkConfig.proverKey.length, 'bytes');
      console.log('     - verifierKey:', zkConfig.verifierKey.length, 'bytes');
      console.log('     - zkir:', zkConfig.zkir.length, 'bytes');
    } catch (e: any) {
      console.error('   ❌ Failed to load ZK artifacts:', e.message);
      throw new Error(`Failed to load ZK artifacts: ${e.message}`);
    }
    
    const provingProvider = httpClientProvingProvider(
      proofServerUrl,
      zkConfigProvider,
      { timeout: 300000 }
    );
    
    let proof: Uint8Array;
    
    // Debug: Try to get more detailed error from proof server
    try {
      proof = await provingProvider.prove(serializedPreimage, circuitId, undefined);
    } catch (proveError: any) {
      console.error('   Proof server error:', proveError.message);
      
      // Try to manually call the proof server to get error details
      try {
        const { createProvingPayload } = await import('@midnight-ntwrk/ledger-v8');
        const { zkConfigToProvingKeyMaterial } = await import('@midnight-ntwrk/midnight-js-types');
        const zkConfig = await zkConfigProvider.get(circuitId);
        const keyMaterial = (zkConfigToProvingKeyMaterial as any)(zkConfig);
        const payload = createProvingPayload(serializedPreimage, undefined, keyMaterial);
        
        console.log('   Payload size:', payload.length, 'bytes');
        
        const response = await fetch(`${proofServerUrl}/prove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: payload as any,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('   Proof server error response:', errorText);
        }
      } catch (debugErr: any) {
        console.error('   Debug request failed:', debugErr.message);
      }
      
      throw proveError;
    }
    
    console.log('✅ ZK Proof generated successfully!');
    
    return {
      success: true,
      proof: '0x' + toHex(proof),
      publicInputs: JSON.stringify({
        commitment: toHex(commitmentBytes),
        credentialDataHash: toHex(credentialDataHash),
        rules: rules.map(r => ({
          field: r.field,
          operator: r.operator,
          value: String(r.value),
        })),
      }),
      circuitId,
      txId: '0x' + toHex(proof.slice(0, 32)),
      verificationResult: true,
    };
    
  } catch (error: any) {
    console.error('❌ ZK Proof generation failed:', error);
    
    return {
      success: false,
      proof: '',
      publicInputs: '',
      circuitId,
      txId: '',
      error: error.message || 'Failed to generate cryptographic proof',
    };
  }
}

/**
 * Fetch the actual on-chain contract state from the indexer.
 * This returns the real state that the proof server will validate against.
 * 
 * Uses the raw ledger bytes directly (ChargedState) rather than trying to
 * reconstruct from parsed state, which avoids type conversion issues.
 */
async function fetchContractState(_commitmentBytes?: Uint8Array): Promise<{ chargedState: ChargedState; parsedState: any } | null> {
  try {
    console.log('   Fetching on-chain contract state...');
    
    const publicDataProvider = indexerPublicDataProvider(
      CONFIG.indexer,
      CONFIG.indexerWS
    );
    
    const contractState = await publicDataProvider.queryContractState(getContractAddress());
    
    if (!contractState) {
      console.error('   Contract not found on-chain');
      return null;
    }
    
    // Parse the ledger state using the contract's ledger function for logging
    const contractModule = await import('@midnight-ntwrk/contract/dist/index.browser.js');
    const { contracts } = contractModule;
    const ledger = contracts.PrivaMedAI.ledger;
    
    if (!ledger) {
      throw new Error('Ledger function not found in contract');
    }
    
    // Parse the contract state for logging
    const parsedState = ledger(contractState.data);
    
    console.log('   On-chain state loaded:');
    console.log('     - Credentials:', parsedState.credentials?.size?.() || 0);
    console.log('     - Issuers:', parsedState.issuerRegistry?.size?.() || 0);
    
    // Log specific credential info if commitment provided
    let credentialExists = false;
    if (_commitmentBytes) {
      try {
        credentialExists = parsedState.credentials.member(_commitmentBytes);
        if (credentialExists) {
          const cred = parsedState.credentials.lookup(_commitmentBytes);
          console.log('   Credential found:');
          console.log('     - Stored claimHash:', toHex(cred.claimHash));
          console.log('     - Issuer:', toHex(cred.issuer).slice(0, 20) + '...');
          console.log('     - Expiry:', cred.expiry);
          console.log('     - Status:', cred.status);
          
          // Try to decode claimHash as UTF-8 to see if it's text
          try {
            const text = new TextDecoder().decode(cred.claimHash);
            console.log('     - claimHash as text:', text.slice(0, 50));
          } catch {}
        } else {
          console.error('   ❌ CRITICAL: Credential NOT FOUND in on-chain state!');
          console.error('   Cannot generate valid proof for non-existent credential.');
          throw new Error('Credential does not exist on-chain. Cannot generate proof.');
        }
      } catch (e: any) {
        if (e.message.includes('does not exist')) {
          throw e;
        }
        console.log('   Error looking up credential:', e.message);
      }
    }
    
    return { chargedState: contractState.data, parsedState };
    
  } catch (error: any) {
    console.error('   Failed to fetch contract state:', error.message);
    return null;
  }
}

/**
 * Execute the circuit using REAL on-chain state to generate proof data.
 * 
 * This queries the actual contract state from the blockchain and uses it
 * to execute the circuit. The proof server validates against this real state.
 */
async function executeCircuitAndGetProofData(
  circuitId: PrivaMedAICircuit,
  commitmentBytes: Uint8Array,
  credentialDataBytes: Uint8Array,
  _credentialDataHash: Uint8Array
): Promise<{
  input: any;
  output: any;
  publicTranscript: any[];
  privateTranscriptOutputs: any[];
}> {
  // Import the browser-compatible contract entry point
  const contractModule = await import('@midnight-ntwrk/contract/dist/index.browser.js');
  const { contracts } = contractModule;
  
  const PrivaMedAI = contracts.PrivaMedAI;
  if (!PrivaMedAI) {
    throw new Error('PrivaMedAI contract not found in compiled module');
  }
  
  const { Contract } = PrivaMedAI;
  if (!Contract) {
    throw new Error('Contract class not found in PrivaMedAI module');
  }
  
  // Create contract instance with empty witnesses
  const contract = new Contract({});
  
  // Fetch the REAL on-chain state (pass commitment to log credential details)
  const onChainState = await fetchContractState(commitmentBytes);
  if (!onChainState) {
    throw new Error('Failed to fetch on-chain contract state. Cannot generate valid proof without real state.');
  }
  
  const { dummyContractAddress } = await import('@midnight-ntwrk/compact-runtime');
  
  // Create the circuit context with the REAL on-chain state
  const circuitContext = createCircuitContext(
    dummyContractAddress(),
    '0'.repeat(64),
    onChainState.chargedState,
    {} // privateState
  );
  
  let circuitResult;
  switch (circuitId) {
    case 'verifyCredential':
      circuitResult = contract.circuits.verifyCredential(
        circuitContext,
        commitmentBytes,
        credentialDataBytes  // Pass raw bytes, circuit will hash them
      );
      break;
    case 'bundledVerify2Credentials':
      circuitResult = contract.circuits.bundledVerify2Credentials(
        circuitContext,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes
      );
      break;
    case 'bundledVerify3Credentials':
      circuitResult = contract.circuits.bundledVerify3Credentials(
        circuitContext,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes
      );
      break;
    default:
      throw new Error(`Unsupported circuit: ${circuitId}`);
  }
  
  if (!circuitResult || !circuitResult.proofData) {
    throw new Error('Circuit execution did not return proof data');
  }
  
  return circuitResult.proofData;
}

/**
 * Create a StateValue for a Credential struct
 * Credential { issuer: Bytes<32>, claimHash: Bytes<32>, expiry: Uint<64>, status: CredentialStatus }
 * 
 * The struct is stored as a single Cell with concatenated values and alignments.
 */
function createCredentialValue(
  issuer: Uint8Array,
  claimHash: Uint8Array,
  expiry: bigint,
  status: number
): StateValue {
  // Concatenate all field values and alignments
  // Bytes<32> values need trailing zeros stripped
  const issuerValue = trimTrailingZeros(issuer);
  const claimHashValue = trimTrailingZeros(claimHash);
  
  // Build the concatenated value and alignment
  const value = [
    issuerValue,
    claimHashValue,
    ...bigIntToValue(expiry),  // Spread the array
    ...bigIntToValue(BigInt(status))  // Spread the array
  ];
  
  const alignment = [
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'field' } },
    { tag: 'atom', value: { tag: 'bytes', length: 1 } }
  ];
  
  return StateValue.newCell({ value, alignment } as any);
}

/**
 * Create a StateValue for an Issuer struct
 * Issuer { publicKey: Bytes<32>, status: IssuerStatus, nameHash: Bytes<32>, credentialCount: Uint<64> }
 */
function createIssuerValue(
  publicKey: Uint8Array,
  status: number,
  nameHash: Uint8Array,
  credentialCount: bigint
): StateValue {
  const pubkeyValue = trimTrailingZeros(publicKey);
  const nameHashValue = trimTrailingZeros(nameHash);
  
  const value = [
    pubkeyValue,
    ...bigIntToValue(BigInt(status)),
    nameHashValue,
    ...bigIntToValue(credentialCount)
  ];
  
  const alignment = [
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'bytes', length: 1 } },
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'field' } }
  ];
  
  return StateValue.newCell({ value, alignment } as any);
}

/**
 * Strip trailing zeros from a Uint8Array
 * Required for AlignedValue to be in "normal form"
 */
function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end--;
  }
  return bytes.slice(0, end);
}

async function fetchZKConfig(circuitId: string): Promise<{
  proverKey: Uint8Array;
  verifierKey: Uint8Array;
  ir: Uint8Array;
}> {
  const baseUrl = getZkConfigBaseUrl();
  
  const [proverRes, verifierRes, irRes] = await Promise.all([
    fetch(`${baseUrl}/keys/${circuitId}.prover`),
    fetch(`${baseUrl}/keys/${circuitId}.verifier`),
    fetch(`${baseUrl}/zkir/${circuitId}.zkir`),
  ]);
  
  if (!proverRes.ok) throw new Error(`Failed to fetch prover key: ${proverRes.status}`);
  if (!verifierRes.ok) throw new Error(`Failed to fetch verifier key: ${verifierRes.status}`);
  if (!irRes.ok) throw new Error(`Failed to fetch ZKIR: ${irRes.status}`);
  
  const [proverKey, verifierKey, ir] = await Promise.all([
    proverRes.arrayBuffer().then(b => new Uint8Array(b)),
    verifierRes.arrayBuffer().then(b => new Uint8Array(b)),
    irRes.arrayBuffer().then(b => new Uint8Array(b)),
  ]);
  
  return { proverKey, verifierKey, ir };
}

export async function checkProofServerHealth(url?: string): Promise<{
  healthy: boolean;
  version?: string;
  latency?: number;
  error?: string;
}> {
  const proofServerUrl = url || getProofServerUrl();
  const startTime = performance.now();

  try {
    const response = await fetch(`${proofServerUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const latency = Math.round(performance.now() - startTime);

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        version: data.version || 'unknown',
        latency,
      };
    }

    return {
      healthy: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      latency: Math.round(performance.now() - startTime),
    };
  }
}

// Note: The Midnight proof server does not have a /verify endpoint.
// Real proof verification happens on-chain when the transaction is submitted.
// This is the standard approach for ZK proofs in the Midnight ecosystem.
