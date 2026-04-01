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
  getConfiguration?: () => Promise<{ proverServerUri?: string; indexerUri?: string; indexerWsUri?: string }>;
  getShieldedAddresses?: () => Promise<{ shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
}

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectedAPI: ConnectedAPI | null;
  showNetworkSelector: boolean;
  detectedNetwork: string | null;
}

// Valid networks per Midnight Lace wallet
export const VALID_NETWORKS = [
  { id: 'preprod', name: 'Preprod', description: 'Pre-production testnet' },
  { id: 'preview', name: 'Preview', description: 'Preview testnet' },
  { id: 'mainnet', name: 'Mainnet', description: 'Main network' },
  { id: 'testnet', name: 'Testnet', description: 'Test network' },
  { id: 'devnet', name: 'Devnet', description: 'Development network' },
  { id: 'qanet', name: 'QA Net', description: 'QA network' },
  { id: 'undeployed', name: 'Undeployed', description: 'Local development' },
] as const;

export type NetworkId = typeof VALID_NETWORKS[number]['id'];

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
    showNetworkSelector: false,
    detectedNetwork: null,
  });

  // Connect to Lace wallet with a specific network
  const connectWithNetwork = useCallback(async (networkId: string) => {
    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null, 
      showNetworkSelector: false 
    }));

    try {
      // Wait a bit for extension to inject
      await new Promise(r => setTimeout(r, 500));
      
      const initialAPI = getFirstCompatibleWallet();
      
      if (!initialAPI) {
        throw new Error('Midnight Lace wallet not found. Please install the extension and refresh.');
      }

      console.log('Found wallet with API version:', initialAPI.apiVersion);
      console.log(`Connecting with network: ${networkId}`);
      
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
        showNetworkSelector: false,
        detectedNetwork: networkId,
      });

      console.log(`✅ Connected to Midnight Lace wallet on ${networkId}`);
      return true;
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      
      let errorMsg = err.message || err.reason || 'Failed to connect wallet';
      
      if (errorMsg.includes('not found') || errorMsg.includes('not installed')) {
        errorMsg = 'Midnight Lace wallet not found. Please install the extension and refresh the page.';
      } else if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        errorMsg = 'Connection rejected. Please approve the connection in your Lace wallet.';
      } else if (errorMsg.includes('timeout')) {
        errorMsg = 'Connection timed out. Please try again.';
      } else if (errorMsg.includes('version') || errorMsg.includes('compatible')) {
        errorMsg = 'Incompatible wallet version. Please update your Lace wallet extension.';
      } else if (errorMsg.includes('Network ID mismatch')) {
        errorMsg = `Network mismatch. Your wallet is configured for a different network than "${networkId}".`;
      }
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMsg,
        isConnected: false,
      }));
      return false;
    }
  }, []);

  // Auto-detect and connect to wallet (tries multiple networks)
  const connectWallet = useCallback(async (preferredNetworkId: string = 'preprod') => {
    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null, 
      showNetworkSelector: false 
    }));

    try {
      // Wait a bit for extension to inject
      await new Promise(r => setTimeout(r, 500));
      
      const initialAPI = getFirstCompatibleWallet();
      
      if (!initialAPI) {
        throw new Error('Midnight Lace wallet not found. Please install the extension and refresh.');
      }

      console.log('Found wallet with API version:', initialAPI.apiVersion);

      // Try different networks if the preferred one fails
      // Valid networks per wallet: mainnet, testnet, devnet, qanet, undeployed, preview, preprod
      const networks = [
        preferredNetworkId, 
        'preprod', 'preview', 'mainnet', 'testnet', 'devnet', 'qanet', 'undeployed'
      ];
      let connectedAPI = null;
      let successfulNetwork = '';
      let lastError = null;
      let hasNetworkMismatch = false;

      for (const networkId of networks) {
        try {
          console.log(`Trying to connect with network: ${networkId}`);
          connectedAPI = await initialAPI.connect(networkId);
          successfulNetwork = networkId;
          console.log(`✅ Successfully connected with network: ${networkId}`);
          break;
        } catch (e: any) {
          console.log(`Failed to connect with ${networkId}:`, e.message || e.reason);
          lastError = e;
          const errorText = (e.message || e.reason || '').toLowerCase();
          if (errorText.includes('network id mismatch')) {
            hasNetworkMismatch = true;
            continue;
          }
          if (errorText.includes('invalid network id') || e.code === 'InvalidRequest') {
            continue;
          }
          // For other errors, throw immediately
          throw e;
        }
      }

      if (!connectedAPI) {
        // If we had network mismatches, show the network selector
        if (hasNetworkMismatch) {
          setState(prev => ({
            ...prev,
            isConnecting: false,
            showNetworkSelector: true,
            error: 'Please select the network your wallet is configured for:',
          }));
          return;
        }
        throw lastError || new Error('Could not connect with any network. Please check your wallet configuration.');
      }
      
      // Check connection status
      const status = await connectedAPI.getConnectionStatus();
      console.log('Connection status:', status);
      
      // Save connection state
      localStorage.setItem('privamed_lace_connected', successfulNetwork);
      
      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        connectedAPI,
        showNetworkSelector: false,
        detectedNetwork: successfulNetwork,
      });

      console.log(`✅ Connected to Midnight Lace wallet on ${successfulNetwork}`);
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      
      let errorMsg = err.message || err.reason || 'Failed to connect wallet';
      
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

  // Hide network selector
  const hideNetworkSelector = useCallback(() => {
    setState(prev => ({
      ...prev,
      showNetworkSelector: false,
    }));
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    localStorage.removeItem('privamed_lace_connected');
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      connectedAPI: null,
      showNetworkSelector: false,
      detectedNetwork: null,
    });
  }, []);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const savedNetwork = localStorage.getItem('privamed_lace_connected');
    if (savedNetwork) {
      connectWithNetwork(savedNetwork);
    }
  }, [connectWithNetwork]);

  return {
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    connectedAPI: state.connectedAPI,
    showNetworkSelector: state.showNetworkSelector,
    detectedNetwork: state.detectedNetwork,
    connectWallet,
    connectWithNetwork,
    hideNetworkSelector,
    disconnectWallet,
  };
}
