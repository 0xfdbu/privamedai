/**
 * Main Layout Component
 * Combines Header, Sidebar, and content area
 */

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { PortalType, ContractState } from '../../types';

interface MainLayoutProps {
  children: React.ReactNode;
  contractState: ContractState;
  contractError?: string | null;
  walletAddress?: string;
  activePortal: PortalType;
  onPortalChange: (portal: PortalType) => void;
  onDisconnect: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  contractState,
  contractError,
  walletAddress,
  activePortal,
  onPortalChange,
  onDisconnect,
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <Header
        contractState={contractState}
        contractError={contractError}
        walletAddress={walletAddress}
        onDisconnect={onDisconnect}
      />

      {/* Sidebar */}
      <Sidebar
        activePortal={activePortal}
        onPortalChange={onPortalChange}
      />

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 pb-20 lg:pb-8 min-h-screen">
        <div className="container py-8">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav
        activePortal={activePortal}
        onPortalChange={onPortalChange}
      />
    </div>
  );
};

export default MainLayout;
