import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useLaceWallet, VALID_NETWORKS, type NetworkId } from './useLaceWallet';
import { useBrowserWallet } from './useBrowserWallet';
import { createCredentialAPI, type CredentialAPI } from '../contract/credentialApi';

export { useLaceWallet, VALID_NETWORKS };
export type { NetworkId };

type WalletMode = 'lace' | 'browser' | null;

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  showNetworkSelector: boolean;
  detectedNetwork: string | null;
  connectedAPI: any | null;
  credentialAPI: CredentialAPI | null;
  walletMode: WalletMode;
  walletAddress: string | null;
  connect: (networkId?: string) => Promise<void>;
  connectWithNetwork: (networkId: string) => Promise<boolean>;
  hideNetworkSelector: () => void;
  disconnect: () => void;
  // Browser wallet specific
  createBrowserWallet: () => Promise<void>;
  restoreBrowserWallet: (seed: string) => Promise<void>;
  clearBrowserWallet: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const NETWORK_CONFIG = {
  preprod: {
    indexerUri: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'preprod',
  },
  preview: {
    indexerUri: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'preview',
  },
  mainnet: {
    indexerUri: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUri: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'mainnet',
  },
  testnet: {
    indexerUri: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
    indexerWsUri: 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'testnet',
  },
  devnet: {
    indexerUri: 'https://indexer.devnet.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.devnet.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'devnet',
  },
  qanet: {
    indexerUri: 'https://indexer.qanet.dev.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.qanet.dev.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'qanet',
  },
  undeployed: {
    indexerUri: 'http://localhost:8088/api/v1/graphql',
    indexerWsUri: 'ws://localhost:8088/api/v1/graphql/ws',
    proofServerUri: 'http://localhost:6300',
    networkId: 'undeployed',
  },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const laceWallet = useLaceWallet();
  const browserWallet = useBrowserWallet('preprod');
  const [credentialAPI, setCredentialAPI] = useState<CredentialAPI | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>(null);

  // Determine overall connection state
  const isLaceConnected = laceWallet.isConnected;
  const isBrowserConnected = !!browserWallet.wallet;
  const isConnected = isLaceConnected || isBrowserConnected;
  
  // Determine which mode is active
  useEffect(() => {
    if (isLaceConnected) {
      setWalletMode('lace');
    } else if (isBrowserConnected) {
      setWalletMode('browser');
    } else {
      setWalletMode(null);
      setCredentialAPI(null);
    }
  }, [isLaceConnected, isBrowserConnected]);

  // Lace wallet connection
  const connectWithNetwork = useCallback(async (networkId: string) => {
    const success = await laceWallet.connectWithNetwork(networkId);
    if (success) {
      setWalletMode('lace');
    }
    return success;
  }, [laceWallet]);

  const connect = useCallback(async (networkId?: string) => {
    await laceWallet.connectWallet(networkId);
  }, [laceWallet]);

  // Initialize credential API for Lace wallet
  useEffect(() => {
    if (walletMode === 'lace' && laceWallet.connectedAPI && laceWallet.detectedNetwork && !credentialAPI) {
      const initAPI = async () => {
        const proofServerUri = NETWORK_CONFIG[laceWallet.detectedNetwork as keyof typeof NETWORK_CONFIG]?.proofServerUri || 'http://localhost:6300';
        console.log('Using configured proof server (Lace):', proofServerUri);
        
        const networkConfig = {
          ...NETWORK_CONFIG[laceWallet.detectedNetwork as keyof typeof NETWORK_CONFIG] || NETWORK_CONFIG.preprod,
          proofServerUri,
        };
        
        const api = await createCredentialAPI(laceWallet.connectedAPI, networkConfig);
        setCredentialAPI(api);
      };
      initAPI();
    }
  }, [walletMode, laceWallet.connectedAPI, laceWallet.detectedNetwork, credentialAPI]);

  // Initialize credential API for Browser wallet
  useEffect(() => {
    if (walletMode === 'browser' && browserWallet.walletFacade && !credentialAPI) {
      const initAPI = async () => {
        console.log('Initializing credential API for browser wallet...');
        
        // Create a mock wallet API that uses the browser wallet facade
        const mockWalletApi = {
          getShieldedAddresses: async () => ({
            shieldedCoinPublicKey: browserWallet.wallet!.address,
            shieldedEncryptionPublicKey: browserWallet.wallet!.address,
          }),
          getConfiguration: async () => ({
            proverServerUri: 'http://localhost:6300',
            zkConfigUri: window.location.origin,
          }),
          balanceUnsealedTransaction: async (tx: string) => ({ tx }),
          submitTransaction: async (tx: string) => {
            console.log('Browser wallet submitting tx:', tx.slice(0, 50) + '...');
            // Use wallet facade to actually submit
            // This is a simplified version
          },
        };

        const api = await createCredentialAPI(mockWalletApi, {
          indexerUri: NETWORK_CONFIG.preprod.indexerUri,
          indexerWsUri: NETWORK_CONFIG.preprod.indexerWsUri,
          proofServerUri: NETWORK_CONFIG.preprod.proofServerUri,
          networkId: 'preprod',
        });
        
        setCredentialAPI(api);
      };
      initAPI();
    }
  }, [walletMode, browserWallet.walletFacade, browserWallet.wallet, credentialAPI]);

  // Disconnect both wallets
  const disconnect = useCallback(() => {
    setCredentialAPI(null);
    laceWallet.disconnectWallet();
    browserWallet.clearWallet();
    setWalletMode(null);
  }, [laceWallet, browserWallet]);

  // Browser wallet actions
  const createBrowserWallet = useCallback(async () => {
    await browserWallet.createWallet();
    setWalletMode('browser');
  }, [browserWallet]);

  const restoreBrowserWallet = useCallback(async (seed: string) => {
    await browserWallet.restoreWallet(seed);
    setWalletMode('browser');
  }, [browserWallet]);

  const clearBrowserWallet = useCallback(() => {
    browserWallet.clearWallet();
    setCredentialAPI(null);
    setWalletMode(null);
  }, [browserWallet]);

  // Get wallet address for display
  const walletAddress = walletMode === 'lace' 
    ? null // Lace doesn't expose address easily
    : browserWallet.wallet?.address || null;

  const value: WalletContextType = {
    isConnected,
    isConnecting: laceWallet.isConnecting || browserWallet.isLoading,
    error: laceWallet.error || browserWallet.error,
    showNetworkSelector: laceWallet.showNetworkSelector,
    detectedNetwork: laceWallet.detectedNetwork,
    connectedAPI: walletMode === 'lace' ? laceWallet.connectedAPI : browserWallet.walletFacade,
    credentialAPI,
    walletMode,
    walletAddress,
    connect,
    connectWithNetwork,
    hideNetworkSelector: laceWallet.hideNetworkSelector,
    disconnect,
    createBrowserWallet,
    restoreBrowserWallet,
    clearBrowserWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
