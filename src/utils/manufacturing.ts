/**
 * Manufacturing constants & helpers ported from v15f HTML prototype.
 * Shared across BatchPlanner, BMR, BPR, GRN, Delay Impact, etc.
 */

// ─── Stage Constants ─────────────────────────────────────────────
export const BMR_STAGES = [
  'Pending', 'Confirmed', 'Reserved', 'Scheduled',
  'Material Sourced', 'Dispensed', 'Under Production', 'Under Review', 'Completed',
] as const;

export const BMR_STAGE_ICONS = ['📋', '✅', '🔒', '📅', '🏭', '⚗', '🔄', '🔬', '✔'] as const;

export const BPR_STAGES = ['Pending', 'Scheduled', 'Packaging', 'QC Review', 'Completed'] as const;
export const BPR_STAGE_ICONS = ['📋', '📅', '📦', '🔬', '✔'] as const;

export const CPO_STATUS_MAP: Record<string, [string, string]> = {
  draft:                     ['', 'Draft'],
  checkout_pending:          ['warn', 'Checkout Pending'],
  customer_approval_pending: ['warn', 'Awaiting Approval'],
  payment_pending:           ['bad', 'Payment Pending'],
  advance_paid:              ['ok', 'Advance Paid'],
  so_created:                ['ok', 'SO Created'],
  cancelled:                 ['bad', 'Cancelled'],
};

// ─── Manufacturing Areas ─────────────────────────────────────────
export const MFG_AREAS = [
  { id: 'AREA-1', name: 'Manufacturing Area 1', tanks: ['TANK-01', 'TANK-02'], desc: 'Primary bulk area' },
  { id: 'AREA-2', name: 'Manufacturing Area 2', tanks: ['TANK-03', 'TANK-04'], desc: 'Secondary / small batch' },
];

// ─── FG Specs (used in BMR & BPR QC) ────────────────────────────
export interface FGSpecParam {
  param: string;
  min: number | null;
  max: number | null;
  unit: string;
  method: string;
  expected?: string;
}

export interface FGSpec {
  sku: string;
  product: string;
  specs: FGSpecParam[];
  yieldMin: number;
  yieldMax: number;
}

export const FG_SPECS: FGSpec[] = [
  {
    sku: '100g Tube',
    product: 'Anti-Acne Facewash 100g',
    specs: [
      { param: 'pH', min: 5.0, max: 6.5, unit: '', method: 'pH meter' },
      { param: 'Viscosity', min: 4000, max: 8000, unit: 'cP', method: 'Brookfield RVT' },
      { param: 'Appearance', min: null, max: null, unit: '', method: 'Visual', expected: 'White smooth cream' },
      { param: 'Odour', min: null, max: null, unit: '', method: 'Organoleptic', expected: 'Characteristic' },
      { param: 'Niacinamide', min: 3.8, max: 4.2, unit: '%w/w', method: 'HPLC' },
    ],
    yieldMin: 95,
    yieldMax: 103,
  },
  {
    sku: '50g Tube',
    product: 'Sunscreen Gel SPF50 50g',
    specs: [
      { param: 'pH', min: 6.0, max: 7.5, unit: '', method: 'pH meter' },
      { param: 'Viscosity', min: 3000, max: 7000, unit: 'cP', method: 'Brookfield RVT' },
      { param: 'Appearance', min: null, max: null, unit: '', method: 'Visual', expected: 'Transparent gel' },
      { param: 'SPF (In-vitro)', min: 48, max: null, unit: '', method: 'UV transmittance' },
    ],
    yieldMin: 95,
    yieldMax: 103,
  },
];

// ─── BOM Helpers ─────────────────────────────────────────────────

/** Parse SKU like "100g Tube" → 100 grams */
export function parseSkuToGrams(sku: string): number {
  const match = sku.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1], 10) : 100;
}

/** RM fractional composition (simplified BOM formula) */
const RM_FRACTIONS = [0.06, 0.12, 0.70, 0.04, 0.05, 0.03];
const RM_CATEGORIES = ['Active', 'Active', 'Base', 'Fragrance', 'Others', 'Others'];

