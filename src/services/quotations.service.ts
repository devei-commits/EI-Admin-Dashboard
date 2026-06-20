/**
 * Quotations API — pricing + timeline engine, grades, overheads, timeline
 * config, and saved quotes. Backend: /api/v1/quotes/* (super_admin only).
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

// ─────────────── Types ───────────────
export interface BmapEntry { b: string; f: number; }

export interface QuoteGrade {
  id: number;
  name: string;
  description?: string | null;
  moq_labels: string[];
  moq_values: number[];
  markups: number[];
  zero_pm: boolean;
  bmap: BmapEntry[];
  qc_days?: number | null;
  is_system: boolean;
  grade_ref?: string | null;
}

export interface OverheadRow {
  id: number;
  product_category: string;
  head_name: string;
  band_values: number[];
  sort_order: number;
}

export interface ProcurementRule {
  id: number;
  material_type: 'RM' | 'PM';
  category_or_material: string;
  individual_lead_days: number;
  batch_lead_days: number | null;
  notes?: string | null;
  sort_order: number;
}

export interface ManufacturingRule {
  id: number;
  product_type: string;
  product_subtype: string;
  band_index: number;
  manufacturing_days: number;
  cycle_time_days: number | null;
  notes?: string | null;
}

export interface QcRule { id: number; grade_ref: string; qc_days: number; notes?: string | null; }
export interface DispatchRule { id: number; grade_ref: string; dispatch_days: number; notes?: string | null; }

export interface BandTimeline {
  procurement: number; manufacturing: number; cycle_time: number;
  qc: number; dispatch: number; total: number; weeks: number;
  product_type: string; procurement_source: string;
}

export interface QuoteBand {
  moq: string; moqv: number;
  conversion: number; overhead: number; rm: number; pm: number;
  cost_base: number; credit: number; total_cost: number;
  markup_pct: number; gross_margin_pct: number; margin_amt: number;
  sell_price: number; target: number; gap: number;
  timeline: BandTimeline;
}

export interface RmDetail { name: string; rm_code: string; pct_w_w: number; price_per_kg: number; db_price: number | null; vendor_price: number | null; price_source: string | null; landed_per_kg: number; weighted_contribution: number; missing_price: boolean; }
export interface PmDetail { name: string; pm_code: string; qty_per_unit: number; price_per_pc: number; db_price: number | null; vendor_price: number | null; price_source: string | null; landed_per_pc: number; line_total: number; missing_price: boolean; }
export interface MissingSgLine { raw_material_id: number | null; rm_code: string; name: string; pct_w_w: number; }

export interface SgInfo {
  blended_sg: number | null;
  blended_sg_partial: number;
  sg_complete: boolean;
  sg_known_pct: number;
  missing_sg_lines: MissingSgLine[];
  sg_used: number;
}

export interface QuoteResult {
  bom_id: number | null;
  bom_code: string; bom_name: string; pack_size: string; product_code?: string | null;
  grade: number; grade_ref: string; grade_name: string;
  product_type: string; overhead_category: string; pricing_source?: string;
  zero_pm: boolean; has_weight: boolean;
  volume_ml: number; sg: number; weight_per_unit_kg: number;
  landing_factor: number; total_pct_ww: number;
  blended_rm_ex_works: number; blended_rm_landed: number; total_rm: number; total_pm: number;
  rm_detail: RmDetail[]; pm_detail: PmDetail[];
  sg_info: SgInfo | null;
  bands: QuoteBand[];
  target_calc?: TargetCalc[];
  warnings: string[];
}

export interface TargetCalc { moq: string; required_rm_kg_landed: number; required_rm_kg_exworks: number; current_rm_kg_landed: number; gap: number; feasible: boolean; }

export interface CalculatePayload {
  bom_id?: number;
  name?: string;
  rmLines?: Array<Record<string, unknown>>;
  pmLines?: Array<Record<string, unknown>>;
  volumeMl?: number; sg?: number;
  packagingType?: string; volumeKey?: string; monocarton?: boolean;
  rmWastage?: number; pmWastage?: number; rmLogistics?: number; pmLogistics?: number;
  freightPct?: number; insurancePct?: number; handlingPct?: number;
  creditDays?: number; annualRate?: number;
  grade?: number; customMargins?: number[] | null; targetPrice?: number;
  rmOverrides?: Record<string, number>; pmOverrides?: Record<string, number>; sgOverrides?: Record<string, number>;
  useBatchLead?: boolean; productSubtype?: string; pricingSource?: 'master' | 'vendor';
}

export interface StatusEvent { from: string; to: string; by: number | null; by_name: string | null; note: string | null; at: string; }

export interface SavedQuoteListItem {
  id: number; quote_ref: string; quote_name: string; customer_name: string | null;
  bom_id: number | null; bom_code: string | null; grade: number | null; mode: string | null;
  status: string; sales_order_ref: string | null; headline_sell: number | null; headline_moq: string | null; notes: string | null; created_at: string;
}

export interface SavedQuoteFull extends SavedQuoteListItem {
  payload: Record<string, unknown>; result: QuoteResult; status_history: StatusEvent[];
  sales_order_id: number | null;
  version: number; root_quote_id: number | null; superseded_by: number | null;
  gst_pct: number; valid_until: string | null; client_id: number | null; prepared_by: string | null;
}

export interface VersionItem { id: number; quote_ref: string; version: number; status: string; headline_sell: number | null; superseded_by: number | null; created_at: string; }

function fail<T>(e: unknown, fallback: T, msg: string): ServiceResult<T> {
  const message = e instanceof Error ? e.message : msg;
  return { data: fallback, error: message as unknown as ServiceResult<T>['error'], success: false };
}

// ─────────────── Calculate ───────────────
export async function calculateQuote(payload: CalculatePayload): Promise<ServiceResult<QuoteResult>> {
  try {
    const data = await api.post<QuoteResult>('/api/v1/quotes/calculate', payload);
    return { data, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as QuoteResult, 'Failed to calculate quote'); }
}

// ─────────────── Grades ───────────────
export async function fetchGrades(): Promise<ServiceResult<QuoteGrade[]>> {
  try {
    const d = await api.get<{ grades: QuoteGrade[] }>('/api/v1/quotes/grades');
    return { data: d.grades ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load grades'); }
}
export async function createGrade(payload: Partial<QuoteGrade>): Promise<ServiceResult<QuoteGrade>> {
  try {
    const d = await api.post<{ grade: QuoteGrade }>('/api/v1/quotes/grades', payload);
    return { data: d.grade, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as QuoteGrade, 'Failed to create grade'); }
}
export async function updateGrade(id: number, payload: Partial<QuoteGrade>): Promise<ServiceResult<QuoteGrade>> {
  try {
    const d = await api.put<{ grade: QuoteGrade }>(`/api/v1/quotes/grades/${id}`, payload);
    return { data: d.grade, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as QuoteGrade, 'Failed to update grade'); }
}
export async function deleteGrade(id: number): Promise<ServiceResult<null>> {
  try { await api.delete(`/api/v1/quotes/grades/${id}`); return { data: null, error: null, success: true }; }
  catch (e) { return fail(e, null, 'Failed to delete grade'); }
}

// ─────────────── Overheads ───────────────
export async function fetchOverheads(category?: string): Promise<ServiceResult<OverheadRow[]>> {
  try {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const d = await api.get<{ overheads: OverheadRow[] }>(`/api/v1/quotes/overheads${qs}`);
    return { data: d.overheads ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load overheads'); }
}
export async function createOverhead(payload: Partial<OverheadRow>): Promise<ServiceResult<OverheadRow>> {
  try {
    const d = await api.post<{ overhead: OverheadRow }>('/api/v1/quotes/overheads', payload);
    return { data: d.overhead, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as OverheadRow, 'Failed to create overhead'); }
}
export async function updateOverhead(id: number, payload: Partial<OverheadRow>): Promise<ServiceResult<OverheadRow>> {
  try {
    const d = await api.put<{ overhead: OverheadRow }>(`/api/v1/quotes/overheads/${id}`, payload);
    return { data: d.overhead, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as OverheadRow, 'Failed to update overhead'); }
}
export async function deleteOverhead(id: number): Promise<ServiceResult<null>> {
  try { await api.delete(`/api/v1/quotes/overheads/${id}`); return { data: null, error: null, success: true }; }
  catch (e) { return fail(e, null, 'Failed to delete overhead'); }
}

// ─────────────── Timeline: procurement ───────────────
export async function fetchProcurementRules(type?: 'RM' | 'PM'): Promise<ServiceResult<ProcurementRule[]>> {
  try {
    const qs = type ? `?type=${type}` : '';
    const d = await api.get<{ rules: ProcurementRule[] }>(`/api/v1/quotes/timeline/procurement${qs}`);
    return { data: d.rules ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load procurement rules'); }
}
export async function createProcurementRule(p: Partial<ProcurementRule>): Promise<ServiceResult<ProcurementRule>> {
  try { const d = await api.post<{ rule: ProcurementRule }>('/api/v1/quotes/timeline/procurement', p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as ProcurementRule, 'Failed to create rule'); }
}
export async function updateProcurementRule(id: number, p: Partial<ProcurementRule>): Promise<ServiceResult<ProcurementRule>> {
  try { const d = await api.put<{ rule: ProcurementRule }>(`/api/v1/quotes/timeline/procurement/${id}`, p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as ProcurementRule, 'Failed to update rule'); }
}
export async function deleteProcurementRule(id: number): Promise<ServiceResult<null>> {
  try { await api.delete(`/api/v1/quotes/timeline/procurement/${id}`); return { data: null, error: null, success: true }; }
  catch (e) { return fail(e, null, 'Failed to delete rule'); }
}

// ─────────────── Timeline: manufacturing ───────────────
export async function fetchManufacturingRules(type?: string): Promise<ServiceResult<ManufacturingRule[]>> {
  try {
    const qs = type ? `?type=${encodeURIComponent(type)}` : '';
    const d = await api.get<{ rules: ManufacturingRule[] }>(`/api/v1/quotes/timeline/manufacturing${qs}`);
    return { data: d.rules ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load manufacturing rules'); }
}
export async function createManufacturingRule(p: Partial<ManufacturingRule>): Promise<ServiceResult<ManufacturingRule>> {
  try { const d = await api.post<{ rule: ManufacturingRule }>('/api/v1/quotes/timeline/manufacturing', p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as ManufacturingRule, 'Failed to create rule'); }
}
export async function updateManufacturingRule(id: number, p: Partial<ManufacturingRule>): Promise<ServiceResult<ManufacturingRule>> {
  try { const d = await api.put<{ rule: ManufacturingRule }>(`/api/v1/quotes/timeline/manufacturing/${id}`, p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as ManufacturingRule, 'Failed to update rule'); }
}
export async function deleteManufacturingRule(id: number): Promise<ServiceResult<null>> {
  try { await api.delete(`/api/v1/quotes/timeline/manufacturing/${id}`); return { data: null, error: null, success: true }; }
  catch (e) { return fail(e, null, 'Failed to delete rule'); }
}

// ─────────────── Timeline: QC + dispatch ───────────────
export async function fetchQcRules(): Promise<ServiceResult<QcRule[]>> {
  try { const d = await api.get<{ rules: QcRule[] }>('/api/v1/quotes/timeline/qc'); return { data: d.rules ?? [], error: null, success: true }; }
  catch (e) { return fail(e, [], 'Failed to load QC rules'); }
}
export async function upsertQcRule(p: { grade_ref: string; qc_days: number; notes?: string }): Promise<ServiceResult<QcRule>> {
  try { const d = await api.post<{ rule: QcRule }>('/api/v1/quotes/timeline/qc', p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as QcRule, 'Failed to save QC rule'); }
}
export async function fetchDispatchRules(): Promise<ServiceResult<DispatchRule[]>> {
  try { const d = await api.get<{ rules: DispatchRule[] }>('/api/v1/quotes/timeline/dispatch'); return { data: d.rules ?? [], error: null, success: true }; }
  catch (e) { return fail(e, [], 'Failed to load dispatch config'); }
}
export async function upsertDispatchRule(p: { grade_ref: string; dispatch_days: number; notes?: string }): Promise<ServiceResult<DispatchRule>> {
  try { const d = await api.post<{ rule: DispatchRule }>('/api/v1/quotes/timeline/dispatch', p); return { data: d.rule, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as DispatchRule, 'Failed to save dispatch config'); }
}

// ─────────────── Saved quotes ───────────────
export async function saveQuote(payload: {
  quote_name?: string; customer_name?: string; notes?: string;
  payload: Record<string, unknown>; result: QuoteResult;
  gst_pct?: number; valid_until?: string; client_id?: number; prepared_by?: string;
}): Promise<ServiceResult<{ id: number; quote_ref: string; created_at: string }>> {
  try { const d = await api.post<{ id: number; quote_ref: string; created_at: string }>('/api/v1/quotes/save', payload); return { data: d, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as { id: number; quote_ref: string; created_at: string }, 'Failed to save quote'); }
}
export interface ClientItem { id: number; entity_code: string | null; name: string; email: string | null; segment: string | null; payment_terms: string | null; city: string | null; }
export async function searchClients(search = ''): Promise<ServiceResult<ClientItem[]>> {
  try {
    const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const d = await api.get<{ clients: ClientItem[] }>(`/api/v1/quotes/clients${qs}`);
    return { data: d.clients ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load clients'); }
}

export interface QuoteAnalytics {
  total: number; converted: number; avg_sell: number | null;
  by_status: Record<string, number>;
  win_rate: number | null; conversion_rate: number | null;
  top_boms: { bom_code: string; name: string; c: number }[];
  by_month: { m: string; c: number }[];
  recent: { id: number; quote_ref: string; quote_name: string; status: string; headline_sell: string | number | null; created_at: string }[];
}
export async function fetchAnalytics(): Promise<ServiceResult<QuoteAnalytics>> {
  try {
    const d = await api.get<QuoteAnalytics>('/api/v1/quotes/analytics');
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as QuoteAnalytics, 'Failed to load analytics'); }
}

export interface QuoteStats { total: number; by_status: Record<string, number>; converted: number; }
export async function fetchQuoteStats(): Promise<ServiceResult<QuoteStats>> {
  try {
    const d = await api.get<QuoteStats>('/api/v1/quotes/stats');
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { total: 0, by_status: {}, converted: 0 }, 'Failed to load stats'); }
}

export async function fetchSavedQuotes(search?: string, limit = 50, offset = 0, status?: string, clientId?: number): Promise<ServiceResult<{ quotes: SavedQuoteListItem[]; total: number }>> {
  try {
    const params = new URLSearchParams();
    if (search?.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (clientId) params.set('client_id', String(clientId));
    params.set('limit', String(limit)); params.set('offset', String(offset));
    const d = await api.get<{ quotes: SavedQuoteListItem[]; total: number }>(`/api/v1/quotes/saved?${params.toString()}`);
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { quotes: [], total: 0 }, 'Failed to load saved quotes'); }
}

export async function changeQuoteStatus(id: number, status: string, note?: string): Promise<ServiceResult<{ status: string; status_history: StatusEvent[] }>> {
  try {
    const d = await api.post<{ status: string; status_history: StatusEvent[] }>(`/api/v1/quotes/saved/${id}/status`, { status, note });
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as { status: string; status_history: StatusEvent[] }, 'Failed to change status'); }
}

export async function convertQuoteToSO(id: number, band_index: number, quantity?: number, unit_price?: number): Promise<ServiceResult<{ sales_order_id: number; order_id: string }>> {
  try {
    const d = await api.post<{ sales_order_id: number; order_id: string }>(`/api/v1/quotes/saved/${id}/convert`, { band_index, quantity, unit_price });
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as { sales_order_id: number; order_id: string }, 'Failed to convert quote'); }
}

export async function reviseQuote(id: number): Promise<ServiceResult<{ id: number; quote_ref: string; version: number }>> {
  try {
    const d = await api.post<{ id: number; quote_ref: string; version: number }>(`/api/v1/quotes/saved/${id}/revise`, {});
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, null as unknown as { id: number; quote_ref: string; version: number }, 'Failed to revise quote'); }
}

export async function fetchVersions(id: number): Promise<ServiceResult<VersionItem[]>> {
  try {
    const d = await api.get<{ versions: VersionItem[] }>(`/api/v1/quotes/saved/${id}/versions`);
    return { data: d.versions ?? [], error: null, success: true };
  } catch (e) { return fail(e, [], 'Failed to load versions'); }
}
export async function fetchSavedQuote(id: number): Promise<ServiceResult<SavedQuoteFull>> {
  try { const d = await api.get<SavedQuoteFull>(`/api/v1/quotes/saved/${id}`); return { data: d, error: null, success: true }; }
  catch (e) { return fail(e, null as unknown as SavedQuoteFull, 'Failed to load quote'); }
}
export async function deleteSavedQuote(id: number): Promise<ServiceResult<null>> {
  try { await api.delete(`/api/v1/quotes/saved/${id}`); return { data: null, error: null, success: true }; }
  catch (e) { return fail(e, null, 'Failed to delete quote'); }
}

// ─────────────── Audit log ───────────────
export interface AuditEntry { id: number; entity_type: string; entity_id: number | null; action: string; summary: string | null; changed_by_name: string | null; created_at: string; }
export async function fetchAudit(entityType = '', limit = 50, offset = 0): Promise<ServiceResult<{ entries: AuditEntry[]; total: number }>> {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (entityType) params.set('entity_type', entityType);
    const d = await api.get<{ entries: AuditEntry[]; total: number }>(`/api/v1/quotes/audit?${params.toString()}`);
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { entries: [], total: 0 }, 'Failed to load audit log'); }
}

// ─────────────── Material lead-time tooling ───────────────
export interface LeadTimeItem {
  id: number; code: string; name: string; klass: string | null;
  lead_time_days: number | null; vendor_lead: number | null;
}
export async function fetchLeadTimes(type: 'RM' | 'PM', search = '', missingOnly = false, limit = 50, offset = 0): Promise<ServiceResult<{ items: LeadTimeItem[]; total: number }>> {
  try {
    const params = new URLSearchParams({ type, limit: String(limit), offset: String(offset) });
    if (search.trim()) params.set('search', search.trim());
    if (missingOnly) params.set('missingOnly', 'true');
    const d = await api.get<{ items: LeadTimeItem[]; total: number }>(`/api/v1/quotes/lead-times?${params.toString()}`);
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { items: [], total: 0 }, 'Failed to load lead times'); }
}
export async function saveLeadTimes(type: 'RM' | 'PM', updates: { id: number; lead_time_days: number | null }[]): Promise<ServiceResult<{ updated: number }>> {
  try {
    const d = await api.post<{ updated: number }>('/api/v1/quotes/lead-times', { type, updates });
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { updated: 0 }, 'Failed to save lead times'); }
}

// ─────────────── Raw-material SG persistence ───────────────
export async function saveRmSg(updates: { raw_material_id: number; specific_gravity: number }[]): Promise<ServiceResult<{ updated: number }>> {
  try {
    const d = await api.post<{ updated: number }>('/api/v1/quotes/rm-sg', { updates });
    return { data: d, error: null, success: true };
  } catch (e) { return fail(e, { updated: 0 }, 'Failed to save SG to master'); }
}
