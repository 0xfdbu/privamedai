/**
 * Proof Service Configuration
 */

import type { GeneratedRule } from '../../types/claims';

// Selective disclosure circuits for ZK proof generation
// These circuits allow proving specific claims without revealing full credential data
export type PrivaMedAICircuit = 
  | 'verifyForFreeHealthClinic'  // Proves: age >= minAge (reveals only age threshold match)
  | 'verifyForPharmacy'          // Proves: prescription code match (reveals only prescription validity)
  | 'verifyForHospital';         // Proves: age >= minAge AND condition code match

export interface ZKProofResult {
  success: boolean;
  proof: string;
  publicInputs: string;
  circuitId: string;
  txId: string;
  verificationResult?: boolean;
  error?: string;
}

export function getProofServerUrl(): string {
  const url = import.meta.env.VITE_PROOF_SERVER_URL;
  if (url && url !== 'undefined') return url;
  return 'http://localhost:6300';
}

export function getZkConfigBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/managed/PrivaMedAI`;
  }
  return 'http://localhost:3000/managed/PrivaMedAI';
}

/**
 * Select the appropriate verification circuit based on the user's intent
 * 
 * For selective disclosure, we detect the verifier type from the rules/context
 */
export function selectCircuitForRules(
  _rules: GeneratedRule[], 
  context?: { verifierType?: 'freeHealthClinic' | 'pharmacy' | 'hospital' }
): PrivaMedAICircuit {
  // If explicit verifier type is provided, use it
  if (context?.verifierType === 'freeHealthClinic') return 'verifyForFreeHealthClinic';
  if (context?.verifierType === 'pharmacy') return 'verifyForPharmacy';
  if (context?.verifierType === 'hospital') return 'verifyForHospital';
  
  // Default to freeHealthClinic for single-rule age verification
  return 'verifyForFreeHealthClinic';
}

export async function checkProofServerHealth(url?: string): Promise<{
  healthy: boolean;
  version?: string;
  latency?: number;
  error?: string;
}> {
  const proofServerUrl = url || getProofServerUrl();
  const startTime = performance.now();

  try {
    const response = await fetch(`${proofServerUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const latency = Math.round(performance.now() - startTime);

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        version: data.version || 'unknown',
        latency,
      };
    }

    return {
      healthy: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      latency: Math.round(performance.now() - startTime),
    };
  }
}
