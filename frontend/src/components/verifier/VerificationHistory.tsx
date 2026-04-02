import { useState } from 'react';
import { History, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../common';

interface VerificationRecord {
  id: string;
  timestamp: string;
  credentialType: string;
  issuer: string;
  result: 'valid' | 'invalid' | 'pending';
  verifier: string;
}

export function VerificationHistory() {
  const [records] = useState<VerificationRecord[]>([
    {
      id: '1',
      timestamp: '2024-03-15 14:30',
      credentialType: 'Vaccination Record',
      issuer: 'City General Hospital',
      result: 'valid',
      verifier: '0x7890...1234',
    },
    {
      id: '2',
      timestamp: '2024-03-14 09:15',
      credentialType: 'Medical Clearance',
      issuer: 'State Health Dept',
      result: 'valid',
      verifier: '0xabcd...efgh',
    },
    {
      id: '3',
      timestamp: '2024-03-13 16:45',
      credentialType: 'Free Healthcare Eligibility',
      issuer: 'Public Health Dept',
      result: 'invalid',
      verifier: '0x5678...9012',
    },
  ]);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'invalid': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-600" />;
      default: return null;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'valid': return <Badge variant="success">Valid</Badge>;
      case 'invalid': return <Badge variant="error">Invalid</Badge>;
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      default: return <Badge>Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Verification History"
        subtitle="Recent proof verifications"
        icon={History}
      />
      <CardBody>
        <div className="space-y-3">
          {records.map((record) => (
            <div 
              key={record.id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getResultIcon(record.result)}
                  <span className="font-medium text-slate-900">{record.credentialType}</span>
                </div>
                {getResultBadge(record.result)}
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                <p>Issuer: {record.issuer}</p>
                <p>Verifier: {record.verifier}</p>
                <p className="text-xs">{record.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
