import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Download, RefreshCw, FileText, PieChart, Activity, Clock } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { usePIS } from '../context/PISContext';
import { PISStage, UserRole } from '../types/pis';
import { getStageLabel } from '../utils/permissions';

interface AnalyticsViewProps {
 currentRole: UserRole;
}

export function AnalyticsView({ currentRole }: AnalyticsViewProps) {
 const { pisRecords, currentUser } = usePIS();
 const [timeRange, setTimeRange] = useState('30d');
 const [isRefreshing, setIsRefreshing] = useState(false);

 // Filter PIS records based on role permissions
 const roleScopedRecords = useMemo(() => {
  // SUPER_ADMIN and ADMIN see all records
  if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
   return pisRecords;
  }

  // Filter based on role
  return pisRecords.filter((pis) => {
   switch (currentRole) {
    case 'BD_MANAGER':
     return (
      (pis.stage === 'BD_INTAKE' ||
       pis.stage === 'ALIGNMENT' ||
       pis.stage === 'AGREEMENT' ||
       pis.stage === 'WAY_FORWARD') &&
      pis.assignedBdRole !== 'BD_STAFF'
     );
    case 'BD_STAFF':
     return (
      (pis.stage === 'BD_INTAKE' ||
       pis.stage === 'ALIGNMENT' ||
       pis.stage === 'AGREEMENT' ||
       pis.stage === 'WAY_FORWARD') &&
      pis.assignedBdRole === 'BD_STAFF' &&
      (!!currentUser && pis.assignedBdStaffId === currentUser.id)
     );
    case 'RND_LEAD':
     return (
      pis.stage === 'ALIGNMENT' ||
      pis.stage === 'AGREEMENT' ||
      pis.stage === 'RND_LEAD_REVIEW' ||
      pis.stage === 'RND_DEVELOPMENT' ||
      pis.stage === 'QUALITY_REVIEW'
     );
    case 'RND_STAFF': {
     if (!currentUser) return false;
     const identities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     return (
      (pis.stage === 'RND_DEVELOPMENT' || pis.stage === 'QUALITY_REVIEW') &&
      pis.rndStaffAssignment &&
      identities.includes(pis.rndStaffAssignment)
     );
    }
    case 'QA_MANAGER':
    case 'QA_STAFF':
     return pis.stage === 'QUALITY_REVIEW' || pis.stage === 'WAY_FORWARD';
    case 'PKG_STAFF':
     return pis.stage === 'PACKAGING' || pis.stage === 'QUALITY_REVIEW';
    case 'CLIENT':
     return (
      !!currentUser &&
      (pis.createdById === currentUser.id || pis.customerId === currentUser.id)
     );
    default:
     return false;
   }
  });
 }, [pisRecords, currentRole, currentUser]);

 // Calculate real statistics from role-scoped PIS data
 const stats = useMemo(() => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentRecords = roleScopedRecords.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
  
  // Status distribution
  const statusCounts = roleScopedRecords.reduce((acc, r) => {
   acc[r.status] = (acc[r.status] || 0) + 1;
   return acc;
  }, {} as Record<string, number>);

  // Stage distribution
  const stageCounts = roleScopedRecords.reduce((acc, r) => {
   acc[r.stage] = (acc[r.stage] || 0) + 1;
   return acc;
  }, {} as Record<string, number>);

  // Monthly trend (simplified)
  const monthlyData = roleScopedRecords.reduce((acc, r) => {
   const month = new Date(r.createdAt).toLocaleString('default', { month: 'short' });
   acc[month] = (acc[month] || 0) + 1;
   return acc;
  }, {} as Record<string, number>);

  // Calculate completion rate
  const completed = statusCounts['COMPLETED'] || 0;
  const total = roleScopedRecords.length || 1;
  const completionRate = Math.round((completed / total) * 100);

  // Average time (simulated based on status)
  const avgProcessingDays = roleScopedRecords.length > 0 ? 
   Math.round(roleScopedRecords.reduce((sum, r) => {
    const created = new Date(r.createdAt);
    const updated = new Date(r.updatedAt || r.createdAt);
    return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
   }, 0) / roleScopedRecords.length) : 0;

  // Most looped PIS
  const mostLooped = [...roleScopedRecords]
   .filter(r => (r.loopCount ?? 0) > 0)
   .sort((a, b) => (b.loopCount ?? 0) - (a.loopCount ?? 0))
   .slice(0, 5);

  return {
   total: roleScopedRecords.length,
   recentCount: recentRecords.length,
   statusCounts,
   stageCounts,
   monthlyData,
   completionRate,
   avgProcessingDays,
   inProgress: (statusCounts['IN_PROGRESS'] || 0),
   pending: statusCounts['PENDING'] || 0,
   mostLooped,
  };
 }, [roleScopedRecords]);

 const handleRefresh = () => {
  setIsRefreshing(true);
  setTimeout(() => setIsRefreshing(false), 1000);
 };

 const handleExport = () => {
  // Create CSV content
  const headers = ['ID', 'PIS Code', 'Formulation', 'Customer', 'Status', 'Stage', 'Created At', 'Updated At'];
  const rows = roleScopedRecords.map(r => [
   r.id,
   r.pisCode,
   r.formulation,
   r.customer,
   r.status,
   r.stage,
   new Date(r.createdAt).toLocaleDateString(),
   new Date(r.updatedAt || r.createdAt).toLocaleDateString()
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  
  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pis-analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
 };

 // Status bar chart data
 const statusData = useMemo(() => {
  const statuses = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ON_HOLD', 'COMPLETED', 'TERMINATED'];
  const maxCount = Math.max(...statuses.map(s => stats.statusCounts[s] || 0), 1);
  return statuses.map(status => ({
   label: status.replace(/_/g, ' '),
   count: stats.statusCounts[status] || 0,
   percentage: Math.round(((stats.statusCounts[status] || 0) / maxCount) * 100),
  }));
 }, [stats.statusCounts]);

 const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
   PENDING: 'bg-gray-400',
   IN_PROGRESS: 'bg-blue-500',
   APPROVED: 'bg-emerald-500',
   COMPLETED: 'bg-green-500',
   REJECTED: 'bg-red-500',
   ON_HOLD: 'bg-slate-800',
   TERMINATED: 'bg-slate-500',
  };
  return colors[status.replace(/ /g, '_')] || 'bg-gray-400';
 };

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
     <h2 className="text-3xl font-bold text-gray-900">Analytics & Reports</h2>
     <p className="text-gray-600">View detailed analytics and generate reports</p>
    </div>
    <div className="flex gap-3">
     <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger className="w-40">
       <Calendar className="h-4 w-4 mr-2" />
       <SelectValue />
      </SelectTrigger>
      <SelectContent>
       <SelectItem value="7d">Last 7 days</SelectItem>
       <SelectItem value="30d">Last 30 days</SelectItem>
       <SelectItem value="90d">Last 90 days</SelectItem>
       <SelectItem value="1y">Last year</SelectItem>
      </SelectContent>
     </Select>
     <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      Refresh
     </Button>
     <Button onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      Export
     </Button>
    </div>
   </div>

   {/* Key Metrics */}
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <Card className="p-4">
     <div className="flex items-center justify-between">
      <div>
       <p className="text-sm text-gray-500">Total PIS Records</p>
       <p className="text-3xl font-bold mt-1">{stats.total}</p>
      </div>
      <div className="p-3 bg-blue-100 rounded-full">
       <FileText className="h-6 w-6 text-blue-600" />
      </div>
     </div>
     <div className="flex items-center gap-1 mt-2 text-sm">
      <TrendingUp className="h-4 w-4 text-green-500" />
      <span className="text-green-600">+{stats.recentCount}</span>
      <span className="text-gray-500">this month</span>
     </div>
    </Card>

    <Card className="p-4">
     <div className="flex items-center justify-between">
      <div>
       <p className="text-sm text-gray-500">Completion Rate</p>
       <p className="text-3xl font-bold mt-1">{stats.completionRate}%</p>
      </div>
      <div className="p-3 bg-green-100 rounded-full">
       <PieChart className="h-6 w-6 text-green-600" />
      </div>
     </div>
     <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
      <div 
       className="bg-green-500 h-2 rounded-full transition-all duration-500"
       style={{ width: `${stats.completionRate}%` }}
      />
     </div>
    </Card>

    <Card className="p-4">
     <div className="flex items-center justify-between">
      <div>
       <p className="text-sm text-gray-500">In Progress</p>
       <p className="text-3xl font-bold mt-1">{stats.inProgress}</p>
      </div>
      <div className="p-3 bg-gray-100 rounded-full">
       <Activity className="h-6 w-6 text-slate-800" />
      </div>
     </div>
     <div className="flex items-center gap-1 mt-2 text-sm">
      <Badge variant="outline" className="text-xs">Active workflows</Badge>
     </div>
    </Card>

    <Card className="p-4">
     <div className="flex items-center justify-between">
      <div>
       <p className="text-sm text-gray-500">Avg. Processing Time</p>
       <p className="text-3xl font-bold mt-1">{stats.avgProcessingDays}d</p>
      </div>
      <div className="p-3 bg-purple-100 rounded-full">
       <Clock className="h-6 w-6 text-purple-600" />
      </div>
     </div>
     <div className="flex items-center gap-1 mt-2 text-sm">
      <TrendingDown className="h-4 w-4 text-green-500" />
      <span className="text-green-600">-2d</span>
      <span className="text-gray-500">vs last month</span>
     </div>
    </Card>
   </div>

   {/* Most Looped PIS */}
   {stats.mostLooped.length > 0 && (
    <Card className="p-6">
     <h3 className="text-lg font-semibold mb-4">Most Looped PIS (BD/R&D/QA/Client rework)</h3>
     <div className="space-y-3">
      {stats.mostLooped.map((pis) => (
       <div
        key={pis.id}
        className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
       >
        <div>
         <p className="font-medium text-blue-700">{pis.pisCode}</p>
         <p className="text-xs text-gray-500">{pis.customer}</p>
         <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <Badge variant="outline">{getStageLabel(pis.stage)}</Badge>
          <span>
           Loops: <span className="font-semibold">{pis.loopCount ?? 0}</span>
          </span>
         </div>
        </div>
       </div>
      ))}
     </div>
    </Card>
   )}

   {/* Charts Section */}
   <Tabs defaultValue="status" className="space-y-4">
    <TabsList>
     <TabsTrigger value="status" className="flex items-center gap-2">
      <BarChart3 className="h-4 w-4" />
      Status Distribution
     </TabsTrigger>
     <TabsTrigger value="priority" className="flex items-center gap-2">
      <PieChart className="h-4 w-4" />
      Stage Breakdown
     </TabsTrigger>
     <TabsTrigger value="trend" className="flex items-center gap-2">
      <TrendingUp className="h-4 w-4" />
      Monthly Trend
     </TabsTrigger>
    </TabsList>

    {/* Status Distribution Chart */}
    <TabsContent value="status">
     <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">PIS Status Distribution</h3>
      <div className="space-y-4">
       {statusData.map((item, idx) => (
        <div key={idx} className="space-y-2">
         <div className="flex justify-between text-sm">
          <span className="text-gray-600">{item.label}</span>
          <span className="font-medium">{item.count}</span>
         </div>
         <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
          <div 
           className={`h-8 rounded-full ${getStatusColor(item.label)} transition-all duration-500 flex items-center justify-end pr-3`}
           style={{ width: `${Math.max(item.percentage, 5)}%` }}
          >
           {item.count > 0 && (
            <span className="text-white text-xs font-medium">{item.count}</span>
           )}
          </div>
         </div>
        </div>
       ))}
      </div>
     </Card>
    </TabsContent>

    {/* Stage Breakdown */}
    <TabsContent value="priority">
     <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Stage Distribution</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
       {(
        Object.entries(stats.stageCounts)
         .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
         .slice(0, 3)
         .map(([stage]) => stage as PISStage)
       ).map((stage, index) => {
        const count = stats.stageCounts[stage] || 0;
        const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
        const palette = [
         { bg: 'bg-blue-100', text: 'text-blue-600', bar: 'bg-blue-500' },
         { bg: 'bg-gray-100', text: 'text-slate-800', bar: 'bg-slate-800' },
         { bg: 'bg-green-100', text: 'text-green-600', bar: 'bg-green-500' },
        ];
        const color = palette[index % palette.length];
        const label = getStageLabel(stage);
        
        return (
         <Card key={stage} className={`p-6 ${color.bg}`}>
          <div className="text-center">
           <p className={`text-sm font-medium ${color.text}`}>{label}</p>
           <p className="text-4xl font-bold mt-2">{count}</p>
           <p className="text-sm text-gray-500 mt-1">{percentage}% of total</p>
           <div className="w-full bg-white/50 rounded-full h-2 mt-4">
            <div 
             className={`${color.bar} h-2 rounded-full`}
             style={{ width: `${percentage}%` }}
            />
           </div>
          </div>
         </Card>
        );
       })}
      </div>
     </Card>
    </TabsContent>

    {/* Monthly Trend */}
    <TabsContent value="trend">
     <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Monthly PIS Creation Trend</h3>
      <div className="flex items-end justify-between gap-2 h-64">
       {Object.entries(stats.monthlyData).map(([month, count], idx) => {
        const maxCount = Math.max(...Object.values(stats.monthlyData), 1);
        const height = (count / maxCount) * 100;
        
        return (
         <div key={idx} className="flex-1 flex flex-col items-center gap-2">
          <div 
           className="w-full bg-blue-600 rounded-t-lg transition-all duration-500 relative group"
           style={{ height: `${Math.max(height, 5)}%` }}
          >
           <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {count}
           </div>
          </div>
          <span className="text-xs text-gray-500">{month}</span>
         </div>
        );
       })}
       {Object.keys(stats.monthlyData).length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
         No data available
        </div>
       )}
      </div>
     </Card>
    </TabsContent>
   </Tabs>

   {/* Recent Activity & Quick Stats */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="p-6">
     <h3 className="text-lg font-semibold mb-4">Department Performance</h3>
     <div className="space-y-4">
      {['Business Development', 'R&D', 'Quality Assurance', 'Packaging'].map((dept, idx) => {
       const progress = [75, 68, 82, 91][idx];
       return (
        <div key={dept} className="space-y-2">
         <div className="flex justify-between text-sm">
          <span>{dept}</span>
          <span className="font-medium">{progress}%</span>
         </div>
         <div className="w-full bg-gray-100 rounded-full h-3">
          <div 
           className="bg-blue-500 h-3 rounded-full"
           style={{ width: `${progress}%` }}
          />
         </div>
        </div>
       );
      })}
     </div>
    </Card>

    <Card className="p-6">
     <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
     <div className="grid grid-cols-2 gap-4">
      <div className="p-4 bg-gray-50 rounded-lg">
       <p className="text-2xl font-bold text-green-600">{stats.statusCounts['COMPLETED'] || 0}</p>
       <p className="text-sm text-gray-500">Completed</p>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
       <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
       <p className="text-sm text-gray-500">Pending</p>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
       <p className="text-2xl font-bold text-red-600">{stats.statusCounts['REJECTED'] || 0}</p>
       <p className="text-sm text-gray-500">Rejected</p>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
       <p className="text-2xl font-bold text-blue-600">{stats.recentCount}</p>
       <p className="text-sm text-gray-500">This Month</p>
      </div>
     </div>
    </Card>
   </div>
  </div>
 );
}
