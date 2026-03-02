import { useState } from 'react';
import { X } from 'lucide-react';
import { InventoryItem, mockInventoryData } from './Inventory';

interface Rack {
  id: string;
  name: string;
  subtitle: string;
  utilization: number;
  levels: number;
  slots: number;
  itemsStored: number;
  tags: string[];
}

interface Store {
  id: string;
  name: string;
  zone: string;
  icon: string;
  meta: string;
  utilization: number;
  racks: Rack[];
}

const storesData: Store[] = [
  {
    id: '1',
    name: 'RM Store',
    zone: 'Zone A',
    icon: '🧪',
    meta: '380 sqm · Ambient + Cool + Cold zones · 15 items · 7 racks',
    utilization: 68,
    racks: [
      { id: 'a1', name: 'A1', subtitle: 'Ambient Row 1', utilization: 87, levels: 4, slots: 16, itemsStored: 2, tags: ['001', '001'] },
      { id: 'a2', name: 'A2', subtitle: 'Ambient Row 2', utilization: 62, levels: 4, slots: 16, itemsStored: 5, tags: ['001', '002', '001', '002', '+1'] },
      { id: 'a3', name: 'A3', subtitle: 'Ambient Row 3', utilization: 45, levels: 4, slots: 16, itemsStored: 2, tags: ['001', '002'] },
      { id: 'a4', name: 'A4', subtitle: 'Ambient Row 4', utilization: 30, levels: 4, slots: 16, itemsStored: 0, tags: [] },
      { id: 'b1', name: 'B1', subtitle: 'Cool Store <25°C', utilization: 75, levels: 3, slots: 12, itemsStored: 2, tags: ['001', '002'] },
      { id: 'b2', name: 'B2', subtitle: 'Cool Store <25°C', utilization: 50, levels: 3, slots: 12, itemsStored: 3, tags: ['001', '001', '002'] },
      { id: 'c1', name: 'C1', subtitle: 'Cold Store 2–8°C', utilization: 100, levels: 2, slots: 8, itemsStored: 1, tags: ['006'] },
    ],
  },
  {
    id: '2',
    name: 'Actives Store',
    zone: 'Zone B',
    icon: '⚗️',
    meta: '120 sqm · Cool <25°C / Climate controlled · 8 items · 2 racks',
    utilization: 78,
    racks: [
      { id: 'b3', name: 'B1', subtitle: 'Actives UV Filters', utilization: 89, levels: 3, slots: 9, itemsStored: 4, tags: ['001', '002', '003', '004'] },
      { id: 'b4', name: 'B2', subtitle: 'Actives Vitamins/C', utilization: 67, levels: 3, slots: 9, itemsStored: 4, tags: ['002', '003', '004', '005'] },
    ],
  },
  {
    id: '3',
    name: 'Primary Pack Store',
    zone: 'Zone C',
    icon: '📦',
    meta: '220 sqm · Ambient · 4 items · 4 racks',
    utilization: 53,
    racks: [
      { id: 'c1', name: 'C1', subtitle: 'Pack Bottles', utilization: 95, levels: 4, slots: 18, itemsStored: 1, tags: ['004'] },
      { id: 'c2', name: 'C2', subtitle: 'Pack Tubes/Caps', utilization: 76, levels: 4, slots: 16, itemsStored: 2, tags: ['001', '004'] },
      { id: 'c3', name: 'C3', subtitle: 'Pack Pumps/Closures', utilization: 44, levels: 4, slots: 16, itemsStored: 1, tags: ['024'] },
      { id: 'c4', name: 'C4', subtitle: 'Pack Reserve/Overflow', utilization: 15, levels: 4, slots: 18, itemsStored: 0, tags: [] },
    ],
  },
  {
    id: '4',
    name: 'Labels Store',
    zone: 'Zone D',
    icon: '🏷️',
    meta: '80 sqm · Ambient humidity-controlled · 1 items · 2 racks',
    utilization: 48,
    racks: [
      { id: 'd1', name: 'D1', subtitle: 'Labels Self-Adhesive', utilization: 89, levels: 3, slots: 12, itemsStored: 1, tags: ['001'] },
      { id: 'd2', name: 'D2', subtitle: 'Labels Printed Leaflets', utilization: 47, levels: 3, slots: 12, itemsStored: 0, tags: [] },
    ],
  },
  {
    id: '5',
    name: 'Secondary Pack Store',
    zone: 'Zone E',
    icon: '📮',
    meta: '260 sqm · Ambient · 2 items · 3 racks',
    utilization: 47,
    racks: [
      { id: 'e1', name: 'E1', subtitle: 'SPM Sunscreen Cartons', utilization: 64, levels: 5, slots: 10, itemsStored: 1, tags: ['001'] },
      { id: 'e2', name: 'E2', subtitle: 'SPM Facewash Cartons', utilization: 45, levels: 4, slots: 16, itemsStored: 1, tags: ['002'] },
      { id: 'e3', name: 'E3', subtitle: 'SPM Shippers/Master', utilization: 22, levels: 3, slots: 12, itemsStored: 0, tags: [] },
    ],
  },
  {
    id: '6',
    name: 'Finished Goods Store',
    zone: 'Zone F',
    icon: '✅',
    meta: '300 sqm · Cold dry <25°C · 2 items · 3 racks',
    utilization: 29,
    racks: [
      { id: 'f1', name: 'F1', subtitle: 'FG Quarantine (Under QC)', utilization: 56, levels: 3, slots: 12, itemsStored: 0, tags: [] },
      { id: 'f2', name: 'F2', subtitle: 'FG QC Released / Approved', utilization: 56, levels: 4, slots: 16, itemsStored: 2, tags: ['0005', '0002'] },
      { id: 'f3', name: 'F3', subtitle: 'FG Dispatch Ready', utilization: 48, levels: 4, slots: 16, itemsStored: 0, tags: [] },
    ],
  },
];

