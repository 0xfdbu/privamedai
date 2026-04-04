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
    for (const rule of rules) {
      const value = BigInt(rule.value);
      if (rule.field === 'age' && (rule.operator === '>=' || rule.operator === '>')) {
        circuitParams.minAge = value;
      } else if (rule.field === 'conditionCode' && rule.operator === '==') {
        circuitParams.requiredCondition = value;
      } else if (rule.field === 'prescriptionCode' && rule.operator === '==') {
        circuitParams.requiredPrescription = value;
      }
    }
    console.log('   Circuit params:', {
      minAge: circuitParams.minAge?.toString(),
      requiredCondition: circuitParams.requiredCondition?.toString(),
      requiredPrescription: circuitParams.requiredPrescription?.toString(),
    });
    
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
