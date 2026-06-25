import { describe, expect, it } from 'vitest';
import type { GRNRecordFromApi } from '../../services/grn.service';
import type { Order } from '../../types/salesPurchase.types';
import {
  buildActualLeadTimeByMaterialKey,
  computePlanBatchMaterialStatus,
  formatEarliestInHouse,
  formatLeadDaysLabel,
} from '../planBatchMaterialLeadTime';

describe('planBatchMaterialLeadTime', () => {
  it('averages PO order date to GRN receipt days per material', () => {
    const purchaseOrders: Order[] = [
      {
        orderId: 'PO-1001',
        type: 'PO',
        orderDate: '2026-01-01',
        status: 'Open',
        items: [],
      } as Order,
      {
        orderId: 'PO-1002',
        type: 'PO',
        orderDate: '2026-02-01',
        status: 'Open',
        items: [],
      } as Order,
    ];
    const grnList: GRNRecordFromApi[] = [
      {
        id: '1',
        grnNo: 'GRN-1',
        poNo: 'PO-1001',
        vendor: 'Croda',
        type: 'RM',
        items: 1,
        poValue: 0,
        expectedDate: '2026-01-10',
        receivedDate: '2026-01-15',
        assignedTo: '',
        qcStatus: '',
        qcBy: '',
        status: 'Completed',
        grnDate: '2026-01-15',
        lineItems: [{ id: 'l1', item: 'SLES', itemCode: '1000098', poQty: 100, rcvdQty: 100, invoiceQty: 100, unitPrice: 1, diff: 0, qcStatus: '', qcBy: '' }],
      },
      {
        id: '2',
        grnNo: 'GRN-2',
        poNo: 'PO-1002',
        vendor: 'Croda',
        type: 'RM',
        items: 1,
        poValue: 0,
        expectedDate: '2026-02-20',
        receivedDate: '2026-02-09',
        assignedTo: '',
        qcStatus: '',
        qcBy: '',
        status: 'Completed',
        grnDate: '2026-02-09',
        lineItems: [{ id: 'l2', item: 'SLES', itemCode: '1000098', poQty: 50, rcvdQty: 50, invoiceQty: 50, unitPrice: 1, diff: 0, qcStatus: '', qcBy: '' }],
      },
    ];

    const map = buildActualLeadTimeByMaterialKey(purchaseOrders, grnList, 6);
    const stats = map.get('RM:1000098');
    expect(stats).toBeDefined();
    expect(stats?.sampleCount).toBe(2);
    expect(stats?.avgDays).toBe(11);
    expect(stats?.subLabel).toContain('avg of 2 POs');
  });

  it('computePlanBatchMaterialStatus follows free vs pipeline rules', () => {
    expect(computePlanBatchMaterialStatus(85, 280, 0, 0, 0)).toBe('AVAILABLE');
    expect(computePlanBatchMaterialStatus(25, 15, 0, 0, 0)).toBe('SHORTAGE');
    expect(computePlanBatchMaterialStatus(5000, 0, 1000, 0, 0)).toBe('UNDER PROCUREMENT');
    expect(computePlanBatchMaterialStatus(5000, 0, 0, 0, 2000)).toBe('UNDER PROCUREMENT');
  });

  it('formatEarliestInHouse shows in stock when free covers req', () => {
    expect(formatEarliestInHouse({ reqQty: 85, free: 280, actualLeadDays: 12, quotedLeadDays: 14 })).toBe('in stock');
  });

  it('formatLeadDaysLabel appends quoted or actual suffix', () => {
    expect(formatLeadDaysLabel(14, 'quoted')).toBe('14d quoted');
    expect(formatLeadDaysLabel(12.3, 'actual')).toBe('12.3d actual');
    expect(formatLeadDaysLabel(null, 'quoted')).toBe('—');
  });
});
