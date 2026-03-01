import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchItemGroups,
  createItemGroup,
  updateItemGroup,
  type ItemGroupRecord,
  type CreateItemGroupPayload,
} from '../services/itemGroups.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';

const EMPTY_FORM = {
  name: '',
  type: 'RM' as 'RM' | 'PM',
  primaryItemId: '',
  icon: '🔗',
  description: '',
  rationale: '',
};

const ItemGroups: React.FC = () => {
  const { addToast } = useToast();
  const [itemGroups, setItemGroups] = useState<ItemGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedGroup, setSelectedGroup] = useState<ItemGroupRecord | null>(null);
  const [editingGroup, setEditingGroup] = useState<ItemGroupRecord | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; purpose: string; notes: string; status: string; member_ids: number[] }>({ name: '', description: '', purpose: '', notes: '', status: 'Active', member_ids: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchItemGroups().then(res => {
      if (cancelled) return;
      if (res.success && res.data) setItemGroups(res.data);
      else setItemGroups([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    Promise.all([fetchRawMaterialsList(), fetchPackMaterialsList()]).then(([rms, pms]) => {
      setRawMaterials(rms ?? []);
      setPackMaterials(pms ?? []);
    });
  }, []);

  const primaryItemOptions = useMemo(() => {
    if (form.type === 'PM') return packMaterials.map(p => ({ id: p.id, name: p.description || p.code }));
    return rawMaterials.map(r => ({ id: r.id, name: r.name || r.code }));
  }, [form.type, rawMaterials, packMaterials]);

  const handleCreateGroup = async () => {
    if (!form.name.trim()) return;
    const sameTypeCount = itemGroups.filter(g => g.type === form.type).length;
    const prefix = form.type === 'PM' ? 'IG-PM' : 'IG';
    const code = `${prefix}-${String(sameTypeCount + 1).padStart(3, '0')}`;
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
      setItemGroups(prev => [...prev, res.data!]);
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      addToast('success', `Item Group "${res.data.name}" created`);
    } else {
      addToast('error', res.error?.message ?? 'Failed to create group');
    }
  };

  const openEdit = (group: ItemGroupRecord) => {
    setEditingGroup(group);
    setEditForm({
      name: group.name,
      description: group.description || '',
      purpose: group.purpose || '',
      notes: group.notes || '',
      status: group.status || 'Active',
      member_ids: group.member_ids ? [...group.member_ids] : [],
    });
  };

  const availableMembersForEdit = useMemo(() => {
    if (!editingGroup) return [];
    if (editingGroup.type === 'PM') return packMaterials.map(p => ({ id: parseInt(p.id, 10), code: p.code, name: p.description || p.code }));
    return rawMaterials.map(r => ({ id: parseInt(r.id, 10), code: r.code, name: r.name || r.code }));
  }, [editingGroup, rawMaterials, packMaterials]);

  const toggleEditMember = (id: number) => {
    setEditForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(id) ? prev.member_ids.filter(m => m !== id) : [...prev.member_ids, id],
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    setSaving(true);
    const res = await updateItemGroup(editingGroup.id, {
      name: editForm.name,
      description: editForm.description,
      purpose: editForm.purpose,
      notes: editForm.notes,
      status: editForm.status,
      member_ids: editForm.member_ids,
    });
    setSaving(false);
    if (res.success && res.data) {
      setItemGroups(prev => prev.map(g => g.id === res.data!.id ? res.data! : g));
      setSelectedGroup(res.data);
      setEditingGroup(null);
      addToast('success', 'Group updated');
    } else {
      addToast('error', res.error?.message ?? 'Failed to update group');
    }
  };

  const filtered = itemGroups.filter(ig => {
    const matchType = typeFilter === 'All' || ig.type === typeFilter;
    const matchSearch = !searchQuery ||
      ig.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ig.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const stats = {
    totalGroups: itemGroups.length,
    rmGroups: itemGroups.filter(ig => ig.type === 'RM').length,
    pmGroups: itemGroups.filter(ig => ig.type === 'PM').length,
    alternates: itemGroups.reduce((sum, ig) => sum + ig.proposedAlternates.length, 0),
  };

  const statCards = [
    { label: 'TOTAL GROUPS', value: stats.totalGroups, sub: 'RM + PM groups', accent: 'border-l-violet-500', num: 'text-violet-600' },
    { label: 'RM GROUPS', value: stats.rmGroups, sub: 'Raw material', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'PM GROUPS', value: stats.pmGroups, sub: 'Packaging', accent: 'border-l-green-500', num: 'text-green-600' },
    { label: 'ALTERNATES', value: stats.alternates, sub: 'Approved + Proposed', accent: 'border-l-amber-500', num: 'text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">🔗</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">Item Configuration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Item Groups</h1>
            <p className="text-sm text-gray-600">Manage approved member items (RM/PM from DB) and proposed alternates for supply continuity.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => (
            <div key={card.label} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className={`h-1 bg-linear-to-r from-violet-400 to-violet-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num}`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-800">Item Groups</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200/50">{filtered.length} / {itemGroups.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search group…"
                className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 w-44"
              />
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
                {(['All', 'RM', 'PM'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded ${typeFilter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-lg"
              >
                <span className="text-base leading-none">+</span> New Group
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(ig => (
                <div key={ig.id} className="p-5 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedGroup(ig)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="text-lg shrink-0">{ig.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-violet-600">{ig.code}</span>
                            <span className="text-xs text-gray-500">·</span>
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{ig.type}</span>
                            <h3 className="text-sm font-semibold text-gray-900">{ig.name}</h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{ig.description}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ig.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'}`}>
                      {ig.status === 'Active' ? '✓ ' : ''}{ig.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base leading-none">✅</span>
                        <span className="text-xs font-semibold text-gray-600 uppercase">APPROVED MEMBERS ({ig.approvedMembers.length})</span>
                      </div>
                      <ul className="space-y-1">
                        {ig.approvedMembers.map(member => (
                          <li key={member.id} className="flex items-center gap-2 text-xs">
                            <span className="text-yellow-500">★</span>
                            <span className="text-gray-800 font-medium">{member.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base leading-none">🔄</span>
                        <span className="text-xs font-semibold text-gray-600 uppercase">PROPOSED ALTERNATES ({ig.proposedAlternates.length})</span>
                      </div>
                      {ig.proposedAlternates.length === 0 ? (
                        <p className="text-xs text-gray-400">No proposed alternates yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {ig.proposedAlternates.map(alt => (
                            <li key={alt.id} className="text-xs">
                              <div className="text-gray-800 font-medium">{alt.name}</div>
                              <div className="text-gray-500 text-[10px]">{alt.notes}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {ig.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">💡 </span>{ig.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Side Panel */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md" onClick={() => { setSelectedGroup(null); setEditingGroup(null); }} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl shrink-0 mt-0.5">{selectedGroup?.icon}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{editingGroup ? editForm.name : selectedGroup.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{editingGroup ? editForm.description : selectedGroup.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!editingGroup ? (
                  <button onClick={(e) => { e.stopPropagation(); openEdit(selectedGroup); }} className="p-2 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors" title="Edit">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                ) : null}
                <button onClick={() => { setSelectedGroup(null); setEditingGroup(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {editingGroup ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Name</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Description</label>
                    <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Purpose</label>
                    <input value={editForm.purpose} onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Notes</label>
                    <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-2">Members ({editingGroup.type === 'RM' ? 'Raw materials' : 'Pack materials'})</h3>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                      {availableMembersForEdit.map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={editForm.member_ids.includes(m.id)} onChange={() => toggleEditMember(m.id)} className="rounded border-gray-300 text-violet-600" />
                          <span className="text-xs font-mono text-gray-600">{m.code}</span>
                          <span className="text-sm text-gray-800 truncate">{m.name}</span>
                        </label>
                      ))}
                      {availableMembersForEdit.length === 0 && <p className="text-xs text-gray-400 p-2">No {editingGroup.type === 'RM' ? 'raw' : 'pack'} materials in DB.</p>}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center py-3 px-2 rounded-xl border border-gray-200 bg-gray-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-1">{selectedGroup.type}</p>
                    </div>
                    <div className="text-center py-3 px-2 rounded-xl border border-teal-200 bg-teal-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Members</p>
                      <p className="text-lg font-extrabold text-teal-600 mt-1">{selectedGroup.approvedMembers.length}</p>
                    </div>
                    <div className="text-center py-3 px-2 rounded-xl border border-amber-200 bg-amber-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Alternates</p>
                      <p className="text-lg font-extrabold text-amber-600 mt-1">{selectedGroup.proposedAlternates.length}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-3">Approved Members</h3>
                    <div className="space-y-2">
                      {selectedGroup.approvedMembers.map((member, idx) => (
                        <div key={member.id} className="border border-gray-200 rounded-xl p-3.5">
                          <div className="flex items-center gap-2 mb-1">
                            {idx === 0 && <span className="text-[10px] font-bold text-teal-600">★ Primary</span>}
                            <span className="font-mono text-[10px] font-bold text-teal-600">{member.code}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                        </div>
                      ))}
                      {selectedGroup.approvedMembers.length === 0 && <p className="text-xs text-gray-400 italic">No approved members yet</p>}
                    </div>
                  </div>
                  {selectedGroup.proposedAlternates.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-3">Proposed Alternates</h3>
                      <div className="space-y-2">
                        {selectedGroup.proposedAlternates.map(alt => (
                          <div key={alt.id} className="border border-amber-200 rounded-xl p-3.5 bg-amber-50/50">
                            <p className="text-sm font-semibold text-gray-900">{alt.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{alt.notes}</p>
                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${alt.status === 'proposed' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{alt.status === 'proposed' ? 'Proposed' : 'Under Review'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.notes && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm text-emerald-800"><span className="font-bold">💡 Rationale:</span> {selectedGroup.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              {editingGroup ? (
                <>
                  <button onClick={() => setEditingGroup(null)} className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveEdit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => { setSelectedGroup(null); setEditingGroup(null); }} className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-gray-900">Create Item Group</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Group Name <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Vitamin C Derivatives" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'RM' | 'PM', primaryItemId: '' }))} className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500">
                    <option value="RM">RM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Primary Item</label>
                  <select value={form.primaryItemId} onChange={e => setForm(f => ({ ...f, primaryItemId: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500">
                    <option value="">— Select —</option>
                    {primaryItemOptions.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Icon (Emoji)</label>
                  <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🔗" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Rationale</label>
                <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} placeholder="Why these items are grouped" rows={3} className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setForm(EMPTY_FORM); setShowCreateModal(false); }} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateGroup} disabled={!form.name.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed">Create Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemGroups;
