import { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle, FileCheck, AlertCircle, Send, Loader2, FileJson, ArrowRight, Sparkles } from 'lucide-react';
import { verifyZKProof, getCircuitInfo } from '../../services/proofs/verifier';
import { submitOnChainVerification } from '../../services/proofs/onChainVerification';
import { CONFIG } from '../../services/contractService';

interface VerificationResult {
  valid: boolean;
  type?: string;
  verifiedAt?: string;
  circuitId?: string;
  proofSize?: number;
  error?: string;
  details?: string;
  isRealVerification?: boolean;
  proofData?: any;
  diagnosticInfo?: string;
}

export function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{txId?: string; error?: string; status?: 'pending' | 'success' | 'failed'} | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!proofInput.trim()) return;
    setIsVerifying(true);
    
    try {
      const trimmed = proofInput.trim();
      const isHexProof = trimmed.startsWith('0x') || /^[0-9a-fA-F]+$/.test(trimmed);
      
      if (isHexProof) {
        await verifyCryptographicProof(trimmed);
      } else {
        await verifyJsonProof(trimmed);
      }
    } catch (error) {
      let diagnosticInfo = '';
      if (error instanceof Error) {
        diagnosticInfo = `Error: ${error.message}`;
      }
      
      setResult({
        valid: false,
        error: 'Failed to verify proof: ' + (error instanceof Error ? error.message : 'Unknown error'),
        diagnosticInfo,
      });
    }
    
    setIsVerifying(false);
  };

  const verifyCryptographicProof = async (hexProof: string) => {
    const cleanHex = hexProof.startsWith('0x') ? hexProof.slice(2) : hexProof;
    
    if (cleanHex.length < 64) {
      setResult({
        valid: false,
        error: 'Proof too short - must be at least 32 bytes',
      });
      return;
    }
    
    const proofBytes = new Uint8Array(cleanHex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || []);
    const isValidFormat = proofBytes.length > 100;
    
    if (!isValidFormat) {
      setResult({
        valid: false,
        error: 'Proof format appears invalid',
      });
      return;
    }
    
    setResult({
      valid: true,
      type: 'ZK Proof (Format Validated Only)',
      proofSize: cleanHex.length / 2,
      verifiedAt: new Date().toLocaleString(),
      circuitId: 'unknown',
      details: 'Format is valid but cryptographic verification requires the full proof JSON (with circuitId and publicInputs).',
      isRealVerification: false,
    });
  };

  const verifyJsonProof = async (jsonString: string) => {
    let proofData: any;
    try {
      proofData = JSON.parse(jsonString);
    } catch (e) {
      setResult({
        valid: false,
        error: 'Invalid proof format - must be valid JSON or hex-encoded cryptographic proof',
      });
      return;
    }
    
    const serializedPreimage = proofData.serializedPreimage;
    const circuitId = proofData.circuitId;
    const publicInputs = typeof proofData.publicInputs === 'string' 
      ? JSON.parse(proofData.publicInputs) 
      : proofData.publicInputs;
    
    if (!serializedPreimage || !circuitId) {
      setResult({
        valid: false,
        error: 'Invalid proof format. Missing serializedPreimage or circuit ID.',
      });
      return;
    }
    
    const preimageBytes = new Uint8Array(serializedPreimage);
    
    setIsVerifying(true);
    const verificationResult = await verifyZKProof(preimageBytes, circuitId, publicInputs);
    setIsVerifying(false);
    
    if (verificationResult.valid) {
      setResult({
        valid: true,
        type: 'ZK Proof (SNARK Verified)',
        proofSize: preimageBytes.length,
        verifiedAt: new Date().toLocaleString(),
        circuitId: verificationResult.circuitId,
        details: verificationResult.details,
        isRealVerification: true,
        proofData: proofData,
      });
    } else {
      setResult({
        valid: false,
        error: verificationResult.error,
        circuitId: circuitId,
      });
    }
  };

  const handleSubmitOnChain = async () => {
    if (!result?.proofData) return;
    
    setIsSubmitting(true);
    setTxResult(null);
    
    try {
      const proofData = result.proofData;
      const publicInputs = JSON.parse(proofData.publicInputs || '{}');
      const commitment = publicInputs.commitment;
      
      if (!commitment) {
        throw new Error('No commitment found in proof public inputs');
      }
      
      const commitmentHex = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
      
      const circuitId = proofData.circuitId || '';
      let params: { minAge?: number; requiredPrescription?: number; requiredCondition?: number } = {};
      
      if (circuitId.includes('FreeHealthClinic') || circuitId.includes('freeHealthClinic')) {
        const rules = publicInputs.rules || [];
        const ageRule = rules.find((r: any) => r.field === 'age');
        params.minAge = ageRule ? parseInt(ageRule.value) : 18;
      } else if (circuitId.includes('Pharmacy') || circuitId.includes('pharmacy')) {
        const rules = publicInputs.rules || [];
        const rxRule = rules.find((r: any) => r.field === 'prescriptionCode');
        params.requiredPrescription = rxRule ? parseInt(rxRule.value) : 500;
      } else if (circuitId.includes('Hospital') || circuitId.includes('hospital')) {
        const rules = publicInputs.rules || [];
        const ageRule = rules.find((r: any) => r.field === 'age');
        const conditionRule = rules.find((r: any) => r.field === 'conditionCode');
        params.minAge = ageRule ? parseInt(ageRule.value) : 18;
        params.requiredCondition = conditionRule ? parseInt(conditionRule.value) : 100;
      } else {
        params.minAge = 18;
      }
      
      const healthClaim = proofData.healthClaim;
      
      if (!healthClaim) {
        setTxResult({ error: 'Health claim not found in proof data', status: 'failed' });
        setIsSubmitting(false);
        return;
      }
      
      const submitResult = await submitOnChainVerification(
        commitmentHex,
        circuitId as any,
        params,
        healthClaim
      );
      
      if (submitResult.success) {
        setTxResult({ txId: submitResult.txId, status: 'pending' });
      } else {
        setTxResult({ error: submitResult.error, status: 'failed' });
      }
    } catch (error: any) {
      setTxResult({ error: error.message || 'Failed to submit verification' });
    }
    
    setIsSubmitting(false);
  };

  const reset = () => {
    setProofInput('');
    setResult(null);
    setTxResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Submit Proof</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Validate your proof and get transaction ID for providers
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>ZK-Enabled</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {!result ? (
        <>
          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Paste Proof
                </label>
                <textarea
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  placeholder="Paste JSON proof from AI Chat download..."
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-sm"
                />
              </div>
              
              <button 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json,.proof,.txt';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const text = await file.text();
                      setProofInput(text);
                    }
                  };
                  input.click();
                }}
              >
                <FileJson className="w-5 h-5" />
                Upload Proof File
              </button>
            </div>
            
            {/* Help Box */}
            <div className="px-6 pb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-700 mb-1">How to verify</p>
                    <p>Upload a proof file from the AI Chat (download button) or paste the JSON proof data. The verifier performs full SNARK validation.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={!proofInput.trim() || isVerifying}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Verify Proof
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </>
      ) : (
        /* Results */
        <div className="space-y-4">
          {/* Status Banner */}
          <div className={`rounded-2xl p-6 border ${result.valid 
            ? (result.isRealVerification ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200')
            : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.valid ? (result.isRealVerification ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-red-500'}`}>
                {result.valid ? (
                  result.isRealVerification ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-white" />
                  )
                ) : (
                  <XCircle className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h3 className={`text-lg font-bold ${result.valid ? (result.isRealVerification ? 'text-emerald-800' : 'text-amber-800') : 'text-red-800'}`}>
                  {result.valid 
                    ? (result.isRealVerification ? 'Proof Verified' : 'Format Valid')
                    : 'Verification Failed'}
                </h3>
                <p className="text-sm text-slate-600">
                  {result.valid 
                    ? (result.isRealVerification ? 'Full SNARK verification passed' : 'Proof structure is valid')
                    : 'The proof could not be validated'}
                </p>
              </div>
            </div>
          </div>

          {/* Details Card */}
          {result.valid && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-slate-400" />
                Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 uppercase mb-1">Type</p>
                  <p className="text-sm font-medium text-slate-900">{result.type}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 uppercase mb-1">Circuit</p>
                  <p className="text-sm font-medium text-slate-900 font-mono">{result.circuitId || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 uppercase mb-1">Size</p>
                  <p className="text-sm font-medium text-slate-900">{result.proofSize} bytes</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 uppercase mb-1">Verified</p>
                  <p className="text-sm font-medium text-slate-900">{result.verifiedAt}</p>
                </div>
              </div>

              {result.details && (
                <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{result.details}</p>
              )}
            </div>
          )}

          {/* Error */}
          {!result.valid && result.error && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}

          {/* On-Chain Submission */}
          {result.valid && result.proofData && result.isRealVerification && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                On-Chain Verification
              </h4>
              
              {!txResult && (
                <button
                  onClick={handleSubmitOnChain}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit to Blockchain
                    </>
                  )}
                </button>
              )}

              {txResult?.status === 'pending' && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span className="font-medium text-amber-800">Verifying on-chain...</span>
                  </div>
                  <p className="text-xs font-mono text-amber-900 break-all">{txResult.txId}</p>
                </div>
              )}

              {txResult?.status === 'success' && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-800">Verified on-chain!</span>
                  </div>
                  <p className="text-xs font-mono text-emerald-900 break-all">{txResult.txId}</p>
                </div>
              )}

              {txResult?.status === 'failed' && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-800">Verification failed</span>
                  </div>
                  <p className="text-sm text-red-600">{txResult.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Reset Button */}
          <button
            onClick={reset}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Verify Another Proof
          </button>
        </div>
      )}
    </div>
  );
}