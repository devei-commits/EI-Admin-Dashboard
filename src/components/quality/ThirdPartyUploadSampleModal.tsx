import React, { useRef, useState } from 'react';
import type { ThirdPartyTrackingRow } from '../../lib/thirdPartyTestTrackingDisplay';
import { ModalOverlay } from '../ui/ModalOverlay';

type ThirdPartyUploadSampleModalProps = {
  row: ThirdPartyTrackingRow;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

const ThirdPartyUploadSampleModal: React.FC<ThirdPartyUploadSampleModalProps> = ({ row, onClose, onSave }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!file) {
      setError('Select a sample photo to upload.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save sample photo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} z="z-[130]" dismissable={false} backdrop="default">
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-sample-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 id="upload-sample-title" className="text-base font-bold text-ink">
            Upload sample photo
          </h2>
          <p className="text-xs text-ink-2 mt-1">
            {row.poNo} · {row.testParameter} · {row.itemName}
          </p>
        </div>
        <div className="p-5 space-y-4">
          {error ? (
            <p className="text-xs text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <div className="rounded-lg border border-dashed border-border bg-surface-2 p-4 text-center">
            {file ? (
              <p className="text-xs font-medium text-ink">{file.name}</p>
            ) : (
              <p className="text-xs text-ink-3">No file selected</p>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 text-xs font-semibold text-violet-800 hover:underline"
            >
              Choose photo
            </button>
          </div>
          <p className="text-[10px] text-ink-3">
            Photo is linked to this PO only. Status moves to Sample Picked / In Lab after upload.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="px-3 py-1.5 rounded-lg bg-violet-700 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save sample photo'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

export default ThirdPartyUploadSampleModal;
