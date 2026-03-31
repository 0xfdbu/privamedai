import { useState } from 'react';
import { usePrivaCredContract } from '../hooks/usePrivaCredContract';
import { Buffer } from 'buffer';

interface CredentialForm {
  subject: string;
  claimType: string;
  claimValue: string;
  expiryDays: number;
}

interface IssuedCredential {
  commitment: string;
  claimType: string;
  claimValue: string;
  txId?: string;
  timestamp: number;
}

export default function IssuerPortal({ seed }: { seed: string }) {
  const [form, setForm] = useState<CredentialForm>({
    subject: '',
    claimType: 'age',
    claimValue: '',
    expiryDays: 365,
  });
  const [status, setStatus] = useState<string>('');
  const [issuedCreds, setIssuedCreds] = useState<IssuedCredential[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { state, error, walletAddress, issueCredential, contractAddress } = usePrivaCredContract(seed);

  const generateCommitment = (data: any) => {
    // Simple hash for demo - in production use proper hashing
    const str = JSON.stringify(data) + Date.now();
    return '0x' + Array(64).fill(0).map((_, i) => {
      return ((str.charCodeAt(i % str.length) + i * 17) % 16).toString(16);
    }).join('');
  };

  const generateClaimHash = (claimType: string, claimValue: string) => {
    const str = `${claimType}:${claimValue}`;
    return '0x' + Array(64).fill(0).map((_, i) => {
      return ((str.charCodeAt(i % str.length) + i * 13) % 16).toString(16);
    }).join('');
  };

  const handleIssue = async () => {
    if (state !== 'ready') {
      setStatus('❌ Contract not ready yet. Please wait...');
      return;
    }

    setIsSubmitting(true);
    setStatus('Generating credential commitment...');

    try {
      const commitment = generateCommitment({
        subject: form.subject,
        claimType: form.claimType,
        claimValue: form.claimValue,
      });

      const claimHash = generateClaimHash(form.claimType, form.claimValue);
      const issuerKey = walletAddress || '0x' + '0'.repeat(64);

      setStatus('Submitting transaction to Midnight network...');

      const txId = await issueCredential(
        commitment,
        issuerKey,
        claimHash,
        form.expiryDays
      );

      const newCred: IssuedCredential = {
        commitment,
        claimType: form.claimType,
        claimValue: form.claimValue,
        txId,
        timestamp: Date.now(),
      };

      setIssuedCreds((prev) => [newCred, ...prev]);
      setStatus(`✅ Credential issued! Transaction: ${txId.slice(0, 20)}...`);

      // Also save to API for backend tracking
      try {
        await fetch('/api/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            commitment,
            claimHash,
            txId,
          }),
        });
      } catch (e) {
        // API might not be running, that's ok
      }
    } catch (e: any) {
      console.error('Issue error:', e);
      setStatus(`❌ Error: ${e.message || 'Transaction failed'}`);
    } finally {
      setIsSubmitting(false);
    }
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
        <h2>Issuer Portal</h2>
        {getStatusBadge()}
      </div>
      
      <p style={{ color: '#8888aa', marginBottom: '1rem' }}>
        Create and sign verifiable credentials for subjects on the Midnight preprod network.
      </p>

      {contractAddress && (
        <div style={{ 
          padding: '0.75rem', 
          background: '#0f0f1a', 
          borderRadius: '0.375rem', 
          marginBottom: '1rem',
          fontSize: '0.75rem',
          color: '#6666aa',
          wordBreak: 'break-all'
        }}>
          Contract: {contractAddress}
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        <label>
          Subject Address
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="0x... (recipient's public key)"
            style={inputStyle}
            disabled={isSubmitting}
          />
        </label>

        <label>
          Claim Type
          <select
            value={form.claimType}
            onChange={(e) => setForm({ ...form, claimType: e.target.value })}
            style={inputStyle}
            disabled={isSubmitting}
          >
            <option value="age">Age Over</option>
            <option value="education">Education Degree</option>
            <option value="health">Health Status</option>
            <option value="employment">Employment</option>
            <option value="membership">Membership</option>
          </select>
        </label>

        <label>
          Claim Value
          <input
            value={form.claimValue}
            onChange={(e) => setForm({ ...form, claimValue: e.target.value })}
            placeholder="e.g. 18, BSc, Clear, Active"
            style={inputStyle}
            disabled={isSubmitting}
          />
        </label>

        <label>
          Expiry (days)
          <input
            type="number"
            value={form.expiryDays}
            onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
            style={inputStyle}
            min={1}
            max={3650}
            disabled={isSubmitting}
          />
        </label>

        <button 
          onClick={handleIssue} 
          style={{ ...buttonStyle, opacity: isSubmitting || state !== 'ready' ? 0.6 : 1 }}
          disabled={isSubmitting || state !== 'ready'}
        >
          {isSubmitting ? '⏳ Issuing...' : 'Issue Credential'}
        </button>
        
        {status && (
          <div style={{ 
            padding: '0.75rem', 
            background: status.startsWith('✅') ? '#064e3b' : status.startsWith('❌') ? '#450a0a' : '#1a1a2e',
            borderRadius: '0.375rem',
            color: status.startsWith('✅') ? '#86efac' : status.startsWith('❌') ? '#fca5a5' : '#e0e0ff',
            fontSize: '0.875rem',
          }}>
            {status}
          </div>
        )}
      </div>

      {issuedCreds.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Recently Issued</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {issuedCreds.map((c, i) => (
              <div key={i} style={{ background: '#111122', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #2a2a3e' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ textTransform: 'capitalize', color: '#a78bfa' }}>{c.claimType}</strong>
                  <span style={{ color: '#6666aa', fontSize: '0.75rem' }}>
                    {new Date(c.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: '#a0a0cc', marginBottom: '0.5rem' }}>{c.claimValue}</div>
                <div style={{ fontSize: '0.75rem', color: '#6666aa', wordBreak: 'break-all' }}>
                  Commitment: {c.commitment}
                </div>
                {c.txId && (
                  <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '0.25rem' }}>
                    TX: {c.txId.slice(0, 40)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid #2a2a3e',
  background: '#111122',
  color: '#e0e0ff',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
