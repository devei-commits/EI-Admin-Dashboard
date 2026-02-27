import React, { useState } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';

type ItemGroupMember = {
  id: string;
  code: string;
  name: string;
  ratio?: number;
  status: 'approved';
};

type ItemGroupAlternate = {
  id: string;
  name: string;
  notes: string;
  status: 'proposed' | 'under-review';
  ratio?: number;
};

type ItemGroup = {
  id: string;
  code: string;
  icon: string;
  type: 'RM' | 'PM';
  name: string;
  description: string;
  purpose: string;
  status: 'Active' | 'Inactive';
  approvedMembers: ItemGroupMember[];
  proposedAlternates: ItemGroupAlternate[];
  notes: string;
};

const ITEM_GROUPS_SEED: ItemGroup[] = [
  {
    id: '1',
    code: 'IG-001',
    icon: '💧',
    type: 'RM',
    name: 'Emulsion Base Water Phase',
    description: 'Purified water sources — mutually interchangeable at same %',
    purpose: 'Water phase for emulsions',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-BASE-001', name: 'Aqua (Purified Water)', status: 'approved' }
    ],
    proposedAlternates: [],
    notes: 'Only one water source currently; group for future expansion'
  },
  {
    id: '2',
    code: 'IG-002',
    icon: '☀️',
    type: 'RM',
    name: 'Broad-Spectrum UV Filter Pack',
    description: 'UV filters approved for sunscreen formula — swap within regulatory limits',
    purpose: 'Sunscreen actives',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-UV-001', name: 'Homosalate', status: 'approved' },
      { id: '2', code: 'EI-RM-UV-002', name: 'Octinoxate', status: 'approved' },
      { id: '3', code: 'EI-RM-UV-003', name: 'Octocrylene', status: 'approved' },
      { id: '4', code: 'EI-RM-UV-004', name: 'Avobenzone', status: 'approved' }
    ],
    proposedAlternates: [],
    notes: 'Any UV filter can substitute another; SPF must be re-verified'
  },
  {
    id: '3',
    code: 'IG-003',
    icon: '🔄',
    type: 'RM',
    name: 'Emulsifiers',
    description: 'Oil & water phase binders — compatibility tested',
    purpose: 'Emulsion stabilizers',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-EMUL-001', name: 'Cetearyl Alcohol', status: 'approved' },
      { id: '2', code: 'EI-RM-EMUL-002', name: 'Ceteareth-20', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: 'Glyceryl Stearate SE', notes: 'Not yet approved — R&D trial pending', status: 'proposed' }
    ],
    notes: 'Both emulsifiers work as a pair; avoid swapping one without the other'
  },
  {
    id: '4',
    code: 'IG-004',
    icon: '🧊',
    type: 'RM',
    name: 'Carbomer Rheology Modifier',
    description: 'Carbomer 980 and Carbopol 940 are functionally interchangeable at same %',
    purpose: 'Viscosity adjusters',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-POLY-001', name: 'Carbomer 980', status: 'approved' },
      { id: '2', code: 'EI-RM-POLY-002', name: 'Carbopol 940', ratio: 1, status: 'approved' }
    ],
    proposedAlternates: [],
    notes: '980 preferred for sunscreen, 940 for facewash; can cross-swap at 1:1 if supply disrupted'
  },
  {
    id: '5',
    code: 'IG-005',
    icon: '🛡️',
    type: 'RM',
    name: 'Preservative System',
    description: 'Phenoxyethanol primary; Ethylhexylglycerin combination as backup',
    purpose: 'Preservative actives',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-PRES-001', name: 'Phenoxyethanol', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: 'Phenoxyethanol + Ethylhexylglycerin (0.7%+0.1%)', notes: 'Cosmos-approved alternative; re-challenge test needed', status: 'proposed' }
    ],
    notes: 'Primary preservative at 0.8%; alternative is 0.7% Pheno + 0.1% EHG'
  },
  {
    id: '6',
    code: 'IG-006',
    icon: '🍋',
    type: 'RM',
    name: 'Vitamin C Derivatives',
    description: 'Ascorbyl Glucoside and Sodium Ascorbyl Phosphate — functionally equivalent antioxidants',
    purpose: 'Antioxidant actives',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-ACT-003', name: 'Ascorbyl Glucoside', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: 'Sodium Ascorbyl Phosphate', notes: 'Stability assessment pending; awaiting R&D sign-off', status: 'proposed' }
    ],
    notes: 'Use at same % if supply of Ascorbyl Glucoside is disrupted'
  },
  {
    id: '7',
    code: 'IG-007',
    icon: '🫧',
    type: 'RM',
    name: 'Anionic Surfactant',
    description: 'Primary SLES is primary; SCI can partially replace for milder formulas',
    purpose: 'Cleansing agents',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-SURF-001', name: 'SLES 70%', status: 'approved' },
      { id: '2', code: 'EI-RM-SURF-003', name: 'SCI (Sodium Cocoyl Isethionate)', ratio: 0.9, status: 'approved' }
    ],
    proposedAlternates: [],
    notes: 'SCI replaces SLES at 90% ratio by weight for similar foaming; viscosity re-adjust needed'
  },
  {
    id: '8',
    code: 'IG-008',
    icon: '🫧',
    type: 'RM',
    name: 'Amphoteric Co-Surfactant',
    description: 'CAPB primary amphoteric; alternatives include Sodium Lauroamphoacetate',
    purpose: 'Conditioning agents',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-RM-SURF-002', name: 'CAPB 35%', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: 'Sodium Lauroamphoacetate', notes: 'Milder; trial batch needed', status: 'proposed' }
    ],
    notes: '1:1 swap possible; SLAA is milder and palm-free'
  },
  {
    id: '9',
    code: 'IG-PM-001',
    icon: '🧴',
    type: 'PM',
    name: '50g Sunscreen Primary Pack Tube',
    description: 'Tube options for 50g sunscreen — aluminium laminate vs plastic alternatives',
    purpose: 'Primary packaging',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-PM-TUB-001', name: '50g Aluminium Laminated Tube', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: '50g HDPE Squeeze Tube', notes: 'Backup option; artwork re-approval needed', status: 'proposed' }
    ],
    notes: 'Aluminium laminate preferred for UV product protection; HDPE as cost/supply backup'
  },
  {
    id: '10',
    code: 'IG-PM-002',
    icon: '🍶',
    type: 'PM',
    name: '150ml Facewash Bottle',
    description: '150ml pump bottle — PET options including opaque alternatives',
    purpose: 'Primary packaging',
    status: 'Active',
    approvedMembers: [
      { id: '1', code: 'EI-PM-BTL-001', name: '150ml Clear PET Pump Bottle', status: 'approved' }
    ],
    proposedAlternates: [
      { id: '1', name: '150ml HDPE Opaque Pump Bottle', notes: 'Backup vendor; same neck finish 28/410', status: 'proposed' }
    ],
    notes: 'PET transparent preferred per brand; HDPE opaque as supply backup'
  }
];

