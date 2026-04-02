import { useState, useEffect } from 'react';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { connectWallet, disconnectWallet, getWalletState } from '../../services/contractService';

export function WalletConnect() {
  const [seed, setSeed] = useState('');
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const wallet = getWalletState();
    if (wallet.isConnected && wallet.address) {
      setConnected(true);
      setAddress(wallet.address);
    }
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    
    const result = await connectWallet(seed);
    
    if (result.success) {
      setConnected(true);
      setAddress(result.address!);
      setSeed('');
    } else {
      setError(result.error || 'Failed to connect');
    }
    
    setLoading(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setConnected(false);
    setAddress('');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (connected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
          <Wallet className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-emerald-600 font-medium">Connected</p>
          <p className="text-sm text-slate-700 font-mono truncate">{address.slice(0, 12)}...{address.slice(-8)}</p>
        </div>
        <button 
          onClick={copyAddress}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
        <button 
          onClick={handleDisconnect}
          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Wallet Seed (64 hex characters)"
        placeholder="Enter your wallet seed..."
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        type="password"
      />
      <Button 
        onClick={handleConnect} 
        isLoading={loading}
        disabled={seed.length !== 64 || loading}
        className="w-full"
        leftIcon={<Wallet className="w-4 h-4" />}
      >
        Connect Wallet
      </Button>
      <p className="text-xs text-slate-400">
        Your seed is stored locally and never sent to any server.
      </p>
    </div>
  );
}
