import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
 Ticket, 
 TicketStatus, 
 TicketPriority, 
 TicketFilters,
 StaffMember,
} from '../../types/ticket.types';
import TicketDashboard from './TicketDashboard';
import TicketDetailPopup from './TicketDetailPopup';
import { 
 FilterPanel, 
 TicketRow, 
 EmptyTicketState,
} from './TicketComponents';
import { fetchTickets, fetchAvailableStaff } from '../../services/ticket.service';

// Mock tickets data for development
const mockTickets: Ticket[] = [
 {
  id: 'TKT001',
  ticketNumber: 'TKT-2026-0001',
  customer: {
   id: 'CUST001',
   name: 'John Doe',
   email: 'john.doe@example.com',
   phone: '9876543210',
   company: 'Acme Corp',
   isRegistered: true,
  },
  subject: 'Issue with my recent order delivery',
  description: 'I placed an order last week but it still has not arrived. The tracking shows it has been stuck at the same location for 3 days.',
  category: 'delivery-issue',
  priority: 'high',
  status: 'in-progress',
  source: 'website',
  tags: ['delivery', 'urgent'],
  currentAssignee: {
   staffId: 'STF001',
   staffName: 'Rahul Sharma',
   staffEmail: 'rahul.s@company.com',
   department: 'Customer Support',
   assignedAt: '2026-01-21T10:30:00Z',
   assignedBy: 'System',
   isActive: true,
  },
  assignmentHistory: [],
  linkedOrders: [
   {
    orderId: 'ORD001',
    orderNumber: 'ORD-2026-0542',
    orderDate: '2026-01-15',
    orderStatus: 'Shipped',
    orderTotal: 15999,
    productName: 'Premium Skincare Kit',
    linkedAt: '2026-01-21T10:30:00Z',
    linkedBy: 'Rahul Sharma',
    relevance: 'Customer order mentioned in complaint',
   },
  ],
  messages: [
   {
    id: 'MSG001',
    ticketId: 'TKT001',
    senderId: 'CUST001',
    senderName: 'John Doe',
    senderType: 'customer',
    content: 'Hi, I placed order ORD-2026-0542 on Jan 15th and it still hasn\'t arrived. Please help!',
    sentAt: '2026-01-20T14:22:00Z',
    isInternal: false,
   },
   {
    id: 'MSG002',
    ticketId: 'TKT001',
    senderId: 'STF001',
    senderName: 'Rahul Sharma',
    senderType: 'staff',
    content: 'Hello John, I apologize for the inconvenience. I\'m looking into your order status right now.',
    sentAt: '2026-01-21T10:35:00Z',
    isInternal: false,
   },
  ],
  activities: [
   {
    id: 'ACT001',
    ticketId: 'TKT001',
    type: 'created',
    description: 'Ticket created from website contact form',
    performedBy: { id: 'SYSTEM', name: 'System', role: 'System' },
    timestamp: '2026-01-20T14:22:00Z',
   },
   {
    id: 'ACT002',
    ticketId: 'TKT001',
    type: 'assigned',
    description: 'Ticket assigned to Rahul Sharma',
    performedBy: { id: 'SYSTEM', name: 'System', role: 'System' },
    timestamp: '2026-01-21T10:30:00Z',
   },
   {
    id: 'ACT003',
    ticketId: 'TKT001',
    type: 'status-change',
    description: 'Status changed from New to In Progress',
    performedBy: { id: 'STF001', name: 'Rahul Sharma', role: 'Support Executive' },
    timestamp: '2026-01-21T10:31:00Z',
    previousValue: 'New',
    newValue: 'In Progress',
   },
   {
    id: 'ACT004',
    ticketId: 'TKT001',
    type: 'order-linked',
    description: 'Order ORD-2026-0542 linked to ticket',
    performedBy: { id: 'STF001', name: 'Rahul Sharma', role: 'Support Executive' },
    timestamp: '2026-01-21T10:32:00Z',
   },
  ],
  createdAt: '2026-01-20T14:22:00Z',
  updatedAt: '2026-01-21T10:35:00Z',
  firstResponseAt: '2026-01-21T10:35:00Z',
  slaDeadline: '2026-01-22T14:22:00Z',
  isOverdue: false,
  responseCount: 1,
 },
 {
  id: 'TKT002',
  ticketNumber: 'TKT-2026-0002',
  customer: {
   name: 'Jane Smith',
   email: 'jane.smith@example.com',
   phone: '8765432109',
   isRegistered: false,
  },
  subject: 'Request for bulk pricing quote',
  description: 'We are interested in purchasing 500 units of your premium products. Can you provide bulk pricing?',
  category: 'quotation-request',
  priority: 'medium',
  status: 'new',
  source: 'email',
  currentAssignee: undefined,
  assignmentHistory: [],
  linkedOrders: [],
  messages: [],
  activities: [
   {
    id: 'ACT005',
    ticketId: 'TKT002',
    type: 'created',
    description: 'Ticket created from email',
    performedBy: { id: 'SYSTEM', name: 'System', role: 'System' },
    timestamp: '2026-01-22T09:15:00Z',
   },
  ],
  createdAt: '2026-01-22T09:15:00Z',
  updatedAt: '2026-01-22T09:15:00Z',
  slaDeadline: '2026-01-23T09:15:00Z',
  isOverdue: false,
  responseCount: 0,
 },
 {
  id: 'TKT003',
  ticketNumber: 'TKT-2026-0003',
  customer: {
   id: 'CUST003',
   name: 'Mike Johnson',
   email: 'mike.j@example.com',
   phone: '7654321098',
   isRegistered: true,
  },
  subject: 'Payment failed but amount deducted',
  description: 'I tried to make a payment of Rs 5,999 for my order but the transaction failed. However, the amount has been deducted from my account.',
  category: 'payment-issue',
  priority: 'urgent',
  status: 'open',
  source: 'phone',
  currentAssignee: {
   staffId: 'STF004',
   staffName: 'Sneha Reddy',
   staffEmail: 'sneha.r@company.com',
   department: 'Order Management',
   assignedAt: '2026-01-22T11:00:00Z',
   assignedBy: 'Admin',
   isActive: true,
  },
  assignmentHistory: [],
  linkedOrders: [],
  messages: [],
  activities: [
   {
    id: 'ACT006',
    ticketId: 'TKT003',
    type: 'created',
    description: 'Ticket created from phone call',
    performedBy: { id: 'STF004', name: 'Sneha Reddy', role: 'Order Manager' },
    timestamp: '2026-01-22T11:00:00Z',
   },
   {
    id: 'ACT007',
    ticketId: 'TKT003',
    type: 'priority-change',
    description: 'Priority escalated to Urgent',
    performedBy: { id: 'STF004', name: 'Sneha Reddy', role: 'Order Manager' },
    timestamp: '2026-01-22T11:02:00Z',
    previousValue: 'Medium',
    newValue: 'Urgent',
   },
  ],
  createdAt: '2026-01-22T11:00:00Z',
  updatedAt: '2026-01-22T11:02:00Z',
  slaDeadline: '2026-01-22T15:00:00Z',
  isOverdue: true,
  responseCount: 0,
 },
 {
  id: 'TKT004',
  ticketNumber: 'TKT-2026-0004',
  customer: {
   name: 'Sarah Wilson',
   email: 'sarah.w@example.com',
   phone: '6543210987',
   company: 'Beauty Plus Salon',
   isRegistered: true,
  },
  subject: 'Product specifications inquiry',
  description: 'Need technical specifications and ingredient list for your organic skincare range.',
  category: 'product-inquiry',
  priority: 'low',
  status: 'resolved',
  source: 'website',
  currentAssignee: {
   staffId: 'STF002',
   staffName: 'Priya Patel',
   staffEmail: 'priya.p@company.com',
   department: 'Sales',
   assignedAt: '2026-01-18T14:00:00Z',
   assignedBy: 'System',
   isActive: true,
  },
  assignmentHistory: [],
  linkedOrders: [],
  messages: [],
  activities: [],
  createdAt: '2026-01-18T10:30:00Z',
  updatedAt: '2026-01-20T16:45:00Z',
  firstResponseAt: '2026-01-18T14:15:00Z',
  resolvedAt: '2026-01-20T16:45:00Z',
  resolutionNotes: 'Sent product specification documents via email',
  isOverdue: false,
  responseCount: 3,
 },
 {
  id: 'TKT005',
  ticketNumber: 'TKT-2026-0005',
  customer: {
   name: 'David Brown',
   email: 'david.b@example.com',
   phone: '5432109876',
   isRegistered: false,
  },
  subject: 'Partnership inquiry for distribution',
  description: 'We are a distribution company and interested in becoming an authorized distributor for your products in the southern region.',
  category: 'partnership',
  priority: 'medium',
  status: 'pending-internal',
  source: 'email',
  currentAssignee: {
   staffId: 'STF002',
   staffName: 'Priya Patel',
   staffEmail: 'priya.p@company.com',
   department: 'Sales',
   assignedAt: '2026-01-19T09:00:00Z',
   assignedBy: 'Admin',
   isActive: true,
  },
  assignmentHistory: [],
  linkedOrders: [],
  messages: [],
  activities: [],
  createdAt: '2026-01-17T15:20:00Z',
  updatedAt: '2026-01-21T11:30:00Z',
  isOverdue: false,
  responseCount: 2,
 },
];

// ==================== Main Component ====================
type ViewTab = 'dashboard' | 'tickets';

const EnquiryManagementEnhanced: React.FC = () => {
 // View state
 const [activeView, setActiveView] = useState<ViewTab>('dashboard');
 
 // Ticket list state
 const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
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

 // Load tickets
 const loadTickets = useCallback(async () => {
  setLoading(true);
  try {
   const result = await fetchTickets(filters, { page: currentPage, pageSize: recordsPerPage });
   if (result.success && result.data) {
    // Use mock data for now since API is not implemented
    // setTickets(result.data.data);
   }
  } catch (error) {
  } finally {
   setLoading(false);
  }
 }, [filters, currentPage]);

 useEffect(() => {
  loadTickets();
 }, [loadTickets]);

 // Filter tickets locally (for mock data)
 const filteredTickets = useMemo(() => {
  let result = [...tickets];

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

   {/* Dashboard View */}
   {activeView === 'dashboard' && (
    <TicketDashboard 
     onNavigateToTickets={handleNavigateToTickets}
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
