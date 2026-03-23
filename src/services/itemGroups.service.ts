/**
 * Item Groups API — CRUD for RM/PM groups with member_ids from raw_materials / pack_materials.
 * Backend: GET/POST /api/v1/item-groups, GET/PUT/DELETE /api/v1/item-groups/:id
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ItemGroupMember {
  id: string;
  code: string;
  name: string;
  ratio?: number;
  status: 'approved';
}

export interface ItemGroupAlternate {
  id: string;
  item_id: number; // raw_material.id or pack_material.id
  code: string;
  name: string;
  notes: string;
  status: 'proposed' | 'under-review';
  ratio?: number;
}

/** Payload shape when sending proposed alternates to the API (item_id + optional notes/status). */
export type ProposedAlternateInput = { item_id: number; notes?: string; status?: 'proposed' | 'under-review' };

export interface ItemGroupRecord {
  id: string;
  code: string;
  icon: string;
  type: 'RM' | 'PM';
  name: string;
  description: string;
  purpose: string;
  status: string;
  notes: string;
  approvedMembers: ItemGroupMember[];
  proposedAlternates: ItemGroupAlternate[];
  member_ids: number[];
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedRowsResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateItemGroupPayload {
  code: string;
  icon?: string;
  type: 'RM' | 'PM';
  name: string;
  description?: string;
  purpose?: string;
  status?: string;
  notes?: string;
  member_ids?: number[];
  proposedAlternates?: ItemGroupAlternate[];
}

export async function fetchNextItemGroupCode(type: 'RM' | 'PM'): Promise<ServiceResult<{ nextCode: string }>> {
  try {
    const res = await api.get<{ nextCode: string }>(`/api/v1/item-groups/next-code?type=${type}`);
    return { data: res ?? { nextCode: type === 'PM' ? 'IG-PM-001' : 'IG-001' }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get next code';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function fetchItemGroups(type?: 'RM' | 'PM'): Promise<ServiceResult<ItemGroupRecord[]>> {
  try {
    const qs = type ? `?type=${type}` : '';
    const list = await api.get<ItemGroupRecord[]>(`/api/v1/item-groups${qs}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load item groups';
    return { data: [], error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

/**
 * Paginated list view for Item Groups.
 * When limit/offset are provided, backend returns `{ rows, total, limit, offset }`.
 */
export async function fetchItemGroupsPage(opts: {
  type?: 'RM' | 'PM';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedRowsResponse<ItemGroupRecord>> {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.search != null && opts.search.trim()) params.set('search', opts.search.trim());
  params.set('limit', String(opts.limit ?? 20));
  params.set('offset', String(opts.offset ?? 0));

  const path = `/api/v1/item-groups?${params.toString()}`;
  const resp = await api.get<PaginatedRowsResponse<ItemGroupRecord>>(path);
  return {
    rows: resp?.rows ?? [],
    total: resp?.total ?? 0,
    limit: resp?.limit ?? (opts.limit ?? 20),
    offset: resp?.offset ?? (opts.offset ?? 0),
  };
}

export async function fetchItemGroupById(id: string): Promise<ServiceResult<ItemGroupRecord>> {
  try {
    const row = await api.get<ItemGroupRecord>(`/api/v1/item-groups/${id}`);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load item group';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function createItemGroup(payload: CreateItemGroupPayload): Promise<ServiceResult<ItemGroupRecord>> {
  try {
    const body = {
      code: payload.code,
      icon: payload.icon ?? null,
      type: payload.type,
      name: payload.name,
      description: payload.description ?? null,
      purpose: payload.purpose ?? null,
      status: payload.status ?? 'Active',
      notes: payload.notes ?? null,
      member_ids: payload.member_ids ?? [],
      proposed_alternates: payload.proposedAlternates ?? [],
    };
    const row = await api.post<ItemGroupRecord>('/api/v1/item-groups', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create item group';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export type UpdateItemGroupPayload = Partial<Omit<CreateItemGroupPayload, 'proposedAlternates'>> & { proposedAlternates?: ProposedAlternateInput[] };

export async function updateItemGroup(id: string, payload: UpdateItemGroupPayload): Promise<ServiceResult<ItemGroupRecord>> {
  try {
    const body: Record<string, unknown> = {};
    if (payload.code !== undefined) body.code = payload.code;
    if (payload.icon !== undefined) body.icon = payload.icon;
    if (payload.type !== undefined) body.type = payload.type;
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.purpose !== undefined) body.purpose = payload.purpose;
    if (payload.status !== undefined) body.status = payload.status;
    if (payload.notes !== undefined) body.notes = payload.notes;
    if (payload.member_ids !== undefined) body.member_ids = payload.member_ids;
    if (payload.proposedAlternates !== undefined) body.proposed_alternates = payload.proposedAlternates;
    const row = await api.put<ItemGroupRecord>(`/api/v1/item-groups/${id}`, body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update item group';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function deleteItemGroup(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/item-groups/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete item group';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}
