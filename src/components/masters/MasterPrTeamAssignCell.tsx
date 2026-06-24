import { useMemo, useState, type MouseEvent } from 'react';
import {
  formatStageAssigneeLabel,
  normalizeStageAssignees,
  type MasterApprovalStageAssignees,
  type MasterApprovalStageSlot,
} from '../../constants/masterApprovalStatus';
import { normalizePrApprovalTeamPending, type PrTeamKey } from '../../lib/prMasterTeamApproval';
import { MasterPrTeamAssignModal } from './MasterPrTeamAssignModal';

export type MasterPrTeamAssignCellProps = {
  team: PrTeamKey;
  itemId: string | number;
  itemCode: string;
  stageAssignees?: unknown;
  approvalTeamPending?: unknown;
  canAssign?: boolean;
  onSaved?: (assignees: MasterApprovalStageAssignees) => void;
};

function teamSignedPending(team: PrTeamKey, pending: ReturnType<typeof normalizePrApprovalTeamPending>): boolean {
  if (!pending) return false;
  return team === 'rm_team' ? !!pending.rm_signed_at : !!pending.pack_signed_at;
}

function TeamAssignButton({
  label,
  slot,
  pendingSigned,
  accentClass,
  onClick,
}: {
  label: string;
  slot: MasterApprovalStageSlot;
  pendingSigned: boolean;
  accentClass: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  const assigned = !!slot?.user_id;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`text-left w-full min-w-[7rem] max-w-[10rem] px-2 py-1.5 rounded-md border border-dashed ${accentClass} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1`}
      title={`Assign ${label}`}
    >
      <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      {assigned ? (
        <span className="block text-[11px] font-semibold text-gray-900 truncate" title={formatStageAssigneeLabel(slot)}>
          {slot!.display_name}
        </span>
      ) : (
        <span className="block text-[11px] text-gray-500 italic">Open</span>
      )}
      {pendingSigned ? (
        <span className="block text-[10px] font-semibold text-amber-700 mt-0.5">Signed ✓</span>
      ) : null}
    </button>
  );
}

function TeamAssignReadonly({
  label,
  slot,
  pendingSigned,
}: {
  label: string;
  slot: MasterApprovalStageSlot;
  pendingSigned: boolean;
}): JSX.Element {
  return (
    <div className="min-w-[7rem] max-w-[10rem] text-[10px] text-gray-600">
      <span className="block font-bold uppercase tracking-wide text-gray-400">{label}</span>
      {slot?.user_id ? (
        <p className="truncate font-medium text-gray-800" title={formatStageAssigneeLabel(slot)}>
          {formatStageAssigneeLabel(slot)}
        </p>
      ) : (
        <p className="text-gray-400 italic">Open</p>
      )}
      {pendingSigned ? <p className="text-amber-700 font-semibold">Signed ✓</p> : null}
    </div>
  );
}

export function MasterPrTeamAssignCell({
  team,
  itemId,
  itemCode,
  stageAssignees: rawAssignees,
  approvalTeamPending: rawPending,
  canAssign = false,
  onSaved,
}: MasterPrTeamAssignCellProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const assignees = useMemo(() => normalizeStageAssignees(rawAssignees), [rawAssignees]);
  const pending = useMemo(() => normalizePrApprovalTeamPending(rawPending), [rawPending]);
  const slot = assignees[team];
  const label = team === 'rm_team' ? 'RM assign' : 'Pack assign';
  const accentClass =
    team === 'rm_team'
      ? 'border-indigo-300 bg-indigo-50/60 focus:ring-indigo-400'
      : 'border-violet-300 bg-violet-50/60 focus:ring-violet-400';
  const pendingSigned = teamSignedPending(team, pending);

  if (!canAssign) {
    return <TeamAssignReadonly label={label} slot={slot} pendingSigned={pendingSigned} />;
  }

  return (
    <>
      <TeamAssignButton
        label={label}
        slot={slot}
        pendingSigned={pendingSigned}
        accentClass={accentClass}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      <MasterPrTeamAssignModal
        isOpen={open}
        onClose={() => setOpen(false)}
        team={team}
        itemId={itemId}
        itemCode={itemCode}
        assignees={assignees}
        onSaved={(next) => {
          onSaved?.(next);
          setOpen(false);
        }}
      />
    </>
  );
}
