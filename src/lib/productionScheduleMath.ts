/**
 * Production schedule recommendation math — pure functions for date arithmetic,
 * equipment occupancy, volume-based vessel compatibility, and best/slot-based recommendations.
 * All logic is unit-tested; keep this module dependency-free (no React, no API).
 */

/** Minimal batch shape for occupancy check (scheduled equipment + dates). */
export interface ScheduledBatchLike {
  mainVessel?: string;
  mfgDate?: string;
  supportingTanks?: string[];
  fillingLine?: string;
  fillDate?: string;
  packagingLine?: string;
  packDate?: string;
  /** Units to fill (bottles/tubes/jars) for capacity aggregation. Optional. */
  fillUnitsRequired?: number | null;
  /** Units to pack for capacity aggregation. Optional. */
  packUnitsRequired?: number | null;
  /** Optional; used to exclude this batch when summing used capacity (e.g. current batch being scheduled). */
  bmrNo?: string;
}

/** Minimal batch shape for schedule recommendation (volume, compat, filling type). */
export interface BatchForScheduleLike {
  requiredVolumeLiters?: number | null;
  batchSize: number;
  compatibleVessels?: string[];
  compatibleFillLines?: string[];
  compatiblePackLines?: string[];
  fillingType?: string;
  /** Units to fill (bottles/tubes/jars) for FL capacity check. When set, recommendation prefers lines with enough remaining capacity. */
  fillUnitsRequired?: number | null;
  /** Units to pack for PL capacity check. */
  packUnitsRequired?: number | null;
  /** Optional batch id (e.g. bmrNo) to exclude when summing used capacity. */
  bmrNo?: string;
}

/** Manufacturing vessel (capacity in liters). */
export interface MfgEquipLike {
  id: string;
  name?: string;
  cap?: number;
  type?: string;
}

/** Filling line (compatible package types; speed in units/hr for capacity scheduling). */
export interface FillEquipLike {
  id: string;
  name?: string;
  compatible: string[];
  /** Capacity in units per hour (e.g. 3000/hr). Used with working hours to compute daily capacity. */
  speed?: number;
}

/** Packaging line (speed in units/hr for capacity scheduling). */
export interface PackEquipLike {
  id: string;
  name?: string;
  /** Capacity in units per hour (e.g. 4000/hr). */
  speed?: number;
}

/** Default working hours per day for FL/PL daily capacity. */
export const DEFAULT_WORKING_HOURS_PER_DAY = 8;

export interface EquipmentLike {
  manufacturing: MfgEquipLike[];
  filling: FillEquipLike[];
  packaging: PackEquipLike[];
}

export interface ScheduleSlotLike {
  equipId: string;
  category: 'mfg' | 'fill' | 'pack';
  dateIso: string;
}

/** Minimal shape for dispensing items (code + required qty). */
export interface DispensingItemLike {
  code: string;
  required: number;
  /** Optional specific gravity for volume: volume_L = kg / (specificGravity || 1). */
  specificGravity?: number;
}

/** Per-RM volume line: kg, specific gravity, volume in L. */
export interface RmVolumeLine {
  code: string;
  kg: number;
  specificGravity: number;
  volumeL: number;
}

/** Result of RM volume breakdown for Smart Schedule / console. */
export interface RmVolumeBreakdown {
  lines: RmVolumeLine[];
  totalVolumeL: number;
}

/**
 * Compute RM volume breakdown: for each RM, volume_L = kg / (specificGravity || 1); total = sum.
 * Used to log total RMs, their kg → specific gravity → volume → total volume (e.g. in Smart Schedule).
 */
export function computeRmVolumeBreakdown(
  items: { code: string; required: number; specificGravity?: number }[],
): RmVolumeBreakdown {
  const lines: RmVolumeLine[] = [];
  let totalVolumeL = 0;
  for (const it of items ?? []) {
    const kg = Number(it.required) || 0;
    const sg = Number(it.specificGravity) > 0 ? Number(it.specificGravity) : 1;
    const volumeL = Math.round((kg / sg) * 100) / 100;
    lines.push({ code: it.code, kg, specificGravity: sg, volumeL });
    totalVolumeL += volumeL;
  }
  totalVolumeL = Math.round(totalVolumeL * 100) / 100;
  return { lines, totalVolumeL };
}

/** BOM RM line shape for volume calculation (pct_w_w or pct, optional specific_gravity). */
export interface RmLineForVolumeLike {
  pct_w_w?: number;
  pct?: number;
  specific_gravity?: number;
}

/**
 * Compute total batch volume in liters from BOM rm_lines.
 * Same formula as backend: per line volume_L = (batchSizeKg * pct_w_w/100) / (specific_gravity || 1); total = sum. Rounds to 2 decimals.
 * Returns null if batchSizeKg falsy or rmLines empty/missing.
 */
