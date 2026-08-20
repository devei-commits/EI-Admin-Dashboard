/**
 * Batch COA used to be a single slot: each pick overwrote the last, and there was no way to remove
 * one. A batch can genuinely arrive with several COAs (per test, per sub-lot, a reissued revision).
 */
import { describe, it, expect } from 'vitest';
import {
  addBatchCoaDocs,
  batchCoaDocs,
  emptyBatchRow,
  removeBatchCoaDoc,
  type GrnBatchRow,
} from '../inboundGrnBatchesMeta';

const AT = '2026-08-20T10:00:00.000Z';
const row = (over: Partial<GrnBatchRow> = {}): GrnBatchRow => ({ ...emptyBatchRow(), ...over });

describe('batchCoaDocs', () => {
  it('reads an empty batch as no documents', () => {
    expect(batchCoaDocs(row())).toEqual([]);
    expect(batchCoaDocs(null)).toEqual([]);
    expect(batchCoaDocs(undefined)).toEqual([]);
  });

  it('upgrades a GRN saved before multi-COA', () => {
    expect(batchCoaDocs(row({ coaFileName: 'coa-old.pdf', coaDocs: null })))
      .toEqual([{ fileName: 'coa-old.pdf', uploadedAt: null }]);
  });

  it('prefers the list once one exists', () => {
    const r = row({ coaFileName: 'stale.pdf', coaDocs: [{ fileName: 'a.pdf' }, { fileName: 'b.pdf' }] });
    expect(batchCoaDocs(r).map((d) => d.fileName)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('drops blank entries rather than rendering empty chips', () => {
    const r = row({ coaDocs: [{ fileName: '  ' }, { fileName: ' ok.pdf ' }] });
    expect(batchCoaDocs(r)).toEqual([{ fileName: 'ok.pdf', uploadedAt: null }]);
  });
});

describe('addBatchCoaDocs', () => {
  it('adds several files in one pick and stamps each', () => {
    const patch = addBatchCoaDocs(row(), ['a.pdf', 'b.pdf'], AT);
    expect(patch.coaDocs).toEqual([
      { fileName: 'a.pdf', uploadedAt: AT },
      { fileName: 'b.pdf', uploadedAt: AT },
    ]);
  });

  it('appends instead of overwriting — the original defect', () => {
    const first = row(addBatchCoaDocs(row(), ['a.pdf'], AT));
    const patch = addBatchCoaDocs(first, ['b.pdf'], AT);
    expect(patch.coaDocs?.map((d) => d.fileName)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('ignores a file already on the batch, since only the name is stored', () => {
    const first = row(addBatchCoaDocs(row(), ['a.pdf'], AT));
    expect(addBatchCoaDocs(first, ['A.PDF', 'a.pdf', 'c.pdf'], AT).coaDocs?.map((d) => d.fileName))
      .toEqual(['a.pdf', 'c.pdf']);
  });

  it('skips blank names and an empty pick', () => {
    expect(addBatchCoaDocs(row(), ['', '   '], AT).coaDocs).toEqual([]);
    expect(addBatchCoaDocs(row(), [], AT).coaDocs).toEqual([]);
  });

  it('carries a legacy file into the list rather than dropping it', () => {
    const patch = addBatchCoaDocs(row({ coaFileName: 'old.pdf' }), ['new.pdf'], AT);
    expect(patch.coaDocs?.map((d) => d.fileName)).toEqual(['old.pdf', 'new.pdf']);
  });

  it('mirrors the legacy field to the first document', () => {
    expect(addBatchCoaDocs(row(), ['a.pdf', 'b.pdf'], AT).coaFileName).toBe('a.pdf');
  });
});

describe('removeBatchCoaDoc', () => {
  const three = row(addBatchCoaDocs(row(), ['a.pdf', 'b.pdf', 'c.pdf'], AT));

  it('removes the document at the given index', () => {
    expect(removeBatchCoaDoc(three, 1).coaDocs?.map((d) => d.fileName)).toEqual(['a.pdf', 'c.pdf']);
  });

  it('re-points the legacy field when the first document goes', () => {
    const patch = removeBatchCoaDoc(three, 0);
    expect(patch.coaFileName).toBe('b.pdf');
  });

  it('clears the legacy field when the last document goes', () => {
    const one = row(addBatchCoaDocs(row(), ['only.pdf'], AT));
    const patch = removeBatchCoaDoc(one, 0);
    expect(patch.coaDocs).toEqual([]);
    expect(patch.coaFileName).toBeNull();
  });

  it('leaves the list untouched on an out-of-range index', () => {
    for (const i of [-1, 3, 99, 1.5, Number.NaN]) {
      expect(removeBatchCoaDoc(three, i).coaDocs?.map((d) => d.fileName)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    }
  });

  it('can remove a legacy single COA', () => {
    expect(removeBatchCoaDoc(row({ coaFileName: 'old.pdf' }), 0).coaDocs).toEqual([]);
  });
});
