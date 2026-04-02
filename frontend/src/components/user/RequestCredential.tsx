import { useState } from 'react';
import { Send, Building2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';

interface CredentialRequest {
  providerAddress: string;
  claimType: string;
  reason: string;
}

export function RequestCredential() {
  const [request, setRequest] = useState<CredentialRequest>({
    providerAddress: '',
    claimType: '',
    reason: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <Card>
      <CardHeader 
        title="Request Credential"
        subtitle="Request a new credential from your medical provider"
        icon={Building2}
      />
      <CardBody>
        {submitted ? (
          <Alert variant="success" title="Request Submitted">
            Your credential request has been submitted. The provider will review and issue your credential if approved.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Provider Address"
              placeholder="Enter provider's wallet address"
              value={request.providerAddress}
              onChange={(e) => setRequest(prev => ({ ...prev, providerAddress: e.target.value }))}
              required
            />
            
            <Input
              label="Credential Type"
              placeholder="e.g., Vaccination Record, Medical Clearance"
              value={request.claimType}
              onChange={(e) => setRequest(prev => ({ ...prev, claimType: e.target.value }))}
              required
            />
            
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Reason for Request
              </label>
              <textarea
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors resize-none"
                rows={3}
                placeholder="Briefly explain why you need this credential..."
                value={request.reason}
                onChange={(e) => setRequest(prev => ({ ...prev, reason: e.target.value }))}
                required
              />
            </div>

            <Alert variant="info">
              Your request will be sent to the provider. They will verify your identity and issue the credential using zero-knowledge proofs for privacy.
            </Alert>

            <Button 
              type="submit" 
              className="w-full"
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Request
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
