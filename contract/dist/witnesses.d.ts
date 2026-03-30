import { WitnessContext } from '@midnight-ntwrk/compact-runtime';
declare const Ledger: any;
export type PrivaCredPrivateState = {
    readonly secretKey: Uint8Array;
    readonly credentialData: Uint8Array;
};
export declare const createPrivaCredPrivateState: (secretKey: Uint8Array, credentialData?: Uint8Array) => {
    secretKey: Uint8Array<ArrayBufferLike>;
    credentialData: Uint8Array<ArrayBufferLike>;
};
export declare const witnesses: {
    local_secret_key: ({ privateState, }: WitnessContext<typeof Ledger, PrivaCredPrivateState>) => [PrivaCredPrivateState, Uint8Array];
    get_credential_data: ({ privateState, }: WitnessContext<typeof Ledger, PrivaCredPrivateState>) => [PrivaCredPrivateState, Uint8Array];
};
export {};
