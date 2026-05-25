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
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          {doneLabel}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{codeLabel}</p>
          <p className="mt-1 text-2xl font-mono font-bold text-emerald-900 break-all">{generatedCode}</p>
        </div>
        {rows.length > 0 ? (
          <dl className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 sm:grid-cols-[minmax(120px,36%)_1fr] gap-1 sm:gap-3 px-4 py-2.5 text-sm"
              >
                <dt className="font-medium text-gray-600">{row.label}</dt>
                <dd className="text-gray-900 break-words">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {zohoNote ? (
          <p className="text-xs text-gray-600 border-t border-gray-100 pt-3">{zohoNote}</p>
        ) : null}
      </div>
    </Modal>
  );
}
