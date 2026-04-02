// Test 6: Revoke Credential
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 6: Revoke Credential             ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  const publicKey = (state as any).publicKey;
  const issuerPubKey = publicKey.slice(0, 64);
  
  // Use a commitment that was issued (from test 4 batch issue)
  const commitment = '19d4adf31d20f2d4e5f678901234567890abcdef1234567890abce';
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Issuer PK: ${issuerPubKey.slice(0, 32)}...`);
  console.log(`Commitment: ${commitment.slice(0, 32)}...\n`);
  
  console.log('Submitting revokeCredential transaction...');
  const result = await submitTx(wallet, 'revokeCredential', [
    Buffer.from(issuerPubKey, 'hex'),  // callerPubKey
    Buffer.from(commitment, 'hex'),    // commitment
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
