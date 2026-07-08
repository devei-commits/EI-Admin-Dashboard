import { describe, expect, it } from 'vitest';
import {
  memberDisplayName,
  scheduleTeamPayloadFromState,
  scheduleTeamStateFromBatch,
  teamMembersForDept,
} from '../productionScheduleTeam';

describe('productionScheduleTeam', () => {
  it('formats short display names', () => {
    expect(memberDisplayName({ id: 'T1', name: 'Anjali Mehta', role: 'Shift Lead', dept: 'Manufacturing', avail: true })).toBe(
      'Anjali M.',
    );
  });

  it('builds payload without duplicating lead in member lists', () => {
    const payload = scheduleTeamPayloadFromState({
      shiftLeadBmr: 'T1',
      teamBmr: ['T1', 'T2', 'T3'],
      shiftLeadBpr: 'T8',
      teamBpr: ['T8', 'T9'],
    });
    expect(payload.teamBMR).toEqual(['T2', 'T3']);
    expect(payload.teamBPR).toEqual(['T9']);
  });

  it('hydrates state from batch fields', () => {
    expect(
      scheduleTeamStateFromBatch({
        shiftLeadBMR: 'T1',
        teamBMR: ['T2'],
        shiftLeadBPR: 'T8',
        teamBPR: ['T9'],
      }),
    ).toEqual({
      shiftLeadBmr: 'T1',
      teamBmr: ['T2'],
      shiftLeadBpr: 'T8',
      teamBpr: ['T9'],
    });
  });

  it('includes Super Admin and Admin in both manufacturing and filling pickers', () => {
    const team = [
      { id: 'U1', name: 'Ops Admin', role: 'Admin', dept: 'Manufacturing', avail: true },
      { id: 'U2', name: 'Line Staff', role: 'Production', dept: 'Filling', avail: true },
    ];
    expect(teamMembersForDept(team, 'Manufacturing').map((m) => m.id)).toEqual(['U1']);
    expect(teamMembersForDept(team, 'Filling').map((m) => m.id)).toEqual(['U1', 'U2']);
  });
});
