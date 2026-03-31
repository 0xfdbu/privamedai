/**
 * Issuer Portal Page
 * Issue and manage healthcare credentials
 */

import React, { useState, useCallback } from 'react';
import { createHash } from 'crypto';
import { usePrivaMedAIContract } from '../hooks/usePrivaMedAIContract';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Select,
  Badge,
  Alert,
} from '../components/ui';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconLoader,
  IconKey,
  IconLock,
} from '../components/icons';
import {
  ContractState,
  CredentialFormData,
  IssuedCredential,
  ClaimType,
  TransactionStatus,
} from '../types';

interface IssuerPortalProps {
  seed: string;
  contractState: ContractState;
  isAdmin: boolean;
}

const CLAIM_TYPE_OPTIONS = [
  { value: 'age', label: 'Age Verification' },
  { value: 'vaccination', label: 'Vaccination Record' },
  { value: 'insurance', label: 'Insurance Coverage' },
  { value: 'medical_degree', label: 'Medical Degree' },
  { value: 'license', label: 'Medical License' },
  { value: 'clearance', label: 'Health Clearance' },
];

// Generate 32-byte credential data
const generateCredentialData = (claimType: string, claimValue: string): string => {
  const str = `${claimType}:${claimValue}`;
  const hash = createHash('sha256').update(str).digest();
  return '0x' + hash.toString('hex');
};

// Generate claim hash
const generateClaimHash = (credentialData: string): string => {
  const data = Buffer.from(credentialData.replace('0x', ''), 'hex');
  const hash = createHash('sha256').update(data).digest();
  return '0x' + hash.toString('hex');
};

// Generate commitment
const generateCommitment = (data: object): string => {
  const str = JSON.stringify(data) + Date.now();
  const hash = createHash('sha256').update(str).digest();
  return '0x' + hash.toString('hex');
};

