import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchLowThresholdAlerts } from '../services/warehouseInventory.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';
import { useGlobalState } from '../context/GlobalStateContext';
import {
  LayoutDashboard,
  Package,
  Users,
  Shield,
  ClipboardList,
  MessageSquare,
  Mail,
  FlaskConical,
  TestTubes,
  Wallet,
  Box,
  Layers,
  Building2,
  TrendingUp,
  CheckSquare,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Truck,
  Tag,
  Percent,
  BookOpen,
  Pill,
  Stethoscope,
  Beaker,
  ChevronRight,
  Activity,
  Zap,
  Search,
  ExternalLink,
} from 'lucide-react';

// ==================== TYPES ====================
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  color: string;
  link?: string;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  description: string;
}

interface ModuleCard {
  title: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  stats?: { label: string; value: number | string }[];
  description: string;
}

interface RecentActivity {
  id: string;
  action: string;
  module: string;
  user: string;
  time: string;
  type: 'order' | 'user' | 'enquiry' | 'task' | 'system';
}

interface PendingItem {
  id: string;
  title: string;
  module: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
}

// ==================== MOCK DATA ====================

const RECENT_ACTIVITY: RecentActivity[] = [
  { id: '1', action: 'New order ORD-2026-0125 created', module: 'Orders', user: 'Priya Sharma', time: '5 mins ago', type: 'order' },
  { id: '2', action: 'User Amit Patel role updated to Manager', module: 'Users', user: 'Admin', time: '15 mins ago', type: 'user' },
  { id: '3', action: 'Enquiry #ENQ-089 resolved', module: 'Enquiries', user: 'Kavita Desai', time: '32 mins ago', type: 'enquiry' },
  { id: '4', action: 'Task "Review BOM specs" completed', module: 'Tasks', user: 'Ravi Verma', time: '1 hour ago', type: 'task' },
  { id: '5', action: 'GRN-2026-0045 approved', module: 'Receiving', user: 'Sunita Joshi', time: '2 hours ago', type: 'order' },
  { id: '6', action: 'New product sample requested', module: 'Samples', user: 'Meera Nair', time: '3 hours ago', type: 'system' },
  { id: '7', action: 'Packaging specs updated for PKG-112', module: 'Packaging', user: 'Anil Mehta', time: '4 hours ago', type: 'system' },
];

// Will be replaced by dynamic data later if needed
const PENDING_ITEMS: PendingItem[] = [
  { id: '1', title: 'Review order ORD-2026-0118', module: 'Orders', priority: 'high', dueDate: 'Today' },
  { id: '2', title: 'Approve GRN for Raw Materials', module: 'Receiving', priority: 'high', dueDate: 'Today' },
  { id: '3', title: 'Update packaging specifications', module: 'Packaging', priority: 'medium', dueDate: 'Tomorrow' },
  { id: '4', title: 'Complete vendor evaluation', module: 'Vendors', priority: 'medium', dueDate: 'Jan 27' },
  { id: '5', title: 'Review new development proposal', module: 'R&D', priority: 'low', dueDate: 'Jan 28' },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Order', icon: <Plus className="w-5 h-5" />, href: '/procurement', color: 'amber', description: 'Create new order' },
  { label: 'Add User', icon: <Users className="w-5 h-5" />, href: '/user-management', color: 'blue', description: 'Add team member' },
  { label: 'View Tasks', icon: <CheckSquare className="w-5 h-5" />, href: '/task-management', color: 'green', description: 'Manage tasks' },
  { label: 'Enquiries', icon: <MessageSquare className="w-5 h-5" />, href: '/enquiry-management', color: 'purple', description: 'Handle enquiries' },
  { label: 'Order Hub', icon: <Package className="w-5 h-5" />, href: '/order-hub', color: 'orange', description: 'Track all orders' },
  { label: 'PIS Portal', icon: <LayoutDashboard className="w-5 h-5" />, href: '/pis', color: 'rose', description: 'Product Info System' },
];

