import React, { useRef, useState } from 'react';
import { Order } from '../../types/salesPurchase.types';
import { importOpenSoHeadersExcel } from '../../services/salesPurchase.service';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-400';
    case 'completed': return 'bg-green-500';
    case 'processing': return 'bg-blue-500';
    default: return 'bg-gray-300';
  }
};

interface SalesTabProps {
  filteredSalesOrders: Order[];
  openDetailModal: (order: Order) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  selectedFilters: string[];
  toggleFilter: (filter: string) => void;
  filterStatuses: string[];
  customField: string;
  setCustomField: (v: string) => void;
  setSelectedFilters: (v: string[]) => void;
  setShowFiltersOff: () => void;
  onCreateSO: () => void;
  /** Called after a successful Open SO Headers Excel import (e.g. refetch list). */
  onOrdersChanged?: () => void;
  onImportMessage?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SalesTab: React.FC<SalesTabProps> = ({
  filteredSalesOrders,
  openDetailModal,
  showFilters,
  setShowFilters,
  selectedFilters,
  toggleFilter,
  filterStatuses,
  customField,
  setCustomField,
  setSelectedFilters,
  setShowFiltersOff,
  onCreateSO,
  onOrdersChanged,
  onImportMessage,
}) => {
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    if (onImportMessage) onImportMessage(type, message);
    else if (type === 'error') window.alert(message);
  };

  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingExcel(true);
    try {
      const res = await importOpenSoHeadersExcel(file, { details: true });
      const s = res.summary;
      if (!res.ok) {
        notify('error', res.error ?? 'Sales order import failed');
        return;
      }
      notify(
        'success',
        `Sales orders: ${s?.sales_orders_created ?? 0} created, ${s?.sales_orders_updated ?? 0} updated, ${res.rows_imported ?? res.rows_total ?? 0} rows from Excel, ${s?.errors ?? 0} errors`,
      );
      if ((s?.errors ?? 0) > 0 && res.row_log?.length) {
        const sample = res.row_log
          .filter((r) => r.action === 'error')
          .slice(0, 3)
          .map((r) => `row ${r.excel_row}: ${r.reason ?? r.action}`)
          .join('; ');
        if (sample) notify('info', `Sample issues: ${sample}`);
      }
      onOrdersChanged?.();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Sales order import failed');
    } finally {
      setImportingExcel(false);
    }
  };

  return (
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
                          setShowFiltersOff();
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
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={handleExcelChange}
            aria-hidden
          />
          <button
            type="button"
            disabled={importingExcel}
            onClick={() => excelInputRef.current?.click()}
            className="flex-1 sm:flex-none bg-white text-gray-700 px-3 sm:px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-60"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            <span className="hidden sm:inline">{importingExcel ? 'Importing…' : 'Import Excel'}</span>
            <span className="sm:hidden">{importingExcel ? '…' : 'Import'}</span>
          </button>
          <button type="button" onClick={onCreateSO} className="flex-1 sm:flex-none bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-800 hover: transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
  );
};

export default SalesTab;
