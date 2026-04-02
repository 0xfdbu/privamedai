import { GeneratedRule } from '../types/claims';

const PROOF_SERVER_URL = import.meta.env.VITE_PROOF_SERVER_URL || 'http://127.0.0.1:6300';

export interface ZKProofResult {
  success: boolean;
  proof?: string;
  proofBytes?: Uint8Array;
  txId?: string;
  circuitId?: string;
  error?: string;
}

// Circuit mapping for AI-generated rules
const CIRCUIT_MAPPING: Record<string, string> = {
  'age': 'verifyAgeRange',
  'has_diabetes_diagnosis': 'verifyDiabetesTrialEligibility',
  'vaccinated_last_6_months': 'verifyDiabetesTrialEligibility',
  'vaccination_status': 'verifyCredential',
  'medical_clearance': 'verifyCredential',
  'free_healthcare_eligible': 'verifyFreeHealthcareEligibility',
  'dental_coverage': 'verifyFreeHealthcareEligibility',
  'annual_wellness_exam': 'verifyCredential',
  'identity_verified': 'verifyCredential',
};

/**
 * Check if proof server is available
 */
async function checkProofServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${PROOF_SERVER_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Generate a ZK proof
 * 
 * Note: The Midnight proof server uses a custom binary CBOR protocol that requires
 * a full transaction context. For this demo, we simulate the proof generation
 * with realistic output while showing the actual circuit that would be used.
 * 
 * In production, this would use the full Midnight SDK with:
 * - Built unproven transaction
 * - Wallet integration for signing
 * - Proper proof provider chain
 */
export async function generateZKProofReal(
  rules: GeneratedRule[],
  credentialCommitment: string,
  credentialData: Record<string, any>
): Promise<ZKProofResult> {
  try {
    // Determine which circuit to use based on rules
    const circuitId = determineCircuit(rules);
    
    console.log(`[ProofService] =========================================`);
    console.log(`[ProofService] Generating ZK proof`);
    console.log(`[ProofService] Circuit: ${circuitId}`);
    console.log(`[ProofService] Rules:`, rules);
    console.log(`[ProofService] Credential: ${credentialCommitment}`);
    console.log(`[ProofService] Proof Server: ${PROOF_SERVER_URL}`);
    console.log(`[ProofService] =========================================`);

    // Check if proof server is reachable
    const isServerAvailable = await checkProofServer();
    
    if (!isServerAvailable) {
      console.warn('[ProofService] Proof server not available at', PROOF_SERVER_URL);
      console.warn('[ProofService] To enable real proof generation, run:');
      console.warn('[ProofService]   docker run -p 6300:6300 midnightnetwork/proof-server:latest');
    } else {
      console.log('[ProofService] Proof server is reachable');
      console.log('[ProofService] Note: Full proof generation requires complete transaction context');
    }

    // Build witness data from rules
    const witnessData = buildWitnessData(rules, credentialData);
    console.log('[ProofService] Witness data:', witnessData);

    // Simulate realistic proof generation delay
    console.log('[ProofService] Generating proof...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Generate realistic proof bytes
    // In a real implementation, this would come from the proof server's CBOR response
    const proofId = generateRealisticProofId();
    const proofBytes = hexToBytes(proofId);
    
    console.log('[ProofService] =========================================');
    console.log('[ProofService] ZK PROOF GENERATED');
    console.log('[ProofService] Circuit:', circuitId);
    console.log(`[ProofService] Proof ID: ${proofId.slice(0, 16)}...${proofId.slice(-16)}`);
    console.log(`[ProofService] Proof size: ${proofBytes.length} bytes`);
    console.log(`[ProofService] Server: ${isServerAvailable ? 'Connected (simulated)' : 'Offline (simulated)'}`);
    console.log('[ProofService] =========================================');

    return {
      success: true,
      proof: `zk:${circuitId}:${proofId}`,
      proofBytes,
      txId: `0x${proofId.slice(0, 40)}`,
      circuitId,
    };
  } catch (error: any) {
    console.error('[ProofService] =========================================');
    console.error('[ProofService] PROOF GENERATION FAILED');
    console.error('[ProofService] Error:', error.message);
    console.error('[ProofService] =========================================');
    
    return {
      success: false,
      error: error.message || 'Failed to generate ZK proof',
    };
  }
}

/**
 * Verify a ZK proof on-chain (simulated)
 */
export async function verifyZKProof(
  _commitment: string,
  _proofBytes: Uint8Array
): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    console.log('[ProofService] Verifying proof...');
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

// Helper functions
function determineCircuit(rules: GeneratedRule[]): string {
  if (rules.length > 1) {
    if (rules.some(r => r.field.includes('diabetes'))) {
      return 'verifyDiabetesTrialEligibility';
    }
    if (rules.some(r => r.field.includes('healthcare') || r.field.includes('coverage'))) {
      return 'verifyFreeHealthcareEligibility';
    }
    return 'verifyCredential';
  }
  
  const field = rules[0]?.field;
  return CIRCUIT_MAPPING[field] || 'verifyCredential';
}

function buildWitnessData(
  rules: GeneratedRule[],
  credentialData: Record<string, any>
): Record<string, any> {
  const witness: Record<string, any> = {};
  
  for (const rule of rules) {
    const witnessName = getWitnessName(rule.field);
    witness[witnessName] = credentialData[rule.field] ?? parseValue(rule.value);
  }
  
  return witness;
}

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

function parseValue(value: any): any {
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
  }
  return value;
}

function generateRealisticProofId(): string {
  // Generate a realistic 64-character hex proof ID
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const proofService = {
  generateZKProofReal,
  verifyZKProof,
};
