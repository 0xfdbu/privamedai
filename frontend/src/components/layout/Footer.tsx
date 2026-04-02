export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-500 text-sm">
            PrivaMedAI - Privacy-Preserving Medical Credentials
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>Contract: <code className="text-slate-600 bg-slate-100 px-2 py-1 rounded">3bbe...cf46</code></span>
            <span>•</span>
            <span>ZK Proofs Enabled</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
