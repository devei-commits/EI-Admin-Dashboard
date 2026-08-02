import React, { useMemo, useState } from 'react';
import {
  memberDisplayName,
  teamLeadOptionsForDept,
  teamMembersForDept,
  type ScheduleTeamAssignmentState,
  type ScheduleTeamMemberLike,
} from '../../lib/productionScheduleTeam';

export interface ScheduleTeamAssignmentSectionProps {
  team: ScheduleTeamMemberLike[];
  value: ScheduleTeamAssignmentState;
  onChange: (next: ScheduleTeamAssignmentState) => void;
}

function MemberChip({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-surface border border-border text-[11px] font-semibold text-ink-2">
      + {name}
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-surface-3 text-ink-4 hover:text-err"
        aria-label={`Remove ${name}`}
      >
        ✕
      </button>
    </span>
  );
}

function TeamMemberPicker({
  label,
  options,
  selectedIds,
  onAdd,
}: {
  label: string;
  options: ScheduleTeamMemberLike[];
  selectedIds: string[];
  onAdd: (id: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const available = options.filter((o) => o.avail && !selectedIds.includes(o.id));
  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={available.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-border text-[11px] font-semibold text-ink-3 hover:border-brand-soft hover:text-brand disabled:opacity-40"
      >
        + Add
      </button>
      {open && available.length > 0 && (
        <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-surface shadow-lg py-1">
          {available.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-brand-soft text-ink"
              onClick={() => {
                onAdd(m.id);
                setOpen(false);
              }}
            >
              {memberDisplayName(m)}
              <span className="text-ink-4 ml-1">{m.role}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label={`Close ${label} picker`}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function TeamBlock({
  title,
  leadLabel,
  membersLabel,
  leadValue,
  memberIds,
  dept,
  team,
  onLeadChange,
  onMembersChange,
}: {
  title: string;
  leadLabel: string;
  membersLabel: string;
  leadValue: string;
  memberIds: string[];
  dept: string;
  team: ScheduleTeamMemberLike[];
  onLeadChange: (id: string) => void;
  onMembersChange: (ids: string[]) => void;
}): React.ReactElement {
  const leadOptions = useMemo(() => teamLeadOptionsForDept(team, dept), [team, dept]);
  const memberOptions = useMemo(() => teamMembersForDept(team, dept), [team, dept]);
  const memberById = useMemo(
    () => new Map(team.map((t) => [t.id, t])),
    [team],
  );

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-3">{title}</div>
      <div className="mb-3">
        <label className="block text-[11px] font-semibold text-ink-2 mb-1">{leadLabel}</label>
        <select
          aria-label={leadLabel}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
          value={leadValue}
          onChange={(e) => onLeadChange(e.target.value)}
        >
          <option value="">Select lead</option>
          {leadOptions.map((t) => (
            <option key={t.id} value={t.id} disabled={!t.avail}>
              {memberDisplayName(t)} {!t.avail ? '(Unavailable)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-ink-2 mb-1.5">{membersLabel}</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {memberIds.map((id) => {
            const m = memberById.get(id);
            if (!m) return null;
            return (
              <MemberChip
                key={id}
                name={memberDisplayName(m)}
                onRemove={() => onMembersChange(memberIds.filter((x) => x !== id))}
              />
            );
          })}
          <TeamMemberPicker
            label={membersLabel}
            options={memberOptions}
            selectedIds={memberIds}
            onAdd={(id) => onMembersChange([...memberIds, id])}
          />
        </div>
      </div>
    </div>
  );
}

export function ScheduleTeamAssignmentSection({
  team,
  value,
  onChange,
}: ScheduleTeamAssignmentSectionProps): React.ReactElement {
  return (
    <div className="mt-4 rounded-xl border border-brand-soft bg-brand-soft/20 p-4">
      <div className="text-[11px] font-bold text-brand mb-3">Team assignment</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TeamBlock
          title="Manufacturing"
          leadLabel="Shift Lead"
          membersLabel="Production team members"
          leadValue={value.shiftLeadBmr}
          memberIds={value.teamBmr}
          dept="Manufacturing"
          team={team}
          onLeadChange={(shiftLeadBmr) => onChange({ ...value, shiftLeadBmr })}
          onMembersChange={(teamBmr) => onChange({ ...value, teamBmr })}
        />
        <TeamBlock
          title="Filling"
          leadLabel="Filling team lead"
          membersLabel="Filling team members"
          leadValue={value.shiftLeadBpr}
          memberIds={value.teamBpr}
          dept="Filling"
          team={team}
          onLeadChange={(shiftLeadBpr) => onChange({ ...value, shiftLeadBpr })}
          onMembersChange={(teamBpr) => onChange({ ...value, teamBpr })}
        />
      </div>
    </div>
  );
}
