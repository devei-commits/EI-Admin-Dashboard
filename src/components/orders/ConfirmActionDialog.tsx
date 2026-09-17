/**
 * ConfirmActionDialog — shared confirm-before-you-do-it dialog for one-click, hard-to-undo SO
 * actions (Cancel, Manual Fulfill). Fast Forward needs a qty input per line, so it uses
 * FastForwardModal instead of this generic confirm.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export type ConfirmActionType = 'cancel' | 'manual_fulfill';
export interface ConfirmState { id: number; soNo: string; type: ConfirmActionType }

export const CONFIRM_DIALOG_CONFIG: Record<ConfirmActionType, {
  title: string;
  body: string;
  confirmLabel: string;
  processingLabel: string;
  iconBg: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  confirmBtnClass: string;
}> = {
  cancel: {
    title: 'Cancel Sales Order',
    body: 'This will set SO status and commercial status to "Cancelled" and freeze all further changes. This cannot be undone from the dashboard.',
    confirmLabel: 'Yes, Cancel SO',
    processingLabel: 'Processing…',
    iconBg: 'bg-err-soft',
    icon: AlertTriangle,
    iconColor: 'text-err',
    confirmBtnClass: 'bg-err hover:opacity-90',
  },
  manual_fulfill: {
    title: 'Mark as Manually Fulfilled',
    body: 'This will mark the SO as fully fulfilled and close it. Status will be set to "Closed" and frozen. Use this for SOs completed outside normal workflow.',
    confirmLabel: 'Yes, Mark Fulfilled',
    processingLabel: 'Processing…',
    iconBg: 'bg-ok-soft',
    icon: CheckCircle2,
    iconColor: 'text-ok',
    confirmBtnClass: 'bg-ok hover:opacity-90',
  },
};

export function ConfirmActionDialog({
  state,
  onClose,
  onConfirm,
  loading,
}: {
  state: ConfirmState;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const cfg = CONFIRM_DIALOG_CONFIG[state.type];
  const Icon = cfg.icon;
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="so-confirm-dialog-title"
          className="bg-surface rounded-xl border border-border shadow-xl p-6 w-full max-w-sm pointer-events-auto"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className={`mt-0.5 p-1.5 rounded-full ${cfg.iconBg}`}>
              <Icon size={16} className={cfg.iconColor} />
            </div>
            <div>
              <h3 id="so-confirm-dialog-title" className="font-bold text-ink text-sm">
                {cfg.title}
              </h3>
              <p className="text-[11px] text-ink-3 mt-0.5">{state.soNo}</p>
            </div>
          </div>
          <p className="text-sm text-ink-3 mb-5">{cfg.body}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg border border-border text-ink-2 hover:bg-surface-3 disabled:opacity-60"
            >
              Go back
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-3 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-60 ${cfg.confirmBtnClass}`}
            >
              {loading ? cfg.processingLabel : cfg.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
