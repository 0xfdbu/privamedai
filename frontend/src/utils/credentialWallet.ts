// Secure Local Credential Wallet
// Encrypted localStorage + export/import functionality

import { persistentHash } from './crypto';

export interface StoredCredential {
  id: string;
  commitment: string;
  issuer: string;
  claimHash: string;
  expiry: number;
  status: 'VALID' | 'REVOKED';
  metadata: {
    name: string;
    description: string;
    issuedAt: number;
    issuerName?: string;
  };
  // Private data (encrypted)
  encryptedData?: string;
}

export interface WalletData {
  credentials: StoredCredential[];
  lastSync: number;
  walletVersion: string;
}

const WALLET_KEY = 'privamed_wallet_v1';
const ENCRYPTION_KEY_SALT = 'privamed_encryption_salt_v1';

// ═════════════════════════════════════════════════════════════════════════════
// ENCRYPTION UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ENCRYPTION_KEY_SALT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: any, password: string): Promise<string> {
  const key = await deriveKey(password);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  
  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData: string, password: string): Promise<any> {
  try {
    const key = await deriveKey(password);
    
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  } catch (e) {
    throw new Error('Decryption failed - incorrect password or corrupted data');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// WALLET OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

export class CredentialWallet {
  private password: string | null = null;
  private cachedData: WalletData | null = null;

  // Check if wallet exists
  static exists(): boolean {
    return localStorage.getItem(WALLET_KEY) !== null;
  }

  // Initialize new wallet with password
  async initialize(password: string): Promise<void> {
    const emptyWallet: WalletData = {
      credentials: [],
      lastSync: Date.now(),
      walletVersion: '1.0.0'
    };
    
    const encrypted = await encryptData(emptyWallet, password);
    localStorage.setItem(WALLET_KEY, encrypted);
    this.password = password;
    this.cachedData = emptyWallet;
  }

  // Unlock wallet with password
  async unlock(password: string): Promise<boolean> {
    try {
      const encrypted = localStorage.getItem(WALLET_KEY);
      if (!encrypted) return false;
      
      const data = await decryptData(encrypted, password);
      this.password = password;
      this.cachedData = data;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Lock wallet
  lock(): void {
    this.password = null;
    this.cachedData = null;
  }

  // Get all credentials
  async getCredentials(): Promise<StoredCredential[]> {
    if (!this.cachedData) {
      throw new Error('Wallet is locked');
    }
    return this.cachedData.credentials;
  }

  // Add credential
  async addCredential(credential: StoredCredential, privateData?: any): Promise<void> {
    if (!this.cachedData || !this.password) {
      throw new Error('Wallet is locked');
    }
    
    // Encrypt private data if provided
    if (privateData) {
      credential.encryptedData = await encryptData(privateData, this.password);
    }
    
    this.cachedData.credentials.push(credential);
    this.cachedData.lastSync = Date.now();
    await this.save();
  }

  // Get credential private data
  async getPrivateData(credentialId: string): Promise<any | null> {
    if (!this.cachedData || !this.password) {
      throw new Error('Wallet is locked');
    }
    
    const credential = this.cachedData.credentials.find(c => c.id === credentialId);
    if (!credential?.encryptedData) return null;
    
    return await decryptData(credential.encryptedData, this.password);
  }

  // Remove credential
  async removeCredential(credentialId: string): Promise<void> {
    if (!this.cachedData) {
      throw new Error('Wallet is locked');
    }
    
    this.cachedData.credentials = this.cachedData.credentials.filter(
      c => c.id !== credentialId
    );
    this.cachedData.lastSync = Date.now();
    await this.save();
  }

  // Check for expiring credentials
  async getExpiringCredentials(daysThreshold: number = 30): Promise<StoredCredential[]> {
    const credentials = await this.getCredentials();
    const now = Date.now();
    const threshold = daysThreshold * 24 * 60 * 60 * 1000;
    
    return credentials.filter(c => {
      if (c.status === 'REVOKED') return false;
      const timeToExpiry = c.expiry - now;
      return timeToExpiry > 0 && timeToExpiry < threshold;
    });
  }

  // Export wallet (encrypted backup)
  async exportWallet(): Promise<string> {
    if (!this.cachedData) {
      throw new Error('Wallet is locked');
    }
    return localStorage.getItem(WALLET_KEY) || '';
  }

  // Import wallet from backup
  static async importWallet(encryptedData: string, password: string): Promise<boolean> {
    try {
      // Verify by decrypting
      await decryptData(encryptedData, password);
      localStorage.setItem(WALLET_KEY, encryptedData);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Private: save to localStorage
  private async save(): Promise<void> {
    if (!this.cachedData || !this.password) return;
    
    const encrypted = await encryptData(this.cachedData, this.password);
    localStorage.setItem(WALLET_KEY, encrypted);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// WALLET HOOK
// ═════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

export function useCredentialWallet() {
  const [wallet] = useState(() => new CredentialWallet());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [expiringCredentials, setExpiringCredentials] = useState<StoredCredential[]>([]);

  const refreshCredentials = useCallback(async () => {
    if (!isUnlocked) return;
    const creds = await wallet.getCredentials();
    setCredentials(creds);
    const expiring = await wallet.getExpiringCredentials(30);
    setExpiringCredentials(expiring);
  }, [wallet, isUnlocked]);

  useEffect(() => {
    refreshCredentials();
  }, [refreshCredentials]);

  const initialize = async (password: string) => {
    await wallet.initialize(password);
    setIsUnlocked(true);
    await refreshCredentials();
  };

  const unlock = async (password: string): Promise<boolean> => {
    const success = await wallet.unlock(password);
    if (success) {
      setIsUnlocked(true);
      await refreshCredentials();
    }
    return success;
  };

  const lock = () => {
    wallet.lock();
    setIsUnlocked(false);
    setCredentials([]);
  };

  const addCredential = async (credential: StoredCredential, privateData?: any) => {
    await wallet.addCredential(credential, privateData);
    await refreshCredentials();
  };

  const removeCredential = async (credentialId: string) => {
    await wallet.removeCredential(credentialId);
    await refreshCredentials();
  };

  const exportWallet = async (): Promise<string> => {
    return await wallet.exportWallet();
  };

  const getPrivateData = async (credentialId: string): Promise<any | null> => {
    return await wallet.getPrivateData(credentialId);
  };

  return {
    isUnlocked,
    credentials,
    expiringCredentials,
    initialize,
    unlock,
    lock,
    addCredential,
    removeCredential,
    exportWallet,
    getPrivateData,
    walletExists: CredentialWallet.exists,
    importWallet: CredentialWallet.importWallet,
  };
}
