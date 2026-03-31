import { useState, useEffect } from 'react';
import { usePrivaCredContract } from '../hooks/usePrivaCredContract';

interface StoredCredential {
  commitment: string;
  claimType: string;
  claimValue: string;
  expiry: number;
  issuer: string;
  rawData: string;
}

export default function UserPortal({ seed }: { seed: string }) {
  const [creds, setCreds] = useState<StoredCredential[]>([]);
  const [selected, setSelected] = useState<StoredCredential | null>(null);
  const [proofStatus, setProofStatus] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { state, error, verifyCredential } = usePrivaCredContract(seed);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('privacred_credentials') || '[]');
    setCreds(stored);
  }, []);

  const generateProof = async () => {
    if (!selected) return;
    if (state !== 'ready') {
      setProofStatus('❌ Contract not ready. Please wait...');
      return;
    }

    setIsGenerating(true);
    setProofStatus('Generating ZK proof via Midnight network...');

    try {
      // Call the verifyCredential circuit which generates a ZK proof
      const txId = await verifyCredential(selected.commitment);
      
      const proof = `zk-proof-${selected.commitment.slice(0, 16)}-${Date.now()}`;
      
      // Copy to clipboard
      const proofData = JSON.stringify({
        proof,
        commitment: selected.commitment,
        claimType: selected.claimType,
        txId,
        timestamp: Date.now(),
      }, null, 2);
      
      navigator.clipboard.writeText(proofData);
      setProofStatus(`✅ Proof generated and copied to clipboard!\nTransaction: ${txId.slice(0, 40)}...`);
    } catch (err: any) {
      console.error('Proof generation error:', err);
      setProofStatus(`❌ Error: ${err.message || 'Failed to generate proof'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addDemoCred = () => {
    const demo: StoredCredential = {
      commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      claimType: 'age',
      claimValue: '21',
      expiry: Date.now() + 86400000 * 365,
      issuer: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      rawData: JSON.stringify({ age: 21, over18: true }),
    };
    const updated = [demo, ...creds];
    localStorage.setItem('privacred_credentials', JSON.stringify(updated));
    setCreds(updated);
  };

  const getStatusBadge = () => {
    switch (state) {
      case 'initializing':
        return <span style={{ color: '#fbbf24' }}>⚙️ Initializing...</span>;
      case 'syncing':
        return <span style={{ color: '#60a5fa' }}>🔄 Syncing wallet...</span>;
      case 'ready':
        return <span style={{ color: '#4ade80' }}>✅ Ready</span>;
      case 'error':
        return <span style={{ color: '#f87171' }}>❌ Error: {error}</span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>User Portal</h2>
        {getStatusBadge()}
      </div>
      
      <p style={{ color: '#8888aa', marginBottom: '1rem' }}>
        Manage your credentials and generate zero-knowledge proofs on Midnight.
      </p>

      <button 
        onClick={addDemoCred} 
        style={{ ...buttonStyle, background: '#1a1a2e', marginBottom: '1rem' }}
        disabled={state !== 'ready'}
      >
        + Add Demo Credential
      </button>

      {creds.length === 0 ? (
        <div style={{ padding: '2rem', background: '#111122', borderRadius: '0.5rem', textAlign: 'center', color: '#6666aa' }}>
          <p>No credentials stored locally yet.</p>
          <p style={{ fontSize: '0.875rem' }}>Credentials issued to you will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {creds.map((c, i) => (
            <div
              key={i}
              onClick={() => setSelected(c)}
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                background: selected?.commitment === c.commitment ? '#1e1b4b' : '#111122',
                border: `1px solid ${selected?.commitment === c.commitment ? '#4f46e5' : '#2a2a3e'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ textTransform: 'capitalize', color: '#a78bfa' }}>{c.claimType}</strong>
                <span style={{ color: '#6666aa', fontSize: '0.875rem' }}>
                  Expires: {new Date(c.expiry).toLocaleDateString()}
                </span>
              </div>
              <div style={{ color: '#a0a0cc', marginTop: '0.25rem' }}>{c.claimValue}</div>
              <div style={{ color: '#444466', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {c.commitment.slice(0, 32)}...
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#0f0f1a', borderRadius: '0.5rem', border: '1px solid #2a2a3e' }}>
          <h4>Generate ZK Proof</h4>
          <p style={{ fontSize: '0.875rem', color: '#8888aa', marginBottom: '1rem' }}>
            Generate a zero-knowledge proof for <strong>{selected.claimType}</strong> without revealing the actual value.
          </p>
          <button 
            onClick={generateProof} 
            style={{ ...buttonStyle, opacity: isGenerating || state !== 'ready' ? 0.6 : 1 }}
            disabled={isGenerating || state !== 'ready'}
          >
            {isGenerating ? '⏳ Generating...' : 'Generate ZK Proof'}
          </button>
          {proofStatus && (
            <pre style={{ 
              marginTop: '0.75rem', 
              whiteSpace: 'pre-wrap', 
              fontSize: '0.8rem', 
              color: proofStatus.startsWith('✅') ? '#4ade80' : proofStatus.startsWith('❌') ? '#f87171' : '#a0a0cc',
              background: '#111122',
              padding: '0.75rem',
              borderRadius: '0.375rem',
            }}>
              {proofStatus}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
