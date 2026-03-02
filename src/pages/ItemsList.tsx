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

interface PriceTier {
  id?: string;
  moq: string;
  price: string;
  validTill: string;
  note: string;
}

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
  const [activeTab, setActiveTab] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'price'>('code');
  const [sortAsc, setSortAsc] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [addItemForm, setAddItemForm] = useState<{ type: 'RM' | 'PM'; raw_material_id: string; pack_material_id: string }>({ type: 'RM', raw_material_id: '', pack_material_id: '' });
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [vendors, setVendors] = useState<VendorClientRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemListDetailRecord | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [rates, setRates] = useState<ItemListVendorRateRow[]>([]);
  const [addItemSubmitting, setAddItemSubmitting] = useState(false);

  // Add Tier Modal State
  const [selectedVendorForTier, setSelectedVendorForTier] = useState<VendorClientRecord | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([
    { id: '1', moq: '', price: '', validTill: '', note: '' },
    { id: '2', moq: '', price: '', validTill: '', note: '' },
    { id: '3', moq: '', price: '', validTill: '', note: '' },
    { id: '4', moq: '', price: '', validTill: '', note: '' },
  ]);
  const [submittingTiers, setSubmittingTiers] = useState(false);

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
        const matchType = activeTab === 'All' || item.type === activeTab;
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
  }, [itemLists, activeTab, searchQuery, sortBy, sortAsc]);

  const stats = useMemo(() => {
    const rmItems = itemLists.filter((i) => i.type === 'RM').length;
    const pmItems = itemLists.filter((i) => i.type === 'PM').length;
    const totalVendorRates = itemLists.reduce((sum, item) => sum + item.vendors, 0);
    const totalTiers = itemLists.reduce((sum, item) => sum + item.tiers, 0);
    return { rmItems, pmItems, totalVendorRates, totalTiers };
  }, [itemLists]);

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

  const openAddTierModal = (item: ItemListRecord) => {
    setSelectedItem(null);
    openSidebar(item).then(() => {
      setShowAddTierModal(true);
      setPriceTiers([
        { id: '1', moq: '', price: '', validTill: '', note: '' },
        { id: '2', moq: '', price: '', validTill: '', note: '' },
        { id: '3', moq: '', price: '', validTill: '', note: '' },
        { id: '4', moq: '', price: '', validTill: '', note: '' },
      ]);
      setSelectedVendorForTier(null);
      setSelectedCurrency('INR');
    });
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

  const handleAddTiers = async () => {
    if (!selectedItem || !selectedVendorForTier) {
      addToast('error', 'Select a vendor');
      return;
    }

    const validTiers = priceTiers.filter((t) => t.moq && t.price);
    if (validTiers.length === 0) {
      addToast('error', 'Add at least one tier with MOQ and Price');
      return;
    }

    setSubmittingTiers(true);
    try {
      // First, check if vendor rate exists
      let existingRate = rates.find((r) => r.vendor_id === parseInt(selectedVendorForTier.id, 10));

      if (!existingRate) {
        // Create vendor rate first
        const rateRes = await createItemListRate(selectedItem.id, {
          vendor_id: parseInt(selectedVendorForTier.id, 10),
          default_rate: null,
          default_moq: null,
        });

        if (!rateRes.success || !rateRes.data) {
          addToast('error', rateRes.error?.message ?? 'Failed to create vendor rate');
          setSubmittingTiers(false);
          return;
        }
        existingRate = rateRes.data;
      }

      // Add all tiers
      let successCount = 0;
      for (const tier of validTiers) {
        if (!tier.moq || !tier.price) continue;

        const tierRes = await createItemListTier(selectedItem.id, existingRate.id, {
          moq_min: parseInt(tier.moq, 10),
          moq_max: tier.moq ? parseInt(tier.moq, 10) : null,
          price_per_unit: parseFloat(tier.price),
        });

        if (tierRes.success) {
          successCount++;
        }
      }

      // Refetch rates to show new tiers
      const updatedRates = await fetchItemListRates(selectedItem.id);
      if (updatedRates.success && updatedRates.data) {
        setRates(updatedRates.data);
        setSelectedItem((prev) => (prev ? { ...prev, vendorRates: updatedRates.data! } : null));
      }

      addToast('success', `${successCount} tier(s) added successfully`);
      setShowAddTierModal(false);
      setPriceTiers([
        { id: '1', moq: '', price: '', validTill: '', note: '' },
        { id: '2', moq: '', price: '', validTill: '', note: '' },
        { id: '3', moq: '', price: '', validTill: '', note: '' },
        { id: '4', moq: '', price: '', validTill: '', note: '' },
      ]);
      setSelectedVendorForTier(null);
    } catch (err) {
      addToast('error', 'Failed to add tiers');
    }
    setSubmittingTiers(false);
  };

  const handleAddItem = async () => {
    if (addItemForm.type === 'RM') {
      if (!addItemForm.raw_material_id) {
        addToast('error', 'Select a raw material');
        return;
      }
    } else {
      if (!addItemForm.pack_material_id) {
        addToast('error', 'Select a pack material');
        return;
      }
    }
    setAddItemSubmitting(true);
    const payload =
      addItemForm.type === 'RM'
        ? { type: 'RM' as const, raw_material_id: parseInt(addItemForm.raw_material_id, 10), pack_material_id: null }
        : { type: 'PM' as const, raw_material_id: null, pack_material_id: parseInt(addItemForm.pack_material_id, 10) };
    const res = await createItemList(payload);
    setAddItemSubmitting(false);
    if (res.success && res.data) {
      setItemLists((prev) => [...prev, res.data!]);
      setShowAddItemModal(false);
      setAddItemForm({ type: 'RM', raw_material_id: '', pack_material_id: '' });
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
  const availableVendorsForTier = useMemo(() => vendors.filter((v) => !vendorsAlreadyUsed.has(parseInt(v.id, 10))), [vendors, vendorsAlreadyUsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">💰</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">Pricing Tiers</span>
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Price Lists</h1>
            <p className="text-sm text-gray-600">Vendor-wise MOQ-tiered pricing for raw materials and packaging materials.</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
            <div className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">RM Price Lists</p>
              <p className="text-4xl font-extrabold mt-2 text-teal-600 group-hover:scale-110 transition-transform origin-left">{stats.rmItems}</p>
              <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">Items with tiered pricing</p>
            </div>
          </div>
          <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-400 to-violet-600" />
            <div className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">PM Price Lists</p>
              <p className="text-4xl font-extrabold mt-2 text-violet-600 group-hover:scale-110 transition-transform origin-left">{stats.pmItems}</p>
              <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">Items with MOQ tiers</p>
            </div>
          </div>
          <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
            <div className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">Vendor Rates</p>
              <p className="text-4xl font-extrabold mt-2 text-orange-600 group-hover:scale-110 transition-transform origin-left">{stats.totalVendorRates}</p>
              <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">Vendor-item combos</p>
            </div>
          </div>
          <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-400 to-cyan-600" />
            <div className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">MOQ Tiers</p>
              <p className="text-4xl font-extrabold mt-2 text-cyan-600 group-hover:scale-110 transition-transform origin-left">{stats.totalTiers}</p>
              <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">Total price breaks</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Price Lists — Vendor & MOQ-wise</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200/50">
                {filtered.length} / {itemLists.length}
              </span>
            </div>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
            >
              <span className="text-base leading-none">+</span> Add Price List
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-white">
            {(['All', 'Raw Materials', 'Packaging', 'Products'] as const).map((label, idx) => {
              const tabValue = idx === 0 ? 'All' : idx === 1 ? 'RM' : 'PM';
              return (
                <button
                  key={label}
                  onClick={() => setActiveTab(tabValue as 'All' | 'RM' | 'PM')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    (tabValue === 'All' ? activeTab === 'All' : activeTab === tabValue)
                      ? 'bg-teal-100 text-teal-700 border border-teal-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="relative group flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item…"
                className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all w-full"
              />
            </div>
          </div>

          {/* Items List */}
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
            <div className="divide-y divide-gray-100">
              {filtered.map((item) => {
                const colors = CATEGORY_COLORS[item.category] || { bg: 'bg-gray-100', text: 'text-gray-600', badge: 'bg-gray-100' };
                return (
                  <div key={item.id} className="p-5 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-transparent transition-colors group">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-teal-600 group-hover:text-teal-700">{item.code}</span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.badge}`}>{item.category}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.type === 'RM' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'}`}>{item.type}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1.5 group-hover:text-teal-700 transition-colors">{item.name}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                          item.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {item.status === 'Active' ? '✓ ' : ''}{item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs mb-4">
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Price/Unit</p>
                        <p className="font-bold text-amber-600 group-hover:text-amber-700">{formatPrice(item.pricePerUnit)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">UOM</p>
                        <p className="text-gray-700 font-semibold">{item.uom}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Vendors</p>
                        <p className={`font-bold ${item.vendors > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                          {item.vendors > 0 ? `${item.vendors}` : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-0.5">Tiers</p>
                        <p className={`font-bold ${item.tiers > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {item.tiers > 0 ? `${item.tiers}` : '0'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-400 font-medium mb-0.5">Updated</p>
                        <p className="text-gray-600">{item.lastUpdated || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button 
                        onClick={() => openAddTierModal(item)}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded transition-colors"
                      >
                        + Add Tier
                      </button>
                      <button 
                        onClick={() => openSidebar(item)} 
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors"
                      >
                        ⚙️ Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Price Tier Modal */}
      {showAddTierModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddTierModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add Price Tier — {selectedItem.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedItem.code}</p>
              </div>
              <button 
                onClick={() => setShowAddTierModal(false)} 
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">VENDOR NAME *</label>
                <select
                  value={selectedVendorForTier?.id || ''}
                  onChange={(e) => {
                    const vendor = vendors.find((v) => v.id === e.target.value);
                    setSelectedVendorForTier(vendor || null);
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">Select vendor…</option>
                  {availableVendorsForTier.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.id}
                    </option>
                  ))}
                </select>
                {availableVendorsForTier.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">All vendors already have rates for this item</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">CURRENCY</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-3">PRICE TIERS</label>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-700">MOQ</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Price</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Valid Till</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {priceTiers.map((tier, idx) => (
                      <tr key={tier.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            placeholder="1"
                            value={tier.moq}
                            onChange={(e) => {
                              const updated = [...priceTiers];
                              updated[idx] = { ...updated[idx], moq: e.target.value };
                              setPriceTiers(updated);
                            }}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={tier.price}
                            onChange={(e) => {
                              const updated = [...priceTiers];
                              updated[idx] = { ...updated[idx], price: e.target.value };
                              setPriceTiers(updated);
                            }}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="date"
                            value={tier.validTill}
                            onChange={(e) => {
                              const updated = [...priceTiers];
                              updated[idx] = { ...updated[idx], validTill: e.target.value };
                              setPriceTiers(updated);
                            }}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            placeholder="Note"
                            value={tier.note}
                            onChange={(e) => {
                              const updated = [...priceTiers];
                              updated[idx] = { ...updated[idx], note: e.target.value };
                              setPriceTiers(updated);
                            }}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowAddTierModal(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTiers}
                disabled={submittingTiers || !selectedVendorForTier}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submittingTiers ? 'Saving Tiers…' : 'Save Tiers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddItemModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Item to List</h2>
            <p className="text-sm text-gray-600">Select a raw material or pack material to add to the price list.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddItemForm((f) => ({ ...f, type: 'RM', pack_material_id: '' }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 transition-colors ${addItemForm.type === 'RM' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Raw Material
                </button>
                <button
                  type="button"
                  onClick={() => setAddItemForm((f) => ({ ...f, type: 'PM', raw_material_id: '' }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 transition-colors ${addItemForm.type === 'PM' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Pack Material
                </button>
              </div>
            </div>
            {addItemForm.type === 'RM' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Raw Material</label>
                <select
                  value={addItemForm.raw_material_id}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, raw_material_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                <label className="block text-xs font-semibold text-gray-700 mb-2">Pack Material</label>
                <select
                  value={addItemForm.pack_material_id}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, pack_material_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
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
              <button type="button" onClick={() => setShowAddItemModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleAddItem} disabled={addItemSubmitting} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {addItemSubmitting ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar: Manage Vendor Rates */}
      {selectedItem && !showAddTierModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col max-h-screen overflow-hidden">
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedItem.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedItem.code} · {selectedItem.type}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      <button onClick={handleSaveStatus} disabled={savingStatus} className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                        {savingStatus ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Vendor Rates & Tiers</h3>
                    {rates.length === 0 && (
                      <p className="text-sm text-gray-500 mb-3">No vendor rates yet. Use the "Add Tier" button to add vendor pricing.</p>
                    )}
                    {rates.map((rate) => (
                      <div key={rate.id} className="border border-gray-200 rounded-lg p-4 mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-gray-900">{rate.vendor_name || rate.vendor_code || `Vendor #${rate.vendor_id}`}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Default: {rate.default_rate != null ? formatPrice(rate.default_rate) : '—'} · MOQ: {rate.default_moq ?? '—'}</p>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs text-gray-700">
                          {rate.tiers.map((t) => (
                            <div key={t.id} className="flex items-center justify-between">
                              <span>MOQ {t.moq_min}{t.moq_max != null ? `–${t.moq_max}` : '+'}</span>
                              <span className="font-medium">{formatPrice(t.price_per_unit)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
