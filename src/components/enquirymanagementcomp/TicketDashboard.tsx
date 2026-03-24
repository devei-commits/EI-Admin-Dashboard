import React, { useState, useEffect, useCallback } from 'react';
import type { 
 TicketDashboardStats, 
 StaffPerformanceMetrics,
 TicketPriority,
 TicketStatus,
} from '../../types/ticket.types';
import { fetchTicketDashboardStats, fetchStaffPerformanceMetrics } from '../../services/ticket.service';

// ==================== Dashboard Stat Card ====================
interface StatCardProps {
 title: string;
 value: number | string;
 subtitle?: string;
 icon: React.ReactNode;
 trend?: { value: number; isPositive: boolean };
 color: 'blue' | 'amber' | 'emerald' | 'red' | 'purple' | 'gray';
 onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
 title, value, subtitle, icon, trend, color, onClick 
}) => {
 const colorClasses = {
  blue: 'bg-blue-50 border-blue-200',
  amber: 'bg-amber-50 border-amber-200',
  emerald: 'bg-emerald-50 border-emerald-200',
  red: 'bg-red-50 border-red-200',
  purple: 'bg-purple-50 border-purple-200',
  gray: 'bg-gray-50 border-gray-200',
 };

 const iconBgClasses = {
  blue: 'bg-blue-200 text-blue-600',
  amber: 'bg-gray-200 text-slate-800',
  emerald: 'bg-emerald-200 text-emerald-600',
  red: 'bg-red-200 text-red-600',
  purple: 'bg-purple-200 text-purple-600',
  gray: 'bg-gray-200 text-gray-600',
 };

 const textClasses = {
  blue: 'text-blue-600',
  amber: 'text-slate-800',
  emerald: 'text-emerald-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
  gray: 'text-gray-600',
 };

 const valueClasses = {
  blue: 'text-blue-900',
  amber: 'text-amber-900',
  emerald: 'text-emerald-900',
  red: 'text-red-900',
  purple: 'text-purple-900',
  gray: 'text-gray-900',
 };

 return (
  <div 
   className={`${colorClasses[color]} rounded-xl p-5 border transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
   onClick={onClick}
  >
   <div className="flex items-start justify-between">
    <div className="flex-1">
     <p className={`text-xs font-semibold ${textClasses[color]} uppercase tracking-wide`}>
      {title}
     </p>
     <p className={`text-3xl font-bold ${valueClasses[color]} mt-1`}>{value}</p>
     {subtitle && (
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
     )}
     {trend && (
      <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
         strokeLinecap="round" 
         strokeLinejoin="round" 
         strokeWidth={2} 
         d={trend.isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} 
        />
       </svg>
       <span className="font-medium">{trend.value}%</span>
       <span className="text-gray-500">vs last week</span>
      </div>
     )}
    </div>
    <div className={`w-12 h-12 rounded-xl ${iconBgClasses[color]} flex items-center justify-center shrink-0`}>
     {icon}
    </div>
   </div>
  </div>
 );
};

// ==================== Priority Badge ====================
const PriorityBadge: React.FC<{ priority: TicketPriority; count: number }> = ({ priority, count }) => {
 const colors = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
 };

 const labels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
 };

 return (
  <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${colors[priority]}`}>
   <span className="font-medium capitalize">{labels[priority]}</span>
   <span className="text-xl font-bold">{count}</span>
  </div>
 );
};

// ==================== Status Progress Bar ====================
interface StatusProgressProps {
 stats: TicketDashboardStats['byStatus'];
 total: number;
}

