import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ConfirmDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string | ReactNode;
 confirmText?: string;
 cancelText?: string;
 variant?: 'danger' | 'warning' | 'info';
 isLoading?: boolean;
}

/**
 * Reusable confirmation dialog.
 * Replaces the many inline confirmation modals (delete confirm, status change, etc.)
 * found in 15+ locations across the codebase.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
 isOpen,
 onClose,
 onConfirm,
 title,
 message,
 confirmText = 'Confirm',
 cancelText = 'Cancel',
 variant = 'danger',
 isLoading = false,
}) => {
 const handleKeyDown = useCallback(
  (e: KeyboardEvent) => {
   if (e.key === 'Escape') onClose();
  },
  [onClose]
 );

 useEffect(() => {
  if (isOpen) {
   document.addEventListener('keydown', handleKeyDown);
   return () => document.removeEventListener('keydown', handleKeyDown);
  }
 }, [isOpen, handleKeyDown]);

 const dialogRef = useRef<HTMLDivElement>(null);
 useFocusTrap(isOpen, dialogRef);

 if (!isOpen) return null;

 const confirmStyles = {
  danger: 'bg-[color:var(--st-red-fg)] text-white hover:brightness-95 focus-visible:ring-[color:var(--st-red-fg)]/40',
  warning: 'bg-brand text-brand-ink hover:bg-brand-press focus-visible:ring-[color:var(--ring)]',
  info: 'bg-brand text-brand-ink hover:bg-brand-press focus-visible:ring-[color:var(--ring)]',
 };

 const iconColors = {
  danger: 'text-[color:var(--st-red-fg)]',
  warning: 'text-[color:var(--st-amber-fg)]',
  info: 'text-brand',
 };

 return (
  <div
   className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4"
   onClick={onClose}
  >
   <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    className="bg-surface text-ink rounded-[var(--r-lg)] shadow-[var(--e3)] border border-hairline w-full max-w-md p-6 space-y-4"
    onClick={(e) => e.stopPropagation()}
   >
    <div className="flex items-start gap-3">
     <div className={`mt-0.5 ${iconColors[variant]}`}>
      {variant === 'danger' ? (
       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
       </svg>
      ) : (
       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>
      )}
     </div>
     <div className="flex-1">
      <h3 id="confirm-dialog-title" className="text-lg font-semibold text-ink">{title}</h3>
      <div className="text-sm text-ink-2 mt-1">{message}</div>
     </div>
    </div>

    <div className="flex justify-end gap-3 pt-2">
     <button
      onClick={onClose}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-medium text-ink-2 bg-surface-3 border border-hairline rounded-[var(--r-sm)] hover:bg-surface-2 transition-colors disabled:opacity-50"
     >
      {cancelText}
     </button>
     <button
      onClick={onConfirm}
      disabled={isLoading}
      className={`px-4 py-2 text-sm font-medium rounded-[var(--r-sm)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed ${confirmStyles[variant]}`}
     >
      {isLoading ? (
       <span className="flex items-center gap-2">
        <span aria-hidden className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
        Processing...
       </span>
      ) : (
       confirmText
      )}
     </button>
    </div>
   </div>
  </div>
 );
};

export default ConfirmDialog;
