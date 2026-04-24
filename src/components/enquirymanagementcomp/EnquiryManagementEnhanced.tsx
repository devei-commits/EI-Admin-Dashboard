import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
 Ticket, 
 TicketStatus, 
 TicketPriority, 
 TicketFilters,
 StaffMember,
 TicketDashboardStats,
} from '../../types/ticket.types';
import TicketDashboard from './TicketDashboard';
import TicketDetailPopup from './TicketDetailPopup';
import CrossTeamTicketModal from './CrossTeamTicketModal';
import { 
 FilterPanel, 
 TicketRow, 
 EmptyTicketState,
} from './TicketComponents';
import { fetchAvailableStaff } from '../../services/ticket.service';
import api, { getApiBaseUrl } from '../../lib/apiClient';
import { ApiResponse } from '../../types/api.types';


// ==================== Main Component ====================
type ViewTab = 'dashboard' | 'tickets' | 'cross-team' | 'customizations';

type ProductCustomizationRow = {
 customization_id: number;
 user_id?: number;
 product_id?: number | null;
 formulation?: Record<string, unknown> | null;
 care?: string | null;
 category?: string | null;
 formulationSummary?: string | null;
 packagingType?: string | null;
 packaging_image?: string | null;
 packaging?: string | null;
 userNotes?: string | null;
 internal_notes?: string | null;
 status?: string | null;
 assigned_bd_user_id?: number | null;
 assigned_bd_name?: string | null;
 assigned_bd_email?: string | null;
 assigned_at?: string | null;
 created_at?: string | null;
 updated_at?: string | null;
 product?: {
  product_name?: string | null;
  product_sku?: string | null;
 } | null;
 user?: {
  userid?: number;
  fname?: string | null;
  lname?: string | null;
  email?: string | null;
  mobile?: string | null;
  usertype?: string | null;
 } | null;
};

type BDAssignee = {
 userid: number;
 display_name?: string | null;
 email?: string | null;
 role_name?: string | null;
};

const resolveImageUrl = (value?: string | null): string => {
 if (!value) return '';
 if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
 const base = getApiBaseUrl();
 const normalized = value.startsWith('/') ? value : `/${value}`;
 return base ? `${base}${normalized}` : normalized;
};

