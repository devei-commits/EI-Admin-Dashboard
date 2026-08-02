import React from 'react';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';

/**
 * ErrorState — unified failure appearance (icon + message + optional Retry).
 * `role="alert"` so screen readers announce it. Token-driven, theme-aware.
 */
export interface ErrorStateProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
  compact = false,
}) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-14 px-6'} ${className}`}
  >
    <Warning className="mb-3 h-10 w-10 text-err" weight="duotone" aria-hidden="true" />
    <p className="text-sm font-semibold text-ink">{title}</p>
    {message && <p className="mt-1 max-w-sm text-xs text-ink-3">{message}</p>}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-press focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        <ArrowClockwise size={15} aria-hidden="true" /> {retryLabel}
      </button>
    )}
  </div>
);
