import { createContext, useContext, ReactNode } from 'react';
import { useLaceWallet, VALID_NETWORKS, type NetworkId } from './useLaceWallet';

export { useLaceWallet, VALID_NETWORKS };
export type { NetworkId };

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  showNetworkSelector: boolean;
  detectedNetwork: string | null;
  connect: (networkId?: string) => Promise<void>;
  connectWithNetwork: (networkId: string) => Promise<boolean>;
  hideNetworkSelector: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const laceWallet = useLaceWallet();
  
  const value: WalletContextType = {
    isConnected: laceWallet.isConnected,
    isConnecting: laceWallet.isConnecting,
    error: laceWallet.error,
    showNetworkSelector: laceWallet.showNetworkSelector,
    detectedNetwork: laceWallet.detectedNetwork,
    connect: laceWallet.connectWallet,
    connectWithNetwork: laceWallet.connectWithNetwork,
    hideNetworkSelector: laceWallet.hideNetworkSelector,
    disconnect: laceWallet.disconnectWallet,
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
