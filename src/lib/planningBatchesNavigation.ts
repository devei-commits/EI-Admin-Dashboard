import type { PlanningBatchAllRow } from '../services/planningExtracted.service';
import type { BatchRow } from '../services/production.service';

/** Order Hub — fulfillment orders view for an SO. */
export function buildOrderHubSoPath(soNumber: string): string {
  const so = String(soNumber || '').trim();
  return so ? `/fulfillment?so=${encodeURIComponent(so)}` : '/fulfillment';
}

export function buildClientHubPath(input: {
  customerName?: string | null;
  clientCode?: string | null;
}): string {
  const code = String(input.clientCode ?? '').trim();
  if (code) return `/client-hub?open=${encodeURIComponent(code)}`;
  const name = String(input.customerName ?? '').trim();
  if (name) return `/client-hub?q=${encodeURIComponent(name)}`;
  return '/client-hub';
}

export function buildMastersPrPathFromBatch(row: Pick<PlanningBatchAllRow, 'productCode' | 'productName'> & { productId?: number | null }): string {
  if (row.productId != null && Number(row.productId) > 0) {
    return `/bom?productId=${row.productId}`;
  }
  const code = String(row.productCode || '').trim();
  return code ? `/bom?pr=${encodeURIComponent(code)}` : '/bom';
}

export function buildProductionBatchDetailPath(prod: BatchRow | undefined): string | null {
  if (!prod) return null;
  const bmr = String(prod.bmrNo ?? '').trim();
  if (!bmr) return null;
  return `/production?section=batches&bmr=${encodeURIComponent(bmr)}`;
}

/** Fulfillment module — batches view filtered to SO / BMR. */
export function buildFulfillmentBatchPath(input: {
  soNumber?: string | null;
  bmrNo?: string | null;
}): string | null {
  const so = String(input.soNumber ?? '').trim();
  const bmr = String(input.bmrNo ?? '').trim();
  if (!so && !bmr) return null;
  const params = new URLSearchParams();
  params.set('view', 'batches');
  if (so) params.set('so', so);
  if (bmr) params.set('bmr', bmr);
  return `/fulfillment?${params.toString()}`;
}
