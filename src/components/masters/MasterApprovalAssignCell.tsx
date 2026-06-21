import { useMemo, useState } from 'react';
import {
  formatStageAssigneeLabel,
  normalizeStageAssignees,
  type MasterApprovalKind,
  type MasterApprovalStageAssignees,
} from '../../constants/masterApprovalStatus';
import { MasterApprovalAssignModal } from './MasterApprovalAssignModal';

export type MasterApprovalAssignCellProps = {
  kind: MasterApprovalKind;
  itemId: string | number;
  itemCode: string;
  stageAssignees?: unknown;
  canAssign?: boolean;
  onSaved?: (assignees: MasterApprovalStageAssignees) => void;
  compact?: boolean;
};

function assignmentSummary(assignees: MasterApprovalStageAssignees): string {
  const parts = (['drafter', 'reviewer', 'approver'] as const)
    .map((k) => assignees[k])
    .filter((s) => s?.user_id)
    .map((s) => s!.display_name.split(' ')[0] ?? s!.display_name);
  if (parts.length === 0) return 'All open';
  if (parts.length <= 2) return parts.join(', ');
  return `${parts[0]}, ${parts[1]} +${parts.length - 2}`;
}

export function MasterApprovalAssignCell({
  kind,
  itemId,
  itemCode,
  stageAssignees: rawAssignees,
  canAssign = false,
  onSaved,
  compact = false,
}: MasterApprovalAssignCellProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const assignees = useMemo(() => normalizeStageAssignees(rawAssignees), [rawAssignees]);
  const summary = useMemo(() => assignmentSummary(assignees), [assignees]);

  if (!canAssign) {
    const lines = (['drafter', 'reviewer', 'approver'] as const)
      .map((key) => assignees[key])
      .filter(Boolean);
    if (lines.length === 0) {
      return <span className="text-[10px] text-gray-400">Open</span>;
    }
    return (
      <div className={`text-[10px] text-gray-600 ${compact ? 'max-w-28' : 'max-w-40'}`}>
        {lines.slice(0, 2).map((slot) => (
          <p key={slot!.user_id} className="truncate" title={formatStageAssigneeLabel(slot)}>
            {formatStageAssigneeLabel(slot)}
          </p>
        ))}
        {lines.length > 2 ? <p className="text-gray-400">+{lines.length - 2} more</p> : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-left px-2 py-1 rounded-md border border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-400 max-w-full"
        title="Assign people to approval stages"
      >
        <span className="block text-[10px] font-semibold text-teal-700">Assign</span>
        <span className="block text-[10px] text-gray-600 truncate">{summary}</span>
      </button>
      <MasterApprovalAssignModal
        isOpen={open}
        onClose={() => setOpen(false)}
        kind={kind}
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
