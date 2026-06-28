/**
 * Order Fulfillment Constants
 * Static configuration and lookup data
 */

import {
  Package,
  CheckCircle,
  Hand,
  FileText,
  Truck,
  MapPin,
  Lock,
  AlertCircle,
  Clock,
  TestTube,
  Zap,
  ShoppingCart,
  Settings,
  PauseCircle,
  ReceiptText,
  Search,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type { FFStatus, SOStatus, CommercialStatus } from '../types/orderFulfillment';

// ═══════════════════════════════════════════════════════════
// FG LOCATIONS & COURIERS
// ═══════════════════════════════════════════════════════════

export const FG_LOCATIONS = [
  'FG-A01', 'FG-A02', 'FG-A03',
  'FG-B01', 'FG-B02',
  'FG-C01', 'FG-C02', 'FG-C03'
] as const;

export const COURIERS = [
  'BlueDart Express',
  'Delhivery',
  'FedEx India',
  'DTDC',
  'Ecom Express',
  'Direct Dispatch'
] as const;

export const PAYMENT_TERMS = [
  'Net 30',
  'Net 45',
  'Net 60',
  'Advance',
  'COD'
] as const;

// ═══════════════════════════════════════════════════════════
// STATUS CONFIGURATIONS
// ═══════════════════════════════════════════════════════════

export const FF_STATUS_CONFIG: Record<FFStatus, {
  label: string;
  icon: typeof Package;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  fg_pending: {
    label: 'Pending FG',
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20'
  },
  wip: {
    label: 'Work in Progress',
    icon: Settings,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  bulk_qc: {
    label: 'Bulk QC',
    icon: TestTube,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20'
  },
  fg_ready: {
    label: 'FG Ready',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20'
  },
  picking: {
    label: 'Picking',
    icon: Hand,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20'
  },
  invoiced: {
    label: 'Invoiced',
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  shipped: {
    label: 'Shipped',
    icon: Truck,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  delivered: {
    label: 'Delivered',
    icon: MapPin,
    color: 'text-teal-600',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20'
  },
  closed: {
    label: 'Closed',
    icon: Lock,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20'
  }
};

export const SO_STATUS_CONFIG: Record<SOStatus, {
  label: string;
  icon: typeof Package;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  planned: {
    label: 'Planned',
    icon: ShoppingCart,
    color: 'text-gray-600',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20'
  },
  SO_New: {
    label: 'New',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  SO_Pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20'
  },
  SO_InProd: {
    label: 'In Production',
    icon: Settings,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  SO_ReadyShip: {
    label: 'Ready to Ship',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20'
  },
  SO_Shipped: {
    label: 'Shipped',
    icon: Truck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  SO_Fulfilled: {
    label: 'Fulfilled',
    icon: CheckCircle,
    color: 'text-teal-600',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20'
  },
  in_production: {
    label: 'In Production',
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  partial: {
    label: 'Partial FG',
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20'
  },
  fg_ready: {
    label: 'FG Ready',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20'
  },
  picking: {
    label: 'Picking',
    icon: Hand,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20'
  },
  invoiced: {
    label: 'Invoiced',
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  shipped: {
    label: 'Shipped',
    icon: Truck,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  delivered: {
    label: 'Delivered',
    icon: MapPin,
    color: 'text-teal-600',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20'
  },
  closed: {
    label: 'SO Closed',
    icon: Lock,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20'
  }
};

// ═══════════════════════════════════════════════════════════
// PIPELINE STAGES
// ═══════════════════════════════════════════════════════════

export const PIPELINE_STAGES = [
  { key: 'in_production' as SOStatus, label: 'Production', icon: AlertCircle },
  { key: 'partial' as SOStatus, label: 'FG Partial', icon: Zap },
  { key: 'fg_ready' as SOStatus, label: 'FG Ready', icon: CheckCircle },
  { key: 'picking' as SOStatus, label: 'Picking', icon: Hand },
  { key: 'invoiced' as SOStatus, label: 'Invoiced', icon: FileText },
  { key: 'shipped' as SOStatus, label: 'Shipped', icon: Truck },
  { key: 'delivered' as SOStatus, label: 'Delivered', icon: MapPin },
  { key: 'closed' as SOStatus, label: 'Closed', icon: Lock }
];

// ═══════════════════════════════════════════════════════════
// FILTER CHIPS CONFIG
// ═══════════════════════════════════════════════════════════

export const SO_FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'fg_ready', label: 'FG Ready', icon: CheckCircle },
  { key: 'picking', label: 'Picking', icon: Package },
  { key: 'invoiced', label: 'Invoiced', icon: FileText },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
  { key: 'closed', label: 'Closed', icon: Lock },
  { key: 'in_production', label: 'Production', icon: AlertCircle }
];

export const BATCH_FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'fg_ready', label: 'FG Ready', icon: CheckCircle },
  { key: 'picking', label: 'Picking', icon: Package },
  { key: 'invoiced', label: 'Invoiced', icon: FileText },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'closed', label: 'Closed', icon: Lock },
  { key: 'fg_pending', label: 'Pending', icon: Clock }
];

// ═══════════════════════════════════════════════════════════
// UTILITY CONSTANTS
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// COMMERCIAL STATUS CONFIG
// ═══════════════════════════════════════════════════════════

export const COMMERCIAL_STATUS_CONFIG: Record<CommercialStatus, {
  label: string;
  icon: typeof Package;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
  },
  received: {
    label: 'Received',
    icon: ReceiptText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  advance_pending: {
    label: 'Advance Pending',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  under_review: {
    label: 'Under Review',
    icon: Search,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  approved: {
    label: 'Approved',
    icon: ThumbsUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  partial_closed: {
    label: 'Partial Closed',
    icon: Zap,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  closed: {
    label: 'Closed',
    icon: XCircle,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  on_hold: {
    label: 'On Hold',
    icon: PauseCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

export const COMMERCIAL_STATUS_FILTER_OPTIONS: { key: CommercialStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Statuses' },
  { key: 'received', label: 'Received' },
  { key: 'advance_pending', label: 'Advance Pending' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'partial_closed', label: 'Partial Closed' },
  { key: 'closed', label: 'Closed' },
  { key: 'on_hold', label: 'On Hold' },
];

export const BATCH_STAGE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Stages' },
  { key: 'PLANNING', label: 'Planning' },
  { key: 'PROCUREMENT', label: 'Procurement' },
  { key: 'PRODUCTION', label: 'Production' },
  { key: 'FG_READY', label: 'FG Ready' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'INVOICED', label: 'Invoiced' },
  { key: 'SHIPPED', label: 'Shipped' },
];

export const GST_RATE = 0.18; // 18% GST

export const DEFAULT_DISPATCH_DAYS = 3; // Default ETA days after dispatch

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
};
