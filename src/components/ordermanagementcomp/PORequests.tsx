import React, { useState } from 'react';

interface PORequest {
  id: string;
  oldSku: string;
  poItemName: string;
  itemCategory: string;
  moq: number;
  unitPrice: number;
  vendorName: string;
  duePayable: string;
  procTime: number;
  poQty: number;
  unitPriceQty: number;
  poBudget: number;
  netReqQty: number;
  availableStock: number;
  s2ConsoReq: number;
  poRequestDt: string;
  creatorComments: string;
  poType: string;
  createdBy: string;
  referenceId: string;
  isApproved: 'APPROVE' | 'add' | 'pending';
  approverComments: string;
  poApprovedDt: string;
  poScheduleDt: string;
}

const MOCK_PO_REQUESTS: PORequest[] = [
  {
    id: '1',
    oldSku: 'SL01195',
    poItemName: 'OLIVA OILY SKIN MRP STICKERS NEW MRP 1675 WITH BARCODE',
    itemCategory: 'Stickers',
    moq: 0.50,
    unitPrice: 3000.00,
    vendorName: 'SS PRINTERS',
    duePayable: '',
    procTime: 10,
    poQty: 2000.00,
    unitPriceQty: 0.50,
    poBudget: 6000.00,
    netReqQty: 2000,
    availableStock: 12436,
    s2ConsoReq: 0.50,
    poRequestDt: '23-01-2026',
    creatorComments: 'Add',
    poType: 'ADHOC',
    createdBy: '61',
    referenceId: '2396',
    isApproved: 'APPROVE',
    approverComments: '',
    poApprovedDt: '23-01-2026',
    poScheduleDt: '23-01-2026',
  },
  {
    id: '2',
    oldSku: '1001315',
    poItemName: 'OCTYL METHOXYCINNAMATE OMC OC SPECIALITY',
    itemCategory: 'Raw Materials',
    moq: 950.00,
    unitPrice: 125.00,
    vendorName: 'OC SPECIALITIES CHEMICALS PRIVATE LIMITED',
    duePayable: '0',
    procTime: 20,
    poQty: 50.00,
    unitPriceQty: 950.00,
    poBudget: 47500.00,
    netReqQty: -41.00,
    availableStock: 34.91696,
    s2ConsoReq: 54.375,
    poRequestDt: '23-01-2026',
    creatorComments: 'Add',
    poType: 'Standard',
    createdBy: '61',
    referenceId: '2806',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '23-01-2026',
  },
  {
    id: '3',
    oldSku: '1000551',
    poItemName: 'BELSIL EG 2',
    itemCategory: 'Raw Materials',
    moq: 1150.00,
    unitPrice: 200.00,
    vendorName: 'DKSH INDIA PRIVATE LIMITED',
    duePayable: '',
    procTime: 10,
    poQty: 100.00,
    unitPriceQty: 1150.00,
    poBudget: 115000.00,
    netReqQty: -97.9608,
    availableStock: 5.6207,
    s2ConsoReq: 19.3625,
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: 'Standard',
    createdBy: '61',
    referenceId: '170',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '22-01-2026',
  },
  {
    id: '4',
    oldSku: '1000105',
    poItemName: 'CARBOPOL AQUA SF1',
    itemCategory: 'Raw Materials',
    moq: 445.00,
    unitPrice: 217.00,
    vendorName: 'ARIHANT INNOCHEM PVT LTD',
    duePayable: '927425.88',
    procTime: 10,
    poQty: 217.00,
    unitPriceQty: 445.00,
    poBudget: 96565.00,
    netReqQty: -2.05,
    availableStock: 15,
    s2ConsoReq: 1.05,
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: 'Standard',
    createdBy: '61',
    referenceId: '115',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '22-01-2026',
  },
  {
    id: '5',
    oldSku: 'SL01540',
    poItemName: 'SK ACNE LIMIT FACIAL CREAM WITH 9 AZELAIC ACID 4 NIACINAMIDE FOR MODERATE ACNE 30ML LABLE AIRLESS BOTTLE',
    itemCategory: 'Packaging',
    moq: 3.00,
    unitPrice: 6000.00,
    vendorName: 'WEBACK LABELS PRIVATE LIMITED',
    duePayable: '',
    procTime: 10,
    poQty: 5000.00,
    unitPriceQty: 3.00,
    poBudget: 15000.00,
    netReqQty: -2000,
    availableStock: 2000,
    s2ConsoReq: 4000,
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: 'ADHOC',
    createdBy: '61',
    referenceId: '3128',
    isApproved: 'APPROVE',
    approverComments: '',
    poApprovedDt: '22-01-2026',
    poScheduleDt: '22-01-2026',
  },
];

