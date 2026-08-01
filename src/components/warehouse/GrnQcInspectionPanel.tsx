import { AlertTriangle, Check, CircleDot, X } from 'lucide-react';
import type { GrnQcSpecsStored } from '../../lib/grnQcSpecs';
import {
  cycleGrnQcTestPassed,
  summarizeGrnQcTests,
  updateGrnQcTestAt,
} from '../../lib/grnQcSpecs';

interface GrnQcInspectionPanelProps {
  qcSpecs: GrnQcSpecsStored | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onChange: (next: GrnQcSpecsStored) => void;
}

export function GrnQcInspectionPanel({
  qcSpecs,
  loading,
  error,
  disabled = false,
  onChange,
}: GrnQcInspectionPanelProps): JSX.Element {
  const summary = summarizeGrnQcTests(qcSpecs);
  const lines = qcSpecs?.lines ?? [];
  const usesDefaultInbound = lines.some((l) => l.testsSource === 'default-inbound');
  const hasAnyTests = summary.total > 0;
  const allLinesMissingMaster = lines.length > 0 && lines.every((l) => l.masterId == null);

  if (loading) {
    return <p className="text-xs text-ink-3">Loading quality specs from item master…</p>;
  }

  if (error) {
    return (
      <p className="text-xs text-err" role="alert">
        {error}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="text-xs text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
        No GRN line items to inspect.
      </p>
    );
  }

  if (allLinesMissingMaster) {
    return (
      <p className="text-xs text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
        Could not link this GRN line to an RM/PM master. Save the GRN after PO receipt so the item code resolves, or fix the line item master link.
      </p>
    );
  }

  if (!hasAnyTests) {
    return (
      <p className="text-xs text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
        No QC tests could be loaded. Refresh the page or contact support if this persists.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {usesDefaultInbound && (
        <p className="text-xs text-brand bg-brand-soft border border-brand rounded-lg px-3 py-2">
          This item has no quality specs on its master. Using the <strong>standard inbound QC checklist</strong> (visual inspection + quantity check). Add tabular specs under RM/PM <strong>Quality Specifications</strong> to replace these defaults.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
          <span className="text-xs font-semibold text-ink-2">
            {summary.total} tests · {summary.mandatory} Mand
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ok-soft text-ok font-bold text-[10px]">
            <Check size={10} /> {summary.passed} passed
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-err-soft text-err font-bold text-[10px]">
            <X size={10} /> {summary.failed} failed
          </span>
          {summary.mandatoryPending > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warn-soft text-warn font-bold text-[10px]">
              <CircleDot size={10} /> {summary.mandatoryPending} Mand pending
            </span>
          )}
          {summary.optionalSkipped > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 text-ink-2 font-bold text-[10px]">
              {summary.optionalSkipped} optional skipped
            </span>
          )}
          {summary.failed > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-err">
              <AlertTriangle size={12} /> QC will be Rejected
            </span>
          )}
          {summary.mandatoryPending === 0 && summary.failed === 0 && summary.mandatory > 0 && (
            <span className="ml-auto text-[10px] font-bold text-ok">All mandatory tests passed</span>
          )}
          {summary.mandatory === 0 && summary.failed === 0 && summary.total > 0 && (
            <span className="ml-auto text-[10px] font-bold text-ok">No mandatory tests — optional only</span>
          )}
        </div>

      {lines.map((line) => (
        <div key={line.lineItemId} className="rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-surface-3 border-b border-border flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-brand">{line.itemCode || '—'}</span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand">
              {line.masterType}
            </span>
            <span className="text-xs font-medium text-ink truncate">{line.itemName || '—'}</span>
            {line.testsSource === 'default-inbound' && (
              <span className="text-[10px] font-medium text-brand">· default inbound checklist</span>
            )}
          </div>

          {line.tests.length === 0 ? (
            <p className="text-xs text-ink-3 px-3 py-3">No QC tests for this line.</p>
          ) : (
            <div>
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_90px] gap-2 px-3 py-2 bg-surface-2 border-b border-hairline text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                <div>Parameter</div>
                <div>Spec limit</div>
                <div>Method</div>
                <div>Result</div>
                <div>Verdict</div>
              </div>
              {line.tests.map((test, testIdx) => {
                const rowBg =
                  test.passed === true
                    ? 'bg-ok-soft/50'
                    : test.passed === false
                      ? 'bg-err-soft/50'
                      : '';
                return (
                  <div
                    key={`${line.lineItemId}-${test.specId}-${testIdx}`}
                    className={`grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_90px] gap-2 px-3 py-2.5 border-b border-hairline items-center ${rowBg}`}
                  >
                    <div className="text-xs font-semibold text-ink flex items-start gap-1.5 min-w-0">
                      {test.passed === true && <Check size={12} className="text-ok shrink-0 mt-0.5" />}
                      {test.passed === false && <X size={12} className="text-err shrink-0 mt-0.5" />}
                      {test.passed === null && <CircleDot size={12} className="text-ink-4 shrink-0 mt-0.5" />}
                      <span className="flex flex-wrap items-center gap-1">
                        {test.parameter}
                        {test.mandatory ? (
                          <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-warn-soft text-warn">
                            Mand
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium uppercase px-1 py-0.5 rounded bg-surface-3 text-ink-3">
                            Optional
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-2 font-mono truncate" title={test.specLimit}>
                      {test.specLimit || '—'}
                    </div>
                    <div className="text-[11px] text-ink-3 truncate" title={test.method}>
                      {test.method || '—'}
                    </div>
                    <input
                      type="text"
                      disabled={disabled}
                      value={test.result}
                      placeholder="Measured"
                      aria-label={`Result for ${test.parameter}`}
                      className={`border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-brand focus:outline-none bg-surface disabled:bg-surface-2 ${
                        String(test.result ?? '').trim()
                          ? 'border-border'
                          : test.mandatory
                            ? 'border-warn'
                            : 'border-border'
                      }`}
                      onChange={(e) => {
                        if (!qcSpecs) return;
                        onChange(updateGrnQcTestAt(qcSpecs, line.lineItemId, testIdx, { result: e.target.value }));
                      }}
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Toggle verdict for ${test.parameter}`}
                      onClick={() => {
                        if (!qcSpecs) return;
                        onChange(
                          updateGrnQcTestAt(qcSpecs, line.lineItemId, testIdx, {
                            passed: cycleGrnQcTestPassed(test.passed),
                          })
                        );
                      }}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                        test.passed === true
                          ? 'bg-ok-soft border-ok text-ok'
                          : test.passed === false
                            ? 'bg-err-soft border-err text-err'
                            : 'bg-surface-2 border-border text-ink-3'
                      }`}
                    >
                      {test.passed === true ? 'Pass' : test.passed === false ? 'Fail' : 'Pending'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
