import { Shield } from 'lucide-react';
import { WalletButton } from './WalletButton';

export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">PrivaMedAI</h1>
              <p className="text-xs text-slate-500">Zero-Knowledge Medical Credentials</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-700">Preprod Network</span>
            </div>
            
            <WalletButton />
            
            <a 
              href="https://midnight.network" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:block text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Powered by Midnight
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
