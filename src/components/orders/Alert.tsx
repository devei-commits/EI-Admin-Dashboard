/**
 * Alert Component
 * Displays alert messages with different variants
 */

import React from 'react';
import { 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Lightbulb
} from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'teal' | 'orange' | 'blue';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ 
  variant = 'info', 
  children, 
  icon,
  className = '' 
}) => {
  const variants = {
    info: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      text: 'text-blue-600',
      icon: Info
    },
    success: {
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/20',
      text: 'text-emerald-600',
      icon: CheckCircle
    },
    warning: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      text: 'text-amber-600',
      icon: AlertTriangle
    },
    error: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/20',
      text: 'text-red-600',
      icon: XCircle
    },
    teal: {
      bg: 'bg-teal-500/5',
      border: 'border-teal-500/20',
      text: 'text-teal-600',
      icon: Info
    },
    orange: {
      bg: 'bg-orange-500/5',
      border: 'border-orange-500/20',
      text: 'text-orange-600',
      icon: AlertCircle
    },
    blue: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      text: 'text-blue-600',
      icon: Lightbulb
    }
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div 
      className={`
        px-3 py-2.5 rounded-lg text-[11.5px] flex items-start gap-2.5 mb-3 leading-relaxed border
        ${config.bg} ${config.border} ${config.text} ${className}
      `}
    >
      <span className="shrink-0 mt-0.5">
        {icon || <Icon size={16} />}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
};
