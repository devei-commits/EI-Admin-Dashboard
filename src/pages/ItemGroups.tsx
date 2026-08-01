import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import {
  fetchItemGroupsPage,
  fetchNextItemGroupCode,
  createItemGroup,
  updateItemGroup,
  type ItemGroupRecord,
  type CreateItemGroupPayload,
  type ItemGroupAlternate,
} from '../services/itemGroups.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';
import { fetchWarehouseInventory, type WarehouseInventoryRow } from '../services/warehouseInventory.service';
import RmMasterTypeahead from '../components/RmMasterTypeahead';
import { buildRmTypeaheadOptions, rmTypeaheadLabelForId } from '../lib/rmTypeahead';

const EMPTY_FORM = {
  name: '',
  type: 'RM' as 'RM' | 'PM',
  primaryItemId: '',
  code: '',
  icon: '',
  description: '',
  rationale: '',
};

type EditMemberRow = {
  id: number;
  code: string;
  sku: string;
  name: string;
};

const ItemGroups: React.FC = () => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedGroup, setSelectedGroup] = useState<ItemGroupRecord | null>(null);
  const [editingGroup, setEditingGroup] = useState<ItemGroupRecord | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; purpose: string; notes: string; status: string; member_ids: number[]; proposedAlternates: ItemGroupAlternate[] }>({ name: '', description: '', purpose: '', notes: '', status: 'Active', member_ids: [], proposedAlternates: [] });
  const [saving, setSaving] = useState(false);
  const [primaryRmQuery, setPrimaryRmQuery] = useState('');
  const [memberRmFilter, setMemberRmFilter] = useState('');
  const [alternateRmQuery, setAlternateRmQuery] = useState('');
  const [editSubmitStep, setEditSubmitStep] = useState<'form' | 'preview'>('form');
  const [createSubmitStep, setCreateSubmitStep] = useState<'form' | 'preview'>('form');

  useEffect(() => {
    setMastersLoading(true);
    Promise.all([fetchRawMaterialsList(), fetchPackMaterialsList()])
      .then(([rms, pms]) => {
        setRawMaterials(rms ?? []);
        setPackMaterials(pms ?? []);
      })
      .finally(() => setMastersLoading(false));
  }, []);

  useEffect(() => {
    // Reset to page 1 when filters change.
    setCurrentPage(1);
  }, [typeFilter, searchQuery]);

  const offset = (currentPage - 1) * pageSize;
  const apiType = typeFilter === 'All' ? undefined : typeFilter;
  const trimmedSearch = searchQuery.trim();

  const { data: itemGroupsPage, isLoading: loading, error } = useQuery({
    queryKey: ['item-groups-page', apiType, trimmedSearch, pageSize, offset],
    queryFn: () =>
      fetchItemGroupsPage({
        type: apiType,
        search: trimmedSearch || undefined,
        limit: pageSize,
        offset,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: warehouseInventoryData } = useQuery({
    queryKey: ['warehouse-inventory-for-item-groups'],
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      return res.data?.rows ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const primaryItemOptions = useMemo(() => {
    if (form.type === 'PM') return packMaterials.map(p => ({ id: p.id, name: p.description || p.code }));
    return rawMaterials.map(r => ({ id: r.id, name: r.name || r.code }));
  }, [form.type, rawMaterials, packMaterials]);

  const rmTypeaheadOptions = useMemo(() => buildRmTypeaheadOptions(rawMaterials), [rawMaterials]);

  const stockByItemKey = useMemo(() => {
    const index = new Map<string, WarehouseInventoryRow>();
    const rows = warehouseInventoryData ?? [];
    for (const row of rows) {
      if (!row?.type || row.sourceId == null) continue;
      index.set(`${row.type}:${row.sourceId}`, row);
    }
    return index;
  }, [warehouseInventoryData]);

  const alternateRmTypeaheadOptions = useMemo(() => {
    const excludeIds = new Set([
      ...editForm.member_ids.map((id) => String(id)),
      ...editForm.proposedAlternates.map((a) => String(a.item_id)),
    ]);
    return buildRmTypeaheadOptions(rawMaterials, { excludeIds });
  }, [rawMaterials, editForm.member_ids, editForm.proposedAlternates]);

  useEffect(() => {
    if (!showCreateModal) return;
    fetchNextItemGroupCode(form.type).then(res => {
      if (res.success && res.data?.nextCode) setForm(f => ({ ...f, code: res.data!.nextCode }));
    });
  }, [showCreateModal, form.type]);

  useEffect(() => {
    if (!showCreateModal) {
      setPrimaryRmQuery('');
      return;
    }
    if (form.type === 'RM' && form.primaryItemId) {
      setPrimaryRmQuery(rmTypeaheadLabelForId(rawMaterials, form.primaryItemId));
    } else if (form.type !== 'RM') {
      setPrimaryRmQuery('');
    }
  }, [showCreateModal, form.type, form.primaryItemId, rawMaterials]);

  const closeCreateModal = (): void => {
    setForm(EMPTY_FORM);
    setPrimaryRmQuery('');
    setCreateSubmitStep('form');
    setShowCreateModal(false);
  };

  const requestCreatePreview = (): void => {
    if (!form.name.trim()) {
      addToast('error', 'Group name is required.');
      return;
    }
    setCreateSubmitStep('preview');
  };

  const handleCreateGroup = async () => {
    if (!form.name.trim()) return;
    const code = form.code?.trim() || (form.type === 'PM' ? 'IG-PM-001' : 'IG-001');
    const member_ids = form.primaryItemId ? [parseInt(form.primaryItemId, 10)] : [];
    const payload: CreateItemGroupPayload = {
      code,
      icon: form.icon || undefined,
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      purpose: form.rationale.trim() || undefined,
      notes: form.rationale.trim() || undefined,
      status: 'Active',
      member_ids,
    };
    const res = await createItemGroup(payload);
    if (res.success && res.data) {
      setSelectedGroup(res.data);
      queryClient.invalidateQueries({ queryKey: ['item-groups-page'] });
      closeCreateModal();
      addToast('success', `Item Group "${res.data.name}" created`);
    } else {
      addToast('error', res.error?.message ?? 'Failed to create group');
    }
  };

  const closeDetailPanel = (): void => {
    setSelectedGroup(null);
    setEditingGroup(null);
    setEditSubmitStep('form');
    setMemberRmFilter('');
    setAlternateRmQuery('');
  };

  const openEdit = (group: ItemGroupRecord) => {
    setMemberRmFilter('');
    setAlternateRmQuery('');
    setEditSubmitStep('form');
    setEditingGroup(group);
    const alts = Array.isArray(group.proposedAlternates) ? group.proposedAlternates : [];
    const normalized = alts.map(a => ({
      ...a,
      id: a.id || String(a.item_id ?? ''),
      item_id: a.item_id ?? (a.id != null ? parseInt(String(a.id), 10) : 0),
      code: a.code ?? '',
      name: a.name ?? '',
      notes: a.notes ?? '',
      status: (a.status === 'under-review' ? 'under-review' : 'proposed') as 'proposed' | 'under-review',
    }));
    setEditForm({
      name: group.name,
      description: group.description || '',
      purpose: group.purpose || '',
      notes: group.notes || '',
      status: group.status || 'Active',
      member_ids: group.member_ids ? [...group.member_ids] : [],
      proposedAlternates: normalized,
    });
  };

  const memberPoolForEdit = useMemo((): EditMemberRow[] => {
    if (!editingGroup) return [];
    if (editingGroup.type === 'PM') {
      return packMaterials.map((p) => ({
        id: parseInt(p.id, 10),
        code: p.code,
        sku: '',
        name: p.description || p.code,
      }));
    }
    return rawMaterials.map((r) => ({
      id: parseInt(r.id, 10),
      code: r.code,
      sku: String(r.zohoSkuCode ?? '').trim(),
      name: r.name || r.inci || r.code,
    }));
  }, [editingGroup, rawMaterials, packMaterials]);

  const selectedMembersForEdit = useMemo((): EditMemberRow[] => {
    const byId = new Map(memberPoolForEdit.map((m) => [m.id, m]));
    return editForm.member_ids
      .map((id) => byId.get(id))
      .filter((m): m is EditMemberRow => m != null);
  }, [editForm.member_ids, memberPoolForEdit]);

  const addableMembersForEdit = useMemo((): EditMemberRow[] => {
    const selected = new Set(editForm.member_ids);
    let list = memberPoolForEdit.filter((m) => !selected.has(m.id));
    if (editingGroup?.type === 'RM' && memberRmFilter.trim()) {
      const q = memberRmFilter.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.code.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          String(m.id).includes(q)
      );
    }
    return list;
  }, [memberPoolForEdit, editForm.member_ids, editingGroup?.type, memberRmFilter]);

  const removeEditMember = (id: number): void => {
    setEditForm((prev) => ({ ...prev, member_ids: prev.member_ids.filter((m) => m !== id) }));
  };

  /** RM/PM items that can be added as proposed alternates (not already approved members, not already in proposed list). */
  const availableAlternatesForEdit = useMemo(() => {
    const memberIds = new Set(editForm.member_ids);
    const alternateIds = new Set(editForm.proposedAlternates.map(a => a.item_id));
    return memberPoolForEdit.filter((m) => !memberIds.has(m.id) && !alternateIds.has(m.id));
  }, [memberPoolForEdit, editForm.member_ids, editForm.proposedAlternates]);

  const toggleEditMember = (id: number) => {
    setEditForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(id)
        ? prev.member_ids.filter(m => m !== id)
        : [...prev.member_ids, id],
    }));
  };

  const updateEditAlternate = (index: number, patch: Partial<ItemGroupAlternate>) => {
    setEditForm(prev => ({
      ...prev,
      proposedAlternates: prev.proposedAlternates.map((a, i) => i === index ? { ...a, ...patch } : a),
    }));
  };
  const addEditAlternate = (item: { id: number; code: string; name: string }) => {
    setEditForm(prev => ({
      ...prev,
      proposedAlternates: [...prev.proposedAlternates, { id: String(item.id), item_id: item.id, code: item.code, name: item.name, notes: '', status: 'proposed' as const }],
    }));
  };
  const removeEditAlternate = (index: number) => {
    setEditForm(prev => ({ ...prev, proposedAlternates: prev.proposedAlternates.filter((_, i) => i !== index) }));
  };

  const validateEditBeforeSubmit = (): boolean => {
    if (!editForm.name.trim()) {
      addToast('error', 'Group name is required.');
      return false;
    }
    return true;
  };

  const requestEditPreview = (): void => {
    if (!validateEditBeforeSubmit()) return;
    setEditSubmitStep('preview');
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    if (!validateEditBeforeSubmit()) return;
    setSaving(true);
    const res = await updateItemGroup(editingGroup.id, {
      name: editForm.name,
      description: editForm.description,
      purpose: editForm.purpose,
      notes: editForm.notes,
      status: editForm.status,
      member_ids: editForm.member_ids,
      proposedAlternates: editForm.proposedAlternates.map(a => ({ item_id: a.item_id, notes: a.notes, status: a.status })),
    });
    setSaving(false);
    if (res.success && res.data) {
      setSelectedGroup(res.data);
      setEditingGroup(null);
      setEditSubmitStep('form');
      queryClient.invalidateQueries({ queryKey: ['item-groups-page'] });
      addToast('success', 'Group updated');
    } else {
      addToast('error', res.error?.message ?? 'Failed to update group');
    }
  };

  const itemGroups: ItemGroupRecord[] = itemGroupsPage?.rows ?? [];
  const filtered = itemGroups; // server-side filtered when using pagination

  const stats = {
    totalGroups: itemGroupsPage?.total ?? 0,
    rmGroups: itemGroups.filter(ig => ig.type === 'RM').length,
    pmGroups: itemGroups.filter(ig => ig.type === 'PM').length,
    alternates: itemGroups.reduce((sum, ig) => sum + ig.proposedAlternates.length, 0),
  };

  const statCards = [
    { label: 'TOTAL GROUPS', value: stats.totalGroups, sub: 'RM + PM groups', accent: 'border-l-brand', num: 'text-brand' },
    { label: 'RM GROUPS', value: stats.rmGroups, sub: 'Raw material', accent: 'border-l-brand', num: 'text-brand' },
    { label: 'PM GROUPS', value: stats.pmGroups, sub: 'Packaging', accent: 'border-l-ok', num: 'text-ok' },
    { label: 'ALTERNATES', value: stats.alternates, sub: 'Approved + Proposed', accent: 'border-l-warn', num: 'text-warn' },
  ];

  const totalPages = Math.max(1, Math.ceil(stats.totalGroups / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const renderStockWindow = (groupType: 'RM' | 'PM', memberId: string | number) => {
    const sourceId = Number(memberId);
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      return (
        <div className="mt-1 inline-flex rounded-md border border-border bg-surface-3 px-2 py-1 text-[10px] text-ink-3">
          Stock unavailable
        </div>
      );
    }
    const key = `${groupType}:${sourceId}`;
    const stock = stockByItemKey.get(key);
    if (!stock) {
      return (
        <div className="mt-1 inline-flex rounded-md border border-border bg-surface-3 px-2 py-1 text-[10px] text-ink-3">
          Stock unavailable
        </div>
      );
    }
    return (
      <div className="mt-1 inline-flex items-center gap-2 rounded-md border border-brand-soft bg-brand-soft px-2 py-1 text-[10px] text-brand">
        <span className="font-semibold">Total {stock.stockInHand}</span>
        <span className="text-brand">|</span>
        <span>WH {stock.whStock}</span>
        <span>ML1 {stock.ml1Stock}</span>
        <span>ML2 {stock.ml2Stock}</span>
      </div>
    );
  };

  const detailPanelOpen = selectedGroup != null;
  const detailPanelWide = editingGroup != null;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="flex min-h-screen">
        <main
          className={`flex-1 min-w-0 px-6 md:px-10 py-8 space-y-6 ${
            detailPanelOpen ? 'lg:max-w-none' : 'max-w-400 mx-auto w-full'
          }`}
        >

        <div className="relative">
          <div className="absolute inset-0 bg-brand-soft rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-soft text-brand border border-brand-soft">Item Configuration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-2">Item Groups</h1>
            <p className="text-sm text-ink-3">Manage approved member items (RM/PM from DB) and proposed alternates for supply continuity.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => (
            <div key={card.label} className="group bg-surface rounded-2xl border border-hairline shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-brand ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-4">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num}`}>{card.value}</p>
                <p className="text-[11px] text-ink-4 mt-2">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-hairline bg-surface-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-ink">Item Groups</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-soft text-brand border border-brand-soft">
                {filtered.length} / {stats.totalGroups}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search group…"
                aria-label="Search group"
                className="pl-9 pr-4 py-2 text-xs border border-border rounded-lg bg-surface-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] w-44"
              />
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-surface-3">
                {(['All', 'RM', 'PM'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded ${typeFilter === type ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setCreateSubmitStep('form');
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-xs font-semibold shadow-lg"
              >
                <span className="text-base leading-none">+</span> New Group
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-ink-3">Loading…</div>
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map(ig => (
                <div
                  key={ig.id}
                  className={`p-5 transition-colors cursor-pointer ${
                    selectedGroup?.id === ig.id
                      ? 'bg-brand-soft ring-1 ring-inset ring-brand-soft'
                      : 'hover:bg-surface-2'
                  }`}
                  onClick={() => setSelectedGroup(ig)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="text-lg shrink-0">{ig.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-brand">{ig.code}</span>
                            <span className="text-xs text-ink-3">·</span>
                            <span className="text-xs font-semibold text-ink-2 bg-surface-3 px-1.5 py-0.5 rounded">{ig.type}</span>
                            <h3 className="text-sm font-semibold text-ink">{ig.name}</h3>
                          </div>
                          <p className="text-xs text-ink-3 mt-1">{ig.description}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ig.status === 'Active' ? 'bg-ok-soft text-ok border border-[color:var(--st-green-fg)]/30' : 'bg-surface-3 text-ink-3'}`}>
                      {ig.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base leading-none"></span>
                        <span className="text-xs font-semibold text-ink-3 uppercase">APPROVED MEMBERS ({ig.approvedMembers.length})</span>
                      </div>
                      <ul className="space-y-1">
                        {ig.approvedMembers.map(member => (
                          <li key={member.id} className="flex items-center gap-2 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-warn"></span>
                                <span className="text-ink font-medium">{member.name}</span>
                              </div>
                              {renderStockWindow(ig.type, member.id)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base leading-none"></span>
                        <span className="text-xs font-semibold text-ink-3 uppercase">PROPOSED ALTERNATES ({ig.proposedAlternates.length})</span>
                      </div>
                      {ig.proposedAlternates.length === 0 ? (
                        <p className="text-xs text-ink-4">No proposed alternates yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {ig.proposedAlternates.map(alt => (
                            <li key={alt.id} className="text-xs">
                              <div className="text-ink font-medium">{alt.name}</div>
                              <div className="text-ink-3 text-[10px]">{alt.notes}</div>
                              {renderStockWindow(ig.type, alt.item_id)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {ig.notes && (
                    <div className="mt-3 pt-3 border-t border-hairline">
                      <p className="text-xs text-ink-3"><span className="font-semibold text-ink-3"></span>{ig.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && stats.totalGroups > 0 && (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mt-4 px-6 py-0">
            <div className="text-sm text-ink-3">
              Page {safeCurrentPage} of {totalPages} • Showing {filtered.length} of {stats.totalGroups}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-sm"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        </main>

      {/* Detail / edit panel — split view on large screens so the list stays visible on the left */}
      {selectedGroup && (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="lg:hidden fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={closeDetailPanel}
          />
          <aside
            className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-surface shadow-2xl border-l border-border w-full max-w-md
              lg:static lg:z-auto lg:shrink-0 lg:h-screen lg:shadow-none
              ${detailPanelWide ? 'lg:max-w-2xl xl:max-w-3xl' : 'lg:max-w-md xl:max-w-lg'}`}
          >
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-hairline">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl shrink-0 mt-0.5">{selectedGroup?.icon}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-ink leading-snug">
                    {editingGroup
                      ? editSubmitStep === 'preview'
                        ? 'Review changes'
                        : editForm.name
                      : selectedGroup.name}
                  </h2>
                  <p className="text-sm text-ink-3 mt-1">
                    {editingGroup
                      ? editSubmitStep === 'preview'
                        ? 'Verify details before saving to the database.'
                        : editForm.description
                      : selectedGroup.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!editingGroup ? (
                  <button onClick={(e) => { e.stopPropagation(); openEdit(selectedGroup); }} className="p-2 rounded-lg hover:bg-brand-soft text-brand transition-colors" title="Edit" aria-label="Edit">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                ) : null}
                <button type="button" onClick={closeDetailPanel} aria-label="Close panel" className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-4 hover:text-ink-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {editingGroup && editSubmitStep === 'preview' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-brand-soft bg-brand-soft px-4 py-3">
                    <p className="text-sm font-semibold text-brand">Confirm item group update</p>
                    <p className="text-xs text-brand mt-1">
                      Check every field below. Use Back to edit, or confirm to save permanently.
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Code</dt>
                      <dd className="font-mono font-semibold text-brand">{editingGroup.code}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Type</dt>
                      <dd className="font-semibold text-ink">{editingGroup.type}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Name</dt>
                      <dd className="font-semibold text-ink">{editForm.name.trim()}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Status</dt>
                      <dd className="font-semibold text-ink">{editForm.status}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Description</dt>
                      <dd className="text-ink">{editForm.description.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Purpose</dt>
                      <dd className="text-ink">{editForm.purpose.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Notes</dt>
                      <dd className="text-ink">{editForm.notes.trim() || '—'}</dd>
                    </div>
                  </dl>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand mb-2">
                      Approved members ({selectedMembersForEdit.length})
                    </h4>
                    {selectedMembersForEdit.length === 0 ? (
                      <p className="text-xs text-ink-3 italic">No members selected.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedMembersForEdit.map((m, idx) => (
                          <li key={m.id} className="rounded-lg border border-brand-soft bg-brand-soft px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {idx === 0 ? (
                                <span className="text-[9px] font-bold uppercase text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                                  Primary
                                </span>
                              ) : null}
                              <span className="text-xs font-mono font-semibold text-brand">{m.code}</span>
                              {m.sku ? <span className="text-[10px] font-mono text-ink-3">SKU {m.sku}</span> : null}
                            </div>
                            <p className="text-sm font-medium text-ink mt-0.5">{m.name}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-warn mb-2">
                      Proposed alternates ({editForm.proposedAlternates.length})
                    </h4>
                    {editForm.proposedAlternates.length === 0 ? (
                      <p className="text-xs text-ink-3 italic">None.</p>
                    ) : (
                      <ul className="space-y-2">
                        {editForm.proposedAlternates.map((alt, idx) => (
                          <li key={`${alt.item_id}-${idx}`} className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2">
                            <p className="text-xs font-mono text-warn">{alt.code}</p>
                            <p className="text-sm font-medium text-ink">{alt.name}</p>
                            {alt.notes ? <p className="text-xs text-ink-3 mt-1">{alt.notes}</p> : null}
                            <span className="inline-block mt-1 text-[10px] font-semibold text-warn capitalize">{alt.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : editingGroup ? (
                <>
                  <div className="rounded-xl border border-brand-soft bg-brand-soft px-3 py-2.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-brand">{editingGroup.code}</span>
                    <span className="text-ink-4">·</span>
                    <span className="font-semibold text-ink-2">{editingGroup.type}</span>
                    <span className="text-ink-4">·</span>
                    <span className="text-ink-3">{editForm.member_ids.length} member(s)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-ink-3 mb-1">Name</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-ink-3 mb-1">Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-ink-3 mb-1">Description</label>
                      <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-ink-3 mb-1">Purpose</label>
                      <input value={editForm.purpose} onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-ink-3 mb-1">Notes</label>
                      <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
                      Members ({editingGroup.type === 'RM' ? 'Raw materials' : 'Pack materials'})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <section className="rounded-xl border border-brand-soft bg-brand-soft p-3 flex flex-col min-h-48">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">
                            Selected ({selectedMembersForEdit.length})
                          </h4>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-56">
                          {selectedMembersForEdit.length === 0 ? (
                            <p className="text-xs text-brand italic p-1">No members selected. Add from the list on the right.</p>
                          ) : (
                            selectedMembersForEdit.map((m, idx) => (
                              <div
                                key={m.id}
                                className="flex items-start justify-between gap-2 rounded-lg border border-brand-soft bg-surface px-2.5 py-2 shadow-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {idx === 0 ? (
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                                        Primary
                                      </span>
                                    ) : null}
                                    <span className="text-[10px] font-mono font-semibold text-brand">{m.code}</span>
                                  </div>
                                  <p className="text-sm font-medium text-ink truncate mt-0.5">{m.name}</p>
                                  {m.sku ? (
                                    <p className="text-[10px] text-ink-3 font-mono mt-0.5">SKU {m.sku}</p>
                                  ) : null}
                                  {editingGroup.type === 'RM' ? renderStockWindow('RM', m.id) : renderStockWindow('PM', m.id)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeEditMember(m.id)}
                                  className="shrink-0 p-1.5 rounded-md text-ink-4 hover:bg-err-soft hover:text-err"
                                  title="Remove member"
                                  aria-label={`Remove ${m.name}`}
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="rounded-xl border border-border bg-surface-2 p-3 flex flex-col min-h-48">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-2">
                          Add members
                        </h4>
                        {editingGroup.type === 'RM' ? (
                          <input
                            type="text"
                            value={memberRmFilter}
                            onChange={(e) => setMemberRmFilter(e.target.value)}
                            placeholder="Search by name, code, or SKU…"
                            aria-label="Search by name, code, or SKU"
                            className="w-full mb-2 px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:ring-2 focus:ring-[color:var(--ring)]"
                          />
                        ) : null}
                        <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-surface p-1.5 space-y-0.5 min-h-0 max-h-56">
                          {addableMembersForEdit.map((m) => (
                            <label
                              key={m.id}
                              className="flex items-center gap-2 p-2 hover:bg-brand-soft rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => toggleEditMember(m.id)}
                                className="rounded border-border text-brand"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-mono text-ink-3">{m.code}</span>
                                {m.sku ? (
                                  <span className="text-[10px] text-ink-4 font-mono ml-1">· {m.sku}</span>
                                ) : null}
                                <span className="block text-sm text-ink truncate">{m.name}</span>
                              </div>
                            </label>
                          ))}
                          {addableMembersForEdit.length === 0 && (
                            <p className="text-xs text-ink-4 p-2">
                              {memberRmFilter.trim() && editingGroup.type === 'RM'
                                ? 'No more materials match your search.'
                                : selectedMembersForEdit.length > 0
                                  ? 'All available materials are already selected.'
                                  : `No ${editingGroup.type === 'RM' ? 'raw' : 'pack'} materials available to add.`}
                            </p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-warn mb-2">Proposed alternates</h3>
                    <p className="text-[11px] text-ink-3 mb-2">Select {editingGroup.type === 'RM' ? 'raw materials' : 'pack materials'} from the list to add as proposed alternates.</p>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {editForm.proposedAlternates.map((alt, idx) => (
                        <div key={`${alt.item_id}-${idx}`} className="border border-[color:var(--st-amber-fg)]/30 rounded-lg p-2 bg-warn-soft space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-warn">{alt.code}</span>
                            <span className="text-sm text-ink truncate flex-1 min-w-0">{alt.name}</span>
                            <button type="button" onClick={() => removeEditAlternate(idx)} className="p-1.5 rounded hover:bg-err-soft text-err shrink-0" title="Remove">×</button>
                          </div>
                          <input value={alt.notes} onChange={e => updateEditAlternate(idx, { notes: e.target.value })} placeholder="Notes" aria-label="Notes" className="w-full px-2 py-1.5 text-xs border border-border rounded" />
                          <select value={alt.status} onChange={e => updateEditAlternate(idx, { status: e.target.value as 'proposed' | 'under-review' })} aria-label="Alternate status" className="w-full px-2 py-1.5 text-xs border border-border rounded bg-surface">
                            <option value="proposed">Proposed</option>
                            <option value="under-review">Under review</option>
                          </select>
                        </div>
                      ))}
                      {editForm.proposedAlternates.length === 0 && <p className="text-xs text-ink-4 p-2">No proposed alternates. Add from the list below.</p>}
                    </div>
                    {availableAlternatesForEdit.length > 0 ? (
                      <div className="mt-2">
                        {editingGroup.type === 'RM' ? (
                          <RmMasterTypeahead
                            options={alternateRmTypeaheadOptions}
                            value={alternateRmQuery}
                            selectedId=""
                            onValueChange={setAlternateRmQuery}
                            onSelect={(opt) => {
                              const id = parseInt(opt.id, 10);
                              const item = availableAlternatesForEdit.find((m) => m.id === id);
                              if (item) addEditAlternate(item);
                              setAlternateRmQuery('');
                            }}
                            onClearSelection={() => setAlternateRmQuery('')}
                            requirePickFromList
                            placeholder="Search by name, code, or SKU…"
                            className="[&_input]:text-xs [&_input]:border-[color:var(--st-amber-fg)]/30 [&_input]:rounded-lg"
                          />
                        ) : (
                          <select
                            className="px-3 py-1.5 text-xs border border-[color:var(--st-amber-fg)]/30 rounded-lg bg-surface text-ink-2 w-full"
                            value=""
                            onChange={e => {
                              const id = e.target.value ? parseInt(e.target.value, 10) : 0;
                              const item = availableAlternatesForEdit.find(m => m.id === id);
                              if (item) addEditAlternate(item);
                              e.target.value = '';
                            }}
                          >
                            <option value="">— Add pack material —</option>
                            {availableAlternatesForEdit.map(m => (
                              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-ink-4">No more {editingGroup?.type === 'RM' ? 'raw materials' : 'pack materials'} available to add as alternates.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center py-3 px-2 rounded-xl border border-border bg-surface-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Type</p>
                      <p className="text-lg font-extrabold text-ink mt-1">{selectedGroup.type}</p>
                    </div>
                    <div className="text-center py-3 px-2 rounded-xl border border-brand-soft bg-brand-soft">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Members</p>
                      <p className="text-lg font-extrabold text-brand mt-1">{selectedGroup.approvedMembers.length}</p>
                    </div>
                    <div className="text-center py-3 px-2 rounded-xl border border-[color:var(--st-amber-fg)]/30 bg-warn-soft">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Alternates</p>
                      <p className="text-lg font-extrabold text-warn mt-1">{selectedGroup.proposedAlternates.length}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand mb-3">Approved Members</h3>
                    <div className="space-y-2">
                      {selectedGroup.approvedMembers.map((member, idx) => (
                        <div key={member.id} className="border border-border rounded-xl p-3.5">
                          <div className="flex items-center gap-2 mb-1">
                            {idx === 0 && <span className="text-[10px] font-bold text-brand">Primary</span>}
                            <span className="font-mono text-[10px] font-bold text-brand">{member.code}</span>
                          </div>
                          <p className="text-sm font-semibold text-ink">{member.name}</p>
                        </div>
                      ))}
                      {selectedGroup.approvedMembers.length === 0 && <p className="text-xs text-ink-4 italic">No approved members yet</p>}
                    </div>
                  </div>
                  {selectedGroup.proposedAlternates.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-warn mb-3">Proposed Alternates</h3>
                      <div className="space-y-2">
                        {selectedGroup.proposedAlternates.map(alt => (
                          <div key={alt.id} className="border border-[color:var(--st-amber-fg)]/30 rounded-xl p-3.5 bg-warn-soft">
                            <p className="text-sm font-semibold text-ink">{alt.name}</p>
                            <p className="text-xs text-ink-3 mt-1">{alt.notes}</p>
                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${alt.status === 'proposed' ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand'}`}>{alt.status === 'proposed' ? 'Proposed' : 'Under Review'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.notes && (
                    <div className="rounded-xl border border-[color:var(--st-green-fg)]/30 bg-ok-soft p-4">
                      <p className="text-sm text-ok"><span className="font-bold">Rationale:</span> {selectedGroup.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
              {editingGroup ? (
                editSubmitStep === 'preview' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditSubmitStep('form')}
                      disabled={saving}
                      className="px-5 py-2 text-sm font-medium text-ink-2 border border-border rounded-lg hover:bg-surface-3 disabled:opacity-50"
                    >
                      Back to edit
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-5 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-press disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Confirm & save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroup(null);
                        setEditSubmitStep('form');
                      }}
                      className="px-5 py-2 text-sm font-medium text-ink-2 border border-border rounded-lg hover:bg-surface-3"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={requestEditPreview}
                      className="px-5 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-press"
                    >
                      Review & save
                    </button>
                  </>
                )
              ) : (
                <button type="button" onClick={closeDetailPanel} className="px-5 py-2 text-sm font-medium text-ink-2 border border-border rounded-lg hover:bg-surface-3">Close</button>
              )}
            </div>
          </aside>
        </>
      )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md" onClick={closeCreateModal} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[min(90vh,720px)] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="create-item-group-title">
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <div>
                <h2 id="create-item-group-title" className="text-lg font-bold text-ink">
                  {createSubmitStep === 'preview' ? 'Review new group' : 'Create Item Group'}
                </h2>
                {createSubmitStep === 'preview' ? (
                  <p className="text-xs text-ink-3 mt-1">Verify details before creating the group.</p>
                ) : null}
              </div>
              <button type="button" onClick={closeCreateModal} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-4 hover:text-ink-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {createSubmitStep === 'preview' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-brand-soft bg-brand-soft px-4 py-3">
                    <p className="text-sm font-semibold text-brand">Confirm new item group</p>
                    <p className="text-xs text-brand mt-1">
                      Check every field below. Use Back to edit, or confirm to create the group.
                    </p>
                  </div>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      {form.icon ? <span className="text-2xl">{form.icon}</span> : null}
                      <div>
                        <dt className="text-[10px] font-bold uppercase text-ink-3">Group name</dt>
                        <dd className="font-semibold text-ink">{form.name.trim()}</dd>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-[10px] font-bold uppercase text-ink-3">Type</dt>
                        <dd className="font-semibold text-ink">{form.type}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase text-ink-3">Code</dt>
                        <dd className="font-mono font-semibold text-brand">{form.code || '—'}</dd>
                      </div>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Primary member</dt>
                      <dd className="text-ink mt-0.5">
                        {form.type === 'RM'
                          ? rmTypeaheadLabelForId(rawMaterials, form.primaryItemId) || '—'
                          : packMaterials.find((p) => p.id === form.primaryItemId)?.description ||
                            packMaterials.find((p) => p.id === form.primaryItemId)?.code ||
                            '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Description</dt>
                      <dd className="text-ink">{form.description.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-ink-3">Rationale</dt>
                      <dd className="text-ink">{form.rationale.trim() || '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
              <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Group Name <span className="text-err">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Vitamin C Derivatives" className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Type</label>
                  <select value={form.type} onChange={e => { setPrimaryRmQuery(''); setForm(f => ({ ...f, type: e.target.value as 'RM' | 'PM', primaryItemId: '', code: '' })); }} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-surface focus:ring-2 focus:ring-[color:var(--ring)]">
                    <option value="RM">RM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Code</label>
                  <input value={form.code} readOnly className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-surface-3 text-ink-3" placeholder="From server" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Primary Item</label>
                  {form.type === 'RM' ? (
                    <>
                      <RmMasterTypeahead
                        options={rmTypeaheadOptions}
                        value={primaryRmQuery}
                        selectedId={form.primaryItemId}
                        onValueChange={setPrimaryRmQuery}
                        onSelect={(opt) => {
                          setForm((f) => ({ ...f, primaryItemId: opt.id }));
                          setPrimaryRmQuery(opt.label);
                        }}
                        onClearSelection={() => setForm((f) => ({ ...f, primaryItemId: '' }))}
                        loading={mastersLoading}
                        requirePickFromList
                        placeholder="Search by name, code, or SKU…"
                        className="[&_input]:w-full [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:border-border [&_input]:rounded-lg [&_input]:focus:ring-2 [&_input]:focus:ring-[color:var(--ring)]"
                      />
                      {!mastersLoading && rmTypeaheadOptions.length === 0 ? (
                        <p className="mt-1 text-xs text-warn" role="status">
                          No raw materials in master.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <select value={form.primaryItemId} onChange={e => setForm(f => ({ ...f, primaryItemId: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-surface focus:ring-2 focus:ring-[color:var(--ring)]">
                      <option value="">— Select pack material —</option>
                      {primaryItemOptions.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Icon (Emoji)</label>
                  <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="" className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Rationale</label>
                <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} placeholder="Why these items are grouped" rows={3} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg resize-y focus:ring-2 focus:ring-[color:var(--ring)]" />
              </div>
              </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-hairline">
              {createSubmitStep === 'preview' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCreateSubmitStep('form')}
                    className="px-4 py-2 text-sm font-medium text-ink-2 border border-border rounded-lg hover:bg-surface-3"
                  >
                    Back to edit
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    className="px-5 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-press"
                  >
                    Confirm & create
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={closeCreateModal} className="px-4 py-2 text-sm font-medium text-ink-2 border border-border rounded-lg hover:bg-surface-3">Cancel</button>
                  <button
                    type="button"
                    onClick={requestCreatePreview}
                    disabled={!form.name.trim()}
                    className="px-5 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-press disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Review & create
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

export default ItemGroups;
