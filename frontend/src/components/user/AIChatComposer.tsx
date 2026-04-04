import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Shield, Check, Copy, Download, Loader2, ChevronDown, AlertCircle } from 'lucide-react';
import { parseNaturalLanguage } from '../../services/xaiService';
import { generateProductionZKProof } from '../../services/proofServiceProd';
import { getWalletState } from '../../services/contractService';
import { queryCredentialsOnChain, checkCredentialOnChain } from '../../services/contractInteraction';
import type { GeneratedRule } from '../../types/claims';

// Credential data interface for patient's stored credentials
interface PatientCredential {
  commitment: string;
  claimType: string;
  claimData: Record<string, any>;
  claimDataBytes: number[];
  issuedAt: number;
  expiresAt: number;
  issuer: string;
  healthClaim?: {
    age: number;
    conditionCode: number;
    prescriptionCode: number;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rules?: GeneratedRule[];
  proof?: GeneratedProof;
  isGenerating?: boolean;
  error?: boolean;
}

interface GeneratedProof {
  id: string;
  type: string;
  timestamp: string;
  qrData: string;
  txId?: string;
  rules: GeneratedRule[];
  circuitId?: string;
  publicInputs?: string; // Required for cryptographic verification
  credentialDataBytes?: number[]; // For on-chain submission
  serializedPreimage?: number[]; // For verification (proof preimage)
}

const SUGGESTED_PROMPTS = [
  "🏥 Prove my age for free clinic eligibility",
  "💊 Prove I have prescription authorization at pharmacy",
  "🏨 Prove my age and condition for hospital treatment",
];

/**
 * Normalize values for comparison - handles type coercion
 * e.g., 'true' (string) === true (boolean)
 * e.g., '50' (string) === 50 (number)
 */
function normalizeValue(value: any): string | number | boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return String(value);
  
  const lower = value.toLowerCase().trim();
  
  // Boolean strings
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  
  // Numeric strings
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  
  // Keep as string
  return value;
}

