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
    return <p className="text-xs text-slate-500">Loading quality specs from item master…</p>;
  }

  if (error) {
    return (
      <p className="text-xs text-rose-700" role="alert">
        {error}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        No GRN line items to inspect.
      </p>
    );
  }

  if (allLinesMissingMaster) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Could not link this GRN line to an RM/PM master. Save the GRN after PO receipt so the item code resolves, or fix the line item master link.
      </p>
    );
  }

  if (!hasAnyTests) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        No QC tests could be loaded. Refresh the page or contact support if this persists.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {usesDefaultInbound && (
        <p className="text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
          This item has no quality specs on its master. Using the <strong>standard inbound QC checklist</strong> (visual inspection + quantity check). Add tabular specs under RM/PM <strong>Quality Specifications</strong> to replace these defaults.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
          <span className="text-xs font-semibold text-slate-600">
            {summary.total} tests · {summary.mandatory} Mand
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
            <Check size={10} /> {summary.passed} passed
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
            <X size={10} /> {summary.failed} failed
          </span>
          {summary.mandatoryPending > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
              <CircleDot size={10} /> {summary.mandatoryPending} Mand pending
            </span>
          )}
          {summary.optionalSkipped > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
              {summary.optionalSkipped} optional skipped
            </span>
          )}
          {summary.failed > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-rose-700">
              <AlertTriangle size={12} /> QC will be Rejected
            </span>
          )}
          {summary.mandatoryPending === 0 && summary.failed === 0 && summary.mandatory > 0 && (
            <span className="ml-auto text-[10px] font-bold text-emerald-700">All mandatory tests passed</span>
          )}
          {summary.mandatory === 0 && summary.failed === 0 && summary.total > 0 && (
            <span className="ml-auto text-[10px] font-bold text-emerald-700">No mandatory tests — optional only</span>
          )}
        </div>

      {lines.map((line) => (
        <div key={line.lineItemId} className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-700">{line.itemCode || '—'}</span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              {line.masterType}
            </span>
            <span className="text-xs font-medium text-slate-800 truncate">{line.itemName || '—'}</span>
            {line.testsSource === 'default-inbound' && (
              <span className="text-[10px] font-medium text-sky-700">· default inbound checklist</span>
            )}
          </div>

          {line.tests.length === 0 ? (
            <p className="text-xs text-slate-500 px-3 py-3">No QC tests for this line.</p>
          ) : (
            <div>
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_90px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <div>Parameter</div>
                <div>Spec limit</div>
                <div>Method</div>
                <div>Result</div>
                <div>Verdict</div>
              </div>
              {line.tests.map((test, testIdx) => {
                const rowBg =
                  test.passed === true
                    ? 'bg-emerald-50/50'
                    : test.passed === false
                      ? 'bg-rose-50/50'
                      : '';
                return (
                  <div
                    key={`${line.lineItemId}-${test.specId}-${testIdx}`}
                    className={`grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_90px] gap-2 px-3 py-2.5 border-b border-slate-50 items-center ${rowBg}`}
                  >
                    <div className="text-xs font-semibold text-slate-800 flex items-start gap-1.5 min-w-0">
                      {test.passed === true && <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />}
                      {test.passed === false && <X size={12} className="text-rose-500 shrink-0 mt-0.5" />}
                      {test.passed === null && <CircleDot size={12} className="text-slate-300 shrink-0 mt-0.5" />}
                      <span className="flex flex-wrap items-center gap-1">
                        {test.parameter}
                        {test.mandatory ? (
                          <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-800">
                            Mand
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-500">
                            Optional
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono truncate" title={test.specLimit}>
                      {test.specLimit || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate" title={test.method}>
                      {test.method || '—'}
                    </div>
                    <input
                      type="text"
                      disabled={disabled}
                      value={test.result}
                      placeholder="Measured"
                      aria-label={`Result for ${test.parameter}`}
                      className={`border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white disabled:bg-slate-50 ${
                        String(test.result ?? '').trim()
                          ? 'border-slate-300'
                          : test.mandatory
                            ? 'border-amber-300'
                            : 'border-slate-200'
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
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : test.passed === false
                            ? 'bg-rose-100 border-rose-300 text-rose-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
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
