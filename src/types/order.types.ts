/**
 * Order-related type definitions
 * Used across Order Management and related components
 */

// ==================== Order Status Types ====================
export type OrderStatus = 
 | 'Pending' 
 | 'Processing' 
 | 'Approved' 
 | 'Packaging' 
 | 'Shipped' 
 | 'Delivered' 
 | 'Rejected' 
 | 'Cancelled';

export type OrderPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type StageStatus = 'pending' | 'in-progress' | 'completed';

export type BOMStatus = 'PENDING' | 'APPROVED' | 'IN_STOCK' | 'ORDERED';

export type ReceivingStatus = 'Pending' | 'Completed' | 'Rejected';

export type ItemCondition = 'Good' | 'Damaged' | 'Partial';

// ==================== Order Interfaces ====================
export interface Product {
 id: string;
 name: string;
 quantity: number;
 unitPrice: number;
 total: number;
}

export interface StatusHistory {
 status: string;
 timestamp: string;
 changedBy: string;
 notes?: string;
}

export interface Order {
 orderId: string;
 companyName: string;
 doctorClinicAddress: string;
 dateRegistered: string;
 orderStatus: OrderStatus;
 productType: string;
 quantity: number;
 totalAmount: number;
 priority: OrderPriority;
 products?: Product[];
 statusHistory?: StatusHistory[];
 notes?: string;
 contactPerson?: string;
 contactEmail?: string;
 contactPhone?: string;
 cancellationReason?: string;
}

// ==================== BOM Types ====================
export interface BOMItem {
 id: string;
 orderNo: string;
 itemName: string;
 componentName: string;
 quantity: number;
 unit: string;
 supplier: string;
 unitCost: number;
 totalCost: number;
 status: BOMStatus;
}

// ==================== Good Receiving Types ====================
export interface ReceivedItem {
 id: string;
 itemName: string;
 orderedQty: number;
 receivedQty: number;
 unit: string;
 condition: ItemCondition;
 notes: string;
}

export interface GoodReceivingRecord {
 id: string;
 grNumber: string;
 orderId: string;
 supplierName: string;
 receivedDate: string;
 receivedBy: string;
 invoiceNumber: string;
 totalItems: number;
 status: ReceivingStatus;
 items: ReceivedItem[];
 remarks?: string;
 createdAt: string;
}

// ==================== Audit Types ====================
export interface AuditLog {
 id: string;
 orderId: string;
 timestamp: string;
 user: string;
 action: string;
 field: string;
 oldValue: string;
 newValue: string;
}

// ==================== Filter Types ====================
export interface OrderFilter {
 searchTerm: string;
 statusFilter: string;
 productTypeFilter: string;
 dateFrom: string;
 dateTo: string;
 priorityFilter: string;
}

export interface SavedFilter {
 id: string;
 name: string;
 filters: OrderFilter;
}

// ==================== Team Types ====================
export interface TeamMember {
 id: string;
 name: string;
 role: string;
 email: string;
 phone?: string;
 avatar?: string;
}

export interface Team {
 id: string;
 name: string;
 code: string;
 lead: TeamMember;
 members: TeamMember[];
 color: string;
}
