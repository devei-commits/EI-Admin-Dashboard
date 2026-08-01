import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchGRNList, updateGRN } from '../../services/grn.service';
import type { GRNRecordFromApi } from '../../services/grn.service';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  applyThirdPartyTrackingFilters,
  buildThirdPartyOrderAfterReportUpload,
  buildThirdPartyOrderAfterSampleUpload,
  exportThirdPartyTrackingCsv,
  extractThirdPartyTrackingRows,
  poStatusBadgeClass,
  resolveThirdPartyTrackingAction,
  summarizeThirdPartyTracking,
  uniqueThirdPartyLabs,
  type ThirdPartyPoStatus,
  type ThirdPartyTrackingFilters,
  type ThirdPartyTrackingRow,
} from '../../lib/thirdPartyTestTrackingDisplay';
import {
  addGrnQcAttachment,
  createGrnQcAttachment,
  updateGrnQcTestAt,
  type GrnQcSpecsStored,
} from '../../lib/grnQcSpecs';
import ThirdPartyUploadReportModal from '../../components/quality/ThirdPartyUploadReportModal';
import ThirdPartyUploadSampleModal from '../../components/quality/ThirdPartyUploadSampleModal';
import ThirdPartyTestModal from '../../components/quality/ThirdPartyTestModal';
import type { QualityOrderManagementRow } from '../../lib/qualityOrderManagementTableDisplay';
import { buildQualityOrderManagementRowForGrnLine } from '../../lib/qualityOrderManagementTableDisplay';
import type { QualityOrderManagementInput } from '../../lib/qualityOrderManagementTableDisplay';

const STATUS_OPTIONS: Array<ThirdPartyPoStatus | 'all'> = [
  'all',
  'PO RELEASED',
  'SAMPLE PICKED',
  'IN LAB',
  'REPORT RECEIVED',
  'RESULT ENTERED',
];

const FILTER_SELECT_CLASS =
  'rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-ink-2 focus:outline-none focus:ring-2 focus:ring-violet-500';

