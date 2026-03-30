import { useState } from 'react'
import IssuerPortal from './pages/IssuerPortal'
import UserPortal from './pages/UserPortal'
import VerifierPortal from './pages/VerifierPortal'

type Portal = 'issuer' | 'user' | 'verifier'

function App() {
  const [activePortal, setActivePortal] = useState<Portal>('issuer')

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0a0a0f', color: '#e0e0ff' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #1a1a2e', background: '#0f0f1a' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🌙 PrivaCred
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#8888aa' }}>
          Privacy-first verifiable credentials on Midnight
        </p>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem', padding: '1rem 2rem', background: '#0f0f1a' }}>
        {(['issuer', 'user', 'verifier'] as Portal[]).map((portal) => (
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
            {portal} Portal
          </button>
        ))}
      </nav>

      <main style={{ padding: '2rem' }}>
        {activePortal === 'issuer' && <IssuerPortal />}
        {activePortal === 'user' && <UserPortal />}
        {activePortal === 'verifier' && <VerifierPortal />}
      </main>
    </div>
  )
}

export default App
