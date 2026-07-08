import { api } from '../lib/apiClient';
import type { BatchMaterialCoverage, ProductionReservedItemRow } from '../lib/productionBatchReserve';

const BASE = '/api/v1/production';

/* ── Equipment ── */

export interface MfgEquipmentRow {
  id: string; name: string; cap: number; type: string;
  homogenizer: boolean; processType: string[]; status: string; _pk: number;
}

export interface FillingEquipmentRow {
  id: string; name: string; speed: number; type: string;
  compatible: string[]; status: string; _pk: number;
}

export interface PackagingEquipmentRow {
  id: string; name: string; speed: number; type: string;
  supports: string[]; status: string; _pk: number;
}

export interface EquipmentData {
  manufacturing: MfgEquipmentRow[];
  filling: FillingEquipmentRow[];
  packaging: PackagingEquipmentRow[];
}

export async function fetchEquipment(): Promise<EquipmentData> {
  const res = await api.get<EquipmentData>(`${BASE}/equipment`);
  const data = (res as any)?.data ?? res;
  return data ?? { manufacturing: [], filling: [], packaging: [] };
}

export async function createEquipment(payload: Record<string, unknown>) {
  const res = await api.post(`${BASE}/equipment`, payload);
  return (res as any)?.data ?? res;
}

