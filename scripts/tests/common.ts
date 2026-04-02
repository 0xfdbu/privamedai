// Common utilities for individual tests
import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import * as Rx from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

export const PROOF_SERVER_URL = 'http://localhost:6300';
export const DEPLOYMENT_PATH = path.join(process.cwd(), 'contracts/PrivaMedAI/deployments/preprod-deployment.json');

export interface Providers {
  wallet: any;
  proofServer: { prove: (circuitId: string, inputs: unknown[]) => Promise<Uint8Array> };
}

export async function setupWallet() {
  const wallet = createLaceWalletProvider();
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  return { wallet, state };
}

export async function submitTx(wallet: any, circuitId: string, args: unknown[]) {
  const response = await fetch(`${PROOF_SERVER_URL}/prove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuitId, inputs: args }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proof failed: ${error}`);
  }
  
  const proofData = await response.json();
  
  // Submit via wallet
  const result = await wallet.submitTransaction({
    contractAddress: JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf-8')).contractAddress,
    proof: proofData.proof,
    inputs: args,
  });
  
  return result;
}

export function getDeployment() {
  return JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf-8'));
}
