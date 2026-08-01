/**
 * Customer Detail popup — BD spec §3A. KPI tiles + account info + an editable
 * BD-profile block (tier / lifecycle / credit / onboarded / notes → PUT profile).
 * Reuses the tool-native ProcModalShell. Initiate-action buttons (meeting/query/
 * grievance) and the History button hand off to the parent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BookText, CalendarPlus, HelpCircle, Flag } from 'lucide-react';
import { CardSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { ProcModalShell, ModalSection } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { fetchBdCustomerDetail, updateBdProfile } from '../../services/bd.service';
import type { BdCustomerDetail, BdProfilePatch } from '../../types/bd.types';
import type { TrackerAction } from './CustomerTrackerView';
import {
  TIER_CONFIG, TIER_ORDER, LIFECYCLE_CONFIG, formatINRCompact, formatDMY,
  type ClientTier, type ClientLifecycle,
} from '../../constants/bd';

export interface CustomerDetailPopupProps {
  code: string;
  onClose: () => void;
  onOpenTimeline: (code: string) => void;
  onAction: (action: TrackerAction, code: string, name: string) => void;
  onSaved?: () => void;
}

function Kpi({ label, value, tone = 'slate', sub }: { label: string; value: string; tone?: string; sub?: string }) {
  const toneClass: Record<string, string> = {
    slate: 'text-ink', green: 'text-ok', red: 'text-err',
    blue: 'text-brand', violet: 'text-violet-600', amber: 'text-warn',
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneClass[tone] ?? toneClass.slate}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-4">{sub}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">{label}</p>
      <p className="text-sm text-ink-2">{value || '—'}</p>
    </div>
  );
}

export const CustomerDetailPopup: React.FC<CustomerDetailPopupProps> = ({ code, onClose, onOpenTimeline, onAction, onSaved }) => {
  const { addToast } = useToast();
  const [detail, setDetail] = useState<BdCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // editable profile fields
  const [tier, setTier] = useState<ClientTier | ''>('');
  const [lifecycle, setLifecycle] = useState<ClientLifecycle | ''>('');
  const [creditLimit, setCreditLimit] = useState('');
  const [onboardedDate, setOnboardedDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetchBdCustomerDetail(code);
    if (res.success && res.data) {
      const d = res.data;
      setDetail(d);
      setTier(d.tierSource === 'manual' ? d.tier : '');
      setLifecycle(d.lifecycleSource === 'manual' ? d.lifecycle : '');
      setCreditLimit(d.creditLimit != null ? String(d.creditLimit) : '');
      setOnboardedDate(d.onboardedDate ? String(d.onboardedDate).slice(0, 10) : '');
      setNotes(d.notes ?? '');
    } else {
      setError(res.error || 'Failed to load customer');
    }
    setLoading(false);
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const patch: BdProfilePatch = {
      tier: tier || null,
      lifecycle: lifecycle || null,
      creditLimit: creditLimit !== '' ? Number(creditLimit) : null,
      onboardedDate: onboardedDate || null,
      notes: notes || null,
    };
    const res = await updateBdProfile(code, patch);
    setSaving(false);
    if (res.success) {
      addToast('success', 'BD profile updated');
      if (res.data) setDetail(res.data);
      onSaved?.();
    } else {
      addToast('error', res.error || 'Failed to update profile');
    }
  };

  const tierCfg = detail ? (TIER_CONFIG[detail.tier] ?? TIER_CONFIG.bronze) : null;
  const lifeCfg = detail ? (LIFECYCLE_CONFIG[detail.lifecycle] ?? LIFECYCLE_CONFIG.active) : null;

  return (
    <ProcModalShell
      eyebrow={`Customer · ${detail?.displayCode ?? code}`}
      title={detail?.name ?? 'Customer'}
      subtitle={tierCfg && lifeCfg ? (
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${tierCfg.text} ${tierCfg.bg} ${tierCfg.border}`}><tierCfg.icon size={11} className="shrink-0" /> {tierCfg.label}</span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${lifeCfg.text} ${lifeCfg.bg} ${lifeCfg.border}`}>{lifeCfg.label}</span>
        </span>
      ) : undefined}
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between">
          <button onClick={() => onOpenTimeline(code)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface">
            <BookText size={14} /> History & Comments
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface">Close</button>
            <button onClick={save} disabled={saving || loading} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand disabled:opacity-50">
              {saving ? 'Saving…' : 'Save BD Profile'}
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : error || !detail ? (
        <ErrorState message={error || 'Not found'} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="CLV (lifetime)" value={formatINRCompact(detail.clv)} tone="violet" />
            <Kpi label="Receivable" value={formatINRCompact(detail.receivable)} tone={(detail.overdue ?? 0) > 0 ? 'red' : 'slate'} sub={(detail.overdue ?? 0) > 0 ? 'has overdue' : undefined} />
            <Kpi label="Advances" value={formatINRCompact(detail.advances)} tone="green" />
            <Kpi label="Products Customized" value={`${detail.productsCustomized.total}`} sub={`${detail.productsCustomized.active} active`} />
            <Kpi label="Open Orders" value={`${detail.orders.open}`} tone="blue" sub={`${detail.orders.ytd} YTD`} />
            <Kpi label="In-flight PIS" value={`${detail.pis.inFlight}`} tone="violet" sub={`${detail.pis.total} total`} />
            <Kpi label="Open Queries" value={`${detail.queries.open}`} tone="amber" sub={detail.queries.breached > 0 ? `${detail.queries.breached} breached` : undefined} />
            <Kpi label="Grievances" value={`${detail.grievances.open}`} tone="red" />
          </div>

          {/* Account info */}
          <ModalSection title="Account information">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Info label="Entity Code" value={<span className="font-mono">{detail.code}</span>} />
              <Info label="Category" value={detail.category} />
              <Info label="Segment" value={detail.segment} />
              <Info label="GSTIN" value={detail.gstin ? <span className="font-mono">{detail.gstin}</span> : '—'} />
              <Info label="Payment Terms" value={detail.paymentTerms} />
              <Info label="Last Order" value={detail.lastOrderDate ? `${formatDMY(detail.lastOrderDate)}${detail.daysSinceLastSO != null ? ` (${detail.daysSinceLastSO}d ago)` : ''}` : '—'} />
              <Info label="Primary Contact" value={detail.primaryContact ? `${detail.primaryContact.name ?? '—'}${detail.primaryContact.phone ? ` · ${detail.primaryContact.phone}` : ''}` : (detail.phone || '—')} />
              <Info label="Email" value={detail.email} />
              <Info label="Billing Address" value={detail.billingAddress} />
            </div>
          </ModalSection>

          {/* BD profile (editable) */}
          <ModalSection title="BD profile">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">Tier (override)</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as ClientTier | '')} className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">Auto ({TIER_CONFIG[detail.tier].label})</option>
                  {TIER_ORDER.map((t) => <option key={t} value={t}>{TIER_CONFIG[t].label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">Lifecycle (override)</span>
                <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as ClientLifecycle | '')} className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">Auto ({LIFECYCLE_CONFIG[detail.lifecycle].label})</option>
                  {(Object.keys(LIFECYCLE_CONFIG) as ClientLifecycle[]).map((l) => <option key={l} value={l}>{LIFECYCLE_CONFIG[l].label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">Credit Limit (₹)</span>
                <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="—" className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">Onboarded Date</span>
                <input type="date" value={onboardedDate} onChange={(e) => setOnboardedDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
              <Info label="BD POC" value={detail.bdPoc.name} />
            </div>
            <label className="mt-3 block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-4">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
            </label>
          </ModalSection>

          {/* Initiate actions */}
          <ModalSection title="Initiate">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onAction('meeting', code, detail.name)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"><CalendarPlus size={14} /> Meeting</button>
              <button onClick={() => onAction('query', code, detail.name)} className="inline-flex items-center gap-1.5 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-sm font-semibold text-warn hover:bg-warn-soft"><HelpCircle size={14} /> Query</button>
              <button onClick={() => onAction('grievance', code, detail.name)} className="inline-flex items-center gap-1.5 rounded-lg border border-err bg-err-soft px-3 py-2 text-sm font-semibold text-err hover:bg-err-soft"><Flag size={14} /> Grievance</button>
            </div>
          </ModalSection>
        </div>
      )}
    </ProcModalShell>
  );
};
