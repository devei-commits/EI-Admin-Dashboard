/**
 * ProcModalShell — light modal chrome matching the procurement tool's own
 * design language (see InventoryAuditDetailModal / StockCheckUpdateModal):
 * white card, slate-50 header with an uppercase eyebrow + ✕ close, scrollable
 * body, slate-50 footer with right-aligned actions. (Deliberately NOT the
 * dark-gradient HTML popup style.)
 */
import React, { useId } from 'react';
import { X } from '@phosphor-icons/react';
import { ModalOverlay } from '../ui/ModalOverlay';

export interface ProcModalShellProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}

export const ProcModalShell: React.FC<ProcModalShellProps> = ({
  eyebrow, title, subtitle, onClose, footer, width = 'max-w-2xl', children,
}) => {
  const titleId = useId();
  return (
    <ModalOverlay onClose={onClose} z="z-[120]">
      <div
        className={`relative w-full ${width} max-h-[90vh] overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-hairline bg-surface-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">{eyebrow}</p>}
            <h2 id={titleId} className="text-lg font-bold text-ink mt-0.5">{title}</h2>
            {subtitle && <p className="text-sm text-ink-3 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 px-2 py-1 rounded-lg border border-border text-ink-3 text-sm hover:bg-surface-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 text-sm">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-hairline bg-surface-2 flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

/** Section heading used inside the modal body. */
export const ModalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-2">{title}</p>
    {children}
  </div>
);

/** Labelled text input matching the tool's form style. */
export const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string; max?: string }> = ({
  label, value, onChange, type = 'text', placeholder, min, max,
}) => (
  <label className="block">
    <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]"
    />
  </label>
);
