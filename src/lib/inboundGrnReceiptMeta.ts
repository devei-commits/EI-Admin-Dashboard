/**
 * Physical-receipt details captured in the GRN "Confirm Receipt" step.
 *
 * Stored inside the GRN's existing `sourceDocuments` JSON blob (key `receipt`) so no
 * backend schema change is needed. The person assigned and the receipt date are ALSO
 * mirrored onto the real `assignedTo` / `receivedDate` GRN columns on save.
 */

export type GrnAssignmentType = 'open' | 'specific';

/** Document checklist items ticked at the dock. Order here drives render order. */
export const GRN_RECEIPT_CHECKLIST_ITEMS = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'deliveryChallan', label: 'Delivery Challan' },
  { key: 'ewayBill', label: 'E-Way Bill' },
  { key: 'coa', label: 'COA (Certificate of Analysis)' },
  { key: 'msds', label: 'MSDS' },
  { key: 'weighmentSlip', label: 'Weighment Slip' },
] as const;

export type GrnReceiptChecklistKey = (typeof GRN_RECEIPT_CHECKLIST_ITEMS)[number]['key'];

export type GrnReceiptChecklist = Partial<Record<GrnReceiptChecklistKey, boolean>>;

export type InboundGrnReceiptMeta = {
  assignmentType?: GrnAssignmentType;
  /** Email/identifier of the assigned WH person when assignmentType === 'specific'. */
  assignedTo?: string | null;
  /** yyyy-mm-dd */
  receiptDate?: string | null;
  /** HH:mm (24h) */
  receiptTime?: string | null;
  receivedBy?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  checklist?: GrnReceiptChecklist;
  /** Compressed JPEG data URLs, stored inline in the GRN JSON (warehouse base64 convention). */
  vehiclePhotos?: string[];
  documentPhotos?: string[];
  remarks?: string | null;
  /** Set when the step's Confirm Receipt action has been run. */
  confirmedAt?: string | null;
};

/** Cap stored photos per category so the GRN JSON row stays bounded. */
export const GRN_RECEIPT_MAX_PHOTOS = 8;

/** Minimum vehicle photos required by the step. */
export const GRN_RECEIPT_MIN_VEHICLE_PHOTOS = 1;

/** Minimum document photos required by the step. */
export const GRN_RECEIPT_MIN_DOCUMENT_PHOTOS = 1;

export function emptyGrnReceiptMeta(): InboundGrnReceiptMeta {
  return {
    assignmentType: 'open',
    assignedTo: null,
    receiptDate: null,
    receiptTime: null,
    receivedBy: null,
    vehicleNumber: null,
    driverName: null,
    driverPhone: null,
    checklist: {},
    vehiclePhotos: [],
    documentPhotos: [],
    remarks: null,
    confirmedAt: null,
  };
}

/** Read the receipt blob off a sourceDocuments object, tolerating older rows that lack it. */
export function readGrnReceiptMeta(
  sourceDocuments: { receipt?: InboundGrnReceiptMeta } | null | undefined,
): InboundGrnReceiptMeta {
  const stored = sourceDocuments && typeof sourceDocuments === 'object' ? sourceDocuments.receipt : null;
  if (!stored || typeof stored !== 'object') return emptyGrnReceiptMeta();
  return {
    ...emptyGrnReceiptMeta(),
    ...stored,
    checklist: { ...(stored.checklist ?? {}) },
    vehiclePhotos: Array.isArray(stored.vehiclePhotos) ? stored.vehiclePhotos : [],
    documentPhotos: Array.isArray(stored.documentPhotos) ? stored.documentPhotos : [],
  };
}

/** Fields the reference marks with * — used to gate the step's Confirm Receipt action. */
export function grnReceiptValidationErrors(meta: InboundGrnReceiptMeta): string[] {
  const errors: string[] = [];
  if (meta.assignmentType === 'specific' && !String(meta.assignedTo ?? '').trim()) {
    errors.push('Choose the person to assign this GRN to.');
  }
  if (!String(meta.receiptDate ?? '').trim()) errors.push('Receipt date is required.');
  if (!String(meta.receiptTime ?? '').trim()) errors.push('Receipt time is required.');
  if (!String(meta.vehicleNumber ?? '').trim()) errors.push('Vehicle number is required.');
  const anyChecklist = Object.values(meta.checklist ?? {}).some(Boolean);
  if (!anyChecklist) errors.push('Tick the documents received in the checklist.');
  if ((meta.vehiclePhotos?.length ?? 0) < GRN_RECEIPT_MIN_VEHICLE_PHOTOS) {
    errors.push(`Add at least ${GRN_RECEIPT_MIN_VEHICLE_PHOTOS} vehicle photos (front + goods).`);
  }
  return errors;
}
