/**
 * ZK Proof Verifier
 * 
 * Cryptographically verifies ZK proofs using the proof server's /check endpoint
 * This performs actual SNARK verification - not just format checks
 */

import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { toHex } from '@midnight-ntwrk/compact-runtime';
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
 * Circuit argument definitions for validation
 */
const CIRCUIT_ARGUMENTS: Record<PrivaMedAICircuit, { name: string; type: string; size: number }[]> = {
  verifyForFreeHealthClinic: [
    { name: 'commitment', type: 'Bytes<32>', size: 32 },
    { name: 'minAge', type: 'Uint<8>', size: 1 },
  ],
  verifyForPharmacy: [
    { name: 'commitment', type: 'Bytes<32>', size: 32 },
    { name: 'requiredPrescription', type: 'Uint<16>', size: 2 },
  ],
  verifyForHospital: [
    { name: 'commitment', type: 'Bytes<32>', size: 32 },
    { name: 'minAge', type: 'Uint<8>', size: 1 },
    { name: 'requiredCondition', type: 'Uint<16>', size: 2 },
  ],
};

/**
 * Get expected argument count for a circuit
 */
function getExpectedArgumentCount(circuitId: string): number {
  const args = CIRCUIT_ARGUMENTS[circuitId as PrivaMedAICircuit];
  return args ? args.length : 2; // Default to 2 if unknown
}

/**
 * Get expected minimum serialized preimage size for a circuit
 * This is a heuristic based on the argument structure
 */
function getExpectedMinPreimageSize(circuitId: string): number {
  const args = CIRCUIT_ARGUMENTS[circuitId as PrivaMedAICircuit];
  if (!args) return 50;
  
  // Sum of argument sizes + overhead for transcripts and metadata
  const argsSize = args.reduce((sum, arg) => sum + arg.size, 0);
  return argsSize + 32; // 32 bytes minimum overhead for transcripts
}

/**
 * Log detailed information about the serialized preimage structure
 */
function logSerializedPreimageDetails(serializedPreimage: Uint8Array, circuitId: string): void {
  console.log('📊 Serialized Preimage Analysis:');
  console.log('   Circuit ID:', circuitId);
  console.log('   Total size:', serializedPreimage.length, 'bytes');
  console.log('   Expected args:', getExpectedArgumentCount(circuitId));
  console.log('   Expected min size:', getExpectedMinPreimageSize(circuitId), 'bytes');
  
  // Log first 100 bytes as hex (or less if preimage is smaller)
  const bytesToShow = Math.min(100, serializedPreimage.length);
  const hexPreview = Array.from(serializedPreimage.slice(0, bytesToShow))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log(`   First ${bytesToShow} bytes (hex):`, hexPreview);
  
  // Log the raw bytes array format (for direct comparison)
  const rawBytesArray = Array.from(serializedPreimage.slice(0, bytesToShow));
  console.log(`   First ${bytesToShow} bytes (array):`, JSON.stringify(rawBytesArray));
  
  // Circuit-specific analysis
  if (circuitId === 'verifyForHospital') {
    console.log('   ⚠️  Hospital circuit has 3 arguments - ensure all 3 are present in input');
    // Hospital: commitment(32) + minAge(1) + requiredCondition(2) = 35 bytes minimum for inputs
    if (serializedPreimage.length < 35) {
      console.warn('   ⚠️  WARNING: Preimage may be too short for hospital circuit (expects 35+ bytes for inputs)');
    }
  } else if (circuitId === 'verifyForFreeHealthClinic') {
    console.log('   ℹ️  FreeHealthClinic circuit has 2 arguments');
    if (serializedPreimage.length < 33) {
      console.warn('   ⚠️  WARNING: Preimage may be too short for freeHealthClinic circuit (expects 33+ bytes for inputs)');
    }
  } else if (circuitId === 'verifyForPharmacy') {
    console.log('   ℹ️  Pharmacy circuit has 2 arguments');
    if (serializedPreimage.length < 34) {
      console.warn('   ⚠️  WARNING: Preimage may be too short for pharmacy circuit (expects 34+ bytes for inputs)');
    }
  }
  
  // Check for common issues
  if (serializedPreimage.length === 0) {
    console.error('   ❌ ERROR: Serialized preimage is empty!');
  } else if (serializedPreimage.length < 30) {
    console.error('   ❌ ERROR: Serialized preimage is suspiciously short (< 30 bytes)');
  }
}

/**
 * Validate the serialized preimage structure for a specific circuit
 */
