import type { GRNRecordFromApi } from '../services/grn.service';
import type {
  GrnQcAttachment,
  GrnQcSpecsStored,
  GrnQcTestRow,
  ThirdPartyOrderMeta,
  ThirdPartyPoStatus,
} from './grnQcSpecs';
export type { ThirdPartyPoStatus } from './grnQcSpecs';
import { deriveAutoPassedFromResult } from './grnQcAutoPass';
import { isThirdPartyQcTest } from './grnQcAutoPass';
import {
  buildQcReferenceNo,
  extractThirdPartyPoRef,
  formatThirdPartyDate,
} from './thirdPartyLabTest';

export type ThirdPartyTrackingRow = {
  id: string;
  grnId: string;
  lineItemId: string;
  testIndex: number;
  poDate: string;
  poDateDisplay: string;
  poNo: string;
  labVendorDisplay: string;
  itemName: string;
  itemCode: string;
  testParameter: string;
  specLimit: string;
  qcRef: string;
  grnNo: string;
  samplePhotoOk: boolean;
  samplePhotoFileName: string | null;
  reportReady: boolean;
  reportFileName: string | null;
  resultValue: string;
  resultDisplay: string;
  resultTone: 'pass' | 'fail' | 'pending' | 'none';
  poStatus: ThirdPartyPoStatus;
  poStatusSublabel: string;
  slaDisplay: string;
  slaTone: 'ok' | 'warn' | 'bad';
  isOverdue: boolean;
  isActive: boolean;
  isInLab: boolean;
  reportReceived: boolean;
  order: ThirdPartyOrderMeta;
  test: GrnQcTestRow;
};

export type ThirdPartyTrackingSummary = {
  active: number;
  inLab: number;
  reportsReceived: number;
  overdue: number;
};

export type ThirdPartyTrackingAction = 'upload-sample' | 'upload-report' | 'view';

export function resolveThirdPartyTrackingAction(row: ThirdPartyTrackingRow): ThirdPartyTrackingAction {
  if (row.poStatus === 'RESULT ENTERED' || row.poStatus === 'CLOSED') return 'view';
  if (!row.samplePhotoOk) return 'upload-sample';
  return 'upload-report';
}

export type ThirdPartyTrackingFilters = {
  search: string;
  status: ThirdPartyPoStatus | 'all';
  lab: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatTrackingPoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()}-${MONTH_SHORT[d.getMonth()]}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type GrnWithRawSpecs = GRNRecordFromApi & { qc_specs?: GrnQcSpecsStored | null };

function readGrnQcSpecs(grn: GrnWithRawSpecs): GrnQcSpecsStored | null {
  return grn.qcSpecs ?? grn.qc_specs ?? null;
}

function normalizeThirdPartyOrder(raw: Record<string, unknown>): ThirdPartyOrderMeta {
  return {
    poNo: String(raw.poNo ?? raw.po_no ?? ''),
    poDate: String(raw.poDate ?? raw.po_date ?? ''),
    labVendorName: String(raw.labVendorName ?? raw.lab_vendor_name ?? 'Lab vendor'),
    labVendorCode: String(raw.labVendorCode ?? raw.lab_vendor_code ?? '—'),
    samplePickupDate: String(raw.samplePickupDate ?? raw.sample_pickup_date ?? ''),
    expectedReportDate: String(raw.expectedReportDate ?? raw.expected_report_date ?? ''),
    samplePhotoUploaded: Boolean(raw.samplePhotoUploaded ?? raw.sample_photo_uploaded),
    samplePhotoFileName:
      raw.samplePhotoFileName != null
        ? String(raw.samplePhotoFileName)
        : raw.sample_photo_file_name != null
          ? String(raw.sample_photo_file_name)
          : undefined,
    samplePhotoAttachmentId:
      raw.samplePhotoAttachmentId != null
        ? String(raw.samplePhotoAttachmentId)
        : raw.sample_photo_attachment_id != null
          ? String(raw.sample_photo_attachment_id)
          : undefined,
    reportUploaded: Boolean(raw.reportUploaded ?? raw.report_uploaded),
    reportFileName:
      raw.reportFileName != null
        ? String(raw.reportFileName)
        : raw.report_file_name != null
          ? String(raw.report_file_name)
          : undefined,
    reportAttachmentId:
      raw.reportAttachmentId != null
        ? String(raw.reportAttachmentId)
        : raw.report_attachment_id != null
          ? String(raw.report_attachment_id)
          : undefined,
    status: (raw.status as ThirdPartyPoStatus) ?? 'PO RELEASED',
  };
}

