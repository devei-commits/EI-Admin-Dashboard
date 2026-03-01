import React, { useState, useEffect, useCallback } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import ItemDetailModal from '../components/orders/ItemDetailModal';
import DraftSplitModal from '../components/orders/DraftSplitModal';
import SalesTab from './salesPurchase/SalesTab';
import PurchaseTab from './salesPurchase/PurchaseTab';
import { OrderStatus, Order } from '../types/salesPurchase.types';
import {
  fetchSalesOrders,
  fetchPurchaseOrders,
  createSalesOrder,
  createPurchaseOrder,
  updateSalesOrder,
  updatePurchaseOrder,
} from '../services/salesPurchase.service';
import { useToast } from '../context/ToastContext';

const _getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-400';
    case 'completed': return 'bg-green-500';
    case 'processing': return 'bg-blue-500';
    default: return 'bg-gray-300';
  }
};

const SalesAndPurchase: React.FC = () => {
  const { state, dispatch } = useGlobalState();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [useApi, setUseApi] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [viewMode, setViewMode] = useState<'dashboard' | 'form' | 'procurement'>('dashboard');
  const [orderType, setOrderType] = useState<'SO' | 'PO' | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['All']);
  const [customField, setCustomField] = useState('');
  const [itemDetailModalId, setItemDetailModalId] = useState<string | null>(null);
  const [draftSplitModalId, setDraftSplitModalId] = useState<string | null>(null);
  const [delayImpactModalPoId, setDelayImpactModalPoId] = useState<string | null>(null);
  const [editingDraftOrder, setEditingDraftOrder] = useState<Order | null>(null);

  const loadFromApi = useCallback(async () => {
    setLoading(true);
    const [soRes, poRes] = await Promise.all([fetchSalesOrders(), fetchPurchaseOrders()]);
    if (soRes.success && poRes.success) {
      setOrders([...(soRes.data ?? []), ...(poRes.data ?? [])]);
      setUseApi(true);
    } else {
      setUseApi(false);
      setOrders([]);
      if (!soRes.success || !poRes.success) addToast('error', 'Could not load orders from server.');
    }
    setLoading(false);
  }, [addToast]);

  // Load from API on mount, else fallback to localStorage + global state
  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  useEffect(() => {
    if (!useApi) return;
    if (state.orders?.salesOrders?.length > 0) {
      const globalSOs: Order[] = state.orders.salesOrders.map((so: any) => ({
        id: so.so,
        type: 'SO' as const,
        orderId: so.so,
        customerName: so.clientName,
        vendorName: '',
        orderDate: so.createdAt,
        status: so.internalStatus || 'Submitted',
        items: [],
        formData: {},
        orderStatus: { orderStatus: so.internalStatus === 'Batch created' ? 'processing' : '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' },
      }));
      setOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id));
        const newOrders = globalSOs.filter(o => !existingIds.has(o.id));
        return [...prev, ...newOrders];
      });
    }
  }, [state.orders?.salesOrders, useApi]);


  const [formData, setFormData] = useState({
    customerName: '',
    vendorName: '',
    branch: '',
    orderId: '',
    reference: '',
    orderDate: '',
    expectedShipmentDate: '',
    paymentTerms: '',
    poNumber: '',
    scheduledQty: '',
    bundleNumber: '',
    bmr: '',
    bpl: '',
    bundleQty: '',
    warehouseInversionNumber: '',
    discount: '',
    shippingCharges: '',
    roundOff: '',
    customerNotes: '',
    termsConditions: '',
  });

  const [totals, setTotals] = useState({
    subTotal: 0,
    discount: 0,
    shippingCharges: 0,
    roundOff: 0,
    total: 0,
  });

  const calculateTotals = () => {
    const subTotal = items.reduce((sum, item) => {
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
      const tax = (itemTotal * (parseFloat(item.tax) || 0)) / 100;
      return sum + itemTotal + tax;
    }, 0);

    const discount = parseFloat(formData.discount) || 0;
    const shippingCharges = parseFloat(formData.shippingCharges) || 0;
    const roundOff = parseFloat(formData.roundOff) || 0;
    const total = subTotal - discount + shippingCharges + roundOff;

    setTotals({
      subTotal: parseFloat(subTotal.toFixed(2)),
      discount,
      shippingCharges,
      roundOff,
      total: parseFloat(total.toFixed(2)),
    });
  };

  React.useEffect(() => {
    calculateTotals();
  }, [items, formData.discount, formData.shippingCharges, formData.roundOff]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddItem = () => {
    setItems([...items, { id: items.length + 1, itemName: '', batchNumber: '', expiryDate: '', mrpUnit: '', mrp: '', quantity: '', rate: '', tax: '' }]);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async (draft: boolean) => {
    const orderIdVal = orderType === 'PO' ? (formData.poNumber || formData.orderId) : formData.orderId;
    if (!orderIdVal?.trim() || !formData.orderDate) {
      addToast('error', orderType === 'PO' ? 'Please fill PO Number and Date' : 'Please fill in Order ID and Date');
      return;
    }

    const status = draft ? 'Draft' : 'Submitted';
    const orderStatus = editingDraftOrder?.orderStatus ?? { orderStatus: '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' };

    const payload = {
      orderId: orderIdVal.trim(),
      orderDate: formData.orderDate,
      expectedShipmentDate: formData.expectedShipmentDate || undefined,
      reference: formData.reference || undefined,
      paymentTerms: formData.paymentTerms || undefined,
      status,
      formData: { ...formData, orderId: orderIdVal },
      items: [...items],
      orderStatus,
    };

    if (useApi && editingDraftOrder) {
      const numericId = editingDraftOrder.id.replace(/^(SO|PO)-/, '');
      if (editingDraftOrder.type === 'SO') {
        const res = await updateSalesOrder(numericId, { ...payload, customerName: formData.customerName, branch: formData.branch });
        if (res.success) {
          await loadFromApi();
          addToast('success', 'Draft sales order updated.');
          resetFormAndClose();
          return;
        }
        addToast('error', res.error || 'Failed to update draft');
        return;
      }
      if (editingDraftOrder.type === 'PO') {
        const res = await updatePurchaseOrder(numericId, { ...payload, vendorName: formData.vendorName, branch: formData.branch });
        if (res.success) {
          await loadFromApi();
          addToast('success', 'Draft purchase order updated.');
          resetFormAndClose();
          return;
        }
        addToast('error', res.error || 'Failed to update draft');
        return;
      }
    }

    if (useApi) {
      if (orderType === 'SO') {
        const res = await createSalesOrder({ ...payload, customerName: formData.customerName, branch: formData.branch });
        if (res.success && res.data) {
          await loadFromApi();
          if (!draft) syncToOrderHub(res.data);
          addToast('success', `Sales order ${draft ? 'saved as draft' : 'submitted'}.`);
          resetFormAndClose();
          return;
        }
        addToast('error', res.error || 'Failed to create sales order');
        return;
      }
      if (orderType === 'PO') {
        const res = await createPurchaseOrder({ ...payload, vendorName: formData.vendorName, branch: formData.branch });
        if (res.success && res.data) {
          await loadFromApi();
          if (!draft) syncToOrderHub(res.data);
          addToast('success', `Purchase order ${draft ? 'saved as draft' : 'submitted'}.`);
          resetFormAndClose();
          return;
        }
        addToast('error', res.error || 'Failed to create purchase order');
        return;
      }
    }

    const newOrder: Order = {
      id: `${orderType}-${Date.now()}`,
      type: orderType as 'SO' | 'PO',
      orderId: orderIdVal,
      customerName: formData.customerName,
      vendorName: formData.vendorName,
      orderDate: formData.orderDate,
      status,
      items: [...items],
      formData: { ...formData },
      orderStatus,
    };
    setOrders(prev => [...prev, newOrder]);
    if (!draft) syncToOrderHub(newOrder);
    addToast('success', `${orderType} ${draft ? 'saved as draft' : 'submitted'}.`);
    resetFormAndClose();
  };

  const initialFormData = {
    customerName: '',
    vendorName: '',
    branch: '',
    orderId: '',
    reference: '',
    orderDate: '',
    expectedShipmentDate: '',
    paymentTerms: '',
    poNumber: '',
    scheduledQty: '',
    bundleNumber: '',
    bmr: '',
    bpl: '',
    bundleQty: '',
    warehouseInversionNumber: '',
    discount: '',
    shippingCharges: '',
    roundOff: '',
    customerNotes: '',
    termsConditions: '',
  };

  const resetFormAndClose = () => {
    setFormData(initialFormData);
    setItems([]);
    setEditingDraftOrder(null);
    setOrderType(null);
    setViewMode('dashboard');
    setActiveTab(orderType === 'SO' ? 'sales' : 'purchase');
  };

  /** Open the create form pre-filled with a draft SO/PO so user can edit and save. */
  const openDraftInForm = (order: Order) => {
    const fd = order.formData || {};
    const asStr = (v: unknown) => (v != null ? String(v) : '');
    setFormData({
      ...initialFormData,
      ...Object.fromEntries(Object.entries(fd).map(([k, v]) => [k, asStr(v)])),
      orderId: order.orderId || asStr(fd.orderId),
      customerName: (order.type === 'SO' ? order.customerName : undefined) ?? asStr(fd.customerName),
      vendorName: (order.type === 'PO' ? order.vendorName : undefined) ?? asStr(fd.vendorName),
      branch: asStr(fd.branch ?? order.formData?.branch),
      orderDate: order.orderDate || asStr(fd.orderDate),
      expectedShipmentDate: (order as any).expectedShipmentDate ?? asStr(fd.expectedShipmentDate),
      reference: asStr(fd.reference),
      paymentTerms: asStr(fd.paymentTerms),
      poNumber: asStr(fd.poNumber ?? fd.orderId),
      discount: asStr(fd.discount),
      shippingCharges: asStr(fd.shippingCharges),
      roundOff: asStr(fd.roundOff),
      customerNotes: asStr(fd.customerNotes),
      termsConditions: asStr(fd.termsConditions),
    });
    setItems(
      (order.items || []).map((item: any, i: number) => ({
        id: i + 1,
        itemName: item.itemName ?? '',
        batchNumber: item.batchNumber ?? '',
        expiryDate: item.expiryDate ?? '',
        mrpUnit: item.mrpUnit ?? '',
        mrp: item.mrp ?? '',
        quantity: item.quantity ?? '',
        rate: item.rate ?? '',
        tax: item.tax ?? '',
        ...item,
      }))
    );
    setEditingDraftOrder(order);
    setOrderType(order.type);
    setViewMode('form');
    setShowDetailModal(false);
    setActiveTab(order.type === 'SO' ? 'sales' : 'purchase');
  };

  const handleFillMockValuesSO = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFormData(prev => ({
      ...prev,
      customerName: 'Customer 1',
      branch: 'Branch A',
      orderId: `SO-MOCK-${Date.now().toString(36).toUpperCase()}`,
      reference: 'REF-MOCK',
      orderDate: today,
      expectedShipmentDate: nextWeek,
      paymentTerms: 'NET 30',
      poNumber: '',
      scheduledQty: '100',
      bundleNumber: 'BND-001',
      bmr: 'BMR-001',
      bpl: 'BPL-001',
      bundleQty: '10',
      warehouseInversionNumber: 'WH-INV-001',
      discount: '5',
      shippingCharges: '100',
      roundOff: '0',
      customerNotes: 'Mock sales order for testing.',
      termsConditions: 'Standard terms apply.',
    }));
    setItems([
      { id: 1, itemName: 'Product Alpha', batchNumber: 'B001', expiryDate: '', mrpUnit: '500', mrp: '500', quantity: '20', rate: '450', tax: '18' },
      { id: 2, itemName: 'Product Beta', batchNumber: 'B002', expiryDate: '', mrpUnit: '300', mrp: '300', quantity: '50', rate: '280', tax: '12' },
    ]);
    addToast('success', 'Mock values filled for Sales Order. Edit as needed and save.');
  };

  const handleFillMockValuesPO = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFormData(prev => ({
      ...prev,
      vendorName: 'Vendor 1',
      branch: 'Branch A',
      orderId: '',
      poNumber: `PO-MOCK-${Date.now().toString(36).toUpperCase()}`,
      reference: 'REF-PO-MOCK',
      orderDate: today,
      expectedShipmentDate: nextWeek,
      paymentTerms: 'NET 30',
      scheduledQty: '200',
      bundleNumber: 'BND-PO-001',
      bmr: 'BMR-PO-001',
      bpl: 'BPL-PO-001',
      bundleQty: '25',
      warehouseInversionNumber: 'WH-PO-001',
      discount: '0',
      shippingCharges: '250',
      roundOff: '0',
      customerNotes: 'Mock purchase order for testing.',
      termsConditions: 'Standard PO terms.',
    }));
    setItems([
      { id: 1, itemName: 'Raw Material X', batchNumber: 'RM-B01', expiryDate: '', mrpUnit: '100', mrp: '100', quantity: '100', rate: '95', tax: '18' },
      { id: 2, itemName: 'Raw Material Y', batchNumber: 'RM-B02', expiryDate: '', mrpUnit: '80', mrp: '80', quantity: '200', rate: '75', tax: '12' },
    ]);
    addToast('success', 'Mock values filled for Purchase Order. Edit as needed and save.');
  };

  const syncToOrderHub = (_order: Order) => {
    // No localStorage: pure backend integration; Order Hub would use API when available
  };

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const updateOrderStatus = (field: keyof OrderStatus, value: any) => {
    if (selectedOrder) {
      const updatedOrder = {
        ...selectedOrder,
        orderStatus: {
          ...selectedOrder.orderStatus,
          [field]: value,
        },
      };
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    }
  };

  /** Persist Order Status Tracking to backend and refresh. */
  const handleSaveOrderStatusTracking = async () => {
    if (!selectedOrder || !useApi) return;
    const numericId = selectedOrder.id.replace(/^(SO|PO)-/, '');
    const orderStatus = selectedOrder.orderStatus;
    if (selectedOrder.type === 'SO') {
      const res = await updateSalesOrder(numericId, { orderStatus });
      if (res.success && res.data) {
        await loadFromApi();
        setSelectedOrder(res.data);
        addToast('success', 'Order status tracking updated.');
      } else addToast('error', res.error || 'Failed to update status');
    } else {
      const res = await updatePurchaseOrder(numericId, { orderStatus });
      if (res.success && res.data) {
        await loadFromApi();
        setSelectedOrder(res.data);
        addToast('success', 'Order status tracking updated.');
      } else addToast('error', res.error || 'Failed to update status');
    }
  };

  /** Delay modal: new expected date state and handlers */
  const delayOrder = delayImpactModalPoId ? orders.find(o => o.id === delayImpactModalPoId) : null;
  const [delayEstimatedDate, setDelayEstimatedDate] = useState('');
  const handleDelayUpdate = async () => {
    if (!delayOrder || delayOrder.type !== 'PO' || !delayEstimatedDate.trim()) {
      addToast('error', 'Please enter an estimated delivery date.');
      return;
    }
    const numericId = delayOrder.id.replace(/^PO-/, '');
    const res = await updatePurchaseOrder(numericId, {
      expectedShipmentDate: delayEstimatedDate.trim(),
      formData: { ...delayOrder.formData, expectedShipmentDate: delayEstimatedDate.trim() },
    });
    if (res.success) {
      await loadFromApi();
      setDelayImpactModalPoId(null);
      setDelayEstimatedDate('');
      addToast('success', 'Expected delivery date updated.');
    } else addToast('error', res.error || 'Failed to update date');
  };

  useEffect(() => {
    if (delayOrder) {
      const current =
        delayOrder.expectedShipmentDate ??
        delayOrder.formData?.expectedShipmentDate ??
        '';
      setDelayEstimatedDate(typeof current === 'string' ? current : '');
    } else {
      setDelayEstimatedDate('');
    }
  }, [delayImpactModalPoId, delayOrder?.id]);

  const filterStatuses = [
    'All',
    'Draft',
    'Pending approval',
    'Approved',
    'Confirmed',
    'For packaging',
    'To be shipped',
    'Shipped',
    'Fulfilled'
  ];

  const toggleFilter = (filter: string) => {
    if (filter === 'All') {
      setSelectedFilters(['All']);
    } else {
      let newFilters = selectedFilters.filter(f => f !== 'All');
      if (newFilters.includes(filter)) {
        newFilters = newFilters.filter(f => f !== filter);
      } else {
        newFilters.push(filter);
      }
      setSelectedFilters(newFilters.length === 0 ? ['All'] : newFilters);
    }
  };

  const getFilteredOrders = (orderList: Order[]) => {
    if (selectedFilters.includes('All')) return orderList;

    return orderList.filter(order => {
      // Map status to filter options
      const orderStatusMap: { [key: string]: string } = {
        'Draft': 'Draft',
        'Pending': 'Pending approval',
        'Approved': 'Approved',
        'Confirmed': 'Confirmed',
        'Packaging': 'For packaging',
        'ToShip': 'To be shipped',
        'Shipped': 'Shipped',
        'Fulfilled': 'Fulfilled'
      };

      const mappedStatus = orderStatusMap[order.status] || order.status;
      return selectedFilters.includes(mappedStatus) || selectedFilters.includes(order.status);
    });
  };

  const salesOrders = orders.filter(o => o.type === 'SO');
  const purchaseOrders = orders.filter(o => o.type === 'PO');
  const filteredSalesOrders = getFilteredOrders(salesOrders);
  const filteredPurchaseOrders = getFilteredOrders(purchaseOrders);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-100">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Sales and Purchase</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage sales and purchase orders and transactions</p>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2 sm:gap-3">
        <button
          onClick={() => setViewMode('dashboard')}
          className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${viewMode === 'dashboard'
            ? 'bg-slate-800 text-white shadow-md'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l4-4m0 0l4 4m-4-4V5m0 16H5a2 2 0 01-2-2v-5.586a1 1 0 00-.293-.707l-.414-.414A1 1 0 003.828 6h16.344a1 1 0 00.707.293l-.414.414a1 1 0 00-.293.707V17a2 2 0 01-2 2h-4z" />
          </svg>
          <span className="hidden xs:inline">Dashboard</span>
          <span className="xs:hidden">List</span>
        </button>
        <button
          onClick={() => setViewMode('form')}
          className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${viewMode === 'form'
            ? 'bg-slate-800 text-white shadow-md'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Form
        </button>
        <button
          onClick={() => setViewMode('procurement')}
          className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${viewMode === 'procurement'
            ? 'bg-slate-800 text-white shadow-md'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Procurement
        </button>
      </div>

      {/* Procurement View */}
      {viewMode === 'procurement' && <ProcurementView state={state} dispatch={dispatch} onItemDetail={setItemDetailModalId} />}

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Sales</p>
                  <p className="text-3xl font-bold text-green-600">{salesOrders.length}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Purchases</p>
                  <p className="text-3xl font-bold text-blue-600">{purchaseOrders.length}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-all text-sm sm:text-base ${activeTab === 'sales'
                  ? 'text-slate-800 border-b-2 border-amber-600 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span className="hidden sm:inline">Sales Orders</span>
                <span className="sm:hidden">Sales</span>
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-all text-sm sm:text-base ${activeTab === 'purchase'
                  ? 'text-slate-800 border-b-2 border-amber-600 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span className="hidden sm:inline">Purchase Orders</span>
                <span className="sm:hidden">Purchase</span>
              </button>
            </div>

            <div className="p-3 sm:p-6">
              {activeTab === 'sales' ? (
                <SalesTab
                  filteredSalesOrders={filteredSalesOrders}
                  openDetailModal={openDetailModal}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  selectedFilters={selectedFilters}
                  toggleFilter={toggleFilter}
                  filterStatuses={filterStatuses}
                  customField={customField}
                  setCustomField={setCustomField}
                  setSelectedFilters={setSelectedFilters}
                  setShowFiltersOff={() => setShowFilters(false)}
                  onCreateSO={() => { setEditingDraftOrder(null); setOrderType('SO'); setViewMode('form'); }}
                />
              ) : (
                <PurchaseTab
                  filteredPurchaseOrders={filteredPurchaseOrders}
                  openDetailModal={openDetailModal}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  selectedFilters={selectedFilters}
                  toggleFilter={toggleFilter}
                  filterStatuses={filterStatuses}
                  customField={customField}
                  setCustomField={setCustomField}
                  setSelectedFilters={setSelectedFilters}
                  setShowFiltersOff={() => setShowFilters(false)}
                  onCreatePO={() => { setEditingDraftOrder(null); setOrderType('PO'); setViewMode('form'); }}
                  setDraftSplitModalId={setDraftSplitModalId}
                  setDelayImpactModalPoId={setDelayImpactModalPoId}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Form View */}
      {viewMode === 'form' && !orderType && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Order</h2>
          <p className="text-gray-600 mb-8">Select the type of order you want to create:</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setOrderType('SO')}
              className="bg-green-50 border-2 border-green-300 rounded-lg p-8 hover:shadow-lg transition-all hover:border-green-500 cursor-pointer"
            >
              <div className="flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Sales Order (SO)</h3>
              <p className="text-green-600">Create a new sales order for customers</p>
            </button>

            <button
              onClick={() => setOrderType('PO')}
              className="bg-blue-50 border-2 border-blue-300 rounded-lg p-8 hover:shadow-lg transition-all hover:border-blue-500 cursor-pointer"
            >
              <div className="flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-blue-700 mb-2">Purchase Order (PO)</h3>
              <p className="text-blue-600">Create a new purchase order for suppliers</p>
            </button>
          </div>
        </div>
      )}

      {/* Form View - SO Form */}
      {viewMode === 'form' && orderType === 'SO' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-green-500 px-8 py-4 flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-bold text-white">{editingDraftOrder ? 'Edit Draft Sales Order' : 'Create New Sales Order'}</h2>
            <div className="flex items-center gap-2">
              {!editingDraftOrder && (
                <button
                  type="button"
                  onClick={handleFillMockValuesSO}
                  className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition font-medium text-sm"
                >
                  Fill mock values
                </button>
              )}
              <button
                onClick={() => { setEditingDraftOrder(null); setOrderType(null); }}
                className="bg-white text-green-600 hover:bg-gray-100 p-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-300px)]">
            {/* Customer Information */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <select name="customerName" value={formData.customerName} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="">Select or add a customer</option>
                    <option>Customer 1</option>
                    <option>Customer 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <select name="branch" value={formData.branch} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="">Select branch</option>
                    <option>Branch A</option>
                    <option>Branch B</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">Order Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sales Order ID *</label>
                  <input type="text" name="orderId" value={formData.orderId} onChange={handleFormChange} placeholder="SO-XXXXXX" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                  <input type="text" name="reference" value={formData.reference} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sales Order Date *</label>
                  <input type="date" name="orderDate" value={formData.orderDate} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Shipment Date</label>
                  <input type="date" name="expectedShipmentDate" value={formData.expectedShipmentDate} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                  <select name="paymentTerms" value={formData.paymentTerms} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="">Select payment terms</option>
                    <option>NET 30</option>
                    <option>NET 60</option>
                    <option>COD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Item Details */}
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
              <h3 className="text-lg font-bold text-purple-900 mb-4">Item Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-100">
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Item Details</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Batch Number</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Expiry Date</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">MRP/Unit</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Quantity</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Rate</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Tax %</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Amount</th>
                      <th className="px-2 py-2 text-center text-purple-900 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const itemAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                      const tax = (itemAmount * (parseFloat(item.tax) || 0)) / 100;
                      const totalAmount = itemAmount + tax;
                      return (
                        <tr key={index} className="border-b border-purple-100">
                          <td className="px-2 py-2"><input type="text" value={item.itemName} onChange={(e) => handleItemChange(index, 'itemName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Select item" /></td>
                          <td className="px-2 py-2"><input type="text" value={item.batchNumber || ''} onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Batch" /></td>
                          <td className="px-2 py-2"><input type="date" value={item.expiryDate || ''} onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.mrpUnit || ''} onChange={(e) => handleItemChange(index, 'mrpUnit', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="MRP" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.tax} onChange={(e) => handleItemChange(index, 'tax', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="0" /></td>
                          <td className="px-2 py-2 text-gray-800 font-semibold text-xs whitespace-nowrap">{totalAmount.toFixed(2)}</td>
                          <td className="px-2 py-2 text-center">
                            <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 font-semibold">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleAddItem} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item Row
                </button>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add In Bulk
                </button>
              </div>
            </div>

            {/* Additional Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PO Number</label>
                <input type="text" name="poNumber" value={formData.poNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Qty</label>
                <input type="number" name="scheduledQty" value={formData.scheduledQty} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Number</label>
                <input type="text" name="bundleNumber" value={formData.bundleNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BMR</label>
                <input type="text" name="bmr" value={formData.bmr} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BPL</label>
                <input type="text" name="bpl" value={formData.bpl} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Qty</label>
                <input type="number" name="bundleQty" value={formData.bundleQty} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Inversion Number</label>
                <input type="text" name="warehouseInversionNumber" value={formData.warehouseInversionNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
            </div>

            {/* Totals Section */}
            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <h3 className="text-lg font-bold text-green-900 mb-4">Billing Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-300">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Sub Total</p>
                  <p className="text-lg font-bold text-gray-800">₹{totals.subTotal.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                  <div className="flex gap-2">
                    <input type="number" name="discount" value={formData.discount} onChange={handleFormChange} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" placeholder="0" />
                    <span className="flex items-center text-gray-600 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shipping</label>
                  <input type="number" name="shippingCharges" value={formData.shippingCharges} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Round Off</label>
                  <input type="number" name="roundOff" value={formData.roundOff} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" placeholder="0" />
                </div>
                <div className="bg-green-600 p-4 rounded-lg text-white">
                  <p className="text-xs mb-1 font-medium">Total (Rs.)</p>
                  <p className="text-xl font-bold">{totals.total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Notes</label>
                  <textarea name="customerNotes" value={formData.customerNotes} onChange={handleFormChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Enter any notes for the customer"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
                  <textarea name="termsConditions" value={formData.termsConditions} onChange={handleFormChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Enter terms and conditions"></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-8 py-4 flex justify-end gap-3 border-t border-gray-200">
            <button
              onClick={() => setOrderType(null)}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-all font-medium"
            >
              Cancel
            </button>
            <button onClick={() => handleSaveOrder(true)} className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium">
              {editingDraftOrder ? 'Update draft' : 'Save as Draft'}
            </button>
            <button onClick={() => handleSaveOrder(false)} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium">
              {editingDraftOrder ? 'Submit order' : 'Save & Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Form View - PO Form */}
      {viewMode === 'form' && orderType === 'PO' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-blue-500 px-8 py-4 flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-bold text-white">{editingDraftOrder ? 'Edit Draft Purchase Order' : 'Create New Purchase Order'}</h2>
            <div className="flex items-center gap-2">
              {!editingDraftOrder && (
                <button
                  type="button"
                  onClick={handleFillMockValuesPO}
                  className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition font-medium text-sm"
                >
                  Fill mock values
                </button>
              )}
              <button
                onClick={() => { setEditingDraftOrder(null); setOrderType(null); }}
                className="bg-white text-blue-600 hover:bg-gray-100 p-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-300px)]">
            {/* Vendor Information */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Vendor Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
                  <select name="vendorName" value={formData.vendorName} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select or add a vendor</option>
                    <option>Vendor 1</option>
                    <option>Vendor 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <select name="branch" value={formData.branch} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select branch</option>
                    <option>Branch A</option>
                    <option>Branch B</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">Order Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Number *</label>
                  <input type="text" name="poNumber" value={formData.poNumber} onChange={handleFormChange} placeholder="PO-XXXXXX" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                  <input type="text" name="reference" value={formData.reference} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Date *</label>
                  <input type="date" name="orderDate" value={formData.orderDate} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
                  <input type="date" name="expectedShipmentDate" value={formData.expectedShipmentDate} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                  <select name="paymentTerms" value={formData.paymentTerms} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select payment terms</option>
                    <option>NET 30</option>
                    <option>NET 60</option>
                    <option>COD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Item Details */}
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
              <h3 className="text-lg font-bold text-purple-900 mb-4">Item Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-100">
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Item Details</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Batch Number</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Expiry Date</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">MRP/Unit</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Quantity</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Rate</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Tax %</th>
                      <th className="px-2 py-2 text-left text-purple-900 font-semibold">Amount</th>
                      <th className="px-2 py-2 text-center text-purple-900 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const itemAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                      const tax = (itemAmount * (parseFloat(item.tax) || 0)) / 100;
                      const totalAmount = itemAmount + tax;
                      return (
                        <tr key={index} className="border-b border-purple-100">
                          <td className="px-2 py-2"><input type="text" value={item.itemName} onChange={(e) => handleItemChange(index, 'itemName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Select item" /></td>
                          <td className="px-2 py-2"><input type="text" value={item.batchNumber || ''} onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Batch" /></td>
                          <td className="px-2 py-2"><input type="date" value={item.expiryDate || ''} onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.mrpUnit || ''} onChange={(e) => handleItemChange(index, 'mrpUnit', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="MRP" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.tax} onChange={(e) => handleItemChange(index, 'tax', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="0" /></td>
                          <td className="px-2 py-2 text-gray-800 font-semibold text-xs whitespace-nowrap">{totalAmount.toFixed(2)}</td>
                          <td className="px-2 py-2 text-center">
                            <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 font-semibold">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleAddItem} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item Row
                </button>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add In Bulk
                </button>
              </div>
            </div>

            {/* Additional Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PO Number</label>
                <input type="text" name="poNumber" value={formData.poNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Qty</label>
                <input type="number" name="scheduledQty" value={formData.scheduledQty} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Number</label>
                <input type="text" name="bundleNumber" value={formData.bundleNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BMR</label>
                <input type="text" name="bmr" value={formData.bmr} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">BPL</label>
                <input type="text" name="bpl" value={formData.bpl} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Qty</label>
                <input type="number" name="bundleQty" value={formData.bundleQty} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Inversion Number</label>
                <input type="text" name="warehouseInversionNumber" value={formData.warehouseInversionNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
            </div>

            {/* Totals Section */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Billing Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-300">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Sub Total</p>
                  <p className="text-lg font-bold text-gray-800">₹{totals.subTotal.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                  <div className="flex gap-2">
                    <input type="number" name="discount" value={formData.discount} onChange={handleFormChange} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="0" />
                    <span className="flex items-center text-gray-600 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shipping</label>
                  <input type="number" name="shippingCharges" value={formData.shippingCharges} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Round Off</label>
                  <input type="number" name="roundOff" value={formData.roundOff} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="0" />
                </div>
                <div className="bg-blue-600 p-4 rounded-lg text-white">
                  <p className="text-xs mb-1 font-medium">Total (Rs.)</p>
                  <p className="text-xl font-bold">{totals.total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Notes</label>
                  <textarea name="customerNotes" value={formData.customerNotes} onChange={handleFormChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter any notes for the vendor"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
                  <textarea name="termsConditions" value={formData.termsConditions} onChange={handleFormChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter terms and conditions"></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-8 py-4 flex justify-end gap-3 border-t border-gray-200">
            <button
              onClick={() => setOrderType(null)}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-all font-medium"
            >
              Cancel
            </button>
            <button onClick={() => handleSaveOrder(true)} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-medium">
              {editingDraftOrder ? 'Update draft' : 'Save as Draft'}
            </button>
            <button onClick={() => handleSaveOrder(false)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium">
              {editingDraftOrder ? 'Submit order' : 'Save & Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`${selectedOrder.type === 'SO' ? 'bg-green-600' : 'bg-blue-600'} px-8 py-4 flex justify-between items-center sticky top-0`}>
              <h2 className="text-2xl font-bold text-white">{selectedOrder.type === 'SO' ? 'Sales Order' : 'Purchase Order'} Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-white rounded-lg p-2 hover:bg-gray-100 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Order Header Info */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Order ID</p>
                    <p className="text-lg font-bold text-gray-800">{selectedOrder.orderId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Type</p>
                    <p className={`text-lg font-bold px-3 py-1 rounded-full inline-block mt-1 ${selectedOrder.type === 'SO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {selectedOrder.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Date</p>
                    <p className="text-lg font-bold text-gray-800">{selectedOrder.orderDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Status</p>
                    <p className={`text-lg font-bold px-3 py-1 rounded-full inline-block mt-1 ${selectedOrder.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {selectedOrder.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer/Vendor Info */}
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-3">{selectedOrder.type === 'SO' ? 'Customer' : 'Vendor'} Information</h3>
                <p className="text-gray-800"><span className="font-semibold">{selectedOrder.type === 'SO' ? 'Customer Name:' : 'Vendor Name:'}</span> {selectedOrder.type === 'SO' ? selectedOrder.formData.customerName : selectedOrder.formData.vendorName}</p>
                <p className="text-gray-800"><span className="font-semibold">Branch:</span> {selectedOrder.formData.branch}</p>
              </div>

              {/* Order Details */}
              <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                <h3 className="text-lg font-bold text-yellow-900 mb-3">Order Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
                  <p><span className="font-semibold">Reference:</span> {selectedOrder.formData.reference}</p>
                  <p><span className="font-semibold">Payment Terms:</span> {selectedOrder.formData.paymentTerms}</p>
                  <p><span className="font-semibold">Expected Date:</span> {selectedOrder.formData.expectedShipmentDate}</p>
                </div>
              </div>

              {/* Items */}
              <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                <h3 className="text-lg font-bold text-purple-900 mb-4">Items ({selectedOrder.items.length})</h3>
                {selectedOrder.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-purple-100">
                          <th className="px-4 py-2 text-left text-purple-900 font-semibold">Item Name</th>
                          <th className="px-4 py-2 text-left text-purple-900 font-semibold">Quantity</th>
                          <th className="px-4 py-2 text-left text-purple-900 font-semibold">Rate</th>
                          <th className="px-4 py-2 text-left text-purple-900 font-semibold">Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item, index) => (
                          <tr key={index} className="border-b border-purple-100">
                            <td className="px-4 py-2 text-gray-800">{item.itemName}</td>
                            <td className="px-4 py-2 text-gray-800">{item.quantity}</td>
                            <td className="px-4 py-2 text-gray-800">₹{item.rate}</td>
                            <td className="px-4 py-2 text-gray-800">{item.tax}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No items added</p>
                )}
              </div>

              {/* Order Status Tracking */}
              <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                <h3 className="text-lg font-bold text-indigo-900 mb-4">Order Status Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Order Status</label>
                    <select
                      value={selectedOrder.orderStatus.orderStatus}
                      onChange={(e) => updateOrderStatus('orderStatus', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Invoiced</label>
                    <select
                      value={selectedOrder.orderStatus.invoiced}
                      onChange={(e) => updateOrderStatus('invoiced', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Payment</label>
                    <select
                      value={selectedOrder.orderStatus.payment}
                      onChange={(e) => updateOrderStatus('payment', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Packed</label>
                    <select
                      value={selectedOrder.orderStatus.packed}
                      onChange={(e) => updateOrderStatus('packed', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Shipped</label>
                    <select
                      value={selectedOrder.orderStatus.shipped}
                      onChange={(e) => updateOrderStatus('shipped', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Method</label>
                    <select
                      value={selectedOrder.orderStatus.deliveryMethod}
                      onChange={(e) => updateOrderStatus('deliveryMethod', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Not Set</option>
                      <option value="road">Road</option>
                      <option value="rail">Rail</option>
                      <option value="air">Air</option>
                      <option value="sea">Sea</option>
                    </select>
                  </div>
                </div>
                {useApi && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleSaveOrderStatusTracking}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                    >
                      Update order status in database
                    </button>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Additional Information</h3>
                {selectedOrder.formData.customerNotes && (
                  <div className="mb-4">
                    <p className="font-semibold text-gray-700">Notes:</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedOrder.formData.customerNotes}</p>
                  </div>
                )}
                {selectedOrder.formData.termsConditions && (
                  <div>
                    <p className="font-semibold text-gray-700">Terms & Conditions:</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedOrder.formData.termsConditions}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-8 py-4 flex justify-end gap-3 border-t border-gray-200 sticky bottom-0">
              {selectedOrder.status === 'Draft' && (
                <button
                  onClick={() => openDraftInForm(selectedOrder)}
                  className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-medium"
                >
                  Edit in form
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Integrated modals === */}
      {itemDetailModalId && (
        <ItemDetailModal
          itemId={itemDetailModalId}
          onClose={() => setItemDetailModalId(null)}
          onReleaseToPlan={(_id) => { setItemDetailModalId(null); setViewMode('procurement'); }}
        />
      )}
      {draftSplitModalId && (
        <DraftSplitModal
          draftId={draftSplitModalId}
          onClose={() => setDraftSplitModalId(null)}
        />
      )}
      {delayImpactModalPoId && delayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update expected delivery date</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Purchase order: {delayOrder.id}</p>
            <input
              type="date"
              value={delayEstimatedDate}
              onChange={e => setDelayEstimatedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDelayImpactModalPoId(null); setDelayEstimatedDate(''); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelayUpdate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                Update date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesAndPurchase;

// ══════════════════════════════════════════════════════════════
// ProcurementView — shows item-level gap analysis + PO planning
// mirrors v15f Procurement Item Dashboard
// ══════════════════════════════════════════════════════════════
const ProcurementView: React.FC<{ state: any; dispatch: any; onItemDetail?: (id: string) => void }> = ({ state, dispatch, onItemDetail }) => {
  const [planItemId, setPlanItemId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ vendor: '', moq: '', qty: '', price: '', termsId: '' });

  const items: any[] = state.items || [];
  const planned: any[] = state.po?.planned || [];
  const termOptions: any[] = state.masters?.paymentTerms || [];

  const vendorByName = (name: string, item: any) =>
    item?.vendors?.find((v: any) => v.vendor === name);

  const getPlanItem = () => items.find((it: any) => it.id === planItemId);

  const openPlanModal = (itemId: string) => {
    setPlanItemId(itemId);
    setPlanForm({ vendor: '', moq: '', qty: '', price: '', termsId: '' });
  };

  const handlePushPlanned = () => {
    const item = getPlanItem();
    if (!item) return;
    if (!planForm.vendor || !planForm.moq || !planForm.qty || !planForm.price) {
      alert('Fill all procurement fields.');
      return;
    }
    const v = vendorByName(planForm.vendor, item);
    const slab = v?.slabs?.find((s: any) => s.moq === Number(planForm.moq)) || v?.slabs?.[0];
    const leadDays = slab?.leadDays || 10;
    const qty = Number(planForm.qty);

    const line = {
      id: 'PLAN-' + Math.random().toString(16).slice(2, 8).toUpperCase(),
      vendor: planForm.vendor,
      vendorId: v?.vendorId || null,
      itemId: item.id,
      itemName: item.name,
      uom: item.uom,
      moq: Number(planForm.moq),
      qty,
      unit: Number(planForm.price),
      leadDays,
      termsId: planForm.termsId,
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'PLANNED',
    };

    dispatch({ type: 'ADD_PLANNED_LINE', payload: { line, itemId: item.id, qty } });
    setPlanItemId(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n));

  // Group planned lines by vendor for the summary panel
  const plannedByVendor: Record<string, any[]> = {};
  planned.forEach((l: any) => {
    if (!plannedByVendor[l.vendor]) plannedByVendor[l.vendor] = [];
    plannedByVendor[l.vendor].push(l);
  });

  const planItem = getPlanItem();

  return (
    <div className="space-y-6 pt-2">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Procurement Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Item-level stock gap analysis · Release to Planned PO</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-gray-500">{planned.length} planned lines</p>
          <p className="font-semibold text-slate-800">{Object.keys(plannedByVendor).length} vendors</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Item', 'Type', 'Stock', 'Reserved', 'Free', 'In Transit', 'PO Qty', 'Required', 'Gap', 'Priority Qty', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const free = (item.stock || 0) - (item.reserved || 0);
                const incoming = (item.poQty || 0) + (item.inTransit || 0);
                const gap = (item.required || 0) - free - incoming;
                const priorityOrders = (item.orders || []).filter((o: any) => (o.planning || 0) >= 80);
                const priorityQty = priorityOrders.reduce((s: number, o: any) => s + o.required, 0);
                const isGap = gap > 0;
                const isBlocker = (item.orders || []).some((o: any) => o.pendingBlocker);

                return (
                  <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isGap ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'RM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.type}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-700">{fmt(item.stock || 0)}</td>
                    <td className="px-3 py-3 font-mono text-orange-600">{fmt(item.reserved || 0)}</td>
                    <td className={`px-3 py-3 font-mono font-semibold ${free < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(free)}</td>
                    <td className="px-3 py-3 font-mono text-blue-600">{fmt(item.inTransit || 0)}</td>
                    <td className="px-3 py-3 font-mono text-indigo-600">{fmt(item.poQty || 0)}</td>
                    <td className="px-3 py-3 font-mono text-gray-700">{fmt(item.required || 0)}</td>
                    <td className="px-3 py-3">
                      <span className={`font-mono font-bold ${isGap ? 'text-red-600' : 'text-green-600'}`}>{isGap ? `▲ ${fmt(gap)}` : '✓ OK'}</span>
                    </td>
                    <td className="px-3 py-3">
                      {isBlocker ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{fmt(priorityQty)} {item.uom}</span>
                      ) : (
                        <span className="text-xs text-gray-400">{fmt(priorityQty)} {item.uom}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 flex gap-1.5">
                      {onItemDetail && (
                        <button
                          onClick={() => onItemDetail(item.id)}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition whitespace-nowrap"
                        >
                          📋 Detail
                        </button>
                      )}
                      {(item.vendors || []).length > 0 && (
                        <button
                          onClick={() => openPlanModal(item.id)}
                          className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition whitespace-nowrap"
                        >
                          + Plan PO
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planned Lines Summary */}
      {planned.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">PO Planned Stage — {planned.length} lines</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-gray-100">
                <th className="text-left pb-2">Vendor</th>
                <th className="text-left pb-2">Items</th>
                <th className="text-left pb-2">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(plannedByVendor).map(([vendor, lines]) => {
                const total = lines.reduce((s: number, l: any) => s + l.qty * l.unit, 0);
                return (
                  <tr key={vendor} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-semibold text-gray-800">{vendor}</td>
                    <td className="py-2 text-gray-600">{lines.map((l: any) => `${l.itemName} (${fmt(l.qty)} ${l.uom})`).join(', ')}</td>
                    <td className="py-2 font-bold text-gray-800">₹{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ Plan PO Modal ══ */}
      {planItemId && planItem && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Release to Planned</h2>
                <p className="text-sm text-gray-500">{planItem.name} · {planItem.uom}</p>
              </div>
              <button onClick={() => setPlanItemId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Vendor picker with price slabs */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor</label>
                <select
                  value={planForm.vendor}
                  onChange={(e) => {
                    const v = vendorByName(e.target.value, planItem);
                    const slab = v?.slabs?.[0];
                    setPlanForm((p) => ({ ...p, vendor: e.target.value, moq: slab?.moq?.toString() || '', price: slab?.price?.toString() || '' }));
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select vendor…</option>
                  {(planItem.vendors || []).map((v: any) => <option key={v.vendor} value={v.vendor}>{v.vendor}</option>)}
                </select>
              </div>

              {planForm.vendor && (() => {
                const v = vendorByName(planForm.vendor, planItem);
                return (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">MOQ / Slab</label>
                    <div className="flex gap-2 flex-wrap">
                      {(v?.slabs || []).map((s: any) => (
                        <button
                          key={s.moq}
                          onClick={() => setPlanForm((p) => ({ ...p, moq: s.moq.toString(), price: s.price.toString() }))}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition ${planForm.moq === s.moq.toString() ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                        >
                          MOQ {s.moq} · ₹{s.price}/{planItem.uom} · {s.leadDays}d
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Order Qty ({planItem.uom})</label>
                  <input type="number" value={planForm.qty} onChange={(e) => setPlanForm((p) => ({ ...p, qty: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Price (₹)</label>
                  <input type="number" value={planForm.price} onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))}
                    placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
              </div>

              {planForm.qty && planForm.price && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
                  <span className="text-gray-600">Estimated Value</span>
                  <span className="font-bold text-gray-800">₹{fmt(Number(planForm.qty) * Number(planForm.price))}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms</label>
                <select value={planForm.termsId} onChange={(e) => setPlanForm((p) => ({ ...p, termsId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Select terms…</option>
                  {termOptions.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setPlanItemId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={handlePushPlanned} className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition">Release to Planned</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