const ItemGroups: React.FC = () => {
  const [itemGroups] = useState<ItemGroup[]>(ITEM_GROUPS_SEED);
  const [typeFilter, setTypeFilter] = useState<'All' | 'RM' | 'PM'>('All');
  const [searchQuery, setSearchQuery] = useState('');

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
    alternates: itemGroups.reduce((sum, ig) => sum + ig.proposedAlternates.length, 0)
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

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl">🔗</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">Item Configuration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Item Groups</h1>
            <p className="text-sm text-gray-600">Manage approved member items and proposed alternates for supply continuity.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => (
            <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
              <div className={`h-1 bg-linear-to-r from-violet-400 to-violet-600 ${card.accent}`} />
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
              <span className="text-sm font-semibold text-gray-800">Item Groups — Alternate Sourcing</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200/50">{filtered.length} / {itemGroups.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
               <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search group…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all w-44"
                />
              </div>

              {/* Type Tabs */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                {['All', 'RM', 'PM'].map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type as 'All' | 'RM' | 'PM')}
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

              {/* New Group Button */}
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md">
                <span className="text-base leading-none">+</span> New Group
              </button>
            </div>
          </div>

          {/* Item Groups List */}
          <div className="divide-y divide-gray-100">
            {filtered.map(ig => (
              <div key={ig.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                {/* Header Row */}
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    ig.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {ig.status === 'Active' ? '✓ ' : ''}{ig.status}
                  </span>
                </div>

                {/* Members Section */}
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
                          {member.ratio && member.ratio !== 1 && (
                            <span className="text-gray-400">×{member.ratio}</span>
                          )}
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
                            {alt.ratio && alt.ratio !== 1 && (
                              <span className="text-gray-400">×{alt.ratio}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {ig.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">💡 </span>
                      {ig.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ItemGroups;
