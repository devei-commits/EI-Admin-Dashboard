import type { PlanningQuotationAsk } from '../services/planningQuotationAsks.service';

export type PlanningQuotationAskUiStatus =
  | 'none'
  | 'pending'
  | 'fulfilled_unread'
  | 'fulfilled_read';

export interface PlanningQuotationAskItemTarget {
  itemType: 'RM' | 'PM';
  code: string;
  name: string;
  raw_material_id?: number;
  pack_material_id?: number;
  planningExtractedIds: number[];
  planningExtractedId: number | null;
}

export const PLANNING_QUOTATION_ASK_SEEN_STORAGE_KEY = 'ei-planning-quotation-ask-seen-v1';

function normalizeMaterialCode(code: string): string {
  const c = (code ?? '').toString().trim().toLowerCase();
  if (!c) return '';
  return c
    .replace(/^ei[-_]?rm[-_]?/i, '')
    .replace(/^ei[-_]?pm[-_]?/i, '')
    .replace(/^rm[-_]?/i, '')
    .replace(/^pm[-_]?/i, '');
}

function peIdSetForItem(item: PlanningQuotationAskItemTarget): Set<number> {
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

export function planningQuotationAskMatchesItem(
  ask: PlanningQuotationAsk,
  item: PlanningQuotationAskItemTarget
): boolean {
  if (ask.itemType !== item.itemType) return false;

  const peIds = peIdSetForItem(item);
  const askPe = Number(ask.planningExtractedId);
  if (Number.isFinite(askPe) && askPe > 0 && peIds.size > 0 && !peIds.has(askPe)) {
    return false;
  }

  const matId =
    item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const askMatId =
    item.itemType === 'RM' ? Number(ask.rawMaterialId) : Number(ask.packMaterialId);
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(askMatId) && askMatId === matId;
  }

  const codeItem = normalizeMaterialCode(item.code);
  const codeAsk = normalizeMaterialCode(String(ask.itemCode ?? ''));
  if (codeItem && codeAsk && codeItem === codeAsk) return true;

  const nameItem = item.name.trim().toLowerCase();
  const nameAsk = String(ask.itemName ?? '')
    .trim()
    .toLowerCase();
  return nameItem.length > 0 && nameAsk.length > 0 && nameItem === nameAsk;
}

function fulfilledSortTs(ask: PlanningQuotationAsk): number {
  const t = Date.parse(String(ask.fulfilledAt ?? ask.updatedAt ?? ask.createdAt ?? ''));
  return Number.isFinite(t) ? t : 0;
}

/** Tailwind classes for Items Involved quotation action button. */
export function planningQuotationActionButtonClass(status: PlanningQuotationAskUiStatus): string {
  switch (status) {
    case 'pending':
      return 'border-yellow-600 bg-yellow-400 text-yellow-950 hover:bg-yellow-500 shadow-sm ring-1 ring-yellow-500/30';
    case 'fulfilled_unread':
      return 'border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm';
    case 'fulfilled_read':
      return 'border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
    default:
      return 'border-yellow-500 bg-yellow-50 text-yellow-950 hover:bg-yellow-100';
  }
}

export function resolvePlanningQuotationAskUiStatus(
  asks: PlanningQuotationAsk[],
  item: PlanningQuotationAskItemTarget,
  seenIds: ReadonlySet<number>,
  hasOpenProcurementQuotationPr = false
): { status: PlanningQuotationAskUiStatus; askId: number | null } {
  const base = getPlanningQuotationAskUiStatus(asks, item, seenIds);
  if (base.status !== 'none') return base;
  if (hasOpenProcurementQuotationPr) return { status: 'pending', askId: null };
  return base;
}

export function getPlanningQuotationAskUiStatus(
  asks: PlanningQuotationAsk[],
  item: PlanningQuotationAskItemTarget,
  seenIds: ReadonlySet<number>
): { status: PlanningQuotationAskUiStatus; askId: number | null } {
  const matched = asks.filter((a) => planningQuotationAskMatchesItem(a, item));
  if (matched.length === 0) return { status: 'none', askId: null };

  const pending = matched.filter((a) => a.status === 'pending');
  if (pending.length > 0) {
    const latest = pending.sort((a, b) => fulfilledSortTs(b) - fulfilledSortTs(a))[0];
    return { status: 'pending', askId: latest?.id ?? null };
  }

  const fulfilled = matched
    .filter((a) => a.status === 'fulfilled')
    .sort((a, b) => fulfilledSortTs(b) - fulfilledSortTs(a));
  if (fulfilled.length === 0) return { status: 'none', askId: null };

  const newest = fulfilled[0];
  if (newest && !seenIds.has(newest.id)) {
    return { status: 'fulfilled_unread', askId: newest.id };
  }

  return { status: 'fulfilled_read', askId: newest?.id ?? null };
}

export function loadSeenPlanningQuotationAskIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(PLANNING_QUOTATION_ASK_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function persistSeenPlanningQuotationAskIds(ids: ReadonlySet<number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PLANNING_QUOTATION_ASK_SEEN_STORAGE_KEY,
      JSON.stringify([...ids])
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function markPlanningQuotationAskSeen(
  askId: number,
  current: ReadonlySet<number>
): Set<number> {
  const next = new Set(current);
  if (Number.isFinite(askId) && askId > 0) next.add(askId);
  persistSeenPlanningQuotationAskIds(next);
  return next;
}

export function markMatchingFulfilledAsksSeen(
  asks: PlanningQuotationAsk[],
  item: PlanningQuotationAskItemTarget,
  current: ReadonlySet<number>
): Set<number> {
  const next = new Set(current);
  for (const ask of asks) {
    if (ask.status !== 'fulfilled') continue;
    if (!planningQuotationAskMatchesItem(ask, item)) continue;
    next.add(ask.id);
  }
  persistSeenPlanningQuotationAskIds(next);
  return next;
}
