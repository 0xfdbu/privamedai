import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const managedPath = path.join(__dirname, 'managed');
const [folder] = fs.readdirSync(managedPath).filter(f => fs.statSync(path.join(managedPath, f)).isDirectory());
const { Ledger } = await import(`./managed/${folder}/contract/index.cjs`);
export const createPrivaCredPrivateState = (secretKey, credentialData = new Uint8Array()) => ({
    secretKey,
    credentialData,
});
export const witnesses = {
    local_secret_key: ({ privateState, }) => {
        return [privateState, privateState.secretKey];
    },
    get_credential_data: ({ privateState, }) => {
        return [privateState, privateState.credentialData];
    },
};
//# sourceMappingURL=witnesses.js.map