import { useState, useEffect, useCallback } from 'react';

// Types for the Midnight Lace wallet API
interface InitialAPI {
  apiVersion: string;
  connect: (networkId: string) => Promise<ConnectedAPI>;
}

interface ConnectedAPI {
  getConnectionStatus: () => Promise<any>;
  balanceUnsealedTransaction: (tx: string) => Promise<{ tx: string }>;
  submitTransaction: (tx: string) => Promise<void>;
}

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectedAPI: ConnectedAPI | null;
}

// Extend window interface for Midnight Lace
declare global {
  interface Window {
    midnight?: {
      [key: string]: InitialAPI;
    };
  }
}

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

// Simple semver check
function satisfiesSemver(version: string, range: string): boolean {
  const major = parseInt(version.split('.')[0]);
  const rangeMajor = parseInt(range.split('.')[0]);
  return major === rangeMajor;
}

// Find compatible wallet
function getFirstCompatibleWallet(): InitialAPI | undefined {
  if (typeof window === 'undefined' || !window.midnight) return undefined;
  
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      satisfiesSemver(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
  );
}

export function useLaceWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    connectedAPI: null,
  });

  // Connect to Lace wallet
  const connectWallet = useCallback(async (networkId: string = 'preprod') => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Wait a bit for extension to inject
      await new Promise(r => setTimeout(r, 500));
      
      const initialAPI = getFirstCompatibleWallet();
      
      if (!initialAPI) {
        throw new Error('Midnight Lace wallet not found. Please install the extension and refresh.');
      }

      console.log('Found wallet with API version:', initialAPI.apiVersion);

      // Connect to the wallet
      const connectedAPI = await initialAPI.connect(networkId);
      
      // Check connection status
      const status = await connectedAPI.getConnectionStatus();
      console.log('Connection status:', status);
      
      // Save connection state
      localStorage.setItem('privamed_lace_connected', networkId);
      
      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        connectedAPI,
      });

      console.log('✅ Connected to Midnight Lace wallet');
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      
      let errorMsg = err.message || 'Failed to connect wallet';
      
      if (errorMsg.includes('not found') || errorMsg.includes('not installed')) {
        errorMsg = 'Midnight Lace wallet not found. Please install the extension and refresh the page.';
      } else if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        errorMsg = 'Connection rejected. Please approve the connection in your Lace wallet.';
      } else if (errorMsg.includes('timeout')) {
        errorMsg = 'Connection timed out. Please try again.';
      } else if (errorMsg.includes('version') || errorMsg.includes('compatible')) {
        errorMsg = 'Incompatible wallet version. Please update your Lace wallet extension.';
      }
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMsg,
        isConnected: false,
      }));
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    localStorage.removeItem('privamed_lace_connected');
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      error: null,
      connectedAPI: null,
    }));
  }, []);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const savedNetwork = localStorage.getItem('privamed_lace_connected');
    if (savedNetwork) {
      connectWallet(savedNetwork);
    }
  }, [connectWallet]);

  return {
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    connectedAPI: state.connectedAPI,
    connectWallet,
    disconnectWallet,
  };
}
