import React, { useState, useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import type {
 Ticket,
 TicketStatus,
 TicketPriority,
 TicketCategory,
 StaffMember,
 TicketFilters
} from '../../types/ticket.types';
import { EmptyState } from '../ui/EmptyState';

// ==================== Ticket Status Badge ====================
interface StatusBadgeProps {
 status: TicketStatus;
 size?: 'sm' | 'md';
}

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string }> = {
 'new': { label: 'New', color: 'text-brand', bgColor: 'bg-brand-soft border-brand' },
 'open': { label: 'Open', color: 'text-ink', bgColor: 'bg-surface-2 border-border' },
 'in-progress': { label: 'In Progress', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
 'pending-customer': { label: 'Pending Customer', color: 'text-warn', bgColor: 'bg-warn-soft border-warn' },
 'pending-internal': { label: 'Pending Internal', color: 'text-warn', bgColor: 'bg-warn-soft border-warn' },
 'resolved': { label: 'Resolved', color: 'text-ok', bgColor: 'bg-ok-soft border-ok' },
 'closed': { label: 'Closed', color: 'text-ink-2', bgColor: 'bg-surface-3 border-border' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
 const config = statusConfig[status];
 const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
 
 return (
  <span className={`inline-flex items-center rounded-full border font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}>
   {config.label}
  </span>
 );
};

// ==================== Priority Badge ====================
interface PriorityBadgeProps {
 priority: TicketPriority;
 size?: 'sm' | 'md';
}

const priorityConfig: Record<TicketPriority, { label: string; color: string; bgColor: string; icon: string }> = {
 'low': { label: 'Low', color: 'text-ink-2', bgColor: 'bg-surface-3', icon: '' },
 'medium': { label: 'Medium', color: 'text-brand', bgColor: 'bg-brand-soft', icon: '' },
 'high': { label: 'High', color: 'text-ink', bgColor: 'bg-warn-soft', icon: '' },
 'urgent': { label: 'Urgent', color: 'text-err', bgColor: 'bg-err-soft', icon: '' },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
 const config = priorityConfig[priority];
 const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
 
 return (
  <span className={`inline-flex items-center gap-1 rounded-md font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}>
   <span>{config.icon}</span>
   {config.label}
  </span>
 );
};

// ==================== Category Badge ====================
const categoryLabels: Record<TicketCategory, string> = {
 'general-inquiry': 'General',
 'product-inquiry': 'Product',
 'order-issue': 'Order',
 'payment-issue': 'Payment',
 'delivery-issue': 'Delivery',
 'complaint': 'Complaint',
 'feedback': 'Feedback',
 'technical-support': 'Technical',
 'quotation-request': 'Quotation',
 'partnership': 'Partnership',
 'refund': 'Refund',
 'pis-issue': 'PIS',
 'other': 'Other',
};

export const CategoryBadge: React.FC<{ category: TicketCategory | string }> = ({ category }) => {
 const label =
  categoryLabels[category as TicketCategory] ||
  String(category || 'other')
   .replace(/-/g, ' ')
   .replace(/\b\w/g, (c) => c.toUpperCase());
 return (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-3 text-ink-2 border border-border">
   {label}
  </span>
 );
};

// ==================== Staff Assignment Dropdown ====================
interface StaffAssignmentDropdownProps {
 currentAssignee?: { staffId: string; staffName: string };
 availableStaff: StaffMember[];
 onAssign: (staffId: string) => void;
 onUnassign: () => void;
 disabled?: boolean;
}

export const StaffAssignmentDropdown: React.FC<StaffAssignmentDropdownProps> = ({
 currentAssignee,
 availableStaff,
 onAssign,
 onUnassign,
 disabled = false,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');

 const filteredStaff = useMemo(() => {
  if (!searchTerm) return availableStaff;
  const lower = searchTerm.toLowerCase();
  return availableStaff.filter(
   s => s.name.toLowerCase().includes(lower) || 
      s.department.toLowerCase().includes(lower)
  );
 }, [availableStaff, searchTerm]);

 return (
  <div className="relative">
   <button
    onClick={() => !disabled && setIsOpen(!isOpen)}
    disabled={disabled}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
     disabled 
      ? 'bg-surface-3 text-ink-4 cursor-not-allowed' 
      : 'bg-surface hover:bg-surface-2 border-border'
    }`}
   >
    {currentAssignee ? (
     <>
      <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center text-white text-xs font-semibold">
       {currentAssignee.staffName.split(' ').map(n => n[0]).join('')}
      </div>
      <span className="text-sm font-medium text-ink-2">{currentAssignee.staffName}</span>
     </>
    ) : (
     <>
      <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center">
       <svg className="w-4 h-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
       </svg>
      </div>
      <span className="text-sm text-ink-3">Unassigned</span>
     </>
    )}
    <svg className="w-4 h-4 text-ink-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
   </button>

   {isOpen && (
    <>
     <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
     <div className="absolute top-full left-0 mt-2 w-72 bg-surface rounded-xl shadow-lg border border-border z-20 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-hairline">
       <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search staff..."
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-border focus:border-transparent"
        aria-label="Search staff"
       />
      </div>

      {/* Staff List */}
      <div className="max-h-64 overflow-y-auto">
       {currentAssignee && (
        <button
         onClick={() => {
          onUnassign();
          setIsOpen(false);
         }}
         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 text-left border-b border-hairline"
        >
         <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center">
          <svg className="w-4 h-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
         </div>
         <span className="text-sm text-ink-2">Remove Assignment</span>
        </button>
       )}
       
       {filteredStaff.map(staff => (
        <button
         key={staff.id}
         onClick={() => {
          onAssign(staff.id);
          setIsOpen(false);
         }}
         disabled={!staff.isAvailable || staff.activeTicketCount >= staff.maxTicketCapacity}
         className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 text-left ${
          !staff.isAvailable || staff.activeTicketCount >= staff.maxTicketCapacity
           ? 'opacity-50 cursor-not-allowed'
           : ''
         } ${currentAssignee?.staffId === staff.id ? 'bg-surface-2' : ''}`}
        >
         <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-white text-xs font-semibold">
          {staff.name.split(' ').map(n => n[0]).join('')}
         </div>
         <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{staff.name}</p>
          <p className="text-xs text-ink-3">{staff.department}</p>
         </div>
         <div className="text-right">
          <p className="text-xs font-medium text-ink-2">
           {staff.activeTicketCount}/{staff.maxTicketCapacity}
          </p>
          {!staff.isAvailable && (
           <span className="text-xs text-err">Unavailable</span>
          )}
         </div>
        </button>
       ))}

       {filteredStaff.length === 0 && (
        <div className="px-4 py-8 text-center text-ink-3 text-sm">
         No staff found
        </div>
       )}
      </div>
     </div>
    </>
   )}
  </div>
 );
};

