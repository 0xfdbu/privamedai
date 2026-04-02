#!/usr/bin/env node
/**
 * Register wallet as issuer on PrivaMedAI contract
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Midnight SDK imports (same as working test)
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as PrivaMedAIModule from '../contract/dist/managed/PrivaMedAI/contract/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROOF_SERVER_URL = 'http://localhost:6300';
const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v3/graphql';
const INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';

const DEPLOYMENT = {
  contractAddress: '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d',
  network: 'preprod',
};

setNetworkId('preprod');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Registering Wallet as Issuer on PrivaMedAI                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📋 Contract: ${DEPLOYMENT.contractAddress.slice(0, 40)}...`);
  
  // Setup wallet
  const wallet = createLaceWalletProvider();
  console.log('⏳ Syncing wallet...');
  
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  const publicKey = (state as any).publicKey;
  const address = (state as any).address;
  
  console.log(`💳 Wallet: ${address}`);
  console.log(`🔑 PubKey: ${publicKey.slice(0, 32)}...\n`);
  
  // Create compiled contract
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: () => new Uint8Array(32),
    }),
  );

  // Create providers
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
      privateStoragePasswordProvider: async () => 'PrivaMedAI-Register-Issuer!',
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
  const nameHash = (timestamp.toString(16).slice(0, 12) + 'issuer' + '0'.repeat(46)).slice(0, 64);
  
  console.log('📝 Registration Details:');
  console.log(`   Issuer PubKey: ${publicKey.slice(0, 64)}`);
  console.log(`   Name Hash: ${nameHash.slice(0, 32)}...\n`);
  
  console.log('🚀 Submitting registerIssuer transaction...');
  console.log('   (This may take 30-60 seconds)\n');
  
  try {
    const result = await submitCallTx(providers, {
      contractAddress: DEPLOYMENT.contractAddress,
      compiledContract,
      circuitId: 'registerIssuer',
      args: [
        Buffer.from(publicKey.slice(0, 64), 'hex'),  // callerPubKey
        Buffer.from(publicKey.slice(0, 64), 'hex'),  // issuerPubKey
        Buffer.from(nameHash, 'hex'),                // nameHash
      ],
    });
    
    const txId = result?.public?.txId;
    console.log('\n✅ SUCCESS! Wallet registered as issuer!');
    console.log(`🆔 TX Hash: ${txId ? (typeof txId === 'bigint' ? txId.toString() : String(txId)) : 'unknown'}`);
    console.log('\n🎉 You can now issue credentials from the frontend!');
    
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('already registered')) {
      console.log('ℹ️  Wallet is already registered as an issuer!');
      console.log('   You can start issuing credentials immediately.');
    } else if (msg.includes('Only admin')) {
      console.log('❌ Only the contract admin can register issuers.');
      console.log('   Your wallet is not the admin.');
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
