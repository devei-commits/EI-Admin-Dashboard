/**
 * Vendor / Client master API.
 * Backend: GET /api/v1/vendor-client?type=, GET /api/v1/vendor-client/next-code?type=, GET/POST/PUT/DELETE /api/v1/vendor-client/:id
 */

import type { ServiceResult } from "../types/api.types";
import { api } from "../lib/apiClient";

/** Returned on vendor create/update when Vendor Items are synced to Items List price tables */
export interface PriceListSyncResult {
  synced: number;
  removed: number;
  skipped: Array<{ code: string; type: string; reason: string }>;
}

export interface VendorClientRecord {
  id: string;
  type: "vendor" | "client";
  /** users.userid when this master is linked to a portal/login user */
  userId?: string | null;
  zohoId?: string;
  /** Set when backend syncs vendor/client to Zoho Books on create or update */
  zoho_sync?: { synced: boolean; contact_id?: string; error?: string };
  /** Present for vendors after save when backend syncs vendorItems → items_list */
  priceListSync?: PriceListSyncResult;
  name: string;
  email: string;
  phone: string;
  location: string;
  country: string;
  city?: string;
  category: string;
  status: "active" | "inactive" | "pending";
  paymentTerms: string;
  notes: string;
  rating: number;
  moq: string;
  leadTime: string;
  createdAt: string;
  lastModified: string;
  data: Record<string, unknown>;
}

export interface PaginatedRowsResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateVendorClientPayload {
  type: "vendor" | "client";
  entityCode: string;
  zohoId?: string | null;
  /** Optional link to portal/user management record. */
  userId?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  country?: string;
  city?: string;
  category?: string;
  status?: string;
  paymentTerms?: string;
  notes?: string;
  data?: Record<string, unknown>;
}

export async function fetchVendorClients(
  type?: "vendor" | "client",
): Promise<ServiceResult<VendorClientRecord[]>> {
  try {
    const qs = type ? `?type=${type}` : "";
    const list = await api.get<VendorClientRecord[]>(
      `/api/v1/vendor-client${qs}`,
    );
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load vendor/client list";
    return { data: [], error: message, success: false };
  }
}

/**
 * Paginated list view for Vendor/Client.
 * Backend returns `{ rows, total, limit, offset }` when limit/offset are provided.
 */
export async function fetchVendorClientsPage(opts: {
  type: "vendor" | "client";
  search?: string;
  status?: VendorClientRecord['status'] | 'all';
  category?: string | 'all';
  limit?: number;
  offset?: number;
}): Promise<PaginatedRowsResponse<VendorClientRecord>> {
  const params = new URLSearchParams();
  params.set('type', opts.type);
  if (opts.search != null && opts.search.trim()) params.set('search', opts.search.trim());
  if (opts.status && opts.status !== 'all') params.set('status', opts.status);
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  params.set('limit', String(opts.limit ?? 10));
  params.set('offset', String(opts.offset ?? 0));

  const path = `/api/v1/vendor-client?${params.toString()}`;
  const resp = await api.get<PaginatedRowsResponse<VendorClientRecord>>(path);
  return {
    rows: resp?.rows ?? [],
    total: resp?.total ?? 0,
    limit: resp?.limit ?? (opts.limit ?? 10),
    offset: resp?.offset ?? (opts.offset ?? 0),
  };
}

export async function fetchVendorClientById(
  id: string,
): Promise<ServiceResult<VendorClientRecord>> {
  try {
    const row = await api.get<VendorClientRecord>(
      `/api/v1/vendor-client/${id}`,
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load vendor/client";
    return { data: null, error: message, success: false };
  }
}

/** Response from POST /vendor-client/sync-zoho (draft → Zoho Books contact) */
export interface SyncZohoVendorDraftResponse {
  zohoId: string;
  /** Fields to merge into VendorForm state (camelCase keys) */
  mappedFields: Record<string, string>;
  alreadySynced?: boolean;
  zoho_sync?: { synced: boolean; contact_id?: string };
}

/**
 * Create a Zoho Books vendor contact from the current form draft and return contact id + mapped fields.
 * Does not persist a vendor_client row.
 */
export async function syncVendorDraftToZoho(
  payload: CreateVendorClientPayload,
): Promise<ServiceResult<SyncZohoVendorDraftResponse>> {
  try {
    const body = {
      type: payload.type,
      entityCode: payload.entityCode,
      ...(payload.userId != null && payload.userId !== ""
        ? { userId: payload.userId }
        : {}),
      zohoId: payload.zohoId ?? undefined,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      location: payload.location,
      country: payload.country,
      city: payload.city,
      category: payload.category,
      status: payload.status ?? "pending",
      paymentTerms: payload.paymentTerms,
      notes: payload.notes,
      data: payload.data ?? {},
    };
    const row = await api.post<SyncZohoVendorDraftResponse>(
      "/api/v1/vendor-client/sync-zoho",
      body,
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const err = e as Error & { status?: number; body?: { error?: string } };
    const message =
      err.body?.error ??
      (err instanceof Error ? err.message : "Zoho sync failed");
    return {
      data: null,
      error: { code: "ERROR", message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function fetchNextCode(
  type: "vendor" | "client",
): Promise<ServiceResult<string>> {
  try {
    const res = await api.get<{ nextCode: string }>(
      `/api/v1/vendor-client/next-code?type=${type}`,
    );
    return { data: res?.nextCode ?? "", error: null, success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to generate next code";
    return { data: "", error: message, success: false };
  }
}

export async function createVendorClient(
  payload: CreateVendorClientPayload,
): Promise<ServiceResult<VendorClientRecord>> {
  try {
    const body = {
      type: payload.type,
      entityCode: payload.entityCode,
      ...(payload.userId != null && payload.userId !== ""
        ? { userId: payload.userId }
        : {}),
      zohoId: payload.zohoId ?? undefined,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      location: payload.location,
      country: payload.country,
      city: payload.city,
      category: payload.category,
      status: payload.status ?? "pending",
      paymentTerms: payload.paymentTerms,
      notes: payload.notes,
      data: payload.data ?? {},
    };
    const row = await api.post<VendorClientRecord>(
      "/api/v1/vendor-client",
      body,
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const err = e as Error & { status?: number; body?: { error?: string } };
    const message =
      err.body?.error ??
      (err instanceof Error ? err.message : "Failed to create vendor/client");
    return {
      data: null,
      error: { code: "ERROR", message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function updateVendorClient(
  id: string,
  payload: Partial<CreateVendorClientPayload> & {
    data?: Record<string, unknown>;
  },
): Promise<ServiceResult<VendorClientRecord>> {
  try {
    const row = await api.put<VendorClientRecord>(
      `/api/v1/vendor-client/${id}`,
      payload,
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update vendor/client";
    return { data: null, error: message, success: false };
  }
}

export async function deleteVendorClient(
  id: string,
): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/vendor-client/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to delete vendor/client";
    return { data: null, error: message, success: false };
  }
}
