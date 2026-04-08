import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, UserCircle, Stethoscope, ShieldCheck, Activity, Check, Heading1 } from 'lucide-react';
import { WalletButton } from './layout/WalletButton';

const CIRCUITS = [
  { name: 'verifyForFreeHealthClinic', desc: 'Age verification', icon: Activity },
  { name: 'verifyForPharmacy', desc: 'Prescription verification', icon: Check },
  { name: 'verifyForHospital', desc: 'Age + Condition', icon: ShieldCheck },
];

const FEATURES = [
  {
    icon: UserCircle,
    label: 'For Patients',
    desc: 'Import your medical credentials and generate zero-knowledge proofs to share only what you choose.',
    accent: '#d1fae5',
    iconColor: '#059669',
  },
  {
    icon: Stethoscope,
    label: 'For Providers',
    desc: 'Issue verifiable medical credentials on the Midnight blockchain with selective disclosure built-in.',
    accent: '#ccfbf1',
    iconColor: '#0d9488',
  }
];

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        .pmx-btn-primary {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 32px; background: #059669; color: #fff;
          border-radius: 12px; font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 600; letter-spacing: 0.01em;
          text-decoration: none; border: none; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .pmx-btn-primary:hover { background: #047857; transform: translateY(-1px); }
        .pmx-btn-primary:active { transform: translateY(0); }

        .pmx-circuit-card {
          background: #fff; border: 1px solid #d1fae5;
          border-radius: 16px; padding: 24px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pmx-circuit-card:hover {
          border-color: #6ee7b7;
          box-shadow: 0 4px 24px rgba(5, 150, 105, 0.08);
        }

        .pmx-feature-card {
          background: #fff; border: 1px solid #ecfdf5;
          border-radius: 20px; padding: 32px;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .pmx-feature-card:hover {
          border-color: #a7f3d0;
          box-shadow: 0 8px 32px rgba(5, 150, 105, 0.07);
        }

        .pmx-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: #ecfdf5;
          border: 1px solid #6ee7b7; border-radius: 999px;
        }

        .pmx-dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: pmx-pulse 2s infinite; }
        @keyframes pmx-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .pmx-cross {
          position: absolute; opacity: 0.07;
        }
        .pmx-cross::before, .pmx-cross::after {
          content: ''; position: absolute; background: #059669;
        }
        .pmx-cross::before { width: 1px; height: 32px; top: -16px; left: 0; }
        .pmx-cross::after  { width: 32px; height: 1px; top: 0; left: -16px; }

        .pmx-hero-line {
          position: absolute; background: linear-gradient(90deg, transparent, #a7f3d0, transparent);
          height: 1px; width: 100%;
        }

        .pmx-num {
          font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
          color: #6ee7b7; font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      {/* ─── Header ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #ecfdf5',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#064e3b', letterSpacing: '-0.02em' }}>
              PrivaMed<span style={{ color: '#059669' }}>AI</span>
            </span>
          </div>
          <WalletButton />
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#f0fdf4', borderBottom: '1px solid #d1fae5' }}>

        {/* Decorative crosses */}
        {[[120, 80], [920, 160], [260, 340], [740, 60], [1020, 300]].map(([x, y], i) => (
          <span key={i} className="pmx-cross" style={{ left: x, top: y }} />
        ))}

        {/* Faint grid lines */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #a7f3d0 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.25 }} />

        {/* Green circle glow */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: 760, margin: '0 auto', padding: '96px 24px 100px', textAlign: 'center' }}>

          <div className="pmx-pill" style={{ marginBottom: 28 }}>
            <span className="pmx-dot" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46', fontFamily: "'DM Sans', sans-serif" }}>
              Live on Midnight Preprod
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, color: '#022c22', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 24px' }}>
            Privacy-Preserving<br />
            <span style={{ color: '#059669' }}>Medical Credentials</span>
          </h1>

          <p style={{ fontSize: 18, fontWeight: 300, color: '#166534', lineHeight: 1.7, margin: '0 0 40px', fontFamily: "'DM Sans', sans-serif', maxWidth: 540", display: 'block' }}>
            Zero-knowledge proofs for healthcare. Prove medical credentials without revealing sensitive data.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Link to="/patient/ai" className="pmx-btn-primary">
              <Sparkles size={18} />
              Launch App
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── ZK Circuits ─── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '88px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <p className="pmx-num">01 — CIRCUITS</p>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 38px)', fontWeight: 800, color: '#022c22', letterSpacing: '-0.025em', margin: '8px 0 12px' }}>
            Essential Circuits
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', fontFamily: "'DM Sans', sans-serif", maxWidth: 400 }}>
            Smart contracts that enable selective disclosure of medical data.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {CIRCUITS.map((circuit, i) => (
            <div key={i} className="pmx-circuit-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, background: '#ecfdf5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <circuit.icon size={22} color="#059669" />
                </div>
                <span className="pmx-num">{(i + 1).toString().padStart(2, '0')}</span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#059669', letterSpacing: '0.04em', marginBottom: 6 }}>
                {circuit.name}()
              </p>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#022c22', letterSpacing: '-0.01em', margin: 0 }}>
                {circuit.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section style={{ background: '#f0fdf4', borderTop: '1px solid #d1fae5', borderBottom: '1px solid #d1fae5' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '88px 24px' }}>
          <div style={{ marginBottom: 48 }}>
            <p className="pmx-num">02 — WHO IT'S FOR</p>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 38px)', fontWeight: 800, color: '#022c22', letterSpacing: '-0.025em', margin: '8px 0 0' }}>
              Built for everyone in the health ecosystem
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="pmx-feature-card">
                <div style={{ width: 52, height: 52, background: f.accent, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <f.icon size={24} color={f.iconColor} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#022c22', letterSpacing: '-0.015em', margin: '0 0 12px' }}>
                  {f.label}
                </h3>
                <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Selective Disclosure ─── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '88px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <p className="pmx-num">03 — PRIVACY</p>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 38px)', fontWeight: 800, color: '#022c22', letterSpacing: '-0.025em', margin: '8px 0 12px' }}>
            Selective Disclosure
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', fontFamily: "'DM Sans', sans-serif", maxWidth: 500 }}>
            Zero-knowledge proofs let you prove what you need to share — nothing more.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* What's Private */}
          <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 20, padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, background: '#fef2f2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', margin: 0 }}>
                ZK-Protected
              </h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Actual age value (e.g., 35)',
                'Condition codes (e.g., 100 = diabetes)',
                'Prescription codes (e.g., 500)',
                'All health claim data',
                'Patient identity / wallet address',
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 20, height: 20, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                  <span style={{ fontSize: 14, color: '#7f1d1d', fontFamily: "'DM Sans', sans-serif" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What's Visible */}
          <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, background: '#f0fdf4', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={20} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#166534', margin: 0 }}>
                Visible on-chain (public)
              </h3>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Transaction hash (the receipt)',
                'Contract state changed',
                'totalVerificationsPerformed incremented',
                'Transaction included in a block',
                'The circuit you called',
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 20, height: 20, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                  <span style={{ fontSize: 14, color: '#14532d', fontFamily: "'DM Sans', sans-serif" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{
          background: '#022c22', borderRadius: 24, padding: '64px 48px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="pmx-num" style={{ color: '#6ee7b7', marginBottom: 16 }}>04 — GET STARTED</p>
            <h1 style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 16px' }}>
              Take control of your<br />medical privacy.
            </h1>
            <p style={{ fontSize: 16, color: '#a7f3d0', fontFamily: "'DM Sans', sans-serif", margin: '0 0 36px' }}>
              Your data. Your proof. Zero exposure.
            </p>
            <Link to="/patient/ai" className="pmx-btn-primary" style={{ background: '#10b981' }}>
              <Sparkles size={18} />
              Launch App
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid #ecfdf5', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, background: '#059669', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={13} color="#fff" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#022c22' }}>PrivaMedAI</span>
          </div>
          <p style={{ fontSize: 13, color: '#9ca3af', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            Zero-Knowledge Medical Credentials on Midnight
          </p>
        </div>
      </footer>
    </div>
  );
}