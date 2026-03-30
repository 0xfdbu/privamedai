import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WitnessContext } from '@midnight-ntwrk/compact-runtime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const managedPath = path.join(__dirname, 'managed');
const [folder] = fs.readdirSync(managedPath).filter(f =>
  fs.statSync(path.join(managedPath, f)).isDirectory()
);

const { Ledger } = await import(`./managed/${folder}/contract/index.cjs`);

export type PrivaCredPrivateState = {
  readonly secretKey: Uint8Array;
  readonly credentialData: Uint8Array;
};

export const createPrivaCredPrivateState = (
  secretKey: Uint8Array,
  credentialData: Uint8Array = new Uint8Array()
) => ({
  secretKey,
  credentialData,
});

export const witnesses = {
  local_secret_key: ({
    privateState,
  }: WitnessContext<typeof Ledger, PrivaCredPrivateState>): [
    PrivaCredPrivateState,
    Uint8Array,
  ] => {
    return [privateState, privateState.secretKey];
  },
  get_credential_data: ({
    privateState,
  }: WitnessContext<typeof Ledger, PrivaCredPrivateState>): [
    PrivaCredPrivateState,
    Uint8Array,
  ] => {
    return [privateState, privateState.credentialData];
  },
};
