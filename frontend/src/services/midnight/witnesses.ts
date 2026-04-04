/**
 * PrivaMedAI Witnesses
 * 
 * Witness implementations for private state access in circuits
 */

import { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js';

export type PrivaMedAIPrivateState = {
  readonly secretKey: Uint8Array;
  readonly credentialData: Uint8Array;
  readonly bundledCredentialData: Uint8Array[];
};

export const createPrivaMedAIPrivateState = (
  secretKey: Uint8Array,
  credentialData: Uint8Array = new Uint8Array(32),
  bundledCredentialData: Uint8Array[] = []
): PrivaMedAIPrivateState => ({
  secretKey,
  credentialData,
  bundledCredentialData,
});

/**
 * Witnesses for PrivaMedAI contract
 * These provide access to private state during circuit execution
 */
export const witnesses = {
  /**
   * Get the private health claim data (age, condition, prescription)
   * Used by verification circuits for selective disclosure
   */
  get_private_health_claim: (
    context: WitnessContext<Ledger, PrivaMedAIPrivateState>
  ): [PrivaMedAIPrivateState, { age: bigint; conditionCode: bigint; prescriptionCode: bigint }] => {
    // Default health claim - in production, this would come from actual credential data
    const healthClaim = {
      age: BigInt(context.privateState.credentialData[0] || 25),
      conditionCode: BigInt(
        (context.privateState.credentialData[1] || 0) * 256 + 
        (context.privateState.credentialData[2] || 0)
      ),
      prescriptionCode: BigInt(
        (context.privateState.credentialData[3] || 0) * 256 + 
        (context.privateState.credentialData[4] || 0)
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
  credentialData?: Uint8Array
): PrivaMedAIPrivateState {
  return {
    secretKey: secretKey || new Uint8Array(32),
    credentialData: credentialData || new Uint8Array(32),
    bundledCredentialData: [],
  };
}
