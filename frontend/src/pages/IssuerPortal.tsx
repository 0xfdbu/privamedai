import { useState } from 'react'

interface CredentialForm {
  subject: string
  claimType: string
  claimValue: string
  expiryDays: number
}

export default function IssuerPortal() {
  const [form, setForm] = useState<CredentialForm>({
    subject: '',
    claimType: 'age',
    claimValue: '',
    expiryDays: 365,
  })
  const [status, setStatus] = useState<string>('')
  const [issuedCreds, setIssuedCreds] = useState<any[]>([])

  const handleIssue = async () => {
    setStatus('Issuing credential...')
    try {
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setStatus(`✅ Credential issued! Commitment: ${data.commitment.slice(0, 16)}...`)
        setIssuedCreds((prev) => [data, ...prev])
      } else {
        setStatus(`❌ Error: ${data.error}`)
      }
    } catch (e: any) {
      setStatus(`❌ Error: ${e.message}`)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Issuer Portal</h2>
      <p style={{ color: '#8888aa' }}>Create and sign verifiable credentials for subjects.</p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        <label>
          Subject Address
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="0x..."
            style={inputStyle}
          />
        </label>

        <label>
          Claim Type
          <select
            value={form.claimType}
            onChange={(e) => setForm({ ...form, claimType: e.target.value })}
            style={inputStyle}
          >
            <option value="age">Age Over</option>
            <option value="education">Education Degree</option>
            <option value="health">Health Status</option>
            <option value="employment">Employment</option>
          </select>
        </label>

        <label>
          Claim Value
          <input
            value={form.claimValue}
            onChange={(e) => setForm({ ...form, claimValue: e.target.value })}
            placeholder="e.g. 18, BSc, Clear"
            style={inputStyle}
          />
        </label>

        <label>
          Expiry (days)
          <input
            type="number"
            value={form.expiryDays}
            onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <button onClick={handleIssue} style={buttonStyle}>Issue Credential</button>
        {status && <p>{status}</p>}
      </div>

      {issuedCreds.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Recently Issued</h3>
          <ul style={{ padding: 0, listStyle: 'none' }}>
            {issuedCreds.map((c, i) => (
              <li key={i} style={{ background: '#111122', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                <strong>{c.claimType}</strong>: {c.claimValue} <br />
                <small style={{ color: '#6666aa' }}>Commitment: {c.commitment}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
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
