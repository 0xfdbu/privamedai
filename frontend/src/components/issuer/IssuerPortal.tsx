import { useState } from 'react';
import { Building2, LayoutDashboard, FilePlus, ClipboardList, UserCircle, FileText } from 'lucide-react';
import { IssuerDashboard } from './IssuerDashboard';
import { IssueCredential } from './IssueCredential';
import { BatchIssue } from './BatchIssue';
import { ManageCredentials } from './ManageCredentials';
import { IssuerRegistration } from './IssuerRegistration';
import { AuditLog } from './AuditLog';
import { Card, CardHeader, CardBody, Badge } from '../common';

type IssuerTab = 'dashboard' | 'issue' | 'manage' | 'registration' | 'audit';

const tabs = [
  { id: 'dashboard' as IssuerTab, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'issue' as IssuerTab, label: 'Issue Credentials', icon: FilePlus },
  { id: 'manage' as IssuerTab, label: 'Manage', icon: ClipboardList },
  { id: 'registration' as IssuerTab, label: 'Registration', icon: UserCircle },
  { id: 'audit' as IssuerTab, label: 'Audit Log', icon: FileText },
];

export function IssuerPortal() {
  const [activeTab, setActiveTab] = useState<IssuerTab>('dashboard');
  const [issuerStatus, setIssuerStatus] = useState({
    isRegistered: true,
    isActive: true,
    name: 'City General Hospital',
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <IssuerDashboard />;
      case 'issue':
        return (
          <div className="space-y-6">
            <BatchIssue />
            <IssueCredential />
          </div>
        );
      case 'manage':
        return <ManageCredentials />;
      case 'registration':
        return <IssuerRegistration />;
      case 'audit':
        return <AuditLog />;
      default:
        return <IssuerDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader
          title="Medical Provider Portal"
          subtitle="Issue and manage privacy-preserving credentials"
          icon={Building2}
          action={
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{issuerStatus.name}</span>
              {issuerStatus.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
            </div>
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
                    {tab.label}
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
