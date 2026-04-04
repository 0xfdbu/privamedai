/**
 * Verification Circuit Functions
 * 
 * On-chain proof verification
 */

import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../providers';
import { CIRCUITS, CONTRACT_ADDRESS } from '../config';
import { hexToBytes32, hashString } from '../utils/bytes';
import { getWalletState } from '../../contractService';

/**
 * Verify a credential on-chain
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

    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUITS.VERIFY_CREDENTIAL,
      args: [commitmentBytes, credentialDataHash],
    });

    const txId = (result as any)?.public?.txId;
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
 * Submit proof verification on-chain
 * Used by verifiers to submit verified proofs to the blockchain
 */
export async function submitProofVerification(
  commitmentHex: string,
  credentialDataBytes: Uint8Array,
  circuitId: string = 'verifyCredential'
): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Submitting proof verification on-chain...');

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitmentHex);

    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: circuitId,
      args: [commitmentBytes, credentialDataBytes],
    });

    const txId = (result as any)?.public?.txId;
    console.log('✅ Proof verification submitted:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to submit proof verification:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit proof verification',
    };
  }
}