export default function PORequests() {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PORequest | null>(null);
  const [formData, setFormData] = useState({
    confirmedQty: '',
    finalQuote: '',
    confirmedBudget: '',
    rate: '',
    selectType: 'ZOHO_LIST',
    selectedPOId: '',
  });

  const filteredRequests = MOCK_PO_REQUESTS.filter(
    (req) =>
      req.oldSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.poItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.referenceId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const toggleSelectRequest = (id: string) => {
    setSelectedRequests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRequests.length === paginatedRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(paginatedRequests.map((req) => req.id));
    }
  };

  const handleApprove = (id: string) => {
    const po = MOCK_PO_REQUESTS.find(req => req.id === id);
    if (po) {
      setSelectedPO(po);
      setFormData({
        confirmedQty: po.poQty.toString(),
        finalQuote: po.unitPriceQty.toString(),
        confirmedBudget: po.poBudget.toString(),
        rate: '',
        selectType: 'ZOHO_LIST',
        selectedPOId: '',
      });
      setIsModalOpen(true);
    }
  };

  const handleEdit = (id: string) => {
    alert(`Edit PO: ${id}`);
  };

  const handleDelete = (id: string) => {
    alert(`Delete PO: ${id}`);
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'APPROVE':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
            APPROVE
          </span>
        );
      case 'add':
        return (
          <button className="text-blue-500 hover:underline text-xs font-medium">
            add
          </button>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
            pending
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with search and controls */}
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 p-4 border-b border-amber-300">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by SKU, Item Name, or Reference ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>
        </div>
      </div>

      {/* Table - Desktop View */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-200 sticky top-0">
              <th className="border border-amber-300 p-2 text-left whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={
                    paginatedRequests.length > 0 &&
                    selectedRequests.length === paginatedRequests.length
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">ID</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">OLD SKU</th>
              <th className="border border-amber-300 p-2 text-left font-semibold">PO Item Name</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Item Category</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">MOQ</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Unit Price</th>
              <th className="border border-amber-300 p-2 text-left font-semibold">Vendor Name</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Due Payable</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PROC TIME</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO QTY</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">UNIT PRICE</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO BUDGET</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">NET_REQ QTY</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">AVAILABLE STOCK</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">#S2_ConsoReq</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO_Request_Dt</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Creator_comments</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO_type</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Created_by</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Reference_id</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">isApproved</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Approver Comments</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO_Approved_Dt</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO_Schedule_Dt</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRequests.map((request) => (
              <tr key={request.id} className="hover:bg-amber-50 transition-colors">
                <td className="border border-amber-300 p-2">
                  <input
                    type="checkbox"
                    checked={selectedRequests.includes(request.id)}
                    onChange={() => toggleSelectRequest(request.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="border border-amber-300 p-2 font-mono whitespace-nowrap">{request.id}</td>
                <td className="border border-amber-300 p-2 font-mono whitespace-nowrap">{request.oldSku}</td>
                <td className="border border-amber-300 p-2 max-w-xs truncate" title={request.poItemName}>
                  {request.poItemName}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{request.itemCategory || '-'}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.moq}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">₹{request.unitPrice.toFixed(2)}</td>
                <td className="border border-amber-300 p-2 max-w-xs truncate" title={request.vendorName}>
                  {request.vendorName}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{request.duePayable || '-'}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.procTime}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.poQty}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.unitPriceQty}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">₹{request.poBudget.toFixed(2)}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.netReqQty}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.availableStock}</td>
                <td className="border border-amber-300 p-2 text-right whitespace-nowrap">{request.s2ConsoReq}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{request.poRequestDt}</td>
                <td className="border border-amber-300 p-2">
                  {request.creatorComments === 'Add' ? (
                    <button className="text-blue-500 hover:underline font-medium">add</button>
                  ) : (
                    request.creatorComments
                  )}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{request.poType || '-'}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{request.createdBy}</td>
                <td className="border border-amber-300 p-2 font-mono whitespace-nowrap">{request.referenceId}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{getApprovalBadge(request.isApproved)}</td>
                <td className="border border-amber-300 p-2">
                  {request.approverComments === 'add' ? (
                    <button className="text-blue-500 hover:underline font-medium">add</button>
                  ) : (
                    request.approverComments || '-'
                  )}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">
                  {request.poApprovedDt ? (
                    <button className="text-blue-500 hover:underline font-medium">{request.poApprovedDt}</button>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">
                  {request.poScheduleDt ? (
                    <button className="text-blue-500 hover:underline font-medium">{request.poScheduleDt}</button>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      title="Approve"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(request.id)}
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(request.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View - Card Layout */}
      <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3">
        {paginatedRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No PO requests found</div>
        ) : (
          paginatedRequests.map((request) => (
            <div key={request.id} className="bg-white border-l-4 border-amber-400 rounded-lg shadow-sm p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-mono">SKU: {request.oldSku}</p>
                  <p className="font-medium text-sm truncate">{request.poItemName}</p>
                  <p className="text-xs text-gray-600 mt-1">Ref: {request.referenceId}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedRequests.includes(request.id)}
                  onChange={() => toggleSelectRequest(request.id)}
                  className="w-4 h-4 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                <div>
                  <span className="text-gray-600">MOQ:</span>
                  <p className="font-medium">{request.moq}</p>
                </div>
                <div>
                  <span className="text-gray-600">Budget:</span>
                  <p className="font-medium">₹{request.poBudget.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>
                  <p className="font-medium">{request.poRequestDt}</p>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p>{getApprovalBadge(request.isApproved)}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => handleApprove(request.id)}
                  className="flex-1 px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleEdit(request.id)}
                  className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(request.id)}
                  className="flex-1 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-amber-300 bg-amber-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Showing {paginatedRequests.length === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1} to{' '}
          {Math.min(currentPage * entriesPerPage, filteredRequests.length)} of {filteredRequests.length} entries
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-amber-300 rounded text-sm font-medium bg-white hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 1))
            .map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 border rounded text-sm font-medium ${
                  currentPage === page
                    ? 'bg-amber-400 text-white border-amber-400'
                    : 'border-amber-300 bg-white hover:bg-amber-50'
                }`}
              >
                {page}
              </button>
            ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-amber-300 rounded text-sm font-medium bg-white hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Execute Purchase Orders Modal */}
      {isModalOpen && selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Execute Purchase Orders</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* PO Item Qty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Item Qty
                </label>
                <p className="text-gray-600 text-sm font-semibold">{selectedPO.poQty}</p>
              </div>

              {/* PO Item Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Item Unit Price
                </label>
                <p className="text-gray-600 text-sm font-semibold">{selectedPO.unitPriceQty}</p>
              </div>

              {/* CONFIRMED PO QTY */}
              <div>
                <label htmlFor="confirmedQty" className="block text-sm font-medium text-gray-700 mb-1">
                  CONFIRMED PO QTY
                </label>
                <input
                  id="confirmedQty"
                  type="number"
                  value={formData.confirmedQty}
                  onChange={(e) => setFormData({ ...formData, confirmedQty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                />
              </div>

              {/* FINAL QUOTE PER UNIT */}
              <div>
                <label htmlFor="finalQuote" className="block text-sm font-medium text-gray-700 mb-1">
                  FINAL QUOTE PER UNIT
                </label>
                <input
                  id="finalQuote"
                  type="number"
                  value={formData.finalQuote}
                  onChange={(e) => setFormData({ ...formData, finalQuote: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                />
              </div>

              {/* CONFIRMED BUDGET */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CONFIRMED BUDGET
                </label>
                <input
                  type="text"
                  placeholder="Rate"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                />
              </div>

              {/* SELECT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select :
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <input
                      id="zohoList"
                      type="radio"
                      name="selectType"
                      value="ZOHO_LIST"
                      checked={formData.selectType === 'ZOHO_LIST'}
                      onChange={(e) => setFormData({ ...formData, selectType: e.target.value })}
                      className="w-4 h-4 text-amber-400"
                    />
                    <label htmlFor="zohoList" className="ml-2 text-sm text-gray-700">
                      ZOHO LIST
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="textEntry"
                      type="radio"
                      name="selectType"
                      value="TEXT_ENTRY"
                      checked={formData.selectType === 'TEXT_ENTRY'}
                      onChange={(e) => setFormData({ ...formData, selectType: e.target.value })}
                      className="w-4 h-4 text-amber-400"
                    />
                    <label htmlFor="textEntry" className="ml-2 text-sm text-gray-700">
                      TEXT ENTRY
                    </label>
                  </div>
                </div>
              </div>

              {/* SELECT PO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SELECT PO
                </label>
                <select
                  value={formData.selectedPOId}
                  onChange={(e) => setFormData({ ...formData, selectedPOId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                >
                  <option value="">--Select PO--</option>
                  {MOCK_PO_REQUESTS.map((po) => (
                    <option key={po.id} value={po.referenceId}>
                      {po.referenceId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Purchase order executed successfully!');
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 bg-amber-400 text-white rounded-lg text-sm font-medium hover:bg-amber-500"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}