/**
 * Re-export all types from claims.ts
 */
export * from './claims';

export interface ClaimField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
}

export interface ParsedClaim {
  type: string;
  fields: Record<string, string | number | boolean>;
  hash: string;
}

export type UserRole = 'patient' | 'provider' | 'verifier';

export interface WalletState {
  isConnected: boolean;
  address?: string;
  balance?: string;
  role?: UserRole;
}
