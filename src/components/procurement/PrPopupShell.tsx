/**
 * PrPopupShell — shared modal chrome for the Procurement PR popups (§3A/§3B/§3C).
 * Reproduces the spec's popup-mock: dark gradient header with title + code +
 * subtitle and a primary action button, scrollable body, fixed overlay.
 */
import React, { useId } from 'react';
import { X } from '@phosphor-icons/react';
import { ModalOverlay } from '../ui/ModalOverlay';

export interface PrPopupShellProps {
  title: React.ReactNode;
  code?: string;
  subtitle?: React.ReactNode;
  /** Primary header action (e.g. "Save Request" / "Push to Draft"). */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export const PrPopupShell: React.FC<PrPopupShellProps> = ({
  title, code, subtitle, primaryLabel, onPrimary, primaryDisabled, primaryBusy, onClose, children, width = 'max-w-4xl',
}) => {
  const titleId = useId();
  return (
    <ModalOverlay onClose={onClose} z="z-[120]" align="start" scroll className="sm:p-8">
      <div
        className={`w-full ${width} my-4 rounded-[var(--r-lg)] bg-surface shadow-[var(--e3)] border border-hairline overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-[image:var(--brand-gradient)] text-white">
          <div className="min-w-0">
            <h3 id={titleId} className="text-base font-bold flex items-center gap-2 flex-wrap">
              {title}
              {code && <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded">{code}</span>}
            </h3>
            {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {primaryLabel && onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryBusy}
                className="bg-white text-[#1d1d1f] px-3.5 py-1.5 rounded-md text-xs font-bold hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {primaryBusy ? 'Saving…' : primaryLabel}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/15 text-white/90">
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="p-5 max-h-[calc(100vh-9rem)] overflow-y-auto">{children}</div>
      </div>
    </ModalOverlay>
  );
};

/** Small labelled stat cell used across the popups. */
export const StatCell: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'bad' | 'info' | 'edit' }> = ({ label, value, tone = 'default' }) => {
  const valueCls =
    tone === 'bad' ? 'text-err'
    : tone === 'info' ? 'text-brand'
    : tone === 'edit' ? 'bg-warn-soft border border-dashed border-[color:var(--st-amber-fg)]/40 px-1.5 py-0.5 rounded text-warn'
    : 'text-ink';
  return (
    <div className="bg-surface-2 border border-hairline rounded-lg px-3 py-2">
      <div className="text-[9.5px] font-bold text-ink-4 uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-[13px] font-bold mt-0.5 ${valueCls}`}>{value}</div>
    </div>
  );
};

/** Section wrapper with an uppercase heading. */
export const PopupSection: React.FC<{ title: React.ReactNode; children: React.ReactNode; first?: boolean }> = ({ title, children, first }) => (
  <div className={first ? '' : 'mt-4 pt-4 border-t border-hairline'}>
    <h4 className="text-[11px] font-extrabold text-ink-2 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">{title}</h4>
    {children}
  </div>
);
