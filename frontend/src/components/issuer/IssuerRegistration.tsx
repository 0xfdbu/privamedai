import { useState } from 'react';
import { Building2, Key, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';

interface RegistrationStatus {
  isRegistered: boolean;
  isPending: boolean;
  name?: string;
  publicKey?: string;
}

export function IssuerRegistration() {
  const [status, setStatus] = useState<RegistrationStatus>({ isRegistered: false, isPending: false });
  const [formData, setFormData] = useState({
    name: '',
    licenseNumber: '',
    publicKey: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkRegistration = async () => {
    // Mock checking on-chain status
    await new Promise(resolve => setTimeout(resolve, 1000));
    // For demo, show as not registered
    setStatus({ isRegistered: false, isPending: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate on-chain registration
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setResult({
      success: true,
      message: 'Registration submitted! Your issuer status is now pending admin approval.',
    });
    setStatus({ isRegistered: false, isPending: true, name: formData.name });
    setIsSubmitting(false);
    
    setTimeout(() => setResult(null), 5000);
  };

  if (status.isRegistered) {
    return (
      <Card>
        <CardHeader 
          title="Issuer Status"
          subtitle="Your registration is active"
          icon={Building2}
        />
        <CardBody>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-800">Active Issuer</h3>
                <p className="text-sm text-emerald-700">{status.name}</p>
                <p className="text-xs text-emerald-600 font-mono mt-1">{status.publicKey}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (status.isPending) {
    return (
      <Card>
        <CardHeader 
          title="Issuer Status"
          subtitle="Registration pending approval"
          icon={Building2}
        />
        <CardBody>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-800">Pending Approval</h3>
                <p className="text-sm text-amber-700">{status.name}</p>
                <p className="text-xs text-amber-600 mt-1">
                  Your registration is being reviewed by the network admin.
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader 
        title="Issuer Registration"
        subtitle="Register as a credential issuer on the network"
        icon={Building2}
      />
      <CardBody>
        {result ? (
          <Alert variant="success" title="Registration Submitted">
            {result.message}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Organization Name"
              placeholder="e.g., City General Hospital"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            
            <Input
              label="License Number"
              placeholder="Medical institution license number"
              value={formData.licenseNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
              required
            />
            
            <Input
              label="Public Key"
              placeholder="Your wallet's public key (auto-filled)"
              value={formData.publicKey}
              onChange={(e) => setFormData(prev => ({ ...prev, publicKey: e.target.value }))}
              leftIcon={<Key className="w-4 h-4" />}
            />

            <Alert variant="info">
              Registration requires admin approval. Once approved, you'll be able to issue privacy-preserving credentials to patients.
            </Alert>

            <Button 
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full"
            >
              Submit Registration
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
