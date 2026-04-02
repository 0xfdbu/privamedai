import { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, TextArea, Alert, Badge } from '../common';

interface VerificationResult {
  valid: boolean;
  credentialType?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  disclosures?: Record<string, string>;
}

export function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!proofInput.trim()) return;
    
    setIsVerifying(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setResult({
      valid: true,
      credentialType: 'Vaccination Record',
      issuer: 'City General Hospital',
      issuedAt: '2024-01-15',
      expiresAt: '2025-01-15',
      disclosures: {
        'Vaccination Status': 'Complete',
        'Date of Issue': '2024-01-15',
      },
    });
    
    setIsVerifying(false);
  };

  const reset = () => {
    setProofInput('');
    setResult(null);
  };

  return (
    <Card>
      <CardHeader 
        title="Verify Zero-Knowledge Proof"
        subtitle="Verify credential proofs without accessing private data"
        icon={ShieldCheck}
      />
      <CardBody className="space-y-6">
        {!result ? (
          <>
            <TextArea
              label="Paste Proof"
              placeholder="Paste the zero-knowledge proof here..."
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              rows={6}
            />

            <div className="flex items-center justify-center">
              <span className="text-slate-500 text-sm">or</span>
            </div>

            <Button 
              variant="secondary" 
              className="w-full"
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Upload Proof File
            </Button>

            <Alert variant="info">
              Verification confirms the proof is valid and the credential exists on-chain without revealing any private information.
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
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${result.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {result.valid ? 'Proof Valid' : 'Proof Invalid'}
                  </h3>
                  <p className="text-slate-600">
                    {result.valid ? 'This credential proof is valid and on-chain' : 'This proof could not be verified'}
                  </p>
                </div>
              </div>

              {result.valid && (
                <div className="space-y-3 mt-4 pt-4 border-t border-emerald-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Credential Type</p>
                      <p className="text-slate-900 font-medium">{result.credentialType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Issuer</p>
                      <p className="text-slate-900 font-medium">{result.issuer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Issued</p>
                      <p className="text-slate-700">{result.issuedAt}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Expires</p>
                      <p className="text-slate-700">{result.expiresAt}</p>
                    </div>
                  </div>

                  {result.disclosures && Object.keys(result.disclosures).length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 uppercase mb-2">Disclosed Information</p>
                      <div className="space-y-2">
                        {Object.entries(result.disclosures).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Badge variant="info" size="sm">{key}</Badge>
                            <span className="text-slate-900">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button onClick={reset} variant="secondary" className="w-full">
              Verify Another Proof
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
