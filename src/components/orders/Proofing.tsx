import React, { useState, useMemo } from 'react';

interface Proofing {
 id: number;
 itemSku: string;
 qcType: string;
 itemName: string;
 comments: string;
 createdDt: string;
 createdBy: string;
 verifiedDt: string;
 verifiedBy: string;
 proofingStatus: 'Pending' | 'Approved' | 'Rejected';
}

// Mock data for Proofing
const MOCK_PROOFING: Proofing[] = [
 {
  id: 1,
  itemSku: '4000143',
  qcType: 'online',
  itemName: 'MEDMANOR MOISTAR DEEP RESTORE CREAM 25G TUBE',
  comments: '',
  createdDt: '16-10-2025',
  createdBy: 'Krishna D',
  verifiedDt: '27-10-2025',
  verifiedBy: 'Bindu Sree',
  proofingStatus: 'Pending',
 },
 {
  id: 2,
  itemSku: '4001047',
  qcType: 'online',
  itemName: 'SKINQ RX ACNE CONTROL MASK 5G SACHET ( US )',
  comments: 'sunita graphics',
  createdDt: '13-10-2025',
  createdBy: 'Nikhil Barange',
  verifiedDt: '10-11-2025',
  verifiedBy: 'Nikhil Barange',
  proofingStatus: 'Approved',
 },
 {
  id: 3,
  itemSku: '4001046',
  qcType: 'online',
  itemName: 'SKINQ RX GLOW BRIGHT MASK 5G SACHET ( US )',
  comments: 'sunita graphics',
  createdDt: '13-10-2025',
  createdBy: 'Nikhil Barange',
  verifiedDt: '10-11-2025',
  verifiedBy: 'Nikhil Barange',
  proofingStatus: 'Approved',
 },
 {
  id: 4,
  itemSku: '5101557',
  qcType: 'online',
  itemName: 'ZENSKINN REVEAL CLEANSER 100ML LABEL',
  comments: 'test',
  createdDt: '10-10-2025',
  createdBy: 'Krishna D',
  verifiedDt: '10-10-2025',
  verifiedBy: 'Krishna D',
  proofingStatus: 'Approved',
 },
];

const getStatusColor = (status: string) => {
 const colorMap: { [key: string]: string } = {
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Approved': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-700',
 };
 return colorMap[status] || 'bg-gray-100 text-slate-300';
};

