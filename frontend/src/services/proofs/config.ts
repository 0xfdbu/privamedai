/**
 * Proof Service Configuration
 */

import type { GeneratedRule } from '../../types/claims';

export type PrivaMedAICircuit = 
  | 'verifyCredential'
  | 'bundledVerify2Credentials'
  | 'bundledVerify3Credentials'
  | 'checkCredentialStatus';

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

export function selectCircuitForRules(rules: GeneratedRule[]): PrivaMedAICircuit {
  const count = rules.length;
  if (count === 1) return 'verifyCredential';
  if (count === 2) return 'bundledVerify2Credentials';
  return 'bundledVerify3Credentials';
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
