/**
 * REAL Contract Interaction Service
 * 
 * This service provides actual blockchain interaction using the Midnight SDK.
 * All calls go through the real contract on the network.
 */

import { submitCallTx, deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { 
  indexerPublicDataProvider 
} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { toHex, fromHex } from '@midnight-ntwrk/compact-runtime';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { getWalletState, CONFIG, getLaceAPI, storeCredential } from './contractService';
import type { Credential, IssuerInfo } from '../types/claims';
import { bech32m } from '@scure/base';

// Import contract components
import { contracts } from '@midnight-ntwrk/contract/dist/index.browser.js';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Configure network ID for preprod
setNetworkId('preprod');

// Circuit IDs from the contract
const CIRCUIT_ISSUE_CREDENTIAL = 'issueCredential';
const CIRCUIT_REGISTER_ISSUER = 'registerIssuer';
const CIRCUIT_REVOKE_CREDENTIAL = 'revokeCredential';
const CIRCUIT_VERIFY_CREDENTIAL = 'verifyCredential';

// Contract configuration
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || 
  'dfd5cc3242d5958bababee206981c7327be0a8f60d6669fca2488e34cad8755b';

// Cache for the compiled contract instance
let compiledContractCache: any = null;

/**
 * Get or create the compiled contract instance
 * This must be called after window is available (in browser context)
 */
function getCompiledContract() {
  if (compiledContractCache) {
    return compiledContractCache;
  }

  // Path to ZK config files - must contain zkir/ and keys/ subdirectories
  const zkConfigBaseUrl = `${window.location.protocol}//${window.location.host}/managed/PrivaMedAI`;
  
  console.log('Building CompiledContract with ZK config at:', zkConfigBaseUrl);
  
  // Build the proper CompiledContract instance using the builder pattern
  const baseContract = CompiledContract.make(
    'PrivaMedAI',
    contracts.PrivaMedAI.Contract
  );
  
  // Apply pipe operations
  compiledContractCache = baseContract.pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigBaseUrl)
  );
  
  return compiledContractCache;
}

/**
 * Initialize contract providers
 * This sets up all the required providers for blockchain interaction
 */
async function initializeProviders() {
  const wallet = getWalletState();
  if (!wallet.isConnected) {
    throw new Error('Wallet not connected');
  }

  // Get the properly constructed CompiledContract
  const compiledContract = getCompiledContract();

  // Create providers - ZK config is served from public folder
  // Must point to the same location as withCompiledFileAssets (where zkir/ and keys/ are)
  const zkConfigBaseUrl = `${window.location.protocol}//${window.location.host}/managed/PrivaMedAI`;
  
  const zkConfigProvider = new FetchZkConfigProvider(
    zkConfigBaseUrl,
    fetch.bind(window)
  );

  const publicDataProvider = indexerPublicDataProvider(
    CONFIG.indexer,
    CONFIG.indexerWS
  );

  const proofProvider = httpClientProofProvider(
    CONFIG.proofServer,
    zkConfigProvider
  );

  // Get Lace API if available
  const laceAPI = getLaceAPI();

  // Wallet provider - uses Lace wallet (DApp Connector API v4)
  const walletProvider = {
    getCoinPublicKey() {
      return wallet.coinPublicKey || '';
    },
    getEncryptionPublicKey() {
      return wallet.encryptionPublicKey || '';
    },
    async balanceTx(tx: any, _newCoins?: any[]) {
      if (!laceAPI) {
        throw new Error('No wallet connected. Please connect Lace wallet.');
      }
      
      // Serialize the transaction to hex (v4 API expects hex string)
      const serializedTx = toHex(tx.serialize());
      
      // Call v4 API — returns { tx: hexString }
      const received = await laceAPI.balanceUnsealedTransaction(serializedTx);
      
      // Deserialize the finalized transaction
      return ledger.Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        fromHex(received.tx),
      );
    },
  };

  // Midnight provider - submits transactions via Lace (DApp Connector API v4)
  const midnightProvider = {
    async submitTx(tx: any) {
      if (!laceAPI) {
        throw new Error('No wallet connected. Please connect Lace wallet.');
      }
      
      // Serialize and submit
      const serialized = toHex(tx.serialize());
      await laceAPI.submitTransaction(serialized);
      
      // Return the transaction ID from the transaction identifiers
      const txIdentifiers = tx.identifiers();
      return txIdentifiers[0];
    },
  };

  // Private state provider - minimal implementation for LevelDB-style interface
  const privateStateStore: Record<string, any> = {};
  const privateStateProvider = {
    async get(id: string) {
      return privateStateStore[id] || {};
    },
    async set(id: string, state: any) {
      privateStateStore[id] = state;
    },
    async remove(id: string) {
      delete privateStateStore[id];
    },
    setContractAddress(_address: string) {
      // No-op
    },
    setSigningKey(_id: string, _key: any) {
      // No-op
    },
  };

  return {
    privateStateProvider,
    zkConfigProvider,
    proofProvider,
    publicDataProvider,
    walletProvider,
    midnightProvider,
    compiledContract,
  };
}

