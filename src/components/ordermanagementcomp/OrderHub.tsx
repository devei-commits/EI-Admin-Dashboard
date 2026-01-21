import React from 'react';

const OrderHub: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-7 border border-amber-100">
        <h2 className="text-3xl font-bold text-gray-800 mb-3 tracking-tight">Order Hub</h2>
        <p className="text-gray-700 leading-relaxed tracking-wide">Centralized order management and tracking system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Total Orders</p>
              <p className="text-3xl font-bold text-gray-800">124</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Pending</p>
              <p className="text-3xl font-bold text-amber-600">28</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Processing</p>
              <p className="text-3xl font-bold text-blue-600">45</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Completed</p>
              <p className="text-3xl font-bold text-green-600">51</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-7">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <button className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md font-medium tracking-wider">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Order</span>
          </button>

          <button className="flex items-center gap-3 px-5 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium tracking-wider">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Bulk Import</span>
          </button>

          <button className="flex items-center gap-3 px-5 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium tracking-wider">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-7">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 uppercase tracking-wider">Recent Activity</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="bg-green-100 p-2 rounded-full">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Order #ORD001 completed</p>
              <p className="text-xs text-gray-500 mt-1">2 minutes ago</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="bg-blue-100 p-2 rounded-full">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">New order #ORD025 created</p>
              <p className="text-xs text-gray-500 mt-1">15 minutes ago</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="bg-amber-100 p-2 rounded-full">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Order #ORD018 status updated</p>
              <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHub;
