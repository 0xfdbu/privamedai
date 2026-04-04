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

export type HealthClaim = { age: bigint;
                            conditionCode: bigint;
                            prescriptionCode: bigint
                          };

export type Witnesses<PS> = {
  get_private_health_claim(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, HealthClaim];
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             initialAdmin_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 callerPubKey_0: Uint8Array,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     callerPubKey_0: Uint8Array,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  callerPubKey_0: Uint8Array,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyForFreeHealthClinic(context: __compactRuntime.CircuitContext<PS>,
                            commitment_0: Uint8Array,
                            minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForPharmacy(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    requiredPrescription_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForHospital(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    minAge_0: bigint,
                    requiredCondition_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   callerPubKey_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        callerPubKey_0: Uint8Array,
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
                 callerPubKey_0: Uint8Array,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     callerPubKey_0: Uint8Array,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  callerPubKey_0: Uint8Array,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyForFreeHealthClinic(context: __compactRuntime.CircuitContext<PS>,
                            commitment_0: Uint8Array,
                            minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForPharmacy(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    requiredPrescription_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForHospital(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    minAge_0: bigint,
                    requiredCondition_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   callerPubKey_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        callerPubKey_0: Uint8Array,
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
                 callerPubKey_0: Uint8Array,
                 issuerPubKey_0: Uint8Array,
                 nameHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuerStatus(context: __compactRuntime.CircuitContext<PS>,
                     callerPubKey_0: Uint8Array,
                     issuerPubKey_0: Uint8Array,
                     newStatus_0: IssuerStatus): __compactRuntime.CircuitResults<PS, []>;
  getIssuerInfo(context: __compactRuntime.CircuitContext<PS>,
                issuerPubKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Issuer>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  callerPubKey_0: Uint8Array,
                  commitment_0: Uint8Array,
                  issuerPubKey_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyForFreeHealthClinic(context: __compactRuntime.CircuitContext<PS>,
                            commitment_0: Uint8Array,
                            minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForPharmacy(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    requiredPrescription_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  verifyForHospital(context: __compactRuntime.CircuitContext<PS>,
                    commitment_0: Uint8Array,
                    minAge_0: bigint,
                    requiredCondition_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   callerPubKey_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  adminRevokeCredential(context: __compactRuntime.CircuitContext<PS>,
                        callerPubKey_0: Uint8Array,
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
