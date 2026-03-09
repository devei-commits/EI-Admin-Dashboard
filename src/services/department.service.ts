import { api } from '../lib/apiClient';

export interface DepartmentRow {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  const res = await api.get<DepartmentRow[]>('/api/v1/departments');
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function createDepartment(payload: { name: string; code: string; is_active?: boolean }): Promise<DepartmentRow> {
  const res = await api.post<DepartmentRow>('/api/v1/departments', payload);
  return (res as any)?.data ?? res;
}

export async function updateDepartment(id: number, payload: Partial<{ name: string; code: string; is_active: boolean }>): Promise<DepartmentRow> {
  const res = await api.patch<DepartmentRow>(`/api/v1/departments/${id}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.delete(`/api/v1/departments/${id}`);
}
