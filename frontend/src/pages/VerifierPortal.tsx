import { useState } from 'react'

export default function VerifierPortal() {
  const [proofInput, setProofInput] = useState('')
  const [result, setResult] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid'; message: string }>({
    status: 'idle',
    message: '',
  })

  const verifyProof = async () => {
    if (!proofInput.trim()) return
    setResult({ status: 'checking', message: 'Verifying on Midnight testnet...' })

    // In a real app, this would query the contract's verifyCredential circuit
    setTimeout(() => {
      const isValid = proofInput.startsWith('zk-proof-')
      setResult({
        status: isValid ? 'valid' : 'invalid',
        message: isValid
          ? '✅ Credential is VALID. Zero-knowledge proof verified on-chain.'
          : '❌ Invalid proof or credential not found.',
      })
    }, 1500)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Verifier Portal</h2>
      <p style={{ color: '#8888aa' }}>Verify credentials without seeing any private data.</p>

      <div style={{ marginTop: '1.5rem' }}>
        <label>
          Paste ZK Proof
          <textarea
            value={proofInput}
            onChange={(e) => setProofInput(e.target.value)}
            rows={4}
            placeholder="Paste the proof string here..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <button onClick={verifyProof} style={{ ...buttonStyle, marginTop: '0.75rem' }}>
          Verify Proof
        </button>

        {result.status !== 'idle' && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '0.5rem',
              background: result.status === 'valid' ? '#064e3b' : result.status === 'invalid' ? '#450a0a' : '#1a1a2e',
              color: result.status === 'valid' ? '#86efac' : result.status === 'invalid' ? '#fca5a5' : '#e0e0ff',
            }}
          >
            {result.message}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#111122', borderRadius: '0.5rem' }}>
        <h4>What the verifier sees:</h4>
        <ul style={{ color: '#8888aa', paddingLeft: '1.25rem' }}>
          <li>Credential status: VALID or REVOKED</li>
          <li>Proof timestamp</li>
          <li>Issuer identity (public key)</li>
          <li>NO raw claim values</li>
        </ul>
      </div>
    </div>
  )
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
}

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
}
