/**
 * PIs Extracted showed no RM/PM comment chips at all: the ids were resolved by looking each BOM
 * line up in the RM/PM master lists, which are fetched separately — before they load, every lookup
 * failed and the material row of the switcher rendered empty.
 *
 * The BOM lines already carry the ids (real shape from planning_extracted 3258):
 *   {"raw_material_id":3334,"name":"Bentonite","quantity":93,"unit":"KG","code":"1000483"}
 */
import { describe, it, expect } from 'vitest';
import { buildPisMaterialScopes } from '../pisMaterialCommentScopes';

const rm = { raw_material_id: 3334, name: 'Bentonite', code: '1000483' };
const pm = { pack_material_id: 6507, name: 'SKINQ GLOW BRIGHT MASK 10GM_Sample TUBE', code: '4001115' };

describe('buildPisMaterialScopes', () => {
  it('reads ids straight off the BOM line, with no master lists loaded', () => {
    expect(buildPisMaterialScopes([rm], [pm])).toEqual([
      { type: 'rm', id: 3334, label: 'Bentonite' },
      { type: 'pm', id: 6507, label: 'SKINQ GLOW BRIGHT MASK 10GM_Sample TUBE' },
    ]);
  });

  it('falls back to the master list for an older line that has only a code', () => {
    const legacy = { code: '1000483', name: 'Bentonite' };
    expect(buildPisMaterialScopes([legacy], [], [{ id: 3334, code: '1000483' }])).toEqual([
      { type: 'rm', id: 3334, label: 'Bentonite' },
    ]);
  });

  it('matches a legacy line by name when the code does not match', () => {
    const legacy = { code: 'OLD-CODE', name: 'Bentonite' };
    expect(buildPisMaterialScopes([legacy], [], [{ id: 3334, code: '1000483', name: 'Bentonite' }])[0].id).toBe(3334);
  });

  it('emits one chip per material even when it appears on several lines', () => {
    expect(buildPisMaterialScopes([rm, { ...rm, quantity: 5 }], [])).toHaveLength(1);
  });

  it('skips a line with no resolvable id rather than keying a thread on nothing', () => {
    expect(buildPisMaterialScopes([{ name: 'Unknown', code: '' }], [])).toEqual([]);
    expect(buildPisMaterialScopes([{ raw_material_id: 0, name: 'Zero' }], [])).toEqual([]);
  });

  it('keeps RM and PM ids in separate namespaces', () => {
    const out = buildPisMaterialScopes([{ raw_material_id: 7, name: 'A' }], [{ pack_material_id: 7, name: 'B' }]);
    expect(out.map((s) => `${s.type}-${s.id}`)).toEqual(['rm-7', 'pm-7']);
  });

  it('handles missing arrays', () => {
    expect(buildPisMaterialScopes(undefined, null)).toEqual([]);
  });

  it('falls back to a readable label when the line has no name', () => {
    expect(buildPisMaterialScopes([{ raw_material_id: 12 }], [])[0].label).toBe('RM 12');
  });
});
