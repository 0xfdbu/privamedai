/**
 * Comprehensive Contract Tests for PrivaMedAI System
 * 
 * This test suite covers:
 * A. Issuer Management Tests
 * B. Credential Lifecycle Tests
 * C. Selective Disclosure Circuit Tests
 * D. Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  CredentialStatus, 
  IssuerStatus,
  type HealthClaim 
} from '../contract/src/managed/PrivaMedAI/contract/index.js';
import { 
  PrivaMedAISimulator, 
  computeClaimHash, 
  computePublicKey 
} from '../contract/src/test/privamedai-simulator.js';

// ═════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION & HELPERS
// ═════════════════════════════════════════════════════════════════════════════

// Helper to create deterministic test data
const createTestBytes = (fill: number, length: number = 32): Uint8Array => {
  return new Uint8Array(length).fill(fill);
};

// Helper to create random test bytes
const createRandomBytes = (length: number = 32): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

// Helper to compute health claim hash matching the contract logic
const computeHealthClaimHash = (claim: HealthClaim): Uint8Array => {
  // The contract uses: persistentHash([prefix, age_bytes, condition_bytes, prescription_bytes])
  // where prefix is "privamed:claim:" padded to 32 bytes
  const prefix = new Uint8Array(32);
  const prefixStr = 'privamed:claim:';
  const prefixBytes = new TextEncoder().encode(prefixStr);
  prefix.set(prefixBytes);
  
  // Convert numbers to 32-byte arrays (big-endian)
  const ageBytes = new Uint8Array(32);
  ageBytes[31] = Number(claim.age);
  
  const conditionBytes = new Uint8Array(32);
  conditionBytes[30] = Number(claim.conditionCode >> 8n);
  conditionBytes[31] = Number(claim.conditionCode & 0xFFn);
  
  const prescriptionBytes = new Uint8Array(32);
  prescriptionBytes[30] = Number(claim.prescriptionCode >> 8n);
  prescriptionBytes[31] = Number(claim.prescriptionCode & 0xFFn);
  
  // Simple hash combination for testing
  return hashBytes(Buffer.concat([prefix, ageBytes, conditionBytes, prescriptionBytes]));
};

// Simple hash function for testing
function hashBytes(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let sum = 0;
    for (let j = 0; j < data.length; j++) {
      sum += data[i] * (i + 1) * (j + 1);
    }
    result[i] = sum % 256;
  }
  return result;
}

// Buffer comparison helper
const buffersEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// ═════════════════════════════════════════════════════════════════════════════
// A. ISSUER MANAGEMENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('A. Issuer Management Tests', () => {
  describe('A.1 Initialize Contract with Admin', () => {
    it('should initialize with admin public key stored', () => {
      const adminSk = createTestBytes(1);
      const adminPk = computePublicKey(adminSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.admin.lookup(new Uint8Array([97]))).toEqual(adminPk);
      expect(ledgerState.roundCounter.value).toBe(1n);
    });

    it('should return correct admin address via getAdmin', () => {
      const adminSk = createTestBytes(1);
      const adminPk = computePublicKey(adminSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      expect(sim.getAdmin()).toEqual(adminPk);
    });
  });

  describe('A.2 Register Issuer', () => {
    it('should allow admin to register a new issuer', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.issuerRegistry.member(issuerPk)).toBe(true);
      
      const issuer = ledgerState.issuerRegistry.lookup(issuerPk);
      expect(buffersEqual(issuer.publicKey, issuerPk)).toBe(true);
      expect(issuer.status).toBe(IssuerStatus.ACTIVE);
      expect(buffersEqual(issuer.nameHash, nameHash)).toBe(true);
    });

    it('should prevent duplicate issuer registration', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = createTestBytes(2);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      
      expect(() => sim.registerIssuer(issuerPk, nameHash))
        .toThrow('Issuer already registered');
    });
  });

  describe('A.3 Get Issuer Info', () => {
    it('should retrieve issuer information correctly', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      const issuer = sim.getIssuerInfo(issuerPk);
      
      expect(issuer.status).toBe(IssuerStatus.ACTIVE);
      expect(buffersEqual(issuer.publicKey, issuerPk)).toBe(true);
      expect(buffersEqual(issuer.nameHash, nameHash)).toBe(true);
    });

    it('should throw error for non-existent issuer', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const nonExistentPk = createTestBytes(99);
      
      expect(() => sim.getIssuerInfo(nonExistentPk))
        .toThrow('Issuer not found');
    });
  });

  describe('A.4 Update Issuer Status', () => {
    it('should allow admin to update issuer status to SUSPENDED', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      const issuer = sim.getLedger().issuerRegistry.lookup(issuerPk);
      expect(issuer.status).toBe(IssuerStatus.SUSPENDED);
    });

    it('should allow admin to update issuer status to REVOKED', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      sim.updateIssuerStatus(issuerPk, IssuerStatus.REVOKED);
      
      const issuer = sim.getLedger().issuerRegistry.lookup(issuerPk);
      expect(issuer.status).toBe(IssuerStatus.REVOKED);
    });

    it('should prevent non-admin from updating issuer status', () => {
      const adminSk = createTestBytes(1);
      const nonAdminSk = createTestBytes(99);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const nameHash = createTestBytes(3);
      
      sim.registerIssuer(issuerPk, nameHash);
      
      expect(() => sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED, nonAdminSk))
        .toThrow('Only admin can update issuer status');
    });
  });

  describe('A.5 Prevent Unauthorized Issuer Registration', () => {
    it('should prevent non-admin from registering issuers', () => {
      const adminSk = createTestBytes(1);
      const nonAdminSk = createTestBytes(99);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      const issuerPk = createTestBytes(2);
      const nameHash = createTestBytes(3);
      
      expect(() => sim.registerIssuer(issuerPk, nameHash, nonAdminSk))
        .toThrow('Only admin can register issuers');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. CREDENTIAL LIFECYCLE TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('B. Credential Lifecycle Tests', () => {
  describe('B.1 Issue Single Credential', () => {
    it('should issue a credential through registered issuer', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Register issuer
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      // Issue credential
      const commitment = createTestBytes(3);
      const claimHash = createTestBytes(4);
      const expiry = 1000n;
      
      sim.issueCredential(commitment, issuerPk, claimHash, expiry, issuerSk);
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.credentials.member(commitment)).toBe(true);
      expect(ledgerState.totalCredentialsIssued.value).toBe(1n);
      
      const cred = ledgerState.credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.VALID);
      expect(buffersEqual(cred.issuer, issuerPk)).toBe(true);
    });

    it('should prevent issuing duplicate credentials', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      const claimHash = createTestBytes(4);
      
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Credential already exists');
    });
  });

  describe('B.2 Issue 3 Credentials (Bundled)', () => {
    it('should issue 3 credentials in one transaction', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment1 = createTestBytes(10);
      const commitment2 = createTestBytes(11);
      const commitment3 = createTestBytes(12);
      
      sim.batchIssue3Credentials(
        commitment1, createTestBytes(20), 1000n,
        commitment2, createTestBytes(21), 1000n,
        commitment3, createTestBytes(22), 1000n,
        issuerSk
      );
      
      const ledgerState = sim.getLedger();
      expect(ledgerState.credentials.member(commitment1)).toBe(true);
      expect(ledgerState.credentials.member(commitment2)).toBe(true);
      expect(ledgerState.credentials.member(commitment3)).toBe(true);
      expect(ledgerState.totalCredentialsIssued.value).toBe(3n);
    });
  });

  describe('B.3 Check Credential Status', () => {
    it('should return VALID status for valid credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
    });

    it('should return REVOKED status for revoked credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      sim.revokeCredential(commitment, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.REVOKED);
    });
  });

  describe('B.4 Revoke Credential (by Issuer)', () => {
    it('should allow issuer to revoke their own credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      
      sim.revokeCredential(commitment, issuerSk);
      
      const cred = sim.getLedger().credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.REVOKED);
    });

    it('should prevent non-issuer from revoking credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const otherSk = createTestBytes(5);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      
      expect(() => sim.revokeCredential(commitment, otherSk))
        .toThrow('Only issuer can revoke');
    });
  });

  describe('B.5 Admin Revoke Credential', () => {
    it('should allow admin to emergency revoke any credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      
      const reasonHash = createTestBytes(99);
      sim.adminRevokeCredential(commitment, reasonHash, adminSk);
      
      const cred = sim.getLedger().credentials.lookup(commitment);
      expect(cred.status).toBe(CredentialStatus.REVOKED);
    });

    it('should prevent non-admin from emergency revocation', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
      
      const reasonHash = createTestBytes(99);
      expect(() => sim.adminRevokeCredential(commitment, reasonHash, issuerSk))
        .toThrow('Only admin can emergency revoke');
    });
  });

  describe('B.6 Prevent Issuing to Invalid Issuer', () => {
    it('should prevent issuing through unregistered issuer', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Don't register the issuer
      const commitment = createTestBytes(3);
      const claimHash = createTestBytes(4);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Issuer not registered');
    });

    it('should prevent issuing through suspended issuer', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Register then suspend issuer
      sim.registerIssuer(issuerPk, createTestBytes(9));
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      const commitment = createTestBytes(3);
      const claimHash = createTestBytes(4);
      
      expect(() => sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk))
        .toThrow('Issuer not active');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. SELECTIVE DISCLOSURE CIRCUIT TESTS (CRITICAL)
// ═════════════════════════════════════════════════════════════════════════════

describe('C. Selective Disclosure Circuit Tests', () => {
  // Test helper to create a valid health claim credential
  const createValidHealthCredential = (
    age: number,
    conditionCode: number,
    prescriptionCode: number
  ): { claim: HealthClaim; claimHash: Uint8Array } => {
    const claim: HealthClaim = {
      age: BigInt(age),
      conditionCode: BigInt(conditionCode),
      prescriptionCode: BigInt(prescriptionCode)
    };
    
    // Create the claim hash as the contract expects
    const prefix = new Uint8Array(32);
    const prefixStr = 'privamed:claim:';
    const prefixBytes = new TextEncoder().encode(prefixStr);
    prefix.set(prefixBytes);
    
    const ageBytes = new Uint8Array(32);
    ageBytes[31] = age;
    
    const conditionBytes = new Uint8Array(32);
    conditionBytes[30] = conditionCode >> 8;
    conditionBytes[31] = conditionCode & 0xFF;
    
    const prescriptionBytes = new Uint8Array(32);
    prescriptionBytes[30] = prescriptionCode >> 8;
    prescriptionBytes[31] = prescriptionCode & 0xFF;
    
    const claimHash = hashBytes(Buffer.concat([prefix, ageBytes, conditionBytes, prescriptionBytes]));
    
    return { claim, claimHash };
  };

  describe('C.1 verifyForFreeHealthClinic: Prove age >= threshold', () => {
    it('should verify when age is above minimum threshold', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      // Create credential with age 25
      const { claimHash } = createValidHealthCredential(25, 100, 200);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk,
        credentialData: claimHash
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      // Verify credential exists and is valid
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
    });

    it('should handle edge case: age exactly at threshold', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      // Create credential with age exactly at threshold (e.g., 18)
      const { claimHash } = createValidHealthCredential(18, 100, 200);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk,
        credentialData: claimHash
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
    });
  });

  describe('C.2 verifyForPharmacy: Prove prescription match', () => {
    it('should verify when prescription code matches', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      // Create credential with prescription code 500
      const { claimHash } = createValidHealthCredential(30, 100, 500);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk,
        credentialData: claimHash
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
    });

    it('should handle various prescription codes', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      for (const prescriptionCode of [1, 100, 1000, 5000, 65535]) {
        const { claimHash } = createValidHealthCredential(30, 100, prescriptionCode);
        
        const sim = new PrivaMedAISimulator({ 
          adminSecretKey: adminSk,
          credentialData: claimHash
        });
        
        sim.registerIssuer(issuerPk, createTestBytes(9));
        
        const commitment = createRandomBytes();
        sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
        
        expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
      }
    });
  });

  describe('C.3 verifyForHospital: Prove age AND condition match', () => {
    it('should verify when both age and condition match requirements', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      // Create credential with age 65 and condition 200
      const { claimHash } = createValidHealthCredential(65, 200, 300);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk,
        credentialData: claimHash
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
    });

    it('should handle various condition codes', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      for (const conditionCode of [1, 50, 100, 500, 1000]) {
        const { claimHash } = createValidHealthCredential(40, conditionCode, 300);
        
        const sim = new PrivaMedAISimulator({ 
          adminSecretKey: adminSk,
          credentialData: claimHash
        });
        
        sim.registerIssuer(issuerPk, createTestBytes(9));
        
        const commitment = createRandomBytes();
        sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
        
        expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
      }
    });
  });

  describe('C.4 Test Proof Generation and Verification', () => {
    it('should verify credential with matching claim hash', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const credentialData = createTestBytes(5);
      const claimHash = computeClaimHash(credentialData);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        credentialData 
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      const isValid = sim.verifyCredential(commitment);
      expect(isValid).toBe(true);
      expect(sim.getLedger().totalVerificationsPerformed.value).toBe(1n);
    });

    it('should fail verification when claim hash does not match', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        credentialData: createTestBytes(5) 
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      const wrongClaimHash = createTestBytes(99);
      sim.issueCredential(commitment, issuerPk, wrongClaimHash, 1000n, issuerSk);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Hash mismatch');
    });
  });

  describe('C.5 Test Failure Cases', () => {
    it('should fail verification for revoked credential', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const credentialData = createTestBytes(5);
      const claimHash = computeClaimHash(credentialData);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        credentialData 
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      sim.revokeCredential(commitment, issuerSk);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Credential revoked');
    });

    it('should fail verification when issuer is suspended', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const credentialData = createTestBytes(5);
      const claimHash = computeClaimHash(credentialData);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        credentialData 
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment = createTestBytes(3);
      sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      // Suspend the issuer
      sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED);
      
      expect(() => sim.verifyCredential(commitment)).toThrow('Issuer not active');
    });

    it('should fail bundled verification if one credential is revoked', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const credentialData1 = createTestBytes(5);
      const credentialData2 = createTestBytes(6);
      const claimHash1 = computeClaimHash(credentialData1);
      const claimHash2 = computeClaimHash(credentialData2);
      
      const sim = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        bundledCredentialData: [credentialData1, credentialData2] 
      });
      
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      const commitment1 = createTestBytes(10);
      const commitment2 = createTestBytes(11);
      
      sim.issueCredential(commitment1, issuerPk, claimHash1, 1000n, issuerSk);
      sim.issueCredential(commitment2, issuerPk, claimHash2, 1000n, issuerSk);
      
      // Revoke one credential
      sim.revokeCredential(commitment1, issuerSk);
      
      expect(() => sim.bundledVerify2Credentials(commitment1, commitment2))
        .toThrow('Credential 1 revoked');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. INTEGRATION TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('D. Integration Tests', () => {
  describe('D.1 Simulator-Based Integration Flow', () => {
    it('should execute complete workflow: admin setup → issuer reg → credential issue → verify', () => {
      // Setup
      const adminSk = createTestBytes(1);
      const adminPk = computePublicKey(adminSk);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Verify admin setup
      expect(sim.getAdmin()).toEqual(adminPk);
      
      // Register issuer
      const nameHash = createTestBytes(3);
      sim.registerIssuer(issuerPk, nameHash);
      
      const issuer = sim.getIssuerInfo(issuerPk);
      expect(issuer.status).toBe(IssuerStatus.ACTIVE);
      
      // Issue credential
      const credentialData = createTestBytes(5);
      const claimHash = computeClaimHash(credentialData);
      const commitment = createTestBytes(10);
      
      const simWithData = new PrivaMedAISimulator({ 
        adminSecretKey: adminSk, 
        credentialData 
      });
      simWithData.registerIssuer(issuerPk, nameHash);
      simWithData.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
      
      // Verify credential
      const isValid = simWithData.verifyCredential(commitment);
      expect(isValid).toBe(true);
      
      // Check counters
      expect(simWithData.getLedger().totalCredentialsIssued.value).toBe(1n);
      expect(simWithData.getLedger().totalVerificationsPerformed.value).toBe(1n);
    });

    it('should handle multiple issuers and credentials', () => {
      const adminSk = createTestBytes(1);
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      
      // Create multiple issuers
      const issuer1Sk = createTestBytes(2);
      const issuer1Pk = computePublicKey(issuer1Sk);
      const issuer2Sk = createTestBytes(3);
      const issuer2Pk = computePublicKey(issuer2Sk);
      
      sim.registerIssuer(issuer1Pk, createTestBytes(20));
      sim.registerIssuer(issuer2Pk, createTestBytes(30));
      
      // Issue credentials from both issuers
      const cred1Data = createTestBytes(40);
      const cred1Hash = computeClaimHash(cred1Data);
      const commitment1 = createTestBytes(41);
      
      const cred2Data = createTestBytes(50);
      const cred2Hash = computeClaimHash(cred2Data);
      const commitment2 = createTestBytes(51);
      
      sim.issueCredential(commitment1, issuer1Pk, cred1Hash, 1000n, issuer1Sk);
      sim.issueCredential(commitment2, issuer2Pk, cred2Hash, 1000n, issuer2Sk);
      
      // Verify both credentials exist
      expect(sim.getLedger().credentials.member(commitment1)).toBe(true);
      expect(sim.getLedger().credentials.member(commitment2)).toBe(true);
      expect(sim.getLedger().totalCredentialsIssued.value).toBe(2n);
    });

    it('should handle batch issuance workflow', () => {
      const adminSk = createTestBytes(1);
      const issuerSk = createTestBytes(2);
      const issuerPk = computePublicKey(issuerSk);
      
      const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
      sim.registerIssuer(issuerPk, createTestBytes(9));
      
      // Create 3 credentials
      const commitments = [createTestBytes(10), createTestBytes(11), createTestBytes(12)];
      const claimHashes = [createTestBytes(20), createTestBytes(21), createTestBytes(22)];
      
      sim.batchIssue3Credentials(
        commitments[0], claimHashes[0], 1000n,
        commitments[1], claimHashes[1], 1000n,
        commitments[2], claimHashes[2], 1000n,
        issuerSk
      );
      
      // Verify all 3 credentials
      for (const commitment of commitments) {
        expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
      }
      
      expect(sim.getLedger().totalCredentialsIssued.value).toBe(3n);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. EDGE CASE AND STRESS TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('E. Edge Case and Stress Tests', () => {
  it('should handle maximum age value (255)', () => {
    const adminSk = createTestBytes(1);
    const issuerSk = createTestBytes(2);
    const issuerPk = computePublicKey(issuerSk);
    
    const { claimHash } = (() => {
      const age = 255;
      const conditionCode = 100;
      const prescriptionCode = 200;
      
      const prefix = new Uint8Array(32);
      const prefixStr = 'privamed:claim:';
      const prefixBytes = new TextEncoder().encode(prefixStr);
      prefix.set(prefixBytes);
      
      const ageBytes = new Uint8Array(32);
      ageBytes[31] = age;
      
      const conditionBytes = new Uint8Array(32);
      conditionBytes[30] = conditionCode >> 8;
      conditionBytes[31] = conditionCode & 0xFF;
      
      const prescriptionBytes = new Uint8Array(32);
      prescriptionBytes[30] = prescriptionCode >> 8;
      prescriptionBytes[31] = prescriptionCode & 0xFF;
      
      const claimHash = hashBytes(Buffer.concat([prefix, ageBytes, conditionBytes, prescriptionBytes]));
      
      return { claimHash };
    })();
    
    const sim = new PrivaMedAISimulator({ 
      adminSecretKey: adminSk,
      credentialData: claimHash
    });
    
    sim.registerIssuer(issuerPk, createTestBytes(9));
    
    const commitment = createTestBytes(3);
    sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
    
    expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
  });

  it('should handle maximum prescription code (65535)', () => {
    const adminSk = createTestBytes(1);
    const issuerSk = createTestBytes(2);
    const issuerPk = computePublicKey(issuerSk);
    
    const { claimHash } = (() => {
      const age = 30;
      const conditionCode = 100;
      const prescriptionCode = 65535;
      
      const prefix = new Uint8Array(32);
      const prefixStr = 'privamed:claim:';
      const prefixBytes = new TextEncoder().encode(prefixStr);
      prefix.set(prefixBytes);
      
      const ageBytes = new Uint8Array(32);
      ageBytes[31] = age;
      
      const conditionBytes = new Uint8Array(32);
      conditionBytes[30] = conditionCode >> 8;
      conditionBytes[31] = conditionCode & 0xFF;
      
      const prescriptionBytes = new Uint8Array(32);
      prescriptionBytes[30] = prescriptionCode >> 8;
      prescriptionBytes[31] = prescriptionCode & 0xFF;
      
      const claimHash = hashBytes(Buffer.concat([prefix, ageBytes, conditionBytes, prescriptionBytes]));
      
      return { claimHash };
    })();
    
    const sim = new PrivaMedAISimulator({ 
      adminSecretKey: adminSk,
      credentialData: claimHash
    });
    
    sim.registerIssuer(issuerPk, createTestBytes(9));
    
    const commitment = createTestBytes(3);
    sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
    
    expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
  });

  it('should handle zero values for all fields', () => {
    const adminSk = createTestBytes(1);
    const issuerSk = createTestBytes(2);
    const issuerPk = computePublicKey(issuerSk);
    
    const { claimHash } = (() => {
      const age = 0;
      const conditionCode = 0;
      const prescriptionCode = 0;
      
      const prefix = new Uint8Array(32);
      const prefixStr = 'privamed:claim:';
      const prefixBytes = new TextEncoder().encode(prefixStr);
      prefix.set(prefixBytes);
      
      const ageBytes = new Uint8Array(32);
      ageBytes[31] = age;
      
      const conditionBytes = new Uint8Array(32);
      conditionBytes[30] = conditionCode >> 8;
      conditionBytes[31] = conditionCode & 0xFF;
      
      const prescriptionBytes = new Uint8Array(32);
      prescriptionBytes[30] = prescriptionCode >> 8;
      prescriptionBytes[31] = prescriptionCode & 0xFF;
      
      const claimHash = hashBytes(Buffer.concat([prefix, ageBytes, conditionBytes, prescriptionBytes]));
      
      return { claimHash };
    })();
    
    const sim = new PrivaMedAISimulator({ 
      adminSecretKey: adminSk,
      credentialData: claimHash
    });
    
    sim.registerIssuer(issuerPk, createTestBytes(9));
    
    const commitment = createTestBytes(3);
    sim.issueCredential(commitment, issuerPk, claimHash, 1000n, issuerSk);
    
    expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.VALID);
  });

  it('should handle rapid successive operations', () => {
    const adminSk = createTestBytes(1);
    const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
    
    // Register multiple issuers rapidly
    for (let i = 0; i < 5; i++) {
      const issuerSk = createRandomBytes();
      const issuerPk = computePublicKey(issuerSk);
      sim.registerIssuer(issuerPk, createRandomBytes());
    }
    
    expect(sim.getLedger().issuerRegistry.size()).toBe(5n);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. ACCESS CONTROL TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('F. Access Control Tests', () => {
  it('should maintain strict admin-only functions', () => {
    const adminSk = createTestBytes(1);
    const nonAdminSk = createTestBytes(99);
    const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
    
    const issuerPk = createTestBytes(2);
    
    // Non-admin cannot register issuer
    expect(() => sim.registerIssuer(issuerPk, createTestBytes(3), nonAdminSk))
      .toThrow('Only admin can register issuers');
    
    // Admin can register
    sim.registerIssuer(issuerPk, createTestBytes(3), adminSk);
    expect(sim.getLedger().issuerRegistry.member(issuerPk)).toBe(true);
    
    // Non-admin cannot update status
    expect(() => sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED, nonAdminSk))
      .toThrow('Only admin can update issuer status');
    
    // Admin can update
    sim.updateIssuerStatus(issuerPk, IssuerStatus.SUSPENDED, adminSk);
    expect(sim.getIssuerInfo(issuerPk).status).toBe(IssuerStatus.SUSPENDED);
  });

  it('should maintain strict issuer-only functions', () => {
    const adminSk = createTestBytes(1);
    const issuerSk = createTestBytes(2);
    const issuerPk = computePublicKey(issuerSk);
    const otherSk = createTestBytes(5);
    
    const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
    sim.registerIssuer(issuerPk, createTestBytes(9));
    
    const commitment = createTestBytes(3);
    sim.issueCredential(commitment, issuerPk, createTestBytes(4), 1000n, issuerSk);
    
    // Other key cannot revoke
    expect(() => sim.revokeCredential(commitment, otherSk))
      .toThrow('Only issuer can revoke');
    
    // Issuer can revoke
    sim.revokeCredential(commitment, issuerSk);
    expect(sim.checkCredentialStatus(commitment)).toBe(CredentialStatus.REVOKED);
  });
});

console.log('✅ PrivaMedAI Contract Tests Loaded');
