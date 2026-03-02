import { useState } from 'react';
import ZoneDetailsSidebar from './ZoneDetailsSidebar';

type KpiCard = {
  id: string;
  label: string;
  subtitle: string;
  value: string;
  accentColor: string;
};

type Zone = {
  id: string;
  name: string;
  title: string;
  description: string;
  items: number;
  racks: number;
  alerts: number;
  utilization: number;
  footprint: string;
  tags: string[];
};

type ActivityItem = {
  id: string;
  type: 'grn' | 'mrn' | 'alert';
  title: string;
  subtitle: string;
  meta: string;
};

const kpis: KpiCard[] = [
  { id: 'total-skus', label: 'Total SKUs', subtitle: 'RM · PM · Finished Goods', value: '32', accentColor: 'border-emerald-500 text-emerald-600 bg-emerald-50' },
  { id: 'low-stock', label: 'Low / Critical Stock', subtitle: 'Items below reorder', value: '0', accentColor: 'border-amber-500 text-amber-600 bg-amber-50' },
  { id: 'pending-grn', label: 'Pending GRN', subtitle: 'POs awaiting GRN', value: '2', accentColor: 'border-sky-500 text-sky-600 bg-sky-50' },
  { id: 'open-requests', label: 'Open Requests', subtitle: 'MRNs in progress', value: '3', accentColor: 'border-indigo-500 text-indigo-600 bg-indigo-50' },
  { id: 'fg-under-qc', label: 'FG Under QC', subtitle: 'Batches pending release', value: '1', accentColor: 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50' },
  { id: 'wh-zones', label: 'WH Zones', subtitle: '21 racks · 6 team members', value: '6', accentColor: 'border-slate-400 text-slate-700 bg-slate-50' },
];

const zones: Zone[] = [
  { id: 'zone-a', name: 'Zone A', title: 'RM Store', description: 'Raw materials — Ambient, Cool & Cold sections', items: 18, racks: 28, alerts: 0, utilization: 68, footprint: '380 sqm · Ambient + Cool + Cold zones', tags: ['A1', 'A2', 'A3', 'A4', 'RM 01', 'RM 02', 'QC OK'] },
  { id: 'zone-b', name: 'Zone B', title: 'Actives Store', description: 'High-value actives & UV filters — Restricted access', items: 8, racks: 8, alerts: 0, utilization: 78, footprint: '120 sqm · Cool <25°C · Climate controlled', tags: ['B1', 'B2', 'B3', 'B4', 'ACT 01', 'ACT 02'] },
  { id: 'zone-c', name: 'Zone C', title: 'Primary Pack Store', description: 'Bottles, tubes, pumps, closures — Primary packaging', items: 5, racks: 16, alerts: 0, utilization: 53, footprint: '220 sqm · Ambient', tags: ['C1', 'C2', 'C3', 'C4'] },
  { id: 'zone-d', name: 'Zone D', title: 'Labels Store', description: 'Self-adhesive labels, printed inserts, leaflets', items: 2, racks: 6, alerts: 0, utilization: 48, footprint: '80 sqm · Ambient humidity-controlled', tags: ['D1', 'D2', 'LBL 01'] },
  { id: 'zone-e', name: 'Zone E', title: 'Secondary Pack Store', description: 'Monocartons, shippers, corrugate — Secondary packaging', items: 4, racks: 12, alerts: 0, utilization: 47, footprint: '260 sqm · Ambient', tags: ['E1', 'E2', 'E3', 'E4'] },
  { id: 'zone-f', name: 'Zone F', title: 'Finished Goods Store', description: 'Finished goods — Quarantine, QC Released & Dispatch Ready', items: 2, racks: 12, alerts: 0, utilization: 29, footprint: '300 sqm · Cold dry <25°C', tags: ['F1', 'F2', 'FG 01', 'FG 02'] },
];

const recentActivity: ActivityItem[] = [
  { id: 'act-1', type: 'grn', title: 'GRN-003 completed — Packwell Industries', subtitle: 'Sunscreen packaging received · 3 items · ₹79,250', meta: '2h ago' },
  { id: 'act-2', type: 'mrn', title: 'MRN-003 transfer initiated by Ravi Kumar', subtitle: 'Sunscreen RM → Manufacturing Line 1 · 3 items', meta: '3h ago' },
  { id: 'act-3', type: 'alert', title: 'Low stock alert — E-RM-HP-ACT-001 (Glycerin)', subtitle: 'Still 140 KG · Reorder point 80 KG · Avg consumption 25 KG/week', meta: '4h ago' },
  { id: 'act-4', type: 'mrn', title: 'MRN-002 on hold — Qty mismatch (SLES 70%)', subtitle: 'Received 1040 KG vs 1000 KG · Pending QC decision', meta: '5h ago' },
  { id: 'act-5', type: 'grn', title: 'GRN-004 completed — Facewash batch BTH-FW-002', subtitle: 'Kanari Nair · 2 tonnes transferred to ML2', meta: 'Yesterday' },
];

const Overview = () => {
  const [selectedZone, setSelectedZone] = useState<{
    id: string;
    name: string;
    type: string;
    location: string;
    utilization: number;
    items: number;
    racks: number;
  } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleOpenZone = (zone: Zone) => {
    setSelectedZone({
      id: zone.id,
      name: zone.name,
      type: zone.title,
      location: zone.footprint,
      utilization: zone.utilization,
      items: zone.items,
      racks: zone.racks,
    });
    setSelectedItemId(null);
  };

  const handleCloseZone = () => {
    setSelectedZone(null);
    setSelectedItemId(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-white p-6 relative">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Warehouse Overview</h1>
            <p className="mt-1 text-sm text-slate-500">Live snapshot of warehouse zones, inventory movement, GRNs and material requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              3 alerts
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              Hyderabad Plant 1
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map(card => (
            <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between min-h-27.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                </div>
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border ${card.accentColor}`}>
                  {card.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Warehouse Zones — Utilisation</h2>
            <p className="text-xs text-slate-500 mt-1">Zone-wise capacity, alerts and utilization across the warehouse.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {zones.map(zone => (
              <button
                key={zone.id}
                type="button"
                onClick={() => handleOpenZone(zone)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 text-left hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{zone.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{zone.title}</p>
                    <p className="mt-1 text-xs text-slate-500 max-w-xs">{zone.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-emerald-600">{zone.utilization}%</span>
                    <div className="relative h-1.5 w-20 rounded-full bg-slate-100">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${zone.utilization}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Utilisation</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-slate-400">Items</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{zone.items}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-slate-400">Racks</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{zone.racks}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-slate-400">Alerts</p>
                    <p className="mt-0.5 text-sm font-semibold text-emerald-600">{zone.alerts}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="mb-1 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-100">{zone.footprint}</span>
                  {zone.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3 items-start">
          <div className="xl:col-span-2 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${item.type === 'grn' ? 'bg-sky-500' : item.type === 'mrn' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.meta}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Low / Critical Stock</h2>
              </div>
              <div className="px-4 py-3 text-xs text-slate-400">All items currently within safe inventory range.</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Open GRNs</h2>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">EI-GRN-2025-002</p>
                    <p className="text-[11px] text-slate-500 truncate">EI-PO-2025-002 · Chemspec India</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">Under GRN</span>
                </div>
                <div className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">EI-GRN-2025-004</p>
                    <p className="text-[11px] text-slate-500 truncate">EI-PO-2025-004 · Packwell Industries</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-100">In Transit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedZone && (
        <ZoneDetailsSidebar
          zone={selectedZone}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onClearSelectedItem={() => setSelectedItemId(null)}
          onClose={handleCloseZone}
        />
      )}
    </div>
  );
};

export default Overview;
