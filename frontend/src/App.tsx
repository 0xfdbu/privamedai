import { useState, useEffect, useCallback } from 'react';
import './styles/theme.css';
import { WalletProvider, useWallet, VALID_NETWORKS } from './hooks/WalletContext';
import type { CredentialWithPrivateData } from './contract/credentialApi';
import { AIClaimComposer } from './components/AIClaimComposer';
import { CliInstructions } from './components/CliInstructions';
import { useCredentialWallet, CredentialWallet } from './utils/credentialWallet';


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
  FileCheck: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>,
  Award: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  Eye: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.78 0 1.53-.09 2.24-.26"/><path d="M2 2l20 20"/></svg>,
};

// ============================================================================
// UI Components
// ============================================================================

const Button = ({ children, onClick, disabled, loading, variant = 'primary', icon: Icon, style }: any) => {
  const variants: any = {
    primary: { 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
      color: '#070707',
      boxShadow: '0 2px 8px rgba(248,250,252,0.2)',
    },
    secondary: { 
      background: 'rgba(248,250,252,0.08)', 
      color: '#f8fafc',
      border: '1px solid rgba(248,250,252,0.12)',
    },
    danger: { 
      background: 'rgba(239,68,68,0.15)', 
      color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.3)',
    },
    ghost: { 
      background: 'transparent', 
      color: 'rgba(248,250,252,0.6)',
    },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '12px 20px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        border: 'none',
        ...v,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(248,250,252,0.3)';
          }
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = v.boxShadow;
        }
      }}
    >
      {loading && <Icons.Loader />}
      {!loading && Icon && <Icon />}
      {children}
    </button>
  );
};

const Card = ({ children, style, className }: any) => (
  <div className={className} style={{
    background: 'rgba(248,250,252,0.03)',
    border: '1px solid rgba(248,250,252,0.08)',
    borderRadius: '20px',
    padding: '24px',
    ...style,
  }}>{children}</div>
);

const Badge = ({ children, color = 'green' }: any) => {
  const colors: any = {
    green: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
    red: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    blue: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
    purple: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
    gray: { bg: 'rgba(248,250,252,0.08)', text: 'rgba(248,250,252,0.7)', border: 'rgba(248,250,252,0.15)' },
  };
  const c = colors[color];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '20px',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>{children}</span>
  );
};

