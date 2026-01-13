// Main components barrel export
// This file provides organized imports for all components

// Auth components
export { Login, WaitingForRole, RoleSelector } from './auth';

// Layout components
export { Header, Sidebar, ScrollToTopButton } from './layout';

// Dashboard components
export { DashboardStats, ImprovedDashboard } from './dashboard';

// PIS management components
export { 
  ImprovedPISManagement, 
  EnhancedPISTable, 
  PISDetailsDialog, 
  CreatePISDialog, 
  AdvancedFilters,
  type PISManagementPreset,
  type FilterState 
} from './pis';

// Views
export { 
  TasksView, 
  CustomersView, 
  ProductsView, 
  AnalyticsView, 
  SettingsView 
} from './views';

// UI components
export * from './ui/button';
export * from './ui/card';
export * from './ui/badge';
export * from './ui/input';
export * from './ui/label';
export * from './ui/select';
export * from './ui/dialog';
export * from './ui/dropdown-menu';
export * from './ui/tabs';
export * from './ui/table';
export * from './ui/checkbox';
export * from './ui/switch';
export * from './ui/textarea';
export * from './ui/alert';
export * from './ui/collapsible';
export * from './ui/sonner';
