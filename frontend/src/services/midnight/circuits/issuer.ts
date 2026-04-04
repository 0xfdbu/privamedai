/**
 * Issuer Circuit Functions
 * 
 * On-chain issuer registration and management
 */

import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../providers';
import { getCompiledContract } from '../providers/contract';
import { createInitialPrivateState } from '../witnesses';
import { CIRCUITS, CONTRACT_ADDRESS } from '../config';
import { hexToBytes32, hashString } from '../utils/bytes';
import { getWalletState } from '../../contractService';

// Private state ID for this contract
const PRIVATE_STATE_ID = 'privamedai-private-state';

/**
 * Register an issuer on-chain
 */
export async function registerIssuerOnChain(
  name: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log('📝 Registering issuer on-chain:', name);

    const providers = await initializeProviders();
    const compiledContract = await getCompiledContract();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // First, find/join the deployed contract to seed the private state
    console.log('🔍 Finding deployed contract...');
    const initialPrivateState = createInitialPrivateState(
      hexToBytes32(wallet.coinPublicKey.slice(0, 64))
    );
    
    try {
      await findDeployedContract(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState,
      });
      console.log('✅ Found deployed contract and seeded private state');
    } catch (findError: any) {
      console.warn('⚠️ findDeployedContract warning (may be already joined):', findError.message);
      // Continue anyway - we might already be joined
    }

    // Get public key bytes (first 64 hex chars = 32 bytes)
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes32(pubKeyHex);

    // Create name hash
    const nameHash = hashString(name);

    console.log('📤 Submitting registerIssuer transaction...');

    // Add timeout to prevent infinite hanging
    const submitWithTimeout = Promise.race([
      (submitCallTx as any)(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
        circuitId: CIRCUITS.REGISTER_ISSUER,
        privateStateId: PRIVATE_STATE_ID,
        args: [pubKeyBytes, pubKeyBytes, nameHash],
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout')), 120000)
      )
    ]);

    const result = await submitWithTimeout;
    const txId = (result as any)?.public?.txId;
    
    console.log('✅ Issuer registered successfully:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to register issuer:', error);
    
    // Extract the real error from the FiberFailure wrapper
    const cause = error.cause?.cause || error.cause;
    const causeMessage = cause?.message || cause?.failure?.message || error.cause?.message || '';
    
    console.error('   Real cause:', cause);
    console.error('   Cause message:', causeMessage);
    
    // Check for specific error conditions
    if (causeMessage.includes('Insufficient Funds') || causeMessage.includes('could not balance dust')) {
      return { 
        success: false, 
        error: 'Insufficient funds: Your wallet needs tDUST tokens. Get some from https://faucet.preprod.midnight.network/' 
      };
    }
    if (causeMessage.includes('already registered')) {
      return { success: false, error: 'Issuer already registered' };
    }
    if (causeMessage.includes('Only admin')) {
      return { success: false, error: 'Only admin can register issuers' };
    }
    
    return {
      success: false,
      error: causeMessage || error.message || 'Failed to register issuer on-chain',
    };
  }
}

/**
 * Check if an issuer is registered on-chain
 */
export async function checkIssuerOnChain(
  publicKeyHex: string
): Promise<{
  registered: boolean;
  info?: {
    status: number;
    credentialCount: bigint;
    nameHash: Uint8Array;
  };
}> {
  try {
    console.log('🔍 Checking issuer on-chain:', publicKeyHex.slice(0, 16) + '...');

    const { publicDataProvider } = await initializeProviders();

    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return { registered: false };
    }

    // Parse ledger state
    const { ledger } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    const state = ledger(contractState.data);

    // Convert public key hex to bytes32
    const pubKeyBytes = hexToBytes32(publicKeyHex);
    
    // Check if issuer exists
    const exists = state.issuerRegistry.member(pubKeyBytes);
    
    if (!exists) {
      return { registered: false };
    }

    // Get issuer details
    const issuer = state.issuerRegistry.lookup(pubKeyBytes);

    return {
      registered: true,
      info: {
        status: issuer.status,
        credentialCount: issuer.credentialCount,
        nameHash: issuer.nameHash,
      },
    };
  } catch (error: any) {
    console.error('❌ Failed to check issuer:', error);
    return { registered: false };
  }
}

/**
 * Get contract admin
 * 
 * Note: This is a read-only query that doesn't require submitCallTx.
 * We read directly from the ledger state.
 */
export async function getContractAdmin(): Promise<{
  success: boolean;
  admin?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Getting contract admin...');

    const { publicDataProvider } = await initializeProviders();

    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return { success: false, error: 'Contract not found' };
    }

    // Parse ledger state directly
    const { ledger } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    const state = ledger(contractState.data);

    // Admin is stored in a Map with key 'a' (0x61)
    const adminKey = new Uint8Array([97]); // 'a' in ASCII
    const admin = state.admin.member(adminKey) ? state.admin.lookup(adminKey) : null;

    if (!admin) {
      return { success: false, error: 'Admin not found' };
    }

    const adminHex = Array.from(admin)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('✅ Contract admin retrieved:', adminHex.slice(0, 16) + '...');

    return {
      success: true,
      admin: adminHex,
    };
  } catch (error: any) {
    console.error('❌ Failed to get contract admin:', error);
    return {
      success: false,
      error: error.message || 'Failed to get contract admin',
    };
  }
}
