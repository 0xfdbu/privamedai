/**
 * PrivaMedAI Application
 * Main entry point with wallet connection and portal routing
 */

import React, { useState } from 'react';
import { WalletProvider, useWallet } from './hooks/WalletContext';
import { usePrivaMedAIContract } from './hooks/usePrivaMedAIContract';
import { MainLayout } from './components/layout';
import { Button, Card, CardContent, Input, Alert } from './components/ui';
import { IconWallet, IconKey, IconLoader, IconArrowRight } from './components/icons';
import { IssuerPortal } from './pages/IssuerPortal';
import { UserPortal } from './pages/UserPortal';
import { VerifierPortal } from './pages/VerifierPortal';
import { PortalType } from './types';

// ============================================================================
// Wallet Connection Screen
// ============================================================================

const WalletConnect: React.FC<{ onConnect: (seed: string) => void }> = ({ onConnect }) => {
  const [seed, setSeed] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleConnect = () => {
    if (seed.trim().length === 64) {
      onConnect(seed.trim());
    } else {
      alert('Please enter a valid 64-character hex seed');
    }
  };

  const generateRandom = () => {
    setIsGenerating(true);
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    setSeed(hex);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <IconWallet size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2">PrivaMedAI</h1>
            <p className="text-[var(--text-muted)] text-sm">
              Enterprise Healthcare Credentials on Midnight
            </p>
          </div>

          {/* Seed Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Wallet Seed <span className="text-[var(--text-muted)]">(64 hex characters)</span>
              </label>
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Enter your wallet seed..."
                rows={3}
                className="input textarea font-mono text-sm"
              />
              <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{seed.length}/64 characters</span>
                {seed.length === 64 && (
                  <span className="text-green-500 flex items-center gap-1">
                    <IconCheck size={12} /> Valid
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={generateRandom}
                isLoading={isGenerating}
                className="flex-1"
              >
                Generate
              </Button>
              <Button
                onClick={handleConnect}
                disabled={seed.length !== 64}
                rightIcon={<IconArrowRight size={16} />}
                className="flex-1"
              >
                Connect
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="mt-8 space-y-3">
            <Alert variant="info">
              Your wallet must be funded with tNight tokens from the{' '}
              <a
                href="https://faucet.preprod.midnight.network/"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                Midnight preprod faucet
              </a>
            </Alert>
            <Alert variant="warning">
              The local proof server must be running on port 6300
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// Main Application
// ============================================================================

const MainApp: React.FC = () => {
  const { seed, isConnected, connect, disconnect } = useWallet();
  const [activePortal, setActivePortal] = useState<PortalType>('issuer');
  
  const {
    state: contractState,
    error: contractError,
    walletAddress,
    isAdmin,
  } = usePrivaMedAIContract(seed || '');

  if (!isConnected || !seed) {
    return <WalletConnect onConnect={connect} />;
  }

  return (
    <MainLayout
      contractState={contractState}
      contractError={contractError}
      walletAddress={walletAddress}
      activePortal={activePortal}
      onPortalChange={setActivePortal}
      onDisconnect={disconnect}
    >
      <div className="animate-fade-in">
        {activePortal === 'issuer' && (
          <IssuerPortal
            seed={seed}
            contractState={contractState}
            isAdmin={isAdmin}
          />
        )}
        {activePortal === 'user' && (
          <UserPortal
            seed={seed}
            contractState={contractState}
          />
        )}
        {activePortal === 'verifier' && (
          <VerifierPortal
            seed={seed}
            contractState={contractState}
          />
        )}
      </div>
    </MainLayout>
  );
};

// ============================================================================
// Root Application
// ============================================================================

const App: React.FC = () => {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
};

export default App;
