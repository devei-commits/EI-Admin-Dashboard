import React, { useState, useEffect } from 'react';

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
    switch(status) {
        case 'pending': return 'bg-yellow-400';
        case 'completed': return 'bg-green-500';
        case 'processing': return 'bg-blue-500';
        default: return 'bg-gray-300';
    }
};

const SalesAndPurchase: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
    const [viewMode, setViewMode] = useState<'dashboard' | 'form'>('dashboard');
    const [orderType, setOrderType] = useState<'SO' | 'PO' | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<string[]>(['All']);
    const [customField, setCustomField] = useState('');

    // Load orders from localStorage on mount
    useEffect(() => {
        const savedOrders = localStorage.getItem(STORAGE_KEY);
        if (savedOrders) {
            try {
                setOrders(JSON.parse(savedOrders));
            } catch (error) {
                console.error('Error loading orders:', error);
            }
        }
    }, []);

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
            console.error('Error syncing to OrderHub:', error);
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
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Sales and Purchase</h1>
                <p className="text-gray-600">Manage sales and purchase orders and transactions</p>
            </div>

            {/* View Mode Selector */}
            <div className="flex gap-3">
                <button
                    onClick={() => setViewMode('dashboard')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        viewMode === 'dashboard'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l4-4m0 0l4 4m-4-4V5m0 16H5a2 2 0 01-2-2v-5.586a1 1 0 00-.293-.707l-.414-.414A1 1 0 003.828 6h16.344a1 1 0 00.707.293l-.414.414a1 1 0 00-.293.707V17a2 2 0 01-2 2h-4z" />
                    </svg>
                    Dashboard
                </button>
                <button
                    onClick={() => setViewMode('form')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        viewMode === 'form'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Form
                </button>
            </div>

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
                                className={`flex-1 px-6 py-3 font-medium transition-all ${
                                    activeTab === 'sales'
                                        ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Sales Orders
                            </button>
                            <button
                                onClick={() => setActiveTab('purchase')}
                                className={`flex-1 px-6 py-3 font-medium transition-all ${
                                    activeTab === 'purchase'
                                        ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Purchase Orders
                            </button>
                        </div>

                        <div className="p-6">
                            {activeTab === 'sales' ? (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-semibold text-gray-800">Sales Orders ({filteredSalesOrders.length})</h2>
                                        <div className="flex gap-3">
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
                                                        <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{selectedFilters.length}</span>
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
                                                                        className="w-4 h-4 text-amber-600 rounded cursor-pointer"
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                />
                                                                {customField && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFilters([customField]);
                                                                            setCustomField('');
                                                                            setShowFilters(false);
                                                                        }}
                                                                        className="mt-2 w-full bg-amber-500 text-white text-xs py-1.5 rounded font-medium hover:bg-amber-600"
                                                                    >
                                                                        Apply Custom Filter
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => { setOrderType('SO'); setViewMode('form'); }} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Create SO
                                            </button>
                                        </div>
                                    </div>
                                    {filteredSalesOrders.length === 0 ? (
                                        <div className="text-center py-12">
                                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-gray-500">No sales orders found. Create one to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Order ID</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Order Status</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Invoiced</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Payment</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Packed</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Shipped</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Delivery Method</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Items</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSalesOrders.map((order) => (
                                                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="py-4 px-5 text-gray-800 font-medium leading-relaxed">{order.orderId}</td>
                                                            <td className="py-4 px-5 leading-relaxed">
                                                                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 tracking-wider">SO</span>
                                                            </td>
                                                            <td className="py-4 px-5 text-gray-800 leading-relaxed">{order.customerName || 'N/A'}</td>
                                                            <td className="py-4 px-5 text-gray-800 leading-relaxed">{order.orderDate}</td>
                                                            <td className="py-4 px-5 leading-relaxed">
                                                                <span className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wider ${order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                                    {order.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.orderStatus ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.invoiced ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.invoiced}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.payment ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.payment}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.packed ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.packed}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.shipped ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.shipped}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.deliveryMethod ? (
                                                                    <span className="text-xs text-gray-600 capitalize">{order.orderStatus.deliveryMethod}</span>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-800">{order.items.length}</td>
                                                            <td className="py-3 px-4 text-center">
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
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-semibold text-gray-800">Purchase Orders ({filteredPurchaseOrders.length})</h2>
                                        <div className="flex gap-3">
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
                                                        <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{selectedFilters.length}</span>
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
                                                                        className="w-4 h-4 text-amber-600 rounded cursor-pointer"
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                />
                                                                {customField && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFilters([customField]);
                                                                            setCustomField('');
                                                                            setShowFilters(false);
                                                                        }}
                                                                        className="mt-2 w-full bg-amber-500 text-white text-xs py-1.5 rounded font-medium hover:bg-amber-600"
                                                                    >
                                                                        Apply Custom Filter
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => { setOrderType('PO'); setViewMode('form'); }} className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Create PO
                                            </button>
                                        </div>
                                    </div>
                                    {filteredPurchaseOrders.length === 0 ? (
                                        <div className="text-center py-12">
                                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-gray-500">No purchase orders found. Create one to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">PO ID</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Vendor</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Order Status</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Invoiced</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Payment</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Packed</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Shipped</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Delivery Method</th>
                                                        <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Items</th>
                                                        <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredPurchaseOrders.map((order) => (
                                                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="py-4 px-5 text-gray-800 font-medium leading-relaxed">{order.orderId}</td>
                                                            <td className="py-4 px-5 leading-relaxed">
                                                                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 tracking-wider">PO</span>
                                                            </td>
                                                            <td className="py-4 px-5 text-gray-800 leading-relaxed">{order.vendorName || 'N/A'}</td>
                                                            <td className="py-4 px-5 text-gray-800 leading-relaxed">{order.orderDate}</td>
                                                            <td className="py-4 px-5 leading-relaxed">
                                                                <span className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wider ${order.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                                    {order.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.orderStatus ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.orderStatus)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.orderStatus}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.invoiced ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.invoiced)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.invoiced}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.payment ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.payment)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.payment}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.packed ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.packed)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.packed}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.shipped ? (
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.orderStatus.shipped)}`}></span>
                                                                        <span className="text-xs text-gray-600 capitalize">{order.orderStatus.shipped}</span>
                                                                    </div>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-center">
                                                                {order.orderStatus.deliveryMethod ? (
                                                                    <span className="text-xs text-gray-600 capitalize">{order.orderStatus.deliveryMethod}</span>
                                                                ) : <span className="text-xs text-gray-400">-</span>}
                                                            </td>
                                                            <td className="py-4 px-5 text-gray-800 leading-relaxed">{order.items.length}</td>
                                                            <td className="py-4 px-5 text-center">
                                                                <button
                                                                    onClick={() => openDetailModal(order)}
                                                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium tracking-wider"
                                                                >
                                                                    View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
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
                            className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-8 hover:shadow-lg transition-all hover:border-green-500 cursor-pointer"
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
                            className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg p-8 hover:shadow-lg transition-all hover:border-blue-500 cursor-pointer"
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
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-8 py-4 flex justify-between items-center">
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
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-4 flex justify-between items-center">
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
                        <div className={`bg-gradient-to-r ${selectedOrder.type === 'SO' ? 'from-green-500 to-emerald-500' : 'from-blue-500 to-cyan-500'} px-8 py-4 flex justify-between items-center sticky top-0`}>
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
        </div>
    );
};

export default SalesAndPurchase;
