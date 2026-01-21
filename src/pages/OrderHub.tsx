import { useState, useEffect, useRef } from 'react';

// ==================== CUSTOM HOOKS ====================
/**
 * useOutsideClick - Auto-closes dropdown on outside click
 * @param isOpen - Whether the dropdown is currently open
 * @param onClose - Callback to close the dropdown
 * @param triggerSelector - Optional CSS selector to exclude from outside-click detection
 */
const useOutsideClick = (
  isOpen: boolean,
  onClose: () => void,
  triggerSelector?: string
) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is inside dropdown
      if (dropdownRef.current?.contains(target)) {
        return;
      }

      // Check if click is on trigger element (if selector provided)
      if (triggerSelector && target.closest(triggerSelector)) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerSelector]);

  return dropdownRef;
};

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
  currentStage: number; // 1-6 for stages, 7 for closed
  stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'>; // Track status of each stage
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
    comments: '-',
    currentStage: 1,
    stageProgress: { 1: 'in-progress', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' }
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
    comments: '-',
    currentStage: 1,
    stageProgress: { 1: 'in-progress', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' }
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
    comments: '-',
    currentStage: 1,
    stageProgress: { 1: 'in-progress', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' }
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
    comments: '-',
    currentStage: 2,
    stageProgress: { 1: 'completed', 2: 'in-progress', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' }
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
    comments: '-',
    currentStage: 3,
    stageProgress: { 1: 'completed', 2: 'completed', 3: 'in-progress', 4: 'pending', 5: 'pending', 6: 'pending' }
  },
  ...Array.from({ length: 55 }, (_, i) => {
    const idx = i + 1;
    const id = String(100 + idx);
    const orderNo = `SO-${String(30000 + idx).padStart(5, '0')}`;
    const orderType = (['NEW ORDER', 'REORDER', 'MODIFIED'] as const)[idx % 3];
    const skuPrefixes = ['SK2109', 'SK2202', 'PR000', 'SK2110', 'SK2108'] as const;
    const sku = `${skuPrefixes[idx % skuPrefixes.length]}${String(1000 + (idx * 37) % 9000)}`;
    const names = [
      'SKINKRAFT ULTRA SMOOTH FACE CLEANSER FOR SENSITIVE SKIN 60ML',
      'SKINKRAFT FOR MEN SEBUM CONTROL FACE CLEANSER FOR OILY SKIN 60ML',
      'SKINKRAFT BARRIER REPAIR CREAM FOR DRY SKIN 45ML',
      'SKINKRAFT BRIGHTSIDE FACIAL SERUM FOR DULL SKIN 30ML',
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML'
    ] as const;
    const itemName = names[idx % names.length];
    const qtyOptions = [1000, 2000, 3000, 5000, 6000, 8000, 10000, 15000, 20000] as const;
    const qty = qtyOptions[idx % qtyOptions.length];

    const unitRate = (30 + ((idx * 173) % 120) + ((idx * 7) % 100) / 100).toFixed(2);

    const month = 8 + (idx % 5); // Aug..Dec
    const day = 1 + (idx % 28);
    const odrDate = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const estDelDate = `2025-${String(Math.min(month + 1, 12)).padStart(2, '0')}-${String(Math.min(day + 7, 28)).padStart(2, '0')}`;
    const comDate = 'CDD';

    const licenseArch = idx % 4 === 0 ? 'no' : 'yes';
    const licenseEI = idx % 6 === 0 ? 'no' : 'yes';

    // Distribute stages across mock orders
    const currentStage = 1 + (idx % 6);
    const stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'> = {};
    for (let s = 1; s <= 6; s++) {
      if (s < currentStage) stageProgress[s] = 'completed';
      else if (s === currentStage) stageProgress[s] = 'in-progress';
      else stageProgress[s] = 'pending';
    }

    return {
      id,
      orderNo,
      orderType,
      sku,
      itemName,
      qty,
      unitRate,
      odrDate,
      estDelDate,
      comDate,
      licenseArch,
      licenseEI,
      stage: 'PURCHASE PLAN',
      currentStatus: 'UNDER PLANNING',
      pocForCurrentStatus: '*#S2 COMPLETED*',
      comments: '-',
      currentStage,
      stageProgress
    };
  })
];

// ==================== API FUNCTIONS (To be implemented with backend) ====================
const fetchOrders = async (): Promise<Order[]> => {
  // Load from multiple sources:
  // 1. Mock orders
  // 2. SO/PO synced orders from SalesAndPurchase
  
  return new Promise((resolve) => {
    setTimeout(() => {
      let allOrders = [...MOCK_ORDERS];
      
      // Load synced orders from SalesAndPurchase
      try {
        const syncedOrders = JSON.parse(localStorage.getItem('eisthetic_order_hub_orders') || '[]');
        allOrders = [...allOrders, ...syncedOrders];
      } catch (error) {
        console.error('Error loading synced orders:', error);
      }
      
      resolve(initializeOrderStages(allOrders));
    }, 500);
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

// ==================== STAGE MANAGEMENT FUNCTIONS ====================
const STAGES = [
  { id: 1, name: 'Orders Review', tabId: 'orders-review' },
  { id: 2, name: 'Purchase Plan', tabId: 'purchase-plan' },
  { id: 3, name: 'Connectivity Tracker', tabId: 'purchase-planner' },
  { id: 4, name: 'Production Planner', tabId: 'production-planner' },
  { id: 5, name: 'Production Tracker', tabId: 'production-tracker' },
  { id: 6, name: 'Order Closure', tabId: 'order-closure' },
];

const initializeOrderStages = (orders: Order[]): Order[] => {
  return orders.map(order => {
    if (!order.currentStage) {
      // Determine stage from legacy 'stage' field
      let currentStage = 1;
      if (order.stage === 'PURCHASE PLAN') currentStage = 2;
      else if (order.stage === 'CONNECTIVITY TRACKER') currentStage = 3;
      else if (order.stage === 'PRODUCTION PLANNER') currentStage = 4;
      else if (order.stage === 'PRODUCTION TRACKER') currentStage = 5;
      else if (order.stage === 'ORDER CLOSURE') currentStage = 6;

      return {
        ...order,
        currentStage,
        stageProgress: {
          1: currentStage > 1 ? 'completed' : 'in-progress',
          2: currentStage > 2 ? 'completed' : currentStage === 2 ? 'in-progress' : 'pending',
          3: currentStage > 3 ? 'completed' : currentStage === 3 ? 'in-progress' : 'pending',
          4: currentStage > 4 ? 'completed' : currentStage === 4 ? 'in-progress' : 'pending',
          5: currentStage > 5 ? 'completed' : currentStage === 5 ? 'in-progress' : 'pending',
          6: currentStage > 6 ? 'completed' : currentStage === 6 ? 'in-progress' : 'pending',
        },
      };
    }
    return order;
  });
};

const moveOrderToNextStage = (order: Order): Order => {
  if (order.currentStage >= 6) {
    return { ...order, currentStage: 7, stage: 'ORDER CLOSED' }; // Final stage
  }

  const nextStage = order.currentStage + 1;
  const stageNames = ['ORDERS REVIEW', 'PURCHASE PLAN', 'CONNECTIVITY TRACKER', 'PRODUCTION PLANNER', 'PRODUCTION TRACKER', 'ORDER CLOSURE'];
  
  return {
    ...order,
    currentStage: nextStage,
    stage: stageNames[nextStage - 1] || 'ORDER CLOSED',
    stageProgress: {
      ...order.stageProgress,
      [order.currentStage]: 'completed',
      [nextStage]: 'in-progress',
    },
  };
};

const getStageStatusColor = (stageStatus: 'pending' | 'in-progress' | 'completed'): string => {
  switch (stageStatus) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    case 'in-progress':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'pending':
      return 'bg-gray-100 text-gray-600 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};

const getStageStatusIcon = (stageStatus: 'pending' | 'in-progress' | 'completed'): string => {
  switch (stageStatus) {
    case 'completed':
      return '✓';
    case 'in-progress':
      return '⚙';
    case 'pending':
      return '○';
    default:
      return '○';
  }
};

const OrderHub = () => {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orderHubActiveTab') || 'orders-tracker';
    }
    return 'orders-tracker';
  });
  const [purchasePlanSubTab, setPurchasePlanSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('purchasePlanSubTab') || 'po-plan';
    }
    return 'po-plan';
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewOrders, setReviewOrders] = useState<OrderReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openOrderTypeDropdown, setOpenOrderTypeDropdown] = useState<string | null>(null);
  const [openLicenseDropdown, setOpenLicenseDropdown] = useState<{
    orderId: string;
    type: 'arch' | 'ei';
  } | null>(null);
  const [openHmgDropdown, setOpenHmgDropdown] = useState<string | null>(null);
  const [openMrpDropdown, setOpenMrpDropdown] = useState<string | null>(null);
  const [licenseEdits, setLicenseEdits] = useState<Record<string, {
    mfgUnit: string;
    licenseNo: string;
    status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
  }>>({});
  const [hmgEdits, setHmgEdits] = useState<Record<string, {
    status: 'YES' | 'NO';
  }>>({});
  const [mrpEdits, setMrpEdits] = useState<Record<string, {
    status: 'MRP REV' | 'PO PLAN';
  }>>({});
  const [commentEdits, setCommentEdits] = useState<Record<string, string>>({});
  const [openCommentModal, setOpenCommentModal] = useState<string | null>(null);
    const [openPocModal, setOpenPocModal] = useState<string | null>(null);
    const [pocModalOrder, setPocModalOrder] = useState<any>(null);
  const [commentModalText, setCommentModalText] = useState('');
  const [lastUpdatedDates, setLastUpdatedDates] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const licenseDropdownRef = useRef<HTMLDivElement>(null);
  const hmgDropdownRef = useRef<HTMLDivElement>(null);
  const mrpDropdownRef = useRef<HTMLDivElement>(null);
  const commentModalRef = useRef<HTMLDivElement>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewHistoryOrderId, setViewHistoryOrderId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Connectivity Tracker states
  const [connectivityRecords, setConnectivityRecords] = useState<Record<string, any>>({});
  const [showAddConnectivityRow, setShowAddConnectivityRow] = useState(false);
  const [newConnectivityRecord, setNewConnectivityRecord] = useState<any>(null);

  // Production Planner states
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [productionPlannerMfgUnits, setProductionPlannerMfgUnits] = useState<Record<string, string>>({});
  const [rmReqDates, setRmReqDates] = useState<Record<string, string>>({});
  const [pmReqDates, setPmReqDates] = useState<Record<string, string>>({});
  const [bundleModalOpen, setBundleModalOpen] = useState<string | null>(null);
  const [bundleQty, setBundleQty] = useState('');
  
  // Production Tracker states
  const [trackerWarehouseFilter, setTrackerWarehouseFilter] = useState('ALL');
  const [trackerSearchQuery, setTrackerSearchQuery] = useState('');

  // ==================== OUTSIDE-CLICK HANDLERS ====================
  // Only handle order type dropdown (the main one)
  useOutsideClick(!!openOrderTypeDropdown, () => setOpenOrderTypeDropdown(null));
  
  // Manual outside-click handlers for other dropdowns
  useEffect(() => {
    if (!openLicenseDropdown && !openHmgDropdown && !openMrpDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a trigger or inside a dropdown
      if (target.closest('[data-license-trigger="true"]') || 
          target.closest('[data-license-dropdown="true"]')) {
        return;
      }
      if (target.closest('[data-hmg-trigger="true"]') || 
          target.closest('[data-hmg-dropdown="true"]')) {
        return;
      }
      if (target.closest('[data-mrp-trigger="true"]') || 
          target.closest('[data-mrp-dropdown="true"]')) {
        return;
      }
      
      // Close all dropdowns
      setOpenLicenseDropdown(null);
      setOpenHmgDropdown(null);
      setOpenMrpDropdown(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openLicenseDropdown, openHmgDropdown, openMrpDropdown]);

  useEffect(() => {
    localStorage.setItem('orderHubActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('purchasePlanSubTab', purchasePlanSubTab);
  }, [purchasePlanSubTab]);

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

  const getMfgProcess = (order: Order) => {
    const seed = order.sku.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return seed % 2 === 0 ? 'HOT' : 'COLD';
  };

  const getTransitionDate = (estDate: string) => {
    const parsed = new Date(estDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    const transition = new Date(parsed);
    transition.setMonth(transition.getMonth() + 2);
    const yyyy = transition.getFullYear();
    const mm = String(transition.getMonth() + 1).padStart(2, '0');
    const dd = String(transition.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openHmgEditor = (orderId: string) => {
    if (!hmgEdits[orderId]) {
      setHmgEdits((prev) => ({
        ...prev,
        [orderId]: { status: 'YES' }
      }));
    }
    setOpenHmgDropdown(orderId);
  };

  const openMrpEditor = (orderId: string) => {
    if (!mrpEdits[orderId]) {
      setMrpEdits((prev) => ({
        ...prev,
        [orderId]: { status: 'MRP REV' }
      }));
    }
    setOpenMrpDropdown(orderId);
  };

  const updateHmgEdit = (orderId: string, updates: Partial<{ status: 'YES' | 'NO'; }>) => {
    setHmgEdits((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], ...updates }
    }));
    updateLastModified(orderId);
  };

  const updateMrpEdit = (orderId: string, updates: Partial<{ status: 'MRP REV' | 'PO PLAN'; }>) => {
    setMrpEdits((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], ...updates }
    }));
    updateLastModified(orderId);
  };

  const getHmgStatusLabel = (orderId: string) => hmgEdits[orderId]?.status || 'YES';
  const getMrpStatusLabel = (orderId: string) => mrpEdits[orderId]?.status || 'MRP REV';

  const updateLastModified = (orderId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setLastUpdatedDates((prev) => ({
      ...prev,
      [orderId]: today
    }));
  };

  const openCommentEditor = (orderId: string) => {
    const currentComment = commentEdits[orderId] ?? '';
    setCommentModalText(currentComment);
    setOpenCommentModal(orderId);
  };

  const saveComment = (orderId: string) => {
    setCommentEdits((prev) => ({
      ...prev,
      [orderId]: commentModalText
    }));
    updateLastModified(orderId);
    setOpenCommentModal(null);
    setCommentModalText('');
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

  const getLicenseKey = (orderId: string, type: 'arch' | 'ei') => `${orderId}-${type}`;

  const openLicenseEditor = (orderId: string, type: 'arch' | 'ei') => {
    const key = getLicenseKey(orderId, type);
    const order = orders.find((o) => o.id === orderId);
    if (!licenseEdits[key]) {
      setLicenseEdits((prev) => ({
        ...prev,
        [key]: {
          mfgUnit: type === 'arch' ? 'ARCHEESH LAB' : 'EI FACTORY',
          licenseNo: '',
          status: (order?.[type === 'arch' ? 'licenseArch' : 'licenseEI'] === 'yes') ? 'YES' : 'NO'
        }
      }));
    }
    setOpenLicenseDropdown({ orderId, type });
  };

  const updateLicenseEdit = (key: string, updates: Partial<{ mfgUnit: string; licenseNo: string; status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS'; }>) => {
    setLicenseEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }));
    updateLastModified(key);
  };

  const applyLicenseStatus = (orderId: string, type: 'arch' | 'ei', status: 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS') => {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        licenseArch: type === 'arch' ? (status === 'YES' ? 'yes' : 'no') : order.licenseArch,
        licenseEI: type === 'ei' ? (status === 'YES' ? 'yes' : 'no') : order.licenseEI
      };
    }));
  };

  const getLicenseStatusLabel = (orderId: string, type: 'arch' | 'ei', fallback: string) => {
    const key = getLicenseKey(orderId, type);
    const status = licenseEdits[key]?.status;
    if (status) return status;
    return fallback === 'yes' ? 'YES' : 'NO';
  };

  const getLicenseStatusClass = (status: string) => {
    switch (status) {
      case 'YES':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'NO':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'APPLIED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'IN PROCESS':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
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

  // ==================== CONNECTIVITY TRACKER FUNCTIONS ====================
  const getConnectivityTrackerOrders = () => {
    // Get ALL orders from all stages for connectivity tracking
    return orders;
  };

  const updateConnectivityRecord = (orderId: string, field: string, value: any) => {
    setConnectivityRecords((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
    updateLastModified(orderId);
  };

  const addNewConnectivityRecord = () => {
    if (!newConnectivityRecord) {
      setNewConnectivityRecord({
        id: `new-${Date.now()}`,
        orderNo: '',
        sku: '',
        itemName: '',
        qty: 0,
        sourceStage: 'MANUAL',
        startDate: new Date().toISOString().split('T')[0],
        estimatedCompletionDate: '',
        status: 'IN PROGRESS',
        remarks: ''
      });
    }
    setShowAddConnectivityRow(true);
  };

  const saveNewConnectivityRecord = () => {
    if (newConnectivityRecord) {
      setConnectivityRecords((prev) => ({
        ...prev,
        [newConnectivityRecord.id]: newConnectivityRecord
      }));
      setNewConnectivityRecord(null);
      setShowAddConnectivityRow(false);
    }
  };

  const cancelNewConnectivityRecord = () => {
    setNewConnectivityRecord(null);
    setShowAddConnectivityRow(false);
  };

  const tabs = [
    { id: 'orders-tracker', label: 'Orders Tracker' },
    { id: 'orders-review', label: '#1 Orders Review' },
    { id: 'purchase-plan', label: '#2 Purchase Plan' },
    { id: 'purchase-planner', label: '#3 Connectivity Tracker' },
    { id: 'production-planner', label: '#4 Production Planner' },
    { id: 'production-tracker', label: '#5 Production Tracker' },
    { id: 'order-closure', label: '#6 Order Closure' },
  ];

  // Filter orders based on search query and status filter
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'OPEN' && order.currentStatus === 'OPEN') ||
      (statusFilter === 'IN_PROGRESS' && order.currentStatus === 'IN_PROGRESS') ||
      (statusFilter === 'COMPLETED' && order.currentStatus === 'COMPLETED') ||
      (statusFilter === 'PENDING' && order.currentStatus === 'PENDING');
    
    return matchesSearch && matchesStatus;
  });

  const poPlanOrders = filteredOrders.filter((order) => order.stage === 'PURCHASE PLAN');

  // Filter review orders based on search query and status filter
  const filteredReviewOrders = reviewOrders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          <div className="space-y-4 p-4">
            {/* Header with Statistics */}
            <div className="grid grid-cols-6 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{orders.length}</div>
                <div className="text-xs text-blue-600 font-medium mt-1">Total Orders</div>
              </div>
              {STAGES.map((stage) => {
                const count = orders.filter(o => o.currentStage === stage.id).length;
                return (
                  <div key={stage.id} className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{count}</div>
                    <div className="text-xs text-amber-600 font-medium mt-1">Stage {stage.id}</div>
                  </div>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by Order No, SKU, or Item Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="ALL">All Stages</option>
                {STAGES.map(s => (
                  <option key={s.id} value={s.id}>Stage {s.id}</option>
                ))}
              </select>
            </div>

            {/* Orders Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {orders
                  .filter(order => {
                    const matchesSearch = !searchQuery || 
                      order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      order.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      order.itemName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStage = statusFilter === 'ALL' || order.currentStage === parseInt(statusFilter);
                    return matchesSearch && matchesStage;
                  })
                  .map(order => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">{order.orderNo}</h3>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              order.orderType === 'REORDER' 
                                ? 'bg-blue-100 text-blue-700' 
                                : order.orderType === 'NEW ORDER'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.orderType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{order.itemName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">SKU: {order.sku} • Qty: {order.qty}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-700">Stage {order.currentStage}/6</div>
                          <div className="text-xs text-gray-500 mt-1">{STAGES.find(s => s.id === order.currentStage)?.name}</div>
                        </div>
                      </div>

                      {/* Stage Progress Bar */}
                      <div className="mb-4">
                        <div className="flex gap-1.5 items-center">
                          {STAGES.map((stage) => {
                            const status = order.stageProgress?.[stage.id] || 'pending';
                            const isCurrentStage = stage.id === order.currentStage;
                            return (
                              <div
                                key={stage.id}
                                className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                                  status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : isCurrentStage
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : 'bg-gray-100 text-gray-500 border border-gray-300'
                                }`}
                                title={stage.name}
                              >
                                <span>{getStageStatusIcon(status)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                          {STAGES.map((stage) => (
                            <span key={stage.id} className="text-center" style={{ width: `calc(100% / 6)` }}>
                              {stage.id}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Order Details Grid */}
                      <div className="grid grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-200">
                        <div>
                          <span className="text-xs text-gray-500 font-medium">Order Date</span>
                          <p className="text-sm text-gray-700 font-medium">{order.odrDate}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 font-medium">Est. Delivery</span>
                          <p className="text-sm text-gray-700 font-medium">{order.estDelDate}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 font-medium">Unit Rate</span>
                          <p className="text-sm text-gray-700 font-medium">₹{order.unitRate}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 font-medium">Status</span>
                          <p className={`text-sm font-medium ${
                            order.currentStatus === 'COMPLETED' ? 'text-green-600' :
                            order.currentStatus === 'UNDER REVIEW' ? 'text-amber-600' :
                            'text-blue-600'
                          }`}>{order.currentStatus}</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {order.currentStage < 7 && (
                          <button
                            onClick={() => {
                              const updatedOrder = moveOrderToNextStage(order);
                              setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
                            }}
                            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Move to Stage {order.currentStage + 1}
                          </button>
                        )}
                        <button
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${order.mfgProcess === 'HOT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {order.mfgProcess || '-'}
                            </span>
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
        {activeTab === 'purchase-plan' && (
          <div>
            {/* Sub-tabs for Purchase Plan */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setPurchasePlanSubTab('po-plan')}
                className={`px-6 py-3 text-sm font-medium transition-all ${
                  purchasePlanSubTab === 'po-plan'
                    ? 'border-b-2 border-amber-500 text-amber-600 bg-white'
                    : 'text-gray-600 hover:text-amber-600'
                }`}
              >
                PO Plan
              </button>
              <button
                onClick={() => setPurchasePlanSubTab('rev-1')}
                className={`px-6 py-3 text-sm font-medium transition-all ${
                  purchasePlanSubTab === 'rev-1'
                    ? 'border-b-2 border-amber-500 text-amber-600 bg-white'
                    : 'text-gray-600 hover:text-amber-600'
                }`}
              >
                Rev 1
              </button>
            </div>

            {/* Sub-tab Content */}
            <div className="p-6">
              {purchasePlanSubTab === 'po-plan' && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">PO Plan</h2>
                    <p className="text-sm text-gray-600">Purchase Order Plan</p>
                  </div>

                  {/* Search and Filter Bar (reuse existing controls) */}
                  <div className="p-4 border border-gray-100 rounded-xl bg-white flex items-center gap-4 mb-4">
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

                  <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white relative z-0">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
                      </div>
                    ) : (
                      <table className="w-full relative" style={{ borderCollapse: 'collapse', position: 'relative' }}>
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-40 bg-white">
                              <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-40 bg-white">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-40 bg-white">Order No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-64 z-20 bg-white">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-80 z-20 bg-white">Item Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Req</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">ODR_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">EST_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">COM_Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#SYNC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">INV PLAN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Transition Date</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License ARCH Status</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">License EI Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MFG Process</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">HMG Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">MRP_Status</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#POC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">#Comments</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Updated_Dt</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-white">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poPlanOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3.5 sticky left-0 z-30 bg-white hover:bg-gray-50">
                                <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-12 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-64 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                              <td className="px-4 py-3.5 text-sm text-gray-900 min-w-[300px] sticky left-80 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                -
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <button className="text-blue-600 hover:underline text-sm">sync</button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                {(() => {
                                  const mfg = getMfgProcess(order);
                                  return (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${mfg === 'HOT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {mfg}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                -
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-license-trigger="true"
                                    onClick={() => openLicenseEditor(order.id, 'arch')}
                                    className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs border hover:shadow-sm transition ${getLicenseStatusClass(getLicenseStatusLabel(order.id, 'arch', order.licenseArch) as string)}`}
                                  >
                                    {getLicenseStatusLabel(order.id, 'arch', order.licenseArch)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openLicenseDropdown?.orderId === order.id && openLicenseDropdown?.type === 'arch' && (
                                    <div ref={licenseDropdownRef} data-license-dropdown="true" className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select License Status..</p>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">MFG Unit</label>
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.mfgUnit || 'ARCHEESH LAB'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { mfgUnit: e.target.value })}
                                          >
                                            <option>ARCHEESH LAB</option>
                                            <option>EI FACTORY</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">LDIS.No</label>
                                          <input
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            placeholder="LDIS.No"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.licenseNo || ''}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { licenseNo: e.target.value })}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'arch')]?.status || 'YES'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'arch'), { status: e.target.value as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS' })}
                                          >
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="APPLIED">APPLIED</option>
                                            <option value="IN PROCESS">IN PROCESS</option>
                                          </select>
                                          <button
                                            className="p-1.5 bg-blue-600 text-white rounded"
                                            title="Save"
                                            onClick={() => {
                                              const key = getLicenseKey(order.id, 'arch');
                                              const status = (licenseEdits[key]?.status || 'YES') as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
                                              applyLicenseStatus(order.id, 'arch', status);
                                              setOpenLicenseDropdown(null);
                                            }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </button>
                                          <button
                                            className="p-1.5 text-gray-500 hover:text-gray-700"
                                            title="Close"
                                            onClick={() => setOpenLicenseDropdown(null)}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-license-trigger="true"
                                    onClick={() => openLicenseEditor(order.id, 'ei')}
                                    className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs border hover:shadow-sm transition ${getLicenseStatusClass(getLicenseStatusLabel(order.id, 'ei', order.licenseEI) as string)}`}
                                  >
                                    {getLicenseStatusLabel(order.id, 'ei', order.licenseEI)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openLicenseDropdown?.orderId === order.id && openLicenseDropdown?.type === 'ei' && (
                                    <div ref={licenseDropdownRef} data-license-dropdown="true" className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select License EI Status..</p>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">MFG Unit</label>
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.mfgUnit || 'EI FACTORY'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { mfgUnit: e.target.value })}
                                          >
                                            <option>EI FACTORY</option>
                                            <option>ARCHEESH LAB</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[11px] text-gray-500">License No.</label>
                                          <input
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            placeholder="License No"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.licenseNo || ''}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { licenseNo: e.target.value })}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <select
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                            value={licenseEdits[getLicenseKey(order.id, 'ei')]?.status || 'YES'}
                                            onChange={(e) => updateLicenseEdit(getLicenseKey(order.id, 'ei'), { status: e.target.value as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS' })}
                                          >
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="APPLIED">APPLIED</option>
                                            <option value="IN PROCESS">IN PROCESS</option>
                                          </select>
                                          <button
                                            className="p-1.5 bg-blue-600 text-white rounded"
                                            title="Save"
                                            onClick={() => {
                                              const key = getLicenseKey(order.id, 'ei');
                                              const status = (licenseEdits[key]?.status || 'YES') as 'YES' | 'NO' | 'APPLIED' | 'IN PROCESS';
                                              applyLicenseStatus(order.id, 'ei', status);
                                              setOpenLicenseDropdown(null);
                                            }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </button>
                                          <button
                                            className="p-1.5 text-gray-500 hover:text-gray-700"
                                            title="Close"
                                            onClick={() => setOpenLicenseDropdown(null)}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-hmg-trigger="true"
                                    onClick={() => openHmgEditor(order.id)}
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                  >
                                    {getHmgStatusLabel(order.id)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openHmgDropdown === order.id && (
                                    <div ref={hmgDropdownRef} data-hmg-dropdown="true" className="absolute z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select HMG Status</p>
                                      <select
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-3"
                                        value={hmgEdits[order.id]?.status || 'YES'}
                                        onChange={(e) => updateHmgEdit(order.id, { status: e.target.value as 'YES' | 'NO' })}
                                      >
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                      </select>
                                      <div className="flex items-center gap-2 mt-3">
                                        <button
                                          className="p-1.5 bg-blue-600 text-white rounded"
                                          title="Save"
                                          onClick={() => setOpenHmgDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          className="p-1.5 text-gray-500 hover:text-gray-700"
                                          title="Close"
                                          onClick={() => setOpenHmgDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="relative inline-block text-left">
                                  <button
                                    data-mrp-trigger="true"
                                    onClick={() => openMrpEditor(order.id)}
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                  >
                                    {getMrpStatusLabel(order.id)}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {openMrpDropdown === order.id && (
                                    <div ref={mrpDropdownRef} data-mrp-dropdown="true" className="absolute z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Select MRP Review Status</p>
                                      <select
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                        value={mrpEdits[order.id]?.status || 'MRP REV'}
                                        onChange={(e) => updateMrpEdit(order.id, { status: e.target.value as 'MRP REV' | 'PO PLAN' })}
                                      >
                                        <option value="MRP REV">MRP REV</option>
                                        <option value="PO PLAN">PO PLAN</option>
                                      </select>
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          className="p-1.5 bg-blue-600 text-white rounded"
                                          title="Save"
                                          onClick={() => setOpenMrpDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          className="p-1.5 text-gray-500 hover:text-gray-700"
                                          title="Close"
                                          onClick={() => setOpenMrpDropdown(null)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <button
                                  className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="POC"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <button
                                  data-comment-trigger="true"
                                  onClick={() => openCommentEditor(order.id)}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {commentEdits[order.id]?.trim() ? commentEdits[order.id] : 'Add'}
                                </button>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">
                                {lastUpdatedDates[order.id] || '-'}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                <button
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Action"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {/* Comment Modal */}
                          {openCommentModal && (
                            <tr>
                              <td colSpan={24} className="px-0 py-0">
                                <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setOpenCommentModal(null)}>
                                  <div 
                                    ref={commentModalRef}
                                    data-comment-modal="true"
                                    className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Comment</h3>
                                    <textarea
                                      autoFocus
                                      value={commentModalText}
                                      onChange={(e) => setCommentModalText(e.target.value)}
                                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                      rows={4}
                                      placeholder="Enter your comment here..."
                                    />
                                    <div className="flex items-center gap-2 mt-4">
                                      <button
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                                        onClick={() => saveComment(openCommentModal)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition font-medium"
                                        onClick={() => setOpenCommentModal(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {!poPlanOrders.length && (
                            <tr>
                              <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={24}>
                                No orders found in PURCHASE PLAN.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
              {purchasePlanSubTab === 'rev-1' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Rev 1</h2>
                  <p className="text-gray-600">Revision 1 content will be displayed here.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'purchase-planner' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#3 Connectivity Tracker</h2>
              <button
                onClick={addNewConnectivityRecord}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Connectivity Tracker Table */}
            <div className="overflow-x-auto">
              {getConnectivityTrackerOrders().length === 0 && !showAddConnectivityRow ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available. Add new records or create manually.</p>
                </div>
              ) : (
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST. Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">INV. Can_di</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Loc</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License ARCH</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License EI</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING_UNI_CDE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC_</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Comment Modal */}
                    {openCommentModal && (
                      <tr>
                        <td colSpan={26} className="px-0 py-0">
                          <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setOpenCommentModal(null)}>
                            <div 
                              ref={commentModalRef}
                              data-comment-modal="true"
                              className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Comment</h3>
                              <textarea
                                autoFocus
                                value={commentModalText}
                                onChange={(e) => setCommentModalText(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={4}
                                placeholder="Enter your comment here..."
                              />
                              <div className="flex items-center gap-2 mt-4">
                                <button
                                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                                  onClick={() => saveComment(openCommentModal)}
                                >
                                  Save
                                </button>
                                <button
                                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition font-medium"
                                  onClick={() => setOpenCommentModal(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* All Order Records */}
                    {getConnectivityTrackerOrders().map((order) => {
                      const recordData = connectivityRecords[order.id] || {};
                      const mfgProcess = getMfgProcess(order);
                      const transitionDate = getTransitionDate(order.estDelDate);
                      
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">₹{order.unitRate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.req || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'req', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.invCandi || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'invCandi', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{transitionDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.mfgLoc || 'ARCHEESH LAB'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'mfgLoc', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="ARCHEESH LAB">ARCHEESH LAB</option>
                              <option value="EI FACTORY">EI FACTORY</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </td>
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
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">{mfgProcess}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <span 
                              onClick={() => openHmgEditor(order.id)}
                              className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200"
                            >
                              {getHmgStatusLabel(order.id)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">
                            <input
                              type="number"
                              defaultValue={recordData.fgPlanQty || order.qty}
                              onChange={(e) => updateConnectivityRecord(order.id, 'fgPlanQty', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.mfgUnit || ''}
                              onChange={(e) => updateConnectivityRecord(order.id, 'mfgUnit', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="">SELECT MFG UNIT</option>
                              <optgroup label="Select MFG Location">
                                <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                                <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                              </optgroup>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <input
                              type="date"
                              defaultValue={recordData.estMfgDate || order.estDelDate}
                              onChange={(e) => updateConnectivityRecord(order.id, 'estMfgDate', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <select
                              defaultValue={recordData.tankCode || ''}
                              onChange={(e) => updateConnectivityRecord(order.id, 'tankCode', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="">SELECT TANK CODE</option>
                              <option value="MANUAL">MANUAL</option>
                              <option value="10 KG">10 KG</option>
                              <option value="100 KG">100 KG</option>
                              <option value="150 KG">150 KG</option>
                              <option value="300 KG">300 KG</option>
                              <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                              <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                              <option value="1 KL WITHOUT HMZ">1 KL WITHOUT HMZ</option>
                              <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                              <option value="2 KL WITHOUT HMZ">2 KL WITHOUT HMZ</option>
                              <option value="3 KL WITH HMZ">3 KL WITH HMZ</option>
                              <option value="3 KL WITHOUT HMZ">3 KL WITHOUT HMZ</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                            <input
                              type="text"
                              defaultValue={recordData.fillingUniCde || '-'}
                              onChange={(e) => updateConnectivityRecord(order.id, 'fillingUniCde', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              placeholder="Code"
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <input
                              type="date"
                              defaultValue={recordData.estFillingUnit || order.estDelDate}
                              onChange={(e) => updateConnectivityRecord(order.id, 'estFillingUnit', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-sm relative">
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => {
                                  if (openPocModal === order.id) {
                                    setOpenPocModal(null);
                                    return;
                                  }
                                  setPocModalOrder(order);
                                  setOpenPocModal(order.id);
                                }}
                                className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                              >
                                View POC
                              </button>
                              {openPocModal === order.id && pocModalOrder && (
                                <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                    <button
                                      onClick={() => setOpenPocModal(null)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="w-4 h-4"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <ul className="space-y-2 text-[11px]">
                                    <li>
                                      <span className="font-medium text-gray-700">CM_TEAM: </span>
                                      <span className="text-gray-600">TEJA</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                      <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">PACKING: </span>
                                      <span className="text-gray-600">-</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                      <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                      <span className="text-gray-600">-</span>
                                    </li>
                                    <li>
                                      <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                      <span className="text-gray-600">TARUN</span>
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm">
                            <button
                              onClick={() => openCommentEditor(order.id)}
                              className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                            >
                              {commentEdits[order.id] ? 'Edit' : 'Add'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <button
                              className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                              title="Action"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* New Record Row (if adding) */}
                    {showAddConnectivityRow && newConnectivityRecord && (
                      <tr className="border-b border-gray-100 bg-green-50 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm sticky left-0 z-10 bg-green-50">AUTO</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm sticky left-12 z-10 bg-green-50">
                          <input
                            type="text"
                            value={newConnectivityRecord.orderNo}
                            onChange={(e) => setNewConnectivityRecord({ ...newConnectivityRecord, orderNo: e.target.value })}
                            placeholder="Order No"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td colSpan={24} className="px-4 py-3.5 text-center text-sm text-gray-600">
                          [New record row - Fill all fields and click Save]
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary Section */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{getConnectivityTrackerOrders().length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Qty</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{getConnectivityTrackerOrders().reduce((sum, o) => sum + o.qty, 0)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Value</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">₹{(getConnectivityTrackerOrders().reduce((sum, o) => sum + (o.qty * parseFloat(o.unitRate || '0')), 0) / 100000).toFixed(2)}L</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">License ARCH</p>
                  <p className="text-2xl font-bold text-purple-600 mt-2">{getConnectivityTrackerOrders().filter(o => o.licenseArch === 'yes').length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">License EI</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{getConnectivityTrackerOrders().filter(o => o.licenseEI === 'yes').length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'production-planner' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#4 Production Planner</h2>
              <button
                onClick={() => console.log('Add new record')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Warehouse Filter */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-6">
                <span className="text-sm font-semibold text-gray-700">WAREHOUSE:</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="ALL"
                      checked={warehouseFilter === 'ALL'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="ARCHEESH LAB"
                      checked={warehouseFilter === 'ARCHEESH LAB'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">ARCHEESH LAB</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="warehouse"
                      value="EI FACTORY"
                      checked={warehouseFilter === 'EI FACTORY'}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">EI FACTORY</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Production Planner Table */}
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available.</p>
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">Item SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Material Request</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License ARCH</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">License EI</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PRODUCT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PACKING</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING *line code*</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Disp_sheet</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter((order) => {
                      if (warehouseFilter === 'ALL') return true;
                      const mfgUnit = productionPlannerMfgUnits[order.id];
                      if (warehouseFilter === 'ARCHEESH LAB') return mfgUnit === 'ARCHEESH LAB (MFG 1)';
                      if (warehouseFilter === 'EI FACTORY') return mfgUnit === 'EI FACTORY (MFG 2)';
                      return false;
                    }).map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">CRD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            defaultValue={order.qty}
                            placeholder="Enter QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue={order.licenseArch === 'yes' ? 'YES' : 'NO'}
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="IN PROCESS">IN PROCESS</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue={order.licenseEI === 'yes' ? 'YES' : 'NO'}
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="IN PROCESS">IN PROCESS</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">HOT</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">YES</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Production Incharge</option>
                            <option value="PROD EXE 1">PROD EXE 1</option>
                            <option value="PROD EXE 2">PROD EXE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Package Incharge</option>
                            <option value="PACK EXE 1">PACK EXE 1</option>
                            <option value="PACK EXE 2">PACK EXE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            value={productionPlannerMfgUnits[order.id] || ''}
                            onChange={(e) => setProductionPlannerMfgUnits({ ...productionPlannerMfgUnits, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">SELECT MFG UNIT</option>
                            <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                            <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">SELECT TANK CODE</option>
                            <option value="MANUAL">MANUAL</option>
                            <option value="10 KG">10 KG</option>
                            <option value="100 KG">100 KG</option>
                            <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                            <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                            <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Filling Line Code</option>
                            <option value="TWO HEAD">TWO HEAD</option>
                            <option value="MANUAL LINE 1">MANUAL LINE 1</option>
                            <option value="MANUAL LINE 2">MANUAL LINE 2</option>
                            <option value="SINGLE HEAD 1">SINGLE HEAD 1</option>
                            <option value="SINGLE HEAD 2">SINGLE HEAD 2</option>
                            <option value="FOUR HEAD 1">FOUR HEAD 1</option>
                            <option value="FOUR HEAD 2">FOUR HEAD 2</option>
                            <option value="SIX HEAD">SIX HEAD</option>
                            <option value="TUBE LINE 1">TUBE LINE 1</option>
                            <option value="TUBE LINE 2">TUBE LINE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            value={rmReqDates[order.id] || ''}
                            onChange={(e) => setRmReqDates({ ...rmReqDates, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            value={pmReqDates[order.id] || ''}
                            onChange={(e) => setPmReqDates({ ...pmReqDates, [order.id]: e.target.value })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 text-sm">
                          <button
                            onClick={() => openCommentEditor(order.id)}
                            className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                          >
                            {commentEdits[order.id] ? 'Edit' : 'Add'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-sm relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                if (openPocModal === order.id) {
                                  setOpenPocModal(null);
                                  return;
                                }
                                setPocModalOrder(order);
                                setOpenPocModal(order.id);
                              }}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                            >
                              View POC
                            </button>
                            {openPocModal === order.id && pocModalOrder && (
                              <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                  <button
                                    onClick={() => setOpenPocModal(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth="1.5"
                                      stroke="currentColor"
                                      className="w-4 h-4"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <ul className="space-y-2 text-[11px]">
                                  <li>
                                    <span className="font-medium text-gray-700">CM_TEAM: </span>
                                    <span className="text-gray-600">TEJA</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                    <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">PACKING: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                    <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                    <span className="text-gray-600">TARUN</span>
                                  </li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <button
                            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                            title="Action"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === 'production-tracker' && (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">#5 Production Tracker</h2>
              <button
                onClick={() => console.log('Add new record')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Record
              </button>
            </div>

            {/* Warehouse Filter and Search */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-6 mb-4">
                <span className="text-sm font-semibold text-gray-700">WAREHOUSE:</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="ALL"
                      checked={trackerWarehouseFilter === 'ALL'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="ARCHEESH LAB"
                      checked={trackerWarehouseFilter === 'ARCHEESH LAB'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">ARCHEESH LAB</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tracker-warehouse"
                      value="EI FACTORY"
                      checked={trackerWarehouseFilter === 'EI FACTORY'}
                      onChange={(e) => setTrackerWarehouseFilter(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">EI FACTORY</span>
                  </label>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={trackerSearchQuery}
                  onChange={(e) => setTrackerSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64"
                />
              </div>
            </div>

            {/* Production Tracker Table */}
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">No records available.</p>
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-50">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-12 z-20 bg-gray-50">Order No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-28 z-20 bg-gray-50">Item SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap sticky left-48 z-20 bg-gray-50">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Order Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Req</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Material Request</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">ODR_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">COM_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Transition_Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">HMG Process</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PRODUCT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PACKING</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FG_PLAN_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">MFG_UNIT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_MFG</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">TANK_CODE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">FILLING *line code*</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">EST_FILLING DATE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_T Req_dt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">PM_DISPENSE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">RM_DISPENSE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">BUNDLE_NO</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">BUNDLE_QTY</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*POC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Disp_sheet</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">*Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Complete Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .filter((order) => {
                        // Filter by warehouse
                        if (trackerWarehouseFilter !== 'ALL') {
                          const mfgUnit = productionPlannerMfgUnits[order.id];
                          if (trackerWarehouseFilter === 'ARCHEESH LAB' && mfgUnit !== 'ARCHEESH LAB (MFG 1)') {
                            return false;
                          }
                          if (trackerWarehouseFilter === 'EI FACTORY' && mfgUnit !== 'EI FACTORY (MFG 2)') {
                            return false;
                          }
                        }
                        
                        // Filter by search query
                        if (trackerSearchQuery) {
                          const searchLower = trackerSearchQuery.toLowerCase();
                          return (
                            order.orderNo.toLowerCase().includes(searchLower) ||
                            order.itemName.toLowerCase().includes(searchLower) ||
                            order.sku.toLowerCase().includes(searchLower)
                          );
                        }
                        
                        return true;
                      })
                      .map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 font-medium sticky left-0 z-10 bg-white hover:bg-gray-50">{order.id}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-12 z-10 bg-white hover:bg-gray-50">{order.orderNo}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 sticky left-28 z-10 bg-white hover:bg-gray-50">{order.sku}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 min-w-[200px] sticky left-48 z-10 bg-white hover:bg-gray-50">{order.itemName}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.qty}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.unitRate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">CRD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.odrDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.estDelDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">{order.comDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700">-</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">HOT</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-yellow-600">YES</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">ADD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-blue-600">ADD</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            defaultValue={order.qty}
                            placeholder="Enter QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">SELECT MFG UNIT</option>
                            <option value="ARCHEESH LAB (MFG 1)">ARCHEESH LAB (MFG 1)</option>
                            <option value="EI FACTORY (MFG 2)">EI FACTORY (MFG 2)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">SELECT TANK CODE</option>
                            <option value="MANUAL">MANUAL</option>
                            <option value="10 KG">10 KG</option>
                            <option value="100 KG">100 KG</option>
                            <option value="750 KL WITH HMZ">750 KL WITH HMZ</option>
                            <option value="1 KL WITH HMZ">1 KL WITH HMZ</option>
                            <option value="2 KL WITH HMZ">2 KL WITH HMZ</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <select
                            defaultValue=""
                            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                          >
                            <option value="">Select Filling Line Code</option>
                            <option value="TWO HEAD">TWO HEAD</option>
                            <option value="MANUAL LINE 1">MANUAL LINE 1</option>
                            <option value="MANUAL LINE 2">MANUAL LINE 2</option>
                            <option value="SINGLE HEAD 1">SINGLE HEAD 1</option>
                            <option value="SINGLE HEAD 2">SINGLE HEAD 2</option>
                            <option value="FOUR HEAD 1">FOUR HEAD 1</option>
                            <option value="FOUR HEAD 2">FOUR HEAD 2</option>
                            <option value="SIX HEAD">SIX HEAD</option>
                            <option value="TUBE LINE 1">TUBE LINE 1</option>
                            <option value="TUBE LINE 2">TUBE LINE 2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.estDelDate}
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <input
                            type="date"
                            className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="text"
                            placeholder="BUNDLE NO"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            placeholder="QTY"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-sm relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                if (openPocModal === order.id) {
                                  setOpenPocModal(null);
                                  return;
                                }
                                setPocModalOrder(order);
                                setOpenPocModal(order.id);
                              }}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors font-medium"
                            >
                              View POC
                            </button>
                            {openPocModal === order.id && pocModalOrder && (
                              <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 right-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xs font-semibold text-gray-800">POC USERS</h3>
                                  <button
                                    onClick={() => setOpenPocModal(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth="1.5"
                                      stroke="currentColor"
                                      className="w-4 h-4"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <ul className="space-y-2 text-[11px]">
                                  <li>
                                    <span className="font-medium text-gray-700">CM_TEAM: </span>
                                    <span className="text-gray-600">TEJA</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">R&D PRODUCT: </span>
                                    <span className="text-gray-600">(id: 12, name: "BHAVYA")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">PACKING: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY PRODUCT: </span>
                                    <span className="text-gray-600">(id: 57, name: "SHIVA KUMAR")</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">QUALITY COMPLIANCE: </span>
                                    <span className="text-gray-600">-</span>
                                  </li>
                                  <li>
                                    <span className="font-medium text-gray-700">LABEL DESIGN: </span>
                                    <span className="text-gray-600">TARUN</span>
                                  </li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm">
                          <input
                            type="text"
                            placeholder="Select"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-sm">
                          <button
                            onClick={() => openCommentEditor(order.id)}
                            className="px-2 py-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors font-medium"
                          >
                            {commentEdits[order.id] ? 'Edit' : 'Add'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => {
                              setBundleModalOpen(order.id);
                              setBundleQty('');
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                          >
                            Bundle
                          </button>
                          {bundleModalOpen === order.id && (
                            <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center" onClick={() => setBundleModalOpen(null)}>
                              <div 
                                className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Bundle Order - Planned Qty:</h3>
                                <p className="text-2xl font-bold text-gray-900 mb-4">{order.qty}.00</p>
                                <input
                                  type="number"
                                  value={bundleQty}
                                  onChange={(e) => setBundleQty(e.target.value)}
                                  placeholder="Enter quantity"
                                  className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => {
                                      console.log('Bundle submitted with qty:', bundleQty);
                                      setBundleModalOpen(null);
                                      setBundleQty('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                                  >
                                    Submit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBundleModalOpen(null);
                                      setBundleQty('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-medium"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === 'order-closure' && <div className="p-6">#6 Order Closure Content</div>}
      </div>
    </div>
  );
};

export default OrderHub;
