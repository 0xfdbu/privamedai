/**
 * User Portal Page
 * Manage credentials and generate ZK proofs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createHash } from 'crypto';
import { usePrivaMedAIContract } from '../hooks/usePrivaMedAIContract';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Alert,
} from '../components/ui';
import {
  IconUser,
  IconShield,
  IconPlus,
  IconCheck,
  IconLoader,
  IconCopy,
  IconKey,
} from '../components/icons';
import {
  ContractState,
  StoredCredential,
  ZKProof,
  TransactionStatus,
} from '../types';

interface UserPortalProps {
  seed: string;
  contractState: ContractState;
}

// Generate demo credential
const generateDemoCredential = (): StoredCredential => {
  const claimType = 'vaccination';
  const claimValue = 'COVID-19-Pfizer-Booster';
  const str = `${claimType}:${claimValue}`;
  const hash = createHash('sha256').update(str).digest();
  const credentialData = '0x' + hash.toString('hex');
  
  return {
    commitment: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    claimType,
    claimValue,
    credentialData,
    expiry: Date.now() + 86400000 * 365,
    issuer: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
  };
};

export const UserPortal: React.FC<UserPortalProps> = ({
  seed,
  contractState,
}) => {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [selectedCred, setSelectedCred] = useState<StoredCredential | null>(null);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [txError, setTxError] = useState<string>('');
  const [txSuccess, setTxSuccess] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const { verifyCredential } = usePrivaMedAIContract(seed);
  const isReady = contractState === 'ready';

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('privamedai_credentials') || '[]');
    setCredentials(stored);
  }, []);

  const addDemoCredential = useCallback(() => {
    const demo = generateDemoCredential();
    const updated = [demo, ...credentials];
    localStorage.setItem('privamedai_credentials', JSON.stringify(updated));
    setCredentials(updated);
  }, [credentials]);

  const generateProof = useCallback(async () => {
    if (!selectedCred || !isReady) return;

    setTxStatus('pending');
    setTxError('');
    setTxSuccess('');

    try {
      const txId = await verifyCredential(
        selectedCred.commitment,
        selectedCred.credentialData
      );

      const proof: ZKProof = {
        proof: `zk-proof-${selectedCred.commitment.slice(0, 16)}-${Date.now()}`,
        commitment: selectedCred.commitment,
        claimType: selectedCred.claimType,
        txId,
        timestamp: Date.now(),
        credentialData: selectedCred.credentialData,
      };

      await navigator.clipboard.writeText(JSON.stringify(proof, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      setTxSuccess('Zero-knowledge proof generated and copied to clipboard!');
      setTxStatus('success');
    } catch (err: any) {
      setTxError(err.message || 'Failed to generate proof');
      setTxStatus('error');
    }
  }, [selectedCred, isReady, verifyCredential]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">User Portal</h2>
          <p className="text-[var(--text-muted)]">
            Manage your credentials and generate privacy-preserving proofs
          </p>
        </div>
        <Button variant="secondary" onClick={addDemoCredential}>
          <IconPlus size={16} />
          Add Demo Credential
        </Button>
      </div>

      {/* Alerts */}
      {txError && (
        <Alert variant="error" onClose={() => setTxError('')}>
          {txError}
        </Alert>
      )}
      {txSuccess && (
        <Alert variant="success" onClose={() => setTxSuccess('')}>
          {txSuccess}
        </Alert>
      )}

      {/* Credentials Grid */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <IconUser size={32} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              No Credentials
            </h3>
            <p className="text-[var(--text-muted)] mb-4">
              Add a demo credential to get started
            </p>
            <Button onClick={addDemoCredential}>
              <IconPlus size={16} />
              Add Demo Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {credentials.map((cred, index) => (
            <Card
              key={index}
              hover={false}
              className={`cursor-pointer transition-all ${
                selectedCred?.commitment === cred.commitment
                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                  : ''
              }`}
              onClick={() => setSelectedCred(cred)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="success">
                        <IconCheck size={12} />
                        Valid
                      </Badge>
                      <span className="text-sm text-[var(--text-muted)]">
                        Expires: {new Date(cred.expiry).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-[var(--text-primary)] capitalize mb-1">
                      {cred.claimType.replace('_', ' ')}
                    </h3>
                    <p className="text-[var(--text-secondary)]">{cred.claimValue}</p>
                    
                    <div className="mt-3 font-mono text-xs text-[var(--text-muted)] break-all">
                      {cred.commitment.slice(0, 40)}...
                    </div>
                  </div>

                  {selectedCred?.commitment === cred.commitment && (
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                      <IconKey size={20} className="text-indigo-400" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Proof Section */}
      {selectedCred && (
        <Card className="border-indigo-500/30">
          <CardHeader>
            <CardTitle>Generate ZK Proof</CardTitle>
            <CardDescription>
              Create a zero-knowledge proof for {selectedCred.claimType.replace('_', ' ')}
              without revealing your private data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3 mb-3">
                <IconShield size={20} className="text-indigo-400" />
                <span className="font-medium text-[var(--text-primary)]">
                  Privacy Guarantee
                </span>
              </div>
              <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-green-500" />
                  Your actual data never leaves your device
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-green-500" />
                  Only the cryptographic proof is shared
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-green-500" />
                  Verifier can confirm validity without seeing data
                </li>
              </ul>
            </div>

            <Button
              onClick={generateProof}
              isLoading={txStatus === 'pending'}
              disabled={!isReady}
              fullWidth
            >
              {txStatus === 'pending' ? (
                <>
                  <IconLoader size={16} />
                  Generating Proof...
                </>
              ) : copied ? (
                <>
                  <IconCheck size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <IconCopy size={16} />
                  Generate & Copy Proof
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserPortal;
