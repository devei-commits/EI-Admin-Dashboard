/**
 * Some shipments arrive with no vendor batch identity at all. Requiring a batch number for those
 * left Step 3 unpassable. Pack counts stay required — Step 4 mints a packaging number per pack and
 * the QR labels print per pack.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyBatchRow,
  emptyGrnBatchesMeta,
  grnBatchesValidationErrors,
  readGrnBatchesMeta,
  type InboundGrnBatchesMeta,
} from '../inboundGrnBatchesMeta';

const meta = (over: Partial<InboundGrnBatchesMeta>): InboundGrnBatchesMeta => ({
  ...emptyGrnBatchesMeta(),
  ...over,
});
const row = (over = {}) => ({ ...emptyBatchRow(), ...over });

describe('grnBatchesValidationErrors — vendor batch not applicable', () => {
  it('demands a batch number by default', () => {
    const errs = grnBatchesValidationErrors(meta({ rows: [row({ noOfPacks: 2 })] }), 1);
    expect(errs).toContain('Batch 1: vendor batch no. is required.');
  });

  it('waives the batch number when the vendor supplied none', () => {
    const errs = grnBatchesValidationErrors(
      meta({ rows: [row({ noOfPacks: 2 })], vendorBatchNotApplicable: true }),
      1,
    );
    expect(errs).toEqual([]);
  });

  it('still requires pack counts — Step 4 and the labels depend on them', () => {
    const errs = grnBatchesValidationErrors(
      meta({ rows: [row({ noOfPacks: null })], vendorBatchNotApplicable: true }),
      1,
    );
    expect(errs).toContain('Batch 1: no. of packs must be at least 1.');
  });

  it('still checks the declared batch count', () => {
    const errs = grnBatchesValidationErrors(
      meta({ rows: [row({ noOfPacks: 1 })], vendorBatchNotApplicable: true }),
      2,
    );
    expect(errs).toContain('Enter details for all 2 batches.');
  });

  it('reports every row that is missing packs, not just the first', () => {
    const errs = grnBatchesValidationErrors(
      meta({ rows: [row({ noOfPacks: null }), row({ noOfPacks: 0 })], vendorBatchNotApplicable: true }),
      2,
    );
    expect(errs).toHaveLength(2);
  });
});

describe('readGrnBatchesMeta', () => {
  it('defaults the flag to false for GRNs saved before it existed', () => {
    expect(readGrnBatchesMeta({ batches: { rows: [] } }).vendorBatchNotApplicable).toBe(false);
    expect(readGrnBatchesMeta(null).vendorBatchNotApplicable).toBe(false);
  });

  it('round-trips the flag', () => {
    expect(
      readGrnBatchesMeta({ batches: { rows: [], vendorBatchNotApplicable: true } }).vendorBatchNotApplicable,
    ).toBe(true);
  });

  it('treats a non-boolean stored value as not waived rather than truthy', () => {
    expect(
      readGrnBatchesMeta({ batches: { rows: [], vendorBatchNotApplicable: 'yes' } as never })
        .vendorBatchNotApplicable,
    ).toBe(false);
  });
});
