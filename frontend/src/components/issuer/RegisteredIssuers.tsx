import { useState, useEffect } from 'react';
import { Users, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../common';
import { getWalletState } from '../../services/contractService';
import { getContractAdmin, checkIssuerOnChain } from '../../services/contractInteraction';

interface IssuerInfo {
  publicKey: string;
  name: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REVOKED';
  credentialCount: number;
}

export function RegisteredIssuers() {
  const [issuers, setIssuers] = useState<IssuerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wallet = getWalletState();

  useEffect(() => {
    fetchRegisteredIssuers();
  }, []);

  async function fetchRegisteredIssuers() {
    setIsLoading(true);
    setError(null);

    try {
      // Get current wallet info
      const wallet = getWalletState();
      if (!wallet.coinPublicKey) {
        setIssuers([]);
        setIsLoading(false);
        return;
      }

      // Try to get issuer info for the current wallet from the contract
      const issuerResult = await checkIssuerOnChain(wallet.coinPublicKey.slice(0, 64));
      
      const issuerList: IssuerInfo[] = [];
      
      if (issuerResult.registered && issuerResult.info) {
        issuerList.push({
          publicKey: wallet.coinPublicKey.slice(0, 20) + '...',
          name: wallet.address?.slice(0, 16) + '...' || 'Your Organization',
          status: issuerResult.info.status === 1 ? 'ACTIVE' : 'PENDING',
          credentialCount: Number(issuerResult.info.credentialCount || 0),
        });
      }

      // Also get admin info
      const adminResult = await getContractAdmin();
      if (adminResult.success && adminResult.admin) {
        // Check if admin is already in the list
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
      setError(err.message || 'Failed to fetch registered issuers');
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusColor = (status: IssuerInfo['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800';
      case 'PENDING':
        return 'bg-amber-100 text-amber-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      case 'REVOKED':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Registered Issuers"
          subtitle="View all organizations registered as credential issuers on the network"
          icon={Users}
        />
        <CardBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="ml-3 text-slate-600">Loading issuers...</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error loading issuers</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          ) : issuers.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No registered issuers found
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                There are no organizations currently registered as issuers on the PrivaMedAI network.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">
                      Organization
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">
                      Public Key
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">
                      Credentials Issued
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {issuers.map((issuer, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Shield className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="font-medium text-slate-900">
                            {issuer.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-slate-600 font-mono">
                          {issuer.publicKey}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(issuer.status)}`}>
                          {issuer.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-slate-600">
                          {issuer.credentialCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Note:</strong> This list shows issuers registered on the PrivaMedAI network. 
              Only active issuers can issue verifiable credentials.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
