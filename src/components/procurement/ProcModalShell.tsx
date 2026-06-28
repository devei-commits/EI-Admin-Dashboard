/**
 * ProcModalShell — light modal chrome matching the procurement tool's own
 * design language (see InventoryAuditDetailModal / StockCheckUpdateModal):
 * white card, slate-50 header with an uppercase eyebrow + ✕ close, scrollable
 * body, slate-50 footer with right-aligned actions. (Deliberately NOT the
 * dark-gradient HTML popup style.)
 */
import React from 'react';

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
}) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
    <div
      className={`relative w-full ${width} max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col`}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{eyebrow}</p>}
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h2>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 space-y-4 text-sm">{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
          {footer}
        </div>
      )}
    </div>
  </div>
);

/** Section heading used inside the modal body. */
export const ModalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</p>
    {children}
  </div>
);

/** Labelled text input matching the tool's form style. */
export const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({
  label, value, onChange, type = 'text', placeholder,
}) => (
  <label className="block">
    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  </label>
);
