import { useState, useRef, useEffect } from 'react';
import { Wallet, LogOut, Copy, Check, ExternalLink, ChevronDown, Shield } from 'lucide-react';
import { getWalletState, connectWallet, disconnectWallet } from '../../services/contractService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export function WalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [pubKey, setPubKey] = useState('');
  const [seed, setSeed] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wallet = getWalletState();
    setIsConnected(wallet.isConnected);
    setAddress(wallet.address || '');
    setPubKey(wallet.pubKey || '');
  }, []);

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

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    const result = await connectWallet(seed);
    
    if (result.success) {
      setIsConnected(true);
      setAddress(result.address!);
      setPubKey(seed);
      setSeed('');
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
    setPubKey('');
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
                Enter your wallet seed to connect
              </p>

              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}

              <Input
                label="Wallet Seed"
                placeholder="64 character hex seed..."
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                type="password"
              />

              <Button
                onClick={handleConnect}
                isLoading={isConnecting}
                disabled={seed.length !== 64 || isConnecting}
                className="w-full mt-3"
              >
                Connect
              </Button>

              <p className="text-xs text-slate-400 mt-3 text-center">
                Your seed is stored locally and never leaves your device
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
                <p className="text-xs text-slate-500">Midnight Preprod Network</p>
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

            {/* Public Key */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Public Key
              </label>
              <div className="mt-1">
                <code className="block text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-600 font-mono truncate">
                  {pubKey ? `${pubKey.slice(0, 20)}...${pubKey.slice(-20)}` : 'N/A'}
                </code>
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
