import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  CreditCard, 
  PlusCircle,
  Building2,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// User Portal Pages
import { LandingPage } from './components/LandingPage';
import { AIChatComposer } from './components/user/AIChatComposer';


// Issuer Portal Pages
import { IssueCredential } from './components/issuer/IssueCredential';
import { IssuerManagement } from './components/issuer/IssuerManagement';
import { ManageCredentials } from './components/issuer/ManageCredentials';

// Verifier Portal Pages
import { VerifyProof } from './components/verifier/VerifyProof';

// Sidebar navigation
const navItems = [
  { path: '/patient/ai', label: 'Generate Proof', icon: Sparkles, section: 'Patient' },
  { path: '/patient/verify', label: 'Submit Proof', icon: ShieldCheck, section: 'Patient' },
  { path: '/issuer/issue', label: 'Issue Credential', icon: PlusCircle, section: 'Provider' },
  { path: '/issuer/issuers', label: 'Register As Issuer', icon: Building2, section: 'Provider' },
  { path: '/issuer/manage', label: 'Manage Credentials', icon: Settings, section: 'Provider' },
];

// Group nav items by section
const navBySection = navItems.reduce((acc, item) => {
  if (!acc[item.section]) acc[item.section] = [];
  acc[item.section].push(item);
  return acc;
}, {} as Record<string, typeof navItems>);

function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 overflow-y-auto z-50 shadow-xl">
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <NavLink to="/" className="flex items-center hover:opacity-80 transition-opacity">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            PrivaMedAI
          </h1>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6">
        {Object.entries(navBySection).map(([section, items]) => (
          <div key={section}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
              {section}
            </h3>
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Network info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Midnight Preprod</span>
        </div>
      </div>
    </aside>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - hidden on landing page */}
      {!isLandingPage && <Sidebar />}
      
      <div className={`flex-1 flex flex-col min-h-screen ${isLandingPage ? '' : 'lg:ml-64'}`}>
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <NavLink to="/" className="flex items-center">
            <span className="font-bold text-2xl text-slate-900">PrivaMedAI</span>
          </NavLink>
        </div>
        
        <Header />
        
        {children}
        
        {!isLandingPage && <Footer />}
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* App Routes */}
      <Route path="/*" element={
        <AppLayout>
          <main className="flex-1">
            <Routes>
               {/* Patient Routes */}
               <Route path="/patient/ai" element={
                 <div className="h-full">
                   <AIChatComposer />
                 </div>
               } />
                <Route path="/patient/verify" element={<VerifyProof />} />
                
                {/* Provider Routes */}
                <Route path="/issuer/issue" element={<IssueCredential />} />
                <Route path="/issuer/issuers" element={<IssuerManagement />} />
                <Route path="/issuer/manage" element={<ManageCredentials />} />
               
               {/* Legacy redirects */}
               <Route path="/patient" element={<Navigate to="/patient/ai" replace />} />
               <Route path="/issuer" element={<Navigate to="/issuer/issue" replace />} />
               <Route path="/verifier" element={<Navigate to="/patient/verify" replace />} />
               <Route path="/verifier/verify" element={<Navigate to="/patient/verify" replace />} />
            </Routes>
          </main>
        </AppLayout>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;