export async function updateEquipment(pk: number, payload: Record<string, unknown>) {
  const res = await api.patch(`${BASE}/equipment/${pk}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteEquipment(pk: number) {
  const res = await api.delete(`${BASE}/equipment/${pk}`);
  return (res as any)?.data ?? res;
}

/* ── Team ── */

export interface TeamMemberRow {
  id: string; userId: number | null; name: string; role: string; dept: string;
  avail: boolean; _pk: number | null;
}

export async function fetchTeam(): Promise<TeamMemberRow[]> {
  const res = await api.get<TeamMemberRow[]>(`${BASE}/team`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Batches (BMR / BPR) ── */

export interface DispensingItem {
  code: string; inci?: string; name?: string;
  required: number; dispensed: number; done: boolean;
  trayContainer?: string;
  traySlot?: string;
  dispensedAt?: string;
}

export interface QCSpec {
  param: string; spec: string; result: string; passed: boolean | null;
}

/** Stored in production_batches.qc_specs JSON — keeps BMR / fill / pack checklists separate (legacy: flat array = BMR only). */
export interface QcSpecsByScope {
  bmr?: QCSpec[];
  fill?: QCSpec[];
  pack?: QCSpec[];
  remarksBmr?: string;
  remarksFill?: string;
  remarksPack?: string;
}
export type QcSpecsStored = QCSpec[] | QcSpecsByScope;

export interface BatchRow {
  _pk: number;
  bmrNo: string; bprNo: string; productName: string; sku: string;
  soNo: string; orderQty: number; batchSize: number; batchNo: string;
  batchIndex: number; totalBatches: number;
  bmrStatus: string; bprStatus: string; color: string;
  processType: string; homogenizer: boolean;
  mainVessel: string; supportingTanks: string[];
  fillingLine: string; fillingType: string; packagingLine: string;
  monocarton: boolean; shrink: boolean;
  teamBMR: string[]; teamBPR: string[];
  shiftLeadBMR: string; shiftLeadBPR: string;
  qcOfficerBMR: string; qcOfficerBPR: string;
  /** Manufacturing unit zone (MTR receive) set when scheduling the batch. */
  scheduledMuZone?: string;
  scheduleRemarks?: string;
  mfgDate: string; fillDate: string; packDate: string; fgDate: string;
  rmConnectDate: string; pmConnectDate: string;
  rmReserved: boolean; pmReserved: boolean;
  rmConnected: boolean; pmConnected: boolean;
  dispensingRM: DispensingItem[]; dispensingPM: DispensingItem[];
  bulkYield: number | null; fillYield: number | null; fgYield: number | null;
  bulkBatchAccepted: boolean | null; fillBatchAccepted: boolean | null; fgBatchAccepted: boolean | null;
  qcSpecs: QcSpecsStored; remarks: string; dueDate: string;
  compatibleVessels?: string[]; compatibleFillLines?: string[]; compatiblePackLines?: string[];
  /** Required vessel volume in liters (from BOM specific gravity + batch size). */
  requiredVolumeLiters?: number | null;
  /** planning_batches.id — when set, batch can be used as base for rework (Create New Batch). */
  planningBatchId?: number | null;
  /** Latest MU dispensing bundle (RM+PM qty consumed from ML1/ML2/WH in one PATCH). */
  muDispensingBundleId?: string | null;
  /** Audit trail of MU bundles with PR list + RM/PM line qty for that consumption event. */
  muDispensingBundles?: MuDispensingBundleSnapshot[];
}

export interface MuDispensingBundleSnapshot {
  bundleId: string;
  at: string;
  procurementRequests: { id: number; planningBatchId: number | null; status: string | null }[];
  rm: { code: string; qty: number }[];
  pm: { code: string; qty: number }[];
}

/** Sync production batches from sent planning batches (creates missing BMR/BPR rows). Idempotent. */
export async function syncBatchesFromPlanning(): Promise<{ success: boolean; created?: number }> {
  const res = await api.post<{ success: boolean; created?: number }>(`${BASE}/batches/sync-from-planning`);
  const data = (res as any)?.data ?? res;
  return data ?? { success: false };
}

export async function fetchBatches(): Promise<BatchRow[]> {
  const res = await api.get<BatchRow[]>(`${BASE}/batches`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function fetchBatchById(pk: number): Promise<BatchRow | null> {
  try {
    const res = await api.get<BatchRow>(`${BASE}/batches/${pk}`);
    return ((res as any)?.data ?? res) ?? null;
  } catch {
    return null;
  }
}

export type BatchReservedStockMaps = {
  /** Reserved for this production batch (reserved_batch_items). */
  byCode: Record<string, number>;
  /** Reserved by other batches — not available for this batch's reserve/MTR. */
  otherBatchesByCode: Record<string, number>;
};

/** Reserved qty maps for this production batch by material code (MTR + Reserve modals). */
export async function fetchBatchMtrReserved(pk: number): Promise<BatchReservedStockMaps> {
  try {
    const res = await api.get<{
      success?: boolean;
      byCode?: Record<string, number>;
      otherBatchesByCode?: Record<string, number>;
    }>(`${BASE}/batches/${pk}/mtr-reserved`);
    const data = (res as { data?: BatchReservedStockMaps })?.data ?? res;
    const byCode =
      (data as { byCode?: Record<string, number> })?.byCode &&
      typeof (data as { byCode?: Record<string, number> }).byCode === 'object'
        ? (data as { byCode: Record<string, number> }).byCode
        : {};
    const otherBatchesByCode =
      (data as { otherBatchesByCode?: Record<string, number> })?.otherBatchesByCode &&
      typeof (data as { otherBatchesByCode?: Record<string, number> }).otherBatchesByCode === 'object'
        ? (data as { otherBatchesByCode: Record<string, number> }).otherBatchesByCode
        : {};
    return { byCode, otherBatchesByCode };
  } catch {
    return { byCode: {}, otherBatchesByCode: {} };
  }
}

export async function createBatch(payload: Record<string, unknown>): Promise<BatchRow> {
  const res = await api.post<BatchRow>(`${BASE}/batches`, payload);
  return (res as any)?.data ?? res;
}

export type CreateReworkOptions = {
  reason?: string;
  targetOrderQty?: number;
  targetBatchSizeKg?: number;
  rmLines?: Array<Record<string, unknown>>;
  pmLines?: Array<Record<string, unknown>>;
};

/** Create a rework batch (BMR-YYYY-NNN-rw-01, rw-02, ...) from an existing batch. */
export async function createRworkBatch(baseBatchId: number, reasonOrOptions?: string | CreateReworkOptions): Promise<BatchRow> {
  const payload: Record<string, unknown> = { baseBatchId };
  if (typeof reasonOrOptions === 'string') {
    payload.reason = reasonOrOptions;
  } else if (reasonOrOptions && typeof reasonOrOptions === 'object') {
    payload.reason = reasonOrOptions.reason ?? '';
    if (reasonOrOptions.targetOrderQty != null) payload.targetOrderQty = reasonOrOptions.targetOrderQty;
    if (reasonOrOptions.targetBatchSizeKg != null) payload.targetBatchSizeKg = reasonOrOptions.targetBatchSizeKg;
    if (Array.isArray(reasonOrOptions.rmLines)) payload.rmLines = reasonOrOptions.rmLines;
    if (Array.isArray(reasonOrOptions.pmLines)) payload.pmLines = reasonOrOptions.pmLines;
  } else {
    payload.reason = '';
  }
  const res = await api.post<BatchRow>(`${BASE}/batches/create-rework`, payload);
  return (res as any)?.data ?? res;
}

export interface SplitBatchForVesselResult {
  original: BatchRow;
  split: BatchRow;
}

/** Split an oversized batch into vessel-sized first run + sp-NN remainder batch. */
export async function splitBatchForVessel(
  baseBatchId: number,
  firstRunSizeKg: number,
  reason?: string,
): Promise<SplitBatchForVesselResult> {
  const res = await api.post<SplitBatchForVesselResult>(`${BASE}/batches/split-for-vessel`, {
    baseBatchId,
    firstRunSizeKg,
    reason: reason ?? '',
  });
  return (res as { data?: SplitBatchForVesselResult }).data ?? (res as SplitBatchForVesselResult);
}

export async function updateBatch(pk: number, payload: Record<string, unknown>): Promise<BatchRow> {
  const res = await api.patch<BatchRow>(`${BASE}/batches/${pk}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteBatch(pk: number) {
  const res = await api.delete(`${BASE}/batches/${pk}`);
  return (res as any)?.data ?? res;
}

/** RM/PM row from master with bulk quality specs (form_data) for BMR Bulk QC. */
export interface QcIngredientBulkSpecRow {
  type: 'RM' | 'PM';
  id: number;
  code: string;
  name: string;
  inci: string;
  /** Label → value (e.g. "Assay / Purity %" → "NLT 98%"). */
  specs: Record<string, string>;
}

/** Product Specs & Stability (BOM → FG) for BPR Pack QC. */
export interface QcReferencePayload {
  ingredientBulkSpecs: QcIngredientBulkSpecRow[];
  fgProductSpecs: Record<string, string>;
}

/** BOM for a production batch (batch-specific from planning when available, else product master BOM). */
export interface BatchBOMResponse {
  success: boolean;
  data?: {
    rmLines: Array<Record<string, unknown>>;
    pmLines: Array<Record<string, unknown>>;
    source: 'planning_batch' | 'product_bom';
    /** When source is planning_batch, use this for RM/PM required (planned batch size in kg). */
    batchSizeKg?: number | null;
    qcReference?: QcReferencePayload;
  };
  error?: string;
}

export interface BatchDispensingMuStockResponse {
  success: boolean;
  scheduledMuZone?: string;
  /** Exact DECIMAL strings from DB (ml1_stock / ml2_stock bucket). */
  rmByCode?: Record<string, string>;
  pmByCode?: Record<string, string>;
  error?: string;
}

/** Qty at batch manufacturing zone per code (same source as dispensing PATCH validation). */
export async function fetchBatchDispensingMuStock(batchPk: number): Promise<BatchDispensingMuStockResponse> {
  try {
    const res = await api.get<BatchDispensingMuStockResponse>(`${BASE}/batches/${batchPk}/dispensing-mu-stock`);
    const body = (res as {
      success?: boolean;
      scheduledMuZone?: string;
      rmByCode?: Record<string, string | number>;
      pmByCode?: Record<string, string | number>;
    }) ?? res;
    if (body?.success) {
      const toStrMap = (m: Record<string, string | number> | undefined): Record<string, string> => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(m ?? {})) {
          out[k] = typeof v === 'string' ? v : String(v);
        }
        return out;
      };
      return {
        success: true,
        scheduledMuZone: body.scheduledMuZone,
        rmByCode: toStrMap(body.rmByCode),
        pmByCode: toStrMap(body.pmByCode),
      };
    }
    return { success: false, error: 'Invalid response' };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to load dispensing MU stock',
    };
  }
}

