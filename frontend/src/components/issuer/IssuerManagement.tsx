import { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Users,
  Stethoscope,
  Plus,
  RefreshCw,
  Building2,
  Wallet
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card, CardHeader, CardBody, Badge } from '../common';
import { 
  registerIssuerOnChain, 
  getContractAdmin, 
  checkIssuerOnChain 
} from '../../services/contractInteraction';
import { getWalletState } from '../../services/contractService';

interface IssuerInfo {
  publicKey: string;
  name: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REVOKED';
  credentialCount: number;
}

export function IssuerManagement() {
  // Registration state
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    txId?: string;
    error?: string;
  } | null>(null);

  // Issuers list state
  const [issuers, setIssuers] = useState<IssuerInfo[]>([]);
  const [isLoadingIssuers, setIsLoadingIssuers] = useState(true);
  const [issuersError, setIssuersError] = useState<string | null>(null);

  const wallet = getWalletState();

  // Fetch issuers on mount
  useEffect(() => {
    fetchIssuers();
  }, []);

  async function fetchIssuers() {
    setIsLoadingIssuers(true);
    setIssuersError(null);

    try {
      const issuerList: IssuerInfo[] = [];

      // Get current wallet issuer info
      if (wallet.coinPublicKey) {
        const issuerResult = await checkIssuerOnChain(wallet.coinPublicKey.slice(0, 64));
        if (issuerResult.registered && issuerResult.info) {
          issuerList.push({
            publicKey: wallet.coinPublicKey.slice(0, 20) + '...',
            name: wallet.address?.slice(0, 16) + '...' || 'Your Organization',
            status: issuerResult.info.status === 1 ? 'ACTIVE' : 'PENDING',
            credentialCount: Number(issuerResult.info.credentialCount || 0),
          });
        }
      }

      // Get admin info
      const adminResult = await getContractAdmin();
      if (adminResult.success && adminResult.admin) {
        const adminShort = adminResult.admin.slice(0, 20) + '...';
        const exists = issuerList.some(i => i.publicKey === adminShort);
        if (!exists) {
          issuerList.push({
            publicKey: adminShort,
            name: 'Contract Admin',
            status: 'ACTIVE',
            credentialCount: 0,
          });
        }
      }

      setIssuers(issuerList);
    } catch (err: any) {
      setIssuersError(err.message || 'Failed to fetch issuers');
    } finally {
      setIsLoadingIssuers(false);
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
        // Refresh issuers list after successful registration
        await fetchIssuers();
      }
    } catch (error: any) {
      setRegistrationResult({ success: false, error: error.message || 'Failed to register' });
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusColor = (status: IssuerInfo['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'REVOKED':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const isAlreadyRegistered = issuers.some(
    i => i.publicKey.includes(wallet.coinPublicKey?.slice(0, 20) || '') && 
         i.status === 'ACTIVE'
  );

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
              Please connect your Lace wallet to register as an issuer or view the issuer registry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Issuer Management</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Register your organization and view the credential issuer network
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-sm">
            <Shield className="w-4 h-4" />
            <span>Open Registration</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Form */}
        <div>
          <Card className="border-slate-200 shadow-sm h-full">
            <CardHeader 
              title="Register as Issuer" 
              subtitle="Join the PrivaMedAI credential issuer network"
              icon={Plus}
            />
            <CardBody className="p-6">
              {registrationResult?.success ? (
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

                  {/* Status Alert */}
                  {isAlreadyRegistered ? (
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
                      disabled={isAlreadyRegistered}
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
                        <span className={isAlreadyRegistered ? 'text-emerald-600 font-medium' : 'text-blue-600 font-medium'}>
                          {isAlreadyRegistered ? 'Already Registered' : 'Ready to Register'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    isLoading={isRegistering}
                    disabled={!name.trim() || isRegistering || isAlreadyRegistered}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    leftIcon={<Shield className="w-5 h-5" />}
                  >
                    {isRegistering ? 'Registering...' : isAlreadyRegistered ? 'Already Registered' : 'Register as Issuer'}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    By registering, you agree to issue credentials in accordance with network rules.
                  </p>
                </form>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Registered Issuers List */}
        <div>
          <Card className="border-slate-200 shadow-sm h-full">
            <CardHeader 
              title="Registered Issuers" 
              subtitle="Organizations authorized to issue credentials"
              icon={Users}
              action={
                <button
                  onClick={fetchIssuers}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              }
            />
            <CardBody className="p-0">
              {isLoadingIssuers ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="ml-3 text-slate-600">Loading issuers...</span>
                </div>
              ) : issuersError ? (
                <div className="flex items-start gap-3 p-6 m-6 bg-red-50 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Error loading issuers</p>
                    <p className="text-red-600 text-sm">{issuersError}</p>
                  </div>
                </div>
              ) : issuers.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No registered issuers
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto text-sm">
                    There are no organizations currently registered. Be the first to join the network!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {issuers.map((issuer, index) => (
                    <div 
                      key={index} 
                      className="p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              {issuer.name}
                            </h4>
                            <code className="text-xs text-slate-500 font-mono">
                              {issuer.publicKey}
                            </code>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(issuer.status)}`}>
                                {issuer.status}
                              </span>
                              <span className="text-xs text-slate-500">
                                {issuer.credentialCount.toLocaleString()} credentials issued
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  <strong>Note:</strong> Only active issuers can issue verifiable credentials. 
                  Status updates may take a few moments to reflect.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
