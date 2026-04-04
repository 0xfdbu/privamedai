/**
 * ZK Proof Verifier
 * 
 * Cryptographically verifies ZK proofs using the proof server's /check endpoint
 * This performs actual SNARK verification - not just format checks
 */

import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { getProofServerUrl, getZkConfigBaseUrl } from './config';
import type { PrivaMedAICircuit } from './config';

export interface ProofVerificationResult {
  valid: boolean;
  error?: string;
  circuitId?: string;
  publicInputs?: any;
  details?: string;
}

/**
 * Verify a ZK proof cryptographically using the proof server's /check endpoint
 * 
 * This performs REAL SNARK verification:
 * 1. Loads the verifier key for the circuit
 * 2. Sends serialized preimage to proof server's /check endpoint
 * 3. Runs constraint satisfaction verification
 * 4. Returns public inputs if valid
 * 
 * NOTE: serializedPreimage is the INPUT to the prover (what goes into prove()),
 * NOT the proof output. This is what check() expects.
 */
export async function verifyZKProof(
  serializedPreimage: Uint8Array,
  circuitId: string,
  publicInputs: any
): Promise<ProofVerificationResult> {
  console.log('🔐 Verifying ZK proof cryptographically...');
  console.log('   Circuit:', circuitId);
  console.log('   Serialized preimage size:', serializedPreimage.length, 'bytes');

  try {
    if (serializedPreimage.length < 50) {
      return {
        valid: false,
        error: 'Serialized preimage too short',
      };
    }

    // Create proving provider
    const zkConfigProvider = new FetchZkConfigProvider<PrivaMedAICircuit>(
      getZkConfigBaseUrl(),
      fetch.bind(window)
    );
    
    const provingProvider = httpClientProvingProvider(
      getProofServerUrl(),
      zkConfigProvider,
      { timeout: 60000 }
    );

    console.log('   Calling proof server /check endpoint...');

    // REAL SNARK VERIFICATION
    // This hits the proof server's /check endpoint which:
    // - Loads the verifier key for the circuit
    // - Verifies the serialized preimage satisfies constraints
    // - Returns public inputs if valid
    const checkResult = await provingProvider.check(serializedPreimage, circuitId as PrivaMedAICircuit);

    console.log('   Proof server check result:', checkResult);

    // checkResult is [] if invalid, or the public inputs if valid
    const isValid = Array.isArray(checkResult) && checkResult.length > 0;

    if (isValid) {
      console.log('✅ SNARK verification passed');
      return {
        valid: true,
        circuitId,
        publicInputs,
        details: `SNARK verification passed. ${checkResult.length} public input(s) verified.`,
      };
    } else {
      console.log('❌ SNARK verification failed');
      return {
        valid: false,
        error: 'SNARK verification failed - proof is invalid or does not satisfy constraints',
        circuitId,
      };
    }

  } catch (error: any) {
    console.error('❌ Proof verification error:', error);
    return {
      valid: false,
      error: error.message || 'Verification error',
      circuitId,
    };
  }
}

/**
 * Quick format check - NOT cryptographic verification
 */
export function isValidProofFormat(proofHex: string): boolean {
  const cleanHex = proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex;
  return /^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length >= 128;
}

/**
 * Extract circuit ID from proof data
 */
export function detectCircuitId(proofData: any): string | null {
  if (proofData.circuitId) {
    return proofData.circuitId;
  }
  
  const rules = proofData.publicInputs?.rules || [];
  const hasAge = rules.some((r: any) => r.field === 'age');
  const hasCondition = rules.some((r: any) => r.field === 'conditionCode');
  const hasPrescription = rules.some((r: any) => r.field === 'prescriptionCode');

  if (hasPrescription) return 'verifyForPharmacy';
  if (hasAge && hasCondition) return 'verifyForHospital';
  if (hasAge) return 'verifyForFreeHealthClinic';
  
  return null;
}
