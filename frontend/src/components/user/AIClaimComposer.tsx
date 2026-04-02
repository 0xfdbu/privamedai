import { useState } from 'react';
import { Sparkles, Wand2, Check, Copy, Shield } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Alert, Badge } from '../common';

interface ParsedRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  description: string;
}

interface AIResult {
  naturalLanguage: string;
  rules: ParsedRule[];
  bundledProof: boolean;
}

export function AIClaimComposer() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [copied, setCopied] = useState(false);

  const examples = [
    "I need proof I'm eligible for the new diabetes clinical trial",
    "Prove I'm vaccinated and over 18 for international travel",
    "Show I have medical clearance for sports competition",
    "Prove I'm eligible for free healthcare and dental coverage",
  ];

  const processInput = async () => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock AI parsing based on keywords
    const lowerInput = input.toLowerCase();
    const rules: ParsedRule[] = [];
    
    if (lowerInput.includes('diabetes') || lowerInput.includes('clinical trial')) {
      rules.push(
        { id: '1', field: 'age', operator: '>=', value: '50', description: 'Age at least 50 years' },
        { id: '2', field: 'has_diabetes_diagnosis', operator: '==', value: 'true', description: 'Has diabetes diagnosis' },
        { id: '3', field: 'vaccinated_last_6_months', operator: '==', value: 'true', description: 'Vaccinated within last 6 months' },
      );
    } else if (lowerInput.includes('vaccinated') || lowerInput.includes('travel')) {
      rules.push(
        { id: '1', field: 'age', operator: '>=', value: '18', description: 'Age at least 18 years' },
        { id: '2', field: 'vaccination_status', operator: '==', value: 'complete', description: 'Vaccination complete' },
      );
    } else if (lowerInput.includes('medical clearance') || lowerInput.includes('sports')) {
      rules.push(
        { id: '1', field: 'medical_clearance', operator: '==', value: 'true', description: 'Medical clearance granted' },
        { id: '2', field: 'clearance_expiry', operator: '>', value: 'today', description: 'Clearance not expired' },
      );
    } else if (lowerInput.includes('healthcare') || lowerInput.includes('coverage')) {
      rules.push(
        { id: '1', field: 'free_healthcare_eligible', operator: '==', value: 'true', description: 'Eligible for free healthcare' },
        { id: '2', field: 'dental_coverage', operator: '==', value: 'true', description: 'Dental coverage included' },
      );
    } else {
      // Default rules
      rules.push(
        { id: '1', field: 'identity_verified', operator: '==', value: 'true', description: 'Identity verified' },
      );
    }
    
    setResult({
      naturalLanguage: input,
      rules,
      bundledProof: rules.length > 1,
    });
    setIsProcessing(false);
  };

  const copyRules = () => {
    if (result) {
      const text = result.rules.map(r => `${r.field} ${r.operator} ${r.value}`).join(' AND ');
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateProof = async () => {
    // Would trigger ZK proof generation
    alert('Generating bundled ZK proof locally... This happens entirely on your device for maximum privacy.');
  };

  return (
    <Card>
      <CardHeader 
        title="AI Claim Composer"
        subtitle="Describe what you need to prove - AI will generate the precise rule"
        icon={Sparkles}
      />
      <CardBody className="space-y-4">
        {!result ? (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                What do you need to prove?
              </label>
              <textarea
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors resize-none"
                rows={3}
                placeholder="e.g., I need proof I'm eligible for the diabetes clinical trial..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase">Examples</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(ex)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                  >
                    {ex.length > 40 ? ex.slice(0, 40) + '...' : ex}
                  </button>
                ))}
              </div>
            </div>

            <Alert variant="info">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Privacy First</p>
                  <p>AI processing happens locally. No data leaves your device.</p>
                </div>
              </div>
            </Alert>

            <Button 
              onClick={processInput}
              isLoading={isProcessing}
              disabled={!input.trim() || isProcessing}
              className="w-full"
              leftIcon={<Wand2 className="w-4 h-4" />}
            >
              {isProcessing ? 'Composing Rules...' : 'Generate Rules'}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h4 className="font-semibold text-emerald-800">Generated Rules</h4>
              </div>
              <p className="text-sm text-emerald-700 mb-4">"{result.naturalLanguage}"</p>
              
              <div className="space-y-2">
                {result.rules.map((rule, index) => (
                  <div key={rule.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-mono text-sm text-slate-700">
                        {rule.field} {rule.operator} {rule.value}
                      </p>
                      <p className="text-xs text-slate-500">{rule.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {result.bundledProof && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs text-amber-700">
                    <strong>Bundled Proof:</strong> All {result.rules.length} conditions will be proven in a single ZK proof.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={copyRules}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied!' : 'Copy Rules'}
              </Button>
              <Button 
                onClick={generateProof}
                leftIcon={<Shield className="w-4 h-4" />}
              >
                Generate ZK Proof
              </Button>
            </div>

            <Button 
              variant="ghost" 
              onClick={() => { setResult(null); setInput(''); }}
              className="w-full"
            >
              Compose New Request
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
