/**
 * Verifier Portal Page
 * Verify credentials without seeing private data
 */

import React, { useState, useCallback } from 'react';
import { usePrivaMedAIContract } from '../hooks/usePrivaMedAIContract';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  TextArea,
  Badge,
  Alert,
} from '../components/ui';
import {
  IconShield,
  IconSearch,
  IconCheck,
  IconX,
  IconLoader,
  IconLock,
  IconUnlock,
  IconInfo,
} from '../components/icons';
import {
  ContractState,
  VerificationResult,
} from '../types';

interface VerifierPortalProps {
  seed: string;
  contractState: ContractState;
}

export const VerifierPortal: React.FC<VerifierPortalProps> = ({
  seed,
  contractState,
}) => {
  const [proofInput, setProofInput] = useState('');
  const [result, setResult] = useState<VerificationResult>({
    status: 'idle',
    message: '',
  });

  const { verifyCredential } = usePrivaMedAIContract(seed);
  const isReady = contractState === 'ready';

  const handleVerify = useCallback(async () => {
    if (!proofInput.trim() || !isReady) return;

    setResult({ status: 'checking', message: 'Verifying on-chain...' });

    try {
      let proofData: any;
      try {
        proofData = JSON.parse(proofInput);
      } catch {
        setResult({
          status: 'error',
          message: 'Invalid JSON format. Please paste a valid proof.',
        });
        return;
      }

      if (!proofData.commitment || proofData.commitment.length !== 66) {
        setResult({
          status: 'error',
          message: 'Invalid commitment format. Expected 66 character hex string (0x + 64 chars).',
        });
        return;
      }

      if (!proofData.credentialData) {
        setResult({
          status: 'error',
          message: 'Missing credentialData. Full verification requires the credential data from the holder.',
        });
        return;
      }

      const txId = await verifyCredential(
        proofData.commitment,
        proofData.credentialData
      );

      setResult({
        status: 'valid',
        message: `✅ Credential is VALID!\n\nThe proof verifies that:\n• The credential data hash matches the stored claim\n• The issuer is verified and active\n• The credential has not been revoked\n\nTransaction: ${txId}`,
      });
    } catch (err: any) {
      const errorMsg = err.message || '';
      
      if (errorMsg.includes('Hash mismatch')) {
        setResult({
          status: 'invalid',
          message: '❌ Hash Mismatch\n\nThe credential data does not match the stored claim. This could indicate tampering or an incorrect credential.',
        });
      } else if (errorMsg.includes('revoked')) {
        setResult({
          status: 'invalid',
          message: '❌ Credential Revoked\n\nThis credential has been revoked by the issuer and is no longer valid.',
        });
      } else if (errorMsg.includes('not found')) {
        setResult({
          status: 'invalid',
          message: '❌ Credential Not Found\n\nNo credential exists on-chain with this commitment.',
        });
      } else if (errorMsg.includes('Issuer not active')) {
        setResult({
          status: 'invalid',
          message: '❌ Issuer Not Active\n\nThe issuer of this credential has been suspended or revoked.',
        });
      } else {
        setResult({
          status: 'error',
          message: `❌ Error: ${errorMsg || 'Verification failed'}`,
        });
      }
    }
  }, [proofInput, isReady, verifyCredential]);

  const getStatusIcon = () => {
    switch (result.status) {
      case 'valid':
        return <IconCheck size={24} className="text-green-500" />;
      case 'invalid':
        return <IconX size={24} className="text-red-500" />;
      case 'checking':
        return <IconLoader size={24} className="animate-spin" />;
      default:
        return <IconShield size={24} className="text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Verifier Portal</h2>
        <p className="text-[var(--text-muted)]">
          Verify healthcare credentials without accessing private health data
        </p>
      </div>

      {/* Verification Card */}
      <Card>
        <CardHeader>
          <CardTitle>Verify Credential</CardTitle>
          <CardDescription>
            Paste a zero-knowledge proof to verify credential validity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <TextArea
            label="ZK Proof"
            placeholder={`{
  "proof": "zk-proof-...",
  "commitment": "0x...",
  "claimType": "vaccination",
  "credentialData": "0x...",
  "txId": "...",
  "timestamp": ...
}`}
            value={proofInput}
            onChange={(e) => setProofInput(e.target.value)}
            rows={10}
            disabled={!isReady}
          />

          <Button
            onClick={handleVerify}
            disabled={!isReady || !proofInput.trim()}
            fullWidth
          >
            {result.status === 'checking' ? (
              <>
                <IconLoader size={16} />
                Verifying...
              </>
            ) : (
              <>
                <IconSearch size={16} />
                Verify Proof
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result Card */}
      {result.status !== 'idle' && (
        <Card
          className={`
            ${result.status === 'valid' ? 'border-green-500/50' : ''}
            ${result.status === 'invalid' ? 'border-red-500/50' : ''}
            ${result.status === 'error' ? 'border-yellow-500/50' : ''}
          `}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                {getStatusIcon()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {result.status === 'valid' && 'Verification Successful'}
                  {result.status === 'invalid' && 'Verification Failed'}
                  {result.status === 'error' && 'Error'}
                  {result.status === 'checking' && 'Verifying...'}
                </h3>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-secondary)] font-mono">
                  {result.message}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20">
                <IconCheck size={20} className="text-green-500" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                What You Can Verify
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green-500" />
                Credential validity on-chain
              </li>
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green-500" />
                Issuer identity and status
              </li>
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green-500" />
                Revocation status
              </li>
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green-500" />
                Data integrity (hash match)
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/20">
                <IconLock size={20} className="text-red-500" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                What You Cannot See
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <IconX size={14} className="text-red-500" />
                Actual health records
              </li>
              <li className="flex items-center gap-2">
                <IconX size={14} className="text-red-500" />
                Personal identifying info
              </li>
              <li className="flex items-center gap-2">
                <IconX size={14} className="text-red-500" />
                Medical history details
              </li>
              <li className="flex items-center gap-2">
                <IconX size={14} className="text-red-500" />
                Test results or diagnoses
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Zero-Knowledge Verification Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <IconShield size={24} className="text-indigo-400" />
              </div>
              <h4 className="font-medium text-[var(--text-primary)] mb-1">1. Holder Generates Proof</h4>
              <p className="text-xs text-[var(--text-muted)]">
                The credential holder creates a cryptographic proof that proves they have a valid credential without revealing its contents
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <IconUnlock size={24} className="text-indigo-400" />
              </div>
              <h4 className="font-medium text-[var(--text-primary)] mb-1">2. Proof is Shared</h4>
              <p className="text-xs text-[var(--text-muted)]">
                Only the proof and commitment are shared. The actual credential data remains private and encrypted
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <IconCheck size={24} className="text-indigo-400" />
              </div>
              <h4 className="font-medium text-[var(--text-primary)] mb-1">3. On-Chain Verification</h4>
              <p className="text-xs text-[var(--text-muted)]">
                The Midnight blockchain verifies the proof cryptographically without ever seeing the private data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifierPortal;
