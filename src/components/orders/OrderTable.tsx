import React, { useState, useCallback, useEffect } from 'react';
import { UnifiedBadge, getStatusBadgeColor } from '../ui';
import { useGlobalState } from '../../context/GlobalStateContext';

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

// SortButton component - extracted outside to avoid re-creation during render
interface OrderSortButtonProps {
  field: keyof Order;
  label: string;
  sortField: keyof Order | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Order) => void;
}

const OrderSortButton: React.FC<OrderSortButtonProps> = ({
  field,
  label,
  sortField,
  sortDirection,
  onSort
}) => (
  <button
    onClick={() => onSort(field)}
    className="flex items-center gap-1 hover:text-brand transition-colors"
  >
    {label}
    <span className="text-xs">
      {sortField === field ? (
        sortDirection === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-ink-4">⇅</span>
      )}
    </span>
  </button>
);

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
  const { state, dispatch } = useGlobalState();
  const customerPOs = state.orders?.customerPOs || [];

  // Map GlobalState customerPOs to the local Order format for initial state
  const initialMappedOrders: Order[] = customerPOs.map((po: any) => ({
    orderId: po.po,
    companyName: po.client,
    doctorClinicAddress: 'Mapped from Global State', // This might need to be fetched from po details if available
    dateRegistered: po.createdAt,
    orderStatus: po.status === 'so_created' ? 'Approved' : po.status === 'payment_pending' ? 'Pending' : po.status === 'cancelled' ? 'Cancelled' : 'Processing', // Basic translation
    productType: po.products?.[0]?.product || 'Mixed', // Simplified mapping
    quantity: po.products?.reduce((sum: number, p: any) => sum + (p.qty || 0), 0) || 0,
    totalAmount: po.value,
    priority: 'Medium', // Defaulting for now
    contactPerson: po.bdRep || 'N/A',
    products: po.products?.map((p: any) => ({
      id: p.product, // Using product name as ID for simplicity
      name: p.product,
      quantity: p.qty,
      unitPrice: p.unitPrice,
      total: p.lineValue
    })) || [],
    statusHistory: [{
      status: po.status === 'so_created' ? 'Approved' : po.status === 'payment_pending' ? 'Pending' : po.status === 'cancelled' ? 'Cancelled' : 'Processing',
      timestamp: po.createdAt,
      changedBy: 'System',
      notes: 'Initial status from global state'
    }]
  }));

  const [orders, setOrders] = useState<Order[]>(initialMappedOrders);

  useEffect(() => {
    // Update local orders state when global customerPOs change
    const mappedOrders: Order[] = customerPOs.map((po: any) => ({
      orderId: po.po,
      companyName: po.client,
      doctorClinicAddress: 'Mapped from Global State',
      dateRegistered: po.createdAt,
      orderStatus: po.status === 'so_created' ? 'Approved' : po.status === 'payment_pending' ? 'Pending' : po.status === 'cancelled' ? 'Cancelled' : 'Processing', // Basic translation
      productType: po.products?.[0]?.product || 'Mixed', // Simplified mapping
      quantity: po.products?.reduce((sum: number, p: any) => sum + (p.qty || 0), 0) || 0,
      totalAmount: po.value,
      priority: 'Medium', // Defaulting for now
      contactPerson: po.bdRep || 'N/A',
      products: po.products?.map((p: any) => ({
        id: p.product,
        name: p.product,
        quantity: p.qty,
        unitPrice: p.unitPrice,
        total: p.lineValue
      })) || [],
      statusHistory: [{
        status: po.status === 'so_created' ? 'Approved' : po.status === 'payment_pending' ? 'Pending' : po.status === 'cancelled' ? 'Cancelled' : 'Processing',
        timestamp: po.createdAt,
        changedBy: 'System',
        notes: 'Initial status from global state'
      }]
    }));
    setOrders(mappedOrders);
  }, [customerPOs]);

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

    // Dispatch to GlobalState
    dispatch({
      type: 'ADD_CUSTOMER_PO', payload: {
        po: newOrder.orderId,
        client: newOrder.companyName,
        createdAt: newOrder.dateRegistered,
        status: 'payment_pending', // Default status for new orders
        value: newOrder.totalAmount,
        products: newOrder.products?.map(p => ({ product: p.name, qty: p.quantity, unitPrice: p.unitPrice, lineValue: p.total })) || []
      }
    });

    setShowCreateModal(false);
    resetForm();
    alert('Order created successfully!');
  };

  const handleEditOrder = () => {
    if (!selectedOrder) return;

    const updatedOrderData = {
      ...selectedOrder,
      ...formData,
      products: formProducts,
      quantity: formProducts.reduce((sum, p) => sum + p.quantity, 0),
      totalAmount: formProducts.reduce((sum, p) => sum + p.total, 0)
    };

    // Dispatch to GlobalState
    dispatch({
      type: 'UPDATE_CUSTOMER_PO', payload: {
        poId: updatedOrderData.orderId,
        updatedFields: {
          client: updatedOrderData.companyName,
          // Assuming doctorClinicAddress, contactPerson, contactEmail, contactPhone, notes are part of the PO details in global state
          // If not, these fields might need a different dispatch or be handled locally only.
          // For now, mapping to common fields.
          doctorClinicAddress: updatedOrderData.doctorClinicAddress,
          bdRep: updatedOrderData.contactPerson, // Assuming bdRep maps to contactPerson
          value: updatedOrderData.totalAmount,
          products: updatedOrderData.products?.map(p => ({ product: p.name, qty: p.quantity, unitPrice: p.unitPrice, lineValue: p.total })) || [],
          status: updatedOrderData.orderStatus === 'Pending' ? 'payment_pending' : updatedOrderData.orderStatus === 'Approved' ? 'so_created' : updatedOrderData.orderStatus.toLowerCase() // Map back to global state status format
        }
      }
    });

    setShowEditModal(false);
    resetForm();
    alert('Order updated successfully!');
  };

  const handleStatusChange = (orderId: string, newStatus: Order['orderStatus']) => {
    // Dispatch status update
    dispatch({ type: 'UPDATE_PO_STATUS', payload: { poId: orderId, status: newStatus.toLowerCase() } });

    alert(`Order status changed to ${newStatus}`);
  };

  // Handler for opening cancel modal - used in the orders table action menu
  void handleStatusChange; // Suppress unused warning - kept for future use

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

  // Keep handlers that are used elsewhere or for future functionality
  void openCreateModal;
  void openEditModal;
  void openCancelModal;

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

  const getPriorityColor = (priority: Order['priority']) => {
    const colors = {
      'Low': 'text-ink-4',
      'Medium': 'text-brand',
      'High': 'text-ink',
      'Urgent': 'text-err font-bold'
    };
    return colors[priority];
  };

  // Modal Components - handlers
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    resetForm();
  }, [resetForm]);

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
    <div className="p-6 bg-surface-3 min-h-screen">
      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="create-order-modal-title">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 id="create-order-modal-title" className="text-2xl font-bold text-ink">Create New Order</h2>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-ink-3 hover:text-ink-2 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold text-ink-2 mb-3">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Enter company name"
                        aria-label="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Address *
                      </label>
                      <input
                        type="text"
                        value={formData.doctorClinicAddress || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctorClinicAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Enter address"
                        aria-label="Enter address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Contact person name"
                        aria-label="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.contactEmail || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="email@example.com"
                        aria-label="Email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="+1-555-0000"
                        aria-label="Phone"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority || 'Medium'}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Order['priority'] }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        aria-label="Priority"
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
                    <h3 className="text-lg font-semibold text-ink-2">Products *</h3>
                    <button
                      onClick={addProduct}
                      className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-sm"
                    >
                      + Add Product
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formProducts.map((product) => (
                      <div key={product.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-ink-4 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            placeholder="Product name"
                            aria-label="Product name"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-ink-4 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            min="1"
                            aria-label="Quantity"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-ink-4 mb-1">Unit Price (₹)</label>
                          <input
                            type="number"
                            value={product.unitPrice}
                            onChange={(e) => updateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            min="0"
                            step="0.01"
                            aria-label="Unit Price (₹)"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-ink-4 mb-1">Total (₹)</label>
                          <input
                            type="text"
                            value={product.total.toFixed(2)}
                            readOnly
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-3 text-sm"
                            aria-label="Total (₹)"
                          />
                        </div>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="px-3 py-2 bg-err text-white rounded hover:bg-err text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {formProducts.length > 0 && (
                    <div className="mt-3 text-right">
                      <span className="text-lg font-bold text-ink">
                        Total: ₹{formProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                    aria-label="Notes"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCloseCreateModal}
                    className="px-6 py-2 border border-border rounded-lg hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateOrder}
                    className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-press"
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
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="edit-order-modal-title">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 id="edit-order-modal-title" className="text-2xl font-bold text-ink">Edit Order</h2>
                <button
                  onClick={handleCloseEditModal}
                  className="text-ink-3 hover:text-ink-2 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold text-ink-2 mb-3">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Enter company name"
                        aria-label="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Address *
                      </label>
                      <input
                        type="text"
                        value={formData.doctorClinicAddress || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctorClinicAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Enter address"
                        aria-label="Enter address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="Contact person name"
                        aria-label="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.contactEmail || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="email@example.com"
                        aria-label="Email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        placeholder="+1-555-0000"
                        aria-label="Phone"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority || 'Medium'}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Order['priority'] }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                        aria-label="Priority"
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
                    <h3 className="text-lg font-semibold text-ink-2">Products *</h3>
                    <button
                      onClick={addProduct}
                      className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-sm"
                    >
                      + Add Product
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formProducts.map((product) => (
                      <div key={product.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-ink-4 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            placeholder="Product name"
                            aria-label="Product name"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-ink-4 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            min="1"
                            aria-label="Quantity"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-ink-4 mb-1">Unit Price (₹)</label>
                          <input
                            type="number"
                            value={product.unitPrice}
                            onChange={(e) => updateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                            min="0"
                            step="0.01"
                            aria-label="Unit Price (₹)"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-ink-4 mb-1">Total (₹)</label>
                          <input
                            type="text"
                            value={product.total.toFixed(2)}
                            readOnly
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-3 text-sm"
                            aria-label="Total (₹)"
                          />
                        </div>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="px-3 py-2 bg-err text-white rounded hover:bg-err text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {formProducts.length > 0 && (
                    <div className="mt-3 text-right">
                      <span className="text-lg font-bold text-ink">
                        Total: ₹{formProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                    aria-label="Notes"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCloseEditModal}
                    className="px-6 py-2 border border-border rounded-lg hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditOrder}
                    className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-press"
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
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="details-order-modal-title">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 id="details-order-modal-title" className="text-2xl font-bold text-ink">Order Details</h2>
                <button
                  onClick={handleCloseDetailsModal}
                  className="text-ink-3 hover:text-ink-2 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-ink-3">Order ID</label>
                    <p className="text-lg font-semibold text-ink">{selectedOrder.orderId}</p>
                  </div>
                  <div>
                    <label className="text-sm text-ink-3">Status</label>
                    <p>
                      <UnifiedBadge variant={getStatusBadgeColor(selectedOrder.orderStatus)}>
                        {selectedOrder.orderStatus}
                      </UnifiedBadge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-ink-3">Company Name</label>
                    <p className="text-ink">{selectedOrder.companyName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-ink-3">Priority</label>
                    <p className={`font - medium ${getPriorityColor(selectedOrder.priority)} `}>
                      {selectedOrder.priority}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-ink-3">Address</label>
                    <p className="text-ink">{selectedOrder.doctorClinicAddress}</p>
                  </div>
                  {selectedOrder.contactPerson && (
                    <div>
                      <label className="text-sm text-ink-3">Contact Person</label>
                      <p className="text-ink">{selectedOrder.contactPerson}</p>
                    </div>
                  )}
                  {selectedOrder.contactEmail && (
                    <div>
                      <label className="text-sm text-ink-3">Email</label>
                      <p className="text-ink">{selectedOrder.contactEmail}</p>
                    </div>
                  )}
                  {selectedOrder.contactPhone && (
                    <div>
                      <label className="text-sm text-ink-3">Phone</label>
                      <p className="text-ink">{selectedOrder.contactPhone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-ink-3">Date Registered</label>
                    <p className="text-ink">{selectedOrder.dateRegistered}</p>
                  </div>
                </div>

                {/* Products */}
                {selectedOrder.products && selectedOrder.products.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-ink-2 mb-3">Products</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-surface-3">
                          <tr>
                            <th scope="col" className="px-4 py-2 text-left text-sm font-semibold text-ink-2">Product</th>
                            <th scope="col" className="px-4 py-2 text-right text-sm font-semibold text-ink-2">Quantity</th>
                            <th scope="col" className="px-4 py-2 text-right text-sm font-semibold text-ink-2">Unit Price</th>
                            <th scope="col" className="px-4 py-2 text-right text-sm font-semibold text-ink-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedOrder.products.map((product) => (
                            <tr key={product.id}>
                              <td className="px-4 py-2 text-sm text-ink">{product.name}</td>
                              <td className="px-4 py-2 text-sm text-ink text-right">{product.quantity}</td>
                              <td className="px-4 py-2 text-sm text-ink text-right">₹{product.unitPrice.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-ink text-right">₹{product.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-3">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-right font-semibold text-ink-2">Grand Total:</td>
                            <td className="px-4 py-2 text-right font-bold text-ink">₹{selectedOrder.totalAmount.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Status History Timeline */}
                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-ink-2 mb-3">Order Timeline</h3>
                    <div className="space-y-3">
                      {selectedOrder.statusHistory.map((history, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w - 3 h - 3 rounded - full ${index === selectedOrder.statusHistory!.length - 1 ? 'bg-brand' : 'bg-ink-4'} `}></div>
                            {index < selectedOrder.statusHistory!.length - 1 && (
                              <div className="w-0.5 h-full bg-surface-3 my-1"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex justify-between items-start">
                              <UnifiedBadge variant={getStatusBadgeColor(history.status as Order['orderStatus'])}>
                                {history.status}
                              </UnifiedBadge>
                              <span className="text-xs text-ink-3">{history.timestamp}</span>
                            </div>
                            <p className="text-sm text-ink-4 mt-1">Changed by: {history.changedBy}</p>
                            {history.notes && <p className="text-sm text-ink-2 mt-1">{history.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-ink-2 mb-2">Notes</h3>
                    <p className="text-ink-2 bg-surface-3 p-3 rounded-lg">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Cancellation Reason */}
                {selectedOrder.cancellationReason && (
                  <div>
                    <h3 className="text-lg font-semibold text-err mb-2">Cancellation Reason</h3>
                    <p className="text-ink-2 bg-err-soft p-3 rounded-lg border border-[color:var(--st-red-fg)]/30">{selectedOrder.cancellationReason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseDetailsModal}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-surface-2"
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
          <div className="bg-white rounded-lg w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="cancel-order-modal-title">
            <div className="p-6">
              <h2 id="cancel-order-modal-title" className="text-xl font-bold text-err mb-4">Cancel Order</h2>
              <p className="text-ink-2 mb-4">
                Are you sure you want to cancel order <strong>{selectedOrder.orderId}</strong>?
                This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-2 mb-2">
                  Cancellation Reason *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--st-red-fg)]"
                  rows={3}
                  placeholder="Please provide a reason for cancellation..."
                  aria-label="Cancellation reason"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseCancelModal}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-surface-2"
                >
                  No, Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  className="px-4 py-2 bg-err text-white rounded-lg hover:bg-err"
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
          <div className="text-ink-3 text-sm">Total Orders</div>
          <div className="text-2xl font-bold text-ink">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-ink-3 text-sm">Pending</div>
          <div className="text-2xl font-bold text-warn">{stats.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-ink-3 text-sm">Processing</div>
          <div className="text-2xl font-bold text-brand">{stats.processing}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-ink-3 text-sm">Shipped</div>
          <div className="text-2xl font-bold text-brand">{stats.shipped}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-ink-3 text-sm">Delivered</div>
          <div className="text-2xl font-bold text-ok">{stats.delivered}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {/* Header with Filter Toggle */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-ink">Order Tracker</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-press"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {/* Advanced Filters */}
        <div className={`p - 4 border - b bg - slate - 50 ${showFilters ? 'block' : 'hidden md:block'} `}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Quick Search */}
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
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
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Search by Order ID, Company, Product..."
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Order Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Order Status"
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
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Product Type
              </label>
              <select
                value={productTypeFilter}
                onChange={(e) => {
                  setProductTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Product Type"
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
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Priority"
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
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Date From"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                aria-label="Date To"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-surface-3 text-ink-2 rounded-lg hover:bg-surface-3 transition-colors"
            >
              Clear All Filters
            </button>
            <button
              onClick={() => setShowSaveFilter(!showSaveFilter)}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-press transition-colors"
            >
              {showSaveFilter ? 'Cancel Save' : 'Save Current Filter'}
            </button>
          </div>

          {/* Save Filter Form */}
          {showSaveFilter && (
            <div className="mt-4 p-4 bg-white rounded-lg border">
              <label className="block text-sm font-medium text-ink-2 mb-2">
                Filter Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g., High Priority Pending Orders"
                  className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]"
                  aria-label="Filter Name"
                />
                <button
                  onClick={handleSaveFilter}
                  className="px-4 py-2 bg-ok text-white rounded-lg hover:bg-ok"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink-3 mb-2">Saved Filters</h3>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map(filter => (
                  <div key={filter.id} className="flex items-center gap-1 bg-brand-soft px-3 py-1 rounded-full">
                    <button
                      onClick={() => handleLoadFilter(filter)}
                      className="text-brand hover:text-brand font-medium"
                    >
                      {filter.name}
                    </button>
                    <button
                      onClick={() => handleDeleteFilter(filter.id)}
                      className="text-err hover:text-err ml-1"
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
          <div className="p-4 bg-brand-soft border-b flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-ink-2">
              {selectedOrders.length} order(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('Approve')}
                className="px-3 py-1 bg-ok text-white rounded hover:bg-ok text-sm"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction('Reject')}
                className="px-3 py-1 bg-err text-white rounded hover:bg-err text-sm"
              >
                Reject Selected
              </button>
              <button
                onClick={() => handleBulkAction('Export')}
                className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-sm"
              >
                Export Selected
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-3 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === currentRecords.length && currentRecords.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-border"
                    aria-label="Select all orders"
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="orderId" label="Order ID" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="companyName" label="Company" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="productType" label="Product Type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="quantity" label="Quantity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="totalAmount" label="Amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="priority" label="Priority" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="dateRegistered" label="Date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-ink-2">
                  <OrderSortButton field="orderStatus" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-ink-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {currentRecords.map((order) => (
                <tr key={order.orderId} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.orderId)}
                      onChange={() => handleSelectOrder(order.orderId)}
                      className="rounded border-border"
                      aria-label={`Select order ${order.orderId}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-ink">{order.orderId}</td>
                  <td className="px-4 py-3 text-sm text-ink-2">{order.companyName}</td>
                  <td className="px-4 py-3 text-sm text-ink-2">{order.productType}</td>
                  <td className="px-4 py-3 text-sm text-ink-2">{order.quantity}</td>
                  <td className="px-4 py-3 text-sm text-ink-2 font-medium">₹{order.totalAmount.toLocaleString()}</td>
                  <td className={`px - 4 py - 3 text - sm font - medium ${getPriorityColor(order.priority)} `}>
                    {order.priority}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-2">{order.dateRegistered}</td>
                  <td className="px-4 py-3">
                    <UnifiedBadge variant={getStatusBadgeColor(order.orderStatus)}>
                      {order.orderStatus}
                    </UnifiedBadge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openDetailsModal(order)}
                        className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-xs"
                        title="View Details"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-hairline">
          {currentRecords.map((order) => (
            <div key={order.orderId} className="p-4 hover:bg-surface-2">
              <div className="flex items-start gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.orderId)}
                  onChange={() => handleSelectOrder(order.orderId)}
                  className="mt-1 rounded border-border"
                  aria-label={`Select order ${order.orderId}`}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-ink">{order.orderId}</span>
                    <UnifiedBadge variant={getStatusBadgeColor(order.orderStatus)}>
                      {order.orderStatus}
                    </UnifiedBadge>
                  </div>
                  <div className="space-y-1 text-sm text-ink-3">
                    <div><strong>Company:</strong> {order.companyName}</div>
                    <div><strong>Product:</strong> {order.productType}</div>
                    <div><strong>Quantity:</strong> {order.quantity}</div>
                    <div><strong>Amount:</strong> ₹{order.totalAmount.toLocaleString()}</div>
                    <div className="flex justify-between">
                      <span><strong>Priority:</strong> <span className={getPriorityColor(order.priority)}>{order.priority}</span></span>
                      <span><strong>Date:</strong> {order.dateRegistered}</span>
                    </div>
                    <div className="text-xs text-ink-3 mt-1">{order.doctorClinicAddress}</div>
                  </div>
                  {/* Mobile Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => openDetailsModal(order)}
                      className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-press text-xs"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-ink-3">
            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, sortedOrders.length)} of {sortedOrders.length} orders
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-surface-3 text-ink-2 rounded-lg hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-white border rounded-lg">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-surface-3 text-ink-2 rounded-lg hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
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