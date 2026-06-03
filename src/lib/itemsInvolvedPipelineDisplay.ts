/**
 * Items Involved — procurement pipeline labels (PR → PO → in-transit → WH).
 * Uses stage-flow qty from planning-extracted/items-involved API.
 */
import type { ProcurementRequest } from '../services/procurement.service';
import { formatQtyExact } from '../utils/formatQty';
import { itemsInvolvedUsesDecimalQty, normRmPrimaryUom } from './rmUnitConversion';

export type ItemsInvolvedPipelineItem = {
  itemType: 'RM' | 'PM';
  code: string;
  name: string;
  raw_material_id?: number;
  pack_material_id?: number;
  planningExtractedIds?: number[];
  planningExtractedId?: number | null;
  totalRequired: number;
  netNum: number;
  plannedQtyNum: number;
  poQtyNum: number;
  inTransitQtyNum: number;
  whQtyNum: number;
  sihNum: number;
  totalReleasedNum?: number;
  totalOnPONum?: number;
  totalReceivedNum?: number;
  batchAllocatedQtyNum?: number;
  unallocatedToBatches?: number;
  unit: string;
};

export type PlannedLineForItem = {
  createdAt: string;
  planningExtractedId: number | null;
  itemType: 'RM' | 'PM';
  itemId: number | null;
  itemCode: string;
  itemName: string;
  vendorName: string;
  qty: number;
  paymentTerms: string;
  leadTimeDays: number;
  unit: string;
  backendPoId?: string;
};

export type ItemsInvolvedProcurementDisplay = {
  currentStatus: {
    title: string;
    detail: string;
    badge: string;
    badgeTone: 'emerald' | 'amber' | 'red' | 'blue' | 'slate';
    steps: { label: string; active: boolean; done: boolean }[];
  };
  poInfo: { lines: string[] };
  latestComment: { whenLabel: string; source: string; text: string } | null;
};

const QUOTATION_NOTE_TAG = 'Quotation requested from Planning';

function normalizeMaterialCode(code: string): string {
  const c = (code ?? '').toString().trim().toLowerCase();
  if (!c) return '';
  return c
    .replace(/^ei[-_]?rm[-_]?/i, '')
    .replace(/^ei[-_]?pm[-_]?/i, '')
    .replace(/^rm[-_]?/i, '')
    .replace(/^pm[-_]?/i, '');
}

function peIdSetForItem(item: ItemsInvolvedPipelineItem): Set<number> {
  const set = new Set<number>();
  for (const id of item.planningExtractedIds ?? []) {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  if (set.size === 0) {
    const single = Number(item.planningExtractedId);
    if (Number.isFinite(single) && single > 0) set.add(single);
  }
  return set;
}

function lineMatchesItem(
  item: ItemsInvolvedPipelineItem,
  line: {
    itemType?: string;
    type?: string;
    itemId?: number | null;
    raw_material_id?: number;
    pack_material_id?: number;
    itemCode?: string;
    code?: string;
    itemName?: string;
    name?: string;
  }
): boolean {
  const lineType = (line.itemType ?? line.type ?? '') as string;
  if (lineType && lineType !== item.itemType) return false;
  const matId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const lineMatId =
    line.itemId != null
      ? Number(line.itemId)
      : item.itemType === 'RM'
        ? Number(line.raw_material_id)
        : Number(line.pack_material_id);
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(lineMatId) && lineMatId === matId;
  }
  const codeItem = normalizeMaterialCode(item.code);
  const codeLine = normalizeMaterialCode(String(line.itemCode ?? line.code ?? ''));
  if (codeItem && codeLine && codeItem === codeLine) return true;
  const nameItem = item.name.trim().toLowerCase();
  const nameLine = String(line.itemName ?? line.name ?? '')
    .trim()
    .toLowerCase();
  return nameItem.length > 0 && nameLine.length > 0 && nameItem === nameLine;
}

function prMatchesItem(pr: ProcurementRequest, item: ItemsInvolvedPipelineItem): boolean {
  const peIds = peIdSetForItem(item);
  if (peIds.size === 0) return false;
  return peIds.has(Number(pr.planningExtractedId));
}

