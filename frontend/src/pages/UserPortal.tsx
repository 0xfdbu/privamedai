import { useState, useEffect } from 'react'

interface StoredCredential {
  commitment: string
  claimType: string
  claimValue: string
  expiry: number
  issuer: string
  rawData: string
}

export default function UserPortal() {
  const [creds, setCreds] = useState<StoredCredential[]>([])
  const [selected, setSelected] = useState<StoredCredential | null>(null)
  const [proofStatus, setProofStatus] = useState<string>('')

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('privacred_credentials') || '[]')
    setCreds(stored)
  }, [])

  const generateProof = async () => {
    if (!selected) return
    setProofStatus('Generating ZK proof locally...')
    // In a real app, this would call the Midnight proof provider
    setTimeout(() => {
      const proof = `zk-proof-${selected.commitment.slice(0, 16)}-${Date.now()}`
      navigator.clipboard.writeText(proof)
      setProofStatus(`✅ Proof generated and copied to clipboard!\n${proof}`)
    }, 1200)
  }

  const addDemoCred = () => {
    const demo: StoredCredential = {
      commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      claimType: 'age',
      claimValue: '21',
      expiry: Date.now() + 86400000 * 365,
      issuer: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      rawData: JSON.stringify({ age: 21, over18: true }),
    }
    const updated = [demo, ...creds]
    localStorage.setItem('privacred_credentials', JSON.stringify(updated))
    setCreds(updated)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>User Portal</h2>
      <p style={{ color: '#8888aa' }}>Manage your credentials and generate zero-knowledge proofs.</p>

      <button onClick={addDemoCred} style={{ ...buttonStyle, background: '#1a1a2e', marginBottom: '1rem' }}>
        + Add Demo Credential
      </button>

      {creds.length === 0 ? (
        <p>No credentials stored locally yet.</p>
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
                border: '1px solid #2a2a3e',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ textTransform: 'capitalize' }}>{c.claimType}</strong>
                <span style={{ color: '#8888aa', fontSize: '0.875rem' }}>
                  {new Date(c.expiry).toLocaleDateString()}
                </span>
              </div>
              <div style={{ color: '#a0a0cc', marginTop: '0.25rem' }}>{c.claimValue}</div>
              <div style={{ color: '#6666aa', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {c.commitment.slice(0, 24)}...
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#0f0f1a', borderRadius: '0.5rem' }}>
          <h4>Generate Proof for: {selected.claimType}</h4>
          <p style={{ fontSize: '0.875rem', color: '#8888aa' }}>
            Raw data never leaves your device. Only the ZK proof is shared.
          </p>
          <button onClick={generateProof} style={buttonStyle}>Generate ZK Proof</button>
          {proofStatus && (
            <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#a0a0cc' }}>
              {proofStatus}
            </pre>
          )}
        </div>
      )}
    </div>
  )
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
