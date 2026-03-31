import { useState } from 'react';
import { usePrivaMedAIContract } from '../hooks/usePrivaMedAIContract';
import { Buffer } from 'buffer';
import { createHash } from 'crypto';

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
  credentialData: string;
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
  const [activeTab, setActiveTab] = useState<'issue' | 'manage'>('issue');

  const { 
    state, 
    error, 
    walletAddress: _walletAddress, 
    adminKey: _adminKey,
    isAdmin,
    initialize,
    registerIssuer: _registerIssuer,
    issueCredential,
    batchIssueCredentials: _batchIssueCredentials,
    revokeCredential,
    updateIssuerStatus: _updateIssuerStatus,
    contractAddress 
  } = usePrivaMedAIContract(seed);

  // Generate 32-byte credential data from claim
  const generateCredentialData = (claimType: string, claimValue: string): string => {
    const str = `${claimType}:${claimValue}`;
    // Create 32 bytes by hashing and taking first 32 bytes
    const hash = createHash('sha256').update(str).digest();
    return '0x' + hash.toString('hex');
  };

  const generateClaimHash = (credentialData: string): string => {
    // claimHash is the persistentHash of credentialData
    // For simplicity, we use SHA-256 (matches contract's persistentHash for single element)
    const data = Buffer.from(credentialData.replace('0x', ''), 'hex');
    const hash = createHash('sha256').update(data).digest();
    return '0x' + hash.toString('hex');
  };

  const generateCommitment = (data: any) => {
    // Generate unique commitment based on data + timestamp
    const str = JSON.stringify(data) + Date.now();
    const hash = createHash('sha256').update(str).digest();
    return '0x' + hash.toString('hex');
  };

  const handleInitialize = async () => {
    if (!isAdmin) {
      setStatus('❌ Only the admin can initialize the contract');
      return;
    }
    setIsSubmitting(true);
    setStatus('Initializing contract...');
    try {
      const txId = await initialize();
      setStatus(`✅ Contract initialized! TX: ${txId.slice(0, 40)}...`);
    } catch (e: any) {
      setStatus(`❌ Error: ${e.message || 'Initialization failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssue = async () => {
    if (state !== 'ready') {
      setStatus('❌ Contract not ready yet. Please wait...');
      return;
    }

    setIsSubmitting(true);
    setStatus('Generating credential...');

    try {
      // Generate credential data (32 bytes)
      const credentialData = generateCredentialData(form.claimType, form.claimValue);
      const claimHash = generateClaimHash(credentialData);
      const commitment = generateCommitment({
        subject: form.subject,
        claimType: form.claimType,
        claimValue: form.claimValue,
      });

      setStatus('Submitting transaction to Midnight network...');

      const txId = await issueCredential(
        commitment,
        claimHash,
        form.expiryDays
      );

      const newCred: IssuedCredential = {
        commitment,
        claimType: form.claimType,
        claimValue: form.claimValue,
        credentialData,
        txId,
        timestamp: Date.now(),
      };

      setIssuedCreds((prev) => [newCred, ...prev]);
      setStatus(`✅ Credential issued! Transaction: ${txId.slice(0, 40)}...`);

      // Save to localStorage for demo
      const existing = JSON.parse(localStorage.getItem('privamedai_credentials') || '[]');
      localStorage.setItem('privamedai_credentials', JSON.stringify([newCred, ...existing]));
    } catch (e: any) {
      console.error('Issue error:', e);
      setStatus(`❌ Error: ${e.message || 'Transaction failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (commitment: string) => {
    if (state !== 'ready') {
      setStatus('❌ Contract not ready');
      return;
    }

    setIsSubmitting(true);
    setStatus('Revoking credential...');

    try {
      const txId = await revokeCredential(commitment);
      setStatus(`✅ Credential revoked! TX: ${txId.slice(0, 40)}...`);
    } catch (e: any) {
      setStatus(`❌ Error: ${e.message || 'Revoke failed'}`);
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
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>🏥 PrivaMedAI - Issuer Portal</h2>
        {getStatusBadge()}
      </div>
      
      <p style={{ color: '#8888aa', marginBottom: '1rem' }}>
        Issue and manage verifiable healthcare credentials on the Midnight preprod network.
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
          {isAdmin && <span style={{ color: '#4ade80', marginLeft: '0.5rem' }}>(Admin)</span>}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('issue')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'issue' ? '#4f46e5' : '#1a1a2e',
            color: activeTab === 'issue' ? '#fff' : '#a0a0cc',
          }}
        >
          Issue Credential
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'manage' ? '#4f46e5' : '#1a1a2e',
            color: activeTab === 'manage' ? '#fff' : '#a0a0cc',
          }}
        >
          Manage Issued
        </button>
      </div>

      {activeTab === 'issue' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {isAdmin && (
            <div style={{ padding: '1rem', background: '#1a1a2e', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', color: '#a78bfa' }}>Admin Actions</h4>
              <button
                onClick={handleInitialize}
                disabled={isSubmitting}
                style={{ ...buttonStyle, background: '#7c3aed', fontSize: '0.875rem' }}
              >
                Initialize Contract
              </button>
            </div>
          )}

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
            Credential Type
            <select
              value={form.claimType}
              onChange={(e) => setForm({ ...form, claimType: e.target.value })}
              style={inputStyle}
              disabled={isSubmitting}
            >
              <option value="age">Age Verification</option>
              <option value="vaccination">Vaccination Record</option>
              <option value="insurance">Insurance Coverage</option>
              <option value="medical_degree">Medical Degree</option>
              <option value="license">Medical License</option>
              <option value="clearance">Health Clearance</option>
            </select>
          </label>

          <label>
            Claim Value
            <input
              value={form.claimValue}
              onChange={(e) => setForm({ ...form, claimValue: e.target.value })}
              placeholder="e.g. 21, Pfizer-COVID-19, Active, MD"
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
              whiteSpace: 'pre-wrap',
            }}>
              {status}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && (
        <div>
          <h3>Recently Issued Credentials</h3>
          {issuedCreds.length === 0 ? (
            <div style={{ padding: '2rem', background: '#111122', borderRadius: '0.5rem', textAlign: 'center', color: '#6666aa' }}>
              <p>No credentials issued yet in this session.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {issuedCreds.map((c, i) => (
                <div key={i} style={{ background: '#111122', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #2a2a3e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ textTransform: 'capitalize', color: '#a78bfa' }}>{c.claimType.replace('_', ' ')}</strong>
                    <span style={{ color: '#6666aa', fontSize: '0.75rem' }}>
                      {new Date(c.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: '#a0a0cc', marginBottom: '0.5rem' }}>{c.claimValue}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6666aa', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                    Commitment: {c.commitment}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4ade80', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                    Credential Data (for verification): {c.credentialData}
                  </div>
                  {c.txId && (
                    <div style={{ fontSize: '0.75rem', color: '#8888aa', marginBottom: '0.5rem' }}>
                      TX: {c.txId.slice(0, 40)}...
                    </div>
                  )}
                  <button
                    onClick={() => handleRevoke(c.commitment)}
                    disabled={isSubmitting}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #dc2626',
                      background: '#450a0a',
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
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