export const IssuerPortal: React.FC<IssuerPortalProps> = ({
  seed,
  contractState,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'manage'>('issue');
  const [formData, setFormData] = useState<CredentialFormData>({
    subject: '',
    claimType: 'vaccination',
    claimValue: '',
    expiryDays: 365,
  });
  const [issuedCreds, setIssuedCreds] = useState<IssuedCredential[]>([]);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [txError, setTxError] = useState<string>('');
  const [txSuccess, setTxSuccess] = useState<string>('');

  const {
    issueCredential,
    revokeCredential,
    initialize,
  } = usePrivaMedAIContract(seed);

  const isReady = contractState === 'ready';

  const handleIssue = useCallback(async () => {
    if (!isReady) return;

    setTxStatus('pending');
    setTxError('');
    setTxSuccess('');

    try {
      const credentialData = generateCredentialData(formData.claimType, formData.claimValue);
      const claimHash = generateClaimHash(credentialData);
      const commitment = generateCommitment({
        subject: formData.subject,
        claimType: formData.claimType,
        claimValue: formData.claimValue,
      });

      const txId = await issueCredential(
        commitment,
        claimHash,
        formData.expiryDays
      );

      const newCred: IssuedCredential = {
        ...formData,
        commitment,
        credentialData,
        claimHash,
        txId,
        timestamp: Date.now(),
      };

      setIssuedCreds((prev) => [newCred, ...prev]);
      setTxSuccess(`Credential issued successfully! TX: ${txId.slice(0, 40)}...`);
      setTxStatus('success');

      // Reset form
      setFormData((prev) => ({ ...prev, claimValue: '', subject: '' }));
    } catch (err: any) {
      setTxError(err.message || 'Failed to issue credential');
      setTxStatus('error');
    }
  }, [formData, isReady, issueCredential]);

  const handleRevoke = useCallback(async (commitment: string) => {
    if (!isReady) return;

    setTxStatus('pending');
    setTxError('');

    try {
      const txId = await revokeCredential(commitment);
      setTxSuccess(`Credential revoked! TX: ${txId.slice(0, 40)}...`);
      setTxStatus('success');
    } catch (err: any) {
      setTxError(err.message || 'Failed to revoke credential');
      setTxStatus('error');
    }
  }, [isReady, revokeCredential]);

  const handleInitialize = useCallback(async () => {
    if (!isReady || !isAdmin) return;

    setTxStatus('pending');
    setTxError('');

    try {
      const txId = await initialize();
      setTxSuccess(`Contract initialized! TX: ${txId.slice(0, 40)}...`);
      setTxStatus('success');
    } catch (err: any) {
      setTxError(err.message || 'Failed to initialize contract');
      setTxStatus('error');
    }
  }, [isReady, isAdmin, initialize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Issuer Portal</h2>
          <p className="text-[var(--text-muted)]">
            Issue and manage verifiable healthcare credentials
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'issue' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('issue')}
          >
            <IconPlus size={16} />
            Issue New
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('manage')}
          >
            Manage ({issuedCreds.length})
          </Button>
        </div>
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

      {/* Admin Section */}
      {isAdmin && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <IconKey size={20} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Admin Controls</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Initialize contract or manage issuers
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={handleInitialize}
                isLoading={txStatus === 'pending'}
              >
                Initialize Contract
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issue Form */}
      {activeTab === 'issue' && (
        <Card>
          <CardHeader>
            <CardTitle>Issue New Credential</CardTitle>
            <CardDescription>
              Create a verifiable healthcare credential for a subject
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <Input
                label="Subject Address"
                placeholder="0x... (recipient's public key)"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                disabled={!isReady || txStatus === 'pending'}
              />

              <Select
                label="Credential Type"
                options={CLAIM_TYPE_OPTIONS}
                value={formData.claimType}
                onChange={(e) => setFormData({ ...formData, claimType: e.target.value as ClaimType })}
                disabled={!isReady || txStatus === 'pending'}
              />

              <Input
                label="Claim Value"
                placeholder="e.g., COVID-19-Pfizer, MD-12345, 21"
                value={formData.claimValue}
                onChange={(e) => setFormData({ ...formData, claimValue: e.target.value })}
                disabled={!isReady || txStatus === 'pending'}
              />

              <Input
                label="Expiry (days)"
                type="number"
                min={1}
                max={3650}
                value={formData.expiryDays}
                onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) })}
                disabled={!isReady || txStatus === 'pending'}
              />
            </div>

            <Button
              onClick={handleIssue}
              isLoading={txStatus === 'pending'}
              disabled={!isReady || !formData.subject || !formData.claimValue}
              fullWidth
            >
              {txStatus === 'pending' ? (
                <>
                  <IconLoader size={16} />
                  Issuing Credential...
                </>
              ) : (
                <>
                  <IconLock size={16} />
                  Issue Credential
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manage Credentials */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {issuedCreds.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <IconKey size={32} className="text-[var(--text-muted)]" />
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                  No Credentials Issued
                </h3>
                <p className="text-[var(--text-muted)] mb-4">
                  Issue your first credential to see it here
                </p>
                <Button variant="secondary" onClick={() => setActiveTab('issue')}>
                  Issue Credential
                </Button>
              </CardContent>
            </Card>
          ) : (
            issuedCreds.map((cred, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="success">
                          <IconCheck size={12} />
                          Active
                        </Badge>
                        <span className="text-sm text-[var(--text-muted)]">
                          {new Date(cred.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-[var(--text-primary)] capitalize">
                        {cred.claimType.replace('_', ' ')}
                      </h3>
                      <p className="text-[var(--text-secondary)]">{cred.claimValue}</p>
                      
                      <div className="font-mono text-xs text-[var(--text-muted)] break-all">
                        <span className="text-[var(--text-secondary)]">Commitment:</span> {cred.commitment}
                      </div>
                      
                      {cred.txId && (
                        <div className="font-mono text-xs text-green-500">
                          TX: {cred.txId.slice(0, 50)}...
                        </div>
                      )}
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevoke(cred.commitment)}
                      isLoading={txStatus === 'pending'}
                    >
                      <IconTrash size={14} />
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default IssuerPortal;
