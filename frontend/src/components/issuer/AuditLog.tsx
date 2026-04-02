import { useState } from 'react';
import { FileText, Download, Filter, Calendar, Search } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Badge } from '../common';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'issue' | 'revoke' | 'verify' | 'register';
  credentialId?: string;
  patientAddress?: string;
  claimType?: string;
  txHash: string;
  status: 'success' | 'failed';
}

export function AuditLog() {
  const [entries] = useState<AuditEntry[]>([
    {
      id: '1',
      timestamp: '2024-03-15 14:30:22',
      action: 'issue',
      credentialId: 'cred-001',
      patientAddress: '0x1234...5678',
      claimType: 'Vaccination Record',
      txHash: '0xabc...def',
      status: 'success',
    },
    {
      id: '2',
      timestamp: '2024-03-15 13:15:10',
      action: 'issue',
      credentialId: 'cred-002',
      patientAddress: '0xabcd...efgh',
      claimType: 'Medical Clearance',
      txHash: '0x123...456',
      status: 'success',
    },
    {
      id: '3',
      timestamp: '2024-03-14 09:45:33',
      action: 'revoke',
      credentialId: 'cred-000',
      patientAddress: '0x5678...9012',
      claimType: 'Free Healthcare Eligibility',
      txHash: '0x789...012',
      status: 'success',
    },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.credentialId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.patientAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.claimType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'issue': return <Badge variant="success">Issue</Badge>;
      case 'revoke': return <Badge variant="error">Revoke</Badge>;
      case 'verify': return <Badge variant="info">Verify</Badge>;
      case 'register': return <Badge variant="warning">Register</Badge>;
      default: return <Badge>{action}</Badge>;
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'Credential ID', 'Patient Address', 'Claim Type', 'TX Hash', 'Status'].join(','),
      ...filteredEntries.map(e => [
        e.timestamp,
        e.action,
        e.credentialId || '',
        e.patientAddress || '',
        e.claimType || '',
        e.txHash,
        e.status,
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader 
        title="Audit Log"
        subtitle="Complete history of all issuer actions"
        icon={FileText}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportLogs} leftIcon={<Download className="w-4 h-4" />}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJSON} leftIcon={<Download className="w-4 h-4" />}>
              JSON
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by credential, patient, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
            />
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Action</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Credential</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Patient</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">TX Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-600">{entry.timestamp}</td>
                  <td className="py-3 px-4">{getActionBadge(entry.action)}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{entry.claimType}</p>
                      <p className="text-xs text-slate-500">{entry.credentialId}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 font-mono">{entry.patientAddress}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 font-mono">{entry.txHash.slice(0, 10)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No audit entries found matching your criteria.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
