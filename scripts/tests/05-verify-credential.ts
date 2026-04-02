// Test 5: Verify Credential
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 5: Verify Credential             ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  
  // Use the same commitment/claimHash from batch issue (test 4)
  // You need to use values that were successfully issued
  const commitment = '19d4adf31d20f1d4e5f678901234567890abcdef1234567890abcd';
  const claimHash = '19d4adf31d20b1d4e5f678901234567890abcdef1234567890abcd';
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Commitment: ${commitment.slice(0, 32)}...`);
  console.log(`Claim Hash: ${claimHash.slice(0, 32)}...\n`);
  
  console.log('Submitting verifyCredential transaction...');
  const result = await submitTx(wallet, 'verifyCredential', [
    Buffer.from(commitment, 'hex'),   // commitment
    Buffer.from(claimHash, 'hex'),    // credentialData (must match stored claimHash)
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
