import api from '../lib/apiClient';

export type DashboardActivityType = 'order' | 'user' | 'enquiry' | 'task' | 'system';

export interface DashboardRecentActivity {
  id: string;
  action: string;
  module: string;
  user: string;
  time: string;
  type: DashboardActivityType;
}

export interface DashboardPendingItem {
  id: string;
  title: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingReview: number;
  activeUsers: number;
  openEnquiries: number;
  openTasks: number;
  lowStockItems: number;
  issuedPos: number;
  fulfillmentCount: number;
  salesOrderCount: number;
  purchaseOrderCount: number;
}

export interface DashboardWebsiteRequests {
  openEnquiries: number;
  contactEnquiries: number;
  productSampleRequests: number;
  technicalDocRequests: number;
  newDevelopmentRequests: number;
  resolvedEnquiries: number;
}

export interface DashboardModuleStats {
  orderManagement?: { total: number; pending: number };
  orderHub?: { inProgress: number; shipped: number };
  userManagement?: { active: number; total: number };
  roleManagement?: { roles: number; permissions: number };
  taskManagement?: { open: number; completedFulfillment: number };
  enquiryManagement?: { open: number; resolved: number };
  procurement?: { pending: number; released: number };
  rawMaterials?: { materials: number; lowStock: number };
  vendorClient?: { vendors: number; clients: number };
  catalogue?: { products: number };
  packaging?: { types: number };
}

export interface DashboardOverview {
  stats: DashboardStats;
  websiteRequests: DashboardWebsiteRequests;
  moduleStats: DashboardModuleStats;
  recentActivity: DashboardRecentActivity[];
  pendingItems: DashboardPendingItem[];
  fetchedAt: string;
}

export interface DashboardOverviewResponse {
  success?: boolean;
  data?: DashboardOverview;
  error?: string;
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const res = await api.get<DashboardOverviewResponse>('/api/v1/dashboard/overview');
  if (!res?.success || !res.data) {
    throw new Error(res?.error || 'Dashboard overview unavailable');
  }
  return res.data;
}
