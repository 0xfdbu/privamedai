import { useState, useEffect } from 'react';
import { CreditCard, Calendar, Shield, Download, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Badge } from '../common';
import { Credential } from '../../types';

export function CredentialWallet() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showEncrypted, setShowEncrypted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem('privamedai_credentials');
    if (stored) {
      try {
        setCredentials(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse credentials:', e);
      }
    }
  }, []);

  const toggleShowEncrypted = (id: string) => {
    setShowEncrypted(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const deleteCredential = (id: string) => {
    const updated = credentials.filter(c => c.id !== id);
    setCredentials(updated);
    localStorage.setItem('privamedai_credentials', JSON.stringify(updated));
  };

  const exportCredentials = () => {
    const blob = new Blob([JSON.stringify(credentials, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privamedai-credentials-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExpired = (expiresAt: number) => expiresAt < Date.now();

  return (
    <Card>
      <CardHeader 
        title="My Credentials"
        subtitle="Your privacy-preserving medical credentials"
        icon={CreditCard}
        action={
          credentials.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCredentials} leftIcon={<Download className="w-4 h-4" />}>
              Export
            </Button>
          )
        }
      />
      <CardBody>
        {credentials.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No Credentials Yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Your credentials will appear here when a medical provider issues them to you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {credentials.map((cred) => (
              <div 
                key={cred.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{cred.claimType}</h4>
                      {cred.isRevoked ? (
                        <Badge variant="error">Revoked</Badge>
                      ) : isExpired(cred.expiresAt) ? (
                        <Badge variant="warning">Expired</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Issuer: {cred.issuer.slice(0, 20)}...</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleShowEncrypted(cred.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showEncrypted[cred.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => deleteCredential(cred.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>Issued: {new Date(cred.issuedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>Expires: {new Date(cred.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {showEncrypted[cred.id] && (
                  <div className="p-3 bg-white rounded border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Encrypted Data (Zero-Knowledge):</p>
                    <code className="text-xs text-slate-600 break-all">{cred.encryptedData}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
