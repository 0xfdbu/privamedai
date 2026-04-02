import { useState } from 'react';
import { Search, Ban, RotateCcw, Eye } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Badge } from '../common';

interface IssuedCredential {
  id: string;
  patientAddress: string;
  claimType: string;
  issuedAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
}

export function ManageCredentials() {
  const [searchQuery, setSearchQuery] = useState('');
  const [credentials] = useState<IssuedCredential[]>([
    {
      id: '1',
      patientAddress: '0x1234...5678',
      claimType: 'COVID-19 Vaccination',
      issuedAt: '2024-01-15',
      expiresAt: '2025-01-15',
      status: 'active',
    },
    {
      id: '2',
      patientAddress: '0xabcd...efgh',
      claimType: 'Medical Clearance',
      issuedAt: '2024-02-01',
      expiresAt: '2024-08-01',
      status: 'active',
    },
  ]);

  const filteredCredentials = credentials.filter(cred => 
    cred.patientAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.claimType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'revoked': return <Badge variant="error">Revoked</Badge>;
      case 'expired': return <Badge variant="warning">Expired</Badge>;
      default: return <Badge>Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Manage Credentials"
        subtitle="View and manage issued credentials"
        icon={Eye}
      />
      <CardBody>
        <div className="mb-4">
          <Input
            placeholder="Search by patient address or claim type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="space-y-3">
          {filteredCredentials.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No credentials found matching your search.
            </div>
          ) : (
            filteredCredentials.map((cred) => (
              <div 
                key={cred.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">{cred.claimType}</span>
                    {getStatusBadge(cred.status)}
                  </div>
                  <div className="flex gap-2">
                    {cred.status === 'active' && (
                      <Button variant="danger" size="sm" leftIcon={<Ban className="w-3 h-3" />}>
                        Revoke
                      </Button>
                    )}
                    {cred.status === 'revoked' && (
                      <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="w-3 h-3" />}>
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                  <p>Patient: {cred.patientAddress}</p>
                  <p>Issued: {cred.issuedAt} • Expires: {cred.expiresAt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
