/**
 * Query detail & lifecycle (§3F). View the record, then Respond (draft / record),
 * Escalate to a dept/person, mark Under Review, Resolve or Reopen. Each action
 * hits POST /queries/:id/transition and reflects the returned row. Light design.
 *
 * Honesty: "Record response" stores the response text and advances status — it
 * does not dispatch an email/WhatsApp (no integration exists). UI says "recorded".
 */
import React, { useState } from 'react';
import { Loader2, Send, FileText, ArrowUpRight, CheckCircle2, RotateCcw, Eye } from 'lucide-react';
import { ProcModalShell } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { transitionBdQuery } from '../../services/bd.service';
import type { BdQueryRow } from '../../types/bd.types';
import { QUERY_STATUS_CONFIG, formatDMY } from '../../constants/bd';
import { StatusPill, SourceTag, SlaCell, RelatedCell, ReadField } from './bdQueueBits';

const ESCALATION_DEPTS = ['Operations', 'Production', 'Quality', 'Finance / Accounts', 'Logistics', 'Management'];
const inputCls = 'mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-ink-3';

type Mode = null | 'respond' | 'escalate';

export interface QueryDetailPopupProps {
  query: BdQueryRow;
  onClose: () => void;
  onUpdated: (row: BdQueryRow) => void;
}

export const QueryDetailPopup: React.FC<QueryDetailPopupProps> = ({ query, onClose, onUpdated }) => {
  const { addToast } = useToast();
  const [row, setRow] = useState<BdQueryRow>(query);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [dept, setDept] = useState(ESCALATION_DEPTS[0]);
  const [toName, setToName] = useState('');
  const [note, setNote] = useState('');

  const cfg = QUERY_STATUS_CONFIG[row.status];
  const isClosed = row.status === 'resolved';

  const run = async (body: Parameters<typeof transitionBdQuery>[1], okMsg: string) => {
    setBusy(true);
    const res = await transitionBdQuery(row.id, body);
    setBusy(false);
    if (res.success && res.data) {
      setRow(res.data); onUpdated(res.data); setMode(null); setText(''); setNote('');
      addToast('success', okMsg);
    } else addToast('error', res.error || 'Action failed');
  };

  const submitRespond = (draft: boolean) => {
    if (!text.trim()) { addToast('error', 'Write a response first'); return; }
    void run({ action: 'respond', text: text.trim(), draft }, draft ? 'Draft saved' : 'Response recorded');
  };
  const submitEscalate = () => {
    if (!dept && !toName.trim()) { addToast('error', 'Pick a department or person'); return; }
    void run({ action: 'escalate', dept, toName: toName.trim() || null, note: note.trim() || null }, 'Escalated');
  };

  return (
    <ProcModalShell
      eyebrow={`Query · ${row.code}`}
      title={<span className="inline-flex items-center gap-2">{row.subject || 'Customer Query'} <StatusPill cfg={cfg} /></span>}
      subtitle={<span className="text-xs text-ink-3">{row.client.displayCode} · {row.client.name}</span>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        mode ? (
          <>
            <button onClick={() => setMode(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface">Back</button>
            {mode === 'respond' && (
              <>
                <button onClick={() => submitRespond(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50"><FileText size={14} /> Save draft</button>
                <button onClick={() => submitRespond(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Record response</button>
              </>
            )}
            {mode === 'escalate' && (
              <button onClick={submitEscalate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-warn px-4 py-2 text-sm font-bold text-white hover:bg-warn disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} Escalate</button>
            )}
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {!isClosed && <button onClick={() => { setMode('respond'); setText(row.response || ''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand"><Send size={14} /> Respond</button>}
              {!isClosed && <button onClick={() => setMode('escalate')} className="inline-flex items-center gap-1.5 rounded-lg border border-warn px-3 py-2 text-sm font-semibold text-warn hover:bg-warn-soft"><ArrowUpRight size={14} /> Escalate</button>}
              {!isClosed && row.status !== 'under_review' && <button onClick={() => run({ action: 'status', status: 'under_review' }, 'Marked under review')} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-3"><Eye size={14} /> Under review</button>}
            </div>
            <div className="flex gap-2">
              {!isClosed && <button onClick={() => run({ action: 'resolve' }, 'Resolved')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-2 text-sm font-bold text-white hover:bg-ok disabled:opacity-50"><CheckCircle2 size={14} /> Resolve</button>}
              {isClosed && <button onClick={() => run({ action: 'reopen' }, 'Reopened')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-err px-3 py-2 text-sm font-semibold text-err hover:bg-err-soft"><RotateCcw size={14} /> Reopen</button>}
            </div>
          </div>
        )
      }
    >
      {mode === 'respond' ? (
        <div>
          <p className={labelCls}>Response to customer</p>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Type the response…" aria-label="Response to customer" className={inputCls} />
          <p className="mt-1 text-[11px] text-ink-4">Stored on the query and logged to the timeline. External send (email/WhatsApp) is not wired — share the text manually.</p>
        </div>
      ) : mode === 'escalate' ? (
        <div className="space-y-3">
          <label className="block"><span className={labelCls}>Department</span>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}>{ESCALATION_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </label>
          <label className="block"><span className={labelCls}>Person <span className="font-normal normal-case text-ink-4">(optional)</span></span>
            <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Who should handle this?" className={inputCls} />
          </label>
          <label className="block"><span className={labelCls}>Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Context for the assignee…" className={inputCls} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ReadField label="Initiated By"><SourceTag origin={row.origin} /></ReadField>
            <ReadField label="Raised"><span className="text-sm">{formatDMY(row.createdAt)}</span></ReadField>
            <ReadField label="SLA"><SlaCell createdAt={row.createdAt} targetHrs={row.slaTargetHours} resolvedAt={row.resolvedAt} /></ReadField>
            <ReadField label="Assignee"><span className="text-sm">{row.assignee.name || '—'}</span></ReadField>
            <ReadField label="Related To"><RelatedCell type={row.relatedType} ref={row.relatedRef} info={row.relatedInfo} /></ReadField>
            <ReadField label="Status"><StatusPill cfg={cfg} /></ReadField>
          </div>
          <ReadField label="Description"><p className="whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink-2">{row.description}</p></ReadField>
          {row.escalation && (
            <ReadField label="Escalation">
              <div className="rounded-lg border border-warn bg-warn-soft p-3 text-sm text-warn">
                <b>{row.escalation.dept}</b>{row.escalation.toName ? ` · ${row.escalation.toName}` : ''}
                {row.escalation.note && <p className="mt-1 whitespace-pre-wrap text-xs text-warn">{row.escalation.note}</p>}
                {row.internalReply && <p className="mt-2 border-t border-warn pt-2 text-xs"><span className="font-semibold">Internal reply:</span> {row.internalReply}</p>}
              </div>
            </ReadField>
          )}
          {row.response && (
            <ReadField label={`Response${row.respondedAt ? ` · ${formatDMY(row.respondedAt)}` : ''}`}>
              <p className="whitespace-pre-wrap rounded-lg border border-brand bg-brand-soft p-3 text-sm text-ink-2">{row.response}</p>
            </ReadField>
          )}
        </div>
      )}
    </ProcModalShell>
  );
};

export default QueryDetailPopup;
