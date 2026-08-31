/**
 * "Batch Details" step (step 3 of the GRN inbound flow): one row per distinct batch
 * received in the shipment. The row count is driven by "No. of batches received" from
 * step 2, and each row's "No. of packs" drives step 4 (Packaging List).
 *
 * Stored inside the GRN's existing `sourceDocuments` JSON blob (key `batches`).
 */

/**
 * One COA document on a batch. Metadata only — the file itself is not uploaded, matching how every
 * other GRN source document (bill / waybill / LR / COA) is recorded.
 */
export type GrnBatchCoaDoc = {
  fileName: string;
  uploadedAt?: string | null;
};

export type GrnBatchRow = {
  /**
   * System-generated internal batch no. (format B126-#####, backend-allocated — see
   * fetchNextVendorBatchNos), shown in the "#" column. Distinct from `vendorBatchNo`, which the
   * vendor supplies and staff type in by hand; this one is never editable.
   */
  systemBatchNo?: string | null;
  vendorBatchNo?: string | null;
  /** yyyy-mm-dd */
  mfgDate?: string | null;
  /** yyyy-mm-dd */
  expDate?: string | null;
  noOfPacks?: number | null;
  qtyPerPack?: number | null;
  /**
   * Legacy single-COA field. Kept so GRNs saved before multi-COA still render, and mirrored from
   * `coaDocs[0]` on write. Read through `batchCoaDocs()` rather than using this directly.
   */
  coaFileName?: string | null;
  /** COA documents on this batch. A batch can arrive with several (per-test, per-lot, revisions). */
  coaDocs?: GrnBatchCoaDoc[] | null;
};

export type InboundGrnBatchesMeta = {
  rows?: GrnBatchRow[];
  confirmedAt?: string | null;
  /**
   * The vendor did not assign a batch number for this shipment.
   *
   * Waives only `vendorBatchNo`. MFG/EXP dates, COA, and pack counts are still captured as usual —
   * Step 4 mints one packaging number per pack and the QR labels are printed per pack, so a
   * shipment with no packs would leave nothing to label or put away.
   */
  vendorBatchNotApplicable?: boolean;
};

export function emptyBatchRow(): GrnBatchRow {
  return {
    systemBatchNo: null,
    vendorBatchNo: null,
    mfgDate: null,
    expDate: null,
    noOfPacks: null,
    qtyPerPack: null,
    coaFileName: null,
    coaDocs: [],
  };
}

/**
 * The batch's COA documents, upgrading a legacy single `coaFileName` into the list form.
 * Every reader goes through here so old and new GRNs look identical to the UI.
 */
export function batchCoaDocs(row: GrnBatchRow | null | undefined): GrnBatchCoaDoc[] {
  const docs = Array.isArray(row?.coaDocs) ? row!.coaDocs! : null;
  if (docs && docs.length > 0) {
    return docs
      .filter((d) => d && String(d.fileName ?? '').trim() !== '')
      .map((d) => ({ fileName: String(d.fileName).trim(), uploadedAt: d.uploadedAt ?? null }));
  }
  const legacy = String(row?.coaFileName ?? '').trim();
  return legacy ? [{ fileName: legacy, uploadedAt: null }] : [];
}

/** Patch that writes `docs` back, keeping the legacy field mirrored to the first entry. */
export function batchCoaDocsPatch(docs: GrnBatchCoaDoc[]): Pick<GrnBatchRow, 'coaDocs' | 'coaFileName'> {
  return { coaDocs: docs, coaFileName: docs.length > 0 ? docs[0].fileName : null };
}

/**
 * Append picked files. Re-picking a file already on the batch is ignored: only the name is stored,
 * so a repeat name is indistinguishable from the document already there and would read as a
 * duplicate COA.
 */
export function addBatchCoaDocs(
  row: GrnBatchRow,
  fileNames: string[],
  at: string,
): Pick<GrnBatchRow, 'coaDocs' | 'coaFileName'> {
  const existing = batchCoaDocs(row);
  const seen = new Set(existing.map((d) => d.fileName.toLowerCase()));
  const added: GrnBatchCoaDoc[] = [];
  for (const raw of fileNames ?? []) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ fileName: name, uploadedAt: at });
  }
  return batchCoaDocsPatch([...existing, ...added]);
}

/** Drop one document by index. Out-of-range indexes leave the list untouched. */
export function removeBatchCoaDoc(row: GrnBatchRow, index: number): Pick<GrnBatchRow, 'coaDocs' | 'coaFileName'> {
  const existing = batchCoaDocs(row);
  if (!Number.isInteger(index) || index < 0 || index >= existing.length) return batchCoaDocsPatch(existing);
  return batchCoaDocsPatch(existing.filter((_, i) => i !== index));
}

export function emptyGrnBatchesMeta(): InboundGrnBatchesMeta {
  return { rows: [], confirmedAt: null, vendorBatchNotApplicable: false };
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
    vendorBatchNotApplicable: stored.vendorBatchNotApplicable === true,
  };
}

/** Resize the row list to `count`, preserving existing rows (pad with blanks, trim extras). */
export function reconcileBatchRows(rows: GrnBatchRow[], count: number): GrnBatchRow[] {
  const n = Math.max(0, Math.floor(count) || 0);
  const out = (rows ?? []).slice(0, n);
  while (out.length < n) out.push(emptyBatchRow());
  return out;
}

/**
 * Every batch needs a vendor batch no. and a pack count (the pack count drives step 4).
 *
 * When the vendor didn't assign a batch number (`vendorBatchNotApplicable`), the batch number is
 * not demanded — but the pack count still is, because Step 4 mints a packaging number per pack
 * and the QR labels print per pack.
 */
export function grnBatchesValidationErrors(meta: InboundGrnBatchesMeta, expectedCount: number): string[] {
  const rows = meta.rows ?? [];
  const errors: string[] = [];
  const vendorBatchNoWaived = meta.vendorBatchNotApplicable === true;
  if (expectedCount > 0 && rows.length !== expectedCount) {
    errors.push(`Enter details for all ${expectedCount} batches.`);
  }
  rows.forEach((r, i) => {
    if (!vendorBatchNoWaived && !String(r.vendorBatchNo ?? '').trim()) {
      errors.push(`Batch ${i + 1}: vendor batch no. is required.`);
    }
    if (!(Number(r.noOfPacks) >= 1)) errors.push(`Batch ${i + 1}: no. of packs must be at least 1.`);
  });
  return errors;
}

/** Total packs across all batches — the number of packaging numbers step 4 will mint. */
export function totalPacks(meta: InboundGrnBatchesMeta): number {
  return (meta.rows ?? []).reduce((s, r) => s + (Number(r.noOfPacks) || 0), 0);
}
