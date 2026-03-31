import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WalletContextType {
  seed: string | null;
  isConnected: boolean;
  connect: (seed: string) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check localStorage for saved seed
    const saved = localStorage.getItem('privacred_wallet_seed');
    if (saved) {
      setSeed(saved);
      setIsConnected(true);
    }
  }, []);

  const connect = (newSeed: string) => {
    localStorage.setItem('privacred_wallet_seed', newSeed);
    setSeed(newSeed);
    setIsConnected(true);
  };

  const disconnect = () => {
    localStorage.removeItem('privacred_wallet_seed');
    setSeed(null);
    setIsConnected(false);
  };

  return (
    <WalletContext.Provider value={{ seed, isConnected, connect, disconnect }}>
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
