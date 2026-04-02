import { UserCircle, Building2, ClipboardCheck } from 'lucide-react';

type Tab = 'user' | 'issuer' | 'verifier';

interface TabNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: 'user' as Tab, label: 'Patient Portal', icon: UserCircle, description: 'Manage your credentials' },
  { id: 'issuer' as Tab, label: 'Medical Provider', icon: Building2, description: 'Issue & manage credentials' },
  { id: 'verifier' as Tab, label: 'Verifier Portal', icon: ClipboardCheck, description: 'Verify credentials' },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="bg-white/50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left
                  ${isActive 
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-500 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                  }
                `}
              >
                <div className={`
                  p-2 rounded-lg transition-colors
                  ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}
                `}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div>
                  <div className={`font-semibold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                    {tab.label}
                  </div>
                  <div className="text-xs text-slate-500">{tab.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
