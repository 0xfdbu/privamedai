import React, { useState } from 'react';
import QRCode from 'qrcode';
import { 
  parseClaimPattern, 
  suggestSimilarClaims, 
  buildCustomAgeRule,
  PRESET_CLAIMS,
  CATEGORY_INFO,
  type ClaimRule,
  type ClaimParameter,
  type CircuitName 
} from '../ai/claimParser';
import { buildProofPackage, generateQRCode, generateProofLink } from '../utils/proofSharing';
import type { StoredCredential } from '../utils/credentialWallet';

interface AIClaimComposerProps {
  credentials: StoredCredential[];
  onGenerateProof: (rule: ClaimRule, credential: StoredCredential) => Promise<{ success: boolean; txHash?: string; result?: boolean }>;
}

export const AIClaimComposer: React.FC<AIClaimComposerProps> = ({ credentials, onGenerateProof }) => {
  const [input, setInput] = useState('');
  const [selectedRule, setSelectedRule] = useState<ClaimRule | null>(null);
  const [selectedCredential, setSelectedCredential] = useState<StoredCredential | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [suggestions, setSuggestions] = useState<ClaimRule[]>([]);
  
  // Proof result
  const [proofResult, setProofResult] = useState<{
    success: boolean;
    txHash?: string;
    result?: boolean;
    qrCode?: string;
    link?: string;
  } | null>(null);

  const handleCompose = async () => {
    if (!input.trim()) return;
    
    // Try pattern matching
    const rule = parseClaimPattern(input);
    
    if (rule) {
      setSelectedRule(rule);
      setSuggestions([]);
      // Auto-select first compatible credential
      const compatible = credentials.find(c => 
        rule.requiredCredentials.some(rc => 
          c.metadata.name.toLowerCase().includes(rc.toLowerCase())
        )
      );
      if (compatible) setSelectedCredential(compatible);
    } else {
      const similar = suggestSimilarClaims(input);
      setSuggestions(similar);
      setSelectedRule(null);
    }
  };

  const handleUsePreset = (rule: ClaimRule) => {
    setInput(rule.description);
    setSelectedRule(rule);
    setSuggestions([]);
    setShowPresets(false);
    setProofResult(null);
    
    const compatible = credentials.find(c => 
      rule.requiredCredentials.some(rc => 
        c.metadata.name.toLowerCase().includes(rc.toLowerCase())
      )
    );
    if (compatible) setSelectedCredential(compatible);
  };

  const handleGenerateProof = async () => {
    if (!selectedRule || !selectedCredential) return;
    
    setIsGenerating(true);
    setProofResult(null);
    
    try {
      const outcome = await onGenerateProof(selectedRule, selectedCredential);
      
      if (outcome.success) {
        // Build proof package for sharing
        const proofPackage = buildProofPackage(
          selectedRule,
          selectedCredential.commitment,
          outcome.result || false,
          outcome.txHash
        );
        
        // Generate QR and link
        const [qrCode, link] = await Promise.all([
          generateQRCode(proofPackage, { width: 250, color: '#10b981' }),
          generateProofLink(proofPackage),
        ]);
        
        setProofResult({
          ...outcome,
          qrCode,
          link,
        });
      } else {
        setProofResult({ success: false });
      }
    } catch (error) {
      setProofResult({ success: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (proofResult?.link) {
      navigator.clipboard.writeText(proofResult.link);
    }
  };

  const allPresets = Object.values(PRESET_CLAIMS);
  const categories = [...new Set(allPresets.map(p => p.category))];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: '16px',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        }}>🤖</div>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>AI Claim Composer</h3>
          <p style={{ margin: 0, color: 'rgba(248,250,252,0.5)', fontSize: '13px' }}>
            Natural language → ZK proof • 100% Private
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div style={{ marginBottom: '16px' }}>
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setProofResult(null);
          }}
          placeholder="Describe what you need to prove... e.g., 'I need to show I'm eligible for the diabetes clinical trial'"
          style={{
            width: '100%',
            padding: '16px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '12px',
            color: '#f8fafc',
            fontSize: '15px',
            minHeight: '90px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={handleCompose}
          disabled={!input.trim()}
          style={{
            flex: 1,
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: !input.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            opacity: !input.trim() ? 0.6 : 1,
          }}
        >
          ✨ Compose Rule
        </button>
        <button
          onClick={() => setShowPresets(!showPresets)}
          style={{
            padding: '12px 16px',
            background: 'rgba(139,92,246,0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          📋 Presets
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !selectedRule && (
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <p style={{ margin: '0 0 12px 0', color: '#fbbf24', fontSize: '14px' }}>
            Did you mean:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.map((rule) => (
              <button
                key={rule.id}
                onClick={() => handleUsePreset(rule)}
                style={{
                  padding: '12px',
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: '8px',
                  color: '#fbbf24',
                  fontSize: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {CATEGORY_INFO[rule.category]?.icon} {rule.description}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Presets Panel */}
      {showPresets && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          maxHeight: '350px',
          overflow: 'auto',
        }}>
          {categories.map((category) => (
            <div key={category} style={{ marginBottom: '16px' }}>
              <p style={{ 
                margin: '0 0 10px 0', 
                color: CATEGORY_INFO[category]?.color || '#888',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 600,
              }}>
                {CATEGORY_INFO[category]?.icon} {CATEGORY_INFO[category]?.label || category}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allPresets
                  .filter(p => p.category === category)
                  .map((rule) => (
                    <button
                      key={rule.id}
                      onClick={() => handleUsePreset(rule)}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '8px',
                        color: '#c4b5fd',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {rule.description}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Rule Display */}
      {selectedRule && (
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>{CATEGORY_INFO[selectedRule.category]?.icon}</span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '16px' }}>
                {selectedRule.description}
              </h4>
              <p style={{ margin: 0, color: 'rgba(248,250,252,0.6)', fontSize: '13px' }}>
                {selectedRule.naturalLanguage}
              </p>
            </div>
            <span style={{ 
              padding: '4px 10px',
              background: 'rgba(16,185,129,0.2)',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#10b981',
              fontWeight: 600,
            }}>
              {selectedRule.privacyLevel} privacy
            </span>
          </div>

          {/* Circuit Info */}
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <code style={{ color: '#a78bfa', fontSize: '13px' }}>
              {selectedRule.compactRule}
            </code>
          </div>

          {/* Privacy Note */}
          <div style={{
            background: 'rgba(99,102,241,0.1)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <p style={{ margin: 0, color: '#c4b5fd', fontSize: '13px' }}>
              🔒 <strong>Zero-Knowledge:</strong> {selectedRule.resultDescription}
            </p>
          </div>

          {/* Credential Selection */}
          {credentials.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'rgba(248,250,252,0.7)', fontSize: '13px', marginBottom: '8px' }}>
                Select Credential to Prove:
              </label>
              <select
                value={selectedCredential?.id || ''}
                onChange={(e) => {
                  const cred = credentials.find(c => c.id === e.target.value);
                  setSelectedCredential(cred || null);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '14px',
                }}
              >
                <option value="">-- Select a credential --</option>
                {credentials.map(cred => (
                  <option key={cred.id} value={cred.id}>
                    {cred.metadata.name} (expires {new Date(cred.expiry).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerateProof}
            disabled={isGenerating || !selectedCredential}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: selectedCredential ? '#10b981' : 'rgba(16,185,129,0.3)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: selectedCredential ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isGenerating ? (
              <>
                <span className="spinner" /> Generating ZK Proof...
              </>
            ) : (
              <>🔒 Generate Zero-Knowledge Proof</>
            )}
          </button>
        </div>
      )}

      {/* Proof Result */}
      {proofResult && (
        <div style={{
          background: proofResult.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${proofResult.success ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: proofResult.success ? '16px' : 0,
          }}>
            <span style={{ fontSize: '32px' }}>
              {proofResult.success ? (proofResult.result ? '✅' : '❌') : '⚠️'}
            </span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '16px' }}>
                {proofResult.success 
                  ? (proofResult.result ? 'Proof Verified!' : 'Proof Generated (Not Eligible)')
                  : 'Proof Generation Failed'
                }
              </h4>
              <p style={{ margin: 0, color: 'rgba(248,250,252,0.6)', fontSize: '13px' }}>
                {proofResult.success 
                  ? `Tx: ${proofResult.txHash?.slice(0, 20)}...`
                  : 'Please check your credential and try again'
                }
              </p>
            </div>
          </div>

          {proofResult.success && (
            <>
              {/* QR Code */}
              {proofResult.qrCode && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img 
                    src={proofResult.qrCode} 
                    alt="Proof QR Code"
                    style={{ 
                      maxWidth: '200px',
                      borderRadius: '8px',
                      background: 'white',
                      padding: '8px',
                    }}
                  />
                  <p style={{ margin: '8px 0 0 0', color: 'rgba(248,250,252,0.5)', fontSize: '12px' }}>
                    Scan to verify instantly
                  </p>
                </div>
              )}

              {/* Share Link */}
              {proofResult.link && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={proofResult.link}
                    readOnly
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={handleCopyLink}
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(16,185,129,0.2)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '8px',
                      color: '#10b981',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p style={{ 
        margin: 0, 
        color: 'rgba(248,250,252,0.4)', 
        fontSize: '12px',
        textAlign: 'center',
      }}>
        💡 Fully offline-capable • No data leaves your device • ZK proofs verify without revealing health data
      </p>
    </div>
  );
};

export default AIClaimComposer;
