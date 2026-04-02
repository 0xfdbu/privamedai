import { useState } from 'react';
import { Users, Plus, Trash2, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert, Badge } from '../common';

interface BatchCredential {
  id: string;
  patientAddress: string;
  claimType: string;
  claimData: string;
  expiryDays: string;
}

export function BatchIssue() {
  const [credentials, setCredentials] = useState<BatchCredential[]>([
    { id: '1', patientAddress: '', claimType: '', claimData: '', expiryDays: '365' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null);

  const addCredential = () => {
    if (credentials.length >= 10) {
      alert('Maximum 10 credentials per batch');
      return;
    }
    setCredentials(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      patientAddress: '',
      claimType: '',
      claimData: '',
      expiryDays: '365',
    }]);
  };

  const removeCredential = (id: string) => {
    if (credentials.length <= 1) return;
    setCredentials(prev => prev.filter(c => c.id !== id));
  };

  const updateCredential = (id: string, field: keyof BatchCredential, value: string) => {
    setCredentials(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const newCredentials: BatchCredential[] = [];
      
      for (let i = 1; i < lines.length && i <= 10; i++) {
        const [patientAddress, claimType, claimData, expiryDays] = lines[i].split(',');
        if (patientAddress && claimType) {
          newCredentials.push({
            id: Math.random().toString(36).substring(2, 9),
            patientAddress: patientAddress.trim(),
            claimType: claimType.trim(),
            claimData: (claimData || '').trim(),
            expiryDays: (expiryDays || '365').trim(),
          });
        }
      }
      
      if (newCredentials.length > 0) {
        setCredentials(newCredentials);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = 'patientAddress,claimType,claimData,expiryDays\n0x1234...,Vaccination Record,COVID-19 Vaccine,365\n0x5678...,Medical Clearance,Fit for surgery,180';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch-credential-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    const validCreds = credentials.filter(c => c.patientAddress && c.claimType);
    if (validCreds.length === 0) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setResult({
      success: true,
      message: `Successfully issued ${validCreds.length} credentials`,
      txId: '0x' + Math.random().toString(16).substring(2, 34),
    });
    setIsSubmitting(false);
    
    setTimeout(() => setResult(null), 8000);
  };

  return (
    <Card>
      <CardHeader 
        title="Batch Credential Issuance"
        subtitle="Issue multiple credentials in a single transaction (up to 10)"
        icon={Users}
        action={
          <Badge variant="info">{credentials.length}/10</Badge>
        }
      />
      <CardBody className="space-y-4">
        {result ? (
          <Alert variant="success" title="Batch Issued Successfully">
            <div className="space-y-1">
              <p>{result.message}</p>
              {result.txId && <p className="text-xs font-mono">TX: {result.txId}</p>}
            </div>
          </Alert>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button variant="secondary" size="sm" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                Download CSV Template
              </Button>
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleCSVUpload}
                />
                <span className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Import CSV
                </span>
              </label>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {credentials.map((cred, index) => (
                <div key={cred.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
                      <Badge variant="default" size="sm">Credential</Badge>
                    </div>
                    <button 
                      onClick={() => removeCredential(cred.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      disabled={credentials.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Patient Address (0x...)"
                      value={cred.patientAddress}
                      onChange={(e) => updateCredential(cred.id, 'patientAddress', e.target.value)}
                    />
                    <Input
                      placeholder="Claim Type"
                      value={cred.claimType}
                      onChange={(e) => updateCredential(cred.id, 'claimType', e.target.value)}
                    />
                    <Input
                      placeholder="Claim Data"
                      value={cred.claimData}
                      onChange={(e) => updateCredential(cred.id, 'claimData', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Expiry (days)"
                      value={cred.expiryDays}
                      onChange={(e) => updateCredential(cred.id, 'expiryDays', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button 
              variant="secondary" 
              onClick={addCredential}
              className="w-full"
              leftIcon={<Plus className="w-4 h-4" />}
              disabled={credentials.length >= 10}
            >
              Add Credential
            </Button>

            <Alert variant="info">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">CSV Format</p>
                  <p className="text-xs">patientAddress,claimType,claimData,expiryDays</p>
                </div>
              </div>
            </Alert>

            <Button 
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting || credentials.filter(c => c.patientAddress && c.claimType).length === 0}
              className="w-full"
            >
              Issue {credentials.filter(c => c.patientAddress && c.claimType).length} Credentials
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
