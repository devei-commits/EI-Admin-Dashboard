import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchLowThresholdAlerts } from '../services/warehouseInventory.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';
import { fetchDashboardOverview } from '../services/dashboard.service';
import type {
  DashboardOverview,
  DashboardPendingItem,
  DashboardRecentActivity,
} from '../services/dashboard.service';
import { queryKeys } from '../lib/queryClient';
import { TableSkeleton, SkeletonText } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
// Icons: Phosphor (design language). Aliased to the previous lucide names to keep JSX unchanged.
import {
  SquaresFour as LayoutDashboard,
  Package,
  Users,
  ShieldCheck as Shield,
  ClipboardText as ClipboardList,
  ChatCircle as MessageSquare,
  Envelope as Mail,
  Flask as FlaskConical,
  TestTube as TestTubes,
  Wallet,
  Cube as Box,
  Stack as Layers,
  Buildings as Building2,
  CheckSquare,
  Clock,
  WarningCircle as AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowsClockwise as RefreshCw,
  Truck,
  Tag,
  Percent,
  BookOpen,
  Pill,
  Stethoscope,
  Flask as Beaker,
  CaretRight as ChevronRight,
  Pulse as Activity,
  Lightning as Zap,
  MagnifyingGlass as Search,
  ArrowSquareOut as ExternalLink,
} from '@phosphor-icons/react';

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

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Sales Order', icon: <Plus className="w-5 h-5" />, href: '/fulfillment', color: 'amber', description: 'Sales orders & fulfillment' },
  { label: 'Add User', icon: <Users className="w-5 h-5" />, href: '/user-management', color: 'blue', description: 'Add team member' },
  { label: 'View Tasks', icon: <CheckSquare className="w-5 h-5" />, href: '/task-management', color: 'green', description: 'Manage tasks' },
  { label: 'Enquiries', icon: <MessageSquare className="w-5 h-5" />, href: '/enquiry-management', color: 'purple', description: 'Handle enquiries' },
  { label: 'Planning', icon: <Package className="w-5 h-5" />, href: '/planning/pis-extracted', color: 'orange', description: 'SO planning & PIs' },
  { label: 'PIS Portal', icon: <LayoutDashboard className="w-5 h-5" />, href: '/pis', color: 'rose', description: 'Product Info System' },
];

