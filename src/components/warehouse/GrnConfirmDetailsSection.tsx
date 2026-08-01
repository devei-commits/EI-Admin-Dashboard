/**
 * "Confirm Details" step (step 2 of the GRN inbound flow): additional attachments and
 * shipment-level declarations. The batch count drives the next, batch-wise, step.
 */

import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import {
  GRN_STORAGE_REQUIREMENTS,
  type GrnStorageRequirementKey,
  type InboundGrnDetailsMeta,
} from '../../lib/inboundGrnDetailsMeta';

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3';

export interface GrnConfirmDetailsSectionProps {
  value: InboundGrnDetailsMeta;
  onChange: (patch: Partial<InboundGrnDetailsMeta>) => void;
  disabled?: boolean;
}

/** Parse a numeric input to a number, or null when blank. */
function toNumOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const GrnConfirmDetailsSection: React.FC<GrnConfirmDetailsSectionProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const attachRef = useRef<HTMLInputElement>(null);
  const attachments = value.attachments ?? [];

  const toggleStorage = (key: GrnStorageRequirementKey): void => {
    onChange({
      storageRequirements: {
        ...(value.storageRequirements ?? {}),
        [key]: !(value.storageRequirements ?? {})[key],
      },
    });
  };

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">2 · Confirm Details</h3>
        <p className="mt-1 text-xs text-ink-3">
          Upload additional docs and declare how many distinct batches were received in this shipment.
          The next step will ask for batch-wise details.
        </p>
      </div>

      {/* Additional attachments (file names only) */}
      <div className="mb-4">
        <span className={labelClass}>Additional attachments</span>
        <input
          ref={attachRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name);
            if (names.length) onChange({ attachments: [...attachments, ...names] });
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => attachRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60"
          >
            <Paperclip className="h-4 w-4" aria-hidden /> Choose file
          </button>
          {attachments.length === 0 ? (
            <span className="text-xs text-ink-3">No file chosen</span>
          ) : null}
        </div>
        {attachments.length ? (
          <ul className="mt-2 space-y-1">
            {attachments.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-2 text-xs text-ink-2">
                <Paperclip className="h-3 w-3 text-ink-4" aria-hidden />
                <span className="truncate">{name}</span>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => onChange({ attachments: attachments.filter((_, j) => j !== i) })}
                    aria-label="Remove attachment"
                    className="text-ink-4 hover:text-ink-2"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Declarations */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="grn-batches">No. of batches received *</label>
          <input
            id="grn-batches"
            type="number"
            min={1}
            step={1}
            value={value.batchesReceived ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ batchesReceived: toNumOrNull(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-total-weight">Total shipment weight (declared)</label>
          <div className="flex items-center gap-2">
            <input
              id="grn-total-weight"
              type="number"
              min={0}
              value={value.totalWeightKg ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ totalWeightKg: toNumOrNull(e.target.value) })}
              className={inputClass}
            />
            <span className="text-sm text-ink-3">kg</span>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-containers">Total containers</label>
          <input
            id="grn-containers"
            type="number"
            min={0}
            step={1}
            value={value.totalContainers ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ totalContainers: toNumOrNull(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>

      {/* Storage requirements */}
      <div className="mb-4">
        <span className={labelClass}>Storage requirements observed</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {GRN_STORAGE_REQUIREMENTS.map((req) => (
            <label
              key={req.key}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-2 hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={!!(value.storageRequirements ?? {})[req.key]}
                disabled={disabled}
                onChange={() => toggleStorage(req.key)}
                className="h-4 w-4 rounded border-border"
              />
              {req.label}
            </label>
          ))}
        </div>
      </div>

      {/* QC notes */}
      <div>
        <label className={labelClass} htmlFor="grn-qc-notes">Notes for QC team</label>
        <textarea
          id="grn-qc-notes"
          value={value.qcNotes ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ qcNotes: e.target.value || null })}
          rows={2}
          placeholder="Any observations for QC to check"
          className={inputClass}
        />
      </div>
    </section>
  );
};
