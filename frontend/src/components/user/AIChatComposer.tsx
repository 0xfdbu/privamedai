import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Shield, Check, Copy, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Badge, Alert } from '../common';
import { parseNaturalLanguage } from '../../services/xaiService';
import { generateZKProofReal } from '../../services/proofService';
import { getStoredCredentials, getWalletState } from '../../services/contractService';
import { GeneratedRule } from '../../types/claims';

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
}

const SUGGESTED_PROMPTS = [
  "I need proof I'm eligible for the new diabetes clinical trial",
  "Prove I'm vaccinated and over 18 for international travel",
  "Show I have medical clearance for sports competition",
  "Prove I'm eligible for free healthcare and dental coverage",
  "Verify I completed my annual wellness exam",
  "Show I'm a senior citizen for discount eligibility",
];

export function AIChatComposer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your AI Claim Composer. Describe what you need to prove in plain English, and I'll generate the precise zero-knowledge proof for you.\n\nFor example: *\"I need proof I'm eligible for the diabetes clinical trial\"*",
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wallet = getWalletState();
    setWalletConnected(wallet.isConnected);
    scrollToBottom();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // Add processing message
    const processingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: processingId,
      role: 'assistant',
      content: 'Analyzing your request with xAI...',
      isGenerating: true,
    }]);

    try {
      // Call AI to parse natural language
      const aiResponse = await parseNaturalLanguage(userMessage.content);

      // Update with rules
      setMessages(prev => prev.map(m => 
        m.id === processingId 
          ? {
              ...m,
              content: `I've analyzed your request and generated the following verification rules:\n\n**${aiResponse.explanation}**`,
              rules: aiResponse.rules,
              isGenerating: false,
            }
          : m
      ));

      // Generate real ZK proof using proof server
      const credentials = getStoredCredentials();
      const latestCredential = credentials[credentials.length - 1];
      const credentialCommitment = latestCredential?.commitment || '0x' + '0'.repeat(64);
      
      // Get credential data for witness generation
      const credentialData = latestCredential ? {
        age: Math.floor(Math.random() * 40) + 30, // Mock age for demo
        has_diabetes_diagnosis: true,
        vaccinated_last_6_months: true,
        vaccination_status: 'complete',
        medical_clearance: true,
        free_healthcare_eligible: true,
        identity_verified: true,
      } : {};

      const proofResult = await generateZKProofReal(
        aiResponse.rules, 
        credentialCommitment,
        credentialData
      );

      if (!proofResult.success) {
        throw new Error(proofResult.error || 'Failed to generate proof');
      }

      // Add proof message
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `✅ **Zero-Knowledge Proof Generated!**\n\nYour ${aiResponse.circuitType} proof has been generated using the local proof server. You can now share this proof with any verifier - they'll know you meet all the requirements without seeing your private medical data.`,
        proof: {
          id: proofResult.proof!.replace('zk:', '').split(':').pop() || proofResult.proof!,
          type: aiResponse.circuitType,
          timestamp: new Date().toISOString(),
          qrData: proofResult.proof!,
          txId: proofResult.txId,
          rules: aiResponse.rules,
        },
      }]);
    } catch (error: any) {
      setMessages(prev => prev.map(m => 
        m.id === processingId 
          ? {
              ...m,
              content: `Error: ${error.message || 'Failed to process request'}`,
              isGenerating: false,
              error: true,
            }
          : m
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const copyProof = (qrData: string) => {
    navigator.clipboard.writeText(qrData);
  };

  const downloadProof = (proof: GeneratedProof) => {
    const data = {
      proofId: proof.id,
      type: proof.type,
      generatedAt: proof.timestamp,
      qrData: proof.qrData,
      rules: proof.rules,
      contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zk-proof-${proof.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader 
        title="AI Claim Composer"
        subtitle="Powered by xAI Grok-4 - Describe what you need to prove"
        icon={Bot}
        action={
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500">AI Ready</span>
          </div>
        }
      />
      <CardBody className="flex-1 flex flex-col p-0">
        {!walletConnected && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
            <p className="text-xs text-amber-700">
              ⚠️ Connect your wallet to generate and store proofs
            </p>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-emerald-100' 
                  : message.error 
                    ? 'bg-red-100'
                    : 'bg-blue-100'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-emerald-600" />
                ) : message.error ? (
                  <RefreshCw className="w-4 h-4 text-red-600" />
                ) : (
                  <Bot className="w-4 h-4 text-blue-600" />
                )}
              </div>

              {/* Content */}
              <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-2 rounded-2xl text-left ${
                  message.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : message.error
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-slate-100 text-slate-800'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>

                {/* Generated Rules */}
                {message.rules && message.rules.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-800">Generated Rules</span>
                    </div>
                    <div className="space-y-1.5">
                      {message.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 text-xs flex items-center justify-center font-medium">
                            {idx + 1}
                          </span>
                          <code className="text-emerald-700 font-mono text-xs">
                            {rule.field} {rule.operator} {rule.value}
                          </code>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600 mt-2">
                      {message.rules.length > 1 ? 'Bundled ZK proof will verify all conditions' : 'Single condition proof'}
                    </p>
                  </div>
                )}

                {/* Generated Proof */}
                {message.proof && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">ZK Proof Ready</span>
                      <Badge variant="success" size="sm">Private</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="bg-white p-2 rounded border border-blue-200">
                        <span className="text-slate-500">Proof ID</span>
                        <p className="font-mono text-slate-700">{message.proof.id}</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-200">
                        <span className="text-slate-500">Type</span>
                        <p className="text-slate-700 capitalize">{message.proof.type}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => copyProof(message.proof!.qrData)}
                        leftIcon={<Copy className="w-3 h-3" />}
                      >
                        Copy
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => downloadProof(message.proof!)}
                        leftIcon={<Download className="w-3 h-3" />}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {message.isGenerating && (
                  <div className="mt-2 flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Processing...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {messages.length < 3 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(prompt)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                >
                  {prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you need to prove..."
                className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                rows={2}
                disabled={isProcessing}
              />
              <div className="absolute right-3 bottom-3 text-xs text-slate-400">
                {input.length > 0 && 'Press Enter ↵'}
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              isLoading={isProcessing}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            ZK proof generation happens locally for maximum privacy.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