function normalizeStoredTest(raw: Record<string, unknown>): GrnQcTestRow {
  const thirdPartyRaw = raw.thirdPartyOrder ?? raw.third_party_order;
  return {
    specId: String(raw.specId ?? raw.spec_id ?? ''),
    parameter: String(raw.parameter ?? ''),
    specLimit: String(raw.specLimit ?? raw.spec_limit ?? ''),
    method: String(raw.method ?? ''),
    mandatory: Boolean(raw.mandatory),
    tolerance: String(raw.tolerance ?? ''),
    frequency: String(raw.frequency ?? ''),
    sample: String(raw.sample ?? ''),
    acceptance: String(raw.acceptance ?? ''),
    outputType: raw.outputType != null ? String(raw.outputType) : undefined,
    result: String(raw.result ?? ''),
    passed: raw.passed === true ? true : raw.passed === false ? false : null,
    thirdPartyOrder:
      thirdPartyRaw && typeof thirdPartyRaw === 'object'
        ? normalizeThirdPartyOrder(thirdPartyRaw as Record<string, unknown>)
        : undefined,
  };
}

function normalizeStoredLine(raw: Record<string, unknown>): {
  lineItemId: string;
  itemCode: string;
  itemName: string;
  tests: GrnQcTestRow[];
} {
  const testsRaw = Array.isArray(raw.tests) ? raw.tests : [];
  return {
    lineItemId: String(raw.lineItemId ?? raw.line_item_id ?? ''),
    itemCode: String(raw.itemCode ?? raw.item_code ?? ''),
    itemName: String(raw.itemName ?? raw.item_name ?? ''),
    tests: testsRaw
      .filter((t): t is Record<string, unknown> => t != null && typeof t === 'object')
      .map((t) => normalizeStoredTest(t))
      .filter((t) => t.parameter),
  };
}

