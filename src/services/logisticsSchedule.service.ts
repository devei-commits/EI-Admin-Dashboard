import { api } from '../lib/apiClient';

export interface LogisticsScheduleRow {
  id: number;
  trackingNo: string;
  transporter: string;
  dispatchDate: string; // YYYY-MM-DD (DATEONLY)
  etaDate: string; // YYYY-MM-DD (DATEONLY)
  vehicleNo: string;
  status: string;
  createdAt?: string | null;
}

export interface CreateLogisticsSchedulePayload {
  trackingNo: string;
  transporter: string;
  dispatchDate: string; // YYYY-MM-DD
  etaDate: string; // YYYY-MM-DD
  vehicleNo: string;
  status?: string;
}

export async function fetchLogisticsSchedules(params?: { status?: string }): Promise<LogisticsScheduleRow[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api.get<LogisticsScheduleRow[]>(`/api/v1/logistics-schedules${query}`);
  const list = (res as any)?.data ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createLogisticsSchedule(payload: CreateLogisticsSchedulePayload): Promise<LogisticsScheduleRow> {
  const res = await api.post<LogisticsScheduleRow>('/api/v1/logistics-schedules', payload);
  return (res as any)?.data ?? res;
}

