import { api } from '../lib/apiClient';

export interface ClientContact {
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

export interface ClientQueryRecord {
  id: string;
  title: string;
  status: string;
  due: string;
  cat: string;
  note: string;
}

export interface ClientDevRecord {
  id: string;
  pr: string;
  name: string;
  stage: string;
  status: string;
  due: string;
  phase: string;
}

export interface ClientOrderRecord {
  id: string;
  prod: string;
  qty: string;
  status: string;
  due: string;
  batch: string;
}

export interface ClientApptRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  with: string;
}

export interface ClientRecord {
  id: string;
  entityCode: string;
  name: string;
  email: string;
  phone: string;
  segment: string;
  priority: 'high' | 'medium' | 'low';
  sinceYear: number;
  revenueValue: number;
  avatarColor: string;
  initials: string;
  accountManagerId: number | null;
  accountManagerName: string | null;
  contacts: ClientContact[];
  status: string;
  category: string;
  queries: ClientQueryRecord[];
  devs: ClientDevRecord[];
  orders: ClientOrderRecord[];
  appts: ClientApptRecord[];
}

export interface DashboardKPIs {
  totalOverdue: number;
  totalPending: number;
  activeClients: number;
  highPriority: number;
  activeOrders: number;
  totalDevs: number;
  totalAppts: number;
  totalRevenue: number;
}

export interface DashboardResponse {
  clients: ClientRecord[];
  kpis: DashboardKPIs;
}

const BASE = '/api/v1/client-hub';

export async function fetchClientHubDashboard(): Promise<DashboardResponse> {
  return api.get<DashboardResponse>(BASE);
}

export async function fetchClientById(id: string): Promise<ClientRecord> {
  return api.get<ClientRecord>(`${BASE}/${id}`);
}

export async function createClient(payload: {
  name: string;
  email?: string;
  phone?: string;
  priority?: string;
  segment?: string;
  sinceYear?: number;
  revenueValue?: number;
  avatarColor?: string;
  accountManagerId?: number;
  contacts?: ClientContact[];
}): Promise<ClientRecord> {
  return api.post<ClientRecord>(`${BASE}/clients`, payload);
}

export async function addClientQuery(
  clientId: string,
  payload: { title: string; status?: string; due?: string; cat?: string; note?: string },
): Promise<ClientQueryRecord> {
  return api.post<ClientQueryRecord>(`${BASE}/${clientId}/queries`, payload);
}

export async function addClientDevelopment(
  clientId: string,
  payload: { name: string; pr?: string; stage?: string; status?: string; due?: string; phase?: string },
): Promise<ClientDevRecord> {
  return api.post<ClientDevRecord>(`${BASE}/${clientId}/developments`, payload);
}

export async function addClientOrder(
  clientId: string,
  payload: { prod: string; qty?: string; status?: string; due?: string; batch?: string },
): Promise<ClientOrderRecord> {
  return api.post<ClientOrderRecord>(`${BASE}/${clientId}/orders`, payload);
}

export async function addClientAppointment(
  clientId: string,
  payload: { title: string; date?: string; time?: string; type?: string; with?: string },
): Promise<ClientApptRecord> {
  return api.post<ClientApptRecord>(`${BASE}/${clientId}/appointments`, payload);
}

export async function updateClientQuery(
  id: string,
  payload: Partial<{ title: string; status: string; due: string; cat: string; note: string }>,
): Promise<ClientQueryRecord> {
  return api.put<ClientQueryRecord>(`${BASE}/queries/${id}`, payload);
}

export async function updateClientDevelopment(
  id: string,
  payload: Partial<{ name: string; pr: string; stage: string; status: string; due: string; phase: string }>,
): Promise<ClientDevRecord> {
  return api.put<ClientDevRecord>(`${BASE}/developments/${id}`, payload);
}

export async function updateClientOrder(
  id: string,
  payload: Partial<{ prod: string; qty: string; status: string; due: string; batch: string }>,
): Promise<ClientOrderRecord> {
  return api.put<ClientOrderRecord>(`${BASE}/orders/${id}`, payload);
}

export async function updateClientAppointment(
  id: string,
  payload: Partial<{ title: string; date: string; time: string; type: string; with: string }>,
): Promise<ClientApptRecord> {
  return api.put<ClientApptRecord>(`${BASE}/appointments/${id}`, payload);
}
