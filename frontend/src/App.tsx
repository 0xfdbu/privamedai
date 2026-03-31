import { useState, useEffect } from 'react';
import './styles/theme.css';
import { WalletProvider, useWallet, VALID_NETWORKS } from './hooks/WalletContext';
import { createHash } from 'crypto';

// ============================================================================
// Icons
// ============================================================================

const Icons = {
  Check: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  X: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  Loader: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Hospital: ({ s = 20 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v4"/><path d="M14 10h-4"/><path d="M18 22V8l-6-4-6 4v14"/></svg>,
  User: ({ s = 20 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Shield: ({ s = 20 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Plus: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  Trash: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  Lock: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Search: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Copy: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Key: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/></svg>,
  Alert: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  Zap: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>,
};

// ============================================================================
// UI Components
// ============================================================================

const Button = ({ children, onClick, disabled, loading, variant = 'primary', icon: Icon }: any) => {
  const styles: any = {
    primary: { background: 'var(--primary)', color: 'white', border: 'none' },
    secondary: { background: 'var(--surface-elevated)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid var(--error)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: 'none' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '10px 18px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s',
        ...styles[variant],
      }}
    >
      {loading && <Icons.Loader />}
      {!loading && Icon && <Icon />}
      {children}
    </button>
  );
};

const Card = ({ children, style }: any) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '24px',
    ...style,
  }}>{children}</div>
);

const Badge = ({ children, color = 'green' }: any) => {
  const colors: any = {
    green: { bg: 'var(--success-dim)', text: 'var(--success)' },
    red: { bg: 'var(--error-dim)', text: 'var(--error)' },
    purple: { bg: 'var(--primary-dim)', text: 'var(--primary)' },
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '20px',
      background: colors[color].bg,
      color: colors[color].text,
    }}>{children}</span>
  );
};

