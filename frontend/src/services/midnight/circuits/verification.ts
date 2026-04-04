/**
 * Verification Circuit Functions
 * 
 * On-chain selective disclosure proof verification
 */

export type VerifierType = 'freeHealthClinic' | 'pharmacy' | 'hospital';

import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../providers';
import { getCompiledContract } from '../providers/contract';
import { createInitialPrivateState } from '../witnesses';
import { CIRCUITS, CONTRACT_ADDRESS } from '../config';
import { hexToBytes32 } from '../utils/bytes';
import { getWalletState } from '../../contractService';

// Private state ID for this contract
const PRIVATE_STATE_ID = 'privamedai-private-state';

/**
 * Helper to ensure contract is found and private state is seeded
 */
async function ensureContractJoined(providers: any, wallet: any): Promise<void> {
  const compiledContract = await getCompiledContract();
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
    // Check if it's a "contract already joined" error
    const errorMsg = findError.message || '';
    if (errorMsg.includes('already joined') || errorMsg.includes('already exists')) {
      console.log('ℹ️ Contract already joined, private state already seeded');
      return;
    }
    
    // Check if it's a signing key error
    if (errorMsg.includes('getSigningKey') || errorMsg.includes('signing key')) {
      console.warn('⚠️ Signing key issue, attempting to set it manually');
      // Set the signing key manually
      const signingKey = new Uint8Array(32);
      const pubKeyBytes = hexToBytes32(wallet.coinPublicKey.slice(0, 64));
      signingKey.set(pubKeyBytes.slice(0, 32));
      await providers.privateStateProvider.setSigningKey(CONTRACT_ADDRESS, signingKey);
      
      // Try again
      try {
        await findDeployedContract(providers, {
          contractAddress: CONTRACT_ADDRESS,
          compiledContract,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState,
        });
        console.log('✅ Second attempt succeeded');
        return;
      } catch (retryError: any) {
        console.error('❌ Second attempt failed:', retryError.message);
        throw retryError;
      }
    }
    
    console.error('❌ findDeployedContract failed:', findError.message);
    throw findError;
  }
}

/**
 * Submit selective disclosure proof verification on-chain
 * 
 * Uses the appropriate verification circuit based on verifier type:
 * - freeHealthClinic: Proves age >= minAge without revealing actual age
 * - pharmacy: Proves prescription code match without revealing other data
 * - hospital: Proves age >= minAge AND condition code match
 */
export async function submitProofVerification(
  commitmentHex: string,
  verifierType: 'freeHealthClinic' | 'pharmacy' | 'hospital',
  params: {
    minAge?: number;
    requiredPrescription?: number;
    requiredCondition?: number;
  }
): Promise<{
  success: boolean;
  txId?: string;
  isValid?: boolean;
  error?: string;
}> {
  try {
    console.log('🔍 Submitting selective disclosure proof verification on-chain...');
    console.log('   Verifier type:', verifierType);
    console.log('   Parameters:', params);

    const providers = await initializeProviders();
    const compiledContract = await getCompiledContract();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Ensure contract is joined first
    await ensureContractJoined(providers, wallet);

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitmentHex);

    // Determine circuit and args based on verifier type
    let circuitId: string;
    let args: any[];

    switch (verifierType) {
      case 'freeHealthClinic': {
        if (params.minAge === undefined) {
          return { success: false, error: 'minAge parameter required for freeHealthClinic verification' };
        }
        circuitId = CIRCUITS.VERIFY_FREE_HEALTH_CLINIC;
        args = [commitmentBytes, BigInt(params.minAge)];
        console.log('   Using verifyForFreeHealthClinic circuit with minAge:', params.minAge);
        break;
      }
      case 'pharmacy': {
        if (params.requiredPrescription === undefined) {
          return { success: false, error: 'requiredPrescription parameter required for pharmacy verification' };
        }
        circuitId = CIRCUITS.VERIFY_PHARMACY;
        args = [commitmentBytes, BigInt(params.requiredPrescription)];
        console.log('   Using verifyForPharmacy circuit with prescription:', params.requiredPrescription);
        break;
      }
      case 'hospital': {
        if (params.minAge === undefined || params.requiredCondition === undefined) {
          return { success: false, error: 'minAge and requiredCondition parameters required for hospital verification' };
        }
        circuitId = CIRCUITS.VERIFY_HOSPITAL;
        args = [commitmentBytes, BigInt(params.minAge), BigInt(params.requiredCondition)];
        console.log('   Using verifyForHospital circuit with minAge:', params.minAge, 'condition:', params.requiredCondition);
        break;
      }
      default:
        return { success: false, error: `Unknown verifier type: ${verifierType}` };
    }

    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract,
      circuitId,
      privateStateId: PRIVATE_STATE_ID,
      args,
    });

    const txId = (result as any)?.public?.txId;
    const returnValue = (result as any)?.returnValue;
    
    console.log('✅ Selective disclosure verification submitted:', txId);
    console.log('   Verification result:', returnValue);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
      isValid: returnValue === true,
    };
  } catch (error: any) {
    console.error('❌ Failed to submit proof verification:', error);
    
    // Extract the real error from the FiberFailure wrapper
    const cause = error.cause?.cause || error.cause;
    const causeMessage = cause?.message || cause?.failure?.message || error.cause?.message || '';
    
    console.error('   Real cause:', cause);
    console.error('   Cause message:', causeMessage);
    
    if (causeMessage.includes('Insufficient Funds') || causeMessage.includes('could not balance dust')) {
      return { 
        success: false, 
        error: 'Insufficient funds: Your wallet needs tDUST tokens. Get some from https://faucet.preprod.midnight.network/' 
      };
    }
    
    return {
      success: false,
      error: causeMessage || error.message || 'Failed to submit proof verification',
    };
  }
}
