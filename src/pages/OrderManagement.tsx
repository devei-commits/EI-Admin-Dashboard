import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OrderTable } from '../components/ordermanagementcomp';

const Ordermanagement = () => {
  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Order Management</h1>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
              <Link to="/" className="text-blue-600 hover:text-blue-800 hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">Order Management</span>
            </div>
          </div>
          <Link
            to="/order-hub"
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium transition-colors"
          >
            Open Tracker
          </Link>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <OrderTable />
      </div>
    </div>
  )
}

export default Ordermanagement
