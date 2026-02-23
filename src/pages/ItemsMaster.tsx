import React, { useState, useMemo, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';

const ItemsMaster: React.FC = () => {
  const { items, updateItem, deleteItem } = useItems();
  const { addToast } = useToast();
  const safeItems = Array.isArray(items) ? items : [];
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  
  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...safeItems];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.code?.toLowerCase().includes(query) ||
        JSON.stringify(item.data)?.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (typeFilters.length > 0) {
      result = result.filter(item => typeFilters.includes(item.type));
    }
    
    // Date range filter
    if (dateFrom) {
      result = result.filter(item => new Date(item.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      result = result.filter(item => new Date(item.createdAt) <= new Date(dateTo + 'T23:59:59'));
    }
    
    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'createdAt' || sortField === 'lastModified') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return result;
  }, [safeItems, searchQuery, typeFilters, dateFrom, dateTo, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleTypeFilterToggle = (type: string) => {
    setTypeFilters(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
    setCurrentPage(1);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) {
      setIsLoading(true);
      selectedIds.forEach(id => deleteItem(id));
      setSelectedIds([]);
      setIsLoading(false);
      addToast('success', `${selectedIds.length} items deleted successfully`);
    }
  };

  // Auto-save draft every 30 seconds if editing
  useEffect(() => {
    if (editMode && editedData) {
      const timer = setTimeout(() => {
        if (selectedItem) {
          const draftKey = `draft_${selectedItem.id}`;
          localStorage.setItem(draftKey, JSON.stringify(editedData));
          addToast('info', 'Draft auto-saved');
        }
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [editedData, editMode, selectedItem, addToast]);

  const handleExportExcel = () => {
    try {
      // Create CSV data
      const headers = ['Name', 'Code', 'Type', 'Created', 'Last Modified', 'Status'];
      const rows = filteredAndSortedItems.map(item => [
        item.name,
        item.code,
        getTypeLabel(item.type),
        new Date(item.createdAt).toLocaleDateString(),
        new Date(item.lastModified).toLocaleDateString(),
        item.data?.status || 'N/A'
      ]);

      // Convert to CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `items_master_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Excel file exported successfully');
    } catch (_error) {
      addToast('error', 'Failed to export Excel');
    }
  };

  const handleView = (item: any) => {
    setSelectedItem(item);
    setEditedData(JSON.parse(JSON.stringify(item.data)));
    setEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (selectedItem) {
      const updatedItem = {
        ...selectedItem,
        data: editedData,
        lastModified: new Date().toISOString(),
      };
      updateItem(selectedItem.id, updatedItem);
      setIsModalOpen(false);
      setEditMode(false);
      setSelectedItem(null);
      addToast('success', 'Item updated successfully');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItem(id);
      addToast('success', 'Item deleted successfully');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'raw-material': 'Raw Material',
      'bom': 'BOM',
      'packaging': 'Packaging',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'raw-material': 'bg-blue-100 text-blue-800',
      'bom': 'bg-green-100 text-green-800',
      'packaging': 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilters([]);
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  // Stats
  const stats = useMemo(() => ({
    total: safeItems.length,
    rawMaterial: safeItems.filter(i => i.type === 'raw-material').length,
    bom: safeItems.filter(i => i.type === 'bom').length,
    packaging: safeItems.filter(i => i.type === 'packaging').length,
  }), [safeItems]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Items Master</h1>
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export to Excel
              </button>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-600">Raw Materials</p>
              <p className="text-2xl font-bold text-blue-800">{stats.rawMaterial}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-600">BOM</p>
              <p className="text-2xl font-bold text-green-800">{stats.bom}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-purple-600">Packaging</p>
              <p className="text-2xl font-bold text-purple-800">{stats.packaging}</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by name, code, or any field..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600"
              >
                Clear Filters
              </button>
            </div>
            
            {/* Filter Row */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Type Multi-Select */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Type:</span>
                <div className="flex gap-2">
                  {['raw-material', 'bom', 'packaging'].map(type => (
                    <button
                      key={type}
                      onClick={() => handleTypeFilterToggle(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        typeFilters.includes(type)
                          ? getTypeColor(type)
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Date Range */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Date:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Active Filters Summary */}
            {(searchQuery || typeFilters.length > 0 || dateFrom || dateTo) && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing {filteredAndSortedItems.length} of {safeItems.length} items</span>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedIds.length} item(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8">
              {/* Skeleton Loader */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 mb-4 animate-pulse">
                  <div className="w-8 h-5 bg-gray-200 rounded"></div>
                  <div className="flex-1 h-5 bg-gray-200 rounded"></div>
                  <div className="w-24 h-5 bg-gray-200 rounded"></div>
                  <div className="w-20 h-5 bg-gray-200 rounded"></div>
                  <div className="w-24 h-5 bg-gray-200 rounded"></div>
                  <div className="w-24 h-5 bg-gray-200 rounded"></div>
                  <div className="w-20 h-5 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No items found</h3>
              <p className="text-gray-500">
                {safeItems.length === 0 
                  ? 'Create items from Raw Material, BOM, or Packaging pages.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedItems.length && paginatedItems.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="p-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      Item Name {getSortIcon('name')}
                    </th>
                    <th 
                      className="p-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('code')}
                    >
                      Code {getSortIcon('code')}
                    </th>
                    <th 
                      className="p-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('type')}
                    >
                      Type {getSortIcon('type')}
                    </th>
                    <th 
                      className="p-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('createdAt')}
                    >
                      Created {getSortIcon('createdAt')}
                    </th>
                    <th 
                      className="p-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('lastModified')}
                    >
                      Last Modified {getSortIcon('lastModified')}
                    </th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="p-4 text-sm text-gray-600 font-mono">{item.code}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(item.lastModified).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(item)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {filteredAndSortedItems.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)} of {filteredAndSortedItems.length}
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedItem.name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getTypeColor(selectedItem.type)}`}>
                    {getTypeLabel(selectedItem.type)}
                  </span>
                  <p className="text-sm text-gray-600">Code: {selectedItem.code}</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {editMode ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Item</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(editedData).map(([key, value]: [string, any]) => {
                      if (typeof value === 'object' && value !== null) return null;
                      if (Array.isArray(value)) return null;
                      
                      return (
                        <div key={key}>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          {typeof value === 'boolean' ? (
                            <select
                              value={value ? 'true' : 'false'}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  [key]: e.target.value === 'true',
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={typeof value === 'number' ? 'number' : 'text'}
                              value={value || ''}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  [key]: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Display all form fields organized by sections */}
                  {Object.entries(selectedItem.data).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(selectedItem.data).map(([key, value]: [string, any]) => {
                        // Skip empty values
                        if (value === '' || value === null || value === undefined) return null;
                        
                        // Handle arrays (like vendors, documents, etc.)
                        if (Array.isArray(value)) {
                          if (value.length === 0) return null;
                          return (
                            <div key={key} className="border-t pt-4">
                              <h4 className="text-md font-semibold text-gray-800 mb-3 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-4">
                                {value.map((item, idx) => (
                                  <div key={idx} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(item).map(([itemKey, itemValue]: [string, any]) => (
                                        <div key={itemKey}>
                                          <span className="text-xs font-semibold text-gray-600 uppercase">
                                            {itemKey}:
                                          </span>
                                          <span className="text-sm text-gray-800 ml-2">
                                            {String(itemValue)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        
                        // Handle objects
                        if (typeof value === 'object' && value !== null) {
                          return null;
                        }
                        
                        // Handle simple values
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2 border-b pb-3">
                            <div className="col-span-1">
                              <label className="text-xs font-semibold text-gray-600 uppercase">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </label>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm text-gray-800 break-words">
                                {typeof value === 'boolean' ? (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {value ? 'Yes' : 'No'}
                                  </span>
                                ) : (
                                  String(value)
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-700">Created:</p>
                    <p>{new Date(selectedItem.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Last Modified:</p>
                    <p>{new Date(selectedItem.lastModified).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
              {editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsMaster;
