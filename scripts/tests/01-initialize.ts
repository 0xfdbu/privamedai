// Test 1: Initialize Contract (Set Admin)
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 1: Initialize Contract           ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  const publicKey = (state as any).publicKey;
  const adminPubKey = publicKey.slice(0, 64);
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Admin PK: ${adminPubKey.slice(0, 32)}...\n`);
  
  console.log('Submitting initialize transaction...');
  const result = await submitTx(wallet, 'initialize', [
    Buffer.from(adminPubKey, 'hex'),  // initialAdmin: Bytes<32>
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
