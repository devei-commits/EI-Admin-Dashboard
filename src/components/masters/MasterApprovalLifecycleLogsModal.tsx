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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 backdrop-blur-sm overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="master-approval-logs-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-6 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="min-w-0">
            <h2 id="master-approval-logs-title" className="text-base font-bold text-gray-900">
              Approval lifecycle logs
            </h2>
            <p className="text-sm text-gray-600 mt-0.5 truncate">
              <span className="font-mono font-semibold text-gray-800">{itemCode}</span>
              {itemLabel ? <span className="text-gray-500"> · {itemLabel}</span> : null}
            </p>
            <p className="mt-2">
              <span className="text-xs text-gray-500 mr-2">Current status</span>
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
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-white text-xs font-medium"
          >
            ✕ Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[75vh] overflow-y-auto">
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500">Loading lifecycle logs…</p>
          ) : null}

          {!loading && !error ? (
            <>
              <section aria-label="Time in each approval stage">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Time in each stage
                </h3>
                {stages.length === 0 ? (
                  <p className="text-sm text-gray-500">No lifecycle data yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {stages.map((stage, idx) => (
                      <li
                        key={`${stage.status}-${idx}`}
                        className={`rounded-xl border px-4 py-3 ${
                          stage.isCurrent
                            ? 'border-indigo-200 bg-indigo-50/40'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(stage.status)}`}
                          >
                            {stage.status}
                          </span>
                          {stage.isCurrent ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                              Current
                            </span>
                          ) : null}
                          <span className="text-sm font-bold text-gray-900">{stage.durationLabel}</span>
                        </div>
                        <p className="text-xs text-gray-600">
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
                              <span className="text-gray-400"> (start not recorded)</span>
                            </>
                          ) : (
                            <>In stage since {formatWhen(stage.startedAt)}</>
                          )}
                        </p>
                        {stage.isCurrent ? (
                          <p className="text-xs text-gray-700 mt-1">
                            {exitActionVerb('current')} · total time {stage.durationLabel}
                          </p>
                        ) : stage.exitedBy ? (
                          <p className="text-xs text-gray-700 mt-1">
                            {exitActionVerb(stage.exitAction)}{' '}
                            <span className="font-semibold">{stage.exitedBy}</span>
                            {stage.exitNote ? (
                              <span className="text-gray-500"> — “{stage.exitNote}”</span>
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
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    All events
                  </h3>
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-sm text-gray-500">No status changes recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-100">
                          <th className="py-2 px-3 font-semibold">When</th>
                          <th className="py-2 px-3 font-semibold">From</th>
                          <th className="py-2 px-3 font-semibold">To</th>
                          <th className="py-2 px-3 font-semibold">By</th>
                          <th className="py-2 px-3 font-semibold">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
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
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(entry.toStatus)}`}
                              >
                                {entry.toStatus}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-700">
                              {entry.changedByDisplayName?.trim() || '—'}
                              {entry.source === 'pr_rm_team_signoff' ? (
                                <span className="block text-[10px] text-amber-700 font-semibold">RM team sign-off</span>
                              ) : entry.source === 'pr_pack_team_signoff' ? (
                                <span className="block text-[10px] text-violet-700 font-semibold">Pack team sign-off</span>
                              ) : null}
                            </td>
                            <td className="py-2 px-3 text-gray-600 max-w-xs whitespace-pre-wrap break-words">
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
    </div>
  );
}
