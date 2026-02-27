import React, { useState } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';

type SwapRecord = {
  id: string;
  fromIngredient: string;
  toIngredient: string;
  swapRatio: number;
  reason: string;
  approvedBy: string;
  date: string;
  affectedPRs: string[];
};

type ProductRecord = {
  id: string;
  code: string;
  name: string;
  rmCount: number;
  ingredients: string[];
  selected: boolean;
};

const UniversalSwap: React.FC = () => {
  const { items } = useItems();
  const { addToast } = useToast();
  
  // Mock data - replace with actual data from context/API
  const mockProducts: ProductRecord[] = [
    { id: '1', code: 'EI-PR-00001', name: 'EI Sunscreen Lotion SPF50+ PA++++', rmCount: 16, ingredients: ['Glycerin', 'Niacinamide', 'Zinc Oxide'], selected: true },
    { id: '2', code: 'EI-PR-00002', name: 'EI Gentle Foaming Facewash 150ml', rmCount: 12, ingredients: ['Glycerin', 'SLES 70%', 'Cocamidopropyl Betaine'], selected: true },
  ];

  const [products, setProducts] = useState<ProductRecord[]>(mockProducts);
  const [swapHistory, setSwapHistory] = useState<SwapRecord[]>([
    {
      id: '1',
      fromIngredient: 'Cetearyl Alcohol',
      toIngredient: 'Behenyl Alcohol',
      swapRatio: 0.95,
      reason: 'Cost optimization - 12% cheaper',
      approvedBy: 'Rajesh Kumar',
      date: '2026-02-15',
      affectedPRs: ['EI-PR-00001', 'EI-PR-00003']
    }
  ]);

  const [formData, setFormData] = useState({
    fromIngredient: '',
    toIngredient: '',
    swapRatio: 1.0,
    reason: '',
    approvedBy: ''
  });

  const [showPreview, setShowPreview] = useState(false);

  // Get all unique ingredients from products
  const allIngredients = Array.from(new Set(products.flatMap(p => p.ingredients))).sort();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id === 'swapRatio' ? parseFloat(value) : value
    }));
  };

  const toggleProduct = (id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const handlePreview = () => {
    if (!formData.fromIngredient || !formData.toIngredient) {
      addToast('error', 'Please select both FROM and TO ingredients');
      return;
    }
    setShowPreview(true);
  };

  const handleApplySwap = () => {
    if (!formData.reason.trim() || !formData.approvedBy.trim()) {
      addToast('error', 'Reason and Approved By are required');
      return;
    }

    const selectedPRs = products.filter(p => p.selected && p.ingredients.includes(formData.fromIngredient));
    
    if (selectedPRs.length === 0) {
      addToast('error', 'No selected PRs contain the FROM ingredient');
      return;
    }

    const newSwap: SwapRecord = {
      id: Date.now().toString(),
      fromIngredient: formData.fromIngredient,
      toIngredient: formData.toIngredient,
      swapRatio: formData.swapRatio,
      reason: formData.reason,
      approvedBy: formData.approvedBy,
      date: new Date().toISOString().split('T')[0],
      affectedPRs: selectedPRs.map(p => p.code)
    };

    setSwapHistory(prev => [newSwap, ...prev]);
    addToast('success', `Swap applied to ${selectedPRs.length} product(s)`);
    
    // Reset form
    setFormData({
      fromIngredient: '',
      toIngredient: '',
      swapRatio: 1.0,
      reason: '',
      approvedBy: ''
    });
    setShowPreview(false);
  };

  const affectedProductsCount = products.filter(p => 
    p.selected && p.ingredients.includes(formData.fromIngredient)
  ).length;

  const stats = {
    totalPRs: products.length,
    totalIngredients: allIngredients.length,
    swapHistoryCount: swapHistory.length,
  };

  const statCards = [
    { label: 'PRS IN SYSTEM', value: stats.totalPRs, sub: 'Formula records', accent: 'border-l-indigo-500', num: 'text-indigo-600' },
    { label: 'SWAP HISTORY', value: stats.swapHistoryCount, sub: 'Applied swaps', accent: 'border-l-emerald-500', num: 'text-emerald-600' },
    { label: 'TOTAL INGREDIENTS', value: stats.totalIngredients, sub: 'Swappable RMs', accent: 'border-l-amber-500', num: 'text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-indigo-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">🔄</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Ingredient Operations</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Universal Ingredient Swap</h1>
            <p className="text-sm text-gray-600">Swap an ingredient across selected PRs without editing each formula individually. Selective PR exemption supported.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statCards.map(card => (
            <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
              <div className={`h-1 bg-linear-to-r from-indigo-400 to-indigo-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Swap Form Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-indigo-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <span className="text-sm font-semibold text-gray-800">New Swap</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* From / To / Ratio Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fromIngredient" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  SWAP FROM — INGREDIENT TO REPLACE
                </label>
                <select
                  id="fromIngredient"
                  value={formData.fromIngredient}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Select ingredient —</option>
                  {allIngredients.map(ing => (
                    <option key={ing} value={ing}>{ing}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="toIngredient" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  SWAP TO — REPLACEMENT INGREDIENT
                </label>
                <select
                  id="toIngredient"
                  value={formData.toIngredient}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Select ingredient —</option>
                  {allIngredients.map(ing => (
                    <option key={ing} value={ing}>{ing}</option>
                  ))}
                </select>
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
                <p className="text-[10px] text-gray-400 mt-1">1.0 = same %; 0.9 = 90% of original; 1.1 = 110%</p>
              </div>
            </div>

            {/* Reason / Approved By Row */}
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

              <div>
                <label htmlFor="approvedBy" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  APPROVED BY
                </label>
                <input
                  type="text"
                  id="approvedBy"
                  value={formData.approvedBy}
                  onChange={handleInputChange}
                  placeholder="Enter approver name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Product Selection Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-blue-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <span className="text-sm font-semibold text-gray-900">Apply To / Exempt</span>
              </div>
              {formData.fromIngredient && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {affectedProductsCount} PR(s) affected
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            <p className="text-xs text-gray-500 mb-3">
              Check PRs to apply swap. Uncheck to exempt. Only PRs containing the "From" ingredient are affected after preview.
            </p>

            <div className="space-y-2">
              {products.map(pr => {
                const hasFromIngredient = formData.fromIngredient && pr.ingredients.includes(formData.fromIngredient);
                const willBeAffected = hasFromIngredient && pr.selected;

                return (
                  <div
                    key={pr.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      willBeAffected
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : hasFromIngredient
                        ? 'border-gray-200 bg-gray-50/50'
                        : 'border-gray-100 bg-white opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pr.selected}
                      onChange={() => toggleProduct(pr.id)}
                      disabled={!hasFromIngredient && !!formData.fromIngredient}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">{pr.name}</span>
                        {willBeAffected && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            WILL SWAP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-mono">{pr.code}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{pr.rmCount} RMs</span>
                        {hasFromIngredient && (
                          <>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-emerald-600 font-medium">✓ Contains {formData.fromIngredient}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!hasFromIngredient && formData.fromIngredient && (
                      <span className="text-xs text-gray-400 shrink-0">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-100">
              <button
                onClick={handlePreview}
                disabled={!formData.fromIngredient || !formData.toIngredient}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                👁 Preview
              </button>
              <button
                onClick={handleApplySwap}
                disabled={!showPreview || affectedProductsCount === 0}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ✓ Apply Swap
              </button>
              {showPreview && (
                <span className="text-xs text-emerald-600 font-medium ml-2">
                  ✓ Preview ready — {affectedProductsCount} PR(s) selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Swap History ── */}
        {swapHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-emerald-50/50 to-transparent">
              <span className="text-sm font-semibold text-gray-900">Swap History</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Date</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">From → To</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Ratio</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Ratio</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Approved By</th>
                    <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Affected PRs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {swapHistory.map(swap => (
                    <tr key={swap.id} className="hover:bg-linear-to-r hover:from-emerald-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-sm font-medium">{swap.date}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-red-600 group-hover:text-red-700">{swap.fromIngredient}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-emerald-600 group-hover:text-emerald-700">{swap.toIngredient}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{swap.swapRatio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={swap.reason}>{swap.reason}</td>
                      <td className="px-4 py-3 text-gray-600">{swap.approvedBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {swap.affectedPRs.map(pr => (
                            <span key={pr} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              {pr}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UniversalSwap;