function resolveOrder(test: GrnQcTestRow, grn: GRNRecordFromApi): ThirdPartyOrderMeta | null {
  if (test.thirdPartyOrder?.poNo) return test.thirdPartyOrder;
  const poNo = extractThirdPartyPoRef(test.acceptance);
  if (!poNo) return null;
  return {
    poNo,
    poDate: String(grn.grnDate ?? grn.receivedDate ?? new Date().toISOString()),
    labVendorName: 'Lab vendor',
    labVendorCode: '—',
    samplePickupDate: String(grn.grnDate ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    expectedReportDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    status: 'PO RELEASED',
  };
}

export function resolveThirdPartyPoStatus(
  test: GrnQcTestRow,
  order: ThirdPartyOrderMeta,
  samplePhotoOk: boolean,
  reportReady: boolean,
  now = Date.now(),
): ThirdPartyPoStatus {
  const result = String(test.result ?? '').trim();
  if (result && !/^pending$/i.test(result)) return 'RESULT ENTERED';
  if (reportReady || order.reportUploaded) return 'REPORT RECEIVED';
  if (!samplePhotoOk && !order.samplePhotoUploaded) return 'PO RELEASED';
  const pickupMs = startOfDay(new Date(order.samplePickupDate));
  const todayMs = startOfDay(new Date(now));
  if (pickupMs <= todayMs) return 'IN LAB';
  return 'SAMPLE PICKED';
}

function resultToneForTest(test: GrnQcTestRow): ThirdPartyTrackingRow['resultTone'] {
  const result = String(test.result ?? '').trim();
  if (!result || /^pending$/i.test(result)) return 'none';
  if (test.passed === true) return 'pass';
  if (test.passed === false) return 'fail';
  const auto = deriveAutoPassedFromResult(test);
  if (auto === true) return 'pass';
  if (auto === false) return 'fail';
  return 'pending';
}

function buildResultDisplay(test: GrnQcTestRow): string {
  const result = String(test.result ?? '').trim();
  if (!result || /^pending$/i.test(result)) return '—';
  const tone = resultToneForTest(test);
  if (tone === 'pass') return `${result}\n✓ within spec`;
  if (tone === 'fail') return `${result}\n✗ out of spec`;
  return result;
}

function buildSlaView(
  order: ThirdPartyOrderMeta,
  status: ThirdPartyPoStatus,
  now = Date.now(),
): { display: string; tone: ThirdPartyTrackingRow['slaTone']; overdue: boolean } {
  const eta = formatThirdPartyDate(order.expectedReportDate);
  const etaMs = startOfDay(new Date(order.expectedReportDate));
  const todayMs = startOfDay(new Date(now));
  const overdue = etaMs < todayMs && status !== 'RESULT ENTERED' && status !== 'CLOSED';
  if (status === 'RESULT ENTERED' || status === 'CLOSED') {
    return { display: '✓ on time', tone: 'ok', overdue: false };
  }
  if (overdue) {
    return { display: '🚩 overdue', tone: 'bad', overdue: true };
  }
  if (status === 'SAMPLE PICKED' || status === 'IN LAB') {
    const picked = formatThirdPartyDate(order.samplePickupDate);
    return { display: `picked ${picked}\n✓ ETA ${eta}`, tone: 'ok', overdue: false };
  }
  return { display: `✓ ETA ${eta}`, tone: 'warn', overdue: false };
}

function buildStatusSublabel(order: ThirdPartyOrderMeta, status: ThirdPartyPoStatus): string {
  if (status === 'SAMPLE PICKED') {
    return `picked ${formatThirdPartyDate(order.samplePickupDate)}`;
  }
  if (status === 'IN LAB') return 'at external lab';
  if (status === 'REPORT RECEIVED') return 'awaiting result entry';
  if (status === 'PO RELEASED') return 'awaiting sample pickup';
  return '';
}

function findAttachment(
  attachments: GrnQcAttachment[],
  order: ThirdPartyOrderMeta,
  kind: 'sample' | 'report',
): GrnQcAttachment | null {
  const id = kind === 'sample' ? order.samplePhotoAttachmentId : order.reportAttachmentId;
  if (id) {
    const byId = attachments.find((a) => a.id === id);
    if (byId) return byId;
  }
  const fileName = kind === 'sample' ? order.samplePhotoFileName : order.reportFileName;
  if (fileName) {
    const byName = attachments.find((a) => a.fileName === fileName);
    if (byName) return byName;
  }
  return null;
}

function resolveSamplePhotoState(
  order: ThirdPartyOrderMeta,
  qcSpecs: GrnQcSpecsStored | null | undefined,
): { ok: boolean; fileName: string | null } {
  const attachment = findAttachment(qcSpecs?.attachments ?? [], order, 'sample');
  if (attachment || order.samplePhotoUploaded) {
    return {
      ok: true,
      fileName: attachment?.fileName ?? order.samplePhotoFileName ?? null,
    };
  }
  return { ok: false, fileName: null };
}

function resolveReportState(
  order: ThirdPartyOrderMeta,
  qcSpecs: GrnQcSpecsStored | null | undefined,
): { ok: boolean; fileName: string | null } {
  const attachment = findAttachment(qcSpecs?.attachments ?? [], order, 'report');
  if (attachment || order.reportUploaded) {
    return {
      ok: true,
      fileName: attachment?.fileName ?? order.reportFileName ?? null,
    };
  }
  return { ok: false, fileName: null };
}

export function buildThirdPartyOrderAfterSampleUpload(
  order: ThirdPartyOrderMeta,
  attachment: GrnQcAttachment,
  now = Date.now(),
): ThirdPartyOrderMeta {
  const pickupMs = startOfDay(new Date(order.samplePickupDate));
  const todayMs = startOfDay(new Date(now));
  const status: ThirdPartyPoStatus = pickupMs <= todayMs ? 'IN LAB' : 'SAMPLE PICKED';
  return {
    ...order,
    samplePhotoUploaded: true,
    samplePhotoFileName: attachment.fileName,
    samplePhotoAttachmentId: attachment.id,
    status,
  };
}

export function buildThirdPartyOrderAfterReportUpload(
  order: ThirdPartyOrderMeta,
  attachment: GrnQcAttachment,
  hasResult: boolean,
): ThirdPartyOrderMeta {
  return {
    ...order,
    reportUploaded: true,
    reportFileName: attachment.fileName,
    reportAttachmentId: attachment.id,
    status: hasResult ? 'RESULT ENTERED' : 'REPORT RECEIVED',
  };
}

export function extractThirdPartyTrackingRows(
  grns: GrnWithRawSpecs[],
  now = Date.now(),
): ThirdPartyTrackingRow[] {
  const rows: ThirdPartyTrackingRow[] = [];
  for (const grn of grns) {
    const qcSpecs = readGrnQcSpecs(grn);
    const linesRaw = qcSpecs?.lines ?? [];
    const lines = linesRaw
      .map((l) => normalizeStoredLine(l as unknown as Record<string, unknown>))
      .filter((l) => l.lineItemId);
    for (const line of lines) {
      const tests = line.tests ?? [];
      tests.forEach((test, testIndex) => {
        if (!isThirdPartyQcTest(test)) return;
        const order = resolveOrder(test, grn);
        if (!order) return;
        const samplePhoto = resolveSamplePhotoState(order, qcSpecs);
        const report = resolveReportState(order, qcSpecs);
        const poStatus = resolveThirdPartyPoStatus(test, order, samplePhoto.ok, report.ok, now);
        const sla = buildSlaView(order, poStatus, now);
        const resultTone = resultToneForTest(test);
        const isActive = poStatus !== 'CLOSED' && poStatus !== 'RESULT ENTERED' ? true : poStatus === 'RESULT ENTERED' && !order.reportUploaded;
        rows.push({
          id: `${grn.id}::${line.lineItemId}::${testIndex}`,
          grnId: grn.id,
          lineItemId: line.lineItemId,
          testIndex,
          poDate: order.poDate,
          poDateDisplay: formatTrackingPoDate(order.poDate),
          poNo: order.poNo,
          labVendorDisplay: `${order.labVendorName} · ${order.labVendorCode}`,
          itemName: line.itemName || test.parameter,
          itemCode: line.itemCode,
          testParameter: test.parameter,
          specLimit: test.specLimit,
          qcRef: buildQcReferenceNo(grn.grnNo, grn.id),
          grnNo: grn.grnNo,
          samplePhotoOk: samplePhoto.ok,
          samplePhotoFileName: samplePhoto.fileName,
          reportReady: report.ok,
          reportFileName: report.fileName,
          resultValue: String(test.result ?? '').trim(),
          resultDisplay: buildResultDisplay(test),
          resultTone,
          poStatus,
          poStatusSublabel: buildStatusSublabel(order, poStatus),
          slaDisplay: sla.display,
          slaTone: sla.tone,
          isOverdue: sla.overdue,
          isActive: poStatus !== 'CLOSED',
          isInLab: poStatus === 'IN LAB' || poStatus === 'SAMPLE PICKED',
          reportReceived: report.ok || poStatus === 'REPORT RECEIVED' || poStatus === 'RESULT ENTERED',
          order: { ...order, status: poStatus },
          test,
        });
      });
    }
  }
  return rows.sort((a, b) => String(b.poDate).localeCompare(String(a.poDate)));
}

export function summarizeThirdPartyTracking(rows: ThirdPartyTrackingRow[]): ThirdPartyTrackingSummary {
  const active = rows.filter((r) => r.poStatus !== 'RESULT ENTERED' && r.poStatus !== 'CLOSED').length;
  const inLab = rows.filter((r) => r.poStatus === 'IN LAB' || r.poStatus === 'SAMPLE PICKED').length;
  const reportsReceived = rows.filter((r) => r.reportReceived).length;
  const overdue = rows.filter((r) => r.isOverdue).length;
  return { active, inLab, reportsReceived, overdue };
}

export function applyThirdPartyTrackingFilters(
  rows: ThirdPartyTrackingRow[],
  filters: ThirdPartyTrackingFilters,
): ThirdPartyTrackingRow[] {
  let result = rows;
  if (filters.status !== 'all') {
    result = result.filter((r) => r.poStatus === filters.status);
  }
  if (filters.lab !== 'all') {
    result = result.filter((r) => r.labVendorDisplay.toLowerCase().includes(filters.lab.toLowerCase()));
  }
  const q = filters.search.trim().toLowerCase();
  if (q) {
    result = result.filter((r) =>
      [
        r.poNo,
        r.labVendorDisplay,
        r.itemName,
        r.itemCode,
        r.testParameter,
        r.specLimit,
        r.qcRef,
        r.grnNo,
        r.poStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  return result;
}

export function uniqueThirdPartyLabs(rows: ThirdPartyTrackingRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    set.add(row.order.labVendorName);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function exportThirdPartyTrackingCsv(rows: ThirdPartyTrackingRow[]): void {
  const header = [
    'PO Date',
    'PO #',
    'Lab Vendor',
    'Item',
    'Test',
    'Linked QC',
    'Sample Photo',
    'Report',
    'Result',
    'PO Status',
    'SLA',
  ];
  const lines = rows.map((r) =>
    [
      r.poDateDisplay,
      r.poNo,
      r.labVendorDisplay,
      `${r.itemName} (${r.itemCode})`,
      `${r.testParameter} · ${r.specLimit}`,
      r.qcRef,
      r.samplePhotoOk ? 'Yes' : 'No',
      r.reportReady ? 'Yes' : 'No',
      r.resultValue || '—',
      r.poStatus,
      r.slaDisplay.replace(/\n/g, ' '),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `third-party-test-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function poStatusBadgeClass(status: ThirdPartyPoStatus): string {
  switch (status) {
    case 'RESULT ENTERED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'REPORT RECEIVED':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'IN LAB':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'SAMPLE PICKED':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
