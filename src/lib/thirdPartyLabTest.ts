import type { VendorClientRecord } from '../services/vendorClient.service';
import type { GrnQcTestRow, ThirdPartyOrderMeta, ThirdPartyPoStatus } from './grnQcSpecs';
import { isThirdPartyQcTest } from './grnQcAutoPass';
import { STATIC_THIRD_PARTY_LAB_VENDORS } from '../constants/thirdPartyLabVendorsStatic';
import { EI_COMPANY_LETTERHEAD } from '../constants/eiCompanyLetterhead';

export type ThirdPartyLabVendorOption = {
  id: string;
  name: string;
  vendorCode: string;
  accreditation: string;
  tier: string;
  pricePerSample: number;
  leadTimeDays: number;
  lastUsed: string;
  city?: string;
  paymentTerms?: string;
};

export type ThirdPartyPoPreviewInput = {
  poNo: string;
  poDate: Date;
  qcRef: string;
  grnNo: string;
  vendorName: string;
  vendorCode: string;
  vendorCity?: string;
  itemCode: string;
  itemName: string;
  testParameter: string;
  testMethod: string;
  specLimit: string;
  sampleQty: number;
  sampleNote: string;
  pricePerSample: number;
  pickupDate: string;
  expectedReportDate: string;
  paymentTerms: string;
  warehouseLabel: string;
  materialVendor?: string;
  qcApprover?: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatThirdPartyDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}-${MONTH_SHORT[date.getMonth()]}-${date.getFullYear()}`;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function isLabVendorCategory(category: string): boolean {
  const c = String(category ?? '').trim().toLowerCase();
  return (
    c.includes('lab') ||
    c.includes('testing') ||
    c.includes('3rd-party-lab') ||
    c === '3rd party lab'
  );
}

export function requiredAccreditationForTest(method: string): string | null {
  const m = String(method ?? '').toLowerCase();
  if (m.includes('nabl')) return 'NABL';
  if (
    m.includes('microbial') ||
    m.includes('plate count') ||
    m.includes('chromatography') ||
    m.includes('hplc') ||
    m.includes('external') ||
    m.includes('3rd') ||
    m.includes('third-party')
  ) {
    return 'NABL';
  }
  return null;
}

export function labVendorMatchesTest(vendor: ThirdPartyLabVendorOption, test: GrnQcTestRow): boolean {
  const required = requiredAccreditationForTest(test.method);
  if (!required) return true;
  return String(vendor.accreditation ?? '').toUpperCase().includes(required);
}

export function vendorRecordToLabOption(record: VendorClientRecord): ThirdPartyLabVendorOption | null {
  const category = String(record.category || record.data?.setupCategory || '').trim();
  if (!isLabVendorCategory(category)) return null;

  const vendorCode =
    String(record.entityCode ?? record.data?.vendorCode ?? record.data?.entityCode ?? '').trim() ||
    `V-${String(record.id).replace(/\D/g, '').slice(-3).padStart(3, '0')}`;

  const leadDays = parseInt(String(record.leadTime ?? record.data?.leadTimeDays ?? '').replace(/\D/g, ''), 10);
  const price = Number(record.data?.defaultLabRate ?? record.data?.pricePerSample ?? 0);

  return {
    id: record.id,
    name: record.name,
    vendorCode,
    accreditation: String(record.data?.accreditation ?? record.notes ?? 'NABL').trim() || 'NABL',
    tier: String(record.data?.labTier ?? record.moq ?? '1–5 samples').trim() || '1–5 samples',
    pricePerSample: Number.isFinite(price) && price > 0 ? price : 1800,
    leadTimeDays: Number.isFinite(leadDays) && leadDays > 0 ? leadDays : 7,
    lastUsed: String(record.lastModified ?? record.createdAt ?? '').slice(0, 10) || '—',
    city: String(record.city ?? record.location ?? '').trim() || undefined,
    paymentTerms: String(record.paymentTerms ?? 'Net 30').trim() || 'Net 30',
  };
}

export function mergeLabVendorOptions(apiVendors: ThirdPartyLabVendorOption[]): ThirdPartyLabVendorOption[] {
  const byCode = new Map<string, ThirdPartyLabVendorOption>();
  for (const v of STATIC_THIRD_PARTY_LAB_VENDORS) {
    byCode.set(v.vendorCode, v);
  }
  for (const v of apiVendors) {
    byCode.set(v.vendorCode, v);
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterLabVendorsForTest(
  vendors: ThirdPartyLabVendorOption[],
  test: GrnQcTestRow,
): ThirdPartyLabVendorOption[] {
  return vendors.filter((v) => labVendorMatchesTest(v, test));
}

export function buildQcReferenceNo(grnNo: string, grnId: string): string {
  const fromGrn = String(grnNo ?? '').match(/(\d{4})-(\d+)/);
  if (fromGrn) return `QC-${fromGrn[1]}-${fromGrn[2].padStart(4, '0')}`;
  const year = new Date().getFullYear();
  const tail = String(grnId ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0') || '0001';
  return `QC-${year}-${tail}`;
}

export function generateThirdPartyPoNumber(date = new Date()): string {
  const year = date.getFullYear();
  const seq = String((date.getTime() % 9000) + 100).padStart(4, '0');
  return `PO-3P-${year}-${seq}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeExpectedReportDate(pickupDateIso: string, leadTimeDays: number): string {
  return addCalendarDays(pickupDateIso, Math.max(1, leadTimeDays));
}

