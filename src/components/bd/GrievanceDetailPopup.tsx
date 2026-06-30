/**
 * Grievance detail & lifecycle (§3G). Query lifecycle + severity/category, plus
 * Root Cause and Corrective Action (CAPA) capture. RESOLVED is gated on both
 * root cause and corrective action being present (spec §3G). Light design.
 */
import React, { useState } from 'react';
import { Loader2, Send, ArrowUpRight, CheckCircle2, RotateCcw, Microscope, Wrench } from 'lucide-react';
import { ProcModalShell } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { transitionBdGrievance } from '../../services/bd.service';
import type { BdGrievanceRow } from '../../types/bd.types';
import { GRIEVANCE_STATUS_CONFIG, SEVERITY_CONFIG, formatDMY } from '../../constants/bd';
import { StatusPill, SourceTag, SlaCell, RelatedCell, ReadField } from './bdQueueBits';

const ESCALATION_DEPTS = ['Operations', 'Production', 'Quality', 'Finance / Accounts', 'Logistics', 'Management'];
const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500';

type Mode = null | 'respond' | 'escalate' | 'rootcause' | 'capa' | 'resolve';

export interface GrievanceDetailPopupProps {
  grievance: BdGrievanceRow;
  onClose: () => void;
  onUpdated: (row: BdGrievanceRow) => void;
}

