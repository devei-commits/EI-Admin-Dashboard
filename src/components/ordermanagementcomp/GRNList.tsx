import React, { useState, useMemo } from 'react';

interface GRN {
  id: number;
  grnNo: string;
  poNo: string;
  vendor: string;
  grnDate: string;
  invoiceNo: string;
  preparedBy: string;
  updatedOn: string;
  status: string;
  counter: number;
  attachment: string;
}

// Mock data for GRN List
const MOCK_GRNS: GRN[] = [
  {
    id: 1,
    grnNo: 'GR_25-11/2346-1',
    poNo: 'E1/PO/25-11/2346',
    vendor: 'KVL GLOBAL SOLUTION',
    grnDate: '',
    invoiceNo: 'KVL/HW/2326/515',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 2,
    grnNo: 'GR_25-11/2113-1',
    poNo: 'E1/PO/25-11/2113',
    vendor: 'PURITY POLYTUBESS PRIVATE LIMITED',
    grnDate: '',
    invoiceNo: 'PPTL/2025-26/616',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 3,
    grnNo: 'GR_25-07/1729-4',
    poNo: 'E1/PO/25-07/1729',
    vendor: 'TAKEMOTO YOHKI INDIA PRIVATE LIMITED',
    grnDate: '',
    invoiceNo: 'TMID/25-26/1304',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 4,
    grnNo: 'GR_25-11/2143-3',
    poNo: 'E1/PO/25-11/2143',
    vendor: 'ANAND ENTERPRISES',
    grnDate: '',
    invoiceNo: '2025-M0273',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 5,
    grnNo: 'GR_25-11/2377-1',
    poNo: 'E1/PO/25-11/2377',
    vendor: 'ETERNITE ELEMENTS PRIVATE LIMITED',
    grnDate: '',
    invoiceNo: '01/ETERNITE ELEMENTS PRIVATE LIMITED',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 6,
    grnNo: 'GR_25-11/2313-1',
    poNo: 'E1/PO/25-11/2313',
    vendor: 'JAY VEE INDUSTRIES',
    grnDate: '',
    invoiceNo: 'JVI/25-26-1943',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 7,
    grnNo: 'GR_25-11/2262-1',
    poNo: 'E1/PO/25-11/2262',
    vendor: 'SS PRINTERS',
    grnDate: '',
    invoiceNo: 'INV-25/26-617',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 8,
    grnNo: 'GR_25-11/2314-1',
    poNo: 'E1/PO/25-11/2314',
    vendor: 'ASHIRWAD POLYMERS',
    grnDate: '',
    invoiceNo: '1621',
    preparedBy: 'Naga Raju',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 9,
    grnNo: 'GR_25-11/2337-1',
    poNo: 'E1/PO/25-11/2337',
    vendor: 'NANO TECH CHEMICAL BROTHERS PVT. LTD',
    grnDate: '',
    invoiceNo: 'PC/25-25/02252',
    preparedBy: 'NagaRatalu Meka',
    updatedOn: '23-01-2026',
    status: 'ARCHIVED',
    counter: 1,
    attachment: 'View',
  },
  {
    id: 10,
    grnNo: 'GR_25-11/2156-1',
    poNo: 'E1/PO/25-11/2156',
    vendor: 'PRISHA TUBES PRIVATE LIMITED',
    grnDate: '',
    invoiceNo: 'PTPL/2526/P01123',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 11,
    grnNo: 'GR_25-11/2241-1',
    poNo: 'E1/PO/25-11/2241',
    vendor: 'AJANTA BOTTLE PRIVATE LIMITED',
    grnDate: '',
    invoiceNo: 'D/25-26/6802',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 12,
    grnNo: 'GR_25-11/2296-1',
    poNo: 'E1/PO/25-11/2296',
    vendor: 'KUMAR ORGANIC PRODUCT LIMITED',
    grnDate: '',
    invoiceNo: '25-26IU/1327',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 13,
    grnNo: 'GR_25-11/2190-1',
    poNo: 'E1/PO/25-11/2190',
    vendor: 'GRAVITY CHEMICALS AND SPECIALITIES',
    grnDate: '',
    invoiceNo: 'GCS/25-26/M1446',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 14,
    grnNo: 'GR_25-11/2261-2',
    poNo: 'E1/PO/25-11/2261',
    vendor: 'ANAND ENTERPRISES',
    grnDate: '',
    invoiceNo: '2025-M0270',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 15,
    grnNo: 'GR_25-11/2261-1',
    poNo: 'E1/PO/25-11/2261',
    vendor: 'ANAND ENTERPRISES',
    grnDate: '',
    invoiceNo: '2025-M0271',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 0,
    attachment: 'View',
  },
  {
    id: 16,
    grnNo: 'GR_25-10/2033-3',
    poNo: 'E1/PO/25-10/2033',
    vendor: 'CREATIVE PRINT & PACK',
    grnDate: '',
    invoiceNo: '812',
    preparedBy: 'Naga Raju',
    updatedOn: '20-01-2026',
    status: 'ARCHIVED',
    counter: 1,
    attachment: 'View',
  },
];

