import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

interface AlertProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onClose?: () => void;
}

export function Alert({ children, variant = 'info', title, onClose }: AlertProps) {
  const variants = {
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      Icon: Info,
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200',
      icon: 'text-emerald-600',
      Icon: CheckCircle,
    },
    warning: {
      container: 'bg-amber-50 border-amber-200',
      icon: 'text-amber-600',
      Icon: AlertCircle,
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      Icon: XCircle,
    },
  };

  const { container, icon, Icon: IconComponent } = variants[variant];

  return (
    <div className={`p-4 rounded-lg border ${container}`}>
      <div className="flex gap-3">
        <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${icon}`} />
        <div className="flex-1">
          {title && <h4 className={`font-medium mb-1 ${icon}`}>{title}</h4>}
          <div className="text-sm text-slate-700">{children}</div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
