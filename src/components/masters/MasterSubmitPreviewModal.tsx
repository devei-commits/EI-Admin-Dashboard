import React from 'react';
import { Modal } from '../orders/Modal';
import type { MasterPreviewSection } from '../../utils/masterSubmitPreview';

export type MasterSubmitPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  sections: MasterPreviewSection[];
  confirmLabel?: string;
  confirming?: boolean;
  isEdit?: boolean;
};

export function MasterSubmitPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle = 'Review all values below. Confirm to save to the server.',
  sections,
  confirmLabel = 'Confirm & save',
  confirming = false,
  isEdit = false,
}: MasterSubmitPreviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={confirming ? () => {} : onClose}
      title={title}
      subtitle={subtitle}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Back to form
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirming ? 'Saving…' : isEdit ? 'Confirm & update' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {sections.length === 0 ? (
          <p className="text-sm text-gray-500">No fields to preview.</p>
        ) : (
          sections.map((section) => (
            <section key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
              <h3 className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-indigo-800 bg-indigo-50 border-b border-indigo-100">
                {section.title}
              </h3>
              <dl className="divide-y divide-gray-100">
                {section.rows.map((row) => (
                  <div
                    key={`${section.title}-${row.label}`}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(140px,32%)_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm"
                  >
                    <dt className="font-medium text-gray-600 shrink-0">{row.label}</dt>
                    <dd className="text-gray-900 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