export function AIChatComposer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [patientCredentials, setPatientCredentials] = useState<PatientCredential[]>([]);
  const [showCredentialImporter, setShowCredentialImporter] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const wallet = getWalletState();
    setWalletConnected(wallet.isConnected);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);

    const userMsgId = Date.now().toString();
    const processingId = (Date.now() + 1).toString();

    // Add user message
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: userMessage,
    }]);

    // Add processing message
    setMessages(prev => [...prev, {
      id: processingId,
      role: 'assistant',
      content: '🤖 Analyzing your request...',
      isGenerating: true,
    }]);

    try {
      // Parse with AI
      const aiResponse = await parseNaturalLanguage(userMessage);

      if (!aiResponse.rules || aiResponse.rules.length === 0) {
        throw new Error('Could not understand your request. Please try describing what you need to prove more clearly.');
      }

      // Update with rules
      setMessages(prev => prev.map(m => 
        m.id === processingId 
          ? {
              ...m,
              content: `I'll generate a ${aiResponse.circuitType} proof for you.`,
              rules: aiResponse.rules,
              isGenerating: false,
            }
          : m
      ));

      // Generate ZK proof
      const wallet = getWalletState();
      const onChainResult = await queryCredentialsOnChain(wallet.address || '');
      
      if (!onChainResult.success || !onChainResult.totalCredentials || onChainResult.totalCredentials === 0n) {
        throw new Error(
          'No credentials found on-chain for your wallet address. ' +
          'Please ask a Medical Provider to issue you a credential first.'
        );
      }
      
      // Check if patient has credentials loaded
      if (patientCredentials.length === 0) {
        setShowCredentialImporter(true);
        throw new Error(
          'No credentials found in your wallet. ' +
          'Please import your credentials first. ' +
          'In a production system, these would be stored in your wallet or fetched from encrypted storage.'
        );
      }
      
      // Find a credential that ACTUALLY SATISFIES the rules
      // AND exists on-chain
      console.log('=== CREDENTIAL SELECTION DEBUG ===');
      console.log(`Rules to satisfy:`, aiResponse.rules);
      console.log(`Total on-chain credentials: ${onChainResult.totalCredentials}`);
      console.log(`Patient credentials (${patientCredentials.length}):`);
      
      let selectedCredential: PatientCredential | null = null;
      let bestMatchScore = 0;
      
      for (let i = 0; i < patientCredentials.length; i++) {
        const cred = patientCredentials[i];
        try {
          const claimData = cred.claimData || {};
          
          console.log(`\n[${i + 1}] Credential: ${cred.claimType}`);
          console.log(`    Commitment: ${(cred.commitment || '').slice(0, 20)}...`);
          console.log(`    Available fields:`, Object.keys(claimData));
          
          // CRITICAL: Check if this credential actually exists on-chain
          if (!cred.commitment) {
            console.log(`    ❌ No commitment - skipping`);
            continue;
          }
          
          const checkResult = await checkCredentialOnChain(cred.commitment);
          if (!checkResult.success || !checkResult.exists) {
            console.log(`    ❌ NOT FOUND on-chain - skipping`);
            console.log(`       Check result:`, checkResult);
            continue;
          }
          console.log(`    ✅ Found on-chain (issuer: ${checkResult.credential?.issuer.slice(0, 16)}...)`);
          
          // Check if credential ACTUALLY SATISFIES ALL rules
          let allRulesSatisfied = true;
          let matchScore = 0;
          
          for (const rule of aiResponse.rules) {
            if (claimData[rule.field] !== undefined) {
              const ruleValue = rule.value;
              const credValue = claimData[rule.field];
              const operator = rule.operator || '==';
              
              // Type-aware comparison - handle string vs boolean/number mismatch
              const normalizedRuleValue = normalizeValue(ruleValue);
              const normalizedCredValue = normalizeValue(credValue);
              
              console.log(`    Rule ${rule.field} ${operator} ${JSON.stringify(ruleValue)}: cred=${JSON.stringify(credValue)}`);
              
              // Use the actual operator for comparison
              let rulePassed = false;
              switch (operator) {
                case '==':
                case '=':
                  rulePassed = normalizedCredValue === normalizedRuleValue;
                  break;
                case '>=':
                  rulePassed = normalizedCredValue >= normalizedRuleValue;
                  break;
                case '>':
                  rulePassed = normalizedCredValue > normalizedRuleValue;
                  break;
                case '<=':
                  rulePassed = normalizedCredValue <= normalizedRuleValue;
                  break;
                case '<':
                  rulePassed = normalizedCredValue < normalizedRuleValue;
                  break;
                case '!=':
                  rulePassed = normalizedCredValue !== normalizedRuleValue;
                  break;
                default:
                  rulePassed = normalizedCredValue === normalizedRuleValue;
              }
              
              if (rulePassed) {
                matchScore += 3;
                console.log(`    ✅ MATCH (${normalizedCredValue} ${operator} ${normalizedRuleValue})`);
              } else {
                console.log(`    ❌ FAIL (${normalizedCredValue} ${operator} ${normalizedRuleValue})`);
                allRulesSatisfied = false;
                break;
              }
            } else {
              console.log(`    ❌ Field '${rule.field}' NOT FOUND in credential`);
              allRulesSatisfied = false;
              break;
            }
          }
          
          if (allRulesSatisfied) {
            console.log(`    ✅ ALL RULES SATISFIED (score: ${matchScore})`);
            if (matchScore > bestMatchScore) {
              bestMatchScore = matchScore;
              selectedCredential = cred;
              console.log(`    -> SELECTED as best match`);
            }
          } else {
            console.log(`    ❌ Some rules not satisfied`);
          }
        } catch (e) {
          console.log(`    ❌ Error parsing credential:`, e);
        }
      }
      
      console.log(`\n=== SELECTION RESULT ===`);
      console.log(`Selected: ${selectedCredential ? selectedCredential.claimType : 'NONE'}`);
      
      // No credential satisfies the rules
      if (!selectedCredential) {
        throw new Error(
          'None of your credentials satisfy the requirements: ' +
          aiResponse.rules.map((r: any) => `${r.field} = ${r.value}`).join(', ') +
          '. Please request a new credential from your Medical Provider that meets these requirements.'
        );
      }
      
      const credentialData = { ...selectedCredential.claimData };
      credentialData.clearance_expiry = selectedCredential.expiresAt;
      credentialData.exam_date = selectedCredential.issuedAt;
      
      if (!selectedCredential.commitment) {
        throw new Error('Selected credential is missing commitment hash');
      }
      const credentialCommitment = selectedCredential.commitment;

      // Extract the ORIGINAL claimData bytes for proof generation
      let claimDataBytes: Uint8Array;
      if (selectedCredential.claimDataBytes && Array.isArray(selectedCredential.claimDataBytes)) {
        claimDataBytes = new Uint8Array(selectedCredential.claimDataBytes);
      } else {
        throw new Error('Credential missing claimDataBytes - cannot generate proof');
      }

      // Determine verifier type and circuit based on rules
      const userMessageLower = userMessage.toLowerCase();
      let verifierType: 'standard' | 'freeHealthClinic' | 'pharmacy' | 'hospital' = 'standard';
      let circuitId: string = 'verifyCredential';
      let selectiveDisclosureParams: { minAge?: number; requiredPrescription?: number; requiredCondition?: number } = {};
      let disclosedFields: string[] = [];
      let privateFields: string[] = ['age', 'conditionCode', 'prescriptionCode'];
      
      // Check if credential has healthClaim for selective disclosure
      const hasHealthClaim = selectedCredential.healthClaim !== undefined;
      console.log('Proof debug - userMessage:', userMessage);
      console.log('Proof debug - selectedCredential.healthClaim:', selectedCredential.healthClaim);
      console.log('Proof debug - hasHealthClaim:', hasHealthClaim);
      
      // Detect verifier type from AI-generated rules (NOT just user message)
      // The rules tell us what circuit we actually need
      const rulesHaveAge = aiResponse.rules.some((r: GeneratedRule) => r.field === 'age');
      const rulesHaveCondition = aiResponse.rules.some((r: GeneratedRule) => r.field === 'conditionCode');
      const rulesHavePrescription = aiResponse.rules.some((r: GeneratedRule) => r.field === 'prescriptionCode');
      
      console.log('Proof debug - rule detection:', { rulesHaveAge, rulesHaveCondition, rulesHavePrescription });
      
      if (hasHealthClaim) {
        // Detect verifier type based on what fields the rules need to prove
        if (rulesHavePrescription) {
          // Pharmacy: proves prescription code match
          verifierType = 'pharmacy';
          circuitId = 'verifyForPharmacy';
          selectiveDisclosureParams.requiredPrescription = selectedCredential.healthClaim!.prescriptionCode;
          disclosedFields = ['prescriptionCode match'];
          privateFields = ['age', 'conditionCode'];
        } else if (rulesHaveAge && rulesHaveCondition) {
          // Hospital: proves age AND condition
          verifierType = 'hospital';
          circuitId = 'verifyForHospital';
          selectiveDisclosureParams.minAge = selectedCredential.healthClaim!.age;
          selectiveDisclosureParams.requiredCondition = selectedCredential.healthClaim!.conditionCode;
          disclosedFields = ['age >= threshold', 'conditionCode match'];
          privateFields = ['actual age value', 'prescriptionCode'];
        } else if (rulesHaveAge) {
          // Free Health Clinic: proves age only
          verifierType = 'freeHealthClinic';
          circuitId = 'verifyForFreeHealthClinic';
          selectiveDisclosureParams.minAge = 18; // Default minimum age
          disclosedFields = ['age >= 18'];
          privateFields = ['actual age', 'conditionCode', 'prescriptionCode'];
        }
      }
      
      console.log('Proof debug - verifierType after detection:', verifierType);
      console.log('Proof debug - circuitId:', circuitId);

      // Show proof generation message with credential info
      const proofGenId = (Date.now() + 2).toString();
      setMessages(prev => [...prev, {
        id: proofGenId,
        role: 'assistant',
        content: `🔐 Generating ${verifierType !== 'standard' ? '**Selective Disclosure**' : ''} proof using: **${selectedCredential.claimType}**...`,
        isGenerating: true,
      }]);

      // Generate proof with selective disclosure if applicable
      const proofOptions: any = {};
      console.log('Proof debug - BEFORE setting proofOptions:', { 
        hasHealthClaim, 
        verifierType, 
        isStandard: verifierType === 'standard',
        healthClaimData: selectedCredential.healthClaim 
      });
      if (hasHealthClaim && verifierType !== 'standard') {
        proofOptions.healthClaim = selectedCredential.healthClaim;
        console.log('Proof debug - healthClaim SET in proofOptions:', proofOptions.healthClaim);
      } else {
        console.log('Proof debug - healthClaim NOT set. Conditions:', { 
          hasHealthClaim, 
          verifierTypeNotStandard: verifierType !== 'standard',
          selectedCredentialHasHealthClaim: !!selectedCredential.healthClaim
        });
      }
      
      console.log('Proof debug - FINAL proofOptions:', { 
        hasHealthClaimKey: 'healthClaim' in proofOptions,
        healthClaimValue: proofOptions.healthClaim,
        proofOptionsKeys: Object.keys(proofOptions) 
      });
      
      const proofResult = await generateProductionZKProof(
        aiResponse.rules, 
        credentialCommitment,
        claimDataBytes,
        proofOptions
      );

      // Remove the proof generation message
      setMessages(prev => prev.filter(m => m.id !== proofGenId));

      if (!proofResult.success) {
        throw new Error(proofResult.error || 'Failed to generate proof');
      }

      // Build selective disclosure message if applicable
      let selectiveDisclosureMessage = '';
      if (verifierType !== 'standard' && hasHealthClaim) {
        selectiveDisclosureMessage = `

🔒 **Selective Disclosure Enabled**
**Verifier Type:** ${verifierType === 'freeHealthClinic' ? '🏥 Free Health Clinic' : verifierType === 'pharmacy' ? '💊 Pharmacy' : '🏨 Hospital'}

📋 **Private Data (Witness):**
• Age: ${selectedCredential.healthClaim!.age}
• Condition Code: ${selectedCredential.healthClaim!.conditionCode}
• Prescription Code: ${selectedCredential.healthClaim!.prescriptionCode}

✅ **Disclosed to Verifier:**
${disclosedFields.map(f => `• ${f}`).join('\n')}

🔐 **Remains Private:**
${privateFields.map(f => `• ${f}`).join('\n')}`;
      }

      // Add proof message
      setMessages(prev => [...prev, {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `**✅ Zero-Knowledge Proof Generated Successfully**${selectiveDisclosureMessage}

**Credential Used:** ${selectedCredential.claimType}
**Issued:** ${new Date(selectedCredential.issuedAt).toLocaleDateString()}`,
        proof: {
          id: proofResult.proof.slice(0, 32),
          type: aiResponse.circuitType,
          timestamp: new Date().toISOString(),
          qrData: proofResult.proof,
          txId: proofResult.txId,
          rules: aiResponse.rules,
          circuitId: circuitId, // Use the selective disclosure circuit
          publicInputs: proofResult.publicInputs,
          credentialDataBytes: Array.from(claimDataBytes),
          serializedPreimage: proofResult.serializedPreimage ? Array.from(proofResult.serializedPreimage) : undefined,
          // Include selective disclosure info
          verifierType: verifierType !== 'standard' ? verifierType : undefined,
          disclosedFields,
          privateFields,
          selectiveDisclosureParams,
          healthClaim: hasHealthClaim ? selectedCredential.healthClaim : undefined,
        },
      }]);
    } catch (error: any) {
      setMessages(prev => prev.map(m => 
        m.id === processingId 
          ? {
              ...m,
              content: error.message || 'Failed to process request',
              isGenerating: false,
              error: true,
            }
          : m
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const copyProof = (proof: GeneratedProof) => {
    // Include all data needed for verification
    const proofData = {
      proofId: proof.id,
      type: proof.type,
      circuitId: proof.circuitId,
      generatedAt: proof.timestamp,
      qrData: proof.qrData,
      serializedPreimage: proof.serializedPreimage, // Required for SNARK verification
      publicInputs: proof.publicInputs, // Required for verification
      credentialDataBytes: proof.credentialDataBytes, // For on-chain submission
      txId: proof.txId,
      rules: proof.rules,
      contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
      network: import.meta.env.VITE_NETWORK_ID || 'preprod',
    };
    navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
  };

  const downloadProof = (proof: GeneratedProof) => {
    // Validate proof data before download
    if (!proof.qrData || proof.qrData.length < 64) {
      console.error('Invalid proof data - qrData is missing or too short:', proof);
      alert('Error: Proof data is incomplete. Please try generating the proof again.');
      return;
    }
    
    const data = {
      proofId: proof.id,
      type: proof.type,
      circuitId: proof.circuitId,
      generatedAt: proof.timestamp,
      qrData: proof.qrData,
      serializedPreimage: proof.serializedPreimage, // Required for SNARK verification
      publicInputs: proof.publicInputs, // Required for cryptographic verification
      credentialDataBytes: proof.credentialDataBytes, // For on-chain submission
      txId: proof.txId,
      rules: proof.rules,
      contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
      network: import.meta.env.VITE_NETWORK_ID || 'preprod',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zk-proof-${proof.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  // Credential Import Handler
  const handleImportCredentials = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      
      // Handle array of credentials
      const credentials = Array.isArray(data) ? data : [data];
      
      const validCredentials: PatientCredential[] = credentials.map((cred: any) => {
        // Parse claimData from encryptedData if needed
        let claimData = cred.claimData;
        if (!claimData && cred.encryptedData) {
          try {
            const parsed = JSON.parse(cred.encryptedData);
            claimData = parsed.claimData || parsed;
          } catch (e) {
            // encryptedData might not be JSON
          }
        }
        
        // Extract healthClaim - either from root or from claimData
        let healthClaim = cred.healthClaim;
        console.log('Import debug - cred.healthClaim:', cred.healthClaim);
        console.log('Import debug - claimData:', claimData);
        if (!healthClaim && claimData) {
          // Try to build healthClaim from claimData fields
          if (claimData.age !== undefined) {
            healthClaim = {
              age: Number(claimData.age),
              conditionCode: Number(claimData.conditionCode || 0),
              prescriptionCode: Number(claimData.prescriptionCode || 0),
            };
            console.log('Import debug - built healthClaim:', healthClaim);
          }
        }
        
        return {
          ...cred,
          claimData: claimData || {},
          healthClaim,
        };
      }).filter((cred: any) => {
        // Must have commitment and either claimDataBytes or be a valid credential
        return cred.commitment && (Array.isArray(cred.claimDataBytes) || cred.claimHash);
      });
      
      if (validCredentials.length === 0) {
        throw new Error('No valid credentials found in file');
      }
      
      setPatientCredentials(validCredentials);
      setShowCredentialImporter(false);
      
      // Add system message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ **${validCredentials.length} credential(s) imported successfully**\n\nYou can now request ZK proofs using these credentials.`,
      }]);
    } catch (error: any) {
      alert('Failed to import credentials: ' + error.message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Credential Importer Modal */}
      {showCredentialImporter && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Import Your Credentials</h3>
                <p className="text-sm text-slate-500">Credentials are stored in your wallet, not on this device</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
              <p className="mb-2">
                In a real deployment, your credentials would be:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Stored in your <strong>Lace wallet</strong> secure storage</li>
                <li>Or fetched from <strong>encrypted cloud storage</strong> tied to your wallet</li>
                <li>Never stored in browser localStorage for security</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Upload Credential File
              </label>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const text = await file.text();
                    handleImportCredentials(text);
                  }
                }}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <p className="text-xs text-slate-400">
                Upload the credential file provided by your Medical Provider
              </p>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowCredentialImporter(false)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {isEmpty ? (
          // Empty state
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-3xl flex items-center justify-center mb-8 shadow-sm">
              <Sparkles className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-semibold text-slate-800 mb-3">
              What do you need to prove?
            </h2>
            <p className="text-slate-500 text-center max-w-lg mb-10 text-lg">
              Describe your verification needs in plain English, and I'll generate a zero-knowledge proof for you.
            </p>
            
            {/* Suggested Prompts */}
            <div className="w-full max-w-2xl grid gap-3">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(prompt)}
                  className="text-left p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all group hover:shadow-sm"
                >
                  <span className="group-hover:text-emerald-700 transition-colors">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages
          <div className="max-w-3xl mx-auto pb-40 pt-10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`py-6 ${message.role === 'user' ? 'bg-slate-50/50' : 'bg-white'}`}
              >
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                  {/* Message Header */}
                  <div className="flex items-center gap-2 mb-3">
                    {message.role === 'user' ? (
                      <span className="text-sm font-medium text-slate-700">You</span>
                    ) : message.error ? (
                      <span className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
                        Error
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">PrivaMed AI</span>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`text-slate-800 leading-relaxed text-base ${message.error ? 'text-red-600 bg-red-50/50 p-4 rounded-xl' : ''}`}>
                    {message.content}
                  </div>

                  {/* Rules Display */}
                  {message.rules && message.rules.length > 0 && (
                    <div className="mt-5 p-5 bg-gradient-to-br from-emerald-50/80 to-emerald-50/40 border border-emerald-100 rounded-2xl">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800">Generated Verification Rules</span>
                      </div>
                      <div className="space-y-2.5">
                        {message.rules.map((rule, ridx) => (
                          <div key={ridx} className="flex items-center gap-3 text-sm bg-white/60 p-2.5 rounded-lg">
                            <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-700 text-xs flex items-center justify-center font-semibold">
                              {ridx + 1}
                            </span>
                            <code className="text-emerald-700 font-mono bg-emerald-100/70 px-2 py-1 rounded text-xs">
                              {rule.field}
                            </code>
                            <span className="text-slate-400 font-medium">{rule.operator}</span>
                            <code className="text-emerald-700 font-mono bg-emerald-100/70 px-2 py-1 rounded text-xs">
                              {rule.value}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proof Display */}
                  {message.proof && (
                    <div className="mt-5 p-6 bg-gradient-to-br from-emerald-50/60 to-white border border-emerald-200 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center shadow-sm">
                          <Check className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-emerald-900">Zero-Knowledge Proof Ready</h4>
                          <p className="text-xs text-emerald-600">Verified on Midnight network</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm">
                          <span className="text-slate-400 text-xs uppercase tracking-wide">Proof Type</span>
                          <p className="font-medium text-slate-700 capitalize mt-0.5">{message.proof.type}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm">
                          <span className="text-slate-400 text-xs uppercase tracking-wide">Circuit</span>
                          <p className="font-medium text-slate-700 font-mono text-xs mt-0.5 truncate">{message.proof.circuitId}</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => copyProof(message.proof!)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors text-sm font-medium shadow-sm"
                        >
                          <Copy className="w-4 h-4" />
                          Copy for Verifier
                        </button>
                        <button 
                          onClick={() => downloadProof(message.proof!)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {message.isGenerating && (
                    <div className="mt-3 flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Processing your request...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-36 right-8 p-3 bg-white border border-slate-200 hover:border-emerald-400 text-slate-600 hover:text-emerald-600 rounded-full shadow-lg transition-all z-10"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-slate-100 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Status Bar */}
          <div className="flex gap-2 mb-3">
            {!walletConnected ? (
              <div className="flex-1 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Connect your wallet to generate proofs
              </div>
            ) : patientCredentials.length === 0 ? (
              <button
                onClick={() => setShowCredentialImporter(true)}
                className="flex-1 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2 hover:bg-amber-100 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                Import your credentials to generate proofs
              </button>
            ) : (
              <button
                onClick={() => setShowCredentialImporter(true)}
                className="flex-1 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
              >
                <Shield className="w-4 h-4" />
                {patientCredentials.length} credential(s) loaded • Click to manage
              </button>
            )}
          </div>
          
          <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isEmpty ? "Describe what you need to prove..." : "Continue the conversation..."}
              className="flex-1 bg-transparent border-0 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 resize-none min-h-[24px] max-h-[200px] py-1.5 px-2"
              rows={1}
              disabled={isProcessing}
            />
            
            {/* Send Button - Fixed styling */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className={`
                flex items-center justify-center w-10 h-10 rounded-xl transition-all
                ${input.trim() && !isProcessing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-sans">Enter</kbd> to send • 
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-sans">Shift</kbd> + 
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-sans">Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  );
}
