/**
 * Ticket/Enquiry Management Types
 * Comprehensive type definitions for enquiry management, staff assignment, and order tracking
 */

// ==================== Ticket Status & Priority ====================
export type TicketStatus = 
 | 'new' 
 | 'open' 
 | 'in-progress' 
 | 'pending-customer' 
 | 'pending-internal' 
 | 'resolved' 
 | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketCategory = 
 | 'general-inquiry' 
 | 'product-inquiry' 
 | 'order-issue' 
 | 'payment-issue' 
 | 'delivery-issue' 
 | 'complaint' 
 | 'feedback' 
 | 'technical-support' 
 | 'quotation-request' 
 | 'partnership' 
 | 'other';

export type TicketSource = 'website' | 'email' | 'phone' | 'whatsapp' | 'walk-in' | 'referral';

// ==================== Staff Types ====================
export interface StaffMember {
 id: string;
 name: string;
 email: string;
 phone?: string;
 department: string;
 role: string;
 avatar?: string;
 isAvailable: boolean;
 activeTicketCount: number;
 maxTicketCapacity: number;
}

export interface StaffAssignment {
 staffId: string;
 staffName: string;
 staffEmail: string;
 department: string;
 assignedAt: string;
 assignedBy: string;
 isActive: boolean;
 notes?: string;
}

// ==================== Activity & Timeline ====================
export type ActivityType = 
 | 'created' 
 | 'assigned' 
 | 'reassigned' 
 | 'status-change' 
 | 'priority-change' 
 | 'note-added' 
 | 'response-sent' 
 | 'customer-replied' 
 | 'escalated' 
 | 'order-linked' 
 | 'attachment-added' 
 | 'resolved' 
 | 'reopened' 
 | 'closed';

export interface TicketActivity {
 id: string;
 ticketId: string;
 type: ActivityType;
 description: string;
 performedBy: {
  id: string;
  name: string;
  role: string;
 };
 timestamp: string;
 metadata?: Record<string, unknown>;
 previousValue?: string;
 newValue?: string;
}

// ==================== Communication ====================
export interface TicketMessage {
 id: string;
 ticketId: string;
 senderId: string;
 senderName: string;
 senderType: 'staff' | 'customer' | 'system';
 content: string;
 attachments?: Attachment[];
 sentAt: string;
 readAt?: string;
 isInternal: boolean;
}

export interface Attachment {
 id: string;
 fileName: string;
 fileType: string;
 fileSize: number;
 url: string;
 uploadedAt: string;
 uploadedBy: string;
}

// ==================== Order Tracking ====================
export interface LinkedOrder {
 orderId: string;
 orderNumber: string;
 orderDate: string;
 orderStatus: string;
 orderTotal: number;
 productName?: string;
 linkedAt: string;
 linkedBy: string;
 relevance?: string;
}

// ==================== Main Ticket Interface ====================
export interface Ticket {
 id: string;
 ticketNumber: string;
 
 // Customer Information
 customer: {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  isRegistered: boolean;
 };
 
 // Ticket Details
 subject: string;
 description: string;
 category: TicketCategory;
 priority: TicketPriority;
 status: TicketStatus;
 source: TicketSource;
 tags?: string[];
 
 // Assignment
 currentAssignee?: StaffAssignment;
 assignmentHistory: StaffAssignment[];
 department?: string;
 
 // Order Tracking
 linkedOrders: LinkedOrder[];
 
 // Communication
 messages: TicketMessage[];
 lastResponseAt?: string;
 responseCount: number;
 
 // Activity
 activities: TicketActivity[];
 
 // Timestamps
 createdAt: string;
 updatedAt: string;
 firstResponseAt?: string;
 resolvedAt?: string;
 closedAt?: string;
 
 // SLA
 slaDeadline?: string;
 isOverdue: boolean;
 
 // Resolution
 resolutionNotes?: string;
 satisfactionRating?: number;
 satisfactionFeedback?: string;
}

// ==================== Dashboard Statistics ====================
export interface TicketDashboardStats {
 // Overview
 totalTickets: number;
 openTickets: number;
 closedToday: number;
 avgResolutionTime: number; // in hours
 
 // By Status
 byStatus: {
  new: number;
  open: number;
  inProgress: number;
  pendingCustomer: number;
  pendingInternal: number;
  resolved: number;
  closed: number;
 };
 
 // By Priority
 byPriority: {
  low: number;
  medium: number;
  high: number;
  urgent: number;
 };
 
 // By Category
 byCategory: Record<TicketCategory, number>;
 
 // Staff Performance
 staffMetrics: StaffPerformanceMetrics[];
 
 // Trends
 ticketTrend: {
  date: string;
  created: number;
  resolved: number;
 }[];
 
 // SLA Metrics
 slaMetrics: {
  onTime: number;
  breached: number;
  atRisk: number;
 };
 
 // Response Metrics
 responseMetrics: {
  avgFirstResponseTime: number; // in minutes
  avgResponseTime: number;
  avgResolutionTime: number;
 };
}

export interface StaffPerformanceMetrics {
 staffId: string;
 staffName: string;
 department: string;
 activeTickets: number;
 resolvedToday: number;
 resolvedThisWeek: number;
 avgResolutionTime: number;
 avgResponseTime: number;
 satisfactionScore: number;
 overdueTickets: number;
}

// ==================== Filter & Query Types ====================
export interface TicketFilters {
 status?: TicketStatus[];
 priority?: TicketPriority[];
 category?: TicketCategory[];
 assigneeId?: string;
 department?: string;
 dateFrom?: string;
 dateTo?: string;
 isOverdue?: boolean;
 hasLinkedOrders?: boolean;
 searchTerm?: string;
 source?: TicketSource[];
}

export interface TicketSortConfig {
 field: keyof Ticket | 'customerName' | 'assigneeName';
 direction: 'asc' | 'desc';
}

// ==================== Action Payloads ====================
export interface CreateTicketPayload {
 customer: {
  name: string;
  email: string;
  phone: string;
  company?: string;
 };
 subject: string;
 description: string;
 category: TicketCategory;
 priority?: TicketPriority;
 source: TicketSource;
 assigneeId?: string;
 department?: string;
 tags?: string[];
}

export interface UpdateTicketPayload {
 subject?: string;
 description?: string;
 category?: TicketCategory;
 priority?: TicketPriority;
 status?: TicketStatus;
 tags?: string[];
 department?: string;
}

export interface AssignTicketPayload {
 ticketId: string;
 staffId: string;
 notes?: string;
}

export interface AddMessagePayload {
 ticketId: string;
 content: string;
 isInternal: boolean;
 attachments?: File[];
}

export interface LinkOrderPayload {
 ticketId: string;
 orderId: string;
 relevance?: string;
}

export interface ResolveTicketPayload {
 ticketId: string;
 resolutionNotes: string;
}

// ==================== Notification Types ====================
export interface TicketNotification {
 id: string;
 ticketId: string;
 ticketNumber: string;
 type: 'new-ticket' | 'assigned' | 'response' | 'escalation' | 'sla-warning' | 'overdue';
 title: string;
 message: string;
 timestamp: string;
 isRead: boolean;
 recipientId: string;
}
