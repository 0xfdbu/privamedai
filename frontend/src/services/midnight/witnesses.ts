/**
 * PrivaMedAI Witnesses
 * 
 * Witness implementations for private state access in circuits
 */

import { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js';

/**
 * Private state for PrivaMedAI
 * Contains the health claim data used by verification circuits
 */
export type PrivaMedAIPrivateState = {
  readonly secretKey: Uint8Array;
  readonly healthClaim?: {
    age: bigint;
    conditionCode: bigint;
    prescriptionCode: bigint;
  };
  // Legacy fields for backward compatibility
  readonly credentialData?: Uint8Array;
  readonly bundledCredentialData?: Uint8Array[];
};

/**
 * Create private state with health claim
 */
export const createPrivaMedAIPrivateState = (
  secretKey: Uint8Array,
  healthClaim?: { age: bigint; conditionCode: bigint; prescriptionCode: bigint }
): PrivaMedAIPrivateState => ({
  secretKey,
  healthClaim,
});

/**
 * Witnesses for PrivaMedAI contract
 * These provide access to private state during circuit execution
 */
export const witnesses = {
  /**
   * Get the private health claim data (age, condition, prescription)
   * Used by verification circuits for selective disclosure
   * 
   * CRITICAL: This must return the EXACT health claim values that were
   * used to compute the claimHash during credential issuance.
   */
  get_private_health_claim: (
    context: WitnessContext<Ledger, PrivaMedAIPrivateState>
  ): [PrivaMedAIPrivateState, { age: bigint; conditionCode: bigint; prescriptionCode: bigint }] => {
    // Use healthClaim from private state if available
    if (context.privateState.healthClaim) {
      return [context.privateState, context.privateState.healthClaim];
    }
    
    // Fallback: extract from credentialData for backward compatibility
    const credentialData = context.privateState.credentialData || new Uint8Array(32);
    const healthClaim = {
      age: BigInt(credentialData[0] || 0),
      conditionCode: BigInt(
        (credentialData[1] || 0) + (credentialData[2] || 0) * 256
      ),
      prescriptionCode: BigInt(
        (credentialData[3] || 0) + (credentialData[4] || 0) * 256
      ),
    };
    return [context.privateState, healthClaim];
  },
};

/**
 * Create initial private state for a user
 */
export function createInitialPrivateState(
  secretKey?: Uint8Array,
  healthClaim?: { age: number | bigint; conditionCode: number | bigint; prescriptionCode: number | bigint }
): PrivaMedAIPrivateState {
  return {
    secretKey: secretKey || new Uint8Array(32),
    healthClaim: healthClaim ? {
      age: BigInt(healthClaim.age),
      conditionCode: BigInt(healthClaim.conditionCode),
      prescriptionCode: BigInt(healthClaim.prescriptionCode),
    } : undefined,
  };
}
