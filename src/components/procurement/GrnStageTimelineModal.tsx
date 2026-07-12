/**
 * GRN stage timeline modal — spec View 5 §6.1.
 * Shows 6-stage workflow with timestamps/actors and allows stage advancement.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  GRN_STAGE_CONFIG,
  GRN_STAGE_ORDER,
  SLA_LEVEL_CLASSES,
  type GrnStage,
} from '../../constants/procurement';
import { grnInTransitSlaLevel, grnStageSlaLevel } from '../../lib/procurementSla';
import {
  advanceGrnStage,
  fetchGRNById,
  type GrnTrackerRow,
} from '../../services/grn.service';

export type GrnWorkflowStep = {
  stage: string;
  at: string;
  actor?: string;
};

function isGrnStage(s: string): s is GrnStage {
  return (GRN_STAGE_ORDER as string[]).includes(s);
}

function fmtWhen(iso: string | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeWorkflowSteps(raw: unknown): GrnWorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { stage: entry, at: '' };
      }
      if (entry && typeof entry === 'object') {
        const o = entry as Record<string, unknown>;
        return {
          stage: String(o.stage ?? ''),
          at: String(o.at ?? ''),
          actor: o.actor != null ? String(o.actor) : undefined,
        };
      }
      return null;
    })
    .filter((s): s is GrnWorkflowStep => !!s && !!s.stage);
}

function stageIndex(stage: string): number {
  const idx = GRN_STAGE_ORDER.indexOf(stage as GrnStage);
  return idx >= 0 ? idx : 0;
}

export type GrnStageTimelineModalProps = {
  row: GrnTrackerRow;
  actorName?: string;
  leadDays?: number;
  onClose: () => void;
  onAdvanced?: () => void;
};

export const GrnStageTimelineModal: React.FC<GrnStageTimelineModalProps> = ({
  row,
  actorName = 'Procurement',
  leadDays = 7,
  onClose,
  onAdvanced,
}) => {
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [steps, setSteps] = useState<GrnWorkflowStep[]>([]);
  const [currentStage, setCurrentStage] = useState(row.stage);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchGRNById(String(row.id));
      const wf = normalizeWorkflowSteps(detail?.workflowSteps ?? row.workflowSteps);
      const stageFromRow = isGrnStage(row.stage) ? row.stage : 'in_transit';
      setSteps(wf.length ? wf : [{ stage: stageFromRow, at: row.shippedDate ?? '' }]);
      const last = wf[wf.length - 1];
      setCurrentStage(last && isGrnStage(last.stage) ? last.stage : stageFromRow);
    } catch {
      const wf = normalizeWorkflowSteps(row.workflowSteps);
      const stageFromRow = isGrnStage(row.stage) ? row.stage : 'in_transit';
      setSteps(wf.length ? wf : [{ stage: stageFromRow, at: row.shippedDate ?? '' }]);
      setCurrentStage(stageFromRow);
    } finally {
      setLoading(false);
    }
  }, [row]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepByStage = useMemo(() => {
    const m = new Map<string, GrnWorkflowStep>();
    for (const s of steps) {
      if (!m.has(s.stage) || (s.at && (!m.get(s.stage)?.at || s.at > (m.get(s.stage)?.at ?? '')))) {
        m.set(s.stage, s);
      }
    }
    return m;
  }, [steps]);

  const currentIdx = stageIndex(currentStage);
  const nextStage = currentIdx < GRN_STAGE_ORDER.length - 1 ? GRN_STAGE_ORDER[currentIdx + 1] : null;

  const handleAdvance = async () => {
    if (!nextStage || advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      await advanceGrnStage(row.id, nextStage, actorName);
      await load();
      setSucceeded(true);
      onAdvanced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance stage');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="grn-stage-timeline-title"
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">GRN stage timeline</p>
            <h2 id="grn-stage-timeline-title" className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
              {row.grnNo}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {row.item.name} · <span className="font-mono">{row.item.code}</span>
              {row.sbCode ? <> · SB <span className="font-mono">{row.sbCode}</span></> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading timeline…
            </div>
          ) : (
            <ol className="space-y-0">
              {GRN_STAGE_ORDER.map((stage, idx) => {
                const cfg = GRN_STAGE_CONFIG[stage];
                const recorded = stepByStage.get(stage);
                const done = idx <= currentIdx;
                const active = stage === currentStage;
                const enteredAt = recorded?.at || (active && stage === 'in_transit' ? row.shippedDate ?? undefined : undefined);
                const slaLevel =
                  stage === 'in_transit'
                    ? grnInTransitSlaLevel(row.shippedDate, leadDays)
                    : active
                      ? grnStageSlaLevel(stage, enteredAt ?? null)
                      : 'ok';

                return (
                  <li key={stage} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                          done ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
                        } ${active ? 'ring-2 ring-blue-200' : ''}`}
                      />
                      {idx < GRN_STAGE_ORDER.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[24px] ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        {active && slaLevel !== 'ok' && (
                          <span className={`text-[10px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>SLA flag</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {recorded?.at ? (
                          <>
                            <span className="font-medium">{fmtWhen(recorded.at)}</span>
                            {recorded.actor ? <span className="text-slate-400"> · {recorded.actor}</span> : null}
                          </>
                        ) : done ? (
                          <span className="text-slate-400">Recorded (time unavailable)</span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
          {succeeded && !error ? (
            <p className="mt-3 text-xs text-emerald-700 font-semibold">Stage advanced successfully.</p>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white">
            Close
          </button>
          {nextStage && !loading ? (
            <button
              type="button"
              disabled={advancing}
              onClick={() => void handleAdvance()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {advancing ? 'Advancing…' : `Advance to ${GRN_STAGE_CONFIG[nextStage].label}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
