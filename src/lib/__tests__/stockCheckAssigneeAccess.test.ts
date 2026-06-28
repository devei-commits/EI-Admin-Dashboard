import { describe, expect, it } from 'vitest';
import {
  canUserPerformStockCheck,
  isStockCheckAssigneeOpen,
  resolveStockCheckActorName,
  stockCheckAssigneeNamesMatch,
} from '../stockCheckAssigneeAccess';

describe('stockCheckAssigneeAccess', () => {
  it('treats empty assignee as open', () => {
    expect(isStockCheckAssigneeOpen('')).toBe(true);
    expect(isStockCheckAssigneeOpen('Open')).toBe(true);
    expect(isStockCheckAssigneeOpen('Ravi Kumar')).toBe(false);
  });

  it('matches assignee names with short-name fallback', () => {
    expect(stockCheckAssigneeNamesMatch('Ravi Kumar', 'Ravi K.')).toBe(true);
    expect(stockCheckAssigneeNamesMatch('Ravi Kumar', 'Priya S.')).toBe(false);
  });

  it('allows any actor when assignee is open', () => {
    expect(canUserPerformStockCheck('', 'Ravi Kumar')).toBe(true);
    expect(canUserPerformStockCheck(null, 'Ravi Kumar')).toBe(true);
  });

  it('restricts edit to assigned person', () => {
    expect(canUserPerformStockCheck('Ravi Kumar', 'Ravi Kumar')).toBe(true);
    expect(canUserPerformStockCheck('Ravi Kumar', 'Priya Sharma')).toBe(false);
  });

  it('resolves actor from staff profile email', () => {
    expect(
      resolveStockCheckActorName({
        authName: 'Ravi K.',
        authEmail: 'ravi@example.com',
        staffUsers: [{ display_name: 'Ravi Kumar', email: 'ravi@example.com' }],
      }),
    ).toBe('Ravi Kumar');
  });
});
