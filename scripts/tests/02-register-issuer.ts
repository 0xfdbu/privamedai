// Test 2: Register Issuer
import { setupWallet, submitTx, getDeployment } from './common.ts';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Test 2: Register Issuer               ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const deployment = getDeployment();
  const { wallet, state } = await setupWallet();
  const publicKey = (state as any).publicKey;
  const issuerPubKey = publicKey.slice(0, 64);
  
  // Unique name hash for this test run
  const timestamp = Date.now();
  const nameHash = (timestamp.toString(16).slice(0, 12) + 'e5f6789012345678901234567890abcdef1234567890abcdef12').slice(0, 64);
  
  console.log(`Contract: ${deployment.contractAddress.slice(0, 40)}...`);
  console.log(`Issuer PK: ${issuerPubKey.slice(0, 32)}...`);
  console.log(`Name Hash: ${nameHash.slice(0, 32)}...\n`);
  
  console.log('Submitting registerIssuer transaction...');
  const result = await submitTx(wallet, 'registerIssuer', [
    Buffer.from(issuerPubKey, 'hex'),  // callerPubKey
    Buffer.from(issuerPubKey, 'hex'),  // issuerPubKey
    Buffer.from(nameHash, 'hex'),      // nameHash
  ]);
  
  console.log('\n✅ SUCCESS!');
  console.log('TX Hash:', result?.txHash || result);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ FAILED:', e.message);
  process.exit(1);
});
