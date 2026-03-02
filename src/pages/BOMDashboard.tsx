import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { fetchBOMs, type BOMRecord } from '../services/bom.service';

const BOMDashboard: React.FC = () => {
  const [list, setList] = useState<BOMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedBOM, setSelectedBOM] = useState<BOMRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadBOMs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchBOMs(searchTerm || undefined);
    if (res.success && res.data) {
      setList(res.data);
    } else {
      const errorMessage =
        typeof res.error === 'string'
          ? res.error
          : res.error?.message ?? 'Failed to load BOMs';
      setError(errorMessage);
      setList([]);
    }
    setLoading(false);
  }, [searchTerm]);

  const handleViewItem = (bom: BOMRecord) => {
    setSelectedBOM(bom);
    setIsViewModalOpen(true);
    setIsEditMode(false);
  };

  const handleEditItem = () => {
    setIsEditMode(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedBOM) return;
    setIsSaving(true);
    try {
      setList(list.map(b => b.id === selectedBOM.id ? selectedBOM : b));
      setIsEditMode(false);
    } catch (err) {
      console.error('Error saving BOM:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsViewModalOpen(false);
    setSelectedBOM(null);
    setIsEditMode(false);
  };

  const updateSelectedBOMField = (field: keyof BOMRecord, value: any) => {
    if (selectedBOM) {
      setSelectedBOM({ ...selectedBOM, [field]: value });
    }
  };

  useEffect(() => {
    loadBOMs();
  }, [loadBOMs]);

  const statCardData = [
    { label: 'TOTAL PRODUCTS', value: list.length, sub: 'Registered PR masters', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'PRODUCTION RELEASED', value: list.filter(b => b.status === 'Approved').length, sub: 'Ready to manufacture', accent: 'border-l-green-500', num: 'text-green-600' },
    { label: 'CATEGORIES', value: 2, sub: 'Product categories', accent: 'border-l-orange-400', num: 'text-orange-500' },
    { label: 'RM INGREDIENTS', value: 23, sub: 'Unique RMs in use', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PM COMPONENTS', value: 7, sub: 'Unique PMs in use', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 w-full">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">📦</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">PR Masters</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Products (PR)</h1>
            <p className="text-sm text-gray-600">Manage product registrations, formulations, packaging specifications and regulatory compliance.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCardData.map(card => (
            <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
              <div className={`h-1 bg-linear-to-r from-blue-400 to-blue-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Products Master</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{list.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* search */}
              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadBOMs()}
                  placeholder="Search name, code, SKU…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all w-52"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Categories</option>
                <option>Sunscreen</option>
                <option>Facewash</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Statuses</option>
                <option>Production Released</option>
                <option>Draft</option>
              </select>

              <Link
                to="/bom/new"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                New PR
              </Link>
            </div>
          </div>

          {/* Table */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <span className="animate-pulse">Loading Products…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CODE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PRODUCT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CATEGORY</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FORM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FILL SIZE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">BATCH (KG)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">SHELF LIFE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RM INGS.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PACK ITEMS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">MRP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">STATUS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">VER.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">OPEN SOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center text-gray-500">
                        No Products found. <Link to="/bom/new" className="text-blue-600 hover:text-blue-700 font-semibold">Create one</Link> to get started.
                      </td>
                    </tr>
                  ) : (
                    list.map((bom, idx) => (
                      <tr key={bom.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewItem(bom)}>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 hover:text-blue-600">{bom.bomCode || `PR-${String(idx + 1).padStart(5, '0')}`}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{bom.name || 'Product'}</p>
                            <p className="text-xs text-gray-500">SKU: {bom.type || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{bom.type || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">—</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            bom.status === 'Approved' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {bom.status || 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{bom.version || '1'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── View/Edit Modal ── */}
      {isViewModalOpen && selectedBOM && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-lg font-bold">{selectedBOM.name || 'Product Details'}</h2>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-slate-700 rounded-lg p-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Product Identity Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider border-b pb-2">PRODUCT IDENTITY</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Product Code</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={selectedBOM.bomCode || ''}
                        onChange={(e) => updateSelectedBOMField('bomCode', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{selectedBOM.bomCode || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Product Name</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={selectedBOM.name || ''}
                        onChange={(e) => updateSelectedBOMField('name', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{selectedBOM.name || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Specifications Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider border-b pb-2">SPECIFICATIONS</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={selectedBOM.type || ''}
                        onChange={(e) => updateSelectedBOMField('type', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{selectedBOM.type || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Form</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={(selectedBOM as any).form || ''}
                        onChange={(e) => updateSelectedBOMField('form' as any, e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{(selectedBOM as any).form || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Production Details Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider border-b pb-2">PRODUCTION DETAILS</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Fill Size</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={(selectedBOM as any).fillSize || ''}
                        onChange={(e) => updateSelectedBOMField('fillSize' as any, e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{(selectedBOM as any).fillSize || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Batch Size (KG)</label>
                    {isEditMode ? (
                      <input
                        type="number"
                        value={(selectedBOM as any).batchSize || ''}
                        onChange={(e) => updateSelectedBOMField('batchSize' as any, parseFloat(e.target.value))}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{(selectedBOM as any).batchSize || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Shelf Life</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={(selectedBOM as any).shelfLife || ''}
                        onChange={(e) => updateSelectedBOMField('shelfLife' as any, e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{(selectedBOM as any).shelfLife || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Version</label>
                    {isEditMode ? (
                      <input
                        type="number"
                        value={selectedBOM.version || 1}
                        onChange={(e) => updateSelectedBOMField('version', parseInt(e.target.value))}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-gray-800 font-medium mt-1">{selectedBOM.version || '1'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider border-b pb-2">STATUS</h3>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                  {isEditMode ? (
                    <select
                      value={selectedBOM.status || 'Draft'}
                      onChange={(e) => updateSelectedBOMField('status', e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
                      <option value="Archived">Archived</option>
                    </select>
                  ) : (
                    <div className="mt-1">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        selectedBOM.status === 'Approved'
                          ? 'bg-green-100 text-green-700'
                          : selectedBOM.status === 'Archived'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedBOM.status || 'Draft'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-gray-200 sticky bottom-0">
              {isEditMode ? (
                <>
                  <button
                    onClick={() => setIsEditMode(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleEditItem}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Product
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMDashboard;
