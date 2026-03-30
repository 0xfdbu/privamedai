import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum CredentialStatus { VALID = 0, REVOKED = 1 }

export type Credential = { issuer: Uint8Array;
                           claimHash: Uint8Array;
                           expiry: bigint;
                           status: CredentialStatus
                         };

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_credential_data(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuer_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuer_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  issuer_0: Uint8Array,
                  claimHash_0: Uint8Array,
                  expiry_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  credentials: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Credential;
    [Symbol.iterator](): Iterator<[Uint8Array, Credential]>
  };
  readonly roundCounter: bigint;
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