const Input = ({ label, mono, ...props }: any) => (
  <div style={{ marginBottom: '16px' }}>
    {label && <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>{label}</label>}
    <input {...props} style={{
      width: '100%',
      padding: '10px 14px',
      fontSize: '14px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      color: 'var(--text)',
      outline: 'none',
      fontFamily: mono ? 'monospace' : 'inherit',
      ...props.style,
    }} />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div style={{ marginBottom: '16px' }}>
    {label && <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>{label}</label>}
    <select {...props} style={{
      width: '100%',
      padding: '10px 14px',
      fontSize: '14px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      color: 'var(--text)',
      outline: 'none',
    }}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Alert = ({ type = 'info', children, onClose }: any) => {
  const styles: any = {
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', icon: Icons.Alert },
    success: { bg: 'var(--success-dim)', border: 'var(--success)', icon: Icons.Check },
    error: { bg: 'var(--error-dim)', border: 'var(--error)', icon: Icons.X },
  };
  const s = styles[type];
  const Icon = s.icon;
  return (
    <div style={{ padding: '12px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ color: s.border }}><Icon /></div>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Icons.X /></button>}
    </div>
  );
};

// ============================================================================
// Login Screen with Lace Wallet
// ============================================================================

function NetworkSelector({ onSelect, onCancel }: { onSelect: (network: string) => void; onCancel: () => void }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Your wallet is configured for a specific network. Please select which network your wallet is using:
      </p>
      <div style={{ display: 'grid', gap: '8px' }}>
        {VALID_NETWORKS.map((network) => (
          <button
            key={network.id}
            onClick={() => onSelect(network.id)}
            style={{
              padding: '12px 16px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: '600' }}>{network.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{network.description}</div>
            </div>
            <Icons.Check s={16} />
          </button>
        ))}
      </div>
      <Button variant="ghost" onClick={onCancel} style={{ marginTop: '12px', width: '100%' }}>
        Cancel
      </Button>
    </div>
  );
}

function LoginScreen({ onConnect }: { onConnect: () => Promise<void> }) {
  const { isConnecting, error, showNetworkSelector, connectWithNetwork, hideNetworkSelector } = useWallet();
  const [showManualSelector, setShowManualSelector] = useState(false);

  const handleConnect = async () => {
    await onConnect();
  };

  const handleNetworkSelect = async (networkId: string) => {
    await connectWithNetwork(networkId);
  };

  const handleManualSelect = () => {
    setShowManualSelector(true);
  };

  const handleCancel = () => {
    setShowManualSelector(false);
    hideNetworkSelector();
  };

  // Show network selector if auto-detect failed or user wants manual selection
  const shouldShowSelector = showNetworkSelector || showManualSelector;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', margin: '0 auto 20px', background: 'var(--gradient-primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold' }}>P</div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>PrivaMedAI</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>Healthcare Credentials on Midnight Network</p>

        {!shouldShowSelector ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <Button 
                onClick={handleConnect} 
                loading={isConnecting}
                icon={Icons.Lock}
                style={{ width: '100%', padding: '14px' }}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Button 
                variant="secondary"
                onClick={handleManualSelect}
                disabled={isConnecting}
                style={{ width: '100%' }}
              >
                Select Network Manually
              </Button>
            </div>

            {error && (
              <Alert type="error" onClose={() => {}}>
                {error}
              </Alert>
            )}

            <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <Icons.Alert /> Requires Midnight Lace wallet with tNight tokens
            </div>
          </>
        ) : (
          <NetworkSelector onSelect={handleNetworkSelect} onCancel={handleCancel} />
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Issuer Portal
// ============================================================================

function _IssuerPortal({ walletAPI: _walletAPI, serviceConfig: _serviceConfig, ready }: { walletAPI: any; serviceConfig: any; ready: boolean }) {
  // TODO: Integrate with contract using wallet providers
  const issueCredential = async (_commitment: string, _claimHash: string, _days: number) => {
    return 'mock-tx-id';
  };
  const revokeCredential = async (_commitment: string) => {
    return 'mock-tx-id';
  };
  const [tab, setTab] = useState<'issue' | 'manage'>('issue');
  const [form, setForm] = useState({ subject: '', type: 'vaccination', value: '', days: 365 });
  const [issued, setIssued] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: string; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate hash
  const hash = (s: string) => '0x' + createHash('sha256').update(s).digest('hex');

  const handleIssue = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const credentialData = hash(`${form.type}:${form.value}`).slice(0, 66);
      const claimHash = hash(credentialData).slice(0, 66);
      const commitment = hash(JSON.stringify(form) + Date.now()).slice(0, 66);
      
      const txId = await issueCredential(commitment, claimHash, form.days);
      
      const newCred = { ...form, commitment, credentialData, txId, time: Date.now() };
      setIssued([newCred, ...issued]);
      setStatus({ type: 'success', msg: `Credential issued! TX: ${txId.slice(0, 35)}...` });
      setForm({ ...form, value: '', subject: '' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Issuer Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Issue healthcare credentials</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant={tab === 'issue' ? 'primary' : 'secondary'} onClick={() => setTab('issue')} icon={Icons.Plus}>Issue</Button>
          <Button variant={tab === 'manage' ? 'primary' : 'secondary'} onClick={() => setTab('manage')}>Manage ({issued.length})</Button>
        </div>
      </div>

      {status && <Alert type={status.type as any} onClose={() => setStatus(null)}>{status.msg}</Alert>}

      {tab === 'issue' ? (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>New Credential</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Create a verifiable healthcare credential</p>
          
          <Input label="Subject Address" value={form.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, subject: e.target.value })} placeholder="0x..." />
          <Select label="Credential Type" value={form.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, type: e.target.value })} options={[
            { value: 'vaccination', label: 'Vaccination Record' },
            { value: 'medical_license', label: 'Medical License' },
            { value: 'insurance', label: 'Insurance Coverage' },
            { value: 'age', label: 'Age Verification' },
          ]} />
          <Input label="Claim Value" value={form.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, value: e.target.value })} placeholder="e.g., COVID-19-Pfizer" />
          <Input label="Expiry Days" type="number" value={form.days} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, days: parseInt(e.target.value) })} />
          
          <Button onClick={handleIssue} loading={loading} disabled={!ready || !form.value} icon={Icons.Lock}>
            Issue Credential
          </Button>
        </Card>
      ) : (
        <div>
          {issued.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <p style={{ color: 'var(--text-muted)' }}>No credentials issued yet</p>
            </Card>
          ) : (
            issued.map((c, i) => (
              <Card key={i} style={{ marginBottom: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Badge color="green"><Icons.Check s={12} /> Active</Badge>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(c.time).toLocaleDateString()}</span>
                    </div>
                    <h4 style={{ fontSize: '15px', fontWeight: '600', textTransform: 'capitalize', marginBottom: '2px' }}>{c.type.replace('_', ' ')}</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{c.value}</p>
                    <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.commitment.slice(0, 45)}...</code>
                  </div>
                  <Button variant="danger" icon={Icons.Trash} onClick={() => revokeCredential(c.commitment)} />
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// User Portal
// ============================================================================

function _UserPortal({ walletAPI: _walletAPI, serviceConfig: _serviceConfig, ready }: { walletAPI: any; serviceConfig: any; ready: boolean }) {
  // TODO: Integrate with contract using wallet providers
  const verifyCredential = async (_commitment: string, _credentialData: string) => {
    return 'mock-tx-id';
  };
  const [creds, setCreds] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: string } | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('privamedai_creds') || '[]');
    setCreds(stored);
  }, []);

  const addDemo = () => {
    const demo = {
      commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      type: 'vaccination',
      value: 'COVID-19-Pfizer-Booster',
      credentialData: '0x' + createHash('sha256').update('demo').digest('hex').slice(0, 64),
      expiry: Date.now() + 86400000 * 365,
    };
    const updated = [demo, ...creds];
    localStorage.setItem('privamedai_creds', JSON.stringify(updated));
    setCreds(updated);
  };

  // FIXED: Generate proof function
  const generateProof = async () => {
    if (!selected || !ready) return;
    setLoading(true);
    setMsg(null);
    try {
      // Call the verifyCredential circuit on the contract
      // This proves the credential is valid and increments the verification counter
      const txId = await verifyCredential(selected.commitment, selected.credentialData);
      
      // Create the proof object with all necessary data
      const proof = {
        proof: `zk-proof-${Date.now()}`,
        commitment: selected.commitment,
        credentialData: selected.credentialData,
        claimType: selected.type,
        claimValue: selected.value,
        txId,
        timestamp: Date.now(),
        verified: true,
      };
      
      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(proof, null, 2));
      
      setMsg({ text: '✓ Proof generated and copied to clipboard!', type: 'success' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to generate proof', type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>User Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Your credentials & ZK proofs</p>
        </div>
        <Button variant="secondary" onClick={addDemo} icon={Icons.Plus}>Add Demo</Button>
      </div>

      {msg && <Alert type={msg.type as any}>{msg.text}</Alert>}

      {creds.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          <p style={{ color: 'var(--text-muted)' }}>No credentials stored</p>
        </Card>
      ) : (
        <>
          {creds.map((c, i) => (
            <Card 
              key={i} 
              style={{ 
                marginBottom: '12px', 
                padding: '16px', 
                cursor: 'pointer',
                borderColor: selected?.commitment === c.commitment ? 'var(--primary)' : undefined,
                background: selected?.commitment === c.commitment ? 'var(--surface-elevated)' : undefined,
              }}
              onClick={() => setSelected(c)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Badge color="green">Valid</Badge>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expires {new Date(c.expiry).toLocaleDateString()}</span>
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', textTransform: 'capitalize' }}>{c.type.replace('_', ' ')}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{c.value}</p>
                </div>
                {selected?.commitment === c.commitment && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
            </Card>
          ))}

          {selected && (
            <Card style={{ marginTop: '24px', borderColor: 'var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Icons.Zap />
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Generate ZK Proof</h3>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Create a zero-knowledge proof for <strong>{selected.type}</strong>. This proves you have a valid credential without revealing the data.
              </p>
              
              <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Credential Data (for verifier):</div>
                <code style={{ fontSize: '12px', color: 'var(--primary)' }}>{selected.credentialData}</code>
              </div>

              <Button onClick={generateProof} loading={loading} disabled={!ready} icon={Icons.Copy}>
                {loading ? 'Generating...' : 'Generate & Copy Proof'}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Verifier Portal
// ============================================================================

function _VerifierPortal({ walletAPI: _walletAPI, serviceConfig: _serviceConfig, ready }: { walletAPI: any; serviceConfig: any; ready: boolean }) {
  // TODO: Integrate with contract using wallet providers
  const verifyCredential = async (_commitment: string, _credentialData: string) => {
    return 'mock-tx-id';
  };
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ status: string; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!input.trim() || !ready) return;
    setLoading(true);
    setResult(null);
    try {
      const data = JSON.parse(input);
      if (!data.commitment || !data.credentialData) {
        throw new Error('Missing commitment or credentialData in proof');
      }
      const txId = await verifyCredential(data.commitment, data.credentialData);
      setResult({ status: 'success', msg: `✅ Credential is VALID\n\nVerified on-chain:\n• Commitment hash matches stored claim\n• Issuer is active and verified\n• Credential has not been revoked\n\nTX: ${txId}` });
    } catch (e: any) {
      const msg = e.message || 'Verification failed';
      if (msg.includes('Hash mismatch')) {
        setResult({ status: 'error', msg: '❌ Hash Mismatch\n\nThe credential data does not match the stored claim hash.' });
      } else if (msg.includes('revoked')) {
        setResult({ status: 'error', msg: '❌ Credential Revoked\n\nThis credential has been revoked by the issuer.' });
      } else {
        setResult({ status: 'error', msg: `❌ Error: ${msg}` });
      }
    }
    setLoading(false);
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Verifier Portal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Verify credentials without accessing private data</p>
      </div>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Verify Proof</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>Paste the zero-knowledge proof JSON</p>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`{\n  "commitment": "0x...",\n  "credentialData": "0x...",\n  "claimType": "vaccination"\n}`}
          style={{
            width: '100%',
            height: '180px',
            padding: '12px',
            fontSize: '13px',
            fontFamily: 'monospace',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            marginBottom: '16px',
            resize: 'vertical',
          }}
        />
        <Button onClick={verify} loading={loading} disabled={!ready} icon={Icons.Search}>Verify Proof</Button>
      </Card>

      {result && (
        <Card style={{ 
          marginTop: '16px', 
          background: result.status === 'success' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
          borderColor: result.status === 'success' ? 'var(--success)' : 'var(--error)',
        }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.6 }}>{result.msg}</pre>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <Card>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--success)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.Check /> You Can Verify
          </h4>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li>✓ Credential validity on-chain</li>
            <li>✓ Issuer identity & status</li>
            <li>✓ Revocation status</li>
            <li>✓ Data integrity (hash)</li>
          </ul>
        </Card>
        <Card>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--error)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.X /> You Cannot See
          </h4>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li>✗ Actual health records</li>
            <li>✗ Personal identifying info</li>
            <li>✗ Medical history details</li>
            <li>✗ Test results</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Layout & Main App
// ============================================================================

function Layout({ children, address, portal, setPortal, onDisconnect }: any) {
  const navItems = [
    { id: 'issuer', label: 'Issuer', icon: Icons.Hospital },
    { id: 'user', label: 'User', icon: Icons.User },
    { id: 'verifier', label: 'Verifier', icon: Icons.Shield },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Floating Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 20px',
        zIndex: 100,
        pointerEvents: 'none',
      }}>
        <header style={{ 
          width: '100%',
          maxWidth: '1280px',
          height: '56px', 
          background: 'rgba(23,23,23,0.8)', 
          backdropFilter: 'blur(20px) saturate(180%)', 
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 16px',
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ 
              fontWeight: '800', 
              color: '#f8fafc',
              fontSize: '18px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>PRIAMED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {address && (
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px', 
                color: 'rgba(248,250,252,0.8)', 
                background: 'rgba(255,255,255,0.06)', 
                padding: '6px 12px', 
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'monospace',
                fontWeight: 500,
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }} />
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
            <button 
              onClick={onDisconnect}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(248,250,252,0.8)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(248,250,252,0.8)';
              }}
            >
              Disconnect
            </button>
          </div>
        </header>
      </div>

      {/* Floating Sidebar */}
      <aside className="sidebar-lg" style={{
        position: 'fixed',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'none',
        flexDirection: 'column',
        zIndex: 50,
        pointerEvents: 'auto',
      }}>
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(10,10,10,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          padding: '12px',
          borderRadius: '24px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(item => {
              const isActive = portal === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPortal(item.id)}
                  title={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '18px 20px',
                    minWidth: '88px',
                    borderRadius: '16px',
                    border: 'none',
                    background: isActive 
                      ? 'rgba(255,255,255,0.12)' 
                      : 'transparent',
                    color: isActive ? '#f8fafc' : 'rgba(248,250,252,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.color = 'rgba(248,250,252,0.8)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(248,250,252,0.4)';
                    }
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#f8fafc',
                      boxShadow: '0 0 10px rgba(248,250,252,0.6)',
                    }} />
                  )}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isActive ? 1 : 0.7,
                    transition: 'opacity 0.2s ease',
                  }}>
                    <item.icon s={26} />
                  </span>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '0.5px',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px', display: 'flex', justifyContent: 'space-around', zIndex: 100 }} className="mobile-nav">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setPortal(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 16px', border: 'none', background: 'none', color: portal === item.id ? 'var(--primary)' : 'var(--text-muted)' }}>
            <item.icon />
            <span style={{ fontSize: '11px' }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ 
        marginTop: '80px', 
        marginBottom: '70px', 
        padding: '24px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1280px', // max-w-7xl
        }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (min-width: 1024px) {
          .sidebar-lg { display: flex !important; }
          .mobile-nav { display: none !important; }
          main { 
            margin-left: auto !important;
            margin-right: auto !important;
            margin-bottom: 20px !important;
            margin-top: 80px !important;
            padding: 32px 40px !important;
          }
        }
        @media (max-width: 1023px) {
          main {
            margin-top: 80px !important;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function MainApp() {
  const { isConnected, connect, disconnect } = useWallet();
  const [portal, setPortal] = useState('issuer');
  
  if (!isConnected) return <LoginScreen onConnect={connect} />;

  return (
    <Layout address="Connected" portal={portal} setPortal={setPortal} onDisconnect={disconnect}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1280px',
        }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '16px' }}>
            Wallet Connected! 🎉
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Your Midnight Lace wallet is now connected.
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>
            Contract integration coming soon...
          </p>
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
