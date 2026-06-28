import {
  resolveGrnReceiptSource,
  type InboundGrnSourceTab,
} from './inboundGrnSourceFilter';

export type InboundGrnSourceDocKey =
  | 'bill'
  | 'waybill'
  | 'lr'
  | 'coa'
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

export const INBOUND_SOURCE_DOC_REQUIREMENTS: Record<InboundGrnSourceTab, InboundGrnSourceDocRequirement[]> = {
  po: [
    { key: 'bill', label: 'Bill' },
    { key: 'waybill', label: 'Waybill' },
    { key: 'lr', label: 'LR' },
    { key: 'coa', label: 'COA' },
  ],
  transfer: [
    { key: 'to_ref', label: 'TO# ref' },
    { key: 'dispatch_labels', label: 'Dispatch label scans' },
  ],
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

function legacyTransferDocPresent(
  key: InboundGrnSourceDocKey,
  grn: InboundGrnSourceDocCountInput,
): boolean {
  if (key === 'to_ref') {
    return Boolean(String(grn.transferOrderRef ?? grn.poNo ?? '').trim());
  }
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
    const legacy =
      source === 'po'
        ? legacyPoDocPresent(req.key, grn)
        : source === 'transfer'
          ? legacyTransferDocPresent(req.key, grn)
          : false;
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
