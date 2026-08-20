/**
 * Warehouse → Inbound listed GRNs in backend order, interleaving July and August rows, and the
 * Shipment column sorted on its own display label ("24-Jul") — i.e. alphabetically.
 */
import { describe, it, expect } from 'vitest';
import { inboundShipmentSortValue, formatInboundShipmentLabel } from '../inboundGrnTableDisplay';

type Row = Parameters<typeof inboundShipmentSortValue>[0];
const grn = (over: Partial<Row>): Row => ({ ...over } as Row);

describe('inboundShipmentSortValue', () => {
  it('orders chronologically where the display label ordered alphabetically', () => {
    // Exactly the dates on screen. Sorted by label these read 10-Aug, 11-Aug, 17-Jul, 21-Aug, 24-Jul.
    const dates = ['2026-07-24', '2026-07-21', '2026-07-17', '2026-08-10', '2026-08-21', '2026-08-11'];
    const byValue = [...dates].sort(
      (a, b) => inboundShipmentSortValue(grn({ grnDate: b })) - inboundShipmentSortValue(grn({ grnDate: a })),
    );
    expect(byValue).toEqual(['2026-08-21', '2026-08-11', '2026-08-10', '2026-07-24', '2026-07-21', '2026-07-17']);

    const byLabel = [...dates].sort((a, b) =>
      formatInboundShipmentLabel(grn({ grnDate: b })).localeCompare(formatInboundShipmentLabel(grn({ grnDate: a }))),
    );
    expect(byLabel).not.toEqual(byValue); // the bug this replaces
  });

  it('uses the same field precedence as the label it sorts', () => {
    expect(inboundShipmentSortValue(grn({ grnDate: '2026-08-21', receivedDate: '2026-01-01', expectedDate: '2026-02-02' })))
      .toBe(new Date('2026-08-21').getTime());
    expect(inboundShipmentSortValue(grn({ receivedDate: '2026-01-01', expectedDate: '2026-02-02' })))
      .toBe(new Date('2026-01-01').getTime());
    expect(inboundShipmentSortValue(grn({ expectedDate: '2026-02-02' })))
      .toBe(new Date('2026-02-02').getTime());
  });

  it('settles undated and unparseable rows at the old end instead of throwing', () => {
    expect(inboundShipmentSortValue(grn({}))).toBe(0);
    expect(inboundShipmentSortValue(grn({ grnDate: null }))).toBe(0);
    expect(inboundShipmentSortValue(grn({ grnDate: 'not a date' }))).toBe(0);
  });

  it('separates two dates in the same month, which the DD-Mon label cannot always do', () => {
    expect(inboundShipmentSortValue(grn({ grnDate: '2026-08-11' })))
      .toBeGreaterThan(inboundShipmentSortValue(grn({ grnDate: '2026-08-10' })));
  });

  it('orders across years rather than by month name', () => {
    expect(inboundShipmentSortValue(grn({ grnDate: '2027-01-05' })))
      .toBeGreaterThan(inboundShipmentSortValue(grn({ grnDate: '2026-12-31' })));
  });
});
