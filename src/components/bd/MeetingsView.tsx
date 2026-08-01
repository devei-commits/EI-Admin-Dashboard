/**
 * Meetings queue (§3H) — cross-client list of meetings with schedule, mode/type
 * and lifecycle status. Filter by status / this-week, search, open a row to drive
 * the confirm→attend→MoM→close lifecycle, or request a new meeting.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, CalendarClock, Plus, Clock } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import type { BdCustomerRow, BdMeetingRow } from '../../types/bd.types';
import { MEETING_STATUS_CONFIG, formatDMY, type MeetingStatus } from '../../constants/bd';
import { fetchBdMeetings } from '../../services/bd.service';
import { StatusPill, SourceTag, ClientCell } from './bdQueueBits';
import { MeetingDetailPopup } from './MeetingDetailPopup';
import { NewTxnPopup } from './NewTxnPopup';

const HEADERS = ['Meeting', 'Client', 'Source', 'Schedule', 'Type', 'Mode', 'Lead', 'Status'];
const ALL_STATUSES = Object.keys(MEETING_STATUS_CONFIG) as MeetingStatus[];

function fmtDT(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${formatDMY(d)}, ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}
function isThisWeek(d: string | null): boolean {
  if (!d) return false;
  const dt = new Date(d); if (Number.isNaN(dt.getTime())) return false;
  const now = new Date(); const day = (now.getDay() + 6) % 7;
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(now.getDate() - day);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return dt >= start && dt < end;
}

export interface MeetingsViewProps {
  clients: BdCustomerRow[];
  onDataChanged?: () => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({ clients, onDataChanged }) => {
  const [rows, setRows] = useState<BdMeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | MeetingStatus>('upcoming');
  const [weekOnly, setWeekOnly] = useState(false);
  const [active, setActive] = useState<BdMeetingRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetchBdMeetings();
    if (res.success) setRows(res.data ?? []);
    else setError(res.error || 'Failed to load meetings');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const closed = r.status === 'closed' || r.status === 'cancelled';
      if (statusFilter === 'upcoming' && closed) return false;
      if (statusFilter !== 'all' && statusFilter !== 'upcoming' && r.status !== statusFilter) return false;
      if (weekOnly && !isThisWeek(r.scheduledFor)) return false;
      if (q && !`${r.code} ${r.client.name} ${r.client.displayCode} ${r.type ?? ''} ${r.mode ?? ''} ${r.assignee.name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter, weekOnly]);

  const upcoming = rows.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length;
  const weekCount = rows.filter((r) => isThisWeek(r.scheduledFor) && r.status !== 'cancelled').length;

  const handleUpdated = (updated: BdMeetingRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    onDataChanged?.();
  };
  const handleCreated = () => { void load(); onDataChanged?.(); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <CalendarClock size={14} className="text-blue-500" />
          <span><b className="text-slate-800">Meetings</b> · {upcoming} active · {weekCount} this week</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"><Plus size={14} /> Request meeting</button>
          <button onClick={() => void load()} title="Refresh" aria-label="Refresh" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meeting, client, type, lead…" aria-label="Search meeting, client, type, lead" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={weekOnly} onChange={(e) => setWeekOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> This week
        </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="upcoming">Active</option>
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{MEETING_STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4"><TableSkeleton rows={6} cols={8} /></div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={() => void load()} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={<CalendarClock />} title={rows.length === 0 ? 'No meetings yet.' : 'No meetings match your filters.'} /></div>
      ) : (
        <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-20 [&_th]:bg-slate-50"><tr className="border-b border-slate-200 bg-slate-50">{HEADERS.map((h) => <th scope="col" key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer transition-colors hover:bg-blue-50/30" onClick={() => setActive(r)}>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-blue-600">{r.code}</td>
                  <td className="px-3 py-2.5"><ClientCell client={r.client} /></td>
                  <td className="px-3 py-2.5"><SourceTag origin={r.origin} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700"><span className="inline-flex items-center gap-1"><Clock size={11} className="text-slate-400" /> {fmtDT(r.scheduledFor)}</span></td>
                  <td className="max-w-[120px] px-3 py-2.5"><p className="truncate text-xs text-slate-700">{r.type || '—'}</p></td>
                  <td className="max-w-[140px] px-3 py-2.5"><p className="truncate text-xs text-slate-500">{r.mode || '—'}</p></td>
                  <td className="max-w-[110px] px-3 py-2.5"><p className="truncate text-xs text-slate-600">{r.assignee.name || '—'}</p></td>
                  <td className="px-3 py-2.5"><StatusPill cfg={MEETING_STATUS_CONFIG[r.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && <MeetingDetailPopup meeting={active} onClose={() => setActive(null)} onUpdated={handleUpdated} />}
      {creating && <NewTxnPopup kind="meeting" clients={clients} onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </div>
  );
};

export default MeetingsView;
