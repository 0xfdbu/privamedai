// Test 4: Batch Issue 3 Credentials
import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import * as Rx from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const PROOF_SERVER_URL = 'http://localhost:6300';
const DEPLOYMENT_PATH = path.join(process.cwd(), 'contracts/PrivaMedAI/deployments/preprod-deployment.json');

async function submitTx(wallet: any, circuitId: string, args: unknown[]) {
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf-8'));
  const response = await fetch(`${PROOF_SERVER_URL}/prove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuitId, inputs: args }),
  });
  
  if (!response.ok) throw new Error(`Proof failed: ${await response.text()}`);
  const proofData = await response.json();
  
  return await wallet.submitTransaction({
    contractAddress: deployment.contractAddress,
    proof: proofData.proof,
    inputs: args,
  });
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 4: Batch Issue 3 Credentials     ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf-8'));
  const wallet = createLaceWalletProvider();
  
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  const publicKey = (state as any).publicKey;
  const issuerPubKey = publicKey.slice(0, 64);
  const callerPk = Buffer.from(issuerPubKey, 'hex');
  
  // Unique data for this test run
  const timestamp = Date.now();
  const tsHex = timestamp.toString(16).slice(0, 12);
  const expiry = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);
  
  const c1 = (tsHex + 'f1d4e5f6789012345678901234567890abcdef1234567890abcd').slice(0, 64);
  const c2 = (tsHex + 'f2d4e5f6789012345678901234567890abcdef1234567890abce').slice(0, 64);
  const c3 = (tsHex + 'f3d4e5f6789012345678901234567890abcdef1234567890abcf').slice(0, 64);
  const h1 = (tsHex + 'b1d4e5f6789012345678901234567890abcdef1234567890abcd').slice(0, 64);
  const h2 = (tsHex + 'b2d4e5f6789012345678901234567890abcdef1234567890abce').slice(0, 64);
  const h3 = (tsHex + 'b3d4e5f6789012345678901234567890abcdef1234567890abcf').slice(0, 64);
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Issuer PK: ${issuerPubKey.slice(0, 32)}...`);
  console.log(`Commitments: ${c1.slice(0, 16)}..., ${c2.slice(0, 16)}..., ${c3.slice(0, 16)}...\n`);
  
  console.log('Submitting batchIssue3Credentials transaction...');
  const result = await submitTx(wallet, 'batchIssue3Credentials', [
    callerPk,
    Buffer.from(c1, 'hex'), Buffer.from(h1, 'hex'), expiry,
    Buffer.from(c2, 'hex'), Buffer.from(h2, 'hex'), expiry,
    Buffer.from(c3, 'hex'), Buffer.from(h3, 'hex'), expiry,
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
