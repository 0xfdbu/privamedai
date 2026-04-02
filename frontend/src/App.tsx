import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { TabNavigation } from './components/layout/TabNavigation';
import { Alert } from './components/common';

// User Portal
import { CredentialWallet, RequestCredential, GenerateProof } from './components/user';

// Issuer Portal
import { IssuerDashboard, IssueCredential, ManageCredentials } from './components/issuer';

// Verifier Portal
import { VerifyProof, VerificationHistory } from './components/verifier';

type Tab = 'user' | 'issuer' | 'verifier';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const [error, setError] = useState<string | null>(null);

  const renderUserPortal = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <CredentialWallet />
      </div>
      <RequestCredential />
      <GenerateProof />
    </div>
  );

  const renderIssuerPortal = () => (
    <div className="space-y-6">
      <IssuerDashboard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IssueCredential />
        <ManageCredentials />
      </div>
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
