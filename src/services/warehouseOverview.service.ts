/**
 * Warehouse Overview — KPIs, zones, recent activity, open GRNs from backend.
 */

import { api } from '../lib/apiClient';

export interface WarehouseOverviewKpi {
  id: string;
  label: string;
  subtitle: string;
  value: string;
  accentColor: string;
}

export interface WarehouseOverviewZone {
  id: string;
  name: string;
  title: string;
  description: string;
  items: number;
  racks: number;
  alerts: number;
  utilization: number;
  footprint: string;
  tags: string[];
}

export interface WarehouseRecentActivityItem {
  id: string;
  type: 'grn' | 'mrn' | 'alert';
  title: string;
  subtitle: string;
  meta: string;
}

export interface OpenGrnItem {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  status: string;
}

export interface WarehouseOverviewResponse {
  kpis: WarehouseOverviewKpi[];
  zones: WarehouseOverviewZone[];
  recentActivity: WarehouseRecentActivityItem[];
  openGrns: OpenGrnItem[];
  alertCount: number;
}

export async function fetchWarehouseOverview(): Promise<WarehouseOverviewResponse | null> {
  try {
    const res = await api.get<WarehouseOverviewResponse>('/api/v1/warehouse/overview');
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}