const Input = ({ label, mono, error, ...props }: any) => (
  <div style={{ marginBottom: '20px' }}>
    {label && (
      <label style={{ 
        display: 'block', 
        fontSize: '13px', 
        fontWeight: '500', 
        marginBottom: '8px', 
        color: 'rgba(248,250,252,0.7)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>{label}</label>
    )}
    <input {...props} style={{
      width: '100%',
      padding: '14px 16px',
      fontSize: '15px',
      background: 'rgba(248,250,252,0.05)',
      border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(248,250,252,0.1)'}`,
      borderRadius: '12px',
      color: '#f8fafc',
      outline: 'none',
      fontFamily: mono ? 'monospace' : 'inherit',
      transition: 'all 0.2s ease',
      ...props.style,
    }} />
    {error && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{error}</span>}
  </div>
);

const Select = ({ label, options, error, ...props }: any) => (
  <div style={{ marginBottom: '20px' }}>
    {label && (
      <label style={{ 
        display: 'block', 
        fontSize: '13px', 
        fontWeight: '500', 
        marginBottom: '8px', 
        color: 'rgba(248,250,252,0.7)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>{label}</label>
    )}
    <select {...props} style={{
      width: '100%',
      padding: '14px 16px',
      fontSize: '15px',
      background: 'rgba(248,250,252,0.05)',
      border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(248,250,252,0.1)'}`,
      borderRadius: '12px',
      color: '#f8fafc',
      outline: 'none',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgba(248,250,252,0.5)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '20px',
      paddingRight: '44px',
    }}>
      {options.map((o: any) => <option key={o.value} value={o.value} style={{ background: '#070707' }}>{o.label}</option>)}
    </select>
    {error && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{error}</span>}
  </div>
);

const Alert = ({ type = 'info', children, onClose }: any) => {
  const styles: any = {
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', icon: Icons.Alert },
    success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', icon: Icons.Check },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', icon: Icons.X },
  };
  const s = styles[type];
  const Icon = s.icon;
  return (
    <div style={{ 
      padding: '16px 20px', 
      background: s.bg, 
      border: `1px solid ${s.border}`, 
      borderRadius: '12px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      marginBottom: '20px',
    }}>
      <div style={{ color: s.border, flexShrink: 0 }}><Icon /></div>
      <div style={{ flex: 1, color: '#f8fafc' }}>{children}</div>
      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(248,250,252,0.5)', cursor: 'pointer', padding: '4px' }}>
          <Icons.X />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Network Selector
// ============================================================================

function NetworkSelector({ onSelect, onCancel }: { onSelect: (network: string) => void; onCancel: () => void }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <p style={{ fontSize: '14px', color: 'rgba(248,250,252,0.6)', marginBottom: '16px' }}>
        Select your wallet network:
      </p>
      <div style={{ display: 'grid', gap: '8px' }}>
        {VALID_NETWORKS.map((network) => (
          <button
            key={network.id}
            onClick={() => onSelect(network.id)}
            style={{
              padding: '14px 16px',
              background: 'rgba(248,250,252,0.05)',
              border: '1px solid rgba(248,250,252,0.1)',
              borderRadius: '12px',
              color: '#f8fafc',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248,250,252,0.1)';
              e.currentTarget.style.borderColor = 'rgba(248,250,252,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(248,250,252,0.05)';
              e.currentTarget.style.borderColor = 'rgba(248,250,252,0.1)';
            }}
          >
            <div>
              <div style={{ fontWeight: '600' }}>{network.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(248,250,252,0.5)' }}>{network.description}</div>
            </div>
            <Icons.Check s={16} />
          </button>
        ))}
      </div>
      <Button variant="ghost" onClick={onCancel} style={{ marginTop: '16px', width: '100%' }}>
        Cancel
      </Button>
    </div>
  );
}

// ============================================================================
// Login Screen
// ============================================================================

function LoginScreen({ onConnect, onBrowserWallet }: { onConnect: () => Promise<void>; onBrowserWallet: () => void }) {
  const { isConnecting, error, showNetworkSelector, connectWithNetwork, hideNetworkSelector } = useWallet();
  const [showManualSelector, setShowManualSelector] = useState(false);

  const handleConnect = async () => {
    await onConnect();
  };

  const handleNetworkSelect = async (networkId: string) => {
    await connectWithNetwork(networkId);
  };

  const shouldShowSelector = showNetworkSelector || showManualSelector;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ 
          width: '72px', 
          height: '72px', 
          margin: '0 auto 24px', 
          background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(248,250,252,0.2)',
        }}>
          <Icons.Shield s={36} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', letterSpacing: '1px' }}>PRIAMED</h1>
        <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '15px', marginBottom: '32px' }}>
          Healthcare Credentials on Midnight Network
        </p>

        {!shouldShowSelector ? (
          <>
            <Button onClick={handleConnect} loading={isConnecting} icon={Icons.Lock} style={{ width: '100%', marginBottom: '12px' }}>
              {isConnecting ? 'Connecting...' : 'Connect Lace Wallet'}
            </Button>
            <Button variant="secondary" onClick={onBrowserWallet} style={{ width: '100%', marginBottom: '12px' }}>
              🌐 Use Browser Wallet
            </Button>
            <Button variant="ghost" onClick={() => setShowManualSelector(true)} disabled={isConnecting} style={{ width: '100%' }}>
              Select Network Manually
            </Button>
            {error && <Alert type="error" onClose={() => {}}>{error}</Alert>}
          </>
        ) : (
          <NetworkSelector onSelect={handleNetworkSelect} onCancel={() => { setShowManualSelector(false); hideNetworkSelector(); }} />
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Issuer Portal
// ============================================================================

function IssuerPortal() {
  const { credentialAPI } = useWallet();
  const [tab, setTab] = useState<'issue' | 'manage'>('issue');
  const [form, setForm] = useState({ subject: '', type: 'vaccination', value: '', days: 365 });
  const [issued, setIssued] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string; txId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCliHelp, setShowCliHelp] = useState(false);

  const hash = async (s: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(s);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleIssue = async () => {
    if (!credentialAPI) {
      setStatus({ type: 'error', msg: 'Contract API not initialized. Please reconnect wallet.' });
      return;
    }
    if (!form.value.trim()) {
      setStatus({ type: 'error', msg: 'Please enter a claim value' });
      return;
    }
    setLoading(true);
    setStatus(null);
    
    try {
      const credentialData = await hash(`${form.type}:${form.value}`);
      const claimHash = await hash(credentialData);
      const commitment = await hash(JSON.stringify(form) + Date.now());
      
      const txId = await credentialAPI.issueCredential(commitment, claimHash, form.days);
      
      const newCred = { 
        ...form, 
        commitment, 
        credentialData, 
        claimHash, 
        txId, 
        time: Date.now(),
        status: 'VALID'
      };
      
      setIssued([newCred, ...issued]);
      setStatus({ type: 'success', msg: 'Credential issued successfully!', txId });
      setForm({ ...form, value: '', subject: '' });
    } catch (e: any) {
      const msg = e.message || 'Unknown error';
      setStatus({ type: 'error', msg });
      // Show CLI instructions for proof server errors
      if (msg.includes('400') || msg.includes('Bad Request') || msg.includes('proof server') || msg.includes('Proof Server')) {
        setShowCliHelp(true);
      }
    }
    setLoading(false);
  };

  const handleRevoke = async (commitment: string) => {
    if (!credentialAPI) return;
    try {
      await credentialAPI.revokeCredential(commitment);
      setIssued(issued.map(c => c.commitment === commitment ? { ...c, status: 'REVOKED' } : c));
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Issuer Portal</h2>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '15px' }}>Issue and manage healthcare credentials</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant={tab === 'issue' ? 'primary' : 'secondary'} onClick={() => setTab('issue')} icon={Icons.Plus}>
            Issue
          </Button>
          <Button variant={tab === 'manage' ? 'primary' : 'secondary'} onClick={() => setTab('manage')}>
            Manage ({issued.length})
          </Button>
        </div>
      </div>

      {status && <Alert type={status.type} onClose={() => setStatus(null)}>{status.msg} {status.txId && <code style={{ fontSize: '11px', opacity: 0.7 }}>({status.txId.slice(0, 20)}...)</code>}</Alert>}

      {showCliHelp && <CliInstructions />}

      {tab === 'issue' ? (
        <Card>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>New Credential</h3>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '14px', marginBottom: '24px' }}>
            Create a verifiable healthcare credential
          </p>
          
          <Input 
            label="Subject Address" 
            value={form.subject} 
            onChange={(e: any) => setForm({ ...form, subject: e.target.value })} 
            placeholder="0x..."
            mono
          />
          <Select 
            label="Credential Type" 
            value={form.type} 
            onChange={(e: any) => setForm({ ...form, type: e.target.value })} 
            options={[
              { value: 'vaccination', label: 'Vaccination Record' },
              { value: 'medical_license', label: 'Medical License' },
              { value: 'insurance', label: 'Insurance Coverage' },
              { value: 'age', label: 'Age Verification' },
            ]} 
          />
          <Input 
            label="Claim Value" 
            value={form.value} 
            onChange={(e: any) => setForm({ ...form, value: e.target.value })} 
            placeholder="e.g., COVID-19-Pfizer"
          />
          <Input 
            label="Expiry Days" 
            type="number" 
            value={form.days} 
            onChange={(e: any) => setForm({ ...form, days: parseInt(e.target.value) })} 
          />
          
          <Button onClick={handleIssue} loading={loading} disabled={!form.value} icon={Icons.Lock}>
            Issue Credential
          </Button>
        </Card>
      ) : (
        <div>
          {issued.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.3 }}>📋</div>
              <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '16px' }}>No credentials issued yet</p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {issued.map((c, i) => (
                <Card key={i} style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Badge color={c.status === 'VALID' ? 'green' : 'red'}>
                          {c.status === 'VALID' ? <><Icons.Check s={12} /> Active</> : <><Icons.X s={12} /> Revoked</>}
                        </Badge>
                        <span style={{ fontSize: '13px', color: 'rgba(248,250,252,0.4)' }}>
                          {new Date(c.time).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '17px', fontWeight: '600', textTransform: 'capitalize', marginBottom: '4px' }}>
                        {c.type.replace('_', ' ')}
                      </h4>
                      <p style={{ fontSize: '15px', color: 'rgba(248,250,252,0.7)', marginBottom: '10px' }}>{c.value}</p>
                      <code style={{ fontSize: '12px', color: 'rgba(248,250,252,0.4)', fontFamily: 'monospace' }}>
                        {c.commitment.slice(0, 50)}...
                      </code>
                    </div>
                    {c.status === 'VALID' && (
                      <Button variant="danger" icon={Icons.Trash} onClick={() => handleRevoke(c.commitment)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// User Portal with Credential Wallet & AI Composer
// ============================================================================

import type { ClaimRule } from './ai/claimParser';
import type { StoredCredential } from './utils/credentialWallet';

function UserPortal() {
  const { credentialAPI } = useWallet();
  const wallet = useCredentialWallet();
  
  // Wallet UI state
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [walletError, setWalletError] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');
  
  // AI Composer state
  const [showAIComposer, setShowAIComposer] = useState(false);
  
  // Credential management
  const [selectedCred, setSelectedCred] = useState<StoredCredential | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Initialize wallet
  const handleInitializeWallet = async () => {
    if (!walletPassword || walletPassword.length < 8) {
      setWalletError('Password must be at least 8 characters');
      return;
    }
    await wallet.initialize(walletPassword);
    setShowWalletSetup(false);
    setWalletPassword('');
    setWalletError('');
  };

  // Unlock wallet
  const handleUnlock = async () => {
    const success = await wallet.unlock(walletPassword);
    if (!success) {
      setWalletError('Incorrect password');
    } else {
      setShowWalletSetup(false);
      setWalletPassword('');
      setWalletError('');
    }
  };

  // Export wallet
  const handleExport = async () => {
    const data = await wallet.exportWallet();
    setExportData(data);
    setShowExport(true);
  };

  // Handle AI proof generation
  const handleGenerateProof = async (rule: ClaimRule, credential: StoredCredential): Promise<{ success: boolean; txHash?: string; result?: boolean }> => {
    if (!credentialAPI) {
      setMsg({ text: 'Contract API not available', type: 'error' });
      return { success: false };
    }

    try {
      // Call the appropriate circuit based on the rule
      let result: boolean;
      let txHash: string;

      switch (rule.circuit) {
        case 'verifyAgeRange':
          const ageResult = await credentialAPI.verifyAgeRange(
            credential.commitment,
            rule.circuitParams.minAge,
            rule.circuitParams.maxAge
          );
          result = ageResult;
          txHash = 'tx-' + Date.now(); // Would come from actual tx
          break;
        
        case 'verifyDiabetesTrialEligibility':
          const diabetesResult = await credentialAPI.verifyDiabetesTrialEligibility(credential.commitment);
          result = diabetesResult;
          txHash = 'tx-' + Date.now();
          break;
        
        case 'verifyInsuranceWellnessDiscount':
          const wellnessResult = await credentialAPI.verifyInsuranceWellnessDiscount(credential.commitment);
          result = wellnessResult;
          txHash = 'tx-' + Date.now();
          break;
        
        case 'verifyHealthcareWorkerClearance':
          const clearanceResult = await credentialAPI.verifyHealthcareWorkerClearance(credential.commitment);
          result = clearanceResult;
          txHash = 'tx-' + Date.now();
          break;
        
        default:
          // Fallback to basic credential verification
          result = await credentialAPI.verifyCredential(credential.commitment, credential.claimHash);
          txHash = 'tx-' + Date.now();
      }

      setMsg({ 
        text: `✅ Proof generated: ${rule.description} - ${result ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`, 
        type: 'success' 
      });
      setTimeout(() => setMsg(null), 5000);

      return { success: true, txHash, result };
    } catch (error: any) {
      setMsg({ text: `❌ ${error.message || 'Proof generation failed'}`, type: 'error' });
      return { success: false };
    }
  };

  // Add demo credential to wallet
  const addDemoCredential = async () => {
    const demo: StoredCredential = {
      id: 'demo-' + Date.now(),
      commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      issuer: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      claimHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      expiry: Date.now() + 86400000 * 365,
      status: 'VALID',
      metadata: {
        name: 'COVID-19 Vaccination',
        description: 'Pfizer-BioNTech Booster',
        issuedAt: Date.now(),
        issuerName: 'Demo Hospital',
      }
    };
    await wallet.addCredential(demo, { 
      vaccine: 'Pfizer', 
      dose: 3, 
      date: '2024-01-15',
      lotNumber: 'ABC123'
    });
    setMsg({ text: '✅ Demo credential added', type: 'success' });
    setTimeout(() => setMsg(null), 3000);
  };

  // Render wallet setup UI
  if (!wallet.isUnlocked) {
    const walletExists = CredentialWallet.exists();
    
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Patient Portal</h2>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '15px' }}>Secure credential wallet</p>
        </div>

        <Card style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}>🔐</div>
            <h3 style={{ margin: '0 0 8px 0' }}>
              {walletExists ? 'Unlock Wallet' : 'Create Wallet'}
            </h3>
            <p style={{ color: 'rgba(248,250,252,0.5)', margin: 0, fontSize: '14px' }}>
              {walletExists 
                ? 'Enter your password to access credentials'
                : 'Create a password to encrypt your credentials locally'
              }
            </p>
          </div>

          <Input
            type="password"
            label="Password"
            value={walletPassword}
            onChange={(e: any) => setWalletPassword(e.target.value)}
            placeholder={walletExists ? 'Enter password' : 'Create password (min 8 chars)'}
          />

          {walletError && <Alert type="error">{walletError}</Alert>}

          <Button 
            onClick={walletExists ? handleUnlock : handleInitializeWallet}
            style={{ width: '100%' }}
          >
            {walletExists ? '🔓 Unlock' : '🔐 Create Wallet'}
          </Button>

          {walletExists && (
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'rgba(248,250,252,0.4)' }}>
              Your credentials are encrypted with AES-256-GCM
            </p>
          )}
        </Card>
      </div>
    );
  }

  // Render main user portal
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Patient Portal</h2>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '15px' }}>
            {wallet.credentials.length} credentials • {wallet.expiringCredentials.length} expiring soon
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => setShowAIComposer(!showAIComposer)} icon={Icons.Zap}>
            {showAIComposer ? 'Hide AI' : '🤖 AI Composer'}
          </Button>
          <Button variant="secondary" onClick={addDemoCredential} icon={Icons.Plus}>
            Add Demo
          </Button>
          <Button variant="ghost" onClick={handleExport}>
            Export
          </Button>
          <Button variant="ghost" onClick={() => wallet.lock()}>
            Lock
          </Button>
        </div>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* Expiration Alerts */}
      {wallet.expiringCredentials.length > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
              {wallet.expiringCredentials.length} credential(s) expiring soon
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wallet.expiringCredentials.map(cred => (
              <div key={cred.id} style={{
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ color: '#f8fafc', fontSize: '14px' }}>{cred.metadata.name}</span>
                <span style={{ color: '#fbbf24', fontSize: '13px' }}>
                  Expires {new Date(cred.expiry).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Claim Composer */}
      {showAIComposer && (
        <div style={{ marginBottom: '24px' }}>
          <AIClaimComposer 
            credentials={wallet.credentials}
            onGenerateProof={handleGenerateProof}
          />
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <Card style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0' }}>Export Wallet</h3>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '14px', marginBottom: '16px' }}>
            Copy this encrypted backup and store it securely. You'll need your password to restore.
          </p>
          <textarea
            value={exportData}
            readOnly
            style={{
              width: '100%',
              height: '120px',
              padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(248,250,252,0.1)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
              fontFamily: 'monospace',
              marginBottom: '16px',
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button onClick={() => navigator.clipboard.writeText(exportData)} icon={Icons.Copy}>
              Copy to Clipboard
            </Button>
            <Button variant="ghost" onClick={() => setShowExport(false)}>
              Close
            </Button>
          </div>
        </Card>
      )}

      {/* Credentials List */}
      {wallet.credentials.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '80px 40px' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.3 }}>📋</div>
          <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '16px', marginBottom: '20px' }}>
            No credentials stored yet
          </p>
          <Button onClick={addDemoCredential} icon={Icons.Plus}>
            Add Demo Credential
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {wallet.credentials.map((cred) => (
            <Card 
              key={cred.id}
              style={{ 
                padding: '20px', 
                cursor: 'pointer',
                borderColor: selectedCred?.id === cred.id ? 'rgba(248,250,252,0.3)' : undefined,
                background: selectedCred?.id === cred.id ? 'rgba(248,250,252,0.06)' : undefined,
                transition: 'all 0.2s ease',
              }}
              onClick={() => setSelectedCred(selectedCred?.id === cred.id ? null : cred)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Badge color={cred.status === 'VALID' ? 'green' : 'red'}>
                      {cred.status === 'VALID' ? <><Icons.Check s={12} /> Valid</> : <><Icons.X s={12} /> Revoked</>}
                    </Badge>
                    <span style={{ fontSize: '13px', color: 'rgba(248,250,252,0.4)' }}>
                      Expires {new Date(cred.expiry).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '17px', fontWeight: '600' }}>
                    {cred.metadata.name}
                  </h4>
                  <p style={{ fontSize: '15px', color: 'rgba(248,250,252,0.7)' }}>
                    {cred.metadata.description}
                  </p>
                  {cred.metadata.issuerName && (
                    <p style={{ fontSize: '13px', color: 'rgba(248,250,252,0.5)', marginTop: '4px' }}>
                      Issued by {cred.metadata.issuerName}
                    </p>
                  )}
                </div>
                {selectedCred?.id === cred.id && (
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verifier Portal
// ============================================================================

function VerifierPortal() {
  const { credentialAPI } = useWallet();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ status: 'success' | 'error' | null; msg: string; details?: any } | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!input.trim() || !credentialAPI) return;
    setLoading(true);
    setResult(null);
    
    try {
      const data = JSON.parse(input);
      if (!data.commitment || !data.credentialData) {
        throw new Error('Missing commitment or credentialData');
      }
      
      const isValid = await credentialAPI.verifyOnChain(data.commitment, data.credentialData);
      
      if (isValid) {
        setResult({ 
          status: 'success', 
          msg: '✅ Credential is VALID',
          details: {
            commitment: data.commitment.slice(0, 20) + '...',
            verifiedAt: new Date().toISOString(),
          }
        });
      } else {
        setResult({ status: 'error', msg: '❌ Credential verification failed' });
      }
    } catch (e: any) {
      setResult({ status: 'error', msg: `❌ Error: ${e.message}` });
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Verifier Portal</h2>
        <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '15px' }}>Verify credentials without accessing private data</p>
      </div>

      <Card>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Verify Proof</h3>
        <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: '14px', marginBottom: '20px' }}>
          Paste the zero-knowledge proof JSON
        </p>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`{\n  "commitment": "0x...",\n  "credentialData": "0x...",\n  "claimType": "vaccination"\n}`}
          style={{
            width: '100%',
            height: '200px',
            padding: '16px',
            fontSize: '14px',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(248,250,252,0.1)',
            borderRadius: '12px',
            color: '#f8fafc',
            marginBottom: '20px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <Button onClick={verify} loading={loading} disabled={!input.trim()} icon={Icons.Search}>
          Verify Proof
        </Button>
      </Card>

      {result && (
        <Card style={{ 
          marginTop: '20px', 
          background: result.status === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          borderColor: result.status === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            {result.status === 'success' ? (
              <div style={{ padding: '8px', background: 'rgba(16,185,129,0.2)', borderRadius: '8px', color: '#10b981' }}>
                <Icons.Check />
              </div>
            ) : (
              <div style={{ padding: '8px', background: 'rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444' }}>
                <Icons.X />
              </div>
            )}
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: result.status === 'success' ? '#10b981' : '#ef4444' }}>
              {result.msg}
            </h4>
          </div>
          
          {result.details && (
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <pre style={{ margin: 0, fontSize: '13px', color: 'rgba(248,250,252,0.8)' }}>
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '32px' }}>
        <Card>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#10b981', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.Check /> You Can Verify
          </h4>
          <ul style={{ fontSize: '14px', color: 'rgba(248,250,252,0.6)', lineHeight: 2.2, listStyle: 'none', padding: 0, margin: 0 }}>
            <li>✓ Credential validity on-chain</li>
            <li>✓ Issuer identity & status</li>
            <li>✓ Revocation status</li>
            <li>✓ Data integrity (hash)</li>
          </ul>
        </Card>
        <Card>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.X /> You Cannot See
          </h4>
          <ul style={{ fontSize: '14px', color: 'rgba(248,250,252,0.6)', lineHeight: 2.2, listStyle: 'none', padding: 0, margin: 0 }}>
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
    { id: 'verifier', label: 'Verify', icon: Icons.Shield },
  ];

  const portals: any = {
    issuer: <IssuerPortal />,
    user: <UserPortal />,
    verifier: <VerifierPortal />,
  };

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
          background: 'rgba(15,15,15,0.85)', 
          backdropFilter: 'blur(24px) saturate(180%)', 
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 16px',
          pointerEvents: 'auto',
        }}>
          <span style={{ 
            fontWeight: '800', 
            color: '#f8fafc',
            fontSize: '16px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>PRIAMED</span>
          
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
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
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
                color: 'rgba(248,250,252,0.7)',
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
                e.currentTarget.style.color = 'rgba(248,250,252,0.7)';
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
          padding: '10px',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                    gap: '6px',
                    padding: '16px 14px',
                    minWidth: '80px',
                    borderRadius: '14px',
                    border: 'none',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: isActive ? '#f8fafc' : 'rgba(248,250,252,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
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
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: '#f8fafc',
                      boxShadow: '0 0 8px rgba(248,250,252,0.5)',
                    }} />
                  )}
                  <item.icon s={28} />
                  <span style={{ fontSize: '14px', fontWeight: isActive ? 600 : 500, letterSpacing: '0.4px' }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px', display: 'flex', justifyContent: 'space-around', zIndex: 100 }} className="mobile-nav">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setPortal(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 16px', border: 'none', background: 'none', color: portal === item.id ? '#f8fafc' : 'rgba(248,250,252,0.5)' }}>
            <item.icon s={22} />
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ marginTop: '80px', marginBottom: '70px', padding: '24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1280px' }}>
          {portals[portal] || children}
        </div>
      </main>

      <style>{`
        @media (min-width: 1024px) {
          .sidebar-lg { display: flex !important; }
          .mobile-nav { display: none !important; }
          main { margin-top: 80px !important; margin-bottom: 20px !important; padding: 32px 40px !important; }
        }
        @media (max-width: 1023px) {
          main { margin-top: 80px !important; }
        }
      `}</style>
    </div>
  );
}

