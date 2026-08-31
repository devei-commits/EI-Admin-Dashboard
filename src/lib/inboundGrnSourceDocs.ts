import {
  resolveGrnReceiptSource,
  type InboundGrnSourceTab,
} from './inboundGrnSourceFilter';
import type { InboundGrnReceiptMeta } from './inboundGrnReceiptMeta';
import type { InboundGrnDetailsMeta } from './inboundGrnDetailsMeta';
import type { InboundGrnBatchesMeta } from './inboundGrnBatchesMeta';
import type { InboundGrnPackagingMeta } from './inboundGrnPackagingMeta';

export type InboundGrnSourceDocKey =
  | 'bill'
  | 'waybill'
  | 'lr'
  | 'coa'
  // Dock-checklist documents that also need an upload slot. Without these three, ticking
  // "Delivery Challan" / "MSDS" / "Weighment Slip" at receipt recorded that they arrived but gave
  // the operator nowhere to attach them.
  | 'delivery_challan'
  | 'msds'
  | 'weighment_slip'
  | 'to_ref'
  | 'dispatch_labels'
  | 'credit_note'
  | 'debit_note';

export type InboundGrnSourceDocEntry = {
  fileName?: string | null;
  ref?: string | null;
  url?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
};

export type InboundGrnSourceDocuments = Partial<Record<InboundGrnSourceDocKey, InboundGrnSourceDocEntry>> & {
  /** Per-rack post-racking photo counts (Assign Rack workflow). */
  postRackingPhotos?: InboundGrnPostRackingPhotosMeta;
  /** Physical-receipt details from the "Confirm Receipt" step. */
  receipt?: InboundGrnReceiptMeta;
  /** Shipment-level declarations from the "Confirm Details" step. */
  details?: InboundGrnDetailsMeta;
  /** Per-batch rows from the "Batch Details" step. */
  batches?: InboundGrnBatchesMeta;
  /** Per-pack rows from the "Packaging List" step. */
  packaging?: InboundGrnPackagingMeta;
  /** "Quarantine → QC" + QC-decision markers (for wizard resume and reference). */
  qc?: {
    sentAt?: string | null;
    testDate?: string | null;
    verdict?: 'accept' | 'reject' | null;
    decidedAt?: string | null;
  };
};

export type InboundGrnPostRackingPhotosMeta = {
  byRack?: Record<
    string,
    {
      photoCount?: number;
      updatedAt?: string;
    }
  >;
};

export type InboundGrnSourceDocRequirement = {
  key: InboundGrnSourceDocKey;
  label: string;
};

const PO_DOC_REQUIREMENTS: InboundGrnSourceDocRequirement[] = [
  { key: 'bill', label: 'Bill' },
  { key: 'waybill', label: 'Waybill' },
  { key: 'lr', label: 'LR' },
  { key: 'coa', label: 'COA' },
];

export const INBOUND_SOURCE_DOC_REQUIREMENTS: Record<InboundGrnSourceTab, InboundGrnSourceDocRequirement[]> = {
  po: PO_DOC_REQUIREMENTS,
  // Same document set as PO — a GRN by Transfer still receives against the same shared "Receipt
  // documents" checklist step in GrnCopyReceiptModal, so its upload requirement should read the same.
  transfer: PO_DOC_REQUIREMENTS,
  return: [
    { key: 'credit_note', label: 'Credit Note' },
    { key: 'debit_note', label: 'Debit Note' },
  ],
};

export function inboundSourceDocRequirementLabel(tab: InboundGrnSourceTab): string {
  return INBOUND_SOURCE_DOC_REQUIREMENTS[tab].map((d) => d.label).join(' + ');
}

export function isInboundSourceDocUploaded(entry: InboundGrnSourceDocEntry | null | undefined): boolean {
  if (!entry) return false;
  return Boolean(
    String(entry.fileName ?? '').trim() ||
      String(entry.ref ?? '').trim() ||
      String(entry.url ?? '').trim() ||
      String(entry.uploadedAt ?? '').trim(),
  );
}

export type InboundGrnSourceDocCountInput = {
  receiptSource?: string | null;
  poNo?: string | null;
  purchaseOrderId?: number | string | null;
  mrnId?: number | string | null;
  invoiceNo?: string | null;
  transferOrderRef?: string | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
};

function legacyPoDocPresent(
  key: InboundGrnSourceDocKey,
  grn: InboundGrnSourceDocCountInput,
): boolean {
  if (key === 'bill') return Boolean(String(grn.invoiceNo ?? '').trim());
  return false;
}

export function countInboundSourceDocsUploaded(grn: InboundGrnSourceDocCountInput): {
  source: InboundGrnSourceTab;
  uploaded: number;
  required: number;
  requiredLabel: string;
  complete: boolean;
} {
  const source = resolveGrnReceiptSource(grn);
  const requirements = INBOUND_SOURCE_DOC_REQUIREMENTS[source];
  const docs = grn.sourceDocuments ?? {};
  let uploaded = 0;

  for (const req of requirements) {
    const entry = docs[req.key];
    const fromStore = isInboundSourceDocUploaded(entry);
    // PO and transfer share the same document set now, so they share the same legacy fallback too.
    const legacy = source === 'po' || source === 'transfer' ? legacyPoDocPresent(req.key, grn) : false;
    if (fromStore || legacy) uploaded += 1;
  }

  const required = requirements.length;
  return {
    source,
    uploaded,
    required,
    requiredLabel: inboundSourceDocRequirementLabel(source),
    complete: uploaded >= required,
  };
}

export function formatInboundSourceDocChip(grn: InboundGrnSourceDocCountInput): {
  label: string;
  complete: boolean;
  requiredLabel: string;
  uploaded: number;
  required: number;
} {
  const count = countInboundSourceDocsUploaded(grn);
  const suffix = count.complete ? ' ✓' : '';
  return {
    label: `${count.uploaded} of ${count.required} docs uploaded${suffix}`,
    complete: count.complete,
    requiredLabel: count.requiredLabel,
    uploaded: count.uploaded,
    required: count.required,
  };
}
