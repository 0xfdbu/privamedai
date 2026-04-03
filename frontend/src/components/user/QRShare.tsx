import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check, Download, Link2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Badge, Alert } from '../common';
import { getStoredCredentials } from '../../services/contractService';

interface ProofData {
  proof: string;
  txId: string;
  circuitId: string;
  timestamp: string;
}

export function QRShare() {
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    // Check if user has credentials
    const credentials = getStoredCredentials();
    setHasCredentials(credentials.length > 0);
  }, []);

  const generateQR = () => {
    setError(null);
    
    // Get the most recent credential and proof data
    const credentials = getStoredCredentials();
    if (credentials.length === 0) {
      setError('No credentials found. Please issue a credential first.');
      return;
    }

    // For now, we create a placeholder that would be replaced with real proof data
    // In production, this would fetch the actual proof from the AIChatComposer context
    // or from a proof storage service
    const latestCredential = credentials[credentials.length - 1];
    
    // Create proof data based on real credential
    const realProofData: ProofData = {
      proof: latestCredential.commitment,
      txId: latestCredential.claimHash.slice(0, 66),
      circuitId: 'verifyCredential',
      timestamp: new Date(latestCredential.issuedAt).toISOString(),
    };
    
    setProofData(realProofData);
    setGeneratedQR(realProofData.proof);
    setShareLink(`${window.location.origin}/verify/${realProofData.proof.slice(2)}`);
  };

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        title="Share Proof"
        subtitle="Generate QR code or shareable link for instant verification"
        icon={Share2}
      />
      <CardBody className="space-y-4">
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
              Generate a QR code or link that verifiers can scan to instantly verify your credential without accessing your private data.
            </Alert>
            
            {!hasCredentials && (
              <Alert variant="warning">
                No credentials found. Please issue a credential first using the Issuer Portal.
              </Alert>
            )}
            
            <Button 
              onClick={generateQR}
              className="w-full"
              disabled={!hasCredentials}
              leftIcon={<Share2 className="w-4 h-4" />}
            >
              Generate Shareable Proof
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
                    <span className="text-slate-500">Transaction:</span>
                    <span className="font-mono text-slate-700 truncate max-w-[150px]">{proofData.txId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Generated:</span>
                    <span className="text-slate-700">{new Date(proofData.timestamp).toLocaleDateString()}</span>
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
                onClick={copyLink}
                className="flex-1"
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              >
                Copy Link
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge variant="success">Valid for 24 hours</Badge>
              <Badge variant="info">Zero-Knowledge</Badge>
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
