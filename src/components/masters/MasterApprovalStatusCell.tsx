import { useEffect, useState } from 'react';
import {
  MASTER_APPROVAL_STATUSES,
  getNextMasterApprovalStatus,
  masterApprovalStatusBadgeClass,
  normalizeMasterApprovalStatus,
  type MasterApprovalKind,
} from '../../constants/masterApprovalStatus';
import { patchMasterApprovalStatus } from '../../services/masterApproval.service';
import { useToast } from '../../context/ToastContext';

export type MasterApprovalStatusCellProps = {
  kind: MasterApprovalKind;
  itemId: string | number;
  status: string;
  /** May change approval status (admin or assigned person for current stage). */
  canUpdate?: boolean;
  onUpdated?: (nextStatus: string) => void;
  compact?: boolean;
};

export function MasterApprovalStatusCell({
  kind,
  itemId,
  status,
  canUpdate = false,
  onUpdated,
  compact = false,
}: MasterApprovalStatusCellProps): JSX.Element {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(() => normalizeMasterApprovalStatus(status));

  useEffect(() => {
    setLocalStatus(normalizeMasterApprovalStatus(status));
  }, [status, itemId]);

  const label = normalizeMasterApprovalStatus(localStatus);
  const next = getNextMasterApprovalStatus(label);
  const badgeClass = masterApprovalStatusBadgeClass(label);

  const applyStatus = async (nextStatus: string): Promise<void> => {
    if (busy || !canUpdate) return;
    setBusy(true);
    try {
      const res = await patchMasterApprovalStatus(kind, itemId, { status: nextStatus });
      if (!res.success) {
        throw new Error(res.error || 'Failed to update status');
      }
      const updated = normalizeMasterApprovalStatus(res.data?.status ?? nextStatus);
      setLocalStatus(updated);
      onUpdated?.(updated);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  const advance = async (): Promise<void> => {
    if (!next) return;
    await applyStatus(next);
  };

  if (!canUpdate) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badgeClass}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className={`flex ${compact ? 'flex-col gap-1' : 'flex-wrap items-center gap-1.5'}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badgeClass}`}
      >
        {label}
      </span>
      <select
        aria-label={`Approval status for ${kind} ${itemId}`}
        value={label}
        disabled={busy}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => void applyStatus(e.target.value)}
        className="min-w-0 max-w-full px-1.5 py-0.5 text-[10px] font-medium border border-border rounded-md bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] disabled:opacity-60"
      >
        {MASTER_APPROVAL_STATUSES.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {next ? (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void advance();
          }}
          className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-brand text-white hover:bg-brand-press focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? 'Saving…' : `→ ${next}`}
        </button>
      ) : null}
    </div>
  );
}
