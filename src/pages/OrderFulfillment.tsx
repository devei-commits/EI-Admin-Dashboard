/**
 * OrderFulfillment Component
 * Main container for order fulfillment management
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Package, LayoutDashboard, ArrowDownToLine } from 'lucide-react';
import { SODashboardView } from '../components/orders/SODashboardView';
import { BatchesDashboardView } from '../components/orders/BatchesDashboardView';
import { FulfillmentSidebar } from '../components/orders/FulfillmentSidebar';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData } from '../types/orderFulfillment';
import { normalizePackSize } from '../utils/orderFulfillmentUtils';
import { recalculateSOStatus } from '../utils/orderFulfillmentUtils';
import {
  fetchFulfillmentOrderById,
  createFulfillmentOrder,
  updateFulfillmentOrder,
  pickFulfillmentSplits,
  shipFulfillmentSplits,
  deliverFulfillmentSplits,
} from '../services/fulfillment.service';
import { importOpenSoHeadersExcel, importSalesOrderFromZohoBySoNo } from '../services/salesPurchase.service';
import { createRworkBatch, fetchBatches } from '../services/production.service';
import { Modal } from '../components/orders/Modal';
import { useToast } from '../context/ToastContext';
import { DateRangeFilterInputs } from '../components/DateRangeFilterInputs';
import { queryClient } from '../lib/queryClient';

type ViewMode = 'so-dashboard' | 'products-batches';

export const OrderFulfillment: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('so-dashboard');
  // Search / status / priority / city / sort / date filters used to live here, feeding a client-side
  // filter over the full order book. SODashboardView now filters and paginates server-side.
  // Total SO count for the sidebar badge, reported by the dashboard's paginated fetch.
  const [soTotal, setSoTotal] = useState(0);
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
  const [zohoSoNo, setZohoSoNo] = useState('');
  const [importingZohoSo, setImportingZohoSo] = useState(false);
  const [deepLinkSoNo, setDeepLinkSoNo] = useState<string | null>(null);
  const [batchesDeepLinkSearch, setBatchesDeepLinkSearch] = useState('');
  const [batchesDeepLinkBmr, setBatchesDeepLinkBmr] = useState<string | null>(null);

  useEffect(() => {
    const so = searchParams.get('so')?.trim();
    const view = searchParams.get('view')?.trim();
    const bmr = searchParams.get('bmr')?.trim();
    if (view === 'batches' || view === 'products-batches') {
      setViewMode('products-batches');
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
    setViewMode('so-dashboard');
    setDeepLinkSoNo(so);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('so');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  // SODashboardView owns the SO table: it fetches its own slim, server-paginated rows.
  // Bumping this key remounts it so it refetches after a mutation made here.
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const refreshDashboard = useCallback(() => setDashboardRefreshKey((k) => k + 1), []);

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
          mrp: item.mrp ?? null,
          taxPct: item.taxPct ?? 0,
          taxAmount: item.taxAmount ?? 0,
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
      refreshDashboard();
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
      refreshDashboard();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Sales order import failed');
    } finally {
      setImportingSalesOrders(false);
    }
  };

  /**
   * Pull one sales order straight from Zoho Books by its SO number.
   * `force` re-imports an SO that already exists locally (refreshes it from Zoho).
   */
  const handleZohoSoImport = async (force = false): Promise<void> => {
    const soNo = zohoSoNo.trim();
    if (!soNo) {
      addToast('warning', 'Enter a Zoho SO number to fetch.');
      return;
    }

    setImportingZohoSo(true);
    try {
      const res = await importSalesOrderFromZohoBySoNo(soNo, { updateExisting: force });
      addToast(
        'success',
        res.action === 'create'
          ? `Imported ${res.so_no} from Zoho.`
          : `Refreshed ${res.so_no} from Zoho.`
      );
      if (!res.client_matched) {
        addToast('warning', `${res.so_no}: no matching client master — customer left as the Zoho name.`);
      }
      if (res.unmatched_lines.length > 0) {
        const skus = res.unmatched_lines.slice(0, 3).map((l) => l.sku).join(', ');
        addToast(
          'warning',
          `${res.so_no}: ${res.unmatched_lines.length} line(s) have no product master (${skus}). Planning may be incomplete.`
        );
      }
      setZohoSoNo('');
      refreshDashboard();
      // The import also writes planning_extracted rows.
      void queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
    } catch (err) {
      const body = (err as { body?: { code?: string; error?: string } })?.body;
      const message = err instanceof Error ? err.message : 'Failed to fetch sales order from Zoho';
      if (body?.code === 'SO_ALREADY_IMPORTED') {
        addToast('warning', `${message}. Use "Re-fetch" to refresh it from Zoho.`);
      } else {
        addToast('error', message);
      }
    } finally {
      setImportingZohoSo(false);
    }
  };

  const handlePickConfirm = async (id: number, data: PickData): Promise<SaleOrder | void> => {
    if (!id) return;
    try {
      await pickFulfillmentSplits(id, data);
      refreshDashboard();
      // Re-read just this order so the chained Invoice modal opens with fresh splits.
      return (await fetchFulfillmentOrderById(id)) ?? undefined;
    } catch (err) {
      console.error('Failed to pick:', err);
      throw err;
    }
  };

  const handleUpdateSO = async (
    id: number,
    data: {
      customer: string;
      customerCity: string;
      orderDate: string;
      dueDate: string;
      priority: 'normal' | 'high';
      shipAddress: string;
      paymentTerms: string;
      notes: string;
      salesOrderStatus?: string;
      items: Array<{
        sku: string;
        productName: string;
        pack: string;
        orderedQty: number;
        unitPrice: number;
        mrp?: number | null;
        taxPct?: number;
        taxAmount?: number;
      }>;
    }
  ): Promise<void> => {
    if (!id) return;
    const result = await updateFulfillmentOrder(id, data);
    refreshDashboard();
    // An SO-status change (Draft↔Approved…) flips its visibility in Planning → PIS Extracted.
    // Invalidate the Planning list so it refetches fresh instead of showing a stale cached copy.
    if (data.salesOrderStatus) {
      void queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
    }
    // Surface a cancel warning (e.g. batches already sent to production are being discarded).
    if (result?.warning) {
      window.alert(result.warning);
    }
  };

  const handleGenerateInvoice = async (_soId: number, _data: InvoiceData) => {
    try {
      refreshDashboard();
    } catch (err) {
      console.error('Failed to invoice:', err);
    }
  };

  const handleDispatch = async (id: number, data: ShipData) => {
    if (!id) return;
    try {
      await shipFulfillmentSplits(id, {
        awbNo: data.awbNo,
        courier: data.courier,
        dispatchDate: data.dispatchDate,
        eta: data.eta,
        ...(data.bprNos?.length ? { bprNos: data.bprNos } : {}),
      });
      refreshDashboard();
    } catch (err) {
      console.error('Failed to ship:', err);
    }
  };

  const handleConfirmDelivery = async (id: number, data: DeliveryData) => {
    if (!id) return;
    try {
      await deliverFulfillmentSplits(id, {
        deliveryDate: data.deliveryDate,
        receivedBy: data.receivedBy,
        remarks: data.remarks,
        ...(data.bprNos && data.bprNos.length > 0 ? { bprNos: data.bprNos } : {}),
      });
      refreshDashboard();
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
      refreshDashboard();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to create rework batch';
      addToast('error', msg);
    } finally {
      setReworkSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <FulfillmentSidebar activeView={viewMode} onNavigate={setViewMode} counts={{ 'so-dashboard': soTotal }} />
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <div className="sticky top-0 z-20 bg-surface border-b border-hairline px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-ink-3 mb-0.5">Order Management / Fulfillment</div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink truncate">
                {viewMode === 'products-batches' ? 'Products & Batches' : 'SO Dashboard'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Pull a single SO straight from Zoho Books by number */}
              <div
                className="flex items-center gap-1"
                title="Fetch a sales order that exists in Zoho Books by its SO number and import it here."
              >
                <input
                  value={zohoSoNo}
                  onChange={(e) => setZohoSoNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleZohoSoImport(false);
                    }
                  }}
                  placeholder="Zoho SO no…"
                  disabled={importingZohoSo}
                  aria-label="Zoho SO number"
                  className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand w-36 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => { void handleZohoSoImport(false); }}
                  disabled={importingZohoSo || !zohoSoNo.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-sm font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap"
                >
                  <ArrowDownToLine size={16} className="shrink-0" aria-hidden />
                  {importingZohoSo ? 'Fetching…' : 'Fetch from Zoho'}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleZohoSoImport(true); }}
                  disabled={importingZohoSo || !zohoSoNo.trim()}
                  title="Re-import an SO that already exists locally, overwriting it with Zoho's current data"
                  className="inline-flex items-center px-2 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-3 hover:bg-surface-3 disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap"
                >
                  Re-fetch
                </button>
              </div>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-sm font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-60"
                title="Import Sales Order Excel"
              >
                {importingSalesOrders ? 'Importing SO…' : 'Import SO Excel'}
              </button>
              <Link
                to="/planning"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand underline-offset-2 hover:underline shrink-0"
              >
                <LayoutDashboard size={16} className="shrink-0" aria-hidden />
                Planning dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-5">
          <div className="bg-surface rounded-[var(--r-lg)] border border-hairline p-4 sm:p-5 shadow-[var(--e1)]">
          {viewMode === 'products-batches' ? (
            <BatchesDashboardView />
          ) : (
            /* SODashboardView owns its own loading/error/empty states for the paginated row fetch. */
            <SODashboardView
              key={dashboardRefreshKey}
              onTotalChange={setSoTotal}
              onAddSO={handleAddSO}
              onUpdateSO={handleUpdateSO}
              onPickConfirm={handlePickConfirm}
              onGenerateInvoice={handleGenerateInvoice}
              onDispatch={handleDispatch}
              onConfirmDelivery={handleConfirmDelivery}
              initialOpenSoNo={deepLinkSoNo}
              onDeepLinkSoConsumed={() => setDeepLinkSoNo(null)}
            />
          )}
          </div>
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
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">Product</p><p className="text-xs font-semibold text-ink">{selectedYield.productName}</p></div>
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">SO</p><p className="text-xs font-semibold text-ink">{selectedYield.soNo || '—'}</p></div>
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">BMR</p><p className="text-xs font-semibold text-ink">{selectedYield.bmrNo}</p></div>
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">BPR</p><p className="text-xs font-semibold text-ink">{selectedYield.bprNo}</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-brand-soft bg-brand-soft p-4">
                <h4 className="text-sm font-bold text-brand mb-2">BMR (Production)</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Planned batch (KG)</span><b>{selectedYield.plannedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Actual yield (KG)</span><b>{selectedYield.bmrYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Wastage (KG)</span><b>{selectedYield.bmrWasteKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>Yield %</span><b>{selectedYield.bmrYieldPct.toFixed(1)}%</b></div>
                </div>
              </div>
              <div className="rounded-xl border border-brand-soft bg-brand-soft p-4">
                <h4 className="text-sm font-bold text-brand mb-2">BPR (Filling/Packing)</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Bulk units</span><b>{selectedYield.bprBulkUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>Actual output units</span><b>{selectedYield.actualOutputUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>BPR wastage units</span><b>{selectedYield.bprWasteUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                  <div className="flex justify-between"><span>Overall waste units</span><b>{selectedYield.overallWasteUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-ok bg-ok-soft/60 p-4">
              <h4 className="text-sm font-bold text-ok mb-2">Fulfillment Completion</h4>
              <div className="grid md:grid-cols-3 gap-3 text-xs mb-3">
                <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Planned Qty</p>
                  <p className="font-semibold text-ink">{Math.round(selectedYield.plannedQty).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Actual Output</p>
                  <p className="font-semibold text-ink">{Math.round(selectedYield.actualOutputUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Completion %</p>
                  <p className="font-semibold text-ok">{selectedYield.completionPercent.toFixed(1)}%</p>
                </div>
              </div>
              <div className="w-full h-2 bg-ok-soft rounded-full overflow-hidden">
                <div
                  className="h-full bg-ok"
                  style={{ width: `${Math.max(0, Math.min(100, selectedYield.completionPercent))}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-warn bg-warn-soft/60 p-4">
              <h4 className="text-sm font-bold text-warn mb-2">Rework Batch Creation</h4>
              <p className="text-xs text-warn/80 mb-3">
                If actual output is short against planned quantity after QC, create a rework batch for the same SO.
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Planned Qty</p>
                  <p className="font-semibold text-ink">{Math.round(selectedYield.plannedQty).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Actual Output</p>
                  <p className="font-semibold text-ink">{Math.round(selectedYield.actualOutputUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-3 uppercase">Shortfall</p>
                  <p className="font-semibold text-warn">{Math.max(0, Math.round(selectedYield.plannedQty - selectedYield.actualOutputUnits)).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-surface px-3 py-3 mb-3">
                <p className="text-[11px] font-semibold text-warn mb-2">Rework Preview (editable before create)</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-ink-3 mb-1">Rework Qty (units)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={reworkQtyInput}
                      onChange={(e) => setReworkQtyInput(e.target.value)}
                      className="w-full border border-[color:var(--st-amber-fg)]/30 rounded-lg px-3 py-2 text-sm bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-ink-3 mb-1">Batch Size (KG, optional)</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={reworkBatchSizeKgInput}
                      onChange={(e) => setReworkBatchSizeKgInput(e.target.value)}
                      placeholder="Auto-scale from base batch"
                      className="w-full border border-[color:var(--st-amber-fg)]/30 rounded-lg px-3 py-2 text-sm bg-surface"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-ink-3">
                  This rework will be created under the same SO and base batch linkage. Quantity defaults to the shortfall and can be adjusted here.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-ink-3 mb-1">Confirm SO ID</label>
                  <input
                    type="text"
                    value={reworkSoInput}
                    onChange={(e) => setReworkSoInput(e.target.value)}
                    placeholder={selectedYield.soNo}
                    className="w-full border border-[color:var(--st-amber-fg)]/30 rounded-lg px-3 py-2 text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-3 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    placeholder="Rework reason"
                    className="w-full border border-[color:var(--st-amber-fg)]/30 rounded-lg px-3 py-2 text-sm bg-surface"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateReworkFromYield}
                  disabled={reworkSubmitting || Math.max(0, selectedYield.plannedQty - selectedYield.actualOutputUnits) <= 0}
                  className="px-3 py-2 rounded-lg bg-warn text-white text-xs font-semibold hover:bg-warn disabled:opacity-60 disabled:cursor-not-allowed"
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
