/**
 * Purchase Orders — Spec View 2 (§4). Two tabs:
 *  - Tab 1 PO-wise (built here): one row per PO with rolled-up In-Transit /
 *    Received / Billed / Return quantities (computed from the GRN list, since
 *    these rollups aren't stored anywhere today).
 *  - Tab 2 Items (next step): one row per PO line with per-GRN breakdown.
 *
 * Both tabs group rows by Vendor (accordion sections) instead of a flat list.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Eye, Truck, Download, ChevronRight, ChevronDown, ArrowUp, ArrowDown, X, ShieldCheck } from 'lucide-react';
import { Package, Flag, Warning, Check } from '@phosphor-icons/react';
import { Pagination } from '../ui';
import { ProcSectionHeader, ProcTabs, ProcFilterBar, ProcSearch, procSelectClass, ProcTableCard, ProcThead, ProcEmpty } from './ProcSection';
import type { IssuedPOViewRecord } from './issuedPoRecord.types';
import type { GRNRecordFromApi } from '../../services/grn.service';
import {
  GRN_STAGE_CONFIG, PURCHASE_STATUS_CONFIG, PO_STATUS_CONFIG, PO_SHIPPABLE_STATUSES, toPoApprovalStatus,
  type GrnStage, type PurchaseStatus, type PoStatus,
} from '../../constants/procurement';
import { InitiateTransitPopup, ConsolidatedShipmentPopup, type ConsolidatedLine } from './TransitPopups';
import { initiateTransit, createConsolidatedShipment } from '../../services/grn.service';

/** Existing 3-state GRN status → spec 6-stage (best-effort until the stage axis is added). */
function mapGrnStatusToStage(status: string | null | undefined): GrnStage {
  const s = String(status || '').toLowerCase();
  if (s.includes('complete')) return 'grn_completed';
  if (s.includes('hold') || s.includes('quarant')) return 'quarantined';
  if (s.includes('under') || s.includes('qc') || s.includes('test')) return 'qc_tested';
  if (s.includes('transit')) return 'in_transit';
  if (s.includes('land') || s.includes('arriv')) return 'landed';
  return 'in_transit';
}

/**
 * Per-line Purchase Status across the purchase lifecycle: Ordered → Received → Billed → Paid.
 * Received/Billed come from matched-GRN qty. 'paid' is intentionally NOT emitted here: no payment
 * signal (finalPaidAt / paymentTransaction) reaches this component — a 'completed' PO only means the
 * GRN workflow closed (grnCompleteAt), which is not the same as the vendor being paid. The highest
 * truthful status derivable from GRN data alone is 'billed' (invoice present). Draft POs aren't
 * ordered yet → null.
 */
function derivePurchaseStatus(received: number, billed: number, wf: PoStatus): PurchaseStatus | null {
  if (wf === 'draft') return null;
  if (billed > 0 && billed >= received) return 'billed';
  if (received > 0) return 'received';
  return 'ordered'; // issued to vendor, awaiting receipt
}

// ── Display status → spec PO workflow status ──
function resolvePoWorkflowStatus(record: IssuedPOViewRecord): PoStatus {
  return record.poWorkflowStatus ?? (record.status === 'Draft' ? 'draft' : record.status === 'In Transit' ? 'issued' : 'issued');
}

/** Initiate Shipment allowed only when PO Status is ISSUED or ACCEPTED (§3.1). */
function isShippable(record: IssuedPOViewRecord): boolean {
  // A draft PO (even once approved → "Accepted") must be released to the vendor before shipment.
  if (record.status === 'Draft') return false;
  return PO_SHIPPABLE_STATUSES.includes(resolvePoWorkflowStatus(record));
}

/**
 * Connecting dates on a PO — the per-item expected arrival. Shown on the row because a PO can carry
 * several items connecting on different days, and that spread is what drives scheduling; a single
 * PO-level ETA hides it.
 */
function connectingDatesForRecord(record: IssuedPOViewRecord): { label: string; items: string[] } | null {
  const map = record.connectingDateByItem;
  if (!map || typeof map !== 'object') return null;
  const entries = Object.entries(map)
    .map(([k, v]) => ({ key: String(k), date: String(v ?? '').trim() }))
    .filter((e) => e.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return null;
  const items = entries.map((e) => `${e.key}: ${fmtDate(e.date)}`);
  const first = fmtDate(entries[0].date);
  const last = fmtDate(entries[entries.length - 1].date);
  // One date, or a range when the items connect on different days.
  const label = entries.length === 1 || first === last ? first : `${first} – ${last}`;
  return { label, items };
}

function fmtMoney(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-US', { month: 'short' });
  return `${day}-${mon}-${dt.getFullYear()}`;
}
function normPo(s: string | null | undefined): string {
  return String(s ?? '').trim().toUpperCase();
}
/** ms timestamp for sorting; undated rows sort to the bottom. */
function dateMs(d: string | null | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}
/** Inclusive PO-date range test (from/to are yyyy-mm-dd from <input type=date>). */
function poInDateRange(createdDate: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const t = dateMs(createdDate);
  if (!t) return false; // undated rows are excluded once a range is applied
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 86_400_000 - 1) return false; // include the whole "to" day
  return true;
}

interface Rollup { inTransit: number; received: number; billed: number; returned: number; ordered: number; }

