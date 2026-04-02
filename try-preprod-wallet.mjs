import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId as ZswapNetworkId } from '@midnight-ntwrk/zswap';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createHash } from 'crypto';

// Set preprod first
setNetworkId('preprod');
console.log('Network ID set to:', getNetworkId());

const seedPhrase = 'jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular';
const seed = createHash('sha256').update(seedPhrase.trim()).digest('hex');

console.log('');
console.log('Testing with ZswapNetworkId.TestNet (value: 2) after setNetworkId("preprod")...');
console.log('Seed:', seed.substring(0, 20) + '...');
console.log('');

async function test() {
  try {
    const wallet = await WalletBuilder.buildFromSeed(
      'https://indexer.preprod.midnight.network/api/v1/graphql',
      'wss://indexer.preprod.midnight.network/api/v1/graphql/ws',
      'http://127.0.0.1:6300',
      'https://rpc.preprod.midnight.network',
      seed,
      ZswapNetworkId.TestNet, // Use numeric TestNet but with preprod network set
      'info'
    );
    
    return new Promise((resolve) => {
      wallet.state().subscribe(state => {
        console.log('Derived Address:', state.address);
        console.log('');
        console.log('Expected: mn_shield-addr_preprod14akqe...');
        console.log('Match:', state.address.startsWith('mn_shield-addr_preprod'));
        wallet.close();
        resolve();
      });
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
