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
            className="px-4 py-2 text-sm font-medium text-ink-2 bg-surface border border-border rounded-lg hover:bg-surface-3 disabled:opacity-50"
          >
            Back to form
          </button>
          <button
            type="button"
            onClick={() => onConfirm(comment.trim())}
            disabled={confirming}
            className="px-4 py-2 text-sm font-semibold text-white bg-ok rounded-lg hover:bg-ok disabled:opacity-50"
          >
            {confirming ? 'Saving…' : isEdit ? 'Confirm & update' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {sections.length > 0 ? (
          sections.map((section) => (
            <section key={section.title} className="border border-border rounded-lg overflow-hidden">
              <h3 className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand bg-brand-soft border-b border-brand-soft">
                {section.title}
              </h3>
              <dl className="divide-y divide-hairline">
                {section.rows.map((row) => (
                  <div
                    key={`${section.title}-${row.label}`}
                    className={`grid grid-cols-1 sm:grid-cols-[minmax(140px,32%)_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm ${
                      row.changed ? 'bg-warn-soft border-l-4 border-warn' : ''
                    }`}
                  >
                    <dt className={`font-medium shrink-0 ${row.changed ? 'text-warn' : 'text-ink-3'}`}>
                      {row.label}
                    </dt>
                    <dd className="text-ink whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
                      <span className={row.changed ? 'font-semibold text-warn' : undefined}>{row.value}</span>
                      {row.changed && row.previousValue ? (
                        <p className="mt-1.5 text-xs font-sans text-warn/90">
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
            <label htmlFor="master-submit-comment" className="block text-sm font-medium text-ink-2 mb-1.5">
              {commentLabel}
            </label>
            <textarea
              id="master-submit-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={commentPlaceholder}
              disabled={confirming}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand-soft disabled:opacity-50"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