function formatQty(n: number, itemType: 'RM' | 'PM', unit: string): string {
  const u = itemType === 'RM' ? normRmPrimaryUom(unit) : String(unit || 'PCS');
  const kind = itemsInvolvedUsesDecimalQty(itemType, u) ? 'kg' : 'pcs';
  return `${formatQtyExact(n, kind)} ${u}`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function derivePipelineStage(item: ItemsInvolvedPipelineItem): {
  title: string;
  detail: string;
  badge: string;
  badgeTone: ItemsInvolvedProcurementDisplay['currentStatus']['badgeTone'];
} {
  const eps = 1e-6;
  const gross = Number(item.totalRequired) || 0;
  const net = Number(item.netNum) || 0;
  const planned = Number(item.plannedQtyNum) || 0;
  const onPo = Number(item.poQtyNum) || 0;
  const inTransit = Number(item.inTransitQtyNum) || 0;
  const wh = Number(item.whQtyNum) || 0;
  const sih = Number(item.sihNum) || 0;
  const released = Number(item.totalReleasedNum) || 0;
  const received = Number(item.totalReceivedNum) || 0;
  const batchAlloc = Number(item.batchAllocatedQtyNum) || 0;
  const unallocBatch = Number(item.unallocatedToBatches) || 0;
  const u = item.unit;

  if (gross <= eps) {
    return {
      title: 'No BOM demand',
      detail: 'Not required on any confirmed PI batch.',
      badge: 'N/A',
      badgeTone: 'slate',
    };
  }

  if (net >= -eps) {
    const parts: string[] = [];
    if (sih > eps) parts.push(`Free SIH ${formatQty(sih, item.itemType, u)}`);
    if (wh > eps) parts.push(`WH ${formatQty(wh, item.itemType, u)}`);
    if (inTransit > eps) parts.push(`In transit ${formatQty(inTransit, item.itemType, u)}`);
    if (onPo > eps) parts.push(`On PO ${formatQty(onPo, item.itemType, u)}`);
    if (planned > eps) parts.push(`Procurement queue ${formatQty(planned, item.itemType, u)}`);
    return {
      title: 'Demand covered',
      detail: parts.length ? parts.join(' · ') : `Supply meets TOTAL REQ ${formatQty(gross, item.itemType, u)}`,
      badge: 'Covered',
      badgeTone: 'emerald',
    };
  }

  const short = Math.abs(net);
  const shortStr = formatQty(short, item.itemType, u);

  if (released <= eps) {
    const batchNote =
      unallocBatch > eps
        ? ` · ${formatQty(unallocBatch, item.itemType, u)} not on sent batches yet`
        : batchAlloc > eps
          ? ` · ${formatQty(batchAlloc, item.itemType, u)} on batches`
          : '';
    return {
      title: 'Not released to Procurement',
      detail: `Short ${shortStr} vs TOTAL REQ — use Release to Planning${batchNote}`,
      badge: 'Awaiting PR',
      badgeTone: 'red',
    };
  }

  if (inTransit > eps) {
    return {
      title: 'In transit to warehouse',
      detail: `${formatQty(inTransit, item.itemType, u)} shipped · still short ${shortStr} · GRN pending`,
      badge: 'In transit',
      badgeTone: 'blue',
    };
  }

  if (onPo > eps) {
    return {
      title: 'On purchase order',
      detail: `${formatQty(onPo, item.itemType, u)} on open PO · short ${shortStr} · awaiting vendor dispatch`,
      badge: 'PO open',
      badgeTone: 'amber',
    };
  }

  if (planned > eps) {
    return {
      title: 'In Procurement queue',
      detail: `${formatQty(planned, item.itemType, u)} on PR/draft PO · short ${shortStr} · not yet on vendor PO`,
      badge: 'PR / draft',
      badgeTone: 'amber',
    };
  }

  if (wh > eps || sih > eps) {
    return {
      title: 'Partial warehouse stock',
      detail: `SIH ${formatQty(sih, item.itemType, u)} · WH ${formatQty(wh, item.itemType, u)} · short ${shortStr}`,
      badge: 'Partial',
      badgeTone: 'amber',
    };
  }

  if (received > eps) {
    return {
      title: 'Received — still short',
      detail: `${formatQty(received, item.itemType, u)} GRN received · gap ${shortStr}`,
      badge: 'Short',
      badgeTone: 'red',
    };
  }

  return {
    title: 'Pipeline gap',
    detail: `Released ${formatQty(released, item.itemType, u)} but no PO/in-transit balance · short ${shortStr}`,
    badge: 'Gap',
    badgeTone: 'red',
  };
}

function buildPipelineSteps(item: ItemsInvolvedPipelineItem): ItemsInvolvedProcurementDisplay['currentStatus']['steps'] {
  const released = Number(item.totalReleasedNum) || 0;
  const planned = Number(item.plannedQtyNum) || 0;
  const onPo = Number(item.poQtyNum) || 0;
  const inTransit = Number(item.inTransitQtyNum) || 0;
  const wh = Number(item.whQtyNum) || 0;
  const sih = Number(item.sihNum) || 0;
  const covered = Number(item.netNum) >= -1e-6;

  const hasReleased = released > 1e-6;
  const hasPlanned = planned > 1e-6;
  const hasPo = onPo > 1e-6;
  const hasTransit = inTransit > 1e-6;
  const hasWh = wh > 1e-6 || sih > 1e-6;

  const labels = ['Release', 'PR / draft', 'Vendor PO', 'In transit', 'WH / SIH'] as const;
  const done = [hasReleased, hasReleased && (hasPlanned || hasPo || hasTransit || hasWh), hasPo || hasTransit || hasWh, hasTransit || hasWh, covered || hasWh];

  let activeIdx = 0;
  if (covered || hasWh) activeIdx = 4;
  else if (hasTransit) activeIdx = 3;
  else if (hasPo) activeIdx = 2;
  else if (hasPlanned || hasReleased) activeIdx = hasPlanned ? 1 : 0;
  else activeIdx = 0;

  return labels.map((label, i) => ({
    label,
    done: Boolean(done[i]),
    active: i === activeIdx,
  }));
}

/** Open PR with Planning quotation note (legacy path before planning_quotation_asks). */
export function itemHasOpenPlanningQuotationPr(
  item: ItemsInvolvedPipelineItem,
  procurementRequests: ProcurementRequest[]
): boolean {
  for (const pr of procurementRequests) {
    if (!prMatchesItem(pr, item)) continue;
    if (!String(pr.notes ?? '').includes(QUOTATION_NOTE_TAG)) continue;
    const st = String(pr.status ?? '').trim().toLowerCase();
    if (st === 'cancelled' || st === 'rejected' || st === 'closed') continue;
    return true;
  }
  return false;
}

export function getItemsInvolvedProcurementDisplay(
  item: ItemsInvolvedPipelineItem,
  procurementRequests: ProcurementRequest[],
  plannedLines: PlannedLineForItem[]
): ItemsInvolvedProcurementDisplay {
  const stage = derivePipelineStage(item);
  const poLines: string[] = [];
  const commentCandidates: { ts: number; source: string; text: string; whenLabel: string }[] = [];

  for (const pr of procurementRequests) {
    if (!prMatchesItem(pr, item)) continue;
    const isQuotation = String(pr.notes ?? '').includes(QUOTATION_NOTE_TAG);
    const items = Array.isArray(pr.items) ? pr.items : [];
    let lineQty = 0;
    for (const line of items) {
      if (!lineMatchesItem(item, { ...line, itemType: line.type })) continue;
      lineQty += Number(line.quantity_requested ?? line.shortage ?? 0) || 0;
      const ln = String(line.line_notes ?? '').trim();
      if (ln) {
        commentCandidates.push({
          ts: Date.parse(pr.updatedAt || pr.createdAt) || 0,
          source: `PR #${pr.id}`,
          text: ln,
          whenLabel: formatWhen(pr.updatedAt || pr.createdAt),
        });
      }
    }
    if (lineQty > 1e-6 || isQuotation) {
      const so = pr.planningSoNumber ? `SO ${pr.planningSoNumber}` : `PE-${pr.planningExtractedId}`;
      const vendor = String(pr.preferredVendor ?? '').trim();
      const st = String(pr.status ?? 'Pending').trim();
      poLines.push(
        isQuotation
          ? `Quotation ask · ${so} · ${st}${vendor ? ` · ${vendor}` : ''}`
          : `PR #${pr.id} · ${so} · ${st} · ${formatQty(lineQty, item.itemType, item.unit)}${vendor ? ` · ${vendor}` : ''}`
      );
    }
    const notes = String(pr.notes ?? '').trim();
    if (notes && !isQuotation) {
      commentCandidates.push({
        ts: Date.parse(pr.updatedAt || pr.createdAt) || 0,
        source: `PR #${pr.id}`,
        text: notes,
        whenLabel: formatWhen(pr.updatedAt || pr.createdAt),
      });
    }
    const sc = String(pr.stockCheckNotes ?? '').trim();
    if (sc) {
      commentCandidates.push({
        ts: Date.parse(pr.updatedAt || pr.createdAt) || 0,
        source: `Stock check PR #${pr.id}`,
        text: sc,
        whenLabel: formatWhen(pr.updatedAt || pr.createdAt),
      });
    }
  }

  for (const line of plannedLines) {
    if (!lineMatchesItem(item, line)) continue;
    const pe = line.planningExtractedId;
    const peIds = peIdSetForItem(item);
    if (pe != null && pe > 0 && peIds.size > 0 && !peIds.has(pe)) continue;
    const ref = pe ? `Planning PE-${pe}` : 'Planning PO';
    const poId = line.backendPoId ? `PO #${line.backendPoId}` : 'Draft PO';
    poLines.push(
      `${ref} · ${poId} · ${formatQty(Number(line.qty) || 0, item.itemType, line.unit || item.unit)} · ${line.vendorName || 'Vendor TBD'} · ${line.paymentTerms || '—'} · LT ${line.leadTimeDays || 0}d`
    );
    if (line.createdAt) {
      commentCandidates.push({
        ts: Date.parse(line.createdAt) || 0,
        source: ref,
        text: `Draft PO line · ${line.vendorName || 'vendor'} · ${formatQty(Number(line.qty) || 0, item.itemType, line.unit || item.unit)}`,
        whenLabel: formatWhen(line.createdAt),
      });
    }
  }

  const totalOnPo = Number(item.totalOnPONum) || 0;
  if (totalOnPo > 1e-6 && poLines.length === 0) {
    poLines.push(`Open PO total ${formatQty(totalOnPo, item.itemType, item.unit)} (vendor PO lines)`);
  }
  if (poLines.length === 0) {
    const released = Number(item.totalReleasedNum) || 0;
    if (released <= 1e-6) {
      poLines.push('No PR or Planning PO — release from Action column when short.');
    } else {
      poLines.push('Released qty not linked to a visible PR/PO row — check Procurement → Requests.');
    }
  }

  commentCandidates.sort((a, b) => b.ts - a.ts);
  const latest = commentCandidates[0] ?? null;

  if (!latest) {
    const wh = Number(item.whQtyNum) || 0;
    const sih = Number(item.sihNum) || 0;
    if (item.netNum >= -1e-6) {
      commentCandidates.push({
        ts: Date.now(),
        source: 'Inventory',
        text: `Warehouse QC: ${wh > 0 ? `${formatQty(wh, item.itemType, item.unit)} on WH racks` : ''}${sih > 0 ? `${wh > 0 ? ' · ' : ''}Free SIH ${formatQty(sih, item.itemType, item.unit)}` : 'Stock covers BOM demand'}`,
        whenLabel: 'Now',
      });
    } else if (Number(item.unallocatedToBatches) > 1e-6) {
      commentCandidates.push({
        ts: 0,
        source: 'Batch plan',
        text: `${formatQty(Number(item.unallocatedToBatches), item.itemType, item.unit)} required on BOM not yet on sent production batches`,
        whenLabel: '—',
      });
    }
  }

  const latestFinal = commentCandidates.sort((a, b) => b.ts - a.ts)[0] ?? null;

  return {
    currentStatus: {
      title: stage.title,
      detail: stage.detail,
      badge: stage.badge,
      badgeTone: stage.badgeTone,
      steps: buildPipelineSteps(item),
    },
    poInfo: { lines: poLines.slice(0, 4) },
    latestComment: latestFinal
      ? { whenLabel: latestFinal.whenLabel, source: latestFinal.source, text: latestFinal.text }
      : null,
  };
}

export function badgeToneClass(tone: ItemsInvolvedProcurementDisplay['currentStatus']['badgeTone']): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'amber':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'blue':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
