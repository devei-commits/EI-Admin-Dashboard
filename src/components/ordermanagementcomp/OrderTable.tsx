import React, { useState, useCallback } from 'react';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface StatusHistory {
  status: string;
  timestamp: string;
  changedBy: string;
  notes?: string;
}

interface Order {
  orderId: string;
  companyName: string;
  doctorClinicAddress: string;
  dateRegistered: string;
  orderStatus: 'Pending' | 'Processing' | 'Approved' | 'Packaging' | 'Shipped' | 'Delivered' | 'Rejected' | 'Cancelled';
  productType: string;
  quantity: number;
  totalAmount: number;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  products?: Product[];
  statusHistory?: StatusHistory[];
  notes?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  cancellationReason?: string;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: {
    searchTerm: string;
    statusFilter: string;
    productTypeFilter: string;
    dateFrom: string;
    dateTo: string;
    priorityFilter: string;
  };
}

const OrderTable: React.FC = () => {
  // Sample data with enhanced fields
  const [orders, setOrders] = useState<Order[]>([
    {
      orderId: 'ORD001',
      companyName: 'MedCorp Solutions',
      doctorClinicAddress: '123 Health Street, Medical City, MC 12345',
      dateRegistered: '2026-01-15',
      orderStatus: 'Pending',
      productType: 'Medical Equipment',
      quantity: 50,
      totalAmount: 25000,
      priority: 'High',
      contactPerson: 'John Smith',
      contactEmail: 'john@medcorp.com',
      contactPhone: '+1-555-0101',
      products: [
        { id: '1', name: 'Ultrasound Machine', quantity: 5, unitPrice: 3000, total: 15000 },
        { id: '2', name: 'Patient Monitor', quantity: 10, unitPrice: 1000, total: 10000 }
      ],
      statusHistory: [
        { status: 'Pending', timestamp: '2026-01-15 09:00', changedBy: 'System', notes: 'Order created' }
      ],
      notes: 'Urgent delivery required by end of month'
    },
    {
      orderId: 'ORD002',
      companyName: 'HealthTech Inc',
      doctorClinicAddress: '456 Wellness Ave, Care Town, CT 67890',
      dateRegistered: '2026-01-20',
      orderStatus: 'Processing',
      productType: 'Pharmaceuticals',
      quantity: 100,
      totalAmount: 15000,
      priority: 'Medium'
    },
    {
      orderId: 'ORD003',
      companyName: 'Clinical Partners',
      doctorClinicAddress: '789 Doctor Lane, Medicine City, MC 54321',
      dateRegistered: '2026-01-25',
      orderStatus: 'Approved',
      productType: 'Diagnostic Tools',
      quantity: 25,
      totalAmount: 35000,
      priority: 'Urgent'
    },
    {
      orderId: 'ORD004',
      companyName: 'Pharma Solutions',
      doctorClinicAddress: '321 Pharmacy Road, Drug Valley, DV 98765',
      dateRegistered: '2026-01-30',
      orderStatus: 'Packaging',
      productType: 'Medical Supplies',
      quantity: 200,
      totalAmount: 8000,
      priority: 'Low'
    },
    {
      orderId: 'ORD005',
      companyName: 'Medical Supplies Co',
      doctorClinicAddress: '654 Clinic Boulevard, Health City, HC 13579',
      dateRegistered: '2026-02-01',
      orderStatus: 'Shipped',
      productType: 'Surgical Instruments',
      quantity: 75,
      totalAmount: 42000,
      priority: 'Medium'
    },
    {
      orderId: 'ORD006',
      companyName: 'Healthcare Innovations',
      doctorClinicAddress: '987 Medical Plaza, Care Center, CC 24680',
      dateRegistered: '2026-02-05',
      orderStatus: 'Rejected',
      productType: 'Medical Equipment',
      quantity: 30,
      totalAmount: 18000,
      priority: 'Low'
    },
    {
      orderId: 'ORD007',
      companyName: 'BioMed Corp',
      doctorClinicAddress: '111 Research Drive, Science Park, SP 11223',
      dateRegistered: '2026-02-10',
      orderStatus: 'Delivered',
      productType: 'Lab Equipment',
      quantity: 15,
      totalAmount: 65000,
      priority: 'High'
    },
    {
      orderId: 'ORD008',
      companyName: 'Global Health Systems',
      doctorClinicAddress: '222 Wellness Street, Treatment Town, TT 44556',
      dateRegistered: '2026-02-12',
      orderStatus: 'Processing',
      productType: 'Pharmaceuticals',
      quantity: 150,
      totalAmount: 22000,
      priority: 'Urgent'
    }
  ]);

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<keyof Order | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Form state
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [formProducts, setFormProducts] = useState<Product[]>([]);
  
  const recordsPerPage = 5;

  // Filter and search logic
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.orderStatus === statusFilter;
    const matchesProductType = productTypeFilter === 'all' || order.productType === productTypeFilter;
    const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
    
    const orderDate = new Date(order.dateRegistered);
    const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo);
    
    return matchesSearch && matchesStatus && matchesProductType && matchesPriority && matchesDateFrom && matchesDateTo;
  });

  // Sorting logic
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  // Pagination logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = sortedOrders.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(sortedOrders.length / recordsPerPage);

  // Stats calculation
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.orderStatus === 'Pending').length,
    processing: orders.filter(o => o.orderStatus === 'Processing').length,
    shipped: orders.filter(o => o.orderStatus === 'Shipped').length,
    delivered: orders.filter(o => o.orderStatus === 'Delivered').length
  };

  // Handlers
  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === currentRecords.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(currentRecords.map(order => order.orderId));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setProductTypeFilter('all');
    setPriorityFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name: filterName,
        filters: {
          searchTerm,
          statusFilter,
          productTypeFilter,
          dateFrom,
          dateTo,
          priorityFilter
        }
      };
      setSavedFilters([...savedFilters, newFilter]);
      setFilterName('');
      setShowSaveFilter(false);
    }
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    setSearchTerm(filter.filters.searchTerm);
    setStatusFilter(filter.filters.statusFilter);
    setProductTypeFilter(filter.filters.productTypeFilter);
    setPriorityFilter(filter.filters.priorityFilter);
    setDateFrom(filter.filters.dateFrom);
    setDateTo(filter.filters.dateTo);
    setCurrentPage(1);
  };

  const handleDeleteFilter = (id: string) => {
    setSavedFilters(savedFilters.filter(f => f.id !== id));
  };

  const handleBulkAction = (action: string) => {
    if (selectedOrders.length === 0) {
      alert('Please select orders first');
      return;
    }
    alert(`Bulk action "${action}" applied to ${selectedOrders.length} order(s)`);
    setSelectedOrders([]);
  };

  // New order management handlers
  const handleCreateOrder = () => {
    if (!formData.companyName || !formData.doctorClinicAddress || formProducts.length === 0) {
      alert('Please fill in all required fields and add at least one product');
      return;
    }
    
    const newOrder: Order = {
      orderId: `ORD${String(orders.length + 1).padStart(3, '0')}`,
      companyName: formData.companyName || '',
      doctorClinicAddress: formData.doctorClinicAddress || '',
      dateRegistered: new Date().toISOString().split('T')[0],
      orderStatus: 'Pending',
      productType: formData.productType || 'Medical Equipment',
      quantity: formProducts.reduce((sum, p) => sum + p.quantity, 0),
      totalAmount: formProducts.reduce((sum, p) => sum + p.total, 0),
      priority: (formData.priority as Order['priority']) || 'Medium',
      products: formProducts,
      contactPerson: formData.contactPerson,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      notes: formData.notes,
      statusHistory: [{
        status: 'Pending',
        timestamp: new Date().toLocaleString(),
        changedBy: 'Admin User',
        notes: 'Order created'
      }]
    };
    
    setOrders([...orders, newOrder]);
    setShowCreateModal(false);
    resetForm();
    alert('Order created successfully!');
  };

  const handleEditOrder = () => {
    if (!selectedOrder) return;
    
    const updatedOrders = orders.map(order => {
      if (order.orderId === selectedOrder.orderId) {
        return {
          ...order,
          ...formData,
          products: formProducts,
          quantity: formProducts.reduce((sum, p) => sum + p.quantity, 0),
          totalAmount: formProducts.reduce((sum, p) => sum + p.total, 0)
        };
      }
      return order;
    });
    
    setOrders(updatedOrders);
    setShowEditModal(false);
    resetForm();
    alert('Order updated successfully!');
  };

  const handleStatusChange = (orderId: string, newStatus: Order['orderStatus']) => {
    const updatedOrders = orders.map(order => {
      if (order.orderId === orderId) {
        const newHistory: StatusHistory = {
          status: newStatus,
          timestamp: new Date().toLocaleString(),
          changedBy: 'Admin User',
          notes: `Status changed to ${newStatus}`
        };
        return {
          ...order,
          orderStatus: newStatus,
          statusHistory: [...(order.statusHistory || []), newHistory]
        };
      }
      return order;
    });
    
    setOrders(updatedOrders);
    alert(`Order status changed to ${newStatus}`);
  };

  const handleCancelOrder = () => {
    if (!selectedOrder || !cancellationReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }
    
    const updatedOrders = orders.map(order => {
      if (order.orderId === selectedOrder.orderId) {
        const newHistory: StatusHistory = {
          status: 'Cancelled',
          timestamp: new Date().toLocaleString(),
          changedBy: 'Admin User',
          notes: `Order cancelled. Reason: ${cancellationReason}`
        };
        return {
          ...order,
          orderStatus: 'Cancelled' as Order['orderStatus'],
          cancellationReason,
          statusHistory: [...(order.statusHistory || []), newHistory]
        };
      }
      return order;
    });
    
    setOrders(updatedOrders);
    setShowCancelModal(false);
    setCancellationReason('');
    setSelectedOrder(null);
    alert('Order cancelled successfully');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (order: Order) => {
    setSelectedOrder(order);
    setFormData(order);
    setFormProducts(order.products || []);
    setShowEditModal(true);
  };

  const openDetailsModal = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const openCancelModal = (order: Order) => {
    setSelectedOrder(order);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const resetForm = () => {
    setFormData({});
    setFormProducts([]);
    setSelectedOrder(null);
  };

  const addProduct = useCallback(() => {
    setFormProducts(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', quantity: 1, unitPrice: 0, total: 0 }
    ]);
  }, []);

  const updateProduct = useCallback((id: string, field: keyof Product, value: string | number) => {
    setFormProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return p;
    }));
  }, []);

  const removeProduct = useCallback((id: string) => {
    setFormProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const getStatusColor = (status: Order['orderStatus']) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Processing': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Packaging': 'bg-purple-100 text-purple-800',
      'Shipped': 'bg-indigo-100 text-indigo-800',
      'Delivered': 'bg-green-200 text-green-900',
      'Rejected': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: Order['priority']) => {
    const colors = {
      'Low': 'text-gray-600',
      'Medium': 'text-blue-600',
      'High': 'text-orange-600',
      'Urgent': 'text-red-600 font-bold'
    };
    return colors[priority];
  };

  const SortButton: React.FC<{ field: keyof Order; label: string }> = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {label}
      <span className="text-xs">
        {sortField === field ? (
          sortDirection === 'asc' ? '▲' : '▼'
        ) : (
          <span className="text-gray-400">⇅</span>
        )}
      </span>
    </button>
  );

  // Modal Components - handlers
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    resetForm();
  }, []);

  // Handler for closing details modal
  const handleCloseDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
  }, []);

  // Handler for closing cancel modal
  const handleCloseCancelModal = useCallback(() => {
    setShowCancelModal(false);
    setCancellationReason('');
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Create New Order</h2>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address *
                      </label>
                      <input
                        type="text"
                        value={formData.doctorClinicAddress || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctorClinicAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.contactEmail || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="+1-555-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority || 'Medium'}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Order['priority'] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">Products *</h3>
                    <button
                      onClick={addProduct}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      + Add Product
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formProducts.map((product) => (
                      <div key={product.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Product name"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            min="1"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-gray-600 mb-1">Unit Price (₹)</label>
                          <input
                            type="number"
                            value={product.unitPrice}
                            onChange={(e) => updateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-gray-600 mb-1">Total (₹)</label>
                          <input
                            type="text"
                            value={product.total.toFixed(2)}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {formProducts.length > 0 && (
                    <div className="mt-3 text-right">
                      <span className="text-lg font-bold text-gray-800">
                        Total: ₹{formProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCloseCreateModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateOrder}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Create Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Edit Order</h2>
                <button
                  onClick={handleCloseEditModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address *
                      </label>
                      <input
                        type="text"
                        value={formData.doctorClinicAddress || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctorClinicAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.contactEmail || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="+1-555-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority || 'Medium'}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Order['priority'] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">Products *</h3>
                    <button
                      onClick={addProduct}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      + Add Product
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formProducts.map((product) => (
                      <div key={product.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Product name"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            min="1"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-gray-600 mb-1">Unit Price (₹)</label>
                          <input
                            type="number"
                            value={product.unitPrice}
                            onChange={(e) => updateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-gray-600 mb-1">Total (₹)</label>
                          <input
                            type="text"
                            value={product.total.toFixed(2)}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {formProducts.length > 0 && (
                    <div className="mt-3 text-right">
                      <span className="text-lg font-bold text-gray-800">
                        Total: ₹{formProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCloseEditModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditOrder}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Update Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Order Details</h2>
                <button
                  onClick={handleCloseDetailsModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Order ID</label>
                    <p className="text-lg font-semibold text-gray-800">{selectedOrder.orderId}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Status</label>
                    <p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.orderStatus)}`}>
                        {selectedOrder.orderStatus}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Company Name</label>
                    <p className="text-gray-800">{selectedOrder.companyName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Priority</label>
                    <p className={`font-medium ${getPriorityColor(selectedOrder.priority)}`}>
                      {selectedOrder.priority}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-500">Address</label>
                    <p className="text-gray-800">{selectedOrder.doctorClinicAddress}</p>
                  </div>
                  {selectedOrder.contactPerson && (
                    <div>
                      <label className="text-sm text-gray-500">Contact Person</label>
                      <p className="text-gray-800">{selectedOrder.contactPerson}</p>
                    </div>
                  )}
                  {selectedOrder.contactEmail && (
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-800">{selectedOrder.contactEmail}</p>
                    </div>
                  )}
                  {selectedOrder.contactPhone && (
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-gray-800">{selectedOrder.contactPhone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-500">Date Registered</label>
                    <p className="text-gray-800">{selectedOrder.dateRegistered}</p>
                  </div>
                </div>

                {/* Products */}
                {selectedOrder.products && selectedOrder.products.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Products</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Product</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedOrder.products.map((product) => (
                            <tr key={product.id}>
                              <td className="px-4 py-2 text-sm text-gray-800">{product.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-800 text-right">{product.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-800 text-right">₹{product.unitPrice.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-800 text-right">₹{product.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-700">Grand Total:</td>
                            <td className="px-4 py-2 text-right font-bold text-gray-900">₹{selectedOrder.totalAmount.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Status History Timeline */}
                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Order Timeline</h3>
                    <div className="space-y-3">
                      {selectedOrder.statusHistory.map((history, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${index === selectedOrder.statusHistory!.length - 1 ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                            {index < selectedOrder.statusHistory!.length - 1 && (
                              <div className="w-0.5 h-full bg-gray-300 my-1"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex justify-between items-start">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(history.status as Order['orderStatus'])}`}>
                                {history.status}
                              </span>
                              <span className="text-xs text-gray-500">{history.timestamp}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">Changed by: {history.changedBy}</p>
                            {history.notes && <p className="text-sm text-gray-700 mt-1">{history.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Notes</h3>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Cancellation Reason */}
                {selectedOrder.cancellationReason && (
                  <div>
                    <h3 className="text-lg font-semibold text-red-700 mb-2">Cancellation Reason</h3>
                    <p className="text-gray-700 bg-red-50 p-3 rounded-lg border border-red-200">{selectedOrder.cancellationReason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {selectedOrder.orderStatus !== 'Cancelled' && selectedOrder.orderStatus !== 'Delivered' && (
                    <>
                      <button
                        onClick={() => {
                          handleCloseDetailsModal();
                          openEditModal(selectedOrder);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        Edit Order
                      </button>
                      
                      {/* Status Change Dropdown */}
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStatusChange(selectedOrder.orderId, e.target.value as Order['orderStatus']);
                            handleCloseDetailsModal();
                          }
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <option value="">Change Status...</option>
                        {selectedOrder.orderStatus !== 'Processing' && <option value="Processing">Processing</option>}
                        {selectedOrder.orderStatus !== 'Approved' && <option value="Approved">Approved</option>}
                        {selectedOrder.orderStatus !== 'Packaging' && <option value="Packaging">Packaging</option>}
                        {selectedOrder.orderStatus !== 'Shipped' && <option value="Shipped">Shipped</option>}
                        {(selectedOrder.orderStatus as Order['orderStatus']) !== 'Delivered' && <option value="Delivered">Delivered</option>}
                        {selectedOrder.orderStatus !== 'Rejected' && <option value="Rejected">Rejected</option>}
                      </select>
                      
                      <button
                        onClick={() => {
                          handleCloseDetailsModal();
                          openCancelModal(selectedOrder);
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Cancel Order
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleCloseDetailsModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-red-600 mb-4">Cancel Order</h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to cancel order <strong>{selectedOrder.orderId}</strong>?
                This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Please provide a reason for cancellation..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseCancelModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  No, Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Yes, Cancel Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Total Orders</div>
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Processing</div>
          <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Shipped</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.shipped}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Delivered</div>
          <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {/* Header with Filter Toggle */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Order Management</h2>
          <div className="flex gap-2">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              + Create New Order
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className={`p-4 border-b bg-gray-50 ${showFilters ? 'block' : 'hidden md:block'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Quick Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Order ID, Company, Product..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Approved">Approved</option>
                <option value="Packaging">Packaging</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Product Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Type
              </label>
              <select
                value={productTypeFilter}
                onChange={(e) => {
                  setProductTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Products</option>
                <option value="Medical Equipment">Medical Equipment</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Diagnostic Tools">Diagnostic Tools</option>
                <option value="Medical Supplies">Medical Supplies</option>
                <option value="Surgical Instruments">Surgical Instruments</option>
                <option value="Lab Equipment">Lab Equipment</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear All Filters
            </button>
            <button
              onClick={() => setShowSaveFilter(!showSaveFilter)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {showSaveFilter ? 'Cancel Save' : 'Save Current Filter'}
            </button>
          </div>

          {/* Save Filter Form */}
          {showSaveFilter && (
            <div className="mt-4 p-4 bg-white rounded-lg border">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g., High Priority Pending Orders"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveFilter}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Saved Filters</h3>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map(filter => (
                  <div key={filter.id} className="flex items-center gap-1 bg-blue-100 px-3 py-1 rounded-full">
                    <button
                      onClick={() => handleLoadFilter(filter)}
                      className="text-blue-700 hover:text-blue-900 font-medium"
                    >
                      {filter.name}
                    </button>
                    <button
                      onClick={() => handleDeleteFilter(filter.id)}
                      className="text-red-600 hover:text-red-800 ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <div className="p-4 bg-blue-50 border-b flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedOrders.length} order(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('Approve')}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction('Reject')}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Reject Selected
              </button>
              <button
                onClick={() => handleBulkAction('Export')}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Export Selected
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === currentRecords.length && currentRecords.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="orderId" label="Order ID" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="companyName" label="Company" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="productType" label="Product Type" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="quantity" label="Quantity" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="totalAmount" label="Amount" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="priority" label="Priority" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="dateRegistered" label="Date" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <SortButton field="orderStatus" label="Status" />
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentRecords.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.orderId)}
                      onChange={() => handleSelectOrder(order.orderId)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderId}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.companyName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.productType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">₹{order.totalAmount.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${getPriorityColor(order.priority)}`}>
                    {order.priority}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.dateRegistered}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                      {order.orderStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openDetailsModal(order)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                        title="View Details"
                      >
                        View
                      </button>
                      {order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Delivered' && (
                        <>
                          <button
                            onClick={() => openEditModal(order)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                            title="Edit Order"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openCancelModal(order)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                            title="Cancel Order"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {currentRecords.map((order) => (
            <div key={order.orderId} className="p-4 hover:bg-gray-50">
              <div className="flex items-start gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.orderId)}
                  onChange={() => handleSelectOrder(order.orderId)}
                  className="mt-1 rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-gray-900">{order.orderId}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                      {order.orderStatus}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <div><strong>Company:</strong> {order.companyName}</div>
                    <div><strong>Product:</strong> {order.productType}</div>
                    <div><strong>Quantity:</strong> {order.quantity}</div>
                    <div><strong>Amount:</strong> ₹{order.totalAmount.toLocaleString()}</div>
                    <div className="flex justify-between">
                      <span><strong>Priority:</strong> <span className={getPriorityColor(order.priority)}>{order.priority}</span></span>
                      <span><strong>Date:</strong> {order.dateRegistered}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{order.doctorClinicAddress}</div>
                  </div>
                  {/* Mobile Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => openDetailsModal(order)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      View Details
                    </button>
                    {order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Delivered' && (
                      <>
                        <button
                          onClick={() => openEditModal(order)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openCancelModal(order)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, sortedOrders.length)} of {sortedOrders.length} orders
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-white border rounded-lg">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTable;