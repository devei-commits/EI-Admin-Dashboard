import { useEffect, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { InventoryItem } from '../pages/warehouse/Inventory';
import {
  updateWarehouseStock,
  fetchWarehouseLocationHistory,
  type WarehouseLocationHistoryEntry,
} from '../services/warehouseInventory.service';

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
  /** Called after a successful save with the updated item (frontend view of row). */
  onItemUpdated?: (updated: InventoryItem) => void;
  /** When 'modal', render as a centered popup; when 'sidebar' (default), render as a right-side panel. */
  variant?: 'sidebar' | 'modal';
}

const WarehouseInventorySidebar: React.FC<Props> = ({ item, onClose, onItemUpdated, variant = 'sidebar' }) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(item);
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [locationHistory, setLocationHistory] = useState<WarehouseLocationHistoryEntry[]>([]);
  const [locationHistoryLoading, setLocationHistoryLoading] = useState(false);
  const [locationHistoryError, setLocationHistoryError] = useState<string | null>(null);
  const [isLocationEditMode, setIsLocationEditMode] = useState(false);
  const [editZone, setEditZone] = useState('');
  const [editRack, setEditRack] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    setSelectedItem(item);
    setIsAdjustMode(false);
    setIsLocationEditMode(false);
    setLocationHistory([]);
    setLocationHistoryError(null);
    setEditZone(item?.zone ?? '');
    setEditRack(item?.rack ?? '');
  }, [item]);

  // Load internal movement history whenever a new item is selected (if it has a warehouseInventoryId)
  useEffect(() => {
    const wid = selectedItem?.warehouseInventoryId;
    if (!wid) {
      setLocationHistory([]);
      setLocationHistoryError(null);
      setLocationHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setLocationHistoryLoading(true);
    setLocationHistoryError(null);
    fetchWarehouseLocationHistory(wid)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setLocationHistory(res.data.history ?? []);
        } else {
          setLocationHistory([]);
          setLocationHistoryError(res.error || 'Failed to load location history');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLocationHistory([]);
          setLocationHistoryError(err?.message || 'Failed to load location history');
        }
      })
      .finally(() => {
        if (!cancelled) setLocationHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem?.warehouseInventoryId]);

  const updateInventoryField = (field: keyof InventoryItem, value: number | string) => {
    setSelectedItem((prev) => {
      if (!prev) return prev;
      const updated: InventoryItem = { ...prev, [field]: value as any };
      if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock') {
        updated.stockInHand = updated.whStock + updated.ml1Stock + updated.ml2Stock;
      }
      return updated;
    });
  };

  const startLocationEdit = () => {
    setEditZone(selectedItem?.zone ?? '');
    setEditRack(selectedItem?.rack ?? '');
    setIsLocationEditMode(true);
  };

  const handleSaveLocation = async () => {
    const itemToSave = selectedItem;
    if (!itemToSave || itemToSave.warehouseInventoryId == null) {
      setIsLocationEditMode(false);
      return;
    }
    setSavingLocation(true);
    const res = await updateWarehouseStock(itemToSave.warehouseInventoryId, {
      zone: editZone || undefined,
      rack: editRack || undefined,
    });
    setSavingLocation(false);
    if (res.success) {
      const updated: InventoryItem = { ...itemToSave, zone: editZone, rack: editRack };
      setSelectedItem(updated);
      if (onItemUpdated) onItemUpdated(updated);
      setIsLocationEditMode(false);
    }
  };

  const handleDoneAdjustStock = async () => {
    const itemToSave = selectedItem;
    if (!itemToSave) {
      setIsAdjustMode(false);
      return;
    }
    if (itemToSave.warehouseInventoryId == null) {
      setIsAdjustMode(false);
      return;
    }
    setSavingAdjust(true);
    const res = await updateWarehouseStock(itemToSave.warehouseInventoryId, {
      wh_stock: itemToSave.whStock,
      ml1_stock: itemToSave.ml1Stock,
      ml2_stock: itemToSave.ml2Stock,
    });
    setSavingAdjust(false);
    if (res.success && res.data) {
      const d = res.data;
      const stockInHand =
        (Number(d.wh_stock) || 0) + (Number(d.ml1_stock) || 0) + (Number(d.ml2_stock) || 0);
      const updated: InventoryItem = {
        ...itemToSave,
        whStock: Number(d.wh_stock) ?? itemToSave.whStock,
        ml1Stock: Number(d.ml1_stock) ?? itemToSave.ml1Stock,
        ml2Stock: Number(d.ml2_stock) ?? itemToSave.ml2Stock,
        stockInHand,
        reserved: Number(d.reserved) ?? itemToSave.reserved,
      };
      setSelectedItem(updated);
      if (onItemUpdated) onItemUpdated(updated);
    }
    setIsAdjustMode(false);
  };

  if (!selectedItem) return null;

  const isModal = variant === 'modal';
  return (
    <div
      className={
        isModal
          ? 'w-full max-w-xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-y-auto border border-slate-200'
          : 'h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto'
      }
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Inventory — {selectedItem.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded border border-cyan-300 bg-cyan-50 text-cyan-700 text-[10px] font-semibold">
            SIH: {selectedItem.stockInHand} {selectedItem.whUnit}
          </span>
          <span className="px-2 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-semibold">
            W1: {selectedItem.whStock}
          </span>
          <span className="px-2 py-0.5 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
            ML1: {selectedItem.ml1Stock}
          </span>
          <span className="px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-semibold">
            ML2: {selectedItem.ml2Stock}
          </span>
          <span className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-semibold">
            Reserved: {selectedItem.reserved}
          </span>
          <span className="px-2 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-700 text-[10px] font-semibold">
            In Transit: {selectedItem.inTransit}
          </span>
          <span className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
            {selectedItem.status}
          </span>
          <span className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold">
            {selectedItem.type}
          </span>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Item Details
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Item Code</p>
              <p className="text-[11px] font-semibold text-cyan-700">{selectedItem.code}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Input Category</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.subtitle.split('·')[0].trim()}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">UOM</p>
              <p className="text-[11px] font-semibold text-emerald-700">{selectedItem.whUnit}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Location / Zone & Rack
          </p>
          {!isLocationEditMode ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-[9px] uppercase text-slate-500">Zone / Location</p>
                <p className="text-[11px] font-semibold text-slate-900">{selectedItem.zone || '—'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-[9px] uppercase text-slate-500">Rack</p>
                <p className="text-[11px] font-semibold text-slate-900">{selectedItem.rack || '—'}</p>
              </div>
              {selectedItem.warehouseInventoryId != null && (
                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={startLocationEdit}
                    className="px-3 py-1.5 bg-slate-600 text-white rounded-md text-xs font-semibold hover:bg-slate-700 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 bg-amber-50/50 border border-amber-200 rounded p-3">
              <div>
                <label className="block text-[9px] uppercase text-slate-500 mb-1">Zone / Location</label>
                <input
                  type="text"
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value)}
                  placeholder="e.g. Zone A or RM Store"
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-500 mb-1">Rack</label>
                <input
                  type="text"
                  value={editRack}
                  onChange={(e) => setEditRack(e.target.value)}
                  placeholder="e.g. C1-L1-S1"
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  disabled={savingLocation}
                  className="px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-semibold hover:bg-cyan-700 disabled:opacity-60"
                >
                  {savingLocation ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLocationEditMode(false);
                    setEditZone(selectedItem?.zone ?? '');
                    setEditRack(selectedItem?.rack ?? '');
                  }}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Stock Breakdown
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Stock in Warehouse</p>
              <p className="text-base font-bold text-cyan-700">{selectedItem.whStock}</p>
              <p className="text-[9px] text-slate-400">physical in racks</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">In Manufacturing (ML1+ML2)</p>
              <p className="text-base font-bold text-blue-700">
                {selectedItem.ml1Stock + selectedItem.ml2Stock}
              </p>
              <p className="text-[9px] text-slate-400">issued to production</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
              <p className="text-[9px] uppercase text-emerald-700">Stock in Hand (Total)</p>
              <p className="text-base font-bold text-emerald-700">{selectedItem.stockInHand}</p>
              <p className="text-[9px] text-emerald-600">KG</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Reserve (committed)</p>
              <p className="text-sm font-bold text-amber-700">
                {selectedItem.reserved} {selectedItem.whUnit}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Free / available</p>
              <p className="text-sm font-bold text-cyan-700">
                {Math.max(0, selectedItem.stockInHand - selectedItem.reserved)} {selectedItem.whUnit}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Ordered in Transit</p>
              <p className="text-sm font-bold text-rose-700">
                {selectedItem.inTransit} {selectedItem.whUnit}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Avg Consumption (Monthly)
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Avg 2025</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {Math.round(selectedItem.avgMo * 0.9)} KG
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Sep 2025</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {Math.round(selectedItem.avgMo * 0.8)} KG
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Oct 2025</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {Math.round(selectedItem.avgMo)} KG
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">3-Month Avg</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.avgMo} {selectedItem.whUnit}/month
              </p>
            </div>
          </div>
        </div>

        {isAdjustMode && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
              Adjust Stock (Realtime)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-[9px] uppercase text-slate-500 mb-1">WH Stock</p>
                <input
                  type="number"
                  value={selectedItem.whStock}
                  onChange={(e) =>
                    updateInventoryField('whStock', Number(e.target.value) || 0)
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-cyan-700"
                />
              </label>
              <label className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-[9px] uppercase text-slate-500 mb-1">ML1 Stock</p>
                <input
                  type="number"
                  value={selectedItem.ml1Stock}
                  onChange={(e) =>
                    updateInventoryField('ml1Stock', Number(e.target.value) || 0)
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-blue-700"
                />
              </label>
              <label className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-[9px] uppercase text-slate-500 mb-1">ML2 Stock</p>
                <input
                  type="number"
                  value={selectedItem.ml2Stock}
                  onChange={(e) =>
                    updateInventoryField('ml2Stock', Number(e.target.value) || 0)
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-indigo-700"
                />
              </label>
              <div className="bg-amber-50/50 border border-amber-200 rounded p-2 col-span-2">
                <p className="text-[9px] uppercase text-slate-500 mb-1">Reserved (BMR/BPR only)</p>
                <p className="text-sm font-semibold text-amber-700">{selectedItem.reserved} {selectedItem.whUnit}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Updated when batches reserve RM/PM</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Item Specifications
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Batch / Lot Number</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.batchNumber || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Expiry Date</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.expiryDate || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Manufacturer</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.manufacturer || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Quality Grade</p>
              <p className="text-[11px] font-semibold text-emerald-700">
                {selectedItem.qualityGrade || 'N/A'}
              </p>
            </div>
            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded p-2">
              <p className="text-[9px] uppercase text-slate-500">Storage Condition</p>
              <p className="text-[11px] font-semibold text-slate-900">
                {selectedItem.storageCondition || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-2">
            Internal Movement History
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 max-h-56 overflow-y-auto">
            {locationHistoryLoading ? (
              <p className="text-[11px] text-slate-500">Loading movement history…</p>
            ) : locationHistoryError ? (
              <p className="text-[11px] text-rose-600">{locationHistoryError}</p>
            ) : locationHistory.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                No internal movements recorded yet.
              </p>
            ) : (
              <ul className="space-y-2 text-[11px] text-slate-700">
                {locationHistory.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {(h.actionType === 'BMR_RESERVED' || h.actionType === 'BPR_RESERVED') ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700">
                          R
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-100 text-cyan-700">
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                      <div>
                        <div className="font-semibold">
                          {(h.actionType === 'BMR_RESERVED' || h.actionType === 'BPR_RESERVED') ? (
                            <span className="text-amber-700">
                              Reserved +{h.reservedDelta ?? '—'} → {h.reservedAfter ?? '—'} {h.batchNo ? `· ${h.batchNo}` : ''}
                            </span>
                          ) : h.fromZone || h.fromRack ? (
                            <>
                              <span className="text-slate-600">
                                {h.fromZone || '—'} / {h.fromRack || '—'}
                              </span>
                              <span className="mx-1 text-slate-400">→</span>
                              <span className="text-cyan-700">
                                {h.toZone || '—'} / {h.toRack || '—'}
                              </span>
                            </>
                          ) : (
                            <span className="text-cyan-700">
                              Set to {h.toZone || '—'} / {h.toRack || '—'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {new Date(h.movedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
        <button
          type="button"
          onClick={isAdjustMode ? handleDoneAdjustStock : () => setIsAdjustMode(true)}
          disabled={savingAdjust}
          className="px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-60"
        >
          {isAdjustMode ? (savingAdjust ? 'Saving…' : 'Done') : 'Adjust Stock'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-slate-600 text-white rounded-md text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default WarehouseInventorySidebar;

