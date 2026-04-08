import { Sparkles, ArrowRight, UserCircle, Stethoscope, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletButton } from './layout/WalletButton';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                PrivaMedAI
              </span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 py-20 sm:py-32">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100/50 rounded-full border border-emerald-200">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">Midnight Preprod</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight">
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              PrivaMedAI
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-slate-600 max-w-2xl mx-auto">
            Privacy-preserving medical credentials with zero-knowledge proofs on the Midnight blockchain.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/patient/ai"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25"
            >
              <Sparkles className="w-5 h-5" />
              Launch App
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <UserCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Patient</h3>
            <p className="text-slate-600">
              Generate zero-knowledge proofs to prove your medical credentials without revealing sensitive data.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
              <Stethoscope className="w-6 h-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Medical Provider</h3>
            <p className="text-slate-600">
              Issue verifiable medical credentials to patients. Register as an issuer and manage credentials.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Verifier</h3>
            <p className="text-slate-600">
              Verify zero-knowledge proofs on-chain. Confirm validity without accessing private health data.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">How It Works</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Medical Provider Issues Credential', desc: 'Provider creates a credential with patient health data, stored as a cryptographic commitment on-chain.' },
            { step: '2', title: 'Patient Generates ZK Proof', desc: 'Using AI, patient describes what they need to prove. A zero-knowledge proof is generated without revealing actual values.' },
            { step: '3', title: 'Verifier Confirms on Blockchain', desc: 'Verifier submits proof to the Midnight network. The SNARK is verified, confirming validity without learning private data.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-4 border border-slate-200/50">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-emerald-600">{item.step}</span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="text-slate-600 text-sm mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>PrivaMedAI - Zero-Knowledge Medical Credentials on Midnight</p>
        </div>
      </div>
    </div>
  );
}