export const GrievanceDetailPopup: React.FC<GrievanceDetailPopupProps> = ({ grievance, onClose, onUpdated }) => {
  const { addToast } = useToast();
  const [row, setRow] = useState<BdGrievanceRow>(grievance);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [dept, setDept] = useState(ESCALATION_DEPTS[0]);
  const [toName, setToName] = useState('');
  const [note, setNote] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [corrective, setCorrective] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const cfg = GRIEVANCE_STATUS_CONFIG[row.status];
  const sevCfg = SEVERITY_CONFIG[row.severity];
  const isClosed = row.status === 'resolved';

  const run = async (body: Parameters<typeof transitionBdGrievance>[1], okMsg: string) => {
    setBusy(true);
    const res = await transitionBdGrievance(row.id, body);
    setBusy(false);
    if (res.success && res.data) {
      setRow(res.data); onUpdated(res.data); setMode(null); setText(''); setNote('');
      addToast('success', okMsg);
    } else addToast('error', res.error || 'Action failed');
  };

  const openResolve = () => {
    setRootCause(row.rootCause || '');
    setCorrective(row.correctiveAction || '');
    setConfirmed(row.customerConfirmed);
    setMode('resolve');
  };
  const submitResolve = () => {
    if (!rootCause.trim() || !corrective.trim()) { addToast('error', 'Root cause and corrective action are required to resolve'); return; }
    void run({ action: 'resolve', rootCause: rootCause.trim(), correctiveAction: corrective.trim(), customerConfirmed: confirmed }, 'Grievance resolved');
  };

  return (
    <ProcModalShell
      eyebrow={`Grievance · ${row.code}`}
      title={<span className="inline-flex items-center gap-2">{row.category || 'Customer Grievance'} <StatusPill cfg={cfg} /></span>}
      subtitle={<span className="inline-flex items-center gap-2 text-xs text-slate-500">{row.client.displayCode} · {row.client.name} <StatusPill cfg={sevCfg} /></span>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        mode ? (
          <>
            <button onClick={() => setMode(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Back</button>
            {mode === 'respond' && <button onClick={() => { if (!text.trim()) { addToast('error', 'Write a response'); return; } run({ action: 'respond', text: text.trim() }, 'Response recorded'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Record response</button>}
            {mode === 'escalate' && <button onClick={() => { if (!dept && !toName.trim()) { addToast('error', 'Pick a dept or person'); return; } run({ action: 'escalate', dept, toName: toName.trim() || null, note: note.trim() || null }, 'Escalated'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} Escalate</button>}
            {mode === 'rootcause' && <button onClick={() => { if (!text.trim()) { addToast('error', 'Describe the root cause'); return; } run({ action: 'root_cause', text: text.trim() }, 'Root cause captured'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Microscope size={14} />} Save root cause</button>}
            {mode === 'capa' && <button onClick={() => { if (!text.trim()) { addToast('error', 'Describe the corrective action'); return; } run({ action: 'capa', text: text.trim() }, 'CAPA initiated'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Save CAPA</button>}
            {mode === 'resolve' && <button onClick={submitResolve} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Resolve</button>}
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {!isClosed && <button onClick={() => { setMode('respond'); setText(row.response || ''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"><Send size={14} /> Respond</button>}
              {!isClosed && <button onClick={() => setMode('escalate')} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"><ArrowUpRight size={14} /> Escalate</button>}
              {!isClosed && <button onClick={() => { setMode('rootcause'); setText(row.rootCause || ''); }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"><Microscope size={14} /> Root cause</button>}
              {!isClosed && <button onClick={() => { setMode('capa'); setText(row.correctiveAction || ''); }} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50"><Wrench size={14} /> CAPA</button>}
            </div>
            <div className="flex gap-2">
              {!isClosed && <button onClick={openResolve} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700"><CheckCircle2 size={14} /> Resolve</button>}
              {isClosed && <button onClick={() => run({ action: 'reopen' }, 'Reopened')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><RotateCcw size={14} /> Reopen</button>}
            </div>
          </div>
        )
      }
    >
      {mode === 'respond' || mode === 'rootcause' || mode === 'capa' ? (
        <div>
          <p className={labelCls}>{mode === 'respond' ? 'Response to customer' : mode === 'rootcause' ? 'Root cause analysis' : 'Corrective & preventive action'}</p>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={7} className={inputCls}
            placeholder={mode === 'respond' ? 'Type the response…' : mode === 'rootcause' ? 'What caused this?' : 'What will be done to fix & prevent recurrence?'} />
        </div>
      ) : mode === 'escalate' ? (
        <div className="space-y-3">
          <label className="block"><span className={labelCls}>Department</span><select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}>{ESCALATION_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          <label className="block"><span className={labelCls}>Person <span className="font-normal normal-case text-slate-400">(optional)</span></span><input value={toName} onChange={(e) => setToName(e.target.value)} className={inputCls} placeholder="Who should handle this?" /></label>
          <label className="block"><span className={labelCls}>Note</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} placeholder="Context for the assignee…" /></label>
        </div>
      ) : mode === 'resolve' ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">Root cause and corrective action are mandatory before a grievance can be resolved.</p>
          <label className="block"><span className={labelCls}>Root cause *</span><textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} className={inputCls} /></label>
          <label className="block"><span className={labelCls}>Corrective action *</span><textarea value={corrective} onChange={(e) => setCorrective(e.target.value)} rows={3} className={inputCls} /></label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Customer has confirmed the resolution</label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ReadField label="Initiated By"><SourceTag origin={row.origin} /></ReadField>
            <ReadField label="Severity"><StatusPill cfg={sevCfg} /></ReadField>
            <ReadField label="SLA"><SlaCell createdAt={row.createdAt} targetHrs={row.slaTargetHours} resolvedAt={row.resolvedAt} /></ReadField>
            <ReadField label="Logged"><span className="text-sm">{formatDMY(row.createdAt)}</span></ReadField>
            <ReadField label="Assignee"><span className="text-sm">{row.assignee.name || '—'}</span></ReadField>
            <ReadField label="Related To"><RelatedCell type={row.relatedType} ref={row.relatedRef} info={row.relatedInfo} /></ReadField>
          </div>
          <ReadField label="Description"><p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{row.description}</p></ReadField>
          {row.escalation && (
            <ReadField label="Escalation"><div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"><b>{row.escalation.dept}</b>{row.escalation.toName ? ` · ${row.escalation.toName}` : ''}{row.escalation.note && <p className="mt-1 whitespace-pre-wrap text-xs text-orange-700">{row.escalation.note}</p>}</div></ReadField>
          )}
          {row.rootCause && <ReadField label="Root Cause"><p className="whitespace-pre-wrap rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-700">{row.rootCause}</p></ReadField>}
          {row.correctiveAction && <ReadField label="Corrective Action (CAPA)"><p className="whitespace-pre-wrap rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-slate-700">{row.correctiveAction}</p></ReadField>}
          {row.response && <ReadField label={`Response${row.respondedAt ? ` · ${formatDMY(row.respondedAt)}` : ''}`}><p className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">{row.response}</p></ReadField>}
          {isClosed && <p className="text-xs text-slate-500">Customer confirmed: <b className={row.customerConfirmed ? 'text-green-600' : 'text-slate-500'}>{row.customerConfirmed ? 'Yes' : 'No'}</b></p>}
        </div>
      )}
    </ProcModalShell>
  );
};

export default GrievanceDetailPopup;
