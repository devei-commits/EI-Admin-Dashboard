import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchMasterApprovalStatusHistory,
  type MasterApprovalStatusHistoryEntry,
} from '../../services/masterApproval.service';
import {
  masterApprovalStatusBadgeClass,
  type MasterApprovalKind,
} from '../../constants/masterApprovalStatus';

export type MasterApprovalStatusHistoryPanelProps = {
  kind: MasterApprovalKind;
  itemId: string | number | null | undefined;
  /** Bump to refetch after a status change. */
  refreshKey?: number;
  className?: string;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function MasterApprovalStatusHistoryPanel({
  kind,
  itemId,
  refreshKey = 0,
  className = '',
}: MasterApprovalStatusHistoryPanelProps): React.ReactElement | null {
  const [entries, setEntries] = useState<MasterApprovalStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (itemId == null || String(itemId).trim() === '') {
      setEntries([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchMasterApprovalStatusHistory(kind, itemId);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Failed to load approval history');
      setEntries([]);
      return;
    }
    setEntries(res.data?.entries ?? []);
  }, [kind, itemId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (itemId == null || String(itemId).trim() === '') return null;

  return (
    <section
      className={`rounded-lg border border-border bg-surface px-4 py-3 ${className}`.trim()}
      aria-label="Approval status history"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ink-3">
          Approval status history
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[10px] font-semibold text-brand hover:text-brand disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-err" role="alert">
          {error}
        </p>
      ) : null}

      {!error && !loading && entries.length === 0 ? (
        <p className="text-xs text-ink-3">No status changes recorded yet.</p>
      ) : null}

      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink-4 border-b border-hairline">
                <th scope="col" className="py-1.5 pr-3 font-semibold">When</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">From</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">To</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">By</th>
                <th scope="col" className="py-1.5 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 pr-3 text-ink-3 whitespace-nowrap">
                    {formatWhen(entry.createdAt)}
                  </td>
                  <td className="py-2 pr-3">
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
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(entry.toStatus)}`}
                    >
                      {entry.toStatus}
                    </span>
                  </td>
                  <td className="py-2 text-ink-2">
                    {entry.changedByDisplayName?.trim() || '—'}
                  </td>
                  <td className="py-2 text-ink-3 max-w-xs whitespace-pre-wrap break-words">
                    {entry.note?.trim() || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
