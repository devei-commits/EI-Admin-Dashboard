/**
 * "QC → Complete" step (step 7): record the quality inspection against the item's master
 * specs, then Accept → Complete GRN or Reject → Vendor Return. The spec table reuses the
 * existing GrnQcInspectionPanel; the verdict is derived from the per-test pass/fail.
 */

import React from 'react';
import type { GrnQcSpecsStored } from '../../lib/grnQcSpecs';
import { deriveGrnQcStatusFromSpecs, summarizeGrnQcTests } from '../../lib/grnQcSpecs';
import { GrnQcInspectionPanel } from './GrnQcInspectionPanel';

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3';

export interface GrnQcCompleteSectionProps {
  qcSpecs: GrnQcSpecsStored | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onChange: (next: GrnQcSpecsStored) => void;
  qcBy: string;
  onQcByChange: (v: string) => void;
  testDate: string;
  onTestDateChange: (v: string) => void;
}

export const GrnQcCompleteSection: React.FC<GrnQcCompleteSectionProps> = ({
  qcSpecs,
  loading,
  error,
  disabled = false,
  onChange,
  qcBy,
  onQcByChange,
  testDate,
  onTestDateChange,
}) => {
  const derived = deriveGrnQcStatusFromSpecs(qcSpecs);
  const summary = summarizeGrnQcTests(qcSpecs);

  const verdictBadge =
    derived === 'Rejected'
      ? { text: '❌ REJECT — one or more params failed', cls: 'border-err-soft bg-err-soft text-err' }
      : derived === 'Passed'
        ? { text: '✅ ACCEPT — all packs', cls: 'border-ok-soft bg-ok-soft text-ok' }
        : { text: `⏳ Pending — ${summary.mandatoryPending} mandatory test(s) to record`, cls: 'border-warn-soft bg-warn-soft text-warn' };

  return (
    <section className="rounded-xl border border-border p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">7 · Quality Check → Complete</h3>
        <p className="mt-1 text-xs text-ink-3">
          Record the result and verdict for each spec parameter, then Accept to complete the GRN and put
          stock away, or Reject to return the goods to the vendor.
        </p>
      </div>

      <GrnQcInspectionPanel
        qcSpecs={qcSpecs}
        loading={loading}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="grn-qc-analyst">QC Analyst</label>
          <input
            id="grn-qc-analyst"
            type="text"
            value={qcBy}
            disabled={disabled}
            onChange={(e) => onQcByChange(e.target.value)}
            placeholder="e.g. P. Bhatia"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="grn-qc-date">Test date</label>
          <input
            id="grn-qc-date"
            type="date"
            value={testDate}
            disabled={disabled}
            onChange={(e) => onTestDateChange(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Overall verdict</span>
        <div className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold ${verdictBadge.cls}`}>
          {verdictBadge.text}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="grn-qc-notes">QC Notes</label>
        <textarea
          id="grn-qc-notes"
          value={qcSpecs?.remarks ?? ''}
          disabled={disabled}
          onChange={(e) => {
            if (!qcSpecs) return;
            onChange({ ...qcSpecs, remarks: e.target.value });
          }}
          rows={2}
          placeholder="Reason if reject · special notes"
          className={inputClass}
        />
      </div>
    </section>
  );
};
