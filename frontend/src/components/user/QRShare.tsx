import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check, Download, Link2, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Badge, Alert } from '../common';
import { getStoredCredentials, getWalletState } from '../../services/contractService';
import { generateProductionZKProof } from '../../services/proofServiceProd';
import type { HealthClaim } from '../../types/claims';

interface ProofData {
  proof: string;
  txId: string;
  circuitId: string;
  timestamp: string;
  credentialType: string;
}

export function QRShare() {
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    const credentials = getStoredCredentials();
    setHasCredentials(credentials.length > 0);
    const wallet = getWalletState();
    setWalletConnected(wallet.isConnected);
  }, []);

  const generateProof = async () => {
    setError(null);
    setIsGenerating(true);
    
    try {
      const credentials = getStoredCredentials();
      if (credentials.length === 0) {
        throw new Error('No credentials found. Please issue a credential first.');
      }

      // Get the most recent credential
      const latestCredential = credentials[credentials.length - 1];
      
      if (!latestCredential.commitment || !latestCredential.claimHash) {
        throw new Error('Credential is missing required data (commitment or claimHash)');
      }

      // Get claimDataBytes from the credential
      let claimDataBytes: Uint8Array;
      if (latestCredential.claimDataBytes && Array.isArray(latestCredential.claimDataBytes)) {
        claimDataBytes = new Uint8Array(latestCredential.claimDataBytes);
      } else {
        // Fallback: encode encryptedData to bytes
        const encoder = new TextEncoder();
        claimDataBytes = new Uint8Array(32);
        claimDataBytes.set(encoder.encode(latestCredential.encryptedData || '').slice(0, 32));
      }

      // Prepare health claim for selective disclosure if available
      const proofOptions: any = {};
      if (latestCredential.healthClaim) {
        proofOptions.healthClaim = latestCredential.healthClaim as HealthClaim;
      }

      // Generate the actual ZK proof
      const proofResult = await generateProductionZKProof(
        [{ field: 'type', operator: '==', value: latestCredential.claimType, description: 'Credential type verification' }],
        latestCredential.commitment,
        claimDataBytes,
        proofOptions
      );

      if (!proofResult.success) {
        throw new Error(proofResult.error || 'Failed to generate proof');
      }

      // Create proof data
      const realProofData: ProofData = {
        proof: proofResult.proof,
        txId: proofResult.txId || '',
        circuitId: proofResult.circuitId || 'verifyCredential',
        timestamp: new Date().toISOString(),
        credentialType: latestCredential.claimType,
      };
      
      setProofData(realProofData);
      
      // Create shareable QR data (proof hash + commitment)
      const qrPayload = JSON.stringify({
        proof: proofResult.proof.slice(0, 100), // Truncated for QR size
        commitment: latestCredential.commitment,
        circuitId: proofResult.circuitId,
        timestamp: realProofData.timestamp,
      });
      
      setGeneratedQR(qrPayload);
      setShareLink(`${window.location.origin}/verify?proof=${latestCredential.commitment.slice(2, 34)}`);
      
    } catch (err: any) {
      setError(err.message || 'Failed to generate proof');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadProof = () => {
    if (!proofData) return;
    
    const data = {
      proofId: proofData.proof.slice(0, 32),
      type: proofData.credentialType,
      circuitId: proofData.circuitId,
      generatedAt: proofData.timestamp,
      qrData: proofData.proof,
      txId: proofData.txId,
      contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
      network: import.meta.env.VITE_NETWORK_ID || 'preprod',
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zk-proof-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadQR = () => {
    const svg = document.querySelector('#proof-qr-code svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `privamed-proof-${Date.now()}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  return (
    <Card>
      <CardHeader 
        title="Share ZK Proof"
        subtitle="Generate a QR code or shareable link for instant verification"
        icon={Share2}
      />
      <CardBody className="space-y-4">
        {!walletConnected && (
          <Alert variant="warning">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Please connect your wallet to generate proofs.
            </div>
          </Alert>
        )}
        
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </Alert>
        )}
        
        {!generatedQR ? (
          <>
            <Alert variant="info">
              Generate a zero-knowledge proof QR code that verifiers can scan to instantly 
              verify your credential without accessing your private data.
            </Alert>
            
            {!hasCredentials && (
              <Alert variant="warning">
                No credentials found. Please issue a credential first using the Issuer Portal.
              </Alert>
            )}
            
            <Button 
              onClick={generateProof}
              className="w-full"
              disabled={!hasCredentials || !walletConnected || isGenerating}
              isLoading={isGenerating}
              leftIcon={isGenerating ? undefined : <Sparkles className="w-4 h-4" />}
            >
              {isGenerating ? 'Generating ZK Proof...' : 'Generate ZK Proof QR'}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div id="proof-qr-code" className="p-4 bg-white rounded-xl border-2 border-slate-200">
                <QRCodeSVG 
                  value={generatedQR}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">Scan to verify instantly</p>
            </div>

            {proofData && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Proof Details</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Circuit:</span>
                    <span className="font-mono text-slate-700">{proofData.circuitId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Credential:</span>
                    <span className="text-slate-700">{proofData.credentialType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Generated:</span>
                    <span className="text-slate-700">{new Date(proofData.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Share Link</span>
              </div>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-white px-3 py-2 rounded border border-slate-200 text-slate-600 truncate">
                  {shareLink}
                </code>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={copyLink}
                  leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={downloadQR}
                className="flex-1"
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download QR
              </Button>
              <Button 
                variant="secondary" 
                onClick={downloadProof}
                className="flex-1"
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Proof
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge variant="success">Zero-Knowledge</Badge>
              <Badge variant="info">Privacy-Preserving</Badge>
            </div>

            <Button 
              variant="ghost" 
              onClick={() => { 
                setGeneratedQR(null); 
                setShareLink(null); 
                setProofData(null);
                setError(null);
              }}
              className="w-full"
            >
              Generate New Proof
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
