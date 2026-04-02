#!/usr/bin/env node
/**
 * Deploy PrivaMedAI with user's Lace wallet as admin
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as PrivaMedAIModule from './contract/dist/managed/PrivaMedAI/contract/index.js';

const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v3/graphql';
const INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
const PROOF_SERVER_URL = 'http://localhost:6300';

setNetworkId('preprod');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Deploying PrivaMedAI with Your Wallet as Admin             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('💡 Using your connected Lace wallet for deployment\n');
  
  // Setup wallet
  const wallet = createLaceWalletProvider();
  console.log('⏳ Syncing wallet...');
  
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  const lacePubKey = (state as any).publicKey;
  
  console.log(`💳 Lace Wallet PubKey: ${lacePubKey.slice(0, 32)}...`);
  console.log(`   Full: ${lacePubKey.slice(0, 64)}`);
  
  // Create compiled contract
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: () => new Uint8Array(32),
    }),
  );

  // Create providers
  const walletProvider = {
    getCoinPublicKey: () => lacePubKey,
    getEncryptionPublicKey: () => lacePubKey,
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
      privateStateStoreName: 'privamedai-new-deploy',
      privateStoragePasswordProvider: async () => 'New-Deploy-2025!',
      accountId: lacePubKey,
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER_URL, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  console.log('\n🚀 Deploying contract...');
  console.log('   (This may take 30-60 seconds)\n');
  
  try {
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'privamedai-v1',
      initialPrivateState: {},
    });
    
    const contractAddress = deployed.deployTxData.public.contractAddress;
    console.log('✅ SUCCESS! Contract deployed!');
    console.log(`📋 Contract Address: ${contractAddress}`);
    
    // Save deployment info
    const deploymentInfo = {
      contractAddress,
      network: 'preprod',
      admin: lacePubKey.slice(0, 64),
      deployedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      './contracts/PrivaMedAI/deployments/preprod-deployment.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('\n💾 Deployment saved to: contracts/PrivaMedAI/deployments/preprod-deployment.json');
    
    // Now initialize with your wallet as admin
    console.log('\n📝 Initializing contract with your wallet as admin...');
    
    const { submitCallTx } = await import('@midnight-ntwrk/midnight-js-contracts');
    
    const initResult = await submitCallTx(providers, {
      contractAddress,
      compiledContract,
      circuitId: 'initialize',
      args: [Buffer.from(lacePubKey.slice(0, 64), 'hex')],
    });
    
    console.log('✅ Contract initialized!');
    console.log(`🆔 Init TX: ${initResult?.public?.txId || 'submitted'}`);
    
    console.log('\n🎉 You are now the admin! You can:');
    console.log('   • Register yourself as issuer');
    console.log('   • Issue credentials immediately');
    console.log('   • Register other issuers');
    
    console.log(`\n📋 New Contract Address: ${contractAddress}`);
    console.log('   Update this in frontend/src/contract/credentialApi.ts');
    
  } catch (e: any) {
    console.error('\n❌ Error:', e.message);
    console.error(e.stack);
  }
  
  wallet.stop();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
