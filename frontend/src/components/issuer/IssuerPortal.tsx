import { useState } from 'react';
import { Building2, FilePlus, UserCircle, Users } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../common';

// This is now a landing page for the Medical Provider Portal
// Actual navigation is handled by sidebar
export function IssuerPortal() {
  const [issuerStatus] = useState({
    isRegistered: true,
    isActive: true,
    name: 'City General Hospital',
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader
          title="Medical Provider Portal"
          subtitle="Issue privacy-preserving credentials for your patients"
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
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon={FilePlus}
              title="Issue Credentials"
              description="Create new medical credentials for patients"
              link="/issuer/issue"
            />
            <FeatureCard
              icon={UserCircle}
              title="Register"
              description="Register as a credential issuer"
              link="/issuer/register"
            />
            <FeatureCard
              icon={Users}
              title="Registered Issuers"
              description="View all registered medical providers"
              link="/issuer/issuers"
            />
          </div>
        </CardBody>
      </Card>
    </div>
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