export function computeVolumeFromBomRmLines(
  batchSizeKg: number,
  rmLines: RmLineForVolumeLike[] | null | undefined,
): number | null {
  const kg = Number(batchSizeKg) || 0;
  if (kg <= 0) return null;
  const lines = Array.isArray(rmLines) ? rmLines : [];
  if (lines.length === 0) return null;
  let totalL = 0;
  for (const line of lines) {
    const pct = Number(line.pct_w_w ?? line.pct ?? 0) || 0;
    const sg = Number(line.specific_gravity) > 0 ? Number(line.specific_gravity) : 1;
    if (sg <= 0) continue;
    const qtyKg = (kg * pct) / 100;
    totalL += qtyKg / sg;
  }
  return Math.round(totalL * 100) / 100;
}

/** Batch with RM/PM dispensing lists for materials-available check. */
export interface BatchWithDispensingLike {
  dispensingRM?: DispensingItemLike[];
  dispensingPM?: DispensingItemLike[];
}

/**
 * True if all RM and PM required by the batch are available in stock.
 * Used to determine if a batch can be scheduled (no "sent from Planning" required).
 */
export function isBatchMaterialsAvailable(
  batch: BatchWithDispensingLike,
  stockRM: Record<string, number>,
  stockPM: Record<string, number>,
): boolean {
  const rm = batch.dispensingRM ?? [];
  const pm = batch.dispensingPM ?? [];
  const rmOk = rm.length === 0 || rm.every((r) => (stockRM[r.code] ?? 0) >= r.required);
  const pmOk = pm.length === 0 || pm.every((p) => (stockPM[p.code] ?? 0) >= p.required);
  return rmOk && pmOk;
}

const AVAIL_EPS = 1e-6;

export interface InTransitBreakdownLike {
  quantity: number;
  expectedDate?: string | null;
}

/** Warehouse row shape for computing when a material line is fully available at WH. */
export interface WarehouseInventoryForAvailabilityLike {
  code: string;
  type: 'RM' | 'PM';
  available?: number;
  stockInHand?: number;
  reserved?: number;
  underGrn?: number;
  poQuantity?: number;
  /** Earliest expected arrival for the open PO qty; dates the PO slice so availableBy can be computed. */
  poConnectingDate?: string | null;
  inTransitBreakdown?: InTransitBreakdownLike[];
}

export interface MaterialAvailableByResult {
  code: string;
  required: number;
  availableNow: number;
  /** ISO date when cumulative WH supply covers required; null if cannot determine */
  availableBy: string | null;
  coveredNow: boolean;
  shortfall: number;
  needsUnknownPipeline: boolean;
}

export interface BatchMaterialsAvailableBySummary {
  rm: MaterialAvailableByResult[];
  pm: MaterialAvailableByResult[];
  maxRmAvailableBy: string | null;
  maxPmAvailableBy: string | null;
  allRmCoveredNow: boolean;
  allPmCoveredNow: boolean;
  rmIncomplete: boolean;
  pmIncomplete: boolean;
}

function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
}

export function normalizeIsoDateOnly(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Latest non-null ISO date from a list. */
export function maxIsoDate(...dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => Boolean(normalizeIsoDateOnly(d)));
  if (!valid.length) return null;
  return [...valid].sort(compareIsoDate).pop() ?? null;
}

/**
 * When a batch line needs more than WH available now, walk Under GRN → in-transit (GRN/PO ETA) → open PO
 * pipeline in date order until required qty is covered. Returns the date of the last slice needed.
 */
export function computeLineAvailableByDate(
  required: number,
  inventory: WarehouseInventoryForAvailabilityLike | undefined,
  todayIso: string,
): MaterialAvailableByResult {
  const req = Math.max(0, Number(required) || 0);
  const code = String(inventory?.code ?? '').trim();

  const availableNow =
    inventory != null
      ? Math.max(
          0,
          Number(
            inventory.available ??
              (Number(inventory.stockInHand) || 0) - (Number(inventory.reserved) || 0),
          ) || 0,
        )
      : 0;

  if (req <= AVAIL_EPS) {
    return {
      code,
      required: req,
      availableNow,
      availableBy: todayIso,
      coveredNow: true,
      shortfall: 0,
      needsUnknownPipeline: false,
    };
  }

  if (availableNow + AVAIL_EPS >= req) {
    return {
      code,
      required: req,
      availableNow,
      availableBy: todayIso,
      coveredNow: true,
      shortfall: 0,
      needsUnknownPipeline: false,
    };
  }

  type Slice = { date: string | null; qty: number; unknown: boolean };
  const slices: Slice[] = [];

  const underGrn = Math.max(0, Number(inventory?.underGrn) || 0);
  if (underGrn > AVAIL_EPS) {
    slices.push({ date: todayIso, qty: underGrn, unknown: false });
  }

  for (const b of inventory?.inTransitBreakdown ?? []) {
    const qty = Math.max(0, Number(b.quantity) || 0);
    if (qty <= AVAIL_EPS) continue;
    slices.push({ date: normalizeIsoDateOnly(b.expectedDate), qty, unknown: !normalizeIsoDateOnly(b.expectedDate) });
  }

  const poOpen = Math.max(0, Number(inventory?.poQuantity) || 0);
  if (poOpen > AVAIL_EPS) {
    // Use the PO's connecting date (expected arrival) when set, so PO-covered materials contribute a
    // dated slice and the batch gets a real available-by date instead of an unknown pipeline.
    const poDate = normalizeIsoDateOnly(inventory?.poConnectingDate);
    slices.push({ date: poDate, qty: poOpen, unknown: !poDate });
  }

  slices.sort((a, b) => {
    if (a.unknown && b.unknown) return 0;
    if (a.unknown) return 1;
    if (b.unknown) return -1;
    return compareIsoDate(a.date!, b.date!);
  });

  let pool = availableNow;
  let lastKnownDate: string | null = null;
  let needsUnknownPipeline = false;

  for (const s of slices) {
    if (pool + AVAIL_EPS >= req) break;
    pool += s.qty;
    if (s.unknown) {
      needsUnknownPipeline = true;
    } else if (s.date) {
      lastKnownDate = s.date;
    }
  }

  if (pool + AVAIL_EPS >= req) {
    return {
      code,
      required: req,
      availableNow,
      availableBy: needsUnknownPipeline ? null : (lastKnownDate ?? todayIso),
      coveredNow: false,
      shortfall: 0,
      needsUnknownPipeline,
    };
  }

  return {
    code,
    required: req,
    availableNow,
    availableBy: null,
    coveredNow: false,
    shortfall: Math.max(0, req - pool),
    needsUnknownPipeline: true,
  };
}