export default function GRNList() {
  const [selectedGRNs, setSelectedGRNs] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search
  const filteredData = useMemo(() => {
    return MOCK_GRNS.filter((item) => {
      const matchesSearch =
        item.grnNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.preparedBy.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const toggleSelectGRN = (id: number) => {
    setSelectedGRNs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedGRNs.length === paginatedData.length) {
      setSelectedGRNs([]);
    } else {
      setSelectedGRNs(paginatedData.map((item) => item.id));
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with search and controls */}
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 p-4 border-b border-amber-300">
        {/* Selection and Action Buttons Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedGRNs.length === paginatedData.length && paginatedData.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-amber-400"
              />
              <span className="text-sm font-medium text-gray-700">Select all</span>
            </label>
            <span className="text-sm text-gray-600">{selectedGRNs.length} Selected</span>
          </div>

          <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
            + New GRN
          </button>
        </div>

        {/* Search and Entries Row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 md:max-w-md">
            <input
              type="text"
              placeholder="Enter Keyword"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Show</span>
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

          <div className="flex-1 md:max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                className="w-full px-3 py-2 pr-10 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-200 sticky top-0">
              <th className="border border-amber-300 p-2 text-left whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedGRNs.length === paginatedData.length && paginatedData.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">ID</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">GRN No</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">PO No</th>
              <th className="border border-amber-300 p-2 text-left font-semibold">Vendor</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">GRN Date</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Invoice No</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Prepared By</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Updated On</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Status</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Counter</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Attachment</th>
              <th className="border border-amber-300 p-2 text-left font-semibold whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.id} className="hover:bg-amber-50 transition-colors">
                <td className="border border-amber-300 p-2">
                  <input
                    type="checkbox"
                    checked={selectedGRNs.includes(item.id)}
                    onChange={() => toggleSelectGRN(item.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.id}</td>
                <td className="border border-amber-300 p-2 font-medium whitespace-nowrap">{item.grnNo}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.poNo}</td>
                <td className="border border-amber-300 p-2 max-w-xs truncate" title={item.vendor}>
                  {item.vendor}
                </td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.grnDate || '-'}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.invoiceNo}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.preparedBy}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">{item.updatedOn}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                    {item.status}
                  </span>
                </td>
                <td className="border border-amber-300 p-2 text-center whitespace-nowrap">{item.counter}</td>
                <td className="border border-amber-300 p-2 whitespace-nowrap">
                  <button className="text-blue-600 hover:underline">{item.attachment}</button>
                </td>
                <td className="border border-amber-300 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 transition">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 p-4">
        {paginatedData.map((item) => (
          <div key={item.id} className="border border-amber-300 rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <input
                type="checkbox"
                checked={selectedGRNs.includes(item.id)}
                onChange={() => toggleSelectGRN(item.id)}
                className="w-4 h-4 mt-1"
              />
              <div className="flex-1 ml-3">
                <h3 className="font-bold text-gray-800 text-sm">{item.grnNo}</h3>
                <p className="text-xs text-gray-600 mt-1">PO: {item.poNo}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Vendor:</span>
                <span className="text-right max-w-xs truncate">{item.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice No:</span>
                <span>{item.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prepared By:</span>
                <span>{item.preparedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Updated On:</span>
                <span>{item.updatedOn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{item.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Attachment:</span>
                <button className="text-blue-600 hover:underline">{item.attachment}</button>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-amber-300">
              <button className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                Edit
              </button>
              <button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {paginatedData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No GRN records found</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-auto p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-300">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-amber-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-100 transition-colors"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages)
              .map((page, idx, arr) => {
                if (idx > 0 && arr[idx - 1] < page - 1) {
                  return [
                    <span key={`dots-${page}`} className="px-2 text-gray-400">
                      ...
                    </span>,
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-amber-600 text-white'
                          : 'border border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {page}
                    </button>,
                  ];
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-amber-600 text-white'
                        : 'border border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-amber-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
