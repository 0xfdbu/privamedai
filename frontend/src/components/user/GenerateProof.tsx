import { useState } from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Alert, Badge } from '../common';

export function GenerateProof() {
  const [selectedCredential, setSelectedCredential] = useState('');
  const [disclosures, setDisclosures] = useState<Record<string, boolean>>({});
  const [proof, setProof] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const credentials = [
    { id: '1', type: 'Vaccination Record', issuer: '0x1234...5678' },
    { id: '2', type: 'Medical Clearance', issuer: '0xabcd...efgh' },
  ];

  const generateProof = async () => {
    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setProof('zk-proof-' + Math.random().toString(36).substring(2, 15));
    setGenerating(false);
  };

  const copyProof = () => {
    if (proof) {
      navigator.clipboard.writeText(proof);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Generate Zero-Knowledge Proof"
        subtitle="Prove you have a credential without revealing its contents"
        icon={Shield}
      />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Select Credential
          </label>
          <select 
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            value={selectedCredential}
            onChange={(e) => setSelectedCredential(e.target.value)}
          >
            <option value="">Choose a credential...</option>
            {credentials.map(cred => (
              <option key={cred.id} value={cred.id}>{cred.type}</option>
            ))}
          </select>
        </div>

        {selectedCredential && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Selective Disclosure
            </label>
            <div className="space-y-2">
              {['Vaccination Status', 'Date of Issue', 'Issuer Name'].map((field) => (
                <label key={field} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={disclosures[field] || false}
                    onChange={(e) => setDisclosures(prev => ({ ...prev, [field]: e.target.checked }))}
                  />
                  <span className="text-slate-700">{field}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Alert variant="info">
          Zero-knowledge proofs allow you to prove possession of a credential without revealing any other information.
        </Alert>

        <Button 
          onClick={generateProof}
          isLoading={generating}
          disabled={!selectedCredential}
          className="w-full"
        >
          Generate Proof
        </Button>

        {proof && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="success">Proof Generated</Badge>
              <button 
                onClick={copyProof}
                className="text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <code className="text-xs text-emerald-700 break-all">{proof}</code>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
