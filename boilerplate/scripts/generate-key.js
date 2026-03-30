#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { generateRandomSeed, HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import nacl from 'tweetnacl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WalletKeyGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..', '..');
    this.envPath = path.join(this.projectRoot, '.env');
  }

  generateRandomSeedLocal() {
    const bytes = new Uint8Array(32);
    webcrypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  createPreprodAddress(seedHex) {
    const seed = Buffer.from(seedHex, 'hex');
    const wallet = HDWallet.fromSeed(seed);
    if (wallet.type !== 'seedOk') {
      throw new Error('Failed to generate HD wallet from seed');
    }

    const dustResult = wallet.hdWallet.selectAccount(0).selectRole(Roles.Dust).deriveKeyAt(0);
    if (dustResult.type !== 'keyDerived') {
      throw new Error('Failed to derive dust key');
    }

    const dustKeypair = nacl.sign.keyPair.fromSeed(dustResult.key);
    const unshieldedAddr = new UnshieldedAddress(dustKeypair.publicKey);
    const bech32 = UnshieldedAddress.codec.encode('preprod', unshieldedAddr);
    return bech32.asString();
  }

  updateEnvFile(seed, address = null) {
    let envContent = `# Midnight Preprod Configuration
# This seed phrase will be used for automated deployment
WALLET_SEED=${seed}`;
    if (address) {
      envContent += `\nWALLET_ADDRESS=${address}`;
    }
    fs.writeFileSync(this.envPath, envContent);
  }

  async generate() {
    try {
      console.log('🌙 Midnight Preprod Wallet Key Generator\n');

      const seed = this.generateRandomSeedLocal();
      console.log('🔐 Generated new wallet seed:');
      console.log(`💰 Seed: ${seed}\n`);

      const address = this.createPreprodAddress(seed);
      console.log('🏠 Generated preprod wallet address:');
      console.log(`📍 Address: ${address}\n`);

      this.updateEnvFile(seed, address);

      console.log('🚀 Setup completed!');
      console.log('\n💡 The seed phrase and address are now saved in your .env file');
      console.log('🚰 Request tNight from the Midnight preprod faucet using the address above.');

    } catch (error) {
      console.error('\n❌ Key generation failed:', error.message);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
🌙 Midnight Preprod Wallet Key Generator

Usage:
  npm run wallet              Generate new preprod wallet seed/address and update .env
  npm run wallet -- --help    Show this help message

What this does:
  1. Generates a cryptographically secure 64-character hex seed
  2. Derives a preprod shielded address (mn_shield-addr_preprod1...)
  3. Automatically updates your .env file with WALLET_SEED and WALLET_ADDRESS

After running this command:
  - Your .env file will contain WALLET_SEED and WALLET_ADDRESS
  - Paste the address into the Midnight preprod faucet to receive tNight
`);
  }
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  const generator = new WalletKeyGenerator();
  generator.showHelp();
  process.exit(0);
}

const generator = new WalletKeyGenerator();
generator.generate().catch(console.error);