/** Normalized numeric backend PO id ("PO-42" / "42" → "42"); "" when not resolvable. */
function poIdKey(id: string | null | undefined): string {
  const s = String(id ?? '').replace(/^PO-/, '').trim();
  return /^\d+$/.test(s) ? s : '';
}

function computeRollup(
  record: IssuedPOViewRecord,
  grnByPo: Map<string, GRNRecordFromApi[]>,
  grnByPoId: Map<string, GRNRecordFromApi[]>,
): Rollup {
  const ordered = record.lineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // Prefer an exact match on purchaseOrderId (both sides carry it); fall back to the PO-number
  // string only when this PO has no resolvable backend id.
  const idKey = poIdKey(record.backendPoId);
  const grns = (idKey && grnByPoId.has(idKey)) ? grnByPoId.get(idKey)! : (grnByPo.get(normPo(record.poNumber)) ?? []);
  let inTransit = 0, received = 0, billed = 0;
  for (const g of grns) {
    const lines = g.lineItems ?? [];
    const rcvd = lines.reduce((s, l) => s + (Number(l.rcvdQty) || 0), 0);
    const inv = lines.reduce((s, l) => s + (Number(l.invoiceQty) || 0), 0);
    const poQ = lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
    const complete = /complete/i.test(g.status || '');
    if (complete) { received += rcvd; billed += inv; }
    else { inTransit += rcvd || poQ; } // shipped-but-not-received
  }
  // TODO(RTV): returned is hard-coded 0 — GRN rows expose no per-line return/RTV qty field today,
  // so the return-to-vendor rollup isn't wired. Sum a real field here once the GRN API carries one.
  return { inTransit, received, billed, returned: 0, ordered };
}

/**
 * The shipment button reflects how much of the PO is already on a shipment, not merely whether
 * shipping is permitted — a PO with stock in transit kept reading "Initiate Shipment", which looks
 * like the earlier shipment never registered. Partly-shipped POs stay actionable so the remaining
 * quantity can still be sent.
 */
function shipmentAction(rollup: Rollup): { label: string; title: string } {
  const shipped = rollup.inTransit + rollup.received;
  if (shipped <= 0) return { label: 'Initiate Shipment', title: 'Initiate Shipment' };
  const of = `${shipped.toLocaleString('en-IN')} of ${rollup.ordered.toLocaleString('en-IN')}`;
  if (rollup.ordered > 0 && shipped >= rollup.ordered) {
    return { label: 'View Shipments', title: `Fully shipped — ${of}` };
  }
  const remaining = Math.max(0, rollup.ordered - shipped);
  return { label: 'Add Shipment', title: `${of} shipped · ${remaining.toLocaleString('en-IN')} remaining` };
}

/**
 * What a PO that cannot ship yet is actually waiting on.
 *
 * A draft PO showed a greyed-out "Initiate Shipment" whose tooltip said "Available once PO is
 * Issued/Accepted" — true, but it names a state rather than an action, and reads as if shipping is
 * the thing to do next. It isn't: the PO has to clear approval and be released to the vendor first.
 * Returning null means the PO really is shippable and the normal shipment button applies.
 */
export function preShipmentAction(record: IssuedPOViewRecord): { label: string; title: string } | null {
  if (record.status !== 'Draft') return null;
  // Reuse the shared normaliser so this agrees with the Approval panel: a null approval_status (a
  // draft PO that has never entered the workflow, like DPO-008) is 'not_submitted', not "unknown".
  switch (toPoApprovalStatus(record.approvalStatus)) {
    case 'under_review':
      return { label: 'Awaiting Review', title: 'Submitted — waiting for the reviewer to forward it' };
    case 'under_approval':
      return { label: 'Awaiting Approval', title: 'Reviewed — waiting for the approver to sign off' };
    case 'approved':
      return { label: 'Release to Vendor', title: 'Approved — release the PO to the vendor, then it can ship' };
    case 'changes_requested':
      return { label: 'Changes Requested', title: 'Edit the PO, then resubmit it for review' };
    case 'rejected':
      return { label: 'Rejected', title: 'Rejected in approval — this PO cannot proceed' };
    default:
      return { label: 'Submit for Review', title: 'Not submitted — open the PO and submit it for review' };
  }
}

function QtyLink({ value, ordered, onClick }: { value: number; ordered: number; onClick?: () => void }) {
  if (!value) return <span className="text-ink-4 text-xs">0</span>;
  const pct = ordered > 0 ? Math.round((value / ordered) * 100) : 0;
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={!onClick} className={`text-xs tabular-nums ${onClick ? 'text-brand hover:underline decoration-dotted' : 'text-ink-2'}`} title={ordered > 0 ? `${pct}% of ${ordered.toLocaleString('en-IN')}` : undefined}>
      {value.toLocaleString('en-IN')}
    </button>
  );
}

export interface PurchaseOrdersViewProps {
  records: IssuedPOViewRecord[];
  grnList: GRNRecordFromApi[];
  vendorOptions: string[];
  onOpenDetail: (record: IssuedPOViewRecord) => void;
  onEdit: (record: IssuedPOViewRecord) => void;
  /** Called after a Shipment Batch + GRN(s) are created, so the parent can refetch. */
  onShipmentCreated?: () => void;
  onOpenGrnForPo?: (poNumber: string) => void;
  onExport?: () => void;
  /** Opens the manual "New PO" (Direct PO — no PR) modal. */
  onNewPo?: () => void;
}

