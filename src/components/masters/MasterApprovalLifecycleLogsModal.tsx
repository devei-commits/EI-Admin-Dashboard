import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchMasterApprovalStatusHistory,
  type MasterApprovalStatusHistoryEntry,
} from '../../services/masterApproval.service';
import {
  masterApprovalStatusBadgeClass,
  normalizeMasterApprovalStatus,
  type MasterApprovalKind,
} from '../../constants/masterApprovalStatus';
import {
  buildMasterApprovalLifecycleStages,
  exitActionVerb,
  formatLifecycleWhen,
} from '../../lib/masterApprovalLifecycle';
import { ModalOverlay } from '../ui/ModalOverlay';

export type MasterApprovalLifecycleLogsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kind: MasterApprovalKind;
  itemId: string | number;
  itemCode: string;
  itemLabel?: string;
  currentStatus: string;
  recordCreatedAt?: string | null;
};

function formatWhen(iso: string | null | undefined): string {
  return formatLifecycleWhen(iso);
}

export function MasterApprovalLifecycleLogsModal({
  isOpen,
  onClose,
  kind,
  itemId,
  itemCode,
  itemLabel,
  currentStatus,
  recordCreatedAt,
}: MasterApprovalLifecycleLogsModalProps): React.ReactElement | null {
  const [entries, setEntries] = useState<MasterApprovalStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const res = await fetchMasterApprovalStatusHistory(kind, itemId, 200);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Failed to load approval logs');
      setEntries([]);
      return;
    }
    setEntries(res.data?.entries ?? []);
  }, [kind, itemId]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  const stages = useMemo(
    () =>
      buildMasterApprovalLifecycleStages(entries, currentStatus, {
        recordCreatedAt,
      }),
    [entries, currentStatus, recordCreatedAt]
  );

  const statusLabel = normalizeMasterApprovalStatus(currentStatus);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose} z="z-[60]" align="start" scroll backdrop="strong">
      <div
        className="w-full max-w-3xl my-6 bg-surface rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-approval-logs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-surface-3">
          <div className="min-w-0">
            <h2 id="master-approval-logs-title" className="text-base font-bold text-ink">
              Approval lifecycle logs
            </h2>
            <p className="text-sm text-ink-3 mt-0.5 truncate">
              <span className="font-mono font-semibold text-ink">{itemCode}</span>
              {itemLabel ? <span className="text-ink-3"> · {itemLabel}</span> : null}
            </p>
            <p className="mt-2">
              <span className="text-xs text-ink-3 mr-2">Current status</span>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(statusLabel)}`}
              >
                {statusLabel}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close logs"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-ink-2 hover:bg-surface text-xs font-medium"
          >
            ✕ Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[75vh] overflow-y-auto">
          {error ? (
            <p className="text-sm text-err" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-ink-3">Loading lifecycle logs…</p>
          ) : null}

          {!loading && !error ? (
            <>
              <section aria-label="Time in each approval stage">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-3 mb-3">
                  Time in each stage
                </h3>
                {stages.length === 0 ? (
                  <p className="text-sm text-ink-3">No lifecycle data yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {stages.map((stage, idx) => (
                      <li
                        key={`${stage.status}-${idx}`}
                        className={`rounded-xl border px-4 py-3 ${
                          stage.isCurrent
                            ? 'border-brand-soft bg-brand-soft'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(stage.status)}`}
                          >
                            {stage.status}
                          </span>
                          {stage.isCurrent ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                              Current
                            </span>
                          ) : null}
                          <span className="text-sm font-bold text-ink">{stage.durationLabel}</span>
                        </div>
                        <p className="text-xs text-ink-3">
                          {stage.startedAt ? (
                            <>
                              From <span className="font-medium">{formatWhen(stage.startedAt)}</span>
                              {stage.endedAt ? (
                                <>
                                  {' '}
                                  to <span className="font-medium">{formatWhen(stage.endedAt)}</span>
                                </>
                              ) : (
                                <> · still in this stage</>
                              )}
                            </>
                          ) : stage.endedAt ? (
                            <>
                              Until <span className="font-medium">{formatWhen(stage.endedAt)}</span>
                              <span className="text-ink-4"> (start not recorded)</span>
                            </>
                          ) : (
                            <>In stage since {formatWhen(stage.startedAt)}</>
                          )}
                        </p>
                        {stage.isCurrent ? (
                          <p className="text-xs text-ink-2 mt-1">
                            {exitActionVerb('current')} · total time {stage.durationLabel}
                          </p>
                        ) : stage.exitedBy ? (
                          <p className="text-xs text-ink-2 mt-1">
                            {exitActionVerb(stage.exitAction)}{' '}
                            <span className="font-semibold">{stage.exitedBy}</span>
                            {stage.exitNote ? (
                              <span className="text-ink-3"> — “{stage.exitNote}”</span>
                            ) : null}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section aria-label="All status change events">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ink-3">
                    All events
                  </h3>
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="text-[10px] font-semibold text-brand hover:text-brand disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-sm text-ink-3">No status changes recorded yet.</p>
                ) : (
                  <div className="overflow-auto max-h-[70vh] rounded-lg border border-border">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 z-20 [&_th]:bg-surface-3">
                        <tr className="text-left text-[10px] uppercase tracking-wide text-ink-4 bg-surface-3 border-b border-hairline">
                          <th scope="col" className="py-2 px-3 font-semibold">When</th>
                          <th scope="col" className="py-2 px-3 font-semibold">From</th>
                          <th scope="col" className="py-2 px-3 font-semibold">To</th>
                          <th scope="col" className="py-2 px-3 font-semibold">By</th>
                          <th scope="col" className="py-2 px-3 font-semibold">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="py-2 px-3 text-ink-3 whitespace-nowrap">
                              {formatWhen(entry.createdAt)}
                            </td>
                            <td className="py-2 px-3">
                              {entry.fromStatus ? (
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(entry.fromStatus)}`}
                                >
                                  {entry.fromStatus}
                                </span>
                              ) : (
                                <span className="text-ink-4">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(entry.toStatus)}`}
                              >
                                {entry.toStatus}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink-2">
                              {entry.changedByDisplayName?.trim() || '—'}
                              {entry.source === 'pr_rm_team_signoff' ? (
                                <span className="block text-[10px] text-warn font-semibold">RM team sign-off</span>
                              ) : entry.source === 'pr_pack_team_signoff' ? (
                                <span className="block text-[10px] text-brand font-semibold">Pack team sign-off</span>
                              ) : null}
                            </td>
                            <td className="py-2 px-3 text-ink-3 max-w-xs whitespace-pre-wrap break-words">
                              {entry.note?.trim() || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </ModalOverlay>
  );
}
