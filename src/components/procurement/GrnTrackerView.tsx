/**
 * GRN Tracker — Procurement spec View 5 (§6).
 * Multi-stage inbound tracking. Stage pill opens timeline modal for advancement.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Truck, Package, Loader2 } from 'lucide-react';
import { fetchGrnTracker, type GrnTrackerRow } from '../../services/grn.service';
import { GRN_STAGE_CONFIG, GRN_STAGE_ORDER, SLA_LEVEL_CLASSES, type GrnStage } from '../../constants/procurement';
import { grnInTransitSlaLevel } from '../../lib/procurementSla';
import { GrnStageTimelineModal } from './GrnStageTimelineModal';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}
function isGrnStage(s: string): s is GrnStage {
  return (GRN_STAGE_ORDER as string[]).includes(s);
}

function StagePill({ stage, onClick }: { stage: string; onClick?: () => void }) {
  const key = isGrnStage(stage) ? stage : 'in_transit';
  const c = GRN_STAGE_CONFIG[key];
  const inner = (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.text} ${c.bg} ${c.border}`}>
      {c.label}
    </span>
  );
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} className="hover:opacity-80 transition-opacity" title="Open stage timeline">
      {inner}
    </button>
  );
}

export const GrnTrackerView: React.FC = () => {
  const [rows, setRows] = useState<GrnTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<'all' | GrnStage>('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [timelineRow, setTimelineRow] = useState<GrnTrackerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await fetchGrnTracker()); }
    catch (e) { setError('Failed to load GRN tracker'); console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const vendors = useMemo(() => Array.from(new Set(rows.map((r) => r.vendor).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (vendorFilter !== 'all' && r.vendor !== vendorFilter) return false;
      if (q && !`${r.grnNo} ${r.sbCode ?? ''} ${r.poNo ?? ''} ${r.vendor ?? ''} ${r.item.name} ${r.item.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
    out.sort((a, b) => (b.sbCode ?? '').localeCompare(a.sbCode ?? '') || a.grnNo.localeCompare(b.grnNo));
    return out;
  }, [rows, stageFilter, vendorFilter, search]);

  const sbCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.sbCode) m.set(r.sbCode, (m.get(r.sbCode) ?? 0) + 1);
    return m;
  }, [rows]);

  const inTransit = rows.filter((r) => r.stage === 'in_transit').length;
  const underQc = rows.filter((r) => r.stage === 'qc_tested' || r.stage === 'quarantined').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          📦 <b className="text-slate-800">GRN Tracker</b> · {rows.length} GRNs · {inTransit} in-transit · {underQc} under QC
          <span className="ml-2 text-slate-400">· sibling GRNs share an SB#</span>
        </div>
        <button onClick={() => void load()} title="Refresh" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search GRN #, SB #, PO #, item, vendor…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Stages</option>
          {GRN_STAGE_ORDER.map((s) => <option key={s} value={s}>{GRN_STAGE_CONFIG[s].label}</option>)}
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Vendors</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-blue-500 mr-2" /><span className="text-sm text-slate-500">Loading GRN tracker…</span></div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center"><p className="text-red-500 text-sm mb-3">{error}</p><button onClick={() => void load()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm"><Package size={30} className="mx-auto mb-2 opacity-30" />No GRNs yet — create one via a PO's Initiate Shipment.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Shipped', 'SB #', 'GRN #', 'PO #', 'Vendor', 'Item', 'PO Qty', 'Shipped', 'Expected', 'GRN Stage', 'SLA', 'Vehicle'].map((h) => (
                  <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${['PO Qty', 'Shipped'].includes(h) ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const sibling = r.sbCode && (sbCounts.get(r.sbCode) ?? 0) > 1;
                const slaLevel = grnInTransitSlaLevel(r.shippedDate, 7);
                return (
                  <tr key={r.id} className={`transition-colors ${sibling ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.shippedDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.sbCode ? (
                        <span className="font-mono text-[11px] font-semibold text-blue-700" title={sibling ? 'Sibling GRNs share this truck' : undefined}>
                          {r.sbCode}{sibling ? <span className="ml-1 text-[9px] text-blue-500">· same truck</span> : ''}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => setTimelineRow(r)} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline">{r.grnNo}</button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-blue-600">{r.poNo ?? '—'}</td>
                    <td className="px-3 py-2.5 max-w-[120px]"><p className="text-xs text-slate-700 truncate" title={r.vendor ?? ''}>{r.vendor ?? '—'}</p></td>
                    <td className="px-3 py-2.5 max-w-[150px]"><p className="text-xs font-semibold text-slate-800 truncate" title={r.item.name}>{r.item.name || '—'}</p><p className="text-[10px] text-slate-400 font-mono">{r.item.code}</p></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs text-slate-700">{r.poQty.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs font-semibold text-slate-800">{r.shippedQty.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.expectedDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StagePill stage={r.stage} onClick={() => setTimelineRow(r)} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.stage === 'in_transit' && slaLevel !== 'ok' ? (
                        <span className={`text-[10px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>over lead</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.vehicleNo ? <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-slate-600"><Truck size={11} className="text-slate-400" />{r.vehicleNo}</span> : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {timelineRow ? (
        <GrnStageTimelineModal
          row={timelineRow}
          onClose={() => setTimelineRow(null)}
          onAdvanced={() => void load()}
        />
      ) : null}
    </div>
  );
};
