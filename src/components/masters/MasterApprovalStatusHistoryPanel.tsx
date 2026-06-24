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
      className={`rounded-lg border border-gray-200 bg-white px-4 py-3 ${className}`.trim()}
      aria-label="Approval status history"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Approval status history
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!error && !loading && entries.length === 0 ? (
        <p className="text-xs text-gray-500">No status changes recorded yet.</p>
      ) : null}

      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-1.5 pr-3 font-semibold">When</th>
                <th className="py-1.5 pr-3 font-semibold">From</th>
                <th className="py-1.5 pr-3 font-semibold">To</th>
                <th className="py-1.5 pr-3 font-semibold">By</th>
                <th className="py-1.5 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
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
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(entry.toStatus)}`}
                    >
                      {entry.toStatus}
                    </span>
                  </td>
                  <td className="py-2 text-gray-700">
                    {entry.changedByDisplayName?.trim() || '—'}
                  </td>
                  <td className="py-2 text-gray-600 max-w-xs whitespace-pre-wrap break-words">
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
