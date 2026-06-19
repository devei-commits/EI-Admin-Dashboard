/**
 * Order Fulfillment Utilities
 * Helper functions for calculations, formatting, and business logic
 */

import type { SaleOrder, SOProgress, BatchSplit, SOStatus } from '../types/orderFulfillment';
import { DATE_FORMAT_OPTIONS } from '../constants/orderFulfillment';
import { computeOrderItemExecutionPercent } from '../lib/fulfillmentExecutionPct';

// ═══════════════════════════════════════════════════════════
// DATE UTILITIES
// ═══════════════════════════════════════════════════════════

export const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', DATE_FORMAT_OPTIONS);
  } catch {
    return '—';
  }
};

export const addDays = (dateString: string, days: number): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const getDaysLeft = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDaysLeft = (daysLeft: number | null): {
  text: string;
  color: string;
} => {
  if (daysLeft === null) {
    return { text: '—', color: 'text-gray-400' };
  }
  if (daysLeft < 0) {
    return { 
      text: `${Math.abs(daysLeft)}d OVERDUE`, 
      color: 'text-red-600' 
    };
  }
  if (daysLeft === 0) {
    return { text: 'Due Today', color: 'text-red-600' };
  }
  if (daysLeft < 7) {
    return { text: `${daysLeft}d left`, color: 'text-red-600' };
  }
  if (daysLeft < 14) {
    return { text: `${daysLeft}d left`, color: 'text-amber-600' };
  }
  return { text: `${daysLeft}d left`, color: 'text-gray-500' };
};

export const getTodayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};

// ═══════════════════════════════════════════════════════════
// NUMBER FORMATTING
// ═══════════════════════════════════════════════════════════

export const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '—';
  return Number(num).toLocaleString('en-IN');
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '₹0';
  return `₹${formatNumber(amount)}`;
};

// Alias for Indian Rupees formatting
export const formatINR = formatCurrency;

export const formatLakhs = (amount: number): string => {
  return `₹${(amount / 100000).toFixed(1)}L`;
};

/** True when pack size is present and not a UI placeholder. */
export const isValidPackSize = (pack: string | null | undefined): boolean => {
  const p = String(pack ?? '').trim();
  if (!p) return false;
  if (p === '0') return true;
  const lower = p.toLowerCase();
  return lower !== '—' && lower !== '-' && lower !== 'n/a' && lower !== 'na';
};

export const normalizePackSize = (pack: string | null | undefined): string =>
  isValidPackSize(pack) ? String(pack).trim() : '';

// ═══════════════════════════════════════════════════════════
// SALE ORDER CALCULATIONS
// ═══════════════════════════════════════════════════════════

export const calculateSOProgress = (saleOrder: SaleOrder): SOProgress => {
  let total = 0;
  let ready = 0;
  let shipped = 0;
  let batchesTotal = 0;
  let batchesDone = 0;

  saleOrder.items.forEach(item => {
    total += item.orderedQty;
    item.batchSplits.forEach(split => {
      batchesTotal += 1;
      if (split.ffStatus === 'closed') batchesDone += 1;
      // FG Ready = in warehouse, not yet shipped (exclude shipped/delivered/closed so we don't double-count)
      if (['fg_ready', 'picking', 'invoiced'].includes(split.ffStatus)) {
        ready += split.fgQty || 0;
      }
      // Shipped = dispatched or delivered/closed
      if (['shipped', 'delivered', 'closed'].includes(split.ffStatus)) {
        shipped += split.fgQty || 0;
      }
    });
  });

  const readyPct = total > 0 ? Math.min(100, Math.round((ready / total) * 100)) : 0;
  const shippedPct = total > 0 ? Math.min(100, Math.round((shipped / total) * 100)) : 0;
  const batchesDonePct = batchesTotal > 0 ? Math.min(100, Math.round((batchesDone / batchesTotal) * 100)) : 0;

  let lifecycleNum = 0;
  let lifecycleDen = 0;
  for (const item of saleOrder.items) {
    const w = Math.max(0, item.orderedQty);
    if (w <= 0) continue;
    lifecycleDen += w;
    lifecycleNum += w * (computeOrderItemExecutionPercent(item, null) / 100);
  }
  const fulfillmentLifecyclePct =
    lifecycleDen > 0 ? Math.min(100, Math.round((lifecycleNum / lifecycleDen) * 100)) : 0;

  return {
    total,
    ready,
    shipped,
    readyPct,
    shippedPct,
    batchesDone,
    batchesTotal,
    batchesDonePct,
    fulfillmentLifecyclePct,
  };
};

export const calculateOrderValue = (saleOrder: SaleOrder): number => {
  return saleOrder.items.reduce((sum, item) => {
    return sum + (item.orderedQty * item.unitPrice);
  }, 0);
};

export const calculateInvoiceSubtotal = (splits: Array<{ split: BatchSplit; item: any }>): number => {
  return splits.reduce((sum, { split, item }) => {
    const qty = split.pickedQty || split.fgQty;
    return sum + (qty * item.unitPrice);
  }, 0);
};

export const calculateGST = (subtotal: number, rate: number = 0.18): number => {
  return Math.round(subtotal * rate);
};

// ═══════════════════════════════════════════════════════════
// STATUS RECALCULATION
// ═══════════════════════════════════════════════════════════

