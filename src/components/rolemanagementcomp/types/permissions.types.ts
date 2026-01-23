// Comprehensive Permission Types for Role-Based Access Control

// Module-level permission actions
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'import';

// Column-level permission for table fields
export interface ColumnPermission {
  columnId: string;
  columnName: string;
  view: boolean;
  edit: boolean;
  tooltip?: string;
}

// Sub-module/Section with its columns
export interface SubModulePermission {
  subModuleId: string;
  subModuleName: string;
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    export: boolean;
  };
  columns: ColumnPermission[];
}

// Main module with sub-modules
export interface ModulePermission {
  moduleId: string;
  moduleName: string;
  icon: string;
  description: string;
  subModules: SubModulePermission[];
}

// Complete role permissions structure
export interface RolePermissions {
  roleId: string;
  roleName: string;
  modules: ModulePermission[];
  globalSettings: GlobalSettings;
  lastUpdated: string;
  updatedBy: string;
}

export interface GlobalSettings {
  accessToAllModules: boolean;
  allowLogin: boolean;
  allowMultipleSessions: boolean;
  canChangePassword: boolean;
  enableAuditLog: boolean;
  canExportData: boolean;
  canImportData: boolean;
  canAccessReports: boolean;
  canAccessSettings: boolean;
  sessionTimeout: number; // in minutes
}

