import { useState, useEffect } from 'react';
import './styles/theme.css';
import { WalletProvider, useWallet } from './hooks/WalletContext';
import { usePrivaMedAIContract } from './hooks/usePrivaMedAIContract';

// Icons as simple components
const IconCheck = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

const IconHospital = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 6v4"/><path d="M14 10h-4"/><path d="M18 22V8l-6-4-6 4v14"/>
  </svg>
);

const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
  </svg>
);

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
  </svg>
);

// Styles
const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: 'var(--bg)' },
  
  // Login Screen
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '40px',
  },
  logo: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, var(--primary), #a855f7)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    color: 'white',
    fontSize: '24px',
    fontWeight: 'bold',
  },
  title: { fontSize: '24px', fontWeight: '700', textAlign: 'center', marginBottom: '8px' },
  subtitle: { fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'monospace',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text)',
    outline: 'none',
    resize: 'none',
  },
  label: { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text)' },
  buttonPrimary: {
    width: '100%',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  buttonSecondary: {
    width: '100%',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  alert: {
    padding: '12px 16px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '10px',
    fontSize: '13px',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  
  // Main Layout
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 100,
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: '64px',
    bottom: 0,
    width: '260px',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '20px',
    overflowY: 'auto',
  },
  main: {
    marginLeft: '260px',
    marginTop: '64px',
    padding: '32px',
    minHeight: 'calc(100vh - 64px)',
  },
  navItem: {
    width: '100%',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '10px',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  navItemActive: {
    background: 'var(--primary)',
    color: 'white',
  },
  
  // Cards
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '24px',
  },
  cardHeader: { marginBottom: '20px' },
  cardTitle: { fontSize: '18px', fontWeight: '600', marginBottom: '4px' },
  cardSubtitle: { fontSize: '14px', color: 'var(--text-muted)' },
  
  // Form Elements
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text)',
    outline: 'none',
  },
  
  // Status
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '20px',
    background: 'rgba(34, 197, 94, 0.1)',
    color: 'var(--success)',
  },
  
  // List Items
  listItem: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  
  // Mobile Nav
  mobileNav: {
    display: 'none',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    padding: '12px',
    justifyContent: 'space-around',
  },
};

// Media queries for mobile
const mobileStyles = `
  @media (max-width: 768px) {
    .sidebar { display: none !important; }
    .main { margin-left: 0 !important; padding: 20px !important; padding-bottom: 80px !important; }
    .mobileNav { display: flex !important; }
  }
`;

// Login Component
function LoginScreen({ onConnect }: { onConnect: (seed: string) => void }) {
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    if (seed.length === 64) {
      setLoading(true);
      onConnect(seed);
    }
  };

  const generate = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    setSeed(Array.from(arr, b => b.toString(16).padStart(2, '0')).join(''));
  };

  return (
    <div style={styles.loginContainer}>
      <style>{mobileStyles}</style>
      <div style={styles.loginCard}>
        <div style={styles.logo}>P</div>
        <h1 style={styles.title}>PrivaMedAI</h1>
        <p style={styles.subtitle}>Healthcare Credentials on Midnight</p>

        <div style={{ marginBottom: '20px' }}>
          <label style={styles.label}>Wallet Seed</label>
          <textarea
            style={{ ...styles.input, height: '80px' }}
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="64 character hex seed..."
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{seed.length}/64</span>
            {seed.length === 64 && <span style={{ color: 'var(--success)' }}><IconCheck /> Valid</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button style={styles.buttonSecondary} onClick={generate}>Generate</button>
          <button 
            style={{ ...styles.buttonPrimary, opacity: seed.length !== 64 || loading ? 0.6 : 1 }}
            onClick={handleConnect}
            disabled={seed.length !== 64 || loading}
          >
            {loading ? <><IconLoader /> Connecting...</> : 'Connect Wallet'}
          </button>
        </div>

        <div style={styles.alert}>
          <IconAlert />
          <span>Get tNight tokens from the <a href="https://faucet.preprod.midnight.network/" target="_blank" style={{ color: 'var(--primary)' }}>faucet</a>. Proof server must run on port 6300.</span>
        </div>
      </div>
    </div>
  );
}

