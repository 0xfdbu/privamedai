/**
 * Header Component
 * Top navigation bar with wallet status and actions
 */

import React from 'react';
import { StatusIndicator } from '../ui/StatusIndicator';
import { Button } from '../ui/Button';
import { IconWallet, IconPower } from '../icons';
import { ContractState } from '../../types';

interface HeaderProps {
  contractState: ContractState;
  contractError?: string | null;
  walletAddress?: string;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  contractState,
  contractError,
  walletAddress,
  onDisconnect,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--border)]">
      <div className="container h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">PrivaMedAI</h1>
            <p className="text-xs text-[var(--text-muted)]">Healthcare Credentials</p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Status */}
          <div className="hidden sm:flex items-center px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <StatusIndicator state={contractState} error={contractError} />
          </div>

          {/* Wallet */}
          {walletAddress && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
              <IconWallet size={18} className="text-[var(--accent-primary)]" />
              <span className="text-sm font-mono text-[var(--text-secondary)]">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
              </span>
            </div>
          )}

          {/* Disconnect */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            leftIcon={<IconPower size={16} />}
          >
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