const getUtilizationBarColor = (value: number) => {
  if (value >= 90) return 'bg-rose-500';
  if (value >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const getUtilizationBadge = (value: number) => {
  if (value >= 90) return 'text-rose-700 bg-rose-100 border-rose-200';
  if (value >= 70) return 'text-amber-700 bg-amber-100 border-amber-200';
  return 'text-emerald-700 bg-emerald-100 border-emerald-200';
};

const WarehouseLocations = () => {
  const [selectedRack, setSelectedRack] = useState<{ store: Store; rack: Rack } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>(mockInventoryData);

  const updateInventoryItem = (itemId: string, field: keyof InventoryItem, value: number) => {
    setInventoryData(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock') {
            updatedItem.stockInHand = updatedItem.whStock + updatedItem.ml1Stock + updatedItem.ml2Stock;
          }
          if (selectedItem && selectedItem.id === itemId) {
            setSelectedItem(updatedItem);
          }
          return updatedItem;
        }
        return item;
      });
      return updated;
    });
  };

  const getRackCondition = (subtitle: string) => {
    if (subtitle.toLowerCase().includes('cold')) return 'Cold';
    if (subtitle.toLowerCase().includes('cool')) return 'Cool';
    return 'Ambient';
  };

  const getRackItems = (rack: Rack) => {
    if (rack.itemsStored === 0) return [];

    return Array.from({ length: rack.itemsStored }).map((_, index) => ({
      code: `EI-RM-EXCIP-${String(index + 1).padStart(3, '0')}`,
      name: `${rack.name} Material ${index + 1}`,
      qty: `${Math.max(8, 35 - index * 6)} KG`,
    }));
  };

  const getRackSlotMap = (rack: Rack) => {
    const totalPositions = rack.levels * Math.max(1, Math.floor(rack.slots / rack.levels));
    return Array.from({ length: totalPositions }).map((_, index) => {
      const level = Math.floor(index / Math.max(1, Math.floor(rack.slots / rack.levels))) + 1;
      const slot = (index % Math.max(1, Math.floor(rack.slots / rack.levels))) + 1;
      const isFilled = index < rack.itemsStored;
      const code = rack.tags[index] || `L${level}-S${slot}`;

      return { code, label: `L${level}-S${slot}`, isFilled };
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="w-full space-y-5">
        <h1 className="text-3xl font-bold text-slate-900">Warehouse Locations & Rack Management</h1>

        {storesData.map(store => (
          <section key={store.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{store.icon}</span>
                  <h2 className="text-2xl font-bold text-slate-900 leading-none">{store.name}</h2>
                  <span className="text-sm font-semibold text-emerald-700">{store.zone}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{store.meta}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utilisation</p>
                <p className="text-2xl font-bold text-cyan-700 leading-none">{store.utilization}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7">
              {store.racks.map(rack => (
                <button
                  key={rack.id}
                  type="button"
                  onClick={() => setSelectedRack({ store, rack })}
                  className="px-4 py-3 border-r border-b border-slate-200 last:border-r-0 text-left hover:bg-cyan-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xl font-bold text-cyan-700 leading-none">{rack.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${getUtilizationBadge(rack.utilization)}`}>
                      {rack.utilization}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{rack.subtitle}</p>

                  <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getUtilizationBarColor(rack.utilization)}`}
                      style={{ width: `${rack.utilization}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-600">
                    {rack.levels} levels · {rack.slots} slots · {rack.itemsStored} items stored
                  </p>

                  {rack.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rack.tags.map(tag => (
                        <span
                          key={`${rack.id}-${tag}`}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 h-5" />
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedRack && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-3xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-slate-900">
                Rack - Bay {selectedRack.rack.name} - {selectedRack.rack.subtitle}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedRack(null)}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bay</p>
                  <p className="text-2xl font-bold text-cyan-700 mt-1">{selectedRack.rack.name}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zone</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{selectedRack.store.name}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Levels × Slots</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {selectedRack.rack.levels} × {selectedRack.rack.slots} = {selectedRack.rack.levels * selectedRack.rack.slots} positions
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{getRackCondition(selectedRack.rack.subtitle)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utilisation</p>
                  <p className="text-2xl font-bold text-cyan-700 mt-1">{selectedRack.rack.utilization}%</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <span className="inline-flex mt-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 text-sm font-semibold">
                    Active
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-cyan-700 border-b border-slate-200 pb-2">Rack Slot Map</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3">
                  {getRackSlotMap(selectedRack.rack).map(slot => (
                    <div
                      key={`${selectedRack.rack.id}-${slot.code}-${slot.label}`}
                      className={`rounded-lg border p-2 text-center min-h-14 flex flex-col items-center justify-center ${
                        slot.isFilled
                          ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <p className="text-xs font-bold">{slot.code}</p>
                      <p className="text-[10px]">{slot.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-cyan-700 border-b border-slate-200 pb-2">
                  Items Stored ({selectedRack.rack.itemsStored})
                </h3>
                <div className="mt-2 space-y-2">
                  {getRackItems(selectedRack.rack).length === 0 ? (
                    <p className="text-sm text-slate-500">No items currently stored in this rack.</p>
                  ) : (
                    getRackItems(selectedRack.rack).map(item => {
                      const inventoryItem = inventoryData.find(inv => inv.code === item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => inventoryItem && setSelectedItem(inventoryItem)}
                          className="w-full flex items-center justify-between py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div>
                            <p className="text-xs font-semibold text-cyan-700">{item.code}</p>
                            <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                          </div>
                          <span className="px-3 py-1 rounded-lg border border-cyan-300 bg-cyan-100 text-cyan-800 text-sm font-bold">
                            {item.qty}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRack(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Inventory — {selectedItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded border border-cyan-300 bg-cyan-50 text-cyan-700 text-[10px] font-semibold">SIH: {selectedItem.stockInHand} {selectedItem.whUnit}</span>
                <span className="px-2 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-semibold">W1: {selectedItem.whStock}</span>
                <span className="px-2 py-0.5 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 text-[10px] font-semibold">ML1: {selectedItem.ml1Stock}</span>
                <span className="px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-semibold">ML2: {selectedItem.ml2Stock}</span>
                <span className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-semibold">Reserved: {selectedItem.reserved}</span>
                <span className="px-2 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-700 text-[10px] font-semibold">In Transit: {selectedItem.inTransit}</span>
                <span className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-semibold">{selectedItem.status}</span>
                <span className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold">{selectedItem.type}</span>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Item Details</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Item Code</p>
                    <p className="text-[11px] font-semibold text-cyan-700">{selectedItem.code}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Input Category</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.subtitle.split('·')[0].trim()}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">UOM</p>
                    <p className="text-[11px] font-semibold text-emerald-700">{selectedItem.whUnit}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Storage Location</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Zone</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.zone}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Rack / Slot</p>
                    <p className="text-[11px] font-semibold text-cyan-700">{selectedItem.rack}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Stock Breakdown</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Stock in Warehouse</p>
                    <p className="text-base font-bold text-cyan-700">{selectedItem.whStock}</p>
                    <p className="text-[9px] text-slate-400">physical in racks</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">In Manufacturing (ML1+ML2)</p>
                    <p className="text-base font-bold text-blue-700">{selectedItem.ml1Stock + selectedItem.ml2Stock}</p>
                    <p className="text-[9px] text-slate-400">issued to production</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                    <p className="text-[9px] uppercase text-emerald-700">Stock in Hand (Total)</p>
                    <p className="text-base font-bold text-emerald-700">{selectedItem.stockInHand}</p>
                    <p className="text-[9px] text-emerald-600">KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Reserve (committed)</p>
                    <p className="text-sm font-bold text-amber-700">{selectedItem.reserved} {selectedItem.whUnit}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Free / available</p>
                    <p className="text-sm font-bold text-cyan-700">{Math.max(0, selectedItem.stockInHand - selectedItem.reserved)} {selectedItem.whUnit}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Ordered in Transit</p>
                    <p className="text-sm font-bold text-rose-700">{selectedItem.inTransit} {selectedItem.whUnit}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Avg Consumption (Monthly)</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Avg 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo * 0.9)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Sep 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo * 0.8)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Oct 2025</p>
                    <p className="text-[11px] font-semibold text-slate-900">{Math.round(selectedItem.avgMo)} KG</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">3-Month Avg</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.avgMo} {selectedItem.whUnit}/month</p>
                  </div>
                </div>
              </div>

              {isAdjustMode && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Adjust Stock (Realtime)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">WH Stock</p>
                      <input
                        type="number"
                        value={selectedItem.whStock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'whStock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-cyan-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">ML1 Stock</p>
                      <input
                        type="number"
                        value={selectedItem.ml1Stock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'ml1Stock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-blue-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">ML2 Stock</p>
                      <input
                        type="number"
                        value={selectedItem.ml2Stock}
                        onChange={e => updateInventoryItem(selectedItem.id, 'ml2Stock', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-indigo-700"
                      />
                    </label>
                    <label className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] uppercase text-slate-500 mb-1">Reserved</p>
                      <input
                        type="number"
                        value={selectedItem.reserved}
                        onChange={e => updateInventoryItem(selectedItem.id, 'reserved', Number(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-amber-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">Item Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Batch / Lot Number</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.batchNumber || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Expiry Date</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.expiryDate || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Manufacturer</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.manufacturer || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Quality Grade</p>
                    <p className="text-[11px] font-semibold text-emerald-700">{selectedItem.qualityGrade || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[9px] uppercase text-slate-500">Storage Condition</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedItem.storageCondition || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setIsAdjustMode(prev => !prev)}
                className="px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-semibold hover:bg-cyan-700 transition-colors"
              >
                {isAdjustMode ? 'Done' : 'Adjust Stock'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-3 py-1.5 bg-slate-600 text-white rounded-md text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseLocations;
