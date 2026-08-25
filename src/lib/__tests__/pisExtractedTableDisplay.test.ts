import { describe, expect, it } from 'vitest';
import {
  buildPisPlanStatusView,
  buildPisSlaView,
  formatPisOrdQty,
  formatPisTableDate,
  getPisBatchPipelineStage,
} from '../pisExtractedTableDisplay';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';
import type { BatchRow } from '../../services/production.service';

describe('pisExtractedTableDisplay', () => {
  it('formatPisTableDate uses DD-Mon-YYYY', () => {
    expect(formatPisTableDate('2026-06-16')).toBe('16-Jun-2026');
  });

  it('formatPisOrdQty adds pcs suffix', () => {
    expect(formatPisOrdQty('2000 pcs')).toBe('2,000 pcs');
  });

  it('shows planning pending when no batches exist', () => {
    const view = buildPisPlanStatusView(
      { id: '1', orderQty: '2000 pcs', totalKg: '400 kg', orderDate: '2026-06-16' },
      [],
      new Map(),
    );
    expect(view.kind).toBe('pending');
  });

  it('builds per-batch lines with coverage and stage', () => {
    const order = { id: '12', orderQty: '3000 pcs', totalKg: '600 kg', orderDate: '2026-06-14' };
    const batches: PlanningBatchAllRow[] = [
      {
        id: 42,
        planningExtractedId: 12,
        sequence: 1,
        batchCode: 'B-2026-0420',
        sizeKg: 600,
        rmLines: [],
        pmLines: [],
        sent: true,
      },
    ];
    const view = buildPisPlanStatusView(order, batches, new Map());
    expect(view.kind).toBe('batches');
    expect(view.batchLines[0]?.batchLabel).toBe('B-2026-0420');
    expect(view.batchLines[0]?.units).toBe(3000);
    expect(view.batchLines[0]?.coveragePct).toBe(100);
    expect(view.batchLines[0]?.stage).toBe('PROCUREMENT');
  });

  // Opening the planning modal auto-seeds a draft placeholder for the next batch (sized to whatever
  // is still unplanned) so the user has something to work on. That row is not a real, created batch —
  // it must not appear as a batch line or count toward coverage, or "sent 1 of 1000, 100 planned" reads
  // as "2 batches, fully covered" when only 100 units were ever actually committed.
  it('treats an unsent draft placeholder batch as still-pending, not a created batch', () => {
    const order = { id: '3685', orderQty: '1000 units', totalKg: '50 kg', orderDate: '2026-08-24' };
    const batches: PlanningBatchAllRow[] = [
      {
        id: 1,
        planningExtractedId: 3685,
        sequence: 1,
        batchCode: 'PE-3685-B1',
        sizeKg: 5,
        rmLines: [],
        pmLines: [],
        sent: true,
      },
      {
        id: 2,
        planningExtractedId: 3685,
        sequence: 2,
        batchCode: 'PE-3685-B2',
        sizeKg: 45,
        rmLines: [],
        pmLines: [],
        sent: false,
      },
    ];
    const view = buildPisPlanStatusView(order, batches, new Map());
    expect(view.kind).toBe('batches');
    expect(view.batchLines).toHaveLength(1);
    expect(view.batchLines[0]?.batchLabel).toBe('PE-3685-B1');
    expect(view.batchLines[0]?.units).toBe(100);
    expect(view.underCoveredUnits).toBe(900);
  });

  it('shows planning pending when the only batches are unsent drafts', () => {
    const order = { id: '9', orderQty: '500 pcs', totalKg: '100 kg', orderDate: '2026-06-16' };
    const batches: PlanningBatchAllRow[] = [
      {
        id: 5,
        planningExtractedId: 9,
        sequence: 1,
        batchCode: 'PE-9-B1',
        sizeKg: 100,
        rmLines: [],
        pmLines: [],
        sent: false,
      },
    ];
    const view = buildPisPlanStatusView(order, batches, new Map());
    expect(view.kind).toBe('pending');
    expect(view.underCoveredUnits).toBe(500);
  });

  it('maps production fg_ready to COMPLETED', () => {
    const batch: PlanningBatchAllRow = {
      id: 10,
      planningExtractedId: 1,
      sequence: 1,
      batchCode: 'B-2026-0410',
      sizeKg: 100,
      rmLines: [],
      pmLines: [],
      sent: true,
    };
    const prod = { bmrStatus: 'cleared', bprStatus: 'fg_ready' } as BatchRow;
    expect(getPisBatchPipelineStage(batch, prod)).toBe('COMPLETED');
  });

  it('buildPisSlaView shows open days when no batches', () => {
    const now = Date.parse('2026-06-24T12:00:00+05:30');
    const sla = buildPisSlaView(
      { id: '1', orderQty: '2000', totalKg: '400', orderDate: '2026-06-16', createdAt: '2026-06-16' },
      false,
      2000,
      now,
    );
    expect(sla.icon).toBe('🚩');
    expect(sla.text).toContain('open');
    expect(sla.text).toContain('committed 2d'); // fixed commitment, not elapsed days
    expect(sla.tone).toBe('breach');
  });

  it('buildPisSlaView shows amber "approaching" within 1 day of the committed SLA', () => {
    // orderDate 2026-06-16, now 2026-06-17 → 1 day open, committed 2d → approaching
    const now = Date.parse('2026-06-17T12:00:00+05:30');
    const sla = buildPisSlaView(
      { id: '1', orderQty: '2000', totalKg: '400', orderDate: '2026-06-16', createdAt: '2026-06-16' },
      false,
      2000,
      now,
    );
    expect(sla.tone).toBe('warn');
    expect(sla.icon).not.toBe('🚩');
  });

  it('buildPisSlaView is neutral (no flag) well within the SLA', () => {
    // Same day → 0 days open, committed 2d → neutral, no 🚩
    const now = Date.parse('2026-06-16T18:00:00+05:30');
    const sla = buildPisSlaView(
      { id: '1', orderQty: '2000', totalKg: '400', orderDate: '2026-06-16', createdAt: '2026-06-16' },
      false,
      2000,
      now,
    );
    expect(sla.tone).toBe('neutral');
    expect(sla.icon).toBe('');
  });
});
