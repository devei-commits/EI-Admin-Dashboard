import type { ProcurementRequest, ProcurementRequestItem } from '../services/procurement.service';
import type { PlanningBatchAllRow } from '../services/planningExtracted.service';

export type ReleaseBatchSiblingItemRow = {
  itemKey: string;
  code: string;
  name: string;
  /** e.g. "Base · Pure Aqua Pvt Ltd" */
  sublabel: string;
  itemType: 'RM' | 'PM';
  unit: string;
  reqThisBatch: number;
  consolidatedReq: number;
  batchCount: number;
  sihNum: number;
  reservedNum: number;
  /** Qty on procurement requests for this batch. */
  plannedQtyBatch: number;
  plannedReqCount: number;
  poQtyNum: number;
  leadDays: number | null;
  supplyTowardGrossNum: number;
  coverageOk: boolean;
  /** Required-by dates (YYYY-MM-DD) from PR lines on this batch. */
  plannedDates: string[];
  isCurrentItem: boolean;
};

type InvolvedItemLike = {
  id: string;
  itemType: 'RM' | 'PM';
  code: string;
  name: string;
  category: string;
  raw_material_id?: number;
  pack_material_id?: number;
  unit: string;
  totalRequired: number;
  batchCount: number;
  sihNum: number;
  reservedNum: number;
  poQtyNum: number;
  supplyTowardGrossNum: number;
  netNum: number;
};

type MaterialLineRef = {
  type: 'RM' | 'PM';
  code: string;
  raw_material_id?: number;
  pack_material_id?: number;
};

function normalizeMaterialCode(code: string): string {
  const c = (code ?? '').toString().trim().toLowerCase();
  if (!c) return '';
  return c
    .replace(/^ei[-_]?rm[-_]?/i, '')
    .replace(/^ei[-_]?pm[-_]?/i, '')
    .replace(/^rm[-_]?/i, '')
    .replace(/^pm[-_]?/i, '');
}

function procurementRequestIsActive(pr: ProcurementRequest): boolean {
  const st = String(pr.status ?? '').trim();
  if (!st) return true;
  if (/cancel/i.test(st)) return false;
  if (/reject/i.test(st)) return false;
  return true;
}

function procurementLineMatchesItem(line: ProcurementRequestItem, item: InvolvedItemLike): boolean {
  if (line.type !== item.itemType) return false;
  const matId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const lineRm = Number(line.raw_material_id);
  const linePm = Number(line.pack_material_id);
  const lineMatId = item.itemType === 'RM' ? lineRm : linePm;
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(lineMatId) && lineMatId === matId;
  }
  const codeItem = normalizeMaterialCode(item.code);
  const codeLine = normalizeMaterialCode(line.code);
  if (codeItem && codeLine && codeItem === codeLine) return true;
  const nameItem = item.name.trim().toLowerCase();
  const nameLine = line.name.trim().toLowerCase();
  return nameItem.length > 0 && nameLine.length > 0 && nameItem === nameLine;
}

function prMatchesBatchScope(
  pr: ProcurementRequest,
  batchId: number,
  planningExtractedId: number
): boolean {
  if (Number(pr.planningBatchId) !== batchId) return false;
  const peId = Number(pr.planningExtractedId);
  const pe = Number(planningExtractedId);
  return Number.isFinite(peId) && peId === pe;
}

export function countProcurementRequestsForItemByBatch(
  item: InvolvedItemLike,
  planningBatchId: number,
  planningExtractedId: number,
  prs: ProcurementRequest[]
): number {
  const batchId = Number(planningBatchId);
  if (!Number.isFinite(batchId) || batchId <= 0) return 0;
  let count = 0;
  for (const pr of prs) {
    if (!procurementRequestIsActive(pr)) continue;
    if (!prMatchesBatchScope(pr, batchId, planningExtractedId)) continue;
    const items = Array.isArray(pr.items) ? pr.items : [];
    if (items.some((line) => procurementLineMatchesItem(line, item))) count += 1;
  }
  return count;
}

