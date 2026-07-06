import React, { useMemo, useRef, useState } from 'react';
import type { ThirdPartyTrackingRow } from '../../lib/thirdPartyTestTrackingDisplay';
import { deriveAutoPassedFromResult } from '../../lib/grnQcAutoPass';
import { GrnQcResultInput } from './GrnQcResultInput';

type ThirdPartyUploadReportModalProps = {
  row: ThirdPartyTrackingRow;
  onClose: () => void;
  onSave: (result: string, file: File) => Promise<void>;
};

const ThirdPartyUploadReportModal: React.FC<ThirdPartyUploadReportModalProps> = ({ row, onClose, onSave }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState(
    row.resultValue && !/^pending$/i.test(row.resultValue) ? row.resultValue : '',
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verdictPreview = useMemo(() => {
    const value = String(result).trim();
    if (!value || /^pending$/i.test(value)) return null;
    const passed = deriveAutoPassedFromResult({ ...row.test, result: value });
    if (passed === true) return { label: '✓ within spec', tone: 'pass' as const };
    if (passed === false) return { label: '✗ out of spec', tone: 'fail' as const };
    return { label: 'Verdict pending — check spec', tone: 'pending' as const };
  }, [result, row.test]);

  const handleSubmit = async (): Promise<void> => {
    if (!String(result).trim()) {
      setError('Enter the lab result value from the COA.');
      return;
    }
    if (!file) {
      setError('Select the lab report file (PDF or image).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(result.trim(), file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        role="dialog"
        aria-labelledby="upload-report-title"
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 id="upload-report-title" className="text-base font-bold text-slate-900">
            Upload lab report &amp; enter result
          </h2>
          <p className="text-xs text-slate-600 mt-1">
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
            accept=".pdf,application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            {file ? (
              <p className="text-xs font-medium text-slate-800">{file.name}</p>
            ) : (
              <p className="text-xs text-slate-500">No report file selected</p>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 text-xs font-semibold text-violet-800 hover:underline"
            >
              Choose report file
            </button>
          </div>
          <label className="block text-xs" htmlFor="third-party-coa-result">
            <span className="font-semibold text-slate-700">Result from COA</span>
            <div className="mt-1">
              <GrnQcResultInput
                id="third-party-coa-result"
                test={{ ...row.test, result }}
                onChange={setResult}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Spec: {row.specLimit || '—'}</span>
          </label>
          {verdictPreview ? (
            <p
              className={`text-xs font-semibold ${
                verdictPreview.tone === 'pass'
                  ? 'text-emerald-700'
                  : verdictPreview.tone === 'fail'
                    ? 'text-rose-700'
                    : 'text-amber-800'
              }`}
            >
              Auto verdict: {verdictPreview.label}
            </p>
          ) : null}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="px-3 py-1.5 rounded-lg bg-violet-700 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save report & result'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThirdPartyUploadReportModal;
