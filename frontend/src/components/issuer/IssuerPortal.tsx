import { useState } from 'react';
import { Building2, FilePlus, UserCircle, Users } from 'lucide-react';
import { IssueCredential } from './IssueCredential';
import { RegisterIssuer } from './RegisterIssuer';
import { RegisteredIssuers } from './RegisteredIssuers';

// Note: Removed Dashboard, ManageCredentials, and AuditLog tabs as requested
// Now only showing: Issue Credentials, Register, and Registered Issuers

import { Card, CardHeader, CardBody, Badge } from '../common';

type IssuerTab = 'issue' | 'registration' | 'issuers';

const tabs = [
  { id: 'issue' as IssuerTab, label: 'Issue Credentials', icon: FilePlus },
  { id: 'registration' as IssuerTab, label: 'Register', icon: UserCircle },
  { id: 'issuers' as IssuerTab, label: 'Registered Issuers', icon: Users },
];

export function IssuerPortal() {
  const [activeTab, setActiveTab] = useState<IssuerTab>('issue');
  const [issuerStatus] = useState({
    isRegistered: true,
    isActive: true,
    name: 'City General Hospital',
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'issue':
        return <IssueCredential />;
      case 'registration':
        return <RegisterIssuer />;
      case 'issuers':
        return <RegisteredIssuers />;
      default:
        return <IssueCredential />;
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
