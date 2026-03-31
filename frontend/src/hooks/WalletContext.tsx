import { createContext, useContext, ReactNode } from 'react';
import { useLaceWallet } from './useLaceWallet';

export { useLaceWallet };

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (networkId?: string) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const laceWallet = useLaceWallet();
  
  const value: WalletContextType = {
    isConnected: laceWallet.isConnected,
    isConnecting: laceWallet.isConnecting,
    error: laceWallet.error,
    connect: laceWallet.connectWallet,
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