export default function Proofing() {
 const [selectedItems, setSelectedItems] = useState<number[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [editingItem, setEditingItem] = useState<Proofing | null>(null);
 const [editStatus, setEditStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
 const [editComments, setEditComments] = useState('');
 const [_editAttachment, setEditAttachment] = useState<File | null>(null);

 // Filter data based on search
 const filteredData = useMemo(() => {
  return MOCK_PROOFING.filter((item) => {
   const matchesSearch =
    item.itemSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.comments.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.verifiedBy.toLowerCase().includes(searchTerm.toLowerCase());

   return matchesSearch;
  });
 }, [searchTerm]);

 const toggleSelectItem = (id: number) => {
  setSelectedItems((prev) =>
   prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  );
 };

 const toggleSelectAll = () => {
  if (selectedItems.length === filteredData.length) {
   setSelectedItems([]);
  } else {
   setSelectedItems(filteredData.map((item) => item.id));
  }
 };

 const handleEditClick = (item: Proofing) => {
  setEditingItem(item);
  setEditStatus(item.proofingStatus);
  setEditComments(item.comments);
  setEditAttachment(null);
 };

 const handleEditClose = () => {
  setEditingItem(null);
  setEditStatus('Pending');
  setEditComments('');
  setEditAttachment(null);
 };

 const handleEditUpdate = () => {
  // Here you would typically update the item in your backend
  handleEditClose();
 };

 return (
  <div className="w-full h-full flex flex-col">
   {/* Edit Modal */}
   {editingItem && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
     <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div className="p-6">
       <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Edit Proof Item</h2>

       {/* Status Dropdown */}
       <div className="mb-4">
        <label className="block text-sm text-slate-300 mb-2">
         Select Status <span className="text-red-500">*</span>
        </label>
        <select
         value={editStatus}
         onChange={(e) => setEditStatus(e.target.value as 'Pending' | 'Approved' | 'Rejected')}
         className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
         <option value="Pending">Pending</option>
         <option value="Approved">Approved</option>
         <option value="Rejected">Rejected</option>
        </select>
       </div>

       {/* Attachment Upload */}
       <div className="mb-4">
        <label className="block text-sm text-slate-300 mb-2">Attachment</label>
        <input
         type="file"
         onChange={(e) => setEditAttachment(e.target.files?.[0] || null)}
         className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
       </div>

       {/* Comments Textarea */}
       <div className="mb-6">
        <label className="block text-sm text-slate-300 mb-2">
         Comments <span className="text-red-500">*</span>
        </label>
        <textarea
         value={editComments}
         onChange={(e) => setEditComments(e.target.value)}
         rows={5}
         className="w-full px-3 py-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
         placeholder="Enter comments..."
        />
       </div>

       {/* Action Buttons */}
       <div className="flex gap-3 justify-center">
        <button
         onClick={handleEditUpdate}
         className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
        >
         Update
        </button>
        <button
         onClick={handleEditClose}
         className="px-6 py-2 bg-gray-400 text-white rounded font-medium hover:bg-slate-500 transition"
        >
         Cancel
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Header with search and controls */}
   <div className="bg-slate-800 p-4 border-b border-slate-600">
    {/* Selection and Action Buttons Row */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
     <div className="flex items-center gap-4">
      <label className="flex items-center gap-2">
       <input
        type="checkbox"
        checked={selectedItems.length === filteredData.length && filteredData.length > 0}
        onChange={toggleSelectAll}
        className="w-4 h-4 rounded border-slate-500"
       />
       <span className="text-sm font-medium text-slate-300">Select all</span>
      </label>
      <span className="text-sm text-slate-400">{selectedItems.length} Selected</span>
     </div>

     <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
      + New Proof Check
     </button>
    </div>

    {/* Search Row */}
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
     <div className="flex-1 md:max-w-md">
      <input
       type="text"
       placeholder="Enter Keyword"
       value={searchTerm}
       onChange={(e) => {
        setSearchTerm(e.target.value);
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
         checked={selectedItems.length === filteredData.length && filteredData.length > 0}
         onChange={toggleSelectAll}
         className="w-4 h-4"
        />
       </th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">ID</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Item_SKU</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">QC-Type</th>
       <th className="border border-slate-600 p-2 text-left font-semibold">Item Name</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Comments</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Created_Dt</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Created By</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Verified Dt</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Verified By</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">Proofing Status</th>
       <th className="border border-slate-600 p-2 text-left font-semibold whitespace-nowrap">ACTIONS</th>
      </tr>
     </thead>
     <tbody>
      {filteredData.map((item) => (
       <tr key={item.id} className="hover:bg-slate-50 transition-colors">
        <td className="border border-slate-600 p-2">
         <input
          type="checkbox"
          checked={selectedItems.includes(item.id)}
          onChange={() => toggleSelectItem(item.id)}
          className="w-4 h-4"
         />
        </td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.id}</td>
        <td className="border border-slate-600 p-2 font-medium whitespace-nowrap">{item.itemSku}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.qcType}</td>
        <td className="border border-slate-600 p-2 max-w-xs truncate" title={item.itemName}>
         {item.itemName}
        </td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.comments || '-'}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.createdDt}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.createdBy}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.verifiedDt}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">{item.verifiedBy}</td>
        <td className="border border-slate-600 p-2 whitespace-nowrap">
         <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.proofingStatus)}`}>
          {item.proofingStatus}
         </span>
        </td>
        <td className="border border-slate-600 p-2 text-center">
         <div className="flex items-center justify-center gap-1">
          <button className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition">
           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
           </svg>
          </button>
          <button
           onClick={() => handleEditClick(item)}
           className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 transition"
          >
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
    {filteredData.map((item) => (
     <div key={item.id} className="border border-slate-600 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-3">
       <input
        type="checkbox"
        checked={selectedItems.includes(item.id)}
        onChange={() => toggleSelectItem(item.id)}
        className="w-4 h-4 mt-1"
       />
       <div className="flex-1 ml-3">
        <h3 className="font-bold text-gray-800 text-sm">{item.itemName}</h3>
        <p className="text-xs text-slate-400 mt-1">SKU: {item.itemSku}</p>
       </div>
      </div>

      <div className="space-y-2 text-xs">
       <div className="flex justify-between">
        <span className="text-slate-400">QC Type:</span>
        <span>{item.qcType}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Comments:</span>
        <span>{item.comments || '-'}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Created:</span>
        <span>{item.createdDt} by {item.createdBy}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Verified:</span>
        <span>{item.verifiedDt} by {item.verifiedBy}</span>
       </div>
       <div className="flex justify-between">
        <span className="text-slate-400">Status:</span>
        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.proofingStatus)}`}>
         {item.proofingStatus}
        </span>
       </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-600">
       <button
        onClick={() => handleEditClick(item)}
        className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
       >
        Edit
       </button>
       <button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
        Delete
       </button>
      </div>
     </div>
    ))}
   </div>

   {filteredData.length === 0 && (
    <div className="text-center py-8">
     <p className="text-slate-500">No proofing records found</p>
    </div>
   )}

   {/* Footer showing count */}
   <div className="mt-auto p-4 bg-slate-50 border-t border-slate-600">
    <div className="text-sm text-slate-400">
     Showing : {filteredData.length}
    </div>
   </div>
  </div>
 );
}