type PoTab = 'po-wise' | 'items';
type SortDir = 'asc' | 'desc';
type SortKey = 'date' | 'value' | 'po' | 'vendor' | 'item' | 'qty' | 'sla';
const PO_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'PO Date' },
  { key: 'value', label: 'PO Value' },
  { key: 'po', label: 'PO #' },
  { key: 'vendor', label: 'Vendor' },
];
const ITEM_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'PO Date' },
  { key: 'item', label: 'Item' },
  { key: 'qty', label: 'PO Qty' },
  { key: 'sla', label: 'Days Open (SLA)' },
  { key: 'po', label: 'PO #' },
  { key: 'vendor', label: 'Vendor' },
];

const PO_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Footer bar shared by both tabs: "Showing X–Y of Z", rows-per-page, page buttons. */
function PoPaginationBar({
  id, pageStart, pageSize, total, currentPage, totalPages, unit, onPageChange, onPageSizeChange,
}: {
  id: string;
  pageStart: number;
  pageSize: number;
  total: number;
  currentPage: number;
  totalPages: number;
  unit: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
      <span className="text-xs text-ink-3">
        Showing <b className="text-ink">{pageStart + 1}</b>–
        <b className="text-ink">{Math.min(pageStart + pageSize, total)}</b> of{' '}
        <b className="text-ink">{total}</b> {unit}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="text-xs text-ink-3">Rows per page</label>
        <select
          id={id}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-[color:var(--ring)]"
        >
          {PO_PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} variant="compact" />
      </div>
    </div>
  );
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  records, grnList, onOpenDetail, onEdit, onShipmentCreated, onOpenGrnForPo, onExport, onNewPo,
}) => {
  const [tab, setTab] = useState<PoTab>('po-wise');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PoStatus>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [itemFilter, setItemFilter] = useState<string | null>(null); // "Other POs" drill
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set());
  const [poPage, setPoPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Switching tabs resets the sort to that tab's sensible default (PO-wise: newest first; Items: by item code).
  const changeTab = (next: PoTab) => {
    setTab(next);
    if (next === 'items') { setSortBy('item'); setSortDir('asc'); }
    else { setSortBy('date'); setSortDir('desc'); }
  };

  const vendorList = useMemo(
    () => [...new Set(records.map((r) => r.vendor || 'Unknown Vendor'))].sort((a, b) => a.localeCompare(b)),
    [records],
  );
  const sortOptions = tab === 'items' ? ITEM_SORT_OPTIONS : PO_SORT_OPTIONS;
  const hasActiveFilters = !!search || statusFilter !== 'all' || vendorFilter !== 'all' || !!dateFrom || !!dateTo || !!itemFilter;
  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setVendorFilter('all'); setDateFrom(''); setDateTo(''); setItemFilter(null);
  };

  const toggleVendor = (vendor: string) => {
    setCollapsedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  };

  // Initiate-Transit popups (§4A per-line, §4B consolidated)
  const [transit, setTransit] = useState<
    | { mode: 'line'; record: IssuedPOViewRecord; item: { code: string; name: string; type?: string; unit?: string }; poQty: number; alreadyShipped: number }
    | { mode: 'po'; record: IssuedPOViewRecord; lines: ConsolidatedLine[] }
    | null
  >(null);

  const grnByPo = useMemo(() => {
    const m = new Map<string, GRNRecordFromApi[]>();
    for (const g of grnList) {
      const k = normPo(g.poNo);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(g);
    }
    return m;
  }, [grnList]);

  // Same GRNs keyed by purchaseOrderId — the reliable join when both PO row and GRN carry the id.
  const grnByPoId = useMemo(() => {
    const m = new Map<string, GRNRecordFromApi[]>();
    for (const g of grnList) {
      const k = poIdKey(g.purchaseOrderId != null ? String(g.purchaseOrderId) : '');
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(g);
    }
    return m;
  }, [grnList]);

  // Already-shipped for a PO line (sum of matched GRN qtys) — drives Pending in the transit popups.
  const shippedForPoItem = (poNo: string, itemCode: string, itemName: string): number => {
    const grns = grnByPo.get(normPo(poNo)) ?? [];
    let sum = 0;
    for (const g of grns) {
      const gl = (g.lineItems ?? []).filter((x) => (x.itemCode || '').toUpperCase() === (itemCode || '').toUpperCase() || x.item === itemName);
      sum += gl.reduce((s, x) => s + (Number(x.rcvdQty) || Number(x.poQty) || 0), 0);
    }
    return sum;
  };

  const openConsolidated = (record: IssuedPOViewRecord) => {
    const lines: ConsolidatedLine[] = record.lineItems.map((l) => ({
      code: l.itemCode || '', name: l.item, type: l.type, unit: l.unit,
      poQty: Number(l.qty) || 0, alreadyShipped: shippedForPoItem(record.poNumber, l.itemCode || '', l.item),
    }));
    setTransit({ mode: 'po', record, lines });
  };
  const openPerLine = (record: IssuedPOViewRecord, l: { itemCode: string; item: string; type?: string; unit?: string; poQty: number }) => {
    setTransit({
      mode: 'line', record,
      item: { code: l.itemCode, name: l.item, type: l.type, unit: l.unit },
      poQty: l.poQty, alreadyShipped: shippedForPoItem(record.poNumber, l.itemCode, l.item),
    });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dirMul = sortDir === 'asc' ? 1 : -1;
    const filtered = records.filter((r) => {
      if (statusFilter !== 'all' && resolvePoWorkflowStatus(r) !== statusFilter) return false;
      if (vendorFilter !== 'all' && (r.vendor || 'Unknown Vendor') !== vendorFilter) return false;
      if (!poInDateRange(r.createdDate, dateFrom, dateTo)) return false;
      if (q) {
        const hay = `${r.poNumber} ${r.vendor} ${r.lineItems.map((l) => `${l.item} ${l.itemCode ?? ''}`).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      let d = 0;
      switch (sortBy) {
        case 'value': d = (a.grandTotal || 0) - (b.grandTotal || 0); break;
        case 'po': d = normPo(a.poNumber).localeCompare(normPo(b.poNumber)); break;
        case 'vendor': d = (a.vendor || '').localeCompare(b.vendor || ''); break;
        default: d = dateMs(a.createdDate) - dateMs(b.createdDate); break; // 'date'
      }
      if (d === 0) d = dateMs(a.createdDate) - dateMs(b.createdDate);
      return d * dirMul;
    });
    // poNumber alone is not unique: the same released PO can be emitted once per procurement request
    // it matches (one via formData.requestId, another via formData.requestCode), and only the
    // unlinked-vs-request pass upstream dedupes. Identity keeps genuinely distinct POs that happen to
    // share a number, while collapsing the exact same row appearing twice — and doubles as a stable
    // React key, which `key={r.poNumber}` was not.
    const seen = new Set<string>();
    return filtered
      .map((r) => ({
        record: r,
        rollup: computeRollup(r, grnByPo, grnByPoId),
        rowKey: `${r.backendPoId ?? ''}::${r.poNumber}::${r.requestCode ?? ''}`,
      }))
      .filter((row) => {
        if (seen.has(row.rowKey)) return false;
        seen.add(row.rowKey);
        return true;
      });
  }, [records, grnByPo, grnByPoId, search, statusFilter, vendorFilter, dateFrom, dateTo, sortBy, sortDir]);

  // ── Items tab: one row per PO line, with matched GRNs + "other POs" count ──
  const lineRows = useMemo(() => {
    const posByItem = new Map<string, Set<string>>();
    for (const r of records) {
      for (const l of r.lineItems) {
        const k = (l.itemCode || '').toUpperCase();
        if (!k) continue;
        if (!posByItem.has(k)) posByItem.set(k, new Set());
        posByItem.get(k)!.add(r.poNumber);
      }
    }
    const q = search.trim().toLowerCase();
    const out: Array<{
      record: IssuedPOViewRecord; item: string; itemCode: string; itemKey: string; poQty: number; unit?: string;
      grnLines: { grnNo: string; qty: number; stage: GrnStage }[];
      received: number; billed: number; otherPos: number; daysOpen: number; leadDays: number;
    }> = [];
    const now = Date.now();
    for (const r of records) {
      if (statusFilter !== 'all' && resolvePoWorkflowStatus(r) !== statusFilter) continue;
      if (vendorFilter !== 'all' && (r.vendor || 'Unknown Vendor') !== vendorFilter) continue;
      if (!poInDateRange(r.createdDate, dateFrom, dateTo)) continue;
      const grns = grnByPo.get(normPo(r.poNumber)) ?? [];
      const poDate = r.createdDate ? new Date(r.createdDate).getTime() : now;
      const daysOpen = Number.isNaN(poDate) ? 0 : Math.max(0, Math.round((now - poDate) / 86_400_000));
      for (const l of r.lineItems) {
        const itemCode = l.itemCode || '';
        const itemKey = itemCode.toUpperCase();
        if (itemFilter && itemKey !== itemFilter) continue;
        if (q && !`${r.poNumber} ${r.vendor} ${l.item} ${itemCode}`.toLowerCase().includes(q)) continue;
        const grnLines: { grnNo: string; qty: number; stage: GrnStage }[] = [];
        let received = 0, billed = 0;
        for (const g of grns) {
          const gl = (g.lineItems ?? []).filter((x) => (x.itemCode || '').toUpperCase() === itemKey || x.item === l.item);
          if (!gl.length) continue;
          const qty = gl.reduce((s, x) => s + (Number(x.rcvdQty) || Number(x.poQty) || 0), 0);
          const complete = /complete/i.test(g.status || '');
          if (complete) { received += gl.reduce((s, x) => s + (Number(x.rcvdQty) || 0), 0); billed += gl.reduce((s, x) => s + (Number(x.invoiceQty) || 0), 0); }
          grnLines.push({ grnNo: g.grnNo, qty, stage: mapGrnStatusToStage(g.status) });
        }
        out.push({
          record: r, item: l.item, itemCode, itemKey, poQty: Number(l.qty) || 0, unit: l.unit,
          grnLines, received, billed,
          otherPos: Math.max(0, (posByItem.get(itemKey)?.size ?? 1) - 1),
          daysOpen, leadDays: Number(l.leadTimeDays) || 0,
        });
      }
    }
    const dirMul = sortDir === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      let d = 0;
      switch (sortBy) {
        case 'qty': d = a.poQty - b.poQty; break;
        case 'sla': d = a.daysOpen - b.daysOpen; break;
        case 'po': d = normPo(a.record.poNumber).localeCompare(normPo(b.record.poNumber)); break;
        case 'vendor': d = (a.record.vendor || '').localeCompare(b.record.vendor || ''); break;
        case 'date': d = dateMs(a.record.createdDate) - dateMs(b.record.createdDate); break;
        default: d = a.itemKey.localeCompare(b.itemKey); break; // 'item'
      }
      // Tiebreak keeps sibling PO lines for the same item together (§4.4).
      if (d === 0) d = a.itemKey.localeCompare(b.itemKey) || dateMs(b.record.createdDate) - dateMs(a.record.createdDate);
      return d * dirMul;
    });
    return out;
  }, [records, grnByPo, search, statusFilter, vendorFilter, dateFrom, dateTo, itemFilter, sortBy, sortDir]);

  // ── Pagination (slice the filtered+sorted flat rows before vendor grouping) ──
  const poTotalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const poSafePage = Math.min(poPage, poTotalPages);
  const poPageStart = (poSafePage - 1) * pageSize;
  const pagedRows = useMemo(
    () => rows.slice(poPageStart, poPageStart + pageSize),
    [rows, poPageStart, pageSize],
  );

  const itemsTotalPages = Math.max(1, Math.ceil(lineRows.length / pageSize));
  const itemsSafePage = Math.min(itemsPage, itemsTotalPages);
  const itemsPageStart = (itemsSafePage - 1) * pageSize;
  const pagedLineRows = useMemo(
    () => lineRows.slice(itemsPageStart, itemsPageStart + pageSize),
    [lineRows, itemsPageStart, pageSize],
  );

  // Any filter/sort change resets to page 1 so the user isn't stranded past the end.
  useEffect(() => {
    setPoPage(1);
  }, [search, statusFilter, vendorFilter, dateFrom, dateTo, sortBy, sortDir, pageSize]);
  useEffect(() => {
    setItemsPage(1);
  }, [search, statusFilter, vendorFilter, dateFrom, dateTo, itemFilter, sortBy, sortDir, pageSize]);
  useEffect(() => {
    setPoPage((p) => Math.min(p, poTotalPages));
  }, [poTotalPages]);
  useEffect(() => {
    setItemsPage((p) => Math.min(p, itemsTotalPages));
  }, [itemsTotalPages]);

  // ── Vendor-grouped rows for PO-wise tab ──
  const vendorGroups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of pagedRows) {
      const v = row.record.vendor || 'Unknown Vendor';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(row);
    }
    const groups = [...map.entries()].map(([vendor, vendorRows]) => ({
      vendor,
      vendorRows,
      vendorTotal: vendorRows.reduce((s, r) => s + (r.record.grandTotal || 0), 0),
      latest: vendorRows.reduce((m, r) => Math.max(m, dateMs(r.record.createdDate)), 0),
    }));
    // Order the vendor groups by the active sort so grouped view respects sorting at the top level too.
    const dirMul = sortDir === 'asc' ? 1 : -1;
    groups.sort((a, b) => {
      let d = 0;
      if (sortBy === 'value') d = a.vendorTotal - b.vendorTotal;
      else if (sortBy === 'date') d = a.latest - b.latest;
      else d = a.vendor.localeCompare(b.vendor); // 'vendor' / 'po' → alphabetical vendor
      if (d === 0) d = a.vendor.localeCompare(b.vendor);
      return (sortBy === 'value' || sortBy === 'date') ? d * dirMul : d * (sortBy === 'vendor' ? dirMul : 1);
    });
    return groups;
  }, [pagedRows, sortBy, sortDir]);

  // ── Vendor-grouped rows for Items tab ──
  const lineVendorGroups = useMemo(() => {
    const map = new Map<string, typeof lineRows>();
    for (const lr of pagedLineRows) {
      const v = lr.record.vendor || 'Unknown Vendor';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(lr);
    }
    const dirMul = sortDir === 'asc' ? 1 : -1;
    const groups = [...map.entries()].map(([vendor, vendorLineRows]) => ({
      vendor,
      vendorLineRows,
      latest: vendorLineRows.reduce((m, lr) => Math.max(m, dateMs(lr.record.createdDate)), 0),
    }));
    groups.sort((a, b) => {
      if (sortBy === 'date') return (a.latest - b.latest) * dirMul || a.vendor.localeCompare(b.vendor);
      if (sortBy === 'vendor') return a.vendor.localeCompare(b.vendor) * dirMul;
      return a.vendor.localeCompare(b.vendor);
    });
    return groups;
  }, [pagedLineRows, sortBy, sortDir]);

  const totalValue = records.reduce((s, r) => s + (r.grandTotal || 0), 0);
  const inTransitCount = rows.filter((x) => x.rollup.inTransit > 0).length;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <ProcSectionHeader
        icon={<Package className="w-4 h-4 shrink-0" />}
        title="Purchase Orders"
        stats={[
          { value: records.length, label: 'POs' },
          { value: inTransitCount, label: 'in-transit', tone: 'brand' },
          { value: fmtMoney(totalValue), label: 'value' },
        ]}
        actions={
          <>
            {onNewPo && (
              <button onClick={onNewPo} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-press">
                <Package size={14} /> New PO
              </button>
            )}
            <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-ink-3 bg-surface hover:bg-surface-2">
              <Download size={14} /> Export
            </button>
          </>
        }
      />

      {/* Tabs */}
      <ProcTabs
        tabs={[
          { key: 'po-wise', label: 'PO-wise' },
          { key: 'items', label: 'Items' },
        ]}
        value={tab}
        onChange={changeTab}
      />

      {/* ── Filters & sorting (shared across both tabs) ── */}
      <ProcFilterBar stack>
        <div className="flex flex-wrap items-center gap-2">
          <ProcSearch value={search} onChange={setSearch} placeholder="Search PO #, item, vendor…" className="flex-1 min-w-[220px]" />
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            aria-label="Filter by vendor"
            className={`${procSelectClass} max-w-[200px]`}>
            <option value="all">All Vendors</option>
            {vendorList.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by status"
            className={procSelectClass}>
            <option value="all">All Statuses</option>
            {(Object.keys(PO_STATUS_CONFIG) as PoStatus[]).map((s) => (
              <option key={s} value={s}>{PO_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-ink-3 uppercase">PO Date</span>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)}
            aria-label="PO date from"
            className="px-2.5 py-2 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-[color:var(--ring)]" />
          <span className="text-ink-4 text-xs">–</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
            aria-label="PO date to"
            className="px-2.5 py-2 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-[color:var(--ring)]" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-ink-3 uppercase">Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort by"
              className={procSelectClass}>
              {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
              className="inline-flex items-center gap-1 px-2.5 py-2 border border-border rounded-lg text-xs font-semibold bg-surface text-ink-3 hover:bg-surface-2">
              {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {sortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-ink-3">
            {tab === 'items'
              ? `${lineRows.length} line${lineRows.length !== 1 ? 's' : ''} match`
              : `${rows.length} of ${records.length} PO${records.length !== 1 ? 's' : ''} match`}
          </span>
          {tab === 'items' && itemFilter && (
            <button onClick={() => setItemFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-brand-soft text-brand border border-brand-soft">
              item {itemFilter} <X size={12} />
            </button>
          )}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-border text-ink-3 bg-surface hover:bg-surface-2">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </ProcFilterBar>

      {tab === 'items' ? (
        <>
          {lineRows.length === 0 ? (
            <ProcEmpty>No PO lines match these filters.</ProcEmpty>
          ) : (
            <>
            <ProcTableCard>
                <ProcThead cols={['PO Date', 'PO #', 'Item', { label: 'PO Qty', align: 'center' }, 'GRN Qty (GRN# · qty)', 'GRN Status', 'Purchase Status', 'SLA', 'Other POs', 'Action']} />
                <tbody>
                  {lineVendorGroups.map(({ vendor, vendorLineRows }) => (
                    <React.Fragment key={vendor}>
                      {/* Vendor header row */}
                      <tr
                        className="bg-surface-3 border-y border-border hover:bg-surface-2 cursor-pointer select-none"
                        onClick={() => toggleVendor(`items:${vendor}`)}
                      >
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              size={13}
                              className={`text-ink-3 transition-transform ${collapsedVendors.has(`items:${vendor}`) ? '-rotate-90' : ''}`}
                            />
                            <span className="text-xs font-bold text-ink">{vendor}</span>
                            <span className="text-[10px] text-ink-3 font-medium">
                              {vendorLineRows.length} line{vendorLineRows.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!collapsedVendors.has(`items:${vendor}`) && vendorLineRows.map((lr, idx) => {
                        const ps = derivePurchaseStatus(lr.received, lr.billed, resolvePoWorkflowStatus(lr.record));
                        const psCfg = ps ? PURCHASE_STATUS_CONFIG[ps] : null;
                        const fullyReceived = lr.received >= lr.poQty && lr.poQty > 0;
                        const canTransit = isShippable(lr.record) && !fullyReceived;
                        const slaLevel: 'ok' | 'warn' | 'bad' = fullyReceived ? 'ok'
                          : lr.leadDays > 0 && lr.daysOpen > lr.leadDays ? 'bad'
                          : lr.leadDays > 0 && lr.daysOpen >= lr.leadDays * 0.8 ? 'warn' : 'ok';
                        const slaText = fullyReceived ? <><Check className="inline w-3 h-3 align-[-1px]" /> received</> : slaLevel === 'bad' ? <><Flag weight="fill" className="inline w-3 h-3 align-[-1px]" /> {`${lr.daysOpen}d / ${lr.leadDays}d lead`}</> : slaLevel === 'warn' ? <><Warning className="inline w-3 h-3 align-[-1px]" /> {`${lr.daysOpen}d / ${lr.leadDays}d`}</> : <><Check className="inline w-3 h-3 align-[-1px]" /> within lead</>;
                        const slaCls = slaLevel === 'bad' ? 'text-err font-bold' : slaLevel === 'warn' ? 'text-warn font-semibold' : 'text-ok';
                        return (
                          <tr key={`${lr.record.poNumber}-${lr.itemKey}-${idx}`} onClick={() => onOpenDetail(lr.record)} className="hover:bg-brand-soft transition-colors align-top border-b border-hairline cursor-pointer">
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-2">{fmtDate(lr.record.createdDate)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button onClick={(e) => { e.stopPropagation(); onOpenDetail(lr.record); }} className="font-mono text-xs font-semibold text-brand hover:underline decoration-dotted">{lr.record.poNumber}</button>
                            </td>
                            <td className="px-3 py-2.5 max-w-[150px]">
                              <p className="text-xs font-semibold text-ink truncate" title={lr.item}>{lr.item}</p>
                              <p className="text-[10px] text-ink-4 font-mono">{lr.itemCode}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs tabular-nums text-ink-2">{lr.poQty.toLocaleString('en-IN')}{lr.unit ? ` ${lr.unit}` : ''}</td>
                            <td className="px-3 py-2.5 min-w-[130px]">
                              {lr.grnLines.length === 0 ? (
                                <span className="text-[10.5px] text-ink-4">— no shipments yet</span>
                              ) : (
                                <div className="space-y-0.5 font-mono text-[10.5px]">
                                  {lr.grnLines.map((g, i) => (
                                    <div key={i}><span className="text-brand">{g.grnNo}</span> · <b>{g.qty.toLocaleString('en-IN')}</b></div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {lr.grnLines.length === 0 ? <span className="text-ink-4 text-xs">—</span> : (
                                <div className="flex flex-col gap-0.5">
                                  {lr.grnLines.map((g, i) => {
                                    const c = GRN_STAGE_CONFIG[g.stage];
                                    return <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {psCfg ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${psCfg.text} ${psCfg.bg} ${psCfg.border}`}>{psCfg.label}{ps === 'received' ? ` · ${lr.received.toLocaleString('en-IN')}` : ps === 'billed' ? ` · ${lr.billed.toLocaleString('en-IN')}` : ''}</span> : <span className="text-[10px] text-ink-4">— draft</span>}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-[11px] font-mono ${slaCls}`}>{slaText}</span></td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-center">
                              {lr.otherPos > 0 ? (
                                <button onClick={(e) => { e.stopPropagation(); setItemFilter(lr.itemKey); }} className="inline-flex items-center gap-0.5 text-[10.5px] text-brand font-semibold hover:underline">
                                  <ChevronRight size={11} /> {lr.otherPos} other PO{lr.otherPos !== 1 ? 's' : ''}
                                </button>
                              ) : <span className="text-ink-4 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(lr.record); }} title={lr.record.status === 'Draft' ? 'Edit PO' : 'View / Update status'} aria-label={lr.record.status === 'Draft' ? 'Edit PO' : 'View / Update status'} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-ink-3 bg-surface-3 hover:bg-surface-2">{lr.record.status === 'Draft' ? <Pencil size={12} /> : <Eye size={12} />}</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); canTransit && openPerLine(lr.record, { itemCode: lr.itemCode, item: lr.item, unit: lr.unit, poQty: lr.poQty }); }}
                                  disabled={!canTransit}
                                  title={canTransit ? 'Initiate Transit (per line)' : fullyReceived ? 'Line already fully received' : 'PO must be Issued / Accepted before shipment'}
                                  aria-label={canTransit ? 'Initiate Transit (per line)' : fullyReceived ? 'Line already fully received' : 'PO must be Issued / Accepted before shipment'}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-md border ${canTransit ? 'border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft-2' : 'border-border text-ink-4 bg-surface-3 cursor-not-allowed'}`}
                                >
                                  <Truck size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
            </ProcTableCard>
            <PoPaginationBar
              id="po-items-page-size"
              pageStart={itemsPageStart}
              pageSize={pageSize}
              total={lineRows.length}
              currentPage={itemsSafePage}
              totalPages={itemsTotalPages}
              unit="lines"
              onPageChange={setItemsPage}
              onPageSizeChange={setPageSize}
            />
            </>
          )}
        </>
      ) : (
        <>
          {/* Table */}
          {rows.length === 0 ? (
            <ProcEmpty>No purchase orders match these filters.</ProcEmpty>
          ) : (
            <>
            <ProcTableCard>
                <ProcThead cols={['PO Date', 'PO #', 'Item', 'PO Status', { label: 'PO Value', align: 'center' }, 'Connecting', { label: 'In-Transit', align: 'center' }, { label: 'Received', align: 'center' }, { label: 'Billed', align: 'center' }, { label: 'Return', align: 'center' }, 'Actions']} />
                <tbody>
                  {vendorGroups.map(({ vendor, vendorRows, vendorTotal }) => (
                    <React.Fragment key={vendor}>
                      {/* Vendor header row */}
                      <tr
                        className="bg-surface-3 border-y border-border hover:bg-surface-2 cursor-pointer select-none"
                        onClick={() => toggleVendor(`po:${vendor}`)}
                      >
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              size={13}
                              className={`text-ink-3 transition-transform ${collapsedVendors.has(`po:${vendor}`) ? '-rotate-90' : ''}`}
                            />
                            <span className="text-xs font-bold text-ink">{vendor}</span>
                            <span className="text-[10px] text-ink-3 font-medium">
                              {vendorRows.length} PO{vendorRows.length !== 1 ? 's' : ''}
                            </span>
                            <span className="ml-auto text-xs font-mono font-bold text-ink-2">{fmtMoney(vendorTotal)}</span>
                          </div>
                        </td>
                      </tr>
                      {!collapsedVendors.has(`po:${vendor}`) && vendorRows.map(({ record: r, rollup, rowKey }) => {
                        const wf = resolvePoWorkflowStatus(r);
                        const st = PO_STATUS_CONFIG[wf];
                        const shippable = isShippable(r);
                        return (
                          <tr key={rowKey} onClick={() => onOpenDetail(r)} className="hover:bg-brand-soft transition-colors border-b border-hairline cursor-pointer">
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-2">{fmtDate(r.createdDate)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button onClick={(e) => { e.stopPropagation(); onOpenDetail(r); }} className="font-mono text-xs font-semibold text-brand hover:text-brand hover:underline decoration-dotted">{r.poNumber}</button>
                            </td>
                            <td className="px-3 py-2.5 max-w-[180px]">
                              {r.lineItems.length === 0 ? (
                                <span className="text-xs text-ink-4">—</span>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-ink truncate" title={r.lineItems.map((l) => l.item).join(', ')}>{r.lineItems[0].item}</p>
                                  {r.lineItems.length > 1 && <p className="text-[10px] text-ink-4">+{r.lineItems.length - 1} more item{r.lineItems.length - 1 !== 1 ? 's' : ''}</p>}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${st.text} ${st.bg} ${st.border}`}>{st.label}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-center">
                              <div className="text-xs font-bold text-ink tabular-nums">{fmtMoney(r.grandTotal)}</div>
                              <div className="text-[9.5px] text-ink-4">{r.lineItems.length} item{r.lineItems.length !== 1 ? 's' : ''}</div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {(() => {
                                const conn = connectingDatesForRecord(r);
                                if (!conn) return <span className="text-xs text-ink-4">—</span>;
                                return (
                                  <div className="text-xs text-ink-2" title={conn.items.join('\n')}>
                                    {conn.label}
                                    {conn.items.length > 1 && (
                                      <div className="text-[9.5px] text-ink-4">{conn.items.length} items</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.inTransit} ordered={rollup.ordered} onClick={onOpenGrnForPo ? () => onOpenGrnForPo(r.poNumber) : undefined} /></td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.received} ordered={rollup.ordered} /></td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.billed} ordered={rollup.ordered} /></td>
                            <td className="px-3 py-2.5 text-center">{rollup.returned > 0 ? <span className="text-xs font-semibold text-err tabular-nums">{rollup.returned}</span> : <span className="text-ink-4 text-xs">0</span>}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} title={r.status === 'Draft' ? 'Edit PO' : 'View / Update status'} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-ink-3 bg-surface-3 hover:bg-surface-2 text-[10.5px] font-semibold">{r.status === 'Draft' ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> View</>}</button>
                                {(() => {
                                  // Before a PO can ship it must clear approval and be released. Showing the
                                  // shipment verb here (greyed out) read as "shipping is next" when it isn't,
                                  // so a pre-shipment PO gets its own action that opens the approval panel.
                                  const pending = preShipmentAction(r);
                                  if (pending) {
                                    return (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onOpenDetail(r); }}
                                        title={pending.title}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-warn text-warn bg-warn-soft hover:opacity-80 text-[10.5px] font-semibold">
                                        <ShieldCheck size={12} /> {pending.label}
                                      </button>
                                    );
                                  }
                                  const ship = shipmentAction(rollup);
                                  return (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); if (shippable) openConsolidated(r); }}
                                      disabled={!shippable}
                                      title={shippable ? ship.title : 'Available once PO is Issued/Accepted'}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10.5px] font-semibold ${shippable ? 'border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft-2' : 'border-border text-ink-4 bg-surface-3 cursor-not-allowed'}`}>
                                      <Truck size={12} /> {ship.label}
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
            </ProcTableCard>
            <PoPaginationBar
              id="po-wise-page-size"
              pageStart={poPageStart}
              pageSize={pageSize}
              total={rows.length}
              currentPage={poSafePage}
              totalPages={poTotalPages}
              unit="POs"
              onPageChange={setPoPage}
              onPageSizeChange={setPageSize}
            />
            </>
          )}
        </>
      )}

      {/* §4A Initiate Transit (per line) */}
      {transit?.mode === 'line' && (
        <InitiateTransitPopup
          poId={transit.record.backendPoId ?? null}
          poNo={transit.record.poNumber}
          vendor={transit.record.vendor}
          item={transit.item}
          poQty={transit.poQty}
          alreadyShipped={transit.alreadyShipped}
          onClose={() => setTransit(null)}
          onSubmit={async (payload) => {
            await initiateTransit(payload);
            setTransit(null);
            onShipmentCreated?.();
          }}
        />
      )}

      {/* §4B Consolidated Shipment (multi-item) */}
      {transit?.mode === 'po' && (
        <ConsolidatedShipmentPopup
          poId={transit.record.backendPoId ?? null}
          poNo={transit.record.poNumber}
          vendor={transit.record.vendor}
          lines={transit.lines}
          onClose={() => setTransit(null)}
          onSubmit={async (payload) => {
            await createConsolidatedShipment(payload);
            setTransit(null);
            onShipmentCreated?.();
          }}
        />
      )}
    </div>
  );
};
