// PIS Management Module - Barrel Export
// Re-exports all PIS-related components, context, types, and utilities

// Main PIS Components
export { ImprovedPISManagement, type PISManagementPreset } from './ImprovedPISManagement';
export { EnhancedPISTable } from './EnhancedPISTable';
export { PISDetailsDialog } from './PISDetailsDialog';
export { CreatePISDialog } from './CreatePISDialog';
export { AdvancedFilters, type FilterState } from './AdvancedFilters';
export { PISCodeSidebar } from './PISCodeSidebar';
export { DashboardStats } from './DashboardStats';
export { ImprovedDashboard } from './ImprovedDashboard';
export { StageTemplatesForm } from './StageTemplatesForm';
export { PISChat } from './PISChat';

// Views
export { TasksView } from './TasksView';
export { CustomersView } from './CustomersView';
export { ProductsView } from './ProductsView';
export { AnalyticsView } from './AnalyticsView';
export { SettingsView } from './SettingsView';
export { NewPISView } from './NewPISView';

// Context
export { PISProvider, usePIS } from './context/PISContext';

// Types
export * from './types/pis';

// Utils
export { getRolePermissions } from './utils/permissions';
