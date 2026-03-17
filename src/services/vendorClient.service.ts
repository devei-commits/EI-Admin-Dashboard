/**
 * Vendor / Client master API.
 * Backend: GET /api/v1/vendor-client?type=, GET /api/v1/vendor-client/next-code?type=, GET/POST/PUT/DELETE /api/v1/vendor-client/:id
 */

import type { ServiceResult } from "../types/api.types";
import { api } from "../lib/apiClient";

export interface VendorClientRecord {
  id: string;
  type: "vendor" | "client";
  zohoId?: string;
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

export interface CreateVendorClientPayload {
  type: "vendor" | "client";
  entityCode: string;
  zohoId?: string | null;
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
      err.body?.error ?? (err instanceof Error ? err.message : "Failed to create vendor/client");
    return { data: null, error: { code: "ERROR", message, timestamp: new Date().toISOString() }, success: false };
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
