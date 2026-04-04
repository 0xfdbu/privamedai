import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { 
  Shield,
  UserCircle, 
  Stethoscope, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Share2,
  Plus,
  Hash,
  Users,
  ClipboardList
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// User Portal Pages
import { AIChatComposer } from './components/user/AIChatComposer';
import { CredentialWallet } from './components/user/CredentialWallet';
import { QRShare } from './components/user/QRShare';

// Issuer Portal Pages
import { IssueCredential } from './components/issuer/IssueCredential';
import { RegisterIssuer } from './components/issuer/RegisterIssuer';
import { RegisteredIssuers } from './components/issuer/RegisteredIssuers';
import { ManageCredentials } from './components/issuer/ManageCredentials';

// Verifier Portal Pages
import { VerifyProof } from './components/verifier/VerifyProof';
import { VerificationHistory } from './components/verifier/VerificationHistory';

// Sidebar navigation item
interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

// Main navigation sections
const mainNav: NavItem[] = [
  { path: '/patient', label: 'Patient Portal', icon: UserCircle },
  { path: '/issuer', label: 'Medical Provider', icon: Stethoscope },
  { path: '/verifier', label: 'Verifier', icon: ShieldCheck },
];

// Patient sub-navigation
const patientNav: NavItem[] = [
  { path: '/patient/ai', label: 'AI Composer', icon: Sparkles },
  { path: '/patient/credentials', label: 'My Credentials', icon: CreditCard },
  { path: '/patient/share', label: 'Share', icon: Share2 },
];

// Issuer sub-navigation
const issuerNav: NavItem[] = [
  { path: '/issuer/issue', label: 'Issue Credentials', icon: Plus },
  { path: '/issuer/manage', label: 'Manage Credentials', icon: Users },
  { path: '/issuer/register', label: 'Register', icon: Hash },
  { path: '/issuer/issuers', label: 'Registered Issuers', icon: Users },
];

// Verifier sub-navigation
const verifierNav: NavItem[] = [
  { path: '/verifier/verify', label: 'Verify Proof', icon: ShieldCheck },
  { path: '/verifier/history', label: 'History', icon: ClipboardList },
];

function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 overflow-y-auto z-50 shadow-xl">
      {/* Logo */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">PrivaMedAI</h1>
            <p className="text-xs text-slate-500 truncate">ZK Medical Credentials</p>
          </div>
        </NavLink>
      </div>

      <div className="p-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Portals
        </h2>
        <nav className="space-y-1">
          {mainNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="px-4 py-2">
        <div className="border-t border-slate-200" />
      </div>

      <Routes>
        <Route path="/patient/*" element={<SubNav items={patientNav} title="Patient" />} />
        <Route path="/issuer/*" element={<SubNav items={issuerNav} title="Provider" />} />
        <Route path="/verifier/*" element={<SubNav items={verifierNav} title="Verifier" />} />
      </Routes>
    </aside>
  );
}

function SubNav({ items, title }: { items: NavItem[]; title: string }) {
  return (
    <div className="px-4 pb-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {title} Tools
      </h2>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-l-2 border-emerald-500'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function PatientLayout() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="ai" replace />} />
      <Route path="ai" element={
        <div className="h-[calc(100vh-64px)]">
          <AIChatComposer />
        </div>
      } />
      <Route path="credentials" element={<CredentialWalletPage />} />
      <Route path="share" element={<QRSharePage />} />
    </Routes>
  );
}

// Wrapper components with headers
function CredentialWalletPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Credentials</h1>
          <p className="text-slate-500">View and manage your medical credentials</p>
        </div>
        <CredentialWallet />
      </div>
    </div>
  );
}

function QRSharePage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Share Proof</h1>
          <p className="text-slate-500">Share your credentials via QR code</p>
        </div>
        <QRShare />
      </div>
    </div>
  );
}

function IssuerLayout() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Medical Provider Portal</h1>
            <p className="text-slate-500">Issue credentials and manage registrations</p>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Navigate to="issue" replace />} />
          <Route path="issue" element={<IssueCredential />} />
          <Route path="manage" element={<ManageCredentials />} />
          <Route path="register" element={<RegisterIssuer />} />
          <Route path="issuers" element={<RegisteredIssuers />} />
        </Routes>
      </div>
    </div>
  );
}

function VerifierLayout() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Verifier Portal</h1>
            <p className="text-slate-500">Verify zero-knowledge proofs without accessing private data</p>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Navigate to="verify" replace />} />
          <Route path="verify" element={<VerifyProof />} />
          <Route path="history" element={<VerificationHistory />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <Header />
          
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/*" element={<PatientLayout />} />
              <Route path="/issuer/*" element={<IssuerLayout />} />
              <Route path="/verifier/*" element={<VerifierLayout />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
