import { describe, it, expect } from 'vitest';
import { PrivaMedAISimulator, computeClaimHash, computePublicKey } from './privamedai-simulator.js';
import { CredentialStatus, IssuerStatus } from '../managed/PrivaMedAI/contract/index.js';

describe('PrivaMedAI Enterprise Contract', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // ADMIN & INITIALIZATION TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Admin Functions', () => {
    it('initializes with admin set', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const adminPk = computePublicKey(adminSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.admin.lookup(new Uint8Array([97]))).toEqual(adminPk);
      expect(ledgerState.roundCounter.value).toBe(1n);
    });

    it('returns correct admin address', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const adminPk = computePublicKey(adminSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      expect(sim.getAdmin()).toEqual(adminPk);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ISSUER REGISTRY TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Issuer Registry', () => {
    it('registers a new issuer (admin only)', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.issuerRegistry.member(issuerPk)).toBe(true);
      
      const issuer = ledgerState.issuerRegistry.lookup(issuerPk);
      expect(Buffer.from(issuer.publicKey).equals(Buffer.from(issuerPk))).toBe(true);
      expect(issuer.status).toBe(IssuerStatus.ACTIVE);
      expect(Buffer.from(issuer.nameHash).equals(Buffer.from(nameHash))).toBe(true);
    });

    it('prevents non-admin from registering issuers', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const nonAdminSk = new Uint8Array(32).fill(9);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      // Try to register as non-admin
      expect(() => sim.registerIssuer(issuerPk, nameHash, nonAdminSk)).toThrow('Only admin can register issuers');
    });

    it('prevents registering duplicate issuers', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      expect(() => sim.registerIssuer(issuerPk, nameHash)).toThrow('Issuer already registered');
    });

    it('updates issuer status (admin only)', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      const issuer = sim.getLedger().issuerRegistry.lookup(issuerPk);
      expect(issuer.status).toBe(IssuerStatus.SUSPENDED);
    });

    it('prevents non-admin from updating issuer status', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const nonAdminSk = new Uint8Array(32).fill(9);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      expect(() => sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED, nonAdminSk)).toThrow('Only admin can update issuer status');
    });

    it('retrieves issuer info', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = new Uint8Array(32).fill(2);
      const nameHash = new Uint8Array(32).fill(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      const issuer = sim.getIssuerInfo(issuerPk);
      
      expect(issuer.status).toBe(IssuerStatus.ACTIVE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CREDENTIAL ISSUANCE TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Credential Issuance', () => {
    it('issues a credential through registered issuer', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Register issuer
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      // Issue credential
      const commitment = new Uint8Array(32).fill(3);
      const claimHash = new Uint8Array(32).fill(4);
      const expiry = 1000n;
      
      sim.issueCredential(commitment, issuerPk, claimHash, expiry, issuerSk);
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.credentials.member(commitment)).toBe(true);
      expect(ledgerState.totalCredentialsIssued.value).toBe(1n);
      
      const cred = ledgerState.credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.VALID);
    });

    it('prevents issuing through unregistered issuer', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Don't register the issuer
      const commitment = new Uint8Array(32).fill(3);
      const claimHash = new Uint8Array(32).fill(4);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Issuer not registered');
    });

    it('prevents issuing through suspended issuer', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Register then suspend issuer
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      const commitment = new Uint8Array(32).fill(3);
      const claimHash = new Uint8Array(32).fill(4);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Issuer not active');
    });

    it('prevents non-issuer from issuing credentials', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const otherSk = new Uint8Array(32).fill(5);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Register issuer
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      // Try to issue as different key
      const commitment = new Uint8Array(32).fill(3);
      const claimHash = new Uint8Array(32).fill(4);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, otherSk))
        .toThrow('Only registered issuer can issue');
    });

    it('prevents issuing duplicate credentials', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      const claimHash = new Uint8Array(32).fill(4);
      
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Credential already exists');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // BATCH ISSUANCE TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Batch Issuance', () => {
    it('issues 3 credentials in one transaction', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment1 = new Uint8Array(32).fill(10);
      const commitment2 = new Uint8Array(32).fill(11);
      const commitment3 = new Uint8Array(32).fill(12);
      
      sim.batchIssue3Credentials(
        commitment1, new Uint8Array(32).fill(20), 1000n,
        commitment2, new Uint8Array(32).fill(21), 1000n,
        commitment3, new Uint8Array(32).fill(22), 1000n,
        issuerSk
      );
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.credentials.member(commitment1)).toBe(true);
      expect(ledgerState.credentials.member(commitment2)).toBe(true);
      expect(ledgerState.credentials.member(commitment3)).toBe(true);
      expect(ledgerState.totalCredentialsIssued.value).toBe(3n);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // VERIFICATION TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Single Credential Verification', () => {
    it('verifies a valid credential', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData = new Uint8Array(32).fill(5);
      const claimHash = computeClaimHash(credentialData);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk, credentialData });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      const isValid = sim.verifyCredential(commitment);
      expect(isValid).toBe(true);
      expect(sim.getLedger().totalVerificationsPerformed.value).toBe(1n);
    });

    it('fails verification for revoked credential', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData = new Uint8Array(32).fill(5);
      const claimHash = computeClaimHash(credentialData);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk, credentialData });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      sim.revokeCredential(commitment, issuerSk);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Credential revoked');
    });

    it('fails verification when claim hash does not match', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk, credentialData: new Uint8Array(32).fill(5) });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      const wrongClaimHash = new Uint8Array(32).fill(99);
      sim.issueCredential(commitment, issuerPk, wrongClaimHash, 1000n, issuerSk);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Hash mismatch');
    });

    it('fails verification when issuer is no longer active', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData = new Uint8Array(32).fill(5);
      const claimHash = computeClaimHash(credentialData);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk, credentialData });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      // Suspend the issuer
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Issuer not active');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // BUNDLED VERIFICATION TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Bundled Verification', () => {
    it('verifies 2 credentials in one proof', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData1 = new Uint8Array(32).fill(5);
      const credentialData2 = new Uint8Array(32).fill(6);
      const claimHash1 = computeClaimHash(credentialData1);
      const claimHash2 = computeClaimHash(credentialData2);
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        bundledCredentialData: [credentialData1, credentialData2] 
      });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment1 = new Uint8Array(32).fill(10);
      const commitment2 = new Uint8Array(32).fill(11);
      
      sim.issueCredential(commitment1, issuerPk, claimHash1, 1000n, issuerSk);
      sim.issueCredential(commitment2, issuerPk, claimHash2, 1000n, issuerSk);
      
      const isValid = sim.bundledVerify2Credentials(commitment1, commitment2);
      expect(isValid).toBe(true);
    });

    it('verifies 3 credentials in one proof', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData1 = new Uint8Array(32).fill(5);
      const credentialData2 = new Uint8Array(32).fill(6);
      const credentialData3 = new Uint8Array(32).fill(7);
      const claimHash1 = computeClaimHash(credentialData1);
      const claimHash2 = computeClaimHash(credentialData2);
      const claimHash3 = computeClaimHash(credentialData3);
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        bundledCredentialData: [credentialData1, credentialData2, credentialData3] 
      });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment1 = new Uint8Array(32).fill(10);
      const commitment2 = new Uint8Array(32).fill(11);
      const commitment3 = new Uint8Array(32).fill(12);
      
      sim.issueCredential(commitment1, issuerPk, claimHash1, 1000n, issuerSk);
      sim.issueCredential(commitment2, issuerPk, claimHash2, 1000n, issuerSk);
      sim.issueCredential(commitment3, issuerPk, claimHash3, 1000n, issuerSk);
      
      const isValid = sim.bundledVerify3Credentials(commitment1, commitment2, commitment3);
      expect(isValid).toBe(true);
    });

    it('fails bundled verification if one credential is revoked', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const credentialData1 = new Uint8Array(32).fill(5);
      const credentialData2 = new Uint8Array(32).fill(6);
      const claimHash1 = computeClaimHash(credentialData1);
      const claimHash2 = computeClaimHash(credentialData2);
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        bundledCredentialData: [credentialData1, credentialData2] 
      });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment1 = new Uint8Array(32).fill(10);
      const commitment2 = new Uint8Array(32).fill(11);
      
      sim.issueCredential(commitment1, issuerPk, claimHash1, 1000n, issuerSk);
      sim.issueCredential(commitment2, issuerPk, claimHash2, 1000n, issuerSk);
      
      // Revoke one credential
      sim.revokeCredential(commitment1, issuerSk);
      
      expect(() => sim.bundledVerify2Credentials(commitment1, commitment2)).toThrow('Credential 1 revoked');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // REVOCATION TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Credential Revocation', () => {
    it('revokes credential when called by issuer', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(4), 1000n, issuerSk);
      
      sim.revokeCredential(commitment, issuerSk);
      
      const cred = sim.getLedger().credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.REVOKED);
    });

    it('prevents non-issuer from revoking', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const otherSk = new Uint8Array(32).fill(5);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(4), 1000n, issuerSk);
      
      expect(() => sim.revokeCredential(commitment, otherSk)).toThrow('Only issuer can revoke');
    });

    it('allows admin emergency revocation', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(4), 1000n, issuerSk);
      
      const reasonHash = new Uint8Array(32).fill(99);
      sim.adminRevokeCredential(commitment, reasonHash, adminSk);
      
      const cred = sim.getLedger().credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.REVOKED);
    });

    it('prevents non-admin from emergency revocation', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(4), 1000n, issuerSk);
      
      const reasonHash = new Uint8Array(32).fill(99);
      expect(() => sim.adminRevokeCredential(commitment, reasonHash, issuerSk)).toThrow('Only admin can emergency revoke');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // QUERY TESTS
  // ───────────────────────────────────────────────────────────────────────────
  
  describe('Query Functions', () => {
    it('checks credential status', () => {
      const adminSk = new Uint8Array(32).fill(1);
      const issuerSk = new Uint8Array(32).fill(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, new Uint8Array(32).fill(9));
      
      const commitment = new Uint8Array(32).fill(3);
      sim.issueCredential(commitment, issuerPk, new Uint8Array(32).fill(4), 1000n, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
      
      sim.revokeCredential(commitment, issuerSk);
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.REVOKED);
    });
  });
});
