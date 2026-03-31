import { useState } from 'react';
import { usePrivaMedAIContract } from '../hooks/usePrivaMedAIContract';

export default function VerifierPortal({ seed }: { seed: string }) {
  const [proofInput, setProofInput] = useState('');
  const [result, setResult] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  const { state, error, verifyCredential, checkCredentialStatus, contractAddress } = usePrivaMedAIContract(seed);

  const verifyProof = async () => {
    if (!proofInput.trim()) return;
    if (state !== 'ready') {
      setResult({ status: 'error', message: 'Contract not ready. Please wait...' });
      return;
    }

    setResult({ status: 'checking', message: 'Verifying on Midnight preprod network...' });

    try {
      // Parse the proof data
      let proofData: any;
      try {
        proofData = JSON.parse(proofInput);
      } catch {
        // Try to extract commitment from raw string
        const match = proofInput.match(/commitment[":\s]+(0x[a-f0-9]{64})/i);
        if (match) {
          proofData = { commitment: match[1] };
        } else {
          throw new Error('Invalid proof format');
        }
      }

      if (!proofData.commitment || proofData.commitment.length !== 66) {
        throw new Error('Invalid commitment format');
      }

      // For full verification, we need the credentialData
      // The user should have provided this in the proof
      let credentialData = proofData.credentialData;
      
      if (!credentialData) {
        // Try to check status only (won't verify hash match)
        const status = await checkCredentialStatus(proofData.commitment);
        if (status === 0) {
          setResult({
            status: 'valid',
            message: '✅ Credential status: VALID\n\nNote: Full verification requires credential data from the holder.\nThis check only confirms the credential exists and is not revoked.',
          });
        } else if (status === 1) {
          setResult({
            status: 'invalid',
            message: '❌ Credential status: REVOKED\n\nThis credential has been revoked by the issuer.',
          });
        } else {
          setResult({
            status: 'invalid',
            message: '❌ Credential not found\n\nThe provided commitment does not exist on-chain.',
          });
        }
        return;
      }

      // Full verification with credential data
      const txId = await verifyCredential(proofData.commitment, credentialData);
      
      setResult({
        status: 'valid',
        message: `✅ Credential is VALID!\n\nZero-knowledge proof verified on-chain:\n• Credential data hash matches stored claim hash\n• Issuer is verified and active\n• Credential has not been revoked\n\nTransaction: ${txId.slice(0, 40)}...`,
      });
    } catch (err: any) {
      console.error('Verification error:', err);
      const errorMsg = err.message || '';
      
      if (errorMsg.includes('Hash mismatch')) {
        setResult({
          status: 'invalid',
          message: '❌ Hash mismatch!\n\nThe provided credential data does not match the stored claim hash.\nThis could indicate:\n• Wrong credential data provided\n• Credential has been tampered with',
        });
      } else if (errorMsg.includes('revoked')) {
        setResult({
          status: 'invalid',
          message: '❌ Credential REVOKED!\n\nThis credential has been revoked by the issuer.',
        });
      } else if (errorMsg.includes('not found')) {
        setResult({
          status: 'invalid',
          message: '❌ Credential not found!\n\nThe provided commitment does not exist on-chain.',
        });
      } else if (errorMsg.includes('Issuer not active')) {
        setResult({
          status: 'invalid',
          message: '❌ Issuer not active!\n\nThe issuer of this credential has been suspended or revoked.',
        });
      } else {
        setResult({
          status: 'error',
          message: `❌ Error: ${errorMsg || 'Verification failed'}`,
        });
      }
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
        <h2>🔍 PrivaMedAI - Verifier Portal</h2>
        {getStatusBadge()}
      </div>
      
      <p style={{ color: '#8888aa', marginBottom: '1rem' }}>
        Verify healthcare credentials without seeing private data. Only the cryptographic proof is checked on-chain.
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
          Verifying against contract: {contractAddress.slice(0, 40)}...
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <label>
          Paste ZK Proof
          <textarea
            value={proofInput}
            onChange={(e) => setProofInput(e.target.value)}
            rows={8}
            placeholder={`Paste the proof JSON here. For full verification, include credentialData:

{
  "proof": "zk-proof-...",
  "commitment": "0x...",
  "claimType": "vaccination",
  "credentialData": "0x...",  // Required for full verification
  "txId": "...",
  "timestamp": ...
}

Without credentialData, only basic status check is performed.`}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
        </label>

        <button 
          onClick={verifyProof} 
          style={{ ...buttonStyle, marginTop: '0.75rem', opacity: state !== 'ready' ? 0.6 : 1 }}
          disabled={state !== 'ready'}
        >
          Verify Proof
        </button>

        {result.status !== 'idle' && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '0.5rem',
              background: result.status === 'valid' ? '#064e3b' : result.status === 'invalid' ? '#450a0a' : result.status === 'error' ? '#450a0a' : '#1a1a2e',
              color: result.status === 'valid' ? '#86efac' : result.status === 'invalid' || result.status === 'error' ? '#fca5a5' : '#e0e0ff',
              whiteSpace: 'pre-wrap',
              fontSize: '0.875rem',
            }}
          >
            {result.message}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#111122', borderRadius: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: '#a78bfa' }}>🔒 What the verifier sees:</h4>
        <ul style={{ color: '#8888aa', paddingLeft: '1.25rem', margin: 0 }}>
          <li>✓ Credential status: VALID or REVOKED</li>
          <li>✓ Issuer identity (public key)</li>
          <li>✓ Proof timestamp</li>
          <li>✓ Claim hash matches (without seeing actual data)</li>
          <li style={{ color: '#4ade80' }}>✓ NO raw health data is revealed</li>
        </ul>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f0f1a', borderRadius: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: '#fbbf24' }}>⚠️ What the verifier CANNOT see:</h4>
        <ul style={{ color: '#8888aa', paddingLeft: '1.25rem', margin: 0 }}>
          <li>✗ Actual health records or test results</li>
          <li>✗ Patient identity beyond the credential</li>
          <li>✗ Medical history details</li>
          <li>✗ Personal identifying information</li>
        </ul>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a2e', borderRadius: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', color: '#60a5fa' }}>ℹ️ Verification Modes:</h4>
        <div style={{ color: '#8888aa', fontSize: '0.875rem' }}>
          <p><strong>Full Verification:</strong> Requires credentialData from the holder. Verifies hash match + issuer status + revocation status.</p>
          <p><strong>Status Check Only:</strong> Only checks if credential exists and is not revoked. Does not verify the holder actually possesses the credential.</p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid #2a2a2e',
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
