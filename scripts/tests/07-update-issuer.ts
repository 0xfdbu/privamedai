// Test 7: Update Issuer Status
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 7: Update Issuer Status          ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  const publicKey = (state as any).publicKey;
  const issuerPubKey = publicKey.slice(0, 64);
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Issuer PK: ${issuerPubKey.slice(0, 32)}...`);
  console.log(`New Status: false (suspending issuer)\n`);
  
  console.log('Submitting updateIssuerStatus transaction...');
  const result = await submitTx(wallet, 'updateIssuerStatus', [
    Buffer.from(issuerPubKey, 'hex'),  // callerPubKey
    Buffer.from(issuerPubKey, 'hex'),  // issuerPubKey
    false,                              // newStatus (suspend)
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
