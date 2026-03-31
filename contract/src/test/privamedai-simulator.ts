import {
  CredentialStatus,
  IssuerStatus,
  Credential,
  Issuer,
} from '../managed/PrivaMedAI/contract/index.js';
import { WitnessValue } from '../managed/PrivaMedAI/witnesses.js';

// Simple hash function for simulation
export function computePublicKey(secretKey: Uint8Array): Uint8Array {
  // Simplified: just hash with a prefix
  const prefix = new TextEncoder().encode('privamed:pk:');
  const combined = new Uint8Array(prefix.length + secretKey.length);
  combined.set(prefix);
  combined.set(secretKey, prefix.length);
  return hashBytes(combined);
}

export function computeClaimHash(data: Uint8Array): Uint8Array {
  return hashBytes(data);
}

function hashBytes(data: Uint8Array): Uint8Array {
  // Simple hash for simulation - in production use proper crypto
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let sum = 0;
    for (let j = 0; j < data.length; j++) {
      sum += data[j] * (i + 1) * (j + 1);
    }
    result[i] = sum % 256;
  }
  return result;
}

// Map implementation for simulation
class SimulatedMap<K, V> {
  private data = new Map<string, V>();

  private keyToString(key: K): string {
    if (key instanceof Uint8Array) {
      return Buffer.from(key).toString('hex');
    }
    return String(key);
  }

  insert(key: K, value: V): void {
    this.data.set(this.keyToString(key), value);
  }

  lookup(key: K): V {
    const str = this.keyToString(key);
    if (!this.data.has(str)) {
      throw new Error('Key not found');
    }
    return this.data.get(str)!;
  }

  member(key: K): boolean {
    return this.data.has(this.keyToString(key));
  }

  size(): bigint {
    return BigInt(this.data.size);
  }

  isEmpty(): boolean {
    return this.data.size === 0;
  }
}

class SimulatedCounter {
  value = 0n;

  increment(amount: bigint): void {
    this.value += amount;
  }
}

interface LedgerState {
  credentials: SimulatedMap<Uint8Array, Credential>;
  issuerRegistry: SimulatedMap<Uint8Array, Issuer>;
  admin: SimulatedMap<Uint8Array, Uint8Array>;
  roundCounter: SimulatedCounter;
  totalCredentialsIssued: SimulatedCounter;
  totalVerificationsPerformed: SimulatedCounter;
}

interface SimulatorOptions {
  adminSecretKey?: Uint8Array;
  credentialData?: Uint8Array;
  bundledCredentialData?: Uint8Array[];
}

export class PrivaMedAISimulator {
  private ledger: LedgerState;
  private adminSecretKey: Uint8Array;
  private credentialData: Uint8Array;
  private bundledCredentialData: Uint8Array[];

  constructor(options: SimulatorOptions = {}) {
    this.ledger = {
      credentials: new SimulatedMap<Uint8Array, Credential>(),
      issuerRegistry: new SimulatedMap<Uint8Array, Issuer>(),
      admin: new SimulatedMap<Uint8Array, Uint8Array>(),
      roundCounter: new SimulatedCounter(),
      totalCredentialsIssued: new SimulatedCounter(),
      totalVerificationsPerformed: new SimulatedCounter(),
    };
    
    this.adminSecretKey = options.adminSecretKey || new Uint8Array(32);
    this.credentialData = options.credentialData || new Uint8Array(32);
    this.bundledCredentialData = options.bundledCredentialData || [];
    
    // Initialize admin
    if (options.adminSecretKey) {
      this.initialize(computePublicKey(options.adminSecretKey));
    }
  }

  getLedger(): LedgerState {
    return this.ledger;
  }

  // Witness functions
  private localSecretKey(): Uint8Array {
    return this.adminSecretKey;
  }

  private getCredentialData(): Uint8Array {
    return this.credentialData;
  }

  private getBundledCredentialData(index: number): Uint8Array {
    if (index >= this.bundledCredentialData.length) {
      return new Uint8Array(32);
    }
    return this.bundledCredentialData[index];
  }

  // Admin functions
  initialize(initialAdmin: Uint8Array): void {
    this.ledger.admin.insert(new Uint8Array([97]), initialAdmin); // 'a' = 97
    this.ledger.roundCounter.increment(1n);
  }

  getAdmin(): Uint8Array {
    return this.ledger.admin.lookup(new Uint8Array([97]));
  }