export const recalculateSOStatus = (saleOrder: SaleOrder): SOStatus => {
  const allSplits = saleOrder.items.flatMap(item => item.batchSplits);
  const splitsWithFG = allSplits.filter(s => s.fgQty > 0);

  // Check if all FG splits are closed/delivered
  if (splitsWithFG.length > 0 && splitsWithFG.every(s => ['delivered', 'closed'].includes(s.ffStatus))) {
    return 'closed';
  }

  // Check for shipped/delivered splits
  if (allSplits.some(s => s.ffStatus === 'shipped' || s.ffStatus === 'delivered')) {
    return 'shipped';
  }

  // Check for invoiced splits
  if (allSplits.some(s => s.ffStatus === 'invoiced')) {
    return 'invoiced';
  }

  // Check for picking splits
  if (allSplits.some(s => s.ffStatus === 'picking')) {
    return 'picking';
  }

  // Check for FG ready
  if (allSplits.some(s => s.ffStatus === 'fg_ready')) {
    // If all FG splits are ready, status is fg_ready, otherwise partial
    return splitsWithFG.every(s => s.ffStatus === 'fg_ready') ? 'fg_ready' : 'partial';
  }

  // Check for production stages
  if (allSplits.some(s => ['bulk_qc', 'fg_pending'].includes(s.ffStatus))) {
    return 'in_production';
  }

  return 'planned';
};

// ═══════════════════════════════════════════════════════════
// FILTERING & SEARCH
// ═══════════════════════════════════════════════════════════

export const filterSaleOrders = (
  orders: SaleOrder[],
  filter: string,
  searchTerm: string
): SaleOrder[] => {
  let filtered = [...orders];

  // Apply status filter
  if (filter !== 'all') {
    filtered = filtered.filter(so => {
      if (filter === 'fg_ready') {
        return ['fg_ready', 'partial'].includes(so.soStatus);
      }
      return so.soStatus === filter;
    });
  }

  // Apply search
  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(so => 
      so.soNo.toLowerCase().includes(search) ||
      so.customer.toLowerCase().includes(search) ||
      so.items.some(item => 
        item.productName.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search)
      )
    );
  }

  return filtered;
};

export const filterBatchSplits = (
  orders: SaleOrder[],
  filter: string,
  searchTerm: string
): Array<{ so: SaleOrder; item: any; split: BatchSplit }> => {
  const rows: Array<{ so: SaleOrder; item: any; split: BatchSplit }> = [];

  orders.forEach(so => {
    so.items.forEach(item => {
      item.batchSplits.forEach(split => {
        // Apply status filter
        if (filter !== 'all' && split.ffStatus !== filter) {
          return;
        }

        // Apply search
        if (searchTerm.trim()) {
          const search = searchTerm.toLowerCase();
          if (
            !item.productName.toLowerCase().includes(search) &&
            !split.bprNo.toLowerCase().includes(search) &&
            !so.soNo.toLowerCase().includes(search) &&
            !so.customer.toLowerCase().includes(search) &&
            !item.sku.toLowerCase().includes(search)
          ) {
            return;
          }
        }

        rows.push({ so, item, split });
      });
    });
  });

  return rows;
};

// ═══════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════

export const validateSONumber = (soNo: string, existingOrders: SaleOrder[]): string | null => {
  if (!soNo.trim()) {
    return 'SO Number is required';
  }
  if (existingOrders.some(so => so.soNo === soNo)) {
    return 'SO Number already exists';
  }
  return null;
};

export const validatePickData = (splits: any[]): string | null => {
  if (!splits || splits.length === 0) {
    return 'No splits available to pick';
  }
  return null;
};

export const validateInvoiceData = (courier: string): string | null => {
  if (!courier || !courier.trim()) {
    return 'Please select a courier';
  }
  return null;
};

export const validateShipData = (courier: string, awbNo: string): string | null => {
  if (!courier || !courier.trim()) {
    return 'Please select a courier';
  }
  if (!awbNo || !awbNo.trim()) {
    return 'AWB/LR number is required';
  }
  return null;
};

// ═══════════════════════════════════════════════════════════
// AGGREGATION
// ═══════════════════════════════════════════════════════════

export const aggregateKPIs = (orders: SaleOrder[]) => {
  const total = orders.length;
  const inProduction = orders.filter(so => ['in_production', 'planned'].includes(so.soStatus)).length;
  const partial = orders.filter(so => ['partial', 'fg_ready'].includes(so.soStatus)).length;
  const shipped = orders.filter(so => ['shipped', 'invoiced'].includes(so.soStatus)).length;
  const closed = orders.filter(so => ['closed', 'delivered'].includes(so.soStatus)).length;

  const allSplits = orders.flatMap(so => so.items.flatMap(item => item.batchSplits));
  const fgReadySplits = allSplits.filter(sp => sp.ffStatus === 'fg_ready').length;

  const totalValue = orders.reduce((sum, so) => sum + calculateOrderValue(so), 0);
  const pendingValue = orders
    .filter(so => !['closed', 'delivered'].includes(so.soStatus))
    .reduce((sum, so) => sum + calculateOrderValue(so), 0);

  return {
    total,
    inProduction,
    partial,
    shipped,
    closed,
    fgReadySplits,
    totalValue,
    pendingValue
  };
};

export const aggregatePipelineCounts = (orders: SaleOrder[]): Record<SOStatus, number> => {
  const counts: Record<string, number> = {};
  orders.forEach(so => {
    counts[so.soStatus] = (counts[so.soStatus] || 0) + 1;
  });
  return counts as Record<SOStatus, number>;
};
