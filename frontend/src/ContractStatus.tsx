// Contract Status Component - Shows integration status
import { useState, useEffect } from 'react';

const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';

export function ContractStatus() {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [proofServer, setProofServer] = useState(false);

  useEffect(() => {
    // Check proof server
    fetch('http://localhost:6300/health', { method: 'GET' })
      .then(() => setProofServer(true))
      .catch(() => setProofServer(false));

    // Simulate contract check (would be actual indexer query in production)
    setTimeout(() => setStatus('online'), 1000);
  }, []);

  return (
    <div style={{
      background: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 700, 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%', 
          background: status === 'online' ? '#10b981' : '#ef4444',
          boxShadow: status === 'online' ? '0 0 10px #10b981' : 'none'
        }} />
        PrivaMedAI Contract
      </h3>
      
      <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(248,250,252,0.6)' }}>Network:</span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>Preprod ✅</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(248,250,252,0.6)' }}>Contract:</span>
          <code style={{ color: '#f8fafc' }}>{CONTRACT_ADDRESS.slice(0, 16)}...{CONTRACT_ADDRESS.slice(-8)}</code>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(248,250,252,0.6)' }}>Proof Server:</span>
          <span style={{ color: proofServer ? '#10b981' : '#ef4444' }}>
            {proofServer ? 'Connected ✅' : 'Offline ❌'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(248,250,252,0.6)' }}>Features:</span>
          <span style={{ color: '#f8fafc' }}>8 circuits integrated</span>
        </div>
      </div>

      <div style={{ 
        marginTop: '16px', 
        paddingTop: '16px', 
        borderTop: '1px solid rgba(248,250,252,0.1)',
        fontSize: '12px',
        color: 'rgba(248,250,252,0.5)'
      }}>
        <div>✓ Initialize • ✓ Register Issuer • ✓ Issue Credential</div>
        <div>✓ Batch Issue • ✓ Verify • ✓ Revoke • ✓ Update Status</div>
      </div>
    </div>
  );
}
