/**
 * On-Chain Proof Verification
 * 
 * Submits ZK proof verification as an on-chain transaction.
 * This is the authoritative verification - the Midnight network validators
 * run the SNARK verifier, totalVerificationsPerformed increments on-chain,
 * and the transaction is publicly auditable without revealing private data.
 */

import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../midnight/providers';
import { getCompiledContract } from '../midnight/providers/contract';
import { createInitialPrivateState } from '../midnight/witnesses';
import { CIRCUITS, CONTRACT_ADDRESS } from '../midnight/config';
import { hexToBytes32 } from '../midnight/utils/bytes';
import { getWalletState } from '../contractService';
import type { PrivaMedAICircuit } from './config';

const PRIVATE_STATE_ID = 'privamedai-private-state';

export interface OnChainVerificationResult {
  success: boolean;
  txId?: string;
  isValid?: boolean;
  error?: string;
}

// No encoding function needed - we pass healthClaim directly to private state

/**
 * Submit proof verification as an on-chain transaction
 * 
 * This is the AUTHORITATIVE verification:
 * - Network validators run the SNARK verifier
 * - totalVerificationsPerformed increments on-chain
 * - Transaction is publicly auditable
 * - Private health data NEVER appears in the transaction
 * 
 * The private health claim is injected via the `get_private_health_claim` witness.
 * Only the boolean assertion result (e.g., age >= minAge) is disclosed.
 */
export async function submitOnChainVerification(
  commitmentHex: string,
  circuitId: PrivaMedAICircuit,
  params: {
    minAge?: number;
    requiredPrescription?: number;
    requiredCondition?: number;
  },
  healthClaim?: {
    age: number;
    conditionCode: number;
    prescriptionCode: number;
  }
): Promise<OnChainVerificationResult> {
  console.log('⛓️ Submitting on-chain proof verification...');
  console.log('   Circuit:', circuitId);
  console.log('   Parameters:', params);
  console.log('   Health claim:', healthClaim);

  try {
    const providers = await initializeProviders();
    const compiledContract = await getCompiledContract();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Create initial private state WITH the health claim data
    // This is what the witness will use to compute the claim hash
    const initialPrivateState = createInitialPrivateState(
      hexToBytes32(wallet.coinPublicKey.slice(0, 64)),
      healthClaim
    );
    
    console.log('   Private state health claim:', healthClaim);

    // Ensure contract is joined with the correct private state
    try {
      await findDeployedContract(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState,
      });
      console.log('✅ Contract joined with health claim data');
    } catch (findError: any) {
      const errorMsg = findError.message || '';
      if (errorMsg.includes('already joined')) {
        console.log('ℹ️ Contract already joined');
        // Need to update private state with health claim
        await providers.privateStateProvider.set(PRIVATE_STATE_ID, initialPrivateState);
        console.log('✅ Updated private state with health claim');
      } else {
        throw findError;
      }
    }

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitmentHex);

    // Determine circuit and args based on verifier type
    let args: any[];

    switch (circuitId) {
      case 'verifyForFreeHealthClinic': {
        const minAge = params.minAge ?? 18;
        args = [commitmentBytes, BigInt(minAge)];
        console.log('   Using verifyForFreeHealthClinic with minAge:', minAge);
        break;
      }
      case 'verifyForPharmacy': {
        const prescription = params.requiredPrescription ?? 500;
        args = [commitmentBytes, BigInt(prescription)];
        console.log('   Using verifyForPharmacy with prescription:', prescription);
        break;
      }
      case 'verifyForHospital': {
        const minAge = params.minAge ?? 18;
        const condition = params.requiredCondition ?? 100;
        args = [commitmentBytes, BigInt(minAge), BigInt(condition)];
        console.log('   Using verifyForHospital with minAge:', minAge, 'condition:', condition);
        break;
      }
      default:
        return { success: false, error: `Unknown circuit: ${circuitId}` };
    }

    console.log('   Submitting transaction...');

    // Submit on-chain verification
    // The private health claim is injected via witness - never appears in transaction
    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract,
      circuitId,
      privateStateId: PRIVATE_STATE_ID,
      args,
    });

    const txId = (result as any)?.public?.txId;
    const returnValue = (result as any)?.returnValue;
    
    console.log('✅ On-chain verification submitted:', txId);
    console.log('   Verification result:', returnValue);
    console.log('   View on explorer: https://explorer.midnight.network/tx/' + txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
      isValid: returnValue === true,
    };
  } catch (error: any) {
    console.error('❌ On-chain verification failed:', error);
    
    const cause = error.cause?.cause || error.cause;
    const causeMessage = cause?.message || cause?.failure?.message || error.cause?.message || '';
    
    if (causeMessage.includes('Insufficient Funds') || causeMessage.includes('could not balance dust')) {
      return { 
        success: false, 
        error: 'Insufficient funds: Your wallet needs tDUST tokens. Get some from https://faucet.preprod.midnight.network/' 
      };
    }
    
    if (causeMessage.includes('Claim hash mismatch')) {
      return {
        success: false,
        error: 'Claim hash mismatch: The health claim data does not match what was stored when the credential was issued. This can happen if:\n1. The credential was issued with different health claim values\n2. The credential was issued before the claim hash formula was updated\n\nPlease issue a new credential and try again.',
      };
    }
    
    return {
      success: false,
      error: causeMessage || error.message || 'On-chain verification failed',
    };
  }
}
