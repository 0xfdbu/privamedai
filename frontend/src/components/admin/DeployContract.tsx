import { useState } from 'react';
import { Rocket, CheckCircle, AlertCircle, Copy, Terminal } from 'lucide-react';
import { Button } from '../common/Button';
import { deployNewContract } from '../../services/contractInteraction';
import { getWalletState } from '../../services/contractService';

export function DeployContract() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    contractAddress?: string;
    txId?: string;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const wallet = getWalletState();

  const handleDeploy = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await deployNewContract();
      setResult(response);
    } catch (error: any) {
      setResult({ 
        success: false, 
        error: error.message || 'Deployment failed' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCommand = () => {
    const command = `cd contract && npm run deploy`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Connect Wallet First
            </h2>
            <p className="text-slate-600">
              Please connect your Lace wallet to view deployment instructions.
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
            <Rocket className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Deploy New Contract
          </h2>
          <p className="text-slate-600">
            Deploy a new PrivaMedAI contract with your wallet as the admin.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 mb-2">Use CLI Deployment</h3>
              <p className="text-amber-700 text-sm mb-3">
                Browser-based deployment requires filesystem access for ZK configurations. 
                Please use the CLI deployment script instead:
              </p>
              
              <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <code className="text-emerald-400 font-mono text-sm">
                  cd contract && npm run deploy
                </code>
                <button
                  onClick={copyCommand}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? 'Copied!' : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Deployment Steps</h4>
            <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
              <li>Open a terminal in the project root</li>
              <li>Ensure your wallet seed is configured in the environment</li>
              <li>Run: <code className="bg-slate-200 px-1 rounded">cd contract && npm run deploy</code></li>
              <li>Copy the new contract address from the output</li>
              <li>Update your <code className="bg-slate-200 px-1 rounded">.env</code> file with the new address</li>
              <li>Refresh this page</li>
            </ol>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Your Wallet (Will be Admin)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Address:</span>
                <code className="text-slate-700 font-mono">
                  {wallet.address?.slice(0, 20)}...{wallet.address?.slice(-8)}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Network:</span>
                <span className="text-slate-700">Midnight Preprod</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-emerald-900">Good News!</h3>
                <p className="text-emerald-700 text-sm mt-1">
                  The contract has been modified to allow <strong>open registration</strong>. 
                  After deployment, anyone can register as an issuer without needing admin approval.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Contract Already Modified</h3>
                <p className="text-blue-700 text-sm mt-1">
                  The contract at <code className="bg-blue-100 px-1 rounded">/contract/src/PrivaMedAI.compact</code> has been updated to remove the admin-only restriction for issuer registration.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleDeploy}
          isLoading={isLoading}
          disabled={isLoading}
          className="w-full mt-6"
          variant="secondary"
          leftIcon={<Rocket className="w-5 h-5" />}
        >
          {isLoading ? 'Checking...' : 'Check Deployment Status'}
        </Button>

        {result?.error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{result.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
