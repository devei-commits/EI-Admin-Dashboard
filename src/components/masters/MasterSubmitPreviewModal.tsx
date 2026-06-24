import React, { useEffect, useState } from 'react';
import { Modal } from '../orders/Modal';
import type { MasterPreviewSection } from '../../utils/masterSubmitPreview';

export type MasterSubmitPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  title: string;
  subtitle?: string;
  sections: MasterPreviewSection[];
  confirmLabel?: string;
  confirming?: boolean;
  isEdit?: boolean;
  /** When true, shows an optional comment field (default: true). */
  showComment?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
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
  showComment = true,
  commentLabel = 'Comment',
  commentPlaceholder = 'Optional note for the approval status history…',
}: MasterSubmitPreviewModalProps) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (isOpen) setComment('');
  }, [isOpen]);

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
            onClick={() => onConfirm(comment.trim())}
            disabled={confirming}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirming ? 'Saving…' : isEdit ? 'Confirm & update' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {sections.length > 0 ? (
          sections.map((section) => (
            <section key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
              <h3 className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-indigo-800 bg-indigo-50 border-b border-indigo-100">
                {section.title}
              </h3>
              <dl className="divide-y divide-gray-100">
                {section.rows.map((row) => (
                  <div
                    key={`${section.title}-${row.label}`}
                    className={`grid grid-cols-1 sm:grid-cols-[minmax(140px,32%)_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm ${
                      row.changed ? 'bg-amber-50 border-l-4 border-amber-400' : ''
                    }`}
                  >
                    <dt className={`font-medium shrink-0 ${row.changed ? 'text-amber-900' : 'text-gray-600'}`}>
                      {row.label}
                    </dt>
                    <dd className="text-gray-900 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
                      <span className={row.changed ? 'font-semibold text-amber-950' : undefined}>{row.value}</span>
                      {row.changed && row.previousValue ? (
                        <p className="mt-1.5 text-xs font-sans text-amber-800/90">
                          Previously — {row.previousValue}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        ) : null}

        {showComment ? (
          <div>
            <label htmlFor="master-submit-comment" className="block text-sm font-medium text-gray-700 mb-1.5">
              {commentLabel}
            </label>
            <textarea
              id="master-submit-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={commentPlaceholder}
              disabled={confirming}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