export function computeBatchMaterialsAvailableBy(
  dispensingRm: DispensingItemLike[],
  dispensingPm: DispensingItemLike[],
  inventoryRows: WarehouseInventoryForAvailabilityLike[],
  todayIso: string,
): BatchMaterialsAvailableBySummary {
  const rmByCode = new Map(
    inventoryRows
      .filter((r) => r.type === 'RM')
      .map((r) => [String(r.code).trim(), r]),
  );
  const pmByCode = new Map(
    inventoryRows
      .filter((r) => r.type === 'PM')
      .map((r) => [String(r.code).trim(), r]),
  );

  const rm = (dispensingRm ?? []).map((line) =>
    computeLineAvailableByDate(
      line.required,
      rmByCode.get(String(line.code).trim()),
      todayIso,
    ),
  );
  const pm = (dispensingPm ?? []).map((line) =>
    computeLineAvailableByDate(
      line.required,
      pmByCode.get(String(line.code).trim()),
      todayIso,
    ),
  );

  const rmIncomplete = rm.some((l) => l.availableBy == null);
  const pmIncomplete = pm.some((l) => l.availableBy == null);

  return {
    rm,
    pm,
    maxRmAvailableBy: rm.length === 0 || rmIncomplete ? null : maxIsoDate(...rm.map((l) => l.availableBy)),
    maxPmAvailableBy: pm.length === 0 || pmIncomplete ? null : maxIsoDate(...pm.map((l) => l.availableBy)),
    allRmCoveredNow: rm.every((l) => l.coveredNow),
    allPmCoveredNow: pm.every((l) => l.coveredNow),
    rmIncomplete,
    pmIncomplete,
  };
}

/** RM connect @ WH: latest of warehouse availability and 2 days before MFG. */
export function suggestedRmConnectDate(
  mfgDate: string,
  maxRmAvailableBy: string | null,
  todayIso: string,
): string {
  const fromMfg = addDaysToDateStr(mfgDate, -2);
  if (!maxRmAvailableBy) return fromMfg || todayIso;
  return maxIsoDate(fromMfg, maxRmAvailableBy, todayIso) ?? fromMfg ?? todayIso;
}

/** PM connect @ WH: latest of warehouse availability and 2 days before fill. */
export function suggestedPmConnectDate(
  fillDate: string,
  maxPmAvailableBy: string | null,
  todayIso: string,
): string {
  const fromFill = addDaysToDateStr(fillDate, -2);
  if (!maxPmAvailableBy) return fromFill || todayIso;
  return maxIsoDate(fromFill, maxPmAvailableBy, todayIso) ?? fromFill ?? todayIso;
}

/** Earliest MFG date once all RM are at WH (2-day buffer after last RM arrival). */
export function earliestMfgDateAfterRmAvailable(maxRmAvailableBy: string | null): string | null {
  if (!maxRmAvailableBy) return null;
  return addDaysToDateStr(maxRmAvailableBy, 2);
}

export interface ScheduleRecommendationResult {
  mfgDate: string;
  fillDate: string;
  packDate: string;
  fgDate: string;
  rmConnectDate: string;
  pmConnectDate: string;
  vessel: string;
  fillLine: string;
  packLine: string;
  vesselName: string;
  fillLineName: string;
  packLineName: string;
  confidenceScore: number;
  reasons: string[];
}

