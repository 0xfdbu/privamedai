/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices
 */

import React from 'react';
import { PortalType } from '../../types';
import { IconHospital, IconUser, IconShield } from '../icons';

interface MobileNavProps {
  activePortal: PortalType;
  onPortalChange: (portal: PortalType) => void;
}

const navItems = [
  { id: 'issuer' as PortalType, label: 'Issuer', icon: IconHospital },
  { id: 'user' as PortalType, label: 'User', icon: IconUser },
  { id: 'verifier' as PortalType, label: 'Verifier', icon: IconShield },
];

export const MobileNav: React.FC<MobileNavProps> = ({
  activePortal,
  onPortalChange,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-[var(--border)] lg:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = activePortal === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onPortalChange(item.id)}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-indigo-400'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
