import React, { useState, useMemo } from 'react';

interface MRNFG {
 id: number;
 mrnId: string;
 orderNo: string;
 toWhName: string;
 fromWhName: string;
 mrnDate: string;
 preparedBy: string;
 addedonDt: string;
 status: string;
 counter: number;
 attachments: string;
}

// Mock data for MRN/FGs
const MOCK_MRN_FGS: MRNFG[] = [
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11420',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 2,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11414',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11363',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 2,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11362',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11419',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11417',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11416',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11369',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11371',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11372',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11386',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11393',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11394',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11405',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11407',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11409',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
 {
  id: 1,
  mrnId: '',
  orderNo: 'TO-11410',
  toWhName: '',
  fromWhName: '',
  mrnDate: '',
  preparedBy: '',
  addedonDt: '',
  status: '--',
  counter: 1,
  attachments: 'View',
 },
];

export default function MRNFGs() {
 const [selectedMRNs, setSelectedMRNs] = useState<number[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [currentPage, setCurrentPage] = useState(1);
 const entriesPerPage = 50;

 // Filter data based on search
 const filteredData = useMemo(() => {
  return MOCK_MRN_FGS.filter((item, _index) => {
   const matchesSearch =
    item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.mrnId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.toWhName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.fromWhName.toLowerCase().includes(searchTerm.toLowerCase());

   return matchesSearch;
  });
 }, [searchTerm]);

 // Pagination
 const totalPages = Math.ceil(filteredData.length / entriesPerPage);
 const startIndex = (currentPage - 1) * entriesPerPage;
 const endIndex = startIndex + entriesPerPage;
 const paginatedData = filteredData.slice(startIndex, endIndex);

 const toggleSelectMRN = (index: number) => {
  setSelectedMRNs((prev) =>
   prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
  );
 };

 const toggleSelectAll = () => {
  if (selectedMRNs.length === paginatedData.length) {
   setSelectedMRNs([]);
  } else {
   setSelectedMRNs(paginatedData.map((_, idx) => startIndex + idx));
  }
 };

 return (
  <div className="w-full h-full flex flex-col">
   {/* Header with search and controls */}
   <div className="bg-slate-800 p-4 border-b border-slate-600">
    {/* Selection and Action Buttons Row */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
     <div className="flex items-center gap-4">
      <label className="flex items-center gap-2">
       <input
        type="checkbox"
        checked={selectedMRNs.length === paginatedData.length && paginatedData.length > 0}
        onChange={toggleSelectAll}
        className="w-4 h-4 rounded border-slate-500"
       />
       <span className="text-sm font-medium text-slate-300">Select all</span>
      </label>
      <span className="text-sm text-slate-400">{selectedMRNs.length} Selected</span>
     </div>

     <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
      + New MRN/FG
     </button>
    </div>

    {/* Search Row */}
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
     <div className="flex-1 md:max-w-md">
      <input
       type="text"
       placeholder="Enter Keyword (Order No, MRN ID, Warehouse)..."
       value={searchTerm}
       onChange={(e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
       }}
       className="w-full px-3 py-2 bg-slate-900/50 text-slate-100 placeholder-slate-400 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
      />
     </div>

     <div className="flex-1 md:max-w-md">
      <div className="relative">
       <input
        type="text"
        placeholder="Search"
        className="w-full px-3 py-2 pr-10 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
       />
       <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
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
      <tr className="bg-gray-200 sticky top-0">
       <th className="border border-slate-600 p-2 text-left whitespace-nowrap">
        <input
         type="checkbox"
         checked={selectedMRNs.length === paginatedData.length && paginatedData.length > 0}
         onChange={toggleSelectAll}
         className="w-4 h-4"
        />
       </th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">ID</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">#MRN_ID</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Order No</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">To WH_Name</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">From WH_Name</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">MRN_DATE</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">PreparedBy</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Addedon_Dt</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Status</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Counter</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">ATTACHMENTS</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Action</th>
      </tr>
     </thead>
     <tbody>
      {paginatedData.map((item, idx) => (
       <tr key={startIndex + idx} className="hover:bg-slate-50 transition-colors">
        <td className="border border-slate-600 p-2">
         <input
          type="checkbox"
          checked={selectedMRNs.includes(startIndex + idx)}
          onChange={() => toggleSelectMRN(startIndex + idx)}
          className="w-4 h-4"
         />
        </td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.id}</td>
        <td className="border border-slate-600 p-2 font-medium whitespace-nowrap">{item.mrnId || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.orderNo}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.toWhName || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.fromWhName || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.mrnDate || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.preparedBy || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.addedonDt || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.status}</td>
        <td className="border border-slate-600 p-2 text-center whitespace-nowrap">{item.counter}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">
         <button className="text-blue-600 hover:underline">{item.attachments}</button>
        </td>
        <td className="border border-slate-600 p-2 text-center">
         <button className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
           <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
         </button>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>

   {/* Mobile Card View */}
   <div className="md:hidden space-y-4 p-4">
    {paginatedData.map((item, idx) => (
     <div key={startIndex + idx} className="border border-slate-600 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-3">
       <input
        type="checkbox"
        checked={selectedMRNs.includes(startIndex + idx)}
        onChange={() => toggleSelectMRN(startIndex + idx)}
        className="w-4 h-4 mt-1"
       />
       <div className="flex-1 ml-3">
        <h3 className="font-bold text-gray-800 text-sm">{item.orderNo}</h3>
        <p className="text-xs text-slate-400 mt-1">MRN ID: {item.mrnId || '-'}</p>
       </div>
      </div>

      <div className="space-y-2 text-xs">
       <div className="flex justify-between">
        <span className="text-slate-400">To Warehouse:</span>
        <span>{item.toWhName || '-'}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">From Warehouse:</span>
        <span>{item.fromWhName || '-'}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Status:</span>
        <span>{item.status}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Counter:</span>
        <span>{item.counter}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Attachments:</span>
        <button className="text-blue-600 hover:underline">{item.attachments}</button>
       </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-600">
       <button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
        Delete
       </button>
      </div>
     </div>
    ))}
   </div>

   {paginatedData.length === 0 && (
    <div className="text-center py-8">
     <p className="text-slate-500">No MRN/FG records found</p>
    </div>
   )}

   {/* Pagination */}
   <div className="mt-auto p-4 bg-slate-50 border-t border-slate-600">
    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
     <div className="text-sm text-slate-400">
      Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
     </div>

     <div className="flex items-center gap-2">
      <button
       onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
       disabled={currentPage === 1}
       className="px-3 py-1 border border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
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
             ? 'bg-slate-800 text-white'
             : 'border border-slate-600 hover:bg-gray-100'
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
            ? 'bg-slate-800 text-white'
            : 'border border-slate-600 hover:bg-gray-100'
          }`}
         >
          {page}
         </button>
        );
       })}

      <button
       onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
       disabled={currentPage === totalPages}
       className="px-3 py-1 border border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
      >
       Next
      </button>
     </div>
    </div>
   </div>
  </div>
 );
}