export function getProcurementPlannedDatesForItemByBatch(
  item: InvolvedItemLike,
  planningBatchId: number,
  planningExtractedId: number,
  prs: ProcurementRequest[]
): string[] {
  const batchId = Number(planningBatchId);
  if (!Number.isFinite(batchId) || batchId <= 0) return [];
  const dates = new Set<string>();
  for (const pr of prs) {
    if (!procurementRequestIsActive(pr)) continue;
    if (!prMatchesBatchScope(pr, batchId, planningExtractedId)) continue;
    const headerDate = String(pr.requiredByDate ?? '').trim().slice(0, 10);
    const items = Array.isArray(pr.items) ? pr.items : [];
    for (const line of items) {
      if (!procurementLineMatchesItem(line, item)) continue;
      const lineDate = String(line.required_by_date ?? '').trim().slice(0, 10);
      const d = lineDate || headerDate;
      if (d) dates.add(d);
    }
  }
  return [...dates].sort();
}

export function buildReleaseBatchSiblingItemRows(opts: {
  batch: PlanningBatchAllRow;
  materialLines: MaterialLineRef[];
  peItems: InvolvedItemLike[];
  currentItemKey: string;
  getReqThisBatch: (item: InvolvedItemLike, batch: PlanningBatchAllRow) => number;
  getPlannedQtyForBatch: (item: InvolvedItemLike, batch: PlanningBatchAllRow) => number;
  getSublabel: (item: InvolvedItemLike, line: MaterialLineRef) => string;
  getLeadDays: (item: InvolvedItemLike) => number | null;
  procurementRequests: ProcurementRequest[];
}): ReleaseBatchSiblingItemRow[] {
  const {
    batch,
    materialLines,
    peItems,
    currentItemKey,
    getReqThisBatch,
    getPlannedQtyForBatch,
    getSublabel,
    getLeadDays,
    procurementRequests,
  } = opts;

  const batchId = Number(batch.id);
  const peId = Number(batch.planningExtractedId);
  const rows: ReleaseBatchSiblingItemRow[] = [];

  for (const line of materialLines) {
    const sourceId = line.type === 'RM' ? line.raw_material_id : line.pack_material_id;
    const involved = findInvolvedByMaterial(peItems, line.type, sourceId, line.code);
    if (!involved) continue;

    const grossReq = Number(involved.totalRequired) || 0;
    const supply = Number(involved.supplyTowardGrossNum) || 0;
    const coverageOk = grossReq <= 0 || supply + 1e-6 >= grossReq;

    rows.push({
      itemKey: involved.id,
      code: involved.code,
      name: involved.name,
      sublabel: getSublabel(involved, line),
      itemType: involved.itemType,
      unit: involved.unit,
      reqThisBatch: getReqThisBatch(involved, batch),
      consolidatedReq: grossReq,
      batchCount: involved.batchCount,
      sihNum: involved.sihNum,
      reservedNum: involved.reservedNum,
      plannedQtyBatch: getPlannedQtyForBatch(involved, batch),
      plannedReqCount: countProcurementRequestsForItemByBatch(
        involved,
        batchId,
        peId,
        procurementRequests
      ),
      poQtyNum: involved.poQtyNum,
      leadDays: getLeadDays(involved),
      supplyTowardGrossNum: supply,
      coverageOk,
      plannedDates: getProcurementPlannedDatesForItemByBatch(
        involved,
        batchId,
        peId,
        procurementRequests
      ),
      isCurrentItem: involved.id === currentItemKey,
    });
  }

  return rows.sort((a, b) => {
    if (a.isCurrentItem !== b.isCurrentItem) return a.isCurrentItem ? -1 : 1;
    if (a.itemType !== b.itemType) return a.itemType === 'RM' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function findInvolvedByMaterial(
  items: InvolvedItemLike[],
  itemType: 'RM' | 'PM',
  sourceId?: number,
  code?: string
): InvolvedItemLike | undefined {
  if (sourceId != null && Number(sourceId) > 0) {
    const byId = items.find(
      (r) =>
        r.itemType === itemType &&
        (itemType === 'RM'
          ? Number(r.raw_material_id) === Number(sourceId)
          : Number(r.pack_material_id) === Number(sourceId))
    );
    if (byId) return byId;
  }
  const codeNorm = normalizeMaterialCode(String(code ?? '').trim().toLowerCase());
  if (!codeNorm) return undefined;
  return items.find(
    (r) =>
      r.itemType === itemType &&
      normalizeMaterialCode(String(r.code ?? '').trim().toLowerCase()) === codeNorm
  );
}
