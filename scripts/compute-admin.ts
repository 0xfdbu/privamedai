import { Buffer } from 'buffer';
import { createHash } from 'crypto';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as fs from 'fs';

// The contract's get_public_key function does:
// persistentHash<Vector<2, Bytes<32>>>([pad(32, "privamed:pk:"), sk])
// For testing, we can approximate this with SHA-256

const seed = fs.readFileSync('.env', 'utf-8').match(/^WALLET_SEED=(.+)$/m)![1].trim();

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap]).deriveKeysAt(0);
if (result.type !== 'keysDerived') throw new Error('Key derivation failed');

const zswapKey = result.keys[Roles.Zswap];

// Compute the admin key that would be derived from this secret key
// In the contract: persistentHash([pad(32, "privamed:pk:"), sk])
// We approximate with SHA-256 for testing
const prefix = Buffer.alloc(32);
Buffer.from("privamed:pk:").copy(prefix);
const hash = createHash('sha256').update(Buffer.concat([prefix, zswapKey])).digest();

console.log('Secret key (zswapKey):', zswapKey.toString('hex'));
console.log('Derived admin key:', hash.toString('hex'));
console.log('Wallet coin public key:', ''); // We don't have access here

hdWallet.hdWallet.clear();
