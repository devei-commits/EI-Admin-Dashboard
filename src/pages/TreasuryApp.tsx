import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, X } from 'lucide-react';
import logoFull from '../assets/logo/eilogofull.svg';
import { useGlobalState } from '../context/GlobalStateContext';
import { fetchTreasuryPurchaseOrders, type TreasuryPurchaseOrderRow } from '../services/treasury.service';
import { TreasuryPoDetailModal } from '../components/treasury/TreasuryPoDetailModal';

interface Notification {
  id: string;
  type: 'alert' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface Payment {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  priority: 'high' | 'medium' | 'low';
  approvals: { level: number; status: 'pending' | 'approved' | 'rejected'; by?: string; date?: string }[];
}

interface Settings {
  currency: string;
  dateFormat: string;
  timezone: string;
  language: string;
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

const TreasuryApp = () => {
  const { state, dispatch } = useGlobalState();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'alert', title: 'Low Cash Balance', message: 'Cash position below ₹50L', timestamp: new Date(), read: false },
    { id: '2', type: 'warning', title: 'Overdue Payable', message: 'Radcom Packaging payment overdue by 3 days', timestamp: new Date(Date.now() - 3600000), read: false },
    { id: '3', type: 'success', title: 'Payment Processed', message: 'Payment of ₹25L to SkinKraft completed', timestamp: new Date(Date.now() - 7200000), read: true },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([
    { id: 'P001', vendor: 'Radcom Packaging', amount: 650000, dueDate: '2026-01-25', status: 'pending', priority: 'high', approvals: [{ level: 1, status: 'pending' }, { level: 2, status: 'pending' }] },
    { id: 'P002', vendor: 'SkinKraft Supplies', amount: 450000, dueDate: '2026-01-28', status: 'approved', priority: 'medium', approvals: [{ level: 1, status: 'approved', by: 'Priya', date: '2026-01-20' }, { level: 2, status: 'pending' }] },
  ]);
  const [_selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [settings, _setSettings] = useState<Settings>({
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'IST',
    language: 'English',
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 120
  });
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Auto-refresh effect
  useEffect(() => {
    // Polling disabled intentionally to reduce background traffic.
    return undefined;
  }, [settings.autoRefresh, settings.refreshInterval]);
  const [visibleColumns, setVisibleColumns] = useState({
    vendor: true,
    amount: true,
    date: true,
    status: true,
    priority: true,
    method: true
  });
  const notificationRef = useRef<HTMLDivElement>(null);
  const [treasuryPoDetailView, setTreasuryPoDetailView] = useState<TreasuryPurchaseOrderRow | null>(null);

  const {
    data: treasuryPurchaseOrders = [],
    isLoading: treasuryPoLoading,
    refetch: refetchTreasuryPos,
  } = useQuery({
    queryKey: ['treasury-purchase-orders'],
    queryFn: async () => {
      const res = await fetchTreasuryPurchaseOrders();
      return res.success ? res.data : [];
    },
    staleTime: 30_000,
  });

  const fmtMoney = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));

  const formatTreasuryPoDate = (d: string | null | undefined) => {
    if (!d || !String(d).trim()) return '—';
    try {
      return new Date(String(d).slice(0, 10)).toLocaleDateString('en-IN');
    } catch {
      return String(d);
    }
  };

