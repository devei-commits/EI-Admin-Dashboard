/**
 * Modal Component
 * Reusable modal wrapper with header, body, and footer
 */

import React from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from '../ui/ModalOverlay';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Override scroll/overflow on the body panel (e.g. overflow-visible for nested dropdowns). */
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  size = 'md', 
  children,
  footer,
  bodyClassName,
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-[560px]',
    md: 'max-w-[760px]',
    lg: 'max-w-[980px]',
    xl: 'max-w-[1260px]'
  };

  return (
    <ModalOverlay onClose={onClose} z="z-[200]" backdrop="strong">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`
          bg-surface border border-border rounded-[14px] w-full max-h-[94vh]
          overflow-hidden flex flex-col shadow-2xl
          ${sizeClasses[size]}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2.5 shrink-0 bg-surface-3">
          <div>
            <h2 id="modal-title" className="text-[15px] font-extrabold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10.5px] text-ink-3 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="
              px-3 py-1.5 rounded-lg border border-border bg-surface
              text-ink-2 text-[11.5px] font-semibold transition-all duration-150
              hover:bg-surface-3 flex items-center gap-1.5
            "
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-5 py-4 ${bodyClassName ?? ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border flex gap-2 justify-end shrink-0 flex-wrap bg-surface-3">
            {footer}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};


