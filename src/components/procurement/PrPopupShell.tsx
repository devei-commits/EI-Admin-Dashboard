/**
 * PrPopupShell — shared modal chrome for the Procurement PR popups (§3A/§3B/§3C).
 * Reproduces the spec's popup-mock: dark gradient header with title + code +
 * subtitle and a primary action button, scrollable body, fixed overlay.
 */
import React from 'react';
import { X } from 'lucide-react';

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
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className={`w-full ${width} my-4 rounded-2xl bg-white shadow-2xl border-2 border-slate-800 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-indigo-900 text-white">
          <div className="min-w-0">
            <h3 className="text-base font-bold flex items-center gap-2 flex-wrap">
              {title}
              {code && <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded">{code}</span>}
            </h3>
            {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {primaryLabel && onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryBusy}
                className="bg-white text-slate-800 px-3.5 py-1.5 rounded-md text-xs font-bold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

/** Small labelled stat cell used across the popups. */
export const StatCell: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'bad' | 'info' | 'edit' }> = ({ label, value, tone = 'default' }) => {
  const valueCls =
    tone === 'bad' ? 'text-red-600'
    : tone === 'info' ? 'text-blue-600'
    : tone === 'edit' ? 'bg-amber-50 border border-dashed border-amber-400 px-1.5 py-0.5 rounded text-amber-800'
    : 'text-slate-900';
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-[13px] font-bold mt-0.5 ${valueCls}`}>{value}</div>
    </div>
  );
};

/** Section wrapper with an uppercase heading. */
export const PopupSection: React.FC<{ title: string; children: React.ReactNode; first?: boolean }> = ({ title, children, first }) => (
  <div className={first ? '' : 'mt-4 pt-4 border-t border-slate-200'}>
    <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide mb-2">{title}</h4>
    {children}
  </div>
);
