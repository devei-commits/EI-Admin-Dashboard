/**
 * Modal Component
 * Reusable modal wrapper with header, body, and footer
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-[560px]',
    md: 'max-w-[760px]',
    lg: 'max-w-[980px]',
    xl: 'max-w-[1260px]'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-200 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`
          bg-white border border-gray-300 rounded-[14px] w-full max-h-[94vh] 
          overflow-hidden flex flex-col shadow-2xl
          ${sizeClasses[size]}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-2.5 shrink-0 bg-gray-50">
          <div>
            <h2 className="text-[15px] font-extrabold tracking-tight text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10.5px] text-gray-600 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="
              px-3 py-1.5 rounded-lg border border-gray-300 bg-white 
              text-gray-700 text-[11.5px] font-semibold transition-all duration-150
              hover:bg-gray-50 flex items-center gap-1.5
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
          <div className="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end shrink-0 flex-wrap bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};


