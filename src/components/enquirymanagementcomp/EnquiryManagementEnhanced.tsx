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
import { 
 FilterPanel, 
 TicketRow, 
 EmptyTicketState,
} from './TicketComponents';
import { fetchAvailableStaff } from '../../services/ticket.service';
import api from '../../lib/apiClient';
import { ApiResponse } from '../../types/api.types';


// ==================== Main Component ====================
type ViewTab = 'dashboard' | 'tickets';

const EnquiryManagementEnhanced: React.FC = () => {
 // View state
 const [activeView, setActiveView] = useState<ViewTab>('dashboard');
 
 // Ticket list state — always array so filteredTickets never spreads undefined
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
 const [filters, setFilters] = useState<TicketFilters>({});
 const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
 const [loading, setLoading] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const recordsPerPage = 10;

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
  list.forEach((t) => {
   const sk = statusKey(t.status);
   if (sk in byStatus) (byStatus as Record<string, number>)[sk] = ((byStatus as Record<string, number>)[sk] ?? 0) + 1;
   if (t.priority && t.priority in byPriority) byPriority[t.priority as keyof typeof byPriority]++;
   if ((t as { resolvedAt?: string }).resolvedAt?.slice(0, 10) === today) closedToday++;
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
   ticketTrend: [],
   slaMetrics: { onTime: 0, breached: 0, atRisk: 0 },
   responseMetrics: { avgFirstResponseTime: 0, avgResponseTime: 0, avgResolutionTime: 0 },
  };
 }, [tickets]);

 // Filter tickets locally (for mock data)
 const filteredTickets = useMemo(() => {
  const list = Array.isArray(tickets) ? tickets : [];
  let result = [...list];

  // Search filter
  if (filters.searchTerm) {
   const search = filters.searchTerm.toLowerCase();
   result = result.filter(t => 
    t.ticketNumber.toLowerCase().includes(search) ||
    t.subject.toLowerCase().includes(search) ||
    t.customer.name.toLowerCase().includes(search) ||
    t.customer.email.toLowerCase().includes(search)
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
   result = result.filter(t => t.linkedOrders.length > 0);
  }

  return result;
 }, [tickets, filters]);

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

 return (
  <div className="w-full space-y-6">
   {/* View Toggle */}
   <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
    <button
     onClick={() => setActiveView('dashboard')}
     className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
     className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
      activeView === 'tickets'
       ? 'bg-white text-gray-900 shadow-sm'
       : 'text-gray-600 hover:text-gray-900'
     }`}
    >
     <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      All Tickets
      <span className="px-2 py-0.5 bg-gray-100 text-slate-900 text-xs rounded-full">
       {filteredTickets.length}
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

   {/* Tickets View */}
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

   {/* Ticket Detail Popup */}
   {selectedTicket && (
    <TicketDetailPopup
     ticket={selectedTicket}
     onClose={() => setSelectedTicket(null)}
     onUpdate={handleTicketUpdate}
    />
   )}
  </div>
 );
};

export default EnquiryManagementEnhanced;