export async function fetchBOMByBatchId(batchPk: number): Promise<BatchBOMResponse> {
  try {
    const path = `${BASE}/batches/${batchPk}/bom`;
    console.log('[BOM-DEBUG] Dashboard calling GET', path, '(production_batch id =', batchPk, ')');
    const res = await api.get<{ success: boolean; data: { rmLines: unknown[]; pmLines: unknown[]; source: string; batchSizeKg?: number | null } }>(path);
    // Backend returns { success, data } directly; api.get returns that same object (not wrapped in .data).
    const body = res as { success?: boolean; data?: { rmLines: unknown[]; pmLines: unknown[]; source: string; batchSizeKg?: number | null } };
    if (body?.success && body?.data) {
      const qc = body.data.qcReference;
      const qcReference: QcReferencePayload | undefined =
        qc && typeof qc === 'object'
          ? {
              ingredientBulkSpecs: Array.isArray(qc.ingredientBulkSpecs) ? qc.ingredientBulkSpecs : [],
              fgProductSpecs:
                qc.fgProductSpecs && typeof qc.fgProductSpecs === 'object' ? (qc.fgProductSpecs as Record<string, string>) : {},
            }
          : undefined;
      return {
        success: true,
        data: {
          rmLines: Array.isArray(body.data.rmLines) ? body.data.rmLines : [],
          pmLines: Array.isArray(body.data.pmLines) ? body.data.pmLines : [],
          source: body.data.source === 'planning_batch' ? 'planning_batch' : 'product_bom',
          batchSizeKg: body.data.batchSizeKg ?? undefined,
          qcReference,
        },
      };
    }
    return { success: false, data: undefined, error: 'Invalid response' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load batch BOM';
    return { success: false, data: undefined, error: message };
  }
}

export async function fetchProductionReservedItems(): Promise<ProductionReservedItemRow[]> {
  try {
    const res = await api.get<{ success?: boolean; data?: ProductionReservedItemRow[] }>(`${BASE}/reserved-items`);
    const data = (res as { data?: ProductionReservedItemRow[] })?.data ?? res;
    const items = (data as { data?: ProductionReservedItemRow[] })?.data ?? data;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function reserveProductionBatchLines(
  batchPk: number,
  payload: { kind: 'RM' | 'PM'; codes: string[] },
): Promise<{ success: boolean; error?: string; shortages?: unknown }> {
  try {
    await api.post(`${BASE}/batches/${batchPk}/reserve-lines`, {
      kind: payload.kind.toLowerCase(),
      codes: payload.codes,
    });
    return { success: true };
  } catch (e) {
    const err = e as Error & { body?: { error?: string; shortages?: unknown } };
    return {
      success: false,
      error: err?.body?.error || (e instanceof Error ? e.message : 'Reserve failed'),
      shortages: err?.body?.shortages,
    };
  }
}

export async function unreserveProductionBatchLines(
  batchPk: number,
  payload: { kind: 'RM' | 'PM'; codes: string[] },
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.post(`${BASE}/batches/${batchPk}/unreserve-lines`, {
      kind: payload.kind.toLowerCase(),
      codes: payload.codes,
    });
    return { success: true };
  } catch (e) {
    const err = e as Error & { body?: { error?: string } };
    return {
      success: false,
      error: err?.body?.error || (e instanceof Error ? e.message : 'Unreserve failed'),
    };
  }
}

export async function fetchBatchReservationCoverage(
  batchPk: number,
): Promise<{ rm: BatchMaterialCoverage; pm: BatchMaterialCoverage } | null> {
  try {
    const res = await api.get<{
      success?: boolean;
      data?: { rm: BatchMaterialCoverage; pm: BatchMaterialCoverage };
    }>(`${BASE}/batches/${batchPk}/reservation-coverage`);
    const body = (res as { data?: { rm: BatchMaterialCoverage; pm: BatchMaterialCoverage } })?.data ?? res;
    const data = (body as { data?: { rm: BatchMaterialCoverage; pm: BatchMaterialCoverage } })?.data ?? body;
    if (data && typeof data === 'object' && 'rm' in data && 'pm' in data) {
      return data as { rm: BatchMaterialCoverage; pm: BatchMaterialCoverage };
    }
    return null;
  } catch {
    return null;
  }
}