const StatusProgress: React.FC<StatusProgressProps> = ({ stats, total }) => {
 const statusConfig: { key: keyof typeof stats; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'bg-blue-500' },
  { key: 'open', label: 'Open', color: 'bg-slate-800' },
  { key: 'inProgress', label: 'In Progress', color: 'bg-purple-500' },
  { key: 'pendingCustomer', label: 'Pending Customer', color: 'bg-orange-400' },
  { key: 'pendingInternal', label: 'Pending Internal', color: 'bg-yellow-500' },
  { key: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
  { key: 'closed', label: 'Closed', color: 'bg-gray-400' },
 ];

 return (
  <div className="space-y-4">
   <div className="h-4 flex rounded-full overflow-hidden bg-gray-100">
    {statusConfig.map(({ key, color }) => {
     const percentage = total > 0 ? (stats[key] / total) * 100 : 0;
     if (percentage === 0) return null;
     return (
      <div
       key={key}
       className={`${color} transition-all`}
       style={{ width: `${percentage}%` }}
       title={`${key}: ${stats[key]}`}
      />
     );
    })}
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
    {statusConfig.map(({ key, label, color }) => (
     <div key={key} className="flex items-center gap-2 text-sm">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-800 ml-auto">{stats[key]}</span>
     </div>
    ))}
   </div>
  </div>
 );
};

// ==================== Staff Performance Table ====================
interface StaffPerformanceTableProps {
 metrics: StaffPerformanceMetrics[];
 onStaffClick?: (staffId: string) => void;
}

