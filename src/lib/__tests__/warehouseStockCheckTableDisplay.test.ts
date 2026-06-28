import { describe, expect, it } from 'vitest';
import {
  buildWarehouseStockCheckAuditRef,
  buildWarehouseStockCheckTableRows,
  formatAssigneeShortName,
  formatStockCheckTableDate,
  resolveStockCheckSourceDept,
  resolveWarehouseCode,
  warehouseStockCheckSlaClass,
} from '../warehouseStockCheckTableDisplay';
import type { ProcurementRequest } from '../../types/procurement.types';

function mkRequest(overrides: Partial<ProcurementRequest> = {}): ProcurementRequest {
  return {
    id: '34',
    code: 'PR-REQ-034',
    type: 'PM',
    priority: 'High',
    status: 'New',
    items: ['CAPB'],
    dueDate: '2026-06-26',
    createdDate: '2026-06-23',
    requestedBy: 'buyer@example.com',
    stockCheckStatus: 'Pending',
    stockCheckDueDate: '2026-06-26',
    stockCheckAssignedTo: 'Ravi Kumar',
    stockCheckNotes: null,
    itemDetails: [
      {
        itemCode: '1000123',
        itemName: 'CAPB',
        reqQty: 100,
        unit: 'KG',
        moq: '',
        packSize: '',
        plannedPrice: 0,
        estValue: 0,
        type: 'PM',
      },
    ],
    ...overrides,
  };
}

describe('warehouseStockCheckTableDisplay', () => {
  it('formatStockCheckTableDate uses dd-Mon', () => {
    expect(formatStockCheckTableDate('2026-06-23')).toBe('23-Jun');
    expect(formatStockCheckTableDate('2026-06-26')).toBe('26-Jun');
  });

  it('buildWarehouseStockCheckAuditRef uses AUD prefix and 4-digit id', () => {
    expect(buildWarehouseStockCheckAuditRef('34', 2026)).toBe('AUD-2026-0034');
  });

  it('resolveWarehouseCode maps labels to SW and defaults to MW', () => {
    expect(resolveWarehouseCode('MAIN', '1000123', 'PM')).toBe('MW');
    expect(resolveWarehouseCode('MAIN', '5L00005', 'PM')).toBe('SW');
    expect(resolveWarehouseCode('Secondary Pack Store', '1000045', 'RM')).toBe('SW');
  });

  it('resolveStockCheckSourceDept covers treasury, production, and WH lead', () => {
    expect(resolveStockCheckSourceDept({ source: 'Treasury' })).toBe('Treasury');
    expect(resolveStockCheckSourceDept({ requestedBy: 'production@example.com' })).toBe('Production');
    expect(resolveStockCheckSourceDept({ requestedBy: 'warehouse lead' })).toBe('Self · WH lead');
    expect(resolveStockCheckSourceDept({ requestedBy: 'buyer@example.com' })).toBe('Procurement');
  });

  it('formatAssigneeShortName abbreviates or returns Open', () => {
    expect(formatAssigneeShortName('Ravi Kumar')).toBe('Ravi K.');
    expect(formatAssigneeShortName('')).toBe('Open');
  });

  it('buildWarehouseStockCheckTableRows matches warehouse table shape', () => {
    const rows = buildWarehouseStockCheckTableRows([mkRequest()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.auditRef).toBe('AUD-2026-0034');
    expect(rows[0]?.reqDateDisplay).toBe('23-Jun');
    expect(rows[0]?.targetDateDisplay).toBe('26-Jun');
    expect(rows[0]?.priorityDisplay).toBe('HIGH');
    expect(rows[0]?.assignDisplay).toBe('Ravi K.');
    expect(rows[0]?.actionLabel).toBe('🔍 Audit');
    expect(rows[0]?.slaLabel).toMatch(/d open$/);
    expect(rows[0]?.slaIcon).toBe('🚩');
  });

  it('shows closed SLA for completed stock checks', () => {
    const rows = buildWarehouseStockCheckTableRows([
      mkRequest({
        stockCheckStatus: 'Completed',
        stockCheckNotes: JSON.stringify({
          updatedAt: '2026-06-22T10:00:00.000Z',
          lines: [],
        }),
      }),
    ]);
    expect(rows[0]?.slaLabel).toBe('closed 22-Jun');
    expect(rows[0]?.actionLabel).toBe('View');
  });

  it('warehouseStockCheckSlaClass maps tone to color', () => {
    expect(warehouseStockCheckSlaClass('bad')).toContain('red');
    expect(warehouseStockCheckSlaClass('ok')).toContain('emerald');
  });
});
