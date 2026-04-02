import { useState } from 'react';
import { UserCircle, Sparkles, CreditCard, Share2 } from 'lucide-react';
import { AIChatComposer } from './AIChatComposer';
import { CredentialWallet } from './CredentialWallet';
import { QRShare } from './QRShare';
import { Card, CardHeader, CardBody, Badge } from '../common';
import { getWalletState } from '../../services/contractService';

type UserTab = 'ai' | 'credentials' | 'share';

const tabs = [
  { id: 'ai' as UserTab, label: 'AI Composer', icon: Sparkles, description: 'Generate ZK proofs with AI' },
  { id: 'credentials' as UserTab, label: 'My Credentials', icon: CreditCard, description: 'Manage your credentials' },
  { id: 'share' as UserTab, label: 'Share', icon: Share2, description: 'Share proofs with QR' },
];

export function UserPortal() {
  const [activeTab, setActiveTab] = useState<UserTab>('ai');
  const [walletConnected] = useState(() => getWalletState().isConnected);

  const renderContent = () => {
    switch (activeTab) {
      case 'ai':
        return <AIChatComposer />;
      case 'credentials':
        return <CredentialWallet />;
      case 'share':
        return <QRShare />;
      default:
        return <AIChatComposer />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader
          title="Patient Portal"
          subtitle="Manage your privacy-preserving medical credentials"
          icon={UserCircle}
          action={
            walletConnected ? (
              <Badge variant="success">Wallet Connected</Badge>
            ) : (
              <Badge variant="warning">Connect Wallet</Badge>
            )
          }
        />
        <CardBody className="p-0">
          {/* Sub-navigation */}
          <div className="border-t border-slate-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                      ${isActive 
                        ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' 
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}
