import { useEffect, useMemo, useRef, useState } from 'react';
import { PISRecord, UserRole } from './types/pis';
import { EnhancedPISTable } from './EnhancedPISTable';
import { PISDetailsDialog } from './PISDetailsDialog';
import { CreatePISDialog } from './CreatePISDialog';
import { AdvancedFilters, FilterState } from './AdvancedFilters';
import { PISCodeSidebar } from './PISCodeSidebar';
import { Button } from './ui/button';
import { Plus, FileText, CheckCircle, XCircle, ChevronLeft, X } from 'lucide-react';
import { usePIS } from './context/PISContext';
import { getRolePermissions } from './utils/permissions';
import { useScrollToTop } from './hooks/useScrollToTop';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

interface ImprovedPISManagementProps {
  currentRole: UserRole;
  preset?: PISManagementPreset;
}

export type PISManagementPreset = {
  key: number;
  tab?: 'all' | 'active' | 'completed';
  filters?: Partial<FilterState>;
  mode?: 'rejected';
  initialPISId?: string;
};

export function ImprovedPISManagement({ currentRole, preset }: ImprovedPISManagementProps) {
  const { pisRecords, addPIS, getPISById, currentUser } = usePIS();
  const [selectedPISId, setSelectedPISId] = useState<string | null>(null);
  const [selectedPIS, setSelectedPIS] = useState<PISRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const permissions = getRolePermissions(currentRole);
  
  useScrollToTop(activeTab);

  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    stage: 'all',
    status: 'all',
    customer: 'all',
    dateFrom: '',
    dateTo: '',
    bdTeam: 'all',
    rndTeam: 'all',
    showCompleted: true,
  });

  const [presetMode, setPresetMode] = useState<PISManagementPreset['mode']>(undefined);

  const lastAppliedPresetKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (!preset) return;
    if (lastAppliedPresetKeyRef.current === preset.key) return;

    if (preset.tab) setActiveTab(preset.tab);
    if (preset.filters) {
      setFilters((prev) => ({
        ...prev,
        ...preset.filters,
      }));
    }

    setPresetMode(preset.mode);

    if (preset.initialPISId) {
      setSelectedPISId(preset.initialPISId);
      setIsDetailsOpen(true);
      setIsSidebarCollapsed(false);
    }

    lastAppliedPresetKeyRef.current = preset.key;
  }, [preset]);

  // Get unique customers for filter
  const uniqueCustomers = useMemo(() => {
    return Array.from(new Set(pisRecords.map(pis => pis.customer))).sort();
  }, [pisRecords]);

  // Scope PIS records to tasks relevant for the current role
  const roleScopedPISRecords = useMemo(() => {
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
          // BD_STAFF sees ALL PIS assigned to them, regardless of stage
          if (!currentUser || pis.assignedBdRole !== 'BD_STAFF') return false;
          // Handle type mismatch: assignedBdStaffId might be string or number, currentUser.id is string
          const assignedId = pis.assignedBdStaffId?.toString();
          const userId = currentUser.id?.toString();
          return assignedId === userId;
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
          // SUPER_ADMIN, ADMIN see all matching filters
          return true;
      }
    });
  }, [pisRecords, currentRole, currentUser]);

  // Filter PIS records based on all filters
  const filteredPISRecords = useMemo(() => {
    return roleScopedPISRecords.filter(pis => {
      if (presetMode === 'rejected' && filters.status === 'all') {
        if (!(pis.status === 'REJECTED' || pis.status === 'TERMINATED')) return false;
      }

      // Tab filter
      if (activeTab === 'active' && (pis.status === 'COMPLETED' || pis.status === 'TERMINATED')) {
        return false;
      }
      if (activeTab === 'completed' && pis.status !== 'COMPLETED') {
        return false;
      }
      if (activeTab === 'terminated' && pis.status !== 'TERMINATED') {
        return false;
      }

      // Show completed filter
      if (!filters.showCompleted && (pis.status === 'COMPLETED' || pis.status === 'TERMINATED')) {
        return false;
      }

      // Stage filter
      if (filters.stage !== 'all' && pis.stage !== filters.stage) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && pis.status !== filters.status) {
        return false;
      }

      // Customer filter - CLIENT users don't filter by customer (customers belong to admin/super admin)
      if (currentRole !== 'CLIENT' && filters.customer !== 'all' && pis.customer !== filters.customer) {
        return false;
      }

      // BD Team filter
      if (filters.bdTeam !== 'all' && pis.bdTeam !== filters.bdTeam) {
        return false;
      }

      // R&D Team filter
      if (filters.rndTeam !== 'all' && 
          pis.rndLeadAssignment !== filters.rndTeam && 
          pis.rndStaffAssignment !== filters.rndTeam) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (pis.createdAt < fromDate) {
          return false;
        }
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (pis.createdAt > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [roleScopedPISRecords, filters, activeTab, presetMode]);

  const handleViewDetails = (id: string) => {
    setSelectedPISId(id);
    setIsDetailsOpen(true);
    // Don't collapse sidebar immediately, let user toggle manually
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setIsSidebarCollapsed(false);
    setTimeout(() => setSelectedPISId(null), 300);
  };

  const handleSidebarPISSelect = (id: string) => {
    setSelectedPISId(id);
    // Keep details open since we're already in split-view mode
  };

  // Resolve selected PIS (local first, then refresh from server)
  useEffect(() => {
    let cancelled = false;

    if (!selectedPISId) {
      setSelectedPIS(null);
      return () => {
        cancelled = true;
      };
    }

    // Fast path: show from local cache immediately
    const cached = pisRecords.find((p) => p.id === selectedPISId) || null;
    setSelectedPIS(cached);

    // Refresh from API to ensure latest stage/status/details
    void (async () => {
      try {
        const updated = await getPISById(selectedPISId);
        if (!cancelled && updated) {
          setSelectedPIS(updated);
        }
      } catch {
        // Ignore: getPISById already logs and falls back
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPISId, pisRecords, getPISById]);

  const activePISCount = roleScopedPISRecords.filter(
    (p) => p.status !== 'COMPLETED' && p.status !== 'TERMINATED'
  ).length;
  const completedPISCount = roleScopedPISRecords.filter((p) => p.status === 'COMPLETED').length;
  const terminatedPISCount = roleScopedPISRecords.filter((p) => p.status === 'TERMINATED').length;

  return (
    <div className="h-full">
      {/* Split-View Layout when PIS is selected */}
      {isDetailsOpen && selectedPIS ? (
        <div className="flex h-full">
          {/* PIS Code Sidebar */}
          <div
            className={cn(
              'transition-all duration-300 ease-in-out h-full',
              isSidebarCollapsed ? 'w-12' : 'w-72'
            )}
          >
            <PISCodeSidebar
              pisRecords={filteredPISRecords}
              selectedPISId={selectedPISId}
              onSelectPIS={handleSidebarPISSelect}
              onClose={handleCloseDetails}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          </div>

          {/* Full-Screen Details Panel */}
          <div className="flex-1 bg-gray-50 overflow-auto animate-in slide-in-from-right-2 fade-in-0 duration-300">
            <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="h-9 w-9 p-0"
                  >
                    <ChevronLeft className={cn(
                      'h-5 w-5 transition-transform',
                      isSidebarCollapsed && 'rotate-180'
                    )} />
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedPIS.pisCode}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedPIS.customer} • {selectedPIS.formulation}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseDetails}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
            
            {/* Embedded PISDetailsDialog content as full panel */}
            <div className="p-6">
              <PISDetailsDialog
                pis={selectedPIS}
                currentRole={currentRole}
                isOpen={true}
                onClose={handleCloseDetails}
                isEmbedded={true}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Normal Table View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl mb-2">PIS Management</h2>
              <p className="text-gray-600">
                Comprehensive view and management of Product Information Sheets across all workflow stages
              </p>
            </div>
            {permissions.canCreatePIS && (
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-lg w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Create New PIS
              </Button>
            )}
          </div>

          {/* Tabs for quick filtering */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="all" className="gap-2">
                <FileText className="h-4 w-4" />
                All PIS
                <Badge variant="secondary">{roleScopedPISRecords.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <FileText className="h-4 w-4" />
                Active
                <Badge variant="secondary">{activePISCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Completed
                <Badge variant="secondary">{completedPISCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="terminated" className="gap-2">
                <XCircle className="h-4 w-4" />
                Terminated
                <Badge variant="secondary">{terminatedPISCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {/* Advanced Filters */}
              <AdvancedFilters
                filters={filters}
                onFilterChange={setFilters}
                customers={uniqueCustomers}
                currentRole={currentRole}
              />

              {/* Enhanced Table */}
              <EnhancedPISTable
                data={filteredPISRecords}
                currentRole={currentRole}
                onViewDetails={(pis) => handleViewDetails(pis.id)}
                onEditPIS={permissions.canCreatePIS ? (pis) => handleViewDetails(pis.id) : undefined}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <CreatePISDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={addPIS}
      />
    </div>
  );
}
