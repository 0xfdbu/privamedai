import { Credential, IssuerInfo } from '../types/claims';

// Import dapp-connector types
import '@midnight-ntwrk/dapp-connector-api';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '3bbe38546b2c698379620495dfb7ffc8e39d52441b1ad8bad17f7893db94cf46';

// Contract state
let contractInstance: any = null;

// Lace wallet API (populated after connection)
let laceAPI: ConnectedAPI | null = null;

// Wallet state
let walletState: {
  address?: string;
  pubKey?: string;
  isConnected: boolean;
  coinPublicKey?: string;
  encryptionPublicKey?: string;
} = {
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

/**
 * Find the first compatible wallet in window.midnight
 * Uses the same pattern as official Midnight examples
 */
function getFirstCompatibleWallet(): InitialAPI | undefined {
  const midnight = (window as any).midnight;
  if (!midnight) return undefined;
  
  // Look for any wallet with apiVersion (v4 API)
  return Object.values(midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      typeof (wallet as InitialAPI).connect === 'function'
  );
}

/**
 * Connect to Lace wallet (browser extension)
 * This is the recommended secure way to connect wallets
 */
export async function connectLaceWallet(): Promise<{ 
  success: boolean; 
  address?: string; 
  error?: string;
  api?: ConnectedAPI;
}> {
  try {
    // Find compatible wallet using the official pattern
    const initialAPI = getFirstCompatibleWallet();
    
    if (!initialAPI) {
      return { 
        success: false, 
        error: 'Lace wallet not found. Please install the Lace extension and refresh the page.' 
      };
    }

    // Connect using v4 API
    const connectedApi: ConnectedAPI = await initialAPI.connect('preprod');
    
    if (!connectedApi) {
      return { success: false, error: 'Failed to connect to Lace wallet' };
    }

    // Get addresses from the connected wallet
    const addresses = await connectedApi.getShieldedAddresses();
    
    // Store the API for later use
    laceAPI = connectedApi;

    // Update wallet state
    // Use shieldedCoinPublicKey (mn_shield-cpk...) for the coin public key
    // This is what the SDK expects for Bytes<32> arguments
    walletState = {
      address: addresses.shieldedAddress,
      coinPublicKey: addresses.shieldedCoinPublicKey,
      encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
      isConnected: true,
    };

    // Persist to localStorage
    localStorage.setItem('privamedai_wallet_connected', 'true');
    localStorage.setItem('privamedai_wallet_address', addresses.shieldedAddress);
    localStorage.setItem('privamedai_wallet_coin_public_key', addresses.shieldedCoinPublicKey);
    localStorage.setItem('privamedai_wallet_encryption_public_key', addresses.shieldedEncryptionPublicKey);

    console.log('✅ Lace wallet connected:', addresses.shieldedAddress);

    return { 
      success: true, 
      address: addresses.shieldedAddress,
      api: connectedApi 
    };
  } catch (error: any) {
    console.error('❌ Lace connection failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to connect to Lace wallet' 
    };
  }
}

/**
 * Legacy seed-based wallet connection (for backwards compatibility)
 * @deprecated Use connectLaceWallet() instead
 */
export async function connectWallet(seed: string): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    if (!seed || seed.length !== 64) {
      return { success: false, error: 'Invalid seed - must be 64 hex characters' };
    }

    walletState.address = '0x' + seed.slice(0, 40);
    walletState.pubKey = seed;
    walletState.isConnected = true;

    localStorage.setItem('privamedai_wallet_seed', seed);
    localStorage.setItem('privamedai_wallet_address', walletState.address);

    return { success: true, address: walletState.address };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function disconnectWallet(): void {
  walletState = { isConnected: false };
  laceAPI = null;
  localStorage.removeItem('privamedai_wallet_connected');
  localStorage.removeItem('privamedai_wallet_address');
  localStorage.removeItem('privamedai_wallet_coin_public_key');
  localStorage.removeItem('privamedai_wallet_encryption_public_key');
  localStorage.removeItem('privamedai_wallet_seed');
}

export function getWalletState() {
  // Check for Lace connection
  const savedConnected = localStorage.getItem('privamedai_wallet_connected');
  const savedAddress = localStorage.getItem('privamedai_wallet_address');
  const savedCoinPublicKey = localStorage.getItem('privamedai_wallet_coin_public_key');
  const savedEncryptionPublicKey = localStorage.getItem('privamedai_wallet_encryption_public_key');
  
  if (savedConnected && savedAddress && !walletState.isConnected) {
    walletState.address = savedAddress;
    walletState.coinPublicKey = savedCoinPublicKey || undefined;
    walletState.encryptionPublicKey = savedEncryptionPublicKey || undefined;
    walletState.isConnected = true;
  }
  
  return walletState;
}

/**
 * Get the Lace wallet API (for transaction signing)
 */
export function getLaceAPI(): ConnectedAPI | null {
  return laceAPI;
}

export function getContractAddress(): string {
  return CONTRACT_ADDRESS;
}

// Stub for getStoredCredentials (to be implemented with real storage)
export function getStoredCredentials(): Credential[] {
  const stored = localStorage.getItem('privamedai_credentials');
  return stored ? JSON.parse(stored) : [];
}

// Issuer operations
export async function registerIssuer(
  _nameHash: string,
  _publicKey: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  return { success: false, error: 'Use contractInteraction.registerIssuerOnChain()' };
}
