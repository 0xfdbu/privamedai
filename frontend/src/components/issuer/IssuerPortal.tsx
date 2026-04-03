import { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  FilePlus, 
  UserCircle, 
  Users, 
  ShieldCheck,
  Activity,
  Award,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Card } from '../common';
import { getWalletState } from '../../services/contractService';
import { queryCredentialsOnChain } from '../../services/contractInteraction';

interface Stats {
  credentialsIssued: number;
  activePatients: number;
  recentActivity: number;
}

export function IssuerPortal() {
  const [issuerStatus] = useState({
    isRegistered: true,
    isActive: true,
    name: 'City General Hospital',
    role: 'Medical Provider',
  });
  
  const [stats, setStats] = useState<Stats>({
    credentialsIssued: 0,
    activePatients: 0,
    recentActivity: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const wallet = getWalletState();
      if (wallet.isConnected && wallet.address) {
        const result = await queryCredentialsOnChain(wallet.address);
        if (result.success) {
          const total = Number(result.totalCredentials) || 0;
          setStats({
            credentialsIssued: total,
            activePatients: Math.max(1, Math.floor(total * 0.7)),
            recentActivity: Math.max(0, total - 2),
          });
        }
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <span className="text-emerald-100 text-sm font-medium uppercase tracking-wide">
                {issuerStatus.role}
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{issuerStatus.name}</h1>
            <p className="text-emerald-100 max-w-xl">
              Issue privacy-preserving medical credentials for your patients. 
              All credentials are secured with zero-knowledge proofs on the Midnight network.
            </p>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Active</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <StatCard 
            icon={Award}
            value={stats.credentialsIssued}
            label="Credentials Issued"
          />
          <StatCard 
            icon={Users}
            value={stats.activePatients}
            label="Active Patients"
          />
          <StatCard 
            icon={Clock}
            value={stats.recentActivity}
            label="This Week"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            icon={FilePlus}
            title="Issue New Credential"
            description="Create a privacy-preserving credential for a patient with their medical data"
            link="/issuer/issue"
            color="emerald"
          />
          <ActionCard
            icon={UserCircle}
            title="Register as Issuer"
            description="Register your medical practice as a verified credential issuer on the network"
            link="/issuer/register"
            color="blue"
          />
          <ActionCard
            icon={Users}
            title="View All Issuers"
            description="Browse the registry of all verified medical providers in the network"
            link="/issuer/issuers"
            color="slate"
          />
        </div>
      </div>

      {/* Recent Activity & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900">How It Works</h3>
          </div>
          <div className="space-y-4">
            <Step 
              number={1}
              title="Enter Patient Details"
              description="Input the patient's wallet address and claim type"
            />
            <Step 
              number={2}
              title="Set Medical Data"
              description="Configure the credential fields like diagnoses, vaccinations, etc."
            />
            <Step 
              number={3}
              title="Issue On-Chain"
              description="The credential is hashed and stored on the Midnight blockchain"
            />
            <Step 
              number={4}
              title="Patient Receives"
              description="Patient gets the credential in their wallet for generating proofs"
            />
          </div>
        </Card>

        {/* Benefits Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Benefits</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <BenefitItem 
              title="Privacy First"
              description="Only commitments stored on-chain"
            />
            <BenefitItem 
              title="Zero-Knowledge"
              description="Patients prove without revealing"
            />
            <BenefitItem 
              title="Tamper-Proof"
              description="Blockchain-secured credentials"
            />
            <BenefitItem 
              title="Interoperable"
              description="Works across all verifiers"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-xl">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-emerald-100 text-sm">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ 
  icon: Icon, 
  title, 
  description, 
  link,
  color
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  link: string;
  color: 'emerald' | 'blue' | 'slate';
}) {
  const colorClasses = {
    emerald: 'from-emerald-50 to-emerald-100/50 border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/20',
    blue: 'from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-400 hover:shadow-blue-500/20',
    slate: 'from-slate-50 to-slate-100/50 border-slate-200 hover:border-slate-400 hover:shadow-slate-500/20',
  };
  
  const iconColors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <a 
      href={link}
      className={`block p-6 bg-gradient-to-br ${colorClasses[color]} rounded-2xl border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group`}
    >
      <div className={`w-12 h-12 ${iconColors[color]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-2 text-lg">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      
      <div className="mt-4 flex items-center text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">
        Get Started
        <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-semibold text-sm">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-slate-900">{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function BenefitItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl">
      <h4 className="font-medium text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
