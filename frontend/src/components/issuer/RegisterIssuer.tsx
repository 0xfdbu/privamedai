import { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { registerIssuerOnChain } from '../../services/contractInteraction';
import { getWalletState } from '../../services/contractService';

export function RegisterIssuer() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txId?: string;
    error?: string;
  } | null>(null);

  const wallet = getWalletState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setResult({ success: false, error: 'Please enter your organization name' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await registerIssuerOnChain(name.trim());
      setResult(response);
      
      if (response.success) {
        setName('');
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to register' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-600" />
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Register as Issuer
          </h2>
          <p className="text-slate-600">
            Register your organization as a credential issuer on the PrivaMedAI network.
          </p>
        </div>

        {/* Open Registration Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-900">Open Registration</p>
              <p className="text-sm text-emerald-700">
                Anyone can register as an issuer. No admin approval required.
              </p>
            </div>
          </div>
        </div>

        {result?.success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-900 mb-1">
                  Registration Successful!
                </h3>
                <p className="text-emerald-700 text-sm mb-3">
                  You are now registered as an issuer on the PrivaMedAI network.
                </p>
                {result.txId && (
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <p className="text-xs text-slate-500 mb-1">Transaction ID:</p>
                    <code className="text-xs font-mono text-slate-700 break-all">
                      {result.txId}
                    </code>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setResult(null)}
                  className="mt-4"
                >
                  Register Another
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {result?.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-red-900 mb-1">
                      Registration Failed
                    </h3>
                    <p className="text-red-700 text-sm">{result.error}</p>
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
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                This name will be publicly associated with your issuer address on the blockchain.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Registration Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Wallet Address:</span>
                  <code className="text-slate-700 font-mono">
                    {wallet.address?.slice(0, 20)}...{wallet.address?.slice(-8)}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Network:</span>
                  <span className="text-slate-700">Midnight Preprod</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration:</span>
                  <span className="text-emerald-600 font-medium">Open</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!name.trim() || isLoading}
              className="w-full"
              leftIcon={<Shield className="w-5 h-5" />}
            >
              {isLoading ? 'Registering...' : 'Register as Issuer'}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              By registering, you agree to issue credentials in accordance with the PrivaMedAI network rules.
              This transaction will require a small fee.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
