import { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { Ledger } from './managed/PrivaMedAI/contract/index.js';

export type PrivaMedAIPrivateState = {
  readonly secretKey: Uint8Array;
  readonly credentialData: Uint8Array;
  readonly bundledCredentialData: Uint8Array[];
};

export const createPrivaMedAIPrivateState = (
  secretKey: Uint8Array,
  credentialData: Uint8Array = new Uint8Array(32),
  bundledCredentialData: Uint8Array[] = []
): PrivaMedAIPrivateState => ({
  secretKey,
  credentialData,
  bundledCredentialData,
});

export const witnesses = {
  local_secret_key: ({
    privateState,
  }: WitnessContext<typeof Ledger, PrivaMedAIPrivateState>): [
    PrivaMedAIPrivateState,
    Uint8Array,
  ] => {
    return [privateState, privateState.secretKey];
  },
  
  get_credential_data: ({
    privateState,
  }: WitnessContext<typeof Ledger, PrivaMedAIPrivateState>): [
    PrivaMedAIPrivateState,
    Uint8Array,
  ] => {
    return [privateState, privateState.credentialData];
  },
  
  get_bundled_credential_data: ({
    privateState,
    args,
  }: WitnessContext<typeof Ledger, PrivaMedAIPrivateState> & { args: [number] }): [
    PrivaMedAIPrivateState,
    Uint8Array,
  ] => {
    const index = args[0];
    const data = privateState.bundledCredentialData[index] || new Uint8Array(32);
    return [privateState, data];
  },
};
