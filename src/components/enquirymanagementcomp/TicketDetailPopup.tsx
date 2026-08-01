import React, { useState, useEffect, useCallback } from 'react';
import type { 
 Ticket, 
 TicketActivity,
 TicketMessage,
 LinkedOrder,
 StaffMember,
 TicketStatus,
 TicketPriority,
} from '../../types/ticket.types';
import { 
 StatusBadge, 
 PriorityBadge, 
 CategoryBadge,
 StaffAssignmentDropdown,
 StatusDropdown,
 PriorityDropdown,
} from './TicketComponents';
import { fetchAvailableStaff } from '../../services/ticket.service';
import api from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

// ==================== Activity Timeline ====================
interface ActivityTimelineProps {
 activities: TicketActivity[];
 isLoading?: boolean;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, isLoading }) => {
 const getActivityIcon = (type: TicketActivity['type']) => {
  const iconMap: Record<TicketActivity['type'], { icon: string; color: string }> = {
   'created': { icon: '', color: 'bg-blue-100 text-blue-600' },
   'assigned': { icon: '', color: 'bg-purple-100 text-purple-600' },
   'reassigned': { icon: '', color: 'bg-purple-100 text-purple-600' },
   'status-change': { icon: '', color: 'bg-gray-100 text-slate-800' },
   'priority-change': { icon: '', color: 'bg-orange-100 text-slate-800' },
   'note-added': { icon: '', color: 'bg-gray-100 text-gray-600' },
   'response-sent': { icon: '', color: 'bg-emerald-100 text-emerald-600' },
   'customer-replied': { icon: '', color: 'bg-blue-100 text-blue-600' },
   'escalated': { icon: '', color: 'bg-red-100 text-red-600' },
   'order-linked': { icon: '', color: 'bg-indigo-100 text-indigo-600' },
   'attachment-added': { icon: '', color: 'bg-gray-100 text-gray-600' },
   'resolved': { icon: '', color: 'bg-emerald-100 text-emerald-600' },
   'reopened': { icon: '', color: 'bg-gray-100 text-slate-800' },
   'closed': { icon: '', color: 'bg-gray-100 text-gray-600' },
  };
  return iconMap[type] || { icon: '•', color: 'bg-gray-100 text-gray-600' };
 };

 const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
 };

 if (isLoading) {
  return (
   <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800" />
   </div>
  );
 }

 if (activities.length === 0) {
  return (
   <div className="text-center py-8 text-gray-500 text-sm">
    No activity yet
   </div>
  );
 }

 return (
  <div className="space-y-4">
   {activities.map((activity, index) => {
    const { icon, color } = getActivityIcon(activity.type);
    return (
     <div key={activity.id} className="flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
       <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-sm`}>
        {icon}
       </div>
       {index < activities.length - 1 && (
        <div className="w-0.5 bg-gray-200 flex-1 mt-2" />
       )}
      </div>
      {/* Content */}
      <div className="flex-1 pb-4">
       <p className="text-sm text-gray-800">{activity.description}</p>
       <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{activity.performedBy.name}</span>
        <span>•</span>
        <span>{formatTime(activity.timestamp)}</span>
       </div>
       {activity.previousValue && activity.newValue && (
        <div className="mt-2 flex items-center gap-2 text-xs">
         <span className="px-2 py-0.5 bg-gray-100 rounded line-through text-gray-500">
          {activity.previousValue}
         </span>
         <span className="text-gray-400">{'>'}</span>
         <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
          {activity.newValue}
         </span>
        </div>
       )}
      </div>
     </div>
    );
   })}
  </div>
 );
};

// ==================== Messages Section ====================
interface MessagesSectionProps {
 messages: TicketMessage[];
 onSendMessage: (content: string, isInternal: boolean) => void;
 isLoading?: boolean;
}

const MessagesSection: React.FC<MessagesSectionProps> = ({ 
 messages, 
 onSendMessage,
 isLoading 
}) => {
 const [newMessage, setNewMessage] = useState('');
 const [isInternal, setIsInternal] = useState(false);

 const handleSend = () => {
  if (newMessage.trim()) {
   onSendMessage(newMessage.trim(), isInternal);
   setNewMessage('');
  }
 };

 const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
   month: 'short',
   day: 'numeric',
   hour: 'numeric',
   minute: '2-digit',
   hour12: true,
  });
 };

 return (
  <div className="flex flex-col h-full">
   {/* Messages List */}
   <div className="flex-1 overflow-y-auto space-y-4 mb-4">
    {isLoading ? (
     <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800" />
     </div>
    ) : messages.length === 0 ? (
     <div className="text-center py-8 text-gray-500 text-sm">
      No messages yet
     </div>
    ) : (
     messages.map((msg) => (
      <div
       key={msg.id}
       className={`flex ${msg.senderType === 'staff' ? 'justify-end' : 'justify-start'}`}
      >
       <div
        className={`max-w-[80%] rounded-xl p-4 ${
         msg.isInternal
          ? 'bg-yellow-50 border border-yellow-200'
          : msg.senderType === 'staff'
          ? 'bg-slate-800 text-white'
          : msg.senderType === 'customer'
          ? 'bg-gray-100'
          : 'bg-blue-50 border border-blue-200'
        }`}
       >
        {msg.isInternal && (
         <div className="flex items-center gap-1 text-xs text-yellow-600 mb-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Internal Note
         </div>
        )}
        <p className={`text-sm ${msg.senderType === 'staff' && !msg.isInternal ? 'text-white' : 'text-gray-800'}`}>
         {msg.content}
        </p>
        <div className={`flex items-center justify-between mt-2 text-xs ${
         msg.senderType === 'staff' && !msg.isInternal ? 'text-gray-100' : 'text-gray-500'
        }`}>
         <span>{msg.senderName}</span>
         <span>{formatTime(msg.sentAt)}</span>
        </div>
       </div>
      </div>
     ))
    )}
   </div>

   {/* Message Input */}
   <div className="border-t border-gray-200 pt-4">
    <div className="flex items-center gap-2 mb-2">
     <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
       type="checkbox"
       checked={isInternal}
       onChange={(e) => setIsInternal(e.target.checked)}
       className="w-4 h-4 text-slate-700 border-gray-300 rounded focus:ring-slate-800"
      />
      <span className="text-gray-600">Internal note (not visible to customer)</span>
     </label>
    </div>
    <div className="flex gap-2">
     <textarea
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      aria-label={isInternal ? "Add internal note" : "Type your response"}
      placeholder={isInternal ? "Add internal note..." : "Type your response..."}
      className={`flex-1 px-4 py-3 border rounded-xl resize-none focus:ring-2 focus:ring-slate-800 focus:border-transparent ${
       isInternal ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
      }`}
      rows={3}
     />
     <button
      onClick={handleSend}
      disabled={!newMessage.trim()}
      className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end"
      aria-label="Send message"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
     </button>
    </div>
   </div>
  </div>
 );
};

// ==================== Linked Orders Section ====================
interface LinkedOrdersSectionProps {
 orders: LinkedOrder[];
 onLinkOrder: () => void;
 onUnlinkOrder: (orderId: string) => void;
}

const LinkedOrdersSection: React.FC<LinkedOrdersSectionProps> = ({
 orders,
 onLinkOrder,
 onUnlinkOrder,
}) => {
 const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
   'pending': 'bg-gray-100 text-slate-900',
   'processing': 'bg-blue-100 text-blue-700',
   'shipped': 'bg-purple-100 text-purple-700',
   'delivered': 'bg-emerald-100 text-emerald-700',
   'cancelled': 'bg-red-100 text-red-700',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
 };

 return (
  <div className="space-y-4">
   <div className="flex items-center justify-between">
    <h4 className="font-medium text-gray-800">Linked Orders</h4>
    <button
     onClick={onLinkOrder}
     className="flex items-center gap-1 text-sm text-slate-800 hover:text-slate-900 font-medium"
    >
     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
     </svg>
     Link Order
    </button>
   </div>

   {orders.length === 0 ? (
    <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg">
     No linked orders
    </div>
   ) : (
    <div className="space-y-3">
     {orders.map((order) => (
      <div
       key={order.orderId}
       className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
      >
       <div className="flex-1">
        <div className="flex items-center gap-2">
         <span className="font-mono text-sm font-semibold text-gray-800">
          #{order.orderNumber}
         </span>
         <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
          {order.orderStatus}
         </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
         <span>{new Date(order.orderDate).toLocaleDateString()}</span>
         <span>₹{order.orderTotal.toLocaleString()}</span>
        </div>
        {order.relevance && (
         <p className="text-xs text-gray-500 mt-1">{order.relevance}</p>
        )}
       </div>
       <button
        onClick={() => onUnlinkOrder(order.orderId)}
        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        title="Unlink order"
        aria-label="Unlink order"
       >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
     ))}
    </div>
   )}
  </div>
 );
};

// ==================== Main Ticket Detail Popup ====================
interface TicketDetailPopupProps {
 ticket: Ticket;
 onClose: () => void;
 onUpdate: (updatedTicket: Ticket) => void;
}

const TicketDetailPopup: React.FC<TicketDetailPopupProps> = ({
 ticket,
 onClose,
 onUpdate,
}) => {
 const { user } = useAuth();
 const [activeTab, setActiveTab] = useState<'messages' | 'activity' | 'orders'>('messages');
 const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
 const [activities, setActivities] = useState<TicketActivity[]>(ticket.activities);
 const [messages, setMessages] = useState<TicketMessage[]>(ticket.messages);
 const [loading, setLoading] = useState({ staff: true, activities: false, messages: false });
 const [showResolveModal, setShowResolveModal] = useState(false);
 const [resolutionNotes, setResolutionNotes] = useState('');

 // Load available staff
 useEffect(() => {
  const loadStaff = async () => {
   const result = await fetchAvailableStaff();
   if (result.success && result.data) {
    setAvailableStaff(result.data);
   }
   setLoading(prev => ({ ...prev, staff: false }));
  };
  loadStaff();
 }, []);

 useEffect(() => {
  setActivities(ticket.activities || []);
  setMessages(ticket.messages || []);
 }, [ticket.id, ticket.updatedAt, ticket.activities, ticket.messages]);

 // Load activities and messages
 useEffect(() => {
  const loadData = async () => {
   setLoading(prev => ({ ...prev, activities: true, messages: true }));
   try {
    const res = await api.get<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`);
    const data = res && typeof res === 'object' && 'data' in res ? (res as { data?: Ticket }).data : undefined;
    if (data) {
     if (Array.isArray(data.activities)) setActivities(data.activities);
     if (Array.isArray(data.messages)) setMessages(data.messages);
    }
   } catch {
    // keep ticket prop snapshot
   } finally {
    setLoading(prev => ({ ...prev, activities: false, messages: false }));
   }
  };
  void loadData();
 }, [ticket.id]);

 const handleAssign = useCallback(async (staffId: string) => {
  const staff = availableStaff.find((s) => s.id === staffId);
  if (!staff) return;
  const assignedBy =
   (user?.name && user.name.trim()) || (user?.email && user.email.trim()) || `user:${user?.id ?? 'unknown'}`;
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, {
    current_assignee: {
     staffId: staff.id,
     staffName: staff.name,
     staffEmail: staff.email || '',
     department: staff.department || '',
     assignedAt: new Date().toISOString(),
     assignedBy,
     isActive: true,
    },
   });
   if (res?.success && res.data) onUpdate(res.data);
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate, availableStaff, user?.id, user?.name, user?.email]);

 const handleUnassign = useCallback(async () => {
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, {
    current_assignee: null,
   });
   if (res?.success && res.data) onUpdate(res.data);
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate]);

 const handleStatusChange = useCallback(async (status: TicketStatus) => {
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, { status });
   if (res?.success && res.data) onUpdate(res.data);
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate]);

 const handlePriorityChange = useCallback(async (priority: TicketPriority) => {
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, { priority });
   if (res?.success && res.data) onUpdate(res.data);
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate]);

 const handleSendMessage = useCallback(async (content: string, isInternal: boolean) => {
  try {
   const res = await api.post<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}/messages`, {
    content,
    isInternal,
   });
   if (res?.success && res.data) {
    onUpdate(res.data);
    setMessages(res.data.messages || []);
   }
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate]);

 const handleLinkOrder = useCallback(() => {
  // TODO: Open order search modal
 }, []);

 const handleUnlinkOrder = useCallback(async (_orderId: string) => {
  // TODO: Implement unlink order
 }, []);

 const handleResolve = useCallback(async () => {
  if (!resolutionNotes.trim()) return;
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, {
    status: 'resolved',
    resolution_notes: resolutionNotes.trim(),
    resolved_at: new Date().toISOString(),
   });
   if (res?.success && res.data) {
    onUpdate(res.data);
    setShowResolveModal(false);
   }
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, resolutionNotes, onUpdate]);

 const handleClose = useCallback(async () => {
  try {
   const res = await api.patch<{ success?: boolean; data?: Ticket }>(`/api/v1/enquiries/${ticket.id}`, {
    status: 'closed',
   });
   if (res?.success && res.data) onUpdate(res.data);
  } catch (e) {
   console.error(e);
  }
 }, [ticket.id, onUpdate]);

 return (
  <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
   <div role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title" className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
    {/* Header */}
    <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50/50">
     <div className="flex-1">
      <div className="flex items-center gap-3 mb-2">
       <span className="font-mono text-lg font-bold text-gray-800">
        #{ticket.ticketNumber}
       </span>
       <StatusBadge status={ticket.status} />
       <PriorityBadge priority={ticket.priority} />
       <CategoryBadge category={ticket.category as string} />
       {ticket.isOverdue && (
        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
         OVERDUE
        </span>
       )}
      </div>
      <h2 id="ticket-detail-title" className="text-xl font-semibold text-gray-900">{ticket.subject}</h2>
      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
       <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
       <span>•</span>
       <span>{ticket.responseCount} responses</span>
       {ticket.slaDeadline && (
        <>
         <span>•</span>
         <span className={ticket.isOverdue ? 'text-red-600 font-medium' : ''}>
          SLA: {new Date(ticket.slaDeadline).toLocaleDateString()}
         </span>
        </>
       )}
      </div>
     </div>
     <button
      onClick={onClose}
      className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Close"
     >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-hidden flex">
     {/* Left Panel - Details */}
     <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50/30">
      {/* Customer / reporter */}
      <div className="mb-6">
       <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {ticket.ticketScope === 'internal' ? 'Reporter' : 'Customer'}
       </h4>
       <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-semibold">
          {(ticket.customer?.name || '?').split(' ').map(n => n[0]).join('')}
         </div>
         <div>
          <p className="font-medium text-gray-900">{ticket.customer?.name || '—'}</p>
          {ticket.customer?.company && (
           <p className="text-xs text-gray-500">{ticket.customer.company}</p>
          )}
         </div>
        </div>
        <div className="space-y-2 text-sm">
         <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="truncate">{ticket.customer?.email || '—'}</span>
         </div>
         <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>{ticket.customer?.phone || '—'}</span>
         </div>
        </div>
       </div>
      </div>

      {ticket.ticketScope === 'internal' && ticket.collaboration && (
       <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
         Tags &amp; areas
        </h4>
        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3 text-sm">
         {ticket.collaboration.issueAreas && ticket.collaboration.issueAreas.length > 0 && (
          <div>
           <p className="text-xs font-medium text-gray-500 mb-1">Issue areas</p>
           <div className="flex flex-wrap gap-1.5">
            {ticket.collaboration.issueAreas.map((id) => (
             <span
              key={id}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
               id === 'pis' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
              }`}
             >
              {id === 'pis' ? 'PIS' : id.replace(/-/g, ' ')}
             </span>
            ))}
           </div>
          </div>
         )}
         {ticket.collaboration.taggedTeams && ticket.collaboration.taggedTeams.length > 0 && (
          <div>
           <p className="text-xs font-medium text-gray-500 mb-1">Teams</p>
           <div className="flex flex-wrap gap-1.5">
            {ticket.collaboration.taggedTeams.map((t) => (
             <span key={t.id} className="px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-900 border border-violet-100">
              {t.name || t.id}
             </span>
            ))}
           </div>
          </div>
         )}
         {ticket.collaboration.taggedMembers && ticket.collaboration.taggedMembers.length > 0 && (
          <div>
           <p className="text-xs font-medium text-gray-500 mb-1">Tagged colleagues</p>
           <ul className="space-y-1 text-gray-800">
            {ticket.collaboration.taggedMembers.map((m) => (
             <li key={m.userid}>
              {m.displayName || m.email || `User ${m.userid}`}
              {m.email ? <span className="text-gray-500 text-xs ml-1">({m.email})</span> : null}
             </li>
            ))}
           </ul>
          </div>
         )}
        </div>
       </div>
      )}

      {/* Assignment */}
      <div className="mb-6">
       <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Assigned To
       </h4>
       <StaffAssignmentDropdown
        currentAssignee={ticket.currentAssignee ? {
         staffId: ticket.currentAssignee.staffId,
         staffName: ticket.currentAssignee.staffName,
        } : undefined}
        availableStaff={availableStaff}
        onAssign={handleAssign}
        onUnassign={handleUnassign}
        disabled={loading.staff}
       />
       <p className="text-xs text-gray-500 mt-2">
        Use the menu above to change assignee after creation. Past assignees appear below.
       </p>
      </div>

      {ticket.assignmentHistory && ticket.assignmentHistory.length > 0 && (
       <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
         Assignment history
        </h4>
        <ul className="space-y-2 text-sm">
         {[...ticket.assignmentHistory].reverse().map((entry, idx) => (
          <li
           key={`${entry.staffId}-${entry.endedAt || idx}`}
           className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700"
          >
           <span className="font-medium text-gray-900">{entry.staffName}</span>
           {entry.department ? (
            <span className="text-gray-500"> · {entry.department}</span>
           ) : null}
           <div className="text-xs text-gray-500 mt-1">
            {entry.endedAt
             ? `Until ${new Date(entry.endedAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
               })}`
             : '—'}
            {entry.reason ? ` · ${entry.reason.replace(/-/g, ' ')}` : ''}
            {entry.endedBy ? ` · by ${entry.endedBy}` : ''}
           </div>
          </li>
         ))}
        </ul>
       </div>
      )}

      {/* Status & Priority */}
      <div className="mb-6">
       <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Status & Priority
       </h4>
       <div className="space-y-3">
        <div className="flex items-center justify-between">
         <span className="text-sm text-gray-600">Status</span>
         <StatusDropdown
          currentStatus={ticket.status}
          onStatusChange={handleStatusChange}
         />
        </div>
        <div className="flex items-center justify-between">
         <span className="text-sm text-gray-600">Priority</span>
         <PriorityDropdown
          currentPriority={ticket.priority}
          onPriorityChange={handlePriorityChange}
         />
        </div>
       </div>
      </div>

      {/* Description */}
      <div className="mb-6">
       <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Description
       </h4>
       <div className="bg-white rounded-lg p-4 border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
        {ticket.description}
       </div>
      </div>

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
       <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
         Tags
        </h4>
        <div className="flex flex-wrap gap-2">
         {ticket.tags.map((tag, index) => (
          <span
           key={index}
           className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
          >
           {tag}
          </span>
         ))}
        </div>
       </div>
      )}
     </div>

     {/* Right Panel - Tabs */}
     <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
       {[
        { id: 'messages', label: 'Messages', count: messages.length },
        { id: 'activity', label: 'Activity', count: activities.length },
        { id: 'orders', label: 'Linked Orders', count: ticket.linkedOrders?.length ?? 0 },
       ].map((tab) => (
        <button
         key={tab.id}
         onClick={() => setActiveTab(tab.id as typeof activeTab)}
         className={`px-6 py-4 text-sm font-medium transition-colors relative ${
          activeTab === tab.id
           ? 'text-slate-800 border-b-2 border-slate-800'
           : 'text-gray-500 hover:text-gray-700'
         }`}
        >
         {tab.label}
         {tab.count > 0 && (
          <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
           activeTab === tab.id ? 'bg-gray-100 text-slate-900' : 'bg-gray-100 text-gray-600'
          }`}>
           {tab.count}
          </span>
         )}
        </button>
       ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
       {activeTab === 'messages' && (
        <MessagesSection
         messages={messages}
         onSendMessage={handleSendMessage}
         isLoading={loading.messages}
        />
       )}
       {activeTab === 'activity' && (
        <ActivityTimeline
         activities={activities}
         isLoading={loading.activities}
        />
       )}
       {activeTab === 'orders' && (
        <LinkedOrdersSection
         orders={ticket.linkedOrders ?? []}
         onLinkOrder={handleLinkOrder}
         onUnlinkOrder={handleUnlinkOrder}
        />
       )}
      </div>
     </div>
    </div>

    {/* Footer Actions */}
    <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50/50">
     <div className="flex items-center gap-2">
      {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
       <button
        onClick={() => setShowResolveModal(true)}
        className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
       >
        Mark Resolved
       </button>
      )}
      {ticket.status === 'resolved' && (
       <button
        onClick={handleClose}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
       >
        Close Ticket
       </button>
      )}
     </div>
     <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
     >
      Close
     </button>
    </div>
   </div>

   {/* Resolve Modal */}
   {showResolveModal && (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-60">
     <div role="dialog" aria-modal="true" aria-labelledby="resolve-ticket-title" className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h3 id="resolve-ticket-title" className="text-lg font-semibold text-gray-900 mb-4">Resolve Ticket</h3>
      <p className="text-sm text-gray-600 mb-4">
       Please provide resolution notes for this ticket.
      </p>
      <textarea
       value={resolutionNotes}
       onChange={(e) => setResolutionNotes(e.target.value)}
       aria-label="Resolution notes"
       placeholder="Describe how the issue was resolved..."
       className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
       rows={4}
      />
      <div className="flex justify-end gap-3 mt-4">
       <button
        onClick={() => setShowResolveModal(false)}
        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
       >
        Cancel
       </button>
       <button
        onClick={handleResolve}
        disabled={!resolutionNotes.trim()}
        className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
       >
        Resolve
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
};

export default TicketDetailPopup;
