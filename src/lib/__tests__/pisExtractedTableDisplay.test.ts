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
        sent: false,
      },
    ];
    const view = buildPisPlanStatusView(order, batches, new Map());
    expect(view.kind).toBe('batches');
    expect(view.batchLines[0]?.batchLabel).toBe('B-2026-0420');
    expect(view.batchLines[0]?.units).toBe(3000);
    expect(view.batchLines[0]?.coveragePct).toBe(100);
    expect(view.batchLines[0]?.stage).toBe('PROCUREMENT');
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
  });
});
