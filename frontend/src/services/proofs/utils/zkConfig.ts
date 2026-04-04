/**
 * ZK Configuration Utilities
 */

import { getZkConfigBaseUrl, type PrivaMedAICircuit } from '../config';

export interface ZKConfig {
  proverKey: Uint8Array;
  verifierKey: Uint8Array;
  ir: Uint8Array;
}

export async function fetchZKConfig(circuitId: string): Promise<ZKConfig> {
  const baseUrl = getZkConfigBaseUrl();
  
  const [proverRes, verifierRes, irRes] = await Promise.all([
    fetch(`${baseUrl}/keys/${circuitId}.prover`),
    fetch(`${baseUrl}/keys/${circuitId}.verifier`),
    fetch(`${baseUrl}/zkir/${circuitId}.zkir`),
  ]);
  
  if (!proverRes.ok) throw new Error(`Failed to fetch prover key: ${proverRes.status}`);
  if (!verifierRes.ok) throw new Error(`Failed to fetch verifier key: ${verifierRes.status}`);
  if (!irRes.ok) throw new Error(`Failed to fetch ZKIR: ${irRes.status}`);
  
  const [proverKey, verifierKey, ir] = await Promise.all([
    proverRes.arrayBuffer().then(b => new Uint8Array(b)),
    verifierRes.arrayBuffer().then(b => new Uint8Array(b)),
    irRes.arrayBuffer().then(b => new Uint8Array(b)),
  ]);
  
  return { proverKey, verifierKey, ir };
}