const ThirdPartyTestTracking: React.FC = () => {
  const location = useLocation();
  const [grns, setGrns] = useState<GRNRecordFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ThirdPartyTrackingFilters>({
    search: '',
    status: 'all',
    lab: 'all',
  });
  const [uploadRow, setUploadRow] = useState<ThirdPartyTrackingRow | null>(null);
  const [sampleRow, setSampleRow] = useState<ThirdPartyTrackingRow | null>(null);
  const [viewRow, setViewRow] = useState<ThirdPartyTrackingRow | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await fetchGRNList();
      setGrns(list as GRNRecordFromApi[]);
    } catch {
      setGrns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const allRows = useMemo(() => extractThirdPartyTrackingRows(grns), [grns]);
  const summary = useMemo(() => summarizeThirdPartyTracking(allRows), [allRows]);
  const labs = useMemo(() => uniqueThirdPartyLabs(allRows), [allRows]);
  const tableRows = useMemo(() => applyThirdPartyTrackingFilters(allRows, filters), [allRows, filters]);

  const saveSamplePhoto = async (row: ThirdPartyTrackingRow, file: File): Promise<void> => {
    const grn = grns.find((g) => g.id === row.grnId);
    if (!grn?.qcSpecs) throw new Error('GRN QC data not found');
    const attachment = createGrnQcAttachment(file.name, 'Sample photo', 'Quality team');
    let qcSpecs: GrnQcSpecsStored = { ...grn.qcSpecs, lines: [...grn.qcSpecs.lines] };
    const nextOrder = buildThirdPartyOrderAfterSampleUpload(row.order, attachment);
    qcSpecs = updateGrnQcTestAt(qcSpecs, row.lineItemId, row.testIndex, {
      thirdPartyOrder: nextOrder,
    });
    qcSpecs = addGrnQcAttachment(qcSpecs, attachment);
    await updateGRN(grn.id, { qcSpecs });
    await load();
  };

  const saveReport = async (row: ThirdPartyTrackingRow, result: string, file: File): Promise<void> => {
    const grn = grns.find((g) => g.id === row.grnId);
    if (!grn?.qcSpecs) throw new Error('GRN QC data not found');
    const attachment = createGrnQcAttachment(file.name, 'Lab report', 'Quality team');
    let qcSpecs: GrnQcSpecsStored = { ...grn.qcSpecs, lines: [...grn.qcSpecs.lines] };
    const nextOrder = buildThirdPartyOrderAfterReportUpload(row.order, attachment, true);
    qcSpecs = updateGrnQcTestAt(qcSpecs, row.lineItemId, row.testIndex, {
      result,
      thirdPartyOrder: nextOrder,
    });
    qcSpecs = addGrnQcAttachment(qcSpecs, attachment);
    await updateGRN(grn.id, { qcSpecs });
    await load();
  };

  const viewModalContext = useMemo(() => {
    if (!viewRow) return null;
    const grn = grns.find((g) => g.id === viewRow.grnId);
    if (!grn) return null;
    const input: QualityOrderManagementInput = {
      id: grn.id,
      grnNo: grn.grnNo,
      poNo: grn.poNo,
      vendor: grn.vendor,
      type: grn.type,
      status: grn.status,
      qcStatus: grn.qcStatus,
      assignedTo: grn.assignedTo,
      qcBy: grn.qcBy,
      grnDate: grn.grnDate,
      receivedDate: grn.receivedDate,
      lineItems: grn.lineItems,
      workflowSteps: grn.workflowSteps,
      locationZone: grn.locationZone,
    };
    const line = grn.lineItems?.find((li) => li.id === viewRow.lineItemId) ?? grn.lineItems?.[0];
    const omRow: QualityOrderManagementRow = buildQualityOrderManagementRowForGrnLine(input, line);
    return { grn, omRow, test: viewRow.test, testIndex: viewRow.testIndex };
  }, [viewRow, grns]);

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-[96rem] mx-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Quality / Integration</p>
            <h1 className="text-2xl font-bold text-ink mt-1">3rd-Party Test PO Tracking</h1>
            <p className="text-sm text-violet-900 mt-2 font-medium">
              🧫 3rd-Party Test PO Tracking · {summary.active} active · {summary.inLab} in lab ·{' '}
              {summary.reportsReceived} reports received
              {summary.overdue > 0 ? ` · 🚩 ${summary.overdue} overdue` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-ink-2">Filter by Status · Lab · Item · Export</p>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={filters.search}
                onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
                placeholder="Search PO, lab, item…"
                className="w-48"
              />
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value as ThirdPartyPoStatus | 'all' }))
                }
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? 'All statuses' : opt}
                  </option>
                ))}
              </select>
              <select
                value={filters.lab}
                onChange={(e) => setFilters((prev) => ({ ...prev, lab: e.target.value }))}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by lab"
              >
                <option value="all">All labs</option>
                {labs.map((lab) => (
                  <option key={lab} value={lab}>
                    {lab}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => exportThirdPartyTrackingCsv(tableRows)}
                disabled={tableRows.length === 0}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-sm text-ink-3">Loading 3rd-party test POs…</p>
          ) : tableRows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-3">
              No released 3rd-party test POs yet. Release a PO from Quality → Order Management → QC checklist.
            </p>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs min-w-[1100px]">
                <thead className="sticky top-0 z-20">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-ink-3 bg-surface-2 border-b border-border [&_th]:bg-surface-2">
                    <th scope="col" className="px-3 py-2">PO Date</th>
                    <th scope="col" className="px-3 py-2">PO #</th>
                    <th scope="col" className="px-3 py-2">Lab Vendor</th>
                    <th scope="col" className="px-3 py-2 min-w-[10rem]">Item + Test</th>
                    <th scope="col" className="px-3 py-2">Linked QC</th>
                    <th scope="col" className="px-3 py-2 text-center">Sample Photo</th>
                    <th scope="col" className="px-3 py-2 text-center">Report</th>
                    <th scope="col" className="px-3 py-2">Result</th>
                    <th scope="col" className="px-3 py-2">PO Status</th>
                    <th scope="col" className="px-3 py-2">SLA</th>
                    <th scope="col" className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.id} className="border-b border-hairline align-top hover:bg-surface-2/80">
                      <td className="px-3 py-3 text-ink-2 whitespace-nowrap">{row.poDateDisplay}</td>
                      <td className="px-3 py-3 font-mono font-semibold text-violet-800 whitespace-nowrap">
                        {row.poNo}
                      </td>
                      <td className="px-3 py-3 text-ink">{row.labVendorDisplay}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{row.itemName}</p>
                        <p className="text-[10px] text-ink-2 mt-0.5">
                          {row.testParameter}
                          {row.specLimit ? ` · ${row.specLimit}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-mono text-teal-800">{row.qcRef}</td>
                      <td className="px-3 py-3 text-center">
                        {row.samplePhotoOk ? (
                          <span className="text-ok font-semibold" title={row.samplePhotoFileName ?? undefined}>
                            ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSampleRow(row)}
                            className="text-violet-800 font-bold hover:underline"
                            title="Upload sample photo"
                          >
                            +
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.reportReady ? (
                          <span className="text-ok font-semibold" title={row.reportFileName ?? undefined}>
                            ✓
                          </span>
                        ) : row.samplePhotoOk ? (
                          <button
                            type="button"
                            onClick={() => setUploadRow(row)}
                            className="text-violet-800 font-bold hover:underline"
                            title="Upload lab report"
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-pre-line">
                        <span
                          className={
                            row.resultTone === 'pass'
                              ? 'text-ok font-semibold'
                              : row.resultTone === 'fail'
                                ? 'text-rose-700 font-semibold'
                                : 'text-ink-3'
                          }
                        >
                          {row.resultDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex flex-col px-2 py-1 rounded border text-[10px] font-bold leading-tight ${poStatusBadgeClass(row.poStatus)}`}
                        >
                          {row.poStatus}
                          {row.poStatusSublabel ? (
                            <span className="font-normal text-[9px] mt-0.5 opacity-90">{row.poStatusSublabel}</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-pre-line">
                        <span
                          className={
                            row.slaTone === 'bad'
                              ? 'text-rose-700 font-semibold'
                              : row.slaTone === 'ok'
                                ? 'text-ok'
                                : 'text-warn'
                          }
                        >
                          {row.slaDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const action = resolveThirdPartyTrackingAction(row);
                          if (action === 'view') {
                            return (
                              <button
                                type="button"
                                onClick={() => setViewRow(row)}
                                className="text-[11px] font-semibold text-violet-800 hover:underline"
                              >
                                View
                              </button>
                            );
                          }
                          if (action === 'upload-sample') {
                            return (
                              <button
                                type="button"
                                onClick={() => setSampleRow(row)}
                                className="text-[11px] font-semibold text-violet-800 hover:underline"
                              >
                                📷 Upload Sample
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => setUploadRow(row)}
                              className="text-[11px] font-semibold text-violet-800 hover:underline"
                            >
                              📎 Upload Report
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {sampleRow ? (
        <ThirdPartyUploadSampleModal
          row={sampleRow}
          onClose={() => setSampleRow(null)}
          onSave={(file) => saveSamplePhoto(sampleRow, file)}
        />
      ) : null}

      {uploadRow ? (
        <ThirdPartyUploadReportModal
          row={uploadRow}
          onClose={() => setUploadRow(null)}
          onSave={(result, file) => saveReport(uploadRow, result, file)}
        />
      ) : null}

      {viewModalContext && viewRow ? (
        <ThirdPartyTestModal
          row={viewModalContext.omRow}
          grn={viewModalContext.grn}
          qcLine={
            viewModalContext.grn.qcSpecs?.lines.find((l) => l.lineItemId === viewRow.lineItemId) ?? {
              lineItemId: viewRow.lineItemId,
              itemCode: viewRow.itemCode,
              itemName: viewRow.itemName,
              masterType: 'RM',
              masterId: null,
              tests: [viewRow.test],
            }
          }
          test={viewRow.test}
          testIndex={viewRow.testIndex}
          existingPoRef={viewRow.poNo}
          onClose={() => setViewRow(null)}
          onReleased={async () => {
            /* view only */
          }}
        />
      ) : null}
    </div>
  );
};

export default ThirdPartyTestTracking;
