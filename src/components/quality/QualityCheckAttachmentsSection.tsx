import React, { useRef, useState } from 'react';
import {
  GRN_QC_ATTACHMENT_TYPES,
  addGrnQcAttachment,
  createGrnQcAttachment,
  removeGrnQcAttachment,
  type GrnQcAttachmentType,
  type GrnQcSpecsStored,
} from '../../lib/grnQcSpecs';
import {
  buildQualityCheckAttachmentSummary,
  buildQualityCheckAttachments,
  type QualityCheckAttachmentRow,
} from '../../lib/qualityCheckModalDisplay';
import type { GRNRecordFromApi } from '../../services/grn.service';

type QualityCheckAttachmentsSectionProps = {
  grn: GRNRecordFromApi;
  qcSpecs: GrnQcSpecsStored | null;
  disabled?: boolean;
  uploadedBy?: string;
  onChange: (next: GrnQcSpecsStored) => void;
};

const QualityCheckAttachmentsSection: React.FC<QualityCheckAttachmentsSectionProps> = ({
  grn,
  qcSpecs,
  disabled = false,
  uploadedBy,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachType, setAttachType] = useState<GrnQcAttachmentType>('In-house test');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  const basePayload: GrnQcSpecsStored = qcSpecs ?? { lines: [] };
  const rows: QualityCheckAttachmentRow[] = buildQualityCheckAttachments(grn, basePayload);
  const summary = buildQualityCheckAttachmentSummary(rows);

  const handleFile = (file: File | undefined): void => {
    if (!file || disabled) return;
    const attachment = createGrnQcAttachment(file.name, attachType, uploadedBy);
    onChange(addGrnQcAttachment(basePayload, attachment));
    setAttachMenuOpen(false);
  };

  const handleRemove = (row: QualityCheckAttachmentRow): void => {
    if (disabled || row.source !== 'qc-upload') return;
    onChange(removeGrnQcAttachment(basePayload, row.id));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-2">📷 Photos &amp; report attachments</h3>
      <p className={`text-[11px] mb-3 ${rows.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{summary}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/*,.xlsx,.xls,.doc,.docx"
        disabled={disabled}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {rows.length > 0 ? (
        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 border-b border-slate-200">
              <th scope="col" className="py-2 pr-3">Attachment</th>
              <th scope="col" className="py-2 pr-3">Type</th>
              <th scope="col" className="py-2 pr-3">Uploaded</th>
              <th scope="col" className="py-2 w-16">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((att) => (
              <tr key={att.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{att.name}</td>
                <td className="py-2 pr-3 text-slate-600">{att.type}</td>
                <td className="py-2 pr-3 text-slate-600 tabular-nums">{att.uploadedAt}</td>
                <td className="py-2">
                  {att.source === 'qc-upload' ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemove(att)}
                      className="text-[11px] font-semibold text-rose-700 hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">GRN doc</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!disabled ? (
      <div className="relative inline-block">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAttachMenuOpen((open) => !open)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-40"
          aria-expanded={attachMenuOpen}
          aria-haspopup="listbox"
        >
          + attach report file <span aria-hidden="true">▾</span>
        </button>

        {attachMenuOpen && !disabled ? (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[14rem] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Attachment type
            </p>
            {GRN_QC_ATTACHMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={attachType === type}
                onClick={() => {
                  setAttachType(type);
                  setAttachMenuOpen(false);
                  inputRef.current?.click();
                }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${
                  attachType === type ? 'font-semibold text-teal-800 bg-teal-50/50' : 'text-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}

      {attachMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label="Close attachment menu"
          onClick={() => setAttachMenuOpen(false)}
        />
      ) : null}
    </section>
  );
};

export default QualityCheckAttachmentsSection;
