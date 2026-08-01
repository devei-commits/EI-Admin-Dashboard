import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, MessageSquare, Send, Clock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CommentFeedItem } from '../../types/orderFulfillment';
import { fetchComments, addComment, resolveComment } from '../../services/fulfillment.service';
import { useToast } from '../../context/ToastContext';

interface CommentsPanelProps {
  entityType: 'so' | 'batch';
  entityId: number;
  entityLabel: string;
  onClose: () => void;
}

function formatAt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function StagePill({ stage, slipped }: { stage: string; slipped?: boolean }) {
  const colors: Record<string, string> = {
    picking: 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
    invoiced: 'bg-brand-soft text-brand border-brand-soft',
    shipped: 'bg-brand-soft text-brand border-brand-soft',
    delivered: 'bg-brand-soft text-brand border-brand-soft',
  };
  const cls = colors[stage] ?? 'bg-surface-3 text-ink-3 border-border';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>
      {slipped && <AlertCircle size={10} className="shrink-0" />}
      {stage.charAt(0).toUpperCase() + stage.slice(1)}
    </span>
  );
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({ entityType, entityId, entityLabel, onClose }) => {
  const { addToast } = useToast();
  const [feed, setFeed] = useState<CommentFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchComments(entityType, entityId);
      setFeed(data);
    } catch {
      addToast('error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, addToast]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handleResolve = async (commentId: number) => {
    try {
      setResolvingId(commentId);
      await resolveComment(commentId);
      await loadFeed();
    } catch {
      addToast('error', 'Failed to resolve comment');
    } finally {
      setResolvingId(null);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      setSubmitting(true);
      await addComment(entityType, entityId, trimmed);
      setText('');
      await loadFeed();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      addToast('error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] max-w-full bg-surface shadow-2xl border-l border-border flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-surface-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-brand shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink truncate">History & Comments</p>
            <p className="text-[10px] text-ink-3 truncate">{entityLabel}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-3 hover:text-ink-2 transition-colors shrink-0"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-4">
            <MessageSquare size={32} className="mb-2 opacity-30" />
            <p className="text-xs">No comments yet</p>
          </div>
        ) : (
          feed.map((item) =>
            item.kind === 'comment' ? (
              <div key={`c-${item.id}`} className="flex gap-2.5 group">
                <div className="w-7 h-7 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[10px] font-bold shrink-0">
                  {(item.byName ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-ink">{item.byName ?? 'Unknown'}</span>
                    <span className="text-[10px] text-ink-4">{formatAt(item.at)}</span>
                    {item.resolved && (
                      <span className="text-[9px] bg-ok-soft text-ok px-1.5 py-0.5 rounded-full font-semibold">resolved</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-2 mt-0.5 whitespace-pre-wrap break-words">{item.text}</p>
                  {!item.resolved && (
                    <button
                      onClick={() => handleResolve(item.id)}
                      disabled={resolvingId === item.id}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-4 hover:text-ok transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {resolvingId === item.id
                        ? <div className="h-3 w-3 border border-ink-4 border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 size={11} />
                      }
                      Mark resolved
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div key={`e-${item.id}`} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-surface-3 text-ink-3 flex items-center justify-center shrink-0">
                  <ChevronRight size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StagePill stage={item.stage ?? ''} slipped={item.slipped} />
                    <span className="text-[10px] text-ink-4 flex items-center gap-1">
                      <Clock size={10} />
                      {formatAt(item.at)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-3 space-y-0.5">
                    {item.actorName && <span>By {item.actorName}</span>}
                    {item.committedDays != null && (
                      <span className={`ml-2 ${item.slipped ? 'text-err font-semibold' : 'text-ink-4'}`}>
                        {item.actualDays ?? '?'}d / {item.committedDays}d SLA
                        {item.slipped ? ' — Slipped' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Add comment */}
      <div className="shrink-0 border-t border-hairline px-4 py-3 bg-surface-3">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
            }}
            placeholder="Add a comment… (Ctrl+Enter to send)"
            aria-label="Add a comment"
            rows={2}
            className="flex-1 resize-none border border-border rounded-lg px-3 py-2 text-xs bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)] outline-none"
          />
          <button
            onClick={handleSend}
            disabled={submitting || !text.trim()}
            className="px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            aria-label="Send comment"
          >
            {submitting
              ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={14} />
            }
          </button>
        </div>
      </div>
    </div>
  );
};
