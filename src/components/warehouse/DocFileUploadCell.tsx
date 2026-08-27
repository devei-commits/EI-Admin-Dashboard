/**
 * One document upload slot: click or drag-and-drop, with the uploaded file name and a Remove action.
 *
 * Extracted from GrnCopyReceiptModal so the grouped-receipt modal uses the same cell rather than a
 * near-copy — two upload widgets drifting apart is exactly how one of them ends up not clearing
 * state or not accepting the same file types.
 */
import { useRef, useState } from 'react';
import type { InboundGrnSourceDocKey } from '../../lib/inboundGrnSourceDocs';

export type DocFileUploadCellProps = {
  docKey: InboundGrnSourceDocKey;
  fileName: string | null;
  uploaded: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
};

export const DocFileUploadCell: React.FC<DocFileUploadCellProps> = ({
  fileName,
  uploaded,
  disabled,
  onUpload,
  onClear,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const acceptFile = (file: File | undefined): void => {
    if (!file || disabled) return;
    onUpload(file);
  };

  const openFilePicker = (): void => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div className="min-w-[12rem]">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        disabled={disabled}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {uploaded && fileName ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ok">{fileName} ✓ uploaded</span>
          {!disabled ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-ink-3 underline hover:text-err"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex min-h-[2.25rem] w-full items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
            disabled
              ? 'cursor-not-allowed border-border text-ink-4 opacity-60'
              : dragActive
                ? 'cursor-copy border-ok bg-ok-soft text-ok'
                : 'cursor-pointer border-border text-ink-2 hover:border-border hover:bg-surface-2'
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              openFilePicker();
            }}
            className="text-xs font-semibold text-ink underline-offset-2 hover:underline disabled:no-underline disabled:text-ink-4"
          >
            Choose file
          </button>
          <span className="text-xs font-normal text-ink-3">· drag &amp; drop</span>
        </div>
      )}
    </div>
  );
};
