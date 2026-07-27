/**
 * "Packaging List" step (step 4 of the GRN inbound flow): one row per pack, expanded from
 * the Batch Details step (each batch's "No. of packs"). Every pack gets a unique packaging
 * number PKG-<grnNo>-<seq>. Received Qty rolls up from the per-pack quantities.
 *
 * Stored inside the GRN's existing `sourceDocuments` JSON blob (key `packaging`).
 */

import type { GrnBatchRow } from './inboundGrnBatchesMeta';

export type GrnPackLabelStatus = 'pending' | 'labelled';

export type GrnPackagingRow = {
  packagingNo: string;
  /** Index into the Batch Details rows this pack belongs to. */
  batchIndex: number;
  qty?: number | null;
  labelStatus?: GrnPackLabelStatus;
};

export type InboundGrnPackagingMeta = {
  rows?: GrnPackagingRow[];
  confirmedAt?: string | null;
};

export function emptyGrnPackagingMeta(): InboundGrnPackagingMeta {
  return { rows: [], confirmedAt: null };
}

export function readGrnPackagingMeta(
  sourceDocuments: { packaging?: InboundGrnPackagingMeta } | null | undefined,
): InboundGrnPackagingMeta {
  const stored = sourceDocuments && typeof sourceDocuments === 'object' ? sourceDocuments.packaging : null;
  if (!stored || typeof stored !== 'object') return emptyGrnPackagingMeta();
  return {
    ...emptyGrnPackagingMeta(),
    ...stored,
    rows: Array.isArray(stored.rows) ? stored.rows : [],
  };
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** Expand batch rows into one pack row each, numbered PKG-<grnNo>-001, -002, … */
export function buildPackagingRows(grnNo: string, batches: GrnBatchRow[]): GrnPackagingRow[] {
  const rows: GrnPackagingRow[] = [];
  let seq = 0;
  (batches ?? []).forEach((b, batchIndex) => {
    const n = Math.max(0, Math.floor(Number(b.noOfPacks) || 0));
    for (let k = 0; k < n; k += 1) {
      seq += 1;
      rows.push({
        packagingNo: `PKG-${grnNo}-${pad3(seq)}`,
        batchIndex,
        qty: b.qtyPerPack ?? null,
        labelStatus: 'pending',
      });
    }
  });
  return rows;
}

/** Rebuild the pack list from batches, preserving per-pack edits (qty, label status) by packaging no. */
export function reconcilePackagingRows(
  existing: GrnPackagingRow[],
  grnNo: string,
  batches: GrnBatchRow[],
): GrnPackagingRow[] {
  const fresh = buildPackagingRows(grnNo, batches);
  const byNo = new Map((existing ?? []).map((r) => [r.packagingNo, r]));
  return fresh.map((f) => {
    const prev = byNo.get(f.packagingNo);
    if (!prev) return f;
    return {
      ...f,
      qty: prev.qty != null ? prev.qty : f.qty,
      labelStatus: prev.labelStatus ?? f.labelStatus,
    };
  });
}

/** Received Qty — the auto roll-up from the packaging list. */
export function receivedQtyFromPackaging(meta: InboundGrnPackagingMeta): number {
  return (meta.rows ?? []).reduce((s, r) => s + (Number(r.qty) || 0), 0);
}

export function grnPackagingValidationErrors(meta: InboundGrnPackagingMeta): string[] {
  const rows = meta.rows ?? [];
  const errors: string[] = [];
  if (rows.length === 0) {
    errors.push('No packs to package — set pack counts in Batch Details first.');
    return errors;
  }
  rows.forEach((r) => {
    if (!(Number(r.qty) > 0)) errors.push(`${r.packagingNo}: quantity must be greater than 0.`);
  });
  return errors;
}
