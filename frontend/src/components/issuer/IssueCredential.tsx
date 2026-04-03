import { useState } from 'react';
import { 
  Plus, 
  Hash, 
  Calendar, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText,
  User,
  Shield,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../common';
import { getWalletState } from '../../services/contractService';
import { issueCredentialOnChain } from '../../services/contractInteraction';

// Structured claim data that matches AI proof requirements
interface ClaimData {
  age: number;
  has_diabetes_diagnosis: boolean;
  vaccinated_last_6_months: boolean;
  vaccination_status: string;
  medical_clearance: boolean;
  free_healthcare_eligible: boolean;
  dental_coverage: boolean;
  annual_wellness_exam: string;
  identity_verified: boolean;
  income_eligible: boolean;
  resident_status: string;
}

// Credential data structure
interface CredentialData {
  patientAddress: string;
  claimType: string;
  expiryDays: string;
  claimData: ClaimData;
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

const defaultClaimData: ClaimData = {
  age: 35,
  has_diabetes_diagnosis: false,
  vaccinated_last_6_months: false,
  vaccination_status: 'partial',
  medical_clearance: false,
  free_healthcare_eligible: false,
  dental_coverage: false,
  annual_wellness_exam: 'pending',
  identity_verified: true,
  income_eligible: false,
  resident_status: 'pending',
};

const CLAIM_TEMPLATES = [
  { name: 'Medical Record', description: 'General medical record with diagnoses' },
  { name: 'Vaccination Certificate', description: 'COVID-19 and other vaccinations' },
  { name: 'Medical Clearance', description: 'Sports or work clearance' },
  { name: 'Diabetes Diagnosis', description: 'Type 1 or Type 2 diabetes' },
  { name: 'Annual Physical', description: 'Yearly wellness examination' },
  { name: 'Insurance Eligibility', description: 'Healthcare coverage proof' },
];

export function IssueCredential() {
  const [formData, setFormData] = useState<CredentialData>({
    patientAddress: '',
    claimType: '',
    expiryDays: '365',
    claimData: { ...defaultClaimData },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [step, setStep] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      if (!formData.patientAddress || !formData.claimType) {
        throw new Error('Patient address and claim type are required.');
      }

      const claimDataJson = JSON.stringify(formData.claimData);

      const result = await issueCredentialOnChain(
        formData.patientAddress,
        formData.claimType,
        claimDataJson,
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
        claimData: { ...defaultClaimData },
        expiryDays: '365',
      });
      setStep(1);

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

  const selectTemplate = (name: string) => {
    setFormData(prev => ({ ...prev, claimType: name }));
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
            
            <div className="space-y-3 text-left mb-8">
              <DataRow label="Transaction ID" value={result.txId || ''} />
              <DataRow label="Commitment" value={result.commitment || ''} />
              <DataRow label="Claim Hash" value={result.claimHash || ''} />
            </div>

            <Button 
              onClick={() => setResult(null)}
              className="w-full"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Issue Another Credential
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-red-200">
          <CardBody className="p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Failed to Issue Credential
            </h2>
            <p className="text-red-600 mb-8">{result.error}</p>

            <Button 
              variant="secondary"
              onClick={() => setResult(null)}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <StepIndicator number={1} label="Patient" active={step === 1} completed={step > 1} />
        <div className="w-16 h-0.5 bg-slate-200 mx-2" />
        <StepIndicator number={2} label="Claim Type" active={step === 2} completed={step > 2} />
        <div className="w-16 h-0.5 bg-slate-200 mx-2" />
        <StepIndicator number={3} label="Medical Data" active={step === 3} completed={false} />
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <Card>
            <CardHeader 
              title="Step 1: Patient Information"
              subtitle="Enter the patient's wallet address"
              icon={User}
            />
            <CardBody className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  The patient must provide their shielded wallet address. This ensures the credential 
                  is issued to the correct person and can only be used by them.
                </p>
              </div>

              <Input
                label="Patient Wallet Address"
                placeholder="mn_shield-addr..."
                value={formData.patientAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, patientAddress: e.target.value }))}
                required
              />

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.patientAddress}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Continue
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader 
              title="Step 2: Select Claim Type"
              subtitle="Choose the type of credential to issue"
              icon={FileText}
            />
            <CardBody className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CLAIM_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => selectTemplate(template.name)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.claimType === template.name
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium text-slate-900">{template.name}</div>
                    <div className="text-sm text-slate-500">{template.description}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!formData.claimType}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Continue
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader 
              title="Step 3: Medical Data"
              subtitle="Configure the credential details"
              icon={Plus}
            />
            <CardBody>
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Patient Age
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={formData.claimData.age}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        claimData: { ...prev.claimData, age: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expires In (Days)
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={formData.expiryDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, expiryDays: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Conditions */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Medical Conditions
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Checkbox
                      label="Diabetes Diagnosis"
                      checked={formData.claimData.has_diabetes_diagnosis}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, has_diabetes_diagnosis: checked }
                      }))}
                    />
                    <Checkbox
                      label="Vaccinated (6mo)"
                      checked={formData.claimData.vaccinated_last_6_months}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, vaccinated_last_6_months: checked }
                      }))}
                    />
                    <Checkbox
                      label="Medical Clearance"
                      checked={formData.claimData.medical_clearance}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, medical_clearance: checked }
                      }))}
                    />
                    <Checkbox
                      label="Free Healthcare"
                      checked={formData.claimData.free_healthcare_eligible}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, free_healthcare_eligible: checked }
                      }))}
                    />
                    <Checkbox
                      label="Dental Coverage"
                      checked={formData.claimData.dental_coverage}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, dental_coverage: checked }
                      }))}
                    />
                    <Checkbox
                      label="Identity Verified"
                      checked={formData.claimData.identity_verified}
                      onChange={(checked) => setFormData(prev => ({
                        ...prev,
                        claimData: { ...prev.claimData, identity_verified: checked }
                      }))}
                    />
                  </div>
                </div>

                {/* Status Selects */}
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    label="Vaccination Status"
                    value={formData.claimData.vaccination_status}
                    onChange={(value) => setFormData(prev => ({
                      ...prev,
                      claimData: { ...prev.claimData, vaccination_status: value }
                    }))}
                    options={[
                      { value: 'complete', label: 'Complete' },
                      { value: 'partial', label: 'Partial' },
                      { value: 'none', label: 'None' },
                    ]}
                  />
                  <Select
                    label="Wellness Exam"
                    value={formData.claimData.annual_wellness_exam}
                    onChange={(value) => setFormData(prev => ({
                      ...prev,
                      claimData: { ...prev.claimData, annual_wellness_exam: value }
                    }))}
                    options={[
                      { value: 'completed', label: 'Completed' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'scheduled', label: 'Scheduled' },
                    ]}
                  />
                  <Select
                    label="Resident Status"
                    value={formData.claimData.resident_status}
                    onChange={(value) => setFormData(prev => ({
                      ...prev,
                      claimData: { ...prev.claimData, resident_status: value }
                    }))}
                    options={[
                      { value: 'verified', label: 'Verified' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'ineligible', label: 'Ineligible' },
                    ]}
                  />
                </div>

                {/* JSON Preview */}
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Data Preview</span>
                    <span className="text-xs text-slate-500">What will be hashed</span>
                  </div>
                  <pre className="text-xs text-emerald-400 font-mono">
                    {JSON.stringify(formData.claimData, null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Issuing...' : 'Issue Credential'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </form>
    </div>
  );
}

// Helper Components

function StepIndicator({ number, label, active, completed }: { 
  number: number; 
  label: string; 
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
        completed 
          ? 'bg-emerald-500 text-white' 
          : active 
            ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500' 
            : 'bg-slate-100 text-slate-400'
      }`}>
        {completed ? <CheckCircle className="w-5 h-5" /> : number}
      </div>
      <span className={`text-xs mt-1.5 font-medium ${
        active || completed ? 'text-emerald-700' : 'text-slate-400'
      }`}>
        {label}
      </span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</span>
      <code className="block mt-1 font-mono text-sm text-slate-700 break-all">
        {value}
      </code>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { 
  label: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border cursor-pointer hover:border-emerald-300 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 text-emerald-600 rounded-lg border-slate-300 focus:ring-emerald-500"
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}

function Select({ 
  label, 
  value, 
  onChange, 
  options 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
