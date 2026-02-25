import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { PISRecord, UserRole, SystemUser, UserPermissions, UserStatus, PISHistoryEntry, Customer, Product } from '../types/pis';
import { pisApi, customersApi, productsApi, usersApi, dashboardApi, authApi, convertApiPISToFrontend, convertFrontendPISToApi, getAccessToken, getRefreshToken, clearTokens, USE_MOCK_DATA } from '../utils/api';
import { mockPISData } from '../data/mockPISData';
import { mockCustomersData } from '../data/mockCustomersData';
import { mockProductsData } from '../data/mockProductsData';

// Default permissions for each role
export const getDefaultPermissions = (role: UserRole | null): UserPermissions => {
 if (!role) {
  return {
   canViewDashboard: false,
   canViewPIS: false,
   canCreatePIS: false,
   canEditPIS: false,
   canDeletePIS: false,
   canViewTasks: false,
   canManageTasks: false,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: false,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  };
 }

 const permissionsByRole: Record<UserRole, UserPermissions> = {
  SUPER_ADMIN: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: true,
   canEditPIS: true,
   canDeletePIS: true,
   canViewTasks: true,
   canManageTasks: true,
   canViewCustomers: true,
   canManageCustomers: true,
   canViewProducts: true,
   canManageProducts: true,
   canViewAnalytics: true,
   canViewSettings: true,
   canManageUsers: true,
  },
  ADMIN: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: true,
   canEditPIS: true,
   canDeletePIS: true,
   canViewTasks: true,
   canManageTasks: true,
   canViewCustomers: true,
   canManageCustomers: true,
   canViewProducts: true,
   canManageProducts: true,
   canViewAnalytics: true,
   canViewSettings: true,
   canManageUsers: false,
  },
  BD_MANAGER: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: true,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: true,
   canViewCustomers: true,
   canManageCustomers: true,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: true,
   canViewSettings: false,
   canManageUsers: false,
  },
  BD_STAFF: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: true,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: false,
   canViewCustomers: true,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  },
  RND_LEAD: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: true,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: true,
   canViewAnalytics: true,
   canViewSettings: false,
   canManageUsers: false,
  },
  RND_STAFF: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: false,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  },
  QA_MANAGER: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: true,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: true,
   canViewSettings: false,
   canManageUsers: false,
  },
  QA_STAFF: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: false,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  },
  PKG_STAFF: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: true,
   canDeletePIS: false,
   canViewTasks: true,
   canManageTasks: false,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  },
  CLIENT: {
   canViewDashboard: true,
   canViewPIS: true,
   canCreatePIS: false,
   canEditPIS: false,
   canDeletePIS: false,
   canViewTasks: false,
   canManageTasks: false,
   canViewCustomers: false,
   canManageCustomers: false,
   canViewProducts: true,
   canManageProducts: false,
   canViewAnalytics: false,
   canViewSettings: false,
   canManageUsers: false,
  },
 };

 return permissionsByRole[role];
};

