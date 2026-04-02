import { Credential, IssuerInfo } from '../types/claims';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '3bbe38546b2c698379620495dfb7ffc8e39d52441b1ad8bad17f7893db94cf46';

// Contract state
let contractInstance: any = null;
let walletState: {
  seed: string;
  address?: string;
  pubKey?: string;
  isConnected: boolean;
} = {
  seed: '',
  isConnected: false,
};

export interface ContractConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

export const CONFIG: ContractConfig = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// Wallet connection
export async function connectWallet(seed: string): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    if (!seed || seed.length !== 64) {
      return { success: false, error: 'Invalid seed - must be 64 hex characters' };
    }

    // Store seed for later use
    walletState.seed = seed;
    walletState.isConnected = true;
    
    // Derive address from seed (simplified)
    const address = '0x' + seed.slice(0, 40);
    walletState.address = address;
    walletState.pubKey = seed;

    // Persist to localStorage
    localStorage.setItem('privamedai_wallet_seed', seed);
    localStorage.setItem('privamedai_wallet_address', address);

    return { success: true, address };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function disconnectWallet(): void {
  walletState = { seed: '', isConnected: false };
  localStorage.removeItem('privamedai_wallet_seed');
  localStorage.removeItem('privamedai_wallet_address');
}

export function getWalletState() {
  const savedSeed = localStorage.getItem('privamedai_wallet_seed');
  const savedAddress = localStorage.getItem('privamedai_wallet_address');
  
  if (savedSeed && savedAddress && !walletState.isConnected) {
    walletState.seed = savedSeed;
    walletState.address = savedAddress;
    walletState.isConnected = true;
  }
  
  return walletState;
}

// Issuer operations
export async function registerIssuer(
  _nameHash: string,
  _publicKey: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    if (!walletState.isConnected) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Simulate contract call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const txId = '0x' + Math.random().toString(16).substring(2, 34);
    
    return { success: true, txId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getIssuerInfo(publicKey: string): Promise<IssuerInfo | null> {
  try {
    // Simulate fetching from contract
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock data for now
    return {
      name: 'City General Hospital',
      publicKey: publicKey.slice(0, 20) + '...',
      isActive: true,
      credentialsIssued: 156,
    };
  } catch (error) {
    return null;
  }
}

// Credential operations
export async function issueCredential(
  commitment: string,
  claimHash: string,
  expiryDays: number
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    if (!walletState.isConnected) {
      return { success: false, error: 'Wallet not connected' };
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const txId = '0x' + Math.random().toString(16).substring(2, 34);
    
    // Store credential in localStorage
    const credentials = getStoredCredentials();
    const newCredential: Credential = {
      id: 'cred-' + Date.now(),
      issuer: walletState.address || 'unknown',
      claimType: 'Medical Credential',
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      isRevoked: false,
      encryptedData: claimHash,
      commitment,
      claimHash,
    };
    
    credentials.push(newCredential);
    localStorage.setItem('privamedai_credentials', JSON.stringify(credentials));
    
    return { success: true, txId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function batchIssueCredentials(
  commitments: string[],
  claimHashes: string[],
  expiryDays: number
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    if (!walletState.isConnected) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (commitments.length !== claimHashes.length) {
      return { success: false, error: 'Commitments and claim hashes must match' };
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const txId = '0x' + Math.random().toString(16).substring(2, 34);
    
    // Store all credentials
    const credentials = getStoredCredentials();
    
    for (let i = 0; i < commitments.length; i++) {
      const newCredential: Credential = {
        id: 'cred-' + Date.now() + '-' + i,
        issuer: walletState.address || 'unknown',
        claimType: 'Medical Credential',
        issuedAt: Date.now(),
        expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
        isRevoked: false,
        encryptedData: claimHashes[i],
        commitment: commitments[i],
        claimHash: claimHashes[i],
      };
      credentials.push(newCredential);
    }
    
    localStorage.setItem('privamedai_credentials', JSON.stringify(credentials));
    
    return { success: true, txId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function revokeCredential(
  commitment: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    if (!walletState.isConnected) {
      return { success: false, error: 'Wallet not connected' };
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const txId = '0x' + Math.random().toString(16).substring(2, 34);
    
    // Update local storage
    const credentials = getStoredCredentials();
    const updated = credentials.map(c => 
      c.commitment === commitment ? { ...c, isRevoked: true } : c
    );
    localStorage.setItem('privamedai_credentials', JSON.stringify(updated));
    
    return { success: true, txId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function getStoredCredentials(): Credential[] {
  const stored = localStorage.getItem('privamedai_credentials');
  return stored ? JSON.parse(stored) : [];
}

// Verification operations
export async function verifyCredential(
  commitment: string,
  _credentialDataHash: string
): Promise<{ success: boolean; result?: boolean; error?: string }> {
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if credential exists and is valid
    const credentials = getStoredCredentials();
    const credential = credentials.find(c => c.commitment === commitment);
    
    if (!credential) {
      return { success: true, result: false };
    }
    
    if (credential.isRevoked) {
      return { success: true, result: false };
    }
    
    if (credential.expiresAt < Date.now()) {
      return { success: true, result: false };
    }
    
    return { success: true, result: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bundledVerifyCredentials(
  commitments: string[],
  dataHashes: string[]
): Promise<{ success: boolean; result?: boolean; error?: string }> {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify all credentials
    for (let i = 0; i < commitments.length; i++) {
      const verify = await verifyCredential(commitments[i], dataHashes[i]);
      if (!verify.result) {
        return { success: true, result: false };
      }
    }
    
    return { success: true, result: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ZK Proof generation (local)
export async function generateZKProof(
  _rules: { field: string; operator: string; value: string }[],
  _credentialData: any
): Promise<{ success: boolean; proof?: string; error?: string }> {
  try {
    // Simulate local ZK proof generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const proof = 'zk:' + Math.random().toString(36).substring(2, 34);
    
    return { success: true, proof };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export const contractService = {
  connectWallet,
  disconnectWallet,
  getWalletState,
  registerIssuer,
  getIssuerInfo,
  issueCredential,
  batchIssueCredentials,
  revokeCredential,
  getStoredCredentials,
  verifyCredential,
  bundledVerifyCredentials,
  generateZKProof,
};
