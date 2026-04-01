import React, { useState } from 'react';

interface BrowserWalletSetupProps {
  onComplete: () => Promise<void>;
  onRestore: (seed: string) => Promise<void>;
}

export const BrowserWalletSetup: React.FC<BrowserWalletSetupProps> = ({ onComplete, onRestore }) => {
  const [step, setStep] = useState<'menu' | 'created' | 'restore'>('menu');
  const [restoreSeed, setRestoreSeed] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      await onComplete();
      setStep('created');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (restoreSeed.length !== 64) return;
    setIsLoading(true);
    try {
      await onRestore(restoreSeed);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={handleCreate}
          disabled={isLoading}
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
            color: '#070707',
            border: 'none',
            borderRadius: '12px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '16px',
          }}
        >
          {isLoading ? 'Creating...' : '🆕 Create New Wallet'}
        </button>
        <button 
          onClick={() => setStep('restore')}
          style={{
            padding: '16px 24px',
            background: 'rgba(248,250,252,0.05)',
            color: '#f8fafc',
            border: '1px solid rgba(248,250,252,0.1)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '16px',
          }}
        >
          🔑 Restore from Seed
        </button>
      </div>
    );
  }

  if (step === 'restore') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          value={restoreSeed}
          onChange={(e) => setRestoreSeed(e.target.value)}
          placeholder="Enter 64-character seed..."
          style={{
            padding: '16px',
            background: 'rgba(248,250,252,0.05)',
            border: '1px solid rgba(248,250,252,0.1)',
            borderRadius: '12px',
            color: '#f8fafc',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}
        />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleRestore}
            disabled={isLoading || restoreSeed.length !== 64}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: isLoading || restoreSeed.length !== 64 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {isLoading ? 'Restoring...' : 'Restore Wallet'}
          </button>
          <button 
            onClick={() => setStep('menu')}
            style={{
              padding: '16px 24px',
              background: 'transparent',
              color: 'rgba(248,250,252,0.6)',
              border: '1px solid rgba(248,250,252,0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default BrowserWalletSetup;