// ==================== Status Dropdown ====================
interface StatusDropdownProps {
 currentStatus: TicketStatus;
 onStatusChange: (status: TicketStatus) => void;
 disabled?: boolean;
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
 currentStatus,
 onStatusChange,
 disabled = false,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const statuses: TicketStatus[] = [
  'new', 'open', 'in-progress', 'pending-customer', 'pending-internal', 'resolved', 'closed'
 ];

 return (
  <div className="relative">
   <button
    onClick={() => !disabled && setIsOpen(!isOpen)}
    disabled={disabled}
    className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
   >
    <StatusBadge status={currentStatus} />
    {!disabled && (
     <svg className="w-4 h-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
     </svg>
    )}
   </button>

   {isOpen && (
    <>
     <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
     <div className="absolute top-full left-0 mt-2 w-48 bg-surface rounded-xl shadow-lg border border-border z-20 py-2">
      {statuses.map(status => (
       <button
        key={status}
        onClick={() => {
         onStatusChange(status);
         setIsOpen(false);
        }}
        className={`w-full px-4 py-2 text-left hover:bg-surface-2 flex items-center gap-2 ${
         currentStatus === status ? 'bg-surface-2' : ''
        }`}
       >
        <StatusBadge status={status} size="sm" />
       </button>
      ))}
     </div>
    </>
   )}
  </div>
 );
};

