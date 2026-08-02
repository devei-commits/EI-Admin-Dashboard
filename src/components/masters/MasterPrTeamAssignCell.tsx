import { useMemo, useState, type MouseEvent } from 'react';
import {
  formatStageAssigneeLabel,
  normalizeStageAssignees,
  type MasterApprovalStageAssignees,
  type MasterApprovalStageSlot,
} from '../../constants/masterApprovalStatus';
import {
  getPrTeamAssignStatus,
  normalizePrApprovalTeamPending,
  prTeamAssignStatusBadgeClass,
  type PrTeamAssignStatus,
  type PrTeamKey,
} from '../../lib/prMasterTeamApproval';
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

function StatusBadge({ status }: { status: PrTeamAssignStatus }): JSX.Element {
  return (
    <span
      className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase tracking-wide ${prTeamAssignStatusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}

function TeamAssignButton({
  label,
  slot,
  status,
  accentClass,
  onClick,
}: {
  label: string;
  slot: MasterApprovalStageSlot;
  status: PrTeamAssignStatus;
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
        <span className="block text-[11px] font-semibold text-ink truncate" title={formatStageAssigneeLabel(slot)}>
          {slot!.display_name}
        </span>
      ) : (
        <span className="block text-[11px] text-ink-3 italic">Open</span>
      )}
      <StatusBadge status={status} />
    </button>
  );
}

function TeamAssignReadonly({
  label,
  slot,
  status,
}: {
  label: string;
  slot: MasterApprovalStageSlot;
  status: PrTeamAssignStatus;
}): JSX.Element {
  return (
    <div className="min-w-[7rem] max-w-[10rem] text-[10px] text-ink-3">
      <span className="block font-bold uppercase tracking-wide text-ink-4">{label}</span>
      {slot?.user_id ? (
        <p className="truncate font-medium text-ink" title={formatStageAssigneeLabel(slot)}>
          {formatStageAssigneeLabel(slot)}
        </p>
      ) : (
        <p className="text-ink-4 italic">Open</p>
      )}
      <StatusBadge status={status} />
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
      ? 'border-brand-soft bg-brand-soft/60 focus:ring-[color:var(--ring)]'
      : 'border-brand-soft bg-brand-soft/60 focus:ring-[color:var(--ring)]';
  const status = getPrTeamAssignStatus(team, assignees, pending);

  if (!canAssign) {
    return <TeamAssignReadonly label={label} slot={slot} status={status} />;
  }

  return (
    <>
      <TeamAssignButton
        label={label}
        slot={slot}
        status={status}
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
