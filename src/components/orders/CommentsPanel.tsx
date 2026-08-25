import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, MessageSquare, Send, Clock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CommentFeedItem } from '../../types/orderFulfillment';
import {
  fetchComments,
  addComment,
  resolveComment,
  fetchCommentCounts,
  type CommentEntityType,
} from '../../services/fulfillment.service';
import { useToast } from '../../context/ToastContext';

export type CommentScopeOption = {
  /** planning_extracted.id for this SO+product line — the id item comments are keyed by. */
  id: number | null;
  label: string;
  /** Shown when the line has no plan yet, explaining why it cannot be commented on. */
  disabledReason?: string;
};

interface CommentsPanelProps {
  entityType: CommentEntityType;
  entityId: number;
  entityLabel: string;
  onClose: () => void;
  /**
   * Line items on this sale order. Rendered as a scope switcher so a comment can be filed against a
   * specific product instead of the whole order — the panel opened from the SO row had no way to
   * reach the per-item threads, which only existed behind the SO detail modal.
   */
  itemScopes?: CommentScopeOption[];
  /**
   * The whole-order thread, when the panel was opened on something narrower (e.g. Planning's PIs
   * Extracted opens an item thread). Supplying it lets the same panel reach order-level comments,
   * which are otherwise only visible from Fulfillment.
   */
  orderScope?: { id: number; label: string } | null;
  /**
   * RM/PM threads for this row's materials. Keyed by material id and shared with Items Involved, so
   * a note about a material is visible wherever that material appears rather than being trapped on
   * one planning row.
   */
  materialScopes?: { type: 'rm' | 'pm'; id: number; label: string }[];
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

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  entityType, entityId, entityLabel, onClose, itemScopes, orderScope, materialScopes,
}) => {
  const { addToast } = useToast();
  // Which thread is open: the order itself, or one of its lines. Starts on the order.
  const [scope, setScope] = useState<{ type: CommentEntityType; id: number; label: string }>({
    type: entityType, id: entityId, label: entityLabel,
  });
  useEffect(() => {
    setScope({ type: entityType, id: entityId, label: entityLabel });
  }, [entityType, entityId, entityLabel]);

  const [feed, setFeed] = useState<CommentFeedItem[]>([]);

  /**
   * How many comments each material thread already holds, so a chip that has something to read is
   * visibly distinct. Without this the only way to find a commented material was to click all of
   * them in turn — this panel can show thirty at once.
   */
  // Keyed "rm-<id>" / "pm-<id>": RM and PM ids are separate namespaces and would otherwise collide.
  const [materialCounts, setMaterialCounts] = useState<Record<string, number>>({});
  const materialScopesKey = (materialScopes ?? []).map((m) => `${m.type}-${m.id}`).join(',');
  useEffect(() => {
    const rmIds = (materialScopes ?? []).filter((m) => m.type === 'rm').map((m) => m.id);
    const pmIds = (materialScopes ?? []).filter((m) => m.type === 'pm').map((m) => m.id);
    if (rmIds.length === 0 && pmIds.length === 0) { setMaterialCounts({}); return; }
    let alive = true;
    void Promise.all([fetchCommentCounts('rm', rmIds), fetchCommentCounts('pm', pmIds)]).then(
      ([rm, pm]) => {
        if (!alive) return;
        // RM and PM ids are separate namespaces, so they are keyed by "type-id" to avoid collision.
        const merged: Record<string, number> = {};
        Object.entries(rm).forEach(([k, v]) => { merged[`rm-${k}`] = v; });
        Object.entries(pm).forEach(([k, v]) => { merged[`pm-${k}`] = v; });
        setMaterialCounts(merged);
      },
    );
    return () => { alive = false; };
    // Re-count after posting, so a new comment badges its chip immediately.
    // Depend on the material KEYS, not the array identity: a caller passing an inline array literal
    // would otherwise change the dependency every render and refetch in a loop. `materialScopes`
    // is read inside but intentionally not a dependency for that reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialScopesKey, feed.length]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchComments(scope.type, scope.id);
      setFeed(data);
    } catch {
      addToast('error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [scope.type, scope.id, addToast]);

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
      await addComment(scope.type, scope.id, trimmed);
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
            <p className="text-[10px] text-ink-3 truncate">{scope.label}</p>
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

      {/* Scope switcher — comment on the order as a whole, or on one of its line items. */}
      {(() => {
        // The order thread: either the entity this panel opened on, or one supplied by the caller.
        const orderTarget =
          entityType === 'so'
            ? { id: entityId, label: entityLabel }
            : orderScope ?? null;
        const hasAlternatives =
          (Boolean(orderTarget) && (itemScopes?.length ?? 0) > 0) || (materialScopes?.length ?? 0) > 0;
        if (!hasAlternatives) return null;
        return (
        <div className="border-b border-border px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3 mb-1.5">Comment on</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => orderTarget && setScope({ type: 'so', id: orderTarget.id, label: orderTarget.label })}
              className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${
                scope.type === 'so'
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-border bg-surface text-ink-2 hover:bg-surface-3'
              }`}
            >
              Whole order
            </button>
            {itemScopes.map((it, i) => {
              const disabled = it.id == null;
              const active = scope.type === 'item' && it.id != null && scope.id === it.id;
              return (
                <button
                  key={`${it.id ?? 'x'}-${i}`}
                  type="button"
                  disabled={disabled}
                  title={disabled ? (it.disabledReason ?? 'Not linked to a plan yet') : `Comments for ${it.label}`}
                  onClick={() => it.id != null && setScope({ type: 'item', id: it.id, label: it.label })}
                  className={`max-w-[14rem] truncate px-2 py-1 rounded-md border text-[11px] font-semibold ${
                    active
                      ? 'border-brand bg-brand-soft text-brand'
                      : disabled
                        ? 'border-border bg-surface-3 text-ink-4 cursor-not-allowed'
                        : 'border-border bg-surface text-ink-2 hover:bg-surface-3'
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
          {materialScopes && materialScopes.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3 mt-2 mb-1.5">
                Material (shared with Items Involved)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...materialScopes]
                  .sort((a, b) => {
                    // Materials with comments lead, so the ones worth reading are not buried in a
                    // list of thirty. Original order is preserved within each group.
                    const ac = materialCounts[`${a.type}-${a.id}`] ?? 0;
                    const bc = materialCounts[`${b.type}-${b.id}`] ?? 0;
                    if ((ac > 0) !== (bc > 0)) return ac > 0 ? -1 : 1;
                    return 0;
                  })
                  .map((m) => {
                  const active = scope.type === m.type && scope.id === m.id;
                  const count = materialCounts[`${m.type}-${m.id}`] ?? 0;
                  const hasComments = count > 0;
                  return (
                    <button
                      key={`${m.type}-${m.id}`}
                      type="button"
                      onClick={() => setScope({ type: m.type, id: m.id, label: m.label })}
                      title={
                        hasComments
                          ? `${count} comment${count === 1 ? '' : 's'} on ${m.label} — visible on Items Involved too`
                          : `No comments yet for ${m.label}`
                      }
                      className={`inline-flex items-center gap-1 max-w-[15rem] px-2 py-1 rounded-md border text-[11px] font-semibold ${
                        active
                          ? 'border-brand bg-brand-soft text-brand'
                          : hasComments
                            ? 'border-brand-soft bg-brand-soft/50 text-ink hover:bg-brand-soft'
                            : 'border-border bg-surface text-ink-2 hover:bg-surface-3'
                      }`}
                    >
                      <span className="text-ink-4">{m.type.toUpperCase()}</span>
                      <span className="truncate">{m.label}</span>
                      {hasComments && (
                        <span className="ml-0.5 shrink-0 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        );
      })()}

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
