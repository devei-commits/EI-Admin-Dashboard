/**
 * OrderFulfillment Component
 * Main container for order fulfillment management
 */

import React, { useState } from 'react';
import { ShoppingCart, Package, Search } from 'lucide-react';
import { SaleOrdersView } from '../components/orders/SaleOrdersView';
import { ProductsBatchesView } from '../components/orders/ProductsBatchesView';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData } from '../types/orderFulfillment';
import { recalculateSOStatus, getTodayISO } from '../utils/orderFulfillmentUtils';

type ViewMode = 'orders' | 'batches';

export const OrderFulfillment: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([
    {
      soNo: 'EI-SO-2026-001',
      soDate: '2026-01-10',
      customer: 'BeautyBox Retail',
      customerCity: 'Mumbai',
      orderDate: '2026-01-10',
      dueDate: '2026-03-15',
      priority: 'high',
      soStatus: 'partial',
      soValue: 750000,
      shipAddress: '12th Floor, Trade Centre, BKC, Bandra East, Mumbai 400051',
      paymentTerms: 'Net 30',
      notes: 'Urgent — retail launch tied to March season. Partial dispatch OK.',
      items: [{
        itemNo: '001', sku: 'EI-FG-001', productName: 'EI Gentle Foaming Facewash',
        pack: '150ml Tube', orderedQty: 50000, rate: 15, unitPrice: 15,
        batchSplits: [
          { bmrNo: 'BMR-2026-0101', bprNo: 'BPR-2026-0101', plannedQty: 20000, fgQty: 20000, fgLocation: 'FG-A-12', ffStatus: 'fg_ready', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null },
          { bmrNo: 'BMR-2026-0102', bprNo: 'BPR-2026-0102', plannedQty: 15000, fgQty: 0, fgLocation: null, ffStatus: 'fg_pending', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null },
          { bmrNo: 'BMR-2026-0103', bprNo: 'BPR-2026-0103', plannedQty: 15000, fgQty: 0, fgLocation: null, ffStatus: 'fg_pending', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null }
        ]
      }]
    },
    {
      soNo: 'EI-SO-2026-002',
      soDate: '2026-02-01',
      customer: 'Glow & Go Distribution',
      customerCity: 'Bengaluru',
      orderDate: '2026-02-01',
      dueDate: '2026-04-10',
      priority: 'normal',
      soStatus: 'in_production',
      soValue: 900000,
      shipAddress: '45, Industrial Layout, Peenya, Bengaluru 560058',
      paymentTerms: 'Net 45',
      notes: '',
      items: [{
        itemNo: '001', sku: 'EI-FG-002', productName: 'EI Invisible Sunscreen SPF50',
        pack: '50ml Bottle', orderedQty: 30000, rate: 30, unitPrice: 30,
        batchSplits: [
          { bmrNo: 'BMR-2026-0201', bprNo: 'BPR-2026-0201', plannedQty: 15000, fgQty: 14800, fgLocation: 'FG-B-03', ffStatus: 'bulk_qc', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null },
          { bmrNo: 'BMR-2026-0202', bprNo: 'BPR-2026-0202', plannedQty: 15000, fgQty: 0, fgLocation: null, ffStatus: 'fg_pending', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null }
        ]
      }]
    },
    {
      soNo: 'EI-SO-2026-003',
      soDate: '2026-02-20',
      customer: 'Shine & Care Salons',
      customerCity: 'Hyderabad',
      orderDate: '2026-02-20',
      dueDate: '2026-05-01',
      priority: 'normal',
      soStatus: 'planned',
      soValue: 1000000,
      shipAddress: 'Plot 88, HITEC City, Phase 2, Hyderabad 500081',
      paymentTerms: 'Advance',
      notes: 'New client — first order. Quality check before dispatch.',
      items: [{
        itemNo: '001', sku: 'EI-FG-003', productName: 'EI Hydra-Boost Moisturiser',
        pack: '100ml Jar', orderedQty: 40000, rate: 25, unitPrice: 25,
        batchSplits: [
          { bmrNo: 'BMR-2026-0301', bprNo: 'BPR-2026-0301', plannedQty: 40000, fgQty: 0, fgLocation: null, ffStatus: 'fg_pending', pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null, invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null }
        ]
      }]
    },
    {
      soNo: 'EI-SO-2026-004',
      soDate: '2025-12-15',
      customer: 'NaturGlow FMCG',
      customerCity: 'Delhi',
      orderDate: '2025-12-15',
      dueDate: '2026-02-28',
      priority: 'high',
      soStatus: 'shipped',
      soValue: 400000,
      shipAddress: 'A-12, Okhla Industrial Area, Phase 1, New Delhi 110020',
      paymentTerms: 'COD',
      notes: '',
      items: [{
        itemNo: '001', sku: 'EI-FG-004', productName: 'EI Daily Defence Conditioner',
        pack: '200ml Bottle', orderedQty: 20000, rate: 20, unitPrice: 20,
        batchSplits: [
          { bmrNo: 'BMR-2025-0401', bprNo: 'BPR-2025-0401', plannedQty: 20000, fgQty: 20000, fgLocation: 'FG-C-01', ffStatus: 'shipped', pickedQty: 20000, pickerName: 'Ramesh K', pickDate: '2026-02-10', pickSlipNo: 'PS-40112', remarks: 'Handle with care — glass bottles', invoiceNo: 1001, awbNo: 'BD9876543210', courier: 'BlueDart Express', dispatchDate: '2026-02-18', etaDate: '2026-02-25' }
        ]
      }]
    }
  ]);

  const handleAddSO = (data: AddSOData) => {
    const newSO: SaleOrder = {
      soNo: data.soNo || `EI-SO-2026-${String(saleOrders.length + 1).padStart(3, '0')}`,
      soDate: getTodayISO(),
      customer: data.customer,
      customerCity: data.customerCity,
      orderDate: data.orderDate,
      dueDate: data.dueDate,
      priority: data.priority,
      soStatus: 'planned',
      soValue: (data.item?.orderedQty || 0) * (data.item?.unitPrice || 0),
      shipAddress: data.shipAddress,
      paymentTerms: data.paymentTerms,
      notes: data.notes || '',
      items: data.item ? [{
        itemNo: '001',
        sku: data.item.sku || `EI-FG-${String(saleOrders.length + 1).padStart(3, '0')}`,
        productName: data.item.productName,
        pack: data.item.pack || '—',
        orderedQty: data.item.orderedQty,
        rate: data.item.unitPrice,
        unitPrice: data.item.unitPrice,
        batchSplits: [{
          bmrNo: data.item.bmrNo || `BMR-TBD-${String(saleOrders.length + 1).padStart(3, '0')}`,
          bprNo: `BPR-TBD-${String(saleOrders.length + 1).padStart(3, '0')}`,
          plannedQty: data.item.orderedQty, fgQty: 0, fgLocation: null, ffStatus: 'fg_pending' as const,
          pickedQty: 0, pickerName: null, pickDate: null, pickSlipNo: null, remarks: null,
          invoiceNo: null, awbNo: null, courier: null, dispatchDate: null, etaDate: null
        }]
      }] : []
    };
    setSaleOrders(prev => [...prev, newSO]);
  };

  // Pick confirmation — sets status to 'picking'
  const handlePickConfirm = (soNo: string, data: PickData) => {
    setSaleOrders(prev => prev.map(so => {
      if (so.soNo !== soNo) return so;
      const updatedItems = so.items.map(item => ({
        ...item,
        batchSplits: item.batchSplits.map(split => {
          const pickInfo = data.splits.find(s => s.bprNo === split.bprNo);
          if (pickInfo && split.ffStatus === 'fg_ready') {
            return { ...split, ffStatus: 'picking' as const, pickedQty: pickInfo.pickedQty, pickerName: data.pickerName, pickDate: data.pickDate, pickSlipNo: data.pickSlipNo, remarks: data.remarks || null };
          }
          return split;
        })
      }));
      const updatedSO = { ...so, items: updatedItems };
      return { ...updatedSO, soStatus: recalculateSOStatus(updatedSO) };
    }));
  };

  // Invoice generation — transitions 'picking' → 'invoiced'
  const handleGenerateInvoice = (soNo: string, data: InvoiceData) => {
    setSaleOrders(prev => prev.map(so => {
      if (so.soNo !== soNo) return so;
      const updatedItems = so.items.map(item => ({
        ...item,
        batchSplits: item.batchSplits.map(split =>
          split.ffStatus === 'picking'
            ? { ...split, ffStatus: 'invoiced' as const, invoiceNo: parseInt(data.invoiceNo.replace(/\D/g, '')) || null }
            : split
        )
      }));
      const updatedSO = { ...so, items: updatedItems, invoiceNo: data.invoiceNo, invoiceDate: data.invoiceDate, courier: data.courier };
      return { ...updatedSO, soStatus: recalculateSOStatus(updatedSO) };
    }));
  };

  // Dispatch — transitions 'invoiced' → 'shipped'
  const handleDispatch = (soNo: string, data: ShipData) => {
    setSaleOrders(prev => prev.map(so => {
      if (so.soNo !== soNo) return so;
      const updatedItems = so.items.map(item => ({
        ...item,
        batchSplits: item.batchSplits.map(split =>
          split.ffStatus === 'invoiced'
            ? { ...split, ffStatus: 'shipped' as const, courier: data.courier, awbNo: data.awbNo, dispatchDate: data.dispatchDate, etaDate: data.eta }
            : split
        )
      }));
      const updatedSO = { ...so, items: updatedItems, awbNo: data.awbNo, dispatchDate: data.dispatchDate, courier: data.courier };
      return { ...updatedSO, soStatus: recalculateSOStatus(updatedSO) };
    }));
  };

  // Delivery — transitions 'shipped' → 'delivered', auto-close if all done
  const handleConfirmDelivery = (soNo: string, _data: DeliveryData) => {
    setSaleOrders(prev => prev.map(so => {
      if (so.soNo !== soNo) return so;
      const updatedItems = so.items.map(item => ({
        ...item,
        batchSplits: item.batchSplits.map(split =>
          split.ffStatus === 'shipped' ? { ...split, ffStatus: 'delivered' as const } : split
        )
      }));
      const allDelivered = updatedItems.flatMap(i => i.batchSplits).filter(sp => sp.fgQty > 0).every(sp => ['delivered', 'closed'].includes(sp.ffStatus));
      if (allDelivered) {
        const closedItems = updatedItems.map(item => ({ ...item, batchSplits: item.batchSplits.map(split => split.ffStatus === 'delivered' ? { ...split, ffStatus: 'closed' as const } : split) }));
        return { ...so, items: closedItems, soStatus: 'closed' as const };
      }
      const updatedSO = { ...so, items: updatedItems };
      return { ...updatedSO, soStatus: recalculateSOStatus(updatedSO) };
    }));
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

          {viewMode === 'orders' ? (
            <SaleOrdersView saleOrders={filteredSaleOrders} onAddSO={handleAddSO} onPickConfirm={handlePickConfirm} onGenerateInvoice={handleGenerateInvoice} onDispatch={handleDispatch} onConfirmDelivery={handleConfirmDelivery} />
          ) : (
            <ProductsBatchesView saleOrders={filteredSaleOrders} onPickConfirm={handlePickConfirm} onGenerateInvoice={handleGenerateInvoice} onDispatch={handleDispatch} onConfirmDelivery={handleConfirmDelivery} />
          )}
        </div>
      </div>
    </div>
  );
};