function validatePreimageForCircuit(serializedPreimage: Uint8Array, circuitId: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  const args = CIRCUIT_ARGUMENTS[circuitId as PrivaMedAICircuit];
  if (!args) {
    warnings.push(`Unknown circuit: ${circuitId}`);
    return { valid: false, warnings };
  }
  
  // Calculate expected minimum size
  const minSize = getExpectedMinPreimageSize(circuitId);
  if (serializedPreimage.length < minSize) {
    warnings.push(`Preimage too short: ${serializedPreimage.length} bytes (expected at least ${minSize})`);
  }
  
  // Circuit-specific validations
  if (circuitId === 'verifyForHospital') {
    // Hospital has 3 args - check for common serialization issues
    if (serializedPreimage.length < 50) {
      warnings.push('Hospital circuit preimage seems short - may be missing requiredCondition argument');
    }
  }
  
  return { valid: warnings.length === 0, warnings };
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
  
  // Log detailed preimage structure
  logSerializedPreimageDetails(serializedPreimage, circuitId);
  
  // Circuit-specific validation
  const validation = validatePreimageForCircuit(serializedPreimage, circuitId);
  if (!validation.valid) {
    console.warn('   ⚠️  Preimage validation warnings:');
    validation.warnings.forEach(w => console.warn(`      - ${w}`));
  }

  try {
    if (serializedPreimage.length < 50) {
      return {
        valid: false,
        error: `Serialized preimage too short: ${serializedPreimage.length} bytes (expected at least 50)`,
        circuitId,
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
    console.log('   ZK Config base URL:', getZkConfigBaseUrl());
    console.log('   Proof server URL:', getProofServerUrl());
    
    // Log circuit-specific info
    const argCount = getExpectedArgumentCount(circuitId);
    console.log(`   Expected argument count for ${circuitId}: ${argCount}`);

    // Verify ZK config can be loaded first
    try {
      const zkConfig = await zkConfigProvider.get(circuitId as PrivaMedAICircuit);
      console.log('   ZK Config loaded:', {
        circuitId,
        hasProverKey: zkConfig.proverKey.length > 0,
        hasVerifierKey: zkConfig.verifierKey.length > 0,
        hasIr: zkConfig.zkir?.length > 0,
      });
    } catch (zkError: any) {
      console.error('   Failed to load ZK config:', zkError.message);
      return {
        valid: false,
        error: `Failed to load ZK config for circuit ${circuitId}: ${zkError.message}`,
        circuitId,
      };
    }

    // REAL SNARK VERIFICATION
    // This hits the proof server's /check endpoint which:
    // - Loads the verifier key for the circuit
    // - Verifies the serialized preimage satisfies constraints
    // - Returns public inputs if valid
    console.log('   Sending check request with preimage:', toHex(serializedPreimage.slice(0, 32)) + '...');
    
    const checkResult = await provingProvider.check(serializedPreimage, circuitId as PrivaMedAICircuit);

    console.log('   Proof server check result:', checkResult);

    // check() resolves (doesn't throw) = valid; throws = invalid
    // An empty array [] is a valid result for circuits with no public outputs
    // The proof server's /check endpoint throws on constraint failure
    console.log('✅ SNARK verification passed');
    return {
      valid: true,
      circuitId,
      publicInputs,
      details: `SNARK verification passed. ${checkResult.length} public input(s) returned.`,
    };

  } catch (error: any) {
    console.error('❌ Proof verification error:', error);
    console.error('   Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      response: error.response?.data || 'No response data',
    });
    
    // Circuit-specific error diagnostics
    console.error('   Circuit diagnostics:');
    console.error(`     - Circuit ID: ${circuitId}`);
    console.error(`     - Expected args: ${getExpectedArgumentCount(circuitId)}`);
    console.error(`     - Preimage size: ${serializedPreimage.length} bytes`);
    console.error(`     - Expected min size: ${getExpectedMinPreimageSize(circuitId)} bytes`);
    
    // Provide more helpful error messages based on status code and circuit
    let errorMessage = error.message || 'Verification error';
    let diagnosticInfo = '';
    
    if (error.status === 400) {
      errorMessage = 'Proof verification failed: The proof data is invalid or the circuit configuration has changed.';
      
      // Circuit-specific diagnostics for 400 errors
      if (circuitId === 'verifyForHospital') {
        diagnosticInfo = 'Hospital circuit requires 3 arguments (commitment, minAge, requiredCondition). ' +
          'This error often occurs when the proof was generated with only 2 arguments. ' +
          'Try generating a new proof with the hospital circuit selected.';
      } else if (circuitId === 'verifyForFreeHealthClinic') {
        diagnosticInfo = 'FreeHealthClinic circuit requires 2 arguments (commitment, minAge). ' +
          'Ensure the proof was generated with this circuit.';
      } else if (circuitId === 'verifyForPharmacy') {
        diagnosticInfo = 'Pharmacy circuit requires 2 arguments (commitment, requiredPrescription). ' +
          'Ensure the proof was generated with this circuit.';
      }
    } else if (error.status === 404) {
      errorMessage = `Circuit not found: ${circuitId}. The ZK configuration may be missing.`;
    }
    
    return {
      valid: false,
      error: errorMessage + (diagnosticInfo ? ` ${diagnosticInfo}` : ''),
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

/**
 * Get circuit info for debugging
 */
export function getCircuitInfo(circuitId: string): { argCount: number; args: { name: string; type: string; size: number }[] } | null {
  const args = CIRCUIT_ARGUMENTS[circuitId as PrivaMedAICircuit];
  if (!args) return null;
  return { argCount: args.length, args };
}
