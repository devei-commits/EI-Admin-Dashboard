/**
 * OrderFulfillment Component
 * Main container for order fulfillment management
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Package, Search, Loader2, LayoutDashboard, ArrowUpDown } from 'lucide-react';
import { SaleOrdersView } from '../components/orders/SaleOrdersView';
import { ProductsBatchesView } from '../components/orders/ProductsBatchesView';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData } from '../types/orderFulfillment';
import { normalizePackSize } from '../utils/orderFulfillmentUtils';
import { recalculateSOStatus } from '../utils/orderFulfillmentUtils';
import {
  fetchFulfillmentOrders,
  createFulfillmentOrder,
  updateFulfillmentOrder,
  pickFulfillmentSplits,
  shipFulfillmentSplits,
  deliverFulfillmentSplits,
} from '../services/fulfillment.service';
import { importOpenSoHeadersExcel } from '../services/salesPurchase.service';
import { createRworkBatch, fetchBatches } from '../services/production.service';
import { Modal } from '../components/orders/Modal';
import { useToast } from '../context/ToastContext';
import AdminMainMenuButton from '../components/AdminMainMenuButton';
import { DateRangeFilterInputs } from '../components/DateRangeFilterInputs';
import { matchesDateRangeFilter } from '../utils/dateRangeFilter';

type ViewMode = 'orders' | 'batches';
type SortKey = 'dueDate' | 'orderDate' | 'customer' | 'soNo' | 'soValue';
type SortOrder = 'asc' | 'desc';

export const OrderFulfillment: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleOrder['soStatus']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'normal' | 'high'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYield, setSelectedYield] = useState<{
    bmrNo: string;
    bprNo: string;
    productName: string;
    soNo: string;
    plannedQty: number;
    bmrYieldKg: number;
    bprBulkUnits: number;
    actualOutputUnits: number;
    bmrWasteKg: number;
    bprWasteUnits: number;
    overallWasteUnits: number;
    bmrYieldPct: number;
    completionPercent: number;
  } | null>(null);
  const [reworkSoInput, setReworkSoInput] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [reworkQtyInput, setReworkQtyInput] = useState('');
  const [reworkBatchSizeKgInput, setReworkBatchSizeKgInput] = useState('');
  const [reworkSubmitting, setReworkSubmitting] = useState(false);
  const salesOrderExcelInputRef = useRef<HTMLInputElement>(null);
  const [importingSalesOrders, setImportingSalesOrders] = useState(false);
  const [deepLinkSoNo, setDeepLinkSoNo] = useState<string | null>(null);
  const [batchesDeepLinkSearch, setBatchesDeepLinkSearch] = useState('');
  const [batchesDeepLinkBmr, setBatchesDeepLinkBmr] = useState<string | null>(null);

  useEffect(() => {
    const so = searchParams.get('so')?.trim();
    const view = searchParams.get('view')?.trim();
    const bmr = searchParams.get('bmr')?.trim();
    if (view === 'batches') {
      setViewMode('batches');
      if (so) setBatchesDeepLinkSearch(so);
      else if (bmr) setBatchesDeepLinkSearch(bmr);
      if (bmr) setBatchesDeepLinkBmr(bmr);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('view');
        next.delete('bmr');
        if (so) next.delete('so');
        return next;
      }, { replace: true });
      return;
    }
    if (!so) return;
    setViewMode('orders');
    setSearchTerm(so);
    setDeepLinkSoNo(so);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('so');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const orders = await fetchFulfillmentOrders();
      setSaleOrders(orders);
    } catch (err) {
      console.error('Failed to load fulfillment orders:', err);
      setError('Failed to load fulfillment orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleAddSO = async (data: AddSOData) => {
    try {
      const rawItems = data.items ?? (data.item ? [data.item] : []);

      const payload = {
        soNo: data.soNo,
        customer: data.customer,
        customerCity: data.customerCity,
        orderDate: data.orderDate,
        dueDate: data.dueDate,
        priority: data.priority,
        shipAddress: data.shipAddress,
        paymentTerms: data.paymentTerms,
        notes: data.notes || '',
        items: rawItems.map((item, idx) => ({
          itemNo: String(idx + 1).padStart(3, '0'),
          sku: item.sku,
          productName: item.productName,
          pack: normalizePackSize(item.pack),
          orderedQty: item.orderedQty,
          unitPrice: item.unitPrice,
          batchSplits: [{
            bmrNo: item.bmrNo || null,
            bprNo: null,
            plannedQty: item.orderedQty,
            fgQty: 0,
            ffStatus: 'fg_pending',
          }],
        })),
      };

      await createFulfillmentOrder(payload);
      await loadOrders();
    } catch (err) {
      console.error('Failed to create sale order:', err);
    }
  };

  const handleSalesOrderExcelChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingSalesOrders(true);
    try {
      const res = await importOpenSoHeadersExcel(file, { details: true });
      const summary = res.summary;
      if (!res.ok) {
        addToast('error', res.error ?? 'Sales order import failed');
        return;
      }
      addToast(
        'success',
        `Sales orders imported: ${summary?.sales_orders_created ?? 0} created, ${summary?.sales_orders_updated ?? 0} updated, ${res.rows_imported ?? res.rows_total ?? 0} rows`
      );
      if ((summary?.errors ?? 0) > 0 && Array.isArray(res.row_log) && res.row_log.length > 0) {
        const sampleErrors = res.row_log
          .filter((r) => r.action === 'error')
          .slice(0, 3)
          .map((r) => `row ${r.excel_row}: ${r.reason ?? r.action}`)
          .join('; ');
        if (sampleErrors) addToast('warning', `Import issues: ${sampleErrors}`);
      }
      await loadOrders();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Sales order import failed');
    } finally {
      setImportingSalesOrders(false);
    }
  };

  const findOrderId = (soNo: string): number | null => {
    const order = saleOrders.find(so => so.soNo === soNo);
    return (order as any)?.id ?? null;
  };

  const handlePickConfirm = async (soNo: string, data: PickData): Promise<SaleOrder | void> => {
    const id = findOrderId(soNo);
    if (!id) return;
    try {
      await pickFulfillmentSplits(id, data);
      const orders = await fetchFulfillmentOrders();
      setSaleOrders(orders);
      return orders.find((o) => o.soNo === soNo) ?? undefined;
    } catch (err) {
      console.error('Failed to pick:', err);
      throw err;
    }
  };

  const handleUpdateSO = async (
    soNo: string,
    data: {
      customer: string;
      customerCity: string;
      orderDate: string;
      dueDate: string;
      priority: 'normal' | 'high';
      shipAddress: string;
      paymentTerms: string;
      notes: string;
      items: Array<{ sku: string; productName: string; pack: string; orderedQty: number; unitPrice: number }>;
    }
  ): Promise<void> => {
    const id = findOrderId(soNo);
    if (!id) return;
    await updateFulfillmentOrder(id, data);
    await loadOrders();
  };

  const handleGenerateInvoice = async (_soNo: string, _data: InvoiceData) => {
    try {
      await loadOrders();
    } catch (err) {
      console.error('Failed to invoice:', err);
    }
  };

  const handleDispatch = async (soNo: string, data: ShipData) => {
    const id = findOrderId(soNo);
    if (!id) return;
    try {
      await shipFulfillmentSplits(id, {
        awbNo: data.awbNo,
        courier: data.courier,
        dispatchDate: data.dispatchDate,
        eta: data.eta,
        ...(data.bprNos?.length ? { bprNos: data.bprNos } : {}),
      });
      await loadOrders();
    } catch (err) {
      console.error('Failed to ship:', err);
    }
  };

  const handleConfirmDelivery = async (soNo: string, data: DeliveryData) => {
    const id = findOrderId(soNo);
    if (!id) return;
    try {
      await deliverFulfillmentSplits(id, {
        deliveryDate: data.deliveryDate,
        receivedBy: data.receivedBy,
        remarks: data.remarks,
        ...(data.bprNos && data.bprNos.length > 0 ? { bprNos: data.bprNos } : {}),
      });
      await loadOrders();
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
    }
  };

  useEffect(() => {
    if (!selectedYield) return;
    const shortfall = Math.max(0, (Number(selectedYield.plannedQty) || 0) - (Number(selectedYield.actualOutputUnits) || 0));
    setReworkSoInput(selectedYield.soNo || '');
    setReworkReason('');
    setReworkQtyInput(shortfall > 0 ? String(Math.round(shortfall)) : '');
    setReworkBatchSizeKgInput('');
  }, [selectedYield]);

  const handleCreateReworkFromYield = async () => {
    if (!selectedYield) return;
    const shortfall = Math.max(0, (Number(selectedYield.plannedQty) || 0) - (Number(selectedYield.actualOutputUnits) || 0));
    if (shortfall <= 0) {
      addToast('info', 'No shortfall on this batch. Rework is not required.');
      return;
    }
    const soTyped = String(reworkSoInput || '').trim().toUpperCase();
    const expectedSo = String(selectedYield.soNo || '').trim().toUpperCase();
    if (!soTyped) {
      addToast('error', 'Enter SO ID to confirm rework batch creation.');
      return;
    }
    if (soTyped !== expectedSo) {
      addToast('error', `SO ID mismatch. Enter ${selectedYield.soNo} to continue.`);
      return;
    }
    const targetOrderQty = Math.round(Number(reworkQtyInput));
    if (!Number.isFinite(targetOrderQty) || targetOrderQty <= 0) {
      addToast('error', 'Enter valid rework quantity (must be greater than 0).');
      return;
    }
    const targetBatchSizeKg = reworkBatchSizeKgInput.trim() ? Number(reworkBatchSizeKgInput) : null;
    if (targetBatchSizeKg != null && (!Number.isFinite(targetBatchSizeKg) || targetBatchSizeKg <= 0)) {
      addToast('error', 'Batch size must be a valid number greater than 0.');
      return;
    }
    setReworkSubmitting(true);
    try {
      const rows = await fetchBatches();
      const base = rows.find((r) =>
        String(r.bmrNo || '').trim().toUpperCase() === String(selectedYield.bmrNo || '').trim().toUpperCase()
        && String(r.soNo || '').trim().toUpperCase() === expectedSo
      );
      if (!base?._pk) {
        addToast('error', 'Base production batch not found for this SO/BMR.');
        return;
      }
      if (!base.planningBatchId) {
        addToast('error', 'Selected batch is not linked to Planning. Rework batch requires planning-linked base batch.');
        return;
      }
      const baseOrderQty = Number(base.orderQty) || 0;
      const baseBatchSizeKg = Number(base.batchSize) || 0;
      const suggestedBatchSizeKg =
        targetBatchSizeKg != null
          ? targetBatchSizeKg
          : (baseOrderQty > 0 && baseBatchSizeKg > 0
            ? Math.round((baseBatchSizeKg * targetOrderQty * 100) / baseOrderQty) / 100
            : null);
      await createRworkBatch(base._pk, {
        reason: reworkReason.trim() || `Rework from Fulfillment due to shortfall ${shortfall.toLocaleString('en-IN')} units.`,
        targetOrderQty,
        ...(suggestedBatchSizeKg != null ? { targetBatchSizeKg: suggestedBatchSizeKg } : {}),
      });
      addToast('success', `Rework batch created for ${selectedYield.soNo}.`);
      await loadOrders();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to create rework batch';
      addToast('error', msg);
    } finally {
      setReworkSubmitting(false);
    }
  };

  const cityOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const so of saleOrders) {
      const city = String(so.customerCity || '').trim();
      if (city) unique.add(city);
    }
    return ['all', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [saleOrders]);

  const statusOptions = useMemo(() => {
    const unique = new Set<SaleOrder['soStatus']>();
    for (const so of saleOrders) unique.add(so.soStatus);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [saleOrders]);

  const filteredSaleOrders = useMemo(() => {
    const normalizeForSearch = (value: unknown): string =>
      String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const q = normalizeForSearch(searchTerm);
    const filtered = saleOrders.filter((so) => {
      if (!matchesDateRangeFilter(so.orderDate, dateFilter.from, dateFilter.to)) return false;
      if (statusFilter !== 'all' && so.soStatus !== statusFilter) return false;
      if (priorityFilter !== 'all' && so.priority !== priorityFilter) return false;
      if (cityFilter !== 'all' && String(so.customerCity || '').trim() !== cityFilter) return false;
      if (!q) return true;
      const clientSearchText = [
        so.customer,
        (so as SaleOrder & { clientName?: string; customerName?: string }).clientName,
        (so as SaleOrder & { clientName?: string; customerName?: string }).customerName,
        (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).client,
        (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).client_name,
        (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).customer_name,
      ]
        .map((v) => normalizeForSearch(v))
        .join(' ');
      return (
        normalizeForSearch(so.soNo).includes(q) ||
        clientSearchText.includes(q) ||
        normalizeForSearch(so.customerCity).includes(q) ||
        so.items.some(
          (item) =>
            normalizeForSearch(item.productName).includes(q) || normalizeForSearch(item.sku).includes(q)
        )
      );
    });

    const sortValue = (so: SaleOrder): string | number => {
      switch (sortKey) {
        case 'orderDate':
          return new Date(so.orderDate).getTime() || 0;
        case 'dueDate':
          return new Date(so.dueDate).getTime() || 0;
        case 'customer':
          return so.customer.toLowerCase();
        case 'soNo':
          return so.soNo.toLowerCase();
        case 'soValue':
          return Number(so.soValue) || 0;
        default:
          return 0;
      }
    };

    filtered.sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortOrder === 'asc' ? an - bn : bn - an;
    });
    return filtered;
  }, [saleOrders, searchTerm, statusFilter, priorityFilter, cityFilter, sortKey, sortOrder, dateFilter]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-2 bg-gray-50 border-b border-gray-200 flex items-center">
        <AdminMainMenuButton />
        <span className="ml-2 text-sm font-medium text-gray-600">Main menu</span>
      </div>
      <div className="max-w-screen-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Order Fulfillment</h1>
              <p className="text-sm text-gray-500 mt-1">Manage sale orders from creation to delivery.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={salesOrderExcelInputRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={handleSalesOrderExcelChange}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => salesOrderExcelInputRef.current?.click()}
                disabled={importingSalesOrders}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                title="Import Sales Order Excel"
              >
                {importingSalesOrders ? 'Importing SO…' : 'Import SO Excel'}
              </button>
              <Link
                to="/planning"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 underline-offset-2 hover:underline shrink-0"
              >
                <LayoutDashboard size={16} className="shrink-0" aria-hidden />
                Planning dashboard
              </Link>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              <button 
                onClick={() => setViewMode('orders')} 
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${viewMode === 'orders' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <ShoppingCart size={16} /> Sale Orders
              </button>
              <button 
                onClick={() => setViewMode('batches')} 
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${viewMode === 'batches' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Package size={16} /> Products & Batches
              </button>
            </div>
            <span className="text-xs text-gray-500">
              Showing {filteredSaleOrders.length} of {saleOrders.length} orders
            </span>
          </div>

          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
            <DateRangeFilterInputs
              value={dateFilter}
              onChange={setDateFilter}
              dateFieldLabel="Order date"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2">
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search SO, customer, city, SKU, product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm bg-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SaleOrder['soStatus'])}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'normal' | 'high')}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
              </select>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Cities</option>
                {cityOptions.filter((city) => city !== 'all').map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="dueDate">Sort: Due date</option>
                  <option value="orderDate">Sort: Order date</option>
                  <option value="customer">Sort: Customer</option>
                  <option value="soNo">Sort: SO no</option>
                  <option value="soValue">Sort: SO value</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-100 flex items-center gap-1.5"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <ArrowUpDown size={15} />
                  {sortOrder.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCityFilter('all');
                  setSortKey('dueDate');
                  setSortOrder('asc');
                  setDateFilter({ from: '', to: '' });
                }}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline"
              >
                Clear filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-orange-500 mr-3" size={24} />
              <span className="text-gray-500">Loading fulfillment orders...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={loadOrders} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm">
                Retry
              </button>
            </div>
          ) : viewMode === 'orders' ? (
            <SaleOrdersView
              saleOrders={filteredSaleOrders}
              onAddSO={handleAddSO}
              onUpdateSO={handleUpdateSO}
              onPickConfirm={handlePickConfirm}
              onGenerateInvoice={handleGenerateInvoice}
              onDispatch={handleDispatch}
              onConfirmDelivery={handleConfirmDelivery}
              initialOpenSoNo={deepLinkSoNo}
              onDeepLinkSoConsumed={() => setDeepLinkSoNo(null)}
            />
          ) : (
            <ProductsBatchesView
              saleOrders={filteredSaleOrders}
              onPickConfirm={handlePickConfirm}
              onGenerateInvoice={handleGenerateInvoice}
              onDispatch={handleDispatch}
              onConfirmDelivery={handleConfirmDelivery}
              onViewYieldSplit={(payload) => setSelectedYield(payload)}
              initialSearchQuery={batchesDeepLinkSearch}
              initialOpenBmrNo={batchesDeepLinkBmr}
              onDeepLinkConsumed={() => {
                setBatchesDeepLinkSearch('');
                setBatchesDeepLinkBmr(null);
              }}
            />
          )}
        </div>
      </div>
      {selectedYield && (
        <Modal
          isOpen={Boolean(selectedYield)}
          onClose={() => setSelectedYield(null)}
          title={`Batch Yield Detail — ${selectedYield.bmrNo}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">Product</p><p className="text-xs font-semibold text-gray-800">{selectedYield.productName}</p></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">SO</p><p className="text-xs font-semibold text-gray-800">{selectedYield.soNo || '—'}</p></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BMR</p><p className="text-xs font-semibold text-gray-800">{selectedYield.bmrNo}</p></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BPR</p><p className="text-xs font-semibold text-gray-800">{selectedYield.bprNo}</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <h4 className="text-sm font-bold text-blue-900 mb-2">BMR (Production)</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Planned batch (KG)</span><b>{selectedYield.plannedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Actual yield (KG)</span><b>{selectedYield.bmrYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Wastage (KG)</span><b>{selectedYield.bmrWasteKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Yield %</span><b>{selectedYield.bmrYieldPct.toFixed(1)}%</b></div>
                </div>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                <h4 className="text-sm font-bold text-purple-900 mb-2">BPR (Filling/Packing)</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Bulk units</span><b>{selectedYield.bprBulkUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>Actual output units</span><b>{selectedYield.actualOutputUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>BPR wastage units</span><b>{selectedYield.bprWasteUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>Overall waste units</span><b>{selectedYield.overallWasteUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h4 className="text-sm font-bold text-emerald-900 mb-2">Fulfillment Completion</h4>
              <div className="grid md:grid-cols-3 gap-3 text-xs mb-3">
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Planned Qty</p>
                  <p className="font-semibold text-gray-900">{Math.round(selectedYield.plannedQty).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Actual Output</p>
                  <p className="font-semibold text-gray-900">{Math.round(selectedYield.actualOutputUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Completion %</p>
                  <p className="font-semibold text-emerald-700">{selectedYield.completionPercent.toFixed(1)}%</p>
                </div>
              </div>
              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, selectedYield.completionPercent))}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <h4 className="text-sm font-bold text-amber-900 mb-2">Rework Batch Creation</h4>
              <p className="text-xs text-amber-900/80 mb-3">
                If actual output is short against planned quantity after QC, create a rework batch for the same SO.
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Planned Qty</p>
                  <p className="font-semibold text-gray-900">{Math.round(selectedYield.plannedQty).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Actual Output</p>
                  <p className="font-semibold text-gray-900">{Math.round(selectedYield.actualOutputUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-gray-500 uppercase">Shortfall</p>
                  <p className="font-semibold text-amber-700">{Math.max(0, Math.round(selectedYield.plannedQty - selectedYield.actualOutputUnits)).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-3 mb-3">
                <p className="text-[11px] font-semibold text-amber-900 mb-2">Rework Preview (editable before create)</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Rework Qty (units)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={reworkQtyInput}
                      onChange={(e) => setReworkQtyInput(e.target.value)}
                      className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Batch Size (KG, optional)</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={reworkBatchSizeKgInput}
                      onChange={(e) => setReworkBatchSizeKgInput(e.target.value)}
                      placeholder="Auto-scale from base batch"
                      className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-gray-600">
                  This rework will be created under the same SO and base batch linkage. Quantity defaults to the shortfall and can be adjusted here.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Confirm SO ID</label>
                  <input
                    type="text"
                    value={reworkSoInput}
                    onChange={(e) => setReworkSoInput(e.target.value)}
                    placeholder={selectedYield.soNo}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    placeholder="Rework reason"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateReworkFromYield}
                  disabled={reworkSubmitting || Math.max(0, selectedYield.plannedQty - selectedYield.actualOutputUnits) <= 0}
                  className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {reworkSubmitting ? 'Creating Rework…' : 'Create Rework Batch'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
