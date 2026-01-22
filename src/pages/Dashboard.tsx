
import React from 'react';
import { UnifiedBadge, getStatusBadgeColor } from '../components/ui';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, change, changeType, bgColor }) => (
  <div className={`${bgColor} rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {change && (
          <p className={`text-sm mt-2 flex items-center ${
            changeType === 'positive' ? 'text-emerald-600' : 
            changeType === 'negative' ? 'text-amber-600' : 'text-gray-500'
          }`}>
            {changeType === 'positive' && <span className="mr-1">↑</span>}
            {changeType === 'negative' && <span className="mr-1">•</span>}
            {change}
          </p>
        )}
      </div>
      <div className="text-amber-500 opacity-80">
        {icon}
      </div>
    </div>
  </div>
);

interface RecentOrder {
  id: string;
  company: string;
  status: string;
  date: string;
}

interface RecentActivity {
  id: string;
  action: string;
  user: string;
  time: string;
}

const Dashboard = () => {
  const stats = [
    {
      title: 'Total Orders',
      value: 156,
      change: '+12% from last month',
      changeType: 'positive' as const,
      bgColor: 'bg-white',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      title: 'Pending Reviews',
      value: 23,
      change: '5 urgent',
      changeType: 'negative' as const,
      bgColor: 'bg-white',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Active Users',
      value: 42,
      change: '+3 this week',
      changeType: 'positive' as const,
      bgColor: 'bg-white',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      title: 'Total Enquiries',
      value: 89,
      change: '+8% from last month',
      changeType: 'positive' as const,
      bgColor: 'bg-white',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];

  const recentOrders: RecentOrder[] = [
    { id: 'ORD001', company: 'MedCorp Solutions', status: 'Review at BD', date: '2024-01-15' },
    { id: 'ORD002', company: 'HealthTech Inc', status: 'Review at R&D', date: '2024-01-20' },
    { id: 'ORD003', company: 'Clinical Partners', status: 'Approved', date: '2024-01-25' },
    { id: 'ORD004', company: 'Pharma Solutions', status: 'Packaging', date: '2024-01-30' },
    { id: 'ORD005', company: 'Medical Supplies Co', status: 'Shipped', date: '2024-02-01' },
  ];

  const recentActivity: RecentActivity[] = [
    { id: '1', action: 'New order created', user: 'John Smith', time: '5 mins ago' },
    { id: '2', action: 'User role updated', user: 'Admin', time: '15 mins ago' },
    { id: '3', action: 'Order approved', user: 'Sarah Johnson', time: '1 hour ago' },
    { id: '4', action: 'New enquiry received', user: 'System', time: '2 hours ago' },
    { id: '5', action: 'Order shipped', user: 'Michael Brown', time: '3 hours ago' },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                const userRole = localStorage.getItem('adminUserRole') || 'SUPER_ADMIN';
                window.open(`/order-hub?role=${userRole}`, '_blank', 'noopener,noreferrer');
              }}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
            >
              View all in Tracker →
            </button>
          </div>
          
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800">{order.id}</span>
                  <UnifiedBadge variant={getStatusBadgeColor(order.status)}>
                    {order.status}
                  </UnifiedBadge>
                </div>
                <p className="text-sm text-gray-700 font-medium">{order.company}</p>
                <p className="text-xs text-gray-400 mt-1">{order.date}</p>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-3 font-semibold">Order ID</th>
                  <th className="pb-3 font-semibold">Company</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 text-gray-800 font-semibold">{order.id}</td>
                    <td className="py-4 text-gray-700">{order.company}</td>
                    <td className="py-4">
                      <UnifiedBadge variant={getStatusBadgeColor(order.status)}>
                        {order.status}
                      </UnifiedBadge>
                    </td>
                    <td className="py-4 text-gray-400">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-2 h-2 bg-amber-400 rounded-full mt-2 shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{activity.action}</p>
                  <p className="text-xs text-gray-400">{activity.user} • {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/order-management" className="flex flex-col items-center p-5 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all duration-200 border border-gray-100">
            <svg className="w-7 h-7 text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm font-medium text-gray-700 text-center">New Order</span>
          </a>
          <a href="/user-management" className="flex flex-col items-center p-5 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all duration-200 border border-gray-100">
            <svg className="w-7 h-7 text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 text-center">Add User</span>
          </a>
          <a href="/role-management" className="flex flex-col items-center p-5 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all duration-200 border border-gray-100">
            <svg className="w-7 h-7 text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 text-center">Manage Roles</span>
          </a>
          <a href="/enquiry-management" className="flex flex-col items-center p-5 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all duration-200 border border-gray-100">
            <svg className="w-7 h-7 text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 text-center">Enquiries</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
