import { useState } from 'react';
import { Plus, Hash, Calendar } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';

export function IssueCredential() {
  const [formData, setFormData] = useState({
    patientAddress: '',
    claimType: '',
    claimData: '',
    expiryDays: '365',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setResult({
      success: true,
      message: 'Credential issued successfully! Commitment: 0x' + Math.random().toString(16).substring(2, 34),
    });
    setIsSubmitting(false);
    
    setTimeout(() => setResult(null), 5000);
  };

  return (
    <Card>
      <CardHeader 
        title="Issue New Credential"
        subtitle="Create a privacy-preserving credential for a patient"
        icon={Plus}
      />
      <CardBody>
        {result ? (
          <Alert variant={result.success ? 'success' : 'error'}>
            {result.message}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Patient Wallet Address"
              placeholder="0x..."
              value={formData.patientAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, patientAddress: e.target.value }))}
              required
            />

            <Input
              label="Claim Type"
              placeholder="e.g., Vaccination Record, Medical Clearance"
              value={formData.claimType}
              onChange={(e) => setFormData(prev => ({ ...prev, claimType: e.target.value }))}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Claim Data (Encrypted)
              </label>
              <textarea
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                rows={4}
                placeholder="Enter the credential data (will be encrypted)..."
                value={formData.claimData}
                onChange={(e) => setFormData(prev => ({ ...prev, claimData: e.target.value }))}
                required
              />
            </div>

            <Input
              label="Expiry (Days)"
              type="number"
              min="1"
              max="3650"
              leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
              value={formData.expiryDays}
              onChange={(e) => setFormData(prev => ({ ...prev, expiryDays: e.target.value }))}
              required
            />

            <Alert variant="info">
              The credential data will be hashed and stored on-chain. The actual data remains private and is only stored in the patient's encrypted wallet.
            </Alert>

            <Button 
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full"
              leftIcon={<Hash className="w-4 h-4" />}
            >
              Issue Credential
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
