import React from 'react';

export const CliInstructions: React.FC = () => {
  return (
    <div className="cli-instructions" style={{
      background: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '8px',
      padding: '20px',
      margin: '20px 0',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h3 style={{ color: '#856404', marginTop: 0 }}>⚠️ Proof Server Version Mismatch</h3>
      <p style={{ color: '#856404' }}>
        The local proof server (v7.0.0-rc.1) is incompatible with the contract (Compact 0.30.0).
      </p>
      
      <h4 style={{ color: '#856404' }}>✅ Use CLI (Recommended - Always Works)</h4>
      <ol style={{ color: '#856404' }}>
        <li>Open a terminal in the project directory</li>
        <li>Run: <code>npm run cli:privamedai</code></li>
        <li>Select option <strong>6</strong> (Issue Credential)</li>
        <li>Enter the credential details</li>
      </ol>
      <p style={{ color: '#856404', fontSize: '14px' }}>
        The CLI uses the wallet's internal proving and bypasses this version issue.
      </p>

      <h4 style={{ color: '#856404' }}>Generate Random Commitment/Claim:</h4>
      <pre style={{
        background: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px',
        overflow: 'auto'
      }}>
{`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`}
      </pre>

      <h4 style={{ color: '#856404' }}>Issuer Public Key:</h4>
      <code style={{
        background: '#f8f9fa',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        wordBreak: 'break-all'
      }}>
        2184034e2bc70671b6e4b1c0318de573b8ed1da4f66b14cec537c3965c4037ce
      </code>

      <p style={{ marginTop: '15px', fontSize: '14px' }}>
        <a href="/PROOF_SERVER_WORKAROUND.md" target="_blank" style={{ color: '#856404' }}>
          📖 View full workaround documentation
        </a>
      </p>
    </div>
  );
};

export default CliInstructions;