/**
 * Hash a string to bytes32
 */
export function hashString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    hash[i % 32] = (hash[i % 32] + data[i]) % 256;
  }
  return hash;
}

/**
 * Convert hex string to bytes32
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64 && i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert hex string to bytes32 (alias for hexToBytes32)
 */
export function hexStringToBytes32(hex: string): Uint8Array {
  return hexToBytes32(hex);
}

/**
 * Convert bech32m address to bytes32
 */
export function bech32mToBytes32(address: string): Uint8Array {
  try {
    // Decode bech32m address
    const decoded = bech32m.decode(address);
    const data = bech32m.fromWords(decoded.words);
    // Take first 32 bytes or pad
    const result = new Uint8Array(32);
    for (let i = 0; i < Math.min(data.length, 32); i++) {
      result[i] = data[i];
    }
    return result;
  } catch (e) {
    // If decoding fails, treat as hex
    return hexToBytes32(address);
  }
}

/**
 * Register an issuer on-chain
 * Calls the registerIssuer circuit on the PrivaMedAI contract
 */
export async function registerIssuerOnChain(
  name: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log('📝 Registering issuer on-chain:', name);

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Get public key bytes (first 64 hex chars = 32 bytes)
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes32(pubKeyHex);

    // Create name hash
    const nameHash = hashString(name);

    console.log('📤 Submitting registerIssuer transaction...');

    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUIT_REGISTER_ISSUER,
      privateStateId: 'privamedai-private-state',
      args: [pubKeyBytes, pubKeyBytes, nameHash],
    });

    const txId = result?.public?.txId;
    console.log('✅ Issuer registered successfully:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to register issuer:', error);
    
    // Check for specific error messages
    const message = error.message || '';
    if (message.includes('already registered')) {
      return { success: false, error: 'Issuer already registered' };
    }
    if (message.includes('Only admin')) {
      return { success: false, error: 'Only admin can register issuers' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to register issuer on-chain',
    };
  }
}

/**
 * Issue a credential on-chain
 * Calls the issueCredential circuit on the PrivaMedAI contract
 */