export function defaultSampleQtyForTest(test: GrnQcTestRow): number {
  const sample = String(test.sample ?? '').trim();
  const m = sample.match(/(\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 2;
}

export function defaultSampleNote(test: GrnQcTestRow): string {
  const sample = String(test.sample ?? '').trim();
  if (!sample) return '100 g each from drum 1 & 4';
  const qtyMatch = sample.match(/^(\d+)\s*samples?\s*[×x]\s*(.+)$/i);
  if (qtyMatch) return qtyMatch[2]!.trim();
  return sample;
}

/** Avoid duplicating "N samples ×" when sample note already includes a qty prefix. */
export function formatThirdPartySampleQtyLine(sampleQty: number, sampleNote: string): string {
  const note = String(sampleNote ?? '').trim();
  if (!note) return `${sampleQty} sample${sampleQty === 1 ? '' : 's'}`;
  if (/^\d+\s*samples?\b/i.test(note)) return note;
  return `${sampleQty} sample${sampleQty === 1 ? '' : 's'} × ${note}`;
}

export function buildThirdPartyPoPreview(input: ThirdPartyPoPreviewInput): string {
  const total = input.sampleQty * input.pricePerSample;
  const poDate = formatThirdPartyDate(input.poDate);
  const pickup = formatThirdPartyDate(input.pickupDate);
  const report = formatThirdPartyDate(input.expectedReportDate);
  const approver = input.qcApprover?.trim() || 'QA Head';
  const sampleLine = formatThirdPartySampleQtyLine(input.sampleQty, input.sampleNote);

  return [
    '3RD-PARTY TEST PURCHASE ORDER',
    `${EI_COMPANY_LETTERHEAD.legalName}`,
    EI_COMPANY_LETTERHEAD.addressLines.join(' · '),
    `${EI_COMPANY_LETTERHEAD.phone} · GSTIN ${EI_COMPANY_LETTERHEAD.gstin}`,
    '',
    input.poNo,
    `Date: ${poDate}`,
    `Linked QC: ${input.qcRef}`,
    '',
    `To Lab Vendor: ${input.vendorName} · ${input.vendorCode}${input.vendorCity ? ` · ${input.vendorCity}` : ''}`,
    'Attn: Sample Reception Desk',
    'From: Quality Team, Esthetic Insights · ' + EI_COMPANY_LETTERHEAD.qualityEmail,
    '',
    'Please perform the following test(s) on the enclosed sample(s) and return the COA / test report by the expected date.',
    '',
    `Item: ${input.itemName} · ${input.itemCode}`,
    `Sample Qty: ${sampleLine}`,
    `Test Required: ${input.testParameter}`,
    `Method: ${input.testMethod}`,
    `Spec Limit: ${input.specLimit}`,
    `Price / sample: ${formatInr(input.pricePerSample)} · Total: ${formatInr(total)} + GST`,
    '',
    `Sample Pickup: ${pickup} from ${input.warehouseLabel}`,
    `Expected Report: ${report}`,
    `Payment Terms: ${input.paymentTerms} from invoice date`,
    `Reference: Linked to internal ${input.qcRef} · ${input.grnNo}${input.materialVendor ? ` · Vendor ${input.materialVendor}` : ''}`,
    '',
    'Kindly ack receipt of sample by email + share digital COA on completion.',
    '',
    `Regards,`,
    `${approver} · Esthetic Insights`,
    '',
    `Auto-generated from Quality → 3rd-Party Test request · ${input.poNo} · ${poDate}`,
  ].join('\n');
}

export function buildThirdPartyPoPreviewInput(args: {
  poNo: string;
  poDate?: Date;
  qcRef: string;
  grnNo: string;
  vendorName: string;
  vendorCode: string;
  vendorCity?: string;
  itemCode: string;
  itemName: string;
  testParameter: string;
  testMethod: string;
  specLimit: string;
  sampleQty: number;
  sampleNote: string;
  pricePerSample: number;
  pickupDate: string;
  expectedReportDate: string;
  paymentTerms: string;
  warehouseLabel: string;
  materialVendor?: string;
  qcApprover?: string;
}): ThirdPartyPoPreviewInput {
  return {
    poNo: args.poNo,
    poDate: args.poDate ?? new Date(),
    qcRef: args.qcRef,
    grnNo: args.grnNo,
    vendorName: args.vendorName,
    vendorCode: args.vendorCode,
    vendorCity: args.vendorCity,
    itemCode: args.itemCode,
    itemName: args.itemName,
    testParameter: args.testParameter,
    testMethod: args.testMethod,
    specLimit: args.specLimit,
    sampleQty: args.sampleQty,
    sampleNote: args.sampleNote,
    pricePerSample: args.pricePerSample,
    pickupDate: args.pickupDate,
    expectedReportDate: args.expectedReportDate,
    paymentTerms: args.paymentTerms,
    warehouseLabel: args.warehouseLabel,
    materialVendor: args.materialVendor,
    qcApprover: args.qcApprover,
  };
}

export function extractThirdPartyPoRef(acceptance: string | undefined): string | null {
  const raw = String(acceptance ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/PO-3P-\d{4}-\d+/i);
  if (m) return m[0];
  if (/PO-/i.test(raw)) return raw;
  return null;
}

export type ThirdPartyReleasePayload = {
  poRef: string;
  order: ThirdPartyOrderMeta;
};

export function buildThirdPartyOrderOnRelease(args: {
  poNo: string;
  poDate?: Date;
  labVendorName: string;
  labVendorCode: string;
  samplePickupDate: string;
  expectedReportDate: string;
  now?: Date;
}): ThirdPartyOrderMeta {
  const now = args.now ?? new Date();
  return {
    poNo: args.poNo,
    poDate: (args.poDate ?? now).toISOString(),
    labVendorName: args.labVendorName,
    labVendorCode: args.labVendorCode,
    samplePickupDate: args.samplePickupDate,
    expectedReportDate: args.expectedReportDate,
    samplePhotoUploaded: false,
    reportUploaded: false,
    status: 'PO RELEASED',
  };
}

export function hasReleasedThirdPartyOrder(test: GrnQcTestRow): boolean {
  return Boolean(extractThirdPartyPoRef(test.acceptance) || test.thirdPartyOrder?.poNo);
}

export function isThirdPartyResultPending(test: GrnQcTestRow): boolean {
  if (!hasReleasedThirdPartyOrder(test)) return false;
  const result = String(test.result ?? '').trim();
  return !result || /^pending$/i.test(result);
}

export function canTriggerThirdPartyTest(test: GrnQcTestRow): boolean {
  return isThirdPartyQcTest(test) && !hasReleasedThirdPartyOrder(test);
}

export type ThirdPartyQcAction =
  | { mode: 'trigger'; label: '🧫 Trigger 3rd-party' }
  | { mode: 'view'; label: string; poRef: string };

export function resolveThirdPartyQcAction(test: GrnQcTestRow): ThirdPartyQcAction | null {
  if (!isThirdPartyQcTest(test)) return null;
  const poRef = extractThirdPartyPoRef(test.acceptance) ?? test.thirdPartyOrder?.poNo ?? null;
  if (poRef) {
    if (isThirdPartyResultPending(test)) {
      return { mode: 'view', label: `3rd Party · ${poRef} · awaiting`, poRef };
    }
    return { mode: 'view', label: `3rd Party · ${poRef}`, poRef };
  }
  return { mode: 'trigger', label: '🧫 Trigger 3rd-party' };
}
