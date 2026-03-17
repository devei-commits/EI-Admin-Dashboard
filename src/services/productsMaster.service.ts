/**
 * Products Master (PR) — list and detail for PR panel.
 * Backend: GET /api/v1/products (list with counts), GET /api/v1/products/:id/detail (full panel data).
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface PRProductListItem {
  product_id: number;
  product_code: string;
  product_sku: string;
  product_name: string;
  category: string;
  form?: string;
  fill_size?: string;
  batch_size_kg?: number;
  shelf_life_months?: number;
  mrp_price?: number;
  status?: string;
  version?: string;
  rm_ingredients_count: number;
  pack_items_count: number;
  open_sos_count: number;
}

export interface FormulaBomPhase {
  phase: string;
  ingredients: { inci_name: string; rm_code: string; pct_w_w: number; uom: string }[];
}

export interface PackBomRow {
  row_number: number;
  /** Pack Material id from PM table (for linking to Pack Materials); null if only code known */
  pm_id: number | null;
  pm_description: string;
  pm_code: string;
  pack_type: string;
  qty_per_unit: number;
  uom: string;
}

export interface ProcessStep {
  step_number: number;
  description: string;
  duration_minutes: number;
}

export interface OpenSalesOrder {
  order_id: string;
  customer_name: string;
  quantity: number;
  status: string;
}

export interface PRProductDetail extends PRProductListItem {
  product_description?: string;
  license_cml?: string;
  theoretical_yield_pct?: number;
  pao_months?: number;
  manufacturing_location?: string;
  equipment_vessel?: string;
  storage_conditions?: string;
  approved_claims?: string;
  ph_range?: string;
  viscosity_range?: string;
  spf_pa_rating?: string;
  appearance?: string;
  odour?: string;
  fill_weight_spec?: string;
  stability_summary?: string;
  formulaBom: FormulaBomPhase[];
  packBom: PackBomRow[];
  processSteps: ProcessStep[];
  openSalesOrders: OpenSalesOrder[];
}

export async function fetchPRProducts(): Promise<ServiceResult<PRProductListItem[]>> {
  try {
    const list = await api.get<PRProductListItem[]>('/api/v1/products');
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load products';
    return { data: [], error: message, success: false };
  }
}

export async function fetchPRProductDetail(productId: number | string): Promise<ServiceResult<PRProductDetail>> {
  try {
    const detail = await api.get<PRProductDetail>(`/api/v1/products/${productId}/detail`);
    return { data: detail ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load product detail';
    return { data: null, error: message, success: false };
  }
}

/** Payload for updating a PR product. Use snake_case for backend; optional bom for linked BOM. */
export interface UpdatePRProductPayload {
  product_name?: string;
  product_code?: string;
  product_sku?: string;
  product_description?: string;
  category?: string;
  status?: string;
  form?: string;
  fill_size?: string;
  batch_size_kg?: number;
  shelf_life_months?: number;
  version?: string;
  license_cml?: string;
  theoretical_yield_pct?: number;
  pao_months?: number;
  mrp_price?: number;
  manufacturing_location?: string;
  equipment_vessel?: string;
  storage_conditions?: string;
  approved_claims?: string;
  ph_range?: string;
  viscosity_range?: string;
  spf_pa_rating?: string;
  appearance?: string;
  odour?: string;
  fill_weight_spec?: string;
  stability_summary?: string;
  bom?: {
    rm_lines?: unknown[];
    pm_lines?: unknown[];
    process_steps?: ProcessStep[];
    ph_range?: string;
    yield_pct?: string;
    stability_summary?: string;
  };
}

export async function updatePRProduct(
  productId: number | string,
  payload: UpdatePRProductPayload
): Promise<ServiceResult<PRProductDetail>> {
  try {
    await api.put(`/api/v1/products/${productId}`, payload);
    const res = await fetchPRProductDetail(productId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update product';
    return { data: null, error: message, success: false };
  }
}

/**
 * Delete product by id. Backend: DELETE /api/v1/products/:id
 */
export async function deletePRProduct(productId: number | string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/products/${productId}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete product';
    return { data: null, error: message, success: false };
  }
}
