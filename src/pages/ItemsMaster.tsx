import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchItemsMaster,
  updateItemMaster,
  deleteItemMaster,
  createItemMaster,
  type ItemMasterRecord,
  type CreateItemMasterPayload,
} from '../services/itemsMaster.service';
import { fetchBOMs } from '../services/bom.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';

/** List of selected items + dropdown to add more. */
function LinkedMultiField({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: { id: number; label: string }[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const available = options.filter((o) => !selectedIds.includes(o.id));
  const [dropdownVal, setDropdownVal] = useState<string>('');

  const add = () => {
    const id = dropdownVal ? Number(dropdownVal) : null;
    if (id != null && !Number.isNaN(id) && !selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
      setDropdownVal('');
    }
  };

  const remove = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const selectedLabels = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as { id: number; label: string }[];

  return (
    <div className="col-span-2 space-y-2">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      {selectedLabels.length > 0 ? (
        <ul className="mb-2 rounded-lg border border-gray-200 divide-y divide-gray-100 bg-gray-50/50">
          {selectedLabels.map((opt) => (
            <li key={opt.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-gray-800">{opt.label}</span>
              <button
                type="button"
                onClick={() => remove(opt.id)}
                className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded p-1"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-2">None added yet.</p>
      )}
      <div className="flex gap-2">
        <select
          value={dropdownVal}
          onChange={(e) => setDropdownVal(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">— Add one —</option>
          {available.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!dropdownVal || available.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Add
        </button>
      </div>
    </div>
  );
}

const ItemsMaster: React.FC = () => {
  const { addToast } = useToast();
  const [list, setList] = useState<ItemMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemMasterRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Partial<CreateItemMasterPayload> | null>(null);
  const [bomOptions, setBomOptions] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [pmOptions, setPmOptions] = useState<Array<{ id: number; code: string; description: string }>>([]);
  const [rmOptions, setRmOptions] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createData, setCreateData] = useState<Partial<CreateItemMasterPayload>>({ type: 'product', status: 'Active', bomIds: [], rawMaterialIds: [], packMaterialIds: [] });

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await fetchItemsMaster();
    if (res.success && res.data) setList(res.data);
    else {
      setLoadError(typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? String((res.error as { message: string }).message) : 'Failed to load items'));
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { loadItems(); }, 0);
    return () => clearTimeout(t);
  }, [loadItems]);

  const safeItems = list.map((item): ItemMasterRecord & { lastModified: string } => ({
    ...item,
    lastModified: item.updatedAt ?? item.createdAt ?? '',
  }));

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

  const isLoading = loading;

 // Filter and sort items
 const filteredAndSortedItems = useMemo(() => {
  let result = [...safeItems];
  
  // Search filter
  if (searchQuery.trim()) {
   const query = searchQuery.toLowerCase();
   result = result.filter(item =>
    item.name?.toLowerCase().includes(query) ||
    item.code?.toLowerCase().includes(query) ||
    (item.linked && JSON.stringify(item.linked)).toLowerCase().includes(query)
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
   let aVal: string | number = sortField === 'lastModified' ? (a as { lastModified?: string }).lastModified ?? a.updatedAt : (a[sortField as keyof typeof a] as string);
   let bVal: string | number = sortField === 'lastModified' ? (b as { lastModified?: string }).lastModified ?? b.updatedAt : (b[sortField as keyof typeof b] as string);
   if (sortField === 'createdAt' || sortField === 'lastModified') {
    const aNum = new Date(String(aVal)).getTime();
    const bNum = new Date(String(bVal)).getTime();
    return sortDirection === 'asc' ? (aNum > bNum ? 1 : -1) : (bNum > aNum ? 1 : -1);
   }
   aVal = String(aVal || '').toLowerCase();
   bVal = String(bVal || '').toLowerCase();
   if (sortDirection === 'asc') return aVal > bVal ? 1 : -1;
   return bVal > aVal ? 1 : -1;
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
    setLoading(true);
    let done = 0;
    for (const id of selectedIds) {
      const result = await deleteItemMaster(id);
      if (result.success) done++;
    }
    setSelectedIds([]);
    await loadItems();
    setLoading(false);
    addToast('success', `${done} item(s) deleted successfully`);
  };


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
    item.status || 'N/A'
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

  const loadOptionsForEdit = useCallback(async () => {
    const [bomRes, pmList, rmList] = await Promise.all([
      fetchBOMs(),
      fetchPackMaterialsList(),
      fetchRawMaterialsList(),
    ]);
    if (bomRes.success && bomRes.data) {
      setBomOptions(bomRes.data.map(b => ({ id: Number(b.id), code: b.bomCode, name: b.name ?? b.bomCode })));
    }
    setPmOptions((pmList ?? []).map(p => ({ id: Number(p.id), code: p.code, description: p.description ?? p.code })));
    setRmOptions((rmList ?? []).map(r => ({ id: Number(r.id), code: r.code, name: r.name ?? r.code })));
  }, []);

  const handleOpenCreate = () => {
    setCreateData({ type: 'product', status: 'Active', bomIds: [], rawMaterialIds: [], packMaterialIds: [] });
    setIsCreateModalOpen(true);
    loadOptionsForEdit();
  };

  const handleFillMockValues = () => {
    const uniqueCode = `IM-MOCK-${Date.now().toString(36).toUpperCase()}`;
    setCreateData({
      code: uniqueCode,
      name: 'Mock Product (test)',
      type: 'product',
      status: 'Active',
      bomIds: bomOptions.length > 0 ? [bomOptions[0].id] : [],
      rawMaterialIds: rmOptions.length > 0 ? [rmOptions[0].id] : [],
      packMaterialIds: pmOptions.length > 0 ? [pmOptions[0].id] : [],
    });
    addToast('success', 'Mock values filled. Edit as needed and click Create.');
  };

  const handleCreateSubmit = async () => {
    if (!createData.code?.trim()) { addToast('error', 'Code is required'); return; }
    const codeTrimmed = createData.code.trim();
    const existingCodes = list.map((i) => i.code.trim().toLowerCase());
    if (existingCodes.includes(codeTrimmed.toLowerCase())) {
      addToast('error', 'An item with this code already exists. Use a unique code.');
      return;
    }
    const payload: CreateItemMasterPayload = {
      code: createData.code.trim(),
      name: createData.name?.trim(),
      type: createData.type ?? 'product',
      status: createData.status ?? 'Active',
      bomIds: createData.bomIds ?? [],
      packMaterialIds: createData.packMaterialIds ?? [],
      rawMaterialIds: createData.rawMaterialIds ?? [],
    };
    const result = await createItemMaster(payload);
    if (result.success) {
      await loadItems();
      setIsCreateModalOpen(false);
      addToast('success', 'Item created successfully');
    } else {
      addToast('error', typeof result.error === 'string' ? result.error : result.error?.message ?? 'Failed to create');
    }
  };

  const handleView = (item: ItemMasterRecord & { lastModified?: string }) => {
    setSelectedItem(item);
    setEditedData({
      code: item.code,
      name: item.name,
      type: item.type,
      status: item.status ?? '',
      bomIds: item.bomIds ?? [],
      packMaterialIds: item.packMaterialIds ?? [],
      rawMaterialIds: item.rawMaterialIds ?? [],
    });
    setEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setEditMode(true);
    loadOptionsForEdit();
  };

  const handleSaveEdit = async () => {
    if (!selectedItem || !editedData) return;
    const payload: Partial<CreateItemMasterPayload> = {
      code: editedData.code,
      name: editedData.name,
      type: editedData.type,
      status: editedData.status,
      bomIds: editedData.bomIds ?? [],
      packMaterialIds: editedData.packMaterialIds ?? [],
      rawMaterialIds: editedData.rawMaterialIds ?? [],
    };
    const result = await updateItemMaster(selectedItem.id, payload);
    if (result.success) {
      await loadItems();
      setIsModalOpen(false);
      setEditMode(false);
      setSelectedItem(null);
      setEditedData(null);
      addToast('success', 'Item updated successfully');
    } else {
      addToast('error', typeof result.error === 'string' ? result.error : result.error?.message ?? 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    const result = await deleteItemMaster(id);
    if (result.success) {
      await loadItems();
      addToast('success', 'Item deleted successfully');
    } else {
      addToast('error', typeof result.error === 'string' ? result.error : result.error?.message ?? 'Failed to delete');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'product': 'Product',
      'raw-material': 'Raw Material',
      'bom': 'BOM',
      'packaging': 'Packaging',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'product': 'bg-indigo-100 text-indigo-800',
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

 const _formatKeyLabel = (rawKey: string): string => {
  if (!rawKey) return '';

  // First, remove all spaces around single characters (e.g., "C F. Y I E L D P E R C E N T A G E" -> "CF.YIELDPERCENTAGE")
  let normalized = rawKey.replace(/\s+/g, ' ').trim(); // normalize multiple spaces to single space
  normalized = normalized.replace(/(\s)([A-Z])(\s)/g, '$2'); // remove spaces around single capital letters
  normalized = normalized.replace(/\s+/g, ''); // remove all remaining spaces
  
  // Handle custom-field prefix from Zoho like "CF.MFG Date" or "CF.YIELDPERCENTAGE"
  if (normalized.toUpperCase().startsWith('CF.')) {
   const withoutPrefix = normalized.slice(3);
   
   // Convert common patterns to readable labels
   const labelMap: Record<string, string> = {
    'YIELDPERCENTAGE': 'Yield Percentage',
    'TARGETDEVELOPMENTPRICE': 'Target Development Price',
    'PRICEPERKG': 'Price Per KG',
    'ITEMSTATUS': 'Item Status',
    'MKTBRANDNAME': 'Market Brand Name',
    'SALESPERSONNAME': 'Sales Person Name',
    'OLDSKU': 'Old SKU',
    'PREVIOUSSKU': 'Previous SKU',
    'INCINAME': 'INCI Name',
    'MONOCARTONSTATUS': 'Monocarton Status',
    'MONOCARTONPRICE': 'Monocarton Price',
    'IS_GROUP_ITEM': 'Is Group Item',
   };
   
   const upperKey = withoutPrefix.toUpperCase().replace(/[_\s]+/g, '');
   if (labelMap[upperKey]) {
    return labelMap[upperKey];
   }
   
   // If not in map, format by adding spaces before capitals and after dots
   let label = withoutPrefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
   label = label.replace(/[_\s]+/g, ' ');
   return label.trim();
  }

  // If key already has spaces, just normalise them
  if (normalized.includes(' ')) {
   return normalized.replace(/\s+/g, ' ').trim();
  }

  // Normalise snake / kebab
  let label = normalized.replace(/[_-]+/g, ' ');

  // If the whole thing is uppercase (an acronym), avoid inserting spaces between each letter
  if (/^[A-Z0-9\s]+$/.test(label)) {
   return label.trim();
  }

  // Add space before capital letters in camelCase or PascalCase
  label = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  return label.trim();
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
    product: safeItems.filter(i => i.type === 'product').length,
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
        onClick={handleOpenCreate}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
       >
        Add Item
       </button>
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
     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
       <p className="text-sm text-gray-600">Total Items</p>
       <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
      </div>
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
       <p className="text-sm text-indigo-600">Products</p>
       <p className="text-2xl font-bold text-indigo-800">{stats.product}</p>
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

    {loadError && (
     <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{loadError}</div>
    )}

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
         {['product', 'raw-material', 'bom', 'packaging'].map(type => (
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
       {editMode && editedData ? (
        <div className="space-y-4">
         <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Item</h3>
         <div className="grid grid-cols-2 gap-4">
          <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">Code</label>
           <input value={editedData.code ?? ''} onChange={(e) => setEditedData({ ...editedData, code: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
           <input value={editedData.name ?? ''} onChange={(e) => setEditedData({ ...editedData, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
           <select value={editedData.type ?? 'product'} onChange={(e) => setEditedData({ ...editedData, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="product">Product</option>
            <option value="bom">BOM</option>
            <option value="packaging">Packaging</option>
            <option value="raw-material">Raw Material</option>
           </select>
          </div>
          <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
           <input value={editedData.status ?? ''} onChange={(e) => setEditedData({ ...editedData, status: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Active" />
          </div>
          <LinkedMultiField
           label="Linked BOMs"
           options={bomOptions.map((b) => ({ id: b.id, label: `${b.code} — ${b.name}` }))}
           selectedIds={editedData.bomIds ?? []}
           onChange={(bomIds) => setEditedData({ ...editedData, bomIds })}
          />
          <LinkedMultiField
           label="Linked Raw Materials"
           options={rmOptions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
           selectedIds={editedData.rawMaterialIds ?? []}
           onChange={(rawMaterialIds) => setEditedData({ ...editedData, rawMaterialIds })}
          />
          <LinkedMultiField
           label="Linked Pack Materials"
           options={pmOptions.map((p) => ({ id: p.id, label: `${p.code} — ${p.description}` }))}
           selectedIds={editedData.packMaterialIds ?? []}
           onChange={(packMaterialIds) => setEditedData({ ...editedData, packMaterialIds })}
          />
         </div>
        </div>
       ) : (
        <div className="space-y-6">
         <div className="grid grid-cols-2 gap-4">
          <div><p className="text-xs font-semibold text-gray-500">Code</p><p className="text-gray-900">{selectedItem.code}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Name</p><p className="text-gray-900">{selectedItem.name}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Type</p><p className="text-gray-900">{getTypeLabel(selectedItem.type)}</p></div>
          <div><p className="text-xs font-semibold text-gray-500">Status</p><p className="text-gray-900">{selectedItem.status ?? '—'}</p></div>
          {selectedItem.linked?.boms && selectedItem.linked.boms.length > 0 && (
           <div className="col-span-2"><p className="text-xs font-semibold text-gray-500">Linked BOMs</p><ul className="mt-1 text-gray-900 list-disc list-inside">{selectedItem.linked.boms.map(b => (<li key={b.id}>{b.code} — {b.name}</li>))}</ul></div>
          )}
          {selectedItem.linked?.rawMaterials && selectedItem.linked.rawMaterials.length > 0 && (
           <div className="col-span-2"><p className="text-xs font-semibold text-gray-500">Linked Raw Materials</p><ul className="mt-1 text-gray-900 list-disc list-inside">{selectedItem.linked.rawMaterials.map(r => (<li key={r.id}>{r.code} — {r.name}</li>))}</ul></div>
          )}
          {selectedItem.linked?.packMaterials && selectedItem.linked.packMaterials.length > 0 && (
           <div className="col-span-2"><p className="text-xs font-semibold text-gray-500">Linked Pack Materials</p><ul className="mt-1 text-gray-900 list-disc list-inside">{selectedItem.linked.packMaterials.map(p => (<li key={p.id}>{p.code} — {p.description}</li>))}</ul></div>
          )}
         </div>
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
          <p>{new Date((selectedItem as { lastModified?: string }).lastModified ?? selectedItem.updatedAt ?? selectedItem.createdAt).toLocaleString()}</p>
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

   {/* Create Item Modal */}
   {isCreateModalOpen && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
     <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
       <h2 className="text-xl font-bold text-gray-800">Add Item</h2>
       <div className="flex items-center gap-2">
        <button type="button" onClick={handleFillMockValues} className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition">
         Fill mock values
        </button>
        <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
       </div>
      </div>
      <div className="p-6 space-y-4">
       <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Code *</label>
        <input value={createData.code ?? ''} onChange={(e) => setCreateData({ ...createData, code: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. IM-PROD-004" />
       </div>
       <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
        <input value={createData.name ?? ''} onChange={(e) => setCreateData({ ...createData, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Product name" />
       </div>
       <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
        <select value={createData.type ?? 'product'} onChange={(e) => setCreateData({ ...createData, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
         <option value="product">Product</option>
         <option value="bom">BOM</option>
         <option value="packaging">Packaging</option>
         <option value="raw-material">Raw Material</option>
        </select>
       </div>
       <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
        <input value={createData.status ?? 'Active'} onChange={(e) => setCreateData({ ...createData, status: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
       </div>
       <LinkedMultiField
        label="Linked BOMs"
        options={bomOptions.map((b) => ({ id: b.id, label: `${b.code} — ${b.name}` }))}
        selectedIds={createData.bomIds ?? []}
        onChange={(bomIds) => setCreateData({ ...createData, bomIds })}
       />
       <LinkedMultiField
        label="Linked Raw Materials"
        options={rmOptions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
        selectedIds={createData.rawMaterialIds ?? []}
        onChange={(rawMaterialIds) => setCreateData({ ...createData, rawMaterialIds })}
       />
       <LinkedMultiField
        label="Linked Pack Materials"
        options={pmOptions.map((p) => ({ id: p.id, label: `${p.code} — ${p.description}` }))}
        selectedIds={createData.packMaterialIds ?? []}
        onChange={(packMaterialIds) => setCreateData({ ...createData, packMaterialIds })}
       />
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
       <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
       <button onClick={handleCreateSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
};

export default ItemsMaster;
