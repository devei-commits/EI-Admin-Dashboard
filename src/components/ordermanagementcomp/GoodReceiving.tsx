import React, { useState } from 'react';

interface ReceivedItem {
  id: string;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  condition: 'Good' | 'Damaged' | 'Partial';
  notes: string;
}

interface GoodReceivingRecord {
  id: string;
  grNumber: string;
  orderId: string;
  supplierName: string;
  receivedDate: string;
  receivedBy: string;
  invoiceNumber: string;
  totalItems: number;
  status: 'Pending' | 'Completed' | 'Rejected';
  items: ReceivedItem[];
  remarks?: string;
  createdAt: string;
}

const MOCK_RECEIVING_RECORDS: GoodReceivingRecord[] = [
  {
    id: 'gr-1',
    grNumber: 'GR-2026-001',
    orderId: 'PO-2026-001',
    supplierName: 'Supplier Alpha',
    receivedDate: '2026-01-20',
    receivedBy: 'Rajesh Kumar',
    invoiceNumber: 'INV-2026-0001',
    totalItems: 3,
    status: 'Completed',
    items: [
      { id: 'item-1', itemName: 'Component A', orderedQty: 100, receivedQty: 100, unit: 'Kg', condition: 'Good', notes: 'As per specification' },
      { id: 'item-2', itemName: 'Component B', orderedQty: 50, receivedQty: 48, unit: 'Liters', condition: 'Partial', notes: '2 units damaged in transit' },
      { id: 'item-3', itemName: 'Component C', orderedQty: 25, receivedQty: 25, unit: 'Pieces', condition: 'Good', notes: 'Quality verified' },
    ],
    remarks: 'Goods received and stored in warehouse A',
    createdAt: '2026-01-20 10:30'
  },
  {
    id: 'gr-2',
    grNumber: 'GR-2026-002',
    orderId: 'PO-2026-002',
    supplierName: 'Supplier Beta',
    receivedDate: '2026-01-22',
    receivedBy: 'Priya Sharma',
    invoiceNumber: 'INV-2026-0002',
    totalItems: 2,
    status: 'Pending',
    items: [
      { id: 'item-4', itemName: 'Raw Material X', orderedQty: 200, receivedQty: 200, unit: 'gm', condition: 'Good', notes: 'Stock verified' },
      { id: 'item-5', itemName: 'Raw Material Y', orderedQty: 150, receivedQty: 150, unit: 'ml', condition: 'Good', notes: 'Temperature maintained' },
    ],
    remarks: 'Awaiting quality check completion',
    createdAt: '2026-01-22 14:15'
  },
  {
    id: 'gr-3',
    grNumber: 'GR-2026-003',
    orderId: 'PO-2026-003',
    supplierName: 'Supplier Gamma',
    receivedDate: '2026-01-23',
    receivedBy: 'Amit Patel',
    invoiceNumber: 'INV-2026-0003',
    totalItems: 4,
    status: 'Rejected',
    items: [
      { id: 'item-6', itemName: 'Ingredient D', orderedQty: 80, receivedQty: 60, unit: 'Kg', condition: 'Damaged', notes: 'Packaging damaged, contents compromised' },
      { id: 'item-7', itemName: 'Ingredient E', orderedQty: 40, receivedQty: 40, unit: 'Pieces', condition: 'Good', notes: 'Quality OK' },
      { id: 'item-8', itemName: 'Ingredient F', orderedQty: 30, receivedQty: 0, unit: 'Liters', condition: 'Damaged', notes: 'Container leaked, item lost' },
      { id: 'item-9', itemName: 'Ingredient G', orderedQty: 50, receivedQty: 50, unit: 'gm', condition: 'Good', notes: 'Stock received' },
    ],
    remarks: 'Goods rejected due to damage. Return initiated.',
    createdAt: '2026-01-23 09:45'
  },
];

const GoodReceiving: React.FC = () => {
  const [records] = useState<GoodReceivingRecord[]>(MOCK_RECEIVING_RECORDS);
  const [selectedRecord, setSelectedRecord] = useState<GoodReceivingRecord | null>(null);
  const [, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Completed' | 'Rejected'>('All');

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.grNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Good':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Damaged':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Partial':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Good Receiving</h2>
          <p className="text-sm text-gray-600 mt-1">Track and manage received goods from suppliers</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New GR
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by GR Number, Order ID, or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Pending' | 'Completed' | 'Rejected')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Records Grid */}
      <div className="grid gap-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No receiving records found</p>
            <p className="text-gray-400 text-sm mt-1">Create a new Good Receiving record to get started</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Record Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-800">{record.grNumber}</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Order ID</p>
                      <p className="text-gray-800 font-semibold">{record.orderId}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Supplier</p>
                      <p className="text-gray-800 font-semibold">{record.supplierName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Received Date</p>
                      <p className="text-gray-800 font-semibold">{record.receivedDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Received By</p>
                      <p className="text-gray-800 font-semibold">{record.receivedBy}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                  className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className={`w-5 h-5 text-gray-600 transition-transform ${selectedRecord?.id === record.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Record Details */}
              {selectedRecord?.id === record.id && (
                <div className="p-4 space-y-4">
                  {/* Record Info */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Invoice No</p>
                      <p className="font-semibold text-gray-800">{record.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Total Items</p>
                      <p className="font-semibold text-gray-800">{record.totalItems}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Created At</p>
                      <p className="font-semibold text-gray-800">{record.createdAt}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Item Name</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Ordered Qty</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Received Qty</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Unit</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Condition</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800 font-medium">{item.itemName}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.orderedQty}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={item.receivedQty === item.orderedQty ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                                {item.receivedQty}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.unit}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getConditionColor(item.condition)}`}>
                                {item.condition}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-sm">{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks */}
                  {record.remarks && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-1">Remarks</p>
                      <p className="text-blue-900">{record.remarks}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Approve
                    </button>
                    <button className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Reject
                    </button>
                    <button className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Print
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Total Records</p>
          <p className="text-2xl font-bold text-gray-800">{records.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-green-700 uppercase tracking-wide mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-800">{records.filter(r => r.status === 'Completed').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <p className="text-xs text-yellow-700 uppercase tracking-wide mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-800">{records.filter(r => r.status === 'Pending').length}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-xs text-red-700 uppercase tracking-wide mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-800">{records.filter(r => r.status === 'Rejected').length}</p>
        </div>
      </div>
    </div>
  );
};

export default GoodReceiving;
