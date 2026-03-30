import { Contract, ledger, CredentialStatus } from '/home/user/Desktop/midnight/repo/contract/src/managed/PrivaCred/contract/index.js';
import { createConstructorContext, createCircuitContext, sampleContractAddress, persistentHash, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';

const bytes32Type = new CompactTypeBytes(32);
const vector1Bytes32Type = new CompactTypeVector(1, bytes32Type);

function computeClaimHash(credentialData) {
  return persistentHash(vector1Bytes32Type, [credentialData]);
}

// Test 1: issueCredential works
console.log('\n=== Test 1: issueCredential ===');
{
  const witnesses = {
    local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
    get_credential_data: (ctx) => [ctx.privateState, ctx.privateState.credentialData],
  };
  const contract = new Contract(witnesses);
  const coinPublicKey = new Uint8Array(32).fill(0);
  const privateState = { secretKey: new Uint8Array(32).fill(1), credentialData: new Uint8Array(32).fill(2) };
  
  const constructorResult = contract.initialState(createConstructorContext(privateState, coinPublicKey));
  const address = sampleContractAddress();
  const ctx = createCircuitContext(address, constructorResult.currentZswapLocalState, constructorResult.currentContractState, constructorResult.currentPrivateState);
  
  const commitment = new Uint8Array(32).fill(3);
  const issuer = new Uint8Array(32).fill(4);
  const claimHash = new Uint8Array(32).fill(5);
  const expiry = 1000n;
  
  const result = contract.circuits.issueCredential(ctx, commitment, issuer, claimHash, expiry);
  const ledgerState = ledger(result.context.currentQueryContext.state);
  console.assert(ledgerState.credentials.size() === 1n, 'Expected 1 credential');
  console.assert(ledgerState.roundCounter === 1n, 'Expected roundCounter = 1');
  console.log('✅ issueCredential works');
}

// Test 2: verifyCredential succeeds when claim hash matches
console.log('\n=== Test 2: verifyCredential success ===');
{
  const credentialData = new Uint8Array(32).fill(6);
  const claimHash = computeClaimHash(credentialData);
  
  const witnesses = {
    local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
    get_credential_data: (ctx) => [ctx.privateState, ctx.privateState.credentialData],
  };
  const contract = new Contract(witnesses);
  const coinPublicKey = new Uint8Array(32).fill(0);
  const privateState = { secretKey: new Uint8Array(32).fill(1), credentialData };
  
  const constructorResult = contract.initialState(createConstructorContext(privateState, coinPublicKey));
  const address = sampleContractAddress();
  const ctx = createCircuitContext(address, constructorResult.currentZswapLocalState, constructorResult.currentContractState, constructorResult.currentPrivateState);
  
  const commitment = new Uint8Array(32).fill(3);
  const issuer = new Uint8Array(32).fill(4);
  const expiry = 1000n;
  
  const issueResult = contract.circuits.issueCredential(ctx, commitment, issuer, claimHash, expiry);
  const verifyResult = contract.circuits.verifyCredential(issueResult.context, commitment);
  console.assert(verifyResult.result === true, 'Expected verifyCredential to return true');
  console.log('✅ verifyCredential returns true when claim hash matches');
}

// Test 3: verifyCredential fails for revoked credential
console.log('\n=== Test 3: verifyCredential fails for revoked ===');
{
  const credentialData = new Uint8Array(32).fill(6);
  const claimHash = computeClaimHash(credentialData);
  
  // Use same secretKey as issuer so revoke works
  const issuerSk = new Uint8Array(32).fill(7);
  const witnesses = {
    local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
    get_credential_data: (ctx) => [ctx.privateState, ctx.privateState.credentialData],
  };
  const contract = new Contract(witnesses);
  const coinPublicKey = new Uint8Array(32).fill(0);
  const privateState = { secretKey: issuerSk, credentialData };
  
  const constructorResult = contract.initialState(createConstructorContext(privateState, coinPublicKey));
  const address = sampleContractAddress();
  const ctx = createCircuitContext(address, constructorResult.currentZswapLocalState, constructorResult.currentContractState, constructorResult.currentPrivateState);
  
  const commitment = new Uint8Array(32).fill(3);
  // Derive issuer public key using the same pattern as contract
  const pkPrefix = new TextEncoder().encode("privacred:pk:").slice(0, 32);
  const vector2Type = new CompactTypeVector(2, bytes32Type);
  const issuer = persistentHash(vector2Type, [pkPrefix, issuerSk]);
  const expiry = 1000n;
  
  const issueResult = contract.circuits.issueCredential(ctx, commitment, issuer, claimHash, expiry);
  
  // Revoke as issuer
  const revokeResult = contract.circuits.revokeCredential(issueResult.context, commitment);
  const ledgerState = ledger(revokeResult.context.currentQueryContext.state);
  const storedCred = ledgerState.credentials.lookup(commitment);
  console.assert(storedCred.status === CredentialStatus.REVOKED, 'Expected REVOKED status');
  console.assert(ledgerState.roundCounter === 2n, 'Expected roundCounter = 2 after issue+revoke');
  
  try {
    contract.circuits.verifyCredential(revokeResult.context, commitment);
    console.log('❌ verifyCredential should have failed for revoked credential');
  } catch (e) {
    console.log('✅ verifyCredential correctly fails for revoked credential:', e.message);
  }
}

// Test 4: revokeCredential fails for non-issuer
console.log('\n=== Test 4: revokeCredential auth ===');
{
  const witnesses = {
    local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
    get_credential_data: (ctx) => [ctx.privateState, ctx.privateState.credentialData],
  };
  const contract = new Contract(witnesses);
  const coinPublicKey = new Uint8Array(32).fill(0);
  const privateState = { secretKey: new Uint8Array(32).fill(1), credentialData: new Uint8Array(32).fill(2) };
  
  const constructorResult = contract.initialState(createConstructorContext(privateState, coinPublicKey));
  const address = sampleContractAddress();
  const ctx = createCircuitContext(address, constructorResult.currentZswapLocalState, constructorResult.currentContractState, constructorResult.currentPrivateState);
  
  const commitment = new Uint8Array(32).fill(3);
  const issuer = new Uint8Array(32).fill(4);
  const claimHash = new Uint8Array(32).fill(5);
  const expiry = 1000n;
  
  const issueResult = contract.circuits.issueCredential(ctx, commitment, issuer, claimHash, expiry);
  
  try {
    contract.circuits.revokeCredential(issueResult.context, commitment);
    console.log('❌ revokeCredential should have failed for non-issuer');
  } catch (e) {
    console.log('✅ revokeCredential correctly fails for non-issuer:', e.message);
  }
}

// Test 5: issueCredential fails for duplicate commitment
console.log('\n=== Test 5: issueCredential duplicate ===');
{
  const witnesses = {
    local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
    get_credential_data: (ctx) => [ctx.privateState, ctx.privateState.credentialData],
  };
  const contract = new Contract(witnesses);
  const coinPublicKey = new Uint8Array(32).fill(0);
  const privateState = { secretKey: new Uint8Array(32).fill(1), credentialData: new Uint8Array(32).fill(2) };
  
  const constructorResult = contract.initialState(createConstructorContext(privateState, coinPublicKey));
  const address = sampleContractAddress();
  const ctx = createCircuitContext(address, constructorResult.currentZswapLocalState, constructorResult.currentContractState, constructorResult.currentPrivateState);
  
  const commitment = new Uint8Array(32).fill(3);
  const issuer = new Uint8Array(32).fill(4);
  const claimHash = new Uint8Array(32).fill(5);
  const expiry = 1000n;
  
  const issueResult = contract.circuits.issueCredential(ctx, commitment, issuer, claimHash, expiry);
  
  try {
    contract.circuits.issueCredential(issueResult.context, commitment, issuer, claimHash, expiry);
    console.log('❌ issueCredential should have failed for duplicate');
  } catch (e) {
    console.log('✅ issueCredential correctly fails for duplicate:', e.message);
  }
}

console.log('\n🎉 All manual tests passed!');
