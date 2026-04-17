/**
 * OrderFulfillment Component
 * Main container for order fulfillment management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Search, Loader2, LayoutDashboard } from 'lucide-react';
import { SaleOrdersView } from '../components/orders/SaleOrdersView';
import { ProductsBatchesView } from '../components/orders/ProductsBatchesView';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData } from '../types/orderFulfillment';
import { recalculateSOStatus } from '../utils/orderFulfillmentUtils';
import {
  fetchFulfillmentOrders,
  createFulfillmentOrder,
  pickFulfillmentSplits,
  shipFulfillmentSplits,
  deliverFulfillmentSplits,
} from '../services/fulfillment.service';
import { Modal } from '../components/orders/Modal';

type ViewMode = 'orders' | 'batches';

export const OrderFulfillment: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  const [searchTerm, setSearchTerm] = useState('');
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
          pack: item.pack || '—',
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

  const filteredSaleOrders = saleOrders.filter(so => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return (
      so.soNo.toLowerCase().includes(lowerSearchTerm) ||
      so.customer.toLowerCase().includes(lowerSearchTerm) ||
      so.customerCity.toLowerCase().includes(lowerSearchTerm) ||
      so.items.some(item => item.productName.toLowerCase().includes(lowerSearchTerm))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Order Fulfillment</h1>
              <p className="text-sm text-gray-500 mt-1">Manage sale orders from creation to delivery.</p>
            </div>
            <Link
              to="/planning"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 underline-offset-2 hover:underline shrink-0"
            >
              <LayoutDashboard size={16} className="shrink-0" aria-hidden />
              Planning dashboard
            </Link>
          </div>

          <div className="flex justify-between items-center mb-6">
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
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
              />
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
            <SaleOrdersView saleOrders={filteredSaleOrders} onAddSO={handleAddSO} onPickConfirm={handlePickConfirm} onGenerateInvoice={handleGenerateInvoice} onDispatch={handleDispatch} onConfirmDelivery={handleConfirmDelivery} />
          ) : (
            <ProductsBatchesView
              saleOrders={filteredSaleOrders}
              onPickConfirm={handlePickConfirm}
              onGenerateInvoice={handleGenerateInvoice}
              onDispatch={handleDispatch}
              onConfirmDelivery={handleConfirmDelivery}
              onViewYieldSplit={(payload) => setSelectedYield(payload)}
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
                  <div className="flex justify-between"><span>Bulk units</span><b>{Math.round(selectedYield.bprBulkUnits).toLocaleString('en-IN')}</b></div>
                  <div className="flex justify-between"><span>Actual output units</span><b>{Math.round(selectedYield.actualOutputUnits).toLocaleString('en-IN')}</b></div>
                  <div className="flex justify-between"><span>BPR wastage units</span><b>{Math.round(selectedYield.bprWasteUnits).toLocaleString('en-IN')}</b></div>
                  <div className="flex justify-between"><span>Overall waste units</span><b>{Math.round(selectedYield.overallWasteUnits).toLocaleString('en-IN')}</b></div>
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
          </div>
        </Modal>
      )}
    </div>
  );
};
