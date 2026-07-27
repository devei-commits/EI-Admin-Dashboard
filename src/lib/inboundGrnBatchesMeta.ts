/**
 * "Batch Details" step (step 3 of the GRN inbound flow): one row per distinct batch
 * received in the shipment. The row count is driven by "No. of batches received" from
 * step 2, and each row's "No. of packs" drives step 4 (Packaging List).
 *
 * Stored inside the GRN's existing `sourceDocuments` JSON blob (key `batches`).
 */

export type GrnBatchRow = {
  vendorBatchNo?: string | null;
  /** yyyy-mm-dd */
  mfgDate?: string | null;
  /** yyyy-mm-dd */
  expDate?: string | null;
  noOfPacks?: number | null;
  qtyPerPack?: number | null;
  /** COA file name (metadata only — file is not uploaded). */
  coaFileName?: string | null;
};

export type InboundGrnBatchesMeta = {
  rows?: GrnBatchRow[];
  confirmedAt?: string | null;
};

export function emptyBatchRow(): GrnBatchRow {
  return {
    vendorBatchNo: null,
    mfgDate: null,
    expDate: null,
    noOfPacks: null,
    qtyPerPack: null,
    coaFileName: null,
  };
}

export function emptyGrnBatchesMeta(): InboundGrnBatchesMeta {
  return { rows: [], confirmedAt: null };
}

/** Read the batches blob off a sourceDocuments object, tolerating older rows that lack it. */
export function readGrnBatchesMeta(
  sourceDocuments: { batches?: InboundGrnBatchesMeta } | null | undefined,
): InboundGrnBatchesMeta {
  const stored = sourceDocuments && typeof sourceDocuments === 'object' ? sourceDocuments.batches : null;
  if (!stored || typeof stored !== 'object') return emptyGrnBatchesMeta();
  return {
    ...emptyGrnBatchesMeta(),
    ...stored,
    rows: Array.isArray(stored.rows) ? stored.rows.map((r) => ({ ...emptyBatchRow(), ...r })) : [],
  };
}

/** Resize the row list to `count`, preserving existing rows (pad with blanks, trim extras). */
export function reconcileBatchRows(rows: GrnBatchRow[], count: number): GrnBatchRow[] {
  const n = Math.max(0, Math.floor(count) || 0);
  const out = (rows ?? []).slice(0, n);
  while (out.length < n) out.push(emptyBatchRow());
  return out;
}

/** Every batch needs an identifier and a pack count (the pack count drives step 4). */
export function grnBatchesValidationErrors(meta: InboundGrnBatchesMeta, expectedCount: number): string[] {
  const rows = meta.rows ?? [];
  const errors: string[] = [];
  if (expectedCount > 0 && rows.length !== expectedCount) {
    errors.push(`Enter details for all ${expectedCount} batches.`);
  }
  rows.forEach((r, i) => {
    if (!String(r.vendorBatchNo ?? '').trim()) errors.push(`Batch ${i + 1}: vendor batch no. is required.`);
    if (!(Number(r.noOfPacks) >= 1)) errors.push(`Batch ${i + 1}: no. of packs must be at least 1.`);
  });
  return errors;
}

/** Total packs across all batches — the number of packaging numbers step 4 will mint. */
export function totalPacks(meta: InboundGrnBatchesMeta): number {
  return (meta.rows ?? []).reduce((s, r) => s + (Number(r.noOfPacks) || 0), 0);
}
