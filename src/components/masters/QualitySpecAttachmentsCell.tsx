import React, { useRef, useState } from 'react';
import {
  deleteQualitySpecAttachment,
  isMasterQualitySpecAttachmentUrl,
  openQualitySpecAttachment,
  uploadQualitySpecAttachment,
} from '../../services/masterAttachments.service';
import {
  createQualitySpecAttachment,
  type QualitySpecAttachment,
} from '../../types/qualitySpecTable';

type QualitySpecAttachmentsCellProps = {
  rowId: string;
  attachments: QualitySpecAttachment[];
  onChange: (attachments: QualitySpecAttachment[]) => void;
  onRemoveRow: () => void;
};

const inputCls =
  'w-full min-w-0 px-2.5 py-1.5 border border-border rounded-lg text-xs leading-normal focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] bg-surface';

function attachmentLabel(att: QualitySpecAttachment): string {
  if (att.name.trim()) return att.name.trim();
  if (att.url.trim()) return att.url.trim();
  return att.type === 'file' ? 'File' : 'Link';
}

function canViewAttachment(att: QualitySpecAttachment): boolean {
  return Boolean(att.url.trim());
}

export function QualitySpecAttachmentsCell({
  rowId,
  attachments,
  onChange,
  onRemoveRow,
}: QualitySpecAttachmentsCellProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const addUploadedFiles = async (files: FileList | null | undefined): Promise<void> => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    const next = [...attachments];
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadQualitySpecAttachment(file);
        next.push(
          createQualitySpecAttachment({
            type: 'file',
            name: uploaded.name,
            url: uploaded.url,
          })
        );
      }
      onChange(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const addLink = (): void => {
    const url = linkDraft.trim();
    if (!url) return;
    onChange([
      ...attachments,
      createQualitySpecAttachment({
        type: 'link',
        name: url,
        url,
      }),
    ]);
    setLinkDraft('');
    setError('');
  };

  const removeAttachment = async (attachmentId: string): Promise<void> => {
    const att = attachments.find((item) => item.id === attachmentId);
    if (!att) return;
    if (att.type === 'file' && isMasterQualitySpecAttachmentUrl(att.url)) {
      try {
        await deleteQualitySpecAttachment(att.url);
      } catch {
        // Still remove from form if server file is already gone.
      }
    }
    onChange(attachments.filter((item) => item.id !== attachmentId));
  };

  const viewAttachment = async (att: QualitySpecAttachment): Promise<void> => {
    setError('');
    try {
      await openQualitySpecAttachment(att.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open attachment';
      setError(message);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 items-stretch min-w-[8.5rem]">
      {attachments.length > 0 ? (
        <ul className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-start gap-1 rounded border border-hairline bg-surface-3 px-1.5 py-1"
            >
              <span className="shrink-0 text-[10px]" aria-hidden>
                {att.type === 'file' ? '📎' : '🔗'}
              </span>
              <span
                className="flex-1 min-w-0 text-[10px] text-ink-2 break-all leading-tight"
                title={attachmentLabel(att)}
              >
                {attachmentLabel(att)}
              </span>
              <div className="flex shrink-0 flex-col gap-0.5">
                {canViewAttachment(att) ? (
                  <button
                    type="button"
                    onClick={() => {
                      void viewAttachment(att);
                    }}
                    className="px-1 py-0.5 text-[9px] font-semibold text-brand hover:text-brand focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)] rounded"
                  >
                    View
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void removeAttachment(att.id);
                  }}
                  className="px-1 py-0.5 text-[9px] font-semibold text-err hover:text-err focus:outline-none focus:ring-1 focus:ring-[color:var(--st-red-fg)]/40 rounded"
                  aria-label={`Remove attachment ${attachmentLabel(att)}`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-ink-4">No attachments</p>
      )}

      {error ? (
        <p className="text-[10px] text-err" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        id={`${rowId}-file-input`}
        type="file"
        multiple
        className="sr-only"
        disabled={uploading}
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,image/*"
        onChange={(e) => {
          void addUploadedFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex gap-1">
        <button
          type="button"
          title="Upload file(s)"
          aria-label="Upload file(s)"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 px-2 py-1 text-[10px] font-semibold text-ink-2 bg-surface-3 border border-border rounded hover:bg-surface-3 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
        >
          {uploading ? '…' : '📎'}
        </button>
        <button
          type="button"
          title="Add link below"
          aria-label="Add link below"
          disabled={uploading}
          onClick={() => {
            const el = document.getElementById(`${rowId}-link-input`);
            el?.focus();
          }}
          className="flex-1 px-2 py-1 text-[10px] font-semibold text-ink-2 bg-surface-3 border border-border rounded hover:bg-surface-3 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
        >
          🔗
        </button>
      </div>
      <div className="flex gap-1">
        <input
          id={`${rowId}-link-input`}
          type="url"
          value={linkDraft}
          disabled={uploading}
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLink();
            }
          }}
          className={inputCls}
          placeholder="Paste link URL"
          aria-label="Attachment link URL"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={!linkDraft.trim() || uploading}
          className="shrink-0 px-2 py-1 text-[10px] font-semibold text-brand bg-brand-soft border border-brand-soft rounded hover:bg-brand-soft disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
        >
          Add
        </button>
      </div>
      <button
        type="button"
        onClick={onRemoveRow}
        disabled={uploading}
        className="px-2 py-1 text-[10px] font-semibold text-err bg-err-soft border border-[color:var(--st-red-fg)]/30 rounded hover:bg-err-soft disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[color:var(--st-red-fg)]/40"
        aria-label="Remove spec row"
      >
        ✕ Remove row
      </button>
    </div>
  );
}
