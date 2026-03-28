import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import {
  fetchPriceListPage,
  createItemList,
  createItemListRate,
  createItemListTier,
  updateItemListRate,
  deleteItemListRate,
  updateItemListTier,
  deleteItemListTier,
  type PriceListItemPage,
  type ItemListTierRow,
} from '../services/itemsList.service';
import { fetchVendorClients } from '../services/vendorClient.service';
import { fetchPRProducts, type PRProductListItem } from '../services/productsMaster.service';
import type { VendorClientRecord } from '../services/vendorClient.service';
import {
  formatStagedPaymentTermsSummary,
  parseStagedPaymentTerms,
  serializeStagedPaymentTerms,
  validateStagedPercents,
} from '../lib/stagedPaymentTerms';

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rm' | 'pm' | 'pr'>('rm');
  const [showAddTierModal, setShowAddTierModal] = useState(false);

  const [tierTarget, setTierTarget] = useState<PriceListItemPage | null>(null);
  const [resolvedItemsListId, setResolvedItemsListId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorClientRecord | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [priceTiers, setPriceTiers] = useState<PriceTierRow[]>(EMPTY_TIERS);
  const [submittingTiers, setSubmittingTiers] = useState(false);
  const [addPriceListMode, setAddPriceListMode] = useState(false);
  const [addPriceListCombinedItems, setAddPriceListCombinedItems] = useState<PriceListItemPage[]>([]);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [vendorFilterId, setVendorFilterId] = useState<string>('');
  const [advancePctStr, setAdvancePctStr] = useState('');
  const [preShipmentPctStr, setPreShipmentPctStr] = useState('');
  const [postShipmentPctStr, setPostShipmentPctStr] = useState('');
  const [creditDaysStr, setCreditDaysStr] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');

  // Edit rate (vendor block) — item + rate for PUT/DELETE
  type RateForEdit = PriceListItemPage['vendorRates'][number];
  const [editingRate, setEditingRate] = useState<{ item: PriceListItemPage; rate: RateForEdit } | null>(null);
  const [editRateCurrency, setEditRateCurrency] = useState('INR');
  const [editAdvancePct, setEditAdvancePct] = useState('');
  const [editPreShipmentPct, setEditPreShipmentPct] = useState('');
  const [editPostShipmentPct, setEditPostShipmentPct] = useState('');
  const [editCreditDays, setEditCreditDays] = useState('');
  const [submittingEditRate, setSubmittingEditRate] = useState(false);

  // Edit tier (single price row) — item + rateId + tier for PUT/DELETE
  const [editingTier, setEditingTier] = useState<{ item: PriceListItemPage; rateId: number; tier: ItemListTierRow } | null>(null);
  const [editTierMoqMin, setEditTierMoqMin] = useState('');
  const [editTierMoqMax, setEditTierMoqMax] = useState('');
  const [editTierPrice, setEditTierPrice] = useState('');
  const [editTierValidTill, setEditTierValidTill] = useState('');
  const [editTierNote, setEditTierNote] = useState('');
  const [submittingEditTier, setSubmittingEditTier] = useState(false);

  const itemsPageQuery = useQuery({
    queryKey: ['items-list-pageitems', activeTab],
    enabled: activeTab === 'rm' || activeTab === 'pm',
    queryFn: async (): Promise<PriceListItemPage[]> => {
      const res = await fetchPriceListPage(activeTab.toUpperCase() as 'RM' | 'PM');
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load items list');
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const prProductsQuery = useQuery({
    queryKey: ['items-list-pr-products'],
    enabled: activeTab === 'pr',
    queryFn: async (): Promise<PRProductListItem[]> => {
      const res = await fetchPRProducts();
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load PR products');
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const vendorsQuery = useQuery({
    queryKey: ['items-list-vendors', 'vendor'],
    queryFn: async (): Promise<VendorClientRecord[]> => {
      const res = await fetchVendorClients('vendor');
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load vendors');
      return res.data as VendorClientRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const pageItems: PriceListItemPage[] =
    activeTab === 'rm' || activeTab === 'pm' ? (itemsPageQuery.data ?? []) : [];
  const products: PRProductListItem[] = activeTab === 'pr' ? (prProductsQuery.data ?? []) : [];
  const vendors: VendorClientRecord[] = vendorsQuery.data ?? [];
  const loading = vendorsQuery.isLoading || (activeTab === 'pr' ? prProductsQuery.isLoading : itemsPageQuery.isLoading);

  const filteredPageItems = useMemo(() => {
    if (activeTab !== 'rm' && activeTab !== 'pm') return pageItems;
    if (!vendorFilterId) return pageItems;
    const vid = vendorFilterId;
    return pageItems.filter((item) =>
      item.vendorRates?.some((r) => String(r.vendor_id) === vid)
    );
  }, [activeTab, pageItems, vendorFilterId]);

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

  useEffect(() => {
    if (!showAddTierModal || !addPriceListMode || tierTarget) {
      setAddPriceListCombinedItems([]);
      return;
    }
    let cancelled = false;
    setLoadingCombined(true);
    Promise.all([
      fetchPriceListPage('RM'),
      fetchPriceListPage('PM'),
      fetchPriceListPage('PR'),
    ]).then(([rRes, pRes, prRes]) => {
      if (cancelled) return;
      const rm = rRes.success && rRes.data ? rRes.data : [];
      const pm = pRes.success && pRes.data ? pRes.data : [];
      const pr = prRes.success && prRes.data ? prRes.data : [];
      setAddPriceListCombinedItems([...rm, ...pm, ...pr]);
      setLoadingCombined(false);
    }).catch(() => {
      if (!cancelled) setLoadingCombined(false);
    });
    return () => { cancelled = true; };
  }, [showAddTierModal, addPriceListMode, tierTarget]);

  const openAddTier = (item: PriceListItemPage) => {
    setTierTarget(item);
    setResolvedItemsListId(item.itemsListId != null ? String(item.itemsListId) : null);
    setSelectedVendor(null);
    setCurrency('INR');
    setAdvancePctStr('');
    setPreShipmentPctStr('');
    setPostShipmentPctStr('');
    setCreditDaysStr('');
    setLeadTimeDays('');
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
    setAdvancePctStr('');
    setPreShipmentPctStr('');
    setPostShipmentPctStr('');
    setCreditDaysStr('');
    setLeadTimeDays('');
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
    return addPriceListCombinedItems.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [addPriceListMode, addPriceListCombinedItems, itemSearchQuery]);

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
    const adv = Number(advancePctStr);
    const pre = Number(preShipmentPctStr);
    const post = Number(postShipmentPctStr);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) {
      addToast('error', pctErr);
      return;
    }
    setSubmittingTiers(true);
    try {
      let itemsListId = resolvedItemsListId;
      if (!itemsListId) {
        const payload =
          tierTarget.type === 'RM'
            ? { type: 'RM' as const, raw_material_id: tierTarget.raw_material_id!, pack_material_id: null, product_id: null }
            : tierTarget.type === 'PM'
              ? { type: 'PM' as const, raw_material_id: null, pack_material_id: tierTarget.pack_material_id!, product_id: null }
              : { type: 'PR' as const, raw_material_id: null, pack_material_id: null, product_id: tierTarget.product_id! };
        const createRes = await createItemList(payload);
        if (!createRes.success || !createRes.data) {
          addToast('error', createRes.error?.message ?? 'Failed to add item to list');
          setSubmittingTiers(false);
          return;
        }
        itemsListId = createRes.data.id;
      }
      const staged = serializeStagedPaymentTerms({
        advance_pct: adv,
        pre_shipment_pct: pre,
        post_shipment_pct: post,
        credit_days: creditDaysStr ? Math.max(0, parseInt(creditDaysStr, 10) || 0) : 0,
      });
      const rateRes = await createItemListRate(String(itemsListId), {
        vendor_id: parseInt(selectedVendor.id, 10),
        currency,
        payment_terms: staged,
        lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
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
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          typeof q.queryKey[0] === 'string' &&
          q.queryKey[0].startsWith('items-list'),
        refetchType: 'all',
      });
    } catch (e) {
      addToast('error', 'Failed to save tiers');
    }
    setSubmittingTiers(false);
  };

  /** Refetch all Items List queries (active + inactive) so data from Vendor Master sync appears without a full reload. */
  const refetchPage = () => {
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === 'string' &&
        q.queryKey[0].startsWith('items-list'),
      refetchType: 'all',
    });
  };

  const openEditRate = (item: PriceListItemPage, rate: RateForEdit) => {
    setEditingRate({ item, rate });
    setEditRateCurrency(rate.currency);
    const p = parseStagedPaymentTerms(rate.payment_terms ?? '') ?? {
      advance_pct: 0,
      pre_shipment_pct: 100,
      post_shipment_pct: 0,
      credit_days: 0,
    };
    setEditAdvancePct(String(p.advance_pct));
    setEditPreShipmentPct(String(p.pre_shipment_pct));
    setEditPostShipmentPct(String(p.post_shipment_pct));
    setEditCreditDays(String(p.credit_days ?? 0));
  };

  const openEditTier = (item: PriceListItemPage, rateId: number, tier: ItemListTierRow) => {
    setEditingTier({ item, rateId, tier });
    setEditTierMoqMin(String(tier.moq_min));
    setEditTierMoqMax(tier.moq_max != null ? String(tier.moq_max) : '');
    setEditTierPrice(String(tier.price_per_unit));
    setEditTierValidTill(tier.valid_till ?? '');
    setEditTierNote(tier.note ?? '');
  };

  const handleUpdateRate = async () => {
    if (!editingRate || editingRate.item.itemsListId == null) return;
    setSubmittingEditRate(true);
    const adv = Number(editAdvancePct);
    const pre = Number(editPreShipmentPct);
    const post = Number(editPostShipmentPct);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) {
      addToast('error', pctErr);
      setSubmittingEditRate(false);
      return;
    }
    const staged = serializeStagedPaymentTerms({
      advance_pct: adv,
      pre_shipment_pct: pre,
      post_shipment_pct: post,
      credit_days: editCreditDays ? Math.max(0, parseInt(editCreditDays, 10) || 0) : 0,
    });
    const res = await updateItemListRate(String(editingRate.item.itemsListId), editingRate.rate.id, {
      currency: editRateCurrency,
      payment_terms: staged,
    });
    setSubmittingEditRate(false);
    if (res.success) {
      addToast('success', 'Vendor rate updated');
      setEditingRate(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to update rate');
    }
  };

  const handleDeleteRate = async () => {
    if (!editingRate || editingRate.item.itemsListId == null) return;
    if (!window.confirm(`Remove this vendor's rate and all its tiers for ${editingRate.item.name}?`)) return;
    setSubmittingEditRate(true);
    const res = await deleteItemListRate(String(editingRate.item.itemsListId), editingRate.rate.id);
    setSubmittingEditRate(false);
    if (res.success) {
      addToast('success', 'Vendor rate removed');
      setEditingRate(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to delete rate');
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier || editingTier.item.itemsListId == null) return;
    const moqMin = parseInt(editTierMoqMin, 10);
    const price = parseFloat(editTierPrice);
    if (Number.isNaN(moqMin) || Number.isNaN(price)) {
      addToast('error', 'MOQ and price are required');
      return;
    }
    setSubmittingEditTier(true);
    const res = await updateItemListTier(
      String(editingTier.item.itemsListId),
      editingTier.rateId,
      editingTier.tier.id,
      {
        moq_min: moqMin,
        moq_max: editTierMoqMax ? parseInt(editTierMoqMax, 10) : null,
        price_per_unit: price,
        valid_till: editTierValidTill || null,
        note: editTierNote || null,
      }
    );
    setSubmittingEditTier(false);
    if (res.success) {
      addToast('success', 'Tier updated');
      setEditingTier(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to update tier');
    }
  };

  const handleDeleteTier = async () => {
    if (!editingTier || editingTier.item.itemsListId == null) return;
    if (!window.confirm('Remove this price tier?')) return;
    setSubmittingEditTier(true);
    const res = await deleteItemListTier(
      String(editingTier.item.itemsListId),
      editingTier.rateId,
      editingTier.tier.id
    );
    setSubmittingEditTier(false);
    if (res.success) {
      addToast('success', 'Tier removed');
      setEditingTier(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to delete tier');
    }
  };

  const deleteTierFromRow = async (item: PriceListItemPage, rateId: number, tier: ItemListTierRow) => {
    if (item.itemsListId == null) return;
    if (!window.confirm('Remove this price tier?')) return;
    const res = await deleteItemListTier(String(item.itemsListId), rateId, tier.id);
    if (res.success) {
      addToast('success', 'Tier removed');
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to delete tier');
    }
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
          <div className="flex items-center gap-3 flex-wrap">
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
            {(activeTab === 'rm' || activeTab === 'pm') && (
              <div className="flex items-center gap-2">
                <label htmlFor="items-list-vendor-filter" className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Filter by vendor
                </label>
                <select
                  id="items-list-vendor-filter"
                  value={vendorFilterId}
                  onChange={(e) => setVendorFilterId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 bg-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name ?? v.id}
                    </option>
                  ))}
                </select>
                {vendorFilterId ? (
                  <span className="text-[11px] text-amber-800 max-w-[220px] leading-snug">
                    Only rows with a rate for this vendor are shown. Choose &quot;All vendors&quot; to see every RM/PM line.
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <button
            onClick={openAddPriceList}
            className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
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
            {filteredPageItems.map((item) => {
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
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div>
                          <span className="text-xs font-bold text-blue-600">{rate.vendor_name ?? 'Vendor'}</span>
                          {rate.vendor_code && <span className="text-[10.5px] text-gray-400 ml-1.5">({rate.vendor_code})</span>}
                          {(rate.payment_terms && formatStagedPaymentTermsSummary(rate.payment_terms)) ? (
                            <span className="text-[10.5px] text-gray-500 ml-1.5">· {formatStagedPaymentTermsSummary(rate.payment_terms)}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400">{rate.currency}</span>
                          {item.itemsListId != null && (
                            <button
                              type="button"
                              onClick={() => openEditRate(item, rate)}
                              className="px-2 py-1 rounded border border-gray-300 bg-white text-[10.5px] font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Edit rate
                            </button>
                          )}
                        </div>
                      </div>
                      <table className="w-full text-sm border-collapse mt-2">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">MOQ {isRm ? '(KG)' : '(pcs)'}</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Price {isRm ? '/ KG' : '/ pc'}</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Valid Till</th>
                            <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Note</th>
                            {item.itemsListId != null && <th className="text-right py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Actions</th>}
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
                              {item.itemsListId != null && (
                                <td className="py-1.5 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => openEditTier(item, rate.id, t)}
                                    className="text-[10.5px] text-teal-600 hover:underline mr-2"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTierFromRow(item, rate.id, t)}
                                    className="text-[10.5px] text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
            {filteredPageItems.length === 0 && (
              <p className="text-gray-500 py-8 text-center">
                {pageItems.length === 0 ? 'No items' : 'No items with rates for the selected vendor.'}
              </p>
            )}
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
                    Select RM, PM, or Product *
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
                    {loadingCombined ? (
                      <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading RM, PM &amp; products…</div>
                    ) : filteredItemsForSelection.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-gray-400 text-center">No items found</div>
                    ) : (
                      filteredItemsForSelection.slice(0, 80).map((item) => (
                        <button
                          key={item.type === 'PR' ? `PR-${item.product_id}` : item.code}
                          type="button"
                          onClick={() => selectItemForPriceList(item)}
                          className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-[10.5px] shrink-0 ${item.type === 'RM' ? 'text-teal-600' : item.type === 'PM' ? 'text-violet-600' : 'text-amber-600'}`}>{item.code}</span>
                            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">({item.type})</span>
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
                  <span className={`font-mono text-[10.5px] ${tierTarget.type === 'RM' ? 'text-teal-600' : tierTarget.type === 'PM' ? 'text-violet-600' : 'text-amber-600'}`}>{tierTarget.code}</span>
                  <span className="text-sm font-bold text-gray-900">{tierTarget.name}</span>
                  <span className="text-[10px] text-gray-500">({tierTarget.type})</span>
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
                <div className="col-span-2 space-y-2">
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">
                    Payment terms (% of order value)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Advance (on order), pre-shipment, and post-shipment must total at most 100%. These apply to website checkout and My Orders.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500">Advance %</span>
                      <input type="number" min={0} max={100} value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500">Pre-shipment %</span>
                      <input type="number" min={0} max={100} value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500">Post-shipment %</span>
                      <input type="number" min={0} max={100} value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500">Credit days</span>
                      <input type="number" min={0} value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Lead time (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className="w-full max-w-xs px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Applies to this vendor rate (all tiers added below).</p>
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

      {/* Edit vendor rate modal */}
      {editingRate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-4">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                Edit rate — {editingRate.rate.vendor_name ?? 'Vendor'} · {editingRate.item.name}
              </span>
              <button onClick={() => setEditingRate(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Currency</label>
                <select value={editRateCurrency} onChange={(e) => setEditRateCurrency(e.target.value)} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Payment terms (%)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} max={100} value={editAdvancePct} onChange={(e) => setEditAdvancePct(e.target.value)} className="px-2 py-1.5 border rounded text-sm" placeholder="Advance" />
                  <input type="number" min={0} max={100} value={editPreShipmentPct} onChange={(e) => setEditPreShipmentPct(e.target.value)} className="px-2 py-1.5 border rounded text-sm" placeholder="Pre-shipment" />
                  <input type="number" min={0} max={100} value={editPostShipmentPct} onChange={(e) => setEditPostShipmentPct(e.target.value)} className="px-2 py-1.5 border rounded text-sm" placeholder="Post-shipment" />
                  <input type="number" min={0} value={editCreditDays} onChange={(e) => setEditCreditDays(e.target.value)} className="px-2 py-1.5 border rounded text-sm" placeholder="Credit days" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-2 justify-between">
              <button
                type="button"
                onClick={handleDeleteRate}
                disabled={submittingEditRate}
                className="px-3 py-2 rounded-lg border border-red-300 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
              >
                Delete rate & tiers
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingRate(null)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleUpdateRate} disabled={submittingEditRate} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
                  {submittingEditRate ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit tier modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-4">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Edit tier — {editingTier.item.name}</span>
              <button onClick={() => setEditingTier(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">MOQ min</label>
                  <input type="number" min={1} value={editTierMoqMin} onChange={(e) => setEditTierMoqMin(e.target.value)} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">MOQ max (optional)</label>
                  <input type="number" min={1} value={editTierMoqMax} onChange={(e) => setEditTierMoqMax(e.target.value)} placeholder="—" className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Price per unit</label>
                <input type="number" step="0.01" value={editTierPrice} onChange={(e) => setEditTierPrice(e.target.value)} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Valid till</label>
                <input type="date" value={editTierValidTill} onChange={(e) => setEditTierValidTill(e.target.value)} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">Note</label>
                <input type="text" value={editTierNote} onChange={(e) => setEditTierNote(e.target.value)} placeholder="Optional" className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-2 justify-between">
              <button
                type="button"
                onClick={handleDeleteTier}
                disabled={submittingEditTier}
                className="px-3 py-2 rounded-lg border border-red-300 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
              >
                Delete tier
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingTier(null)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleUpdateTier} disabled={submittingEditTier} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
                  {submittingEditTier ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsList;
