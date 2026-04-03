import { createLaceWalletProvider } from '@midnight-ntwrk/midnight-js';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

setNetworkId('preprod');

const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';
const USER_PUBKEY = '525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362';
const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v3/graphql';
const INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
const PROOF_SERVER_URL = 'http://localhost:6300';

async function main() {
  console.log('🔑 Registering user as issuer...\n');
  
  // Import contract module
  const PrivaMedAIModule = await import('./contract/dist/managed/PrivaMedAI/contract/index.js');
  
  // Create compiled contract
  const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
    CompiledContract.withWitnesses({
      local_secret_key: () => new Uint8Array(32),
    }),
  );

  // Setup wallet from saved state
  const wallet = createLaceWalletProvider();
  console.log('⏳ Syncing wallet...');
  
  await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const state = await Rx.firstValueFrom(wallet.state());
  const adminPubKey = state.publicKey;
  
  console.log(`✅ Admin Wallet: ${adminPubKey.slice(0, 32)}...\n`);
  
  // Check if this is the admin
  if (adminPubKey.slice(0, 64) !== '5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a') {
    console.log('⚠️  This wallet is NOT the admin!');
    console.log(`   Expected: 5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a`);
    console.log(`   Got:      ${adminPubKey.slice(0, 64)}`);
    wallet.stop();
    process.exit(1);
  }
  
  console.log('✅ Admin wallet confirmed!\n');
  
  // Create providers
  const walletProvider = {
    getCoinPublicKey: () => adminPubKey,
    getEncryptionPublicKey: () => adminPubKey,
    async balanceTx(tx, ttl) {
      const recipe = await wallet.balanceUnboundTransaction(tx, {}, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx) => wallet.submitTransaction(tx),
  };

  const zkConfigPath = path.join(process.cwd(), 'contract/dist/managed/PrivaMedAI');
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-admin-register',
      privateStoragePasswordProvider: async () => 'Admin-Register-2025!',
      accountId: adminPubKey,
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER_URL, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  const nameHash = '19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12';
  
  console.log('🚀 Calling registerIssuer...');
  console.log(`   Admin: ${adminPubKey.slice(0, 64)}`);
  console.log(`   User:  ${USER_PUBKEY}`);
  console.log(`   Name:  ${nameHash.slice(0, 32)}...\n`);
  
  try {
    const result = await submitCallTx(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract,
      circuitId: 'registerIssuer',
      args: [
        Buffer.from(adminPubKey.slice(0, 64), 'hex'),
        Buffer.from(USER_PUBKEY, 'hex'),
        Buffer.from(nameHash, 'hex'),
      ],
    });
    
    console.log('✅ SUCCESS! User registered as issuer!');
    console.log(`🆔 TX: ${result?.public?.txId || 'submitted'}`);
    
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    if (e.message.includes('already registered')) {
      console.log('   User is already registered!');
    }
  }
  
  wallet.stop();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
