#!/usr/bin/env node
/**
 * Simple script to register an issuer using the admin wallet
 * 
 * Usage: npx ts-node src/register-issuer.ts <issuer_pub_key> [name_hash]
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PreprodRemoteConfig } from './config.js';
import * as api from './api.js';
import { createLogger } from './logger-utils.js';
import { createPrivaMedAIPrivateState } from '@midnight-ntwrk/contract';
import * as Rx from 'rxjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Parse arguments
  const issuerPubKey = process.argv[2];
  const nameHash = process.argv[3] || '19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12';
  
  if (!issuerPubKey || issuerPubKey.length !== 64) {
    console.error('Usage: npx ts-node src/register-issuer.ts <issuer_pub_key_64_hex> [name_hash_64_hex]');
    console.error('Example: npx ts-node src/register-issuer.ts 525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362');
    process.exit(1);
  }

  console.log('🔧 PrivaMedAI Issuer Registration');
  console.log('====================================');
  console.log(`Issuer PubKey: ${issuerPubKey}`);
  console.log(`Name Hash: ${nameHash}`);
  console.log('');

  // Setup logging
  const logDir = path.resolve(currentDir, '..', 'logs', 'register-issuer', `${new Date().toISOString()}.log`);
  const logger = await createLogger(logDir);
  api.setLogger(logger);

  // Use preprod network
  const config = new PreprodRemoteConfig();
  
  // Contract address (your deployed contract)
  const contractAddress = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';

  console.log('⏳ Setting up wallet from saved state...');
  
  try {
    // Build wallet from saved state (admin wallet)
    const wallet = await api.buildWalletAndWaitForFunds(
      config,
      '', // Empty seed - will use saved state
      '.wallet-state.json',
    );

    const walletState = await Rx.firstValueFrom(wallet.state());
    console.log(`✅ Wallet loaded: ${walletState.address}`);
    const balance = walletState.balances['MIDNIGHT'] || walletState.balances['tDUST'] || 0n;
    console.log(`💰 Balance: ${balance} tDUST`);
    console.log('');

    // Configure providers
    console.log('⏳ Configuring providers...');
    const providers = await api.configureProviders(wallet, config);
    console.log('✅ Providers configured');
    console.log('');

    // Join the contract
    console.log(`⏳ Connecting to contract at ${contractAddress}...`);
    const contract = await api.joinContract(providers, contractAddress);
    console.log('✅ Connected to contract');
    console.log('');

    // Register the issuer
    console.log('⏳ Registering issuer...');
    
    // Convert hex strings to byte arrays
    const issuerPubKeyBytes = Uint8Array.from(Buffer.from(issuerPubKey, 'hex'));
    const nameHashBytes = Uint8Array.from(Buffer.from(nameHash, 'hex'));
    
    // Call the registerIssuer contract function
    // Note: This assumes the contract has a registerIssuer circuit
    // The actual circuit name may differ - adjust accordingly
    const result = await (contract.callTx as any).registerIssuer(issuerPubKeyBytes, nameHashBytes);
    
    console.log('✅ Issuer registered successfully!');
    console.log(`📋 Transaction ID: ${result.public.txId}`);
    console.log(`📦 Block Height: ${result.public.blockHeight}`);
    console.log('');
    console.log('🎉 The issuer can now issue credentials!');

    // Save wallet state
    await api.saveState(wallet, '.wallet-state.json');
    
    // Shutdown
    await wallet.close();
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Only admin')) {
      console.error('💡 Your wallet is not the contract admin. Only the admin can register issuers.');
    }
    process.exit(1);
  }
}

main();
