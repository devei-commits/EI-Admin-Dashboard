import React, { useState, useEffect } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import ItemDetailModal from '../components/ordermanagementcomp/ItemDetailModal';
import DraftSplitModal from '../components/ordermanagementcomp/DraftSplitModal';
import DelayImpactModal from '../components/ordermanagementcomp/DelayImpactModal';

interface OrderStatus {
  orderStatus: 'pending' | 'processing' | 'completed' | '';
  invoiced: 'pending' | 'completed' | '';
  payment: 'pending' | 'completed' | '';
  packed: 'pending' | 'completed' | '';
  shipped: 'pending' | 'completed' | '';
  deliveryMethod: 'road' | 'rail' | 'air' | 'sea' | '';
}

interface Order {
  id: string;
  type: 'SO' | 'PO';
  orderId: string;
  customerName?: string;
  vendorName?: string;
  orderDate: string;
  status: string;
  items: any[];
  formData: any;
  orderStatus: OrderStatus;
}

const STORAGE_KEY = 'eisthetic_sales_purchase_orders';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-400';
    case 'completed': return 'bg-green-500';
    case 'processing': return 'bg-blue-500';
    default: return 'bg-gray-300';
  }
};

const SalesAndPurchase: React.FC = () => {
  const { state, dispatch } = useGlobalState();
  const [orders, setOrders] = useState<Order[]>([]);
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

  // Load orders from localStorage on mount AND merge with global state
  useEffect(() => {
    const savedOrders = localStorage.getItem(STORAGE_KEY);
    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch (error) {
      }
    }
    // Also merge global state sales orders into the local list if they exist
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
  }, [state.orders?.salesOrders]);

  // Save orders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

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

  const handleSaveOrder = (draft: boolean) => {
    if (!formData.orderId || !formData.orderDate) {
      alert('Please fill in required fields (Order ID and Date)');
      return;
    }

    const orderId = `${orderType}-${Date.now()}`;

    const newOrder: Order = {
      id: orderId,
      type: orderType as 'SO' | 'PO',
      orderId: formData.orderId,
      customerName: formData.customerName,
      vendorName: formData.vendorName,
      orderDate: formData.orderDate,
      status: draft ? 'Draft' : 'Submitted',
      items: items,
      formData: formData,
      orderStatus: {
        orderStatus: '',
        invoiced: '',
        payment: '',
        packed: '',
        shipped: '',
        deliveryMethod: '',
      },
    };

    // Save to SalesAndPurchase
    setOrders([...orders, newOrder]);

    // If submitted (not draft), also sync to OrderHub
    if (!draft) {
      syncToOrderHub(newOrder);
    }

    alert(`${orderType} ${draft ? 'saved as draft' : 'submitted'} successfully!`);

    // Reset form
    setFormData({
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
    setItems([]);
    setOrderType(null);
    setViewMode('dashboard');
    setActiveTab(orderType === 'SO' ? 'sales' : 'purchase');
  };

  const syncToOrderHub = (order: Order) => {
    try {
      // Get existing OrderHub orders
      const orderHubOrders = JSON.parse(localStorage.getItem('eisthetic_order_hub_orders') || '[]');

      // Create an OrderHub order from SO/PO
      const orderHubOrder = {
        id: order.id,
        soPoId: order.id, // Link back to SO/PO
        orderNo: order.orderId,
        orderType: order.type,
        sku: order.items[0]?.sku || 'N/A',
        itemName: order.items[0]?.productName || 'N/A',
        qty: order.items[0]?.quantity || 0,
        unitRate: order.items[0]?.rate || '0.00',
        odrDate: order.orderDate,
        estDelDate: order.formData.expectedShipmentDate || '',
        comDate: '',
        licenseArch: 'PENDING',
        licenseEI: 'PENDING',
        stage: 'Stage 1: Review',
        currentStatus: 'PENDING',
        pocForCurrentStatus: 'S1',
        comments: order.formData.customerNotes || order.formData.termsConditions || '',
        currentStage: 1,
        stageProgress: {
          1: 'in-progress',
          2: 'pending',
          3: 'pending',
          4: 'pending',
          5: 'pending',
          6: 'pending'
        }
      };

      orderHubOrders.push(orderHubOrder);
      localStorage.setItem('eisthetic_order_hub_orders', JSON.stringify(orderHubOrders));
    } catch (error) {
    }
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
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Sales Orders ({filteredSalesOrders.length})</h2>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                      {/* Filters Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className="bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filters
                          {selectedFilters.length > 0 && selectedFilters[0] !== 'All' && (
                            <span className="bg-slate-800 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{selectedFilters.length}</span>
                          )}
                        </button>

                        {/* Filter Dropdown */}
                        {showFilters && (
                          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4">
                            <div className="space-y-3 max-h-72 overflow-y-auto">
                              {filterStatuses.map((status) => (
                                <label key={status} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={selectedFilters.includes(status)}
                                    onChange={() => toggleFilter(status)}
                                    className="w-4 h-4 text-slate-800 rounded cursor-pointer"
                                  />
                                  <span className="text-sm text-gray-700 font-medium">{status}</span>
                                </label>
                              ))}

                              {/* Custom Field */}
                              <div className="border-t border-gray-200 pt-3 mt-3">
                                <label className="text-xs font-semibold text-gray-600 mb-2 block">+ Custom Field</label>
                                <input
                                  type="text"
                                  placeholder="Add custom filter..."
                                  value={customField}
                                  onChange={(e) => setCustomField(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                                />
                                {customField && (
                                  <button
                                    onClick={() => {
                                      setSelectedFilters([customField]);
                                      setCustomField('');
                                      setShowFilters(false);
                                    }}
                                    className="mt-2 w-full bg-slate-800 text-white text-xs py-1.5 rounded font-medium hover:bg-slate-800"
                                  >
                                    Apply Custom Filter
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setOrderType('SO'); setViewMode('form'); }} className="flex-1 sm:flex-none bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-800 hover: transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">Create SO</span>
                        <span className="sm:hidden">+ SO</span>
                      </button>
                    </div>
                  </div>
                  {filteredSalesOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm sm:text-base">No sales orders found. Create one to get started.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full table-fixed min-w-275 text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="w-[9%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Order ID</th>
                              <th className="w-[5%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Type</th>
                              <th className="w-[12%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Customer</th>
                              <th className="w-[8%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Date</th>
                              <th className="w-[9%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Status</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Order Status</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Invoiced</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Payment</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Packed</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Shipped</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Delivery</th>
                              <th className="w-[5%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Items</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSalesOrders.map((order) => (
                              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-3 text-gray-800 font-medium truncate">{order.orderId}</td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">SO</span>
                                </td>
                                <td className="py-3 px-3 text-gray-800 truncate">{order.customerName || 'N/A'}</td>
                                <td className="py-3 px-3 text-gray-800 whitespace-nowrap">{order.orderDate}</td>
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium tracking-wide ${
                                    order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                    order.status === 'Batch created' ? 'bg-blue-100 text-blue-800' :
                                    order.status === 'BMR active' ? 'bg-purple-100 text-purple-800' :
                                    order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                    order.status === 'Submitted' ? 'bg-sky-100 text-sky-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.orderStatus ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.invoiced ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.invoiced}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.payment ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.payment}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.packed ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.packed}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.shipped ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.shipped}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.deliveryMethod ? (
                                    <span className="text-xs text-gray-600 capitalize">{order.orderStatus.deliveryMethod}</span>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-gray-800 tabular-nums">{order.items.length}</td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => openDetailModal(order)}
                                    className="px-4 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredSalesOrders.map((order) => (
                          <div key={order.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-800">{order.orderId}</span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">SO</span>
                                </div>
                                <p className="text-sm text-gray-600">{order.customerName || 'N/A'}</p>
                              </div>
                              <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${
                                order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                                order.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                order.status === 'Batch created' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'BMR active' ? 'bg-purple-100 text-purple-800' :
                                order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                order.status === 'Submitted' ? 'bg-sky-100 text-sky-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <span className="ml-1 text-gray-800">{order.orderDate}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Items:</span>
                                <span className="ml-1 text-gray-800 font-medium">{order.items.length}</span>
                              </div>
                              {order.orderStatus.orderStatus && (
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                  <span className="text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                </div>
                              )}
                              {order.orderStatus.payment && (
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                  <span className="text-gray-600 capitalize">Payment: {order.orderStatus.payment}</span>
                                </div>
                              )}
                            </div>
                            {/* Status Pills Row */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {order.orderStatus.invoiced && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                  Inv
                                </span>
                              )}
                              {order.orderStatus.packed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                  Pack
                                </span>
                              )}
                              {order.orderStatus.shipped && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                  Ship
                                </span>
                              )}
                              {order.orderStatus.deliveryMethod && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                                  {order.orderStatus.deliveryMethod}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => openDetailModal(order)}
                              className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium"
                            >
                              View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Purchase Orders ({filteredPurchaseOrders.length})</h2>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                      {/* Filters Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className="bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filters
                          {selectedFilters.length > 0 && selectedFilters[0] !== 'All' && (
                            <span className="bg-slate-800 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{selectedFilters.length}</span>
                          )}
                        </button>

                        {/* Filter Dropdown */}
                        {showFilters && (
                          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4">
                            <div className="space-y-3 max-h-72 overflow-y-auto">
                              {filterStatuses.map((status) => (
                                <label key={status} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={selectedFilters.includes(status)}
                                    onChange={() => toggleFilter(status)}
                                    className="w-4 h-4 text-slate-800 rounded cursor-pointer"
                                  />
                                  <span className="text-sm text-gray-700 font-medium">{status}</span>
                                </label>
                              ))}

                              {/* Custom Field */}
                              <div className="border-t border-gray-200 pt-3 mt-3">
                                <label className="text-xs font-semibold text-gray-600 mb-2 block">+ Custom Field</label>
                                <input
                                  type="text"
                                  placeholder="Add custom filter..."
                                  value={customField}
                                  onChange={(e) => setCustomField(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                                />
                                {customField && (
                                  <button
                                    onClick={() => {
                                      setSelectedFilters([customField]);
                                      setCustomField('');
                                      setShowFilters(false);
                                    }}
                                    className="mt-2 w-full bg-slate-800 text-white text-xs py-1.5 rounded font-medium hover:bg-slate-800"
                                  >
                                    Apply Custom Filter
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setOrderType('PO'); setViewMode('form'); }} className="flex-1 sm:flex-none bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">Create PO</span>
                        <span className="sm:hidden">+ PO</span>
                      </button>
                    </div>
                  </div>
                  {filteredPurchaseOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm sm:text-base">No purchase orders found. Create one to get started.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full table-fixed min-w-275 text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="w-[9%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">PO ID</th>
                              <th className="w-[5%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Type</th>
                              <th className="w-[12%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Vendor</th>
                              <th className="w-[8%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Date</th>
                              <th className="w-[9%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Status</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Order Status</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Invoiced</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Payment</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Packed</th>
                              <th className="w-[7%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Shipped</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Delivery</th>
                              <th className="w-[5%] text-left py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Items</th>
                              <th className="w-[8%] text-center py-3 px-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPurchaseOrders.map((order) => (
                              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-3 text-gray-800 font-medium truncate">{order.orderId}</td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">PO</span>
                                </td>
                                <td className="py-3 px-3 text-gray-800 truncate">{order.vendorName || 'N/A'}</td>
                                <td className="py-3 px-3 text-gray-800 whitespace-nowrap">{order.orderDate}</td>
                                <td className="py-3 px-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.orderStatus ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.invoiced ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.invoiced}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.payment ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.payment}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.packed ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.packed}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.shipped ? (
                                    <div className="flex justify-center items-center gap-1.5">
                                      <span className={`w-2 h-2 shrink-0 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                      <span className="text-xs text-gray-600 capitalize">{order.orderStatus.shipped}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {order.orderStatus.deliveryMethod ? (
                                    <span className="text-xs text-gray-600 capitalize">{order.orderStatus.deliveryMethod}</span>
                                  ) : <span className="text-xs text-gray-400">-</span>}
                                </td>
                                <td className="py-3 px-3 text-gray-800 tabular-nums">{order.items.length}</td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex justify-center gap-1.5">
                                    <button
                                      onClick={() => openDetailModal(order)}
                                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium tracking-wider"
                                    >
                                      View
                                    </button>
                                    {order.status === 'Draft' && (
                                      <button
                                        onClick={() => setDraftSplitModalId(order.id)}
                                        className="px-3 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition"
                                      >
                                        ✂ Split
                                      </button>
                                    )}
                                    {order.status !== 'Draft' && (
                                      <button
                                        onClick={() => setDelayImpactModalPoId(order.id)}
                                        className="px-3 py-2 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-50 transition"
                                      >
                                        ⏱ Delay
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredPurchaseOrders.map((order) => (
                          <div key={order.id} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-800">{order.orderId}</span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">PO</span>
                                </div>
                                <p className="text-sm text-gray-600">{order.vendorName || 'N/A'}</p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                {order.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <span className="ml-1 text-gray-800">{order.orderDate}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Items:</span>
                                <span className="ml-1 text-gray-800 font-medium">{order.items.length}</span>
                              </div>
                              {order.orderStatus.orderStatus && (
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                  <span className="text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                </div>
                              )}
                              {order.orderStatus.payment && (
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                  <span className="text-gray-600 capitalize">Payment: {order.orderStatus.payment}</span>
                                </div>
                              )}
                            </div>
                            {/* Status Pills Row */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {order.orderStatus.invoiced && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                  Inv
                                </span>
                              )}
                              {order.orderStatus.packed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                  Pack
                                </span>
                              )}
                              {order.orderStatus.shipped && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                  Ship
                                </span>
                              )}
                              {order.orderStatus.deliveryMethod && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                                  {order.orderStatus.deliveryMethod}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openDetailModal(order)}
                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium"
                              >
                                View Details
                              </button>
                              {order.status === 'Draft' && (
                                <button
                                  onClick={() => setDraftSplitModalId(order.id)}
                                  className="px-3 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition"
                                >
                                  ✂ Split
                                </button>
                              )}
                              {order.status !== 'Draft' && (
                                <button
                                  onClick={() => setDelayImpactModalPoId(order.id)}
                                  className="px-3 py-2 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-50 transition"
                                >
                                  ⏱ Delay
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
          <div className="bg-green-500 px-8 py-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Create New Sales Order</h2>
            <button
              onClick={() => setOrderType(null)}
              className="bg-white text-green-600 hover:bg-gray-100 p-2 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
              Save as Draft
            </button>
            <button onClick={() => handleSaveOrder(false)} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium">
              Save & Submit
            </button>
          </div>
        </div>
      )}

      {/* Form View - PO Form */}
      {viewMode === 'form' && orderType === 'PO' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-blue-500 px-8 py-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Create New Purchase Order</h2>
            <button
              onClick={() => setOrderType(null)}
              className="bg-white text-blue-600 hover:bg-gray-100 p-2 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
              Save as Draft
            </button>
            <button onClick={() => handleSaveOrder(false)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium">
              Save & Submit
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
      {delayImpactModalPoId && (
        <DelayImpactModal
          poId={delayImpactModalPoId}
          onClose={() => setDelayImpactModalPoId(null)}
        />
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
