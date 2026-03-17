/**
 * Universal Swap API — history and apply swap.
 * Backend: GET /api/v1/universal-swap/history, POST /api/v1/universal-swap/apply
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface SwapHistoryRecord {
  id: string;
  fromRawMaterialId: number;
  toRawMaterialId: number;
  fromIngredient: string;
  toIngredient: string;
  swapRatio: number;
  reason: string;
  approvedBy: string;
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
    return { data: [], error: message, success: false };
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
      error: message,
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
    return { data: null, error: message, success: false };
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
      error: message,
      success: false,
    };
  }
}
