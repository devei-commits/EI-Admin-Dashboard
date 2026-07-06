import type { InboundGrnSourceDocuments } from './inboundGrnSourceDocs';
import { formatInboundTableDate, resolveInboundWarehouseCode } from './inboundGrnTableDisplay';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type GrnCopyReceiptLineInput = {
  item?: string;
  itemCode?: string;
  poQty?: number;
  rcvdQty?: number;
  invoiceQty?: number;
  unitPrice?: number;
  unit?: string;
};

export type GrnCopyReceiptInput = {
  grnNo: string;
  poNo?: string | null;
  vendor?: string | null;
  vendorCode?: string | null;
  expectedDate?: string | null;
  receivedDate?: string | null;
  grnDate?: string | null;
  generatedAt?: string | null;
  invoiceNo?: string | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationZone?: string | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
  lineItem?: GrnCopyReceiptLineInput | null;
};

export type GrnPackCheckRow = {
  packIndex: number;
  packTotal: number;
  declaredQty: number;
  actualQty: number;
  variance: number;
  condition: string;
  unit: string;
};

export type GrnCopyDocumentRow = {
  key: string;
  refLabel: string;
  refValue: string;
  docType: string;
  fileName: string | null;
  uploaded: boolean;
  verified: boolean;
};

export type GrnMatchCheckRow = {
  label: string;
  pass: boolean;
};

/** QR labels already saved on GRN (header or matching line item). */
export function resolveGrnExistingLabels(input: {
  generatedLabels?: Array<{ boxIndex?: number }> | null;
  lineItems?: Array<{ itemCode?: string; generatedLabels?: Array<{ boxIndex?: number }> | null }> | null;
  lineItem?: { itemCode?: string; generatedLabels?: Array<{ boxIndex?: number }> | null } | null;
}): Array<{ boxIndex?: number }> {
  const line = input.lineItem;
  if (line && Array.isArray(line.generatedLabels) && line.generatedLabels.length > 0) {
    return line.generatedLabels;
  }
  const codeU = String(line?.itemCode ?? '').trim().toUpperCase();
  if (codeU && Array.isArray(input.lineItems)) {
    const match = input.lineItems.find(
      (li) => String(li.itemCode ?? '').trim().toUpperCase() === codeU,
    );
    if (match && Array.isArray(match.generatedLabels) && match.generatedLabels.length > 0) {
      return match.generatedLabels;
    }
  }
  if (Array.isArray(input.generatedLabels) && input.generatedLabels.length > 0) {
    return input.generatedLabels;
  }
  return [];
}

export function grnCopyHasExistingLabels(input: Parameters<typeof resolveGrnExistingLabels>[0]): boolean {
  return resolveGrnExistingLabels(input).length > 0;
}

export type GrnCopyReceiptHeaderView = {
  titleGrnNo: string;
  itemTitle: string;
  shipmentBatchRef: string | null;
  poNo: string;
  vendorLine: string;
  warehouseCode: string;
  warehouseName: string;
};