// Issuer Portal
function IssuerPortal({ seed, contractState }: { seed: string; contractState: string }) {
  const { issueCredential, revokeCredential } = usePrivaMedAIContract(seed);
  const [tab, setTab] = useState<'issue' | 'manage'>('issue');
  const [form, setForm] = useState({ subject: '', type: 'vaccination', value: '', days: 365 });
  const [issued, setIssued] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });
  const [loading, setLoading] = useState(false);

  const isReady = contractState === 'ready';

  const hash = (s: string) => '0x' + Array(64).fill(0).map((_, i) => ((s.charCodeAt(i % s.length) + i * 17) % 16).toString(16)).join('');

  const handleIssue = async () => {
    if (!isReady) return;
    setLoading(true);
    setStatus({ type: null, msg: '' });
    try {
      const credData = hash(`${form.type}:${form.value}`);
      const claimHash = hash(credData);
      const commitment = hash(JSON.stringify(form) + Date.now());
      
      const txId = await issueCredential(commitment, claimHash, form.days);
      
      const newCred = { ...form, commitment, credData, txId, time: Date.now() };
      setIssued([newCred, ...issued]);
      setStatus({ type: 'success', msg: `Issued! TX: ${txId.slice(0, 40)}...` });
      setForm({ ...form, value: '', subject: '' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Issuer Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Issue healthcare credentials</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.buttonSecondary, width: 'auto', padding: '10px 20px', background: tab === 'issue' ? 'var(--primary)' : undefined, color: tab === 'issue' ? 'white' : undefined }} onClick={() => setTab('issue')}>Issue</button>
          <button style={{ ...styles.buttonSecondary, width: 'auto', padding: '10px 20px', background: tab === 'manage' ? 'var(--primary)' : undefined, color: tab === 'manage' ? 'white' : undefined }} onClick={() => setTab('manage')}>Manage ({issued.length})</button>
        </div>
      </div>

      {status.type && (
        <div style={{ ...styles.alert, background: status.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderColor: status.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)', marginBottom: '20px' }}>
          {status.type === 'success' ? <IconCheck /> : <IconX />}
          {status.msg}
        </div>
      )}

      {tab === 'issue' ? (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Issue New Credential</div>
            <div style={styles.cardSubtitle}>Create a verifiable healthcare credential</div>
          </div>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={styles.label}>Subject Address</label>
              <input style={styles.input} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="0x..." />
            </div>
            <div>
              <label style={styles.label}>Credential Type</label>
              <select style={styles.select} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="age">Age Verification</option>
                <option value="vaccination">Vaccination</option>
                <option value="insurance">Insurance</option>
                <option value="license">Medical License</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Claim Value</label>
              <input style={styles.input} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="e.g., COVID-19, MD-12345" />
            </div>
            <div>
              <label style={styles.label}>Expiry (days)</label>
              <input style={styles.input} type="number" value={form.days} onChange={e => setForm({ ...form, days: +e.target.value })} />
            </div>
            <button style={{ ...styles.buttonPrimary, opacity: loading || !isReady ? 0.6 : 1 }} onClick={handleIssue} disabled={loading || !isReady}>
              {loading ? <><IconLoader /> Issuing...</> : <><IconLock /> Issue Credential</>}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {issued.length === 0 ? (
            <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No Credentials</h3>
              <p style={{ color: 'var(--text-muted)' }}>Issue your first credential to see it here</p>
            </div>
          ) : (
            issued.map((c, i) => (
              <div key={i} style={styles.listItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={styles.badge}><IconCheck size={12} /> Active</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(c.time).toLocaleString()}</span>
                    </div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize', marginBottom: '4px' }}>{c.type}</h4>
                    <p style={{ color: 'var(--text)', marginBottom: '8px' }}>{c.value}</p>
                    <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.commitment.slice(0, 50)}...</code>
                  </div>
                  <button style={{ ...styles.buttonSecondary, width: 'auto', padding: '8px 12px' }} onClick={() => revokeCredential(c.commitment)}>
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// User Portal
function UserPortal({ seed, contractState }: { seed: string; contractState: string }) {
  const { verifyCredential } = usePrivaMedAIContract(seed);
  const [creds, setCreds] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const isReady = contractState === 'ready';

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('privamedai_creds') || '[]');
    setCreds(stored);
  }, []);

  const addDemo = () => {
    const demo = {
      commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      type: 'vaccination',
      value: 'COVID-19-Pfizer',
      credData: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      expiry: Date.now() + 86400000 * 365,
    };
    const updated = [demo, ...creds];
    localStorage.setItem('privamedai_creds', JSON.stringify(updated));
    setCreds(updated);
  };

  const generateProof = async () => {
    if (!selected || !isReady) return;
    setLoading(true);
    try {
      const txId = await verifyCredential(selected.commitment, selected.credData);
      const proof = JSON.stringify({ ...selected, txId, time: Date.now() }, null, 2);
      navigator.clipboard.writeText(proof);
      setMsg('Proof copied to clipboard!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700' }}>User Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage credentials & generate proofs</p>
        </div>
        <button style={{ ...styles.buttonSecondary, width: 'auto' }} onClick={addDemo}><IconPlus /> Add Demo</button>
      </div>

      {msg && <div style={{ ...styles.alert, marginBottom: '20px' }}><IconCheck /> {msg}</div>}

      {creds.length === 0 ? (
        <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          <p style={{ color: 'var(--text-muted)' }}>No credentials stored</p>
        </div>
      ) : (
        <>
          {creds.map((c, i) => (
            <div key={i} style={{ ...styles.listItem, borderColor: selected?.commitment === c.commitment ? 'var(--primary)' : undefined }} onClick={() => setSelected(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={styles.badge}>Valid</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expires {new Date(c.expiry).toLocaleDateString()}</span>
                  </div>
                  <h4 style={{ fontWeight: '600', textTransform: 'capitalize' }}>{c.type}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{c.value}</p>
                </div>
                {selected?.commitment === c.commitment && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
            </div>
          ))}

          {selected && (
            <div style={{ ...styles.card, marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Generate ZK Proof</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>Create a privacy-preserving proof for {selected.type}</p>
              <button style={{ ...styles.buttonPrimary, opacity: loading ? 0.6 : 1 }} onClick={generateProof} disabled={loading}>
                {loading ? <><IconLoader /> Generating...</> : <><IconCopy /> Generate & Copy Proof</>}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Verifier Portal
function VerifierPortal({ seed, contractState }: { seed: string; contractState: string }) {
  const { verifyCredential } = usePrivaMedAIContract(seed);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ status: string; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const isReady = contractState === 'ready';

  const verify = async () => {
    if (!input.trim() || !isReady) return;
    setLoading(true);
    setResult(null);
    try {
      const data = JSON.parse(input);
      const txId = await verifyCredential(data.commitment, data.credData);
      setResult({ status: 'success', msg: `Valid! Transaction: ${txId}` });
    } catch (e: any) {
      setResult({ status: 'error', msg: e.message || 'Invalid proof' });
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Verifier Portal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Verify credentials without seeing private data</p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Verify Credential</div>
          <div style={styles.cardSubtitle}>Paste a zero-knowledge proof</div>
        </div>
        <textarea style={{ ...styles.input, height: '200px', marginBottom: '16px' }} value={input} onChange={e => setInput(e.target.value)} placeholder="Paste proof JSON here..." />
        <button style={{ ...styles.buttonPrimary, opacity: loading || !isReady ? 0.6 : 1 }} onClick={verify} disabled={loading || !isReady}>
          {loading ? <><IconLoader /> Verifying...</> : <><IconSearch /> Verify Proof</>}
        </button>
      </div>

      {result && (
        <div style={{ ...styles.card, background: result.status === 'success' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {result.status === 'success' ? <div style={{ color: 'var(--success)' }}><IconCheck /></div> : <div style={{ color: 'var(--error)' }}><IconX /></div>}
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{result.msg}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Main App
function MainApp() {
  const { seed, isConnected, connect, disconnect } = useWallet();
  const { state: contractState, walletAddress } = usePrivaMedAIContract(seed || '');
  const [portal, setPortal] = useState<'issuer' | 'user' | 'verifier'>('issuer');

  if (!isConnected || !seed) {
    return <LoginScreen onConnect={connect} />;
  }

  return (
    <div style={styles.app}>
      <style>{mobileStyles}</style>
      
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, var(--primary), #a855f7)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>P</div>
          <span style={{ fontWeight: '700', fontSize: '18px' }}>PrivaMedAI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {walletAddress && (
            <code style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface)', padding: '6px 12px', borderRadius: '6px' }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </code>
          )}
          <button style={{ ...styles.buttonSecondary, width: 'auto', padding: '8px 16px' }} onClick={disconnect}>Disconnect</button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar" style={styles.sidebar}>
        <nav>
          <button style={{ ...styles.navItem, ...(portal === 'issuer' ? styles.navItemActive : {}) }} onClick={() => setPortal('issuer')}>
            <IconHospital /> Issuer Portal
          </button>
          <button style={{ ...styles.navItem, ...(portal === 'user' ? styles.navItemActive : {}) }} onClick={() => setPortal('user')}>
            <IconUser /> User Portal
          </button>
          <button style={{ ...styles.navItem, ...(portal === 'verifier' ? styles.navItemActive : {}) }} onClick={() => setPortal('verifier')}>
            <IconShield /> Verifier Portal
          </button>
        </nav>
        
        <div style={{ marginTop: '40px', padding: '16px', background: 'var(--bg)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: contractState === 'ready' ? 'var(--success)' : contractState === 'error' ? 'var(--error)' : 'var(--warning)' }} />
            {contractState === 'ready' ? 'Connected' : contractState === 'error' ? 'Error' : 'Syncing...'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main" style={styles.main}>
        {portal === 'issuer' && <IssuerPortal seed={seed} contractState={contractState} />}
        {portal === 'user' && <UserPortal seed={seed} contractState={contractState} />}
        {portal === 'verifier' && <VerifierPortal seed={seed} contractState={contractState} />}
      </main>

      {/* Mobile Nav */}
      <nav className="mobileNav" style={styles.mobileNav}>
        <button style={{ ...styles.navItem, width: 'auto', margin: 0, color: portal === 'issuer' ? 'var(--primary)' : 'var(--text-muted)' }} onClick={() => setPortal('issuer')}><IconHospital /></button>
        <button style={{ ...styles.navItem, width: 'auto', margin: 0, color: portal === 'user' ? 'var(--primary)' : 'var(--text-muted)' }} onClick={() => setPortal('user')}><IconUser /></button>
        <button style={{ ...styles.navItem, width: 'auto', margin: 0, color: portal === 'verifier' ? 'var(--primary)' : 'var(--text-muted)' }} onClick={() => setPortal('verifier')}><IconShield /></button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
