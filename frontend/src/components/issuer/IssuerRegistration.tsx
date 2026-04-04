import { useState, useEffect } from 'react';
import { Building2, Key, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';
import { getWalletState } from '../../services/contractService';
import { registerIssuerOnChain, checkIssuerOnChain } from '../../services/contractInteraction';

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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const wallet = getWalletState();

  useEffect(() => {
    checkRegistration();
  }, []);

  const checkRegistration = async () => {
    setIsChecking(true);
    try {
      const wallet = getWalletState();
      if (!wallet.coinPublicKey) {
        setStatus({ isRegistered: false, isPending: false });
        setIsChecking(false);
        return;
      }

      // Check on-chain status
      const issuerResult = await checkIssuerOnChain(wallet.coinPublicKey.slice(0, 64));
      
      if (issuerResult.registered && issuerResult.info) {
        setStatus({
          isRegistered: issuerResult.info.status === 1, // 1 = ACTIVE
          isPending: issuerResult.info.status === 0,    // 0 = PENDING
          name: wallet.address?.slice(0, 16) + '...',
          publicKey: wallet.coinPublicKey.slice(0, 20) + '...',
        });
      } else {
        setStatus({ isRegistered: false, isPending: false });
      }
    } catch (error) {
      console.error('Failed to check registration:', error);
      setStatus({ isRegistered: false, isPending: false });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    
    try {
      const result = await registerIssuerOnChain(formData.name);
      
      if (result.success) {
        setResult({
          success: true,
          message: 'Registration submitted successfully! Transaction: ' + result.txId?.slice(0, 20) + '...',
        });
        // Re-check status after registration
        await checkRegistration();
      } else {
        setResult({
          success: false,
          message: result.error || 'Registration failed',
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Registration failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <Card>
        <CardHeader 
          title="Issuer Registration"
          subtitle="Checking your registration status..."
          icon={Building2}
        />
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        </CardBody>
      </Card>
    );
  }

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
          <Alert variant={result.success ? 'success' : 'error'} title={result.success ? 'Registration Submitted' : 'Registration Failed'}>
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
              label="License Number (Optional)"
              placeholder="Medical institution license number"
              value={formData.licenseNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
            />
            
            <div className="p-3 bg-slate-50 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Public Key
              </label>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                <code className="text-sm text-slate-600 font-mono">
                  {wallet.coinPublicKey ? wallet.coinPublicKey.slice(0, 20) + '...' : 'Not connected'}
                </code>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Your wallet's public key will be used as the issuer identifier
              </p>
            </div>

            <Alert variant="info">
              Registration requires your wallet to be connected. Once registered, you'll be able to issue privacy-preserving credentials to patients.
            </Alert>

            <Button 
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !wallet.isConnected}
              className="w-full"
            >
              {!wallet.isConnected ? 'Connect Wallet First' : 'Submit Registration'}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
