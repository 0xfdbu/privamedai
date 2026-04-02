import { useState } from 'react';
import { UserCircle, Sparkles, CreditCard, Share2, MessageSquare } from 'lucide-react';
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

      {/* Quick Help Card - only show on AI tab */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickTip 
            icon={MessageSquare}
            title="Natural Language"
            description="Just describe what you need to prove in plain English"
          />
          <QuickTip 
            icon={Sparkles}
            title="AI Generated"
            description="Our AI converts your request into precise verification rules"
          />
          <QuickTip 
            icon={Share2}
            title="Zero-Knowledge"
            description="Share proofs without revealing your private medical data"
          />
        </div>
      )}

      {/* Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}

interface QuickTipProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function QuickTip({ icon: Icon, title, description }: QuickTipProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Icon className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h4 className="font-medium text-slate-900 text-sm">{title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}