// Mock initial users including Super Admin and 5 users per functional role
// Password for all demo users: "demo123" (stored in localStorage for testing only).
const mockUsers: SystemUser[] = [
 // Core admins
 {
  id: 'superadmin-001',
  email: 'superadmin@eisthetic.com',
  name: 'Super Admin',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('SUPER_ADMIN'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
 },
 {
  id: 'admin-001',
  email: 'admin@eisthetic.com',
  name: 'System Admin 1',
  role: 'ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('ADMIN'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
 },
 {
  id: 'admin-002',
  email: 'admin2@eisthetic.com',
  name: 'System Admin 2',
  role: 'ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('ADMIN'),
  createdAt: new Date('2024-01-16'),
  updatedAt: new Date('2024-01-16'),
 },
 {
  id: 'admin-003',
  email: 'admin3@eisthetic.com',
  name: 'System Admin 3',
  role: 'ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('ADMIN'),
  createdAt: new Date('2024-01-17'),
  updatedAt: new Date('2024-01-17'),
 },
 {
  id: 'admin-004',
  email: 'admin4@eisthetic.com',
  name: 'System Admin 4',
  role: 'ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('ADMIN'),
  createdAt: new Date('2024-01-18'),
  updatedAt: new Date('2024-01-18'),
 },
 {
  id: 'admin-005',
  email: 'admin5@eisthetic.com',
  name: 'System Admin 5',
  role: 'ADMIN',
  status: 'ACTIVE',
  department: 'Administration',
  password: 'demo123',
  permissions: getDefaultPermissions('ADMIN'),
  createdAt: new Date('2024-01-19'),
  updatedAt: new Date('2024-01-19'),
 },

 // BD Managers (5)
 {
  id: 'bd-manager-001',
  email: 'bd.manager@eisthetic.com',
  name: 'BD Manager 1',
  role: 'BD_MANAGER',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_MANAGER'),
  createdAt: new Date('2024-02-01'),
  updatedAt: new Date('2024-02-01'),
 },
 {
  id: 'bd-manager-002',
  email: 'bd.manager2@eisthetic.com',
  name: 'BD Manager 2',
  role: 'BD_MANAGER',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_MANAGER'),
  createdAt: new Date('2024-02-02'),
  updatedAt: new Date('2024-02-02'),
 },
 {
  id: 'bd-manager-003',
  email: 'bd.manager3@eisthetic.com',
  name: 'BD Manager 3',
  role: 'BD_MANAGER',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_MANAGER'),
  createdAt: new Date('2024-02-03'),
  updatedAt: new Date('2024-02-03'),
 },
 {
  id: 'bd-manager-004',
  email: 'bd.manager4@eisthetic.com',
  name: 'BD Manager 4',
  role: 'BD_MANAGER',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_MANAGER'),
  createdAt: new Date('2024-02-04'),
  updatedAt: new Date('2024-02-04'),
 },
 {
  id: 'bd-manager-005',
  email: 'bd.manager5@eisthetic.com',
  name: 'BD Manager 5',
  role: 'BD_MANAGER',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_MANAGER'),
  createdAt: new Date('2024-02-05'),
  updatedAt: new Date('2024-02-05'),
 },

 // BD Staff (5)
 {
  id: 'bd-staff-001',
  email: 'bd.staff1@eisthetic.com',
  name: 'BD Staff 1',
  role: 'BD_STAFF',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_STAFF'),
  createdAt: new Date('2024-02-10'),
  updatedAt: new Date('2024-02-10'),
 },
 {
  id: 'bd-staff-002',
  email: 'bd.staff2@eisthetic.com',
  name: 'BD Staff 2',
  role: 'BD_STAFF',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_STAFF'),
  createdAt: new Date('2024-02-11'),
  updatedAt: new Date('2024-02-11'),
 },
 {
  id: 'bd-staff-003',
  email: 'bd.staff3@eisthetic.com',
  name: 'BD Staff 3',
  role: 'BD_STAFF',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_STAFF'),
  createdAt: new Date('2024-02-12'),
  updatedAt: new Date('2024-02-12'),
 },
 {
  id: 'bd-staff-004',
  email: 'bd.staff4@eisthetic.com',
  name: 'BD Staff 4',
  role: 'BD_STAFF',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_STAFF'),
  createdAt: new Date('2024-02-13'),
  updatedAt: new Date('2024-02-13'),
 },
 {
  id: 'bd-staff-005',
  email: 'bd.staff5@eisthetic.com',
  name: 'BD Staff 5',
  role: 'BD_STAFF',
  status: 'ACTIVE',
  department: 'Business Development',
  password: 'demo123',
  permissions: getDefaultPermissions('BD_STAFF'),
  createdAt: new Date('2024-02-14'),
  updatedAt: new Date('2024-02-14'),
 },

 // R&D Leads (5)
 {
  id: 'rnd-lead-001',
  email: 'rnd.lead@eisthetic.com',
  name: 'R&D Lead 1',
  role: 'RND_LEAD',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_LEAD'),
  createdAt: new Date('2024-02-15'),
  updatedAt: new Date('2024-02-15'),
 },
 {
  id: 'rnd-lead-002',
  email: 'rnd.lead2@eisthetic.com',
  name: 'R&D Lead 2',
  role: 'RND_LEAD',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_LEAD'),
  createdAt: new Date('2024-02-16'),
  updatedAt: new Date('2024-02-16'),
 },
 {
  id: 'rnd-lead-003',
  email: 'rnd.lead3@eisthetic.com',
  name: 'R&D Lead 3',
  role: 'RND_LEAD',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_LEAD'),
  createdAt: new Date('2024-02-17'),
  updatedAt: new Date('2024-02-17'),
 },
 {
  id: 'rnd-lead-004',
  email: 'rnd.lead4@eisthetic.com',
  name: 'R&D Lead 4',
  role: 'RND_LEAD',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_LEAD'),
  createdAt: new Date('2024-02-18'),
  updatedAt: new Date('2024-02-18'),
 },
 {
  id: 'rnd-lead-005',
  email: 'rnd.lead5@eisthetic.com',
  name: 'R&D Lead 5',
  role: 'RND_LEAD',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_LEAD'),
  createdAt: new Date('2024-02-19'),
  updatedAt: new Date('2024-02-19'),
 },

 // R&D Staff (5)
 {
  id: 'rnd-staff-001',
  email: 'rnd.staff1@eisthetic.com',
  name: 'R&D Staff 1',
  role: 'RND_STAFF',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_STAFF'),
  createdAt: new Date('2024-02-20'),
  updatedAt: new Date('2024-02-20'),
 },
 {
  id: 'rnd-staff-002',
  email: 'rnd.staff2@eisthetic.com',
  name: 'R&D Staff 2',
  role: 'RND_STAFF',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_STAFF'),
  createdAt: new Date('2024-02-21'),
  updatedAt: new Date('2024-02-21'),
 },
 {
  id: 'rnd-staff-003',
  email: 'rnd.staff3@eisthetic.com',
  name: 'R&D Staff 3',
  role: 'RND_STAFF',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_STAFF'),
  createdAt: new Date('2024-02-22'),
  updatedAt: new Date('2024-02-22'),
 },
 {
  id: 'rnd-staff-004',
  email: 'rnd.staff4@eisthetic.com',
  name: 'R&D Staff 4',
  role: 'RND_STAFF',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_STAFF'),
  createdAt: new Date('2024-02-23'),
  updatedAt: new Date('2024-02-23'),
 },
 {
  id: 'rnd-staff-005',
  email: 'rnd.staff5@eisthetic.com',
  name: 'R&D Staff 5',
  role: 'RND_STAFF',
  status: 'ACTIVE',
  department: 'Research & Development',
  password: 'demo123',
  permissions: getDefaultPermissions('RND_STAFF'),
  createdAt: new Date('2024-02-24'),
  updatedAt: new Date('2024-02-24'),
 },

 // QA Managers (5)
 {
  id: 'qa-manager-001',
  email: 'qa.manager1@eisthetic.com',
  name: 'QA Manager 1',
  role: 'QA_MANAGER',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_MANAGER'),
  createdAt: new Date('2024-02-25'),
  updatedAt: new Date('2024-02-25'),
 },
 {
  id: 'qa-manager-002',
  email: 'qa.manager2@eisthetic.com',
  name: 'QA Manager 2',
  role: 'QA_MANAGER',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_MANAGER'),
  createdAt: new Date('2024-02-26'),
  updatedAt: new Date('2024-02-26'),
 },
 {
  id: 'qa-manager-003',
  email: 'qa.manager3@eisthetic.com',
  name: 'QA Manager 3',
  role: 'QA_MANAGER',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_MANAGER'),
  createdAt: new Date('2024-02-27'),
  updatedAt: new Date('2024-02-27'),
 },
 {
  id: 'qa-manager-004',
  email: 'qa.manager4@eisthetic.com',
  name: 'QA Manager 4',
  role: 'QA_MANAGER',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_MANAGER'),
  createdAt: new Date('2024-02-28'),
  updatedAt: new Date('2024-02-28'),
 },
 {
  id: 'qa-manager-005',
  email: 'qa.manager5@eisthetic.com',
  name: 'QA Manager 5',
  role: 'QA_MANAGER',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_MANAGER'),
  createdAt: new Date('2024-03-01'),
  updatedAt: new Date('2024-03-01'),
 },

 // QA Staff (5)
 {
  id: 'qa-staff-001',
  email: 'qa.staff1@eisthetic.com',
  name: 'QA Staff 1',
  role: 'QA_STAFF',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_STAFF'),
  createdAt: new Date('2024-03-02'),
  updatedAt: new Date('2024-03-02'),
 },
 {
  id: 'qa-staff-002',
  email: 'qa.staff2@eisthetic.com',
  name: 'QA Staff 2',
  role: 'QA_STAFF',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_STAFF'),
  createdAt: new Date('2024-03-03'),
  updatedAt: new Date('2024-03-03'),
 },
 {
  id: 'qa-staff-003',
  email: 'qa.staff3@eisthetic.com',
  name: 'QA Staff 3',
  role: 'QA_STAFF',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_STAFF'),
  createdAt: new Date('2024-03-04'),
  updatedAt: new Date('2024-03-04'),
 },
 {
  id: 'qa-staff-004',
  email: 'qa.staff4@eisthetic.com',
  name: 'QA Staff 4',
  role: 'QA_STAFF',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_STAFF'),
  createdAt: new Date('2024-03-05'),
  updatedAt: new Date('2024-03-05'),
 },
 {
  id: 'qa-staff-005',
  email: 'qa.staff5@eisthetic.com',
  name: 'QA Staff 5',
  role: 'QA_STAFF',
  status: 'ACTIVE',
  department: 'Quality Assurance',
  password: 'demo123',
  permissions: getDefaultPermissions('QA_STAFF'),
  createdAt: new Date('2024-03-06'),
  updatedAt: new Date('2024-03-06'),
 },

 // Packaging Staff (5)
 {
  id: 'pkg-staff-001',
  email: 'pkg.staff1@eisthetic.com',
  name: 'Packaging Staff 1',
  role: 'PKG_STAFF',
  status: 'ACTIVE',
  department: 'Packaging',
  password: 'demo123',
  permissions: getDefaultPermissions('PKG_STAFF'),
  createdAt: new Date('2024-03-07'),
  updatedAt: new Date('2024-03-07'),
 },
 {
  id: 'pkg-staff-002',
  email: 'pkg.staff2@eisthetic.com',
  name: 'Packaging Staff 2',
  role: 'PKG_STAFF',
  status: 'ACTIVE',
  department: 'Packaging',
  password: 'demo123',
  permissions: getDefaultPermissions('PKG_STAFF'),
  createdAt: new Date('2024-03-08'),
  updatedAt: new Date('2024-03-08'),
 },
 {
  id: 'pkg-staff-003',
  email: 'pkg.staff3@eisthetic.com',
  name: 'Packaging Staff 3',
  role: 'PKG_STAFF',
  status: 'ACTIVE',
  department: 'Packaging',
  password: 'demo123',
  permissions: getDefaultPermissions('PKG_STAFF'),
  createdAt: new Date('2024-03-09'),
  updatedAt: new Date('2024-03-09'),
 },
 {
  id: 'pkg-staff-004',
  email: 'pkg.staff4@eisthetic.com',
  name: 'Packaging Staff 4',
  role: 'PKG_STAFF',
  status: 'ACTIVE',
  department: 'Packaging',
  password: 'demo123',
  permissions: getDefaultPermissions('PKG_STAFF'),
  createdAt: new Date('2024-03-10'),
  updatedAt: new Date('2024-03-10'),
 },
 {
  id: 'pkg-staff-005',
  email: 'pkg.staff5@eisthetic.com',
  name: 'Packaging Staff 5',
  role: 'PKG_STAFF',
  status: 'ACTIVE',
  department: 'Packaging',
  password: 'demo123',
  permissions: getDefaultPermissions('PKG_STAFF'),
  createdAt: new Date('2024-03-11'),
  updatedAt: new Date('2024-03-11'),
 },

 // Client (1)
 {
  id: 'client-001',
  email: 'client@pis.com',
  name: 'Sarah Johnson',
  role: 'CLIENT',
  status: 'ACTIVE',
  department: 'Client',
  password: 'Admin@123',
  permissions: getDefaultPermissions('CLIENT'),
  createdAt: new Date('2024-03-12'),
  updatedAt: new Date('2024-03-12'),
 },
];

interface PISContextType {
 pisRecords: PISRecord[];
 customers: Customer[];
 products: Product[];
 dashboardStats: any | null;
 slaDaysByStage: Record<string, number> | null;
 currentRole: UserRole | null;
 isAuthenticated: boolean;
 currentUser: SystemUser | null;
 systemUsers: SystemUser[];
 isLoading: boolean;
 hasInitializedSession: boolean;
 isAutoRefreshEnabled: boolean;
 setCurrentRole: (role: UserRole | null) => void;
 login: (email: string, password: string) => Promise<SystemUser | null>;
 signup: (email: string, password: string, name: string) => Promise<SystemUser | null>;
 logout: () => Promise<void>;
 addPIS: (pis: PISRecord) => Promise<PISRecord | void>;
 updatePIS: (id: string, updates: Partial<PISRecord>) => Promise<PISRecord | void>;
 transitionPIS: (id: string, toStage: string, decision: 'APPROVED' | 'REJECTED', comments?: string) => Promise<PISRecord | void>;
 deletePIS: (id: string) => Promise<void>;
 getPISById: (id: string) => Promise<PISRecord | undefined>;
 addHistoryEntry: (id: string, entry: PISHistoryEntry) => Promise<void>;
 // Customers
 addCustomer: (customer: Customer) => Promise<Customer | void>;
 updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer | void>;
 deleteCustomer: (id: string) => Promise<void>;
 // Products
 addProduct: (product: Product) => Promise<Product | void>;
 updateProduct: (id: string, updates: Partial<Product>) => Promise<Product | void>;
 deleteProduct: (id: string) => Promise<void>;
 // User management functions
 assignUserRole: (userId: string, role: UserRole) => Promise<void>;
 updateUserPermissions: (userId: string, permissions: Partial<UserPermissions>) => void;
 updateUserStatus: (userId: string, status: UserStatus) => Promise<void>;
 deleteUser: (userId: string) => Promise<void>;
 getPendingUsers: () => SystemUser[];
 getActiveUsers: () => SystemUser[];
 refreshData: () => Promise<void>;
 refreshDashboardStats: () => Promise<void>;
 setAutoRefreshEnabled: (enabled: boolean) => void;
}

const PISContext = createContext<PISContextType | undefined>(undefined);

const SESSION_USER_KEY = 'pis_current_user_id';
const SESSION_ROLE_KEY = 'pis_current_role';

export function PISProvider({ children }: { children: ReactNode }) {
 const [pisRecords, setPisRecords] = useState<PISRecord[]>([]);
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [dashboardStats, setDashboardStats] = useState<any | null>(null);
 const [currentRole, setCurrentRoleState] = useState<UserRole | null>(null);
 const [isAuthenticated, setIsAuthenticated] = useState(false);
 const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
 const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
 const [hasInitializedSession, setHasInitializedSession] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [isAutoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

 const slaDaysByStage: Record<string, number> | null =
  (dashboardStats && dashboardStats.sla && dashboardStats.sla.daysByStage) || null;

 const refreshDashboardStats = useCallback(async () => {
  if (!isAuthenticated) return;
  try {
   const stats = await dashboardApi.getStats();
   if (stats?.success && stats.data) {
    setDashboardStats(stats.data);
   }
  } catch (error) {
  }
 }, [isAuthenticated]);

 const setCurrentRole = (role: UserRole | null) => {
  setCurrentRoleState(role);
  try {
   if (role && currentUser) {
    localStorage.setItem(SESSION_ROLE_KEY, role);
   } else {
    localStorage.removeItem(SESSION_ROLE_KEY);
  }
 } catch (e) {
  }
 };

 // Fetch data from API when authenticated
 const fetchData = useCallback(async () => {
  if (!isAuthenticated) return;

  try {
   setIsLoading(true);

   // If USE_MOCK_DATA is true, skip API calls and use mock data directly
   if (USE_MOCK_DATA) {
    // console.log('📦 Using mock data mode (API calls disabled)');
    setPisRecords(mockPISData);
    setCustomers(mockCustomersData);
    setProducts(mockProductsData);
    setIsLoading(false);
    return;
   }

   // Fetch PIS records - fetch all records without pagination limit
   try {
    // Request a high limit to get all records, or fetch paginated if needed
    const pisResponse = await pisApi.getAll({ limit: 1000, page: 1 });
    if (pisResponse.success && pisResponse.data) {
     // Use the actual data from API, even if it's empty (CLIENT users may have no PIS records)
     const pisRecords = pisResponse.data.pisRecords || [];
     const convertedPis = pisRecords.map(convertApiPISToFrontend);
     setPisRecords(convertedPis);
     // If pagination shows more records than returned, log a warning
     if (pisResponse.data.pagination && pisResponse.data.pagination.total > convertedPis.length) {
     }
    } else {
     // Only use mock data if API response indicates failure (not just empty data)
     setPisRecords([]);
    }
   } catch (error) {
    // Only use mock data in development mode, not for CLIENT users in production
    // For CLIENT users, empty array is correct if no records are assigned
    if (currentUser?.role === 'CLIENT') {
     // console.log('CLIENT user: Using empty array (no mock data)');
     setPisRecords([]);
    } else {
     // Only use mock data as fallback for non-CLIENT users in development
     // console.log('Non-CLIENT user: Using mock data as fallback');
     setPisRecords(mockPISData);
    }
   }

   // Fetch customers
   try {
    const customersResponse = await customersApi.getAll({ limit: 100 });
    if (customersResponse.success && customersResponse.data.customers) {
     const convertedCustomers = customersResponse.data.customers.map((c: any) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      address: c.address || '',
      status: c.status,
      category: c.category || 'SMB',
      totalPIS: c._count?.pisRecords || 0,
     createdAt: new Date(c.createdAt),
    }));
     setCustomers(convertedCustomers.length > 0 ? convertedCustomers : mockCustomersData);
    } else {
     // Use mock data if API returns empty or fails
     setCustomers(mockCustomersData);
    }
   } catch (error) {
    // Use mock data as fallback
    setCustomers(mockCustomersData);
   }

   // Fetch products
   try {
    const productsResponse = await productsApi.getAll({ limit: 100 });
    if (productsResponse.success && productsResponse.data.products) {
     const convertedProducts = productsResponse.data.products.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category || '',
      type: p.type || 'OTHER',
      status: p.status,
      imageUrl: p.imageUrl,
      ingredients: p.ingredients || [],
      price: p.price || 0,
      description: p.description || '',
     createdAt: new Date(p.createdAt),
    }));
     setProducts(convertedProducts.length > 0 ? convertedProducts : mockProductsData);
    } else {
     // Use mock data if API returns empty or fails
     setProducts(mockProductsData);
    }
   } catch (error) {
    // Use mock data as fallback
    setProducts(mockProductsData);
   }

   // Fetch dashboard stats (SLA config + workflow metrics)
   await refreshDashboardStats();

   // Fetch users (if admin) or populate dummy staff for managers
   try {
    if (currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role || '')) {
     const usersResponse = await usersApi.getAll({ limit: 100 });
     if (usersResponse.success && usersResponse.data.users) {
      const convertedUsers = usersResponse.data.users.map((u: any) => ({
       id: u.id.toString(),
       email: u.email || '',
       name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '',
       role: (u.role as UserRole) || null,
       status: u.status === 'active' ? 'ACTIVE' : u.status === 'inactive' ? 'INACTIVE' : 'PENDING',
       department: u.department || undefined,
       permissions: getDefaultPermissions((u.role as UserRole) || null),
       createdAt: new Date(u.createdAt),
       updatedAt: new Date(u.updatedAt),
      }));
      setSystemUsers(convertedUsers);
     }
    } else if (currentUser && currentUser.role === 'BD_MANAGER') {
     // For BD_MANAGER, try to fetch BD_STAFF from API, fallback to dummy data
     try {
      const usersResponse = await usersApi.getAll({ limit: 100, role: 'BD_STAFF', status: 'active' });
      if (usersResponse.success && usersResponse.data?.users && usersResponse.data.users.length > 0) {
       const convertedUsers = usersResponse.data.users.map((u: any) => ({
        id: u.id.toString(),
        email: u.email || '',
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '',
        role: (u.role as UserRole) || null,
        status: u.status === 'active' ? 'ACTIVE' : u.status === 'inactive' ? 'INACTIVE' : 'PENDING',
        department: u.department || undefined,
        permissions: getDefaultPermissions((u.role as UserRole) || null),
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
       }));
       setSystemUsers(convertedUsers);
      } else {
       // Fallback to dummy data
       const dummyBdStaff = mockUsers.filter(u => u.role === 'BD_STAFF' && u.status === 'ACTIVE');
       setSystemUsers(dummyBdStaff);
      }
     } catch (_apiError) {
      // API might not be accessible or permission denied - use dummy data
      const dummyBdStaff = mockUsers.filter(u => u.role === 'BD_STAFF' && u.status === 'ACTIVE');
      setSystemUsers(dummyBdStaff);
     }
    } else if (currentUser && currentUser.role === 'RND_LEAD') {
     // For RND_LEAD, try to fetch RND_STAFF from API, fallback to dummy data
     try {
      const usersResponse = await usersApi.getAll({ limit: 100, role: 'RND_STAFF', status: 'active' });
      if (usersResponse.success && usersResponse.data?.users && usersResponse.data.users.length > 0) {
       const convertedUsers = usersResponse.data.users.map((u: any) => ({
        id: u.id.toString(),
        email: u.email || '',
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '',
        role: (u.role as UserRole) || null,
        status: u.status === 'active' ? 'ACTIVE' : u.status === 'inactive' ? 'INACTIVE' : 'PENDING',
        department: u.department || undefined,
        permissions: getDefaultPermissions((u.role as UserRole) || null),
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
       }));
       setSystemUsers(convertedUsers);
      } else {
       // Fallback to dummy data
       const dummyRndStaff = mockUsers.filter(u => u.role === 'RND_STAFF' && u.status === 'ACTIVE');
       setSystemUsers(dummyRndStaff);
      }
     } catch (_apiError) {
      // API might not be accessible - use dummy data
      const dummyRndStaff = mockUsers.filter(u => u.role === 'RND_STAFF' && u.status === 'ACTIVE');
      setSystemUsers(dummyRndStaff);
     }
    }
   } catch (error) {
    // Fallback to dummy data for managers if API fails
    if (currentUser && currentUser.role === 'BD_MANAGER') {
     const dummyBdStaff = mockUsers.filter(u => u.role === 'BD_STAFF' && u.status === 'ACTIVE');
     setSystemUsers(dummyBdStaff);
    } else if (currentUser && currentUser.role === 'RND_LEAD') {
     const dummyRndStaff = mockUsers.filter(u => u.role === 'RND_STAFF' && u.status === 'ACTIVE');
     setSystemUsers(dummyRndStaff);
    }
   }
  } catch (error) {
  } finally {
   setIsLoading(false);
  }
 }, [isAuthenticated, currentUser, refreshDashboardStats]);

 // Fetch data when authenticated and keep it fresh with light polling
 useEffect(() => {
  if (!isAuthenticated || !currentUser) return;
  fetchData();

  const intervalMs = 60000; // 60 seconds - reduced frequency to minimize unwanted updates
  const id = window.setInterval(() => {
   if (isAutoRefreshEnabled) {
    void fetchData();
   }
  }, intervalMs);

  return () => {
   window.clearInterval(id);
  };
 }, [isAuthenticated, currentUser, fetchData, isAutoRefreshEnabled]);

 // Initialize with mock data on first load if empty (for demo/offline mode)
 useEffect(() => {
  if (!isAuthenticated && pisRecords.length === 0 && customers.length === 0 && products.length === 0) {
   setPisRecords(mockPISData);
   setCustomers(mockCustomersData);
   setProducts(mockProductsData);
  }
 }, []); // Only run once on mount

 // Restore auth session from token on mount
 useEffect(() => {
  // Only run once on mount
  let mounted = true;
  
  const checkAuth = async () => {
   try {
    const accessToken = getAccessToken();
    if (!accessToken) {
     // No token, mark as initialized immediately
     if (mounted) {
      setHasInitializedSession(true);
     }
     return;
    }

    // Token exists, verify it by fetching user info
    try {
     const response = await authApi.getMe();
     if (response.success && response.data?.user) {
      const apiUser = response.data.user;
      
      // Convert API user to SystemUser format
      const systemUser: SystemUser = {
       id: apiUser.id.toString(),
       email: apiUser.email,
       name: `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || apiUser.email,
       role: (apiUser.role as UserRole) || null,
       status: apiUser.status === 'active' ? 'ACTIVE' : 'INACTIVE',
       department: apiUser.department || undefined,
       permissions: getDefaultPermissions((apiUser.role as UserRole) || null),
       createdAt: new Date(),
       updatedAt: new Date(),
      };

      if (mounted) {
       setCurrentUser(systemUser);
       setIsAuthenticated(true);

       // Always use the user's assigned role - no role switching
       setCurrentRole(systemUser.role);
       
       // Store role in localStorage for consistency
       try {
        localStorage.setItem(SESSION_ROLE_KEY, systemUser.role);
       } catch (e) {
       }
       setHasInitializedSession(true);
      }
      return;
     }
    } catch (_error) {
     // Token might be expired, try to refresh
     const refreshToken = getRefreshToken();
     if (refreshToken) {
      try {
       const refreshResponse = await authApi.refreshToken();
       if (refreshResponse.success && refreshResponse.data?.user) {
        const apiUser = refreshResponse.data.user;
        
        const systemUser: SystemUser = {
         id: apiUser.id.toString(),
         email: apiUser.email,
         name: `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || apiUser.email,
         role: (apiUser.role as UserRole) || null,
         status: apiUser.status === 'active' ? 'ACTIVE' : 'INACTIVE',
         department: apiUser.department || undefined,
         permissions: getDefaultPermissions((apiUser.role as UserRole) || null),
         createdAt: new Date(),
         updatedAt: new Date(),
        };

        if (mounted) {
         setCurrentUser(systemUser);
         setIsAuthenticated(true);

         // Always use the user's assigned role - no role switching
         setCurrentRole(systemUser.role);
         
         // Store role in localStorage for consistency
         try {
          localStorage.setItem(SESSION_ROLE_KEY, systemUser.role);
         } catch (e) {
         }
         setHasInitializedSession(true);
        }
        return;
       }
      } catch (refreshError) {
       // Refresh failed, clear tokens and log out
       clearTokens();
       localStorage.removeItem(SESSION_USER_KEY);
       localStorage.removeItem(SESSION_ROLE_KEY);
      }
     } else {
      // No refresh token, clear everything
      clearTokens();
      localStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(SESSION_ROLE_KEY);
     }
    }
    
    // If we get here, authentication failed - mark as initialized so login page shows
    if (mounted) {
     setHasInitializedSession(true);
    }
   } catch (e) {
    // Clear invalid tokens
    clearTokens();
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_ROLE_KEY);
    // Always mark as initialized even on error
    if (mounted) {
     setHasInitializedSession(true);
    }
   }
  };

  checkAuth();
  
  return () => {
   mounted = false;
  };
 }, []); // Empty dependency array - only run once on mount

 const login = async (email: string, password: string): Promise<SystemUser | null> => {
  try {
   const response = await authApi.login(email, password);
   
   if (!response.success || !response.data) {
   return null;
  }

   const { user: apiUser, accessToken: _accessToken, refreshToken: _refreshToken } = response.data;

   // Convert API user to SystemUser format
   const systemUser: SystemUser = {
    id: apiUser.id.toString(),
    email: apiUser.email,
    name: `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || apiUser.email,
    role: (apiUser.role as UserRole) || null,
    status: apiUser.status === 'active' ? 'ACTIVE' : 'INACTIVE',
    department: apiUser.department || undefined,
    permissions: getDefaultPermissions((apiUser.role as UserRole) || null),
    createdAt: new Date(),
    updatedAt: new Date(),
   };

   setCurrentUser(systemUser);
   setIsAuthenticated(true);

   // Always use the user's assigned role - no role switching
   setCurrentRole(systemUser.role);

   try {
    localStorage.setItem(SESSION_USER_KEY, systemUser.id);
    localStorage.setItem(SESSION_ROLE_KEY, systemUser.role);
  } catch (e) {
  }

   return systemUser;
  } catch (error) {
   return null;
  }
 };

 const signup = async (email: string, password: string, name: string): Promise<SystemUser | null> => {
  try {
   // For now, signup creates a user request that needs admin approval
   // We'll use the users API to create a user
   const nameParts = name.split(' ');
   const firstName = nameParts[0] || '';
   const lastName = nameParts.slice(1).join(' ') || '';

   const response = await usersApi.create({
   email,
    password,
    firstName,
    lastName,
    status: 'pending',
   });

   if (response.success && response.data) {
    const newUser: SystemUser = {
     id: response.data.id.toString(),
     email: response.data.email || email,
   name,
   role: null,
   status: 'PENDING',
   permissions: getDefaultPermissions(null),
     createdAt: new Date(response.data.createdAt),
     updatedAt: new Date(response.data.updatedAt || response.data.createdAt),
  };

  setSystemUsers(prev => [...prev, newUser]);
  setCurrentUser(newUser);
  setIsAuthenticated(true);
  try {
   localStorage.setItem(SESSION_USER_KEY, newUser.id);
   localStorage.removeItem(SESSION_ROLE_KEY);
  } catch (e) {
  }
  return newUser;
   }
   return null;
  } catch (error) {
   return null;
  }
 };

 const logout = async () => {
  try {
   await authApi.logout();
  } catch (error) {
  } finally {
  setCurrentUser(null);
  setIsAuthenticated(false);
  setCurrentRole(null);
   setPisRecords([]);
   setCustomers([]);
   setProducts([]);
   setSystemUsers([]);
  try {
   localStorage.removeItem(SESSION_USER_KEY);
   localStorage.removeItem(SESSION_ROLE_KEY);
  } catch (e) {
   }
  }
 };

 const addPIS = async (pis: PISRecord) => {
  try {
   const apiData = convertFrontendPISToApi(pis);
   const response = await pisApi.create(apiData);
   if (response.success && response.data) {
    const converted = convertApiPISToFrontend(response.data);
    setPisRecords(prev => [...prev, converted]);
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const updatePIS = async (id: string, updates: Partial<PISRecord>) => {
  try {
   const apiData = convertFrontendPISToApi({ ...updates } as PISRecord);
   const response = await pisApi.update(id, apiData);
   if (response.success && response.data) {
    const converted = convertApiPISToFrontend(response.data);
  setPisRecords(prev =>
     prev.map(pis => (pis.id === id ? converted : pis))
    );
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const deletePIS = async (id: string) => {
  try {
   await pisApi.delete(id);
  setPisRecords(prev => prev.filter(pis => pis.id !== id));
  } catch (error) {
   throw error;
  }
 };

 const getPISById = async (id: string): Promise<PISRecord | undefined> => {
  // If USE_MOCK_DATA is true, just use local state
  if (USE_MOCK_DATA) {
   return pisRecords.find(pis => pis.id === id);
  }
  
  try {
   const response = await pisApi.getById(id);
   if (response.success && response.data) {
    const converted = convertApiPISToFrontend(response.data);
    // Update local state
    setPisRecords(prev => {
     const index = prev.findIndex(p => p.id === id);
     if (index >= 0) {
      const updated = [...prev];
      updated[index] = converted;
      return updated;
     }
     return [...prev, converted];
    });
    return converted;
   }
  } catch (error) {
   // Fallback to local state
  return pisRecords.find(pis => pis.id === id);
  }
 };

 const addHistoryEntry = async (id: string, _entry: PISHistoryEntry) => {
  // History entries are created automatically by the backend when transitions happen
  // This function is kept for compatibility but will refresh from API
  try {
   const updated = await getPISById(id);
   if (updated) {
    // History is included in the response
  setPisRecords(prev =>
     prev.map(pis => (pis.id === id ? updated : pis))
    );
   }
  } catch (error) {
  }
 };

 const transitionPIS = async (
  id: string,
  toStage: string,
  decision: 'APPROVED' | 'REJECTED',
  comments?: string
 ) => {
  try {
   const response = await pisApi.transitionStage(id, toStage, decision, comments);
   if (response.success && response.data) {
    const converted = convertApiPISToFrontend(response.data);
    setPisRecords(prev =>
     prev.map(pis => (pis.id === id ? converted : pis))
    );
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 // Customer management
 const addCustomer = async (customer: Customer) => {
  try {
   const response = await customersApi.create({
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    status: customer.status,
    category: customer.category,
   });
   if (response.success && response.data) {
    const converted = {
     id: response.data.id,
     name: response.data.name,
     company: response.data.company,
     email: response.data.email,
     phone: response.data.phone,
     address: response.data.address || '',
     status: response.data.status,
     category: response.data.category || 'SMB',
     totalPIS: 0,
     createdAt: new Date(response.data.createdAt),
    };
    setCustomers(prev => [...prev, converted]);
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const updateCustomer = async (id: string, updates: Partial<Customer>) => {
  try {
   const response = await customersApi.update(id, updates);
   if (response.success && response.data) {
    const converted = {
     ...response.data,
     createdAt: new Date(response.data.createdAt),
    };
    setCustomers(prev => prev.map(c => (c.id === id ? converted : c)));
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const deleteCustomer = async (id: string) => {
  try {
   await customersApi.delete(id);
  setCustomers(prev => prev.filter(c => c.id !== id));
  } catch (error) {
   throw error;
  }
 };

 // Product management
 const addProduct = async (product: Product) => {
  try {
   const response = await productsApi.create({
    name: product.name,
    code: product.code,
    category: product.category,
    type: product.type,
    status: product.status,
    imageUrl: product.imageUrl,
    ingredients: product.ingredients,
    price: product.price,
    description: product.description,
   });
   if (response.success && response.data) {
    const converted = {
     ...response.data,
     createdAt: new Date(response.data.createdAt),
    };
    setProducts(prev => [...prev, converted]);
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const updateProduct = async (id: string, updates: Partial<Product>) => {
  try {
   const response = await productsApi.update(id, updates);
   if (response.success && response.data) {
    const converted = {
     ...response.data,
     createdAt: new Date(response.data.createdAt),
    };
    setProducts(prev => prev.map(p => (p.id === id ? converted : p)));
    return converted;
   }
  } catch (error) {
   throw error;
  }
 };

 const deleteProduct = async (id: string) => {
  try {
   await productsApi.delete(id);
  setProducts(prev => prev.filter(p => p.id !== id));
  } catch (error) {
   throw error;
  }
 };

 // User management functions
 const assignUserRole = async (userId: string, role: UserRole) => {
  try {
   const userIdNum = parseInt(userId);
   const response = await usersApi.update(userIdNum, {
    role,
    status: 'active',
   });
   if (response.success && response.data) {
    await fetchData(); // Refresh users
    // Update current user if it's the same user
    if (currentUser?.id === userId) {
     const updated = {
      ...currentUser,
      role,
      status: 'ACTIVE' as UserStatus,
      permissions: getDefaultPermissions(role),
     };
     setCurrentUser(updated);
      setCurrentRole(role);
     }
   }
  } catch (error) {
   throw error;
  }
 };

 const updateUserPermissions = (userId: string, permissions: Partial<UserPermissions>) => {
  // Permissions are managed on backend, this is kept for compatibility
  setSystemUsers(prev =>
   prev.map(user => {
    if (user.id === userId) {
     const updatedUser = {
      ...user,
      permissions: { ...user.permissions, ...permissions },
      updatedAt: new Date(),
     };
     if (currentUser?.id === userId) {
      setCurrentUser(updatedUser);
     }
     return updatedUser;
    }
    return user;
   })
  );
 };

 const updateUserStatus = async (userId: string, status: UserStatus) => {
  try {
   const userIdNum = parseInt(userId);
   const apiStatus = status === 'ACTIVE' ? 'active' : status === 'INACTIVE' ? 'inactive' : 'pending';
   const response = await usersApi.update(userIdNum, { status: apiStatus });
   if (response.success) {
    await fetchData(); // Refresh users
     if (currentUser?.id === userId) {
     const updated = { ...currentUser, status };
     setCurrentUser(updated);
    }
   }
  } catch (error) {
   throw error;
  }
 };

 const deleteUser = async (userId: string) => {
  try {
   const userIdNum = parseInt(userId);
   await usersApi.delete(userIdNum);
  setSystemUsers(prev => prev.filter(user => user.id !== userId));
  } catch (error) {
   throw error;
  }
 };

 const getPendingUsers = () => {
  return systemUsers.filter(user => user.status === 'PENDING');
 };

 const getActiveUsers = () => {
  return systemUsers.filter(user => user.status === 'ACTIVE');
 };

 const refreshData = useCallback(async () => {
  await fetchData();
 }, [fetchData]);

 return (
  <PISContext.Provider
   value={{
    pisRecords,
    customers,
    products,
    dashboardStats,
    slaDaysByStage,
    currentRole,
    isAuthenticated,
    currentUser,
    systemUsers,
    isLoading,
    hasInitializedSession,
    isAutoRefreshEnabled,
    setCurrentRole,
    login,
    signup,
    logout,
    addPIS,
    updatePIS,
    transitionPIS,
    deletePIS,
    getPISById,
    addHistoryEntry,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addProduct,
    updateProduct,
    deleteProduct,
    assignUserRole,
    updateUserPermissions,
    updateUserStatus,
    deleteUser,
    getPendingUsers,
    getActiveUsers,
    refreshData,
    refreshDashboardStats,
    setAutoRefreshEnabled,
   }}
  >
   {children}
  </PISContext.Provider>
 );
}

export function usePIS() {
 const context = useContext(PISContext);
 if (context === undefined) {
  throw new Error('usePIS must be used within a PISProvider');
 }
 return context;
}
