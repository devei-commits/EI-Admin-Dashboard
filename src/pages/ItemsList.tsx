import React, { useState } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';

type ItemRecord = {
  id: string;
  code: string;
  name: string;
  type: 'RM' | 'PM';
  category: string;
  pricePerUnit: number;
  uom: string;
  gst: number;
  status: string;
  vendors: number;
  tiers: number;
  lastUpdated: string;
};

const ITEMS_SEED: ItemRecord[] = [
  { id: '1', code: 'EI-RM-BASE-001', name: 'Aqua (Purified Water)', type: 'RM', category: 'BASE', pricePerUnit: 8.85, uom: 'KG', gst: 8, status: 'Active', vendors: 1, tiers: 0, lastUpdated: '2026-02-15' },
  { id: '2', code: 'EI-RM-UV-001', name: 'Homosalate', type: 'RM', category: 'UV FILTER', pricePerUnit: 1200, uom: 'KG', gst: 18, status: 'Active', vendors: 2, tiers: 4, lastUpdated: '2026-02-20' },
  { id: '3', code: 'EI-RM-UV-002', name: 'Octinoxate', type: 'RM', category: 'UV FILTER', pricePerUnit: 680, uom: 'KG', gst: 18, status: 'Active', vendors: 1, tiers: 3, lastUpdated: '2026-02-18' },
  { id: '4', code: 'EI-RM-UV-003', name: 'Octocrylene', type: 'RM', category: 'UV FILTER', pricePerUnit: 590, uom: 'KG', gst: 18, status: 'Active', vendors: 1, tiers: 2, lastUpdated: '2026-02-17' },
  { id: '5', code: 'EI-RM-UV-004', name: 'Avobenzone', type: 'RM', category: 'UV FILTER', pricePerUnit: 1250, uom: 'KG', gst: 18, status: 'Active', vendors: 1, tiers: 3, lastUpdated: '2026-02-16' },
  { id: '6', code: 'EI-RM-EMUL-001', name: 'Cetearyl Alcohol', type: 'RM', category: 'EMULSIFIER', pricePerUnit: 185, uom: 'KG', gst: 12, status: 'Active', vendors: 0, tiers: 0, lastUpdated: '2026-02-14' },
  { id: '7', code: 'EI-RM-EMUL-002', name: 'Ceteareth-20', type: 'RM', category: 'EMULSIFIER', pricePerUnit: 310, uom: 'KG', gst: 12, status: 'Active', vendors: 0, tiers: 0, lastUpdated: '2026-02-14' },
  { id: '8', code: 'EI-RM-ACT-001', name: 'Glycerin', type: 'RM', category: 'ACTIVE', pricePerUnit: 95, uom: 'KG', gst: 12, status: 'Active', vendors: 0, tiers: 0, lastUpdated: '2026-02-13' },
  { id: '9', code: 'EI-RM-ACT-002', name: 'Niacinamide', type: 'RM', category: 'ACTIVE', pricePerUnit: 1450, uom: 'KG', gst: 12, status: 'Active', vendors: 2, tiers: 3, lastUpdated: '2026-02-19' },
  { id: '10', code: 'EI-RM-ACT-003', name: 'Ascorbyl Glucoside', type: 'RM', category: 'ACTIVE', pricePerUnit: 4800, uom: 'KG', gst: 12, status: 'Active', vendors: 1, tiers: 3, lastUpdated: '2026-02-21' },
  { id: '11', code: 'EI-PM-TUB-001', name: '50g Aluminium Laminated Tube', type: 'PM', category: 'TUBE', pricePerUnit: 12.50, uom: 'PCS', gst: 18, status: 'Active', vendors: 1, tiers: 2, lastUpdated: '2026-02-20' },
  { id: '12', code: 'EI-PM-BTL-001', name: '150ml Clear PET Pump Bottle', type: 'PM', category: 'BOTTLE', pricePerUnit: 18.75, uom: 'PCS', gst: 18, status: 'Active', vendors: 1, tiers: 1, lastUpdated: '2026-02-19' },
  { id: '13', code: 'EI-PM-LABEL-001', name: 'Self-adhesive Label (50x100mm)', type: 'PM', category: 'LABEL', pricePerUnit: 2.40, uom: 'PCS', gst: 18, status: 'Active', vendors: 1, tiers: 0, lastUpdated: '2026-02-15' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  'UV FILTER': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  BASE: { bg: 'bg-slate-100', text: 'text-slate-600', badge: 'bg-slate-100' },
  EMULSIFIER: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
  TUBE: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
  BOTTLE: { bg: 'bg-cyan-50', text: 'text-cyan-700', badge: 'bg-cyan-100' },
  LABEL: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
};

const ItemsList: React.FC = () => {
  const { items: _items } = useItems();
  const { addToast: _addToast } = useToast();

  const [allItems] = useState<ItemRecord[]>(ITEMS_SEED);
  const [typeFilter, setTypeFilter] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, _setSortBy] = useState<'code' | 'price'>('code');
  const [sortAsc, _setSortAsc] = useState(true);

  // Filter and sort
  const filtered = allItems
    .filter(item => {
      const matchType = typeFilter === 'All' || item.type === typeFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        item.code.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchType && matchSearch;
    })
    .sort((a, b) => {
      const compareValue = sortBy === 'code' 
        ? a.code.localeCompare(b.code)
        : a.pricePerUnit - b.pricePerUnit;
      return sortAsc ? compareValue : -compareValue;
    });

  const stats = {
    rmItems: allItems.filter(i => i.type === 'RM').length,
    pmItems: allItems.filter(i => i.type === 'PM').length,
    withVendors: allItems.filter(i => i.vendors > 0).length,
    withTiers: allItems.filter(i => i.tiers > 0).length,
  };

  const statCards = [
    { label: 'RM ITEMS', value: stats.rmItems, sub: 'Raw material masters', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PM ITEMS', value: stats.pmItems, sub: 'Packaging masters', accent: 'border-l-violet-500', num: 'text-violet-600' },
    { label: 'W/ VENDORS', value: stats.withVendors, sub: 'Multi-vendor setup', accent: 'border-l-amber-500', num: 'text-amber-600' },
    { label: 'W/ TIERS', value: stats.withTiers, sub: 'MOQ price breaks', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  function formatPrice(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0 });
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">📋</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Item Catalog</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Items List</h1>
            <p className="text-sm text-gray-600">Complete item master with pricing tiers, vendor rates, and MOQ breakpoints.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => (
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

        {/* ── Toolbar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Items — Pricing & Tiers</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{filtered.length} / {allItems.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search item…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all w-48"
                />
              </div>

              {/* Type Tabs */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                {(['All', 'RM', 'PM'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                      typeFilter === type
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Add Button */}
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md">
                <span className="text-base leading-none">+</span> Add Item
              </button>
            </div>
          </div>

          {/* ── Items List ── */}
          <div className="divide-y divide-gray-100 max-h-200 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  No items match your search.
                </div>
              </div>
            ) : filtered.map((item, _idx) => {
              const colors = CATEGORY_COLORS[item.category] || { bg: 'bg-gray-100', text: 'text-gray-600', badge: 'bg-gray-100' };
              return (
                <div key={item.id} className="p-5 hover:bg-linear-to-r hover:from-blue-50/50 hover:to-transparent transition-colors group">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 group-hover:text-blue-700">{item.code}</span>
                        <span className="text-xs text-gray-500">·</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.badge}`}>
                          {item.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.type === 'RM' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-1.5 group-hover:text-blue-700 transition-colors">{item.name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                      item.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {item.status === 'Active' ? '✓ ' : ''}{item.status}
                    </span>
                  </div>

                  {/* Details Row */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">Price/Unit</p>
                      <p className="font-bold text-amber-600 group-hover:text-amber-700">{formatPrice(item.pricePerUnit)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">UOM</p>
                      <p className="text-gray-700 font-semibold">{item.uom}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">GST</p>
                      <p className="text-gray-700 font-semibold">{item.gst}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">Vendors</p>
                      <p className={`font-bold ${item.vendors > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {item.vendors > 0 ? `${item.vendors} vendor${item.vendors > 1 ? 's' : ''}` : 'No tiers'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">Tiers</p>
                      <p className={`font-bold ${item.tiers > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {item.tiers > 0 ? `${item.tiers} tier${item.tiers > 1 ? 's' : ''}` : 'List only'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-0.5">Updated</p>
                      <p className="text-gray-600">{item.lastUpdated}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                      ⚙️ Edit
                    </button>
                    {item.vendors > 0 && (
                      <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition-colors">
                        💰 View Tiers
                      </button>
                    )}
                    {item.vendors === 0 && (
                      <button className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                        + Add Tiers
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ItemsList;
