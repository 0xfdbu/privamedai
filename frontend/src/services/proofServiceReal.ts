import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { GeneratedRule } from '../types/claims';

const PROOF_SERVER_URL = import.meta.env.VITE_PROOF_SERVER_URL || 'http://127.0.0.1:6300';

// ZK Config provider that fetches from the contract directory
class ZkConfigProvider {
  private basePath: string;
  
  constructor(basePath: string) {
    this.basePath = basePath;
  }
  
  async getVerifierKey(circuitId: string): Promise<Uint8Array> {
    // Try both prefixed and unprefixed names
    const names = [circuitId, `PrivaMedAI#${circuitId}`];
    
    for (const name of names) {
      try {
        const response = await fetch(`${this.basePath}/keys/${name}.verifier`);
        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }
      } catch (e) {
        // Try next name
      }
    }
    
    throw new Error(`Verifier key not found for circuit: ${circuitId}`);
  }
  
  async getZkir(circuitId: string): Promise<Uint8Array> {
    const names = [circuitId, `PrivaMedAI#${circuitId}`];
    
    for (const name of names) {
      try {
        const response = await fetch(`${this.basePath}/zkir/${name}.bzkir`);
        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }
      } catch (e) {
        // Try next name
      }
    }
    
    throw new Error(`ZKIR not found for circuit: ${circuitId}`);
  }
}

export interface ZKProofRequest {
  circuitId: string;
  commitment: string;
  claimHash: string;
  witnessData: Record<string, any>;
}

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

/**
 * Generate a REAL ZK proof by calling the local proof server
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
    console.log(`[ProofService] Generating REAL ZK proof`);
    console.log(`[ProofService] Circuit: ${circuitId}`);
    console.log(`[ProofService] Rules:`, rules);
    console.log(`[ProofService] Credential: ${credentialCommitment}`);
    console.log(`[ProofService] Proof Server: ${PROOF_SERVER_URL}`);
    console.log(`[ProofService] =========================================`);

    // Create ZK config provider pointing to contract keys
    const zkConfigPath = '/contract/src/managed/PrivaMedAI';
    const zkConfigProvider = new ZkConfigProvider(zkConfigPath);
    
    // Test if proof server is reachable
    try {
      const healthCheck = await fetch(`${PROOF_SERVER_URL}/health`, { 
        method: 'GET',
        mode: 'no-cors'
      });
      console.log('[ProofService] Proof server health check:', healthCheck.status);
    } catch (e) {
      console.warn('[ProofService] Could not reach proof server at', PROOF_SERVER_URL);
      console.warn('[ProofService] Make sure proof server is running:');
      console.warn('[ProofService]   docker run -p 6300:6300 midnightnetwork/proof-server:latest');
      throw new Error('Proof server not available. Is it running on port 6300?');
    }

    // Build witness data from rules and credential data
    const witnessData = buildWitnessData(rules, credentialData);
    console.log('[ProofService] Witness data:', witnessData);

    // Fetch circuit configuration
    console.log('[ProofService] Fetching circuit configuration...');
    let verifierKey: Uint8Array;
    let zkir: Uint8Array;
    
    try {
      verifierKey = await zkConfigProvider.getVerifierKey(circuitId);
      zkir = await zkConfigProvider.getZkir(circuitId);
      console.log('[ProofService] Circuit config loaded:');
      console.log(`  - Verifier key: ${verifierKey.length} bytes`);
      console.log(`  - ZKIR: ${zkir.length} bytes`);
    } catch (e: any) {
      console.error('[ProofService] Failed to load circuit config:', e.message);
      throw new Error(`Circuit configuration not found: ${circuitId}`);
    }

    // Prepare public inputs
    const publicInputs = {
      commitment: hexToBytes(credentialCommitment.replace('0x', '')),
      claimHash: hashClaimData(rules),
    };
    console.log('[ProofService] Public inputs prepared');

    // Call the proof server with the proper format
    console.log('[ProofService] Calling proof server...');
    
    // Build the proof request
    const proofRequest = {
      circuitId,
      publicInputs: Array.from(publicInputs.commitment),
      witness: Object.entries(witnessData).map(([key, value]) => ({
        name: key,
        value: typeof value === 'boolean' ? (value ? 1 : 0) : value,
      })),
      zkir: Array.from(zkir),
      verifierKey: Array.from(verifierKey),
    };

    // Call proof server directly via fetch
    const proofResponse = await fetch(`${PROOF_SERVER_URL}/prove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proofRequest),
    });

    if (!proofResponse.ok) {
      const errorText = await proofResponse.text();
      throw new Error(`Proof server error: ${proofResponse.status} - ${errorText}`);
    }

    const proofResult = await proofResponse.json();
    
    if (!proofResult.proof) {
      throw new Error('Proof server returned empty proof');
    }

    const proofBytes = new Uint8Array(proofResult.proof);
    const proofId = bytesToHex(proofBytes.slice(0, 32));
    
    console.log('[ProofService] =========================================');
    console.log('[ProofService] REAL ZK PROOF GENERATED SUCCESSFULLY');
    console.log('[ProofService] Proof ID:', proofId);
    console.log('[ProofService] Proof size:', proofBytes.length, 'bytes');
    console.log('[ProofService] =========================================');

    return {
      success: true,
      proof: `zk:${circuitId}:${proofId}`,
      proofBytes,
      txId: proofResult.txId || `0x${proofId}`,
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
 * Verify a ZK proof on-chain
 */
export async function verifyZKProof(
  commitment: string,
  proofBytes: Uint8Array
): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    console.log('[ProofService] Verifying proof on-chain...');
    
    // Call the contract's verify function via the proof server
    const verifyResponse = await fetch(`${PROOF_SERVER_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commitment: hexToBytes(commitment.replace('0x', '')),
        proof: Array.from(proofBytes),
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error(`Verification failed: ${verifyResponse.status}`);
    }

    const result = await verifyResponse.json();
    
    return {
      success: true,
      valid: result.valid === true,
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

function hashClaimData(rules: GeneratedRule[]): Uint8Array {
  const data = JSON.stringify(rules);
  const encoder = new TextEncoder();
  return encoder.encode(data);
}

export const proofService = {
  generateZKProofReal,
  verifyZKProof,
};
