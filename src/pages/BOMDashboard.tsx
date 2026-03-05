import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';
import { fetchPRProducts, fetchPRProductDetail, updatePRProduct, type PRProductListItem, type PRProductDetail, type FormulaBomPhase, type PackBomRow, type ProcessStep } from '../services/productsMaster.service';

const STATUS_OPTIONS = ['Draft', 'R&D Review', 'Approved', 'Production Released', 'Discontinued'];

const BOMDashboard: React.FC = () => {
  const { hasModuleAccess } = usePermissions();
  const canEdit = hasModuleAccess('catalogue-management') || hasModuleAccess('packaging-management');

  const [list, setList] = useState<PRProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedProduct, setSelectedProduct] = useState<PRProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<PRProductDetail> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchPRProducts();
    if (res.success && res.data) {
      setList(res.data);
    } else {
      setError(res.error ?? 'Failed to load products');
      setList([]);
    }
    setLoading(false);
  }, []);

  const handleViewItem = useCallback(async (product: PRProductListItem) => {
    setIsPanelOpen(true);
    setDetailLoading(true);
    setSelectedProduct(null);
    setEditDraft(null);
    setIsEditMode(false);
    setPanelTab(0);
    const res = await fetchPRProductDetail(product.product_id);
    setDetailLoading(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
    }
  }, []);

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedProduct(null);
    setEditDraft(null);
    setIsEditMode(false);
    setPanelTab(0);
  };

  const startEdit = () => {
    if (selectedProduct) {
      setEditDraft({ ...selectedProduct });
      setIsEditMode(true);
    }
  };

  const cancelEdit = () => {
    setEditDraft(null);
    setIsEditMode(false);
  };

  const updateDraft = (updates: Partial<PRProductDetail>) => {
    setEditDraft((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const addFormulaPhase = () => {
    setEditDraft((prev) => ({
      ...prev!,
      formulaBom: [...(prev?.formulaBom ?? []), { phase: 'New Phase', ingredients: [] }],
    }));
  };
  const addFormulaIngredient = (phaseIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = [...(prev.formulaBom ?? [])];
      if (!fb[phaseIdx]) return prev;
      fb[phaseIdx] = {
        ...fb[phaseIdx],
        ingredients: [...fb[phaseIdx].ingredients, { inci_name: '', rm_code: '', pct_w_w: 0, uom: 'kg' }],
      };
      return { ...prev, formulaBom: fb };
    });
  };
  const updateFormulaIngredient = (phaseIdx: number, ingIdx: number, field: keyof FormulaBomPhase['ingredients'][0], value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) =>
        i !== phaseIdx ? p : { ...p, ingredients: p.ingredients.map((ing, j) => (j !== ingIdx ? ing : { ...ing, [field]: value })) }
      );
      return { ...prev, formulaBom: fb };
    });
  };
  const removeFormulaIngredient = (phaseIdx: number, ingIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) =>
        i !== phaseIdx ? p : { ...p, ingredients: p.ingredients.filter((_, j) => j !== ingIdx) }
      );
      return { ...prev, formulaBom: fb };
    });
  };
  const updateFormulaPhaseName = (phaseIdx: number, phase: string) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = [...(prev.formulaBom ?? [])];
      if (!fb[phaseIdx]) return prev;
      fb[phaseIdx] = { ...fb[phaseIdx], phase };
      return { ...prev, formulaBom: fb };
    });
  };
  const removeFormulaPhase = (phaseIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const formulaBom = (prev.formulaBom ?? []).filter((_, i) => i !== phaseIdx);
      return { ...prev, formulaBom };
    });
  };

  const addPackRow = () => {
    setEditDraft((prev) => ({
      ...prev!,
      packBom: [...(prev?.packBom ?? []), { row_number: (prev?.packBom?.length ?? 0) + 1, pm_id: null, pm_description: '', pm_code: '', pack_type: 'Primary', qty_per_unit: 1, uom: 'pc/unit' }],
    }));
  };
  const updatePackRow = (rowIdx: number, field: keyof Omit<PackBomRow, 'row_number' | 'pm_id'>, value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).map((row, i) => (i !== rowIdx ? row : { ...row, [field]: value }));
      return { ...prev, packBom };
    });
  };
  const removePackRow = (rowIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).filter((_, i) => i !== rowIdx).map((r, i) => ({ ...r, row_number: i + 1 }));
      return { ...prev, packBom };
    });
  };

  const addProcessStep = () => {
    setEditDraft((prev) => ({
      ...prev!,
      processSteps: [...(prev?.processSteps ?? []), { step_number: (prev?.processSteps?.length ?? 0) + 1, description: '', duration_minutes: 0 }],
    }));
  };
  const updateProcessStep = (stepIdx: number, field: keyof ProcessStep, value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const processSteps = (prev.processSteps ?? []).map((s, i) => (i !== stepIdx ? s : { ...s, [field]: value }));
      return { ...prev, processSteps };
    });
  };
  const removeProcessStep = (stepIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const processSteps = (prev.processSteps ?? []).filter((_, i) => i !== stepIdx).map((s, i) => ({ ...s, step_number: i + 1 }));
      return { ...prev, processSteps };
    });
  };

  const handleSave = useCallback(async () => {
    if (!selectedProduct || !editDraft) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      product_name: editDraft.product_name ?? selectedProduct.product_name,
      product_code: editDraft.product_code ?? selectedProduct.product_code,
      product_sku: editDraft.product_sku ?? selectedProduct.product_sku,
      product_description: editDraft.product_description ?? selectedProduct.product_description,
      category: editDraft.category ?? selectedProduct.category,
      status: editDraft.status ?? selectedProduct.status,
      form: editDraft.form ?? selectedProduct.form,
      fill_size: editDraft.fill_size ?? selectedProduct.fill_size,
      batch_size_kg: editDraft.batch_size_kg ?? selectedProduct.batch_size_kg,
      shelf_life_months: editDraft.shelf_life_months ?? selectedProduct.shelf_life_months,
      version: editDraft.version ?? selectedProduct.version,
      license_cml: editDraft.license_cml ?? selectedProduct.license_cml,
      theoretical_yield_pct: editDraft.theoretical_yield_pct ?? selectedProduct.theoretical_yield_pct,
      pao_months: editDraft.pao_months ?? selectedProduct.pao_months,
      mrp_price: editDraft.mrp_price ?? selectedProduct.mrp_price,
      manufacturing_location: editDraft.manufacturing_location ?? selectedProduct.manufacturing_location,
      equipment_vessel: editDraft.equipment_vessel ?? selectedProduct.equipment_vessel,
      storage_conditions: editDraft.storage_conditions ?? selectedProduct.storage_conditions,
      approved_claims: editDraft.approved_claims ?? selectedProduct.approved_claims,
      ph_range: editDraft.ph_range ?? selectedProduct.ph_range,
      viscosity_range: editDraft.viscosity_range ?? selectedProduct.viscosity_range,
      spf_pa_rating: editDraft.spf_pa_rating ?? selectedProduct.spf_pa_rating,
      appearance: editDraft.appearance ?? selectedProduct.appearance,
      odour: editDraft.odour ?? selectedProduct.odour,
      fill_weight_spec: editDraft.fill_weight_spec ?? selectedProduct.fill_weight_spec,
      stability_summary: editDraft.stability_summary ?? selectedProduct.stability_summary,
    };
    const formulaBom = editDraft.formulaBom ?? selectedProduct.formulaBom ?? [];
    const packBom = editDraft.packBom ?? selectedProduct.packBom ?? [];
    const processSteps = editDraft.processSteps ?? selectedProduct.processSteps ?? [];
    const rm_lines = formulaBom.flatMap((p) => p.ingredients.map((ing) => ({ phase: p.phase, inci_name: ing.inci_name, rm_code: ing.rm_code, pct_w_w: ing.pct_w_w, uom: ing.uom || 'kg' })));
    const pm_lines = packBom.map((r) => ({ pm_code: r.pm_code, description: r.pm_description, pack_type: r.pack_type, qty_per_unit: r.qty_per_unit, uom: r.uom }));
    const process_steps = processSteps.map((s, i) => ({ step_number: i + 1, description: s.description, duration_minutes: s.duration_minutes }));
    payload.bom = { rm_lines, pm_lines, process_steps };
    const res = await updatePRProduct(selectedProduct.product_id, payload);
    setSaving(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
      setEditDraft(null);
      setIsEditMode(false);
      loadProducts();
      toast.success('Product updated');
    } else {
      toast.error(res.error ?? 'Update failed');
    }
  }, [selectedProduct, editDraft, loadProducts]);

  const displayProduct = isEditMode && editDraft ? editDraft : selectedProduct;

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredList = list.filter((p) => {
    const matchSearch = !searchTerm.trim() || [p.product_name, p.product_code, p.product_sku].some((s) => (s ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCat = selectedCategory === 'All Categories' || p.category === selectedCategory;
    const matchStatus = selectedStatus === 'All Statuses' || p.status === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const statCardData = [
    { label: 'TOTAL PRODUCTS', value: list.length, sub: 'Registered PR masters', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'PRODUCTION RELEASED', value: list.filter((p) => p.status === 'Production Released').length, sub: 'Ready to manufacture', accent: 'border-l-green-500', num: 'text-green-600' },
    { label: 'CATEGORIES', value: [...new Set(list.map((p) => p.category).filter(Boolean))].length, sub: 'Product categories', accent: 'border-l-orange-400', num: 'text-orange-500' },
    { label: 'RM INGREDIENTS', value: list.reduce((sum, p) => sum + (p.rm_ingredients_count ?? 0), 0), sub: 'Total in formulas', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PM COMPONENTS', value: list.reduce((sum, p) => sum + (p.pack_items_count ?? 0), 0), sub: 'Total pack items', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 w-full">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">📦</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">PR Masters</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Products (PR)</h1>
            <p className="text-sm text-gray-600">Manage product registrations, formulations, packaging specifications and regulatory compliance.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCardData.map(card => (
            <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
              <div className={`h-1 bg-linear-to-r from-blue-400 to-blue-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Products Master</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{list.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* search */}
              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
                  placeholder="Search name, code, SKU…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all w-52"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Categories</option>
                {[...new Set(list.map((p) => p.category).filter(Boolean))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Statuses</option>
                <option>Production Released</option>
                <option>Draft</option>
                <option>R&D Review</option>
                <option>Approved</option>
                <option>Discontinued</option>
              </select>

              <Link
                to="/bom/new"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                New PR
              </Link>
            </div>
          </div>

          {/* Table */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <span className="animate-pulse">Loading Products…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CODE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PRODUCT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CATEGORY</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FORM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FILL SIZE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">BATCH (KG)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">SHELF LIFE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RM INGS.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PACK ITEMS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">MRP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">STATUS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">VER.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">OPEN SOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center text-gray-500">
                        No Products found. <Link to="/bom/new" className="text-blue-600 hover:text-blue-700 font-semibold">Create one</Link> to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((p) => (
                      <tr key={p.product_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewItem(p)}>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{p.product_code || '—'}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{p.product_name || 'Product'}</p>
                            <p className="text-xs text-gray-500">SKU: {p.product_sku || '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.form ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.fill_size ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.batch_size_kg ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.shelf_life_months != null ? `${p.shelf_life_months}M` : '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600 text-center">{p.rm_ingredients_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-amber-600 text-center">{p.pack_items_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.mrp_price != null ? `Rs.${p.mrp_price}` : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            p.status === 'Production Released' ? 'bg-green-100 text-green-700' : p.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {p.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.version ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {(p.open_sos_count ?? 0) > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-100 text-indigo-700 border border-indigo-200">{p.open_sos_count}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── PR Detail Panel (5 tabs) ── */}
      {isPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <span className="text-sm font-mono text-gray-500">{selectedProduct?.product_code ?? '—'}</span>
              <h2 className="text-lg font-bold text-gray-900">{selectedProduct?.product_name ?? 'Product'}</h2>
            </div>
            <button onClick={handleClosePanel} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">✕</button>
          </div>
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>
          ) : selectedProduct ? (
            <>
              <div className="flex gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                {['Overview', 'Formula BOM', 'Pack BOM', 'Process', 'Specs & Stability'].map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setPanelTab(i)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${panelTab === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {panelTab === 0 && displayProduct && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Identity</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Category</span>
                          {isEditMode ? <input value={displayProduct.category ?? ''} onChange={(e) => updateDraft({ category: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900" /> : <div className="font-medium">{displayProduct.category ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Status</span>
                          {isEditMode ? (
                            <select value={displayProduct.status ?? ''} onChange={(e) => updateDraft({ status: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : <div><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{displayProduct.status ?? '—'}</span></div>}
                        </div>
                        <div><span className="text-gray-500">Form</span>
                          {isEditMode ? <input value={displayProduct.form ?? ''} onChange={(e) => updateDraft({ form: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.form ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Fill Size</span>
                          {isEditMode ? <input value={displayProduct.fill_size ?? ''} onChange={(e) => updateDraft({ fill_size: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.fill_size ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">SKU Code</span>
                          {isEditMode ? <input value={displayProduct.product_sku ?? ''} onChange={(e) => updateDraft({ product_sku: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.product_sku ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">License / CML</span>
                          {isEditMode ? <input value={displayProduct.license_cml ?? ''} onChange={(e) => updateDraft({ license_cml: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.license_cml ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Commercials</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">MRP</span>
                          {isEditMode ? <input type="number" step="0.01" value={displayProduct.mrp_price ?? ''} onChange={(e) => updateDraft({ mrp_price: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div className="text-lg font-semibold text-gray-900">{displayProduct.mrp_price != null ? `Rs.${displayProduct.mrp_price}` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Version</span>
                          {isEditMode ? <input value={displayProduct.version ?? ''} onChange={(e) => updateDraft({ version: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.version ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Batch Size (KG)</span>
                          {isEditMode ? <input type="number" value={displayProduct.batch_size_kg ?? ''} onChange={(e) => updateDraft({ batch_size_kg: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.batch_size_kg != null ? `${displayProduct.batch_size_kg} KG` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Yield %</span>
                          {isEditMode ? <input type="number" step="0.01" value={displayProduct.theoretical_yield_pct ?? ''} onChange={(e) => updateDraft({ theoretical_yield_pct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.theoretical_yield_pct != null ? `${displayProduct.theoretical_yield_pct}%` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Shelf Life (months)</span>
                          {isEditMode ? <input type="number" value={displayProduct.shelf_life_months ?? ''} onChange={(e) => updateDraft({ shelf_life_months: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.shelf_life_months != null ? `${displayProduct.shelf_life_months} months` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">PAO (months)</span>
                          {isEditMode ? <input type="number" value={displayProduct.pao_months ?? ''} onChange={(e) => updateDraft({ pao_months: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.pao_months != null ? `${displayProduct.pao_months} months` : '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Manufacturing</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2"><span className="text-gray-500">Location</span>
                          {isEditMode ? <input value={displayProduct.manufacturing_location ?? ''} onChange={(e) => updateDraft({ manufacturing_location: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.manufacturing_location ?? '—'}</div>}
                        </div>
                        <div className="col-span-2"><span className="text-gray-500">Equipment</span>
                          {isEditMode ? <input value={displayProduct.equipment_vessel ?? ''} onChange={(e) => updateDraft({ equipment_vessel: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.equipment_vessel ?? '—'}</div>}
                        </div>
                        <div className="col-span-2"><span className="text-gray-500">Storage</span>
                          {isEditMode ? <input value={displayProduct.storage_conditions ?? ''} onChange={(e) => updateDraft({ storage_conditions: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.storage_conditions ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Claims</div>
                      {isEditMode ? <textarea value={displayProduct.approved_claims ?? ''} onChange={(e) => updateDraft({ approved_claims: e.target.value })} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /> : <div className="p-3 bg-gray-50 rounded-lg text-sm">{displayProduct.approved_claims ?? '—'}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Open Sales Orders</div>
                      <div className="space-y-2">
                        {(selectedProduct?.openSalesOrders ?? []).length === 0 ? (
                          <p className="text-sm text-gray-500">No open orders</p>
                        ) : (
                          (selectedProduct?.openSalesOrders ?? []).map((so) => (
                            <div key={so.order_id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                              <span className="font-mono text-xs font-bold text-indigo-600">{so.order_id}</span>
                              <span className="flex-1 text-sm text-gray-700">{so.customer_name}</span>
                              <span className="font-mono text-sm font-bold text-amber-600">{Number(so.quantity).toLocaleString()} units</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{so.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {panelTab === 1 && (selectedProduct || editDraft) && (() => {
                  const formulaList = (isEditMode ? editDraft?.formulaBom : selectedProduct?.formulaBom) ?? [];
                  return (
                    <div className="space-y-4">
                      {isEditMode && (
                        <div className="flex items-center gap-2 mb-3">
                          <button type="button" onClick={addFormulaPhase} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Plus className="w-3.5 h-3.5" /> Add phase
                          </button>
                        </div>
                      )}
                      {formulaList.map((phase, phaseIdx) => (
                        <div key={phaseIdx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {isEditMode ? (
                              <input value={phase.phase} onChange={(e) => updateFormulaPhaseName(phaseIdx, e.target.value)} className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 border border-blue-200 w-40" placeholder="Phase name" />
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">{phase.phase}</span>
                            )}
                            <span className="text-xs text-gray-500">{phase.ingredients.length} ingredient(s)</span>
                            {isEditMode && (
                              <>
                                <button type="button" onClick={() => addFormulaIngredient(phaseIdx)} className="text-xs text-blue-600 hover:underline">+ Ingredient</button>
                                <button type="button" onClick={() => removeFormulaPhase(phaseIdx)} className="text-red-600 hover:text-red-700 p-0.5" title="Remove phase"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2">INCI Name</th><th className="text-left p-2">RM Code</th><th className="text-right p-2 w-16">% w/w</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                              <tbody>
                                {phase.ingredients.map((ing, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                    {isEditMode ? (
                                      <>
                                        <td className="p-2"><input value={ing.inci_name} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'inci_name', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                        <td className="p-2"><input value={ing.rm_code} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'rm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
                                        <td className="p-2"><input type="number" step="0.01" value={ing.pct_w_w} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'pct_w_w', Number(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-right text-xs" /></td>
                                        <td className="p-2"><input value={ing.uom} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'uom', e.target.value)} className="w-14 px-2 py-1 border rounded text-xs" /></td>
                                        <td className="p-2"><button type="button" onClick={() => removeFormulaIngredient(phaseIdx, i)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                      </>
                                    ) : (
                                      <><td className="p-2 font-medium">{ing.inci_name}</td><td className="p-2 font-mono text-xs text-indigo-600">{ing.rm_code}</td><td className="p-2 text-right font-mono">{ing.pct_w_w}</td><td className="p-2 text-gray-500">{ing.uom}</td></>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {formulaList.length === 0 && <p className="text-gray-500 text-sm">No formula BOM data. {isEditMode && 'Add a phase above.'}</p>}
                    </div>
                  );
                })()}
                {panelTab === 2 && (selectedProduct || editDraft) && (() => {
                  const packList = (isEditMode ? editDraft?.packBom : selectedProduct?.packBom) ?? [];
                  return (
                    <div>
                      <p className="text-xs text-gray-600 mb-3">
                        Items are from the <strong>Pack Materials (PM)</strong> table. Edit a PM there to update it everywhere it is used (products, BOMs, orders).
                      </p>
                      {isEditMode && (
                        <button type="button" onClick={addPackRow} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 mb-3">
                          <Plus className="w-3.5 h-3.5" /> Add row
                        </button>
                      )}
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2">PM Description</th><th className="text-left p-2">PM Code</th><th className="text-left p-2">Pack Type</th><th className="text-right p-2">Qty/Unit</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                          <tbody>
                            {packList.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                {isEditMode ? (
                                  <>
                                    <td className="p-2"><input value={row.pm_description} onChange={(e) => updatePackRow(i, 'pm_description', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><input value={row.pm_code} onChange={(e) => updatePackRow(i, 'pm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
                                    <td className="p-2"><input value={row.pack_type} onChange={(e) => updatePackRow(i, 'pack_type', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={row.qty_per_unit} onChange={(e) => updatePackRow(i, 'qty_per_unit', Number(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-right text-xs" /></td>
                                    <td className="p-2"><input value={row.uom} onChange={(e) => updatePackRow(i, 'uom', e.target.value)} className="w-14 px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><button type="button" onClick={() => removePackRow(i)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 font-medium">{row.pm_description}</td>
                                    <td className="p-2">
                                      <Link to={`/packaging?pm=${encodeURIComponent(row.pm_code)}`} className="font-mono text-xs text-amber-600 hover:text-amber-700 underline" title="Open in Pack Materials to edit; changes apply everywhere">{row.pm_code}</Link>
                                    </td>
                                    <td className="p-2"><span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">{row.pack_type}</span></td>
                                    <td className="p-2 text-right font-mono font-bold text-indigo-600">{row.qty_per_unit}</td>
                                    <td className="p-2 text-gray-500">{row.uom}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{packList.length} packaging component(s)</p>
                      {packList.length === 0 && <p className="text-gray-500 text-sm mt-2">No pack BOM data. {isEditMode && 'Add a row above.'}</p>}
                    </div>
                  );
                })()}
                {panelTab === 3 && (selectedProduct || editDraft) && (() => {
                  const stepsList = (isEditMode ? editDraft?.processSteps : selectedProduct?.processSteps) ?? [];
                  return (
                    <div className="space-y-2">
                      {isEditMode && (
                        <button type="button" onClick={addProcessStep} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 mb-2">
                          <Plus className="w-3.5 h-3.5" /> Add step
                        </button>
                      )}
                      {stepsList.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg">
                          <span className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">{i + 1}</span>
                          {isEditMode ? (
                            <>
                              <div className="flex-1 min-w-0 space-y-1">
                                <input value={step.description} onChange={(e) => updateProcessStep(i, 'description', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Step description" />
                                <div className="flex items-center gap-2">
                                  <input type="number" min={0} value={step.duration_minutes} onChange={(e) => updateProcessStep(i, 'duration_minutes', Number(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm font-mono" />
                                  <span className="text-xs text-gray-500">min</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => removeProcessStep(i)} className="shrink-0 text-red-600 hover:text-red-700 p-1" title="Remove step"><Trash2 className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0"><p className="text-sm text-gray-800">{step.description}</p></div>
                              <span className="shrink-0 text-sm font-mono text-gray-500">{step.duration_minutes} min</span>
                            </>
                          )}
                        </div>
                      ))}
                      {stepsList.length === 0 && <p className="text-gray-500 text-sm">No process steps. {isEditMode && 'Add a step above.'}</p>}
                      {stepsList.length > 0 && <p className="text-xs text-gray-500 text-right">Total steps: {stepsList.length}</p>}
                    </div>
                  );
                })()}
                {panelTab === 4 && displayProduct && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">FP Specifications</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">pH Range</span>
                          {isEditMode ? <input value={displayProduct.ph_range ?? ''} onChange={(e) => updateDraft({ ph_range: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.ph_range ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Viscosity (cPs)</span>
                          {isEditMode ? <input value={displayProduct.viscosity_range ?? ''} onChange={(e) => updateDraft({ viscosity_range: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.viscosity_range ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">SPF / PA</span>
                          {isEditMode ? <input value={displayProduct.spf_pa_rating ?? ''} onChange={(e) => updateDraft({ spf_pa_rating: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.spf_pa_rating ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Appearance</span>
                          {isEditMode ? <input value={displayProduct.appearance ?? ''} onChange={(e) => updateDraft({ appearance: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.appearance ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Odour</span>
                          {isEditMode ? <input value={displayProduct.odour ?? ''} onChange={(e) => updateDraft({ odour: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.odour ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Fill Weight</span>
                          {isEditMode ? <input value={displayProduct.fill_weight_spec ?? ''} onChange={(e) => updateDraft({ fill_weight_spec: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.fill_weight_spec ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Stability</div>
                      {isEditMode ? <textarea value={displayProduct.stability_summary ?? ''} onChange={(e) => updateDraft({ stability_summary: e.target.value })} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900" /> : <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{displayProduct.stability_summary ?? '—'}</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
                {isEditMode ? (
                  <>
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleClosePanel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                    {canEdit && <button onClick={startEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Edit</button>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">Failed to load detail</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BOMDashboard;
