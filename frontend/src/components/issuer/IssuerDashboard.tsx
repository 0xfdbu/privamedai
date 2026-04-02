import { useState, useEffect } from 'react';
import { FileCheck, Users, Clock, TrendingUp } from 'lucide-react';
import { Card, CardBody, Badge } from '../common';

interface Stats {
  totalIssued: number;
  active: number;
  revoked: number;
  thisMonth: number;
}

export function IssuerDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalIssued: 156,
    active: 142,
    revoked: 14,
    thisMonth: 23,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard 
        icon={FileCheck}
        label="Total Issued"
        value={stats.totalIssued}
        trend="+12%"
        color="text-emerald-600"
        bgColor="bg-emerald-50"
      />
      <StatCard 
        icon={Users}
        label="Active"
        value={stats.active}
        trend="91%"
        color="text-blue-600"
        bgColor="bg-blue-50"
      />
      <StatCard 
        icon={Clock}
        label="Revoked"
        value={stats.revoked}
        trend="9%"
        color="text-red-600"
        bgColor="bg-red-50"
      />
      <StatCard 
        icon={TrendingUp}
        label="This Month"
        value={stats.thisMonth}
        trend="+5"
        color="text-purple-600"
        bgColor="bg-purple-50"
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  trend: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, trend, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`p-3 ${bgColor} rounded-lg`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <span className="text-xs font-medium text-slate-500">{trend}</span>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
