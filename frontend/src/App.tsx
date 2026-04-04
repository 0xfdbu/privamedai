import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { 
  Shield,
  UserCircle, 
  Stethoscope, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 

  Plus,
  Hash,
  Users,
  ClipboardList,
  Menu,
  X
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// User Portal Pages
import { AIChatComposer } from './components/user/AIChatComposer';
import { CredentialWallet } from './components/user/CredentialWallet';


// Issuer Portal Pages
import { IssueCredential } from './components/issuer/IssueCredential';
import { IssuerManagement } from './components/issuer/IssuerManagement';
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

];

// Issuer sub-navigation
const issuerNav: NavItem[] = [
  { path: '/issuer/issue', label: 'Issue Credentials', icon: Plus },
  { path: '/issuer/manage', label: 'Manage Credentials', icon: Users },
  { path: '/issuer/issuers', label: 'Issuers', icon: Users },
];

// Verifier sub-navigation
const verifierNav: NavItem[] = [
  { path: '/verifier/verify', label: 'Verify Proof', icon: ShieldCheck },
  { path: '/verifier/history', label: 'History', icon: ClipboardList },
];

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 overflow-y-auto z-50 shadow-xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">PrivaMedAI</h1>
            <p className="text-xs text-slate-500 truncate">ZK Medical Credentials</p>
          </div>
        </NavLink>
        {/* Close button for mobile */}
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
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
    </>
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

    </Routes>
  );
}

// Wrapper components with headers
function CredentialWalletPage() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Credentials</h1>
          <p className="text-sm text-slate-500">View and manage your medical credentials</p>
        </div>
        <CredentialWallet />
      </div>
    </div>
  );
}

function IssuerLayout() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Medical Provider Portal</h1>
            <p className="text-sm text-slate-500">Issue credentials and manage registrations</p>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Navigate to="issue" replace />} />
          <Route path="issue" element={<IssueCredential />} />
          <Route path="manage" element={<ManageCredentials />} />
          <Route path="issuers" element={<IssuerManagement />} />
          <Route path="register" element={<Navigate to="/issuer/issuers" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function VerifierLayout() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Verifier Portal</h1>
            <p className="text-sm text-slate-500">Verify zero-knowledge proofs without accessing private data</p>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        
        <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
          {/* Mobile header with menu button */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-sm">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900">PrivaMedAI</span>
            </NavLink>
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
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
