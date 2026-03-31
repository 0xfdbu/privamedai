/**
 * Status Indicator Component
 * Shows contract connection state
 */

import React from 'react';
import { ContractState } from '../../types';
import { IconLoader, IconCheck, IconX, IconActivity } from '../icons';

interface StatusIndicatorProps {
  state: ContractState;
  error?: string | null;
  showLabel?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  error,
  showLabel = true,
}) => {
  const config = {
    initializing: {
      icon: <IconActivity size={16} />,
      dotClass: 'status-dot syncing',
      label: 'Initializing',
      textClass: 'text-yellow-500',
    },
    syncing: {
      icon: <IconLoader size={16} />,
      dotClass: 'status-dot syncing',
      label: 'Syncing',
      textClass: 'text-yellow-500',
    },
    ready: {
      icon: <IconCheck size={16} />,
      dotClass: 'status-dot online',
      label: 'Connected',
      textClass: 'text-green-500',
    },
    error: {
      icon: <IconX size={16} />,
      dotClass: 'status-dot error',
      label: error || 'Error',
      textClass: 'text-red-500',
    },
  };

  const current = config[state];

  return (
    <div className={`flex items-center gap-2 ${current.textClass}`}>
      <span className={current.dotClass} />
      {current.icon}
      {showLabel && (
        <span className="text-sm font-medium">{current.label}</span>
      )}
    </div>
  );
};

export default StatusIndicator;
