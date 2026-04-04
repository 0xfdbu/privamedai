/**
 * Issuer Circuit Functions
 * 
 * On-chain issuer registration and management
 */

import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../providers';
import { CIRCUITS, CONTRACT_ADDRESS } from '../config';
import { hexToBytes32, hashString } from '../utils/bytes';
import { getWalletState } from '../../contractService';

/**
 * Register an issuer on-chain
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

    // Add timeout to prevent infinite hanging
    const submitWithTimeout = Promise.race([
      (submitCallTx as any)(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract: providers.compiledContract,
        circuitId: CIRCUITS.REGISTER_ISSUER,
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
    const { contracts } = await import('@midnight-ntwrk/contract/dist/index.browser.js');
    const ledger = contracts.PrivaMedAI.ledger;
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
 */
export async function getContractAdmin(): Promise<{
  success: boolean;
  admin?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Getting contract admin...');

    const providers = await initializeProviders();

    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: 'getAdmin',
      args: [],
    });

    const admin = (result as any)?.returnValue;
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
