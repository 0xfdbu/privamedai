import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum CredentialStatus { VALID = 0, REVOKED = 1 }

export enum IssuerStatus { PENDING = 0, ACTIVE = 1, SUSPENDED = 2, REVOKED = 3 }

export type Credential = { issuer: Uint8Array;
                           claimHash: Uint8Array;
                           expiry: bigint;
                           status: CredentialStatus
                         };

export type Issuer = { publicKey: Uint8Array;
                       status: IssuerStatus;
                       nameHash: Uint8Array;
                       credentialCount: bigint
                     };

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_credential_data(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_bundled_credential_data(context: __compactRuntime.WitnessContext<Ledger, PS>,
                              index_0: bigint): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             initialAdmin_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  batchIssue3Credentials(context: __compactRuntime.CircuitContext<PS>,
                         commitment1_0: Uint8Array,
                         claimHash1_0: Uint8Array,
                         expiry1_0: bigint,
                         commitment2_0: Uint8Array,
                         claimHash2_0: Uint8Array,
                         expiry2_0: bigint,
                         commitment3_0: Uint8Array,
                         claimHash3_0: Uint8Array,
                         expiry3_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify3Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array,
                            commitment3_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify2Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array,
                        reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  checkCredentialStatus(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, CredentialStatus>;
}

export type ProvableCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             initialAdmin_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  batchIssue3Credentials(context: __compactRuntime.CircuitContext<PS>,
                         commitment1_0: Uint8Array,
                         claimHash1_0: Uint8Array,
                         expiry1_0: bigint,
                         commitment2_0: Uint8Array,
                         claimHash2_0: Uint8Array,
                         expiry2_0: bigint,
                         commitment3_0: Uint8Array,
                         claimHash3_0: Uint8Array,
                         expiry3_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify3Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array,
                            commitment3_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify2Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array,
                        reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  checkCredentialStatus(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, CredentialStatus>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             initialAdmin_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  batchIssue3Credentials(context: __compactRuntime.CircuitContext<PS>,
                         commitment1_0: Uint8Array,
                         claimHash1_0: Uint8Array,
                         expiry1_0: bigint,
                         commitment2_0: Uint8Array,
                         claimHash2_0: Uint8Array,
                         expiry2_0: bigint,
                         commitment3_0: Uint8Array,
                         claimHash3_0: Uint8Array,
                         expiry3_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify3Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array,
                            commitment3_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  bundledVerify2Credentials(context: __compactRuntime.CircuitContext<PS>,
                            commitment1_0: Uint8Array,
                            commitment2_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array,
                        reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  checkCredentialStatus(context: __compactRuntime.CircuitContext<PS>,
                        commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, CredentialStatus>;
}

export type Ledger = {
  credentials: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Credential;
    [Symbol.iterator](): Iterator<[Uint8Array, Credential]>
  };
  issuerRegistry: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Issuer;
    [Symbol.iterator](): Iterator<[Uint8Array, Issuer]>
  };
  admin: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly roundCounter: bigint;
  readonly totalCredentialsIssued: bigint;
  readonly totalVerificationsPerformed: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
