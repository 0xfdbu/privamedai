import { Server, CreditCard } from 'lucide-react';
import { WalletButton } from './WalletButton';
import { useState, useEffect } from 'react';
import { checkProofServerHealth } from '../../services/proofServiceProd';
import { getWalletState, getStoredCredentials } from '../../services/contractService';
import { queryCredentialsOnChain } from '../../services/contractInteraction';

export function Header() {
  const [proofServerStatus, setProofServerStatus] = useState<{
    checked: boolean;
    healthy: boolean;
    latency?: number;
  }>({ checked: false, healthy: false });
  const [credentials, setCredentials] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const health = await checkProofServerHealth();
      setProofServerStatus({
        checked: true,
        healthy: health.healthy,
        latency: health.latency,
      });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkCredentials = async () => {
      const wallet = getWalletState();
      setWalletConnected(wallet.isConnected);
      
      if (wallet.isConnected && wallet.address) {
        const result = await queryCredentialsOnChain(wallet.address);
        if (result.success) {
          setCredentials(Number(result.totalCredentials) || 0);
        }
      }
      
      const stored = getStoredCredentials();
      if (stored.length > 0) {
        setCredentials(prev => Math.max(prev, stored.length));
      }
    };

    checkCredentials();
    const interval = setInterval(checkCredentials, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-end gap-4">
          {/* Status Indicators */}
          <div className="hidden md:flex items-center gap-3">
            {/* Proof Server Status */}
            {proofServerStatus.checked && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                proofServerStatus.healthy 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <Server className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">
                  {proofServerStatus.healthy ? 'Proof Server Ready' : 'Server Offline'}
                </span>
                {proofServerStatus.healthy && proofServerStatus.latency && (
                  <span className="text-xs opacity-75">({proofServerStatus.latency}ms)</span>
                )}
              </div>
            )}

            {/* Credentials Count */}
            {walletConnected && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                credentials > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">
                  {credentials} Credential{credentials !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Network Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-slate-600 font-medium">Preprod</span>
            </div>
          </div>
          
          {/* Wallet Button */}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}