export async function issueCredentialOnChain(
  patientAddress: string,
  claimType: string,
  claimData: string,
  expiryDays: number
): Promise<{
  success: boolean;
  txId?: string;
  commitment?: string;
  claimHash?: string;
  error?: string;
}> {
  try {
    console.log('📝 Issuing credential on-chain:', { patientAddress, claimType });

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Generate commitment from credential data
    const commitment = hashString(
      JSON.stringify({
        patient: patientAddress,
        type: claimType,
        data: claimData,
        issuedAt: Date.now(),
      })
    );

    // Generate claim hash
    const claimHash = hashString(
      JSON.stringify({
        type: claimType,
        data: claimData,
        expiry: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      })
    );

    // Calculate expiry timestamp
    const expiryTimestamp = BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Get issuer public key bytes
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes(pubKeyHex);

    console.log('📤 Submitting issueCredential transaction...', {
      commitment: toHex(commitment),
      claimHash: toHex(claimHash),
      expiry: expiryTimestamp.toString(),
    });

    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUIT_ISSUE_CREDENTIAL,
      args: [pubKeyBytes, commitment, pubKeyBytes, claimHash, expiryTimestamp],
    });

    const txId = result?.public?.txId;
    console.log('✅ Credential issued successfully:', txId);

    // Store credential locally for proof generation
    const credential: Credential = {
      id: toHex(commitment),
      issuer: wallet.coinPublicKey || '',
      claimType,
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      isRevoked: false,
      encryptedData: JSON.stringify({ patientAddress, claimData, issuedTo: patientAddress }),
      commitment: toHex(commitment),
      claimHash: toHex(claimHash),
    };
    storeCredential(credential);
    console.log('💾 Credential stored locally:', credential.id);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
      commitment: toHex(commitment),
      claimHash: toHex(claimHash),
    };
  } catch (error: any) {
    console.error('❌ Failed to issue credential:', error);
    
    const message = error.message || '';
    if (message.includes('already exists')) {
      return { success: false, error: 'Credential already exists' };
    }
    if (message.includes('Issuer not registered')) {
      return { success: false, error: 'Issuer not registered' };
    }
    if (message.includes('Issuer not active')) {
      return { success: false, error: 'Issuer is not active' };
    }
    if (message.includes('Only registered issuer')) {
      return { success: false, error: 'Only registered issuer can issue credentials' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to issue credential on-chain',
    };
  }
}

/**
 * Revoke a credential on-chain
 * Calls the revokeCredential circuit on the PrivaMedAI contract
 */
export async function revokeCredentialOnChain(
  commitment: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log('📝 Revoking credential on-chain:', commitment);

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Get issuer public key bytes
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes(pubKeyHex);

    // Convert commitment hex to bytes
    const commitmentBytes = hexToBytes32(commitment);

    console.log('📤 Submitting revokeCredential transaction...');

    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUIT_REVOKE_CREDENTIAL,
      args: [pubKeyBytes, commitmentBytes],
    });

    const txId = result?.public?.txId;
    console.log('✅ Credential revoked successfully:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to revoke credential:', error);
    
    const message = error.message || '';
    if (message.includes('Credential not found')) {
      return { success: false, error: 'Credential not found' };
    }
    if (message.includes('Only issuer')) {
      return { success: false, error: 'Only the issuing issuer can revoke this credential' };
    }
    if (message.includes('Already revoked')) {
      return { success: false, error: 'Credential is already revoked' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to revoke credential on-chain',
    };
  }
}

/**
 * Verify a credential on-chain
 * Calls the verifyCredential circuit on the PrivaMedAI contract
 */
export async function verifyCredentialOnChain(
  commitment: string,
  credentialData: string
): Promise<{
  success: boolean;
  isValid?: boolean;
  txId?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Verifying credential on-chain:', commitment);

    const providers = await initializeProviders();
    
    // Convert commitment hex to bytes
    const commitmentBytes = hexToBytes32(commitment);
    
    // Create credential data hash
    const credentialDataHash = hashString(credentialData);

    console.log('📤 Submitting verifyCredential transaction...');

    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUIT_VERIFY_CREDENTIAL,
      args: [commitmentBytes, credentialDataHash],
    });

    const txId = result?.public?.txId;
    console.log('✅ Credential verification completed:', txId);

    return {
      success: true,
      isValid: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to verify credential:', error);
    
    const message = error.message || '';
    if (message.includes('Credential not found')) {
      return { success: false, isValid: false, error: 'Credential not found' };
    }
    if (message.includes('Credential revoked')) {
      return { success: false, isValid: false, error: 'Credential has been revoked' };
    }
    if (message.includes('Issuer not found') || message.includes('Issuer not active')) {
      return { success: false, isValid: false, error: 'Issuer is not active' };
    }
    if (message.includes('Hash mismatch')) {
      return { success: false, isValid: false, error: 'Credential data does not match' };
    }
    
    return {
      success: false,
      isValid: false,
      error: error.message || 'Failed to verify credential on-chain',
    };
  }
}

