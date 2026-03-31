/**
 * Alert Component
 * Feedback messages for users
 */

import React from 'react';
import { AlertVariant } from '../../types';
import { IconCheck, IconX, IconAlertTriangle, IconInfo } from '../icons';

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  className = '',
  onClose,
}) => {
  const variantClasses = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
  };

  const icons = {
    success: <IconCheck size={20} />,
    error: <IconX size={20} />,
    warning: <IconAlertTriangle size={20} />,
    info: <IconInfo size={20} />,
  };

  return (
    <div className={`alert ${variantClasses[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 p-1 hover:bg-white/10 rounded transition-colors"
        >
          <IconX size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
