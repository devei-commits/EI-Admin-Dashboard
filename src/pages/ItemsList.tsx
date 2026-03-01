import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchItemsList,
  fetchItemListById,
  createItemList,
  updateItemList,
  fetchItemListRates,
  createItemListRate,
  createItemListTier,
  deleteItemListRate,
  deleteItemListTier,
  type ItemListRecord,
  type ItemListDetailRecord,
  type ItemListVendorRateRow,
} from '../services/itemsList.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import { fetchVendorClients } from '../services/vendorClient.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';
import type { VendorClientRecord } from '../services/vendorClient.service';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  'UV FILTER': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  BASE: { bg: 'bg-slate-100', text: 'text-slate-600', badge: 'bg-slate-100' },
  EMULSIFIER: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
  TUBE: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
  Bottle: { bg: 'bg-cyan-50', text: 'text-cyan-700', badge: 'bg-cyan-100' },
  Label: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
};

const ItemsList: React.FC = () => {
  const { addToast } = useToast();
  const [itemLists, setItemLists] = useState<ItemListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'price'>('code');
  const [sortAsc, setSortAsc] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{ type: 'RM' | 'PM'; raw_material_id: string; pack_material_id: string }>({ type: 'RM', raw_material_id: '', pack_material_id: '' });
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [vendors, setVendors] = useState<VendorClientRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemListDetailRecord | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [rates, setRates] = useState<ItemListVendorRateRow[]>([]);
  const [addingRate, setAddingRate] = useState(false);
  const [newRateVendorId, setNewRateVendorId] = useState('');
  const [newRateDefaultRate, setNewRateDefaultRate] = useState('');
  const [newRateDefaultMoq, setNewRateDefaultMoq] = useState('');
  const [addingTierForRateId, setAddingTierForRateId] = useState<number | null>(null);
  const [newTierMoqMin, setNewTierMoqMin] = useState('');
  const [newTierMoqMax, setNewTierMoqMax] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [addItemSubmitting, setAddItemSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchItemsList().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setItemLists(res.data);
      else setItemLists([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    Promise.all([
      fetchRawMaterialsList().catch(() => []),
      fetchPackMaterialsList().catch(() => []),
      fetchVendorClients('vendor').then((r) => (r.success && r.data ? r.data : [])),
    ]).then(([rms, pms, v]) => {
      setRawMaterials(rms ?? []);
      setPackMaterials(pms ?? []);
      setVendors(v ?? []);
    });
  }, []);

  const filtered = useMemo(() => {
    return itemLists
      .filter((item) => {
        const matchType = typeFilter === 'All' || item.type === typeFilter;
        const q = searchQuery.toLowerCase();
        const matchSearch =
          !q ||
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q);
        return matchType && matchSearch;
      })
      .sort((a, b) => {
        const compareValue = sortBy === 'code' ? a.code.localeCompare(b.code) : a.pricePerUnit - b.pricePerUnit;
        return sortAsc ? compareValue : -compareValue;
      });
  }, [itemLists, typeFilter, searchQuery, sortBy, sortAsc]);

  const stats = useMemo(
    () => ({
      rmItems: itemLists.filter((i) => i.type === 'RM').length,
      pmItems: itemLists.filter((i) => i.type === 'PM').length,
      withVendors: itemLists.filter((i) => i.vendors > 0).length,
      withTiers: itemLists.filter((i) => i.tiers > 0).length,
    }),
    [itemLists]
  );

  const statCards = [
    { label: 'RM ITEMS', value: stats.rmItems, sub: 'Raw material masters', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PM ITEMS', value: stats.pmItems, sub: 'Packaging masters', accent: 'border-l-violet-500', num: 'text-violet-600' },
    { label: 'W/ VENDORS', value: stats.withVendors, sub: 'Multi-vendor setup', accent: 'border-l-amber-500', num: 'text-amber-600' },
    { label: 'W/ TIERS', value: stats.withTiers, sub: 'MOQ price breaks', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  function formatPrice(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0 });
  }

  const openSidebar = async (item: ItemListRecord) => {
    setSelectedItem(null);
    setRates([]);
    setSidebarLoading(true);
    const res = await fetchItemListById(item.id);
    if (res.success && res.data) {
      setSelectedItem(res.data);
      setEditStatus(res.data.status || 'Active');
      setRates(res.data.vendorRates || []);
    } else {
      addToast('error', res.error?.message ?? 'Failed to load item');
    }
    setSidebarLoading(false);
  };

  const handleSaveStatus = async () => {
    if (!selectedItem) return;
    setSavingStatus(true);
    const res = await updateItemList(selectedItem.id, { status: editStatus });
    setSavingStatus(false);
    if (res.success && res.data) {
      setItemLists((prev) => prev.map((i) => (i.id === res.data!.id ? res.data! : i)));
      setSelectedItem((prev) => (prev && prev.id === res.data!.id ? { ...prev, ...res.data } : prev));
      addToast('success', 'Status updated');
    } else {
      addToast('error', res.error?.message ?? 'Failed to update status');
    }
  };

  const refetchRates = async () => {
    if (!selectedItem) return;
    const res = await fetchItemListRates(selectedItem.id);
    if (res.success && res.data) setRates(res.data);
  };

  const handleAddRate = async () => {
    if (!selectedItem || !newRateVendorId.trim()) return;
    const vendorId = parseInt(newRateVendorId, 10);
    if (Number.isNaN(vendorId)) return;
    const res = await createItemListRate(selectedItem.id, {
      vendor_id: vendorId,
      default_rate: newRateDefaultRate ? parseFloat(newRateDefaultRate) : null,
      default_moq: newRateDefaultMoq ? parseInt(newRateDefaultMoq, 10) : null,
    });
    if (res.success && res.data) {
      setRates((prev) => [...prev, res.data!]);
      setNewRateVendorId('');
      setNewRateDefaultRate('');
      setNewRateDefaultMoq('');
      setAddingRate(false);
      addToast('success', 'Vendor rate added');
    } else {
      addToast('error', res.error?.message ?? 'Failed to add rate');
    }
  };

  const handleAddTier = async (rateId: number) => {
    if (!selectedItem || !newTierMoqMin || !newTierPrice) return;
    const moqMin = parseInt(newTierMoqMin, 10);
    const price = parseFloat(newTierPrice);
    if (Number.isNaN(moqMin) || Number.isNaN(price)) return;
    const res = await createItemListTier(selectedItem.id, rateId, {
      moq_min: moqMin,
      moq_max: newTierMoqMax ? parseInt(newTierMoqMax, 10) : null,
      price_per_unit: price,
    });
    if (res.success) {
      await refetchRates();
      setAddingTierForRateId(null);
      setNewTierMoqMin('');
      setNewTierMoqMax('');
      setNewTierPrice('');
      addToast('success', 'Tier added');
    } else {
      addToast('error', res.error?.message ?? 'Failed to add tier');
    }
  };

  const handleDeleteRate = async (rateId: number) => {
    if (!selectedItem || !window.confirm('Remove this vendor rate and all its tiers?')) return;
    const res = await deleteItemListRate(selectedItem.id, rateId);
    if (res.success) {
      setRates((prev) => prev.filter((r) => r.id !== rateId));
      addToast('success', 'Rate removed');
    } else {
      addToast('error', res.error?.message ?? 'Failed to delete rate');
    }
  };

  const handleAddItem = async () => {
    if (addForm.type === 'RM') {
      if (!addForm.raw_material_id) {
        addToast('error', 'Select a raw material');
        return;
      }
    } else {
      if (!addForm.pack_material_id) {
        addToast('error', 'Select a pack material');
        return;
      }
    }
    setAddItemSubmitting(true);
    const payload =
      addForm.type === 'RM'
        ? { type: 'RM' as const, raw_material_id: parseInt(addForm.raw_material_id, 10), pack_material_id: null }
        : { type: 'PM' as const, raw_material_id: null, pack_material_id: parseInt(addForm.pack_material_id, 10) };
    const res = await createItemList(payload);
    setAddItemSubmitting(false);
    if (res.success && res.data) {
      setItemLists((prev) => [...prev, res.data!]);
      setShowAddModal(false);
      setAddForm({ type: 'RM', raw_material_id: '', pack_material_id: '' });
      addToast('success', `Item "${res.data!.name}" added to list`);
    } else {
      addToast('error', res.error?.message ?? 'Failed to add item');
    }
  };

  const inListRmIds = useMemo(() => new Set(itemLists.filter((i) => i.type === 'RM').map((i) => i.raw_material_id).filter(Boolean)), [itemLists]);
  const inListPmIds = useMemo(() => new Set(itemLists.filter((i) => i.type === 'PM').map((i) => i.pack_material_id).filter(Boolean)), [itemLists]);
  const availableRm = useMemo(() => rawMaterials.filter((r) => !inListRmIds.has(parseInt(r.id, 10))), [rawMaterials, inListRmIds]);
  const availablePm = useMemo(() => packMaterials.filter((p) => !inListPmIds.has(parseInt(p.id, 10))), [packMaterials, inListPmIds]);
  const vendorsAlreadyUsed = useMemo(() => new Set(rates.map((r) => r.vendor_id)), [rates]);
  const availableVendors = useMemo(() => vendors.filter((v) => !vendorsAlreadyUsed.has(parseInt(v.id, 10))), [vendors, vendorsAlreadyUsed]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">📋</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Item Catalog</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Items List</h1>
            <p className="text-sm text-gray-600">Vendor-specific pricing tiers, rates, and MOQ breakpoints.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-linear-to-r from-blue-400 to-blue-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Items — Pricing & Tiers</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">
                {filtered.length} / {itemLists.length}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all w-48"
                />
              </div>
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                {(['All', 'RM', 'PM'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${typeFilter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
              >
                <span className="text-base leading-none">+</span> Add Item
              </button>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                No items match your search.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-200 overflow-y-auto">
              {filtered.map((item) => {
                const colors = CATEGORY_COLORS[item.category] || { bg: 'bg-gray-100', text: 'text-gray-600', badge: 'bg-gray-100' };
                return (
                  <div key={item.id} className="p-5 hover:bg-linear-to-r hover:from-blue-50/50 hover:to-transparent transition-colors group">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-blue-600 group-hover:text-blue-700">{item.code}</span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.badge}`}>{item.category}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.type === 'RM' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'}`}>{item.type}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1.5 group-hover:text-blue-700 transition-colors">{item.name}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                          item.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {item.status === 'Active' ? '✓ ' : ''}{item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Price/Unit</p>
                        <p className="font-bold text-amber-600 group-hover:text-amber-700">{formatPrice(item.pricePerUnit)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">UOM</p>
                        <p className="text-gray-700 font-semibold">{item.uom}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">GST</p>
                        <p className="text-gray-700 font-semibold">{item.gst}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Vendors</p>
                        <p className={`font-bold ${item.vendors > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {item.vendors > 0 ? `${item.vendors} vendor${item.vendors > 1 ? 's' : ''}` : 'No tiers'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Tiers</p>
                        <p className={`font-bold ${item.tiers > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {item.tiers > 0 ? `${item.tiers} tier${item.tiers > 1 ? 's' : ''}` : 'List only'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Updated</p>
                        <p className="text-gray-600">{item.lastUpdated || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => openSidebar(item)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                        ⚙️ Edit
                      </button>
                      <button onClick={() => openSidebar(item)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition-colors">
                        💰 View Tiers
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Item to List</h2>
            <p className="text-sm text-gray-600">Select a raw material or pack material to add to the items list (vendor rates can be added in Edit / View Tiers).</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, type: 'RM', pack_material_id: '' }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${addForm.type === 'RM' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Raw Material
                </button>
                <button
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, type: 'PM', raw_material_id: '' }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${addForm.type === 'PM' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Pack Material
                </button>
              </div>
            </div>
            {addForm.type === 'RM' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Raw Material</label>
                <select
                  value={addForm.raw_material_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, raw_material_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {availableRm.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                  {availableRm.length === 0 && <option value="">None available (all in list)</option>}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pack Material</label>
                <select
                  value={addForm.pack_material_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, pack_material_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {availablePm.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.description}
                    </option>
                  ))}
                  {availablePm.length === 0 && <option value="">None available (all in list)</option>}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleAddItem} disabled={addItemSubmitting} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {addItemSubmitting ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar: Edit item + View Tiers */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md" onClick={() => { setSelectedItem(null); setAddingRate(false); setAddingTierForRateId(null); }} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col max-h-screen overflow-hidden">
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedItem.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedItem.code} · {selectedItem.type}</p>
              </div>
              <button onClick={() => { setSelectedItem(null); setAddingRate(false); setAddingTierForRateId(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {sidebarLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Status</h3>
                    <div className="flex items-center gap-2">
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      <button onClick={handleSaveStatus} disabled={savingStatus} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {savingStatus ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Vendor rates & tiers</h3>
                    {rates.length === 0 && !addingRate && (
                      <p className="text-sm text-gray-500 mb-2">No vendor rates yet. Add one to define default rate, MOQ, and price tiers.</p>
                    )}
                    {rates.map((rate) => (
                      <div key={rate.id} className="border border-gray-200 rounded-lg p-4 mb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{rate.vendor_name || rate.vendor_code || `Vendor #${rate.vendor_id}`}</p>
                            <p className="text-xs text-gray-500">Default: {rate.default_rate != null ? formatPrice(rate.default_rate) : '—'} · MOQ: {rate.default_moq ?? '—'}</p>
                          </div>
                          <button onClick={() => handleDeleteRate(rate.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                        </div>
                        <div className="mt-2 space-y-1">
                          {rate.tiers.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                              <span>MOQ {t.moq_min}{t.moq_max != null ? `–${t.moq_max}` : '+'}</span>
                              <span className="font-medium">{formatPrice(t.price_per_unit)}</span>
                            </div>
                          ))}
                          {addingTierForRateId === rate.id ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input type="number" placeholder="MOQ min" value={newTierMoqMin} onChange={(e) => setNewTierMoqMin(e.target.value)} className="w-20 border rounded px-2 py-1 text-sm" />
                              <input type="number" placeholder="MOQ max" value={newTierMoqMax} onChange={(e) => setNewTierMoqMax(e.target.value)} className="w-20 border rounded px-2 py-1 text-sm" />
                              <input type="number" step="0.01" placeholder="Price" value={newTierPrice} onChange={(e) => setNewTierPrice(e.target.value)} className="w-24 border rounded px-2 py-1 text-sm" />
                              <button onClick={() => handleAddTier(rate.id)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">Add</button>
                              <button onClick={() => { setAddingTierForRateId(null); setNewTierMoqMin(''); setNewTierMoqMax(''); setNewTierPrice(''); }} className="text-xs text-gray-500 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setAddingTierForRateId(rate.id)} className="text-xs text-blue-600 hover:underline mt-1">+ Add tier</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {addingRate ? (
                      <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-2">
                        <select value={newRateVendorId} onChange={(e) => setNewRateVendorId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                          <option value="">Select vendor…</option>
                          {availableVendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.name || v.id}</option>
                          ))}
                        </select>
                        <input type="number" step="0.01" placeholder="Default rate" value={newRateDefaultRate} onChange={(e) => setNewRateDefaultRate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                        <input type="number" placeholder="Default MOQ" value={newRateDefaultMoq} onChange={(e) => setNewRateDefaultMoq(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                        <div className="flex gap-2">
                          <button onClick={handleAddRate} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Add rate</button>
                          <button onClick={() => { setAddingRate(false); setNewRateVendorId(''); setNewRateDefaultRate(''); setNewRateDefaultMoq(''); }} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingRate(true)} className="text-sm text-blue-600 hover:underline">+ Add vendor rate</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsList;
