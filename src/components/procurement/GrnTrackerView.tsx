/**
 * GRN Tracker — Procurement spec View 5 (§6).
 * Multi-stage inbound tracking. Stage pill opens timeline modal for advancement.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Truck, Package, Loader2 } from 'lucide-react';
import { Package as PackagePh } from '@phosphor-icons/react';
import { fetchGrnTracker, type GrnTrackerRow } from '../../services/grn.service';
import { GRN_STAGE_CONFIG, GRN_STAGE_ORDER, SLA_LEVEL_CLASSES, type GrnStage } from '../../constants/procurement';
import { grnInTransitSlaLevel } from '../../lib/procurementSla';
import { GrnStageTimelineModal } from './GrnStageTimelineModal';
import { ProcSectionHeader, ProcFilterBar, ProcSearch, procSelectClass, ProcTableCard, ProcThead, ProcLoading, ProcError, ProcEmpty } from './ProcSection';

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

interface GrnTrackerViewProps {
  onCountChange?: (n: number) => void;
}

export const GrnTrackerView: React.FC<GrnTrackerViewProps> = ({ onCountChange }) => {
  const [rows, setRows] = useState<GrnTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<'all' | GrnStage>('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [timelineRow, setTimelineRow] = useState<GrnTrackerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchGrnTracker();
      setRows(data);
      onCountChange?.(data.length);
    }
    catch (e) { setError('Failed to load GRN tracker'); console.error(e); }
    finally { setLoading(false); }
  }, [onCountChange]);
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
      <ProcSectionHeader
        icon={<PackagePh className="w-4 h-4 shrink-0" />}
        title="GRN Tracker"
        stats={[
          { value: rows.length, label: 'GRNs' },
          { value: inTransit, label: 'in-transit', tone: 'brand' },
          { value: underQc, label: 'under QC', tone: 'warn' },
        ]}
        actions={
          <button onClick={() => void load()} disabled={loading} title="Refresh" aria-label="Refresh" className="p-2 rounded-lg border border-border hover:bg-surface-2 text-ink-3 disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <ProcFilterBar>
        <ProcSearch value={search} onChange={setSearch} placeholder="Search GRN #, SB #, PO #, item, vendor…" />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)} aria-label="Filter by stage" className={procSelectClass}>
          <option value="all">All Stages</option>
          {GRN_STAGE_ORDER.map((s) => <option key={s} value={s}>{GRN_STAGE_CONFIG[s].label}</option>)}
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} aria-label="Filter by vendor" className={procSelectClass}>
          <option value="all">All Vendors</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </ProcFilterBar>

      {loading ? (
        <ProcLoading label="Loading GRN tracker…" />
      ) : error ? (
        <ProcError message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <ProcEmpty icon={<Package size={30} />}>No GRNs yet — create one via a PO&apos;s Initiate Shipment.</ProcEmpty>
      ) : (
        <ProcTableCard>
            <ProcThead cols={['Shipped Date', 'SB #', 'GRN #', 'PO #', 'Vendor', 'Item', { label: 'PO Qty', align: 'center' }, { label: 'Shipped', align: 'center' }, 'Expected', 'GRN Stage', 'SLA', 'Vehicle']} />
            <tbody className="divide-y divide-hairline">
              {filtered.map((r) => {
                const sibling = r.sbCode && (sbCounts.get(r.sbCode) ?? 0) > 1;
                const slaLevel = grnInTransitSlaLevel(r.shippedDate, 7);
                return (
                  <tr key={r.id} className={`transition-colors ${sibling ? 'bg-brand-soft' : 'hover:bg-brand-soft'}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-2">{fmtDate(r.shippedDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.sbCode ? (
                        <span className="font-mono text-[11px] font-semibold text-brand" title={sibling ? 'Sibling GRNs share this truck' : undefined}>
                          {r.sbCode}{sibling ? <span className="ml-1 text-[9px] text-brand">· same truck</span> : ''}
                        </span>
                      ) : <span className="text-ink-4 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => setTimelineRow(r)} className="font-mono text-[11px] font-semibold text-brand hover:underline">{r.grnNo}</button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-brand">{r.poNo ?? '—'}</td>
                    <td className="px-3 py-2.5 max-w-[120px]"><p className="text-xs text-ink-2 truncate" title={r.vendor ?? ''}>{r.vendor ?? '—'}</p></td>
                    <td className="px-3 py-2.5 max-w-[150px]"><p className="text-xs font-semibold text-ink truncate" title={r.item.name}>{r.item.name || '—'}</p><p className="text-[10px] text-ink-4 font-mono">{r.item.code}</p></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs text-ink-2">{r.poQty.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs font-semibold text-ink">{r.shippedQty.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-2">{fmtDate(r.expectedDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StagePill stage={r.stage} onClick={() => setTimelineRow(r)} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.stage === 'in_transit' && slaLevel !== 'ok' ? (
                        <span className={`text-[10px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>over lead</span>
                      ) : (
                        <span className="text-[10px] text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.vehicleNo ? <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-3"><Truck size={11} className="text-ink-4" />{r.vehicleNo}</span> : <span className="text-ink-4 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </ProcTableCard>
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