  // Issuer Registry functions
  registerIssuer(
    issuerPubKey: Uint8Array,
    nameHash: Uint8Array,
    adminSk?: Uint8Array
  ): void {
    const sk = adminSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    const adminKey = this.getAdmin();
    
    if (!buffersEqual(caller, adminKey)) {
      throw new Error('Only admin can register issuers');
    }
    
    if (this.ledger.issuerRegistry.member(issuerPubKey)) {
      throw new Error('Issuer already registered');
    }
    
    const newIssuer: Issuer = {
      publicKey: issuerPubKey,
      status: IssuerStatus.ACTIVE,
      nameHash: nameHash,
      credentialCount: 0n,
    };
    
    this.ledger.issuerRegistry.insert(issuerPubKey, newIssuer);
    this.ledger.roundCounter.increment(1n);
  }

  updateIssuerStatus(
    issuerPubKey: Uint8Array,
    newStatus: IssuerStatus,
    adminSk?: Uint8Array
  ): void {
    const sk = adminSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    const adminKey = this.getAdmin();
    
    if (!buffersEqual(caller, adminKey)) {
      throw new Error('Only admin can update issuer status');
    }
    
    if (!this.ledger.issuerRegistry.member(issuerPubKey)) {
      throw new Error('Issuer not found');
    }
    
    const issuer = this.ledger.issuerRegistry.lookup(issuerPubKey);
    const updatedIssuer: Issuer = {
      publicKey: issuer.publicKey,
      status: newStatus,
      nameHash: issuer.nameHash,
      credentialCount: issuer.credentialCount,
    };
    
    this.ledger.issuerRegistry.insert(issuerPubKey, updatedIssuer);
    this.ledger.roundCounter.increment(1n);
  }

  getIssuerInfo(issuerPubKey: Uint8Array): Issuer {
    if (!this.ledger.issuerRegistry.member(issuerPubKey)) {
      throw new Error('Issuer not found');
    }
    return this.ledger.issuerRegistry.lookup(issuerPubKey);
  }

  // Credential lifecycle functions
  issueCredential(
    commitment: Uint8Array,
    issuerPubKey: Uint8Array,
    claimHash: Uint8Array,
    expiry: bigint,
    issuerSk?: Uint8Array
  ): void {
    const sk = issuerSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    
    if (this.ledger.credentials.member(commitment)) {
      throw new Error('Credential already exists');
    }
    
    if (!this.ledger.issuerRegistry.member(issuerPubKey)) {
      throw new Error('Issuer not registered');
    }
    
    const issuer = this.ledger.issuerRegistry.lookup(issuerPubKey);
    if (issuer.status !== IssuerStatus.ACTIVE) {
      throw new Error('Issuer not active');
    }
    
    if (!buffersEqual(caller, issuerPubKey)) {
      throw new Error('Only registered issuer can issue');
    }
    
    const credential: Credential = {
      issuer: issuerPubKey,
      claimHash: claimHash,
      expiry: expiry,
      status: CredentialStatus.VALID,
    };
    
    this.ledger.credentials.insert(commitment, credential);
    
    const updatedIssuer: Issuer = {
      publicKey: issuer.publicKey,
      status: issuer.status,
      nameHash: issuer.nameHash,
      credentialCount: issuer.credentialCount,
    };
    this.ledger.issuerRegistry.insert(issuerPubKey, updatedIssuer);
    
    this.ledger.totalCredentialsIssued.increment(1n);
    this.ledger.roundCounter.increment(1n);
  }

  batchIssue3Credentials(
    commitment1: Uint8Array,
    claimHash1: Uint8Array,
    expiry1: bigint,
    commitment2: Uint8Array,
    claimHash2: Uint8Array,
    expiry2: bigint,
    commitment3: Uint8Array,
    claimHash3: Uint8Array,
    expiry3: bigint,
    issuerSk?: Uint8Array
  ): void {
    const sk = issuerSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    
    if (!this.ledger.issuerRegistry.member(caller)) {
      throw new Error('Issuer not registered');
    }
    
    const issuer = this.ledger.issuerRegistry.lookup(caller);
    if (issuer.status !== IssuerStatus.ACTIVE) {
      throw new Error('Issuer not active');
    }
    
    // Issue credential 1
    if (this.ledger.credentials.member(commitment1)) {
      throw new Error('Credential 1 exists');
    }
    const credential1: Credential = {
      issuer: caller,
      claimHash: claimHash1,
      expiry: expiry1,
      status: CredentialStatus.VALID,
    };
    this.ledger.credentials.insert(commitment1, credential1);
    this.ledger.totalCredentialsIssued.increment(1n);
    
    // Issue credential 2
    if (this.ledger.credentials.member(commitment2)) {
      throw new Error('Credential 2 exists');
    }
    const credential2: Credential = {
      issuer: caller,
      claimHash: claimHash2,
      expiry: expiry2,
      status: CredentialStatus.VALID,
    };
    this.ledger.credentials.insert(commitment2, credential2);
    this.ledger.totalCredentialsIssued.increment(1n);
    
    // Issue credential 3
    if (this.ledger.credentials.member(commitment3)) {
      throw new Error('Credential 3 exists');
    }
    const credential3: Credential = {
      issuer: caller,
      claimHash: claimHash3,
      expiry: expiry3,
      status: CredentialStatus.VALID,
    };
    this.ledger.credentials.insert(commitment3, credential3);
    this.ledger.totalCredentialsIssued.increment(1n);
    
    // Update issuer stats
    const updatedIssuer: Issuer = {
      publicKey: issuer.publicKey,
      status: issuer.status,
      nameHash: issuer.nameHash,
      credentialCount: issuer.credentialCount,
    };
    this.ledger.issuerRegistry.insert(caller, updatedIssuer);
    
    this.ledger.roundCounter.increment(1n);
  }

