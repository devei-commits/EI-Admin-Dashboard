import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchPriceListPage,
  createItemList,
  createItemListRate,
  createItemListTier,
  type PriceListItemPage,
} from '../services/itemsList.service';
import { fetchVendorClients } from '../services/vendorClient.service';
import { fetchPRProducts, type PRProductListItem } from '../services/productsMaster.service';
import type { VendorClientRecord } from '../services/vendorClient.service';

interface PriceTierRow {
  id?: string;
  moq: string;
  price: string;
  validTill: string;
  note: string;
}

const EMPTY_TIERS: PriceTierRow[] = [
  { id: '1', moq: '', price: '', validTill: '', note: '' },
  { id: '2', moq: '', price: '', validTill: '', note: '' },
  { id: '3', moq: '', price: '', validTill: '', note: '' },
  { id: '4', moq: '', price: '', validTill: '', note: '' },
];

const ItemsList: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'rm' | 'pm' | 'pr'>('rm');
  const [pageItems, setPageItems] = useState<PriceListItemPage[]>([]);
  const [products, setProducts] = useState<PRProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorClientRecord[]>([]);

  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [tierTarget, setTierTarget] = useState<PriceListItemPage | null>(null);
  const [resolvedItemsListId, setResolvedItemsListId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorClientRecord | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [priceTiers, setPriceTiers] = useState<PriceTierRow[]>(EMPTY_TIERS);
  const [submittingTiers, setSubmittingTiers] = useState(false);
  const [addPriceListMode, setAddPriceListMode] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (activeTab === 'rm' || activeTab === 'pm') {
      fetchPriceListPage(activeTab.toUpperCase() as 'RM' | 'PM').then((res) => {
        if (cancelled) return;
        setPageItems(res.success && res.data ? res.data : []);
        setLoading(false);
      });
    } else {
      fetchPRProducts().then((res) => {
        if (cancelled) return;
        setProducts(res.success && res.data ? res.data : []);
        setLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    fetchVendorClients('vendor').then((r) => {
      setVendors(r.success && r.data ? r.data : []);
    });
  }, []);

  const stats = useMemo(() => {
    const withTiers = pageItems.filter((i) => i.vendorRates && i.vendorRates.length > 0).length;
    const totalRates = pageItems.reduce((s, i) => s + (i.vendorRates?.length ?? 0), 0);
    const totalTiers = pageItems.reduce(
      (s, i) => s + (i.vendorRates?.reduce((ss, v) => ss + (v.tiers?.length ?? 0), 0) ?? 0),
      0
    );
    return {
      rmWithTiers: pageItems.filter((i) => i.type === 'RM' && (i.vendorRates?.length ?? 0) > 0).length,
      pmWithTiers: pageItems.filter((i) => i.type === 'PM' && (i.vendorRates?.length ?? 0) > 0).length,
      totalVendorRates: totalRates,
      totalTiers,
    };
  }, [pageItems]);

  const formatPrice = (n: number) => '₹' + (n % 1 !== 0 ? n.toFixed(2) : n.toLocaleString('en-IN'));

  const openAddTier = (item: PriceListItemPage) => {
    setTierTarget(item);
    setResolvedItemsListId(item.itemsListId != null ? String(item.itemsListId) : null);
    setSelectedVendor(null);
    setCurrency('INR');
    setPriceTiers(EMPTY_TIERS);
    setAddPriceListMode(false);
    setItemSearchQuery('');
    setShowAddTierModal(true);
  };

  const openAddPriceList = () => {
    setTierTarget(null);
    setResolvedItemsListId(null);
    setSelectedVendor(null);
    setCurrency('INR');
    setPriceTiers(EMPTY_TIERS);
    setAddPriceListMode(true);
    setItemSearchQuery('');
    setShowAddTierModal(true);
  };

  const selectItemForPriceList = (item: PriceListItemPage) => {
    setTierTarget(item);
    setResolvedItemsListId(item.itemsListId != null ? String(item.itemsListId) : null);
    setItemSearchQuery('');
  };

  const filteredItemsForSelection = useMemo(() => {
    if (!addPriceListMode) return [];
    const q = itemSearchQuery.trim().toLowerCase();
    return pageItems.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [addPriceListMode, pageItems, itemSearchQuery]);

  const handleSaveTiers = async () => {
    if (!tierTarget || !selectedVendor) {
      addToast('error', 'Select a vendor');
      return;
    }
    const valid = priceTiers.filter((t) => t.moq && t.price);
    if (valid.length === 0) {
      addToast('error', 'Add at least one tier with MOQ and Price');
      return;
    }
    setSubmittingTiers(true);
    try {
      let itemsListId = resolvedItemsListId;
      if (!itemsListId) {
        const payload =
          tierTarget.type === 'RM'
            ? { type: 'RM' as const, raw_material_id: tierTarget.raw_material_id!, pack_material_id: null }
            : { type: 'PM' as const, raw_material_id: null, pack_material_id: tierTarget.pack_material_id! };
        const createRes = await createItemList(payload);
        if (!createRes.success || !createRes.data) {
          addToast('error', createRes.error?.message ?? 'Failed to add item to list');
          setSubmittingTiers(false);
          return;
        }
        itemsListId = createRes.data.id;
      }
      const rateRes = await createItemListRate(String(itemsListId), {
        vendor_id: parseInt(selectedVendor.id, 10),
        currency,
      });
      if (!rateRes.success || !rateRes.data) {
        addToast('error', rateRes.error?.message ?? 'Failed to create vendor rate');
        setSubmittingTiers(false);
        return;
      }
      const rateId = rateRes.data.id;
      for (const t of valid) {
        await createItemListTier(String(itemsListId!), rateId, {
          moq_min: parseInt(t.moq, 10) || 1,
          price_per_unit: parseFloat(t.price),
          valid_till: t.validTill || null,
          note: t.note || null,
        });
      }
      addToast('success', `${valid.length} tier(s) added for ${tierTarget.name}`);
      setShowAddTierModal(false);
      setTierTarget(null);
      setAddPriceListMode(false);
      if (activeTab === 'rm' || activeTab === 'pm') {
        const res = await fetchPriceListPage(activeTab.toUpperCase() as 'RM' | 'PM');
        if (res.success && res.data) setPageItems(res.data);
      }
    } catch (e) {
      addToast('error', 'Failed to save tiers');
    }
    setSubmittingTiers(false);
  };

  const vendorIdsUsed = useMemo(() => {
    if (!tierTarget) return new Set<number>();
    return new Set(tierTarget.vendorRates?.map((r) => r.vendor_id) ?? []);
  }, [tierTarget]);
  const availableVendors = useMemo(
    () => vendors.filter((v) => !vendorIdsUsed.has(parseInt(v.id, 10))),
    [vendors, vendorIdsUsed]
  );

  return (
    <div className="min-h-screen bg-[#f9fafb] font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="px-6 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h4 className="text-lg font-bold text-gray-900 mb-1">Price Lists</h4>
          <p className="text-sm text-gray-500">Vendor-wise MOQ-tiered pricing for raw materials and packaging materials.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-teal-500">
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">RM Price Lists</div>
            <div className="text-2xl font-extrabold text-teal-600">{stats.rmWithTiers}</div>
            <div className="text-[11px] text-gray-400 mt-1">Items with tiered pricing</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-violet-500">
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">PM Price Lists</div>
            <div className="text-2xl font-extrabold text-violet-600">{stats.pmWithTiers}</div>
            <div className="text-[11px] text-gray-400 mt-1">Items with MOQ tiers</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-amber-500">
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">Vendor Rates</div>
            <div className="text-2xl font-extrabold text-amber-600">{stats.totalVendorRates}</div>
            <div className="text-[11px] text-gray-400 mt-1">Vendor-item combos</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-blue-500">
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">MOQ Tiers</div>
            <div className="text-2xl font-extrabold text-blue-600">{stats.totalTiers}</div>
            <div className="text-[11px] text-gray-400 mt-1">Total price breaks</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">Price Lists — Vendor & MOQ-wise</span>
            <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {(['rm', 'pm', 'pr'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'rm' ? 'Raw Materials' : tab === 'pm' ? 'Packaging' : 'Products'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openAddPriceList}
            disabled={activeTab === 'pr'}
            className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add Price List
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : activeTab === 'pr' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((p) => (
              <div key={p.product_id} className="bg-white border border-amber-200 rounded-lg p-4">
                <div className="text-sm font-bold text-gray-900 mb-3">{p.product_name}</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg p-2.5 text-center bg-green-50 border border-green-200">
                    <div className="text-[10px] text-gray-500 uppercase">Batch Size</div>
                    <div className="text-sm font-extrabold text-teal-600">{p.batch_size_kg ?? '—'} KG</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center bg-amber-50 border border-amber-200">
                    <div className="text-[10px] text-gray-500 uppercase">MRP</div>
                    <div className="text-sm font-extrabold text-amber-600">₹{p.mrp_price ?? '—'}</div>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-2.5 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sale OH price</span>
                    <span className="font-bold text-amber-600">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fill Size</span>
                    <span className="font-semibold">{p.fill_size ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">License</span>
                    <span className="font-mono text-[10.5px]">{p.product_code ?? '—'}</span>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-gray-500 col-span-2">No products</p>}
          </div>
        ) : (
          <div id="pl-list-body" className="space-y-2.5">
            {pageItems.map((item) => {
              const hasTiers = item.vendorRates && item.vendorRates.length > 0;
              const isRm = item.type === 'RM';
              if (!hasTiers) {
                return (
                  <div key={item.code} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[10.5px] ${isRm ? 'text-teal-600' : 'text-violet-600'}`}>{item.code}</span>
                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                        <span className="font-mono text-xs font-bold text-amber-600">
                          {item.pricePerUnit < 1 ? formatPrice(item.pricePerUnit) : formatPrice(item.pricePerUnit)}
                          {isRm ? '/KG' : '/pc'}
                        </span>
                        <span className="text-[11px] text-gray-400">— List price only, no vendor tiers</span>
                      </div>
                      <button
                        onClick={() => openAddTier(item)}
                        className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        + Add Tiers
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.code} className={`bg-white border rounded-lg overflow-hidden ${isRm ? 'border-teal-100' : 'border-violet-100'}`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isRm ? 'bg-green-50 border-green-200' : 'bg-violet-50 border-violet-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10.5px] ${isRm ? 'text-teal-600' : 'text-violet-600'}`}>{item.code}</span>
                      <span className="text-sm font-bold text-gray-900">{item.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">
                        {isRm ? `${item.uom ?? 'KG'} · GST ${item.gst ?? 0}%` : `${item.pack_type ?? ''} · ${item.level ?? ''}`}
                      </span>
                    </div>
                    <button
                      onClick={() => openAddTier(item)}
                      className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      + Tier
                    </button>
                  </div>
                  {item.vendorRates?.map((rate) => (
                    <div key={rate.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-bold text-blue-600">{rate.vendor_name ?? 'Vendor'}</span>
                          {rate.vendor_code && <span className="text-[10.5px] text-gray-400 ml-1.5">({rate.vendor_code})</span>}
                        </div>
                        <span className="text-[11px] text-gray-400">{rate.currency}</span>
                      </div>
                      <table className="w-full text-sm border-collapse mt-2">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">MOQ {isRm ? '(KG)' : '(pcs)'}</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Price {isRm ? '/ KG' : '/ pc'}</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Valid Till</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rate.tiers?.map((t, ti) => (
                            <tr key={t.id} className={`border-b border-gray-50 ${ti === 0 ? 'bg-green-50/50' : ''}`}>
                              <td className="py-1.5 px-2">
                                <span className={`font-mono text-xs font-bold ${isRm ? 'text-teal-600' : 'text-violet-600'}`}>
                                  {t.moq_min === 1 && t.moq_max == null ? 'List price' : `${t.moq_min}+`}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 font-mono text-sm font-bold text-amber-600">{formatPrice(t.price_per_unit)}</td>
                              <td className="py-1.5 px-2 text-xs text-gray-700">{t.valid_till ?? '—'}</td>
                              <td className="py-1.5 px-2 text-[11px] text-gray-400">{t.note ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
            {pageItems.length === 0 && <p className="text-gray-500 py-8 text-center">No items</p>}
          </div>
        )}
      </div>

      {showAddTierModal && (tierTarget || addPriceListMode) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                {addPriceListMode && !tierTarget ? 'Add Price List — Select Item' : `Add Price Tier — ${tierTarget?.name ?? ''}`}
              </span>
              <button onClick={() => { setShowAddTierModal(false); setAddPriceListMode(false); setTierTarget(null); }} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                X
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Item selector — shown when Add Price List mode and no item selected yet */}
              {addPriceListMode && !tierTarget && (
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">
                    Select {activeTab === 'pm' ? 'Packaging Material' : 'Raw Material'} *
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name or code…"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                    autoFocus
                  />
                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {filteredItemsForSelection.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-gray-400 text-center">No items found</div>
                    ) : (
                      filteredItemsForSelection.slice(0, 50).map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => selectItemForPriceList(item)}
                          className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-[10.5px] shrink-0 ${item.type === 'RM' ? 'text-teal-600' : 'text-violet-600'}`}>{item.code}</span>
                            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                          </div>
                          {item.vendorRates && item.vendorRates.length > 0 ? (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                              {item.vendorRates.length} vendor{item.vendorRates.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 shrink-0">No pricing</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Selected item chip in Add Price List mode */}
              {addPriceListMode && tierTarget && (
                <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <span className={`font-mono text-[10.5px] ${tierTarget.type === 'RM' ? 'text-teal-600' : 'text-violet-600'}`}>{tierTarget.code}</span>
                  <span className="text-sm font-bold text-gray-900">{tierTarget.name}</span>
                  <button
                    type="button"
                    onClick={() => { setTierTarget(null); setResolvedItemsListId(null); }}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Vendor & tier form — shown when item is selected */}
              {tierTarget && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Vendor *</label>
                  <select
                    value={selectedVendor?.id ?? ''}
                    onChange={(e) => setSelectedVendor(vendors.find((v) => v.id === e.target.value) ?? null)}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select…</option>
                    {availableVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name ?? v.id}</option>
                    ))}
                  </select>
                  {availableVendors.length === 0 && tierTarget.vendorRates?.length && (
                    <p className="text-xs text-amber-600 mt-1">All vendors have rates for this item</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase mb-2">Price Tiers</div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-1.5 px-2 text-[10.5px] font-bold text-gray-500">MOQ</th>
                      <th className="text-left py-1.5 px-2 text-[10.5px] font-bold text-gray-500">Price</th>
                      <th className="text-left py-1.5 px-2 text-[10.5px] font-bold text-gray-500">Valid Till</th>
                      <th className="text-left py-1.5 px-2 text-[10.5px] font-bold text-gray-500">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceTiers.map((t, idx) => (
                      <tr key={t.id} className="border-b border-gray-100">
                        <td className="p-1">
                          <input
                            type="number"
                            placeholder={idx === 0 ? '1' : 'MOQ'}
                            value={t.moq}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, moq: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            value={t.price}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="date"
                            value={t.validTill}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, validTill: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="Note"
                            value={t.note}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, note: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>)}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-2 justify-end">
              <button onClick={() => { setShowAddTierModal(false); setAddPriceListMode(false); setTierTarget(null); }} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              {tierTarget && (
                <button
                  onClick={handleSaveTiers}
                  disabled={submittingTiers || !selectedVendor}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingTiers ? 'Saving…' : 'Save Tiers'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsList;
