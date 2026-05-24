import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { parseMoqInput } from '../utils/moqQuantity';
import {
  fetchPriceListPage,
  fetchPriceListPagePaginated,
  fetchPriceListPageStats,
  createItemList,
  createItemListRate,
  createItemListTier,
  updateItemListRate,
  deleteItemListRate,
  updateItemListTier,
  deleteItemListTier,
  importVendorPricingExcel,
  importMasterCategoriesExcel,
  type PriceListItemPage,
  type ItemListTierRow,
} from '../services/itemsList.service';
import { fetchVendorClients, fetchVendorClientById } from '../services/vendorClient.service';
import type { VendorClientRecord } from '../services/vendorClient.service';
import { Pagination } from '../components/ui/Pagination';
import VendorClientNameTypeahead from '../components/VendorClientNameTypeahead';
import {
  formatStagedPaymentTermsSummary,
  parseStagedPaymentTerms,
  resolveStagedPaymentTermsFromVendorRecord,
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

const PAGE_SIZE = 25;

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
  /** Vendor (RM/PM) or client (PR) master row from vendor_clients */
  const [selectedParty, setSelectedParty] = useState<VendorClientRecord | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [priceTiers, setPriceTiers] = useState<PriceTierRow[]>(EMPTY_TIERS);
  const [submittingTiers, setSubmittingTiers] = useState(false);
  const [addPriceListMode, setAddPriceListMode] = useState(false);
  const [addPriceListCombinedItems, setAddPriceListCombinedItems] = useState<PriceListItemPage[]>([]);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listSearchDebounced, setListSearchDebounced] = useState('');
  const [listPage, setListPage] = useState(1);
  const [vendorFilterId, setVendorFilterId] = useState<string>('');
  const [clientFilterId, setClientFilterId] = useState<string>('');
  const [advancePctStr, setAdvancePctStr] = useState('');
  const [preShipmentPctStr, setPreShipmentPctStr] = useState('');
  const [postShipmentPctStr, setPostShipmentPctStr] = useState('');
  const [creditDaysStr, setCreditDaysStr] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');
  const [importingVendorExcel, setImportingVendorExcel] = useState(false);
  const [importingCategoriesExcel, setImportingCategoriesExcel] = useState(false);
  const vendorPricingFileRef = useRef<HTMLInputElement>(null);
  const masterCategoriesFileRef = useRef<HTMLInputElement>(null);

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

  const activeListType: 'RM' | 'PM' | 'PR' =
    activeTab === 'rm' ? 'RM' : activeTab === 'pm' ? 'PM' : 'PR';

  const partyFilterId =
    activeTab === 'pr'
      ? clientFilterId
        ? parseInt(clientFilterId, 10)
        : undefined
      : vendorFilterId
        ? parseInt(vendorFilterId, 10)
        : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => setListSearchDebounced(listSearchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [listSearchQuery]);

  useEffect(() => {
    setListPage(1);
  }, [activeTab, listSearchDebounced, vendorFilterId, clientFilterId]);

  const pageQuery = useQuery({
    queryKey: ['items-list-page', activeListType, listPage, listSearchDebounced, partyFilterId ?? ''],
    queryFn: async () => {
      const res = await fetchPriceListPagePaginated(activeListType, {
        limit: PAGE_SIZE,
        offset: (listPage - 1) * PAGE_SIZE,
        search: listSearchDebounced.trim() || undefined,
        partyId:
          partyFilterId != null && !Number.isNaN(partyFilterId) ? partyFilterId : undefined,
      });
      if (!res.success || !res.data) {
        throw new Error(
          typeof res.error === 'object' && res.error && 'message' in res.error
            ? String((res.error as { message?: string }).message)
            : 'Failed to load items list'
        );
      }
      return res.data;
    },
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const statsQuery = useQuery({
    queryKey: ['items-list-page-stats'],
    queryFn: async () => {
      const res = await fetchPriceListPageStats();
      if (!res.success || !res.data) throw new Error('Failed to load stats');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredPageItems: PriceListItemPage[] = pageQuery.data?.rows ?? [];
  const totalListItems = pageQuery.data?.total ?? 0;
  const totalListPages = Math.max(1, Math.ceil(totalListItems / PAGE_SIZE));

  const vendorsQuery = useQuery({
    queryKey: ['items-list-vendors', 'vendor'],
    queryFn: async (): Promise<VendorClientRecord[]> => {
      const res = await fetchVendorClients('vendor');
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load vendors');
      return res.data as VendorClientRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const clientsQuery = useQuery({
    queryKey: ['items-list-vendors', 'client'],
    queryFn: async (): Promise<VendorClientRecord[]> => {
      const res = await fetchVendorClients('client');
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load clients');
      return res.data as VendorClientRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const vendors: VendorClientRecord[] = vendorsQuery.data ?? [];
  const clients: VendorClientRecord[] = clientsQuery.data ?? [];
  const loading =
    vendorsQuery.isLoading || clientsQuery.isLoading || pageQuery.isLoading;

  const stats = statsQuery.data ?? {
    rmWithTiers: 0,
    pmWithTiers: 0,
    prWithTiers: 0,
    totalRateRows: 0,
    totalTiers: 0,
  };

  const formatPrice = (n: number) => '₹' + (n % 1 !== 0 ? n.toFixed(2) : n.toLocaleString('en-IN'));

  const formatRatePaymentTermsLabel = (raw: string | null | undefined) => {
    const p = parseStagedPaymentTerms(raw ?? '');
    if (p) {
      return `Adv ${p.advance_pct}% · Pre ${p.pre_shipment_pct}% · Post ${p.post_shipment_pct}%${p.credit_days ? ` · Net ${p.credit_days}d` : ''}`;
    }
    return raw?.trim() || '';
  };

  useEffect(() => {
    if (!showAddTierModal || !addPriceListMode || tierTarget) {
      setAddPriceListCombinedItems([]);
      return;
    }
    let cancelled = false;
    setLoadingCombined(true);
    const q = itemSearchQuery.trim();
    Promise.all([
      fetchPriceListPagePaginated('RM', { limit: 80, offset: 0, search: q || undefined }),
      fetchPriceListPagePaginated('PM', { limit: 80, offset: 0, search: q || undefined }),
      fetchPriceListPagePaginated('PR', { limit: 80, offset: 0, search: q || undefined }),
    ]).then(([rRes, pRes, prRes]) => {
      if (cancelled) return;
      const rm = rRes.success && rRes.data ? rRes.data.rows : [];
      const pm = pRes.success && pRes.data ? pRes.data.rows : [];
      const pr = prRes.success && prRes.data ? prRes.data.rows : [];
      setAddPriceListCombinedItems([...rm, ...pm, ...pr]);
      setLoadingCombined(false);
    }).catch(() => {
      if (!cancelled) setLoadingCombined(false);
    });
    return () => { cancelled = true; };
  }, [showAddTierModal, addPriceListMode, tierTarget, itemSearchQuery]);

  const openAddTier = (item: PriceListItemPage) => {
    setTierTarget(item);
    setResolvedItemsListId(item.itemsListId != null ? String(item.itemsListId) : null);
    setSelectedParty(null);
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
    setSelectedParty(null);
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
    if (!tierTarget || !selectedParty) {
      addToast('error', tierTarget?.type === 'PR' ? 'Select a client' : 'Select a vendor');
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
        if (tierTarget.type === 'RM' && tierTarget.raw_material_id == null) {
          addToast('error', 'Missing raw material id for this row. Refresh the page and try again.');
          setSubmittingTiers(false);
          return;
        }
        if (tierTarget.type === 'PM' && tierTarget.pack_material_id == null) {
          addToast('error', 'Missing packaging material id for this row. Refresh the page and try again.');
          setSubmittingTiers(false);
          return;
        }
        if (tierTarget.type === 'PR' && tierTarget.product_id == null) {
          addToast('error', 'Missing product id for this row. Refresh the page and try again.');
          setSubmittingTiers(false);
          return;
        }
        const payload =
          tierTarget.type === 'RM'
            ? { type: 'RM' as const, raw_material_id: tierTarget.raw_material_id!, pack_material_id: null, product_id: null }
            : tierTarget.type === 'PM'
              ? { type: 'PM' as const, raw_material_id: null, pack_material_id: tierTarget.pack_material_id!, product_id: null }
              : { type: 'PR' as const, raw_material_id: null, pack_material_id: null, product_id: tierTarget.product_id! };
        const createRes = await createItemList(payload);
        if (createRes.success && createRes.data?.id) {
          itemsListId = createRes.data.id;
        } else {
          const msg = String(createRes.error?.message ?? '');
          const lowered = msg.toLowerCase();
          const conflict =
            lowered.includes('already') || lowered.includes('conflict') || lowered.includes('409');
          if (conflict) {
            const pageType =
              tierTarget.type === 'RM' ? 'RM' : tierTarget.type === 'PM' ? 'PM' : 'PR';
            const pageRes = await fetchPriceListPage(pageType);
            if (pageRes.success && pageRes.data) {
              const match =
                tierTarget.type === 'RM'
                  ? pageRes.data.find((p) => Number(p.raw_material_id) === Number(tierTarget.raw_material_id))
                  : tierTarget.type === 'PM'
                    ? pageRes.data.find((p) => Number(p.pack_material_id) === Number(tierTarget.pack_material_id))
                    : pageRes.data.find((p) => Number(p.product_id) === Number(tierTarget.product_id));
              if (match?.itemsListId != null) itemsListId = String(match.itemsListId);
            }
          }
          if (!itemsListId) {
            addToast('error', msg || 'Failed to add item to list');
            setSubmittingTiers(false);
            return;
          }
        }
      }
      const staged = serializeStagedPaymentTerms({
        advance_pct: adv,
        pre_shipment_pct: pre,
        post_shipment_pct: post,
        credit_days: creditDaysStr ? Math.max(0, parseInt(creditDaysStr, 10) || 0) : 0,
      });
      const rateRes = await createItemListRate(String(itemsListId), {
        vendor_id: parseInt(selectedParty.id, 10),
        currency,
        payment_terms: staged,
        lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
      });
      if (!rateRes.success || !rateRes.data) {
        addToast(
          'error',
          rateRes.error?.message ??
            (tierTarget.type === 'PR' ? 'Failed to create client rate' : 'Failed to create vendor rate')
        );
        setSubmittingTiers(false);
        return;
      }
      const rateId = rateRes.data.id;
      for (const t of valid) {
        await createItemListTier(String(itemsListId!), rateId, {
          moq_min: parseMoqInput(t.moq) ?? 1,
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
      addToast('success', editingRate.item.type === 'PR' ? 'Client rate updated' : 'Vendor rate updated');
      setEditingRate(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to update rate');
    }
  };

  const handleDeleteRate = async () => {
    if (!editingRate || editingRate.item.itemsListId == null) return;
    if (
      !window.confirm(
        editingRate.item.type === 'PR'
          ? `Remove this client's rate and all its tiers for ${editingRate.item.name}?`
          : `Remove this vendor's rate and all its tiers for ${editingRate.item.name}?`
      )
    )
      return;
    setSubmittingEditRate(true);
    const res = await deleteItemListRate(String(editingRate.item.itemsListId), editingRate.rate.id);
    setSubmittingEditRate(false);
    if (res.success) {
      addToast('success', editingRate.item.type === 'PR' ? 'Client rate removed' : 'Vendor rate removed');
      setEditingRate(null);
      refetchPage();
    } else {
      addToast('error', res.error?.message ?? 'Failed to delete rate');
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier || editingTier.item.itemsListId == null) return;
    const moqMin = parseMoqInput(editTierMoqMin);
    const price = parseFloat(editTierPrice);
    if (moqMin == null || Number.isNaN(price)) {
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
        moq_max: editTierMoqMax.trim() ? parseMoqInput(editTierMoqMax) : null,
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

  const partyIdsUsed = useMemo(() => {
    if (!tierTarget) return new Set<number>();
    return new Set(tierTarget.vendorRates?.map((r) => r.vendor_id) ?? []);
  }, [tierTarget]);
  const availableParties = useMemo(() => {
    const pool = tierTarget?.type === 'PR' ? clients : vendors;
    return pool.filter((p) => !partyIdsUsed.has(parseInt(p.id, 10)));
  }, [tierTarget?.type, clients, vendors, partyIdsUsed]);

  const applySelectedParty = (v: VendorClientRecord | null) => {
    setSelectedParty(v);
    if (!v) {
      setAdvancePctStr('');
      setPreShipmentPctStr('');
      setPostShipmentPctStr('');
      setCreditDaysStr('');
      setLeadTimeDays('');
      return;
    }
    void (async () => {
      try {
        let paymentTerms = v.paymentTerms;
        let data = v.data as Record<string, unknown> | undefined;
        let lead = v.leadTime ?? '';
        const fullRes = await fetchVendorClientById(v.id);
        if (fullRes.success && fullRes.data) {
          paymentTerms = fullRes.data.paymentTerms ?? paymentTerms;
          data = (fullRes.data.data ?? data) as Record<string, unknown> | undefined;
          lead = fullRes.data.leadTime ?? lead;
        }
        const staged = resolveStagedPaymentTermsFromVendorRecord(paymentTerms, data);
        setAdvancePctStr(String(staged.advance_pct));
        setPreShipmentPctStr(String(staged.pre_shipment_pct));
        setPostShipmentPctStr(String(staged.post_shipment_pct));
        setCreditDaysStr(staged.credit_days ? String(staged.credit_days) : '');
        setLeadTimeDays(lead ? String(lead) : '');
      } catch {
        addToast('error', 'Could not apply client payment terms. Try again or refresh.');
      }
    })();
  };

  const partyIdsUsedForTypeahead = useMemo(() => {
    if (!tierTarget?.vendorRates?.length) return undefined;
    return new Set(tierTarget.vendorRates.map((r) => String(r.vendor_id)));
  }, [tierTarget?.vendorRates]);

  const handleMasterCategoriesExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (
      !window.confirm(
        'Update RM/PM category and sub-category for all SKUs in this file? Existing masters are matched by SKU; vendor rates are not changed.'
      )
    ) {
      return;
    }
    setImportingCategoriesExcel(true);
    try {
      const res = await importMasterCategoriesExcel(file, { details: true });
      const s = res.summary;
      if (!res.ok) {
        addToast('error', res.error ?? 'Category import failed');
        return;
      }
      addToast(
        'success',
        `Categories: ${s?.rm_updated ?? 0} RM, ${s?.pm_updated ?? 0} PM updated · ${s?.skipped ?? 0} skipped · ${s?.errors ?? 0} errors`
      );
      if ((s?.skipped ?? 0) > 0 && res.row_log?.length) {
        const sample = res.row_log
          .filter((r) => r.action === 'skipped' || r.action === 'error')
          .slice(0, 3)
          .map((r) => `${r.sheet ?? ''} row ${r.excel_row}: ${r.reason ?? r.action}`)
          .join('; ');
        if (sample) addToast('info', `Sample issues: ${sample}`);
      }
      void queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
      void queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Category import failed');
    } finally {
      setImportingCategoriesExcel(false);
    }
  };

  const handleVendorPricingExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingVendorExcel(true);
    try {
      const res = await importVendorPricingExcel(file, { details: true });
      const s = res.summary;
      if (!res.ok) {
        addToast('error', res.error ?? 'Import failed');
        return;
      }
      addToast(
        'success',
        `Vendor pricing: ${s?.rates_synced ?? 0} synced, ${s?.skipped ?? 0} skipped, ${s?.errors ?? 0} errors`
      );
      if ((s?.skipped ?? 0) > 0 && res.row_log?.length) {
        const sample = res.row_log
          .filter((r) => r.action === 'skipped' || r.action === 'error')
          .slice(0, 3)
          .map((r) => `${r.sheet ?? ''} row ${r.excel_row}: ${r.reason ?? r.action}`)
          .join('; ');
        if (sample) addToast('info', `Sample issues: ${sample}`);
      }
      await refetchPage();
      void queryClient.invalidateQueries({ queryKey: ['items-list'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingVendorExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="px-6 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold text-gray-900 mb-1">Price Lists</h4>
            <p className="text-sm text-gray-500">
              Vendor MOQ-tiered pricing for raw materials and packaging; client MOQ-tiered pricing for finished products (PR).
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <input
              ref={vendorPricingFileRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={handleVendorPricingExcelChange}
            />
            <input
              ref={masterCategoriesFileRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={handleMasterCategoriesExcelChange}
            />
            <button
              type="button"
              disabled={importingCategoriesExcel || importingVendorExcel}
              onClick={() => masterCategoriesFileRef.current?.click()}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {importingCategoriesExcel ? 'Updating…' : 'Update RM/PM categories (Excel)'}
            </button>
            <button
              type="button"
              disabled={importingVendorExcel || importingCategoriesExcel}
              onClick={() => vendorPricingFileRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
            >
              {importingVendorExcel ? 'Importing…' : 'Import vendor pricing (Excel)'}
            </button>
            <p className="text-[11px] text-gray-400 max-w-sm text-right">
              Same workbook for both. Category update uses SKU + Category / Sub-Category. Pricing import also needs Primary Vendor and Price/Unit.
            </p>
          </div>
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
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">PR client price lists</div>
            <div className="text-2xl font-extrabold text-amber-600">{stats.prWithTiers}</div>
            <div className="text-[11px] text-gray-400 mt-1">Products with client tiers</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-blue-500">
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">MOQ Tiers</div>
            <div className="text-2xl font-extrabold text-blue-600">{stats.totalTiers}</div>
            <div className="text-[11px] text-gray-400 mt-1">All MOQ price breaks ({stats.totalRateRows} rate rows)</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-gray-900">Price Lists — Vendor / client & MOQ-wise</span>
            <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {(['rm', 'pm', 'pr'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setListSearchQuery('');
                    setListPage(1);
                  }}
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
            {activeTab === 'pr' && (
              <div className="flex items-center gap-2">
                <label htmlFor="items-list-client-filter" className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Filter by client
                </label>
                <VendorClientNameTypeahead
                  inputId="items-list-client-filter"
                  parties={clients}
                  selectedId={clientFilterId}
                  loading={clientsQuery.isLoading}
                  placeholder="All clients — search by name, city…"
                  onSelect={(c) => setClientFilterId(c?.id ?? '')}
                  className="min-w-[220px]"
                />
                {clientFilterId ? (
                  <span className="text-[11px] text-amber-800 max-w-[220px] leading-snug">
                    Only products with a client price list for this client. Choose &quot;All clients&quot; for every product.
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

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={listSearchQuery}
            onChange={(e) => setListSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'pr'
                ? 'Search product code, name, or client…'
                : 'Search item code, name, or vendor…'
            }
            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            aria-label="Search items list"
          />
          {listSearchQuery ? (
            <button
              type="button"
              onClick={() => setListSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        {listSearchDebounced.trim() && !loading ? (
          <p className="text-xs text-gray-500 -mt-4">
            {totalListItems} {activeTab === 'pr' ? 'product' : 'item'}
            {totalListItems !== 1 ? 's' : ''} match &quot;{listSearchDebounced.trim()}&quot;
          </p>
        ) : null}

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading…</div>
        ) : (
          <div id="pl-list-body" className="space-y-2.5">
            {filteredPageItems.map((item) => {
              const hasTiers = item.vendorRates && item.vendorRates.length > 0;
              const isRm = item.type === 'RM';
              const isPm = item.type === 'PM';
              const isPr = item.type === 'PR';
              const listOnlyLabel = isPr ? 'no client pricing tiers' : 'no vendor tiers';
              if (!hasTiers) {
                return (
                  <div key={item.code} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono text-[10.5px] ${isRm ? 'text-teal-600' : isPm ? 'text-violet-600' : 'text-amber-600'}`}
                        >
                          {item.code}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                        <span className="font-mono text-xs font-bold text-amber-600">
                          {item.pricePerUnit < 1 ? formatPrice(item.pricePerUnit) : formatPrice(item.pricePerUnit)}
                          {isRm ? '/KG' : isPm ? '/pc' : ' MRP'}
                        </span>
                        <span className="text-[11px] text-gray-400">— List price only, {listOnlyLabel}</span>
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
                <div
                  key={item.code}
                  className={`bg-white border rounded-lg overflow-hidden ${
                    isRm ? 'border-teal-100' : isPm ? 'border-violet-100' : 'border-amber-100'
                  }`}
                >
                  <div
                    className={`px-4 py-3 border-b flex items-center justify-between ${
                      isRm
                        ? 'bg-green-50 border-green-200'
                        : isPm
                          ? 'bg-violet-50 border-violet-200'
                          : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10.5px] ${isRm ? 'text-teal-600' : isPm ? 'text-violet-600' : 'text-amber-600'}`}
                      >
                        {item.code}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{item.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">
                        {isRm
                          ? `${item.uom ?? 'KG'} · GST ${item.gst ?? 0}%`
                          : isPm
                            ? `${item.pack_type ?? ''} · ${item.level ?? ''}`
                            : `${item.uom ?? 'UNIT'} · GST ${item.gst ?? 0}%`}
                      </span>
                    </div>
                    <button
                      onClick={() => openAddTier(item)}
                      className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      + Tier
                    </button>
                  </div>
                  {item.vendorRates?.map((rate) => {
                    const isClientRate = rate.party_type === 'client';
                    return (
                      <div key={rate.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div>
                            <span className={`text-[10px] font-bold uppercase text-gray-400 mr-1.5`}>
                              {isClientRate ? 'Client' : 'Vendor'}
                            </span>
                            <span className={`text-xs font-bold ${isClientRate ? 'text-amber-700' : 'text-blue-600'}`}>
                              {rate.vendor_name ?? (isClientRate ? 'Client' : 'Vendor')}
                            </span>
                            {rate.vendor_code && (
                              <span className="text-[10.5px] text-gray-400 ml-1.5">({rate.vendor_code})</span>
                            )}
                            {rate.payment_terms && formatStagedPaymentTermsSummary(rate.payment_terms) ? (
                              <span className="text-[10.5px] text-gray-500 ml-1.5">
                                · {formatStagedPaymentTermsSummary(rate.payment_terms)}
                              </span>
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
                              <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">
                                MOQ {isRm ? '(KG)' : isPm ? '(pcs)' : '(units)'}
                              </th>
                              <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">
                                Price {isRm ? '/ KG' : isPm ? '/ pc' : '/ unit'}
                              </th>
                              <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Valid Till</th>
                              <th className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Note</th>
                              {item.itemsListId != null && (
                                <th className="text-right py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {rate.tiers?.map((t, ti) => (
                              <tr
                                key={t.id}
                                className={`border-b border-gray-50 ${ti === 0 ? (isPr ? 'bg-amber-50/50' : 'bg-green-50/50') : ''}`}
                              >
                                <td className="py-1.5 px-2">
                                  <span
                                    className={`font-mono text-xs font-bold ${
                                      isRm ? 'text-teal-600' : isPm ? 'text-violet-600' : 'text-amber-600'
                                    }`}
                                  >
                                    {t.moq_min === 1 && t.moq_max == null ? 'List price' : `${t.moq_min}+`}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-mono text-sm font-bold text-amber-600">
                                  {formatPrice(t.price_per_unit)}
                                </td>
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
                    );
                  })}
                </div>
              );
            })}
            {filteredPageItems.length === 0 && (
              <p className="text-gray-500 py-8 text-center">
                {listSearchDebounced.trim()
                  ? `No ${activeTab === 'pr' ? 'products' : 'items'} match "${listSearchDebounced.trim()}".`
                  : activeTab === 'pr'
                    ? clientFilterId
                      ? 'No products with client pricing for the selected client.'
                      : 'No products in catalogue.'
                    : vendorFilterId
                      ? 'No items with rates for the selected vendor.'
                      : 'No items in this tab.'}
              </p>
            )}
          </div>
        )}

        {!loading && totalListItems > 0 ? (
          <Pagination
            currentPage={listPage}
            totalPages={totalListPages}
            onPageChange={setListPage}
            totalItems={totalListItems}
            itemsPerPage={PAGE_SIZE}
            variant="compact"
          />
        ) : null}
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

              {/* Vendor or client & tier form — shown when item is selected */}
              {tierTarget && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-gray-500 uppercase mb-1">
                    {tierTarget.type === 'PR' ? 'Client *' : 'Vendor *'}
                  </label>
                  {tierTarget.type === 'PR' ? (
                    <VendorClientNameTypeahead
                      parties={clients}
                      selectedId={selectedParty?.id ?? ''}
                      loading={clientsQuery.isLoading}
                      disabled={availableParties.length === 0 && !!tierTarget.vendorRates?.length}
                      disabledIds={partyIdsUsedForTypeahead}
                      placeholder="Search client by name, city…"
                      onSelect={applySelectedParty}
                    />
                  ) : (
                    <select
                      value={selectedParty?.id ?? ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        const v = vendors.find((x) => x.id === id) ?? null;
                        applySelectedParty(v);
                      }}
                      className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select…</option>
                      {availableParties.map((v) => (
                        <option key={v.id} value={v.id}>{v.name ?? v.id}</option>
                      ))}
                    </select>
                  )}
                  {availableParties.length === 0 && tierTarget.vendorRates?.length ? (
                    <p className="text-xs text-amber-600 mt-1">
                      {tierTarget.type === 'PR'
                        ? 'All clients already have pricing for this product'
                        : 'All vendors have rates for this item'}
                    </p>
                  ) : null}
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
                  <p className="text-[10px] text-gray-500 mt-1">
                    Applies to this {tierTarget.type === 'PR' ? 'client' : 'vendor'} rate (all tiers added below).
                  </p>
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
                  disabled={submittingTiers || !selectedParty}
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
                Edit rate —{' '}
                {editingRate.rate.party_type === 'client' ? 'Client' : 'Vendor'}:{' '}
                {editingRate.rate.vendor_name ?? '—'} · {editingRate.item.name}
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