  // Verification functions
  verifyCredential(commitment: Uint8Array): boolean {
    if (!this.ledger.credentials.member(commitment)) {
      throw new Error('Credential not found');
    }
    
    const credential = this.ledger.credentials.lookup(commitment);
    
    if (credential.status !== CredentialStatus.VALID) {
      throw new Error('Credential revoked');
    }
    
    if (!this.ledger.issuerRegistry.member(credential.issuer)) {
      throw new Error('Issuer not found');
    }
    
    const issuer = this.ledger.issuerRegistry.lookup(credential.issuer);
    if (issuer.status !== IssuerStatus.ACTIVE) {
      throw new Error('Issuer not active');
    }
    
    const privateData = this.getCredentialData();
    const computedHash = computeClaimHash(privateData);
    
    if (!buffersEqual(computedHash, credential.claimHash)) {
      throw new Error('Hash mismatch');
    }
    
    this.ledger.totalVerificationsPerformed.increment(1n);
    return true;
  }

  bundledVerify2Credentials(commitment1: Uint8Array, commitment2: Uint8Array): boolean {
    // Verify credential 1
    if (!this.ledger.credentials.member(commitment1)) {
      throw new Error('Credential 1 not found');
    }
    const cred1 = this.ledger.credentials.lookup(commitment1);
    if (cred1.status !== CredentialStatus.VALID) {
      throw new Error('Credential 1 revoked');
    }
    if (!this.ledger.issuerRegistry.member(cred1.issuer)) {
      throw new Error('Credential 1 issuer not found');
    }
    const issuer1 = this.ledger.issuerRegistry.lookup(cred1.issuer);
    if (issuer1.status !== IssuerStatus.ACTIVE) {
      throw new Error('Credential 1 issuer not active');
    }
    const privateData1 = this.getBundledCredentialData(0);
    const computedHash1 = computeClaimHash(privateData1);
    if (!buffersEqual(computedHash1, cred1.claimHash)) {
      throw new Error('Credential 1 hash mismatch');
    }
    
    // Verify credential 2
    if (!this.ledger.credentials.member(commitment2)) {
      throw new Error('Credential 2 not found');
    }
    const cred2 = this.ledger.credentials.lookup(commitment2);
    if (cred2.status !== CredentialStatus.VALID) {
      throw new Error('Credential 2 revoked');
    }
    if (!this.ledger.issuerRegistry.member(cred2.issuer)) {
      throw new Error('Credential 2 issuer not found');
    }
    const issuer2 = this.ledger.issuerRegistry.lookup(cred2.issuer);
    if (issuer2.status !== IssuerStatus.ACTIVE) {
      throw new Error('Credential 2 issuer not active');
    }
    const privateData2 = this.getBundledCredentialData(1);
    const computedHash2 = computeClaimHash(privateData2);
    if (!buffersEqual(computedHash2, cred2.claimHash)) {
      throw new Error('Credential 2 hash mismatch');
    }
    
    this.ledger.totalVerificationsPerformed.increment(1n);
    return true;
  }

