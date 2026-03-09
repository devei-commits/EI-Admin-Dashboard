/**
 * OrderFulfillment Component
 * Main container for order fulfillment management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Package, Search, Loader2 } from 'lucide-react';
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

type ViewMode = 'orders' | 'batches';

export const OrderFulfillment: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handlePickConfirm = async (soNo: string, data: PickData) => {
    const id = findOrderId(soNo);
    if (!id) return;
    try {
      await pickFulfillmentSplits(id, data);
      await loadOrders();
    } catch (err) {
      console.error('Failed to pick:', err);
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
      await deliverFulfillmentSplits(id, data);
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Order Fulfillment</h1>
              <p className="text-sm text-gray-500 mt-1">Manage sale orders from creation to delivery.</p>
            </div>
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
            <ProductsBatchesView saleOrders={filteredSaleOrders} onPickConfirm={handlePickConfirm} onGenerateInvoice={handleGenerateInvoice} onDispatch={handleDispatch} onConfirmDelivery={handleConfirmDelivery} />
          )}
        </div>
      </div>
    </div>
  );
};
