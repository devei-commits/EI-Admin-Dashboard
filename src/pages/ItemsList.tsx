import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { ModalOverlay } from '../components/ui/ModalOverlay';
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
  updateItemsListApprovalStatus,
  type PriceListItemPage,
  type ItemListTierRow,
} from '../services/itemsList.service';
import {
  MASTER_APPROVAL_STATUSES,
  normalizeMasterApprovalStatus,
  masterApprovalStatusBadgeClass,
  getNextMasterApprovalStatus,
  getPreviousMasterApprovalStatus,
  buildMasterApprovalStatusCounts,
  type MasterApprovalStatusTab,
} from '../constants/masterApprovalStatus';
import { fetchVendorClients, fetchVendorClientById } from '../services/vendorClient.service';
import type { VendorClientRecord } from '../services/vendorClient.service';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
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
  const [statusTab, setStatusTab] = useState<MasterApprovalStatusTab>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
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
  const [viewingRate, setViewingRate] = useState<{ item: PriceListItemPage; rate: RateForEdit } | null>(null);
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
  }, [activeTab, listSearchDebounced, vendorFilterId, clientFilterId, statusTab]);

  const pageQuery = useQuery({
    queryKey: ['items-list-page', activeListType, listPage, listSearchDebounced, partyFilterId ?? '', statusTab],
    queryFn: async () => {
      const res = await fetchPriceListPagePaginated(activeListType, {
        limit: PAGE_SIZE,
        offset: (listPage - 1) * PAGE_SIZE,
        search: listSearchDebounced.trim() || undefined,
        partyId:
          partyFilterId != null && !Number.isNaN(partyFilterId) ? partyFilterId : undefined,
        status: statusTab !== 'all' ? statusTab : undefined,
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

  const rawPageItems: PriceListItemPage[] = pageQuery.data?.rows ?? [];

  // Counts come from the server (global over the whole catalog), so they stay in sync
  // with the paginator; fall back to a page-local count only if the server omits them.
  const statusCounts =
    pageQuery.data?.statusCounts ?? buildMasterApprovalStatusCounts(rawPageItems, (it) => it.status);

  // Status filtering is done server-side (keeps `total`/paginator correct); here we only sort.
  const filteredPageItems: PriceListItemPage[] = useMemo(() => {
    return [...rawPageItems].sort((a, b) => {
      const cmp = String(a.code ?? '').localeCompare(String(b.code ?? ''), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [rawPageItems, sortAsc]);
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

  /** "FRESH · 18d" style age chip from the price list's updatedAt. */
  const freshnessChip = (updatedAt?: string | null): { label: string; cls: string } | null => {
    if (!updatedAt) return null;
    const t = new Date(updatedAt).getTime();
    if (Number.isNaN(t)) return null;
    const days = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
    if (days <= 30) return { label: `FRESH · ${days}d`, cls: 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30' };
    if (days <= 90) return { label: `${days}d`, cls: 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30' };
    return { label: `STALE · ${days}d`, cls: 'bg-err-soft text-err border-[color:var(--st-red-fg)]/30' };
  };

  const formatDate = (d?: string | null): string => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /** "23d ago (Jun 27 2026)" from a timestamp. */
  const updatedAgoLabel = (d?: string | null): string => {
    if (!d) return '—';
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) return '—';
    const days = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
    return `${days}d ago (${formatDate(d)})`;
  };

  const openViewRate = (item: PriceListItemPage, rate: RateForEdit) => setViewingRate({ item, rate });

  const handleApprovalTransition = async (item: PriceListItemPage, action: 'advance' | 'reject') => {
    if (item.itemsListId == null) {
      addToast('error', 'Add a price list for this item before submitting for approval.');
      return;
    }
    setStatusUpdatingId(item.itemsListId);
    try {
      const res = await updateItemsListApprovalStatus(item.itemsListId, { action });
      if (!res.success) {
        addToast('error', res.error?.message ?? 'Failed to update approval status');
        return;
      }
      addToast('success', `${item.name} → ${res.data?.status ?? ''}`);
      refetchPage();
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const renderApprovalStrip = (item: PriceListItemPage) => {
    const status = normalizeMasterApprovalStatus(item.status);
    const fresh = freshnessChip(item.updatedAt);
    const next = getNextMasterApprovalStatus(status);
    const prev = getPreviousMasterApprovalStatus(status);
    const busy = statusUpdatingId != null && statusUpdatingId === item.itemsListId;
    const canWorkflow = item.itemsListId != null;
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${masterApprovalStatusBadgeClass(status)}`}>
          {status}
        </span>
        {fresh && (
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${fresh.cls}`}>{fresh.label}</span>
        )}
        <span className="text-[10.5px] text-ink-4 whitespace-nowrap">{formatDate(item.updatedAt)}</span>
        {canWorkflow && prev && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleApprovalTransition(item, 'reject')}
            className="px-2 py-0.5 rounded border border-border bg-surface text-[10px] font-semibold text-ink-3 hover:bg-surface-2 disabled:opacity-50"
          >
            ← {prev}
          </button>
        )}
        {canWorkflow && next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleApprovalTransition(item, 'advance')}
            className="px-2 py-0.5 rounded bg-brand text-white text-[10px] font-semibold hover:bg-brand-press disabled:opacity-50"
          >
            {next === 'Active' ? 'Approve → Active' : `→ ${next}`}
          </button>
        )}
      </div>
    );
  };

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
    <div className="min-h-screen bg-canvas">
      <div className="px-6 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold text-ink mb-1">Price Lists</h4>
            <p className="text-sm text-ink-3">
              Vendor MOQ-tiered pricing for raw materials and packaging; client MOQ-tiered pricing for finished products (PR).
            </p>
          </div>
          <div className="flex flex items-end gap-2">
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
              className="px-4 py-2 rounded-lg border border-border bg-surface text-ink text-sm font-semibold hover:bg-surface-3 disabled:opacity-50"
            >
              {importingCategoriesExcel ? 'Updating…' : 'Update RM/PM categories (Excel)'}
            </button>
            <button
              type="button"
              disabled={importingVendorExcel || importingCategoriesExcel}
              onClick={() => vendorPricingFileRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-press disabled:opacity-50"
            >
              {importingVendorExcel ? 'Importing…' : 'Import vendor pricing (Excel)'}
            </button>
            <p className="text-[11px] text-ink-4 max-w-sm text-right">
              Same workbook for both. Category update uses SKU + Category / Sub-Category. Pricing import also needs Primary Vendor and Price/Unit.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface border border-border rounded-lg p-4 border-l-4 border-l-brand">
            <div className="text-[10.5px] font-bold text-ink-4 uppercase tracking-wide mb-1">RM Price Lists</div>
            <div className="text-2xl font-extrabold text-brand">{stats.rmWithTiers}</div>
            <div className="text-[11px] text-ink-4 mt-1">Items with tiered pricing</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 border-l-4 border-l-brand">
            <div className="text-[10.5px] font-bold text-ink-4 uppercase tracking-wide mb-1">PM Price Lists</div>
            <div className="text-2xl font-extrabold text-brand">{stats.pmWithTiers}</div>
            <div className="text-[11px] text-ink-4 mt-1">Items with MOQ tiers</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 border-l-4 border-l-warn">
            <div className="text-[10.5px] font-bold text-ink-4 uppercase tracking-wide mb-1">PR client price lists</div>
            <div className="text-2xl font-extrabold text-warn">{stats.prWithTiers}</div>
            <div className="text-[11px] text-ink-4 mt-1">Products with client tiers</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 border-l-4 border-l-brand">
            <div className="text-[10.5px] font-bold text-ink-4 uppercase tracking-wide mb-1">MOQ Tiers</div>
            <div className="text-2xl font-extrabold text-brand">{stats.totalTiers}</div>
            <div className="text-[11px] text-ink-4 mt-1">All MOQ price breaks ({stats.totalRateRows} rate rows)</div>
          </div>
        </div>

        {/* Row 1 — title · category tabs · primary action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-ink">Price Lists</h2>
            <div className="flex gap-0.5 bg-surface-3 p-0.5 rounded-lg">
              {(['rm', 'pm', 'pr'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setStatusTab('all');
                    setListSearchQuery('');
                    setListPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    activeTab === tab ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
                  }`}
                >
                  {tab === 'rm' ? 'RM' : tab === 'pm' ? 'PM' : 'PR Sell'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openAddPriceList}
            className="px-3 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-bold whitespace-nowrap"
          >
            + New Price List
          </button>
        </div>

        {/* Row 2 — approval status filter */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...MASTER_APPROVAL_STATUSES] as MasterApprovalStatusTab[]).map((s) => {
            const active = statusTab === s;
            const count = s === 'all' ? statusCounts.all ?? 0 : statusCounts[s] ?? 0;
            const emoji =
              s === 'Draft' ? '📝' : s === 'Under Review' ? '👀' : s === 'Under Approval' ? '✋' : s === 'Active' ? '✅' : '📋';
            const label = s === 'all' ? 'ALL' : s.toUpperCase();
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusTab(s);
                  setListPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wide flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-ink-3 border-border hover:bg-surface-3'
                }`}
              >
                <span>
                  {emoji} {label}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    active ? 'bg-surface/20 text-white' : 'bg-surface-3 text-ink-3'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3 — search · party filter · sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
            <input
              type="search"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'pr'
                  ? 'Search product code, name, or client…'
                  : 'Search item code, name, or vendor…'
              }
              className="w-full pl-9 pr-9 py-2 border border-border rounded-lg text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
              aria-label="Search items list"
            />
            {listSearchQuery ? (
              <button
                type="button"
                onClick={() => setListSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-ink-4 hover:text-ink-2 hover:bg-surface-3"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {(activeTab === 'rm' || activeTab === 'pm') && (
            <select
              id="items-list-vendor-filter"
              aria-label="Filter by vendor"
              value={vendorFilterId}
              onChange={(e) => setVendorFilterId(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink bg-surface min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name ?? v.id}
                </option>
              ))}
            </select>
          )}
          {activeTab === 'pr' && (
            <VendorClientNameTypeahead
              inputId="items-list-client-filter"
              parties={clients}
              selectedId={clientFilterId}
              loading={clientsQuery.isLoading}
              placeholder="All clients — search by name, city…"
              onSelect={(c) => setClientFilterId(c?.id ?? '')}
              className="min-w-[220px]"
            />
          )}

          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className="ml-auto px-3 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-2 whitespace-nowrap"
            title="Sort by item code"
          >
            Sort · Item Code {sortAsc ? '↑' : '↓'}
          </button>
        </div>

        {vendorFilterId && (activeTab === 'rm' || activeTab === 'pm') ? (
          <p className="text-[11px] text-warn -mt-1">
            Showing only items with a rate for this vendor. Choose &quot;All vendors&quot; for every RM/PM line.
          </p>
        ) : null}
        {clientFilterId && activeTab === 'pr' ? (
          <p className="text-[11px] text-warn -mt-1">
            Showing only products with a client price list for this client. Choose &quot;All clients&quot; for every product.
          </p>
        ) : null}
        {listSearchDebounced.trim() && !loading ? (
          <p className="text-xs text-ink-3 -mt-1">
            {totalListItems} {activeTab === 'pr' ? 'product' : 'item'}
            {totalListItems !== 1 ? 's' : ''} match &quot;{listSearchDebounced.trim()}&quot;
          </p>
        ) : null}

        {loading ? (
          <TableSkeleton rows={8} cols={5} className="py-4" />
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
                  <div key={item.code} className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono text-[10.5px] ${isRm ? 'text-brand' : isPm ? 'text-brand' : 'text-warn'}`}
                        >
                          {item.code}
                        </span>
                        <span className="text-sm font-bold text-ink">{item.name}</span>
                        <span className="font-mono text-xs font-bold text-warn">
                          {item.pricePerUnit < 1 ? formatPrice(item.pricePerUnit) : formatPrice(item.pricePerUnit)}
                          {isRm ? '/KG' : isPm ? '/pc' : ' MRP'}
                        </span>
                        <span className="text-[11px] text-ink-4">— List price only, {listOnlyLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderApprovalStrip(item)}
                        <button
                          onClick={() => openAddTier(item)}
                          className="px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2"
                        >
                          + Add Tiers
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={item.code}
                  className={`bg-surface border rounded-lg overflow-hidden ${
                    isRm ? 'border-brand-soft' : isPm ? 'border-brand-soft' : 'border-[color:var(--st-amber-fg)]/30'
                  }`}
                >
                  <div
                    className={`px-4 py-3 border-b flex items-center justify-between ${
                      isRm
                        ? 'bg-ok-soft border-[color:var(--st-green-fg)]/30'
                        : isPm
                          ? 'bg-brand-soft border-brand-soft'
                          : 'bg-warn-soft border-[color:var(--st-amber-fg)]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10.5px] ${isRm ? 'text-brand' : isPm ? 'text-brand' : 'text-warn'}`}
                      >
                        {item.code}
                      </span>
                      <span className="text-sm font-bold text-ink">{item.name}</span>
                      <span className="font-mono text-[11px] text-ink-4">
                        {isRm
                          ? `${item.uom ?? 'KG'} · GST ${item.gst ?? 0}%`
                          : isPm
                            ? `${item.pack_type ?? ''} · ${item.level ?? ''}`
                            : `${item.uom ?? 'UNIT'} · GST ${item.gst ?? 0}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderApprovalStrip(item)}
                      <button
                        onClick={() => openAddTier(item)}
                        className="px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2"
                      >
                        + Tier
                      </button>
                    </div>
                  </div>
                  {item.vendorRates?.map((rate) => {
                    const isClientRate = rate.party_type === 'client';
                    return (
                      <div key={rate.id} className="px-4 py-3 border-b border-hairline last:border-b-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div>
                            <span className={`text-[10px] font-bold uppercase text-ink-4 mr-1.5`}>
                              {isClientRate ? 'Client' : 'Vendor'}
                            </span>
                            <span className={`text-xs font-bold ${isClientRate ? 'text-warn' : 'text-brand'}`}>
                              {rate.vendor_name ?? (isClientRate ? 'Client' : 'Vendor')}
                            </span>
                            {rate.vendor_code && (
                              <span className="text-[10.5px] text-ink-4 ml-1.5">({rate.vendor_code})</span>
                            )}
                            {rate.payment_terms && formatStagedPaymentTermsSummary(rate.payment_terms) ? (
                              <span className="text-[10.5px] text-ink-3 ml-1.5">
                                · {formatStagedPaymentTermsSummary(rate.payment_terms)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-ink-4">{rate.currency}</span>
                            {item.itemsListId != null && (
                              <button
                                type="button"
                                onClick={() => openViewRate(item, rate)}
                                className="px-2 py-1 rounded border border-border bg-surface text-[10.5px] font-semibold text-ink-3 hover:bg-surface-2"
                              >
                                👁 View / Edit
                              </button>
                            )}
                          </div>
                        </div>
                        <table className="w-full text-sm border-collapse mt-2">
                          <thead>
                            <tr className="border-b border-hairline">
                              <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold text-ink-4 uppercase">
                                MOQ {isRm ? '(KG)' : isPm ? '(pcs)' : '(units)'}
                              </th>
                              <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold text-ink-4 uppercase">
                                Price {isRm ? '/ KG' : isPm ? '/ pc' : '/ unit'}
                              </th>
                              <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold text-ink-4 uppercase">Valid Till</th>
                              <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold text-ink-4 uppercase">Note</th>
                              {item.itemsListId != null && (
                                <th scope="col" className="text-right py-1.5 px-2 text-[10px] font-bold text-ink-4 uppercase">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {rate.tiers?.map((t, ti) => (
                              <tr
                                key={t.id}
                                className={`border-b border-hairline ${ti === 0 ? (isPr ? 'bg-warn-soft' : 'bg-ok-soft') : ''}`}
                              >
                                <td className="py-1.5 px-2">
                                  <span
                                    className={`font-mono text-xs font-bold ${
                                      isRm ? 'text-brand' : isPm ? 'text-brand' : 'text-warn'
                                    }`}
                                  >
                                    {t.moq_min === 1 && t.moq_max == null ? 'List price' : `${t.moq_min}+`}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-mono text-sm font-bold text-warn">
                                  {formatPrice(t.price_per_unit)}
                                </td>
                                <td className="py-1.5 px-2 text-xs text-ink-2">{t.valid_till ?? '—'}</td>
                                <td className="py-1.5 px-2 text-[11px] text-ink-4">{t.note ?? ''}</td>
                                {item.itemsListId != null && (
                                  <td className="py-1.5 px-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openEditTier(item, rate.id, t)}
                                      className="text-[10.5px] text-brand hover:underline mr-2"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTierFromRow(item, rate.id, t)}
                                      className="text-[10.5px] text-err hover:underline"
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
              <EmptyState
                title={
                  listSearchDebounced.trim()
                    ? `No ${activeTab === 'pr' ? 'products' : 'items'} match "${listSearchDebounced.trim()}".`
                    : activeTab === 'pr'
                      ? clientFilterId
                        ? 'No products with client pricing for the selected client.'
                        : 'No products in catalogue.'
                      : vendorFilterId
                        ? 'No items with rates for the selected vendor.'
                        : 'No items in this tab.'
                }
              />
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
        <ModalOverlay onClose={() => { setShowAddTierModal(false); setAddPriceListMode(false); setTierTarget(null); }} z="z-50" dismissable={false} backdrop="default" align="start" scroll={true} className="p-6">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl my-4" role="dialog" aria-modal="true" aria-labelledby="add-tier-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline bg-surface-3 flex items-center justify-between">
              <span id="add-tier-modal-title" className="text-sm font-bold text-ink">
                {addPriceListMode && !tierTarget ? 'Add Price List — Select Item' : `Add Price Tier — ${tierTarget?.name ?? ''}`}
              </span>
              <button onClick={() => { setShowAddTierModal(false); setAddPriceListMode(false); setTierTarget(null); }} className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-ink-3 hover:bg-surface-3">
                X
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Item selector — shown when Add Price List mode and no item selected yet */}
              {addPriceListMode && !tierTarget && (
                <div>
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">
                    Select RM, PM, or Product *
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name or code…"
                    aria-label="Search by name or code"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-2 border border-border rounded-lg text-sm mb-2"
                    autoFocus
                  />
                  <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-hairline">
                    {loadingCombined ? (
                      <div className="px-3 py-4 text-xs text-ink-4 text-center">Loading RM, PM &amp; products…</div>
                    ) : filteredItemsForSelection.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-ink-4 text-center">No items found</div>
                    ) : (
                      filteredItemsForSelection.slice(0, 80).map((item) => (
                        <button
                          key={item.type === 'PR' ? `PR-${item.product_id}` : item.code}
                          type="button"
                          onClick={() => selectItemForPriceList(item)}
                          className="w-full text-left px-3 py-2.5 hover:bg-brand-soft transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-[10.5px] shrink-0 ${item.type === 'RM' ? 'text-brand' : item.type === 'PM' ? 'text-brand' : 'text-warn'}`}>{item.code}</span>
                            <span className="text-sm font-medium text-ink truncate">{item.name}</span>
                            <span className="text-[10px] text-ink-4 shrink-0">({item.type})</span>
                          </div>
                          {item.vendorRates && item.vendorRates.length > 0 ? (
                            <span className="text-[10px] font-semibold text-warn bg-warn-soft px-1.5 py-0.5 rounded shrink-0">
                              {item.vendorRates.length} vendor{item.vendorRates.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-ink-4 shrink-0">No pricing</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Selected item chip in Add Price List mode */}
              {addPriceListMode && tierTarget && (
                <div className="flex items-center gap-2 bg-brand-soft border border-brand-soft rounded-lg px-3 py-2">
                  <span className={`font-mono text-[10.5px] ${tierTarget.type === 'RM' ? 'text-brand' : tierTarget.type === 'PM' ? 'text-brand' : 'text-warn'}`}>{tierTarget.code}</span>
                  <span className="text-sm font-bold text-ink">{tierTarget.name}</span>
                  <span className="text-[10px] text-ink-3">({tierTarget.type})</span>
                  <button
                    type="button"
                    onClick={() => { setTierTarget(null); setResolvedItemsListId(null); }}
                    className="ml-auto text-xs text-ink-3 hover:text-ink-2 underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Vendor or client & tier form — shown when item is selected */}
              {tierTarget && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">
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
                    <VendorClientNameTypeahead
                      parties={vendors}
                      selectedId={selectedParty?.id ?? ''}
                      loading={vendorsQuery.isLoading}
                      disabled={availableParties.length === 0 && !!tierTarget.vendorRates?.length}
                      disabledIds={partyIdsUsedForTypeahead}
                      placeholder="Search vendor by name, city…"
                      onSelect={applySelectedParty}
                    />
                  )}
                  {availableParties.length === 0 && tierTarget.vendorRates?.length ? (
                    <p className="text-xs text-warn mt-1">
                      {tierTarget.type === 'PR'
                        ? 'All clients already have pricing for this product'
                        : 'All vendors have rates for this item'}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-2.5 py-2 border border-border rounded-lg text-sm">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">
                    Payment terms (% of order value)
                  </label>
                  <p className="text-[11px] text-ink-3 mb-2">
                    Advance (on order), pre-shipment, and post-shipment must total at most 100%. These apply to website checkout and My Orders.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-ink-3">Advance %</span>
                      <input type="number" min={0} max={100} value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} aria-label="Advance %" className="w-full px-2 py-1.5 border border-border rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-ink-3">Pre-shipment %</span>
                      <input type="number" min={0} max={100} value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} aria-label="Pre-shipment %" className="w-full px-2 py-1.5 border border-border rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-ink-3">Post-shipment %</span>
                      <input type="number" min={0} max={100} value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} aria-label="Post-shipment %" className="w-full px-2 py-1.5 border border-border rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-ink-3">Credit days</span>
                      <input type="number" min={0} value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} aria-label="Credit days" className="w-full px-2 py-1.5 border border-border rounded-lg text-sm font-mono" placeholder="0" />
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Lead time (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className="w-full max-w-xs px-2.5 py-2 border border-border rounded-lg text-sm"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    Applies to this {tierTarget.type === 'PR' ? 'client' : 'vendor'} rate (all tiers added below).
                  </p>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-ink-3 uppercase mb-2">Price Tiers</div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-3 border-b border-border">
                      <th scope="col" className="text-left py-1.5 px-2 text-[10.5px] font-bold text-ink-3">MOQ</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10.5px] font-bold text-ink-3">Price</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10.5px] font-bold text-ink-3">Valid Till</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10.5px] font-bold text-ink-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceTiers.map((t, idx) => (
                      <tr key={t.id} className="border-b border-hairline">
                        <td className="p-1">
                          <input
                            type="number"
                            placeholder={idx === 0 ? '1' : 'MOQ'}
                            aria-label={`Tier ${idx + 1} MOQ`}
                            value={t.moq}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, moq: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`Tier ${idx + 1} price`}
                            value={t.price}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="date"
                            aria-label={`Tier ${idx + 1} valid till`}
                            value={t.validTill}
                            onChange={(e) => setPriceTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, validTill: e.target.value } : r)))}
                            className="w-full px-2 py-1 border rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="Note"
                            aria-label={`Tier ${idx + 1} note`}
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
            <div className="px-5 py-3 border-t border-hairline bg-surface-3 flex gap-2 justify-end">
              <button onClick={() => { setShowAddTierModal(false); setAddPriceListMode(false); setTierTarget(null); }} className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2">
                Cancel
              </button>
              {tierTarget && (
                <button
                  onClick={handleSaveTiers}
                  disabled={submittingTiers || !selectedParty}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingTiers ? 'Saving…' : 'Save Tiers'}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Edit vendor rate modal */}
      {editingRate && (
        <ModalOverlay onClose={() => setEditingRate(null)} z="z-50" dismissable={false} backdrop="default" align="start" scroll={true} className="p-6">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md my-4" role="dialog" aria-modal="true" aria-labelledby="edit-rate-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline bg-surface-3 flex items-center justify-between">
              <span id="edit-rate-modal-title" className="text-sm font-bold text-ink">
                Edit rate —{' '}
                {editingRate.rate.party_type === 'client' ? 'Client' : 'Vendor'}:{' '}
                {editingRate.rate.vendor_name ?? '—'} · {editingRate.item.name}
              </span>
              <button onClick={() => setEditingRate(null)} className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-ink-3 hover:bg-surface-3">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Currency</label>
                <select value={editRateCurrency} onChange={(e) => setEditRateCurrency(e.target.value)} className="w-full px-2.5 py-2 border border-border rounded-lg text-sm">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Payment terms (%)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} max={100} value={editAdvancePct} onChange={(e) => setEditAdvancePct(e.target.value)} aria-label="Advance" className="px-2 py-1.5 border rounded text-sm" placeholder="Advance" />
                  <input type="number" min={0} max={100} value={editPreShipmentPct} onChange={(e) => setEditPreShipmentPct(e.target.value)} aria-label="Pre-shipment" className="px-2 py-1.5 border rounded text-sm" placeholder="Pre-shipment" />
                  <input type="number" min={0} max={100} value={editPostShipmentPct} onChange={(e) => setEditPostShipmentPct(e.target.value)} aria-label="Post-shipment" className="px-2 py-1.5 border rounded text-sm" placeholder="Post-shipment" />
                  <input type="number" min={0} value={editCreditDays} onChange={(e) => setEditCreditDays(e.target.value)} aria-label="Credit days" className="px-2 py-1.5 border rounded text-sm" placeholder="Credit days" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-hairline bg-surface-3 flex gap-2 justify-between">
              <button
                type="button"
                onClick={handleDeleteRate}
                disabled={submittingEditRate}
                className="px-3 py-2 rounded-lg border border-[color:var(--st-red-fg)]/30 bg-surface text-err text-xs font-bold hover:bg-err-soft disabled:opacity-50"
              >
                Delete rate & tiers
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingRate(null)} className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2">Cancel</button>
                <button onClick={handleUpdateRate} disabled={submittingEditRate} className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-bold disabled:opacity-50">
                  {submittingEditRate ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* View price list modal (read-only card → Edit) */}
      {viewingRate && (() => {
        const { item, rate } = viewingRate;
        const parsed = parseStagedPaymentTerms(rate.payment_terms ?? '');
        const paymentLabel = formatStagedPaymentTermsSummary(rate.payment_terms) || '—';
        const tiers = rate.tiers ?? [];
        return (
          <ModalOverlay onClose={() => setViewingRate(null)} z="z-50" dismissable={false} backdrop="default" align="start" scroll={true} className="p-6">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-md my-4" role="dialog" aria-modal="true" aria-labelledby="view-rate-modal-title" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-hairline flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div id="view-rate-modal-title" className="text-sm font-bold text-ink">
                    {item.name} <span className="font-mono text-[11px] text-ink-4">· {item.code}</span>
                  </div>
                  <div className="text-[11px] text-ink-3 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-brand">{rate.vendor_name ?? '—'}</span>
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${masterApprovalStatusBadgeClass(item.status)}`}>
                      {normalizeMasterApprovalStatus(item.status).toUpperCase()}
                    </span>
                  </div>
                </div>
                <button onClick={() => setViewingRate(null)} className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-ink-3 hover:bg-surface-3 shrink-0">×</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-[10.5px] font-bold text-ink-3 uppercase mb-2">Terms</h4>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">payment</dt><dd className="font-semibold text-ink text-right">{paymentLabel}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">credit</dt><dd className="font-semibold text-ink text-right">{parsed?.credit_days ?? 0} days</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">currency</dt><dd className="font-semibold text-ink text-right">{rate.currency || 'INR'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">gst</dt><dd className="font-semibold text-ink text-right">{item.gst ?? 0}%</dd></div>
                  </dl>
                </div>
                <div>
                  <h4 className="text-[10.5px] font-bold text-ink-3 uppercase mb-2">
                    Tier pricing ({tiers.length} tier{tiers.length !== 1 ? 's' : ''})
                  </h4>
                  {tiers.length === 0 ? (
                    <p className="text-[11px] text-ink-4">No tiers yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-ink-4 text-left">
                          <th scope="col" className="py-1 font-semibold">Tier</th>
                          <th scope="col" className="py-1 font-semibold">MOQ</th>
                          <th scope="col" className="py-1 font-semibold">Price</th>
                          <th scope="col" className="py-1 font-semibold">Lead</th>
                          <th scope="col" className="py-1 font-semibold">Valid till</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((t, i) => (
                          <tr key={t.id} className="border-t border-hairline">
                            <td className="py-1.5 font-semibold text-ink">Tier {i + 1}</td>
                            <td className="py-1.5 text-ink-2 tabular-nums">{t.moq_min}</td>
                            <td className="py-1.5 font-mono text-ink">{formatPrice(t.price_per_unit)}</td>
                            <td className="py-1.5 text-ink-3">{rate.lead_time_days != null ? `${rate.lead_time_days}d` : '—'}</td>
                            <td className="py-1.5 text-ink-3">{t.valid_till ? formatDate(t.valid_till) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="text-[11px] text-ink-4">Updated {updatedAgoLabel(item.updatedAt)}</p>
              </div>
              <div className="px-5 py-3 border-t border-hairline bg-surface-3 flex gap-2 justify-end">
                <button onClick={() => setViewingRate(null)} className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2">Close</button>
                <button
                  onClick={() => {
                    setViewingRate(null);
                    openEditRate(item, rate);
                  }}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-bold"
                >
                  ✏ Edit
                </button>
              </div>
            </div>
          </ModalOverlay>
        );
      })()}

      {/* Edit tier modal */}
      {editingTier && (
        <ModalOverlay onClose={() => setEditingTier(null)} z="z-50" dismissable={false} backdrop="default" align="start" scroll={true} className="p-6">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md my-4" role="dialog" aria-modal="true" aria-labelledby="edit-tier-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline bg-surface-3 flex items-center justify-between">
              <span id="edit-tier-modal-title" className="text-sm font-bold text-ink">Edit tier — {editingTier.item.name}</span>
              <button onClick={() => setEditingTier(null)} className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-ink-3 hover:bg-surface-3">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">MOQ min</label>
                  <input type="number" min={1} value={editTierMoqMin} onChange={(e) => setEditTierMoqMin(e.target.value)} className="w-full px-2.5 py-2 border border-border rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">MOQ max (optional)</label>
                  <input type="number" min={1} value={editTierMoqMax} onChange={(e) => setEditTierMoqMax(e.target.value)} placeholder="—" className="w-full px-2.5 py-2 border border-border rounded-lg text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Price per unit</label>
                <input type="number" step="0.01" value={editTierPrice} onChange={(e) => setEditTierPrice(e.target.value)} className="w-full px-2.5 py-2 border border-border rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Valid till</label>
                <input type="date" value={editTierValidTill} onChange={(e) => setEditTierValidTill(e.target.value)} className="w-full px-2.5 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-ink-3 uppercase mb-1">Note</label>
                <input type="text" value={editTierNote} onChange={(e) => setEditTierNote(e.target.value)} placeholder="Optional" className="w-full px-2.5 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-hairline bg-surface-3 flex gap-2 justify-between">
              <button
                type="button"
                onClick={handleDeleteTier}
                disabled={submittingEditTier}
                className="px-3 py-2 rounded-lg border border-[color:var(--st-red-fg)]/30 bg-surface text-err text-xs font-bold hover:bg-err-soft disabled:opacity-50"
              >
                Delete tier
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingTier(null)} className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-ink-2 hover:bg-surface-2">Cancel</button>
                <button onClick={handleUpdateTier} disabled={submittingEditTier} className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-bold disabled:opacity-50">
                  {submittingEditTier ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

export default ItemsList;
