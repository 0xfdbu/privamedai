import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Loader2, 
  CheckCircle,
  XCircle,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert, Badge } from '../common';
import { getWalletState } from '../../services/contractService';
import { revokeCredentialOnChain, checkCredentialOnChain, queryCredentialsOnChain } from '../../services/contractInteraction';

interface CredentialInfo {
  commitment: string;
  claimType: string;
  issuedAt: string;
  status: 'VALID' | 'REVOKED';
  patientAddress?: string;
}

export function ManageCredentials() {
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [revokingCommitment, setRevokingCommitment] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [onChainStats, setOnChainStats] = useState<{ total: number; issuers: number } | null>(null);

  useEffect(() => {
    const wallet = getWalletState();
    if (wallet.coinPublicKey) {
      setWalletAddress(wallet.coinPublicKey);
      loadCredentials();
    }
  }, []);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      // Fetch on-chain stats
      const statsResult = await queryCredentialsOnChain(walletAddress);
      if (statsResult.success) {
        setOnChainStats({
          total: Number(statsResult.totalCredentials || 0),
          issuers: Number(statsResult.totalIssuers || 0),
        });
      }

      // Get credentials from localStorage (issued by this provider)
      const stored = localStorage.getItem('privamedai_issued_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        const credentialList: CredentialInfo[] = [];
        
        for (const cred of parsed) {
          // Check current on-chain status
          const checkResult = await checkCredentialOnChain(cred.commitment);
          credentialList.push({
            commitment: cred.commitment,
            claimType: cred.claimType,
            issuedAt: cred.issuedAt,
            status: checkResult.exists && checkResult.credential?.status === 'VALID' ? 'VALID' : 'REVOKED',
            patientAddress: cred.patientAddress,
          });
        }
        
        setCredentials(credentialList);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (commitment: string) => {
    setRevokingCommitment(commitment);
    setResult(null);

    try {
      const wallet = getWalletState();
      if (!wallet.coinPublicKey) {
        throw new Error('Wallet not connected');
      }

      const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
      
      const result = await revokeCredentialOnChain(
        pubKeyHex,
        commitment
      );

      if (!result.success) {
        throw new Error(result.error || 'Revocation failed');
      }

      setResult({
        success: true,
        message: `Credential revoked successfully. Transaction: ${result.txId?.slice(0, 20)}...`,
      });

      // Refresh the list
      await loadCredentials();

    } catch (error: any) {
      console.error('❌ Failed to revoke credential:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to revoke credential',
      });
    } finally {
      setRevokingCommitment(null);
    }
  };

  const filteredCredentials = credentials.filter(cred => 
    cred.commitment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.claimType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.patientAddress?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validCount = credentials.filter(c => c.status === 'VALID').length;
  const revokedCount = credentials.filter(c => c.status === 'REVOKED').length;

  return (
    <div className="max-w-6xl space-y-6 mx-auto py-6">
      <Card>
        <CardHeader 
          title="Manage Issued Credentials" 
          subtitle="View and revoke credentials issued by your organization"
          icon={ShieldAlert}
        />
        <CardBody>
          {/* Stats - Two sections: On-chain totals vs This provider */}
          <div className="space-y-4 mb-6">
            {/* On-chain totals */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Network-Wide (On-Chain)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-700">{onChainStats?.total ?? '-'}</p>
                  <p className="text-sm text-blue-600">Total Credentials Issued</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-700">{onChainStats?.issuers ?? '-'}</p>
                  <p className="text-sm text-blue-600">Registered Issuers</p>
                </div>
              </div>
            </div>

            {/* This provider's credentials */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Your Organization (This Session)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{credentials.length}</p>
                  <p className="text-sm text-slate-500">Issued by You</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{validCount}</p>
                  <p className="text-sm text-slate-500">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{revokedCount}</p>
                  <p className="text-sm text-slate-500">Revoked</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by commitment, type, or patient address..."
              className="pl-10"
            />
          </div>

          {/* Result Alert */}
          {result && (
            <div className="mb-4">
              <Alert 
                variant={result.success ? 'success' : 'error'} 
                title={result.success ? 'Success' : 'Error'}
              >
                {result.message}
              </Alert>
            </div>
          )}

          {/* Credentials List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">
                Credentials ({filteredCredentials.length})
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadCredentials}
                isLoading={isLoading}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500">Loading credentials...</p>
              </div>
            ) : filteredCredentials.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No credentials found</p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchQuery ? 'Try adjusting your search' : 'Issue credentials to see them here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCredentials.map((cred) => (
                  <div 
                    key={cred.commitment}
                    className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900 truncate">
                            {cred.claimType}
                          </h4>
                          {cred.status === 'VALID' ? (
                            <Badge variant="success" size="sm">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="error" size="sm">
                              <XCircle className="w-3 h-3 mr-1" />
                              Revoked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 font-mono truncate">
                          {cred.commitment}
                        </p>
                        {cred.patientAddress && (
                          <p className="text-xs text-slate-400 mt-1">
                            Patient: {cred.patientAddress.slice(0, 20)}...
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Issued: {new Date(cred.issuedAt).toLocaleString()}
                        </p>
                      </div>
                      
                      {cred.status === 'VALID' && (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={revokingCommitment === cred.commitment}
                          disabled={revokingCommitment !== null}
                          onClick={() => handleRevoke(cred.commitment)}
                          leftIcon={<Trash2 className="w-4 h-4" />}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Important</p>
              <p className="text-amber-700">
                Revoking a credential permanently invalidates it on the blockchain. 
                This action cannot be undone. Only the original issuer can revoke their credentials.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
