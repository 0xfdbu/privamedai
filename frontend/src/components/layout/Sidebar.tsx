/**
 * Sidebar Component
 * Navigation sidebar with portal switching
 */

import React from 'react';
import { PortalType } from '../../types';
import { IconHospital, IconUser, IconShield, IconArrowRight } from '../icons';

interface NavItem {
  id: PortalType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface SidebarProps {
  activePortal: PortalType;
  onPortalChange: (portal: PortalType) => void;
}

const navItems: NavItem[] = [
  {
    id: 'issuer',
    label: 'Issuer Portal',
    icon: <IconHospital size={20} />,
    description: 'Issue & manage credentials',
  },
  {
    id: 'user',
    label: 'User Portal',
    icon: <IconUser size={20} />,
    description: 'Manage your credentials',
  },
  {
    id: 'verifier',
    label: 'Verifier Portal',
    icon: <IconShield size={20} />,
    description: 'Verify credentials',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePortal,
  onPortalChange,
}) => {
  return (
    <aside className="w-72 h-[calc(100vh-64px)] fixed left-0 top-16 border-r border-[var(--border)] bg-[var(--bg-secondary)] hidden lg:block">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = activePortal === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPortalChange(item.id)}
              className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                  : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                }`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${
                    isActive ? 'text-white' : 'text-[var(--text-primary)]'
                  }`}>
                    {item.label}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {item.description}
                  </p>
                </div>
                <IconArrowRight
                  size={16}
                  className={`mt-1 transition-transform ${
                    isActive
                      ? 'text-indigo-400 translate-x-0'
                      : 'text-[var(--text-muted)] -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </nav>

      {/* Info Card */}
      <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
          🔒 Privacy First
        </h4>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          All credentials are verified using zero-knowledge proofs. Your private health data never leaves your device.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
