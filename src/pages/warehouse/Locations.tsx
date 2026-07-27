import { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { InventoryItem } from './Inventory';
import { useWarehouseLocations } from '../../hooks/useWarehouseLocations';
import { type WarehouseLocationDTO, type WarehouseRackDTO, type StoredItemSummary } from '../../services/warehouseLocations.service';
import { fetchWarehouseInventory } from '../../services/warehouseInventory.service';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import WarehouseInventorySidebar from '../../components/WarehouseInventorySidebar';

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

/** Max SKU chips shown per rack before collapsing into a "+N more" affordance. */
const RACK_CHIP_CAP = 6;

/** Top-level facilities the zones roll up into (shell layout: facility → zones → racks). */
type FacilityKey = 'ML1' | 'ML2' | 'WH';
const FACILITY_META: { key: FacilityKey; label: string; sub: string; icon: string }[] = [
  { key: 'ML1', label: 'ML1', sub: 'Manufacturing Unit 1', icon: '🏭' },
  { key: 'ML2', label: 'ML2', sub: 'Manufacturing Unit 2', icon: '🏭' },
  { key: 'WH', label: 'Warehouse', sub: 'Main warehouse', icon: '🏬' },
];

function facilityKeyOf(loc: WarehouseLocationDTO): FacilityKey {
  if (loc.locationType === 'warehouse') return 'WH';
  const hay = `${loc.zoneLabel ?? ''} ${loc.code} ${loc.name}`.toUpperCase();
  if (hay.includes('ML2')) return 'ML2';
  return 'ML1';
}

const WarehouseLocations = () => {
  const { data: locations = [], isLoading: locationsLoading, refetch: refetchLocations } = useWarehouseLocations();
  const { data: inventoryResult, isLoading: inventoryLoading } = useQuery({
    queryKey: queryKeys.warehouseInventory,
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      if (!res.success || !res.data) return { rows: [] };
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
  const inventoryData: InventoryItem[] = inventoryResult?.rows ?? [];
  const [selectedRack, setSelectedRack] = useState<{ location: WarehouseLocationDTO; rack: WarehouseRackDTO } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [collapsedFacilities, setCollapsedFacilities] = useState<Set<FacilityKey>>(new Set());

  const loading = locationsLoading || inventoryLoading;

  const facilityGroups = useMemo(() => {
    return FACILITY_META.map((f) => {
      const zones = locations.filter((l) => facilityKeyOf(l) === f.key);
      const racks = zones.reduce((s, z) => s + z.racks.length, 0);
      const items = zones.reduce((s, z) => s + z.racks.reduce((a, r) => a + (r.itemsStoredCount ?? 0), 0), 0);
      const utilVals = zones.map((z) => z.utilisationPct ?? 0);
      const util = utilVals.length ? Math.round(utilVals.reduce((a, b) => a + b, 0) / utilVals.length) : 0;
      return { ...f, zones, racks, items, util };
    }).filter((g) => g.zones.length > 0);
  }, [locations]);

  const toggleFacility = (key: FacilityKey) =>
    setCollapsedFacilities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const openInventoryForStoredItem = (stored: StoredItemSummary) => {
    const row = inventoryData.find((r) => r.warehouseInventoryId === stored.warehouseInventoryId);
    if (row) setSelectedItem(row);
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
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warehouse Locations & Rack Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Grouped by facility → zone → rack. Click a facility to expand, or a rack for slot details.
          </p>
        </div>

        {facilityGroups.map((group) => {
          const collapsed = collapsedFacilities.has(group.key);
          return (
            <section key={group.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Facility shell header */}
              <button
                type="button"
                onClick={() => toggleFacility(group.key)}
                aria-expanded={!collapsed}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                  <span className="text-2xl leading-none">{group.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900 leading-none">{group.label}</h2>
                      <span className="text-xs font-medium text-slate-500">{group.sub}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {group.zones.length} zones · {group.racks} racks · {group.items} items stored
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Avg utilisation</p>
                  <p className="text-xl font-bold text-cyan-700 leading-none">{group.util}%</p>
                </div>
              </button>

              {/* Zones inside the facility */}
              {!collapsed && (
                <div className="border-t border-slate-200 divide-y divide-slate-200">
                  {group.zones.map((location) => {
                    const itemCount = location.racks.reduce((s, r) => s + (r.itemsStoredCount ?? 0), 0);
                    const meta = [
                      location.areaSqm != null ? `${location.areaSqm} sqm` : null,
                      location.description,
                      `${itemCount} items · ${location.racks.length} racks`,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div key={location.id}>
                        <div className="px-5 py-3 bg-slate-50/70 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{location.icon ?? '📦'}</span>
                              <h3 className="text-base font-semibold text-slate-800 leading-none">{location.name}</h3>
                              {location.zoneLabel && (
                                <span className="text-xs font-semibold text-emerald-700">{location.zoneLabel}</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{meta}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Util</p>
                            <p className="text-base font-bold text-cyan-700 leading-none">{location.utilisationPct ?? 0}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-t border-slate-100">
                          {location.racks.map((rack) => {
                            const stored = rack.storedItems ?? [];
                            const shown = stored.slice(0, RACK_CHIP_CAP);
                            const extra = stored.length - shown.length;
                            return (
                              <div
                                key={rack.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedRack({ location, rack })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedRack({ location, rack });
                                  }
                                }}
                                className="px-4 py-3 border-r border-b border-slate-200 text-left hover:bg-cyan-50 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-lg font-bold text-cyan-700 leading-none">{rack.code}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${getUtilizationBadge(rack.utilisationPct ?? 0)}`}>
                                    {rack.utilisationPct ?? 0}%
                                  </span>
                                </div>
                                <p className="mt-0.5 text-sm text-slate-600 truncate">{rack.description ?? rack.name}</p>

                                <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${getUtilizationBarColor(rack.utilisationPct ?? 0)}`}
                                    style={{ width: `${rack.utilisationPct ?? 0}%` }}
                                  />
                                </div>

                                <p className="mt-2 text-xs text-slate-600">
                                  {rack.levels} levels · {rack.slotsTotal} slots · {rack.itemsStoredCount ?? 0} items
                                </p>

                                {stored.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                                    {shown.map((s, i) => (
                                      <button
                                        key={`${rack.id}-${s.warehouseInventoryId}-${i}`}
                                        type="button"
                                        onClick={(ev) => {
                                          ev.preventDefault();
                                          ev.stopPropagation();
                                          openInventoryForStoredItem(s);
                                        }}
                                        className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200"
                                      >
                                        {s.code}
                                      </button>
                                    ))}
                                    {extra > 0 && (
                                      <button
                                        type="button"
                                        onClick={(ev) => {
                                          ev.preventDefault();
                                          ev.stopPropagation();
                                          setSelectedRack({ location, rack });
                                        }}
                                        className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 font-medium"
                                      >
                                        +{extra} more
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-2 h-5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {facilityGroups.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No warehouse locations configured yet.
          </div>
        )}
      </div>

      {selectedRack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => setSelectedRack(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Rack details"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Inventory item details"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <WarehouseInventorySidebar
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onItemUpdated={(updated) => setSelectedItem(updated)}
              variant="modal"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseLocations;