// Default module structure for the EI Admin Panel
export const DEFAULT_MODULE_PERMISSIONS: ModulePermission[] = [
  {
    moduleId: 'dashboard',
    moduleName: 'Dashboard',
    icon: 'chart',
    description: 'Overview and analytics dashboard',
    subModules: [
      {
        subModuleId: 'dashboard-overview',
        subModuleName: 'Overview',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'stats-cards', columnName: 'Statistics Cards', view: false, edit: false },
          { columnId: 'revenue-chart', columnName: 'Revenue Chart', view: false, edit: false },
          { columnId: 'order-trends', columnName: 'Order Trends', view: false, edit: false },
          { columnId: 'recent-activities', columnName: 'Recent Activities', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'pis',
    moduleName: 'PIS (Product Information System)',
    icon: 'product',
    description: 'Product development and information management',
    subModules: [
      {
        subModuleId: 'pis-products',
        subModuleName: 'Products',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'pis-code', columnName: 'PIS Code', view: false, edit: false },
          { columnId: 'product-name', columnName: 'Product Name', view: false, edit: false },
          { columnId: 'category', columnName: 'Category', view: false, edit: false },
          { columnId: 'client-name', columnName: 'Client Name', view: false, edit: false },
          { columnId: 'formulation', columnName: 'Formulation Details', view: false, edit: false },
          { columnId: 'ingredients', columnName: 'Active Ingredients', view: false, edit: false },
          { columnId: 'stage', columnName: 'Development Stage', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
          { columnId: 'created-date', columnName: 'Created Date', view: false, edit: false },
          { columnId: 'updated-date', columnName: 'Updated Date', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'pis-formulations',
        subModuleName: 'Formulations',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'formula-id', columnName: 'Formula ID', view: false, edit: false },
          { columnId: 'formula-name', columnName: 'Formula Name', view: false, edit: false },
          { columnId: 'ingredients-list', columnName: 'Ingredients List', view: false, edit: false },
          { columnId: 'percentages', columnName: 'Percentages', view: false, edit: false },
          { columnId: 'batch-size', columnName: 'Batch Size', view: false, edit: false },
          { columnId: 'cost', columnName: 'Cost', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'pis-stability',
        subModuleName: 'Stability Testing',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'test-id', columnName: 'Test ID', view: false, edit: false },
          { columnId: 'product-batch', columnName: 'Product Batch', view: false, edit: false },
          { columnId: 'test-parameters', columnName: 'Test Parameters', view: false, edit: false },
          { columnId: 'results', columnName: 'Results', view: false, edit: false },
          { columnId: 'test-date', columnName: 'Test Date', view: false, edit: false },
          { columnId: 'expiry-prediction', columnName: 'Expiry Prediction', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'order-management',
    moduleName: 'Order Management',
    icon: 'order',
    description: 'Order processing and tracking',
    subModules: [
      {
        subModuleId: 'orders-list',
        subModuleName: 'Orders List',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'order-id', columnName: 'Order ID', view: false, edit: false },
          { columnId: 'company-name', columnName: 'Company Name', view: false, edit: false },
          { columnId: 'product-type', columnName: 'Product Type', view: false, edit: false },
          { columnId: 'quantity', columnName: 'Quantity', view: false, edit: false },
          { columnId: 'total-amount', columnName: 'Total Amount', view: false, edit: false },
          { columnId: 'priority', columnName: 'Priority', view: false, edit: false },
          { columnId: 'order-date', columnName: 'Order Date', view: false, edit: false },
          { columnId: 'delivery-date', columnName: 'Delivery Date', view: false, edit: false },
          { columnId: 'order-status', columnName: 'Order Status', view: false, edit: false },
          { columnId: 'payment-status', columnName: 'Payment Status', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'order-hub',
        subModuleName: 'Order Hub',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'hub-dashboard', columnName: 'Hub Dashboard', view: false, edit: false },
          { columnId: 'pending-orders', columnName: 'Pending Orders', view: false, edit: false },
          { columnId: 'processing-orders', columnName: 'Processing Orders', view: false, edit: false },
          { columnId: 'completed-orders', columnName: 'Completed Orders', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'goods-receiving',
        subModuleName: 'Goods Receiving',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'grn-number', columnName: 'GRN Number', view: false, edit: false },
          { columnId: 'item-name', columnName: 'Item Name', view: false, edit: false },
          { columnId: 'ordered-qty', columnName: 'Ordered Quantity', view: false, edit: false },
          { columnId: 'received-qty', columnName: 'Received Quantity', view: false, edit: false },
          { columnId: 'unit', columnName: 'Unit', view: false, edit: false },
          { columnId: 'condition', columnName: 'Condition', view: false, edit: false },
          { columnId: 'notes', columnName: 'Notes', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'inventory',
    moduleName: 'Inventory Management',
    icon: 'inventory',
    description: 'Stock and inventory control',
    subModules: [
      {
        subModuleId: 'raw-materials',
        subModuleName: 'Raw Materials',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'material-code', columnName: 'Material Code', view: false, edit: false },
          { columnId: 'material-name', columnName: 'Material Name', view: false, edit: false },
          { columnId: 'category', columnName: 'Category', view: false, edit: false },
          { columnId: 'current-stock', columnName: 'Current Stock', view: false, edit: false },
          { columnId: 'min-stock', columnName: 'Minimum Stock', view: false, edit: false },
          { columnId: 'unit-price', columnName: 'Unit Price', view: false, edit: false },
          { columnId: 'supplier', columnName: 'Supplier', view: false, edit: false },
          { columnId: 'expiry-date', columnName: 'Expiry Date', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'packaging',
        subModuleName: 'Packaging Materials',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'pkg-code', columnName: 'Package Code', view: false, edit: false },
          { columnId: 'pkg-name', columnName: 'Package Name', view: false, edit: false },
          { columnId: 'pkg-type', columnName: 'Package Type', view: false, edit: false },
          { columnId: 'pkg-stock', columnName: 'Stock', view: false, edit: false },
          { columnId: 'pkg-cost', columnName: 'Cost', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'bom',
        subModuleName: 'Bill of Materials',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'bom-id', columnName: 'BOM ID', view: false, edit: false },
          { columnId: 'product-name', columnName: 'Product Name', view: false, edit: false },
          { columnId: 'components', columnName: 'Components', view: false, edit: false },
          { columnId: 'quantities', columnName: 'Quantities', view: false, edit: false },
          { columnId: 'total-cost', columnName: 'Total Cost', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'vendor-client',
    moduleName: 'Vendors & Clients',
    icon: 'contacts',
    description: 'Vendor and client management',
    subModules: [
      {
        subModuleId: 'vendors',
        subModuleName: 'Vendors',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'vendor-id', columnName: 'Vendor ID', view: false, edit: false },
          { columnId: 'vendor-name', columnName: 'Vendor Name', view: false, edit: false },
          { columnId: 'contact-person', columnName: 'Contact Person', view: false, edit: false },
          { columnId: 'email', columnName: 'Email', view: false, edit: false },
          { columnId: 'phone', columnName: 'Phone', view: false, edit: false },
          { columnId: 'address', columnName: 'Address', view: false, edit: false },
          { columnId: 'gst-number', columnName: 'GST Number', view: false, edit: false },
          { columnId: 'payment-terms', columnName: 'Payment Terms', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'clients',
        subModuleName: 'Clients',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'client-id', columnName: 'Client ID', view: false, edit: false },
          { columnId: 'client-name', columnName: 'Client Name', view: false, edit: false },
          { columnId: 'company-name', columnName: 'Company Name', view: false, edit: false },
          { columnId: 'email', columnName: 'Email', view: false, edit: false },
          { columnId: 'phone', columnName: 'Phone', view: false, edit: false },
          { columnId: 'billing-address', columnName: 'Billing Address', view: false, edit: false },
          { columnId: 'shipping-address', columnName: 'Shipping Address', view: false, edit: false },
          { columnId: 'credit-limit', columnName: 'Credit Limit', view: false, edit: false },
          { columnId: 'outstanding', columnName: 'Outstanding', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'sales-purchase',
    moduleName: 'Sales & Purchase',
    icon: 'transaction',
    description: 'Sales and purchase transactions',
    subModules: [
      {
        subModuleId: 'sales-orders',
        subModuleName: 'Sales Orders',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'so-number', columnName: 'SO Number', view: false, edit: false },
          { columnId: 'client', columnName: 'Client', view: false, edit: false },
          { columnId: 'products', columnName: 'Products', view: false, edit: false },
          { columnId: 'total-value', columnName: 'Total Value', view: false, edit: false },
          { columnId: 'so-date', columnName: 'Order Date', view: false, edit: false },
          { columnId: 'so-status', columnName: 'Status', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'purchase-orders',
        subModuleName: 'Purchase Orders',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'po-number', columnName: 'PO Number', view: false, edit: false },
          { columnId: 'vendor', columnName: 'Vendor', view: false, edit: false },
          { columnId: 'items', columnName: 'Items', view: false, edit: false },
          { columnId: 'total-value', columnName: 'Total Value', view: false, edit: false },
          { columnId: 'po-date', columnName: 'Order Date', view: false, edit: false },
          { columnId: 'delivery-date', columnName: 'Expected Delivery', view: false, edit: false },
          { columnId: 'po-status', columnName: 'Status', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'invoices',
        subModuleName: 'Invoices',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'invoice-number', columnName: 'Invoice Number', view: false, edit: false },
          { columnId: 'client-vendor', columnName: 'Client/Vendor', view: false, edit: false },
          { columnId: 'amount', columnName: 'Amount', view: false, edit: false },
          { columnId: 'tax', columnName: 'Tax', view: false, edit: false },
          { columnId: 'total', columnName: 'Total', view: false, edit: false },
          { columnId: 'due-date', columnName: 'Due Date', view: false, edit: false },
          { columnId: 'payment-status', columnName: 'Payment Status', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'treasury',
    moduleName: 'Treasury Management',
    icon: 'treasury',
    description: 'Financial and treasury operations',
    subModules: [
      {
        subModuleId: 'accounts',
        subModuleName: 'Accounts',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'account-name', columnName: 'Account Name', view: false, edit: false },
          { columnId: 'account-type', columnName: 'Account Type', view: false, edit: false },
          { columnId: 'balance', columnName: 'Balance', view: false, edit: false },
          { columnId: 'bank-name', columnName: 'Bank Name', view: false, edit: false },
          { columnId: 'account-number', columnName: 'Account Number', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'transactions',
        subModuleName: 'Transactions',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'txn-id', columnName: 'Transaction ID', view: false, edit: false },
          { columnId: 'txn-type', columnName: 'Type', view: false, edit: false },
          { columnId: 'amount', columnName: 'Amount', view: false, edit: false },
          { columnId: 'from-account', columnName: 'From Account', view: false, edit: false },
          { columnId: 'to-account', columnName: 'To Account', view: false, edit: false },
          { columnId: 'date', columnName: 'Date', view: false, edit: false },
          { columnId: 'reference', columnName: 'Reference', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'reports',
        subModuleName: 'Financial Reports',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'profit-loss', columnName: 'Profit & Loss', view: false, edit: false },
          { columnId: 'balance-sheet', columnName: 'Balance Sheet', view: false, edit: false },
          { columnId: 'cash-flow', columnName: 'Cash Flow', view: false, edit: false },
          { columnId: 'aging-report', columnName: 'Aging Report', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'enquiry-management',
    moduleName: 'Enquiry Management',
    icon: 'enquiry',
    description: 'Customer enquiries and tickets',
    subModules: [
      {
        subModuleId: 'enquiries',
        subModuleName: 'Enquiries',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'enquiry-id', columnName: 'Enquiry ID', view: false, edit: false },
          { columnId: 'customer-name', columnName: 'Customer Name', view: false, edit: false },
          { columnId: 'subject', columnName: 'Subject', view: false, edit: false },
          { columnId: 'category', columnName: 'Category', view: false, edit: false },
          { columnId: 'priority', columnName: 'Priority', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
          { columnId: 'assigned-to', columnName: 'Assigned To', view: false, edit: false },
          { columnId: 'created-date', columnName: 'Created Date', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'tickets',
        subModuleName: 'Tickets Dashboard',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'open-tickets', columnName: 'Open Tickets', view: false, edit: false },
          { columnId: 'pending-tickets', columnName: 'Pending Tickets', view: false, edit: false },
          { columnId: 'resolved-tickets', columnName: 'Resolved Tickets', view: false, edit: false },
          { columnId: 'response-time', columnName: 'Response Time', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'task-management',
    moduleName: 'Task Management',
    icon: 'task',
    description: 'Task tracking and assignment',
    subModules: [
      {
        subModuleId: 'tasks',
        subModuleName: 'Tasks',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'task-id', columnName: 'Task ID', view: false, edit: false },
          { columnId: 'task-title', columnName: 'Task Title', view: false, edit: false },
          { columnId: 'description', columnName: 'Description', view: false, edit: false },
          { columnId: 'assigned-to', columnName: 'Assigned To', view: false, edit: false },
          { columnId: 'team', columnName: 'Team', view: false, edit: false },
          { columnId: 'priority', columnName: 'Priority', view: false, edit: false },
          { columnId: 'stage', columnName: 'Stage', view: false, edit: false },
          { columnId: 'due-date', columnName: 'Due Date', view: false, edit: false },
          { columnId: 'hours-logged', columnName: 'Hours Logged', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'user-management',
    moduleName: 'User Management',
    icon: 'users',
    description: 'User accounts and access',
    subModules: [
      {
        subModuleId: 'users',
        subModuleName: 'Users',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'user-id', columnName: 'User ID', view: false, edit: false },
          { columnId: 'user-name', columnName: 'User Name', view: false, edit: false },
          { columnId: 'email', columnName: 'Email', view: false, edit: false },
          { columnId: 'role', columnName: 'Role', view: false, edit: false },
          { columnId: 'department', columnName: 'Department', view: false, edit: false },
          { columnId: 'phone', columnName: 'Phone', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
          { columnId: 'last-login', columnName: 'Last Login', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'role-management',
    moduleName: 'Role Management',
    icon: 'roles',
    description: 'Role configuration and permissions',
    subModules: [
      {
        subModuleId: 'roles',
        subModuleName: 'Roles',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'role-id', columnName: 'Role ID', view: false, edit: false },
          { columnId: 'role-name', columnName: 'Role Name', view: false, edit: false },
          { columnId: 'role-level', columnName: 'Role Level', view: false, edit: false },
          { columnId: 'description', columnName: 'Description', view: false, edit: false },
          { columnId: 'users-count', columnName: 'Users Count', view: false, edit: false },
          { columnId: 'status', columnName: 'Status', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'permissions',
        subModuleName: 'Permissions Matrix',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'module-permissions', columnName: 'Module Permissions', view: false, edit: false },
          { columnId: 'column-permissions', columnName: 'Column Permissions', view: false, edit: false },
        ]
      }
    ]
  },
  {
    moduleId: 'settings',
    moduleName: 'Settings',
    icon: 'settings',
    description: 'System configuration',
    subModules: [
      {
        subModuleId: 'general-settings',
        subModuleName: 'General Settings',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'company-info', columnName: 'Company Info', view: false, edit: false },
          { columnId: 'preferences', columnName: 'Preferences', view: false, edit: false },
          { columnId: 'notifications', columnName: 'Notifications', view: false, edit: false },
        ]
      },
      {
        subModuleId: 'system-settings',
        subModuleName: 'System Settings',
        actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        columns: [
          { columnId: 'email-config', columnName: 'Email Configuration', view: false, edit: false },
          { columnId: 'backup', columnName: 'Backup Settings', view: false, edit: false },
          { columnId: 'integrations', columnName: 'Integrations', view: false, edit: false },
        ]
      }
    ]
  }
];

// Default global settings
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  accessToAllModules: false,
  allowLogin: true,
  allowMultipleSessions: false,
  canChangePassword: true,
  enableAuditLog: false,
  canExportData: false,
  canImportData: false,
  canAccessReports: false,
  canAccessSettings: false,
  sessionTimeout: 30
};

// Helper function to create full access permissions for admin roles
export const createFullAccessPermissions = (): ModulePermission[] => {
  return DEFAULT_MODULE_PERMISSIONS.map(module => ({
    ...module,
    subModules: module.subModules.map(subModule => ({
      ...subModule,
      actions: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        approve: true,
        export: true
      },
      columns: subModule.columns.map(col => ({
        ...col,
        view: true,
        edit: true
      }))
    }))
  }));
};

// LocalStorage key for role permissions
export const ROLE_PERMISSIONS_STORAGE_KEY = 'eisthetic_detailed_role_permissions';

// Helper functions for localStorage
export const loadRolePermissionsFromStorage = (): RolePermissions[] => {
  try {
    const stored = localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveRolePermissionsToStorage = (permissions: RolePermissions[]): void => {
  localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions));
};

export const getRolePermissions = (roleId: string): RolePermissions | null => {
  const allPermissions = loadRolePermissionsFromStorage();
  return allPermissions.find(p => p.roleId === roleId) || null;
};

export const saveRolePermission = (permission: RolePermissions): void => {
  const allPermissions = loadRolePermissionsFromStorage();
  const existingIndex = allPermissions.findIndex(p => p.roleId === permission.roleId);
  
  if (existingIndex >= 0) {
    allPermissions[existingIndex] = permission;
  } else {
    allPermissions.push(permission);
  }
  
  saveRolePermissionsToStorage(allPermissions);
};
