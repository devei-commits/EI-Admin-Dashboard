import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import RmMasterTypeahead from '../components/RmMasterTypeahead';
import { buildRmTypeaheadOptions, rmTypeaheadLabelForId } from '../lib/rmTypeahead';
import { fetchSwapHistory, fetchAffected, saveSwapDraft, finalizeSwap, fetchHistoryAffected } from '../services/universalSwap.service';
import type { SwapHistoryRecord, AffectedItemGroup, AffectedBom, HistoryAffectedResponse } from '../services/universalSwap.service';
import { searchUsers } from '../services/user.service';
import type { UserSearchHit } from '../services/user.service';
import { TableSkeleton, SkeletonText } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

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

  // Draft-first flow: save as draft (no changes applied), then Finalize to execute the swap.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
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

  // Can't swap an item to itself — exclude the other side's selection from each picker's suggestions.
  const fromRmOptions = useMemo(() => rmOptions.filter((o) => o.id !== toRawMaterialId), [rmOptions, toRawMaterialId]);
  const toRmOptions = useMemo(() => rmOptions.filter((o) => o.id !== fromRawMaterialId), [rmOptions, fromRawMaterialId]);

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

  const validateSwapForm = (): boolean => {
    if (!fromRawMaterialId || !toRawMaterialId) {
      addToast('error', 'Please select both FROM and TO raw materials');
      return false;
    }
    if (fromRawMaterialId === toRawMaterialId) {
      addToast('error', 'FROM and TO raw materials must be different');
      return false;
    }
    if (!formData.reason.trim()) {
      addToast('error', 'Reason is required');
      return false;
    }
    if (!formData.approvedBy.trim()) {
      addToast('error', 'Please select an approver from the list');
      return false;
    }
    return true;
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

  const resetSwapForm = () => {
    setFormData({ fromRawMaterialId: '', toRawMaterialId: '', swapRatio: 1.0, reason: '', approvedBy: '', approvedByUserId: null });
    setApproverQuery('');
    setApproverResults([]);
    setFromQuery('');
    setToQuery('');
    setDraftId(null);
  };

  // Step 1 — save the swap as a draft (nothing applied yet).
  const handleSaveDraft = async () => {
    if (!validateSwapForm()) return;
    if (affectedCount === 0) {
      addToast('error', 'Select at least one item group or PR formula for the swap');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await saveSwapDraft({
        fromRawMaterialId: parseInt(fromRawMaterialId, 10),
        toRawMaterialId: parseInt(toRawMaterialId, 10),
        swapRatio: formData.swapRatio,
        reason: formData.reason.trim(),
        approvedBy: formData.approvedBy.trim(),
        approvedByUserId: formData.approvedByUserId ?? undefined,
        selectedGroupIds: selectedGroups.map((g) => g.id),
        selectedBomIds: selectedBoms.map((b) => b.id),
      });
      if (res.success && res.data) {
        setDraftId(res.data.id);
        addToast('success', 'Saved as draft. Review the affected list, then Finalize to apply.');
        await loadSwapHistory();
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : (res.error as { message?: string })?.message;
        addToast('error', errMsg || 'Failed to save draft');
      }
    } catch (_e) {
      addToast('error', 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Step 2 — finalize the saved draft: execute the swap against the currently-selected groups/BOMs.
  const handleFinalize = async () => {
    if (!draftId) { addToast('error', 'Save the swap as a draft first.'); return; }
    if (affectedCount === 0) {
      addToast('error', 'Select at least one item group or PR formula to finalize.');
      return;
    }
    setApplying(true);
    try {
      const res = await finalizeSwap(draftId, {
        swapRatio: formData.swapRatio,
        selectedGroupIds: selectedGroups.map((g) => g.id),
        selectedBomIds: selectedBoms.map((b) => b.id),
      });
      if (res.success) {
        const d = res.data;
        const parts = [];
        if ((d?.updatedGroupsCount ?? 0) > 0) parts.push(`${d!.updatedGroupsCount} group(s)`);
        if ((d?.updatedBomsCount ?? 0) > 0) parts.push(`${d!.updatedBomsCount} BOM(s)`);
        addToast('success', `Swap finalized. ${parts.length ? parts.join(', ') + ' updated.' : 'Done.'}`);
        await loadSwapHistory();
        resetSwapForm();
        setItemGroups([]);
        setBoms([]);
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : (res.error as { message?: string })?.message;
        addToast('error', errMsg || 'Failed to finalize swap');
      }
    } catch (_e) {
      addToast('error', 'Failed to finalize swap');
    } finally {
      setApplying(false);
    }
  };

  // Finalize a draft directly from the history table (uses the draft's stored selections).
  const [finalizingHistoryId, setFinalizingHistoryId] = useState<string | null>(null);
  const handleFinalizeFromHistory = async (id: string) => {
    setFinalizingHistoryId(id);
    try {
      const res = await finalizeSwap(id);
      if (res.success) {
        addToast('success', 'Draft finalized — swap applied.');
        await loadSwapHistory();
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : (res.error as { message?: string })?.message;
        addToast('error', errMsg || 'Failed to finalize swap');
      }
    } catch (_e) {
      addToast('error', 'Failed to finalize swap');
    } finally {
      setFinalizingHistoryId(null);
    }
  };

  const stats = {
    totalRMs: rawMaterials.length,
    totalIngredients: rawMaterials.length,
    swapHistoryCount: swapHistory.length,
  };

  const statCards = [
    { label: 'RAW MATERIALS', value: stats.totalRMs, sub: 'Swappable ingredients', accent: 'border-l-indigo-500', num: 'text-brand' },
    { label: 'SWAP HISTORY', value: stats.swapHistoryCount, sub: 'Applied swaps', accent: 'border-l-emerald-500', num: 'text-ok' },
    { label: 'TOTAL INGREDIENTS', value: stats.totalIngredients, sub: 'From raw materials table', accent: 'border-l-amber-500', num: 'text-warn' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-indigo-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-soft text-brand border border-brand">Ingredient Operations</span>
            </div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-2">Universal Ingredient Swap</h1>
            <p className="text-sm text-ink-2">Swap a raw material across selected item groups and PR BOMs. Apply-to lists item groups that contain the ingredient.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="group bg-surface rounded-2xl border border-hairline shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-linear-to-r from-indigo-400 to-indigo-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-4 group-hover:text-ink-2 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-ink-4 mt-2 group-hover:text-ink-3 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-hairline bg-linear-to-r from-indigo-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <span className="text-lg"></span>
              <span className="text-sm font-semibold text-ink">New Swap</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fromRawMaterialId" className="block text-xs font-semibold text-ink-2 mb-1.5">
                  SWAP FROM — RAW MATERIAL TO REPLACE
                </label>
                <RmMasterTypeahead
                  options={fromRmOptions}
                  loading={loadingRms}
                  requirePickFromList
                  placeholder="Search raw material by name, INCI, or code…"
                  value={fromQuery || rmTypeaheadLabelForId(rawMaterials, fromRawMaterialId)}
                  selectedId={fromRawMaterialId}
                  onValueChange={setFromQuery}
                  onSelect={(opt) => { setFormData((prev) => ({ ...prev, fromRawMaterialId: opt.id })); setFromQuery(opt.label); setDraftId(null); }}
                  onClearSelection={() => { setFormData((prev) => ({ ...prev, fromRawMaterialId: '' })); setFromQuery(''); setDraftId(null); }}
                />
              </div>

              <div>
                <label htmlFor="toRawMaterialId" className="block text-xs font-semibold text-ink-2 mb-1.5">
                  SWAP TO — REPLACEMENT RAW MATERIAL
                </label>
                <RmMasterTypeahead
                  options={toRmOptions}
                  loading={loadingRms}
                  requirePickFromList
                  placeholder="Search raw material by name, INCI, or code…"
                  value={toQuery || rmTypeaheadLabelForId(rawMaterials, toRawMaterialId)}
                  selectedId={toRawMaterialId}
                  onValueChange={setToQuery}
                  onSelect={(opt) => { setFormData((prev) => ({ ...prev, toRawMaterialId: opt.id })); setToQuery(opt.label); setDraftId(null); }}
                  onClearSelection={() => { setFormData((prev) => ({ ...prev, toRawMaterialId: '' })); setToQuery(''); setDraftId(null); }}
                />
              </div>

              <div>
                <label htmlFor="swapRatio" className="block text-xs font-semibold text-ink-2 mb-1.5">
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
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-[10px] text-ink-4 mt-1">e.g. 0.9 = 90% of original usage becomes replacement (in a product with 60% to 54% new, 6% original)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reason" className="block text-xs font-semibold text-ink-2 mb-1.5">
                  REASON / JUSTIFICATION
                </label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="e.g., Cost optimization, vendor change, regulatory compliance..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div ref={approverContainerRef} className="relative">
                <label htmlFor="approvedBy" className="block text-xs font-semibold text-ink-2 mb-1.5">
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
                    className="w-full border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {formData.approvedBy && !approverDropdownOpen && (
                    <button
                      type="button"
                      onClick={clearApprover}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 p-1"
                      aria-label="Clear approver"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {approverDropdownOpen && (approverQuery.trim() || approverResults.length > 0) && (
                  <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-56 overflow-auto">
                    {approverSearching ? (
                      <div className="px-3 py-4 text-sm text-ink-3">Searching…</div>
                    ) : approverResults.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-ink-3">
                        {approverQuery.trim() ? 'No users found. Try another name or email.' : 'Type a name or email to search.'}
                      </div>
                    ) : (
                      approverResults.map((user) => (
                        <button
                          key={user.userid}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-brand-soft text-sm flex flex-col gap-0.5 border-b border-gray-50 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); selectApprover(user); }}
                        >
                          <span className="font-medium text-ink">{user.display_name}</span>
                          <span className="text-xs text-ink-3">{user.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-hairline bg-linear-to-r from-blue-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg"></span>
                <span className="text-sm font-semibold text-ink">Apply To / Exempt</span>
              </div>
              {fromRawMaterialId && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-soft text-brand border border-brand">
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
              <SkeletonText lines={4} className="py-4" />
            ) : itemGroups.length === 0 && boms.length === 0 && fromRawMaterialId ? (
              <EmptyState compact title="No item groups or PR formulas use this raw material." />
            ) : !fromRawMaterialId ? (
              <p className="text-sm text-ink-3 py-4">Select a &quot;From&quot; raw material to see affected item groups and PR formulas.</p>
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
                              willBeAffected ? 'border-violet-300 bg-violet-50/50' : 'border-border bg-surface-2/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={g.selected}
                              onChange={() => toggleGroup(g.id)}
                              className="w-4 h-4 rounded border-border text-violet-600 focus:ring-2 focus:ring-violet-400"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink text-sm">{g.name || g.code}</span>
                                {willBeAffected && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                    WILL SWAP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-ink-3 font-mono">{g.code}</span>
                                <span className="text-xs text-ink-4">·</span>
                                <span className="text-xs text-ink-3">{g.member_ids?.length ?? 0} members</span>
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
                              willBeAffected ? 'border-warn bg-warn-soft/50' : 'border-border bg-surface-2/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={bom.selected}
                              onChange={() => toggleBom(bom.id)}
                              className="w-4 h-4 rounded border-border text-warn focus:ring-2 focus:ring-amber-400"
                            />
                            <span className="text-warn shrink-0" aria-hidden></span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink text-sm">
                                  {bom.product_name || bom.name || bom.bom_code}
                                </span>
                                {willBeAffected && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warn-soft text-warn border border-warn">
                                    WILL SWAP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-ink-3 font-mono">{bom.bom_code}</span>
                                {bom.product_name && bom.name && bom.name !== bom.bom_code && (
                                  <>
                                    <span className="text-xs text-ink-4">·</span>
                                    <span className="text-xs text-ink-3">{bom.name}</span>
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

            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-hairline">
              <button
                onClick={handleSaveDraft}
                disabled={!fromRawMaterialId || !toRawMaterialId || affectedCount === 0 || savingDraft}
                className="px-5 py-2 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingDraft ? 'Saving…' : draftId ? 'Update Draft' : 'Save as Draft'}
              </button>
              <button
                onClick={handleFinalize}
                disabled={!draftId || affectedCount === 0 || applying}
                title={!draftId ? 'Save the swap as a draft first' : undefined}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {applying ? 'Finalizing…' : 'Finalize Swap'}
              </button>
              {draftId ? (
                <span className="text-xs text-amber-600 font-medium ml-2">
                  Draft saved — {selectedGroups.length} group(s), {selectedBoms.length} PR(s) selected. Finalize to apply.
                </span>
              ) : (
                <span className="text-xs text-gray-400 ml-2">Save as a draft first, then Finalize to apply the swap.</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-hairline bg-linear-to-r from-emerald-50/50 to-transparent">
            <span className="text-sm font-semibold text-ink">Swap History</span>
          </div>

          {loadingHistory ? (
            <div className="p-6"><TableSkeleton rows={5} cols={7} /></div>
          ) : swapHistory.length === 0 ? (
            <EmptyState compact title="No swap history yet." />
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-20">
                  <tr className="[&_th]:bg-surface-2 border-b border-hairline bg-linear-to-r from-slate-50/70 to-transparent">
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">Date</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">From / To</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">Ratio</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">Reason</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">Approved By</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">Affected Groups</th>
                    <th scope="col" className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-ink-2">PRs Affected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {swapHistory.map((swap) => (
                    <tr key={swap.id} className="hover:bg-linear-to-r hover:from-emerald-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3.5 text-ink-2 whitespace-nowrap text-sm font-medium">{swap.date}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-red-600 group-hover:text-red-700">{swap.fromIngredient}</span>
                          <span className="text-gray-400">/</span>
                          <span className="font-semibold text-emerald-600 group-hover:text-emerald-700">{swap.toIngredient}</span>
                          {swap.status === 'draft'
                            ? <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">DRAFT</span>
                            : <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">APPLIED</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-mono">{Number(swap.swapRatio).toFixed(2)}</td>
                      <td className="px-4 py-3 text-ink-2 max-w-xs truncate" title={swap.reason}>{swap.reason}</td>
                      <td className="px-4 py-3 text-ink-2">{swap.approvedBy}</td>
                      <td className="px-4 py-3 text-ink-2">
                        {(swap.affectedGroupIds?.length ?? 0) > 0
                          ? `${swap.affectedGroupIds!.length} group(s)`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openHistoryModal(swap)}
                            className="inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                          >
                            View PRs
                          </button>
                          {swap.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleFinalizeFromHistory(swap.id)}
                              disabled={finalizingHistoryId === swap.id}
                              className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors"
                            >
                              {finalizingHistoryId === swap.id ? '…' : 'Finalize'}
                            </button>
                          )}
                        </div>
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
            <div className="bg-surface rounded-2xl shadow-xl max-w-3xl w-full mx-4 border border-hairline" role="dialog" aria-modal="true" aria-labelledby="swap-history-modal-title">
              <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Swap History · PRs Affected</p>
                  <p id="swap-history-modal-title" className="text-sm font-semibold text-ink mt-1">
                    {historyModal.swap.fromIngredient} → {historyModal.swap.toIngredient}{' '}
                    <span className="text-xs text-ink-3 ml-1">(ratio {Number(historyModal.swap.swapRatio).toFixed(2)})</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryModal(null)}
                  className="p-1.5 rounded-full hover:bg-surface-3 text-ink-3 hover:text-ink-2"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 border-b border-hairline text-xs text-ink-2 space-y-1">
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
                  <SkeletonText lines={4} className="py-6" />
                ) : historyModal.boms.length === 0 ? (
                  <EmptyState compact title="No PR BOMs were recorded as affected for this swap entry." />
                ) : (
                  <div className="space-y-2">
                    {historyModal.boms.map((bom) => (
                      <div
                        key={bom.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-ok bg-ok-soft/50"
                      >
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-ok flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {bom.product_name || bom.name || bom.bom_code}
                          </p>
                          <p className="text-[11px] text-ink-3 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
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

              <div className="px-5 py-3 border-t border-hairline flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryModal(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-2 hover:bg-surface-2"
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
