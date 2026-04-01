// QR Code Proof Sharing & Webhook Support
// Enables instant proof verification via QR codes and automated webhooks

import QRCode from 'qrcode';
import { ClaimRule } from '../ai/claimParser';

// ═════════════════════════════════════════════════════════════════════════════
// PROOF PACKAGE FORMAT
// ═════════════════════════════════════════════════════════════════════════════

export interface ProofPackage {
  version: '1.0';
  type: 'zk_proof';
  timestamp: number;
  // Proof data (compact format for QR)
  proof: {
    circuit: string;
    commitment: string;
    result: boolean;
    txHash?: string;
  };
  // Rule that was proven
  rule: {
    id: string;
    description: string;
    resultDescription: string;
  };
  // Optional: verifier-specific data
  verifier?: {
    id: string;
    webhookUrl?: string;
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// QR CODE GENERATION
// ═════════════════════════════════════════════════════════════════════════════

export async function generateQRCode(
  proofPackage: ProofPackage,
  options?: { width?: number; color?: string }
): Promise<string> {
  // Compact the proof for QR code (max ~3000 chars for QR code v40)
  const compactProof = compactProofPackage(proofPackage);
  
  // Generate QR code as data URL
  const dataUrl = await QRCode.toDataURL(compactProof, {
    width: options?.width || 300,
    margin: 2,
    color: {
      dark: options?.color || '#6366f1',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M', // Medium error correction
  });
  
  return dataUrl;
}

export async function generateProofLink(proofPackage: ProofPackage): Promise<string> {
  const compactProof = compactProofPackage(proofPackage);
  // Create a shareable URL with the proof data
  const baseUrl = window.location.origin;
  const encoded = btoa(compactProof).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${baseUrl}/verify?proof=${encoded}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// PROOF COMPACTION / EXPANSION
// For fitting in QR codes and URLs
// ═════════════════════════════════════════════════════════════════════════════

function compactProofPackage(pkg: ProofPackage): string {
  // Minified format: version|type|timestamp|circuit|commitment|result|txHash|ruleId|ruleDesc|resultDesc
  const parts = [
    pkg.version,
    pkg.proof.circuit,
    pkg.proof.commitment,
    pkg.proof.result ? '1' : '0',
    pkg.proof.txHash || '',
    pkg.rule.id,
    encodeURIComponent(pkg.rule.description),
    encodeURIComponent(pkg.rule.resultDescription),
    pkg.timestamp,
  ];
  return parts.join('|');
}

export function parseProofPackage(compact: string): ProofPackage | null {
  try {
    const parts = compact.split('|');
    if (parts.length < 8) return null;
    
    return {
      version: parts[0] as '1.0',
      type: 'zk_proof',
      timestamp: parseInt(parts[8]) || Date.now(),
      proof: {
        circuit: parts[1],
        commitment: parts[2],
        result: parts[3] === '1',
        txHash: parts[4] || undefined,
      },
      rule: {
        id: parts[5],
        description: decodeURIComponent(parts[6]),
        resultDescription: decodeURIComponent(parts[7]),
      },
    };
  } catch (e) {
    return null;
  }
}

export function parseProofFromUrl(encoded: string): ProofPackage | null {
  try {
    // Restore base64 padding
    const padding = 4 - (encoded.length % 4);
    if (padding !== 4) {
      encoded += '='.repeat(padding);
    }
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    
    const compact = atob(encoded);
    return parseProofPackage(compact);
  } catch (e) {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PROOF PACKAGE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildProofPackage(
  rule: ClaimRule,
  commitment: string,
  result: boolean,
  txHash?: string
): ProofPackage {
  return {
    version: '1.0',
    type: 'zk_proof',
    timestamp: Date.now(),
    proof: {
      circuit: rule.circuit,
      commitment,
      result,
      txHash,
    },
    rule: {
      id: rule.id,
      description: rule.description,
      resultDescription: rule.resultDescription,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// WEBHOOK SUPPORT FOR VERIFIERS
// ═════════════════════════════════════════════════════════════════════════════

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  retryCount?: number;
  timeout?: number;
}

export interface WebhookPayload {
  event: 'proof.verified' | 'proof.failed';
  timestamp: number;
  proof: ProofPackage;
  verification: {
    verified: boolean;
    circuit: string;
    commitment: string;
    txHash?: string;
  };
}

export async function sendWebhookNotification(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  const maxRetries = config.retryCount || 3;
  const timeout = config.timeout || 30000;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Attempt': String(attempt + 1),
          ...config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { success: true };
      }
      
      // Retry on 5xx errors
      if (response.status >= 500) {
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }
      
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════════════
// VERIFIER WEBHOOK MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

const WEBHOOK_STORAGE_KEY = 'privamed_webhooks';

export interface StoredWebhook {
  id: string;
  name: string;
  config: WebhookConfig;
  createdAt: number;
  lastUsed?: number;
  callCount: number;
}

export function saveWebhook(name: string, config: WebhookConfig): StoredWebhook {
  const webhooks = getWebhooks();
  const webhook: StoredWebhook = {
    id: generateId(),
    name,
    config,
    createdAt: Date.now(),
    callCount: 0,
  };
  
  webhooks.push(webhook);
  localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(webhooks));
  return webhook;
}

export function getWebhooks(): StoredWebhook[] {
  try {
    const stored = localStorage.getItem(WEBHOOK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function deleteWebhook(id: string): void {
  const webhooks = getWebhooks().filter(w => w.id !== id);
  localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(webhooks));
}

export async function testWebhook(config: WebhookConfig): Promise<{ success: boolean; error?: string }> {
  const testPayload: WebhookPayload = {
    event: 'proof.verified',
    timestamp: Date.now(),
    proof: {
      version: '1.0',
      type: 'zk_proof',
      timestamp: Date.now(),
      proof: {
        circuit: 'test',
        commitment: '0x' + '00'.repeat(32),
        result: true,
      },
      rule: {
        id: 'test',
        description: 'Test webhook',
        resultDescription: 'Test result',
      },
    },
    verification: {
      verified: true,
      circuit: 'test',
      commitment: '0x' + '00'.repeat(32),
    },
  };
  
  return sendWebhookNotification(config, testPayload);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCAN QR CODE (for verifier portal)
// ═════════════════════════════════════════════════════════════════════════════

export async function scanQRCodeFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Would use jsQR library here in production
          // For now, return null - implementation depends on QR scanning library
          resolve(null);
        };
        img.src = e.target?.result as string;
      } catch {
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

// Browser QR scanner using getUserMedia
export async function startQRScanner(
  videoElement: HTMLVideoElement,
  onScan: (result: string) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    videoElement.srcObject = stream;
    videoElement.play();
    
    // In production, use jsQR to scan frames
    // For now, provide cleanup function
    const cleanup = () => {
      stream.getTracks().forEach(track => track.stop());
    };
    
    return cleanup;
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    return () => {};
  }
}
