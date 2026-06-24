import { useEffect, useState } from 'react';
import { Modal } from '../orders/Modal';
import {
  PR_MASTER_TEAM_STAGES,
  emptyStageAssignees,
  type MasterApprovalStageAssignees,
  type MasterApprovalStageKey,
} from '../../constants/masterApprovalStatus';
import { patchMasterApprovalStatus } from '../../services/masterApproval.service';
import { type PrTeamKey } from '../../lib/prMasterTeamApproval';
import { useToast } from '../../context/ToastContext';
import { PrTeamAssignPicker } from './PrTeamAssignPicker';

export type MasterPrTeamAssignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  team: PrTeamKey;
  itemId: string | number;
  itemCode: string;
  assignees: MasterApprovalStageAssignees;
  onSaved?: (assignees: MasterApprovalStageAssignees) => void;
};

function toApiPayload(stages: MasterApprovalStageAssignees): MasterApprovalStageAssignees {
  const out = emptyStageAssignees();
  for (const key of Object.keys(out) as MasterApprovalStageKey[]) {
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

export function MasterPrTeamAssignModal({
  isOpen,
  onClose,
  team,
  itemId,
  itemCode,
  assignees,
  onSaved,
}: MasterPrTeamAssignModalProps): JSX.Element {
  const { addToast } = useToast();
  const [draft, setDraft] = useState<MasterApprovalStageAssignees>(() => ({ ...assignees }));
  const [busy, setBusy] = useState(false);

  const stageMeta = PR_MASTER_TEAM_STAGES.find((s) => s.key === team)!;
  const title = team === 'rm_team' ? 'Assign RM team' : 'Assign Pack team';

  useEffect(() => {
    if (isOpen) setDraft({ ...assignees });
  }, [isOpen, assignees, itemId]);

  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = toApiPayload(draft);
      const res = await patchMasterApprovalStatus('PR', itemId, {
        approval_stage_assignees: payload,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to save assignment');
      }
      const saved = res.data?.approval_stage_assignees ?? payload;
      onSaved?.(saved);
      addToast('success', `${stageMeta.label} assignment saved`);
      onClose();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save assignment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={itemCode}
      size="sm"
      bodyClassName="overflow-visible"
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        This person will sign off on behalf of the {stageMeta.label.toLowerCase()} before PR approval status can
        advance. Leave <span className="font-semibold text-gray-800">Open</span> if anyone with PR approve access may
        act for this team.
      </p>
      <PrTeamAssignPicker
        teamKey={team}
        label={stageMeta.label}
        emoji={stageMeta.emoji}
        slot={draft[team]}
        disabled={busy}
        fieldId={`pr-team-assign-${itemId}-${team}`}
        onChange={(next) => setDraft((prev) => ({ ...prev, [team]: next }))}
      />
    </Modal>
  );
}
