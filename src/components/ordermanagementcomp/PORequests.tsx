import React, { useState } from 'react';

interface PORequest {
  id: string;
  oldSku: string;
  poItemName: string;
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
    id: 'PO001',
    oldSku: 'SL01195',
    poItemName: 'OLIVA OILY SKIN MRP STICKERS NEW MRP 1675 WITH BARCODE',
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
    id: 'PO002',
    oldSku: '1001315',
    poItemName: 'OCTYL METHOXYCINNAMATE OMC OC SPECIALITY',
    poRequestDt: '23-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '2806',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '23-01-2026',
  },
  {
    id: 'PO003',
    oldSku: '1000551',
    poItemName: 'BELSIL EG 2',
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '170',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '22-01-2026',
  },
  {
    id: 'PO004',
    oldSku: '1000105',
    poItemName: 'CARBOPOL AQUA SF1',
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '115',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '22-01-2026',
  },
  {
    id: 'PO005',
    oldSku: 'SL01540',
    poItemName: 'SK ACNE LIMIT FACIAL CREAM WITH 9 AZELAIC ACID 4 NIACINAMIDE FOR MODERATE ACNE 30ML LABLE AIRLESS BOTTLE',
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '3128',
    isApproved: 'APPROVE',
    approverComments: '',
    poApprovedDt: '22-01-2026',
    poScheduleDt: '22-01-2026',
  },
  {
    id: 'PO006',
    oldSku: 'SL01534',
    poItemName: 'SKINKRAFT NIACIN WITH LICORICE DEPIGMENTATION SERUM NIACINAMIDE FOR DARK SPOT PATCHES 30ML LABEL AIRLESS BOTTLE',
    poRequestDt: '22-01-2026',
    creatorComments: 'Add',
    poType: 'ADHOC',
    createdBy: '61',
    referenceId: '3019',
    isApproved: 'APPROVE',
    approverComments: '',
    poApprovedDt: '22-01-2026',
    poScheduleDt: '22-01-2026',
  },
  {
    id: 'PO007',
    oldSku: '1000574',
    poItemName: 'BELSIL DM 350 DKSH',
    poRequestDt: '21-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '1348',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '21-01-2026',
  },
  {
    id: 'PO008',
    oldSku: '1000085',
    poItemName: 'BLUESHIELD',
    poRequestDt: '21-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '216',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '21-01-2026',
  },
  {
    id: 'PO009',
    oldSku: 'SL01526',
    poItemName: 'DERMAGLOWLUXE OAT GLOW BODY WASH 100ML LABEL',
    poRequestDt: '19-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '3015',
    isApproved: 'APPROVE',
    approverComments: '',
    poApprovedDt: '22-01-2026',
    poScheduleDt: '19-01-2026',
  },
  {
    id: 'PO010',
    oldSku: '1000131',
    poItemName: 'COLADET EQ 18',
    poRequestDt: '19-01-2026',
    creatorComments: 'Add',
    poType: '',
    createdBy: '61',
    referenceId: '679',
    isApproved: 'add',
    approverComments: 'add',
    poApprovedDt: '',
    poScheduleDt: '19-01-2026',
  },
];

const PORequests: React.FC = () => {
  const [requests] = useState<PORequest[]>(MOCK_PO_REQUESTS);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRequests(new Set(filteredRequests.map(r => r.id)));
    } else {
      setSelectedRequests(new Set());
    }
  };

  const handleSelectRequest = (id: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRequests(newSelected);
  };

  const filteredRequests = requests.filter(req =>
    req.oldSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.poItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.referenceId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'APPROVE':
        return <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">APPROVE</span>;
      case 'add':
        return <span className="px-3 py-1 text-xs font-semibold text-blue-600 cursor-pointer hover:underline">add</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">pending</span>;
    }
  };

  return (
    <div className="w-full">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedRequests.size === filteredRequests.length && filteredRequests.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 text-amber-500 rounded focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-600">{selectedRequests.size} Selected</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <div className="relative w-full sm:w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {paginatedRequests.map((req) => (
          <div key={req.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <input
                type="checkbox"
                checked={selectedRequests.has(req.id)}
                onChange={() => handleSelectRequest(req.id)}
                className="w-4 h-4 text-amber-500 rounded focus:ring-2 focus:ring-amber-500 mt-0.5"
              />
              <div className="flex gap-2">
                <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Approve">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                </button>
                <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-gray-800">{req.oldSku}</span></div>
              <div><span className="text-gray-600">{req.poItemName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Request Date:</span><span className="font-medium">{req.poRequestDt}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">PO Type:</span><span className="font-medium">{req.poType || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status:</span>{getApprovalBadge(req.isApproved)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRequests.size === filteredRequests.length && filteredRequests.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-2 focus:ring-amber-500"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">OLD SKU</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">PO Item Name</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">PO Request Dt</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">Creator Comments</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">PO Type</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">Created By</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">Reference ID</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">Is Approved</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">Approver Comments</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">PO Approved Dt</th>
              <th className="px-4 py-3 text-left font-semibold text-amber-800 uppercase tracking-wider">PO Schedule Dt</th>
              <th className="px-4 py-3 text-center font-semibold text-amber-800 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRequests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRequests.has(req.id)}
                    onChange={() => handleSelectRequest(req.id)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-2 focus:ring-amber-500"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-gray-700">{req.oldSku}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={req.poItemName}>{req.poItemName}</td>
                <td className="px-4 py-3 text-gray-600">{req.poRequestDt}</td>
                <td className="px-4 py-3">
                  {req.creatorComments === 'Add' ? (
                    <span className="text-blue-600 cursor-pointer hover:underline font-medium">Add</span>
                  ) : (
                    <span className="text-gray-600">{req.creatorComments}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{req.poType || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{req.createdBy}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{req.referenceId}</td>
                <td className="px-4 py-3">{getApprovalBadge(req.isApproved)}</td>
                <td className="px-4 py-3">
                  {req.approverComments === 'add' ? (
                    <span className="text-blue-600 cursor-pointer hover:underline font-medium">add</span>
                  ) : (
                    <span className="text-gray-600">{req.approverComments || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {req.poApprovedDt ? (
                    <span className="text-blue-600 cursor-pointer hover:underline">{req.poApprovedDt}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {req.poScheduleDt ? (
                    <span className="text-blue-600 cursor-pointer hover:underline">{req.poScheduleDt}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Approve">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    </button>
                    <button className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
        <p className="text-sm text-gray-600">
          Showing {paginatedRequests.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to {Math.min(
            currentPage * entriesPerPage,
            filteredRequests.length
          )} of {filteredRequests.length} entries
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentPage === page
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
          {totalPages > 5 && <span className="px-2 py-1.5 text-gray-400">...</span>}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default PORequests;
