#!/usr/bin/env node
/**
 * Standalone wallet test script
 * Tests BIP39 derivation and network connectivity
 */

import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { mnemonicToSeed } from '@scure/bip39';
import { Buffer } from 'buffer';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';

// Enable WebSocket for GraphQL
globalThis.WebSocket = WebSocket;

const MNEMONIC = process.env.WALLET_SEED || 'jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║    PrivaMedAI Wallet Test - Debug Script                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

async function deriveKeys(seed) {
  console.log('Step 1: Deriving HD wallet keys...');
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
}

async function testWallet() {
  try {
    // Step 1: Convert BIP39 to seed
    console.log('Mnemonic:', MNEMONIC.substring(0, 30) + '...');
    console.log('');
    
    console.log('Converting BIP39 to seed...');
    const seedBytes = await mnemonicToSeed(MNEMONIC.trim());
    const seed = Buffer.from(seedBytes).toString('hex');
    console.log('✅ Seed derived:', seed.substring(0, 32) + '...');
    console.log('   Length:', seed.length / 2, 'bytes');
    console.log('');

    // Step 2: Derive keys
    const keys = await deriveKeys(seed);
    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], 'preprod');
    
    console.log('✅ Keys derived successfully');
    console.log('');
    console.log('Addresses:');
    console.log('  Unshielded:', unshieldedKeystore.getBech32Address());
    console.log('');

    // Step 3: Initialize WalletFacade
    console.log('Step 2: Initializing WalletFacade...');
    
    const networkId = 'preprod';
    const indexerHttpUrl = 'https://indexer.preprod.midnight.network/api/v4/graphql';
    const indexerWsUrl = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
    const proofServerUrl = 'http://127.0.0.1:6300';
    const relayURL = 'wss://rpc.preprod.midnight.network';
    
    console.log('  Network:', networkId);
    console.log('  Indexer HTTP:', indexerHttpUrl);
    console.log('  Indexer WS:', indexerWsUrl);
    console.log('  Proof Server:', proofServerUrl);
    console.log('  Relay:', relayURL);
    console.log('');

    const walletConfig = {
      networkId,
      indexerClientConnection: {
        indexerHttpUrl,
        indexerWsUrl,
      },
      provingServerUrl: new URL(proofServerUrl),
      relayURL: new URL(relayURL),
    };

    const unshieldedConfig = {
      networkId,
      indexerClientConnection: {
        indexerHttpUrl,
        indexerWsUrl,
      },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    };

    const dustConfig = {
      networkId,
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
      indexerClientConnection: {
        indexerHttpUrl,
        indexerWsUrl,
      },
      provingServerUrl: new URL(proofServerUrl),
      relayURL: new URL(relayURL),
    };

    console.log('Creating wallet...');
    const wallet = await WalletFacade.init({
      configuration: { ...walletConfig, ...unshieldedConfig, ...dustConfig },
      shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
    });

    console.log('✅ WalletFacade created');
    console.log('');

    // Step 4: Start wallet
    console.log('Step 3: Starting wallet (this may take a while)...');
    console.log('  Waiting for sync...');
    console.log('  (Press Ctrl+C to cancel if it hangs)');
    console.log('');

    await wallet.start(shieldedSecretKeys, dustSecretKey);

    // Wait for sync with timeout
    const syncPromise = Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.tap((state) => {
          if (state.isSynced) {
            console.log('  ✅ Wallet synced!');
          } else {
            console.log('  ⏳ Syncing... (isSynced:', state.isSynced + ')');
          }
        }),
        Rx.filter((state) => state.isSynced),
      )
    );

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sync timeout after 60 seconds')), 60000);
    });

    const syncedState = await Promise.race([syncPromise, timeoutPromise]);

    // Step 5: Check balance
    console.log('');
    console.log('Step 4: Checking balance...');
    const tDUST = syncedState.dust.balance(new Date());
    const tNIGHT = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
    
    console.log('  tDUST:', tDUST.toLocaleString());
    console.log('  tNIGHT:', tNIGHT.toLocaleString());
    console.log('');

    if (tDUST === 0n && tNIGHT === 0n) {
      console.log('⚠️  Wallet has no funds!');
      console.log('');
      console.log('Please fund this address:');
      console.log('  ' + unshieldedKeystore.getBech32Address());
      console.log('');
      console.log('Visit: https://faucet.preprod.midnight.network/');
    } else {
      console.log('✅ Wallet is funded and ready!');
    }

    await wallet.stop();
    console.log('');
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.log('');
    console.log('❌ Error:', error.message);
    console.log('');
    console.log('Stack trace:');
    console.log(error.stack);
    process.exit(1);
  }
}

testWallet();
