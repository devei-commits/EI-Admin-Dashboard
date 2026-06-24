import { describe, expect, test } from 'vitest';
import {
  buildMasterApprovalLifecycleStages,
  formatApprovalDuration,
} from '../masterApprovalLifecycle';
import type { MasterApprovalStatusHistoryEntry } from '../../services/masterApproval.service';

function entry(
  partial: Partial<MasterApprovalStatusHistoryEntry> & Pick<MasterApprovalStatusHistoryEntry, 'id' | 'toStatus' | 'createdAt'>
): MasterApprovalStatusHistoryEntry {
  return {
    masterKind: 'RM',
    masterId: 1,
    masterCode: 'EI-RM-001',
    fromStatus: null,
    changedByUserId: null,
    changedByDisplayName: null,
    source: 'advance',
    note: null,
    ...partial,
  };
}

describe('masterApprovalLifecycle', () => {
  test('formatApprovalDuration formats hours and days', () => {
    expect(formatApprovalDuration(30 * 60_000)).toBe('30 min');
    expect(formatApprovalDuration(8 * 60 * 60_000)).toBe('8 hrs');
    expect(formatApprovalDuration(26 * 60 * 60_000)).toBe('1 day 2 hrs');
  });

  test('buildMasterApprovalLifecycleStages with no history uses current status', () => {
    const now = new Date('2026-06-24T18:00:00.000Z');
    const stages = buildMasterApprovalLifecycleStages([], 'Under Approval', {
      recordCreatedAt: '2026-06-24T10:00:00.000Z',
      now,
    });
    expect(stages).toHaveLength(1);
    expect(stages[0].status).toBe('Under Approval');
    expect(stages[0].durationLabel).toBe('8 hrs');
    expect(stages[0].isCurrent).toBe(true);
  });

  test('buildMasterApprovalLifecycleStages walks full chain with actors', () => {
    const now = new Date('2026-06-26T18:00:00.000Z');
    const stages = buildMasterApprovalLifecycleStages(
      [
        entry({
          id: 1,
          fromStatus: 'Draft',
          toStatus: 'Under Review',
          changedByDisplayName: 'Alice',
          createdAt: '2026-06-24T10:00:00.000Z',
          source: 'advance',
        }),
        entry({
          id: 2,
          fromStatus: 'Under Review',
          toStatus: 'Under Approval',
          changedByDisplayName: 'Bob',
          createdAt: '2026-06-25T10:00:00.000Z',
          source: 'advance',
        }),
        entry({
          id: 3,
          fromStatus: 'Under Approval',
          toStatus: 'Active',
          changedByDisplayName: 'Carol',
          createdAt: '2026-06-26T10:00:00.000Z',
          source: 'advance',
        }),
      ],
      'Active',
      {
        recordCreatedAt: '2026-06-24T02:00:00.000Z',
        now,
      }
    );

    expect(stages.map((s) => s.status)).toEqual([
      'Draft',
      'Under Review',
      'Under Approval',
      'Active',
    ]);
    expect(stages[0].exitedBy).toBe('Alice');
    expect(stages[0].durationLabel).toBe('8 hrs');
    expect(stages[1].exitedBy).toBe('Bob');
    expect(stages[1].durationLabel).toBe('1 day');
    expect(stages[2].exitedBy).toBe('Carol');
    expect(stages[3].isCurrent).toBe(true);
    expect(stages[3].exitedBy).toBeNull();
    expect(stages[3].durationLabel).toBe('8 hrs');
  });
});