/** Add n days to an ISO date string (YYYY-MM-DD). Returns '' if dateStr is falsy. */
export function addDaysToDateStr(dateStr: string, n: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/** Derive fill, pack, fg, rm, pm dates from mfg date (fixed offsets). */
export function deriveScheduleDatesFromMfg(mfgDate: string): {
  fillDate: string;
  packDate: string;
  fgDate: string;
  rmConnectDate: string;
  pmConnectDate: string;
} {
  const fillDate = addDaysToDateStr(mfgDate, 3);
  const packDate = addDaysToDateStr(fillDate, 1);
  const fgDate = addDaysToDateStr(packDate, 1);
  const rmConnectDate = addDaysToDateStr(mfgDate, -2);
  const pmConnectDate = addDaysToDateStr(fillDate, -2);
  return { fillDate, packDate, fgDate, rmConnectDate, pmConnectDate };
}

/** Batch volume in liters for vessel compatibility (requiredVolumeLiters ?? batchSize fallback). */
export function getBatchVolumeLiters(batch: BatchForScheduleLike): number {
  return batch.requiredVolumeLiters ?? batch.batchSize;
}

/** Vessel IDs that can hold the batch volume (cap >= batchVolL, type !== 'support'). If none fit, returns all non-support vessels so callers (e.g. Smart Schedule) always get a suggestion. */
export function getCompatibleVesselIds(
  batch: BatchForScheduleLike,
  manufacturing: MfgEquipLike[],
): string[] {
  const list = manufacturing ?? [];
  const nonSupport = list.filter((e) => e.type !== 'support').map((e) => e.id);
  if (batch.compatibleVessels?.length) return batch.compatibleVessels;
  const vol = getBatchVolumeLiters(batch);
  const byCap = list
    .filter((e) => e.type !== 'support' && (e.cap ?? 0) >= vol)
    .map((e) => e.id);
  return byCap.length > 0 ? byCap : nonSupport;
}

/** True when vessel, fill line, and pack line are all assigned. */
export function hasBatchEquipmentReserved(
  batch: Pick<ScheduledBatchLike, 'mainVessel' | 'fillingLine' | 'packagingLine'>,
): boolean {
  return Boolean(
    String(batch.mainVessel || '').trim()
    && String(batch.fillingLine || '').trim()
    && String(batch.packagingLine || '').trim(),
  );
}

export interface ScheduleEquipmentReservationInput {
  mainVessel: string;
  fillingLine: string;
  packagingLine: string;
  supportingTanks?: string[];
  mfgDate: string;
  fillDate: string;
  packDate: string;
}

/** Client-side validation before saving schedule — requires equipment and checks occupancy. */
export function validateScheduleEquipmentReservation(
  input: ScheduleEquipmentReservationInput,
  batches: ScheduledBatchLike[],
  excludeBmrNo?: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const mainVessel = String(input.mainVessel || '').trim();
  const fillingLine = String(input.fillingLine || '').trim();
  const packagingLine = String(input.packagingLine || '').trim();
  const mfgDate = String(input.mfgDate || '').trim();
  const fillDate = String(input.fillDate || '').trim();
  const packDate = String(input.packDate || '').trim();

  if (!mfgDate) errors.push('Manufacturing date is required.');
  if (!fillDate) errors.push('Fill date is required.');
  if (!packDate) errors.push('Pack date is required.');
  if (!mainVessel) errors.push('Select a manufacturing vessel.');
  if (!fillingLine) errors.push('Select a filling line.');
  if (!packagingLine) errors.push('Select a packaging line.');

  if (mainVessel && mfgDate && !isEquipmentFreeOnDate(batches, mainVessel, mfgDate, excludeBmrNo)) {
    const blocked = getEquipmentOccupiedOnDate(batches, mainVessel, mfgDate, excludeBmrNo);
    errors.push(
      blocked
        ? `Vessel ${mainVessel} is reserved on ${blocked}. Available from ${equipmentAvailableFromDate(blocked)}.`
        : `Vessel ${mainVessel} is not available on ${mfgDate}.`,
    );
  }
  if (fillingLine && fillDate && !isEquipmentFreeOnDate(batches, fillingLine, fillDate, excludeBmrNo)) {
    const blocked = getEquipmentOccupiedOnDate(batches, fillingLine, fillDate, excludeBmrNo);
    errors.push(
      blocked
        ? `Filling line ${fillingLine} is reserved on ${blocked}. Available from ${equipmentAvailableFromDate(blocked)}.`
        : `Filling line ${fillingLine} is not available on ${fillDate}.`,
    );
  }
  if (packagingLine && packDate && !isEquipmentFreeOnDate(batches, packagingLine, packDate, excludeBmrNo)) {
    const blocked = getEquipmentOccupiedOnDate(batches, packagingLine, packDate, excludeBmrNo);
    errors.push(
      blocked
        ? `Packaging line ${packagingLine} is reserved on ${blocked}. Available from ${equipmentAvailableFromDate(blocked)}.`
        : `Packaging line ${packagingLine} is not available on ${packDate}.`,
    );
  }
  for (const tankId of input.supportingTanks ?? []) {
    const tid = String(tankId || '').trim();
    if (!tid || !mfgDate) continue;
    if (!isEquipmentFreeOnDate(batches, tid, mfgDate, excludeBmrNo)) {
      const blocked = getEquipmentOccupiedOnDate(batches, tid, mfgDate, excludeBmrNo);
      errors.push(
        blocked
          ? `Supporting tank ${tid} is reserved on ${blocked}. Available from ${equipmentAvailableFromDate(blocked)}.`
          : `Supporting tank ${tid} is not available on ${mfgDate}.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * True when no other batch reserves this equipment on the same stage date.
 * Equipment reserved on date D is available again from D+1 onward.
 */
export function isEquipmentFreeOnDate(
  batches: ScheduledBatchLike[],
  equipId: string,
  dateStr: string,
  excludeBmrNo?: string,
): boolean {
  return getEquipmentOccupiedOnDate(batches, equipId, dateStr, excludeBmrNo) == null;
}

/** First equipment ID from list that is free on dateStr, or '' if none free. */
export function getFirstFreeEquipment(
  equipIds: string[],
  dateStr: string,
  batches: ScheduledBatchLike[],
): string {
  const free = (id: string) => isEquipmentFreeOnDate(batches, id, dateStr);
  return equipIds.find((id) => free(id)) ?? '';
}

/** Resolve equipment display name by category. Never returns undefined. */
export function getEquipDisplayName(
  equipment: EquipmentLike,
  id: string,
  kind: 'mfg' | 'fill' | 'pack',
): string {
  const fallback = id ?? '—';
  if (kind === 'mfg') return equipment.manufacturing?.find((e) => e.id === id)?.name ?? fallback;
  if (kind === 'fill') return equipment.filling?.find((e) => e.id === id)?.name ?? fallback;
  return equipment.packaging?.find((e) => e.id === id)?.name ?? fallback;
}

/** Prefer batch-compatible IDs; fall back to full catalog when compat list is empty or stale. */
export function resolveScheduleEquipIds(preferredIds: string[], catalogIds: string[]): string[] {
  const catalog = new Set(catalogIds);
  const matched = preferredIds.filter((id) => catalog.has(id));
  if (matched.length > 0) return matched;
  return catalogIds;
}

/** ISO date when equipment becomes free again after a same-day reservation (exclusive end → next day). */
export function equipmentAvailableFromDate(reservedOnDate: string): string {
  return addDaysToDateStr(reservedOnDate, 1);
}

/** Stage date another batch holds this equipment, if it blocks the requested date (same calendar day). */
export function getEquipmentOccupiedOnDate(
  batches: ScheduledBatchLike[],
  equipId: string,
  dateStr: string,
  excludeBmrNo?: string,
): string | null {
  if (!equipId || !dateStr) return null;
  for (const b of batches) {
    if (excludeBmrNo && b.bmrNo === excludeBmrNo) continue;
    if (b.mainVessel === equipId && b.mfgDate === dateStr) return b.mfgDate ?? dateStr;
    if (b.fillingLine === equipId && b.fillDate === dateStr) return b.fillDate ?? dateStr;
    if (b.packagingLine === equipId && b.packDate === dateStr) return b.packDate ?? dateStr;
    if (b.supportingTanks?.includes(equipId) && b.mfgDate === dateStr) return b.mfgDate ?? dateStr;
  }
  return null;
}

/** Fill/pack compat IDs for batch (filling type and packaging list). */
export function getCompatibleFillLineIds(
  batch: BatchForScheduleLike,
  filling: FillEquipLike[],
): string[] {
  if (batch.compatibleFillLines?.length) return batch.compatibleFillLines;
  const fillType = batch.fillingType ?? 'bottle';
  const byType = filling.filter((e) => e.compatible?.includes(fillType)).map((e) => e.id);
  return byType.length > 0 ? byType : filling.map((e) => e.id);
}

export function getCompatiblePackLineIds(
  batch: BatchForScheduleLike,
  packaging: PackEquipLike[],
): string[] {
  if (batch.compatiblePackLines?.length) return batch.compatiblePackLines;
  return packaging.map((e) => e.id);
}

/** Daily fill capacity (units) for a line: speed * workingHours. Returns 0 if no speed. */
export function getFillLineDailyCapacity(
  line: FillEquipLike,
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
): number {
  const speed = Number(line.speed) || 0;
  return speed * workingHoursPerDay;
}

/** Daily pack capacity (units) for a line: speed * workingHours. Returns 0 if no speed. */
export function getPackLineDailyCapacity(
  line: PackEquipLike,
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
): number {
  const speed = Number(line.speed) || 0;
  return speed * workingHoursPerDay;
}

/** Total fill units already scheduled on this filling line on this date (from other batches). */
export function getFillLineCapacityUsedOnDate(
  scheduledBatches: ScheduledBatchLike[],
  fillLineId: string,
  dateStr: string,
  excludeBatchBmrNo?: string,
): number {
  return scheduledBatches
    .filter(
      (b) =>
        b.fillingLine === fillLineId &&
        b.fillDate === dateStr &&
        (excludeBatchBmrNo == null || b.bmrNo !== excludeBatchBmrNo),
    )
    .reduce((sum, b) => sum + (b.fillUnitsRequired ?? 0), 0);
}

/** Total pack units already scheduled on this packaging line on this date. */
export function getPackLineCapacityUsedOnDate(
  scheduledBatches: ScheduledBatchLike[],
  packLineId: string,
  dateStr: string,
  excludeBatchBmrNo?: string,
): number {
  return scheduledBatches
    .filter(
      (b) =>
        b.packagingLine === packLineId &&
        b.packDate === dateStr &&
        (excludeBatchBmrNo == null || b.bmrNo !== excludeBatchBmrNo),
    )
    .reduce((sum, b) => sum + (b.packUnitsRequired ?? 0), 0);
}

/** Remaining fill capacity (units) on line on date after existing scheduled batches. */
export function getFillLineRemainingCapacity(
  filling: FillEquipLike[],
  fillLineId: string,
  dateStr: string,
  scheduledBatches: ScheduledBatchLike[],
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
  excludeBatchBmrNo?: string,
): number {
  const line = filling.find((e) => e.id === fillLineId);
  if (!line) return 0;
  const dailyCap = getFillLineDailyCapacity(line, workingHoursPerDay);
  const used = getFillLineCapacityUsedOnDate(scheduledBatches, fillLineId, dateStr, excludeBatchBmrNo);
  return Math.max(0, dailyCap - used);
}

/** Remaining pack capacity (units) on line on date after existing scheduled batches. */
export function getPackLineRemainingCapacity(
  packaging: PackEquipLike[],
  packLineId: string,
  dateStr: string,
  scheduledBatches: ScheduledBatchLike[],
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
  excludeBatchBmrNo?: string,
): number {
  const line = packaging.find((e) => e.id === packLineId);
  if (!line) return 0;
  const dailyCap = getPackLineDailyCapacity(line, workingHoursPerDay);
  const used = getPackLineCapacityUsedOnDate(scheduledBatches, packLineId, dateStr, excludeBatchBmrNo);
  return Math.max(0, dailyCap - used);
}

/**
 * Pick best fill line for date: prefer one with remaining capacity >= batchUnits (can share line/date with other batches),
 * then first free, then first compatible. Returns first compatible ID if none have enough capacity (caller can show warning).
 */
export function getBestFillLineForDate(
  compatLineIds: string[],
  dateStr: string,
  batchFillUnits: number,
  equipment: EquipmentLike,
  scheduledBatches: ScheduledBatchLike[],
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
  excludeBatchBmrNo?: string,
): string {
  const filling = equipment.filling ?? [];
  const free = (id: string) => isEquipmentFreeOnDate(scheduledBatches, id, dateStr);
  const remaining = (id: string) =>
    getFillLineRemainingCapacity(filling, id, dateStr, scheduledBatches, workingHoursPerDay, excludeBatchBmrNo);

  // Prefer lines with enough remaining capacity (may share day with other batches)
  const withCapacity = compatLineIds.filter((id) => remaining(id) >= batchFillUnits);
  if (withCapacity.length > 0) {
    // Among those, prefer free then by most remaining
    const freeWithCap = withCapacity.filter((id) => free(id));
    const best = freeWithCap.length > 0 ? freeWithCap[0] : withCapacity[0];
    return best;
  }

  // Else first free
  const firstFreeId = compatLineIds.find((id) => free(id));
  if (firstFreeId) return firstFreeId;

  // Else first compatible
  return compatLineIds[0] ?? '';
}

/**
 * Pick best pack line for date: prefer one with remaining capacity >= batchPackUnits (can share line/date),
 * then first free, then first compatible.
 */
export function getBestPackLineForDate(
  compatLineIds: string[],
  dateStr: string,
  batchPackUnits: number,
  equipment: EquipmentLike,
  scheduledBatches: ScheduledBatchLike[],
  workingHoursPerDay: number = DEFAULT_WORKING_HOURS_PER_DAY,
  excludeBatchBmrNo?: string,
): string {
  const packaging = equipment.packaging ?? [];
  const free = (id: string) => isEquipmentFreeOnDate(scheduledBatches, id, dateStr);
  const remaining = (id: string) =>
    getPackLineRemainingCapacity(packaging, id, dateStr, scheduledBatches, workingHoursPerDay, excludeBatchBmrNo);

  const withCapacity = compatLineIds.filter((id) => remaining(id) >= batchPackUnits);
  if (withCapacity.length > 0) {
    const freeWithCap = withCapacity.filter((id) => free(id));
    return (freeWithCap.length > 0 ? freeWithCap[0] : withCapacity[0]);
  }

  const firstFreeId = compatLineIds.find((id) => free(id));
  if (firstFreeId) return firstFreeId;

  return compatLineIds[0] ?? '';
}

export interface ComputeBestScheduleOptions {
  /** Start scanning from this date (default: today). */
  fromDate?: string;
  /** Max days to scan (default: 21). */
  maxDays?: number;
}

/**
 * Compute best schedule recommendation from occupancy and volume: pick earliest date
 * where a compatible vessel (cap >= batch volume) and free fill/pack lines exist.
 */
export function computeBestScheduleRecommendation(
  batch: BatchForScheduleLike,
  equipment: EquipmentLike,
  scheduledBatches: ScheduledBatchLike[],
  options: ComputeBestScheduleOptions = {},
): ScheduleRecommendationResult | null {
  const fromDate = options.fromDate ?? new Date().toISOString().split('T')[0];
  const maxDays = options.maxDays ?? 21;

  const compatV = getCompatibleVesselIds(batch, equipment.manufacturing);
  const compatF = getCompatibleFillLineIds(batch, equipment.filling);
  const compatP = getCompatiblePackLineIds(batch, equipment.packaging);
  if (compatV.length === 0) return null;

  const firstFree = (ids: string[], dateStr: string) =>
    getFirstFreeEquipment(ids, dateStr, scheduledBatches);
  const batchFillUnits = batch.fillUnitsRequired ?? 0;
  const batchPackUnits = batch.packUnitsRequired ?? 0;
  const useCapacityForFill = batchFillUnits > 0 && (equipment.filling ?? []).some((e) => (e.speed ?? 0) > 0);
  const useCapacityForPack = batchPackUnits > 0 && (equipment.packaging ?? []).some((e) => (e.speed ?? 0) > 0);

  for (let d = 0; d < maxDays; d++) {
    const mfgDate = addDaysToDateStr(fromDate, d);
    const { fillDate, packDate, fgDate, rmConnectDate, pmConnectDate } =
      deriveScheduleDatesFromMfg(mfgDate);
    const vessel = firstFree(compatV, mfgDate);
    const fillLine = useCapacityForFill
      ? getBestFillLineForDate(compatF, fillDate, batchFillUnits, equipment, scheduledBatches)
      : firstFree(compatF, fillDate);
    const packLine = useCapacityForPack
      ? getBestPackLineForDate(compatP, packDate, batchPackUnits, equipment, scheduledBatches)
      : firstFree(compatP, packDate);
    if (vessel && fillLine && packLine) {
      const vesselName = getEquipDisplayName(equipment, vessel, 'mfg');
      const fillLineName = getEquipDisplayName(equipment, fillLine, 'fill');
      const packLineName = getEquipDisplayName(equipment, packLine, 'pack');
      const volLabel =
        batch.requiredVolumeLiters != null
          ? `${batch.requiredVolumeLiters.toFixed(1)} L`
          : `${batch.batchSize} KG`;
      const reasons: string[] = [
        `Batch volume ${volLabel} fits ${vesselName} (capacity check)`,
        `${vesselName} free on ${mfgDate}`,
      ];
      if (useCapacityForFill && batchFillUnits > 0) {
        reasons.push(`${fillLineName}: ${batchFillUnits} units fit remaining capacity on ${fillDate}`);
      } else {
        reasons.push(`${fillLineName} free on ${fillDate}`);
      }
      if (useCapacityForPack && batchPackUnits > 0) {
        reasons.push(`${packLineName}: ${batchPackUnits} units fit remaining capacity on ${packDate}`);
      } else {
        reasons.push(`${packLineName} free on ${packDate}`);
      }
      const confidenceScore = Math.min(
        95,
        85 + (batch.requiredVolumeLiters != null ? 5 : 0) + (useCapacityForFill || useCapacityForPack ? 3 : 0),
      );
      return {
        mfgDate,
        fillDate,
        packDate,
        fgDate,
        rmConnectDate,
        pmConnectDate,
        vessel,
        fillLine,
        packLine,
        vesselName,
        fillLineName,
        packLineName,
        confidenceScore,
        reasons,
      };
    }
  }
  return null;
}

/**
 * Compute schedule recommendation when user has picked a calendar slot (fixed vessel/fill/pack + date).
 */
export function computeRecommendedScheduleForSlot(
  slot: ScheduleSlotLike,
  batch: BatchForScheduleLike,
  equipment: EquipmentLike,
  scheduledBatches: ScheduledBatchLike[],
): ScheduleRecommendationResult {
  const manufacturing = equipment.manufacturing ?? [];
  const compatV = getCompatibleVesselIds(batch, manufacturing);
  const compatF = getCompatibleFillLineIds(batch, equipment.filling ?? []);
  const compatP = getCompatiblePackLineIds(batch, equipment.packaging ?? []);
  const firstFree = (ids: string[], dateStr: string) =>
    getFirstFreeEquipment(ids, dateStr, scheduledBatches);
  const firstFreeOrFirst = (ids: string[], dateStr: string) =>
    firstFree(ids, dateStr) || ids[0] || '';
  const batchFillUnits = batch.fillUnitsRequired ?? 0;
  const batchPackUnits = batch.packUnitsRequired ?? 0;
  const useCapacityFill =
    batchFillUnits > 0 && (equipment.filling ?? []).some((e) => (e.speed ?? 0) > 0);
  const useCapacityPack =
    batchPackUnits > 0 && (equipment.packaging ?? []).some((e) => (e.speed ?? 0) > 0);
  const bestFill = (dateStr: string) =>
    useCapacityFill
      ? getBestFillLineForDate(
          compatF,
          dateStr,
          batchFillUnits,
          equipment,
          scheduledBatches,
          undefined,
          batch.bmrNo,
        )
      : firstFreeOrFirst(compatF, dateStr);
  const bestPack = (dateStr: string) =>
    useCapacityPack
      ? getBestPackLineForDate(
          compatP,
          dateStr,
          batchPackUnits,
          equipment,
          scheduledBatches,
          undefined,
          batch.bmrNo,
        )
      : firstFreeOrFirst(compatP, dateStr);

  let mfgDate: string;
  let fillDate: string;
  let packDate: string;
  let fgDate: string;
  let rmDate: string;
  let pmDate: string;
  let vessel: string;
  let fillLine: string;
  let packLine: string;
  const reasons: string[] = [];

  if (slot.category === 'mfg') {
    mfgDate = slot.dateIso;
    vessel = slot.equipId ?? compatV[0] ?? '';
    const derived = deriveScheduleDatesFromMfg(mfgDate);
    fillDate = derived.fillDate;
    packDate = derived.packDate;
    fgDate = derived.fgDate;
    rmDate = derived.rmConnectDate;
    pmDate = derived.pmConnectDate;
    fillLine = bestFill(fillDate);
    packLine = bestPack(packDate);
    const mfgEquip = manufacturing.find((e) => e.id === vessel);
    const cap = mfgEquip && 'cap' in mfgEquip ? mfgEquip.cap : 0;
    const capMatch =
      cap != null && cap > 0
        ? Math.min(100, Math.round((getBatchVolumeLiters(batch) / cap) * 100))
        : 75;
    reasons.push(
      `${getEquipDisplayName(equipment, vessel, 'mfg')} selected: ${batch.batchSize}KG batch fits capacity, ${capMatch}% match`,
    );
    if (useCapacityFill && batchFillUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')} selected: ${batchFillUnits} units fit remaining capacity`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')} selected for speed & availability`,
      );
    }
    if (useCapacityPack && batchPackUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')}: ${batchPackUnits} units fit remaining capacity on ${packDate}`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')} available on ${packDate}`,
      );
    }
  } else if (slot.category === 'fill') {
    fillDate = slot.dateIso;
    fillLine = slot.equipId ?? compatF[0] ?? '';
    mfgDate = addDaysToDateStr(fillDate, -3);
    packDate = addDaysToDateStr(fillDate, 1);
    fgDate = addDaysToDateStr(packDate, 1);
    rmDate = addDaysToDateStr(mfgDate, -2);
    pmDate = addDaysToDateStr(fillDate, -2);
    vessel = firstFreeOrFirst(compatV, mfgDate);
    packLine = bestPack(packDate);
    reasons.push(
      `${getEquipDisplayName(equipment, vessel, 'mfg')} available on ${mfgDate}`,
    );
    if (useCapacityFill && batchFillUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')} selected: this batch ${batchFillUnits} units (capacity considered)`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')} selected for this slot`,
      );
    }
    if (useCapacityPack && batchPackUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')}: ${batchPackUnits} units fit remaining capacity on ${packDate}`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')} available on ${packDate}`,
      );
    }
  } else {
    packDate = slot.dateIso;
    packLine = slot.equipId ?? compatP[0] ?? '';
    fillDate = addDaysToDateStr(packDate, -1);
    mfgDate = addDaysToDateStr(fillDate, -3);
    fgDate = addDaysToDateStr(packDate, 1);
    rmDate = addDaysToDateStr(mfgDate, -2);
    pmDate = addDaysToDateStr(fillDate, -2);
    vessel = firstFreeOrFirst(compatV, mfgDate);
    fillLine = bestFill(fillDate);
    reasons.push(
      `${getEquipDisplayName(equipment, vessel, 'mfg')} available on ${mfgDate}`,
    );
    if (useCapacityFill && batchFillUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')}: ${batchFillUnits} units fit remaining capacity on ${fillDate}`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, fillLine, 'fill')} available on ${fillDate}`,
      );
    }
    if (useCapacityPack && batchPackUnits > 0) {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')} selected: this batch ${batchPackUnits} units (capacity considered)`,
      );
    } else {
      reasons.push(
        `${getEquipDisplayName(equipment, packLine, 'pack')} selected for this slot`,
      );
    }
  }

  const conflicts = [vessel, fillLine, packLine].filter((id) => !id).length;
  const confidenceScore = Math.min(95, Math.max(65, 90 - conflicts * 10));
  return {
    mfgDate,
    fillDate,
    packDate,
    fgDate,
    rmConnectDate: rmDate,
    pmConnectDate: pmDate,
    vessel,
    fillLine,
    packLine,
    vesselName: getEquipDisplayName(equipment, vessel, 'mfg'),
    fillLineName: getEquipDisplayName(equipment, fillLine, 'fill'),
    packLineName: getEquipDisplayName(equipment, packLine, 'pack'),
    confidenceScore,
    reasons,
  };
}
