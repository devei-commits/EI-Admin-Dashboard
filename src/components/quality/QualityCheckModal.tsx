import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  fetchGRNById,
  fetchGRNQcReference,
  updateGRN,
  type GRNRecordFromApi,
} from '../../services/grn.service';
import type { QualityOrderManagementInput } from '../../lib/qualityOrderManagementTableDisplay';
import {
  formatQualityApproverDisplay,
  formatQualityAssigneeShortName,
  type QualityOrderManagementRow,
} from '../../lib/qualityOrderManagementTableDisplay';
import {
  buildChecklistProgressMessage,
  buildChecklistVerdict,
  buildExpectedQcCompletion,
  buildQualityCheckCategorySection,
  buildQualityCheckHeaderSubtitle,
  buildQualityCheckHeaderTitle,
  canCompleteQualityCheck,
  resolveQcWorkflowStages,
  thirdPartyActionLabel,
  type QcWorkflowStage,
} from '../../lib/qualityCheckModalDisplay';
import {
  deriveGrnQcStatusFromSpecs,
  grnQcCompletionBlockers,
  resolveGrnQcLineForItem,
  type GrnQcSpecsStored,
  updateGrnQcTestAt,
} from '../../lib/grnQcSpecs';
import { isThirdPartyQcTest } from '../../lib/grnQcAutoPass';
import { GrnQcResultInput } from './GrnQcResultInput';
import QualityCheckAttachmentsSection from './QualityCheckAttachmentsSection';
import { displayInboundGrnNo } from '../../lib/inboundGrnTableDisplay';