export type GrnCopyReceiptHeaderFields = {
  grnNo: string;
  shipmentDate: string;
  receivedDateTime: string;
  generatedDateTime: string;
  itemLine: string;
  poNumber: string;
  poQty: string;
  shippedQty: string;
  unitPrice: string;
  vendorLine: string;
};

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatGrnCopyDateTime(raw: string | null | undefined): string {
  const d = parseDate(raw);
  if (!d) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  if (!month) return '—';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${month}-${d.getFullYear()} ${hours}:${minutes}`;
}

function formatQty(value: number | null | undefined, unit?: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const u = String(unit ?? '').trim();
  return u ? `${n.toLocaleString('en-IN')} ${u}` : n.toLocaleString('en-IN');
}

function formatInr(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatShipmentBatchRef(poNo: string | null | undefined): string | null {
  const po = String(poNo ?? '').trim();
  if (!po) return null;
  if (/^SB-/i.test(po)) return po;
  return po.replace(/^PO[\s-]*/i, 'SB-');
}

function docRef(sourceDocuments: InboundGrnSourceDocuments | null | undefined, key: string): string {
  const entry = sourceDocuments?.[key as keyof InboundGrnSourceDocuments];
  if (!entry) return '';
  return String(entry.ref ?? '').trim();
}

export type GrnCopyDocRefKey = 'bill' | 'waybill' | 'lr';

/** Doc types with file upload in GRN Copy receipt table. */
export type GrnCopyDocUploadKey = 'bill' | 'waybill' | 'coa';

export const GRN_COPY_FILE_DOC_KEYS: readonly GrnCopyDocUploadKey[] = ['bill', 'waybill', 'coa'];

/** One-time initial values for editable doc ref fields (bill may seed from invoice). */
export function initialGrnCopyDocRefs(
  sourceDocuments?: InboundGrnSourceDocuments | null,
  invoiceNo?: string | null,
): Record<GrnCopyDocRefKey, string> {
  const readRef = (key: GrnCopyDocRefKey): string => docRef(sourceDocuments, key);
  return {
    bill: readRef('bill') || String(invoiceNo ?? '').trim(),
    waybill: readRef('waybill'),
    lr: readRef('lr'),
  };
}

export function docRefsToSourceDocuments(
  refs: Record<GrnCopyDocRefKey, string>,
  existing?: InboundGrnSourceDocuments | null,
): InboundGrnSourceDocuments {
  const next: InboundGrnSourceDocuments = { ...(existing ?? {}) };
  for (const key of ['bill', 'waybill', 'lr'] as const) {
    const ref = refs[key].trim();
    next[key] = { ...(next[key] ?? {}), ...(ref ? { ref } : {}) };
    if (!ref && next[key] && !next[key]?.fileName && !next[key]?.url) {
      delete next[key];
    }
  }
  return next;
}

function docFileName(sourceDocuments: InboundGrnSourceDocuments | null | undefined, key: string): string | null {
  const entry = sourceDocuments?.[key as keyof InboundGrnSourceDocuments];
  if (!entry) return null;
  const name = String(entry.fileName ?? '').trim();
  return name || null;
}

function docUploaded(sourceDocuments: InboundGrnSourceDocuments | null | undefined, key: string): boolean {
  const entry = sourceDocuments?.[key as keyof InboundGrnSourceDocuments];
  if (!entry) return false;
  return Boolean(String(entry.fileName ?? '').trim() || String(entry.url ?? '').trim());
}

export function buildGrnCopyDocumentRows(
  grn: GrnCopyReceiptInput,
): GrnCopyDocumentRow[] {
  const docs = grn.sourceDocuments ?? {};
  const billRef = docRef(docs, 'bill');
  const waybillRef = docRef(docs, 'waybill');
  const lrRef = docRef(docs, 'lr');

  return [
    {
      key: 'bill',
      refLabel: 'Bill No.',
      refValue: billRef || '—',
      docType: 'Tax Invoice',
      fileName: docFileName(docs, 'bill'),
      uploaded: docUploaded(docs, 'bill'),
      verified: docUploaded(docs, 'bill'),
    },
    {
      key: 'waybill',
      refLabel: 'Way Bill No.',
      refValue: waybillRef || '—',
      docType: 'E-Way Bill',
      fileName: docFileName(docs, 'waybill'),
      uploaded: docUploaded(docs, 'waybill'),
      verified: docUploaded(docs, 'waybill'),
    },
    {
      key: 'lr',
      refLabel: 'Lorry Receipt #',
      refValue: lrRef || '—',
      docType: 'Lorry Receipt',
      fileName: docFileName(docs, 'lr'),
      uploaded: docUploaded(docs, 'lr'),
      verified: docUploaded(docs, 'lr'),
    },
    {
      key: 'coa',
      refLabel: 'COA Ref',
      refValue: docRef(docs, 'coa') || '—',
      docType: 'COA (Certificate of Analysis)',
      fileName: docFileName(docs, 'coa'),
      uploaded: docUploaded(docs, 'coa'),
      verified: docUploaded(docs, 'coa'),
    },
  ];
}

export function deriveGrnPackRows(input: {
  rcvdQty: number;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  unit?: string;
  actualQtys?: number[] | null;
}): GrnPackCheckRow[] {
  const rcvd = Math.max(0, Number(input.rcvdQty) || 0);
  const unit = String(input.unit ?? 'kg').trim() || 'kg';
  let packCount = Math.max(1, Number(input.noOfBoxes) || 0);
  if (!packCount || packCount < 1) {
    packCount = rcvd >= 8 ? 8 : Math.max(1, Math.round(rcvd));
  }

  const perBox =
    Number(input.unitsPerBox) > 0
      ? Number(input.unitsPerBox)
      : rcvd > 0
        ? Math.round((rcvd / packCount) * 1000) / 1000
        : 0;

  const rows: GrnPackCheckRow[] = [];
  let allocated = 0;
  for (let i = 0; i < packCount; i += 1) {
    const isLast = i === packCount - 1;
    const declared = isLast ? Math.round((rcvd - allocated) * 1000) / 1000 : perBox;
    allocated += declared;
    const actual =
      Array.isArray(input.actualQtys) && input.actualQtys[i] != null
        ? Number(input.actualQtys[i])
        : declared;
    rows.push({
      packIndex: i + 1,
      packTotal: packCount,
      declaredQty: declared,
      actualQty: actual,
      variance: Math.round((actual - declared) * 1000) / 1000,
      condition: 'seal intact',
      unit,
    });
  }
  return rows;
}

export function buildGrnCopyReceiptHeaderView(grn: GrnCopyReceiptInput): GrnCopyReceiptHeaderView {
  const line = grn.lineItem;
  const itemName = String(line?.item ?? '').trim() || '—';
  const itemCode = String(line?.itemCode ?? '').trim();
  const vendor = String(grn.vendor ?? '').trim() || '—';
  const vendorCode = String(grn.vendorCode ?? '').trim();
  const warehouseCode = resolveInboundWarehouseCode(
    { grnNo: grn.grnNo, locationZone: grn.locationZone, lineItem: line ?? null },
    line ?? null,
  );
  const warehouseName =
    warehouseCode === 'MW' ? 'Main Warehouse' : warehouseCode === 'SW' ? 'Secondary Warehouse' : 'Warehouse';

  return {
    titleGrnNo: grn.grnNo,
    itemTitle: itemCode ? `${itemName} · ${itemCode}` : itemName,
    shipmentBatchRef: formatShipmentBatchRef(grn.poNo),
    poNo: String(grn.poNo ?? '').trim() || '—',
    vendorLine: vendorCode ? `${vendor} · ${vendorCode}` : vendor,
    warehouseCode,
    warehouseName,
  };
}

export function buildGrnCopyReceiptHeaderFields(grn: GrnCopyReceiptInput): GrnCopyReceiptHeaderFields {
  const line = grn.lineItem;
  const itemCode = String(line?.itemCode ?? '').trim();
  const itemName = String(line?.item ?? '').trim();
  const vendor = String(grn.vendor ?? '').trim() || '—';
  const vendorCode = String(grn.vendorCode ?? '').trim();

  return {
    grnNo: grn.grnNo,
    shipmentDate: formatInboundTableDate(grn.expectedDate ?? grn.grnDate),
    receivedDateTime: formatGrnCopyDateTime(grn.receivedDate ?? grn.grnDate),
    generatedDateTime: formatGrnCopyDateTime(grn.generatedAt ?? grn.grnDate),
    itemLine: itemCode ? `${itemCode} · ${itemName}` : itemName || '—',
    poNumber: String(grn.poNo ?? '').trim() || '—',
    poQty: formatQty(line?.poQty, line?.unit),
    shippedQty: formatQty(line?.rcvdQty, line?.unit),
    unitPrice: Number.isFinite(Number(line?.unitPrice))
      ? `${formatInr(line?.unitPrice)} / ${String(line?.unit ?? 'unit').trim() || 'unit'}`
      : '—',
    vendorLine: vendorCode ? `${vendor} · ${vendorCode}` : vendor,
  };
}

export function buildGrnMatchChecks(input: {
  grn: GrnCopyReceiptInput;
  packRows: GrnPackCheckRow[];
  documentRows: GrnCopyDocumentRow[];
  photoCount: number;
  existingLabelCount?: number;
  billedQty?: number;
  verifiedUnitPrice?: number;
}): GrnMatchCheckRow[] {
  const line = input.grn.lineItem;
  const poQty = Number(line?.poQty) || 0;
  const shippedQty = Number(line?.rcvdQty) || 0;
  const billedQty =
    Number(input.billedQty) > 0
      ? Number(input.billedQty)
      : Number(line?.invoiceQty) > 0
        ? Number(line?.invoiceQty)
        : shippedQty;
  const physicalTotal = input.packRows.reduce((sum, row) => sum + row.actualQty, 0);
  const declaredPacks = input.packRows.length;
  const receivedPacks = input.packRows.filter((row) => row.actualQty > 0).length;
  const poPrice = Number(line?.unitPrice) || 0;
  const verifiedPrice =
    Number(input.verifiedUnitPrice) > 0 ? Number(input.verifiedUnitPrice) : poPrice;

  const invoiceDoc = input.documentRows.find((d) => d.key === 'bill');
  const ewbDoc = input.documentRows.find((d) => d.key === 'waybill');
  const coaDoc = input.documentRows.find((d) => d.key === 'coa');
  const docsComplete = Boolean(invoiceDoc?.uploaded && ewbDoc?.uploaded && coaDoc?.uploaded);
  const labelCount = Math.max(0, Number(input.existingLabelCount) || 0);

  const qtyMatch = (a: number, b: number) => Math.abs(a - b) <= 0.0001;

  const rows: GrnMatchCheckRow[] = [
    {
      label: `Shipped Qty (vendor ${formatQty(shippedQty, line?.unit)}) vs Physical (${formatQty(physicalTotal, line?.unit)})`,
      pass: qtyMatch(shippedQty, physicalTotal),
    },
    {
      label: `Physical (${formatQty(physicalTotal, line?.unit)}) vs PO Qty (${formatQty(poQty, line?.unit)})`,
      pass: qtyMatch(physicalTotal, poQty),
    },
    {
      label: `Billed Qty (${formatQty(billedQty, line?.unit)}) vs PO Qty (${formatQty(poQty, line?.unit)})`,
      pass: qtyMatch(billedQty, poQty),
    },
    {
      label: `Per Unit Price (${formatInr(verifiedPrice)}) vs PO Price (${formatInr(poPrice)})`,
      pass: qtyMatch(verifiedPrice, poPrice),
    },
    {
      label: `Packs received (${receivedPacks}) vs Packs declared (${declaredPacks})`,
      pass: receivedPacks === declaredPacks,
    },
    {
      label: 'Documents received (Invoice + EWB + COA)',
      pass: docsComplete,
    },
    {
      label: `Shipment photos (${input.photoCount} uploaded, 1+ required)`,
      pass: input.photoCount >= 1,
    },
  ];

  rows.splice(rows.length - 1, 0, {
    label: labelCount > 0
      ? `QR labels (${labelCount} on file — regenerate after all receipt checks pass)`
      : 'QR labels (not generated — use Generate Labels after receipt checks pass)',
    pass: labelCount > 0,
  });

  return rows;
}

function grnReceiptDocsComplete(sourceDocuments: InboundGrnSourceDocuments | null | undefined): boolean {
  return GRN_COPY_FILE_DOC_KEYS.every((key) => docUploaded(sourceDocuments, key));
}

export function grnReceiptDocumentsLocked(
  mode: 'confirm-receipt' | 'grn-copy',
  grn: {
    status?: string | null;
    generatedLabels?: unknown[] | null;
    sourceDocuments?: InboundGrnSourceDocuments | null;
  },
): boolean {
  if (mode === 'confirm-receipt') return false;
  if (String(grn.status ?? '').trim() === 'GRN Complete') return true;
  const hasLabels = Boolean(Array.isArray(grn.generatedLabels) && grn.generatedLabels.length > 0);
  if (!hasLabels) return false;
  // Lock receipt docs after GRN Copy captured all mandatory uploads and generated QR labels.
  return grnReceiptDocsComplete(grn.sourceDocuments);
}

export function isGrnCoreMatchCheck(label: string): boolean {
  return (
    label.includes(' vs ') &&
    !label.startsWith('Documents') &&
    !label.startsWith('Shipment photos') &&
    !label.startsWith('QR labels')
  );
}

export function allGrnCoreMatchChecksPass(checks: GrnMatchCheckRow[]): boolean {
  const core = checks.filter((check) => isGrnCoreMatchCheck(check.label));
  return core.length > 0 && core.every((check) => check.pass);
}

export function grnReceiptPrerequisitesMet(checks: GrnMatchCheckRow[]): boolean {
  const docs = checks.find((check) => check.label.startsWith('Documents received'));
  const photos = checks.find((check) => check.label.startsWith('Shipment photos'));
  return Boolean(docs?.pass && photos?.pass);
}

export function allGrnMatchChecksPass(checks: GrnMatchCheckRow[]): boolean {
  return checks.length > 0 && checks.every((c) => c.pass);
}

/** Receipt checks only — excludes informational QR label row. */
export function allGrnReceiptChecksPass(checks: GrnMatchCheckRow[]): boolean {
  const receipt = checks.filter((c) => !c.label.startsWith('QR labels'));
  return allGrnMatchChecksPass(receipt);
}
