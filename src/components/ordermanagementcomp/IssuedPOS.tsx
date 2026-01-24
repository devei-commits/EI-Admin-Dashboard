import React, { useState, useMemo } from 'react';

interface IssuedPO {
  id: string;
  itemSku: string;
  itemName: string;
  category: string;
  poNo: string;
  poQty: number;
  createdDt: string;
  approvedDt: string;
  exptedDate: string;
  vendor: string;
  source: string;
  terms: string;
  comments: string;
  grnStatus: string;
}

// Mock data for Issued POs - transformed from PO Requests
const MOCK_ISSUED_POS: IssuedPO[] = [
  {
    id: 'KAD',
    itemSku: 'KAD',
    itemName: 'KOJIDERM (FLYCHEM)',
    category: 'Not specified',
    poNo: 'E1/PO/25-11/23385',
    poQty: 52.00,
    createdDt: '23-01-2026',
    approvedDt: '23-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'FLYCHEM PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: '--',
  },
  {
    id: '4003451',
    itemSku: '4003451',
    itemName: 'LW-A15-30ML GLOSSY WHITE AND CLEAR AIRLESS BOTTLE WITH GLOSSY WHITE AIRLESS PUMP',
    category: 'Not specified',
    poNo: 'E1/PO/25-11/23202',
    poQty: 500.00,
    createdDt: '23-01-2026',
    approvedDt: '',
    exptedDate: 'PO Exp Date',
    vendor: 'JBJ AND CO',
    source: 'Add',
    terms: '',
    comments: '--',
    grnStatus: '--',
  },
  {
    id: '1000163',
    itemSku: '1000163',
    itemName: 'EASYNOV',
    category: 'RM. BASE',
    poNo: 'E1/PO/25-11/23282',
    poQty: 25.00,
    createdDt: '21-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: 'PO yet to send from kriya request',
    grnStatus: 'PO yet to send from kriya',
  },
  {
    id: '1001250',
    itemSku: '1001250',
    itemName: 'NATSOFT DMI',
    category: 'RM. BASE',
    poNo: 'E1/PO/25-11/23279',
    poQty: 35.00,
    createdDt: '20-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: 'PO yet to send from kriya',
  },
  {
    id: '4001039',
    itemSku: '4001039',
    itemName: 'THE SKIN SPECIALIST CUTILESSE CREAM 150ML PRINTED TUBE WITH FLIPTTOP CAP',
    category: 'Packaging Material',
    poNo: 'E1/PO/25-11/23375',
    poQty: 10500.00,
    createdDt: '19-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: 'PO yet to send from kriya request',
  },
  {
    id: '1001331',
    itemSku: '1001331',
    itemName: 'AVOBENZONE',
    category: 'Not specified',
    poNo: 'E1/PO/25-11/23374',
    poQty: 50.00,
    createdDt: '19-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: 'PO yet to send from kriya',
  },
  {
    id: '1001315',
    itemSku: '1001315',
    itemName: 'OCTYL METHOXYCINNAMATE (OMC) (OC SPECIALITY)',
    category: 'Not specified',
    poNo: 'E1/PO/25-11/23371',
    poQty: 100.00,
    createdDt: '19-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: 'Po yet to send from kriya',
  },
  {
    id: '1000485',
    itemSku: '1000485',
    itemName: 'WHITE PETROLEUM GELLY IP',
    category: 'RM. ACTIVE',
    poNo: 'E1/PO/25-11/23369',
    poQty: 175.00,
    createdDt: '19-01-2026',
    approvedDt: '22-01-2026',
    exptedDate: 'PO Exp Date',
    vendor: 'KRIYA INDUSTRIES INDIA PRIVATE LIMITED',
    source: 'Add',
    terms: '',
    comments: '',
    grnStatus: 'Po yet to send from kriya',
  },
];

const CATEGORIES = ['All', 'RM', 'PM', 'Not specified', 'RM. BASE', 'RM. ACTIVE', 'SPM - OTHERS', 'Packaging Material'];

const getCategoryColor = (category: string) => {
  const colorMap: { [key: string]: string } = {
    'Not specified': 'bg-red-100 text-red-700',
    'RM. BASE': 'bg-green-100 text-green-700',
    'RM. ACTIVE': 'bg-green-100 text-green-700',
    'Packaging Material': 'bg-blue-100 text-blue-700',
    'SPM - OTHERS': 'bg-purple-100 text-purple-700',
  };
  return colorMap[category] || 'bg-gray-100 text-gray-700';
};

