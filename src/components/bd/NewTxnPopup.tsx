/**
 * NewTxnPopup — create a Query (§3F), Grievance (§3G) or Meeting (§3H) for a
 * client. Used by the Customer Tracker action buttons (preset client) and the
 * queue "New" buttons (client picker). Light ProcModalShell, lucide icons.
 */
import React, { useMemo, useState } from 'react';
import { HelpCircle, Flag, CalendarPlus, Loader2 } from 'lucide-react';
import { ProcModalShell } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { createBdQuery, createBdGrievance, createBdMeeting } from '../../services/bd.service';
import type { BdCustomerRow } from '../../types/bd.types';
import {
  SOURCE_CONFIG, SEVERITY_CONFIG, QG_CATEGORIES, QG_RELATED_TYPES,
  MEETING_MODES, MEETING_TYPES, type BdSource, type GrievanceSeverity,
} from '../../constants/bd';

export type TxnKind = 'query' | 'grievance' | 'meeting';

export interface NewTxnPopupProps {
  kind: TxnKind;
  clients: BdCustomerRow[];
  presetClient?: { code: string; name: string };
  onClose: () => void;
  onCreated: () => void;
}

const KIND_META: Record<TxnKind, { title: string; icon: typeof HelpCircle; verb: string }> = {
  query:     { title: 'Raise Query',     icon: HelpCircle,   verb: 'Create query' },
  grievance: { title: 'Log Grievance',   icon: Flag,         verb: 'Log grievance' },
  meeting:   { title: 'Request Meeting', icon: CalendarPlus, verb: 'Create meeting' },
};

const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500';
const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export const NewTxnPopup: React.FC<NewTxnPopupProps> = ({ kind, clients, presetClient, onClose, onCreated }) => {
  const { addToast } = useToast();
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  const [clientCode, setClientCode] = useState(presetClient?.code ?? '');
  const [origin, setOrigin] = useState<BdSource>('customer');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [relatedType, setRelatedType] = useState<string>('None');
  const [relatedRef, setRelatedRef] = useState('');
  const [category, setCategory] = useState<string>(QG_CATEGORIES[0]);
  const [severity, setSeverity] = useState<GrievanceSeverity>('medium');
  // meeting fields
  const [scheduledFor, setScheduledFor] = useState('');
  const [mode, setMode] = useState<string>(MEETING_MODES[0]);
  const [type, setType] = useState<string>(MEETING_TYPES[0]);
  const [agenda, setAgenda] = useState('');

  const [saving, setSaving] = useState(false);

  const clientName = useMemo(
    () => presetClient?.name || clients.find((c) => c.code === clientCode)?.name || '',
    [presetClient, clients, clientCode],
  );

  const submit = async () => {
    if (!clientCode) { addToast('error', 'Select a client'); return; }
    if (kind !== 'meeting' && !description.trim()) { addToast('error', 'Description is required'); return; }
    setSaving(true);
    const related = relatedType !== 'None' ? { relatedType, relatedRef: relatedRef.trim() || null } : {};
    let ok = false; let err = 'Failed to create';
    if (kind === 'query') {
      const res = await createBdQuery(clientCode, { origin, subject: subject.trim() || null, description: description.trim(), ...related });
      ok = res.success; err = res.error || err;
    } else if (kind === 'grievance') {
      const res = await createBdGrievance(clientCode, { origin, severity, category, description: description.trim(), ...related });
      ok = res.success; err = res.error || err;
    } else {
      const res = await createBdMeeting(clientCode, {
        origin, mode, type, agenda: agenda.trim() || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        ...related,
      });
      ok = res.success; err = res.error || err;
    }
    setSaving(false);
    if (ok) { addToast('success', `${meta.title} — done`); onCreated(); onClose(); }
    else addToast('error', err);
  };

  return (
    <ProcModalShell
      eyebrow={presetClient ? `${presetClient.name}` : 'BD'}
      title={<span className="inline-flex items-center gap-2"><Icon size={18} className="text-blue-600" /> {meta.title}</span>}
      subtitle={clientName ? <span className="text-xs text-slate-500">For {clientName}</span> : undefined}
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {meta.verb}
          </button>
        </>
      }
    >
      {/* Client + origin */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Client</span>
          {presetClient ? (
            <input value={presetClient.name} disabled className={`${inputCls} bg-slate-50 text-slate-500`} />
          ) : (
            <select value={clientCode} onChange={(e) => setClientCode(e.target.value)} className={inputCls}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.code} value={c.code}>{c.displayCode} · {c.name}</option>)}
            </select>
          )}
        </label>
        <label className="block">
          <span className={labelCls}>Initiated By</span>
          <select value={origin} onChange={(e) => setOrigin(e.target.value as BdSource)} className={inputCls}>
            {(Object.keys(SOURCE_CONFIG) as BdSource[]).map((s) => <option key={s} value={s}>{SOURCE_CONFIG[s].label}</option>)}
          </select>
        </label>
      </div>

      {/* Grievance: severity + category */}
      {kind === 'grievance' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as GrievanceSeverity)} className={inputCls}>
              {(Object.keys(SEVERITY_CONFIG) as GrievanceSeverity[]).map((s) => <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {QG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Meeting: type / mode / schedule */}
      {kind === 'meeting' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                {MEETING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Proposed Date &amp; Time <span className="font-normal normal-case text-slate-400">(optional)</span></span>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={inputCls} />
          </label>
        </>
      )}

      {/* Query: subject */}
      {kind === 'query' && (
        <label className="block">
          <span className={labelCls}>Subject <span className="font-normal normal-case text-slate-400">(optional)</span></span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short headline" className={inputCls} />
        </label>
      )}

      {/* Related To */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Related To</span>
          <select value={relatedType} onChange={(e) => setRelatedType(e.target.value)} className={inputCls}>
            {QG_RELATED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {relatedType !== 'None' && (
          <label className="block">
            <span className={labelCls}>Reference</span>
            <input value={relatedRef} onChange={(e) => setRelatedRef(e.target.value)} placeholder="e.g. SO-1024" className={inputCls} />
          </label>
        )}
      </div>

      {/* Description / agenda */}
      <label className="block">
        <span className={labelCls}>{kind === 'meeting' ? 'Agenda' : 'Description'}{kind !== 'meeting' && ' *'}</span>
        <textarea
          value={kind === 'meeting' ? agenda : description}
          onChange={(e) => (kind === 'meeting' ? setAgenda(e.target.value) : setDescription(e.target.value))}
          rows={4}
          placeholder={kind === 'meeting' ? 'What will be discussed…' : 'Describe the issue or question…'}
          className={inputCls}
        />
      </label>
    </ProcModalShell>
  );
};

export default NewTxnPopup;
