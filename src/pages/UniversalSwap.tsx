import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import RmMasterTypeahead from '../components/RmMasterTypeahead';
import { buildRmTypeaheadOptions, rmTypeaheadLabelForId } from '../lib/rmTypeahead';
import { fetchSwapHistory, fetchAffected, applySwap, fetchHistoryAffected } from '../services/universalSwap.service';
import type { SwapHistoryRecord, AffectedItemGroup, AffectedBom, HistoryAffectedResponse } from '../services/universalSwap.service';
import { searchUsers } from '../services/user.service';
import type { UserSearchHit } from '../services/user.service';

type GroupSelection = AffectedItemGroup & { selected: boolean };
type BomSelection = AffectedBom & { selected: boolean };

const UniversalSwap: React.FC = () => {
  const { addToast } = useToast();
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [itemGroups, setItemGroups] = useState<GroupSelection[]>([]);
  const [boms, setBoms] = useState<BomSelection[]>([]);
  const [swapHistory, setSwapHistory] = useState<SwapHistoryRecord[]>([]);
  const [loadingRms, setLoadingRms] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [applying, setApplying] = useState(false);

  const [formData, setFormData] = useState({
    fromRawMaterialId: '' as string | number,
    toRawMaterialId: '' as string | number,
    swapRatio: 1.0,
    reason: '',
    approvedBy: '',
    approvedByUserId: null as number | null,
  });

  const [approverQuery, setApproverQuery] = useState('');
  const [approverDropdownOpen, setApproverDropdownOpen] = useState(false);
  const [approverResults, setApproverResults] = useState<UserSearchHit[]>([]);
  const [approverSearching, setApproverSearching] = useState(false);
  const approverBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approverContainerRef = useRef<HTMLDivElement>(null);

  const [showPreview, setShowPreview] = useState(false);
  // Filter for the "Apply To / Exempt" PR list — it can run to hundreds of rows for a common RM.
  const [bomQuery, setBomQuery] = useState('');

  // Searchable RM suggestions for the From/To pickers (replaces the long plain <select> lists).
  const rmOptions = useMemo(() => buildRmTypeaheadOptions(rawMaterials), [rawMaterials]);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');

  const [historyModal, setHistoryModal] = useState<{ swap: SwapHistoryRecord; boms: AffectedBom[] } | null>(null);
  const [loadingHistoryModal, setLoadingHistoryModal] = useState(false);

  const loadRawMaterials = useCallback(async () => {
    setLoadingRms(true);
    try {
      const list = await fetchRawMaterialsList();
      setRawMaterials(list ?? []);
    } catch (_e) {
      setRawMaterials([]);
      addToast('error', 'Failed to load raw materials');
    } finally {
      setLoadingRms(false);
    }
  }, [addToast]);

  const loadSwapHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetchSwapHistory();
      if (res.success && res.data) setSwapHistory(res.data);
      else setSwapHistory([]);
    } catch (_e) {
      setSwapHistory([]);
      addToast('error', 'Failed to load swap history');
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadRawMaterials();
    loadSwapHistory();
  }, [loadRawMaterials, loadSwapHistory]);

  // Debounced user search for approver
  useEffect(() => {
    const q = approverQuery.trim();
    if (!q) {
      setApproverResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setApproverSearching(true);
      const res = await searchUsers(q);
      setApproverSearching(false);
      if (res.success && res.data) setApproverResults(res.data);
      else setApproverResults([]);
    }, 300);
    return () => clearTimeout(t);
  }, [approverQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (approverContainerRef.current && !approverContainerRef.current.contains(e.target as Node)) {
        setApproverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectApprover = (user: UserSearchHit) => {
    setFormData((prev) => ({
      ...prev,
      approvedBy: user.display_name,
      approvedByUserId: user.userid,
    }));
    setApproverQuery('');
    setApproverResults([]);
    setApproverDropdownOpen(false);
  };

  const clearApprover = () => {
    setFormData((prev) => ({ ...prev, approvedBy: '', approvedByUserId: null }));
    setApproverQuery('');
    setApproverResults([]);
    setApproverDropdownOpen(false);
  };

  const fromRawMaterialId = formData.fromRawMaterialId ? String(formData.fromRawMaterialId) : '';
  const toRawMaterialId = formData.toRawMaterialId ? String(formData.toRawMaterialId) : '';

  useEffect(() => {
    setBomQuery('');
    if (!fromRawMaterialId) {
      setItemGroups([]);
      setBoms([]);
      return;
    }
    setLoadingItems(true);
    fetchAffected(fromRawMaterialId)
      .then((res) => {
        if (res.success && res.data) {
          setItemGroups((res.data.itemGroups ?? []).map((g) => ({ ...g, selected: true })));
          setBoms((res.data.boms ?? []).map((b) => ({ ...b, selected: true })));
        } else {
          setItemGroups([]);
          setBoms([]);
        }
      })
      .catch(() => {
        setItemGroups([]);
        setBoms([]);
      })
      .finally(() => setLoadingItems(false));
  }, [fromRawMaterialId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === 'swapRatio' ? parseFloat(value) || 1 : value,
    }));
  };

  const toggleGroup = (id: string) => {
    setItemGroups((prev) => prev.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g)));
  };
  const toggleBom = (id: string) => {
    setBoms((prev) => prev.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b)));
  };

  const handlePreview = () => {
    if (!fromRawMaterialId || !toRawMaterialId) {
      addToast('error', 'Please select both FROM and TO raw materials');
      return;
    }
    setShowPreview(true);
  };

  const selectedGroups = itemGroups.filter((g) => g.selected);
  const selectedBoms = boms.filter((b) => b.selected);
  const affectedCount = selectedGroups.length + selectedBoms.length;

  const filteredBoms = useMemo(() => {
    const q = bomQuery.trim().toLowerCase();
    if (!q) return boms;
    return boms.filter((b) =>
      [b.product_name, b.name, b.bom_code].some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [boms, bomQuery]);

  /** Select / clear only the PRs currently visible under the filter, so a search narrows the bulk action. */
  const setAllVisibleBoms = (selected: boolean) => {
    const visibleIds = new Set(filteredBoms.map((b) => b.id));
    setBoms((prev) => prev.map((b) => (visibleIds.has(b.id) ? { ...b, selected } : b)));
  };

  const openHistoryModal = async (swap: SwapHistoryRecord) => {
    setLoadingHistoryModal(true);
    try {
      const res = await fetchHistoryAffected(swap.id);
      if (res.success && res.data) {
        setHistoryModal({ swap, boms: (res.data as HistoryAffectedResponse).boms ?? [] });
      } else {
        setHistoryModal({ swap, boms: [] });
      }
    } catch (_e) {
      addToast('error', 'Failed to load affected PRs for this swap');
      setHistoryModal({ swap, boms: [] });
    } finally {
      setLoadingHistoryModal(false);
    }
  };

  const handleApplySwap = async () => {
    if (!formData.reason.trim()) {
      addToast('error', 'Reason is required');
      return;
    }
    if (!formData.approvedBy.trim()) {
      addToast('error', 'Please select an approver from the list');
      return;
    }
    if (!fromRawMaterialId || !toRawMaterialId) {
      addToast('error', 'Please select both FROM and TO raw materials');
      return;
    }
    if (affectedCount === 0) {
      addToast('error', 'Select at least one item group or PR formula to apply the swap');
      return;
    }

    setApplying(true);
    try {
      const res = await applySwap({
        fromRawMaterialId: parseInt(fromRawMaterialId, 10),
        toRawMaterialId: parseInt(toRawMaterialId, 10),
        swapRatio: formData.swapRatio,
        reason: formData.reason.trim(),
        approvedBy: formData.approvedBy.trim(),
        approvedByUserId: formData.approvedByUserId ?? undefined,
        selectedGroupIds: selectedGroups.map((g) => g.id),
        selectedBomIds: selectedBoms.map((b) => b.id),
      });
      if (res.success) {
        const d = res.data;
        const parts = [];
        if ((d?.updatedGroupsCount ?? 0) > 0) parts.push(`${d!.updatedGroupsCount} group(s)`);
        if ((d?.updatedBomsCount ?? 0) > 0) parts.push(`${d!.updatedBomsCount} BOM(s)`);
        addToast('success', `Swap applied globally. ${parts.length ? parts.join(', ') + ' updated.' : 'Done.'}`);
        await loadSwapHistory();
        setFormData({
          fromRawMaterialId: '',
          toRawMaterialId: '',
          swapRatio: 1.0,
          reason: '',
          approvedBy: '',
          approvedByUserId: null,
        });
        setApproverQuery('');
        setApproverResults([]);
        setFromQuery('');
        setToQuery('');
        setShowPreview(false);
        if (fromRawMaterialId) {
          const affRes = await fetchAffected(fromRawMaterialId);
          if (affRes.success && affRes.data) {
            setItemGroups((affRes.data.itemGroups ?? []).map((g) => ({ ...g, selected: true })));
            setBoms((affRes.data.boms ?? []).map((b) => ({ ...b, selected: true })));
          }
        }
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : (res.error as { message?: string })?.message;
        addToast('error', errMsg || 'Failed to apply swap');
      }
    } catch (_e) {
      addToast('error', 'Failed to apply swap');
    } finally {
      setApplying(false);
    }
  };

  const stats = {
    totalRMs: rawMaterials.length,
    totalIngredients: rawMaterials.length,
    swapHistoryCount: swapHistory.length,
  };

  const statCards = [
    { label: 'RAW MATERIALS', value: stats.totalRMs, sub: 'Swappable ingredients', accent: 'border-l-indigo-500', num: 'text-indigo-600' },
    { label: 'SWAP HISTORY', value: stats.swapHistoryCount, sub: 'Applied swaps', accent: 'border-l-emerald-500', num: 'text-emerald-600' },
    { label: 'TOTAL INGREDIENTS', value: stats.totalIngredients, sub: 'From raw materials table', accent: 'border-l-amber-500', num: 'text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-indigo-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Ingredient Operations</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Universal Ingredient Swap</h1>
            <p className="text-sm text-gray-600">Swap a raw material across selected item groups and PR BOMs. Apply-to lists item groups that contain the ingredient.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-linear-to-r from-indigo-400 to-indigo-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-indigo-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <span className="text-lg"></span>
              <span className="text-sm font-semibold text-gray-800">New Swap</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fromRawMaterialId" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  SWAP FROM — RAW MATERIAL TO REPLACE
                </label>
                <RmMasterTypeahead
                  options={rmOptions}
                  loading={loadingRms}
                  requirePickFromList
                  placeholder="Search raw material by name, INCI, or code…"
                  value={fromQuery || rmTypeaheadLabelForId(rawMaterials, fromRawMaterialId)}
                  selectedId={fromRawMaterialId}
                  onValueChange={setFromQuery}
                  onSelect={(opt) => { setFormData((prev) => ({ ...prev, fromRawMaterialId: opt.id })); setFromQuery(opt.label); }}
                  onClearSelection={() => { setFormData((prev) => ({ ...prev, fromRawMaterialId: '' })); setFromQuery(''); }}
                />
              </div>

              <div>
                <label htmlFor="toRawMaterialId" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  SWAP TO — REPLACEMENT RAW MATERIAL
                </label>
                <RmMasterTypeahead
                  options={rmOptions}
                  loading={loadingRms}
                  requirePickFromList
                  placeholder="Search raw material by name, INCI, or code…"
                  value={toQuery || rmTypeaheadLabelForId(rawMaterials, toRawMaterialId)}
                  selectedId={toRawMaterialId}
                  onValueChange={setToQuery}
                  onSelect={(opt) => { setFormData((prev) => ({ ...prev, toRawMaterialId: opt.id })); setToQuery(opt.label); }}
                  onClearSelection={() => { setFormData((prev) => ({ ...prev, toRawMaterialId: '' })); setToQuery(''); }}
                />
              </div>

              <div>
                <label htmlFor="swapRatio" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  SWAP RATIO
                </label>
                <input
                  type="number"
                  id="swapRatio"
                  value={formData.swapRatio}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">e.g. 0.9 = 90% of original usage becomes replacement (in a product with 60% to 54% new, 6% original)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reason" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  REASON / JUSTIFICATION
                </label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="e.g., Cost optimization, vendor change, regulatory compliance..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div ref={approverContainerRef} className="relative">
                <label htmlFor="approvedBy" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  APPROVED BY
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="approvedBy"
                    value={approverDropdownOpen ? approverQuery : formData.approvedBy}
                    onChange={(e) => {
                      setApproverQuery(e.target.value);
                      setApproverDropdownOpen(true);
                      if (!e.target.value) clearApprover();
                    }}
                    onFocus={() => {
                      if (approverQuery.trim()) setApproverDropdownOpen(true);
                    }}
                    onBlur={() => {
                      approverBlurRef.current = setTimeout(() => setApproverDropdownOpen(false), 150);
                    }}
                    placeholder="Type to search users..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {formData.approvedBy && !approverDropdownOpen && (
                    <button
                      type="button"
                      onClick={clearApprover}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Clear approver"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {approverDropdownOpen && (approverQuery.trim() || approverResults.length > 0) && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {approverSearching ? (
                      <div className="px-3 py-4 text-sm text-gray-500">Searching…</div>
                    ) : approverResults.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500">
                        {approverQuery.trim() ? 'No users found. Try another name or email.' : 'Type a name or email to search.'}
                      </div>
                    ) : (
                      approverResults.map((user) => (
                        <button
                          key={user.userid}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex flex-col gap-0.5 border-b border-gray-50 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); selectApprover(user); }}
                        >
                          <span className="font-medium text-gray-900">{user.display_name}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-blue-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg"></span>
                <span className="text-sm font-semibold text-gray-900">Apply To / Exempt</span>
              </div>
              {fromRawMaterialId && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {loadingItems ? 'Loading…' : `${selectedGroups.length} group(s), ${selectedBoms.length} PR(s) selected`}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            <p className="text-xs text-gray-500 mb-3">
              Item groups and PR formulas (BOMs) that contain the &quot;From&quot; ingredient. Everything is selected by default — untick anything that should be exempt. The swap applies to the selected groups and PR formulas only (ratio applied in each formula).
            </p>

            {loadingItems ? (
              <p className="text-sm text-gray-500 py-4">Loading…</p>
            ) : itemGroups.length === 0 && boms.length === 0 && fromRawMaterialId ? (
              <p className="text-sm text-gray-500 py-4">No item groups or PR formulas use this raw material.</p>
            ) : !fromRawMaterialId ? (
              <p className="text-sm text-gray-500 py-4">Select a &quot;From&quot; raw material to see affected item groups and PR formulas.</p>
            ) : (
              <div className="space-y-4">
                {itemGroups.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                      Item Groups <span className="text-gray-400 font-semibold">({itemGroups.length})</span>
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 overscroll-contain">
                      {itemGroups.map((g) => {
                        const willBeAffected = g.selected;
                        return (
                          <div
                            key={g.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              willBeAffected ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-gray-50/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={g.selected}
                              onChange={() => toggleGroup(g.id)}
                              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-2 focus:ring-violet-400"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 text-sm">{g.name || g.code}</span>
                                {willBeAffected && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                    WILL SWAP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 font-mono">{g.code}</span>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">{g.member_ids?.length ?? 0} members</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {boms.length > 0 && (
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        PR formulas (BOMs){' '}
                        <span className="text-gray-400 font-semibold">
                          ({selectedBoms.length}/{boms.length} selected
                          {bomQuery.trim() ? `, ${filteredBoms.length} shown` : ''})
                        </span>
                      </p>
                      <div className="flex-1" />
                      <input
                        type="text"
                        value={bomQuery}
                        onChange={(e) => setBomQuery(e.target.value)}
                        placeholder="Search PR / BOM code…"
                        className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg w-48 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setAllVisibleBoms(true)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllVisibleBoms(false)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    {filteredBoms.length === 0 ? (
                      <p className="text-sm text-gray-500 py-3">No PR formulas match &quot;{bomQuery}&quot;.</p>
                    ) : (
                    <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1 overscroll-contain">
                      {filteredBoms.map((bom) => {
                        const willBeAffected = bom.selected;
                        return (
                          <div
                            key={bom.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              willBeAffected ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-gray-50/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={bom.selected}
                              onChange={() => toggleBom(bom.id)}
                              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-2 focus:ring-amber-400"
                            />
                            <span className="text-amber-600 shrink-0" aria-hidden></span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 text-sm">
                                  {bom.product_name || bom.name || bom.bom_code}
                                </span>
                                {willBeAffected && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    WILL SWAP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 font-mono">{bom.bom_code}</span>
                                {bom.product_name && bom.name && bom.name !== bom.bom_code && (
                                  <>
                                    <span className="text-xs text-gray-400">·</span>
                                    <span className="text-xs text-gray-500">{bom.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-100">
              <button
                onClick={handlePreview}
                disabled={!fromRawMaterialId || !toRawMaterialId}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handleApplySwap}
                disabled={!showPreview || affectedCount === 0 || applying}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {applying ? 'Applying…' : 'Apply Swap'}
              </button>
              {showPreview && (
                <span className="text-xs text-emerald-600 font-medium ml-2">
                  Preview ready — {selectedGroups.length} group(s), {selectedBoms.length} PR(s) (ratio applied in formulas)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-emerald-50/50 to-transparent">
            <span className="text-sm font-semibold text-gray-900">Swap History</span>
          </div>

          {loadingHistory ? (
            <div className="p-6 text-sm text-gray-500">Loading history…</div>
          ) : swapHistory.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No swap history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Date</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">From / To</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Ratio</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Approved By</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Affected Groups</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">PRs Affected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {swapHistory.map((swap) => (
                    <tr key={swap.id} className="hover:bg-linear-to-r hover:from-emerald-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-sm font-medium">{swap.date}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-red-600 group-hover:text-red-700">{swap.fromIngredient}</span>
                          <span className="text-gray-400">/</span>
                          <span className="font-semibold text-emerald-600 group-hover:text-emerald-700">{swap.toIngredient}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{Number(swap.swapRatio).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={swap.reason}>{swap.reason}</td>
                      <td className="px-4 py-3 text-gray-600">{swap.approvedBy}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {(swap.affectedGroupIds?.length ?? 0) > 0
                          ? `${swap.affectedGroupIds!.length} group(s)`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <button
                          type="button"
                          onClick={() => openHistoryModal(swap)}
                          className="inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                        >
                          View PRs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {historyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Swap History · PRs Affected</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {historyModal.swap.fromIngredient} → {historyModal.swap.toIngredient}{' '}
                    <span className="text-xs text-gray-500 ml-1">(ratio {Number(historyModal.swap.swapRatio).toFixed(2)})</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryModal(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 border-b border-gray-100 text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold">Reason:</span> {historyModal.swap.reason || '—'}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <span className="font-semibold">Date:</span> {historyModal.swap.date || '—'}
                  </span>
                  <span>
                    <span className="font-semibold">Approved By:</span> {historyModal.swap.approvedBy || '—'}
                  </span>
                </p>
              </div>

              <div className="px-5 py-4 max-h-96 overflow-y-auto">
                {loadingHistoryModal ? (
                  <div className="py-6 text-sm text-gray-500">Loading PRs affected…</div>
                ) : historyModal.boms.length === 0 ? (
                  <div className="py-6 text-sm text-gray-500">
                    No PR BOMs were recorded as affected for this swap entry.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyModal.boms.map((bom) => (
                      <div
                        key={bom.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/50"
                      >
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {bom.product_name || bom.name || bom.bom_code}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="font-mono">{bom.bom_code}</span>
                            {bom.name && bom.name !== bom.bom_code && (
                              <span>{bom.name}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryModal(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UniversalSwap;
