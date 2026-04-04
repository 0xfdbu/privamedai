import { X, Stethoscope, Pill, Search } from 'lucide-react';
import { useState } from 'react';
import { CONDITION_CODES, PRESCRIPTION_CODES } from '../../constants/medicalCodes';

interface CodeMappingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CodeMappingsModal({ isOpen, onClose }: CodeMappingsModalProps) {
  const [activeTab, setActiveTab] = useState<'conditions' | 'prescriptions'>('conditions');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const codes = activeTab === 'conditions' ? CONDITION_CODES : PRESCRIPTION_CODES;
  const filteredCodes = codes.filter(
    c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toString().includes(searchQuery) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                {activeTab === 'conditions' ? (
                  <Stethoscope className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Pill className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Medical Code Mappings</h3>
                <p className="text-sm text-slate-500">
                  Reference guide for condition and prescription codes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('conditions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'conditions'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Conditions ({CONDITION_CODES.length})
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'prescriptions'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Prescriptions ({PRESCRIPTION_CODES.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredCodes.map((item) => (
              <div
                key={item.code}
                className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-emerald-600">
                        {item.code}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 rounded text-xs text-slate-600">
                        {item.category}
                      </span>
                    </div>
                    <h4 className="font-medium text-slate-900">{item.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredCodes.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No {activeTab} found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
            These are example codes for demonstration. Production systems would use standardized coding systems like ICD-10 or NDC.
          </p>
        </div>
      </div>
    </div>
  );
}
