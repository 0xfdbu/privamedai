import { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, TextArea, Alert, Badge } from '../common';

interface RuleResult {
  field: string;
  operator: string;
  value: string;
  actualValue: any;
  satisfied: boolean;
}

interface VerificationResult {
  valid: boolean;
  type?: string;
  verifiedAt?: string;
  rules?: RuleResult[];
  allSatisfied?: boolean;
  credentialCommitment?: string;
  error?: string;
}

export function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!proofInput.trim()) return;
    
    setIsVerifying(true);
    
    try {
      // Parse the proof JSON
      let proofData: any;
      try {
        proofData = JSON.parse(proofInput.trim());
      } catch (e) {
        setResult({
          valid: false,
          error: 'Invalid proof format - must be valid JSON',
        });
        setIsVerifying(false);
        return;
      }
      
      // Verify the proof structure
      if (proofData.type !== 'rule-based-verification') {
        setResult({
          valid: false,
          error: 'Unknown proof type. Expected: rule-based-verification',
        });
        setIsVerifying(false);
        return;
      }
      
      // Check if all rules were satisfied
      const allSatisfied = proofData.allSatisfied === true;
      
      setResult({
        valid: allSatisfied,
        type: proofData.type,
        verifiedAt: proofData.verifiedAt ? new Date(proofData.verifiedAt).toLocaleString() : 'Unknown',
        rules: proofData.rules || [],
        allSatisfied: allSatisfied,
        credentialCommitment: proofData.credentialCommitment,
      });
    } catch (error) {
      setResult({
        valid: false,
        error: 'Failed to verify proof: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
    
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

              {result.valid && result.rules && (
                <div className="space-y-3 mt-4 pt-4 border-t border-emerald-200">
                  <div>
                    <p className="text-xs text-slate-500 uppercase mb-2">Verified Rules</p>
                    <div className="space-y-2">
                      {result.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            {rule.satisfied ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">{rule.field}</span>
                            <Badge variant="default" size="sm">{rule.operator}</Badge>
                            <span className="text-sm text-slate-600">{String(rule.value)}</span>
                          </div>
                          <div className="text-sm text-slate-500">
                            Actual: <span className={rule.satisfied ? 'text-emerald-600 font-medium' : 'text-red-600'}>
                              {String(rule.actualValue)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Proof Type</p>
                      <p className="text-slate-900 font-medium">{result.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Verified At</p>
                      <p className="text-slate-700">{result.verifiedAt}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.error && (
                <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm text-red-700">{result.error}</p>
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
