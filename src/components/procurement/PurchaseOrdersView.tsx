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
import { Search, Pencil, Eye, Truck, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { Pagination } from '../ui';
import type { IssuedPOViewRecord } from './issuedPoRecord.types';
import type { GRNRecordFromApi } from '../../services/grn.service';
import {
  GRN_STAGE_CONFIG, PURCHASE_STATUS_CONFIG, PO_STATUS_CONFIG, PO_SHIPPABLE_STATUSES,
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
 * Received/Billed come from matched-GRN qty; Paid is inferred from the PO reaching the 'completed'
 * workflow state (3-way match → payment → close). Draft POs aren't ordered yet → null.
 */
function derivePurchaseStatus(received: number, billed: number, wf: PoStatus): PurchaseStatus | null {
  if (wf === 'draft') return null;
  if (wf === 'completed') return 'paid';
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

interface Rollup { inTransit: number; received: number; billed: number; returned: number; ordered: number; }

function computeRollup(record: IssuedPOViewRecord, grnByPo: Map<string, GRNRecordFromApi[]>): Rollup {
  const ordered = record.lineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const grns = grnByPo.get(normPo(record.poNumber)) ?? [];
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
  return { inTransit, received, billed, returned: 0, ordered };
}

function QtyLink({ value, ordered, onClick }: { value: number; ordered: number; onClick?: () => void }) {
  if (!value) return <span className="text-slate-300 text-xs">0</span>;
  const pct = ordered > 0 ? Math.round((value / ordered) * 100) : 0;
  return (
    <button onClick={onClick} disabled={!onClick} className={`text-xs tabular-nums ${onClick ? 'text-blue-600 hover:underline decoration-dotted' : 'text-slate-700'}`} title={ordered > 0 ? `${pct}% of ${ordered.toLocaleString('en-IN')}` : undefined}>
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
}

type PoTab = 'po-wise' | 'items';

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <span className="text-xs text-slate-600">
        Showing <b className="text-slate-800">{pageStart + 1}</b>–
        <b className="text-slate-800">{Math.min(pageStart + pageSize, total)}</b> of{' '}
        <b className="text-slate-800">{total}</b> {unit}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="text-xs text-slate-600">Rows per page</label>
        <select
          id={id}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
        >
          {PO_PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} variant="compact" />
      </div>
    </div>
  );
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  records, grnList, onOpenDetail, onEdit, onShipmentCreated, onOpenGrnForPo, onExport,
}) => {
  const [tab, setTab] = useState<PoTab>('po-wise');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PoStatus>('all');
  const [itemFilter, setItemFilter] = useState<string | null>(null); // "Other POs" drill
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set());
  const [poPage, setPoPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
    return records
      .filter((r) => {
        if (statusFilter !== 'all' && resolvePoWorkflowStatus(r) !== statusFilter) return false;
        if (q && !`${r.poNumber} ${r.vendor}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((r) => ({ record: r, rollup: computeRollup(r, grnByPo) }));
  }, [records, grnByPo, search, statusFilter]);

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
    // Default sort: item code asc, then PO date desc (siblings sit together — §4.4).
    out.sort((a, b) => a.itemKey.localeCompare(b.itemKey) || (b.record.createdDate || '').localeCompare(a.record.createdDate || ''));
    return out;
  }, [records, grnByPo, search, statusFilter, itemFilter]);

  // ── Pagination (applied to the flat row lists, before vendor grouping) ──
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

  // Filters change the row set — go back to page 1 so the user isn't stranded past the end.
  useEffect(() => {
    setPoPage(1);
  }, [search, statusFilter, pageSize]);
  useEffect(() => {
    setItemsPage(1);
  }, [search, statusFilter, itemFilter, pageSize]);
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
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([vendor, vendorRows]) => ({
        vendor,
        vendorRows,
        vendorTotal: vendorRows.reduce((s, r) => s + (r.record.grandTotal || 0), 0),
      }));
  }, [pagedRows]);

  // ── Vendor-grouped rows for Items tab ──
  const lineVendorGroups = useMemo(() => {
    const map = new Map<string, typeof lineRows>();
    for (const lr of pagedLineRows) {
      const v = lr.record.vendor || 'Unknown Vendor';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(lr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([vendor, vendorLineRows]) => ({ vendor, vendorLineRows }));
  }, [pagedLineRows]);

  const totalValue = records.reduce((s, r) => s + (r.grandTotal || 0), 0);
  const inTransitCount = rows.filter((x) => x.rollup.inTransit > 0).length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          📦 <b className="text-slate-800">Purchase Orders</b> · {records.length} POs · {inTransitCount} in-transit · <b>{fmtMoney(totalValue)}</b> value
        </div>
        <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
          <Download size={14} /> Export
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-slate-200">
        {([['po-wise', 'PO-wise'], ['items', 'Items']] as [PoTab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-xs font-bold border-b-[3px] -mb-0.5 transition-colors ${tab === k ? 'text-blue-700 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'items' ? (
        <>
          {/* Filters + active item drill */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO #, item, vendor…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
            </div>
            {itemFilter && (
              <button onClick={() => setItemFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                item {itemFilter} · clear ✕
              </button>
            )}
          </div>

          {lineRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm">No PO lines match these filters.</div>
          ) : (
            <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['PO Date', 'PO #', 'Item', 'PO Qty', 'GRN Qty (GRN# · qty)', 'GRN Status', 'Purchase Status', 'SLA', 'Other POs', 'Action'].map((h) => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${h === 'PO Qty' ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineVendorGroups.map(({ vendor, vendorLineRows }) => (
                    <React.Fragment key={vendor}>
                      {/* Vendor header row */}
                      <tr
                        className="bg-slate-100/80 border-y border-slate-200 hover:bg-slate-100 cursor-pointer select-none"
                        onClick={() => toggleVendor(`items:${vendor}`)}
                      >
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              size={13}
                              className={`text-slate-500 transition-transform ${collapsedVendors.has(`items:${vendor}`) ? '-rotate-90' : ''}`}
                            />
                            <span className="text-xs font-bold text-slate-800">{vendor}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
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
                        const slaText = fullyReceived ? '✓ received' : slaLevel === 'bad' ? `🚩 ${lr.daysOpen}d / ${lr.leadDays}d lead` : slaLevel === 'warn' ? `⚠ ${lr.daysOpen}d / ${lr.leadDays}d` : '✓ within lead';
                        const slaCls = slaLevel === 'bad' ? 'text-red-600 font-bold' : slaLevel === 'warn' ? 'text-amber-600 font-semibold' : 'text-emerald-600';
                        return (
                          <tr key={`${lr.record.poNumber}-${lr.itemKey}-${idx}`} className="hover:bg-blue-50/30 transition-colors align-top border-b border-slate-100">
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(lr.record.createdDate)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button onClick={() => onOpenDetail(lr.record)} className="font-mono text-xs font-semibold text-blue-600 hover:underline decoration-dotted">{lr.record.poNumber}</button>
                            </td>
                            <td className="px-3 py-2.5 max-w-[150px]">
                              <p className="text-xs font-semibold text-slate-800 truncate" title={lr.item}>{lr.item}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{lr.itemCode}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs tabular-nums text-slate-700">{lr.poQty.toLocaleString('en-IN')}{lr.unit ? ` ${lr.unit}` : ''}</td>
                            <td className="px-3 py-2.5 min-w-[130px]">
                              {lr.grnLines.length === 0 ? (
                                <span className="text-[10.5px] text-slate-400">— no shipments yet</span>
                              ) : (
                                <div className="space-y-0.5 font-mono text-[10.5px]">
                                  {lr.grnLines.map((g, i) => (
                                    <div key={i}><span className="text-blue-600">{g.grnNo}</span> · <b>{g.qty.toLocaleString('en-IN')}</b></div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {lr.grnLines.length === 0 ? <span className="text-slate-300 text-xs">—</span> : (
                                <div className="flex flex-col gap-0.5">
                                  {lr.grnLines.map((g, i) => {
                                    const c = GRN_STAGE_CONFIG[g.stage];
                                    return <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {psCfg ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${psCfg.text} ${psCfg.bg} ${psCfg.border}`}>{psCfg.label}{ps === 'received' ? ` · ${lr.received.toLocaleString('en-IN')}` : ps === 'billed' ? ` · ${lr.billed.toLocaleString('en-IN')}` : ''}</span> : <span className="text-[10px] text-slate-400">— draft</span>}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-[11px] font-mono ${slaCls}`}>{slaText}</span></td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-center">
                              {lr.otherPos > 0 ? (
                                <button onClick={() => setItemFilter(lr.itemKey)} className="inline-flex items-center gap-0.5 text-[10.5px] text-blue-600 font-semibold hover:underline">
                                  <ChevronRight size={11} /> {lr.otherPos} other PO{lr.otherPos !== 1 ? 's' : ''}
                                </button>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button onClick={() => onEdit(lr.record)} title={lr.record.status === 'Draft' ? 'Edit PO' : 'View / Update status'} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100">{lr.record.status === 'Draft' ? <Pencil size={12} /> : <Eye size={12} />}</button>
                                <button
                                  onClick={() => canTransit && openPerLine(lr.record, { itemCode: lr.itemCode, item: lr.item, unit: lr.unit, poQty: lr.poQty })}
                                  disabled={!canTransit}
                                  title={canTransit ? 'Initiate Transit (per line)' : fullyReceived ? 'Line already fully received' : 'PO must be Issued / Accepted before shipment'}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-md border ${canTransit ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100' : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'}`}
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
              </table>
            </div>
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
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO #, vendor…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
              <option value="all">All Statuses</option>
              {(Object.keys(PO_STATUS_CONFIG) as PoStatus[]).map((s) => (
                <option key={s} value={s}>{PO_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm">No purchase orders match these filters.</div>
          ) : (
            <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['PO Date', 'PO #', 'Item', 'PO Status', 'PO Value', 'In-Transit', 'Received', 'Billed', 'Return', 'Actions'].map((h) => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${['PO Value', 'In-Transit', 'Received', 'Billed', 'Return'].includes(h) ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorGroups.map(({ vendor, vendorRows, vendorTotal }) => (
                    <React.Fragment key={vendor}>
                      {/* Vendor header row */}
                      <tr
                        className="bg-slate-100/80 border-y border-slate-200 hover:bg-slate-100 cursor-pointer select-none"
                        onClick={() => toggleVendor(`po:${vendor}`)}
                      >
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              size={13}
                              className={`text-slate-500 transition-transform ${collapsedVendors.has(`po:${vendor}`) ? '-rotate-90' : ''}`}
                            />
                            <span className="text-xs font-bold text-slate-800">{vendor}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {vendorRows.length} PO{vendorRows.length !== 1 ? 's' : ''}
                            </span>
                            <span className="ml-auto text-xs font-mono font-bold text-slate-700">{fmtMoney(vendorTotal)}</span>
                          </div>
                        </td>
                      </tr>
                      {!collapsedVendors.has(`po:${vendor}`) && vendorRows.map(({ record: r, rollup }) => {
                        const wf = resolvePoWorkflowStatus(r);
                        const st = PO_STATUS_CONFIG[wf];
                        const shippable = isShippable(r);
                        return (
                          <tr key={r.poNumber} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.createdDate)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button onClick={() => onOpenDetail(r)} className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline decoration-dotted">{r.poNumber}</button>
                            </td>
                            <td className="px-3 py-2.5 max-w-[180px]">
                              {r.lineItems.length === 0 ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-slate-800 truncate" title={r.lineItems.map((l) => l.item).join(', ')}>{r.lineItems[0].item}</p>
                                  {r.lineItems.length > 1 && <p className="text-[10px] text-slate-400">+{r.lineItems.length - 1} more item{r.lineItems.length - 1 !== 1 ? 's' : ''}</p>}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${st.text} ${st.bg} ${st.border}`}>{st.label}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-center">
                              <div className="text-xs font-bold text-slate-800 tabular-nums">{fmtMoney(r.grandTotal)}</div>
                              <div className="text-[9.5px] text-slate-400">{r.lineItems.length} item{r.lineItems.length !== 1 ? 's' : ''}</div>
                            </td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.inTransit} ordered={rollup.ordered} onClick={onOpenGrnForPo ? () => onOpenGrnForPo(r.poNumber) : undefined} /></td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.received} ordered={rollup.ordered} /></td>
                            <td className="px-3 py-2.5 text-center"><QtyLink value={rollup.billed} ordered={rollup.ordered} /></td>
                            <td className="px-3 py-2.5 text-center">{rollup.returned > 0 ? <span className="text-xs font-semibold text-red-600 tabular-nums">{rollup.returned}</span> : <span className="text-slate-300 text-xs">0</span>}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button onClick={() => onEdit(r)} title={r.status === 'Draft' ? 'Edit PO' : 'View / Update status'} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 text-[10.5px] font-semibold">{r.status === 'Draft' ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> View</>}</button>
                                <button
                                  onClick={() => shippable && openConsolidated(r)}
                                  disabled={!shippable}
                                  title={shippable ? 'Initiate Shipment' : 'Available once PO is Issued/Accepted'}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10.5px] font-semibold ${shippable ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100' : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'}`}>
                                  <Truck size={12} /> Initiate Shipment
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
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
