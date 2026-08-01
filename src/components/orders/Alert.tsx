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
      bg: 'bg-brand-soft',
      border: 'border-brand-soft',
      text: 'text-brand',
      icon: Info
    },
    success: {
      bg: 'bg-ok-soft',
      border: 'border-[color:var(--st-green-fg)]/30',
      text: 'text-ok',
      icon: CheckCircle
    },
    warning: {
      bg: 'bg-warn-soft',
      border: 'border-[color:var(--st-amber-fg)]/30',
      text: 'text-warn',
      icon: AlertTriangle
    },
    error: {
      bg: 'bg-err-soft',
      border: 'border-[color:var(--st-red-fg)]/30',
      text: 'text-err',
      icon: XCircle
    },
    teal: {
      bg: 'bg-brand-soft',
      border: 'border-brand-soft',
      text: 'text-brand',
      icon: Info
    },
    orange: {
      bg: 'bg-brand-soft',
      border: 'border-brand-soft',
      text: 'text-brand',
      icon: AlertCircle
    },
    blue: {
      bg: 'bg-brand-soft',
      border: 'border-brand-soft',
      text: 'text-brand',
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
