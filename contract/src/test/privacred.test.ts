import { describe, it, expect } from 'vitest';
import { PrivaCredSimulator, computeClaimHash, computePublicKey } from './privacred-simulator.js';
import { CredentialStatus } from '../managed/PrivaCred/contract/index.js';

describe('PrivaCred smart contract', () => {
  it('initializes with empty ledger', () => {
    const sim = new PrivaCredSimulator();
    const ledgerState = sim.getLedger();
    expect(ledgerState.credentials.isEmpty()).toBe(true);
    expect(ledgerState.roundCounter).toBe(0n);
  });

  it('issues a credential and increments roundCounter', () => {
    const sim = new PrivaCredSimulator();
    const commitment = new Uint8Array(32).fill(1);
    const issuer = new Uint8Array(32).fill(2);
    const claimHash = new Uint8Array(32).fill(3);
    const expiry = 1000n;

    const ledgerState = sim.issueCredential(commitment, issuer, claimHash, expiry);

    expect(ledgerState.credentials.size()).toBe(1n);
    expect(ledgerState.roundCounter).toBe(1n);
    expect(ledgerState.credentials.member(commitment)).toBe(true);

    const cred = ledgerState.credentials.lookup(commitment);
    expect(Buffer.from(cred.issuer).equals(Buffer.from(issuer))).toBe(true);
    expect(Buffer.from(cred.claimHash).equals(Buffer.from(claimHash))).toBe(true);
    expect(cred.expiry).toBe(expiry);
    expect(cred.status).toBe(CredentialStatus.VALID);
  });

  it('verifies a credential when claim hash matches witness data', () => {
    const credentialData = new Uint8Array(32).fill(5);
    const claimHash = computeClaimHash(credentialData);
    const sim = new PrivaCredSimulator({ secretKey: new Uint8Array(32).fill(1), credentialData });

    const commitment = new Uint8Array(32).fill(4);
    const issuer = new Uint8Array(32).fill(2);
    sim.issueCredential(commitment, issuer, claimHash, 1000n);

    const isValid = sim.verifyCredential(commitment);
    expect(isValid).toBe(true);
  });

  it('fails verification when claim hash does not match witness data', () => {
    const credentialData = new Uint8Array(32).fill(5);
    const sim = new PrivaCredSimulator({ secretKey: new Uint8Array(32).fill(1), credentialData });

    const commitment = new Uint8Array(32).fill(4);
    const issuer = new Uint8Array(32).fill(2);
    const wrongClaimHash = new Uint8Array(32).fill(9);
    sim.issueCredential(commitment, issuer, wrongClaimHash, 1000n);

    expect(() => sim.verifyCredential(commitment)).toThrow('Claim hash mismatch');
  });

  it('revokes a credential when called by the issuer', () => {
    const issuerSk = new Uint8Array(32).fill(7);
    const issuerPk = computePublicKey(issuerSk);
    const credentialData = new Uint8Array(32).fill(6);
    const claimHash = computeClaimHash(credentialData);
    const sim = new PrivaCredSimulator({ secretKey: issuerSk, credentialData });

    const commitment = new Uint8Array(32).fill(3);
    sim.issueCredential(commitment, issuerPk, claimHash, 1000n);

    const ledgerState = sim.revokeCredential(commitment);
    expect(ledgerState.credentials.lookup(commitment).status).toBe(CredentialStatus.REVOKED);
    expect(ledgerState.roundCounter).toBe(2n);
  });

  it('fails revocation when called by a non-issuer', () => {
    const issuerPk = new Uint8Array(32).fill(4);
    const sim = new PrivaCredSimulator({ secretKey: new Uint8Array(32).fill(1), credentialData: new Uint8Array(32).fill(2) });

    const commitment = new Uint8Array(32).fill(3);
    sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(5), 1000n);

    expect(() => sim.revokeCredential(commitment)).toThrow('Only issuer can revoke');
  });

  it('fails verification for a revoked credential', () => {
    const issuerSk = new Uint8Array(32).fill(7);
    const issuerPk = computePublicKey(issuerSk);
    const credentialData = new Uint8Array(32).fill(6);
    const claimHash = computeClaimHash(credentialData);
    const sim = new PrivaCredSimulator({ secretKey: issuerSk, credentialData });

    const commitment = new Uint8Array(32).fill(3);
    sim.issueCredential(commitment, issuerPk, claimHash, 1000n);
    sim.revokeCredential(commitment);

    expect(() => sim.verifyCredential(commitment)).toThrow('Credential revoked');
  });

  it('prevents issuing duplicate credentials', () => {
    const sim = new PrivaCredSimulator();
    const commitment = new Uint8Array(32).fill(1);
    const issuer = new Uint8Array(32).fill(2);
    const claimHash = new Uint8Array(32).fill(3);

    sim.issueCredential(commitment, issuer, claimHash, 1000n);
    expect(() => sim.issueCredential(commitment, issuer, claimHash, 1000n)).toThrow('Credential already exists');
  });
});