const MODULE_CARDS: ModuleCard[] = [
  {
    title: 'Order Management',
    icon: <Package className="w-6 h-6" />,
    href: '/fulfillment',
    color: 'amber',
    stats: [{ label: 'Total', value: 156 }, { label: 'Pending', value: 23 }],
    description: 'Sales orders & fulfillment',
  },
  {
    title: 'Order Hub',
    icon: <Truck className="w-6 h-6" />,
    href: '/planning/pis-extracted',
    color: 'orange',
    stats: undefined,
    description: 'SO planning & PIs extracted',
  },
  {
    title: 'Fulfillment',
    icon: <Truck className="w-6 h-6" />,
    href: '/fulfillment',
    color: 'cyan',
    stats: undefined,
    description: 'Pick, invoice & ship sales orders',
  },
  {
    title: 'Planning',
    icon: <Layers className="w-6 h-6" />,
    href: '/planning/pis-extracted',
    color: 'indigo',
    stats: undefined,
    description: 'Demand extraction & batches',
  },
  {
    title: 'Warehouse',
    icon: <Box className="w-6 h-6" />,
    href: '/warehouse',
    color: 'slate',
    stats: undefined,
    description: 'Inbound, inventory & outbound',
  },
  {
    title: 'Production',
    icon: <Beaker className="w-6 h-6" />,
    href: '/production',
    color: 'violet',
    stats: undefined,
    description: 'BMR/BPR & manufacturing',
  },
  {
    title: 'Client Hub',
    icon: <Building2 className="w-6 h-6" />,
    href: '/client-hub',
    color: 'sky',
    stats: undefined,
    description: 'Client orders & portal',
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
    stats: undefined,
    description: 'Track team tasks',
  },
  {
    title: 'Enquiry Management',
    icon: <MessageSquare className="w-6 h-6" />,
    href: '/enquiry-management',
    color: 'purple',
    stats: undefined,
    description: 'Handle customer enquiries',
  },
  {
    title: 'Procurement',
    icon: <ClipboardList className="w-6 h-6" />,
    href: '/procurement',
    color: 'teal',
    stats: undefined,
    description: 'Manage procurement process',
  },
  {
    title: 'Treasury',
    icon: <Wallet className="w-6 h-6" />,
    href: '/treasury',
    color: 'emerald',
    description: 'Financial management',
  },
  {
    title: 'Raw Materials',
    icon: <Beaker className="w-6 h-6" />,
    href: '/raw-material',
    color: 'lime',
    stats: undefined,
    description: 'Raw material inventory',
  },
  {
    title: 'BOM Management',
    icon: <Layers className="w-6 h-6" />,
    href: '/bom',
    color: 'yellow',
    description: 'Bill of Materials',
  },
  {
    title: 'Packaging',
    icon: <Box className="w-6 h-6" />,
    href: '/packaging',
    color: 'pink',
    stats: undefined,
    description: 'Packaging specifications',
  },
  {
    title: 'Vendor & Client',
    icon: <Building2 className="w-6 h-6" />,
    href: '/vendor-client',
    color: 'slate',
    stats: undefined,
    description: 'Manage business partners',
  },
  {
    title: 'Active Ingredients',
    icon: <Pill className="w-6 h-6" />,
    href: '/active-ingredients',
    color: 'violet',
    description: 'API database',
  },
  {
    title: 'Doctor Appointments',
    icon: <Stethoscope className="w-6 h-6" />,
    href: '/doctor-appointments',
    color: 'sky',
    description: 'Manage appointments',
  },
  {
    title: 'New Developments',
    icon: <FlaskConical className="w-6 h-6" />,
    href: '/new-developments',
    color: 'fuchsia',
    stats: undefined,
    description: 'R&D projects',
  },
  {
    title: 'Product Samples',
    icon: <TestTubes className="w-6 h-6" />,
    href: '/product-samples',
    color: 'rose',
    stats: undefined,
    description: 'Sample requests',
  },
  {
    title: 'Coupons',
    icon: <Tag className="w-6 h-6" />,
    href: '/coupon-management',
    color: 'amber',
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
    stats: undefined,
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
const StatCard = ({ title, value, icon, change, changeType, link }: StatCardProps) => {
  const content = (
    <div className="bg-surface rounded-[var(--r-lg)] p-5 border border-hairline hover:shadow-[var(--e2)] transition-all duration-200 group cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-3 font-medium">{title}</p>
          <p className="text-2xl md:text-3xl font-semibold text-ink tabular-nums mt-1">{value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${changeType === 'up' ? 'text-ok' : changeType === 'down' ? 'text-err' : 'text-ink-3'}`}>
              {changeType === 'up' && <ArrowUpRight className="w-4 h-4" />}
              {changeType === 'down' && <ArrowDownRight className="w-4 h-4" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-[var(--r-md)] bg-brand-soft text-brand">
          {icon}
        </div>
      </div>
      {link && (
        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-ink-3">View details</span>
          <ChevronRight className="w-4 h-4 text-ink-4" />
        </div>
      )}
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const getActivityIcon = (type: DashboardRecentActivity['type']) => {
  const icons = {
    order: <Package className="w-4 h-4" />,
    user: <Users className="w-4 h-4" />,
    enquiry: <MessageSquare className="w-4 h-4" />,
    task: <CheckSquare className="w-4 h-4" />,
    system: <Activity className="w-4 h-4" />,
  };
  return icons[type];
};

const getActivityColor = (type: DashboardRecentActivity['type']) => {
  const colors = {
    order: 'bg-neut-soft text-ink-2',
    user: 'bg-info-soft text-info',
    enquiry: 'bg-brand-soft text-brand',
    task: 'bg-ok-soft text-ok',
    system: 'bg-neut-soft text-ink-3',
  };
  return colors[type];
};

const getPriorityColor = (priority: DashboardPendingItem['priority']) => {
  const colors = {
    high: 'bg-err-soft text-err border-[color:var(--st-red-fg)]/25',
    medium: 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/25',
    low: 'bg-neut-soft text-ink-3 border-hairline',
  };
  return colors[priority];
};

// ==================== MAIN COMPONENT ====================
function applyModuleStatsFromOverview(
  modules: ModuleCard[],
  overview: DashboardOverview | undefined
): ModuleCard[] {
  if (!overview) return modules;
  const { stats, websiteRequests, moduleStats: ms } = overview;
  const byTitle: Record<string, { label: string; value: number | string }[] | undefined> = {
    'Order Management': ms.orderManagement
      ? [{ label: 'Total', value: ms.orderManagement.total }, { label: 'Pending', value: ms.orderManagement.pending }]
      : undefined,
    'Order Hub': ms.orderHub
      ? [{ label: 'In Progress', value: ms.orderHub.inProgress }, { label: 'Shipped', value: ms.orderHub.shipped }]
      : undefined,
    'User Management': ms.userManagement
      ? [{ label: 'Active', value: ms.userManagement.active }, { label: 'Total', value: ms.userManagement.total }]
      : undefined,
    'Role Management': ms.roleManagement
      ? [{ label: 'Roles', value: ms.roleManagement.roles }, { label: 'Permissions', value: ms.roleManagement.permissions }]
      : undefined,
    'Task Management': ms.taskManagement
      ? [{ label: 'Open', value: ms.taskManagement.open }, { label: 'Closed FO', value: ms.taskManagement.completedFulfillment }]
      : undefined,
    'Enquiry Management': ms.enquiryManagement
      ? [{ label: 'Open', value: ms.enquiryManagement.open }, { label: 'Resolved', value: ms.enquiryManagement.resolved }]
      : undefined,
    Procurement: ms.procurement
      ? [{ label: 'Pending', value: ms.procurement.pending }, { label: 'Released PO', value: ms.procurement.released }]
      : undefined,
    'Raw Materials': ms.rawMaterials
      ? [{ label: 'Materials', value: ms.rawMaterials.materials }, { label: 'Low Stock', value: ms.rawMaterials.lowStock }]
      : undefined,
    Packaging: ms.packaging ? [{ label: 'Types', value: ms.packaging.types }] : undefined,
    'Vendor & Client': ms.vendorClient
      ? [{ label: 'Vendors', value: ms.vendorClient.vendors }, { label: 'Clients', value: ms.vendorClient.clients }]
      : undefined,
    Catalogue: ms.catalogue ? [{ label: 'Products', value: ms.catalogue.products }] : undefined,
    'New Developments': [{ label: 'Requests', value: websiteRequests.newDevelopmentRequests }],
    'Product Samples': [
      { label: 'Sample', value: websiteRequests.productSampleRequests },
      { label: 'Tech Doc', value: websiteRequests.technicalDocRequests },
    ],
    'Contact Enquiry': [{ label: 'New', value: websiteRequests.contactEnquiries }],
  };
  return modules.map((m) => {
    const statsForCard = byTitle[m.title];
    if (statsForCard) return { ...m, stats: statsForCard };
    if (m.title === 'Treasury' && stats.issuedPos != null) {
      return { ...m, stats: [{ label: 'Released PO', value: stats.issuedPos }] };
    }
    return m;
  });
}

const Dashboard = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'lowThreshold'>('overview');
  const [lowThresholdRows, setLowThresholdRows] = useState<WarehouseInventoryRow[]>([]);
  const [lowThresholdLoading, setLowThresholdLoading] = useState(false);

  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: overviewError,
    error: overviewErrorDetail,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: fetchDashboardOverview,
    staleTime: 60 * 1000,
  });

  const stats = overview?.stats;
  const recentActivity = overview?.recentActivity ?? [];
  const pendingItems = overview?.pendingItems ?? [];

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
    let modules = applyModuleStatsFromOverview(MODULE_CARDS, overview ?? null);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      modules = modules.filter(m => m.title.toLowerCase().includes(term) || m.description.toLowerCase().includes(term));
    }
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string[]> = {
        orders: [
          'Order Management',
          'Order Hub',
          'Fulfillment',
          'Planning',
          'Procurement',
          'Warehouse',
          'Production',
          'Client Hub',
        ],
        users: ['User Management', 'Role Management'],
        inventory: ['Raw Materials', 'BOM Management', 'Packaging', 'Active Ingredients', 'Catalogue'],
        finance: ['Treasury', 'Coupons', 'Discounts'],
        enquiries: ['Enquiry Management', 'Contact Enquiry', 'Doctor Appointments'],
      };
      const allowed = categoryMap[selectedCategory] || [];
      modules = modules.filter(m => allowed.includes(m.title));
    }
    return modules;
  }, [searchTerm, selectedCategory, overview]);

  const statValue = (n: number | undefined) => {
    if (overviewError) return '—';
    if (overviewLoading && n === undefined) return '—';
    return n ?? 0;
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-canvas p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-[image:var(--brand-gradient)] rounded-[var(--r-xl)] p-6 md:p-8 text-white shadow-[var(--e3)] mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-white/60 text-sm font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">{greeting}, {user?.name || 'Admin'}!</h1>
            <p className="text-white/80 mt-2">Welcome to your Admin Tool. Here's an overview of your system.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-[var(--r-md)] p-4 text-center min-w-30">
              <p className="text-3xl font-semibold tabular-nums">{statValue(stats?.totalOrders)}</p>
              <p className="text-xs text-white/70">Total Orders</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-[var(--r-md)] p-4 text-center min-w-30">
              <p className="text-3xl font-semibold tabular-nums">{statValue(stats?.lowStockItems)}</p>
              <p className="text-xs text-white/70">Low Stock</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-[var(--r-md)] p-4 text-center min-w-30">
              <p className="text-3xl font-semibold tabular-nums">{statValue(stats?.issuedPos)}</p>
              <p className="text-xs text-white/70">Issued POs</p>
            </div>
          </div>
        </div>
      </div>

      {overviewError && (
        <div className="mb-4 rounded-[var(--r-md)] border border-[color:var(--st-red-fg)]/30 bg-err-soft px-4 py-3 text-sm text-err">
          Could not load dashboard data
          {overviewErrorDetail instanceof Error ? `: ${overviewErrorDetail.message}` : ''}.{' '}
          <button type="button" onClick={() => void refetchOverview()} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {/* Dashboard tabs: Overview | Low threshold alert */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setDashboardTab('overview')}
          className={`px-4 py-2 rounded-[var(--r-sm)] text-sm font-medium transition-colors ${dashboardTab === 'overview' ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-ink-2 hover:bg-surface-2'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setDashboardTab('lowThreshold')}
          className={`px-4 py-2 rounded-[var(--r-sm)] text-sm font-medium flex items-center gap-2 transition-colors ${dashboardTab === 'lowThreshold' ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-ink-2 hover:bg-surface-2'}`}
        >
          <AlertCircle className="w-4 h-4" />
          Low threshold alert
          {lowThresholdRows.length > 0 && (
            <span className="bg-err text-white text-xs px-1.5 py-0.5 rounded-full tabular-nums">{lowThresholdRows.length}</span>
          )}
        </button>
      </div>

      {/* Low threshold alert tab content */}
      {dashboardTab === 'lowThreshold' && (
        <div className="bg-surface rounded-[var(--r-lg)] shadow-[var(--e1)] border border-hairline p-5 mb-6">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-warn" /> Items at or below reorder point (planning alert)
          </h2>
          {lowThresholdLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : lowThresholdRows.length === 0 ? (
            <EmptyState icon={<AlertCircle />} title="No items currently at or below reorder point." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-3 border-b border-border">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Code</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Name</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Type</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Stock in hand</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Reorder PT</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Status</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {lowThresholdRows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-3">
                      <td className="px-4 py-2 font-medium text-ink">{row.code}</td>
                      <td className="px-4 py-2 text-ink-2">{row.name}</td>
                      <td className="px-4 py-2">{row.type}</td>
                      <td className="px-4 py-2 text-warn font-medium tabular-nums">{row.stockInHand} {row.whUnit}</td>
                      <td className="px-4 py-2 text-ink-3 tabular-nums">{row.reorderPt}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.status === 'Critical' ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link to="/warehouse/inventory" className="text-brand hover:underline font-medium">View inventory</Link>
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
        <StatCard title="Total Orders" value={statValue(stats?.totalOrders)} icon={<Package className="w-6 h-6" />} color="amber" link="/fulfillment" />
        <StatCard title="Pending Review" value={statValue(stats?.pendingReview)} icon={<Clock className="w-6 h-6" />} color="orange" link="/procurement" />
        <StatCard title="Active Users" value={statValue(stats?.activeUsers)} icon={<Users className="w-6 h-6" />} color="blue" link="/user-management" />
        <StatCard title="Open Enquiries" value={statValue(stats?.openEnquiries)} icon={<MessageSquare className="w-6 h-6" />} color="purple" link="/enquiry-management" />
        <StatCard title="Open Tasks" value={statValue(stats?.openTasks)} icon={<CheckSquare className="w-6 h-6" />} color="green" link="/task-management" />
        <StatCard title="Low Stock Items" value={statValue(stats?.lowStockItems)} icon={<AlertCircle className="w-6 h-6" />} color="red" link="/warehouse/inventory" />
      </div>
      )}

      {/* Quick Actions */}
      <div className="bg-surface rounded-[var(--r-lg)] shadow-[var(--e1)] border border-hairline p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand" /> Quick Actions
          </h2>
          <button
            type="button"
            onClick={() => void refetchOverview()}
            disabled={overviewFetching}
            className="text-sm text-brand hover:text-brand-press font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${overviewFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center p-4 bg-surface-2 hover:bg-surface-3 rounded-[var(--r-md)] border border-hairline hover:border-strong transition-all duration-200 group"
            >
              <div className="p-3 bg-surface rounded-[var(--r-md)] shadow-[var(--e1)] text-brand group-hover:shadow-[var(--e2)] transition-all">
                {action.icon}
              </div>
              <span className="text-sm font-medium text-ink-2 mt-2 text-center">{action.label}</span>
              <span className="text-xs text-ink-4 text-center">{action.description}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface rounded-[var(--r-lg)] shadow-[var(--e1)] border border-hairline p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand" /> Recent Activity
            </h2>
            <button type="button" onClick={() => void refetchOverview()} className="text-sm text-brand hover:text-brand-press font-medium">Refresh</button>
          </div>
          <div className="space-y-3">
            {overviewLoading ? (
              <SkeletonText lines={4} className="py-2" />
            ) : recentActivity.length === 0 ? (
              <EmptyState icon={<Activity />} title="No recent activity." compact />
            ) : recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-[var(--r-md)] hover:bg-surface-3 transition-colors">
                <div className={`p-2 rounded-[var(--r-sm)] ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-2">{activity.action}</p>
                  <p className="text-xs text-ink-3">{activity.user} • {activity.module}</p>
                </div>
                <span className="text-xs text-ink-4 whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Items */}
        <div className="bg-surface rounded-[var(--r-lg)] shadow-[var(--e1)] border border-hairline p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-brand" /> Pending Items
            </h2>
            <span className="px-2 py-1 bg-err-soft text-err text-xs font-medium rounded-full tabular-nums">{pendingItems.length} items</span>
          </div>
          <div className="space-y-3">
            {overviewLoading ? (
              <SkeletonText lines={4} className="py-2" />
            ) : pendingItems.length === 0 ? (
              <EmptyState icon={<AlertCircle />} title="Nothing pending right now." compact />
            ) : pendingItems.map((item) => (
              <div key={item.id} className="p-3 rounded-[var(--r-md)] border border-hairline hover:border-strong hover:bg-surface-3 transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-2">{item.title}</p>
                    <p className="text-xs text-ink-3">{item.module}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
                {item.dueDate && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-ink-3">
                    <Clock className="w-3 h-3" /> Due: {item.dueDate}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Modules Section */}
      <div className="min-w-0 max-w-full overflow-hidden bg-surface rounded-[var(--r-lg)] shadow-[var(--e1)] border border-hairline p-4 sm:p-5">
        <div className="mb-6 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h2 className="flex shrink-0 items-center gap-2 text-lg font-semibold text-ink">
            <LayoutDashboard className="h-5 w-5 shrink-0 text-brand" /> All Modules
          </h2>
          <div className="flex min-w-0 w-full flex-col gap-3 lg:max-w-2xl xl:max-w-none xl:flex-1">
            <div className="relative min-w-0 w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-w-0 rounded-[var(--r-sm)] border border-border bg-surface text-ink placeholder:text-ink-4 py-2 pl-9 pr-4 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus:border-[color:var(--accent)]"
              />
            </div>
            <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-[var(--r-sm)] px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id
                    ? 'bg-brand text-brand-ink'
                    : 'bg-surface-3 text-ink-3 hover:bg-surface-2 hover:text-ink'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredModules.map((module) => (
            <Link
              key={module.title}
              to={module.href}
              className="group p-4 rounded-[var(--r-lg)] border border-hairline hover:border-strong hover:shadow-[var(--e2)] transition-all duration-200 bg-surface"
            >
              <div className="w-12 h-12 rounded-[var(--r-md)] bg-brand-soft text-brand flex items-center justify-center mb-3 group-hover:bg-brand group-hover:text-brand-ink transition-colors">
                {module.icon}
              </div>
              <h3 className="font-semibold text-ink group-hover:text-brand transition-colors">{module.title}</h3>
              <p className="text-xs text-ink-3 mt-1">{module.description}</p>
              {module.stats && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-hairline">
                  {module.stats.map((stat, idx) => (
                    <div key={idx} className="text-center">
                      <p className="text-lg font-semibold text-ink-2 tabular-nums">{stat.value}</p>
                      <p className="text-xs text-ink-4">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-ink-4 group-hover:text-brand transition-colors">
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>

        {filteredModules.length === 0 && (
          <EmptyState
            icon={<Search />}
            title="No modules found"
            description="Try adjusting your search or filter"
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-ink-4">
        <p>
          Admin Tool • {filteredModules.length} Modules Available
          {overview?.fetchedAt
            ? ` • Last updated: ${new Date(overview.fetchedAt).toLocaleTimeString()}`
            : ''}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
