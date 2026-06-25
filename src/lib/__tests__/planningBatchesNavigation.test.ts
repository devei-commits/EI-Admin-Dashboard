import { describe, expect, it } from 'vitest';
import {
  buildClientHubPath,
  buildFulfillmentBatchPath,
  buildMastersPrPathFromBatch,
  buildOrderHubSoPath,
  buildProductionBatchDetailPath,
} from '../planningBatchesNavigation';
import type { BatchRow } from '../../services/production.service';

describe('planningBatchesNavigation', () => {
  it('buildOrderHubSoPath targets fulfillment with SO', () => {
    expect(buildOrderHubSoPath('SO-2026-001')).toBe('/fulfillment?so=SO-2026-001');
  });

  it('buildClientHubPath prefers entity code', () => {
    expect(buildClientHubPath({ customerName: 'Acme', clientCode: 'CL-001' })).toBe(
      '/client-hub?open=CL-001',
    );
  });

  it('buildMastersPrPathFromBatch uses product id when present', () => {
    expect(buildMastersPrPathFromBatch({ productId: 42, productCode: 'PR-1', productName: 'X' })).toBe(
      '/bom?productId=42',
    );
  });

  it('buildProductionBatchDetailPath uses bmr number', () => {
    const prod = { bmrNo: 'BMR-100' } as BatchRow;
    expect(buildProductionBatchDetailPath(prod)).toBe('/production?section=batches&bmr=BMR-100');
  });

  it('buildFulfillmentBatchPath opens batches view', () => {
    expect(buildFulfillmentBatchPath({ soNumber: 'SO-1', bmrNo: 'BMR-1' })).toBe(
      '/fulfillment?view=batches&so=SO-1&bmr=BMR-1',
    );
  });
});
