/**
 * BD Management API client — mirrors the procurement.service.ts convention:
 * thin wrappers over `api.*` returning `ServiceResult<T>` so views get a uniform
 * { success, data, error } shape. Backend mounted at /api/v1/bd.
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type {
  BdCustomerRow, BdCustomerDetail, BdTimelineEvent, BdProfilePatch, BdEventInput,
  BdQueryRow, BdGrievanceRow, BdMeetingRow,
  BdQueryInput, BdGrievanceInput, BdMeetingInput, BdTransitionInput,
} from '../types/bd.types';

const BASE = '/api/v1/bd';

function errMsg(e: unknown, fallback: string): string {
  const anyE = e as { body?: { error?: string }; message?: string };
  return anyE?.body?.error || anyE?.message || fallback;
}

/** GET /bd/customers — Customer Tracker rows. */
export async function fetchBdCustomers(): Promise<ServiceResult<BdCustomerRow[]>> {
  try {
    const data = await api.get<BdCustomerRow[]>(`${BASE}/customers`);
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    console.error('fetchBdCustomers', e);
    return { success: false, data: [], error: errMsg(e, 'Failed to load customers') };
  }
}

/** GET /bd/customers/:code — detail (§3A). */
export async function fetchBdCustomerDetail(code: string): Promise<ServiceResult<BdCustomerDetail | null>> {
  try {
    const data = await api.get<BdCustomerDetail>(`${BASE}/customers/${encodeURIComponent(code)}`);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('fetchBdCustomerDetail', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to load customer') };
  }
}

/** GET /bd/customers/:code/timeline — History & Comments (§3B). */
export async function fetchBdTimeline(code: string): Promise<ServiceResult<BdTimelineEvent[]>> {
  try {
    const data = await api.get<BdTimelineEvent[]>(`${BASE}/customers/${encodeURIComponent(code)}/timeline`);
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    console.error('fetchBdTimeline', e);
    return { success: false, data: [], error: errMsg(e, 'Failed to load timeline') };
  }
}

/** POST /bd/customers/:code/events — add a manual comment/event. */
export async function addBdEvent(code: string, input: BdEventInput): Promise<ServiceResult<BdTimelineEvent | null>> {
  try {
    const data = await api.post<BdTimelineEvent>(`${BASE}/customers/${encodeURIComponent(code)}/events`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('addBdEvent', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to add comment') };
  }
}

/** PUT /bd/customers/:code/profile — set BD enrichment (tier/lifecycle/POC/…). */
export async function updateBdProfile(code: string, patch: BdProfilePatch): Promise<ServiceResult<BdCustomerDetail | null>> {
  try {
    const data = await api.put<BdCustomerDetail>(`${BASE}/customers/${encodeURIComponent(code)}/profile`, patch);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('updateBdProfile', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to update profile') };
  }
}

/* ════════════════════════ Phase 2 — Queries (§3F) ════════════════════════ */
type QueryFilters = { status?: string; client?: string; relatedType?: string; origin?: string };
function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchBdQueries(f: QueryFilters = {}): Promise<ServiceResult<BdQueryRow[]>> {
  try {
    const data = await api.get<BdQueryRow[]>(`${BASE}/queries${qs({ status: f.status, client: f.client, related_type: f.relatedType, origin: f.origin })}`);
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    console.error('fetchBdQueries', e);
    return { success: false, data: [], error: errMsg(e, 'Failed to load queries') };
  }
}
export async function createBdQuery(code: string, input: BdQueryInput): Promise<ServiceResult<BdQueryRow | null>> {
  try {
    const data = await api.post<BdQueryRow>(`${BASE}/customers/${encodeURIComponent(code)}/queries`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('createBdQuery', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to create query') };
  }
}
export async function transitionBdQuery(id: string, input: BdTransitionInput): Promise<ServiceResult<BdQueryRow | null>> {
  try {
    const data = await api.post<BdQueryRow>(`${BASE}/queries/${encodeURIComponent(id)}/transition`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('transitionBdQuery', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to update query') };
  }
}

/* ══════════════════════ Phase 2 — Grievances (§3G) ══════════════════════ */
type GrievanceFilters = { status?: string; severity?: string; client?: string };
export async function fetchBdGrievances(f: GrievanceFilters = {}): Promise<ServiceResult<BdGrievanceRow[]>> {
  try {
    const data = await api.get<BdGrievanceRow[]>(`${BASE}/grievances${qs({ status: f.status, severity: f.severity, client: f.client })}`);
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    console.error('fetchBdGrievances', e);
    return { success: false, data: [], error: errMsg(e, 'Failed to load grievances') };
  }
}
export async function createBdGrievance(code: string, input: BdGrievanceInput): Promise<ServiceResult<BdGrievanceRow | null>> {
  try {
    const data = await api.post<BdGrievanceRow>(`${BASE}/customers/${encodeURIComponent(code)}/grievances`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('createBdGrievance', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to create grievance') };
  }
}
export async function transitionBdGrievance(id: string, input: BdTransitionInput): Promise<ServiceResult<BdGrievanceRow | null>> {
  try {
    const data = await api.post<BdGrievanceRow>(`${BASE}/grievances/${encodeURIComponent(id)}/transition`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('transitionBdGrievance', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to update grievance') };
  }
}

/* ════════════════════════ Phase 2 — Meetings (§3H) ════════════════════════ */
type MeetingFilters = { status?: string; client?: string; thisWeek?: boolean };
export async function fetchBdMeetings(f: MeetingFilters = {}): Promise<ServiceResult<BdMeetingRow[]>> {
  try {
    const data = await api.get<BdMeetingRow[]>(`${BASE}/meetings${qs({ status: f.status, client: f.client, this_week: f.thisWeek ? 'true' : undefined })}`);
    return { success: true, data: data ?? [], error: null };
  } catch (e) {
    console.error('fetchBdMeetings', e);
    return { success: false, data: [], error: errMsg(e, 'Failed to load meetings') };
  }
}
export async function createBdMeeting(code: string, input: BdMeetingInput): Promise<ServiceResult<BdMeetingRow | null>> {
  try {
    const data = await api.post<BdMeetingRow>(`${BASE}/customers/${encodeURIComponent(code)}/meetings`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('createBdMeeting', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to create meeting') };
  }
}
export async function transitionBdMeeting(id: string, input: BdTransitionInput): Promise<ServiceResult<BdMeetingRow | null>> {
  try {
    const data = await api.post<BdMeetingRow>(`${BASE}/meetings/${encodeURIComponent(id)}/transition`, input);
    return { success: true, data, error: null };
  } catch (e) {
    console.error('transitionBdMeeting', e);
    return { success: false, data: null, error: errMsg(e, 'Failed to update meeting') };
  }
}
