import { describe, expect, it } from 'vitest';
import {
  buildDispensingPickList,
  dispensingPickListCsv,
  pickListFileName,
  type PickListSourceLine,
} from '../dispensingPickList';

const BATCH = {
  bmrNo: 'BMR-2026-001',
  batchNo: 'B-01',
  productName: 'SKINKRAFT LICORICE SPF 40',
  soNo: 'SO-00206',
  scheduledMuZone: 'LOC-ML1',
};
const AT = new Date('2026-08-11T09:30:00Z');

const LINES: PickListSourceLine[] = [
  // fully dispensed from a single rack
  {
    code: '1000569', name: 'DIS-AB-10W', required: 9, dispensed: 9, done: true, unit: 'KG',
    trayContainer: 'TRAY-B-01', traySlot: 'S01',
    picks: [{ packNo: 'LOOSE · ML1/DEFAULT', qty: 9, zone: 'ML1', rack: 'DEFAULT' }],
  },
  // picked across TWO racks, not yet dispensed
  {
    code: '1000109', name: 'CETIOL CC', required: 1.75, dispensed: 0, done: false, unit: 'KG',
    picks: [
      { packNo: 'LOOSE · ML1/DEFAULT', qty: 1.3, zone: 'ML1', rack: 'DEFAULT' },
      { packNo: 'LOOSE · ML1/R2', qty: 0.45, zone: 'ML1', rack: 'R2' },
    ],
  },
  // picked short of the requirement
  {
    code: '1000552', name: 'AQUA', required: 3, dispensed: 0, done: false, unit: 'KG',
    picks: [{ packNo: 'LOOSE · ML1/DEFAULT', qty: 1, zone: 'ML1', rack: 'DEFAULT' }],
  },
  // nothing picked; name only resolvable from the master map
  { code: '1001355', required: 1.5, dispensed: 0, done: false, unit: 'KG' },
];

const build = () => buildDispensingPickList(BATCH, LINES, 'RM', {
  siteLabel: 'LOC-ML1 (ML1)',
  generatedAt: AT,
  nameByCode: { '1001355': 'PIROCTONE OLAMINE' },
});

describe('dispensing pick list', () => {
  it('classifies each line by how far it has got', () => {
    const rows = build().rows;
    expect(rows.map((r) => r.status)).toEqual(['dispensed', 'picked', 'short-pick', 'pending']);
  });

  it('sums picks across multiple racks and lists where each came from', () => {
    const row = build().rows[1];
    expect(row.picked).toBe(1.75);
    expect(row.sources).toBe('ML1/DEFAULT 1.3 KG; ML1/R2 0.45 KG');
    expect(row.balance).toBe(1.75); // nothing dispensed yet
  });

  it('flags a short pick rather than calling it ready', () => {
    const row = build().rows[2];
    expect(row.picked).toBe(1);
    expect(row.required).toBe(3);
    expect(row.status).toBe('short-pick');
  });

  it('falls back to the master name when the line carries only a code', () => {
    expect(build().rows[3].name).toBe('PIROCTONE OLAMINE');
  });

  it('totals every column across the list', () => {
    const t = build().totals;
    expect(t.required).toBeCloseTo(9 + 1.75 + 3 + 1.5, 6);
    expect(t.picked).toBeCloseTo(9 + 1.75 + 1, 6);
    expect(t.dispensed).toBe(9);
    expect(t.balance).toBeCloseTo(1.75 + 3 + 1.5, 6);
  });

  it('emits a CSV with the batch preamble, every row, and a TOTAL line', () => {
    const csv = dispensingPickListCsv(build());
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Pick list');
    expect(csv).toContain('"Batch","B-01 · BMR-2026-001"');
    expect(csv).toContain('"Manufacturing site","LOC-ML1 (ML1)"');
    expect(csv).toContain('"1000569"');
    expect(csv).toContain('"PIROCTONE OLAMINE"');
    expect(lines[lines.length - 1]).toContain('TOTAL');
    // one line per material, plus preamble/blank/header/total
    expect(lines.filter((l) => l.startsWith('"1"') || l.startsWith('"2"') || l.startsWith('"3"') || l.startsWith('"4"')).length).toBe(4);
  });

  it('quotes embedded quotes so the CSV stays parseable', () => {
    const csv = dispensingPickListCsv(
      buildDispensingPickList(BATCH, [{ code: 'X', name: 'ACID 1" GRADE', required: 1, dispensed: 0, done: false }], 'RM', { generatedAt: AT }),
    );
    expect(csv).toContain('"ACID 1"" GRADE"');
  });

  it('names the file after the batch and date', () => {
    expect(pickListFileName(build())).toBe('pick-list-rm-B-01-BMR-2026-001-2026-08-11.csv');
  });
});
