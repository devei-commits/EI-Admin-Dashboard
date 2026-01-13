import { useState, useEffect, useRef } from 'react';

// ==================== TYPES ====================
interface Order {
  id: string;
  orderNo: string;
  orderType: string;
  sku: string;
  itemName: string;
  qty: number;
  unitRate: string;
  odrDate: string;
  estDelDate: string;
  comDate: string;
  licenseArch: string;
  licenseEI: string;
  stage: string;
  currentStatus: string;
  pocForCurrentStatus: string;
  comments: string;
}

interface OrderReview {
  id: string;
  orderType: string;
  orderNo: string;
  productSku: string;
  compatibleItem: string;
  brandName: string;
  qty: number;
  unitRate: string;
  odrDate: string;
  estDate: string;
  pocCmtTeam?: string;
  pocRead: string;
  pocQuality: string;
  pocLabel: string;
  rmReview: string;
  pmReview: string;
  labelDesign: string;
  labelReview: string;
  rmSync: string;
  pmSync: string;
  licenseEI: string;
  licenseArch: string;
  mfgProcess: string;
  homogenizerProcess: string;
  approvalStatus: string;
  updatedOn: string;
  upstageNo: string;
  comments: string;
  s1Actions: string;
}

interface AuditLog {
  id: string;
  orderId: string;
  timestamp: string;
  user: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
}

// ==================== MOCK DATA (Replace with API call later) ====================
const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    orderNo: 'SO-02907_1',
    orderType: 'NEW ORDER',
    sku: 'SK2201MC5R',
    itemName: 'SK.MEN CORREXION SPOT RECTIFYING FACIAL SERUM FOR DARK SPOTS 30ML',
    qty: 3000,
    unitRate: '',
    odrDate: '2025-07-10',
    estDelDate: '2025-08-15',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'ORDERS REVIEW',
    currentStatus: 'UNDER REVIEW',
    pocForCurrentStatus: '*#S1 COMPLETED*',
    comments: '-'
  },
  {
    id: '2',
    orderNo: 'SO-02906_1',
    orderType: 'REORDER',
    sku: 'SK2201MEFC',
    itemName: 'SKINKRAFT MEN ACNE EXFOLIATING FACIAL CREAM FOR SEVERE ACNE 50ML',
    qty: 3000,
    unitRate: '',
    odrDate: '2025-07-10',
    estDelDate: '2025-08-15',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'no',
    stage: 'ORDERS REVIEW',
    currentStatus: 'UNDER REVIEW',
    pocForCurrentStatus: '*#S1 COMPLETED*',
    comments: '-'
  },
  {
    id: '3',
    orderNo: 'SO-02961_1',
    orderType: 'MODIFIED',
    sku: 'PR0006393',
    itemName: 'SOLGLO HYBRID SUNSCREEN SPF 70 PA ++++ 50 ML',
    qty: 20000,
    unitRate: '',
    odrDate: '2025-07-31',
    estDelDate: '2025-08-25',
    comDate: 'N/A',
    licenseArch: 'no',
    licenseEI: 'yes',
    stage: 'ORDERS REVIEW',
    currentStatus: 'UNDER REVIEW',
    pocForCurrentStatus: '*#S1 COMPLETED*',
    comments: '-'
  },
  {
    id: '4',
    orderNo: 'SO-02959_1',
    orderType: 'NEW ORDER',
    sku: 'SK2109NUFC',
    itemName: 'SKINKRAFT ULTRA SMOOTH FACE CLEANSER FOR SENSITIVE SKIN 100ML',
    qty: 3000,
    unitRate: '',
    odrDate: '2025-08-01',
    estDelDate: '2025-08-31',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'PURCHASE PLAN',
    currentStatus: 'UNDER PLANNING',
    pocForCurrentStatus: '*#S2 COMPLETED*',
    comments: '-'
  },
  {
    id: '5',
    orderNo: 'SO-02972_1',
    orderType: 'REORDER',
    sku: 'PR0004404',
    itemName: 'MEDIMANOR MOISTAR DEEP RESTORE CREAM-25GM',
    qty: 5000,
    unitRate: '',
    odrDate: '2025-08-06',
    estDelDate: '2025-08-31',
    comDate: 'N/A',
    licenseArch: 'yes',
    licenseEI: 'yes',
    stage: 'CONNECTIVITY TRACKER',
    currentStatus: 'UNDER SCHEDULE',
    pocForCurrentStatus: '*#S3 COMPLETED*',
    comments: '-'
  }
];

