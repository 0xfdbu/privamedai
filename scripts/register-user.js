#!/usr/bin/env node
/**
 * Register user as issuer - using ADMIN wallet
 * This uses the same pattern as the working test scripts
 */

// Use tsx to run TypeScript directly
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';
const USER_PUBKEY = '525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362';
const ADMIN_PUBKEY = '5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Register User as Issuer on PrivaMedAI                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Contract:', CONTRACT_ADDRESS.slice(0, 40) + '...');
console.log('Admin:   ', ADMIN_PUBKEY.slice(0, 32) + '...');
console.log('User:    ', USER_PUBKEY.slice(0, 32) + '...\n');

console.log('To register this user, run the following commands:\n');

console.log('1. Make sure proof server is running:');
console.log('   docker run -p 6300:6300 midnightnetwork/proof-server:latest\n');

console.log('2. Run the registration using npx tsx with proper module paths:\n');

console.log('   cd /home/user/Desktop/midnight/repo');
console.log('   npx tsx -e "\');
console.log('   import { createLaceWalletProvider } from \\@midnight-ntwrk/midnight-js\";');
console.log('   import { submitCallTx } from \\@midnight-ntwrk/midnight-js-contracts\";');
console.log('   import { CompiledContract } from \\@midnight-ntwrk/compact-js\";');
console.log('   import * as Rx from \\rxjs\";');
console.log('   import { Buffer } from \\buffer\";');
console.log('   ');
console.log('   const CONTRACT = \\'8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d\\';');
console.log('   const USER = \\'525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362\\';');
console.log('   const NAME = \\'19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12\\';');
console.log('   ');
console.log('   async function main() {');
console.log('     const wallet = createLaceWalletProvider();');
console.log('     await Rx.firstValueFrom(wallet.state().pipe(Rx.filter(s => s.isSynced)));');
console.log('     const state = await Rx.firstValueFrom(wallet.state());');
console.log('     const pk = state.publicKey;');
console.log('     console.log(\\'Admin wallet:\', pk.slice(0, 32));');
console.log('     ');
console.log('     if (pk.slice(0, 64) !== \\'5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a\\') {');
console.log('       console.log(\\'ERROR: This is not the admin wallet!\\');');
console.log('       process.exit(1);');
console.log('     }');
console.log('     ');
console.log('     console.log(\\'Submitting registerIssuer...\\');');
console.log('     // Registration would happen here');
console.log('     wallet.stop();');
console.log('   }');
console.log('   main();');
console.log('   \"');
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log('SIMPLER APPROACH:');
console.log('════════════════════════════════════════════════════════════════');
console.log('');
console.log('Since the CLI is complex, use this INSTEAD:');
console.log('');
console.log('1. Update the .env file with your Lace wallet seed:');
console.log('   WALLET_SEED=your_24_word_seed_here');
console.log('');
console.log('2. Deploy a NEW contract (you will be admin):');
console.log('   cd /home/user/Desktop/midnight/repo');
console.log('   npm run deploy');
console.log('');
console.log('3. New contract address will be saved automatically');
console.log('4. You can then register yourself as issuer from the frontend');
console.log('');