type QualityCheckModalProps = {
  row: QualityOrderManagementRow;
  assigneeOptions: string[];
  /** Warehouse view: read-only snapshot of quality team's submitted report. */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type QcStatusLabel = 'Under test' | 'Passed' | 'Rejected';

function normalizeQcStatus(s: string | undefined): QcStatusLabel {
  const v = String(s ?? '').trim();
  if (v === 'Passed' || v === 'Pass') return 'Passed';
  if (v === 'Rejected' || v === 'Fail' || v === 'Failed') return 'Rejected';
  return 'Under test';
}

const WORKFLOW_STAGES: QcWorkflowStage[] = ['QC INITIATED', 'QC COMPLETED', 'APPROVED', 'CLOSED'];

const QualityCheckModal: React.FC<QualityCheckModalProps> = ({
  row,
  assigneeOptions,
  readOnly = false,
  onClose,
  onSaved,
}) => {
  const [grn, setGrn] = useState<GRNRecordFromApi | null>(null);
  const [qcSpecs, setQcSpecs] = useState<GrnQcSpecsStored | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [qcBy, setQcBy] = useState('');

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const [grnRow, qcRef] = await Promise.all([fetchGRNById(row.id), fetchGRNQcReference(row.id)]);
      if (!grnRow) throw new Error('GRN not found');
      setGrn(grnRow);
      setQcSpecs({
        ...qcRef.qcSpecs,
        attachments: qcRef.qcSpecs.attachments ?? [],
      });
      setAssignedTo(String(grnRow.assignedTo ?? row.assignedTo ?? '').trim());
      setQcBy(String(grnRow.qcBy ?? row.approver ?? '').trim());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load QC data');
    } finally {
      setLoading(false);
    }
  }, [row.approver, row.assignedTo, row.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const grnInput = useMemo((): QualityOrderManagementInput | null => {
    if (!grn) return null;
    return {
      id: grn.id,
      grnNo: grn.grnNo,
      poNo: grn.poNo,
      vendor: grn.vendor,
      type: grn.type,
      status: grn.status,
      qcStatus: grn.qcStatus,
      assignedTo,
      qcBy,
      grnDate: grn.grnDate,
      receivedDate: grn.receivedDate,
      expectedDate: grn.expectedDate,
      receiptSource: grn.receiptSource,
      locationZone: grn.locationZone,
      workflowSteps: grn.workflowSteps,
      generatedLabels: grn.generatedLabels,
      lineItems: grn.lineItems,
    };
  }, [assignedTo, grn, qcBy]);

  const qcLine = useMemo(
    () => resolveGrnQcLineForItem(qcSpecs, row.itemCode, row.itemName),
    [qcSpecs, row.itemCode, row.itemName],
  );
  const workflow = resolveQcWorkflowStages(grnInput ?? { id: row.id, grnNo: row.grnSourceNo, lineItems: [] }, qcSpecs);
  const canComplete = canCompleteQualityCheck(qcSpecs);
  const blockers = grnQcCompletionBlockers(qcSpecs);
  const derivedStatus = normalizeQcStatus(deriveGrnQcStatusFromSpecs(qcSpecs));

  const persist = async (opts: { complete?: boolean; reject?: boolean }): Promise<void> => {
    if (!grn || !qcSpecs) return;
    setSaving(true);
    setSaveError(null);
    try {
      let qcStatus: string | undefined;
      if (opts.reject) qcStatus = 'Rejected';
      else if (opts.complete) qcStatus = 'Passed';
      else qcStatus = deriveGrnQcStatusFromSpecs(qcSpecs);

      await updateGRN(grn.id, {
        assignedTo: assignedTo || undefined,
        qcBy: qcBy || undefined,
        qcSpecs,
        qcStatus,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputsDisabled = saving || readOnly;

  const approverOptions = useMemo(() => {
    const set = new Set(assigneeOptions);
    if (qcBy) set.add(qcBy);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [assigneeOptions, qcBy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-6">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="qc-check-title"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="qc-check-title" className="text-lg font-bold text-slate-900">
              {grnInput ? buildQualityCheckHeaderTitle(grnInput) : row.itemName}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {grnInput ? buildQualityCheckHeaderSubtitle(grnInput) : row.grnSourceNo}
            </p>
            {readOnly ? (
              <p className="text-[11px] text-teal-800 font-medium mt-1">
                Quality report — read-only view of data submitted by the quality team
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!readOnly ? (
              <button
                type="button"
                disabled={!canComplete || saving}
                onClick={() => void persist({ complete: true })}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 disabled:opacity-40"
              >
                Complete QC
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Close QC check"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/80">
          {loading ? (
            <p className="text-sm text-slate-500">Loading QC checklist from master…</p>
          ) : loadError ? (
            <p className="text-sm text-rose-700" role="alert">
              {loadError}
            </p>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3">📦 Source &amp; item details (read-only)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Item Code</p>
                    <p className="font-mono font-semibold text-slate-900">{row.itemCode}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-500">Item Name</p>
                    <p className="font-semibold text-slate-900">{row.itemName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Category × Section</p>
                    <p className="font-semibold text-slate-900">{grnInput ? buildQualityCheckCategorySection(grnInput) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">GRN #</p>
                    <p className="font-mono font-semibold text-teal-800">{displayInboundGrnNo(grn?.grnNo ?? row.grnSourceNo)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Qty in Q</p>
                    <p className="font-semibold text-slate-900">{row.qtyInQ}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-500">Vendor</p>
                    <p className="font-semibold text-slate-900">{grn?.vendor || '—'}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">🔄 QC status &amp; assignment</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WORKFLOW_STAGES.map((stage) => {
                    const st = workflow[stage];
                    return (
                      <div
                        key={stage}
                        className={`rounded-lg border px-3 py-2 ${
                          st.active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <p className={`text-[10px] font-bold tracking-wide ${st.active ? 'text-teal-800' : 'text-slate-500'}`}>
                          {stage}
                        </p>
                        <p className="text-[11px] text-slate-700 mt-1">{st.detail ?? (st.active ? '—' : '— pending')}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                  <label className="block text-xs">
                    <span className="font-semibold text-slate-700">QC Assignee</span>
                    <span className="mt-1 inline-flex items-center gap-0.5 w-full">
                      <select
                        value={assignedTo}
                        disabled={inputsDisabled}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full mt-1 border border-slate-300 rounded-lg px-2 py-2 text-xs bg-white"
                      >
                        <option value="">Open</option>
                        {assigneeOptions.map((name) => (
                          <option key={name} value={name}>
                            {formatQualityAssigneeShortName(name)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-slate-700">QC Approver</span>
                    <select
                      value={qcBy}
                      disabled={inputsDisabled}
                      onChange={(e) => setQcBy(e.target.value)}
                      className="w-full mt-1 border border-slate-300 rounded-lg px-2 py-2 text-xs bg-white"
                    >
                      <option value="">Select approver…</option>
                      {approverOptions.map((name) => (
                        <option key={name} value={name}>
                          {formatQualityApproverDisplay(name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-700">Expected Completion</p>
                    <p className="mt-2 text-slate-800">📅 {grnInput ? buildExpectedQcCompletion(grnInput) : '—'}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-900">
                    📋 Quality checklist
                  </h3>
                  {qcLine?.testsSource === 'default-inbound' && (
                    <p className="text-[11px] text-sky-700 mt-1">
                      Item not linked to an RM/PM master — using default inbound checklist. Link the GRN line or add specs under RM/PM Quality Specifications.
                    </p>
                  )}
                  {qcLine?.testsSource === 'master' && qcLine.tests.length === 0 && qcLine.masterId != null && (
                    <p className="text-[11px] text-amber-800 mt-1">
                      No QC parameters configured on this item&apos;s master. Add specs under {qcLine.masterType === 'PM' ? 'Packaging' : 'Raw Material'} → GRN Quality Checks.
                    </p>
                  )}
                </div>
                {!qcLine || qcLine.tests.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    {qcLine?.masterId != null
                      ? 'No checklist rows to complete for this item.'
                      : 'No QC parameters loaded for this line.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 w-8">#</th>
                          <th className="px-3 py-2 min-w-[8rem]">Parameter</th>
                          <th className="px-3 py-2 min-w-[8rem]">Spec (from master)</th>
                          <th className="px-3 py-2 min-w-[7rem]">Method</th>
                          <th className="px-3 py-2 w-16">Mandatory</th>
                          <th className="px-3 py-2 min-w-[9rem]">Entry / Result</th>
                          <th className="px-3 py-2 w-24">Pass/Fail (auto)</th>
                          <th className="px-3 py-2 min-w-[8rem]">3rd-party?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qcLine.tests.map((test, testIdx) => {
                          const verdict = buildChecklistVerdict(test);
                          const thirdParty = thirdPartyActionLabel(test);
                          return (
                            <tr key={`${test.specId}-${testIdx}`} className="border-b border-slate-100 align-top">
                              <td className="px-3 py-3 text-slate-500 tabular-nums">{testIdx + 1}</td>
                              <td className="px-3 py-3 font-semibold text-slate-900">{test.parameter}</td>
                              <td className="px-3 py-3 text-slate-700">{test.specLimit || '—'}</td>
                              <td className="px-3 py-3 text-slate-600">{test.method || '—'}</td>
                              <td className="px-3 py-3 text-center">{test.mandatory ? '✓' : '—'}</td>
                              <td className="px-3 py-3">
                                <GrnQcResultInput
                                  id={`qc-result-${testIdx}`}
                                  test={test}
                                  disabled={inputsDisabled}
                                  onChange={(value) => {
                                    if (!qcSpecs || !qcLine) return;
                                    setQcSpecs(
                                      updateGrnQcTestAt(qcSpecs, qcLine.lineItemId, testIdx, { result: value }),
                                    );
                                  }}
                                />
                              </td>
                              <td
                                className={`px-3 py-3 font-bold whitespace-nowrap ${
                                  verdict.tone === 'pass'
                                    ? 'text-emerald-700'
                                    : verdict.tone === 'fail'
                                      ? 'text-rose-700'
                                      : 'text-amber-700'
                                }`}
                              >
                                {verdict.label}
                              </td>
                              <td className="px-3 py-3">
                                {isThirdPartyQcTest(test) ? (
                                  thirdParty ? (
                                    readOnly ? (
                                      <span className="text-[11px] font-semibold text-violet-800">{thirdParty}</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="text-[11px] font-semibold text-violet-800 hover:underline"
                                        onClick={() => {
                                          if (thirdParty.startsWith('🧫')) {
                                            window.alert('3rd-party lab PO flow will open here (§4B).');
                                          }
                                        }}
                                      >
                                        {thirdParty}
                                      </button>
                                    )
                                  ) : (
                                    '—'
                                  )
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="px-4 py-3 text-[11px] text-slate-600 border-t border-slate-100 bg-slate-50">
                  {buildChecklistProgressMessage(qcSpecs)}
                </p>
              </section>

              {grn && qcSpecs ? (
                <QualityCheckAttachmentsSection
                  grn={grn}
                  qcSpecs={qcSpecs}
                  disabled={inputsDisabled}
                  uploadedBy={assignedTo || undefined}
                  onChange={setQcSpecs}
                />
              ) : null}

              {!readOnly ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3">✅ Decision</h3>
                {saveError ? (
                  <p className="text-xs text-rose-700 mb-3" role="alert">
                    {saveError}
                  </p>
                ) : null}
                {blockers.length > 0 && derivedStatus !== 'Rejected' ? (
                  <ul className="text-[11px] text-amber-800 mb-3 list-disc pl-4 space-y-1">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canComplete || saving}
                    onClick={() => void persist({ complete: true })}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-40"
                  >
                    ✓ Complete QC (move to APPROVED)
                  </button>
                  <button
                    type="button"
                    disabled={saving || !qcSpecs}
                    onClick={() => void persist({})}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    📝 Save Progress
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void persist({ reject: true })}
                    className="px-4 py-2 rounded-lg border border-rose-300 bg-rose-50 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
                  >
                    ✗ Reject (any param failed)
                  </button>
                </div>
              </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityCheckModal;