import { BrowserWalletSetup } from './components/BrowserWalletSetup';

function MainApp() {
  const { 
    isConnected, 
    connect, 
    disconnect, 
    walletMode, 
    walletAddress,
    createBrowserWallet,
    restoreBrowserWallet,
    clearBrowserWallet
  } = useWallet();
  const [portal, setPortal] = useState('issuer');
  const [showBrowserWallet, setShowBrowserWallet] = useState(false);
  const [browserStep, setBrowserStep] = useState<'create' | 'restore' | 'seed'>('create');
  const [newSeed, setNewSeed] = useState('');
  
  // Handle browser wallet creation
  const handleCreateBrowserWallet = async () => {
    await createBrowserWallet();
    setShowBrowserWallet(false);
  };

  // Handle browser wallet restore
  const handleRestoreBrowserWallet = async (seed: string) => {
    await restoreBrowserWallet(seed);
    setShowBrowserWallet(false);
  };

  // Show browser wallet setup
  if (showBrowserWallet && !isConnected) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 8px 0' }}>Browser Wallet</h2>
            <p style={{ color: 'rgba(248,250,252,0.5)', margin: 0 }}>Create or restore your self-custody wallet</p>
          </div>
          <BrowserWalletSetup 
            onComplete={handleCreateBrowserWallet}
            onRestore={handleRestoreBrowserWallet}
          />
          <Button variant="ghost" onClick={() => setShowBrowserWallet(false)} style={{ width: '100%', marginTop: '16px' }}>
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  // Show main app if connected
  if (isConnected) {
    const displayAddress = walletMode === 'browser' && walletAddress
      ? walletAddress.slice(0, 10) + '...'
      : 'Connected';
    
    return (
      <Layout address={displayAddress} portal={portal} setPortal={setPortal} onDisconnect={() => {
        disconnect();
        if (walletMode === 'browser') {
          clearBrowserWallet();
        }
      }}>
        <div />
      </Layout>
    );
  }

  // Show login screen
  return <LoginScreen onConnect={connect} onBrowserWallet={() => setShowBrowserWallet(true)} />;
}

export default function App() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
