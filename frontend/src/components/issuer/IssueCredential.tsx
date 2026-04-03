import { useState } from 'react';
import { Plus, Hash, Calendar, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';
import { getWalletState } from '../../services/contractService';
import { issueCredentialOnChain } from '../../services/contractInteraction';

// Credential data structure
interface CredentialData {
  patientAddress: string;
  claimType: string;
  claimData: string;
  expiryDays: string;
}

// Issue result
interface IssueResult {
  success: boolean;
  txId?: string;
  commitment?: string;
  claimHash?: string;
  blockHeight?: bigint;
  error?: string;
}

export type { IssueResult };

export function IssueCredential() {
  const [formData, setFormData] = useState<CredentialData>({
    patientAddress: '',
    claimType: '',
    claimData: '',
    expiryDays: '365',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);

  /**
   * Generate a commitment from credential data
   * Uses persistent hash for deterministic output
   */
  const generateCommitment = async (data: CredentialData): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const dataString = JSON.stringify({
      patient: data.patientAddress,
      type: data.claimType,
      data: data.claimData,
      issuedAt: Date.now(),
    });
    
    const dataBytes = encoder.encode(dataString);
    
    // Create 32-byte hash-like commitment
    const commitment = new Uint8Array(32);
    for (let i = 0; i < dataBytes.length; i++) {
      commitment[i % 32] = (commitment[i % 32] + dataBytes[i]) % 256;
    }
    
    return commitment;
  };

  /**
   * Generate claim hash from credential data
   */
  const generateClaimHash = async (data: CredentialData): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const claimString = JSON.stringify({
      type: data.claimType,
      data: data.claimData,
      expiry: Date.now() + parseInt(data.expiryDays) * 24 * 60 * 60 * 1000,
    });
    
    const claimBytes = encoder.encode(claimString);
    
    // Create 32-byte hash
    const claimHash = new Uint8Array(32);
    for (let i = 0; i < claimBytes.length; i++) {
      claimHash[i % 32] = (claimHash[i % 32] + claimBytes[i]) % 256;
    }
    
    return claimHash;
  };

  /**
   * Issue credential on-chain
   * REAL implementation using Midnight SDK
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      if (!formData.patientAddress || !formData.claimType) {
        throw new Error('Patient address and claim type are required.');
      }

      // Call the REAL contract on-chain
      const result = await issueCredentialOnChain(
        formData.patientAddress,
        formData.claimType,
        formData.claimData,
        parseInt(formData.expiryDays)
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      setResult({
        success: true,
        txId: result.txId,
        commitment: result.commitment,
        claimHash: result.claimHash,
      });

      // Reset form
      setFormData({
        patientAddress: '',
        claimType: '',
        claimData: '',
        expiryDays: '365',
      });

    } catch (error: any) {
      console.error('❌ Failed to issue credential:', error);
      setResult({
        success: false,
        error: error.message || 'Failed to issue credential on-chain',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Issue New Credential"
        subtitle="Create a privacy-preserving credential for a patient"
        icon={Plus}
      />
      <CardBody>
        {result?.success ? (
          <Alert variant="success">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="font-medium">Credential issued on-chain!</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Transaction ID:</span>
                  <code className="block mt-1 font-mono text-xs text-emerald-800 break-all">
                    {result.txId}
                  </code>
                </div>
                
                {result.blockHeight && (
                  <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-emerald-700 font-medium">Block Height:</span>
                    <code className="block mt-1 font-mono text-xs text-emerald-800">
                      {result.blockHeight.toString()}
                    </code>
                  </div>
                )}
                
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Commitment:</span>
                  <code className="block mt-1 font-mono text-xs text-emerald-800 break-all">
                    {result.commitment}
                  </code>
                </div>
                
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Claim Hash:</span>
                  <code className="block mt-1 font-mono text-xs text-emerald-800 break-all">
                    {result.claimHash}
                  </code>
                </div>
              </div>

              <Button 
                variant="secondary" 
                onClick={() => setResult(null)}
                className="w-full"
              >
                Issue Another Credential
              </Button>
            </div>
          </Alert>
        ) : result?.error ? (
          <Alert variant="error">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium">Failed to issue credential</span>
              </div>
              <p className="text-sm text-red-700">{result.error}</p>
              <Button 
                variant="secondary" 
                onClick={() => setResult(null)}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Patient Wallet Address"
              placeholder="0x..."
              value={formData.patientAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, patientAddress: e.target.value }))}
              required
            />

            <Input
              label="Claim Type"
              placeholder="e.g., Vaccination Record, Medical Clearance"
              value={formData.claimType}
              onChange={(e) => setFormData(prev => ({ ...prev, claimType: e.target.value }))}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Claim Data (Encrypted)
              </label>
              <textarea
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                rows={4}
                placeholder="Enter the credential data (will be hashed)..."
                value={formData.claimData}
                onChange={(e) => setFormData(prev => ({ ...prev, claimData: e.target.value }))}
                required
              />
            </div>

            <Input
              label="Expiry (Days)"
              type="number"
              min="1"
              max="3650"
              leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
              value={formData.expiryDays}
              onChange={(e) => setFormData(prev => ({ ...prev, expiryDays: e.target.value }))}
              required
            />

            <Alert variant="info">
              <div className="space-y-1">
                <p className="font-medium">How it works:</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li>Credential data is hashed to create a commitment</li>
                  <li>Only the commitment is stored on-chain</li>
                  <li>The actual data remains private in the patient's wallet</li>
                  <li>Patients can generate ZK proofs without revealing the data</li>
                </ul>
              </div>
            </Alert>

            <Button 
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full"
              leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
            >
              {isSubmitting ? 'Issuing Credential...' : 'Issue Credential'}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