const StaffPerformanceTable: React.FC<StaffPerformanceTableProps> = ({ metrics, onStaffClick }) => {
 return (
  <div className="overflow-x-auto">
   <table className="w-full">
    <thead>
     <tr className="border-b border-gray-200">
      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff</th>
      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolved Today</th>
      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Time</th>
      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overdue</th>
     </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
     {metrics.map((staff) => (
      <tr 
       key={staff.staffId} 
       className="hover:bg-gray-50 transition-colors cursor-pointer"
       onClick={() => onStaffClick?.(staff.staffId)}
      >
       <td className="py-3 px-4">
        <div className="flex items-center gap-3">
         <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white font-semibold text-sm">
          {staff.staffName.split(' ').map(n => n[0]).join('')}
         </div>
         <div>
          <p className="font-medium text-gray-900">{staff.staffName}</p>
          <p className="text-xs text-gray-500">{staff.department}</p>
         </div>
        </div>
       </td>
       <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-semibold">
         {staff.activeTickets}
        </span>
       </td>
       <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
         {staff.resolvedToday}
        </span>
       </td>
       <td className="py-3 px-4 text-center">
        <span className="text-gray-700 font-medium">{staff.avgResolutionTime}h</span>
       </td>
       <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
         <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
         </svg>
         <span className="font-semibold text-gray-800">{staff.satisfactionScore}</span>
        </div>
       </td>
       <td className="py-3 px-4 text-center">
        {staff.overdueTickets > 0 ? (
         <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-700 font-semibold">
          {staff.overdueTickets}
         </span>
        ) : (
         <span className="text-emerald-500">
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
         </span>
        )}
       </td>
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
};

// ==================== Ticket Trend Chart (Simple) ====================
interface TrendChartProps {
 data: { date: string; created: number; resolved: number }[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
 const maxValue = Math.max(...data.flatMap(d => [d.created, d.resolved]));
 
 return (
  <div className="space-y-4">
   <div className="flex items-center gap-4 justify-end">
    <div className="flex items-center gap-2 text-sm">
     <div className="w-3 h-3 rounded-full bg-blue-500" />
     <span className="text-gray-600">Created</span>
    </div>
    <div className="flex items-center gap-2 text-sm">
     <div className="w-3 h-3 rounded-full bg-emerald-500" />
     <span className="text-gray-600">Resolved</span>
    </div>
   </div>
   <div className="flex items-end gap-2 h-40">
    {data.map((item, index) => (
     <div key={index} className="flex-1 flex flex-col gap-1">
      <div className="flex gap-1 items-end flex-1">
       <div 
        className="flex-1 bg-blue-400 rounded-t transition-all hover:bg-blue-500"
        style={{ height: `${(item.created / maxValue) * 100}%` }}
        title={`Created: ${item.created}`}
       />
       <div 
        className="flex-1 bg-emerald-400 rounded-t transition-all hover:bg-emerald-500"
        style={{ height: `${(item.resolved / maxValue) * 100}%` }}
        title={`Resolved: ${item.resolved}`}
       />
      </div>
      <span className="text-xs text-gray-500 text-center truncate">
       {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
      </span>
     </div>
    ))}
   </div>
  </div>
 );
};

// ==================== SLA Metrics Card ====================
interface SLAMetricsProps {
 metrics: { onTime: number; breached: number; atRisk: number };
}

const SLAMetrics: React.FC<SLAMetricsProps> = ({ metrics }) => {
 const total = metrics.onTime + metrics.breached + metrics.atRisk;
 
 return (
  <div className="space-y-4">
   <div className="grid grid-cols-3 gap-4">
    <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
     <p className="text-2xl font-bold text-emerald-700">{metrics.onTime}</p>
     <p className="text-sm text-emerald-600 font-medium">On Time</p>
     <p className="text-xs text-gray-500 mt-1">
      {total > 0 ? ((metrics.onTime / total) * 100).toFixed(0) : 0}%
     </p>
    </div>
    <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
     <p className="text-2xl font-bold text-slate-900">{metrics.atRisk}</p>
     <p className="text-sm text-slate-800 font-medium">At Risk</p>
     <p className="text-xs text-gray-500 mt-1">
      {total > 0 ? ((metrics.atRisk / total) * 100).toFixed(0) : 0}%
     </p>
    </div>
    <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
     <p className="text-2xl font-bold text-red-700">{metrics.breached}</p>
     <p className="text-sm text-red-600 font-medium">Breached</p>
     <p className="text-xs text-gray-500 mt-1">
      {total > 0 ? ((metrics.breached / total) * 100).toFixed(0) : 0}%
     </p>
    </div>
   </div>
   <div className="h-3 flex rounded-full overflow-hidden bg-gray-100">
    <div 
     className="bg-emerald-500 transition-all" 
     style={{ width: `${total > 0 ? (metrics.onTime / total) * 100 : 0}%` }} 
    />
    <div 
     className="bg-slate-800 transition-all" 
     style={{ width: `${total > 0 ? (metrics.atRisk / total) * 100 : 0}%` }} 
    />
    <div 
     className="bg-red-500 transition-all" 
     style={{ width: `${total > 0 ? (metrics.breached / total) * 100 : 0}%` }} 
    />
   </div>
  </div>
 );
};

// ==================== Main Dashboard Component ====================
interface TicketDashboardProps {
 onNavigateToTickets?: (filter?: { status?: TicketStatus; priority?: TicketPriority }) => void;
 onStaffClick?: (staffId: string) => void;
 /** When provided, use these stats instead of fetching (dynamic from enquiries API). */
 overrideStats?: TicketDashboardStats | null;
}

const TicketDashboard: React.FC<TicketDashboardProps> = ({ 
 onNavigateToTickets,
 onStaffClick,
 overrideStats,
}) => {
 const [stats, setStats] = useState<TicketDashboardStats | null>(null);
 const [staffMetrics, setStaffMetrics] = useState<StaffPerformanceMetrics[]>([]);
 const [loading, setLoading] = useState(!overrideStats);
 const [dateRange, setDateRange] = useState({ from: '', to: '' });

 const loadDashboardData = useCallback(async () => {
  setLoading(true);
  try {
   const [statsResult, staffResult] = await Promise.all([
    fetchTicketDashboardStats(dateRange.from && dateRange.to ? dateRange : undefined),
    fetchStaffPerformanceMetrics(dateRange.from && dateRange.to ? dateRange : undefined),
   ]);
   
   if (statsResult.success && statsResult.data) {
    setStats(statsResult.data);
   }
   if (staffResult.success && staffResult.data) {
    setStaffMetrics(staffResult.data);
   }
  } catch (_error) {
   /* ignored */
  } finally {
   setLoading(false);
  }
 }, [dateRange]);

 useEffect(() => {
  if (overrideStats) {
   setStats(overrideStats);
   setLoading(false);
   return;
  }
  loadDashboardData();
 }, [loadDashboardData, overrideStats]);

 const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
 };

 if (loading) {
  return (
   <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
   </div>
  );
 }

 if (!stats) {
  return (
   <div className="text-center py-20 text-gray-500">
    <p>Failed to load dashboard data</p>
    <button 
     onClick={loadDashboardData}
     className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-800 transition-colors"
    >
     Retry
    </button>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Header with Date Filter */}
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
     <h2 className="text-xl font-bold text-gray-800">Ticket Dashboard</h2>
     <p className="text-sm text-gray-500">Overview of support tickets and team performance</p>
    </div>
    <div className="flex items-center gap-3">
     <input
      type="date"
      value={dateRange.from}
      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 focus:border-transparent"
     />
     <span className="text-gray-400">to</span>
     <input
      type="date"
      value={dateRange.to}
      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 focus:border-transparent"
     />
     <button
      onClick={loadDashboardData}
      className="p-2 bg-gray-100 text-slate-900 rounded-lg hover:bg-gray-200 transition-colors"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
     </button>
    </div>
   </div>

   {/* Quick Stats */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard
     title="Total Tickets"
     value={stats.totalTickets}
     subtitle="All time"
     color="blue"
     icon={
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
     }
     onClick={() => onNavigateToTickets?.()}
    />
    <StatCard
     title="Open Tickets"
     value={stats.openTickets}
     subtitle="Needs attention"
     color="amber"
     trend={{ value: 12, isPositive: false }}
     icon={
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
     }
     onClick={() => onNavigateToTickets?.({ status: 'open' })}
    />
    <StatCard
     title="Closed Today"
     value={stats.closedToday}
     subtitle="Great progress!"
     color="emerald"
     trend={{ value: 25, isPositive: true }}
     icon={
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
     }
     onClick={() => onNavigateToTickets?.({ status: 'closed' })}
    />
    <StatCard
     title="Avg Resolution"
     value={`${stats.avgResolutionTime}h`}
     subtitle="Time to resolve"
     color="purple"
     icon={
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
     }
    />
   </div>

   {/* Main Content Grid */}
   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Left Column - Status & Priority */}
    <div className="lg:col-span-2 space-y-6">
     {/* Status Distribution */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
      <StatusProgress stats={stats.byStatus} total={stats.totalTickets} />
     </div>

     {/* Ticket Trend */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">7-Day Ticket Trend</h3>
      <TrendChart data={stats.ticketTrend} />
     </div>

     {/* Staff Performance */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
       <h3 className="text-lg font-semibold text-gray-800">Staff Performance</h3>
       <button className="text-sm text-slate-800 hover:text-slate-900 font-medium">
        View All
       </button>
      </div>
      {staffMetrics.length > 0 ? (
       <StaffPerformanceTable metrics={staffMetrics} onStaffClick={onStaffClick} />
      ) : (
       <p className="text-center py-8 text-gray-500">No staff data available</p>
      )}
     </div>
    </div>

    {/* Right Column - Priority, SLA, Response Times */}
    <div className="space-y-6">
     {/* Priority Distribution */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">By Priority</h3>
      <div className="space-y-3">
       <PriorityBadge priority="urgent" count={stats.byPriority.urgent} />
       <PriorityBadge priority="high" count={stats.byPriority.high} />
       <PriorityBadge priority="medium" count={stats.byPriority.medium} />
       <PriorityBadge priority="low" count={stats.byPriority.low} />
      </div>
     </div>

     {/* SLA Metrics */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">SLA Performance</h3>
      <SLAMetrics metrics={stats.slaMetrics} />
     </div>

     {/* Response Metrics */}
     <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Response Times</h3>
      <div className="space-y-4">
       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
         </div>
         <span className="text-sm text-gray-600">First Response</span>
        </div>
        <span className="text-lg font-bold text-gray-800">
         {formatTime(stats.responseMetrics.avgFirstResponseTime)}
        </span>
       </div>
       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
         </div>
         <span className="text-sm text-gray-600">Avg Response</span>
        </div>
        <span className="text-lg font-bold text-gray-800">
         {formatTime(stats.responseMetrics.avgResponseTime)}
        </span>
       </div>
       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
         </div>
         <span className="text-sm text-gray-600">Avg Resolution</span>
        </div>
        <span className="text-lg font-bold text-gray-800">
         {formatTime(stats.responseMetrics.avgResolutionTime)}
        </span>
       </div>
      </div>
     </div>
    </div>
   </div>
  </div>
 );
};

export default TicketDashboard;
