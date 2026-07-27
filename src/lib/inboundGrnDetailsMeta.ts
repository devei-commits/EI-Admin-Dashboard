/**
 * "Confirm Details" step (step 2 of the GRN inbound flow): additional attachments and
 * shipment-level declarations — batch count, declared weight, containers, storage
 * requirements, and notes for QC.
 *
 * Stored inside the GRN's existing `sourceDocuments` JSON blob (key `details`), same
 * no-schema-change approach as the receipt step's `receipt` blob.
 */

/** Storage-condition observations; order here drives render order. */
export const GRN_STORAGE_REQUIREMENTS = [
  { key: 'coldChain', label: 'Cold chain 2–8°C maintained' },
  { key: 'ambient', label: 'Ambient' },
  { key: 'dryStorage', label: 'Dry storage required' },
  { key: 'protectFromLight', label: 'Protect from light' },
] as const;

export type GrnStorageRequirementKey = (typeof GRN_STORAGE_REQUIREMENTS)[number]['key'];
export type GrnStorageRequirements = Partial<Record<GrnStorageRequirementKey, boolean>>;

export type InboundGrnDetailsMeta = {
  /** Additional attachment file names (metadata only — files are not uploaded). */
  attachments?: string[];
  batchesReceived?: number | null;
  totalWeightKg?: number | null;
  totalContainers?: number | null;
  storageRequirements?: GrnStorageRequirements;
  qcNotes?: string | null;
  /** Set when the step's Save & Continue action has been run. */
  confirmedAt?: string | null;
};

export function emptyGrnDetailsMeta(): InboundGrnDetailsMeta {
  return {
    attachments: [],
    batchesReceived: null,
    totalWeightKg: null,
    totalContainers: null,
    storageRequirements: {},
    qcNotes: null,
    confirmedAt: null,
  };
}

/** Read the details blob off a sourceDocuments object, tolerating older rows that lack it. */
export function readGrnDetailsMeta(
  sourceDocuments: { details?: InboundGrnDetailsMeta } | null | undefined,
): InboundGrnDetailsMeta {
  const stored = sourceDocuments && typeof sourceDocuments === 'object' ? sourceDocuments.details : null;
  if (!stored || typeof stored !== 'object') return emptyGrnDetailsMeta();
  return {
    ...emptyGrnDetailsMeta(),
    ...stored,
    storageRequirements: { ...(stored.storageRequirements ?? {}) },
    attachments: Array.isArray(stored.attachments) ? stored.attachments : [],
  };
}

/** Number of batches is the one required field (it drives the next, batch-wise, step). */
export function grnDetailsValidationErrors(meta: InboundGrnDetailsMeta): string[] {
  const errors: string[] = [];
  const batches = Number(meta.batchesReceived);
  if (!Number.isFinite(batches) || batches < 1) {
    errors.push('Enter how many batches were received (at least 1).');
  }
  return errors;
}
