import { useState, useEffect } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle, FileCheck, AlertCircle, Send, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, TextArea, Alert, Badge } from '../common';
import { submitProofVerification } from '../../services/contractInteraction';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
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
      qrDataPreview: proofData.qrData ? String(proofData.qrData).slice(0, 50) + '...' : 'N/A',
      hasProof: !!proofData.proof,
      hasCircuitId: !!proofData.circuitId,
      hasTimestamp: !!(proofData.timestamp || proofData.generatedAt),
      keys: Object.keys(proofData),
    });
    
    // Normalize field names - AI Chat download uses 'generatedAt' instead of 'timestamp'
    const timestamp = proofData.timestamp || proofData.generatedAt;
    const type = proofData.type || 'ZK Proof';
    
    // Handle downloaded proof file format (from AI Chat)
    // Format: { qrData: "hex proof", circuitId: "...", timestamp: "...", publicInputs: "..." }
    if (proofData.qrData && typeof proofData.qrData === 'string') {
      const hexProof = proofData.qrData.startsWith('0x') 
        ? proofData.qrData.slice(2) 
        : proofData.qrData;
      
      const isValidHex = /^[0-9a-fA-F]+$/.test(hexProof);
      console.log('qrData validation:', { isValidHex, length: hexProof.length, hasPublicInputs: !!proofData.publicInputs });
      
      if (isValidHex && hexProof.length >= 64) {
        // Note: The Midnight proof server does not have a /verify endpoint.
        // Real verification happens on-chain when the proof is submitted.
        // We can validate the format and check if the credential exists.
        const hasPublicInputs = !!proofData.publicInputs;
        
        if (hasPublicInputs && proofData.circuitId) {
          // Validate format and public inputs are present
          // Real cryptographic verification requires on-chain submission
          setResult({
            valid: true,
            type: 'ZK Proof (Format Validated)',
            proofSize: hexProof.length / 2,
            verifiedAt: new Date(timestamp || Date.now()).toLocaleString(),
            circuitId: proofData.circuitId,
            details: `✅ Proof format is valid. This proof was generated for ${proofData.circuitId} circuit.\n\nReady for on-chain verification.`,
            isRealVerification: false,
            proofData: proofData, // Store for on-chain submission
          });
          return;
        }
        
        // No publicInputs - do format validation only
        setResult({
          valid: true,
          type: 'ZK Proof (Format Validated Only)',
          proofSize: hexProof.length / 2,
          verifiedAt: new Date(timestamp || Date.now()).toLocaleString(),
          circuitId: proofData.circuitId || 'verifyCredential',
          details: `⚠️ Format is valid but cryptographic verification requires publicInputs. This proof may be from an older version.`,
          isRealVerification: false,
        });
        return;
      }
    }
    
    // Check for alternative format: { proof: "hex", circuitId: "...", timestamp: "..." }
    if (proofData.proof && typeof proofData.proof === 'string' && proofData.circuitId) {
      const hexProof = proofData.proof.startsWith('0x') 
        ? proofData.proof.slice(2) 
        : proofData.proof;
      
      if (/^[0-9a-fA-F]+$/.test(hexProof) && hexProof.length >= 64) {
        setResult({
          valid: true,
          type: 'ZK Proof (Format Validated Only)',
          proofSize: hexProof.length / 2,
          verifiedAt: new Date(proofData.timestamp || Date.now()).toLocaleString(),
          circuitId: proofData.circuitId,
          details: '⚠️ Format is valid but publicInputs are missing for cryptographic verification.',
          isRealVerification: false,
        });
        return;
      }
    }
    
    // Provide specific error based on what was detected
    let errorMsg = 'Invalid proof format. Expected:\n1. Raw hex proof (starting with 0x or plain hex), OR\n2. JSON file with qrData/circuitId/timestamp fields from AI Chat download';
    
    if (proofData.qrData && typeof proofData.qrData === 'string') {
      const hexProof = proofData.qrData.startsWith('0x') 
        ? proofData.qrData.slice(2) 
        : proofData.qrData;
      if (!/^[0-9a-fA-F]+$/.test(hexProof)) {
        errorMsg = 'Invalid proof: qrData field contains non-hex characters. The proof may be corrupted.';
      } else if (hexProof.length < 64) {
        errorMsg = `Invalid proof: qrData is too short (${hexProof.length} chars). Expected at least 64 hex characters.`;
      }
    } else if (!proofData.qrData && !proofData.proof) {
      // Check if this is the old copy format without qrData
      if (proofData.credentialCommitment && proofData.type === 'rule-based-verification') {
        errorMsg = 'This proof was copied using an older format that does not include the cryptographic proof data. Please download the proof file instead of copying it, or generate a new proof and copy it again.';
      } else {
        errorMsg = `Invalid proof format. Missing required field: qrData or proof. Found keys: ${Object.keys(proofData).join(', ')}`;
      }
    }
    
    setResult({
      valid: false,
      error: errorMsg,
    });
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
      
      // Get the credential data bytes from the proof (needed for on-chain verification)
      let credentialDataBytes: Uint8Array;
      if (proofData.credentialDataBytes && Array.isArray(proofData.credentialDataBytes)) {
        credentialDataBytes = new Uint8Array(proofData.credentialDataBytes);
      } else {
        throw new Error('Missing credential data bytes in proof. Please generate a new proof with the latest version.');
      }
      
      const submitResult = await submitProofVerification(
        commitmentHex,
        credentialDataBytes,
        proofData.circuitId || 'verifyCredential'
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
        subtitle="Validate cryptographic ZK proof format"
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
                      ? (result.isRealVerification ? 'Proof Cryptographically Verified ✓' : 'Proof Format Valid ✓')
                      : 'Proof Invalid'}
                  </h3>
                  <p className="text-slate-600">
                    {result.valid 
                      ? (result.isRealVerification 
                        ? 'This proof has been verified against the blockchain'
                        : 'The proof structure is valid (but not cryptographically verified)')
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
                  <div className="grid grid-cols-2 gap-4">
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

              {/* On-Chain Verification Section */}
              {result.valid && result.proofData && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">On-Chain Verification</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Submit this proof to the blockchain for cryptographic verification. 
                    This will call the {result.circuitId} circuit on-chain.
                  </p>
                  
                  <Button 
                    onClick={handleSubmitOnChain}
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    className="w-full"
                    leftIcon={<Send className="w-4 h-4" />}
                  >
                    Submit Verification to Blockchain
                  </Button>

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
                        href={`https://explorer.midnight.network/tx/${txResult.txId}`}
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
                        href={`https://explorer.midnight.network/tx/${txResult.txId}`}
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
