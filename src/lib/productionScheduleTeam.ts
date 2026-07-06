/** Team assignment helpers for production schedule modals. */

export interface ScheduleTeamMemberLike {
  id: string;
  name: string;
  role: string;
  dept: string;
  avail: boolean;
}

export function teamMembersForDept(
  team: ScheduleTeamMemberLike[],
  dept: string,
): ScheduleTeamMemberLike[] {
  const d = dept.toLowerCase();
  return team.filter((t) => String(t.dept || '').toLowerCase() === d);
}

/** Prefer members whose role looks like a lead; fall back to full dept list. */
export function teamLeadOptionsForDept(
  team: ScheduleTeamMemberLike[],
  dept: string,
): ScheduleTeamMemberLike[] {
  const members = teamMembersForDept(team, dept).filter((t) => t.avail);
  const leads = members.filter((t) => /lead|supervisor|shift/i.test(t.role));
  return leads.length > 0 ? leads : members;
}

export function memberDisplayName(member: ScheduleTeamMemberLike | undefined): string {
  if (!member) return '—';
  const parts = String(member.name || '').trim().split(/\s+/);
  if (parts.length <= 1) return member.name;
  const last = parts[parts.length - 1] ?? '';
  const initial = last.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

export interface ScheduleTeamAssignmentState {
  shiftLeadBmr: string;
  teamBmr: string[];
  shiftLeadBpr: string;
  teamBpr: string[];
}

export function scheduleTeamStateFromBatch(batch: {
  shiftLeadBMR?: string;
  teamBMR?: string[];
  shiftLeadBPR?: string;
  teamBPR?: string[];
}): ScheduleTeamAssignmentState {
  return {
    shiftLeadBmr: batch.shiftLeadBMR ?? '',
    teamBmr: [...(batch.teamBMR ?? [])],
    shiftLeadBpr: batch.shiftLeadBPR ?? '',
    teamBpr: [...(batch.teamBPR ?? [])],
  };
}

export function scheduleTeamPayloadFromState(state: ScheduleTeamAssignmentState): {
  shiftLeadBMR: string;
  teamBMR: string[];
  shiftLeadBPR: string;
  teamBPR: string[];
} {
  const withoutLead = (lead: string, ids: string[]) =>
    ids.filter((id) => id && id !== lead);
  return {
    shiftLeadBMR: state.shiftLeadBmr,
    teamBMR: withoutLead(state.shiftLeadBmr, state.teamBmr),
    shiftLeadBPR: state.shiftLeadBpr,
    teamBPR: withoutLead(state.shiftLeadBpr, state.teamBpr),
  };
}
