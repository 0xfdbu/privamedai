#!/usr/bin/env node
/**
 * Quick script to register wallet as issuer
 * Run: npx tsx register-me.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Same imports as working test
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as PrivaMedAIModule from './contract/dist/managed/PrivaMedAI/contract/index.js';

const DEPLOYMENT = {
  contractAddress: '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d',
  network: 'preprod',
};

const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v3/graphql';
const INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
const PROOF_SERVER_URL = 'http://localhost:6300';

setNetworkId('preprod');

async function main() {
  console.log('📝 Registering you as an issuer...\n');
  
  // Setup wallet
  const wallet = createLaceWalletProvider();
  console.log('⏳ Syncing wallet...');
  
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  const publicKey = (state as any).publicKey;
  
  console.log(`✅ Wallet connected: ${publicKey.slice(0, 32)}...\n`);
  
  // Create compiled contract
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: () => new Uint8Array(32),
    }),
  );

  // Create providers (simplified)
  const walletProvider = {
    getCoinPublicKey: () => publicKey,
    getEncryptionPublicKey: () => publicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await wallet.balanceUnboundTransaction(tx, {}, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => wallet.submitTransaction(tx),
  };

  const zkConfigPath = path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI');
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-register-issuer',
      privateStoragePasswordProvider: async () => 'Register-Issuer-2025!',
      accountId: publicKey,
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER_URL, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // Unique name hash
  const timestamp = Date.now();
  const nameHash = (timestamp.toString(16).slice(0, 12) + 'e5f6789012345678901234567890abcdef1234567890abcdef').slice(0, 64);
  
  console.log('🚀 Submitting registerIssuer...');
  console.log(`   Issuer: ${publicKey.slice(0, 64)}`);
  console.log(`   Name:   ${nameHash.slice(0, 32)}...\n`);
  
  try {
    const result = await submitCallTx(providers, {
      contractAddress: DEPLOYMENT.contractAddress,
      compiledContract,
      circuitId: 'registerIssuer',
      args: [
        Buffer.from(publicKey.slice(0, 64), 'hex'),  // callerPubKey (you as admin)
        Buffer.from(publicKey.slice(0, 64), 'hex'),  // issuerPubKey (you as issuer)
        Buffer.from(nameHash, 'hex'),                // nameHash
      ],
    });
    
    const txId = result?.public?.txId;
    console.log('✅ SUCCESS! You are now a registered issuer!');
    console.log(`🆔 TX Hash: ${txId ? String(txId) : 'submitted'}`);
    console.log('\n🎉 You can now issue credentials from the frontend!');
    
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('already registered')) {
      console.log('ℹ️  You are already registered as an issuer!');
      console.log('   Try issuing credentials now.');
    } else if (msg.includes('Only admin')) {
      console.log('❌ Error: Your wallet is not the admin.');
      console.log('   Only the admin can register issuers.');
    } else {
      console.error('\n❌ Error:', msg);
    }
  }
  
  wallet.stop();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
