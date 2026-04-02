// Test 3: Issue Single Credential
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 3: Issue Credential              ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  const publicKey = (state as any).publicKey;
  const issuerPubKey = publicKey.slice(0, 64);
  
  // Unique data for this test run
  const timestamp = Date.now();
  const tsHex = timestamp.toString(16).slice(0, 12);
  const commitment = (tsHex + 'c1d4e5f6789012345678901234567890abcdef1234567890abcd').slice(0, 64);
  const claimHash = (tsHex + 'd1e5f6789012345678901234567890abcdef1234567890abcd12').slice(0, 64);
  const expiry = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Issuer PK: ${issuerPubKey.slice(0, 32)}...`);
  console.log(`Commitment: ${commitment.slice(0, 32)}...`);
  console.log(`Claim Hash: ${claimHash.slice(0, 32)}...`);
  console.log(`Expiry: ${expiry}\n`);
  
  console.log('Submitting issueCredential transaction...');
  const result = await submitTx(wallet, 'issueCredential', [
    Buffer.from(issuerPubKey, 'hex'),  // callerPubKey
    Buffer.from(commitment, 'hex'),    // commitment
    Buffer.from(issuerPubKey, 'hex'),  // issuerPubKey
    Buffer.from(claimHash, 'hex'),     // claimHash
    expiry,                            // expiry
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