const MODULE_CARDS: ModuleCard[] = [
  {
    title: 'Order Management',
    icon: <Package className="w-6 h-6" />,
    href: '/procurement',
    color: 'amber',
    stats: [{ label: 'Total', value: 156 }, { label: 'Pending', value: 23 }],
    description: 'Create and manage orders',
  },
  {
    title: 'Order Hub',
    icon: <Truck className="w-6 h-6" />,
    href: '/order-hub',
    color: 'orange',
    stats: [{ label: 'In Progress', value: 45 }, { label: 'Shipped', value: 89 }],
    description: 'Track order lifecycle',
  },
  {
    title: 'User Management',
    icon: <Users className="w-6 h-6" />,
    href: '/user-management',
    color: 'blue',
    stats: [{ label: 'Active', value: 42 }, { label: 'Total', value: 58 }],
    description: 'Manage users & access',
  },
  {
    title: 'Role Management',
    icon: <Shield className="w-6 h-6" />,
    href: '/role-management',
    color: 'indigo',
    stats: [{ label: 'Roles', value: 8 }, { label: 'Permissions', value: 24 }],
    description: 'Define roles & permissions',
  },
  {
    title: 'Task Management',
    icon: <CheckSquare className="w-6 h-6" />,
    href: '/task-management',
    color: 'green',
    stats: [{ label: 'Open', value: 18 }, { label: 'Completed', value: 127 }],
    description: 'Track team tasks',
  },
  {
    title: 'Enquiry Management',
    icon: <MessageSquare className="w-6 h-6" />,
    href: '/enquiry-management',
    color: 'purple',
    stats: [{ label: 'Open', value: 12 }, { label: 'Resolved', value: 77 }],
    description: 'Handle customer enquiries',
  },
  {
    title: 'Procurement',
    icon: <ClipboardList className="w-6 h-6" />,
    href: '/procurement',
    color: 'teal',
    stats: [{ label: 'Pending', value: 8 }, { label: 'Approved', value: 156 }],
    description: 'Manage procurement process',
  },
  {
    title: 'Treasury',
    icon: <Wallet className="w-6 h-6" />,
    href: '/treasury',
    color: 'emerald',
    stats: [{ label: 'Balance', value: '₹24.5L' }],
    description: 'Financial management',
  },
  {
    title: 'Raw Materials',
    icon: <Beaker className="w-6 h-6" />,
    href: '/raw-material',
    color: 'lime',
    stats: [{ label: 'Materials', value: 89 }, { label: 'Low Stock', value: 5 }],
    description: 'Raw material inventory',
  },
  {
    title: 'BOM Management',
    icon: <Layers className="w-6 h-6" />,
    href: '/bom',
    color: 'yellow',
    stats: [{ label: 'BOMs', value: 67 }],
    description: 'Bill of Materials',
  },
  {
    title: 'Packaging',
    icon: <Box className="w-6 h-6" />,
    href: '/packaging',
    color: 'pink',
    stats: [{ label: 'Types', value: 45 }],
    description: 'Packaging specifications',
  },
  {
    title: 'Vendor & Client',
    icon: <Building2 className="w-6 h-6" />,
    href: '/vendor-client',
    color: 'slate',
    stats: [{ label: 'Vendors', value: 34 }, { label: 'Clients', value: 56 }],
    description: 'Manage business partners',
  },
  {
    title: 'Active Ingredients',
    icon: <Pill className="w-6 h-6" />,
    href: '/active-ingredients',
    color: 'violet',
    stats: [{ label: 'APIs', value: 78 }],
    description: 'API database',
  },
  {
    title: 'Doctor Appointments',
    icon: <Stethoscope className="w-6 h-6" />,
    href: '/doctor-appointments',
    color: 'sky',
    stats: [{ label: 'Today', value: 8 }, { label: 'Week', value: 34 }],
    description: 'Manage appointments',
  },
  {
    title: 'New Developments',
    icon: <FlaskConical className="w-6 h-6" />,
    href: '/new-developments',
    color: 'fuchsia',
    stats: [{ label: 'Active', value: 12 }],
    description: 'R&D projects',
  },
  {
    title: 'Product Samples',
    icon: <TestTubes className="w-6 h-6" />,
    href: '/product-samples',
    color: 'rose',
    stats: [{ label: 'Pending', value: 6 }],
    description: 'Sample requests',
  },
  {
    title: 'Coupons',
    icon: <Tag className="w-6 h-6" />,
    href: '/coupon-management',
    color: 'amber',
    stats: [{ label: 'Active', value: 15 }],
    description: 'Manage coupons',
  },
  {
    title: 'Discounts',
    icon: <Percent className="w-6 h-6" />,
    href: '/discount-management',
    color: 'orange',
    stats: [{ label: 'Schemes', value: 8 }],
    description: 'Discount schemes',
  },
  {
    title: 'Catalogue',
    icon: <BookOpen className="w-6 h-6" />,
    href: '/catalogue-management',
    color: 'blue',
    stats: [{ label: 'Products', value: 234 }],
    description: 'Product catalogue',
  },
  {
    title: 'Contact Enquiry',
    icon: <Mail className="w-6 h-6" />,
    href: '/contact-enquiry',
    color: 'gray',
    stats: [{ label: 'New', value: 5 }],
    description: 'Contact form submissions',
  },
  {
    title: 'PIS Portal',
    icon: <LayoutDashboard className="w-6 h-6" />,
    href: '/pis',
    color: 'amber',
    description: 'Product Information System',
  },
];

