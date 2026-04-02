import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { TabNavigation } from './components/layout/TabNavigation';
import { Alert } from './components/common';

// User Portal
import { CredentialWallet, AIChatComposer, QRShare, ExpirationAlerts } from './components/user';

// Issuer Portal
import { IssuerDashboard, IssueCredential, ManageCredentials, BatchIssue, IssuerRegistration, AuditLog } from './components/issuer';

// Verifier Portal
import { VerifyProof, VerificationHistory } from './components/verifier';

type Tab = 'user' | 'issuer' | 'verifier';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const [error, setError] = useState<string | null>(null);

  const renderUserPortal = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* AI Chat Composer - Takes up 2 columns */}
      <div className="lg:col-span-2">
        <AIChatComposer />
      </div>
      {/* Side panel */}
      <div className="space-y-6">
        <QRShare />
        <ExpirationAlerts />
      </div>
      {/* Full width credential wallet */}
      <div className="lg:col-span-3">
        <CredentialWallet />
      </div>
    </div>
  );

  const renderIssuerPortal = () => (
    <div className="space-y-6">
      <IssuerDashboard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BatchIssue />
        <IssuerRegistration />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IssueCredential />
        <ManageCredentials />
      </div>
      <AuditLog />
    </div>
  );

  const renderVerifierPortal = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <VerifyProof />
      </div>
      <div className="lg:col-span-2">
        <VerificationHistory />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      <Header />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {error && (
          <div className="mb-6">
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {activeTab === 'user' && renderUserPortal()}
        {activeTab === 'issuer' && renderIssuerPortal()}
        {activeTab === 'verifier' && renderVerifierPortal()}
      </main>

      <Footer />
    </div>
  );
}

export default App;
