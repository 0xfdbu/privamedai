import { useState, useCallback, useEffect } from 'react';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { UnshieldedWallet, createKeystore, InMemoryTransactionHistoryStorage, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Polyfill Buffer for browser
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

export interface BrowserWallet {
  address: string;
  seed: string;
  isFunded: boolean;
  balance: string;
}

// Generate random seed
function generateSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString('hex');
}

// Derive keys from seed
function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  proofServer: 'http://localhost:6300',
  node: 'https://rpc.preprod.midnight.network',
};

export function useBrowserWallet(networkId: string = 'preprod') {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [walletFacade, setWalletFacade] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFunded, setIsFunded] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem(`privamed_wallet_${networkId}`);
    if (savedWallet) {
      try {
        const parsed = JSON.parse(savedWallet);
        setWallet(parsed);
      } catch (e) {
        console.error('Failed to load saved wallet:', e);
      }
    }
  }, [networkId]);

  // Initialize wallet (create or restore)
  const initializeWallet = useCallback(async (seed: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      setNetworkId(networkId);
      const keys = deriveKeys(seed);
      
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId as any);
      
      const walletConfig: any = {
        networkId,
        indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
        provingServerUrl: new URL(CONFIG.proofServer),
        relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
      };
      
      const facade = await WalletFacade.init({
        configuration: walletConfig,
        shielded: (config: any) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
        unshielded: (config: any) => {
          const wallet = UnshieldedWallet({
            ...config,
            txHistoryStorage: new InMemoryTransactionHistoryStorage(),
          });
          return wallet.startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
        },
        dust: (config: any) => DustWallet({
          ...config,
          costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
        }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
      });
      
      await facade.start(shieldedSecretKeys, dustSecretKey);
      
      // Get address
      const address = unshieldedKeystore.getBech32Address();
      
      const newWallet: BrowserWallet = {
        address: address.toString(),
        seed,
        isFunded: false,
        balance: '0',
      };
      
      localStorage.setItem(`privamed_wallet_${networkId}`, JSON.stringify(newWallet));
      setWallet(newWallet);
      setWalletFacade(facade);
      setIsSynced(true);
      
      return { wallet: newWallet, facade };
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [networkId]);

  // Create new wallet
  const createWallet = useCallback(async () => {
    const seed = generateSeed();
    return initializeWallet(seed);
  }, [initializeWallet]);

  // Restore wallet from seed
  const restoreWallet = useCallback(async (seed: string) => {
    return initializeWallet(seed);
  }, [initializeWallet]);

  // Check funding status
  const checkFunding = useCallback(async () => {
    if (!walletFacade) return;
    
    const state: any = await Rx.firstValueFrom(walletFacade.state());
    
    // Check balances from different wallet types
    let totalBalance = 0n;
    if (state.unshielded?.balances) {
      totalBalance += BigInt(state.unshielded.balances['NIGHT'] || 0);
    }
    if (state.shielded?.totalBalance) {
      totalBalance += BigInt(state.shielded.totalBalance);
    }
    
    if (totalBalance > 0n) {
      setIsFunded(true);
      setWallet(prev => prev ? { ...prev, isFunded: true, balance: totalBalance.toString() } : null);
    }
    
    return totalBalance;
  }, [walletFacade]);

  // Clear wallet
  const clearWallet = useCallback(() => {
    if (walletFacade) {
      walletFacade.stop();
    }
    localStorage.removeItem(`privamed_wallet_${networkId}`);
    setWallet(null);
    setWalletFacade(null);
    setIsFunded(false);
    setIsSynced(false);
  }, [networkId, walletFacade]);

  return {
    wallet,
    walletFacade,
    isLoading,
    error,
    isFunded,
    isSynced,
    createWallet,
    restoreWallet,
    checkFunding,
    clearWallet,
  };
}
