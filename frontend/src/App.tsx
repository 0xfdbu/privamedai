import { useState } from 'react';
import { WalletProvider, useWallet } from './hooks/WalletContext';
import IssuerPortal from './pages/IssuerPortal';
import UserPortal from './pages/UserPortal';
import VerifierPortal from './pages/VerifierPortal';

function WalletConnect({ onConnect }: { onConnect: (seed: string) => void }) {
  const [seed, setSeed] = useState('');

  const handleConnect = () => {
    if (seed.trim().length === 64) {
      onConnect(seed.trim());
    } else {
      alert('Please enter a valid 64-character hex seed');
    }
  };

  const generateRandom = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    setSeed(hex);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#0a0a0f',
      color: '#e0e0ff',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: 500, 
        width: '100%',
        background: '#111122',
        borderRadius: '1rem',
        padding: '2rem',
        border: '1px solid #2a2a3e'
      }}>
        <h1 style={{ 
          margin: '0 0 0.5rem', 
          fontSize: '1.75rem',
          background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent' 
        }}>
          🏥 PrivaMedAI
        </h1>
        <p style={{ color: '#8888aa', marginBottom: '0.5rem' }}>
          Enterprise Healthcare Credentials on Midnight
        </p>
        <p style={{ color: '#6666aa', fontSize: '0.75rem', marginBottom: '2rem' }}>
          Privacy-first verifiable credentials for hospitals, clinics, and healthcare providers
        </p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <label>
            Wallet Seed (64 hex chars)
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Enter your wallet seed..."
              rows={3}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #2a2a3e',
                background: '#0a0a0f',
                color: '#e0e0ff',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                resize: 'none',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleConnect}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Connect Wallet
            </button>
            <button
              onClick={generateRandom}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #2a2a3e',
                background: '#1a1a2e',
                color: '#a0a0cc',
                cursor: 'pointer',
              }}
            >
              🎲 Generate
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#0f0f1a', borderRadius: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>⚠️ Important</h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#8888aa' }}>
            Your wallet must be funded with tNight tokens from the{' '}
            <a href="https://faucet.preprod.midnight.network/" target="_blank" rel="noopener" style={{ color: '#60a5fa' }}>
              Midnight preprod faucet
            </a>
            . The local proof server must also be running on port 6300.
          </p>
        </div>

        <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#a78bfa' }}>🔒 Privacy Features</h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#8888aa' }}>
            <li>Zero-knowledge proofs for credential verification</li>
            <li>Private health data never leaves your device</li>
            <li>On-chain verification without data exposure</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const { seed, isConnected, connect, disconnect } = useWallet();
  const [activePortal, setActivePortal] = useState<'issuer' | 'user' | 'verifier'>('issuer');

  if (!isConnected || !seed) {
    return <WalletConnect onConnect={connect} />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0a0a0f', color: '#e0e0ff' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #1a1a2e', background: '#0f0f1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏥 PrivaMedAI
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#8888aa' }}>
            Enterprise Healthcare Credentials on Midnight
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: '#4ade80', fontSize: '0.875rem' }}>● Connected</span>
          <button
            onClick={disconnect}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #2a2a3e',
              background: '#1a1a2e',
              color: '#a0a0cc',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Disconnect
          </button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem', padding: '1rem 2rem', background: '#0f0f1a' }}>
        {(['issuer', 'user', 'verifier'] as const).map((portal) => (
          <button
            key={portal}
            onClick={() => setActivePortal(portal)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              textTransform: 'capitalize',
              background: activePortal === portal ? '#4f46e5' : '#1a1a2e',
              color: activePortal === portal ? '#fff' : '#a0a0cc',
            }}
          >
            {portal === 'issuer' ? '🏥 Issuer' : portal === 'user' ? '👤 User' : '🔍 Verifier'} Portal
          </button>
        ))}
      </nav>

      <main style={{ padding: '2rem' }}>
        {activePortal === 'issuer' && <IssuerPortal seed={seed} />}
        {activePortal === 'user' && <UserPortal seed={seed} />}
        {activePortal === 'verifier' && <VerifierPortal seed={seed} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
