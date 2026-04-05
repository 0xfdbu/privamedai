import { CreditCard, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../common';

export function CredentialWallet() {
  return (
    <Card>
      <CardHeader 
        title="My Credentials"
        subtitle="Your privacy-preserving medical credentials"
        icon={CreditCard}
      />
      <CardBody>
        <div className="text-center py-12">
          <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Privately Handled</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your medical credentials are handed over to you privately by your healthcare provider. 
            Contact your healthcare provider for a credential file.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
