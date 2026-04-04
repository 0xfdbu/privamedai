import { useState } from 'react';
import { 
  Hash, 
  Calendar, 
  Loader2, 
  CheckCircle, 
  User,
  Shield,
  Stethoscope,
  Syringe,
  HeartPulse,
  Activity,
  FileCheck,
  Download
} from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';
import { getWalletState } from '../../services/contractService';
import { issueCredentialOnChain } from '../../services/contractInteraction';
import type { Credential } from '../../types/claims';

// Medical condition cards - cleaner than checkboxes
interface MedicalCondition {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const MEDICAL_CONDITIONS: MedicalCondition[] = [
  { id: 'has_diabetes_diagnosis', label: 'Diabetes Diagnosis', icon: Activity, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'vaccinated_last_6_months', label: 'Recent Vaccination', icon: Syringe, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'medical_clearance', label: 'Medical Clearance', icon: FileCheck, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'free_healthcare_eligible', label: 'Free Healthcare Eligible', icon: HeartPulse, color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

// Credential data structure
interface CredentialData {
  patientAddress: string;
  expiryDays: string;
  medicalData: {
    age: number;
    selectedConditions: string[];
    vaccination_status: 'none' | 'partial' | 'complete';
    annual_wellness_exam: 'pending' | 'completed';
    identity_verified: boolean;
    // HealthClaim fields for selective disclosure
    conditionCode: number;
    prescriptionCode: number;
  };
}

// Issue result
interface IssueResult {
  success: boolean;
  txId?: string;
  commitment?: string;
  claimHash?: string;
  credential?: Credential;
  error?: string;
}

export type { IssueResult };

export function IssueCredential() {
  const [formData, setFormData] = useState<CredentialData>({
    patientAddress: '',
    expiryDays: '365',
    medicalData: {
      age: 35,
      selectedConditions: [],
      vaccination_status: 'none',
      annual_wellness_exam: 'pending',
      identity_verified: true,
      conditionCode: 100, // Default condition code for selective disclosure
      prescriptionCode: 500, // Default prescription code for selective disclosure
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);

  const toggleCondition = (conditionId: string) => {
    setFormData(prev => ({
      ...prev,
      medicalData: {
        ...prev.medicalData,
        selectedConditions: prev.medicalData.selectedConditions.includes(conditionId)
          ? prev.medicalData.selectedConditions.filter(id => id !== conditionId)
          : [...prev.medicalData.selectedConditions, conditionId]
      }
    }));
  };

  const generateClaimData = () => {
    // Build claim data from selected conditions
    const claimData: Record<string, any> = {
      age: formData.medicalData.age,
      identity_verified: formData.medicalData.identity_verified,
      vaccination_status: formData.medicalData.vaccination_status,
      annual_wellness_exam: formData.medicalData.annual_wellness_exam,
      // Include health claim data for selective disclosure
      conditionCode: formData.medicalData.conditionCode,
      prescriptionCode: formData.medicalData.prescriptionCode,
    };

    // Add selected conditions
    MEDICAL_CONDITIONS.forEach(condition => {
      claimData[condition.id] = formData.medicalData.selectedConditions.includes(condition.id);
    });

    return claimData;
  };

  const generateHealthClaim = () => {
    // Generate HealthClaim for selective disclosure
    return {
      age: formData.medicalData.age,
      conditionCode: formData.medicalData.conditionCode,
      prescriptionCode: formData.medicalData.prescriptionCode,
    };
  };

  const detectCredentialType = (): string => {
    const conditions = formData.medicalData.selectedConditions;
    if (conditions.includes('has_diabetes_diagnosis')) return 'Diabetes Diagnosis';
    if (conditions.includes('vaccinated_last_6_months')) return 'Vaccination Certificate';
    if (conditions.includes('medical_clearance')) return 'Medical Clearance';
    if (formData.medicalData.annual_wellness_exam === 'completed') return 'Annual Physical';
    if (conditions.includes('free_healthcare_eligible')) return 'Healthcare Eligibility';
    return 'Medical Record';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      if (!formData.patientAddress) {
        throw new Error('Patient address is required.');
      }

      const claimData = generateClaimData();
      const claimType = detectCredentialType();
      const claimDataJson = JSON.stringify(claimData);

      const result = await issueCredentialOnChain(
        formData.patientAddress,
        claimType,
        claimDataJson,
        parseInt(formData.expiryDays)
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      // Create credential for download with HealthClaim for selective disclosure
      const healthClaim = generateHealthClaim();
      
      // Create claimDataBytes for cryptographic proof generation (must be 32 bytes)
      const encoder = new TextEncoder();
      const claimDataBytes = new Uint8Array(32);
      claimDataBytes.set(encoder.encode(claimDataJson).slice(0, 32));
      
      const credential: Credential = {
        id: result.commitment || '',
        issuer: getWalletState().coinPublicKey || '',
        claimType,
        issuedAt: Date.now(),
        expiresAt: Date.now() + parseInt(formData.expiryDays) * 24 * 60 * 60 * 1000,
        isRevoked: false,
        encryptedData: JSON.stringify({
          patientAddress: formData.patientAddress,
          claimData,
          issuedTo: formData.patientAddress,
        }),
        commitment: result.commitment || '',
        claimHash: result.claimHash || '',
        healthClaim, // Include HealthClaim for selective disclosure
        claimDataBytes: Array.from(claimDataBytes), // Include bytes for proof generation
      };

      setResult({
        success: true,
        txId: result.txId,
        commitment: result.commitment,
        claimHash: result.claimHash,
        credential,
      });

      // Save to localStorage for credential management
      const existing = localStorage.getItem('privamedai_issued_credentials');
      const issued = existing ? JSON.parse(existing) : [];
      issued.push({
        commitment: result.commitment,
        claimType,
        issuedAt: new Date().toISOString(),
        patientAddress: formData.patientAddress,
      });
      localStorage.setItem('privamedai_issued_credentials', JSON.stringify(issued));

      // Reset form
      setFormData({
        patientAddress: '',
        expiryDays: '365',
        medicalData: {
          age: 35,
          selectedConditions: [],
          vaccination_status: 'none',
          annual_wellness_exam: 'pending',
          identity_verified: true,
          conditionCode: 100,
          prescriptionCode: 500,
        },
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

  const downloadCredential = () => {
    if (!result?.credential) return;
    
    const credentialData = {
      ...result.credential,
      downloadDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(credentialData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential-${result.credential.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (result?.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-emerald-200 shadow-lg shadow-emerald-500/10">
          <CardBody className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Credential Issued Successfully!
            </h2>
            <p className="text-slate-500 mb-8">
              The medical credential has been created and stored on the Midnight blockchain.
            </p>
            
            <div className="space-y-3 text-left mb-8 bg-slate-50 rounded-xl p-4">
              <DataRow label="Transaction ID" value={result.txId || ''} />
              <DataRow label="Commitment" value={result.commitment || ''} />
              <DataRow label="Claim Hash" value={result.claimHash || ''} />
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                variant="primary" 
                onClick={() => setResult(null)}
                leftIcon={<Shield className="w-4 h-4" />}
              >
                Issue Another
              </Button>
              <Button 
                variant="secondary" 
                onClick={downloadCredential}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Credential
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader 
          title="Issue Medical Credential" 
          subtitle="Create a verifiable medical credential on the Midnight blockchain"
          icon={Stethoscope}
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Patient Wallet Address
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  value={formData.patientAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientAddress: e.target.value }))}
                  placeholder="mn_shield-addr_preprod..."
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Medical Conditions - Card-based selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Medical Conditions & Certifications
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MEDICAL_CONDITIONS.map((condition) => {
                  const isSelected = formData.medicalData.selectedConditions.includes(condition.id);
                  const Icon = condition.icon;
                  return (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => toggleCondition(condition.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                          ? condition.color + ' border-current ring-2 ring-offset-2 ring-current/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/50' : 'bg-slate-100'}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? '' : 'text-slate-500'}`} />
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                            {condition.label}
                          </p>
                          {isSelected && (
                            <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Selected</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Patient Age
                </label>
                <Input
                  type="number"
                  value={formData.medicalData.age}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    medicalData: { ...prev.medicalData, age: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                  max={150}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Expiry (Days)
                </label>
                <Input
                  type="number"
                  value={formData.expiryDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiryDays: e.target.value }))}
                  min={1}
                  max={3650}
                />
              </div>
            </div>

            {/* Status Selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vaccination Status
                </label>
                <select
                  value={formData.medicalData.vaccination_status}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    medicalData: { ...prev.medicalData, vaccination_status: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="partial">Partial</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Wellness Exam
                </label>
                <select
                  value={formData.medicalData.annual_wellness_exam}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    medicalData: { ...prev.medicalData, annual_wellness_exam: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* HealthClaim Fields for Selective Disclosure */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Selective Disclosure Data (Private)</span>
              </div>
              <p className="text-xs text-purple-600 mb-3">
                These codes are used for zero-knowledge selective disclosure. They remain private and are only revealed through specific verification circuits.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Condition Code
                  </label>
                  <Input
                    type="number"
                    value={formData.medicalData.conditionCode}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      medicalData: { ...prev.medicalData, conditionCode: parseInt(e.target.value) || 0 }
                    }))}
                    min={0}
                    max={65535}
                  />
                  <p className="text-xs text-slate-500 mt-1">Medical condition identifier (Uint16)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Prescription Code
                  </label>
                  <Input
                    type="number"
                    value={formData.medicalData.prescriptionCode}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      medicalData: { ...prev.medicalData, prescriptionCode: parseInt(e.target.value) || 0 }
                    }))}
                    min={0}
                    max={65535}
                  />
                  <p className="text-xs text-slate-500 mt-1">Prescription identifier (Uint16)</p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {result?.error && (
              <Alert variant="error" title="Error">
                <div className="whitespace-pre-line">{result.error}</div>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              leftIcon={isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Hash className="w-5 h-5" />}
            >
              {isSubmitting ? 'Issuing Credential...' : 'Issue Credential'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// Helper component for displaying data rows
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-mono text-slate-900 truncate max-w-[200px]">{value}</span>
    </div>
  );
}
