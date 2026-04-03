import { useState } from 'react';
import { UserCircle, Sparkles, CreditCard, Share2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../common';
import { getWalletState } from '../../services/contractService';

// This component is now a simple wrapper that shows portal info
// Actual navigation is handled by sidebar
export function UserPortal() {
  const [walletConnected] = useState(() => getWalletState().isConnected);

  return (
    <Card className="mb-6">
      <CardHeader 
        title="Welcome to Your Health Wallet"
        subtitle="Generate privacy-preserving proofs for clinical trials, travel, and more"
        icon={UserCircle}
        action={
          walletConnected ? (
            <Badge variant="success">Wallet Connected</Badge>
          ) : (
            <Badge variant="warning">Connect Wallet</Badge>
          )
        }
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Sparkles}
            title="AI Composer"
            description="Describe what you need to prove in plain English"
            link="/patient/ai"
          />
          <FeatureCard
            icon={CreditCard}
            title="My Credentials"
            description="View and manage your medical credentials"
            link="/patient/credentials"
          />
          <FeatureCard
            icon={Share2}
            title="Share"
            description="Share proofs with verifiers via QR code"
            link="/patient/share"
          />
        </div>
      </CardBody>
    </Card>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  link 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  link: string;
}) {
  return (
    <a 
      href={link}
      className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors group"
    >
      <Icon className="w-8 h-8 text-emerald-600 mb-3 group-hover:scale-110 transition-transform" />
      <h3 className="font-medium text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </a>
  );
}
