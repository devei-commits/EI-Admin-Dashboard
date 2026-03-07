/**
 * Procurement Quotations API.
 * Backend: GET/POST/PATCH/DELETE /api/v1/procurement-quotations
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ProcurementQuotationItem {
  raw_material_id?: number;
  pack_material_id?: number;
  itemId: string;
  name: string;
  orderQty: number;
  pricePerUnit: number;
  uom: string;
  totalValue: number;
}

export interface ProcurementQuotation {
  id: number;
  procurementRequestId: number;
  vendorId: number;
  quoteDate: string | null;
  quotedBy: string | null;
  attachmentRef: string | null;
  attachmentStatus: string | null;
  items: ProcurementQuotationItem[];
  leadTimeDays: number | null;
  paymentTerms: string | null;
  validTill: string | null;
  totalValue: number | null;
  notes: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  vendorName?: string | null;
  procurementRequest?: {
    id: number;
    priority: string | null;
    requiredByDate: string | null;
    status: string | null;
  };
}

export interface ProcurementQuotationFilters {
  procurement_request_id?: number;
  vendor_id?: number;
  status?: string;
}

export async function fetchProcurementQuotations(
  filters?: ProcurementQuotationFilters
): Promise<ServiceResult<ProcurementQuotation[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.procurement_request_id != null) params.set('procurement_request_id', String(filters.procurement_request_id));
    if (filters?.vendor_id != null) params.set('vendor_id', String(filters.vendor_id));
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const list = await api.get<ProcurementQuotation[]>(`/api/v1/procurement-quotations${qs}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load procurement quotations';
    return { data: [], error: message, success: false };
  }
}

export async function fetchProcurementQuotationById(
  id: number
): Promise<ServiceResult<ProcurementQuotation | null>> {
  try {
    const row = await api.get<ProcurementQuotation>(`/api/v1/procurement-quotations/${id}`);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load quotation';
    return { data: null, error: message, success: false };
  }
}
