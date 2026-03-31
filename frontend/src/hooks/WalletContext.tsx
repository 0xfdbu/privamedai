import { createContext, useContext, ReactNode } from 'react';
import { useLaceWallet } from './useLaceWallet';

export { useLaceWallet };

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  address: string;
  balance: bigint | null;
  walletAPI: any;
  serviceConfig: any;
  connect: () => Promise<void>;
  disconnect: () => void;
  isLaceInstalled: () => boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const laceWallet = useLaceWallet();
  
  const value: WalletContextType = {
    isConnected: laceWallet.isConnected,
    isConnecting: laceWallet.isConnecting,
    error: laceWallet.error,
    address: laceWallet.address,
    balance: laceWallet.balance,
    walletAPI: laceWallet.walletAPI,
    serviceConfig: laceWallet.serviceConfig,
    connect: laceWallet.connectWallet,
    disconnect: laceWallet.disconnectWallet,
    isLaceInstalled: laceWallet.isLaceInstalled,
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
