import { useEffect, useMemo, useState, useCallback } from 'react';
import { UserRole, PISRecord, PISStage } from '../types/pis';
import { DashboardStats } from './DashboardStats';
import { usePIS } from '../context/PISContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { getStageLabel } from '../utils/permissions';
import { ArrowRight, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { PISDetailsDialog } from './PISDetailsDialog';
import { getServerBaseUrl, pisApi } from '../utils/api';
import QuotationsDashboardWidget from '../../../pages/quotations/QuotationsDashboardWidget';
import { toast } from 'sonner';
import { SkeletonText } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';

// Type definitions for dashboard data
interface PendingUpload {
 id: string;
 fileName?: string;
 fileUrl?: string;
 pis?: {
  pisCode?: string;
  stage?: string;
 };
}

interface StageCount {
 stage: string;
 count: number;
}

interface StatusCount {
 status: string;
 count: number;
}

interface Deadline {
 id: string;
 pisCode?: string;
 customer?: string;
 stage?: string;
 dueAt?: string;
 isOverdue?: boolean;
}

interface TopClient {
 name: string;
 count: number;
}

interface WorkloadItem {
 assignee: string;
 count: number;
}

interface ImprovedDashboardProps {
 currentRole: UserRole;
 onNavigate?: (view: string) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const isManagerRole = (role: UserRole): boolean => {
 return (
  role === 'SUPER_ADMIN' ||
  role === 'ADMIN' ||
  role === 'BD_MANAGER' ||
  role === 'RND_LEAD' ||
  role === 'QA_MANAGER'
 );
};

export function ImprovedDashboard({ currentRole, onNavigate }: ImprovedDashboardProps) {
 const { pisRecords, currentUser, dashboardStats, refreshDashboardStats } = usePIS();
 const serverBaseUrl = getServerBaseUrl();
 const [selectedPIS, setSelectedPIS] = useState<PISRecord | null>(null);
 const [isDetailsOpen, setIsDetailsOpen] = useState(false);
 const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
 const [isPendingUploadsLoading, setIsPendingUploadsLoading] = useState(false);

 useEffect(() => {
  void refreshDashboardStats();
 }, [refreshDashboardStats]);

 const shouldShowModeration =
  currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'BD_MANAGER';

 const fetchPendingUploads = useCallback(async () => {
  if (!shouldShowModeration) {
   setPendingUploads([]);
   return;
  }

  // Don't fetch if user isn't loaded yet
  if (!currentUser) {
   return;
  }

  try {
   setIsPendingUploadsLoading(true);
   const resp = await pisApi.listPendingClientAttachments();
   if (resp.success && resp.data) {
    setPendingUploads(resp.data);
   } else {
    setPendingUploads([]);
   }
  } catch (e: unknown) {
   const error = e as Error;
   setPendingUploads([]);
   // Only show toast for non-permission errors
   const errorMessage = error.message || 'Unknown error';
   if (!errorMessage.includes('Access denied') && !errorMessage.includes('Authentication required')) {
    toast.error(`Failed to load pending client uploads: ${errorMessage}`);
   }
  } finally {
   setIsPendingUploadsLoading(false);
  }
 }, [shouldShowModeration, currentUser]);

 useEffect(() => {
  void fetchPendingUploads();
 }, [fetchPendingUploads]);

 // Scope PIS records to tasks relevant for the current role, similar to TasksView and PIS Management
 const roleScopedPISRecords = useMemo(() => {
  // SUPER_ADMIN and ADMIN see all records
  if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
   return pisRecords;
  }

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
    case 'RND_LEAD': {
     // RND_LEAD sees ONLY PIS assigned to them via rndLeadAssignment
     if (!currentUser) return false;
     const rndLeadIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     const isAssignedToRndLead = !!pis.rndLeadAssignment && rndLeadIdentities.includes(pis.rndLeadAssignment);
     return isAssignedToRndLead;
    }
    case 'RND_STAFF': {
     // RND_STAFF sees ONLY PIS assigned to them via rndStaffAssignment
     if (!currentUser) return false;
     const rndIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     const isAssignedToRndStaff = !!pis.rndStaffAssignment && rndIdentities.includes(pis.rndStaffAssignment);
     return isAssignedToRndStaff;
    }
    case 'QA_MANAGER':
    case 'QA_STAFF': {
     // QA_MANAGER and QA_STAFF see ONLY PIS assigned to them via qaAssignment
     if (!currentUser) return false;
     const qaIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     const isAssignedToQA = !!pis.qaAssignment && qaIdentities.includes(pis.qaAssignment);
     return isAssignedToQA;
    }
    case 'PKG_STAFF': {
     // PKG_STAFF sees ONLY PIS assigned to them via packaging assignment fields
     if (!currentUser) return false;
     const pkgIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     const isAssignedToPKG =
      (pis.pkgDesignAssignment && pkgIdentities.includes(pis.pkgDesignAssignment)) ||
      (pis.pkgProductSubmission && pkgIdentities.includes(pis.pkgProductSubmission)) ||
      (pis.pkgLabelSubmission && pkgIdentities.includes(pis.pkgLabelSubmission)) ||
      (pis.sampleDispatchPreparation && pkgIdentities.includes(pis.sampleDispatchPreparation));
     return isAssignedToPKG;
    }
    case 'CLIENT':
     // CLIENT filtering is now handled by backend via ClientPIS table
     // Frontend receives only PIS records the client has access to
     // No additional filtering needed here - backend handles it
     return true;
    default:
     return false;
   }
  });
 }, [pisRecords, currentRole, currentUser]);

 // Prepare data for charts
 const stageData = useMemo(() => {
  const fromApi = dashboardStats?.stageCounts;
  if (Array.isArray(fromApi) && fromApi.length) {
   return fromApi
    .map((s: StageCount) => ({ stage: getStageLabel(String(s.stage) as PISStage), count: Number(s.count || 0) }))
    .sort((a: StageCount, b: StageCount) => b.count - a.count);
  }

  return roleScopedPISRecords
   .reduce((acc, pis) => {
    const stage = getStageLabel(pis.stage);
    const existing = acc.find((item) => item.stage === stage);
    if (existing) {
     existing.count++;
    } else {
     acc.push({ stage, count: 1 });
    }
    return acc;
   }, [] as Array<{ stage: string; count: number }>)
   .sort((a, b) => b.count - a.count);
 }, [roleScopedPISRecords, dashboardStats]);

 const statusData = useMemo(() => {
  // Normalize status by replacing underscores with spaces
  const normalizeStatus = (status: string) => status.replace(/_/g, ' ');

  const fromApi = dashboardStats?.statusCounts;
  if (Array.isArray(fromApi) && fromApi.length) {
   return fromApi.map((s: StatusCount) => ({
    status: normalizeStatus(String(s.status)),
    count: Number(s.count || 0),
   }));
  }

  return roleScopedPISRecords.reduce((acc, pis) => {
   const normalizedStatus = normalizeStatus(pis.status);
   const existing = acc.find((item) => item.status === normalizedStatus);
   if (existing) {
    existing.count++;
   } else {
    acc.push({ status: normalizedStatus, count: 1 });
   }
   return acc;
  }, [] as Array<{ status: string; count: number }>);
 }, [roleScopedPISRecords, dashboardStats]);

 const workflow = dashboardStats?.workflow;
 const deadlines: Deadline[] = Array.isArray(workflow?.deadlines) ? workflow.deadlines : [];

 // Timeline data - PIS created over time
 const timelineData = useMemo(() => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
   const date = new Date();
   date.setDate(date.getDate() - (6 - i));
   return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    created: 0,
    completed: 0,
   };
  });

  roleScopedPISRecords.forEach(pis => {
   const daysDiff = Math.floor((new Date().getTime() - pis.createdAt.getTime()) / (1000 * 60 * 60 * 24));
   if (daysDiff < 7) {
    const index = 6 - daysDiff;
    if (index >= 0 && index < 7) {
     last7Days[index].created++;
     if (pis.status === 'COMPLETED') {
      last7Days[index].completed++;
     }
    }
   }
  });

  return last7Days;
 }, [roleScopedPISRecords]);

 // Recent activity
 const recentActivity = useMemo(() => {
  return [...roleScopedPISRecords]
   .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
   .slice(0, 8);
 }, [roleScopedPISRecords]);

 // Pending actions by role
 const pendingActions = useMemo(() => {
  return roleScopedPISRecords.filter(pis => {
   // SUPER_ADMIN and ADMIN see all pending PIS
   if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
    return pis.status !== 'COMPLETED' && pis.status !== 'TERMINATED';
   }

   switch (currentRole) {
    case 'BD_MANAGER':
    case 'BD_STAFF':
     return pis.stage === 'BD_INTAKE' || pis.stage === 'ALIGNMENT' || pis.stage === 'AGREEMENT' || pis.stage === 'WAY_FORWARD';
    case 'RND_LEAD':
     return pis.stage === 'ALIGNMENT' || pis.stage === 'AGREEMENT' || pis.stage === 'RND_LEAD_REVIEW' || pis.stage === 'RND_DEVELOPMENT' || pis.stage === 'QUALITY_REVIEW';
    case 'RND_STAFF':
     return pis.stage === 'RND_DEVELOPMENT' || pis.stage === 'QUALITY_REVIEW';
    case 'QA_MANAGER':
    case 'QA_STAFF': {
     // QA_MANAGER and QA_STAFF see ONLY PIS assigned to them via qaAssignment
     if (!currentUser) return false;
     const qaIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
     const isAssignedToQA = !!pis.qaAssignment && qaIdentities.includes(pis.qaAssignment);
     return isAssignedToQA;
    }
    case 'PKG_STAFF':
     return pis.stage === 'PACKAGING' || pis.stage === 'QUALITY_REVIEW';
    case 'CLIENT':
     // Clients see PIS that need their action (WAY_FORWARD, ON_HOLD)
     return pis.stage === 'WAY_FORWARD' || pis.stage === 'ON_HOLD';
    default:
     return false;
   }
  }).filter(pis => pis.status !== 'COMPLETED' && pis.status !== 'TERMINATED');
 }, [roleScopedPISRecords, currentRole, currentUser]);

 // Overdue items (idle thresholds from the workflow)
 const overdueItems = useMemo(() => {
  const getIdleThresholdDays = (stage: string) => {
   switch (stage) {
    case 'BD_INTAKE':
     return 30;
    case 'RND_LEAD_REVIEW':
     return 15;
    case 'ALIGNMENT':
     return 7;
    case 'RND_DEVELOPMENT':
     return 30;
    default:
     return 30;
   }
  };

  return roleScopedPISRecords.filter(pis => {
   if (pis.status === 'COMPLETED' || pis.status === 'TERMINATED') return false;
   const thresholdDays = getIdleThresholdDays(pis.stage);
   const thresholdDate = new Date();
   thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
   return pis.updatedAt < thresholdDate;
  });
 }, [roleScopedPISRecords]);

 const handleOpenDetails = (pis: PISRecord) => {
  setSelectedPIS(pis);
  setIsDetailsOpen(true);
 };

 const handleCloseDetails = () => {
  setIsDetailsOpen(false);
  setSelectedPIS(null);
 };

 const handlePendingClick = () => {
  if (!onNavigate) return;

  switch (currentRole) {
   case 'BD_MANAGER':
   case 'BD_STAFF':
    onNavigate('bd-tasks');
    break;
   case 'RND_LEAD':
   case 'RND_STAFF':
    onNavigate('rnd-tasks');
    break;
   case 'QA_MANAGER':
   case 'QA_STAFF':
    onNavigate('qa-tasks');
    break;
   case 'PKG_STAFF':
    onNavigate('packaging-tasks');
    break;
   default:
    break;
  }
 };

 return (
  <div className="space-y-4 sm:space-y-6">
   <div>
    <h2 className="text-2xl sm:text-3xl mb-1 sm:mb-2">Dashboard</h2>
    <p className="text-sm sm:text-base text-ink-2">Overview of PIS workflow status and key metrics</p>
   </div>

   {/* Stats Cards */}
   <DashboardStats
    data={roleScopedPISRecords}
    currentRole={currentRole}
    onPendingClick={handlePendingClick}
    onNavigate={onNavigate}
   />

   {/* Alerts */}
   {(pendingActions.length > 0 || overdueItems.length > 0) && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
     {pendingActions.length > 0 && (
      <Card className="p-3 sm:p-4 border-l-4 border-brand bg-brand-soft/50">
       <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
        <div className="flex-1">
         <h3 className="font-medium text-brand text-sm sm:text-base">Pending Your Action</h3>
         <p className="text-xs sm:text-sm text-brand">
          You have {pendingActions.length} PIS waiting for your review
         </p>
        </div>
        <Button
         size="sm"
         variant="outline"
         className="border-brand text-brand hover:bg-brand hover:text-white w-full sm:w-auto text-xs sm:text-sm"
         onClick={handlePendingClick}
        >
         View All
        </Button>
       </div>
      </Card>
     )}

     {overdueItems.length > 0 && (
      <Card className="p-3 sm:p-4 border-l-4 border-err bg-err-soft/50">
       <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-err" />
        <div className="flex-1">
         <h3 className="font-medium text-err text-sm sm:text-base">Overdue Items</h3>
         <p className="text-xs sm:text-sm text-err">
          {overdueItems.length} PIS have been idle for over 30 days
         </p>
        </div>
        <Button
         size="sm"
         variant="outline"
         className="border-err text-err hover:bg-err hover:text-white w-full sm:w-auto text-xs sm:text-sm"
         onClick={() => onNavigate?.('pis')}
        >
         Review
        </Button>
       </div>
      </Card>
     )}
    </div>
   )}

   {/* SLA / Workflow summary from backend */}
   {workflow && (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
     <Card className="p-4 sm:p-6 shadow-md lg:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
       <h3 className="text-base sm:text-lg font-medium">Upcoming Deadlines</h3>
       <Button variant="outline" size="sm" onClick={() => refreshDashboardStats()} className="w-full sm:w-auto">
        Refresh
       </Button>
      </div>

      {deadlines.length === 0 ? (
       <div className="text-sm text-ink-3">No upcoming deadlines.</div>
      ) : (
       <div className="space-y-2">
        {deadlines.map((d: Deadline) => {
         const dueAt = d?.dueAt ? new Date(String(d.dueAt)) : null;
         const isOverdue = Boolean(d?.isOverdue);
         return (
          <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 border rounded-lg bg-surface">
           <div className="min-w-0">
            <p className="font-medium truncate text-sm sm:text-base">{d.pisCode || d.id}</p>
            <p className="text-xs text-ink-3 truncate">
             {d.customer || '—'} • {getStageLabel(String(d.stage || '') as PISStage)}
            </p>
           </div>
           <div className="flex items-center gap-2">
            {isOverdue ? (
             <Badge className="bg-err-soft text-err border-0 text-xs">Overdue</Badge>
            ) : (
             <Badge className="bg-surface-3 text-ink border-0 text-xs">Due</Badge>
            )}
            <span className="text-xs text-ink-3 whitespace-nowrap">
             {dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt.toLocaleDateString() : '—'}
            </span>
           </div>
          </div>
         );
        })}
       </div>
      )}
     </Card>

     <Card className="p-4 sm:p-6 shadow-md">
      <h3 className="text-base sm:text-lg font-medium mb-4">Workflow Funnel</h3>
      <div className="space-y-3 text-sm">
       <div className="flex items-center justify-between">
        <span className="text-ink-2">New / Pending</span>
        <span className="font-medium">{workflow?.funnel?.NEW ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">In Progress</span>
        <span className="font-medium">{workflow?.funnel?.IN_PROGRESS ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">On Hold</span>
        <span className="font-medium">{workflow?.funnel?.ON_HOLD ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Dropped</span>
        <span className="font-medium">{workflow?.funnel?.DROPPED ?? 0}</span>
       </div>
       <div className="pt-3 border-t flex items-center justify-between">
        <span className="text-ink-2">Avg cycle time</span>
        <span className="font-medium">{Number(workflow?.avgCycleTimeDays ?? 0).toFixed(1)}d</span>
       </div>
      </div>
     </Card>
    </div>
   )}

   {/* Client upload moderation */}
   {shouldShowModeration && (
    <Card className="p-6 shadow-md">
     <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-medium">Pending Client Uploads</h3>
      <Button variant="outline" size="sm" onClick={fetchPendingUploads}>
       Refresh
      </Button>
     </div>

     {isPendingUploadsLoading ? (
      <SkeletonText lines={3} />
     ) : pendingUploads.length === 0 ? (
      <EmptyState compact title="No pending uploads." />
     ) : (
      <div className="space-y-2">
       {pendingUploads.map((a: PendingUpload) => (
        <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg bg-surface">
         <div className="min-w-0">
          <p className="font-medium truncate">{a.fileName || 'Attachment'}</p>
          <p className="text-xs text-ink-3 truncate">
           {a.pis?.pisCode || '—'} • {a.pis?.stage ? getStageLabel(String(a.pis.stage) as PISStage) : '—'}
          </p>
          {a.fileUrl && (
           <a
            href={String(a.fileUrl).startsWith('http') ? a.fileUrl : `${serverBaseUrl}${a.fileUrl}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline"
           >
            Open file
           </a>
          )}
         </div>
         <div className="flex gap-2 justify-end">
          <Button
           size="sm"
           variant="outline"
           onClick={async () => {
            try {
             await pisApi.moderateClientAttachment(a.id, 'APPROVE');
             toast.success('Approved');
             await fetchPendingUploads();
            } catch (e: unknown) {
             const error = e as Error;
             toast.error(error?.message || 'Approve failed');
            }
           }}
          >
           Approve
          </Button>
          <Button
           size="sm"
           variant="outline"
           onClick={async () => {
            try {
             await pisApi.moderateClientAttachment(a.id, 'REJECT');
             toast.success('Rejected');
             await fetchPendingUploads();
            } catch (e: unknown) {
             const error = e as Error;
             toast.error(error?.message || 'Reject failed');
            }
           }}
           className="border-err text-err hover:bg-err-soft"
          >
           Reject
          </Button>
         </div>
        </div>
       ))}
      </div>
     )}
    </Card>
   )}

   {/* Role dashboards from workflow metrics */}
   {workflow && (currentRole === 'BD_MANAGER' || currentRole === 'BD_STAFF') && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Top Clients (Active)</h3>
      {Array.isArray(workflow?.topClients) && workflow.topClients.length ? (
       <div className="space-y-2">
        {workflow.topClients.map((c: TopClient) => (
         <div key={c.name} className="flex items-center justify-between text-sm">
          <span className="text-ink-2 truncate">{c.name}</span>
          <span className="font-medium">{c.count}</span>
         </div>
        ))}
       </div>
      ) : (
       <div className="text-sm text-ink-3">No data.</div>
      )}
     </Card>

     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Way Forward Snapshot</h3>
      <div className="space-y-3 text-sm">
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Proceed</span>
        <span className="font-medium">{workflow?.management?.wayForward?.wayForwardProceed ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Hold</span>
        <span className="font-medium">{workflow?.management?.wayForward?.wayForwardHold ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Drop</span>
        <span className="font-medium">{workflow?.management?.wayForward?.wayForwardDrop ?? 0}</span>
       </div>
      </div>
     </Card>
    </div>
   )}

   {workflow && (currentRole === 'RND_LEAD' || currentRole === 'RND_STAFF') && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Workload by Scientist</h3>
      <ResponsiveContainer width="100%" height={260}>
       <BarChart data={workflow?.rnd?.workloadByScientist || []}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="assignee" tick={{ fill: '#6b7280' }} hide />
        <YAxis tick={{ fill: '#6b7280' }} />
        <Tooltip />
        <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
       </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1">
       {(workflow?.rnd?.workloadByScientist || []).slice(0, 4).map((w: WorkloadItem) => (
        <div key={w.assignee} className="flex items-center justify-between text-xs text-ink-2">
         <span className="truncate">{w.assignee}</span>
         <span className="font-medium">{w.count}</span>
        </div>
       ))}
      </div>
     </Card>

     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Complexity Buckets</h3>
      <ResponsiveContainer width="100%" height={260}>
       <PieChart>
        <Pie
         dataKey="value"
         nameKey="name"
         data={Object.entries(workflow?.rnd?.complexityBuckets || {}).map(([name, value]) => ({
          name,
          value: Number(value || 0),
         }))}
         cx="50%"
         cy="50%"
         outerRadius={90}
         label
        >
         {Object.keys(workflow?.rnd?.complexityBuckets || {}).map((_, idx) => (
          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
         ))}
        </Pie>
        <Tooltip />
       </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
       <div className="p-2 rounded bg-surface-2">
        <div className="text-xs text-ink-3">Rejections</div>
        <div className="font-medium">{workflow?.rnd?.rework?.totalRejections ?? 0}</div>
       </div>
       <div className="p-2 rounded bg-surface-2">
        <div className="text-xs text-ink-3">Loops</div>
        <div className="font-medium">{workflow?.rnd?.rework?.totalLoops ?? 0}</div>
       </div>
       <div className="p-2 rounded bg-surface-2">
        <div className="text-xs text-ink-3">Lab util</div>
        <div className="font-medium">{workflow?.rnd?.labUtilizationProxy?.percent ?? 0}%</div>
       </div>
      </div>
     </Card>
    </div>
   )}

   {workflow && (currentRole === 'QA_MANAGER' || currentRole === 'QA_STAFF') && (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
     <Card className="p-6 shadow-md">
      <div className="text-sm text-ink-2">Open approvals</div>
      <div className="text-3xl font-semibold mt-2">{workflow?.qa?.openApprovals ?? 0}</div>
     </Card>
     <Card className="p-6 shadow-md">
      <div className="text-sm text-ink-2">Pending checks</div>
      <div className="text-3xl font-semibold mt-2">{workflow?.qa?.pendingChecks ?? 0}</div>
     </Card>
     <Card className="p-6 shadow-md">
      <div className="text-sm text-ink-2">Defect rate (proxy)</div>
      <div className="text-3xl font-semibold mt-2">{workflow?.qa?.defectFailureRateProxy ?? 0}%</div>
     </Card>
    </div>
   )}

   {workflow && currentRole === 'PKG_STAFF' && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
     <Card className="p-6 shadow-md">
      <div className="text-sm text-ink-2">Pending packaging alignment</div>
      <div className="text-3xl font-semibold mt-2">{workflow?.packaging?.pendingPackagingAlignment ?? 0}</div>
     </Card>
     <Card className="p-6 shadow-md">
      <div className="text-sm text-ink-2">Artwork cycles (proxy)</div>
      <div className="text-3xl font-semibold mt-2">{workflow?.packaging?.artworkCyclesProxy ?? 0}</div>
     </Card>
    </div>
   )}

   {workflow && isManagerRole(currentRole) && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Bottleneck Stages</h3>
      <ResponsiveContainer width="100%" height={260}>
       <BarChart data={workflow?.management?.bottleneckStages || []}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="stage" tick={{ fill: '#6b7280' }} hide />
        <YAxis tick={{ fill: '#6b7280' }} />
        <Tooltip />
        <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} />
       </BarChart>
      </ResponsiveContainer>
     </Card>

     <Card className="p-6 shadow-md">
      <h3 className="text-lg font-medium mb-4">Client Satisfaction (Proxy)</h3>
      <div className="space-y-3 text-sm">
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Drops</span>
        <span className="font-medium">{workflow?.management?.clientSatisfactionProxy?.drops ?? 0}</span>
       </div>
       <div className="flex items-center justify-between">
        <span className="text-ink-2">Holds</span>
        <span className="font-medium">{workflow?.management?.clientSatisfactionProxy?.holds ?? 0}</span>
       </div>
      </div>
     </Card>
    </div>
   )}

   {/* Charts */}
   {isManagerRole(currentRole) && (
    <>
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <Card className="p-4 sm:p-6 shadow-md">
       <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-brand" />
        PIS by Stage
       </h3>
       <ResponsiveContainer width="100%" height={250} className="sm:h-75">
        <BarChart data={stageData}>
         <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
         <XAxis
          dataKey="stage"
          angle={-45}
          textAnchor="end"
          height={100}
          fontSize={10}
          tick={{ fill: '#6b7280' }}
          interval={0}
         />
         <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
         <Tooltip
          contentStyle={{
           backgroundColor: '#fff',
           border: '1px solid #e5e7eb',
           borderRadius: '8px',
           boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
           fontSize: '12px'
          }}
         />
         <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
        </BarChart>
       </ResponsiveContainer>
      </Card>

      <Card className="p-4 sm:p-6 shadow-md">
       <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Status Distribution</h3>
       <ResponsiveContainer width="100%" height={250} className="sm:h-75">
        <PieChart>
         <Pie
          data={statusData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ payload, percent }: any) => `${payload.status}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
         >
          {statusData.map((entry, index) => (
           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
         </Pie>
         <Tooltip />
        </PieChart>
       </ResponsiveContainer>
      </Card>

      <Card className="p-4 sm:p-6 shadow-md lg:col-span-2">
       <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">7-Day Activity Trend</h3>
       <ResponsiveContainer width="100%" height={220} className="sm:h-75">
        <LineChart data={timelineData}>vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
         <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
         <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
         <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
         <Tooltip
          contentStyle={{
           backgroundColor: '#fff',
           border: '1px solid #e5e7eb',
           borderRadius: '8px',
           boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
           fontSize: '12px'
          }}
         />
         <Legend wrapperStyle={{ fontSize: '12px' }} />
         <Line
          type="monotone"
          dataKey="created"
          stroke="#3B82F6"
          strokeWidth={2}
          name="Created"
          dot={{ r: 3 }}
         />
         <Line
          type="monotone"
          dataKey="completed"
          stroke="#10B981"
          strokeWidth={2}
          name="Completed"
          dot={{ r: 3 }}
         />
        </LineChart>
       </ResponsiveContainer>
      </Card>
     </div>

     {/* Recent Activity */}
     <Card className="p-4 sm:p-6 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
       <h3 className="text-base sm:text-lg font-medium">Recent Activity</h3>
       <Button variant="ghost" size="sm" className="gap-1 w-full sm:w-auto">
        View All <ArrowRight className="h-4 w-4" />
       </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
       {recentActivity.map((pis) => (
        <div
         key={pis.id}
         className="flex items-center justify-between p-3 sm:p-4 bg-surface-2 rounded-lg border hover:shadow-md transition-all cursor-pointer group"
         onClick={() => handleOpenDetails(pis)}
        >
         <div className="flex-1 min-w-0">
          <p className="font-medium text-brand group-hover:text-brand transition-colors text-sm sm:text-base truncate">
           {pis.pisCode}
          </p>
          <p className="text-xs sm:text-sm text-ink-2 truncate">{pis.customer}</p>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
           <Badge variant="outline" className="text-[10px] sm:text-xs">
            {getStageLabel(pis.stage)}
           </Badge>
           <span className="text-[10px] sm:text-xs text-ink-4">
            {pis.updatedAt.toLocaleDateString()}
           </span>
          </div>
         </div>
         <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-ink-4 group-hover:text-brand group-hover:translate-x-1 transition-all shrink-0 ml-2" />
        </div>
       ))}
      </div>
     </Card>
    </>
   )}

   <QuotationsDashboardWidget />

   <PISDetailsDialog
    pis={selectedPIS}
    currentRole={currentRole}
    isOpen={isDetailsOpen}
    onClose={handleCloseDetails}
   />
  </div>
 );
}
