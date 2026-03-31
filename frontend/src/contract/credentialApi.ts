import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { FinalizedTransaction, Proof, SignatureEnabled, Transaction, TransactionId } from '@midnight-ntwrk/ledger-v8';

// Types
export interface CredentialData {
  commitment: string;
  issuer: string;
  claimHash: string;
  expiry: number;
  status: 'VALID' | 'REVOKED';
}

export interface CredentialWithPrivateData extends CredentialData {
  credentialData: string;
  claimType: string;
  claimValue: string;
}

export interface CredentialAPI {
  issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string>;
  revokeCredential(commitment: string): Promise<string>;
  verifyCredential(commitment: string, credentialData: string): Promise<boolean>;
  verifyOnChain(commitment: string, claimHash: string): Promise<boolean>;
  getCredentialStatus(commitment: string): Promise<CredentialData | null>;
  storeCredential(credential: CredentialWithPrivateData): void;
  getStoredCredentials(): CredentialWithPrivateData[];
  getContractAddress(): string;
}

// Deployed contract address
const CONTRACT_ADDRESS = '9a965779dcd16a1f1d295dc890125cc11b93a2d037a0b298a66e4b8e1f3bf187';

// Create credential API instance
export async function createCredentialAPI(
  walletApi: any,
  _networkConfig: { indexerUri: string; indexerWsUri: string; proofServerUri: string }
): Promise<CredentialAPI> {
  
  // Get wallet configuration
  await walletApi.getConfiguration();
  await walletApi.getShieldedAddresses();
  
  return {
    async issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string> {
      console.log('Issuing credential:', { commitment, claimHash, expiryDays });
      // This would call the actual contract through the wallet
      return 'tx-' + Date.now();
    },
    
    async revokeCredential(commitment: string): Promise<string> {
      console.log('Revoking credential:', commitment);
      return 'tx-' + Date.now();
    },
    
    async verifyCredential(commitment: string, credentialData: string): Promise<boolean> {
      console.log('Verifying credential:', { commitment, credentialData });
      // This would verify the credential with private data
      return true;
    },
    
    async verifyOnChain(commitment: string, claimHash: string): Promise<boolean> {
      console.log('Verifying on chain:', { commitment, claimHash });
      // This would query the contract state
      return true;
    },
    
    async getCredentialStatus(_commitment: string): Promise<CredentialData | null> {
      // This would fetch from the ledger
      return null;
    },
    
    storeCredential(credential: CredentialWithPrivateData): void {
      const existing = JSON.parse(localStorage.getItem('privamed_creds') || '[]');
      existing.push({ ...credential, storedAt: Date.now() });
      localStorage.setItem('privamed_creds', JSON.stringify(existing));
    },
    
    getStoredCredentials(): CredentialWithPrivateData[] {
      return JSON.parse(localStorage.getItem('privamed_creds') || '[]');
    },
    
    getContractAddress(): string {
      return CONTRACT_ADDRESS;
    }
  };
}
