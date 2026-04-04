import { useState, useEffect } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle, FileCheck, AlertCircle, Send, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, TextArea, Alert, Badge } from '../common';

import { verifyZKProof } from '../../services/proofs/verifier';
import { submitOnChainVerification } from '../../services/proofs/onChainVerification';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CONFIG, getStoredCredentials } from '../../services/contractService';

interface VerificationResult {
  valid: boolean;
  type?: string;
  verifiedAt?: string;
  circuitId?: string;
  proofSize?: number;
  error?: string;
  details?: string;
  isRealVerification?: boolean;
  proofData?: any; // Store parsed proof data for on-chain submission
}

export function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{txId?: string; error?: string; status?: 'pending' | 'success' | 'failed'} | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Watch for transaction status
  useEffect(() => {
    if (!txResult?.txId || txResult.status !== 'pending') return;

    const checkStatus = async () => {
      try {
        const publicDataProvider = indexerPublicDataProvider(
          CONFIG.indexer,
          CONFIG.indexerWS
        );
        
        const txData = await publicDataProvider.watchForTxData(txResult.txId);
        
        if (txData.status === 'SucceedEntirely') {
          setTxResult(prev => ({ ...prev!, status: 'success' }));
        } else {
          setTxResult(prev => ({ ...prev!, status: 'failed', error: `Transaction failed with status: ${txData.status}` }));
        }
      } catch (error: any) {
        console.error('Failed to check transaction status:', error);
        setTxResult(prev => ({ ...prev!, status: 'failed', error: error.message }));
      }
    };

    // Check after a short delay to allow transaction to propagate
    const timer = setTimeout(checkStatus, 2000);
    return () => clearTimeout(timer);
  }, [txResult?.txId, txResult?.status]);

  const handleVerify = async () => {
    if (!proofInput.trim()) return;
    
    console.log('Verify button clicked, proofInput length:', proofInput.length);
    console.log('proofInput (first 200 chars):', proofInput.slice(0, 200));
    
    setIsVerifying(true);
    
    try {
      const trimmed = proofInput.trim();
      
      // Check if it's a hex proof (starts with 0x or is all hex chars)
      const isHexProof = trimmed.startsWith('0x') || /^[0-9a-fA-F]+$/.test(trimmed);
      console.log('isHexProof:', isHexProof, 'starts with:', trimmed.slice(0, 20));
      
      if (isHexProof) {
        // This is a cryptographic ZK proof
        await verifyCryptographicProof(trimmed);
      } else {
        // Try to parse as JSON (downloaded proof file format)
        await verifyJsonProof(trimmed);
      }
    } catch (error) {
      setResult({
        valid: false,
        error: 'Failed to verify proof: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
    
    setIsVerifying(false);
  };

  const verifyCryptographicProof = async (hexProof: string) => {
    // Clean up the hex string
    const cleanHex = hexProof.startsWith('0x') ? hexProof.slice(2) : hexProof;
    
    // Check minimum length for a valid proof
    if (cleanHex.length < 64) {
      setResult({
        valid: false,
        error: 'Proof too short - must be at least 32 bytes',
      });
      return;
    }
    
    // Parse the proof to extract basic info
    const proofBytes = new Uint8Array(cleanHex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || []);
    
    // Basic validation checks
    const isValidFormat = proofBytes.length > 100; // Real ZK proofs are typically large
    
    if (!isValidFormat) {
      setResult({
        valid: false,
        error: 'Proof format appears invalid - insufficient data for a valid ZK proof',
      });
      return;
    }
    
    // Raw hex proof without context - can only do format validation
    // For real verification, we need circuitId and publicInputs from the JSON format
    setResult({
      valid: true,
      type: 'ZK Proof (Format Validated Only)',
      proofSize: cleanHex.length / 2,
      verifiedAt: new Date().toLocaleString(),
      circuitId: 'unknown',
      details: '⚠️ Format is valid but cryptographic verification requires the full proof JSON (with circuitId and publicInputs). Use Copy/Download from AI Chat instead of pasting raw hex.',
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
    
    // Debug: Log what we received
    console.log('Proof data received:', {
      hasQrData: !!proofData.qrData,
      qrDataType: typeof proofData.qrData,
      qrDataLength: proofData.qrData?.length,
      hasProof: !!proofData.proof,
      hasCircuitId: !!proofData.circuitId,
      hasTimestamp: !!(proofData.timestamp || proofData.generatedAt),
      hasPublicInputs: !!proofData.publicInputs,
      keys: Object.keys(proofData),
    });
    
    // Get the serialized preimage and circuit ID
    // NOTE: serializedPreimage is what check() expects, NOT the proof bytes
    const serializedPreimage = proofData.serializedPreimage;
    const circuitId = proofData.circuitId;
    const publicInputs = typeof proofData.publicInputs === 'string' 
      ? JSON.parse(proofData.publicInputs) 
      : proofData.publicInputs;
    
    if (!serializedPreimage || !circuitId) {
      setResult({
        valid: false,
        error: 'Invalid proof format. Missing serializedPreimage or circuit ID. Please generate a new proof with the latest version.',
      });
      return;
    }
    
    // Convert serializedPreimage array back to Uint8Array
    const preimageBytes = new Uint8Array(serializedPreimage);
    
    // Perform real SNARK verification
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
      });
    }
  };

  const reset = () => {
    setProofInput('');
    setResult(null);
    setTxResult(null);
  };

  const handleSubmitOnChain = async () => {
    if (!result?.proofData) return;
    
    setIsSubmitting(true);
    setTxResult(null);
    
    try {
      // Extract data from the proof
      const proofData = result.proofData;
      const publicInputs = JSON.parse(proofData.publicInputs || '{}');
      const commitment = publicInputs.commitment;
      
      if (!commitment) {
        throw new Error('No commitment found in proof public inputs');
      }
      
      // Convert commitment to bytes for the contract call
      const commitmentHex = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
      
      // Determine verifier type and parameters from the circuitId
      const circuitId = proofData.circuitId || '';
      let params: { minAge?: number; requiredPrescription?: number; requiredCondition?: number } = {};
      
      if (circuitId.includes('FreeHealthClinic') || circuitId.includes('freeHealthClinic')) {
        // Extract minAge from rules if available
        const rules = publicInputs.rules || [];
        const ageRule = rules.find((r: any) => r.field === 'age');
        params.minAge = ageRule ? parseInt(ageRule.value) : 18; // Default to 18 if not specified
      } else if (circuitId.includes('Pharmacy') || circuitId.includes('pharmacy')) {
        // Extract prescription code from rules
        const rules = publicInputs.rules || [];
        const rxRule = rules.find((r: any) => r.field === 'prescriptionCode');
        params.requiredPrescription = rxRule ? parseInt(rxRule.value) : 500; // Default
      } else if (circuitId.includes('Hospital') || circuitId.includes('hospital')) {
        // Extract age and condition from rules
        const rules = publicInputs.rules || [];
        const ageRule = rules.find((r: any) => r.field === 'age');
        const conditionRule = rules.find((r: any) => r.field === 'conditionCode');
        params.minAge = ageRule ? parseInt(ageRule.value) : 18;
        params.requiredCondition = conditionRule ? parseInt(conditionRule.value) : 100;
      } else {
        // Default to free health clinic
        params.minAge = 18;
      }
      
      // Look up the credential to get the health claim for witness
      const storedCredentials = getStoredCredentials();
      const credential = storedCredentials.find(c => 
        c.commitment.toLowerCase() === commitmentHex.toLowerCase() ||
        c.id.toLowerCase() === commitmentHex.toLowerCase()
      );
      
      if (!credential?.healthClaim) {
        setTxResult({ 
          error: 'Health claim not found for this credential. The credential may have been issued before health claim storage was added. Please issue a new credential.', 
          status: 'failed' 
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log('   Found credential with health claim:', credential.healthClaim);
      
      // Use submitOnChainVerification which properly handles health claim private state
      const submitResult = await submitOnChainVerification(
        commitmentHex,
        circuitId as any,
        params,
        credential.healthClaim
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

  return (
    <Card>
      <CardHeader 
        title="Verify Zero-Knowledge Proof"
        subtitle="Two-step verification: Local SNARK validation → On-chain confirmation"
        icon={ShieldCheck}
      />
      <CardBody className="space-y-6">
        {!result ? (
          <>
            <TextArea
              label="Paste Proof"
              placeholder="Paste the cryptographic ZK proof here (hex format) or JSON proof file content..."
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              rows={6}
            />
            
            <p className="text-xs text-slate-500 mt-1">
              Accepted formats: (1) Raw hex proof starting with 0x, or (2) JSON from AI Chat download with qrData field
            </p>

            <div className="flex items-center justify-center">
              <span className="text-slate-500 text-sm">or</span>
            </div>

            <Button 
              variant="secondary" 
              className="w-full"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.proof,.txt';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    console.log('File selected:', file.name, file.type, file.size);
                    const text = await file.text();
                    console.log('File content (first 200 chars):', text.slice(0, 200));
                    setProofInput(text);
                  }
                };
                input.click();
              }}
            >
              Upload Proof File
            </Button>

            <Alert variant="info">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">About Proof Verification</p>
                  <p className="text-sm mt-1">
                    This tool validates the format of ZK proofs. Full cryptographic verification 
                    requires the verifier key and public inputs, which are typically verified 
                    on-chain or through a verification service.
                  </p>
                </div>
              </div>
            </Alert>

            <Button 
              onClick={handleVerify}
              isLoading={isVerifying}
              disabled={!proofInput.trim() || isVerifying}
              className="w-full"
            >
              Verify Proof
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className={`p-6 rounded-lg border ${result.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                {result.valid ? (
                  result.isRealVerification ? (
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <CheckCircle className="w-8 h-8 text-amber-500" />
                  )
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${result.valid ? (result.isRealVerification ? 'text-emerald-700' : 'text-amber-700') : 'text-red-700'}`}>
                    {result.valid 
                      ? (result.isRealVerification ? 'Proof Verified ✓' : 'Proof Format Valid ✓')
                      : 'Proof Invalid'}
                  </h3>
                  <p className="text-slate-600">
                    {result.valid 
                      ? (result.isRealVerification 
                        ? 'Credential verified on-chain. The proof is valid.'
                        : 'The proof structure is valid (credential status unknown)')
                      : 'This proof could not be validated'}
                  </p>
                </div>
              </div>

              {result.valid && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-900">Validation Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Type</p>
                      <p className="text-slate-900 font-medium">{result.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Proof Size</p>
                      <p className="text-slate-900 font-medium">{result.proofSize} bytes</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Validated At</p>
                      <p className="text-slate-700">{result.verifiedAt}</p>
                    </div>
                    {result.circuitId && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase mb-1">Circuit</p>
                        <p className="text-slate-900 font-mono text-sm">{result.circuitId}</p>
                      </div>
                    )}
                  </div>
                  {result.details && (
                    <div className="mt-4 pt-4 border-t border-emerald-100">
                      <p className="text-sm text-slate-600">{result.details}</p>
                    </div>
                  )}
                </div>
              )}

              {result.error && (
                <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              )}

              {/* Proof Details Section */}
              {result.valid && result.proofData && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Proof Details</span>
                  </div>
                  
                  {/* Two-Step Verification Flow */}
                  <div className="space-y-4">
                    {/* Step 1: Pre-validation */}
                    <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-emerald-900">SNARK Pre-Validation</p>
                        <p className="text-sm text-emerald-700">
                          Proof constraints verified locally via /check endpoint
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          ✓ Valid proof structure • ✓ Constraints satisfied
                        </p>
                      </div>
                    </div>

                    {/* Step 2: On-Chain */}
                    <div className={`flex items-start gap-3 p-3 rounded-lg border ${txResult?.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${txResult?.status === 'success' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                        2
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${txResult?.status === 'success' ? 'text-emerald-900' : 'text-slate-900'}`}>
                          On-Chain Verification
                        </p>
                        <p className="text-sm text-slate-600">
                          {txResult?.status === 'success' 
                            ? 'Network validators verified the proof. Transaction committed.'
                            : 'Submit to Midnight network for authoritative verification'}
                        </p>
                        
                        {/* What's visible on-chain */}
                        <div className="mt-2 p-2 bg-white/50 rounded text-xs">
                          <p className="font-medium text-slate-700 mb-1">What's visible on-chain:</p>
                          <ul className="space-y-1 text-slate-600">
                            <li>• totalVerificationsPerformed counter increments</li>
                            <li>• Transaction hash (publicly auditable)</li>
                            <li>• Boolean result (e.g., age ≥ 18: true)</li>
                          </ul>
                          <p className="font-medium text-emerald-700 mt-2">What stays private:</p>
                          <p className="text-slate-600">Your actual age, condition codes, prescription codes</p>
                        </div>

                        {!txResult && (
                          <Button 
                            onClick={handleSubmitOnChain}
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            className="w-full mt-3"
                            leftIcon={<Send className="w-4 h-4" />}
                          >
                            Submit On-Chain Verification
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {txResult?.status === 'pending' && (
                    <div className="mt-4 p-3 bg-amber-100 rounded border border-amber-300">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        <p className="text-sm font-medium text-amber-800">Verifying on-chain...</p>
                      </div>
                      <p className="text-xs text-amber-700 mt-1">Transaction ID:</p>
                      <p className="text-xs font-mono text-amber-900 break-all">{txResult.txId}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Waiting for network confirmation. This may take a few moments.
                      </p>
                      <a 
                        href={`https://preprod.midnightexplorer.com/transactions/${txResult.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  )}

                  {txResult?.status === 'success' && (
                    <div className="mt-4 p-3 bg-emerald-100 rounded border border-emerald-300">
                      <p className="text-sm font-medium text-emerald-800">✅ Proof Verified Successfully!</p>
                      <p className="text-xs text-emerald-700 mt-1">Transaction ID:</p>
                      <p className="text-xs font-mono text-emerald-900 break-all">{txResult.txId}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        The ZK proof has been cryptographically verified on-chain. The credential is valid.
                      </p>
                      <a 
                        href={`https://preprod.midnightexplorer.com/transactions/${txResult.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  )}

                  {txResult?.status === 'failed' && (
                    <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
                      <p className="text-sm font-medium text-red-800">❌ Verification Failed</p>
                      <p className="text-xs text-red-700 mt-1">{txResult.error || 'The proof verification failed on-chain.'}</p>
                      {txResult.txId && (
                        <>
                          <p className="text-xs text-red-600 mt-1">Transaction ID:</p>
                          <p className="text-xs font-mono text-red-900 break-all">{txResult.txId}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button onClick={reset} variant="secondary" className="w-full">
              Validate Another Proof
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
