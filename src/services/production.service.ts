import { api } from '../lib/apiClient';

const BASE = '/api/v1/production';

/* ── Equipment ── */

export interface MfgEquipmentRow {
  id: string; name: string; cap: number; type: string;
  homogenizer: boolean; processType: string[]; status: string; _pk: number;
}

export interface FillingEquipmentRow {
  id: string; name: string; speed: number; type: string;
  compatible: string[]; status: string; _pk: number;
}

export interface PackagingEquipmentRow {
  id: string; name: string; speed: number; type: string;
  supports: string[]; status: string; _pk: number;
}

export interface EquipmentData {
  manufacturing: MfgEquipmentRow[];
  filling: FillingEquipmentRow[];
  packaging: PackagingEquipmentRow[];
}

export async function fetchEquipment(): Promise<EquipmentData> {
  const res = await api.get<EquipmentData>(`${BASE}/equipment`);
  const data = (res as any)?.data ?? res;
  return data ?? { manufacturing: [], filling: [], packaging: [] };
}

export async function createEquipment(payload: Record<string, unknown>) {
  const res = await api.post(`${BASE}/equipment`, payload);
  return (res as any)?.data ?? res;
}

export async function updateEquipment(pk: number, payload: Record<string, unknown>) {
  const res = await api.patch(`${BASE}/equipment/${pk}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteEquipment(pk: number) {
  const res = await api.delete(`${BASE}/equipment/${pk}`);
  return (res as any)?.data ?? res;
}

/* ── Team ── */

export interface TeamMemberRow {
  id: string; userId: number | null; name: string; role: string; dept: string;
  avail: boolean; _pk: number;
}

export interface UserSearchResult {
  userid: number;
  display_name: string;
  email: string;
  department: string | null;
  role_name: string | null;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const res = await api.get<UserSearchResult[]>(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function fetchTeam(): Promise<TeamMemberRow[]> {
  const res = await api.get<TeamMemberRow[]>(`${BASE}/team`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function createTeamMember(payload: Record<string, unknown>) {
  const res = await api.post(`${BASE}/team`, payload);
  return (res as any)?.data ?? res;
}

export async function updateTeamMember(pk: number, payload: Record<string, unknown>) {
  const res = await api.patch(`${BASE}/team/${pk}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteTeamMember(pk: number) {
  const res = await api.delete(`${BASE}/team/${pk}`);
  return (res as any)?.data ?? res;
}

/* ── Batches (BMR / BPR) ── */

export interface DispensingItem {
  code: string; inci?: string; name?: string;
  required: number; dispensed: number; done: boolean;
}

export interface QCSpec {
  param: string; spec: string; result: string; passed: boolean | null;
}

export interface BatchRow {
  _pk: number;
  bmrNo: string; bprNo: string; productName: string; sku: string;
  soNo: string; orderQty: number; batchSize: number; batchNo: string;
  batchIndex: number; totalBatches: number;
  bmrStatus: string; bprStatus: string; color: string;
  processType: string; homogenizer: boolean;
  mainVessel: string; supportingTanks: string[];
  fillingLine: string; fillingType: string; packagingLine: string;
  monocarton: boolean; shrink: boolean;
  teamBMR: string[]; teamBPR: string[];
  qcOfficerBMR: string; qcOfficerBPR: string;
  mfgDate: string; fillDate: string; packDate: string; fgDate: string;
  rmConnectDate: string; pmConnectDate: string;
  rmReserved: boolean; pmReserved: boolean;
  rmConnected: boolean; pmConnected: boolean;
  dispensingRM: DispensingItem[]; dispensingPM: DispensingItem[];
  bulkYield: number | null; fillYield: number | null; fgYield: number | null;
  bulkBatchAccepted: boolean | null; fillBatchAccepted: boolean | null; fgBatchAccepted: boolean | null;
  qcSpecs: QCSpec[]; remarks: string; dueDate: string;
  compatibleVessels?: string[]; compatibleFillLines?: string[]; compatiblePackLines?: string[];
}

export async function fetchBatches(): Promise<BatchRow[]> {
  const res = await api.get<BatchRow[]>(`${BASE}/batches`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function fetchBatchById(pk: number): Promise<BatchRow | null> {
  try {
    const res = await api.get<BatchRow>(`${BASE}/batches/${pk}`);
    return ((res as any)?.data ?? res) ?? null;
  } catch {
    return null;
  }
}

export async function createBatch(payload: Record<string, unknown>): Promise<BatchRow> {
  const res = await api.post<BatchRow>(`${BASE}/batches`, payload);
  return (res as any)?.data ?? res;
}

export async function updateBatch(pk: number, payload: Record<string, unknown>): Promise<BatchRow> {
  const res = await api.patch<BatchRow>(`${BASE}/batches/${pk}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteBatch(pk: number) {
  const res = await api.delete(`${BASE}/batches/${pk}`);
  return (res as any)?.data ?? res;
}