// ==================== Priority Dropdown ====================
interface PriorityDropdownProps {
 currentPriority: TicketPriority;
 onPriorityChange: (priority: TicketPriority) => void;
 disabled?: boolean;
}

export const PriorityDropdown: React.FC<PriorityDropdownProps> = ({
 currentPriority,
 onPriorityChange,
 disabled = false,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const priorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

 return (
  <div className="relative">
   <button
    onClick={() => !disabled && setIsOpen(!isOpen)}
    disabled={disabled}
    className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
   >
    <PriorityBadge priority={currentPriority} />
    {!disabled && (
     <svg className="w-4 h-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
     </svg>
    )}
   </button>

   {isOpen && (
    <>
     <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
     <div className="absolute top-full left-0 mt-2 w-40 bg-surface rounded-xl shadow-lg border border-border z-20 py-2">
      {priorities.map(priority => (
       <button
        key={priority}
        onClick={() => {
         onPriorityChange(priority);
         setIsOpen(false);
        }}
        className={`w-full px-4 py-2 text-left hover:bg-surface-2 flex items-center gap-2 ${
         currentPriority === priority ? 'bg-surface-2' : ''
        }`}
       >
        <PriorityBadge priority={priority} size="sm" />
       </button>
      ))}
     </div>
    </>
   )}
  </div>
 );
};

// ==================== Filter Panel ====================
interface FilterPanelProps {
 filters: TicketFilters;
 onFiltersChange: (filters: TicketFilters) => void;
 onClear: () => void;
 availableStaff: StaffMember[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
 filters,
 onFiltersChange,
 onClear,
 availableStaff,
}) => {
 const [isExpanded, setIsExpanded] = useState(false);

 const statusOptions: TicketStatus[] = ['new', 'open', 'in-progress', 'pending-customer', 'pending-internal', 'resolved', 'closed'];
 const priorityOptions: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
 const categoryOptions: TicketCategory[] = [
  'general-inquiry', 'product-inquiry', 'order-issue', 'payment-issue',
  'delivery-issue', 'complaint', 'feedback', 'technical-support',
  'quotation-request', 'partnership', 'refund', 'pis-issue', 'other'
 ];

 const activeFilterCount = Object.values(filters).filter(v => {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== '';
 }).length;

 return (
  <div className="bg-surface rounded-xl border border-border p-4">
   {/* Search Bar */}
   <div className="flex flex-col sm:flex-row gap-4">
    <div className="flex-1 relative">
     <svg className="absolute left-3 top-3 w-5 h-5 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
     </svg>
     <input
      type="text"
      placeholder="Search by ticket #, customer name, email..."
      value={filters.searchTerm || ''}
      onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
      aria-label="Search by ticket #, customer name, email"
     />
    </div>
    <div className="flex gap-2">
     <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
       isExpanded || activeFilterCount > 0
        ? 'bg-surface-2 border-warn text-ink'
        : 'bg-surface border-border text-ink-2 hover:bg-surface-2'
      }`}
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      Filters
      {activeFilterCount > 0 && (
       <span className="w-5 h-5 bg-ink text-white text-xs rounded-full flex items-center justify-center">
        {activeFilterCount}
       </span>
      )}
     </button>
     {activeFilterCount > 0 && (
      <button
       onClick={onClear}
       className="px-4 py-2.5 text-ink-2 hover:text-ink hover:bg-surface-3 rounded-lg transition-colors"
      >
       Clear
      </button>
     )}
    </div>
   </div>

   {/* Expanded Filters */}
   {isExpanded && (
    <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
     {/* Status */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">Status</label>
      <select
       value={filters.status?.[0] || ''}
       onChange={(e) => onFiltersChange({ 
        ...filters, 
        status: e.target.value ? [e.target.value as TicketStatus] : undefined
       })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="Status"
      >
       <option value="">All Status</option>
       {statusOptions.map(status => (
        <option key={status} value={status}>{statusConfig[status].label}</option>
       ))}
      </select>
     </div>

     {/* Priority */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">Priority</label>
      <select
       value={filters.priority?.[0] || ''}
       onChange={(e) => onFiltersChange({ 
        ...filters, 
        priority: e.target.value ? [e.target.value as TicketPriority] : undefined
       })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="Priority"
      >
       <option value="">All Priorities</option>
       {priorityOptions.map(priority => (
        <option key={priority} value={priority}>{priorityConfig[priority].label}</option>
       ))}
      </select>
     </div>

     {/* Category */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">Category</label>
      <select
       value={filters.category?.[0] || ''}
       onChange={(e) => onFiltersChange({ 
        ...filters, 
        category: e.target.value ? [e.target.value as TicketCategory] : undefined
       })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="Category"
      >
       <option value="">All Categories</option>
       {categoryOptions.map(category => (
        <option key={category} value={category}>{categoryLabels[category]}</option>
       ))}
      </select>
     </div>

     {/* Assignee */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">Assigned To</label>
      <select
       value={filters.assigneeId || ''}
       onChange={(e) => onFiltersChange({ 
        ...filters, 
        assigneeId: e.target.value || undefined
       })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="Assigned To"
      >
       <option value="">All Staff</option>
       <option value="unassigned">Unassigned</option>
       {availableStaff.map(staff => (
        <option key={staff.id} value={staff.id}>{staff.name}</option>
       ))}
      </select>
     </div>

     {/* Date From */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">From Date</label>
      <input
       type="date"
       value={filters.dateFrom || ''}
       onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="From Date"
      />
     </div>

     {/* Date To */}
     <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">To Date</label>
      <input
       type="date"
       value={filters.dateTo || ''}
       onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
       className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-border focus:border-transparent"
       aria-label="To Date"
      />
     </div>

     {/* Overdue Only */}
     <div className="flex items-end">
      <label className="flex items-center gap-2 cursor-pointer">
       <input
        type="checkbox"
        checked={filters.isOverdue || false}
        onChange={(e) => onFiltersChange({ ...filters, isOverdue: e.target.checked || undefined })}
        className="w-4 h-4 text-ink-2 border-border rounded focus:ring-border"
       />
       <span className="text-sm text-ink-2">Overdue Only</span>
      </label>
     </div>

     {/* Has Orders */}
     <div className="flex items-end">
      <label className="flex items-center gap-2 cursor-pointer">
       <input
        type="checkbox"
        checked={filters.hasLinkedOrders || false}
        onChange={(e) => onFiltersChange({ ...filters, hasLinkedOrders: e.target.checked || undefined })}
        className="w-4 h-4 text-ink-2 border-border rounded focus:ring-border"
       />
       <span className="text-sm text-ink-2">Has Linked Orders</span>
      </label>
     </div>
    </div>
   )}
  </div>
 );
};

// ==================== Ticket Row Component ====================
interface TicketRowProps {
 ticket: Ticket;
 onSelect: (ticket: Ticket) => void;
 onStatusChange?: (ticketId: string, status: TicketStatus) => void;
 onPriorityChange?: (ticketId: string, priority: TicketPriority) => void;
 isSelected?: boolean;
}

export const TicketRow: React.FC<TicketRowProps> = ({
 ticket,
 onSelect,
 onStatusChange,
 onPriorityChange: _onPriorityChange,
 isSelected = false,
}) => {
 const timeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
 };

 return (
  <div
   className={`border rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${
    isSelected 
     ? 'border-warn bg-surface-2/50 shadow-sm' 
     : 'border-border hover:border-border bg-surface'
   } ${ticket.isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
   onClick={() => onSelect(ticket)}
  >
   <div className="flex flex-col lg:flex-row lg:items-center gap-4">
    {/* Left: Ticket Info */}
    <div className="flex-1 min-w-0">
     <div className="flex items-center gap-2 mb-2 flex-wrap">
      <span className="font-mono text-sm font-semibold text-ink-2">
       #{ticket.ticketNumber}
      </span>
      {ticket.ticketScope === 'internal' && (
       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200">
        Cross-team
       </span>
      )}
      <StatusBadge status={ticket.status} size="sm" />
      <PriorityBadge priority={ticket.priority} size="sm" />
      {ticket.isOverdue && (
       <span className="px-2 py-0.5 bg-err-soft text-err text-xs font-medium rounded">
        OVERDUE
       </span>
      )}
     </div>
     <h4 className="font-medium text-ink truncate">{ticket.subject}</h4>
     {ticket.collaboration && ticket.ticketScope === 'internal' && (
      <div className="mt-2 flex flex-wrap gap-1.5">
       {ticket.collaboration.issueAreas?.includes('pis') && (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-warn-soft text-warn">
         PIS
        </span>
       )}
       {ticket.collaboration.taggedTeams?.slice(0, 4).map((t) => (
        <span
         key={t.id}
         className="px-2 py-0.5 rounded text-xs bg-surface-3 text-ink-2 border border-border"
        >
         {t.name || t.id}
        </span>
       ))}
       {ticket.collaboration.taggedMembers && ticket.collaboration.taggedMembers.length > 0 && (
        <span className="text-xs text-ink-3">
         @{ticket.collaboration.taggedMembers.length} colleague
         {ticket.collaboration.taggedMembers.length > 1 ? 's' : ''}
        </span>
       )}
      </div>
     )}
     <div className="flex items-center gap-3 mt-2 text-sm text-ink-3">
      <span className="flex items-center gap-1">
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
       </svg>
       {ticket.customer?.name || '—'}
      </span>
      <span className="flex items-center gap-1">
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>
       {timeAgo(ticket.createdAt)}
      </span>
      {ticket.linkedOrders.length > 0 && (
       <span className="flex items-center gap-1 text-brand">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {ticket.linkedOrders.length} order{ticket.linkedOrders.length > 1 ? 's' : ''}
       </span>
      )}
     </div>
    </div>

    {/* Right: Assignee & Actions */}
    <div className="flex items-center gap-4 lg:shrink-0">
     {/* Assignee */}
     {ticket.currentAssignee ? (
      <div className="flex items-center gap-2">
       <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-white text-xs font-semibold">
        {ticket.currentAssignee.staffName.split(' ').map(n => n[0]).join('')}
       </div>
       <div className="hidden sm:block">
        <p className="text-sm font-medium text-ink">{ticket.currentAssignee.staffName}</p>
        <p className="text-xs text-ink-3">{ticket.currentAssignee.department}</p>
       </div>
      </div>
     ) : (
      <div className="flex items-center gap-2">
       <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center">
        <svg className="w-4 h-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
       </div>
       <span className="hidden sm:block text-sm text-ink-3">Unassigned</span>
      </div>
     )}

     {/* Quick Actions */}
     <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {onStatusChange && (
       <StatusDropdown
        currentStatus={ticket.status}
        onStatusChange={(status) => onStatusChange(ticket.id, status)}
       />
      )}
     </div>
    </div>
   </div>
  </div>
 );
};

// ==================== Empty State ====================
export const EmptyTicketState: React.FC<{ message?: string }> = ({ message }) => (
 <EmptyState
  icon={<ClipboardList />}
  title="No tickets found"
  description={message || 'Try adjusting your filters or create a new ticket'}
 />
);
