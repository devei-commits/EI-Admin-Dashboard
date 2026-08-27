/**
 * Grouped GRN receipt — one truck, several GRNs.
 *
 * A single delivery routinely covers more than one GRN. Confirming each separately meant re-entering
 * the same vehicle number, driver, date/time and re-uploading the same photos and paperwork for
 * every line, and produced GRNs claiming to be separate deliveries.
 *
 * The receipt details and the accompanying documents are captured ONCE and written to every selected
 * GRN, so the group shares one physical arrival record.
 */
import type { InboundGrnReceiptMeta } from './inboundGrnReceiptMeta';
import type { InboundGrnSourceDocuments, InboundGrnSourceDocKey } from './inboundGrnSourceDocs';

/** A GRN eligible to be received as part of a group. */
export type GroupableGrn = {
  id: string;
  grnNo: string;
  status?: string | null;
  vendor?: string | null;
  poNo?: string | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
};

/**
 * Can this GRN take part in a grouped receipt?
 * Only ones whose receipt has not already been confirmed — re-confirming would overwrite an arrival
 * record that has already been signed off, including its photos.
 */
export function isGroupableForReceipt(grn: GroupableGrn): boolean {
  const confirmedAt = grn.sourceDocuments?.receipt?.confirmedAt;
  return !confirmedAt;
}

/** Reason a GRN cannot join the group, or null when it can. */
export function groupBlockReason(grn: GroupableGrn): string | null {
  if (!isGroupableForReceipt(grn)) return 'Receipt already confirmed';
  return null;
}

export type GroupedReceiptShare = {
  meta: InboundGrnReceiptMeta;
  /** Documents uploaded once for the whole delivery and copied onto each GRN. */
  sharedDocs: Partial<Record<InboundGrnSourceDocKey, { fileName?: string | null; ref?: string | null }>>;
};

export type GroupedReceiptUpdate = {
  id: string;
  grnNo: string;
  sourceDocuments: InboundGrnSourceDocuments;
  receivedDate?: string;
  assignedTo?: string;
};

/**
 * Per-GRN payloads for a grouped receipt.
 *
 * Each GRN keeps its OWN existing sourceDocuments and has the shared receipt meta and documents
 * merged over the top — a GRN that already carries, say, its own COA does not lose it, and the
 * shared set never clobbers unrelated keys.
 */
export function buildGroupedReceiptUpdates(
  grns: GroupableGrn[],
  share: GroupedReceiptShare,
  confirmedAt: string,
): GroupedReceiptUpdate[] {
  const meta: InboundGrnReceiptMeta = { ...share.meta, confirmedAt };
  return (grns ?? [])
    .filter(isGroupableForReceipt)
    .map((grn) => {
      const existing = grn.sourceDocuments ?? {};
      const sourceDocuments: InboundGrnSourceDocuments = { ...existing, receipt: meta };
      for (const [key, value] of Object.entries(share.sharedDocs ?? {})) {
        if (!value) continue;
        const fileName = String(value.fileName ?? '').trim();
        const ref = String(value.ref ?? '').trim();
        if (!fileName && !ref) continue;
        const prev = (existing as Record<string, unknown>)[key] as
          | { fileName?: string | null; ref?: string | null }
          | undefined;
        (sourceDocuments as Record<string, unknown>)[key] = {
          ...(prev ?? {}),
          ...(fileName ? { fileName, uploadedAt: confirmedAt } : {}),
          ...(ref ? { ref } : {}),
          // Marks this file as belonging to the whole delivery, not just this GRN.
          sharedWithGroup: true,
        };
      }
      const update: GroupedReceiptUpdate = { id: grn.id, grnNo: grn.grnNo, sourceDocuments };
      if (meta.receiptDate) update.receivedDate = meta.receiptDate;
      if (meta.assignmentType === 'specific' && meta.assignedTo) update.assignedTo = meta.assignedTo;
      return update;
    });
}

/** GRNs sharing a vendor make an obvious group; used only to order the picker, never to restrict it. */
export function sortGroupCandidates(grns: GroupableGrn[]): GroupableGrn[] {
  return [...(grns ?? [])].sort((a, b) => {
    const v = String(a.vendor ?? '').localeCompare(String(b.vendor ?? ''));
    if (v !== 0) return v;
    return String(a.grnNo ?? '').localeCompare(String(b.grnNo ?? ''), undefined, { numeric: true });
  });
}
