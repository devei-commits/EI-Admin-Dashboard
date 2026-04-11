/**
 * Website /customize packaging presets — admin CRUD.
 * Backend: /api/v1/admin/customization-packaging-options
 */

import { api } from '../lib/apiClient';

export type CustomizationPackagingSpecs = {
  skuVol: string;
  material: string;
  color: string;
  pantone: string;
  dispensing: string;
  pumpMaterial: string;
  pumpColor: string;
  capMaterial: string;
  capColor: string;
  moq: number;
};

export type CustomizationPackagingRow = {
  id: string;
  dbId: number;
  title: string;
  subtitle: string;
  reviewLabel: string;
  skuCode: string;
  custom: boolean;
  sortOrder: number;
  active: boolean;
  specs: CustomizationPackagingSpecs;
};

type ApiEnvelope<T> = { success?: boolean; data?: T };

function mapRow(r: CustomizationPackagingRow): CustomizationPackagingRow {
  return r;
}

export async function fetchCustomizationPackagingCatalog(): Promise<CustomizationPackagingRow[]> {
  const res = await api.get<ApiEnvelope<CustomizationPackagingRow[]>>(
    '/api/v1/admin/customization-packaging-options',
  );
  const list = res?.data;
  return Array.isArray(list) ? list.map(mapRow) : [];
}

export async function createCustomizationPackagingOption(body: Record<string, unknown>): Promise<CustomizationPackagingRow> {
  const res = await api.post<ApiEnvelope<CustomizationPackagingRow>>(
    '/api/v1/admin/customization-packaging-options',
    body,
  );
  if (!res?.data) throw new Error('Create failed');
  return res.data;
}

export async function updateCustomizationPackagingOption(
  dbId: number,
  body: Record<string, unknown>,
): Promise<CustomizationPackagingRow> {
  const res = await api.put<ApiEnvelope<CustomizationPackagingRow>>(
    `/api/v1/admin/customization-packaging-options/${dbId}`,
    body,
  );
  if (!res?.data) throw new Error('Update failed');
  return res.data;
}

export async function deleteCustomizationPackagingOption(dbId: number): Promise<void> {
  await api.delete(`/api/v1/admin/customization-packaging-options/${dbId}`);
}