// ==================== HELPER COMPONENTS ====================
const StatCard = ({ title, value, icon, change, changeType, color, link }: StatCardProps) => {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    amber: { bg: 'bg-gray-50 border-gray-100', icon: 'text-slate-700' },
    blue: { bg: 'bg-blue-50 border-blue-100', icon: 'text-blue-500' },
    green: { bg: 'bg-green-50 border-green-100', icon: 'text-green-500' },
    purple: { bg: 'bg-purple-50 border-purple-100', icon: 'text-purple-500' },
    red: { bg: 'bg-red-50 border-red-100', icon: 'text-red-500' },
    orange: { bg: 'bg-orange-50 border-orange-100', icon: 'text-slate-700' },
  };
  const colors = colorClasses[color] || colorClasses.amber;

  const content = (
    <div className={`${colors.bg} rounded-xl p-5 border hover:shadow-md transition-all duration-200 group cursor-pointer`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${changeType === 'up' ? 'text-green-600' : changeType === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
              {changeType === 'up' && <ArrowUpRight className="w-4 h-4" />}
              {changeType === 'down' && <ArrowDownRight className="w-4 h-4" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-white shadow-sm ${colors.icon}`}>
          {icon}
        </div>
      </div>
      {link && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-gray-500">View details</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      )}
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const getActivityIcon = (type: RecentActivity['type']) => {
  const icons = {
    order: <Package className="w-4 h-4" />,
    user: <Users className="w-4 h-4" />,
    enquiry: <MessageSquare className="w-4 h-4" />,
    task: <CheckSquare className="w-4 h-4" />,
    system: <Activity className="w-4 h-4" />,
  };
  return icons[type];
};

const getActivityColor = (type: RecentActivity['type']) => {
  const colors = {
    order: 'bg-gray-100 text-slate-800',
    user: 'bg-blue-100 text-blue-600',
    enquiry: 'bg-purple-100 text-purple-600',
    task: 'bg-green-100 text-green-600',
    system: 'bg-gray-100 text-gray-600',
  };
  return colors[type];
};

const getPriorityColor = (priority: PendingItem['priority']) => {
  const colors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-gray-100 text-slate-900 border-gray-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return colors[priority];
};

// ==================== MAIN COMPONENT ====================
const Dashboard = () => {
  const { user } = useAuth();
  const { state } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'lowThreshold'>('overview');
  const [lowThresholdRows, setLowThresholdRows] = useState<WarehouseInventoryRow[]>([]);
  const [lowThresholdLoading, setLowThresholdLoading] = useState(false);

  useEffect(() => {
    if (dashboardTab !== 'lowThreshold') return;
    setLowThresholdLoading(true);
    fetchLowThresholdAlerts()
      .then((res) => {
        if (res.success && res.data?.rows) setLowThresholdRows(res.data.rows);
        else setLowThresholdRows([]);
      })
      .finally(() => setLowThresholdLoading(false));
  }, [dashboardTab]);

  const categories = [
    { id: 'all', label: 'All Modules' },
    { id: 'orders', label: 'Orders' },
    { id: 'users', label: 'Users & Roles' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'finance', label: 'Finance' },
    { id: 'enquiries', label: 'Enquiries' },
  ];

  const filteredModules = useMemo(() => {
    let modules = MODULE_CARDS;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      modules = modules.filter(m => m.title.toLowerCase().includes(term) || m.description.toLowerCase().includes(term));
    }
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string[]> = {
        orders: ['Order Management', 'Order Hub', 'Procurement', 'Order List'],
        users: ['User Management', 'Role Management'],
        inventory: ['Items Master', 'Raw Materials', 'BOM Management', 'Packaging', 'Active Ingredients'],
        finance: ['Treasury', 'Sales & Purchase', 'Coupons', 'Discounts'],
        enquiries: ['Enquiry Management', 'Contact Enquiry', 'Doctor Appointments'],
      };
      const allowed = categoryMap[selectedCategory] || [];
      modules = modules.filter(m => allowed.includes(m.title));
    }
    return modules;
  }, [searchTerm, selectedCategory]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-gray-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-gray-300 text-sm font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">{greeting}, {user?.name || 'Admin'}!</h1>
            <p className="text-gray-100 mt-2">Welcome to your Admin Tool. Here's an overview of your system.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center min-w-30">
              <p className="text-3xl font-bold">{state.orders?.customerPOs?.length + state.orders?.salesOrders?.length || 0}</p>
              <p className="text-xs text-gray-100">Total Orders</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center min-w-30">
              <p className="text-3xl font-bold">{state.items?.filter((i: any) => i.stock < 500).length || 0}</p>
              <p className="text-xs text-gray-100">Low Stock</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center min-w-30">
              <p className="text-3xl font-bold">{state.po?.issued?.length || 0}</p>
              <p className="text-xs text-gray-100">Issued POs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard tabs: Overview | Low threshold alert */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setDashboardTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${dashboardTab === 'overview' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setDashboardTab('lowThreshold')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${dashboardTab === 'lowThreshold' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <AlertCircle className="w-4 h-4" />
          Low threshold alert
          {lowThresholdRows.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{lowThresholdRows.length}</span>
          )}
        </button>
      </div>

      {/* Low threshold alert tab content */}
      {dashboardTab === 'lowThreshold' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600" /> Items at or below reorder point (planning alert)
          </h2>
          {lowThresholdLoading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : lowThresholdRows.length === 0 ? (
            <p className="text-gray-500 text-sm">No items currently at or below reorder point.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Stock in hand</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Reorder PT</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowThresholdRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{row.code}</td>
                      <td className="px-4 py-2 text-gray-700">{row.name}</td>
                      <td className="px-4 py-2">{row.type}</td>
                      <td className="px-4 py-2 text-amber-700 font-medium">{row.stockInHand} {row.whUnit}</td>
                      <td className="px-4 py-2 text-gray-600">{row.reorderPt}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.status === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link to="/warehouse/inventory" className="text-blue-600 hover:underline font-medium">View inventory</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid — hide when Low threshold tab is active so content is focused */}
      {dashboardTab === 'overview' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Orders" value={state.orders?.customerPOs?.length + state.orders?.salesOrders?.length || 0} icon={<Package className="w-6 h-6" />} change="+12% this month" changeType="up" color="amber" link="/procurement" />
        <StatCard title="Pending Review" value={state.orders?.customerPOs?.filter((po: any) => po.status.includes('pending')).length || 0} icon={<Clock className="w-6 h-6" />} change="urgent" changeType="down" color="orange" link="/order-hub" />
        <StatCard title="Active Users" value={42} icon={<Users className="w-6 h-6" />} change="+3 this week" changeType="up" color="blue" link="/user-management" />
        <StatCard title="Open Enquiries" value={89} icon={<MessageSquare className="w-6 h-6" />} change="+8% resolved" changeType="up" color="purple" link="/enquiry-management" />
        <StatCard title="Open Tasks" value={18} icon={<CheckSquare className="w-6 h-6" />} change={`127 completed`} changeType="neutral" color="green" link="/task-management" />
        <StatCard title="Low Stock Items" value={state.items?.filter((i: any) => i.stock < 500).length || 0} icon={<AlertCircle className="w-6 h-6" />} change="Needs attention" changeType="down" color="red" link="/raw-material" />
      </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-slate-700" /> Quick Actions
          </h2>
          <button className="text-sm text-slate-800 hover:text-slate-900 font-medium flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 group"
            >
              <div className="p-3 bg-white rounded-xl shadow-sm text-slate-700 group-hover:text-slate-800 group-hover:shadow-md transition-all">
                {action.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 mt-2 text-center">{action.label}</span>
              <span className="text-xs text-gray-400 text-center">{action.description}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-700" /> Recent Activity
            </h2>
            <button className="text-sm text-slate-800 hover:text-slate-900 font-medium">View All</button>
          </div>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.user} • {activity.module}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-slate-700" /> Pending Items
            </h2>
            <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">{PENDING_ITEMS.length} items</span>
          </div>
          <div className="space-y-3">
            {PENDING_ITEMS.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.module}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
                {item.dueDate && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" /> Due: {item.dueDate}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Modules Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-slate-700" /> All Modules
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${selectedCategory === cat.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredModules.map((module) => {
            const colorMap: Record<string, string> = {
              amber: 'bg-amber-500',
              blue: 'bg-blue-500',
              green: 'bg-green-600',
              purple: 'bg-purple-600',
              indigo: 'bg-indigo-500',
              teal: 'bg-teal-500',
              emerald: 'bg-emerald-500',
              cyan: 'bg-cyan-500',
              lime: 'bg-lime-500',
              yellow: 'bg-yellow-500',
              pink: 'bg-pink-500',
              rose: 'bg-rose-500',
              red: 'bg-red-500',
              orange: 'bg-orange-500',
              violet: 'bg-violet-500',
              sky: 'bg-sky-500',
              fuchsia: 'bg-fuchsia-500',
              slate: 'bg-slate-500',
              gray: 'bg-gray-500',
            };
            const gradient = colorMap[module.color] || colorMap.amber;

            return (
              <Link
                key={module.title}
                to={module.href}
                className="group p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200 bg-white"
              >
                <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                  {module.icon}
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-slate-800 transition-colors">{module.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{module.description}</p>
                {module.stats && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                    {module.stats.map((stat, idx) => (
                      <div key={idx} className="text-center">
                        <p className="text-lg font-bold text-gray-700">{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400 group-hover:text-slate-700 transition-colors">
                  <span>Open</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>

        {filteredModules.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No modules found</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-gray-400">
        <p>Admin Tool • {filteredModules.length} Modules Available • Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default Dashboard;