/** Pick up to 6 RM items from global items list */
export function pickRMItems(items: any[]): any[] {
  const rmItems = items.filter((i: any) => i.type === 'RM');
  const picked: any[] = [];
  for (let i = 0; i < Math.min(6, rmItems.length); i++) {
    picked.push(rmItems[i]);
  }
  // Pad if less than 6
  while (picked.length < 6 && rmItems.length > 0) {
    picked.push(rmItems[picked.length % rmItems.length]);
  }
  return picked;
}

/** Pick up to 5 PM items from global items list */
export function pickPMItems(items: any[]): any[] {
  const pmItems = items.filter((i: any) => i.type === 'PM');
  const picked: any[] = [];
  for (let i = 0; i < Math.min(5, pmItems.length); i++) {
    picked.push(pmItems[i]);
  }
  return picked;
}

/** Build RM BOM lines for a batch */
export function buildRMLines(units: number, skuGrams: number, items: any[]): any[] {
  const rmPicked = pickRMItems(items);
  const bulkKg = (units * skuGrams) / 1000;
  return rmPicked.map((item: any, idx: number) => ({
    itemId: item.id,
    itemName: item.name,
    uom: item.uom || 'kg',
    category: RM_CATEGORIES[idx] || 'Others',
    qty: Math.round(bulkKg * (RM_FRACTIONS[idx] || 0.05) * 100) / 100,
    stock: item.stock || 0,
    reserved: item.reserved || 0,
    free: Math.max(0, (item.stock || 0) - (item.reserved || 0)),
    poQty: item.poQty || 0,
    inTransit: item.inTransit || 0,
  }));
}

/** Build PM BOM lines for a batch */
export function buildPMLines(units: number, items: any[]): any[] {
  const pmPicked = pickPMItems(items);
  return pmPicked.map((item: any, idx: number) => {
    const ratio = idx === 0 ? 1 : idx === 1 ? 1 : 1 / 24;
    return {
      itemId: item.id,
      itemName: item.name,
      uom: item.uom || 'pcs',
      category: item.category || 'PM',
      qty: Math.ceil(units * ratio),
      stock: item.stock || 0,
      reserved: item.reserved || 0,
      free: Math.max(0, (item.stock || 0) - (item.reserved || 0)),
      poQty: item.poQty || 0,
      inTransit: item.inTransit || 0,
    };
  });
}

// ─── Stock Helpers ───────────────────────────────────────────────

export function getGap(item: any): number {
  const free = Math.max(0, (item.stock || 0) - (item.reserved || 0));
  const pipeline = item.poQty || 0;
  return Math.max(0, (item.required || 0) - (free + pipeline));
}

export function getPriorityQty(item: any): number {
  return (item.orders || [])
    .filter((o: any) => o.planning >= 80 && o.pendingBlocker)
    .reduce((s: number, o: any) => s + (o.required || 0), 0);
}

export function getSignal(item: any): 'PRIORITY' | 'SHORT' | 'OK' {
  if (getPriorityQty(item) > 0) return 'PRIORITY';
  if (getGap(item) > 0) return 'SHORT';
  return 'OK';
}

/** Line-level availability check for BOM lines */
export function lineAvailability(line: { qty: number; free: number; poQty?: number; inTransit?: number }) {
  const available = line.free + (line.poQty || 0) + (line.inTransit || 0);
  return {
    available,
    gap: Math.max(0, line.qty - available),
    sufficient: available >= line.qty,
  };
}

/** Material status: count of available/total lines */
export function materialStatus(lines: any[]): { ok: number; total: number } {
  let ok = 0;
  for (const l of lines) {
    if (lineAvailability(l).sufficient) ok++;
  }
  return { ok, total: lines.length };
}

/** Material Connectivity Date: latest date when all materials arrive */
export function materialConnectivityDate(lines: any[]): string | null {
  let maxDate: string | null = null;
  for (const l of lines) {
    const avail = lineAvailability(l);
    if (!avail.sufficient && l.leadDays) {
      const d = addDaysISO(todayISO(), l.leadDays || 14);
      if (!maxDate || d > maxDate) maxDate = d;
    }
  }
  return maxDate;
}

// ─── Date Helpers ────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addDaysISO(iso: string, n: number): string {
  return addDays(iso, n).toISOString().slice(0, 10);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Number Formatting ──────────────────────────────────────────

export function money(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function fmtNum(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
