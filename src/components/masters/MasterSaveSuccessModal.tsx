import React from 'react';
import { Modal } from '../orders/Modal';

export type MasterSaveSuccessRow = {
  label: string;
  value: string;
};

export type MasterSaveSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Prominent internal code (RM / PM / PR SKU). */
  generatedCode: string;
  codeLabel?: string;
  rows: MasterSaveSuccessRow[];
  zohoNote?: string | null;
  doneLabel?: string;
};

export function MasterSaveSuccessModal({
  isOpen,
  onClose,
  title = 'Saved successfully',
  subtitle = 'The item is registered in Esthetic Insights with the internal code below.',
  generatedCode,
  codeLabel = 'Generated internal code (SKU)',
  rows,
  zohoNote,
  doneLabel = 'Done',
}: MasterSaveSuccessModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-white bg-ok rounded-lg hover:bg-ok"
        >
          {doneLabel}
        </button>
      }
    >
      <div className="space-y-4">
        {generatedCode.trim() ? (
          <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ok">{codeLabel}</p>
            <p className="mt-1 text-2xl font-mono font-bold text-ok break-all">{generatedCode}</p>
          </div>
        ) : null}
        {rows.length > 0 ? (
          <dl className="divide-y divide-hairline border border-border rounded-lg overflow-hidden">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 sm:grid-cols-[minmax(120px,36%)_1fr] gap-1 sm:gap-3 px-4 py-2.5 text-sm"
              >
                <dt className="font-medium text-ink-3">{row.label}</dt>
                <dd className="text-ink break-words">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {zohoNote ? (
          <p className="text-xs text-ink-3 border-t border-hairline pt-3">{zohoNote}</p>
        ) : null}
      </div>
    </Modal>
  );
}
