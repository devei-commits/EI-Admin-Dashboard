/**
 * Meeting detail & lifecycle (§3H): Request → Confirm → Attend → MoM → Close,
 * with Reschedule / Assign / Cancel side-paths. MoM capture can schedule the
 * next meeting (writes a next_meeting timeline event). Light design.
 */
import React, { useState } from 'react';
import { Loader2, CheckCircle2, CalendarClock, UserPlus, ClipboardCheck, FileText, XCircle, Clock } from 'lucide-react';
import { ProcModalShell } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { transitionBdMeeting } from '../../services/bd.service';
import type { BdMeetingRow } from '../../types/bd.types';
import { MEETING_STATUS_CONFIG, formatDMY } from '../../constants/bd';
import { StatusPill, SourceTag, ReadField } from './bdQueueBits';

const inputCls = 'mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-ink-3';

function fmtDT(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${formatDMY(d)}, ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}
/** ISO → value for <input type=datetime-local> in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Mode = null | 'reschedule' | 'assign' | 'mom' | 'cancel';

export interface MeetingDetailPopupProps {
  meeting: BdMeetingRow;
  onClose: () => void;
  onUpdated: (row: BdMeetingRow) => void;
}

export const MeetingDetailPopup: React.FC<MeetingDetailPopupProps> = ({ meeting, onClose, onUpdated }) => {
  const { addToast } = useToast();
  const [row, setRow] = useState<BdMeetingRow>(meeting);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState('');
  const [assignee, setAssignee] = useState('');
  const [mom, setMom] = useState('');
  const [nextWhen, setNextWhen] = useState('');
  const [reason, setReason] = useState('');

  const cfg = MEETING_STATUS_CONFIG[row.status];
  const done = row.status === 'closed' || row.status === 'cancelled';

  const run = async (body: Parameters<typeof transitionBdMeeting>[1], okMsg: string) => {
    setBusy(true);
    const res = await transitionBdMeeting(row.id, body);
    setBusy(false);
    if (res.success && res.data) {
      setRow(res.data); onUpdated(res.data); setMode(null);
      addToast('success', okMsg);
    } else addToast('error', res.error || 'Action failed');
  };

  return (
    <ProcModalShell
      eyebrow={`Meeting · ${row.code}`}
      title={<span className="inline-flex items-center gap-2">{row.type || 'Meeting'} <StatusPill cfg={cfg} /></span>}
      subtitle={<span className="text-xs text-ink-3">{row.client.displayCode} · {row.client.name}{row.mode ? ` · ${row.mode}` : ''}</span>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        mode ? (
          <>
            <button onClick={() => setMode(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface">Back</button>
            {mode === 'reschedule' && <button onClick={() => { if (!when) { addToast('error', 'Pick a date/time'); return; } run({ action: 'reschedule', scheduledFor: new Date(when).toISOString() }, 'Rescheduled'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-warn px-4 py-2 text-sm font-bold text-white hover:bg-warn disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />} Reschedule</button>}
            {mode === 'assign' && <button onClick={() => { if (!assignee.trim()) { addToast('error', 'Enter the lead name'); return; } run({ action: 'assign', assigneeName: assignee.trim() }, 'Lead assigned'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign</button>}
            {mode === 'mom' && <button onClick={() => { if (!mom.trim()) { addToast('error', 'Capture the minutes'); return; } run({ action: 'mom', mom: mom.trim(), nextMeetingAt: nextWhen ? new Date(nextWhen).toISOString() : null }, 'MoM captured'); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Save MoM</button>}
            {mode === 'cancel' && <button onClick={() => run({ action: 'cancel', reason: reason.trim() || null }, 'Meeting cancelled')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-err px-4 py-2 text-sm font-bold text-white hover:bg-err disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Confirm cancel</button>}
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(row.status === 'requested' || row.status === 'rescheduled') && <button onClick={() => run({ action: 'confirm' }, 'Confirmed')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white hover:bg-cyan-700"><CheckCircle2 size={14} /> Confirm</button>}
              {!done && (row.status === 'confirmed' || row.status === 'rescheduled') && <button onClick={() => run({ action: 'attended' }, 'Marked attended')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand"><ClipboardCheck size={14} /> Attended</button>}
              {!done && <button onClick={() => { setMom(row.mom || ''); setNextWhen(toLocalInput(row.nextMeetingAt)); setMode('mom'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"><FileText size={14} /> MoM</button>}
              {!done && <button onClick={() => { setWhen(toLocalInput(row.scheduledFor)); setMode('reschedule'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-warn px-3 py-2 text-sm font-semibold text-warn hover:bg-warn-soft"><CalendarClock size={14} /> Reschedule</button>}
              {!done && <button onClick={() => { setAssignee(row.assignee.name || ''); setMode('assign'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-3"><UserPlus size={14} /> Assign</button>}
            </div>
            <div className="flex gap-2">
              {!done && <button onClick={() => run({ action: 'close' }, 'Meeting closed')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-2 text-sm font-bold text-white hover:bg-ok"><CheckCircle2 size={14} /> Close</button>}
              {!done && <button onClick={() => { setReason(''); setMode('cancel'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-err px-3 py-2 text-sm font-semibold text-err hover:bg-err-soft"><XCircle size={14} /> Cancel</button>}
            </div>
          </div>
        )
      }
    >
      {mode === 'reschedule' ? (
        <label className="block"><span className={labelCls}>New date &amp; time</span><input type="datetime-local" autoFocus value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />{row.scheduledFor && <p className="mt-1 text-[11px] text-ink-4">Currently {fmtDT(row.scheduledFor)}</p>}</label>
      ) : mode === 'assign' ? (
        <label className="block"><span className={labelCls}>Attending lead</span><input autoFocus value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Name of the BD lead" className={inputCls} /></label>
      ) : mode === 'cancel' ? (
        <label className="block"><span className={labelCls}>Reason <span className="font-normal normal-case text-ink-4">(optional)</span></span><textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Why is it cancelled?" /></label>
      ) : mode === 'mom' ? (
        <div className="space-y-3">
          <label className="block"><span className={labelCls}>Minutes of meeting</span><textarea autoFocus value={mom} onChange={(e) => setMom(e.target.value)} rows={6} className={inputCls} placeholder="Key discussion points, decisions, action items…" /></label>
          <label className="block"><span className={labelCls}>Schedule next meeting <span className="font-normal normal-case text-ink-4">(optional)</span></span><input type="datetime-local" value={nextWhen} onChange={(e) => setNextWhen(e.target.value)} className={inputCls} /></label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ReadField label="Initiated By"><SourceTag origin={row.origin} /></ReadField>
            <ReadField label="Type"><span className="text-sm">{row.type || '—'}</span></ReadField>
            <ReadField label="Mode"><span className="text-sm">{row.mode || '—'}</span></ReadField>
            <ReadField label="Scheduled"><span className="inline-flex items-center gap-1 text-sm"><Clock size={12} className="text-ink-4" /> {fmtDT(row.scheduledFor)}</span></ReadField>
            <ReadField label="Assignee"><span className="text-sm">{row.assignee.name || '— (Open)'}</span></ReadField>
            <ReadField label="Requested"><span className="text-sm">{formatDMY(row.requestedAt)}</span></ReadField>
          </div>
          {row.oldScheduledFor && <p className="text-[11px] text-warn">Rescheduled from {fmtDT(row.oldScheduledFor)}</p>}
          {row.agenda && <ReadField label="Agenda"><p className="whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink-2">{row.agenda}</p></ReadField>}
          {row.mom && <ReadField label="Minutes of Meeting"><p className="whitespace-pre-wrap rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-ink-2">{row.mom}</p></ReadField>}
          {row.nextMeetingAt && <p className="text-xs text-brand">Next meeting: {fmtDT(row.nextMeetingAt)}</p>}
          {row.cancelReason && <ReadField label="Cancellation Reason"><p className="text-sm text-err">{row.cancelReason}</p></ReadField>}
        </div>
      )}
    </ProcModalShell>
  );
};

export default MeetingDetailPopup;