  bundledVerify3Credentials(
    commitment1: Uint8Array,
    commitment2: Uint8Array,
    commitment3: Uint8Array
  ): boolean {
    // Verify credential 1
    if (!this.ledger.credentials.member(commitment1)) {
      throw new Error('Credential 1 not found');
    }
    const cred1 = this.ledger.credentials.lookup(commitment1);
    if (cred1.status !== CredentialStatus.VALID) {
      throw new Error('Credential 1 revoked');
    }
    if (!this.ledger.issuerRegistry.member(cred1.issuer)) {
      throw new Error('Credential 1 issuer not found');
    }
    const issuer1 = this.ledger.issuerRegistry.lookup(cred1.issuer);
    if (issuer1.status !== IssuerStatus.ACTIVE) {
      throw new Error('Credential 1 issuer not active');
    }
    const privateData1 = this.getBundledCredentialData(0);
    const computedHash1 = computeClaimHash(privateData1);
    if (!buffersEqual(computedHash1, cred1.claimHash)) {
      throw new Error('Credential 1 hash mismatch');
    }
    
    // Verify credential 2
    if (!this.ledger.credentials.member(commitment2)) {
      throw new Error('Credential 2 not found');
    }
    const cred2 = this.ledger.credentials.lookup(commitment2);
    if (cred2.status !== CredentialStatus.VALID) {
      throw new Error('Credential 2 revoked');
    }
    if (!this.ledger.issuerRegistry.member(cred2.issuer)) {
      throw new Error('Credential 2 issuer not found');
    }
    const issuer2 = this.ledger.issuerRegistry.lookup(cred2.issuer);
    if (issuer2.status !== IssuerStatus.ACTIVE) {
      throw new Error('Credential 2 issuer not active');
    }
    const privateData2 = this.getBundledCredentialData(1);
    const computedHash2 = computeClaimHash(privateData2);
    if (!buffersEqual(computedHash2, cred2.claimHash)) {
      throw new Error('Credential 2 hash mismatch');
    }
    
    // Verify credential 3
    if (!this.ledger.credentials.member(commitment3)) {
      throw new Error('Credential 3 not found');
    }
    const cred3 = this.ledger.credentials.lookup(commitment3);
    if (cred3.status !== CredentialStatus.VALID) {
      throw new Error('Credential 3 revoked');
    }
    if (!this.ledger.issuerRegistry.member(cred3.issuer)) {
      throw new Error('Credential 3 issuer not found');
    }
    const issuer3 = this.ledger.issuerRegistry.lookup(cred3.issuer);
    if (issuer3.status !== IssuerStatus.ACTIVE) {
      throw new Error('Credential 3 issuer not active');
    }
    const privateData3 = this.getBundledCredentialData(2);
    const computedHash3 = computeClaimHash(privateData3);
    if (!buffersEqual(computedHash3, cred3.claimHash)) {
      throw new Error('Credential 3 hash mismatch');
    }
    
    this.ledger.totalVerificationsPerformed.increment(1n);
    return true;
  }

  // Revocation functions
  revokeCredential(commitment: Uint8Array, issuerSk?: Uint8Array): void {
    const sk = issuerSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    
    if (!this.ledger.credentials.member(commitment)) {
      throw new Error('Credential not found');
    }
    
    const credential = this.ledger.credentials.lookup(commitment);
    
    if (!buffersEqual(caller, credential.issuer)) {
      throw new Error('Only issuer can revoke');
    }
    
    if (credential.status !== CredentialStatus.VALID) {
      throw new Error('Already revoked');
    }
    
    const revokedCredential: Credential = {
      issuer: credential.issuer,
      claimHash: credential.claimHash,
      expiry: credential.expiry,
      status: CredentialStatus.REVOKED,
    };
    
    this.ledger.credentials.insert(commitment, revokedCredential);
    this.ledger.roundCounter.increment(1n);
  }

  adminRevokeCredential(
    commitment: Uint8Array,
    reasonHash: Uint8Array,
    adminSk?: Uint8Array
  ): void {
    const sk = adminSk || this.localSecretKey();
    const caller = computePublicKey(sk);
    const adminKey = this.getAdmin();
    
    if (!buffersEqual(caller, adminKey)) {
      throw new Error('Only admin can emergency revoke');
    }
    
    if (!this.ledger.credentials.member(commitment)) {
      throw new Error('Credential not found');
    }
    
    const credential = this.ledger.credentials.lookup(commitment);
    
    const revokedCredential: Credential = {
      issuer: credential.issuer,
      claimHash: credential.claimHash,
      expiry: credential.expiry,
      status: CredentialStatus.REVOKED,
    };
    
    this.ledger.credentials.insert(commitment, revokedCredential);
    this.ledger.roundCounter.increment(1n);
  }

  // Query functions
  checkCredentialStatus(commitment: Uint8Array): CredentialStatus {
    if (!this.ledger.credentials.member(commitment)) {
      throw new Error('Credential not found');
    }
    
    const credential = this.ledger.credentials.lookup(commitment);
    return credential.status;
  }
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
