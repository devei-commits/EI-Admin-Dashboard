import { useState } from 'react';
import { X } from 'lucide-react';
import { InventoryItem } from './Inventory';
import { useWarehouseLocations } from '../../hooks/useWarehouseLocations';
import { type WarehouseLocationDTO, type WarehouseRackDTO, type StoredItemSummary } from '../../services/warehouseLocations.service';
import { fetchWarehouseInventory, updateWarehouseStock } from '../../services/warehouseInventory.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';

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
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading: locationsLoading, refetch: refetchLocations } = useWarehouseLocations();
  const { data: inventoryResult, isLoading: inventoryLoading } = useQuery({
    queryKey: queryKeys.warehouseInventory,
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      if (!res.success || !res.data) return { rows: [] };
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  const inventoryData: InventoryItem[] = inventoryResult?.rows ?? [];
  const [selectedRack, setSelectedRack] = useState<{ location: WarehouseLocationDTO; rack: WarehouseRackDTO } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const loading = locationsLoading || inventoryLoading;

  const openInventoryForStoredItem = (stored: StoredItemSummary) => {
    const row = inventoryData.find((r) => r.warehouseInventoryId === stored.warehouseInventoryId);
    if (row) setSelectedItem(row);
  };

  const updateInventoryItem = (itemId: string, field: keyof InventoryItem, value: number) => {
    if (selectedItem && selectedItem.id === itemId) {
      const updated = { ...selectedItem, [field]: value };
      if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock') {
        updated.stockInHand = updated.whStock + updated.ml1Stock + updated.ml2Stock;
      }
      setSelectedItem(updated);
    }
  };

  const handleDoneAdjustStock = async () => {
    const item = selectedItem;
    if (!item) {
      setIsAdjustMode(false);
      return;
    }
    if (item.warehouseInventoryId == null) {
      setAdjustError('This item cannot be updated (no warehouse inventory id).');
      return;
    }
    setAdjustError(null);
    setSavingAdjust(true);
    const res = await updateWarehouseStock(item.warehouseInventoryId, {
      wh_stock: item.whStock,
      ml1_stock: item.ml1Stock,
      ml2_stock: item.ml2Stock,
      reserved: item.reserved,
    });
    setSavingAdjust(false);
    if (res.success && res.data) {
      const d = res.data;
      const stockInHand = (Number(d.wh_stock) || 0) + (Number(d.ml1_stock) || 0) + (Number(d.ml2_stock) || 0);
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      setSelectedItem((prev) =>
        prev?.id === item.id
          ? {
              ...prev,
              whStock: Number(d.wh_stock) ?? prev.whStock,
              ml1Stock: Number(d.ml1_stock) ?? prev.ml1Stock,
              ml2Stock: Number(d.ml2_stock) ?? prev.ml2Stock,
              stockInHand,
              reserved: Number(d.reserved) ?? prev.reserved,
            }
          : prev
      );
    } else {
      setAdjustError(res.error ?? 'Failed to save stock adjustment.');
    }
    setIsAdjustMode(false);
  };

  const getRackCondition = (description: string) => {
    const d = (description || '').toLowerCase();
    if (d.includes('cold')) return 'Cold';
    if (d.includes('cool')) return 'Cool';
    return 'Ambient';
  };

  const getRackSlotMap = (rack: WarehouseRackDTO) => {
    const levels = rack.levels || 4;
    const slots = rack.slotsTotal || 16;
    const totalPositions = levels * Math.max(1, Math.floor(slots / levels));
    const itemsStored = rack.itemsStoredCount ?? rack.storedItems?.length ?? 0;
    return Array.from({ length: totalPositions }).map((_, index) => {
      const slotsPerLevel = Math.max(1, Math.floor(slots / levels));
      const level = Math.floor(index / slotsPerLevel) + 1;
      const slot = (index % slotsPerLevel) + 1;
      const isFilled = index < itemsStored;
      const stored = rack.storedItems?.[index];
      const code = stored?.code ?? `L${level}-S${slot}`;
      return { code, label: `L${level}-S${slot}`, isFilled };
    });
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6 bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading warehouse locations…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="w-full space-y-5">
        <h1 className="text-3xl font-bold text-slate-900">Warehouse Locations & Rack Management</h1>

        {locations.map((location) => {
          const itemCount = location.racks.reduce((s, r) => s + (r.itemsStoredCount ?? 0), 0);
          const meta = [
            location.areaSqm != null ? `${location.areaSqm} sqm` : null,
            location.description,
            `${itemCount} items · ${location.racks.length} racks`,
          ].filter(Boolean).join(' · ');
          return (
            <section key={location.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{location.icon ?? '📦'}</span>
                    <h2 className="text-2xl font-bold text-slate-900 leading-none">{location.name}</h2>
                    {location.zoneLabel && (
                      <span className="text-sm font-semibold text-emerald-700">{location.zoneLabel}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{meta}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utilisation</p>
                  <p className="text-2xl font-bold text-cyan-700 leading-none">{location.utilisationPct ?? 0}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7">
                {location.racks.map((rack) => (
                  <button
                    key={rack.id}
                    type="button"
                    onClick={() => setSelectedRack({ location, rack })}
                    className="px-4 py-3 border-r border-b border-slate-200 last:border-r-0 text-left hover:bg-cyan-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xl font-bold text-cyan-700 leading-none">{rack.code}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${getUtilizationBadge(rack.utilisationPct ?? 0)}`}>
                        {rack.utilisationPct ?? 0}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{rack.description ?? rack.name}</p>

                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getUtilizationBarColor(rack.utilisationPct ?? 0)}`}
                        style={{ width: `${rack.utilisationPct ?? 0}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-600">
                      {rack.levels} levels · {rack.slotsTotal} slots · {rack.itemsStoredCount ?? 0} items stored
                    </p>

                    {(rack.storedItems?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {rack.storedItems.map((stored, i) => (
                          <button
                            key={`${rack.id}-${stored.warehouseInventoryId}-${i}`}
                            type="button"
                            onClick={(ev) => {
                              ev.preventDefault();
                              ev.stopPropagation();
                              openInventoryForStoredItem(stored);
                            }}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200"
                          >
                            {stored.code}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 h-5" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selectedRack && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-3xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-slate-900">
                Rack - Bay {selectedRack.rack.code} - {selectedRack.rack.description ?? selectedRack.rack.name}
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
                  <p className="text-2xl font-bold text-cyan-700 mt-1">{selectedRack.rack.code}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zone</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{selectedRack.location.name}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Levels × Slots</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {selectedRack.rack.levels} × {selectedRack.rack.slotsTotal} = {selectedRack.rack.levels * selectedRack.rack.slotsTotal} positions
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{getRackCondition(selectedRack.rack.description ?? '')}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utilisation</p>
                  <p className="text-2xl font-bold text-cyan-700 mt-1">{selectedRack.rack.utilisationPct ?? 0}%</p>
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
                  {getRackSlotMap(selectedRack.rack).map((slot, idx) => (
                    <div
                      key={`${selectedRack.rack.id}-${slot.code}-${slot.label}-${idx}`}
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
                  Items Stored ({selectedRack.rack.itemsStoredCount ?? selectedRack.rack.storedItems?.length ?? 0})
                </h3>
                <div className="mt-2 space-y-2">
                  {(selectedRack.rack.storedItems?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-500">No items currently stored in this rack.</p>
                  ) : (
                    (selectedRack.rack.storedItems ?? []).map((stored, i) => {
                      const inventoryItem = inventoryData.find((inv) => inv.warehouseInventoryId === stored.warehouseInventoryId);
                      return (
                        <button
                          key={`${stored.warehouseInventoryId}-${i}`}
                          type="button"
                          onClick={() => openInventoryForStoredItem(stored)}
                          className="w-full flex items-center justify-between py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div>
                            <p className="text-xs font-semibold text-cyan-700">{stored.code}</p>
                            <p className="text-lg font-semibold text-slate-900">{stored.name}</p>
                          </div>
                          {inventoryItem && (
                            <span className="px-3 py-1 rounded-lg border border-cyan-300 bg-cyan-100 text-cyan-800 text-sm font-bold">
                              {inventoryItem.stockInHand} {inventoryItem.whUnit}
                            </span>
                          )}
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
                onClick={() => { setSelectedItem(null); setAdjustError(null); }}
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

            {adjustError && (
              <p className="px-4 py-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md" role="alert">
                {adjustError}
              </p>
            )}
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              {isAdjustMode ? (
                <button
                  type="button"
                  onClick={handleDoneAdjustStock}
                  disabled={savingAdjust}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {savingAdjust ? 'Saving…' : 'Save & done'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAdjustError(null); setIsAdjustMode(true); }}
                  className="px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-semibold hover:bg-cyan-700 transition-colors"
                >
                  Adjust Stock
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSelectedItem(null); setAdjustError(null); }}
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