  const TreasuryPoPaymentsTable = ({
    rows,
    onView,
  }: {
    rows: TreasuryPurchaseOrderRow[];
    onView: (po: TreasuryPurchaseOrderRow) => void;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[48rem]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-2 text-left font-semibold text-gray-700">PO</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Vendor</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700">PO value</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Txn no.</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Mode</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Payment date</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Released</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">View</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">
                No PO payment records yet. Release a PO from Procurement with transaction details.
              </td>
            </tr>
          ) : (
            rows.map((po) => (
              <tr key={po.purchaseOrderId} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">{po.poNumber}</td>
                <td className="px-3 py-2 text-gray-800">{po.vendorName || '—'}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {po.status || '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(po.grandTotal)}</td>
                <td className="px-3 py-2 font-mono text-xs">{po.tracking?.paymentTransactionNo || '—'}</td>
                <td className="px-3 py-2">{po.tracking?.paymentMode || '—'}</td>
                <td className="px-3 py-2">{formatTreasuryPoDate(po.tracking?.paymentTransactionDate)}</td>
                <td className="px-3 py-2">{formatTreasuryPoDate(po.tracking?.poReleasedAt)}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onView(po)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                    title="View PO & payment details"
                    aria-label={`View details for ${po.poNumber}`}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  useEffect(() => {
    if (currentScreen === 'po-advances' || currentScreen === 'treasury') {
      void refetchTreasuryPos();
    }
  }, [currentScreen, refetchTreasuryPos]);

  // Close notifications when clicking outside or navigating screens
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [showNotifications]);

  // Close notifications when screen changes
  useEffect(() => {
    setShowNotifications(false);
  }, [currentScreen]);

  const screenTitles: { [key: string]: string } = {
    'dashboard': 'Control Center',
    'cashflow': 'Cashflow Timeline',
    'treasury': 'Treasury View',
    'new-payment': 'New & Bulk Payment Requests',
    'approvals': 'Outward Approvals',
    'schedule': 'Payment Schedule',
    'execute': 'Execute Payments',
    'recurring': 'Recurring & Reminders',
    'inflows-clients': 'Client Inflows (Advances & Invoices)',
    'inflows-funding': 'Banks & Investors Inflows',
    'budgets': 'Budgets & Allocation',
    'settings': 'Admin & Zoho Books Sync',
    'po-advances': 'PO Advance Requests',
  };

  const handleApproval = (paymentId: string, approved: boolean) => {
    setPayments(payments.map(p => {
      if (p.id === paymentId) {
        return {
          ...p,
          status: approved ? 'approved' : 'rejected',
          approvals: p.approvals.map((a, idx) => idx === 0 ? { ...a, status: approved ? 'approved' : 'rejected', by: 'You', date: new Date().toISOString().split('T')[0] } : a)
        };
      }
      return p;
    }));
    setNotifications([...notifications, {
      id: Date.now().toString(),
      type: approved ? 'success' : 'warning',
      title: approved ? 'Payment Approved' : 'Payment Rejected',
      message: `${approved ? 'Approved' : 'Rejected'} payment to ${payments.find(p => p.id === paymentId)?.vendor}`,
      timestamp: new Date(),
      read: false
    }]);
    setSelectedPayment(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <img src={logoFull} alt="Esthetic Insights" className="h-8 object-contain" />
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white hover:bg-slate-700 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-white/60 backdrop-blur-md z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
    fixed md:static inset-y-0 left-0 z-50
    w-64 bg-slate-800 border-r border-gray-700 overflow-y-auto flex flex-col shadow-xl
    transform transition-transform duration-300 ease-in-out
    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    md:flex
   `}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-center">
          <img src={logoFull} alt="Esthetic Insights" className="h-12 object-contain" />
        </div>
        <div className="px-6 py-3 text-center border-b border-gray-700/50">
          <p className="text-xs text-gray-400 font-medium">Payments & Cashflow</p>
        </div>

        <nav className="flex-1 px-3 space-y-2 py-4">
          {/* Overview */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-4 mb-3 mt-2">Overview</p>
          {['dashboard', 'cashflow', 'treasury'].map(screen => (
            <button
              key={screen}
              onClick={() => { setCurrentScreen(screen); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === screen
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-gray-300 hover:bg-slate-700/50 hover:text-white'
                }`}
            >
              {screenTitles[screen]}
            </button>
          ))}

          {/* Outward */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-4 mb-3 mt-6">Outward</p>
          {['new-payment', 'approvals', 'schedule', 'execute', 'recurring'].map(screen => (
            <button
              key={screen}
              onClick={() => { setCurrentScreen(screen); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === screen
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-gray-300 hover:bg-slate-700/50 hover:text-white'
                }`}
            >
              {screenTitles[screen]}
            </button>
          ))}
          {/* PO Advances (linked from Procurement) */}
          <button
            onClick={() => { setCurrentScreen('po-advances'); setIsMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between ${currentScreen === 'po-advances'
              ? 'bg-slate-800 text-white shadow-lg'
              : 'text-gray-300 hover:bg-slate-700/50 hover:text-white'
              }`}
          >
            PO Advance Requests
            {(state.po?.treasury?.length || 0) + treasuryPurchaseOrders.length > 0 && (
              <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                {(state.po?.treasury?.length || 0) + treasuryPurchaseOrders.length}
              </span>
            )}
          </button>

          {/* Inward */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-4 mb-3 mt-6">Inward</p>
          {['inflows-clients', 'inflows-funding'].map(screen => (
            <button
              key={screen}
              onClick={() => { setCurrentScreen(screen); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === screen
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-gray-300 hover:bg-slate-700/50 hover:text-white'
                }`}
            >
              {screenTitles[screen]}
            </button>
          ))}

          {/* Structure */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-4 mb-3 mt-6">Structure</p>
          {['budgets', 'settings'].map(screen => (
            <button
              key={screen}
              onClick={() => { setCurrentScreen(screen); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentScreen === screen
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-gray-300 hover:bg-slate-700/50 hover:text-white'
                }`}
            >
              {screenTitles[screen]}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 pt-14 md:pt-0">
        <div className="p-4 md:p-8">
          {/* Header with Notifications & Search */}
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 md:mb-6">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">{screenTitles[currentScreen]}</h1>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm bg-white px-3 md:px-4 py-2 rounded-xl w-fit border border-gray-200 shadow-sm">
                  <span className="text-gray-500">Treasury</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-700 font-medium">{screenTitles[currentScreen]}</span>
                  {settings.autoRefresh && (
                    <>
                      <span className="text-gray-300 ml-2">•</span>
                      <span className="text-xs text-green-600 ml-2 font-medium">Auto-refresh: every 2 min</span>
                      <span className="text-xs text-gray-500 ml-1">Last: {lastRefreshTime.toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Notification Bell */}
              <div className="relative" ref={notificationRef} onMouseEnter={() => setShowNotifications(true)} onMouseLeave={() => setShowNotifications(false)}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200 shadow-sm border border-gray-100 hover:shadow-md"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 px-2 py-1 bg-red-600 text-white text-xs rounded-full font-bold shadow-lg">{unreadCount}</span>
                  )}
                </button>

                {/* Notifications Dropdown - stays open until bell is clicked again */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                      <h3 className="font-bold text-gray-900">Notifications</h3>
                      {unreadCount > 0 && <p className="text-xs text-blue-600 font-medium mt-1">{unreadCount} new</p>}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">No notifications</div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} className={`p-4 border-b transition-colors ${notif.type === 'alert' ? 'bg-red-50 border-red-100 hover:bg-red-100' :
                          notif.type === 'warning' ? 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100' :
                            notif.type === 'success' ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' :
                              'bg-blue-50 border-blue-100 hover:bg-blue-100'
                          }`}>
                          <div className="flex items-start gap-3">
                            <div className={`px-2.5 py-1.5 rounded-lg shrink-0 ${notif.type === 'alert' ? 'bg-red-200 text-red-700' :
                              notif.type === 'warning' ? 'bg-yellow-200 text-yellow-700' :
                                notif.type === 'success' ? 'bg-emerald-200 text-emerald-700' : 'bg-blue-200 text-blue-700'
                              }`}>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className={`font-semibold text-sm ${notif.type === 'alert' ? 'text-red-900' :
                                notif.type === 'warning' ? 'text-yellow-900' :
                                  notif.type === 'success' ? 'text-emerald-900' : 'text-blue-900'
                                }`}>{notif.title}</p>
                              <p className={`text-xs mt-1 ${notif.type === 'alert' ? 'text-red-700' :
                                notif.type === 'warning' ? 'text-yellow-700' :
                                  notif.type === 'success' ? 'text-emerald-700' : 'text-blue-700'
                                }`}>{notif.message}</p>
                              <p className={`text-xs mt-2 ${notif.type === 'alert' ? 'text-red-600' :
                                notif.type === 'warning' ? 'text-yellow-600' :
                                  notif.type === 'success' ? 'text-emerald-600' : 'text-blue-600'
                                }`}>{notif.timestamp.toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Screen */}
          {currentScreen === 'dashboard' && (
            <>
              {/* Alert Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-red-50 border border-red-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <svg className="w-6 h-6 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-bold text-red-900">Low Cash Balance Alert</p>
                      <p className="text-sm text-red-700">Cash position: ₹45L (below ₹50L threshold)</p>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <svg className="w-6 h-6 text-yellow-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-bold text-yellow-900">Overdue Payments</p>
                      <p className="text-sm text-yellow-700">3 payments overdue · Total: ₹28.5L</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Dashboard Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-red-50 rounded-xl shadow-md border border-red-200 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-red-600 uppercase tracking-wide">Outstanding Payables</div>
                      <div className="text-2xl font-bold text-gray-900 mt-2">₹ 1.43Cr</div>
                      <div className="text-xs text-gray-600 mt-2">47 vendors</div>
                    </div>
                    <div className="w-14 h-14 bg-red-200 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 h-2 bg-red-300 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-3/4"></div>
                  </div>
                  <p className="text-xs text-red-600 font-medium mt-3">+12% from last month</p>
                </div>

                <div className="bg-blue-50 rounded-xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Outstanding Receivables</div>
                      <div className="text-2xl font-bold text-gray-900 mt-2">₹ 2.11Cr</div>
                      <div className="text-xs text-gray-600 mt-2">32 clients</div>
                    </div>
                    <div className="w-14 h-14 bg-blue-200 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 h-2 bg-blue-300 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-1/2"></div>
                  </div>
                  <p className="text-xs text-blue-600 font-medium mt-3">-5% from last month</p>
                </div>

                <div className="bg-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">This Week – Outflows</div>
                      <div className="text-2xl font-bold text-gray-900 mt-2">₹ 18.75L</div>
                      <div className="text-xs text-gray-600 mt-2">23 payments</div>
                    </div>
                    <div className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-1.5">
                    {[...Array(5)].map((_, i) => <div key={i} className={`flex-1 h-2 rounded-full ${i < 3 ? 'bg-slate-800' : 'bg-gray-200'}`}></div>)}
                  </div>
                  <p className="text-xs text-slate-800 font-medium mt-3">3 high priority</p>
                </div>

                <div className="bg-emerald-50 rounded-xl shadow-md border border-emerald-200 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Net 30-Day</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-2">+ ₹ 42.2L</div>
                      <div className="text-xs text-gray-600 mt-2">Projected</div>
                    </div>
                    <div className="w-14 h-14 bg-emerald-200 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 h-2 bg-emerald-300 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-full"></div>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium mt-3">Comfortable position</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <p className="text-xs font-bold text-slate-800 uppercase">Pending Approvals</p>
                  <p className="text-3xl font-bold text-gray-900 mt-3">5</p>
                  <p className="text-xs text-slate-800 font-medium mt-2">Action required</p>
                </div>
                <div className="bg-blue-50 rounded-xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-all">
                  <p className="text-xs font-bold text-blue-600 uppercase">This Month Paid</p>
                  <p className="text-3xl font-bold text-gray-900 mt-3">₹ 65.5L</p>
                  <p className="text-xs text-blue-600 font-medium mt-2">Across 42 vendors</p>
                </div>
                <div className="bg-emerald-50 rounded-xl shadow-md border border-emerald-200 p-6 hover:shadow-lg transition-all">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Avg. Days to Pay</p>
                  <p className="text-3xl font-bold text-gray-900 mt-3">24 days</p>
                  <p className="text-xs text-emerald-600 font-medium mt-2">Within target</p>
                </div>
              </div>
            </>
          )}



          {/* Cashflow Screen */}
          {currentScreen === 'cashflow' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-emerald-50 rounded-xl shadow-md border border-emerald-200 p-6 hover:shadow-lg transition-all">
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Expected Inflows</div>
                <div className="text-3xl font-bold text-emerald-700 mt-3">₹ 1,30,50,000</div>
                <div className="text-sm text-gray-600 mt-2">Clients · Investors · Banks</div>
              </div>
              <div className="bg-red-50 rounded-xl shadow-md border border-red-200 p-6 hover:shadow-lg transition-all">
                <div className="text-xs font-bold text-red-600 uppercase tracking-wide">Scheduled Outflows</div>
                <div className="text-3xl font-bold text-red-700 mt-3">₹ 88,30,000</div>
                <div className="text-sm text-gray-600 mt-2">Vendors + Salaries + Statutory</div>
              </div>
              <div className="bg-blue-50 rounded-xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-all">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Projected Net</div>
                <div className="text-3xl font-bold text-blue-700 mt-3">+ ₹ 42,20,000</div>
                <div className="text-sm text-gray-600 mt-2">Comfortable position</div>
              </div>
            </div>
          )}

          {/* Treasury Screen */}
          {currentScreen === 'treasury' && (
            <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 overflow-x-auto hover:shadow-lg transition-all">
              <table className="w-full table-fixed min-w-175 text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50">
                    <th className="w-[20%] px-4 py-3 text-left font-bold text-gray-900">Account</th>
                    <th className="w-[15%] px-4 py-3 text-left font-bold text-gray-900">Type</th>
                    <th className="w-[20%] px-4 py-3 text-right font-bold text-gray-900">Balance</th>
                    <th className="w-[15%] px-4 py-3 text-left font-bold text-gray-900">Bank</th>
                    <th className="w-[30%] px-4 py-3 text-left font-bold text-gray-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">EI – Current A/C</td>
                    <td className="px-4 py-3"><span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-200">Operating</span></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">₹ 1,05,40,000</td>
                    <td className="px-4 py-3 text-gray-700">Axis Bank</td>
                    <td className="px-4 py-3 text-gray-700">Main collections & payouts</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">EI – OD Limit</td>
                    <td className="px-4 py-3"><span className="px-3 py-1 bg-gray-100 text-slate-900 text-xs font-medium rounded-lg border border-gray-200">Working Capital</span></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">₹ 40,00,000 used</td>
                    <td className="px-4 py-3 text-gray-700">SBI</td>
                    <td className="px-4 py-3 text-gray-700">Limit 1.5 Cr</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-bold text-gray-800">Released POs — payment transactions</h3>
                <button
                  type="button"
                  onClick={() => void refetchTreasuryPos()}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Refresh
                </button>
              </div>
              {treasuryPoLoading ? (
                <p className="text-sm text-gray-500 py-6 text-center">Loading PO payment records…</p>
              ) : (
                <>
                  <TreasuryPoPaymentsTable
                    rows={treasuryPurchaseOrders}
                    onView={setTreasuryPoDetailView}
                  />
                </>
              )}
            </div>
            </div>
          )}

          {/* Payment Approvals Workflow */}
          {currentScreen === 'approvals' && (
            <>
              <div className="flex gap-2 mb-6 flex-wrap">
                <button className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium border border-blue-300 hover:shadow-lg transition-all">Pending (5)</button>
                <button className="px-5 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors">Approved (12)</button>
                <button className="px-5 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors">Rejected (2)</button>
              </div>

              <div className="space-y-4">
                {payments.map(payment => (
                  <div key={payment.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-bold text-lg text-gray-900">{payment.vendor}</h3>
                          <span className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${payment.priority === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                            payment.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                              'bg-gray-100 text-gray-700 border-gray-300'
                            }`}>
                            {payment.priority === 'high' ? 'High Priority' : payment.priority === 'medium' ? 'Medium Priority' : 'Low Priority'}
                          </span>
                          <span className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${payment.status === 'pending' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                            payment.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                              payment.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-300' :
                                'bg-purple-100 text-purple-700 border-purple-300'
                            }`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Amount</p>
                            <p className="font-bold text-gray-900">₹ {(payment.amount / 100000).toFixed(2)}L</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Due Date</p>
                            <p className="font-bold text-gray-900">{payment.dueDate}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Payment ID</p>
                            <p className="font-bold text-gray-900">{payment.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Approval Status</p>
                            <p className="font-bold text-gray-900">{payment.approvals.filter(a => a.status === 'approved').length}/{payment.approvals.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Approval Timeline */}
                    <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                      <p className="text-xs font-bold text-blue-900 mb-3">Approval Chain</p>
                      <div className="space-y-3">
                        {payment.approvals.map((approval, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className={`px-3 py-2 rounded-lg text-xs font-medium border ${approval.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                              approval.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-300' :
                                'bg-gray-100 text-gray-700 border-gray-300'
                              }`}>
                              Level {approval.level}
                            </div>
                            <div className="flex-1">
                              {approval.status === 'approved' ? (
                                <p className="text-sm text-gray-700">Approved by <span className="font-semibold text-gray-900">{approval.by}</span> on {approval.date}</p>
                              ) : approval.status === 'rejected' ? (
                                <p className="text-sm text-gray-700">Rejected by <span className="font-semibold text-gray-900">{approval.by}</span> on {approval.date}</p>
                              ) : (
                                <p className="text-sm text-gray-600">Awaiting approval</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {payment.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            handleApproval(payment.id, true);
                          }}
                          className="flex-1 px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg transition-all hover:shadow-lg"
                        >
                          Approve Payment
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            handleApproval(payment.id, false);
                          }}
                          className="flex-1 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold rounded-lg border border-red-300 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* New Payment Screen */}
          {currentScreen === 'new-payment' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Request Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                    <option>Advance Against PO</option>
                    <option>Due Payment Against Bill</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Vendor / Payee</label>
                  <input placeholder="Search vendor" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Amount</label>
                  <input placeholder="₹ 0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Payment Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Add Payment Request
              </button>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendor</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">Radcom Packaging</td>
                        <td className="px-4 py-3 font-semibold">₹ 6,50,000</td>
                        <td className="px-4 py-3">Jan 25, 2026</td>
                        <td className="px-4 py-3"><span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded border border-yellow-200">Pending</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {/* PO Advance Requests Screen */}
          {currentScreen === 'po-advances' && (() => {
            const treasuryPOs: any[] = state.po?.treasury || [];
            const plannedPOs: any[] = state.po?.planned || [];

            const issuePO = (po: any) => {
              const itemUpdates = (po.lines || []).map((l: any) => ({
                itemId: l.itemId,
                inTransitDelta: l.qty,
              }));
              dispatch({ type: 'ISSUE_PO_FROM_TREASURY', payload: { poId: po.id, itemUpdates } });
            };

            const fmtMoney = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));

            return (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Released POs from Procurement</h3>
                    <button
                      type="button"
                      onClick={() => void refetchTreasuryPos()}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Refresh
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Summary in the table; use the view icon for full payment terms, transaction details, and line items.
                  </p>
                  {treasuryPoLoading ? (
                    <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
                  ) : (
                    <>
                      <TreasuryPoPaymentsTable
                        rows={treasuryPurchaseOrders}
                        onView={setTreasuryPoDetailView}
                      />
                    </>
                  )}
                </div>

                {/* Treasury POs awaiting advance approval */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">POs Awaiting Advance Approval</h3>
                  {treasuryPOs.length === 0 ? (
                    <p className="text-gray-400 text-sm py-6 text-center">No POs awaiting advance payment. Create planned lines from Procurement.</p>
                  ) : (
                    <div className="space-y-3">
                      {treasuryPOs.map((po: any) => {
                        const total = (po.lines || []).reduce((s: number, l: any) => s + l.qty * l.unit, 0);
                        const advPct = state.masters?.paymentTerms?.find((t: any) => t.id === po.termsId)?.advancePct || 0;
                        const advAmt = Math.round(total * advPct / 100);
                        return (
                          <div key={po.id} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between flex-wrap gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-mono font-bold text-gray-800">{po.id}</span>
                                  <span className="font-semibold text-gray-700">{po.vendor}</span>
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">Advance Pending</span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  {(po.lines || []).map((l: any) => (
                                    <p key={l.itemId}>{l.itemName} — {new Intl.NumberFormat('en-IN').format(l.qty)} {l.uom} @ ₹{l.unit}</p>
                                  ))}
                                  {po.paymentTransactionNo && (
                                    <p className="text-xs text-emerald-700 font-medium pt-1">
                                      Txn {po.paymentTransactionNo} · {po.paymentMode} · {po.paymentTransactionDate}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">PO Value</p>
                                <p className="text-xl font-bold text-gray-800">{fmtMoney(total)}</p>
                                {advPct > 0 && <p className="text-sm text-orange-600 font-medium">{advPct}% advance = {fmtMoney(advAmt)}</p>}
                                <button
                                  onClick={() => issuePO(po)}
                                  className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                                >
                                  Approve & Issue PO
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Planned lines waiting to be converted to Draft POs */}
                {plannedPOs.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 text-sm">PO Planned Stage — {plannedPOs.length} lines pending Draft conversion</h4>
                    <p className="text-xs text-blue-600">These planned lines from Procurement are waiting to be grouped into Draft POs. Visit Procurement tab in Sales & Purchase to manage them.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Budgets Screen */}
          {currentScreen === 'budgets' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Budget</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Committed</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Actual</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">COGS - Raw Materials</td>
                      <td className="px-4 py-3 font-semibold">₹ 40,00,000</td>
                      <td className="px-4 py-3">₹ 28,50,000</td>
                      <td className="px-4 py-3">₹ 6,20,000</td>
                      <td className="px-4 py-3"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded border border-emerald-200">₹ 5,30,000</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}











          {/* Settings & Configuration Screen */}
          {currentScreen === 'settings' && (
            <div className="space-y-6">
              {/* Regional Settings */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Regional Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Currency</label>
                    <select value={settings.currency} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option>INR</option>
                      <option>USD</option>
                      <option>EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Date Format</label>
                    <select value={settings.dateFormat} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Timezone</label>
                    <select value={settings.timezone} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option>IST (UTC+5:30)</option>
                      <option>UTC</option>
                      <option>EST</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Language</label>
                    <select value={settings.language} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Spanish</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Display Settings */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Display Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Theme</label>
                    <select value={settings.theme} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Auto-refresh Data</label>
                    <input type="checkbox" checked={settings.autoRefresh} className="rounded" />
                  </div>
                  {settings.autoRefresh && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Refresh Interval (seconds)</label>
                      <input type="number" value={settings.refreshInterval} className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm mt-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* Column Customization */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Customizable Columns</h3>
                <div className="space-y-2">
                  {Object.entries(visibleColumns).map(([col, visible]) => (
                    <div key={col} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                        className="rounded"
                      />
                      <label className="text-sm font-medium text-gray-700 capitalize">{col}</label>
                    </div>
                  ))}
                </div>
              </div>

              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Save All Settings
              </button>
            </div>
          )}

          {/* Placeholder for other screens */}
          {['schedule', 'execute', 'recurring', 'inflows-clients', 'inflows-funding'].includes(currentScreen) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">Content for {screenTitles[currentScreen]} coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {treasuryPoDetailView ? (
        <TreasuryPoDetailModal po={treasuryPoDetailView} onClose={() => setTreasuryPoDetailView(null)} />
      ) : null}
    </div>
  );
};

export default TreasuryApp;
