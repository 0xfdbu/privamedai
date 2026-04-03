import { useState, useRef, useEffect } from 'react';
import { Wallet, LogOut, Copy, Check, ExternalLink, ChevronDown, Shield } from 'lucide-react';
import { getWalletState, connectLaceWallet, disconnectWallet } from '../../services/contractService';
import { Button } from '../common/Button';

// Import dapp-connector types for window.midnight augmentation
import '@midnight-ntwrk/dapp-connector-api';

export function WalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [laceAvailable, setLaceAvailable] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wallet = getWalletState();
    setIsConnected(wallet.isConnected);
    setAddress(wallet.address || '');
  }, []);

  // Poll for Lace availability (extensions inject async)
  useEffect(() => {
    // Check immediately first
    checkForLace();
    
    // Poll every 100ms for up to 3 seconds
    const interval = setInterval(() => {
      checkForLace();
    }, 100);

    // Stop polling after 3 seconds
    const timeout = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  function checkForLace() {
    const midnight = (window as any).midnight;
    // Check for mnLace or any wallet with apiVersion
    const lace = midnight?.mnLace || 
      (midnight ? Object.values(midnight).find((w: any) => w?.apiVersion) : undefined);
    
    if (lace) {
      setLaceAvailable(true);
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectLace = async () => {
    setIsConnecting(true);
    setError(null);
    
    const result = await connectLaceWallet();
    
    if (result.success) {
      setIsConnected(true);
      setAddress(result.address!);
      setIsOpen(false);
    } else {
      setError(result.error || 'Failed to connect');
    }
    
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setIsConnected(false);
    setAddress('');
    setIsOpen(false);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          leftIcon={<Wallet className="w-4 h-4" />}
        >
          Connect Wallet
        </Button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 mb-1">Connect Wallet</h3>
              <p className="text-xs text-slate-500 mb-4">
                Connect your Lace wallet to interact with the contract
              </p>

              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}

              {!laceAvailable && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <p className="font-medium mb-1">Lace wallet not detected</p>
                  <p>Please install the Lace extension and refresh the page</p>
                  <a 
                    href="https://chromewebstore.google.com/detail/lace-wallet/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-800 underline mt-1 inline-block"
                  >
                    Install Lace →
                  </a>
                </div>
              )}

              <Button
                onClick={handleConnectLace}
                isLoading={isConnecting}
                disabled={!laceAvailable || isConnecting}
                className="w-full"
                leftIcon={<Wallet className="w-4 h-4" />}
              >
                {laceAvailable ? 'Connect with Lace' : 'Lace Not Available'}
              </Button>

              <p className="text-xs text-slate-400 mt-3 text-center">
                Your keys never leave your wallet
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Connected state
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          ${isOpen 
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
            : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
          }
        `}
      >
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-slate-700">
          {truncateAddress(address)}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Wallet Connected</p>
                <p className="text-xs text-slate-500">Lace • Midnight Preprod</p>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="p-4 space-y-4">
            {/* Full Address */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Address
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-700 font-mono break-all">
                  {address}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Copy address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Network Status */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Network</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-sm font-medium text-slate-700">Preprod</span>
              </div>
            </div>

            {/* Contract Info */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Contract</span>
              <a
                href={`https://midnight-explorer.com/address/${import.meta.env.VITE_CONTRACT_ADDRESS || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                View
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
