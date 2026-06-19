import { useState, useEffect, useRef, useCallback } from 'react';
import eiLogo from '../assets/logo/eilogofull.svg';
import AdminMainMenuButton from '../components/AdminMainMenuButton';
import {
  Users, AlertCircle, Clock, Package, FlaskConical, Calendar,
  TrendingUp, Search, X, ChevronDown, Plus, Phone, Mail,
  Filter, ArrowUpRight, CheckCircle2, Activity,
  BarChart3, FileText, Beaker, ShoppingCart, CalendarDays, Loader2, Save,
} from 'lucide-react';
import {
  fetchClientHubDashboard,
  createClient as apiCreateClient,
  addClientQuery,
  addClientDevelopment,
  addClientOrder,
  addClientAppointment,
  updateClientQuery,
  updateClientDevelopment,
  updateClientOrder,
  type ClientRecord,
  type DashboardKPIs,
} from '../services/clientHub.service';

// ─── TYPES ───────────────────────────────────────────────────────────
interface Query {
  id: string; title: string; status: string; due: string; cat: string; note: string;
}
interface Dev {
  id: string; pr: string; name: string; stage: string; status: string; due: string; phase: string;
}
interface Order {
  id: string; prod: string; qty: string; status: string; due: string; batch: string;
}
interface Appt {
  id: string; title: string; date: string; time: string; type: string; with: string;
}
interface Client {
  id: string; name: string; initials: string; color: string;
  seg: string; priority: 'high' | 'medium' | 'low'; am: string; amId: number | null; rev: string;
  revenueValue: number;
  contacts: string[]; queries: Query[]; devs: Dev[]; orders: Order[]; appts: Appt[];
}

