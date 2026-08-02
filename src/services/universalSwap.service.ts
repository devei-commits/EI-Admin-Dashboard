/**
 * Universal Swap API — history and apply swap.
 * Backend: GET /api/v1/universal-swap/history, POST /api/v1/universal-swap/apply
 */

import type { ServiceResult, ApiError } from '../types/api.types';
import { api } from '../lib/apiClient';

/** Wrap an error message into the ApiError shape ServiceResult.error expects. */
const apiErr = (message: string): ApiError => ({ code: 'ERROR', message, timestamp: new Date().toISOString() });

export interface SwapHistoryRecord {
  id: string;
  fromRawMaterialId: number;
  toRawMaterialId: number;
  fromIngredient: string;
  toIngredient: string;
  swapRatio: number;
  reason: string;
  approvedBy: string;
  /** 'draft' = saved but not applied; 'applied' = executed against BOMs/item-groups. */
  status?: string;
  date: string;
  affectedGroupIds?: number[];
  affectedBomIds?: number[];
  createdAt?: string;
}

export interface AffectedItemGroup {
  id: string;
  code: string;
  name: string;
  type: string;
  member_ids: number[];
}

export interface AffectedBom {
  id: string;
  bom_code: string;
  name: string;
  product_id: number | null;
  product_name: string;
}

export interface AffectedResponse {
  itemGroups: AffectedItemGroup[];
  boms: AffectedBom[];
}

export interface HistoryAffectedResponse {
  boms: AffectedBom[];
}

export interface ApplySwapPayload {
  fromRawMaterialId: number;
  toRawMaterialId: number;
  swapRatio?: number;
  reason: string;
  approvedBy: string;
  approvedByUserId?: number | null;
  selectedGroupIds?: (string | number)[];
  selectedBomIds?: (string | number)[];
}

export interface ApplySwapResponse extends SwapHistoryRecord {
  updatedGroupsCount?: number;
  updatedBomsCount?: number;
}

export async function fetchSwapHistory(): Promise<ServiceResult<SwapHistoryRecord[]>> {
  try {
    const list = await api.get<SwapHistoryRecord[]>('/api/v1/universal-swap/history');
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load swap history';
    return { data: [], error: apiErr(message), success: false };
  }
}

export async function fetchAffected(
  fromRawMaterialId: number | string
): Promise<ServiceResult<AffectedResponse>> {
  try {
    const id = typeof fromRawMaterialId === 'string' ? fromRawMaterialId : String(fromRawMaterialId);
    const res = await api.get<AffectedResponse>(
      `/api/v1/universal-swap/affected?fromRawMaterialId=${encodeURIComponent(id)}`
    );
    return {
      data: res ?? { itemGroups: [], boms: [] },
      error: null,
      success: true,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load affected item groups and PR BOMs';
    return {
      data: { itemGroups: [], boms: [] },
      error: apiErr(message),
      success: false,
    };
  }
}

export async function applySwap(payload: ApplySwapPayload): Promise<ServiceResult<ApplySwapResponse>> {
  try {
    const body = {
      fromRawMaterialId: payload.fromRawMaterialId,
      toRawMaterialId: payload.toRawMaterialId,
      swapRatio: payload.swapRatio ?? 1,
      reason: payload.reason,
      approvedBy: payload.approvedBy,
      approvedByUserId: payload.approvedByUserId ?? null,
      selectedGroupIds: (payload.selectedGroupIds ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
      selectedBomIds: (payload.selectedBomIds ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
    };
    const row = await api.post<ApplySwapResponse>('/api/v1/universal-swap/apply', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to apply swap';
    return { data: null, error: apiErr(message), success: false };
  }
}

/** Save the swap as a DRAFT (no BOM/group changes applied). Finalize later to execute. */
export async function saveSwapDraft(payload: ApplySwapPayload): Promise<ServiceResult<ApplySwapResponse>> {
  try {
    const body = {
      fromRawMaterialId: payload.fromRawMaterialId,
      toRawMaterialId: payload.toRawMaterialId,
      swapRatio: payload.swapRatio ?? 1,
      reason: payload.reason,
      approvedBy: payload.approvedBy,
      approvedByUserId: payload.approvedByUserId ?? null,
      selectedGroupIds: (payload.selectedGroupIds ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
      selectedBomIds: (payload.selectedBomIds ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
    };
    const row = await api.post<ApplySwapResponse>('/api/v1/universal-swap/draft', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save draft';
    return { data: null, error: apiErr(message), success: false };
  }
}

/** Finalize (execute) a saved draft swap. Optionally override the selected groups/BOMs. */
export async function finalizeSwap(
  id: string | number,
  overrides?: { swapRatio?: number; selectedGroupIds?: (string | number)[]; selectedBomIds?: (string | number)[] }
): Promise<ServiceResult<ApplySwapResponse>> {
  try {
    const body: Record<string, unknown> = {};
    if (overrides?.swapRatio != null) body.swapRatio = overrides.swapRatio;
    if (overrides?.selectedGroupIds) body.selectedGroupIds = overrides.selectedGroupIds.map((x) => (typeof x === 'string' ? parseInt(x, 10) : x));
    if (overrides?.selectedBomIds) body.selectedBomIds = overrides.selectedBomIds.map((x) => (typeof x === 'string' ? parseInt(x, 10) : x));
    const row = await api.post<ApplySwapResponse>(`/api/v1/universal-swap/${encodeURIComponent(String(id))}/finalize`, body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to finalize swap';
    return { data: null, error: apiErr(message), success: false };
  }
}

export async function fetchHistoryAffected(
  historyId: string | number
): Promise<ServiceResult<HistoryAffectedResponse>> {
  try {
    const id = typeof historyId === 'string' ? historyId : String(historyId);
    const res = await api.get<HistoryAffectedResponse>(
      `/api/v1/universal-swap/history/${encodeURIComponent(id)}/affected`
    );
    return {
      data: res ?? { boms: [] },
      error: null,
      success: true,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load affected PR BOMs';
    return {
      data: { boms: [] },
      error: apiErr(message),
      success: false,
    };
  }
}
