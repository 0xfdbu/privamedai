import { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Plus,
  Building2,
  Wallet
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card, CardHeader, CardBody } from '../common';
import { 
  registerIssuerOnChain, 
  getContractAdmin, 
  checkIssuerOnChain 
} from '../../services/contractInteraction';
import { getWalletState } from '../../services/contractService';

export function IssuerManagement() {
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    txId?: string;
    error?: string;
  } | null>(null);

  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoadingCheck, setIsLoadingCheck] = useState(true);

  const wallet = getWalletState();

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  async function checkRegistrationStatus() {
    setIsLoadingCheck(true);
    try {
      if (wallet.coinPublicKey) {
        const issuerResult = await checkIssuerOnChain(wallet.coinPublicKey.slice(0, 64));
        setIsRegistered(issuerResult.registered && issuerResult.info?.status === 1);
      }
    } catch (err) {
      console.error('Failed to check registration status:', err);
    } finally {
      setIsLoadingCheck(false);
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setRegistrationResult({ success: false, error: 'Please enter your organization name' });
      return;
    }

    setIsRegistering(true);
    setRegistrationResult(null);

    try {
      const response = await registerIssuerOnChain(name.trim());
      setRegistrationResult(response);
      
      if (response.success) {
        setName('');
        setIsRegistered(true);
      }
    } catch (error: any) {
      setRegistrationResult({ success: false, error: error.message || 'Failed to register' });
    } finally {
      setIsRegistering(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Connect Wallet First
            </h2>
            <p className="text-slate-600 mb-6">
              Please connect your Lace wallet to register as an issuer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Register as Issuer</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Join the PrivaMedAI credential issuer network
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader 
          title="Issuer Registration" 
          subtitle="Register your organization to issue verifiable credentials"
          icon={Plus}
        />
        <CardBody className="p-6">
          {isLoadingCheck ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : registrationResult?.success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-900 mb-1">
                    Registration Successful!
                  </h3>
                  <p className="text-emerald-700 text-sm mb-3">
                    You are now registered as an issuer on the PrivaMedAI network.
                  </p>
                  {registrationResult.txId && (
                    <div className="bg-white rounded-lg p-3 border border-emerald-200 mb-4">
                      <p className="text-xs text-slate-500 mb-1">Transaction ID:</p>
                      <code className="text-xs font-mono text-slate-700 break-all">
                        {registrationResult.txId}
                      </code>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRegistrationResult(null)}
                  >
                    Register Another
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              {registrationResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-red-900 mb-1">Registration Failed</h3>
                      <p className="text-red-700 text-sm">{registrationResult.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {isRegistered ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-emerald-900">Already Registered</p>
                      <p className="text-sm text-emerald-700">
                        Your wallet is already registered as an active issuer.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Open Registration</p>
                      <p className="text-sm text-blue-700">
                        Anyone can register as an issuer. No admin approval required.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Input
                  label="Organization Name"
                  placeholder="e.g., City General Hospital"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isRegistered}
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  This name will be publicly associated with your issuer address.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  Registration Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Wallet:</span>
                    <code className="text-slate-700 font-mono text-xs">
                      {wallet.address?.slice(0, 12)}...{wallet.address?.slice(-8)}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Network:</span>
                    <span className="text-slate-700">Midnight Preprod</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={isRegistered ? 'text-emerald-600 font-medium' : 'text-blue-600 font-medium'}>
                      {isRegistered ? 'Already Registered' : 'Ready to Register'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                isLoading={isRegistering}
                disabled={!name.trim() || isRegistering || isRegistered}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                leftIcon={<Shield className="w-5 h-5" />}
              >
                {isRegistering ? 'Registering...' : isRegistered ? 'Already Registered' : 'Register as Issuer'}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                By registering, you agree to issue credentials in accordance with network rules.
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