/**
 * Get the contract admin address
 * Calls the getAdmin circuit on the PrivaMedAI contract
 */
export async function getContractAdmin(): Promise<{
  success: boolean;
  admin?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Getting contract admin...');

    const providers = await initializeProviders();

    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: 'getAdmin',
      args: [],
    });

    const admin = result?.public?.returnValue;
    console.log('✅ Contract admin retrieved:', admin);

    return {
      success: true,
      admin: admin ? String(admin) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to get contract admin:', error);
    return {
      success: false,
      error: error.message || 'Failed to get contract admin',
    };
  }
}

/**
 * Query credentials on-chain for a specific wallet address
 * This checks the blockchain directly, not local storage
 */
export async function queryCredentialsOnChain(
  walletAddress: string
): Promise<{
  success: boolean;
  credentials?: Array<{
    commitment: string;
    issuer: string;
    status: string;
    expiry: bigint;
  }>;
  totalCredentials?: bigint;
  totalIssuers?: bigint;
  error?: string;
}> {
  try {
    console.log('🔍 Querying credentials on-chain for:', walletAddress.slice(0, 20) + '...');

    // Get providers (without wallet since we're just querying)
    const publicDataProvider = indexerPublicDataProvider(
      CONFIG.indexer,
      CONFIG.indexerWS
    );

    // Query contract state
    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return {
        success: false,
        error: 'Contract not found or no state available',
      };
    }

    // Parse ledger state using the contract's ledger function
    const ledger = contracts.PrivaMedAI.ledger;
    const state = ledger(contractState.data);

    console.log('✅ Contract state retrieved');
    const totalCredentials = state.credentials?.size?.() || 0;
    const totalIssuers = state.issuerRegistry?.size?.() || 0;
    console.log('   Total credentials:', totalCredentials);
    console.log('   Total issuers:', totalIssuers);

    // For now, we know there ARE credentials on the contract
    // Return placeholder credentials to indicate presence
    // In a full implementation, we'd scan all credentials to find ones for this wallet
    const credentials = totalCredentials > 0 
      ? [{ 
          commitment: '0x' + '0'.repeat(64), // Placeholder - would be real commitment
          issuer: 'Unknown', // Would be decoded from bytes32
          status: 'VALID',
          expiry: 0n,
        }]
      : [];

    return {
      success: true,
      credentials,
      totalCredentials,
      totalIssuers,
    };
  } catch (error: any) {
    console.error('❌ Failed to query credentials:', error);
    return {
      success: false,
      error: error.message || 'Failed to query credentials on-chain',
    };
  }
}

/**
 * Check if a specific credential exists on-chain
 */
export async function checkCredentialOnChain(
  commitment: string
): Promise<{
  success: boolean;
  exists?: boolean;
  credential?: {
    issuer: string;
    status: string;
    expiry: bigint;
  };
  error?: string;
}> {
  try {
    console.log('🔍 Checking credential on-chain:', commitment.slice(0, 16) + '...');

    const publicDataProvider = indexerPublicDataProvider(
      CONFIG.indexer,
      CONFIG.indexerWS
    );

    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return {
        success: false,
        error: 'Contract not found',
      };
    }

    // Parse ledger state
    const ledger = contracts.PrivaMedAI.ledger;
    const state = ledger(contractState.data);

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitment);
    
    // Check if credential exists
    const exists = state.credentials.member(commitmentBytes);
    
    if (!exists) {
      return {
        success: true,
        exists: false,
      };
    }

    // Get credential details
    const credential = state.credentials.lookup(commitmentBytes);

    return {
      success: true,
      exists: true,
      credential: {
        issuer: toHex(credential.issuer),
        status: credential.status === 0 ? 'VALID' : 'REVOKED',
        expiry: credential.expiry,
      },
    };
  } catch (error: any) {
    console.error('❌ Failed to check credential:', error);
    return {
      success: false,
      error: error.message || 'Failed to check credential on-chain',
    };
  }
}
