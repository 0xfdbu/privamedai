export interface GeneratedRule {
  field: string;
  operator: string;
  value: string;
  description: string;
}

export interface ClaimRule {
  id: string;
  category: 'clinical_trial' | 'healthcare' | 'employment' | 'travel' | 'education' | 'custom';
  description: string;
  naturalLanguage: string;
  compactRule: string;
  circuit: string;
  circuitParams: Record<string, any>;
  parameters: ClaimParameter[];
  requiredCredentials: string[];
  privacyLevel: 'low' | 'medium' | 'high';
  resultDescription: string;
}

export interface ClaimParameter {
  name: string;
  type: 'uint' | 'bool' | 'string' | 'bytes32';
  value: any;
  description: string;
  witnessName?: string;
}

/**
 * HealthClaim - Private health data structure
 * This data is kept private and only revealed through selective disclosure
 */
export interface HealthClaim {
  age: number;           // Uint<8>
  conditionCode: number; // Uint<16>
  prescriptionCode: number; // Uint<16>
}

/**
 * Extended credential with selective disclosure support
 */
export interface Credential {
  id: string;
  issuer: string;
  claimType: string;
  issuedAt: number;
  expiresAt: number;
  isRevoked: boolean;
  encryptedData: string;
  commitment: string;
  claimHash: string;
  healthClaim?: HealthClaim; // Private health data (witness)
  claimDataBytes?: number[];  // Original claim data bytes for proof generation
}

export interface IssuerInfo {
  name: string;
  publicKey: string;
  isActive: boolean;
  credentialsIssued: number;
}

/**
 * Selective disclosure verifier types
 */
export type SelectiveDisclosureVerifier = 
  | 'freeHealthClinic'   // Only verifies age >= minAge
  | 'pharmacy'           // Only verifies prescription code
  | 'hospital';          // Verifies age threshold AND condition

/**
 * Selective disclosure request
 */
export interface SelectiveDisclosureRequest {
  verifier: SelectiveDisclosureVerifier;
  credentialCommitment: string;
  healthClaim: HealthClaim;
  params: {
    minAge?: number;
    requiredPrescription?: number;
    requiredCondition?: number;
  };
}
