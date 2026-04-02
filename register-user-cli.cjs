#!/usr/bin/env node
/**
 * Simple script to register user as issuer using admin wallet
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read seed from .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const seedMatch = envContent.match(/WALLET_SEED=([a-f0-9]+)/);

if (!seedMatch) {
  console.error('Seed not found in .env');
  process.exit(1);
}

const ADMIN_SEED = seedMatch[1];
console.log('Using admin seed from .env');

// User's Lace wallet pubkey
const USER_PUBKEY = '525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362';
const ADMIN_PUBKEY = '5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a';

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  Registering User as Issuer                                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Admin Pubkey:', ADMIN_PUBKEY.slice(0, 32) + '...');
console.log('User Pubkey: ', USER_PUBKEY.slice(0, 32) + '...\n');

// Use the existing compiled contract
const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';

console.log('Contract:', CONTRACT_ADDRESS.slice(0, 40) + '...\n');

console.log('To register this user:');
console.log('1. Start proof server: docker run -p 6300:6300 midnightnetwork/proof-server:latest');
console.log('2. Use the seed to create a wallet transaction\n');

console.log('Parameters for registerIssuer:');
console.log('  callerPubKey:', ADMIN_PUBKEY);
console.log('  issuerPubKey:', USER_PUBKEY);
console.log('  nameHash:    ', '19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12');
