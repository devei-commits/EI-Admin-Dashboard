/**
 * History & Comments popup — BD spec §3B. Vertical event timeline with event-
 * family filter chips and a manual comment composer (POST /events). Merges
 * stored BD events with read-only derived order/PIS events from the backend.
 * Tool-native ProcModalShell.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Send, Circle } from 'lucide-react';
import { ProcModalShell } from '../procurement/ProcModalShell';
import { useToast } from '../../context/ToastContext';
import { fetchBdTimeline, addBdEvent } from '../../services/bd.service';
import type { BdTimelineEvent } from '../../types/bd.types';
import { EVENT_CONFIG, EVENT_FILTER_CHIPS, TONE_CLASSES, formatDMY, type BdEventType } from '../../constants/bd';

export interface HistoryTimelinePopupProps {
  code: string;
  name?: string;
  onClose: () => void;
}

function eventCfg(type: string) {
  return EVENT_CONFIG[type as BdEventType] ?? { label: type, icon: Circle, tone: 'slate' as const };
}

export const HistoryTimelinePopup: React.FC<HistoryTimelinePopupProps> = ({ code, name, onClose }) => {
  const { addToast } = useToast();
  const [events, setEvents] = useState<BdTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState('all');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetchBdTimeline(code);
    if (res.success) setEvents(res.data ?? []);
    else setError(res.error || 'Failed to load timeline');
    setLoading(false);
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const chosen = EVENT_FILTER_CHIPS.find((c) => c.key === chip);
    if (!chosen || chosen.types.length === 0) return events;
    const set = new Set<string>(chosen.types);
    return events.filter((e) => set.has(e.type));
  }, [events, chip]);

  const postComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    const res = await addBdEvent(code, { type: 'comment', title: 'Comment', body: text });
    setPosting(false);
    if (res.success && res.data) {
      setEvents((prev) => [res.data as BdTimelineEvent, ...prev]);
      setComment('');
      addToast('success', 'Comment added');
    } else {
      addToast('error', res.error || 'Failed to add comment');
    }
  };

  return (
    <ProcModalShell
      eyebrow={`History · ${code}`}
      title={name ? `${name} — Timeline` : 'History & Comments'}
      subtitle={<span className="text-xs text-slate-500">{events.length} events</span>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={postComment} disabled={posting || !comment.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            <Send size={14} /> {posting ? '…' : 'Post'}
          </button>
        </div>
      }
    >
      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EVENT_FILTER_CHIPS.map((c) => {
          const ChipIcon = c.icon;
          return (
            <button key={c.key} onClick={() => setChip(c.key)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${chip === c.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {ChipIcon && <ChipIcon size={11} className="shrink-0" />}
              {c.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={20} className="mr-2 animate-spin text-blue-500" /><span className="text-sm text-slate-500">Loading…</span></div>
      ) : error ? (
        <div className="py-10 text-center"><p className="mb-3 text-sm text-red-500">{error}</p><button onClick={() => void load()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Retry</button></div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">No events in this filter yet.</div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
          {visible.map((e) => {
            const cfg = eventCfg(e.type);
            const tone = TONE_CLASSES[cfg.tone];
            const EventIcon = cfg.icon;
            return (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border ${tone.bg} ${tone.border} ${tone.text}`}><EventIcon size={11} /></span>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{e.title || cfg.label}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatDMY(e.occurredAt)}</span>
                  </div>
                  {e.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{e.body}</p>}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className={`rounded-full border px-1.5 py-0.5 font-semibold ${tone.text} ${tone.bg} ${tone.border}`}>{cfg.label}</span>
                    {e.source === 'auto' && <span className="rounded bg-slate-100 px-1.5 py-0.5">auto</span>}
                    {e.actor && <span>· {e.actor}</span>}
                    {e.refType && <span>· {e.refType} {e.refId}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ProcModalShell>
  );
};
