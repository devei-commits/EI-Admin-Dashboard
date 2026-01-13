import { useEffect, useMemo, useState, useCallback } from 'react';
import { UserRole, PISRecord } from '../types/pis';
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
import { toast } from 'sonner';

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
  const [pendingUploads, setPendingUploads] = useState<any[]>([]);
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
    } catch (e: any) {
      console.error('Failed to load pending uploads:', e);
      setPendingUploads([]);
      // Only show toast for non-permission errors
      const errorMessage = e.message || 'Unknown error';
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
        case 'RND_LEAD':
          // RND_LEAD sees ONLY PIS assigned to them via rndLeadAssignment
          if (!currentUser) return false;
          const rndLeadIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
          const isAssignedToRndLead = !!pis.rndLeadAssignment && rndLeadIdentities.includes(pis.rndLeadAssignment);
          return isAssignedToRndLead;
        case 'RND_STAFF':
          // RND_STAFF sees ONLY PIS assigned to them via rndStaffAssignment
          if (!currentUser) return false;
          const rndIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
          const isAssignedToRndStaff = !!pis.rndStaffAssignment && rndIdentities.includes(pis.rndStaffAssignment);
          return isAssignedToRndStaff;
        case 'QA_MANAGER':
        case 'QA_STAFF':
          // QA_MANAGER and QA_STAFF see ONLY PIS assigned to them via qaAssignment
          if (!currentUser) return false;
          const qaIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
          const isAssignedToQA = !!pis.qaAssignment && qaIdentities.includes(pis.qaAssignment);
          return isAssignedToQA;
        case 'PKG_STAFF':
          // PKG_STAFF sees ONLY PIS assigned to them via packaging assignment fields
          if (!currentUser) return false;
          const pkgIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
          const isAssignedToPKG = 
            (pis.pkgDesignAssignment && pkgIdentities.includes(pis.pkgDesignAssignment)) ||
            (pis.pkgProductSubmission && pkgIdentities.includes(pis.pkgProductSubmission)) ||
            (pis.pkgLabelSubmission && pkgIdentities.includes(pis.pkgLabelSubmission)) ||
            (pis.sampleDispatchPreparation && pkgIdentities.includes(pis.sampleDispatchPreparation));
          return isAssignedToPKG;
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
        .map((s: any) => ({ stage: getStageLabel(String(s.stage)), count: Number(s.count || 0) }))
        .sort((a: any, b: any) => b.count - a.count);
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
      return fromApi.map((s: any) => ({
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
  const deadlines: any[] = Array.isArray(workflow?.deadlines) ? workflow.deadlines : [];

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
        case 'QA_STAFF':
          // QA_MANAGER and QA_STAFF see ONLY PIS assigned to them via qaAssignment
          if (!currentUser) return false;
          const qaIdentities = [currentUser.id, currentUser.email, currentUser.name].filter(Boolean);
          const isAssignedToQA = !!pis.qaAssignment && qaIdentities.includes(pis.qaAssignment);
          return isAssignedToQA;
        case 'PKG_STAFF':
          return pis.stage === 'PACKAGING' || pis.stage === 'QUALITY_REVIEW';
        case 'CLIENT':
          // Clients see PIS that need their action (WAY_FORWARD, ON_HOLD)
          return pis.stage === 'WAY_FORWARD' || pis.stage === 'ON_HOLD';
        default:
          return false;
      }
    }).filter(pis => pis.status !== 'COMPLETED' && pis.status !== 'TERMINATED');
  }, [roleScopedPISRecords, currentRole]);

  // Overdue items (idle thresholds from the workflow)
  const overdueItems = useMemo(() => {
    const getIdleThresholdDays = (stage: string) => {
      switch (stage) {
        case 'BD_INTAKE':
          return 30;
        case 'RND_LEAD_REVIEW':
          return 15;
        case 'BD_WFP_REVIEW':
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl mb-2">Dashboard</h2>
        <p className="text-gray-600">Overview of PIS workflow status and key metrics</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingActions.length > 0 && (
            <Card className="p-4 border-l-4 border-blue-500 bg-blue-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900">Pending Your Action</h3>
                  <p className="text-sm text-blue-700">
                    You have {pendingActions.length} PIS waiting for your review
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white w-full sm:w-auto"
                  onClick={handlePendingClick}
                >
                  View All
                </Button>
              </div>
            </Card>
          )}

          {overdueItems.length > 0 && (
            <Card className="p-4 border-l-4 border-red-500 bg-red-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="flex-1">
                  <h3 className="font-medium text-red-900">Overdue Items</h3>
                  <p className="text-sm text-red-700">
                    {overdueItems.length} PIS have been idle for over 30 days
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white w-full sm:w-auto"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 shadow-md lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Upcoming Deadlines</h3>
              <Button variant="outline" size="sm" onClick={() => refreshDashboardStats()}>
                Refresh
              </Button>
            </div>

            {deadlines.length === 0 ? (
              <div className="text-sm text-gray-500">No upcoming deadlines.</div>
            ) : (
              <div className="space-y-2">
                {deadlines.map((d: any) => {
                  const dueAt = d?.dueAt ? new Date(String(d.dueAt)) : null;
                  const isOverdue = Boolean(d?.isOverdue);
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-white">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.pisCode || d.id}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {d.customer || '—'} • {getStageLabel(String(d.stage || ''))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue ? (
                          <Badge className="bg-red-100 text-red-700 border-0">Overdue</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-0">Due</Badge>
                        )}
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt.toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6 shadow-md">
            <h3 className="text-lg font-medium mb-4">Workflow Funnel</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">New / Pending</span>
                <span className="font-medium">{workflow?.funnel?.NEW ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="font-medium">{workflow?.funnel?.IN_PROGRESS ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">On Hold</span>
                <span className="font-medium">{workflow?.funnel?.ON_HOLD ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Dropped</span>
                <span className="font-medium">{workflow?.funnel?.DROPPED ?? 0}</span>
              </div>
              <div className="pt-3 border-t flex items-center justify-between">
                <span className="text-gray-600">Avg cycle time</span>
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
            <div className="text-sm text-gray-500">Loading…</div>
          ) : pendingUploads.length === 0 ? (
            <div className="text-sm text-gray-500">No pending uploads.</div>
          ) : (
            <div className="space-y-2">
              {pendingUploads.map((a: any) => (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg bg-white">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.fileName || 'Attachment'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.pis?.pisCode || '—'} • {a.pis?.stage ? getStageLabel(String(a.pis.stage)) : '—'}
                    </p>
                    {a.fileUrl && (
                      <a
                        href={String(a.fileUrl).startsWith('http') ? a.fileUrl : `${serverBaseUrl}${a.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
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
                        } catch (e: any) {
                          toast.error(e?.message || 'Approve failed');
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
                        } catch (e: any) {
                          toast.error(e?.message || 'Reject failed');
                        }
                      }}
                      className="border-red-300 text-red-700 hover:bg-red-50"
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
                {workflow.topClients.map((c: any) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{c.name}</span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data.</div>
            )}
          </Card>

          <Card className="p-6 shadow-md">
            <h3 className="text-lg font-medium mb-4">Way Forward Snapshot</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Proceed</span>
                <span className="font-medium">{workflow?.management?.wayForward?.wayForwardProceed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Hold</span>
                <span className="font-medium">{workflow?.management?.wayForward?.wayForwardHold ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Drop</span>
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
              {(workflow?.rnd?.workloadByScientist || []).slice(0, 4).map((w: any) => (
                <div key={w.assignee} className="flex items-center justify-between text-xs text-gray-600">
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
              <div className="p-2 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Rejections</div>
                <div className="font-medium">{workflow?.rnd?.rework?.totalRejections ?? 0}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Loops</div>
                <div className="font-medium">{workflow?.rnd?.rework?.totalLoops ?? 0}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Lab util</div>
                <div className="font-medium">{workflow?.rnd?.labUtilizationProxy?.percent ?? 0}%</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {workflow && (currentRole === 'QA_MANAGER' || currentRole === 'QA_STAFF') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 shadow-md">
            <div className="text-sm text-gray-600">Open approvals</div>
            <div className="text-3xl font-semibold mt-2">{workflow?.qa?.openApprovals ?? 0}</div>
          </Card>
          <Card className="p-6 shadow-md">
            <div className="text-sm text-gray-600">Pending checks</div>
            <div className="text-3xl font-semibold mt-2">{workflow?.qa?.pendingChecks ?? 0}</div>
          </Card>
          <Card className="p-6 shadow-md">
            <div className="text-sm text-gray-600">Defect rate (proxy)</div>
            <div className="text-3xl font-semibold mt-2">{workflow?.qa?.defectFailureRateProxy ?? 0}%</div>
          </Card>
        </div>
      )}

      {workflow && currentRole === 'PKG_STAFF' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 shadow-md">
            <div className="text-sm text-gray-600">Pending packaging alignment</div>
            <div className="text-3xl font-semibold mt-2">{workflow?.packaging?.pendingPackagingAlignment ?? 0}</div>
          </Card>
          <Card className="p-6 shadow-md">
            <div className="text-sm text-gray-600">Artwork cycles (proxy)</div>
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
                <span className="text-gray-600">Drops</span>
                <span className="font-medium">{workflow?.management?.clientSatisfactionProxy?.drops ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Holds</span>
                <span className="font-medium">{workflow?.management?.clientSatisfactionProxy?.holds ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Charts */}
      {isManagerRole(currentRole) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 shadow-md">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                PIS by Stage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="stage" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120} 
                    fontSize={11}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6 shadow-md">
              <h3 className="text-lg font-medium mb-4">Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
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

            <Card className="p-6 shadow-md lg:col-span-2">
              <h3 className="text-lg font-medium mb-4">7-Day Activity Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="created" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    name="Created"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    name="Completed"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Activity</h3>
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentActivity.map((pis) => (
                <div 
                  key={pis.id} 
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => handleOpenDetails(pis)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                      {pis.pisCode}
                    </p>
                    <p className="text-sm text-gray-600">{pis.customer}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getStageLabel(pis.stage)}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {pis.updatedAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <PISDetailsDialog
        pis={selectedPIS}
        currentRole={currentRole}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
      />
    </div>
  );
}
