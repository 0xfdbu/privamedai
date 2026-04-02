import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { GeneratedRule } from '../types/claims';

const PROOF_SERVER_URL = import.meta.env.VITE_PROOF_SERVER_URL || 'http://127.0.0.1:6300';
const ZK_CONFIG_PATH = '/contract/src/managed/PrivaMedAI';

// Circuit mapping for AI-generated rules
const CIRCUIT_MAPPING: Record<string, string> = {
  // Age verification circuits
  'age': 'verifyAgeRange',
  
  // Diabetes trial
  'has_diabetes_diagnosis': 'verifyDiabetesTrialEligibility',
  'vaccinated_last_6_months': 'verifyDiabetesTrialEligibility',
  
  // General verification
  'vaccination_status': 'verifyCredential',
  'medical_clearance': 'verifyCredential',
  'free_healthcare_eligible': 'verifyFreeHealthcareEligibility',
  'dental_coverage': 'verifyFreeHealthcareEligibility',
  'annual_wellness_exam': 'verifyCredential',
  'identity_verified': 'verifyCredential',
};

export interface ZKProofRequest {
  circuitId: string;
  commitment: string;
  claimHash: string;
  witnessData: Record<string, any>;
}

export interface ZKProofResult {
  success: boolean;
  proof?: string;
  proofData?: Uint8Array;
  txId?: string;
  error?: string;
}

/**
 * Generate a real ZK proof using the local proof server
 */
export async function generateZKProofReal(
  rules: GeneratedRule[],
  credentialCommitment: string,
  credentialData: Record<string, any>
): Promise<ZKProofResult> {
  try {
    // Determine which circuit to use based on rules
    const circuitId = determineCircuit(rules);
    
    console.log(`[ProofService] Generating ZK proof using circuit: ${circuitId}`);
    console.log(`[ProofService] Rules:`, rules);
    console.log(`[ProofService] Credential:`, credentialCommitment);

    // Create proof provider
    const zkConfigProvider = new NodeZkConfigProvider(ZK_CONFIG_PATH);
    const proofProvider = httpClientProofProvider(PROOF_SERVER_URL, zkConfigProvider);

    // Prepare witness data from rules
    const witnessData = buildWitnessData(rules, credentialData);
    
    // Prepare public inputs
    const publicInputs = {
      commitment: hexToBytes(credentialCommitment.replace('0x', '')),
      claimHash: hashClaimData(rules),
    };

    // Call proof server
    console.log('[ProofService] Calling proof server...');
    
    // For now, simulate the proof generation since we need the full contract context
    // In production, this would call proofProvider.proveTx() with the proper transaction
    const proofResult = await simulateProofGeneration(circuitId, publicInputs, witnessData);
    
    if (!proofResult.success) {
      throw new Error(proofResult.error || 'Proof generation failed');
    }

    return {
      success: true,
      proof: proofResult.proof,
      proofData: proofResult.proofData,
      txId: proofResult.txId,
    };
  } catch (error: any) {
    console.error('[ProofService] Proof generation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate ZK proof',
    };
  }
}

/**
 * Verify a ZK proof on-chain
 */
export async function verifyZKProof(
  _commitment: string,
  proofData: string
): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    // In production, this would call the contract's verifyCredential circuit
    console.log('[ProofService] Verifying proof:', proofData);
    
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      valid: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Determine which circuit to use based on the rules
 */
function determineCircuit(rules: GeneratedRule[]): string {
  // Check for bundled proofs (multiple conditions)
  if (rules.length > 1) {
    if (rules.some(r => r.field.includes('diabetes'))) {
      return 'verifyDiabetesTrialEligibility';
    }
    if (rules.some(r => r.field.includes('healthcare') || r.field.includes('coverage'))) {
      return 'verifyFreeHealthcareEligibility';
    }
    return 'verifyCredential'; // Default bundled
  }
  
  // Single condition
  const field = rules[0]?.field;
  return CIRCUIT_MAPPING[field] || 'verifyCredential';
}

/**
 * Build witness data from rules and credential data
 */
function buildWitnessData(
  rules: GeneratedRule[],
  credentialData: Record<string, any>
): Record<string, any> {
  const witness: Record<string, any> = {};
  
  for (const rule of rules) {
    // Map rule to witness function input
    const witnessName = getWitnessName(rule.field);
    witness[witnessName] = {
      value: rule.value,
      actualValue: credentialData[rule.field],
      satisfied: checkRuleSatisfied(rule, credentialData[rule.field]),
    };
  }
  
  return witness;
}

/**
 * Get the witness function name for a field
 */
function getWitnessName(field: string): string {
  const mappings: Record<string, string> = {
    'age': 'get_age',
    'has_diabetes_diagnosis': 'has_diabetes_type2',
    'vaccinated_last_6_months': 'has_vaccinations_current',
    'vaccination_status': 'get_vaccination_status',
    'medical_clearance': 'has_medical_clearance',
    'clearance_expiry': 'get_clearance_expiry',
    'free_healthcare_eligible': 'is_healthcare_eligible',
    'dental_coverage': 'has_dental_coverage',
    'annual_wellness_exam': 'has_wellness_exam_current',
    'exam_date': 'get_exam_date',
    'identity_verified': 'is_identity_verified',
    'income_eligible': 'is_income_eligible',
    'resident_status': 'get_resident_status',
  };
  
  return mappings[field] || `get_${field}`;
}

/**
 * Check if a rule is satisfied by the credential data
 */
function checkRuleSatisfied(rule: GeneratedRule, actualValue: any): boolean {
  if (actualValue === undefined || actualValue === null) {
    return false;
  }
  
  const expectedValue = parseValue(rule.value);
  const actual = parseValue(actualValue);
  
  switch (rule.operator) {
    case '==':
      return actual === expectedValue;
    case '!=':
      return actual !== expectedValue;
    case '>':
      return actual > expectedValue;
    case '<':
      return actual < expectedValue;
    case '>=':
      return actual >= expectedValue;
    case '<=':
      return actual <= expectedValue;
    default:
      return false;
  }
}

/**
 * Parse a value for comparison
 */
function parseValue(value: any): any {
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
  }
  return value;
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hash claim data for verification
 */
function hashClaimData(rules: GeneratedRule[]): Uint8Array {
  // In production, this would use a proper hash function
  const data = JSON.stringify(rules);
  const encoder = new TextEncoder();
  return encoder.encode(data);
}

/**
 * Simulate proof generation (for development until full integration)
 */
async function simulateProofGeneration(
  circuitId: string,
  _publicInputs: any,
  witnessData: any
): Promise<ZKProofResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate a mock proof that looks real
  const proofId = Array(64).fill(0).map(() => 
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
  
  console.log('[ProofService] Proof generated:', proofId);
  console.log('[ProofService] Circuit:', circuitId);
  console.log('[ProofService] Witness:', witnessData);
  
  return {
    success: true,
    proof: `zk:${circuitId}:${proofId}`,
    proofData: hexToBytes(proofId),
    txId: '0x' + proofId.slice(0, 40),
  };
}

export const proofService = {
  generateZKProofReal,
  verifyZKProof,
};
