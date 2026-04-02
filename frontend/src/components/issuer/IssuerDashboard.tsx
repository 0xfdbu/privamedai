import { useState, useEffect } from 'react';
import { Building2, FileCheck, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Alert } from '../common';
import { IssuerInfo } from '../../types';

interface Stats {
  totalIssued: number;
  active: number;
  revoked: number;
  pending: number;
}

export function IssuerDashboard() {
  const [issuerInfo, setIssuerInfo] = useState<IssuerInfo | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalIssued: 0,
    active: 0,
    revoked: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIssuerInfo({
        name: 'City General Hospital',
        publicKey: '0x1234...5678',
        isActive: true,
        credentialsIssued: 156,
      });
      setStats({
        totalIssued: 156,
        active: 142,
        revoked: 14,
        pending: 3,
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3" />
            <div className="h-24 bg-slate-200 rounded" />
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader 
        title="Issuer Dashboard"
        subtitle="Overview of your credential issuance activity"
        icon={Building2}
        action={
          issuerInfo?.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="error">Inactive</Badge>
          )
        }
      />
      <CardBody className="space-y-6">
        {issuerInfo && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-lg font-medium text-slate-900 mb-1">{issuerInfo.name}</h3>
            <p className="text-sm text-slate-500">{issuerInfo.publicKey}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={FileCheck}
            label="Total Issued"
            value={stats.totalIssued}
            color="text-emerald-600"
          />
          <StatCard 
            icon={FileCheck}
            label="Active"
            value={stats.active}
            color="text-blue-600"
          />
          <StatCard 
            icon={AlertCircle}
            label="Revoked"
            value={stats.revoked}
            color="text-red-600"
          />
          <StatCard 
            icon={Clock}
            label="Pending"
            value={stats.pending}
            color="text-amber-600"
          />
        </div>

        <Alert variant="info">
          As a registered medical provider, you can issue privacy-preserving credentials to patients. All credentials are secured with zero-knowledge proofs.
        </Alert>
      </CardBody>
    </Card>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
      <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
