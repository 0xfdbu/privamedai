import { useState, useEffect, useCallback } from 'react';

// Types for the Midnight Lace wallet API
interface DAppConnectorAPI {
  apiVersion: string;
  isEnabled: () => Promise<boolean>;
  enable: () => Promise<DAppConnectorWalletAPI>;
  serviceUriConfig: () => Promise<ServiceUriConfig>;
}

interface DAppConnectorWalletAPI {
  state: () => Promise<any>;
  submitTransaction: (tx: any) => Promise<any>;
  balanceUnboundTransaction: (...args: any[]) => Promise<any>;
  finalizeRecipe: (recipe: any) => Promise<any>;
}

interface ServiceUriConfig {
  nodeUri: string;
  indexerUri: string;
  indexerWsUri: string;
  proverServerUri: string;
}

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  address: string;
  balance: bigint | null;
  walletAPI: DAppConnectorWalletAPI | null;
  serviceConfig: ServiceUriConfig | null;
}

// Extend window interface for Midnight Lace
declare global {
  interface Window {
    midnight?: {
      mnLace?: DAppConnectorAPI;
    };
  }
}

export function useLaceWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    address: '',
    balance: null,
    walletAPI: null,
    serviceConfig: null,
  });

  // Check if Lace is installed
  const isLaceInstalled = useCallback(() => {
    return typeof window !== 'undefined' && window.midnight?.mnLace !== undefined;
  }, []);

  // Check for previous connection on mount
  useEffect(() => {
    const checkPreviousConnection = async () => {
      const savedConnection = localStorage.getItem('privamed_lace_connected');
      if (savedConnection === 'true' && isLaceInstalled()) {
        // Auto-connect silently
        await connectWallet(true);
      }
    };
    
    checkPreviousConnection();
  }, []);

  // Connect to Lace wallet
  const connectWallet = useCallback(async (silent: boolean = false) => {
    if (!isLaceInstalled()) {
      setState(prev => ({
        ...prev,
        error: 'Midnight Lace wallet not found. Please install the browser extension.',
        isConnecting: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const laceAPI = window.midnight!.mnLace!;

      // Enable the wallet (this triggers the extension popup if not already authorized)
      const wallet = await laceAPI.enable();
      
      // Get service URIs from the wallet
      const serviceConfig = await laceAPI.serviceUriConfig();
      
      // Get wallet state
      const walletState = await wallet.state();
      
      // Extract address from state
      const address = walletState.coinPublicKey || '';
      
      // Save connection state
      localStorage.setItem('privamed_lace_connected', 'true');
      
      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        address,
        balance: walletState.balance || null,
        walletAPI: wallet,
        serviceConfig,
      });

      if (!silent) {
        console.log('✅ Connected to Midnight Lace wallet');
        console.log('📍 Address:', address.slice(0, 16) + '...');
        console.log('🔗 Service URIs:', serviceConfig);
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      
      let errorMsg = err.message || 'Failed to connect wallet';
      
      if (errorMsg.includes('not authorized') || errorMsg.includes('rejected')) {
        errorMsg = 'Connection rejected. Please approve the connection in your Lace wallet.';
      } else if (errorMsg.includes('timeout')) {
        errorMsg = 'Connection timed out. Please try again.';
      }
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMsg,
        isConnected: false,
      }));
    }
  }, [isLaceInstalled]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    localStorage.removeItem('privamed_lace_connected');
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      address: '',
      balance: null,
      walletAPI: null,
      serviceConfig: null,
    });
  }, []);

  // Refresh wallet state
  const refreshState = useCallback(async () => {
    if (!state.walletAPI || !state.isConnected) return;
    
    try {
      const walletState = await state.walletAPI.state();
      setState(prev => ({
        ...prev,
        address: walletState.coinPublicKey || prev.address,
        balance: walletState.balance || prev.balance,
      }));
    } catch (err) {
      console.error('Failed to refresh wallet state:', err);
    }
  }, [state.walletAPI, state.isConnected]);

  return {
    ...state,
    isLaceInstalled,
    connectWallet,
    disconnectWallet,
    refreshState,
  };
}

// Helper to create wallet providers for contract interaction
export async function createWalletProviders(walletAPI: DAppConnectorWalletAPI, serviceConfig: ServiceUriConfig) {
  // Get current state for key information
  const walletState = await walletAPI.state();
  
  return {
    walletProvider: {
      getCoinPublicKey: () => walletState.coinPublicKey,
      getEncryptionPublicKey: () => walletState.encryptionPublicKey,
      balanceTx: async (tx: any, ttl?: Date) => {
        // Use the wallet's built-in balancing
        const recipe = await walletAPI.balanceUnboundTransaction(
          tx,
          {}, // Keys are managed by the wallet
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
        );
        return walletAPI.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => walletAPI.submitTransaction(tx),
    },
    serviceConfig,
  };
}
