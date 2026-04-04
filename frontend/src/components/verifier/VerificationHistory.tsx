import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, Clock, Info } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Alert } from '../common';
import { queryCredentialsOnChain } from '../../services/contractInteraction';

interface NetworkStats {
  totalCredentials: bigint;
  totalIssuers: bigint;
  isLoading: boolean;
  error?: string;
}

export function VerificationHistory() {
  const [stats, setStats] = useState<NetworkStats>({
    totalCredentials: 0n,
    totalIssuers: 0n,
    isLoading: true,
  });

  useEffect(() => {
    loadNetworkStats();
  }, []);

  const loadNetworkStats = async () => {
    try {
      // Query on-chain stats
      const result = await queryCredentialsOnChain('');
      if (result.success) {
        setStats({
          totalCredentials: result.totalCredentials || 0n,
          totalIssuers: result.totalIssuers || 0n,
          isLoading: false,
        });
      } else {
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: result.error,
        }));
      }
    } catch (error: any) {
      setStats({
        totalCredentials: 0n,
        totalIssuers: 0n,
        isLoading: false,
        error: error.message,
      });
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Network Overview"
        subtitle="PrivaMedAI network statistics"
        icon={History}
      />
      <CardBody>
        <Alert variant="info">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">On-Chain Verification</p>
              <p className="text-sm mt-1">
                All verifications happen directly on the Midnight blockchain through 
                zero-knowledge proof circuits. Each verification creates a permanent, 
                auditable record without revealing private health data.
              </p>
            </div>
          </div>
        </Alert>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Total Credentials</span>
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {stats.isLoading ? '...' : stats.totalCredentials.toString()}
            </p>
            <p className="text-xs text-emerald-600 mt-1">Issued on network</p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Registered Issuers</span>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {stats.isLoading ? '...' : stats.totalIssuers.toString()}
            </p>
            <p className="text-xs text-blue-600 mt-1">Active providers</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-slate-700">Verification Circuits</h3>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-900">verifyCredential</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Standard credential verification - validates credential exists and is not revoked.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-900">verifyForFreeHealthClinic</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Selective disclosure - only proves patient is over minimum age.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-900">verifyForPharmacy</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Selective disclosure - only proves patient has specific prescription.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-900">verifyForHospital</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Selective disclosure - proves age threshold AND condition match.
            </p>
          </div>
        </div>

        {stats.error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Failed to load network stats: {stats.error}
            </div>
          </Alert>
        )}
      </CardBody>
    </Card>
  );
}
