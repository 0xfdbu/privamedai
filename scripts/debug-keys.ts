import { Buffer } from 'buffer';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as fs from 'fs';

const seed = fs.readFileSync('.env', 'utf-8').match(/^WALLET_SEED=(.+)$/m)![1].trim();

console.log('Seed:', seed.slice(0, 16) + '...');
console.log('Seed length:', seed.length, 'chars');

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
if (result.type !== 'keysDerived') throw new Error('Key derivation failed');

const zswapKey = result.keys[Roles.Zswap];
const nightKey = result.keys[Roles.NightExternal];

console.log('\n=== Derived Keys ===');
console.log('Zswap key hex:', zswapKey.toString('hex'));
console.log('Zswap key length:', zswapKey.length, 'bytes');
console.log('Night key hex:', nightKey.toString('hex').slice(0, 64));
console.log('Night key length:', nightKey.length, 'bytes');

// The wallet address comes from nightKey
console.log('\n=== Wallet Info ===');
console.log('Seed (hex):', Buffer.from(seed, 'hex').toString('hex'));
console.log('First 32 bytes of seed:', Buffer.from(seed, 'hex').slice(0, 32).toString('hex'));

hdWallet.hdWallet.clear();
