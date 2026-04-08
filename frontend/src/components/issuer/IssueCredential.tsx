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
  Download,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Clock,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';
import { getWalletState } from '../../services/contractService';
import { issueCredentialOnChain } from '../../services/contractInteraction';
import type { Credential } from '../../types/claims';
import { getConditionName, getPrescriptionName } from '../../constants/medicalCodes';

// Medical condition cards - cleaner than checkboxes
interface MedicalCondition {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  conditionCode: number;
  prescriptionCode: number;
}

// Mapping: which condition enables which ZK circuit
// conditionCode: 100 → verifyForHospital (age + condition match)
// prescriptionCode: 500 → verifyForPharmacy (prescription match)
const MEDICAL_CONDITIONS: MedicalCondition[] = [
  { 
    id: 'has_diabetes_diagnosis', 
    label: 'Diabetes', 
    icon: Activity, 
    description: 'Type 1 or Type 2 diabetes',
    conditionCode: 100,
    prescriptionCode: 0
  },
  { 
    id: 'has_prescription', 
    label: 'Prescription', 
    icon: Syringe, 
    description: 'Active prescription',
    conditionCode: 0,
    prescriptionCode: 500
  },
];

// Credential data structure
interface CredentialData {
  patientAddress: string;
  expiryDays: string;
  medicalData: {
    age: number;
    selectedConditions: string[];
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
      identity_verified: true,
      conditionCode: 100,
      prescriptionCode: 500,
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [showPrivateCodes, setShowPrivateCodes] = useState(false);

  const toggleCondition = (conditionId: string) => {
    const condition = MEDICAL_CONDITIONS.find(c => c.id === conditionId);
    if (!condition) return;
    
    const isCurrentlySelected = formData.medicalData.selectedConditions.includes(conditionId);
    
    setFormData(prev => {
      const newSelected = isCurrentlySelected
        ? prev.medicalData.selectedConditions.filter(id => id !== conditionId)
        : [...prev.medicalData.selectedConditions, conditionId];
      
      // Calculate combined codes based on ALL selected conditions
      let combinedConditionCode = 0;
      let combinedPrescriptionCode = 0;
      
      newSelected.forEach(id => {
        const cond = MEDICAL_CONDITIONS.find(c => c.id === id);
        if (cond) {
          if (cond.conditionCode) combinedConditionCode = cond.conditionCode;
          if (cond.prescriptionCode) combinedPrescriptionCode = cond.prescriptionCode;
        }
      });
      
      // If BOTH diabetes (100) and prescription (500) are selected, use both
      const hasDiabetes = newSelected.includes('has_diabetes_diagnosis');
      const hasPrescription = newSelected.includes('has_prescription');
      if (hasDiabetes && hasPrescription) {
        combinedConditionCode = 100;
        combinedPrescriptionCode = 500;
      }
      
      return {
        ...prev,
        medicalData: {
          ...prev.medicalData,
          selectedConditions: newSelected,
          conditionCode: combinedConditionCode,
          prescriptionCode: combinedPrescriptionCode,
        }
      };
    });
  };

  const generateClaimData = () => {
    const claimData: Record<string, any> = {
      age: formData.medicalData.age,
      identity_verified: formData.medicalData.identity_verified,
      conditionCode: formData.medicalData.conditionCode,
      prescriptionCode: formData.medicalData.prescriptionCode,
    };
    
    formData.medicalData.selectedConditions.forEach(conditionId => {
      claimData[conditionId] = true;
    });
    
    return claimData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const wallet = getWalletState();
    if (!wallet.isConnected) {
      setResult({
        success: false,
        error: 'Please connect your wallet first',
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const claimData = generateClaimData();
      
      const issueResult = await issueCredentialOnChain(
        formData.patientAddress,
        'Medical Credential',
        JSON.stringify(claimData),
        parseInt(formData.expiryDays)
      );

      if (!issueResult.success) {
        setResult({
          success: false,
          error: issueResult.error || 'Failed to issue credential',
        });
        return;
      }

      // Generate claimDataBytes for ZK proof generation
      const encryptedData = JSON.stringify({ 
        patientAddress: formData.patientAddress, 
        claimData,
        issuedTo: formData.patientAddress 
      });
      const encoder = new TextEncoder();
      const claimDataBytes = new Uint8Array(32);
      claimDataBytes.set(encoder.encode(encryptedData).slice(0, 32));

      const credential: Credential = {
        id: issueResult.commitment || '',
        issuer: wallet.coinPublicKey || '',
        claimType: 'Medical Credential',
        issuedAt: Date.now(),
        expiresAt: Date.now() + parseInt(formData.expiryDays) * 24 * 60 * 60 * 1000,
        isRevoked: false,
        encryptedData,
        commitment: issueResult.commitment || '',
        claimHash: issueResult.claimHash || '',
        healthClaim: {
          age: formData.medicalData.age,
          conditionCode: formData.medicalData.conditionCode,
          prescriptionCode: formData.medicalData.prescriptionCode,
        },
        claimDataBytes: Array.from(claimDataBytes),
      };

      setResult({
        success: true,
        txId: issueResult.txId,
        commitment: issueResult.commitment,
        claimHash: issueResult.claimHash,
        credential,
      });

      const existing = localStorage.getItem('privamedai_issued_credentials');
      const issued = existing ? JSON.parse(existing) : [];
      issued.push(credential);
      localStorage.setItem('privamedai_issued_credentials', JSON.stringify(issued));

      setFormData({
        patientAddress: '',
        expiryDays: '365',
        medicalData: {
          age: 35,
          selectedConditions: [],
          identity_verified: true,
          conditionCode: 100,
          prescriptionCode: 500,
        },
      });

    } catch (error: any) {
      console.error('Failed to issue credential:', error);
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
        <Card className="border-emerald-200 shadow-xl shadow-emerald-500/10 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Credential Issued</h2>
                <p className="text-emerald-100 text-sm">On-chain verification complete</p>
              </div>
            </div>
          </div>
          
          <CardBody className="p-6">
            <div className="space-y-4 mb-6">
              <DataRow label="Transaction ID" value={result.txId || ''} />
              <DataRow label="Commitment" value={result.commitment || ''} />
              <DataRow label="Claim Hash" value={result.claimHash || ''} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="primary" 
                onClick={() => setResult(null)}
                leftIcon={<Stethoscope className="w-4 h-4" />}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Issue Another
              </Button>
              <Button 
                variant="secondary" 
                onClick={downloadCredential}
                leftIcon={<Download className="w-4 h-4" />}
                className="flex-1"
              >
                Download
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Issue Medical Credential</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Create verifiable credentials with selective disclosure on Midnight
              </p>
            </div>
          </div>
            <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>ZK-Enabled</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardBody className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Patient Address */}
                <div className="">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    Patient Wallet Address
                  </label>
                  <Input
                    value={formData.patientAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientAddress: e.target.value }))}
                    placeholder="mn_shield-addr_preprod..."
                    className="bg-white"
                    required
                  />
                </div>

                {/* Medical Conditions */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Activity className="w-4 h-4 text-emerald-600" />
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
                          className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            isSelected 
                              ? 'bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-500/10'
                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg transition-colors ${
                              isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                                {condition.label}
                              </p>
                              <p className={`text-xs mt-1 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {condition.description}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Age and Expiry Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                      <User className="w-4 h-4 text-emerald-600" />
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
                      className="bg-white"
                    />
                  </div>
                  <div className="">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Validity Period
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.expiryDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, expiryDays: e.target.value }))}
                        min={1}
                        max={3650}
                        className="bg-white pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">days</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Demo: Stored for reference only
                    </p>
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
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
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

        {/* Sidebar - Selective Disclosure */}
        <div className="space-y-6">
          {/* Private Codes Card */}
          <Card className="border-emerald-200 shadow-sm overflow-hidden">
            <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-900 text-sm">Selective Disclosure</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivateCodes(!showPrivateCodes)}
                  className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  {showPrivateCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <CardBody className="p-4">
              <p className="text-xs text-emerald-700 mb-4 leading-relaxed">
                These private codes enable zero-knowledge verification. 
                They remain hidden on-chain and are only used in ZK circuits.
              </p>
              
              {showPrivateCodes ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-emerald-800 mb-1.5">
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
                      className="bg-white border-emerald-200"
                    />
                    <p className="text-xs text-emerald-600 mt-1">Uint16 (0-65535)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-800 mb-1.5">
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
                      className="bg-white border-emerald-200"
                    />
                    <p className="text-xs text-emerald-600 mt-1">Uint16 (0-65535)</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-emerald-50/50 rounded-xl border border-emerald-100 border-dashed">
                  <Lock className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-xs text-emerald-600">Tap eye icon to reveal</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* How It Works Card */}
          <Card className="bg-slate-50 border-slate-200">
            <CardBody className="p-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">How It Works</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-xs text-slate-600">Credential issued with encrypted health data</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-xs text-slate-600">Patient stores private codes in their wallet</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-xs text-slate-600">Selective disclosure proves claims without revealing data</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Verification Types */}
          <Card className="bg-slate-50 border-slate-200">
            <CardBody className="p-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">Available Verifications</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ChevronRight className="w-3 h-3 text-emerald-500" />
                  <span>Age threshold (≥ minAge)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ChevronRight className="w-3 h-3 text-emerald-500" />
                  <span>Prescription code match</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ChevronRight className="w-3 h-3 text-emerald-500" />
                  <span>Condition code match</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper component for displaying data rows
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-mono text-slate-700 truncate max-w-[180px]" title={value}>
        {value}
      </span>
    </div>
  );
}
