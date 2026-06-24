import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../orders/Modal';
import {
  MASTER_APPROVAL_STAGES,
  PR_MASTER_TEAM_STAGES,
  emptyStageAssignees,
  formatStageAssigneeLabel,
  type MasterApprovalKind,
  type MasterApprovalStageAssignees,
  type MasterApprovalStageKey,
  type MasterApprovalStageSlot,
} from '../../constants/masterApprovalStatus';
import { patchMasterApprovalStatus } from '../../services/masterApproval.service';
import { searchUsers, type UserSearchHit } from '../../services/user.service';
import { useToast } from '../../context/ToastContext';
import { PrTeamAssignPicker } from './PrTeamAssignPicker';

export type MasterApprovalAssignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kind: MasterApprovalKind;
  itemId: string | number;
  itemCode: string;
  assignees: MasterApprovalStageAssignees;
  onSaved?: (assignees: MasterApprovalStageAssignees) => void;
};

type DraftStageState = MasterApprovalStageAssignees;

function slotFromUser(user: UserSearchHit): MasterApprovalStageSlot {
  return {
    user_id: user.userid,
    display_name: user.display_name,
    role_name: user.role_name ?? null,
  };
}

function toApiPayload(stages: DraftStageState): MasterApprovalStageAssignees {
  const out = emptyStageAssignees();
  const keys = [...MASTER_APPROVAL_STAGES.map((s) => s.key), ...PR_MASTER_TEAM_STAGES.map((s) => s.key)];
  for (const key of keys) {
    const slot = stages[key];
    out[key] = slot?.user_id
      ? {
          user_id: slot.user_id,
          display_name: slot.display_name,
          role_name: slot.role_name ?? null,
        }
      : null;
  }
  return out;
}

function filterStaffPool(pool: UserSearchHit[], query: string): UserSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, 50);
  return pool
    .filter((u) => {
      const name = u.display_name.toLowerCase();
      const email = u.email.toLowerCase();
      const role = (u.role_name ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    })
    .slice(0, 50);
}

function StageRow({
  fieldId,
  stageKey,
  label,
  emoji,
  slot,
  disabled,
  staffPool,
  staffLoading,
  staffLoadError,
  onChange,
}: {
  fieldId: string;
  stageKey: MasterApprovalStageKey;
  label: string;
  emoji: string;
  slot: MasterApprovalStageSlot;
  disabled: boolean;
  staffPool: UserSearchHit[];
  staffLoading: boolean;
  staffLoadError: string | null;
  onChange: (next: MasterApprovalStageSlot) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => filterStaffPool(staffPool, query), [staffPool, query]);
  const assignedLabel = formatStageAssigneeLabel(slot);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          <span aria-hidden="true">{emoji} </span>
          {label}
        </p>
        {slot?.user_id ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setQuery('');
              setOpen(false);
            }}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-400 rounded disabled:opacity-50"
          >
            Set Open
          </button>
        ) : (
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open</span>
        )}
      </div>

      {slot?.user_id ? (
        <p className="text-sm text-gray-800">{assignedLabel}</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">Anyone with masters approve access can act at this stage.</p>
          <div>
            <label className="sr-only" htmlFor={fieldId}>
              Search staff for {label}
            </label>
            <input
              id={fieldId}
              type="search"
              value={query}
              disabled={disabled}
              placeholder={`Search to assign ${label.toLowerCase()}…`}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 150);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
              autoComplete="off"
            />
            {open ? (
              <ul
                role="listbox"
                aria-label={`${label} suggestions`}
                className="mt-1 w-full max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm text-sm"
              >
                {staffLoading ? (
                  <li className="px-3 py-2 text-gray-500">Loading team members…</li>
                ) : staffLoadError ? (
                  <li className="px-3 py-2 text-red-600" role="alert">
                    {staffLoadError}
                  </li>
                ) : results.length === 0 ? (
                  <li className="px-3 py-2 text-gray-500">
                    {query.trim() ? 'No team members match your search' : 'No internal team members found'}
                  </li>
                ) : (
                  results.map((u) => (
                    <li key={u.userid}>
                      <button
                        type="button"
                        role="option"
                        className="w-full text-left px-3 py-2 hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onChange(slotFromUser(u));
                          setQuery('');
                          setOpen(false);
                        }}
                      >
                        <span className="font-medium text-gray-900">{u.display_name}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {[u.role_name, u.email].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export function MasterApprovalAssignModal({
  isOpen,
  onClose,
  kind,
  itemId,
  itemCode,
  assignees,
  onSaved,
}: MasterApprovalAssignModalProps): JSX.Element {
  const { addToast } = useToast();
  const [draft, setDraft] = useState<DraftStageState>(() => ({ ...assignees }));
  const [busy, setBusy] = useState(false);
  const [staffPool, setStaffPool] = useState<UserSearchHit[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...assignees });
    }
  }, [isOpen, assignees, itemId]);

  useEffect(() => {
    if (!isOpen) {
      setStaffPool([]);
      setStaffLoadError(null);
      return;
    }
    let cancelled = false;
    setStaffLoading(true);
    setStaffLoadError(null);
    void searchUsers('').then((res) => {
      if (cancelled) return;
      setStaffLoading(false);
      if (res.success && res.data) {
        setStaffPool(res.data);
      } else {
        setStaffPool([]);
        setStaffLoadError(
          typeof res.error === 'object' && res.error && 'message' in res.error
            ? String((res.error as { message?: string }).message)
            : 'Could not load team members'
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = toApiPayload(draft);
      const res = await patchMasterApprovalStatus(kind, itemId, {
        approval_stage_assignees: payload,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to save assignments');
      }
      const saved = res.data?.approval_stage_assignees ?? payload;
      onSaved?.(saved);
      addToast('success', 'Stage assignments saved');
      onClose();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save assignments');
    } finally {
      setBusy(false);
    }
  };

  const itemKey = String(itemId);

  if (kind === 'PR') {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Assign teams — ${itemCode}`}
        subtitle="RM and Pack teams must both sign off before approval status advances."
        size="lg"
        bodyClassName="overflow-visible"
        footer={
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save both assignments'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PR_MASTER_TEAM_STAGES.map((stage) => (
            <PrTeamAssignPicker
              key={stage.key}
              teamKey={stage.key}
              label={stage.label}
              emoji={stage.emoji}
              slot={draft[stage.key]}
              disabled={busy}
              fieldId={`assign-${itemKey}-${stage.key}`}
              onChange={(next) => setDraft((prev) => ({ ...prev, [stage.key]: next }))}
            />
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign — ${itemCode}`}
      size="sm"
      bodyClassName="overflow-visible"
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
          >
            {busy ? 'Saving…' : '💾 Save Assignments'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        Assign specific people to each stage. Assigned stages are restricted to that person (admins can always act).
        Leave a stage <span className="font-semibold text-gray-800">Open</span> only when anyone with masters approve access may act there.
      </p>
      <div className="space-y-3">
        {MASTER_APPROVAL_STAGES.map((stage) => (
          <StageRow
            key={stage.key}
            fieldId={`assign-${itemKey}-${stage.key}`}
            stageKey={stage.key}
            label={stage.label}
            emoji={stage.emoji}
            slot={draft[stage.key]}
            disabled={busy}
            staffPool={staffPool}
            staffLoading={staffLoading}
            staffLoadError={staffLoadError}
            onChange={(next) => setDraft((prev) => ({ ...prev, [stage.key]: next }))}
          />
        ))}
      </div>
    </Modal>
  );
}