function formatRevenue(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${Math.round(val / 100000)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
}

function formatTotalRevenue(val: number): string {
  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr+`;
  if (val >= 100000) return `${Math.round(val / 100000)}L+`;
  return `₹${val}`;
}

function apiClientToLocal(c: ClientRecord): Client {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    color: c.avatarColor || 'blue',
    seg: c.segment || '',
    priority: c.priority,
    am: c.accountManagerName || '—',
    amId: c.accountManagerId ?? null,
    rev: formatRevenue(c.revenueValue || 0),
    revenueValue: c.revenueValue || 0,
    contacts: (c.contacts || []).map(ct => `${ct.name} (${ct.role})`),
    queries: c.queries,
    devs: c.devs,
    orders: c.orders,
    appts: c.appts,
  };
}

type ViewMode = 'all' | 'overdue' | 'pending' | 'priority' | 'appts';
type SortMode = 'name' | 'overdue' | 'priority' | 'revenue';
type ModalTab = 'overview' | 'queries' | 'devs' | 'orders' | 'appts' | 'timeline';
interface ToastState { msg: string; type: 'success' | 'error' | 'info' | 'warning'; visible: boolean; }

// Data is fetched from the API — see the main component below.

// ─── STYLE MAPS ───────────────────────────────────────────────────────
const AVATAR_BG: Record<string, string> = {
  orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
  teal:   'bg-gradient-to-br from-teal-400 to-emerald-600',
  violet: 'bg-gradient-to-br from-violet-400 to-violet-700',
  red:    'bg-gradient-to-br from-red-400 to-red-600',
  amber:  'bg-gradient-to-br from-amber-400 to-amber-500',
  pink:   'bg-gradient-to-br from-pink-400 to-pink-600',
  blue:   'bg-gradient-to-br from-blue-400 to-blue-700',
  cyan:   'bg-gradient-to-br from-teal-400 to-cyan-600',
};

const STATUS_MAP: Record<string, { cls: string; dot: string; label: string }> = {
  overdue: { cls: 'bg-red-50 text-red-700 border border-red-200',         dot: 'bg-red-500',     label: 'Overdue' },
  pending: { cls: 'bg-amber-50 text-amber-700 border border-amber-200',   dot: 'bg-amber-500',   label: 'Pending' },
  inprog:  { cls: 'bg-blue-50 text-blue-700 border border-blue-200',      dot: 'bg-blue-500',    label: 'In Progress' },
  done:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', label: 'Completed' },
  new:     { cls: 'bg-violet-50 text-violet-700 border border-violet-200', dot: 'bg-violet-500',  label: 'New' },
  sched:   { cls: 'bg-sky-50 text-sky-700 border border-sky-200',         dot: 'bg-sky-500',     label: 'Scheduled' },
};

const PRIORITY_MAP: Record<string, { badge: string; label: string; border: string }> = {
  high:   { badge: 'bg-red-50 text-red-700 border border-red-200',       label: 'HIGH',   border: 'border-l-red-400' },
  medium: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'MED',    border: 'border-l-amber-400' },
  low:    { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'LOW', border: 'border-l-emerald-400' },
};

const CAT_CHIP: Record<string, string> = {
  Q: 'bg-sky-50 text-sky-700 border border-sky-200',
  D: 'bg-violet-50 text-violet-700 border border-violet-200',
  O: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  A: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const COLOR_OPTS = ['orange','teal','violet','red','amber','pink','blue','cyan'];

// ─── HELPERS ──────────────────────────────────────────────────────────
const TODAY = new Date(new Date().toDateString());
const dDiff = (d: string) => Math.round((new Date(d).getTime() - TODAY.getTime()) / 864e5);
const fDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fDay  = (d: string) => new Date(d).getDate();
const fMon  = (d: string) => new Date(d).toLocaleDateString('en-IN', { month: 'short' });
const cOver = (c: Client) => [...c.queries, ...c.devs, ...c.orders].filter(i => i.status === 'overdue').length;
const cPend = (c: Client) => [...c.queries, ...c.devs, ...c.orders].filter(i => i.status === 'pending').length;

// ─── STATUS BADGE ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { cls: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

const EDITABLE_STATUSES = ['new', 'pending', 'inprog', 'done', 'overdue'] as const;

function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const s = STATUS_MAP[value] ?? STATUS_MAP.pending;
  return (
    <select
      value={value}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      className={`appearance-none cursor-pointer px-2.5 py-1 rounded-full text-xs font-semibold border outline-none transition-colors ${s.cls}`}
    >
      {EDITABLE_STATUSES.map(st => (
        <option key={st} value={st}>{STATUS_MAP[st].label}</option>
      ))}
    </select>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────
interface KpiProps { label: string; value: number | string; sub: string; icon: React.ReactNode; color: string; onClick?: () => void; }
function KpiCard({ label, value, sub, icon, color, onClick }: KpiProps) {
  const accent: Record<string, string> = {
    red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500',
    emerald: 'bg-emerald-500', violet: 'bg-violet-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
  };
  const ring: Record<string, string> = {
    red: 'ring-red-200 text-red-600', amber: 'ring-amber-200 text-amber-600', blue: 'ring-blue-200 text-blue-600',
    emerald: 'ring-emerald-200 text-emerald-600', violet: 'ring-violet-200 text-violet-600',
    pink: 'ring-pink-200 text-pink-600', orange: 'ring-orange-200 text-orange-600',
  };
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`h-1 ${accent[color] ?? accent.blue}`} />
      <div className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-white ring-2 flex items-center justify-center shrink-0 ${ring[color] ?? ring.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">{value}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT CARD ──────────────────────────────────────────────────────
function ClientCard({ c, onOpen, idx }: { c: Client; idx: number; onOpen: (id: string, tab?: ModalTab) => void; }) {
  const ov = cOver(c), pe = cPend(c);
  const all = [...c.queries, ...c.devs, ...c.orders];
  const done = all.filter(i => i.status === 'done').length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const avatarBg = AVATAR_BG[c.color] ?? AVATAR_BG.blue;
  const pri = PRIORITY_MAP[c.priority];
  const highTint = c.priority === 'high' ? 'bg-red-50/30' : 'bg-white';

  return (
    <div
      className={`${highTint} rounded-xl border border-l-4 ${pri.border} hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col`}
      onClick={() => onOpen(c.id)}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${avatarBg}`}>
            {c.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800 text-sm truncate">{c.name}</h3>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{c.seg}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-black text-gray-800">{c.rev}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pri.badge}`}>{pri.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {ov > 0 && (
                <span onClick={e => { e.stopPropagation(); onOpen(c.id, 'overview'); }} className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full hover:bg-red-100 transition-colors">
                  <AlertCircle className="w-3 h-3" /> {ov} overdue
                </span>
              )}
              {pe > 0 && (
                <span onClick={e => { e.stopPropagation(); onOpen(c.id, 'overview'); }} className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full hover:bg-amber-100 transition-colors">
                  <Clock className="w-3 h-3" /> {pe} pending
                </span>
              )}
              {!ov && !pe && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> On track
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row — 5 cols including completion % */}
      <div className="grid grid-cols-5 border-t border-gray-100 divide-x divide-gray-100">
        {[
          { n: c.queries.length, lbl: 'Queries', alert: c.queries.some(q => q.status === 'overdue'), tab: 'queries' as ModalTab },
          { n: c.devs.length,    lbl: 'R&D',     alert: c.devs.some(d => d.status === 'overdue'),    tab: 'devs' as ModalTab },
          { n: c.orders.length,  lbl: 'Orders',  alert: c.orders.some(o => o.status === 'overdue'),  tab: 'orders' as ModalTab },
          { n: c.appts.length,   lbl: 'Appts',   alert: false,                                        tab: 'appts' as ModalTab },
          { n: `${pct}%`,        lbl: 'Done',     alert: ov > 0,                                       tab: 'overview' as ModalTab },
        ].map(m => (
          <button
            key={m.tab + m.lbl}
            onClick={e => { e.stopPropagation(); onOpen(c.id, m.tab); }}
            className={`flex flex-col items-center py-2 hover:bg-gray-50 transition-colors group ${m.alert ? 'bg-red-50/40' : ''}`}
          >
            <span className={`text-sm font-bold ${m.alert ? 'text-red-600' : m.lbl === 'Done' ? (pct > 70 ? 'text-emerald-600' : 'text-amber-600') : 'text-gray-700'}`}>{m.n}</span>
            <span className="text-[10px] text-gray-400 group-hover:text-gray-600">{m.lbl}</span>
          </button>
        ))}
      </div>

      {/* Owner Footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-[10px] text-gray-500 font-medium truncate">{c.am}</span>
        </div>
        <span className="text-[10px] text-gray-400 shrink-0">{c.id}</span>
      </div>
    </div>
  );
}

// ─── PANEL ITEM ───────────────────────────────────────────────────────
interface PanelItem {
  id: string; _t: string; status: string; due: string;
  client: string; cid: string; color: string; cat: 'Q' | 'D' | 'O' | 'A'; time?: string;
}

function PanelRow({ item, onClick }: { item: PanelItem; onClick: () => void }) {
  const d = dDiff(item.due);
  const isAppt = item.cat === 'A';
  const catLabels: Record<string, string> = { Q: 'Query', D: 'Dev', O: 'Order', A: 'Appt' };
  const catCls = CAT_CHIP[item.cat] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  const avatarBg = AVATAR_BG[item.color] ?? AVATAR_BG.blue;

  return (
    <div onClick={onClick} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarBg}`}>
        {item.cid.replace('C', '')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-gray-900">{item._t}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium border ${catCls}`}>{catLabels[item.cat]}</span>
          <span className="text-xs text-gray-400 truncate">{item.client}</span>
          {isAppt && item.time && <span className="text-xs text-gray-400">{item.time}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {isAppt ? (
          <span className={`text-xs font-bold ${d === 0 ? 'text-emerald-600' : d < 0 ? 'text-gray-400' : 'text-blue-600'}`}>
            {d === 0 ? 'Today' : d < 0 ? 'Past' : `${d}d`}
          </span>
        ) : (
          <span className={`text-xs font-bold ${d < 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {d < 0 ? `${Math.abs(d)}d late` : `${d}d`}
          </span>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{fDate(item.due)}</p>
      </div>
    </div>
  );
}

// ─── CLIENT MODAL ─────────────────────────────────────────────────────
function ClientModal({ client, initialTab = 'overview', onClose, onToast, onUpdate }: {
  client: Client; initialTab?: ModalTab;
  onClose: () => void;
  onToast: (msg: string, type?: ToastState['type']) => void;
  onUpdate: (updated: Client) => void;
}) {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [showQueryForm, setShowQueryForm] = useState(false);
  const [showDevForm, setShowDevForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [qForm, setQForm] = useState({ title: '', cat: 'Pricing', due: '', note: '' });
  const [dForm, setDForm] = useState({ pr: '', name: '', stage: 'R&D Stage', phase: 'Formula Dev', due: '' });
  const [oForm, setOForm] = useState({ prod: '', qty: '', batch: '', due: '' });
  const [aForm, setAForm] = useState({ title: '', date: '', time: '', type: 'Video Call', with: '' });
  const [statusEdits, setStatusEdits] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  const editStatus = (type: 'q' | 'd' | 'o', id: string, newStatus: string) => {
    setStatusEdits(prev => ({ ...prev, [`${type}_${id}`]: newStatus }));
  };

  const getEditedStatus = (type: 'q' | 'd' | 'o', id: string, original: string) => {
    return statusEdits[`${type}_${id}`] ?? original;
  };

  const isDirty = (type: 'q' | 'd' | 'o', id: string, original: string) => {
    const key = `${type}_${id}`;
    return statusEdits[key] !== undefined && statusEdits[key] !== original;
  };

  const saveStatus = async (type: 'q' | 'd' | 'o', id: string) => {
    const key = `${type}_${id}`;
    const newStatus = statusEdits[key];
    if (!newStatus) return;
    setSavingStatus(prev => ({ ...prev, [key]: true }));
    try {
      if (type === 'q') {
        await updateClientQuery(id, { status: newStatus });
        const updated = { ...client, queries: client.queries.map(q => q.id === id ? { ...q, status: newStatus } : q) };
        onUpdate(updated);
      } else if (type === 'd') {
        await updateClientDevelopment(id, { status: newStatus });
        const updated = { ...client, devs: client.devs.map(d => d.id === id ? { ...d, status: newStatus } : d) };
        onUpdate(updated);
      } else {
        await updateClientOrder(id, { status: newStatus });
        const updated = { ...client, orders: client.orders.map(o => o.id === id ? { ...o, status: newStatus } : o) };
        onUpdate(updated);
      }
      setStatusEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
      onToast('Status updated', 'success');
    } catch { onToast('Failed to update status', 'error'); }
    setSavingStatus(prev => ({ ...prev, [key]: false }));
  };

  const addQuery = async () => {
    if (!qForm.title.trim() || !qForm.due) return;
    try {
      const created = await addClientQuery(client.id, { title: qForm.title.trim(), due: qForm.due, cat: qForm.cat, note: qForm.note });
      const updated = { ...client, queries: [...client.queries, created] };
      onUpdate(updated);
      setQForm({ title: '', cat: 'Pricing', due: '', note: '' });
      setShowQueryForm(false);
      onToast('Query added successfully', 'success');
    } catch { onToast('Failed to add query', 'error'); }
  };
  const addDev = async () => {
    if (!dForm.name.trim() || !dForm.due) return;
    try {
      const pr = dForm.pr || `PR-NEW-${String(client.devs.length + 1).padStart(4, '0')}`;
      const created = await addClientDevelopment(client.id, { name: dForm.name.trim(), pr, stage: dForm.stage, phase: dForm.phase, due: dForm.due });
      const updated = { ...client, devs: [...client.devs, created] };
      onUpdate(updated);
      setDForm({ pr: '', name: '', stage: 'R&D Stage', phase: 'Formula Dev', due: '' });
      setShowDevForm(false);
      onToast('Development added successfully', 'success');
    } catch { onToast('Failed to add development', 'error'); }
  };
  const addOrder = async () => {
    if (!oForm.prod.trim() || !oForm.due) return;
    try {
      const created = await addClientOrder(client.id, { prod: oForm.prod.trim(), qty: oForm.qty || '—', due: oForm.due, batch: oForm.batch || 'TBD' });
      const updated = { ...client, orders: [...client.orders, created] };
      onUpdate(updated);
      setOForm({ prod: '', qty: '', batch: '', due: '' });
      setShowOrderForm(false);
      onToast('Order added successfully', 'success');
    } catch { onToast('Failed to add order', 'error'); }
  };
  const addAppt = async () => {
    if (!aForm.title.trim() || !aForm.date) return;
    try {
      const created = await addClientAppointment(client.id, { title: aForm.title.trim(), date: aForm.date, time: aForm.time || 'TBD', type: aForm.type, with: aForm.with || '—' });
      const updated = { ...client, appts: [...client.appts, created] };
      onUpdate(updated);
      setAForm({ title: '', date: '', time: '', type: 'Video Call', with: '' });
      setShowApptForm(false);
      onToast('Appointment scheduled successfully', 'success');
    } catch { onToast('Failed to add appointment', 'error'); }
  };

  const avatarBg = AVATAR_BG[client.color] ?? AVATAR_BG.blue;
  const pri = PRIORITY_MAP[client.priority];
  const ov = cOver(client), pe = cPend(client);

  const allItems = [
    ...client.queries.map(q => ({ ...q, _tp: 'Q', _t: q.title, tl: 'Query' })),
    ...client.devs.map(d => ({ ...d, _tp: 'D', _t: d.name, tl: 'Dev' })),
    ...client.orders.map(o => ({ ...o, _tp: 'O', _t: o.prod, tl: 'Order' })),
  ];
  const actionItems = allItems.filter(i => ['overdue', 'pending'].includes(i.status))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  const timelineItems = [
    ...client.queries.map(q => ({ date: q.due, title: q.title, meta: `Query · ${q.cat}`, status: q.status })),
    ...client.devs.map(d => ({ date: d.due, title: d.name, meta: `R&D · ${d.stage}`, status: d.status })),
    ...client.orders.map(o => ({ date: o.due, title: o.prod, meta: `Order · ${o.qty}`, status: o.status })),
    ...client.appts.map(a => ({ date: a.date, title: a.title, meta: `Appt · ${a.time} · ${a.type}`, status: 'sched' })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const TABS: { id: ModalTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview',  label: 'Overview',     icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'queries',   label: 'Queries',      icon: <FileText className="w-3.5 h-3.5" />,    badge: client.queries.filter(q => q.status === 'overdue').length },
    { id: 'devs',      label: 'R&D',          icon: <Beaker className="w-3.5 h-3.5" />,      badge: client.devs.filter(d => d.status === 'overdue').length },
    { id: 'orders',    label: 'Orders',       icon: <ShoppingCart className="w-3.5 h-3.5" />, badge: client.orders.filter(o => o.status === 'overdue').length },
    { id: 'appts',     label: 'Appointments', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { id: 'timeline',  label: 'Timeline',     icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100';
  const tdCls = 'px-3 py-2.5 text-sm text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="flex items-center gap-4 p-5 border-b border-gray-100">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 ${avatarBg}`}>
            {client.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-800">{client.name}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pri.badge}`}>{pri.label}</span>
              {ov > 0 && <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" />{ov} overdue</span>}
              {pe > 0 && <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />{pe} pending</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{client.seg} · AM: {client.am} · {client.rev}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {client.contacts.map(ct => (
                <span key={ct} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  <Users className="w-3 h-3" />{ct}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onToast(`Contacting ${client.contacts[0]}`, 'info')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors">
              <Phone className="w-3.5 h-3.5" /> Contact
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-6 border-b border-gray-100 divide-x divide-gray-100">
          {[
            { n: client.queries.length, l: 'Queries', sub: client.queries.filter(q => q.status === 'overdue').length, tab: 'queries' as ModalTab },
            { n: client.devs.length,    l: 'R&D',     sub: client.devs.filter(d => d.status === 'overdue').length,   tab: 'devs' as ModalTab },
            { n: client.orders.length,  l: 'Orders',  sub: client.orders.filter(o => o.status === 'overdue').length,  tab: 'orders' as ModalTab },
            { n: client.appts.length,   l: 'Appts',   sub: 0, tab: 'appts' as ModalTab },
            { n: ov, l: 'Overdue',  sub: 0, tab: 'overview' as ModalTab },
            { n: pe, l: 'Pending',  sub: 0, tab: 'overview' as ModalTab },
          ].map(s => (
            <button key={s.l} onClick={() => setTab(s.tab)} className="flex flex-col items-center py-3 hover:bg-gray-50 transition-colors">
              <span className={`text-xl font-black ${s.l === 'Overdue' && s.n > 0 ? 'text-red-600' : s.l === 'Pending' && s.n > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{s.n}</span>
              <span className="text-xs text-gray-500">{s.l}</span>
              {s.sub > 0 && <span className="text-xs text-red-500 font-semibold mt-0.5">{s.sub} overdue</span>}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors relative ${
                tab === t.id
                  ? 'text-orange-600 bg-orange-50 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.icon}{t.label}
              {t.badge ? <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {actionItems.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Action Required</h3>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{actionItems.length} items</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full">
                      <thead><tr>
                        <th className={thCls}>Type</th><th className={thCls}>Item</th>
                        <th className={thCls}>Due</th><th className={thCls}>Status</th><th className={thCls}>Days</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {actionItems.map(i => {
                          const d = dDiff(i.due);
                          return (
                            <tr key={i.id} onClick={() => setTab(i._tp === 'Q' ? 'queries' : i._tp === 'D' ? 'devs' : 'orders')} className="hover:bg-gray-50 cursor-pointer">
                              <td className={tdCls}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CAT_CHIP[i._tp]}`}>{i.tl}</span></td>
                              <td className={`${tdCls} font-semibold max-w-xs`}>{i._t}</td>
                              <td className={`${tdCls} text-gray-500 font-mono text-xs`}>{fDate(i.due)}</td>
                              <td className={tdCls}><StatusBadge status={i.status} /></td>
                              <td className={`${tdCls} font-bold ${d < 0 ? 'text-red-600' : 'text-amber-600'}`}>{d < 0 ? `${Math.abs(d)}d late` : `${d}d left`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-700 font-medium">All items on track for <strong>{client.name}</strong>. No overdue or pending actions!</p>
                </div>
              )}
              {client.appts.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-blue-500" /> Upcoming Appointments</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {client.appts.map(a => {
                      const d = dDiff(a.date);
                      return (
                        <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm cursor-pointer ${d < 0 ? 'border-gray-200 bg-gray-50' : d === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'}`}
                          onClick={() => onToast(`${a.title} — ${fDate(a.date)}`, 'info')}>
                          <div className={`shrink-0 w-10 text-center p-1 rounded-lg ${d < 0 ? 'bg-gray-100' : d === 0 ? 'bg-blue-100' : 'bg-orange-50'}`}>
                            <div className={`text-lg font-black leading-none ${d < 0 ? 'text-gray-500' : d === 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fDay(a.date)}</div>
                            <div className="text-xs text-gray-500 font-semibold">{fMon(a.date)}</div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{a.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{a.time} · {a.type}</p>
                            <p className="text-xs text-gray-500">with {a.with}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUERIES */}
          {tab === 'queries' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Client Queries ({client.queries.length})</h3>
                <button onClick={() => setShowQueryForm(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showQueryForm ? 'bg-gray-200 text-gray-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                  {showQueryForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showQueryForm ? 'Cancel' : 'Add Query'}
                </button>
              </div>
              {showQueryForm && (
                <div className="mb-4 p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Title *</label>
                      <input value={qForm.title} onChange={e => setQForm(p => ({ ...p, title: e.target.value }))} placeholder="Query subject" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Category</label>
                      <select value={qForm.cat} onChange={e => setQForm(p => ({ ...p, cat: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                        {['Pricing','Regulatory','Technical','New Brief','Capacity','Documentation','Labelling','Packaging'].map(o => <option key={o}>{o}</option>)}
                      </select></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Due Date *</label>
                      <input type="date" value={qForm.due} onChange={e => setQForm(p => ({ ...p, due: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Note</label>
                      <input value={qForm.note} onChange={e => setQForm(p => ({ ...p, note: e.target.value }))} placeholder="Internal note" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowQueryForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={addQuery} disabled={!qForm.title.trim() || !qForm.due} className="px-4 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save Query</button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full">
                  <thead><tr>
                    <th className={thCls}>ID</th><th className={thCls}>Query</th>
                    <th className={thCls}>Category</th><th className={thCls}>Due</th>
                    <th className={thCls}>Status</th><th className={thCls}>Note</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {client.queries.map(q => (
                      <tr key={q.id} className="hover:bg-gray-50 cursor-pointer">
                        <td className={`${tdCls} font-mono text-xs text-gray-500`}>{q.id}</td>
                        <td className={`${tdCls} font-semibold max-w-xs`}>{q.title}</td>
                        <td className={tdCls}><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{q.cat}</span></td>
                        <td className={`${tdCls} font-mono text-xs text-gray-500`}>{fDate(q.due)}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <StatusDropdown value={getEditedStatus('q', q.id, q.status)} onChange={v => editStatus('q', q.id, v)} />
                            {isDirty('q', q.id, q.status) && (
                              <button onClick={e => { e.stopPropagation(); saveStatus('q', q.id); }} disabled={savingStatus[`q_${q.id}`]}
                                className="p-1 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors" title="Save status">
                                {savingStatus[`q_${q.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`${tdCls} text-xs text-gray-500 max-w-xs`}>{q.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* R&D */}
          {tab === 'devs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">R&D Developments ({client.devs.length})</h3>
                <button onClick={() => setShowDevForm(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showDevForm ? 'bg-gray-200 text-gray-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                  {showDevForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showDevForm ? 'Cancel' : 'New Dev'}
                </button>
              </div>
              {showDevForm && (
                <div className="mb-4 p-4 bg-violet-50/50 border border-violet-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Product Name *</label>
                      <input value={dForm.name} onChange={e => setDForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. SPF 30 Sunscreen Lotion" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">PR Code</label>
                      <input value={dForm.pr} onChange={e => setDForm(p => ({ ...p, pr: e.target.value }))} placeholder="Auto-generated if blank" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Stage</label>
                      <select value={dForm.stage} onChange={e => setDForm(p => ({ ...p, stage: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
                        {['Brief','Brief Review','R&D Stage','R&D Closure','Scale-up','Scale-up Trial','BMR Ready'].map(o => <option key={o}>{o}</option>)}
                      </select></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Phase</label>
                      <select value={dForm.phase} onChange={e => setDForm(p => ({ ...p, phase: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
                        {['Concept Stage','Brief Review','Formula Dev','Trial 1','Trial 2','Trial 3','Pilot Batch','Stability Initiated','Formula Lock','PR Preparation','Production Ready','Production Slot','Production'].map(o => <option key={o}>{o}</option>)}
                      </select></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Target Date *</label>
                      <input type="date" value={dForm.due} onChange={e => setDForm(p => ({ ...p, due: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowDevForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={addDev} disabled={!dForm.name.trim() || !dForm.due} className="px-4 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save Development</button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full">
                  <thead><tr>
                    <th className={thCls}>PR Code</th><th className={thCls}>Product</th>
                    <th className={thCls}>Stage</th><th className={thCls}>Phase</th>
                    <th className={thCls}>Due</th><th className={thCls}>Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {client.devs.map(d => {
                      const da = dDiff(d.due);
                      return (
                        <tr key={d.id} className="hover:bg-gray-50 cursor-pointer">
                          <td className={`${tdCls} font-mono text-xs font-bold text-violet-600`}>{d.pr}</td>
                          <td className={`${tdCls} font-semibold`}>{d.name}</td>
                          <td className={tdCls}><span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">{d.stage}</span></td>
                          <td className={`${tdCls} text-xs text-gray-500`}>{d.phase}</td>
                          <td className={`${tdCls} font-mono text-xs ${da < 0 && d.status !== 'done' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{fDate(d.due)}</td>
                          <td className={tdCls}>
                            <div className="flex items-center gap-1.5">
                              <StatusDropdown value={getEditedStatus('d', d.id, d.status)} onChange={v => editStatus('d', d.id, v)} />
                              {isDirty('d', d.id, d.status) && (
                                <button onClick={e => { e.stopPropagation(); saveStatus('d', d.id); }} disabled={savingStatus[`d_${d.id}`]}
                                  className="p-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors" title="Save status">
                                  {savingStatus[`d_${d.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {tab === 'orders' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Production Orders ({client.orders.length})</h3>
                <button onClick={() => setShowOrderForm(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showOrderForm ? 'bg-gray-200 text-gray-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                  {showOrderForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showOrderForm ? 'Cancel' : 'New Order'}
                </button>
              </div>
              {showOrderForm && (
                <div className="mb-4 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Product *</label>
                      <input value={oForm.prod} onChange={e => setOForm(p => ({ ...p, prod: e.target.value }))} placeholder="e.g. SPF 30 Lotion 50g" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Quantity</label>
                      <input value={oForm.qty} onChange={e => setOForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 50,000 units" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Batch No</label>
                      <input value={oForm.batch} onChange={e => setOForm(p => ({ ...p, batch: e.target.value }))} placeholder="TBD if not assigned" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Due Date *</label>
                      <input type="date" value={oForm.due} onChange={e => setOForm(p => ({ ...p, due: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowOrderForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={addOrder} disabled={!oForm.prod.trim() || !oForm.due} className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save Order</button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full">
                  <thead><tr>
                    <th className={thCls}>Order ID</th><th className={thCls}>Product</th>
                    <th className={thCls}>Quantity</th><th className={thCls}>Batch No</th>
                    <th className={thCls}>Due</th><th className={thCls}>Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {client.orders.map(o => {
                      const d = dDiff(o.due);
                      return (
                        <tr key={o.id} className="hover:bg-gray-50 cursor-pointer">
                          <td className={`${tdCls} font-mono text-xs font-bold text-emerald-600`}>{o.id}</td>
                          <td className={`${tdCls} font-semibold`}>{o.prod}</td>
                          <td className={`${tdCls} font-bold text-gray-700`}>{o.qty}</td>
                          <td className={`${tdCls} font-mono text-xs text-gray-500`}>{o.batch}</td>
                          <td className={`${tdCls} font-mono text-xs ${d < 0 && o.status !== 'done' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{fDate(o.due)}</td>
                          <td className={tdCls}>
                            <div className="flex items-center gap-1.5">
                              <StatusDropdown value={getEditedStatus('o', o.id, o.status)} onChange={v => editStatus('o', o.id, v)} />
                              {isDirty('o', o.id, o.status) && (
                                <button onClick={e => { e.stopPropagation(); saveStatus('o', o.id); }} disabled={savingStatus[`o_${o.id}`]}
                                  className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors" title="Save status">
                                  {savingStatus[`o_${o.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === 'appts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Appointments ({client.appts.length})</h3>
                <button onClick={() => setShowApptForm(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showApptForm ? 'bg-gray-200 text-gray-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                  {showApptForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showApptForm ? 'Cancel' : 'Schedule'}
                </button>
              </div>
              {showApptForm && (
                <div className="mb-4 p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Title *</label>
                      <input value={aForm.title} onChange={e => setAForm(p => ({ ...p, title: e.target.value }))} placeholder="Meeting subject" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">With</label>
                      <input value={aForm.with} onChange={e => setAForm(p => ({ ...p, with: e.target.value }))} placeholder="Attendees" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Date *</label>
                      <input type="date" value={aForm.date} onChange={e => setAForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Time</label>
                      <input value={aForm.time} onChange={e => setAForm(p => ({ ...p, time: e.target.value }))} placeholder="e.g. 10:00 AM" className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Type</label>
                      <select value={aForm.type} onChange={e => setAForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white">
                        {['Video Call','In-person','Phone Call','Site Visit'].map(o => <option key={o}>{o}</option>)}
                      </select></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowApptForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={addAppt} disabled={!aForm.title.trim() || !aForm.date} className="px-4 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Schedule Appointment</button>
                  </div>
                </div>
              )}
              {client.appts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {client.appts.map(a => {
                    const d = dDiff(a.date);
                    return (
                      <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${d < 0 ? 'border-gray-200 bg-gray-50' : d === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <div className={`shrink-0 w-12 text-center p-1.5 rounded-xl ${d < 0 ? 'bg-gray-100' : d === 0 ? 'bg-blue-100' : 'bg-orange-50'}`}>
                          <div className={`text-2xl font-black leading-none ${d < 0 ? 'text-gray-500' : d === 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fDay(a.date)}</div>
                          <div className="text-xs text-gray-600 font-bold">{fMon(a.date)}</div>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{a.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{a.time} · {a.type}</p>
                          <p className="text-xs text-gray-500">with {a.with}</p>
                          <div className="mt-2">
                            <StatusBadge status={d < 0 ? 'overdue' : d === 0 ? 'inprog' : 'sched'} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`text-xs font-bold ${d < 0 ? 'text-gray-400' : d === 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {d < 0 ? 'Past' : d === 0 ? 'Today' : `${d}d away`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No appointments scheduled</p>
                </div>
              )}
            </div>
          )}

          {/* TIMELINE */}
          {tab === 'timeline' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Activity Timeline — All Items Chronological</h3>
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-3">
                  {timelineItems.map((i, idx) => {
                    const sm = STATUS_MAP[i.status] ?? STATUS_MAP.pending;
                    return (
                      <div key={idx} className="flex items-start gap-3 pl-8 relative">
                        <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white ${sm.dot}`} />
                        <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-700">{i.title}</p>
                            <StatusBadge status={i.status} />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{fDate(i.date)} · {i.meta}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setTab('appts'); setShowApptForm(true); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors">
              <CalendarDays className="w-3.5 h-3.5" /> Schedule
            </button>
            <button onClick={() => { setTab('queries'); setShowQueryForm(true); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Query
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADD CLIENT MODAL ─────────────────────────────────────────────────
function AddClientModal({ onClose, onAdd, accountManagers }: {
  onClose: () => void;
  onAdd: (c: Client) => void;
  accountManagers: { id: number; name: string }[];
}) {
  const [form, setForm] = useState({ name: '', init: '', seg: '', priority: 'medium', amId: '', rev: '', contact: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.name.trim() && form.init.trim();

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const avatarColor = COLOR_OPTS[Math.floor(Math.random() * COLOR_OPTS.length)];
      const revNum = parseFloat(form.rev.replace(/[^\d.]/g, '')) || 0;
      const revInPaisa = form.rev.toLowerCase().includes('cr') ? revNum * 10000000 : form.rev.toLowerCase().includes('l') ? revNum * 100000 : revNum;
      const selectedAm = accountManagers.find(a => String(a.id) === form.amId);
      const apiResp = await apiCreateClient({
        name: form.name.trim(),
        priority: form.priority,
        segment: form.seg || undefined,
        avatarColor,
        revenueValue: revInPaisa,
        accountManagerId: selectedAm?.id,
        contacts: form.contact ? [{ name: form.contact, role: '' }] : [],
      });
      onAdd(apiClientToLocal(apiResp));
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">New Client</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add a new CDMO client to the hub</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Client Name <span className="text-red-500">*</span></label><input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. LuxGlow Cosmetics" className={inputCls} /></div>
          <div><label className={labelCls}>Initials <span className="text-red-500">*</span></label><input value={form.init} onChange={e => f('init', e.target.value)} placeholder="e.g. LG" maxLength={3} className={inputCls} /></div>
          <div className="col-span-2"><label className={labelCls}>Segment</label><input value={form.seg} onChange={e => f('seg', e.target.value)} placeholder="e.g. Skin Care · Luxury — Since 2026" className={inputCls} /></div>
          <div><label className={labelCls}>Priority</label><select value={form.priority} onChange={e => f('priority', e.target.value)} className={inputCls}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          <div><label className={labelCls}>Account Manager</label><select value={form.amId} onChange={e => f('amId', e.target.value)} className={inputCls}><option value="">Select...</option>{accountManagers.map(am => <option key={am.id} value={am.id}>{am.name}</option>)}</select></div>
          <div><label className={labelCls}>Revenue</label><input value={form.rev} onChange={e => f('rev', e.target.value)} placeholder="e.g. ₹25L" className={inputCls} /></div>
          <div><label className={labelCls}>Primary Contact</label><input value={form.contact} onChange={e => f('contact', e.target.value)} placeholder="e.g. Ravi Sharma (BD Head)" className={inputCls} /></div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!valid || saving} className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Adding...' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────
function Toast({ toast }: { toast: ToastState }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error:   'bg-red-50 border-red-200 text-red-700',
    info:    'bg-sky-50 border-sky-200 text-sky-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4" />,
    error:   <AlertCircle className="w-4 h-4" />,
    info:    <Activity className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />,
  };
  return (
    <div className={`fixed bottom-6 right-6 z-60 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-semibold transition-all duration-300 max-w-sm ${styles[toast.type]} ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
      {icons[toast.type]}<span>{toast.msg}</span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
const ClientHub = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('all');
  const [segFilter, setSegFilter] = useState<string | null>(null);
  const [amFilter, setAmFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [activeClient, setActiveClient] = useState<{ client: Client; tab: ModalTab } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({ msg: '', type: 'info', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClientHubDashboard();
      setClients(data.clients.map(apiClientToLocal));
      setKpis(data.kpis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client hub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const showToast = useCallback((msg: string, type: ToastState['type'] = 'info') => {
    setToast({ msg, type, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 3500);
  }, []);

  const openClient = (id: string, tab: ModalTab = 'overview') => {
    const c = clients.find(x => x.id === id);
    if (c) setActiveClient({ client: c, tab });
  };

  const updateClient = useCallback((updated: Client) => {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    setActiveClient(prev => prev && prev.client.id === updated.id ? { ...prev, client: updated } : prev);
  }, []);

  const exportClients = () => {
    const headers = ['ID','Name','Segment','Priority','Account Manager','Revenue','Queries','R&D','Orders','Appts','Overdue','Pending'];
    const rows = filteredClients.map(c => [
      c.id, c.name, c.seg.replace(/,/g, ';'), c.priority, c.am, c.rev,
      c.queries.length, c.devs.length, c.orders.length, c.appts.length, cOver(c), cPend(c)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `client-hub-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`Exported ${filteredClients.length} clients to CSV`, 'success');
  };

  const clearFilters = () => { setView('all'); setSegFilter(null); setAmFilter(null); setSearch(''); setSort('name'); };

  // Filtered clients
  const filteredClients = (() => {
    let list = [...clients];
    if (view === 'overdue')  list = list.filter(c => cOver(c) > 0);
    else if (view === 'pending')  list = list.filter(c => cPend(c) > 0);
    else if (view === 'priority') list = list.filter(c => c.priority === 'high');
    else if (view === 'appts')    list = list.filter(c => c.appts.length > 0);
    if (segFilter) list = list.filter(c => c.seg.toLowerCase().includes(segFilter));
    if (amFilter)  list = list.filter(c => c.am === amFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || c.seg.toLowerCase().includes(q) || c.am.toLowerCase().includes(q) ||
        c.devs.some(d => d.name.toLowerCase().includes(q) || d.pr.toLowerCase().includes(q)) ||
        c.orders.some(o => o.prod.toLowerCase().includes(q)) ||
        c.queries.some(r => r.title.toLowerCase().includes(q))
      );
    }
    if (sort === 'overdue')  list.sort((a, b) => cOver(b) - cOver(a));
    else if (sort === 'priority') list.sort((a, b) => ['high','medium','low'].indexOf(a.priority) - ['high','medium','low'].indexOf(b.priority));
    else if (sort === 'revenue')  list.sort((a, b) => b.revenueValue - a.revenueValue);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  })();

  // Aggregates
  const totalOv    = clients.reduce((n, c) => n + cOver(c), 0);
  const totalPe    = clients.reduce((n, c) => n + cPend(c), 0);
  const totalOrds  = clients.reduce((n, c) => n + c.orders.filter(o => ['inprog','pending'].includes(o.status)).length, 0);
  const totalDevs  = clients.reduce((n, c) => n + c.devs.length, 0);
  const totalAppts = clients.reduce((n, c) => n + c.appts.length, 0);
  const highPri    = clients.filter(c => c.priority === 'high').length;

  // Panel data
  const panelOverdue: PanelItem[] = [];
  const panelPending: PanelItem[] = [];
  const panelAppts: PanelItem[]   = [];
  clients.forEach(c => {
    c.queries.filter(i => i.status === 'overdue').forEach(i => panelOverdue.push({ ...i, _t: i.title, client: c.name, cid: c.id, color: c.color, cat: 'Q' }));
    c.devs.filter(i => i.status === 'overdue').forEach(i => panelOverdue.push({ ...i, _t: i.name,  client: c.name, cid: c.id, color: c.color, cat: 'D' }));
    c.orders.filter(i => i.status === 'overdue').forEach(i => panelOverdue.push({ ...i, _t: i.prod, client: c.name, cid: c.id, color: c.color, cat: 'O' }));
    c.queries.filter(i => i.status === 'pending').forEach(i => panelPending.push({ ...i, _t: i.title, client: c.name, cid: c.id, color: c.color, cat: 'Q' }));
    c.devs.filter(i => i.status === 'pending').forEach(i => panelPending.push({ ...i, _t: i.name,  client: c.name, cid: c.id, color: c.color, cat: 'D' }));
    c.orders.filter(i => i.status === 'pending').forEach(i => panelPending.push({ ...i, _t: i.prod, client: c.name, cid: c.id, color: c.color, cat: 'O' }));
    c.appts.forEach(a => panelAppts.push({ id: a.id, _t: a.title, status: 'sched', due: a.date, client: c.name, cid: c.id, color: c.color, cat: 'A', time: a.time }));
  });
  panelOverdue.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  panelPending.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  panelAppts.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  const SidebarBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${active ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
    >
      {children}
    </button>
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3 font-medium">Loading Client Hub...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-screen bg-gray-50 items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-gray-700 mt-3">Failed to load Client Hub</p>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
          <button onClick={loadDashboard} className="mt-4 px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* ── INNER SIDEBAR ── */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          <AdminMainMenuButton />
          <img src={eiLogo} alt="Eisthetic" className="h-6 w-auto mx-auto" />
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {/* Segment chips */}
          <div className="px-2 pt-2 pb-1">
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">By Segment</p>
              <div className="flex flex-wrap gap-1">
                {(['Skin Care','Hair Care','Sun Care','Men\'s Care','Body Care'] as const).map(seg => {
                  const key = seg.toLowerCase() as typeof segFilter;
                  const active = segFilter === key;
                  const count = clients.filter(c => c.seg.toLowerCase().includes(key ?? '')).length;
                  return (
                    <button key={seg} onClick={() => { setSegFilter(active ? null : key); setAmFilter(null); setView('all'); }}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                        active ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                      }`}>
                      {seg}
                      <span className={`text-[9px] font-bold px-1 py-px rounded-full ${active ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider px-2 py-1.5 mt-2">Account Managers</p>
          {[...new Set(clients.map(c => c.am).filter(Boolean))].map(am => {
            const amCount = clients.filter(c => c.am === am).length;
            return (
              <SidebarBtn key={am} active={amFilter === am} onClick={() => { setAmFilter(am); setSegFilter(null); setView('all'); showToast(`Filtered: ${am}'s clients`, 'info'); }}>
                <Users className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate flex-1">{am.split(' ')[0]}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${amFilter === am ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>{amCount}</span>
              </SidebarBtn>
            );
          })}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="p-5 space-y-5">

          {/* Page Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Active filter breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-semibold text-gray-700">Clients</span>
              {view !== 'all' && <><span>/</span><span className="font-semibold text-orange-600 capitalize">{view}</span></>}
              {segFilter && <><span>/</span><span className="font-semibold text-orange-600 capitalize">{segFilter}</span></>}
              {amFilter && <><span>/</span><span className="font-semibold text-orange-600">{amFilter}</span></>}
              <span className="text-gray-300">|</span>
              <span>{filteredClients.length} of {clients.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={sort} onChange={e => setSort(e.target.value as SortMode)} className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="name">Name</option>
                <option value="overdue">Overdue</option>
                <option value="priority">Priority</option>
                <option value="revenue">Revenue</option>
              </select>
              <button onClick={exportClients} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5" /> New Client
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <KpiCard label="Overdue Items"   value={totalOv}    sub="Need immediate action"  icon={<AlertCircle className="w-4 h-4" />} color="red"     onClick={() => setView('overdue')} />
            <KpiCard label="Pending Actions" value={totalPe}    sub="Awaiting follow-up"     icon={<Clock className="w-4 h-4" />}       color="amber"   onClick={() => setView('pending')} />
            <KpiCard label="Active Clients"  value={clients.length} sub={`${highPri} high priority`} icon={<Users className="w-4 h-4" />}  color="blue"    onClick={() => setView('all')} />
            <KpiCard label="Active Orders"   value={totalOrds}  sub="In production / pending" icon={<Package className="w-4 h-4" />}    color="emerald" />
            <KpiCard label="R&D Pipelines"   value={totalDevs}  sub="Across all clients"     icon={<FlaskConical className="w-4 h-4" />} color="violet" />
            <KpiCard label="Appointments"    value={totalAppts} sub="Upcoming scheduled"     icon={<Calendar className="w-4 h-4" />}    color="pink"    onClick={() => setView('appts')} />
            <KpiCard label="Portfolio Rev"   value={formatTotalRevenue(kpis?.totalRevenue ?? clients.reduce((s, c) => s + c.revenueValue, 0))} sub="Combined client value"  icon={<TrendingUp className="w-4 h-4" />}  color="orange" />
          </div>

          {/* Overdue Alert Strip */}
          {totalOv > 0 && (
            <div
              onClick={() => setView('overdue')}
              className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg py-2 px-4 cursor-pointer hover:bg-red-100/80 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-700">{totalOv} overdue</span>
              <span className="text-[10px] text-red-400 truncate">{clients.filter(c => cOver(c) > 0).map(c => c.name).join(' \u00B7 ')}</span>
              <ArrowUpRight className="w-3 h-3 text-red-400 shrink-0 ml-auto" />
            </div>
          )}

          {/* Filter Bar */}
          <div className="space-y-2">
            {/* Search Row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients, products, PR codes…"
                className="w-full pl-10 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            {/* Segmented Control + Filter Chip */}
            <div className="flex items-center gap-2">
              <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                {([
                  { id: 'all',      label: 'All',       count: clients.length },
                  { id: 'overdue',  label: 'Overdue',   count: clients.filter(c => cOver(c) > 0).length },
                  { id: 'pending',  label: 'Pending',   count: clients.filter(c => cPend(c) > 0).length },
                  { id: 'priority', label: 'High Pri',  count: highPri },
                  { id: 'appts',    label: 'Appts',     count: clients.filter(c => c.appts.length > 0).length },
                ] as { id: ViewMode; label: string; count: number }[]).map(ch => {
                  const isActive = ch.id === 'all' ? (view === 'all' && !segFilter && !amFilter) : view === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => { setView(ch.id); setSegFilter(null); setAmFilter(null); }}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${isActive ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {ch.label}{ch.id !== 'all' && ch.count > 0 && <span className="ml-1 text-[9px] opacity-60">{ch.count}</span>}
                    </button>
                  );
                })}
              </div>
              {(segFilter || amFilter) && (
                <button onClick={() => { setSegFilter(null); setAmFilter(null); }}
                  className="flex items-center gap-1 text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded-full hover:bg-orange-100 transition-colors">
                  <Filter className="w-3 h-3" />
                  <span className="capitalize">{segFilter || amFilter}</span>
                  <X className="w-3 h-3 ml-0.5 opacity-60" />
                </button>
              )}
              {(search || segFilter || amFilter || view !== 'all') && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors ml-auto">
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Client Cards Grid */}
          {filteredClients.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-600">No clients match your filters</p>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">Try searching for &ldquo;Skin Care&rdquo;, a client name like &ldquo;Luminos&rdquo;, or a PR code like &ldquo;PR-SUN-0042&rdquo;</p>
              <button onClick={clearFilters} className="mt-4 px-4 py-2 text-xs font-semibold bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors">
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredClients.map((c, i) => (
                <ClientCard key={c.id} c={c} idx={i} onOpen={openClient} />
              ))}
            </div>
          )}

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overdue Panel */}
            <div className="bg-white rounded-xl border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Overdue Items</h3>
                <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">{panelOverdue.length}</span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto max-h-72">
                {panelOverdue.length > 0
                  ? panelOverdue.map(item => <PanelRow key={item.id + item.cat} item={item} onClick={() => openClient(item.cid, 'overview')} />)
                  : <div className="flex flex-col items-center justify-center py-10 text-gray-400"><CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" /><p className="text-sm font-semibold">All clear!</p></div>
                }
              </div>
            </div>

            {/* Pending Panel */}
            <div className="bg-white rounded-xl border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Pending This Week</h3>
                <span className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-200">{panelPending.length}</span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto max-h-72">
                {panelPending.length > 0
                  ? panelPending.map(item => <PanelRow key={item.id + item.cat} item={item} onClick={() => openClient(item.cid, 'overview')} />)
                  : <div className="flex flex-col items-center justify-center py-10 text-gray-400"><CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" /><p className="text-sm font-semibold">All caught up!</p></div>
                }
              </div>
            </div>

            {/* Today's Schedule Panel */}
            <div className="bg-white rounded-xl border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> Today&apos;s Schedule</h3>
                <span className="text-xs bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-200">{panelAppts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-72">
                {panelAppts.length > 0 ? panelAppts.slice(0, 10).map((item, i) => (
                  <div key={item.id} onClick={() => openClient(item.cid, 'appts')} className="flex gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                    {/* Timeline rail */}
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-blue-100 shrink-0 mt-1" />
                      {i < Math.min(panelAppts.length, 10) - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-600">{item.time || fDate(item.due)}</span>
                        <span className={`text-[9px] font-bold px-1 py-px rounded ${CAT_CHIP[item.cat]}`}>{item.cat}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-gray-900">{item._t}</p>
                      <p className="text-[10px] text-gray-400 truncate">{item.client}</p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Calendar className="w-8 h-8 mb-2 text-blue-300" />
                    <p className="text-xs font-semibold">No appointments today</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeClient && (
        <ClientModal
          client={activeClient.client}
          initialTab={activeClient.tab}
          onClose={() => setActiveClient(null)}
          onToast={showToast}
          onUpdate={updateClient}
        />
      )}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onAdd={(c) => { setClients(p => [...p, c]); showToast(`${c.name} added to Client Hub!`, 'success'); }}
          accountManagers={[...new Map(clients.filter(c => c.am && c.am !== '—' && c.amId).map(c => [c.am, { id: c.amId!, name: c.am }])).values()]}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
};

export default ClientHub;
