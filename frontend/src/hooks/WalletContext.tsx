import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useLaceWallet, VALID_NETWORKS, type NetworkId } from './useLaceWallet';
import { createCredentialAPI, type CredentialAPI } from '../contract/credentialApi';

export { useLaceWallet, VALID_NETWORKS };
export type { NetworkId };

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  showNetworkSelector: boolean;
  detectedNetwork: string | null;
  connectedAPI: any | null;
  credentialAPI: CredentialAPI | null;
  connect: (networkId?: string) => Promise<void>;
  connectWithNetwork: (networkId: string) => Promise<boolean>;
  hideNetworkSelector: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const NETWORK_CONFIG = {
  preprod: {
    indexerUri: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
  preview: {
    indexerUri: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUri: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
  mainnet: {
    indexerUri: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUri: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    proofServerUri: 'http://localhost:6300',
  },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const laceWallet = useLaceWallet();
  const [credentialAPI, setCredentialAPI] = useState<CredentialAPI | null>(null);

  // Enhanced connect that also initializes credential API
  const connectWithNetwork = useCallback(async (networkId: string) => {
    const success = await laceWallet.connectWithNetwork(networkId);
    
    if (success && laceWallet.connectedAPI) {
      // Initialize credential API
      const networkConfig = NETWORK_CONFIG[networkId as keyof typeof NETWORK_CONFIG] || NETWORK_CONFIG.preprod;
      const api = await createCredentialAPI(laceWallet.connectedAPI, networkConfig);
      setCredentialAPI(api);
    }
    
    return success;
  }, [laceWallet]);

  const connect = useCallback(async (networkId?: string) => {
    await laceWallet.connectWallet(networkId);
    
    if (laceWallet.connectedAPI && laceWallet.detectedNetwork) {
      const networkConfig = NETWORK_CONFIG[laceWallet.detectedNetwork as keyof typeof NETWORK_CONFIG] || NETWORK_CONFIG.preprod;
      const api = await createCredentialAPI(laceWallet.connectedAPI, networkConfig);
      setCredentialAPI(api);
    }
  }, [laceWallet]);

  const disconnect = useCallback(() => {
    setCredentialAPI(null);
    laceWallet.disconnectWallet();
  }, [laceWallet]);
  
  const value: WalletContextType = {
    isConnected: laceWallet.isConnected,
    isConnecting: laceWallet.isConnecting,
    error: laceWallet.error,
    showNetworkSelector: laceWallet.showNetworkSelector,
    detectedNetwork: laceWallet.detectedNetwork,
    connectedAPI: laceWallet.connectedAPI,
    credentialAPI,
    connect,
    connectWithNetwork,
    hideNetworkSelector: laceWallet.hideNetworkSelector,
    disconnect,
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
