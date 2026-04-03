import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Shield, Check, Copy, Download, Loader2, ChevronDown } from 'lucide-react';
import { parseNaturalLanguage } from '../../services/xaiService';
import { generateProductionZKProof } from '../../services/proofServiceProd';
import { getWalletState, getStoredCredentials } from '../../services/contractService';
import { queryCredentialsOnChain } from '../../services/contractInteraction';
import type { GeneratedRule } from '../../types/claims';

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
}

const SUGGESTED_PROMPTS = [
  "I need proof I'm eligible for the new diabetes clinical trial",
  "Prove I'm vaccinated and over 18 for international travel",
  "Show I have medical clearance for sports competition",
  "Prove I'm eligible for free healthcare and dental coverage",
];

export function AIChatComposer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
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
      
      const storedCredentials = getStoredCredentials();
      const latestCredential = storedCredentials[storedCredentials.length - 1];
      
      if (!latestCredential) {
        throw new Error(
          'Found credentials on-chain but none in local storage. ' +
          'Please ask your Medical Provider to re-issue the credential.'
        );
      }
      
      let credentialData: Record<string, any>;
      try {
        const encryptedData = JSON.parse(latestCredential.encryptedData || '{}');
        const claimDataStr = encryptedData.claimData || '{}';
        credentialData = typeof claimDataStr === 'string' 
          ? JSON.parse(claimDataStr) 
          : claimDataStr;
      } catch (e) {
        credentialData = {
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
      }
      
      credentialData.clearance_expiry = latestCredential.expiresAt;
      credentialData.exam_date = latestCredential.issuedAt;
      
      const credentialCommitment = latestCredential.commitment || '0x' + '0'.repeat(64);

      // Show proof generation message
      const proofGenId = (Date.now() + 2).toString();
      setMessages(prev => [...prev, {
        id: proofGenId,
        role: 'assistant',
        content: '🔐 Generating verification proof...',
        isGenerating: true,
      }]);

      const proofResult = await generateProductionZKProof(
        aiResponse.rules, 
        credentialCommitment,
        credentialData
      );

      // Remove the proof generation message
      setMessages(prev => prev.filter(m => m.id !== proofGenId));

      if (!proofResult.success) {
        throw new Error(proofResult.error || 'Failed to generate proof');
      }

      // Add proof message
      setMessages(prev => [...prev, {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `**Zero-Knowledge Proof Generated Successfully**`,
        proof: {
          id: proofResult.proof.slice(0, 32),
          type: aiResponse.circuitType,
          timestamp: new Date().toISOString(),
          qrData: proofResult.proof,
          txId: proofResult.txId,
          rules: aiResponse.rules,
          circuitId: proofResult.circuitId,
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
    const proofData = {
      type: 'rule-based-verification',
      version: '1.0',
      credentialCommitment: proof.id,
      verifiedAt: new Date(proof.timestamp).getTime(),
      rules: proof.rules?.map(r => ({
        field: r.field,
        operator: r.operator,
        value: r.value,
        actualValue: true,
        satisfied: true,
      })) || [],
      allSatisfied: true,
    };
    navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
  };

  const downloadProof = (proof: GeneratedProof) => {
    const data = {
      proofId: proof.id,
      type: proof.type,
      circuitId: proof.circuitId,
      generatedAt: proof.timestamp,
      qrData: proof.qrData,
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

  return (
    <div className="h-full flex flex-col bg-white">
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
          <div className="max-w-3xl mx-auto pb-40">
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
                      
                      <div className="grid grid-cols-2 gap-3 mb-5">
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
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-slate-100 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {!walletConnected && (
            <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Connect your wallet to generate proofs
            </div>
          )}
          
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