// ==================== API FUNCTIONS (To be implemented with backend) ====================
const fetchOrders = async (): Promise<Order[]> => {
  // TODO: Replace with actual API call
  // Example: const response = await fetch('/api/orders');
  // return response.json();
  
  // For now, return mock data
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_ORDERS), 500);
  });
};

const updateOrderEstDate = async (orderId: string, newDate: string): Promise<void> => {
  // TODO: Replace with actual API call
  // Example: await fetch(`/api/orders/${orderId}`, {
  //   method: 'PATCH',
  //   body: JSON.stringify({ estDelDate: newDate })
  // });
  
  console.log(`Update order ${orderId} with new date: ${newDate}`);
};

const updateOrderType = async (orderId: string, newType: string): Promise<void> => {
  // TODO: Replace with actual API call
  // Example: await fetch(`/api/orders/${orderId}`, {
  //   method: 'PATCH',
  //   body: JSON.stringify({ orderType: newType })
  // });
  
  console.log(`Update order ${orderId} with new type: ${newType}`);
};

const ORDER_TYPE_OPTIONS = ['NEW ORDER', 'REORDER', 'MODIFIED'] as const;

const OrderHub = () => {
  const [activeTab, setActiveTab] = useState('orders-tracker');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewOrders, setReviewOrders] = useState<OrderReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openOrderTypeDropdown, setOpenOrderTypeDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewHistoryOrderId, setViewHistoryOrderId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // ==================== CLICK OUTSIDE HANDLER ====================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenOrderTypeDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    loadOrders();
    loadReviewOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewOrders = async () => {
    setLoading(true);
    try {
      // Convert MOCK_ORDERS to OrderReview format for testing
      const reviewOrders: OrderReview[] = MOCK_ORDERS.map(order => ({
        id: order.id,
        orderType: order.orderType,
        orderNo: order.orderNo,
        productSku: order.sku,
        compatibleItem: order.itemName,
        brandName: 'HC/NET LIFESTYLE RETAIL PRIVATE LIMITED',
        qty: order.qty,
        unitRate: order.unitRate || '0.00',
        odrDate: order.odrDate,
        estDate: order.estDelDate,
        pocCmtTeam: 'PENDING',
        pocRead: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        pocQuality: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        pocLabel: order.pocForCurrentStatus.includes('S1') ? 'COMPLETED' : 'PENDING',
        rmReview: 'yes',
        pmReview: 'yes',
        labelDesign: 'yes',
        labelReview: 'yes',
        rmSync: 'yes',
        pmSync: 'yes',
        licenseEI: order.licenseEI,
        licenseArch: order.licenseArch,
        mfgProcess: 'yes',
        homogenizerProcess: 'yes',
        approvalStatus: order.currentStatus === 'UNDER REVIEW' ? 'PENDING' : 'COMPLETED',
        updatedOn: '',
        upstageNo: '',
        comments: order.comments,
        s1Actions: ''
      }));
      setReviewOrders(reviewOrders);
    } catch (error) {
      console.error('Failed to fetch review orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (orderId: string) => {
    try {
      // Mock audit logs - replace with actual API call
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          orderId: orderId,
          timestamp: '2026-01-14 10:30:00',
          user: 'John Doe',
          action: 'Updated',
          field: 'Order Type',
          oldValue: 'NEW ORDER',
          newValue: 'REORDER'
        },
        {
          id: '2',
          orderId: orderId,
          timestamp: '2026-01-14 09:15:00',
          user: 'Jane Smith',
          action: 'Updated',
          field: 'EST Date',
          oldValue: '2025-08-10',
          newValue: '2025-08-15'
        },
        {
          id: '3',
          orderId: orderId,
          timestamp: '2026-01-13 16:45:00',
          user: 'Admin User',
          action: 'Updated',
          field: 'Approval Status',
          oldValue: 'PENDING',
          newValue: 'COMPLETED'
        }
      ];
      setAuditLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  };

  const handleViewHistory = (orderId: string) => {
    setViewHistoryOrderId(orderId);
    loadAuditLogs(orderId);
  };

  const handleCloseHistory = () => {
    setViewHistoryOrderId(null);
    setAuditLogs([]);
  };

  // ==================== REAL-TIME CLOCK ====================

  // ==================== REAL-TIME CLOCK ====================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // ==================== UTILITY FUNCTIONS ====================
  const calculateTimeElapsed = (odrDate: string) => {
    const orderDate = new Date(odrDate);
    const now = currentTime;
    const diffMs = now.getTime() - orderDate.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  const handleDateChange = async (orderId: string, newDate: string) => {
    // Optimistically update UI
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, estDelDate: newDate } : order
    ));

    // Send update to backend
    try {
      await updateOrderEstDate(orderId, newDate);
    } catch (error) {
      console.error('Failed to update date:', error);
      // Revert on error
      loadOrders();
    }
  };

  const handleOrderTypeChange = async (orderId: string, newType: string) => {
    // Close the dropdown
    setOpenOrderTypeDropdown(null);
    
    // Optimistically update UI for both orders and reviewOrders
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, orderType: newType } : order
    ));
    
    setReviewOrders(reviewOrders.map(order => 
      order.id === orderId ? { ...order, orderType: newType } : order
    ));

    // Send update to backend
    try {
      await updateOrderType(orderId, newType);
    } catch (error) {
      console.error('Failed to update order type:', error);
      // Revert on error
      loadOrders();
      loadReviewOrders();
    }
  };

  const tabs = [
    { id: 'orders-tracker', label: 'Orders Tracker' },
    { id: 'orders-review', label: '#1 Orders Review' },
    { id: 'purchase-plan', label: '#2 Purchase Plan' },
    { id: 'purchase-planner', label: '#3 Purchase Planner' },
    { id: 'production-planner', label: '#4 Production Planner' },
    { id: 'production-tracker', label: '#5 Production Tracker' },
    { id: 'order-closure', label: '#6 Order Closure' },
  ];

  // Filter orders based on search query and status filter
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'OPEN' && order.currentStatus === 'OPEN') ||
      (statusFilter === 'IN_PROGRESS' && order.currentStatus === 'IN_PROGRESS') ||
      (statusFilter === 'COMPLETED' && order.currentStatus === 'COMPLETED') ||
      (statusFilter === 'PENDING' && order.currentStatus === 'PENDING');
    
    return matchesSearch && matchesStatus;
  });

  // Filter review orders based on search query and status filter
  const filteredReviewOrders = reviewOrders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.productSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.compatibleItem.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'OPEN' && order.approvalStatus === 'OPEN') ||
      (statusFilter === 'IN_PROGRESS' && order.approvalStatus === 'IN_PROGRESS') ||
      (statusFilter === 'COMPLETED' && order.approvalStatus === 'COMPLETED') ||
      (statusFilter === 'PENDING' && order.approvalStatus === 'PENDING');
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800">Order Hub</h1>
        </div>
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 bg-amber-50'
                  : 'border-transparent text-gray-600 hover:text-amber-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {activeTab === 'orders-tracker' && (
          <div>
            {/* Search and Filter Bar */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search by Item SKU</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="w-64">
                <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                >
                  <option value="ALL">ALL ORDERS</option>
                  <option value="OPEN">OPEN ORDERS</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="pt-5">
                <button className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Filter Items
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                </div>
              ) : (
                <div className="">
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-white">
                        <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-white">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-white">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-white">Order Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-64 z-20 bg-white">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-80 z-20 bg-white">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Unit Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">ODR Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">EST DEL Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">COM Date</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License ARCH</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License EI</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Time Elapsed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, index) => {
                      const elapsed = calculateTimeElapsed(order.odrDate);
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3.5 sticky left-0 z-10 bg-white hover:bg-gray-50">
                            <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-12 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                          <td className="px-4 py-3.5 sticky left-48 z-10 bg-white hover:bg-gray-50">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              order.orderType === 'REORDER' 
                                ? 'bg-blue-100 text-blue-700' 
                                : order.orderType === 'NEW ORDER'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.orderType}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-64 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-900 min-w-[300px] sticky left-80 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">₹{order.unitRate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <input
                              type="date"
                              value={order.estDelDate}
                              onChange={(e) => handleDateChange(order.id, e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.licenseArch === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {order.licenseArch}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.licenseEI === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {order.licenseEI}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{order.stage}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                              order.currentStatus === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                              order.currentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                              order.currentStatus === 'Pending' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{order.currentStatus}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex gap-1 justify-center">
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium" title="Days">
                                {elapsed.days}d
                              </span>
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium" title="Hours">
                                {elapsed.hours}h
                              </span>
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium" title="Minutes">
                                {elapsed.minutes}m
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.pocForCurrentStatus}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 max-w-[150px] truncate" title={order.comments}>{order.comments}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="View Details">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors" title="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}
        {activeTab === 'orders-review' && (
          <div>
            {/* Search and Filter Bar */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search by Item SKU</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="w-64">
                <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                >
                  <option value="ALL">ALL ORDERS</option>
                  <option value="OPEN">OPEN ORDERS</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="pt-5">
                <button className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Filter Items
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                </div>
              ) : (
                <div className="">
                  <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">
                          <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Order Type</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Order No</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Product SKU</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Compatible Item</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Brand Name</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Qty</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Unit Rate</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">ODR Date</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">EST Date</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_CMT_TEAM</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_R&D PRODUCT</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_QUALITY Compliance</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">POC_Label DESIGN</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">RM_REVIEW</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">PM_REVIEW</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">LABEL_DESIGN STATUS</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">LABEL_REVIEW (QC Status)</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">RM_SYNC</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">PM_SYNC</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License ARCH Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License EI Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MFG Process</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">HOMOGENIZER Process</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Approval Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Updatedon</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Upstage_no</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#Comments</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#S1_ACTIONS__</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviewOrders.map((order) => {
                      return (
                        <tr key={order.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${openOrderTypeDropdown === order.id ? 'relative z-[9998]' : ''}`}>
                          <td className="px-3 py-2.5 bg-white hover:bg-gray-50">
                            <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5" />
                          </td>
                          <td className={`px-3 py-2.5 whitespace-nowrap ${openOrderTypeDropdown === order.id ? 'static' : ''}`}>
                            <div className={`${openOrderTypeDropdown === order.id ? 'relative z-[9999]' : 'relative'} inline-block`}>
                              <button
                                data-order-id={order.id}
                                onClick={() => setOpenOrderTypeDropdown(openOrderTypeDropdown === order.id ? null : order.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                  order.orderType === 'REORDER' 
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                    : order.orderType === 'NEW ORDER'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                              >
                                <span>{order.orderType}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openOrderTypeDropdown === order.id && (
                                <div 
                                  ref={dropdownRef} 
                                  className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] min-w-[160px] flex flex-col"
                                >
                                  {ORDER_TYPE_OPTIONS.map((type) => (
                                    <button
                                      key={type}
                                      onClick={() => handleOrderTypeChange(order.id, type)}
                                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-all border-b border-gray-100 last:border-b-0 block ${
                                        order.orderType === type
                                          ? 'bg-blue-50 text-blue-700 font-semibold'
                                          : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                    >
                                      {type}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline font-medium">{order.orderNo}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.productSku}</button>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 min-w-[200px]">{order.compatibleItem}</td>
                          <td className="px-3 py-2.5 text-gray-700 min-w-[180px]">{order.brandName}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.qty}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.unitRate}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.odrDate}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.estDate}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pocCmtTeam}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pocRead}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pocQuality}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pocLabel}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.rmReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.pmReview === 'add' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.pmReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.labelDesign === 'add' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.labelDesign}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.labelReview}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className={order.rmSync === 'CG' ? 'text-blue-600 hover:underline' : 'text-gray-700'}>{order.rmSync}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.pmSync}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.licenseArch}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.licenseEI}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.mfgProcess}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.homogenizerProcess}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button className="text-blue-600 hover:underline">{order.approvalStatus}</button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.updatedOn || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.upstageNo || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{order.comments}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">
                                View
                              </button>
                              <button className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors">
                                Shift Record
                              </button>
                              <button 
                                onClick={() => handleViewHistory(order.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Audit History Popup */}
            {viewHistoryOrderId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]" onClick={handleCloseHistory}>
                <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Audit History</h2>
                      <p className="text-sm text-gray-600 mt-1">Order ID: {viewHistoryOrderId}</p>
                    </div>
                    <button 
                      onClick={handleCloseHistory}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium">No audit logs found</p>
                        <p className="text-sm mt-1">There are no recorded changes for this order yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {log.action}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-700">{log.field}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Old Value</p>
                                    <p className="text-sm font-medium text-red-600">{log.oldValue}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">New Value</p>
                                    <p className="text-sm font-medium text-green-600">{log.newValue}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-xs text-gray-500">{log.timestamp}</p>
                                <p className="text-sm font-medium text-gray-700 mt-1">{log.user}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}
        {activeTab === 'purchase-plan' && <div className="p-6">#2 Purchase Plan Content</div>}
        {activeTab === 'purchase-planner' && <div className="p-6">#3 Purchase Planner Content</div>}
        {activeTab === 'production-planner' && <div className="p-6">#4 Production Planner Content</div>}
        {activeTab === 'production-tracker' && <div className="p-6">#5 Production Tracker Content</div>}
        {activeTab === 'order-closure' && <div className="p-6">#6 Order Closure Content</div>}
      </div>
    </div>
  );
};

export default OrderHub;
