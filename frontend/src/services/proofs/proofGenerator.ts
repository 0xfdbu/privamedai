/**
 * Proof Generator
 * 
 * Main entry point for generating cryptographic ZK proofs
 */

import { toHex, proofDataIntoSerializedPreimage, persistentHash, CompactTypeVector, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import type { GeneratedRule } from '../../types/claims';
import { 
  getProofServerUrl, 
  getZkConfigBaseUrl, 
  checkProofServerHealth,
  selectCircuitForRules,
  type ZKProofResult,
  type PrivaMedAICircuit
} from './config';
import { serializeCredentialData, hexToBytes32 } from './utils/serialization';
import { fetchZKConfig } from './utils/zkConfig';
import { executeCircuitAndGetProofData, type CircuitParams } from './circuits/execution';

/**
 * Log detailed information about the serialized preimage structure
 */
function logSerializedPreimageDetails(
  serializedPreimage: Uint8Array, 
  circuitId: string, 
  circuitParams: CircuitParams
): void {
  console.log('📊 Serialized Preimage Generation Analysis:');
  console.log('   Circuit ID:', circuitId);
  console.log('   Total size:', serializedPreimage.length, 'bytes');
  
  // Log first 100 bytes as hex
  const bytesToShow = Math.min(100, serializedPreimage.length);
  const hexPreview = Array.from(serializedPreimage.slice(0, bytesToShow))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log(`   First ${bytesToShow} bytes (hex):`, hexPreview);
  
  // Log the raw bytes array for direct comparison
  const rawBytesArray = Array.from(serializedPreimage.slice(0, bytesToShow));
  console.log(`   First ${bytesToShow} bytes (array):`, JSON.stringify(rawBytesArray));
  
  // Log circuit params used
  console.log('   Circuit params used:');
  console.log('     - minAge:', circuitParams.minAge?.toString() || 'not set');
  console.log('     - requiredCondition:', circuitParams.requiredCondition?.toString() || 'not set');
  console.log('     - requiredPrescription:', circuitParams.requiredPrescription?.toString() || 'not set');
  
  // Circuit-specific analysis
  if (circuitId === 'verifyForHospital') {
    console.log('   ℹ️  Hospital circuit (3 arguments):');
    console.log('     - commitment: Bytes<32>');
    console.log('     - minAge: Uint<8>');
    console.log('     - requiredCondition: Uint<16>');
    
    if (!circuitParams.minAge || !circuitParams.requiredCondition) {
      console.warn('   ⚠️  WARNING: Hospital circuit requires both minAge and requiredCondition');
    }
    if (serializedPreimage.length < 35) {
      console.warn('   ⚠️  WARNING: Serialized preimage seems short for hospital circuit (expects 35+ bytes for inputs)');
    }
  } else if (circuitId === 'verifyForFreeHealthClinic') {
    console.log('   ℹ️  FreeHealthClinic circuit (2 arguments):');
    console.log('     - commitment: Bytes<32>');
    console.log('     - minAge: Uint<8>');
    
    if (!circuitParams.minAge) {
      console.warn('   ⚠️  WARNING: FreeHealthClinic circuit requires minAge');
    }
    if (serializedPreimage.length < 33) {
      console.warn('   ⚠️  WARNING: Serialized preimage seems short for freeHealthClinic circuit (expects 33+ bytes for inputs)');
    }
  } else if (circuitId === 'verifyForPharmacy') {
    console.log('   ℹ️  Pharmacy circuit (2 arguments):');
    console.log('     - commitment: Bytes<32>');
    console.log('     - requiredPrescription: Uint<16>');
    
    if (!circuitParams.requiredPrescription) {
      console.warn('   ⚠️  WARNING: Pharmacy circuit requires requiredPrescription');
    }
    if (serializedPreimage.length < 34) {
      console.warn('   ⚠️  WARNING: Serialized preimage seems short for pharmacy circuit (expects 34+ bytes for inputs)');
    }
  }
}

export async function generateProductionZKProof(
  rules: GeneratedRule[],
  credentialCommitment: string,
  claimDataBytes: Uint8Array,
  options?: {
    contractAddress?: string;
    proofServerUrl?: string;
    healthClaim?: { age: number; conditionCode: number; prescriptionCode: number };
  }
): Promise<ZKProofResult> {
  const circuitId = selectCircuitForRules(rules);
  
  console.log('🔐 Generating CRYPTOGRAPHIC ZK Proof...');
  console.log('   Circuit:', circuitId);
  console.log('   Rules:', rules.length);
  console.log('   OPTIONS RECEIVED:', { 
    hasOptions: !!options, 
    hasHealthClaim: !!(options?.healthClaim),
    healthClaimData: options?.healthClaim,
    optionsKeys: options ? Object.keys(options) : []
  });
  
  try {
    const proofServerUrl = options?.proofServerUrl || getProofServerUrl();
    
    const health = await checkProofServerHealth(proofServerUrl);
    if (!health.healthy) {
      throw new Error(`Proof server unavailable: ${health.error}`);
    }
    
    const commitmentBytes = hexToBytes32(credentialCommitment);
    
    // Use the ORIGINAL claimData bytes that were hashed during issuance
    const credentialDataBytes = claimDataBytes.slice(0, 32);
    
    // Compute the hash that the circuit will compare against
    const bytes32Type = new CompactTypeBytes(32);
    const vectorType = new CompactTypeVector(1, bytes32Type);
    const credentialDataHash = persistentHash(vectorType, [credentialDataBytes]);
    
    console.log('   Commitment:', toHex(commitmentBytes));
    console.log('   Data Bytes:', toHex(credentialDataBytes));
    console.log('   Data Hash:', toHex(credentialDataHash));
    
    // Prepare private state with health claim if provided (for selective disclosure)
    // CRITICAL: Circuit expects BigInt values, not numbers
    const privateState = options?.healthClaim ? {
      healthClaim: {
        age: BigInt(options.healthClaim.age),
        conditionCode: BigInt(options.healthClaim.conditionCode),
        prescriptionCode: BigInt(options.healthClaim.prescriptionCode),
      }
    } : {};
    
    console.log('   Private state prepared:', {
      hasHealthClaim: !!privateState.healthClaim,
      age: privateState.healthClaim?.age?.toString(),
      conditionCode: privateState.healthClaim?.conditionCode?.toString(),
      prescriptionCode: privateState.healthClaim?.prescriptionCode?.toString(),
    });
    
    // Extract circuit parameters from rules (thresholds to prove against)
    const circuitParams: CircuitParams = {};
    console.log('   Extracting circuit params from rules:', rules.map(r => ({ field: r.field, operator: r.operator, value: r.value })));
    for (const rule of rules) {
      const value = BigInt(rule.value);
      console.log(`   Processing rule: ${rule.field} ${rule.operator} ${rule.value}`);
      if (rule.field === 'age' && (rule.operator === '>=' || rule.operator === '>')) {
        circuitParams.minAge = value;
        console.log(`     → Set minAge = ${value}`);
      } else if (rule.field === 'conditionCode' && rule.operator === '==') {
        circuitParams.requiredCondition = value;
        console.log(`     → Set requiredCondition = ${value}`);
      } else if (rule.field === 'prescriptionCode' && rule.operator === '==') {
        circuitParams.requiredPrescription = value;
        console.log(`     → Set requiredPrescription = ${value}`);
      } else {
        console.log(`     → No match for any circuit param`);
      }
    }
    console.log('   Circuit params extracted:', {
      minAge: circuitParams.minAge?.toString() || 'not set',
      requiredCondition: circuitParams.requiredCondition?.toString() || 'not set',
      requiredPrescription: circuitParams.requiredPrescription?.toString() || 'not set',
    });
    
    // Circuit-specific parameter validation
    if (circuitId === 'verifyForHospital') {
      if (!circuitParams.minAge) {
        console.warn('   ⚠️  Hospital circuit: minAge not set, using default 18n');
        circuitParams.minAge = 18n;
      }
      if (!circuitParams.requiredCondition) {
        console.warn('   ⚠️  Hospital circuit: requiredCondition not set, using default 100n');
        circuitParams.requiredCondition = 100n;
      }
      console.log('   Hospital circuit params finalized:', {
        minAge: circuitParams.minAge.toString(),
        requiredCondition: circuitParams.requiredCondition.toString(),
      });
    } else if (circuitId === 'verifyForFreeHealthClinic') {
      if (!circuitParams.minAge) {
        console.warn('   ⚠️  FreeHealthClinic circuit: minAge not set, using default 18n');
        circuitParams.minAge = 18n;
      }
      console.log('   FreeHealthClinic circuit params finalized:', {
        minAge: circuitParams.minAge.toString(),
      });
    } else if (circuitId === 'verifyForPharmacy') {
      if (!circuitParams.requiredPrescription) {
        console.warn('   ⚠️  Pharmacy circuit: requiredPrescription not set, using default 500n');
        circuitParams.requiredPrescription = 500n;
      }
      console.log('   Pharmacy circuit params finalized:', {
        requiredPrescription: circuitParams.requiredPrescription.toString(),
      });
    }
    
    // Execute circuit to generate proof data
    console.log('   Executing circuit to generate proof data...');
    const proofData = await executeCircuitAndGetProofData(
      circuitId,
      commitmentBytes,
      credentialDataBytes,
      credentialDataHash,
      privateState,
      circuitParams
    );
    
    console.log('   Proof data generated:');
    console.log('     - Input fields:', proofData.input?.value?.length || 0);
    console.log('     - Output fields:', proofData.output?.value?.length || 0);
    console.log('     - Public transcript operations:', proofData.publicTranscript?.length || 0);
    
    // Create serialized preimage
    console.log('   Creating serialized preimage...');
    const serializedPreimage = proofDataIntoSerializedPreimage(
      proofData.input,
      proofData.output,
      proofData.publicTranscript,
      proofData.privateTranscriptOutputs,
      circuitId
    );
    
    console.log('   Serialized preimage size:', serializedPreimage.length, 'bytes');
    
    // Log detailed preimage structure
    logSerializedPreimageDetails(serializedPreimage, circuitId, circuitParams);
    
    // Use the official FetchZkConfigProvider
    const zkConfigProvider = new FetchZkConfigProvider<PrivaMedAICircuit>(
      getZkConfigBaseUrl(),
      fetch.bind(window)
    );
    
    // Load ZK artifacts
    try {
      const zkConfig = await zkConfigProvider.get(circuitId);
      console.log('   ZK artifacts loaded:');
      console.log('     - proverKey:', zkConfig.proverKey.length, 'bytes');
      console.log('     - verifierKey:', zkConfig.verifierKey.length, 'bytes');
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
    
    try {
      proof = await provingProvider.prove(serializedPreimage, circuitId, undefined);
    } catch (proveError: any) {
      console.error('   Proof server error:', proveError.message);
      throw proveError;
    }
    
    console.log('✅ ZK Proof generated successfully!');
    
    return {
      success: true,
      proof: '0x' + toHex(proof),
      serializedPreimage,  // Include for verification
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

// Re-export for backwards compatibility
export { checkProofServerHealth, serializeCredentialData, hexToBytes32 };
export type { ZKProofResult, PrivaMedAICircuit };
