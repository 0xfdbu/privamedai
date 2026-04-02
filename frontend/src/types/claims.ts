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
}

export interface IssuerInfo {
  name: string;
  publicKey: string;
  isActive: boolean;
  credentialsIssued: number;
}