const EnquiryManagementEnhanced: React.FC = () => {
 // View state
 const [activeView, setActiveView] = useState<ViewTab>('dashboard');
 
 // Ticket list state — always array so filteredTickets never spreads undefined
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
 const [filters, setFilters] = useState<TicketFilters>({});
 const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
 const [loading, setLoading] = useState(false);
 const [customizationsLoading, setCustomizationsLoading] = useState(false);
 const [customizations, setCustomizations] = useState<ProductCustomizationRow[]>([]);
 const [bdAssignees, setBdAssignees] = useState<BDAssignee[]>([]);
 const [selectedCustomization, setSelectedCustomization] = useState<ProductCustomizationRow | null>(null);
 const [savingCustomization, setSavingCustomization] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const recordsPerPage = 10;
 const [crossTeamModalOpen, setCrossTeamModalOpen] = useState(false);

 useEffect(() => {
  setCurrentPage(1);
 }, [activeView]);

 // Load staff members
 useEffect(() => {
  const loadStaff = async () => {
   const result = await fetchAvailableStaff();
   if (result.success && result.data) {
    setAvailableStaff(result.data);
   }
  };
  loadStaff();
 }, []);

 const loadBDAssignees = useCallback(async () => {
  try {
   const users = await api.get<Array<{ userid: number; display_name?: string; email?: string; role_name?: string }>>('/api/v1/users/search');
   const list = (Array.isArray(users) ? users : []).filter((u) =>
    String(u.role_name || '').toLowerCase().includes('bd')
    || String(u.role_name || '').toLowerCase().includes('business')
    || String(u.role_name || '').toLowerCase().includes('admin'),
   );
   setBdAssignees(list);
  } catch (error) {
   console.error('BD assignees fetch error:', error);
   setBdAssignees([]);
  }
 }, []);

 const loadCustomizations = useCallback(async () => {
  setCustomizationsLoading(true);
  try {
   const res = await api.get<{ success?: boolean; data?: ProductCustomizationRow[] } | ProductCustomizationRow[]>(
    '/api/v1/productCustomizations/admin/all',
   );
   const list = Array.isArray(res)
    ? res
    : (res && typeof res === 'object' && Array.isArray((res as { data?: ProductCustomizationRow[] }).data))
     ? (res as { data: ProductCustomizationRow[] }).data
     : [];
   setCustomizations(list);
  } catch (error) {
   setCustomizations([]);
   console.error('Product customizations fetch error:', error);
  } finally {
   setCustomizationsLoading(false);
  }
 }, []);

 useEffect(() => {
  if (activeView !== 'customizations') return;
  void loadCustomizations();
  void loadBDAssignees();
 }, [activeView, loadCustomizations, loadBDAssignees]);

 const handleCustomizationSave = useCallback(async () => {
  if (!selectedCustomization) return;
  setSavingCustomization(true);
  try {
   await api.put(`/api/v1/productCustomizations/admin/${selectedCustomization.customization_id}`, {
    status: selectedCustomization.status ?? 'Pending',
    internal_notes: selectedCustomization.internal_notes ?? null,
    assigned_bd_user_id: selectedCustomization.assigned_bd_user_id ?? null,
    assigned_bd_name: selectedCustomization.assigned_bd_name ?? null,
    assigned_bd_email: selectedCustomization.assigned_bd_email ?? null,
   });
   await loadCustomizations();
  } catch (error) {
   console.error('Customization save error:', error);
  } finally {
   setSavingCustomization(false);
  }
 }, [selectedCustomization, loadCustomizations]);

 
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  const fetchEnquiries = async () => {
    try {
      const res = await api.get<ApiResponse<Ticket[]> | Ticket[]>('/api/v1/enquiries');
      if (cancelled) return;
      const list = Array.isArray(res) ? res : (res && typeof res === 'object' && 'data' in res && Array.isArray((res as ApiResponse<Ticket[]>).data) ? (res as ApiResponse<Ticket[]>).data : []);
      setTickets(list);
    } catch (error) {
      if (!cancelled) setTickets([]);
      console.error('Enquiries fetch error:', error);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };
  fetchEnquiries();
  return () => {
    cancelled = true;
    setLoading(false);
  };
 }, []);

 // Dashboard stats derived from API tickets (full page dynamic)
 const dashboardStatsFromTickets = useMemo((): TicketDashboardStats => {
  const list = Array.isArray(tickets) ? tickets : [];
  const emptyByStatus: TicketDashboardStats['byStatus'] = {
   new: 0, open: 0, inProgress: 0, pendingCustomer: 0, pendingInternal: 0, resolved: 0, closed: 0,
  };
  const emptyByPriority: TicketDashboardStats['byPriority'] = { low: 0, medium: 0, high: 0, urgent: 0 };
  if (list.length === 0) {
   return {
    totalTickets: 0,
    openTickets: 0,
    closedToday: 0,
    avgResolutionTime: 0,
    byStatus: emptyByStatus,
    byPriority: emptyByPriority,
    byCategory: {} as TicketDashboardStats['byCategory'],
    staffMetrics: [],
    ticketTrend: [],
    slaMetrics: { onTime: 0, breached: 0, atRisk: 0 },
    responseMetrics: { avgFirstResponseTime: 0, avgResponseTime: 0, avgResolutionTime: 0 },
   };
  }
  const statusKey = (s: string) => {
   const k = s === 'in-progress' ? 'inProgress' : s === 'pending-customer' ? 'pendingCustomer' : s === 'pending-internal' ? 'pendingInternal' : s;
   return k as keyof TicketDashboardStats['byStatus'];
  };
  const byStatus: TicketDashboardStats['byStatus'] = {
   new: 0,
   open: 0,
   inProgress: 0,
   pendingCustomer: 0,
   pendingInternal: 0,
   resolved: 0,
   closed: 0,
  };
  const byPriority: TicketDashboardStats['byPriority'] = { low: 0, medium: 0, high: 0, urgent: 0 };
  const today = new Date().toISOString().slice(0, 10);
  let closedToday = 0;

  const ticketTrend = Array.from({ length: 7 }, (_, index) => {
   const date = new Date();
   date.setDate(date.getDate() - (6 - index));
   return {
    date: date.toISOString().slice(0, 10),
    created: 0,
    resolved: 0,
   };
  });
  const trendByDate = new Map(ticketTrend.map((row) => [row.date, row]));

  list.forEach((t) => {
   const sk = statusKey(t.status);
   if (sk in byStatus) (byStatus as Record<string, number>)[sk] = ((byStatus as Record<string, number>)[sk] ?? 0) + 1;
   if (t.priority && t.priority in byPriority) byPriority[t.priority as keyof typeof byPriority]++;
   if ((t as { resolvedAt?: string }).resolvedAt?.slice(0, 10) === today) closedToday++;

   const createdDate = t.createdAt?.slice(0, 10);
   if (createdDate && trendByDate.has(createdDate)) {
    trendByDate.get(createdDate)!.created += 1;
   }

   const resolvedDate = (t as { resolvedAt?: string }).resolvedAt?.slice(0, 10)
    || (['resolved', 'closed'].includes(t.status) ? t.updatedAt?.slice(0, 10) : undefined);
   if (resolvedDate && trendByDate.has(resolvedDate)) {
    trendByDate.get(resolvedDate)!.resolved += 1;
   }
  });

  const openTickets = list.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  return {
   totalTickets: list.length,
   openTickets,
   closedToday,
   avgResolutionTime: 24,
   byStatus,
   byPriority,
   byCategory: {} as TicketDashboardStats['byCategory'],
   staffMetrics: [],
   ticketTrend,
   slaMetrics: { onTime: 0, breached: 0, atRisk: 0 },
   responseMetrics: { avgFirstResponseTime: 0, avgResponseTime: 0, avgResolutionTime: 0 },
  };
 }, [tickets]);

 // Filter tickets locally (for mock data)
 const filteredTickets = useMemo(() => {
  const list = Array.isArray(tickets) ? tickets : [];
  let result = [...list];

  if (activeView === 'tickets') {
   result = result.filter((t) => (t.ticketScope || 'customer') === 'customer');
  } else if (activeView === 'cross-team') {
   result = result.filter((t) => t.ticketScope === 'internal');
  }

  // Search filter
  if (filters.searchTerm) {
   const search = filters.searchTerm.toLowerCase();
   result = result.filter(t => 
    t.ticketNumber.toLowerCase().includes(search) ||
    t.subject.toLowerCase().includes(search) ||
    (t.customer?.name || '').toLowerCase().includes(search) ||
    (t.customer?.email || '').toLowerCase().includes(search)
   );
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
   result = result.filter(t => filters.status!.includes(t.status));
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
   result = result.filter(t => filters.priority!.includes(t.priority));
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
   result = result.filter(t => filters.category!.includes(t.category));
  }

  // Assignee filter
  if (filters.assigneeId) {
   if (filters.assigneeId === 'unassigned') {
    result = result.filter(t => !t.currentAssignee);
   } else {
    result = result.filter(t => t.currentAssignee?.staffId === filters.assigneeId);
   }
  }

  // Date filters
  if (filters.dateFrom) {
   const fromDate = new Date(filters.dateFrom);
   result = result.filter(t => new Date(t.createdAt) >= fromDate);
  }
  if (filters.dateTo) {
   const toDate = new Date(filters.dateTo);
   result = result.filter(t => new Date(t.createdAt) <= toDate);
  }

  // Overdue filter
  if (filters.isOverdue) {
   result = result.filter(t => t.isOverdue);
  }

  // Has linked orders filter
  if (filters.hasLinkedOrders) {
   result = result.filter(t => (t.linkedOrders?.length ?? 0) > 0);
  }

  return result;
 }, [tickets, filters, activeView]);

 // Pagination
 const totalPages = Math.ceil(filteredTickets.length / recordsPerPage);
 const paginatedTickets = filteredTickets.slice(
  (currentPage - 1) * recordsPerPage,
  currentPage * recordsPerPage
 );

 // Handlers
 const handleClearFilters = useCallback(() => {
  setFilters({});
  setCurrentPage(1);
 }, []);

 const handleSelectTicket = useCallback((ticket: Ticket) => {
  setSelectedTicket(ticket);
 }, []);

 const handleTicketUpdate = useCallback((updatedTicket: Ticket) => {
  setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
  setSelectedTicket(updatedTicket);
 }, []);

 const handleStatusChange = useCallback((ticketId: string, status: TicketStatus) => {
  setTickets(prev => prev.map(t => 
   t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t
  ));
 }, []);

 const handleNavigateToTickets = useCallback((filter?: { status?: TicketStatus; priority?: TicketPriority }) => {
  setActiveView('tickets');
  if (filter) {
   setFilters({
    status: filter.status ? [filter.status] : undefined,
    priority: filter.priority ? [filter.priority] : undefined,
   });
  }
 }, []);

 const handleInternalTicketCreated = useCallback((created: Ticket) => {
  setTickets((prev) => [created, ...prev]);
  setActiveView('cross-team');
  setCurrentPage(1);
 }, []);

 return (
  <div className="w-full space-y-6">
   {/* View Toggle */}
   <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl w-full sm:w-fit">
    <button
     onClick={() => setActiveView('dashboard')}
     className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all w-full sm:w-auto ${
      activeView === 'dashboard'
       ? 'bg-white text-gray-900 shadow-sm'
       : 'text-gray-600 hover:text-gray-900'
     }`}
    >
     <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
      Dashboard
     </span>
    </button>
    <button
     onClick={() => setActiveView('tickets')}
     className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all w-full sm:w-auto ${
      activeView === 'tickets'
       ? 'bg-white text-gray-900 shadow-sm'
       : 'text-gray-600 hover:text-gray-900'
     }`}
    >
     <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      Customer tickets
      <span className="px-2 py-0.5 bg-gray-100 text-slate-900 text-xs rounded-full">
       {tickets.filter((t) => (t.ticketScope || 'customer') === 'customer').length}
      </span>
     </span>
    </button>
    <button
     onClick={() => setActiveView('cross-team')}
     className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all w-full sm:w-auto ${
      activeView === 'cross-team'
       ? 'bg-white text-gray-900 shadow-sm'
       : 'text-gray-600 hover:text-gray-900'
     }`}
    >
     <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      Cross-team
      <span className="px-2 py-0.5 bg-violet-100 text-violet-900 text-xs rounded-full">
       {tickets.filter((t) => t.ticketScope === 'internal').length}
      </span>
     </span>
    </button>
    <button
     onClick={() => setActiveView('customizations')}
     className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all w-full sm:w-auto ${
      activeView === 'customizations'
       ? 'bg-white text-gray-900 shadow-sm'
       : 'text-gray-600 hover:text-gray-900'
     }`}
    >
     <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
      Product Customizations
      <span className="px-2 py-0.5 bg-gray-100 text-slate-900 text-xs rounded-full">
       {customizations.length}
      </span>
     </span>
    </button>
   </div>

   {/* Dashboard View — stats from API tickets (full page dynamic) */}
   {activeView === 'dashboard' && (
    <TicketDashboard 
     onNavigateToTickets={handleNavigateToTickets}
     overrideStats={dashboardStatsFromTickets}
    />
   )}

   {/* Tickets View (customer enquiries) */}
   {activeView === 'tickets' && (
    <div className="space-y-4">
     {/* Filters */}
     <FilterPanel
      filters={filters}
      onFiltersChange={setFilters}
      onClear={handleClearFilters}
      availableStaff={availableStaff}
     />

     {/* Actions Bar */}
     <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600">
       Showing {paginatedTickets.length} of {filteredTickets.length} tickets
      </p>
      <div className="flex items-center gap-2">
       <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Export
       </button>
       <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-800 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Ticket
       </button>
      </div>
     </div>

     {/* Tickets List */}
     {loading ? (
      <div className="flex items-center justify-center py-20">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
     ) : paginatedTickets.length > 0 ? (
      <div className="space-y-3">
       {paginatedTickets.map((ticket) => (
        <TicketRow
         key={ticket.id}
         ticket={ticket}
         onSelect={handleSelectTicket}
         onStatusChange={handleStatusChange}
         isSelected={selectedTicket?.id === ticket.id}
        />
       ))}
      </div>
     ) : (
      <EmptyTicketState />
     )}

     {/* Pagination */}
     {totalPages > 1 && (
      <div className="flex items-center justify-center gap-2 pt-4">
       <button
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
       >
        Previous
       </button>
       <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
         <button
          key={page}
          onClick={() => setCurrentPage(page)}
          className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
           currentPage === page
            ? 'bg-slate-800 text-white'
            : 'text-gray-700 hover:bg-gray-100'
          }`}
         >
          {page}
         </button>
        ))}
       </div>
       <button
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
       >
        Next
       </button>
      </div>
     )}
    </div>
   )}

   {activeView === 'cross-team' && (
    <div className="space-y-4">
     <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm text-violet-950">
      Internal tickets for handoffs between PIS, warehouse, planning, and other teams. Tag people and teams so the right owners see the request.
     </div>
     <FilterPanel
      filters={filters}
      onFiltersChange={setFilters}
      onClear={handleClearFilters}
      availableStaff={availableStaff}
     />
     <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600">
       Showing {paginatedTickets.length} of {filteredTickets.length} cross-team tickets
      </p>
      <button
       type="button"
       onClick={() => setCrossTeamModalOpen(true)}
       className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors"
      >
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
       </svg>
       New cross-team ticket
      </button>
     </div>
     {loading ? (
      <div className="flex items-center justify-center py-20">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-700" />
      </div>
     ) : paginatedTickets.length > 0 ? (
      <div className="space-y-3">
       {paginatedTickets.map((ticket) => (
        <TicketRow
         key={ticket.id}
         ticket={ticket}
         onSelect={handleSelectTicket}
         onStatusChange={handleStatusChange}
         isSelected={selectedTicket?.id === ticket.id}
        />
       ))}
      </div>
     ) : (
      <EmptyTicketState />
     )}
     {totalPages > 1 && (
      <div className="flex items-center justify-center gap-2 pt-4">
       <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
       >
        Previous
       </button>
       <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
         <button
          key={page}
          onClick={() => setCurrentPage(page)}
          className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
           currentPage === page
            ? 'bg-violet-700 text-white'
            : 'text-gray-700 hover:bg-gray-100'
          }`}
         >
          {page}
         </button>
        ))}
       </div>
       <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
       >
        Next
       </button>
      </div>
     )}
    </div>
   )}

  {activeView === 'customizations' && (
   <div className="space-y-4">
    <div className="flex items-center justify-between">
     <p className="text-sm text-gray-600">
      Showing {customizations.length} submitted product customizations
     </p>
     <button
      type="button"
      onClick={() => void loadCustomizations()}
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
     >
      Refresh
     </button>
    </div>
    {customizationsLoading ? (
     <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
     </div>
    ) : customizations.length > 0 ? (
     <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
      <table className="w-full text-sm">
       <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-left">
         <th className="px-4 py-3">ID</th>
         <th className="px-4 py-3">Customer</th>
         <th className="px-4 py-3">Product</th>
         <th className="px-4 py-3">Care / Category</th>
         <th className="px-4 py-3">Summary</th>
         <th className="px-4 py-3">Packaging</th>
         <th className="px-4 py-3">Status</th>
         <th className="px-4 py-3">Submitted</th>
         <th className="px-4 py-3">Action</th>
        </tr>
       </thead>
       <tbody>
        {customizations.map((row) => {
         const customerName = [row.user?.fname, row.user?.lname].filter(Boolean).join(' ').trim() || row.user?.email || '-';
         const productName = row.product?.product_name || (row.product_id ? `Product #${row.product_id}` : '-');
         return (
          <tr key={row.customization_id} className="border-b border-gray-100 align-top">
           <td className="px-4 py-3 font-medium">#{row.customization_id}</td>
           <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{customerName}</div>
            <div className="text-xs text-gray-500">{row.user?.mobile || row.user?.email || '-'}</div>
           </td>
           <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{productName}</div>
            <div className="text-xs text-gray-500">{row.product?.product_sku || '-'}</div>
           </td>
           <td className="px-4 py-3">
            <div className="text-gray-900">{row.care || '-'}</div>
            <div className="text-xs text-gray-500">{row.category || '-'}</div>
           </td>
           <td className="px-4 py-3 max-w-80">
            <div className="line-clamp-2 text-gray-700">{row.formulationSummary || row.userNotes || '-'}</div>
           </td>
           <td className="px-4 py-3">{row.packagingType || '-'}</td>
           <td className="px-4 py-3">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
             {row.status || 'Pending'}
            </span>
           </td>
           <td className="px-4 py-3 text-gray-600">
            {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '-'}
           </td>
           <td className="px-4 py-3">
            <button
             type="button"
             onClick={() => setSelectedCustomization(row)}
             className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
            >
             View
            </button>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ) : (
     <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
      No product customizations found.
     </div>
    )}
   </div>
  )}

  {selectedCustomization && (
   <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedCustomization(null)} />
    <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-xl p-5">
     <div className="flex items-start justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">
       Product Customization #{selectedCustomization.customization_id}
      </h3>
      <button type="button" onClick={() => setSelectedCustomization(null)} className="text-gray-500 hover:text-gray-800">
       Close
      </button>
     </div>

     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-gray-200 p-3">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Customer</p>
       <p className="text-sm text-gray-900">
        {[selectedCustomization.user?.fname, selectedCustomization.user?.lname].filter(Boolean).join(' ').trim()
         || selectedCustomization.user?.email || '-'}
       </p>
       <p className="text-xs text-gray-500 mt-1">{selectedCustomization.user?.mobile || '-'}</p>
      </div>
      <div className="rounded-lg border border-gray-200 p-3">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Product</p>
       <p className="text-sm text-gray-900">
        {selectedCustomization.product?.product_name || (selectedCustomization.product_id ? `Product #${selectedCustomization.product_id}` : '-')}
       </p>
       <p className="text-xs text-gray-500 mt-1">{selectedCustomization.product?.product_sku || '-'}</p>
      </div>
      <div className="rounded-lg border border-gray-200 p-3">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Care / Category</p>
       <p className="text-sm text-gray-900">{selectedCustomization.care || '-'} / {selectedCustomization.category || '-'}</p>
      </div>
      <div className="rounded-lg border border-gray-200 p-3">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Packaging Type</p>
       <p className="text-sm text-gray-900">{selectedCustomization.packagingType || '-'}</p>
      </div>
     </div>

     <div className="mt-4 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Formulation Summary</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">
       {selectedCustomization.formulationSummary || '-'}
      </p>
      {selectedCustomization.formulation && (
       <pre className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700 overflow-x-auto">
        {JSON.stringify(selectedCustomization.formulation, null, 2)}
       </pre>
      )}
     </div>

     <div className="mt-4 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Client Uploaded Photo</p>
      {selectedCustomization.packaging_image ? (
       <div>
        <img
         src={resolveImageUrl(selectedCustomization.packaging_image)}
         alt="Client packaging upload"
         className="max-h-56 rounded border border-gray-200 object-contain bg-gray-50"
         onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = 'none';
         }}
        />
        <a
         href={resolveImageUrl(selectedCustomization.packaging_image)}
         target="_blank"
         rel="noreferrer"
         className="mt-2 inline-block text-xs text-blue-600 hover:underline"
        >
         Open original image
        </a>
      </div>
      ) : (
       <p className="text-sm text-gray-500">No uploaded image found.</p>
      )}
     </div>

     <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-lg border border-gray-200 p-3">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Status</p>
       <select
        value={selectedCustomization.status || 'Pending'}
        onChange={(e) => setSelectedCustomization((prev) => prev ? { ...prev, status: e.target.value } : prev)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
       >
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Assigned">Assigned</option>
        <option value="Closed">Closed</option>
       </select>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 md:col-span-2">
       <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Allot BD Team Member</p>
       <select
        value={selectedCustomization.assigned_bd_user_id ?? ''}
        onChange={(e) => {
         const selectedId = e.target.value ? Number(e.target.value) : null;
         const selectedUser = bdAssignees.find((u) => Number(u.userid) === Number(selectedId));
         setSelectedCustomization((prev) => prev ? {
          ...prev,
          assigned_bd_user_id: selectedId,
          assigned_bd_name: selectedUser?.display_name ?? null,
          assigned_bd_email: selectedUser?.email ?? null,
         } : prev);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
       >
        <option value="">Unassigned</option>
        {bdAssignees.map((u) => (
         <option key={u.userid} value={u.userid}>
          {(u.display_name || u.email || `User ${u.userid}`)} {u.role_name ? `(${u.role_name})` : ''}
         </option>
        ))}
       </select>
       {selectedCustomization.assigned_bd_name && (
        <p className="mt-2 text-xs text-gray-600">
         Assigned: {selectedCustomization.assigned_bd_name} ({selectedCustomization.assigned_bd_email || 'no email'})
        </p>
       )}
      </div>
     </div>

     <div className="mt-4 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Internal Notes</p>
      <textarea
       rows={3}
       value={selectedCustomization.internal_notes || ''}
       onChange={(e) => setSelectedCustomization((prev) => prev ? { ...prev, internal_notes: e.target.value } : prev)}
       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
       placeholder="Add internal notes for BD/operations follow-up"
      />
     </div>

     <div className="mt-5 flex justify-end gap-2">
      <button
       type="button"
       onClick={() => setSelectedCustomization(null)}
       className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
      >
       Cancel
      </button>
      <button
       type="button"
       disabled={savingCustomization}
       onClick={() => void handleCustomizationSave()}
       className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm disabled:opacity-60"
      >
       {savingCustomization ? 'Saving...' : 'Save Allotment'}
      </button>
     </div>
    </div>
   </div>
  )}

   {/* Ticket Detail Popup */}
   {selectedTicket && (
    <TicketDetailPopup
     ticket={selectedTicket}
     onClose={() => setSelectedTicket(null)}
     onUpdate={handleTicketUpdate}
    />
   )}

   <CrossTeamTicketModal
    open={crossTeamModalOpen}
    onClose={() => setCrossTeamModalOpen(false)}
    onCreated={handleInternalTicketCreated}
   />
  </div>
 );
};

export default EnquiryManagementEnhanced;