export default function IssuedPOS() {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search and category
  const filteredData = useMemo(() => {
    return MOCK_ISSUED_POS.filter((item) => {
      const matchesSearch =
        item.itemSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.poNo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' ||
        selectedCategory === 'RM'
          ? item.category.includes('RM')
          : selectedCategory === 'PM'
            ? item.category.includes('Packaging')
            : item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const toggleSelectRequest = (id: string) => {
    setSelectedRequests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRequests.length === paginatedData.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(paginatedData.map((item) => item.id));
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white">
      {/* Header Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Issued POS</h2>

        {/* Selection and Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedRequests.length === paginatedData.length && paginatedData.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Select all</span>
            </label>
            <span className="text-sm text-gray-600">{selectedRequests.length} Selected</span>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Filter By Category :</span>
            {['All', 'RM', 'PM'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
              Show Category
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">
              + Sync New PO
            </button>
          </div>
        </div>

        {/* Entries and Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded text-sm w-full md:w-48"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-50 border-b border-gray-300">
              <th className="p-2 text-left border border-gray-300 w-8">
                <input
                  type="checkbox"
                  checked={selectedRequests.length === paginatedData.length && paginatedData.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">ID #</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">ITEM SKU</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Item Name</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Category</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">PO No</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">PO QTY</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Created_Dt</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Approved_Dt</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">ExptedDate</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Vendor</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">SOURCE</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Terms</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">Comments</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">GRN Status</th>
              <th className="p-2 text-left border border-gray-300 whitespace-nowrap">ActionBtns</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.id} className="border-b border-gray-300 hover:bg-amber-50">
                <td className="p-2 border border-gray-300 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRequests.includes(item.id)}
                    onChange={() => toggleSelectRequest(item.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="p-2 border border-gray-300">{item.id}</td>
                <td className="p-2 border border-gray-300 font-medium">{item.itemSku}</td>
                <td className="p-2 border border-gray-300 max-w-xs">{item.itemName}</td>
                <td className="p-2 border border-gray-300">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                </td>
                <td className="p-2 border border-gray-300 text-blue-600 underline cursor-pointer">
                  {item.poNo}
                  <button className="ml-2 text-amber-600 hover:text-amber-800">✎</button>
                </td>
                <td className="p-2 border border-gray-300 text-right">{item.poQty.toFixed(2)}</td>
                <td className="p-2 border border-gray-300">{item.createdDt}</td>
                <td className="p-2 border border-gray-300">{item.approvedDt}</td>
                <td className="p-2 border border-gray-300">{item.exptedDate}</td>
                <td className="p-2 border border-gray-300 text-sm">{item.vendor}</td>
                <td className="p-2 border border-gray-300 text-blue-600 underline cursor-pointer">{item.source}</td>
                <td className="p-2 border border-gray-300">{item.terms}</td>
                <td className="p-2 border border-gray-300 text-blue-600 underline cursor-pointer text-xs">{item.comments}</td>
                <td className="p-2 border border-gray-300 text-blue-600 underline cursor-pointer text-xs max-w-xs">
                  {item.grnStatus}
                </td>
                <td className="p-2 border border-gray-300 text-center">
                  <button className="text-red-600 hover:text-red-800 font-bold">−</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {paginatedData.map((item) => (
          <div key={item.id} className="border border-gray-300 rounded p-4 bg-amber-50">
            <div className="flex items-start justify-between mb-3">
              <input
                type="checkbox"
                checked={selectedRequests.includes(item.id)}
                onChange={() => toggleSelectRequest(item.id)}
                className="w-4 h-4 mt-1"
              />
              <div className="flex-1 ml-3">
                <h3 className="font-bold text-gray-800">{item.itemName}</h3>
                <p className="text-xs text-gray-600">SKU: {item.itemSku}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">PO No:</span>
                <span className="text-blue-600 underline">{item.poNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Category:</span>
                <span className={`px-2 py-1 rounded ${getCategoryColor(item.category)}`}>{item.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PO Qty:</span>
                <span>{item.poQty.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vendor:</span>
                <span className="text-right max-w-xs">{item.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{item.createdDt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GRN Status:</span>
                <span className="text-blue-600 underline max-w-xs text-right">{item.grnStatus}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-300">
              <button className="flex-1 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700">
                Edit
              </button>
              <button className="px-2 py-1 text-xs text-red-600 font-bold hover:text-red-800">−</button>
            </div>
          </div>
        ))}
      </div>

      {paginatedData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No issued POs found</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-sm text-gray-600">
          Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
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
                    className={`px-2 py-1 rounded text-sm ${
                      currentPage === page
                        ? 'bg-amber-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-100'
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
                  className={`px-2 py-1 rounded text-sm ${
                    currentPage === page ? 'bg-amber-600 text-white' : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
