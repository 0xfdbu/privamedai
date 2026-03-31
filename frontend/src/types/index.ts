/**
 * PrivaMedAI Type Definitions
 */

export type ContractState = 'initializing' | 'syncing' | 'ready' | 'error';

export type CredentialStatus = 'VALID' | 'REVOKED' | 'NOT_FOUND';

export type IssuerStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Credential {
  commitment: string;
  issuer: string;
  claimHash: string;
  expiry: number;
  status: CredentialStatus;
  credentialData?: string;
}

export interface IssuerInfo {
  pubKey: string;
  nameHash: string;
  status: IssuerStatus;
  credentialsIssued: number;
}

export interface CredentialFormData {
  subject: string;
  claimType: ClaimType;
  claimValue: string;
  expiryDays: number;
}

export type ClaimType = 
  | 'age' 
  | 'vaccination' 
  | 'insurance' 
  | 'medical_degree' 
  | 'license' 
  | 'clearance';

export interface IssuedCredential extends CredentialFormData {
  commitment: string;
  credentialData: string;
  claimHash: string;
  txId?: string;
  timestamp: number;
}

export interface StoredCredential {
  commitment: string;
  claimType: string;
  claimValue: string;
  credentialData: string;
  expiry: number;
  issuer: string;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info';

export type PortalType = 'issuer' | 'user' | 'verifier';

export interface NavItem {
  id: PortalType;
  label: string;
  icon: string;
  description: string;
}

export interface WalletContextValue {
  seed: string | null;
  isConnected: boolean;
  connect: (seed: string) => void;
  disconnect: () => void;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error';

export interface ZKProof {
  proof: string;
  commitment: string;
  claimType: string;
  txId: string;
  timestamp: number;
  credentialData: string;
}

export interface VerificationResult {
  status: 'valid' | 'invalid' | 'error' | 'checking';
  message: string;
  txId?: string;
}
