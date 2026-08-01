import { useEffect, useState, useRef } from 'react';
import { X, ArrowRight, ClipboardList } from 'lucide-react';
import type { InventoryItem } from '../pages/warehouse/Inventory';
import {
  updateWarehouseStock,
  fetchWarehouseLocationHistory,
  fetchStockByLocation,
  deriveWarehouseInventoryDisplayStatus,
  warehouseInventoryAvailable,
  inventoryAdjustChangeLines,
  type WarehouseLocationHistoryEntry,
  type StockByLocationPayload,
} from '../services/warehouseInventory.service';
import StockByLocationPanel, { type RackQtyDraft } from './StockByLocationPanel';
import { warehouseStoreLabelForItemType } from '../constants/warehouseItemLocations';
import {
  formatQtyInputDisplay,
  parseQtyInputString,
  sanitizeQtyInputString,
} from '../utils/qtyInput';

interface Props {
  item: InventoryItem | null;
  onClose: () => void;
  /** Called after a successful save with the updated item (frontend view of row). */
  onItemUpdated?: (updated: InventoryItem) => void;
  /** When 'modal', render as a centered popup; when 'sidebar' (default), render as a right-side panel. */
  variant?: 'sidebar' | 'modal';
  /** Open directly in edit/adjust mode (e.g. from WH stock distribution popup). */
  initialEditMode?: boolean;
}

const QC_STATUS_PRESETS = [
  'In Stock',
  'Low Stock',
  'Critical',
  'Out of Stock',
  'Hold',
  'Quarantine',
] as const;

function displayZoneRack(v: string | undefined): string {
  if (v == null || v === '') return '—';
  return v;
}

function numOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const STOCK_QTY_INPUT_FIELDS = [
  'whStock',
  'ml1Stock',
  'ml2Stock',
  'reserved',
  'inTransit',
  'reorderPt',
  'avgMo',
] as const;

type StockQtyInputField = (typeof STOCK_QTY_INPUT_FIELDS)[number];

function buildStockQtyDraft(item: InventoryItem): Record<StockQtyInputField, string> {
  return {
    whStock: formatQtyInputDisplay(item.whStock),
    ml1Stock: formatQtyInputDisplay(item.ml1Stock),
    ml2Stock: formatQtyInputDisplay(item.ml2Stock),
    reserved: formatQtyInputDisplay(item.reserved),
    inTransit: formatQtyInputDisplay(item.inTransit),
    reorderPt: formatQtyInputDisplay(item.reorderPt),
    avgMo: formatQtyInputDisplay(item.avgMo),
  };
}

const WarehouseInventorySidebar: React.FC<Props> = ({
  item,
  onClose,
  onItemUpdated,
  variant = 'sidebar',
  initialEditMode = false,
}) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(item);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [adjustNote, setAdjustNote] = useState('');
  const [locationHistory, setLocationHistory] = useState<WarehouseLocationHistoryEntry[]>([]);
  const [locationHistoryLoading, setLocationHistoryLoading] = useState(false);
  const [locationHistoryError, setLocationHistoryError] = useState<string | null>(null);
  const [stockByLocation, setStockByLocation] = useState<StockByLocationPayload | null>(null);
  const [stockByLocationLoading, setStockByLocationLoading] = useState(false);
  const [rackQtyDraft, setRackQtyDraft] = useState<RackQtyDraft[] | null>(null);
  const [stockQtyDraft, setStockQtyDraft] = useState<Partial<Record<StockQtyInputField, string>>>({});
  const editSnapshotRef = useRef<InventoryItem | null>(null);

  function buildRackDraftFromPayload(payload: StockByLocationPayload): RackQtyDraft[] {
    const rows: RackQtyDraft[] = [];
    for (const loc of payload.warehouse) {
      for (const r of loc.racks) {
        rows.push({ rackId: r.rackId, qtyWh: r.qtyWh });
      }
    }
    return rows;
  }

  const handleRackQtyChange = (rackId: number, qtyWh: number) => {
    setRackQtyDraft((prev) => {
      const base = prev ?? [];
      const idx = base.findIndex((d) => d.rackId === rackId);
      const next =
        idx >= 0
          ? base.map((d, i) => (i === idx ? { rackId, qtyWh } : d))
          : [...base, { rackId, qtyWh }];
      const whTotal = next.reduce((s, d) => s + d.qtyWh, 0);
      setSelectedItem((itemPrev) => {
        if (!itemPrev) return itemPrev;
        const stockInHand = whTotal + itemPrev.ml1Stock + itemPrev.ml2Stock;
        return {
          ...itemPrev,
          whStock: whTotal,
          stockInHand,
          available: warehouseInventoryAvailable(stockInHand, itemPrev.reserved),
        };
      });
      setStockQtyDraft((prev) => ({ ...prev, whStock: formatQtyInputDisplay(whTotal) }));
      return next;
    });
  };

  useEffect(() => {
    setSelectedItem(item);
    setAdjustNote('');
    setLocationHistory([]);
    setLocationHistoryError(null);
    setStockByLocation(null);
    setStockByLocationLoading(false);
    setRackQtyDraft(null);
    if (initialEditMode && item?.warehouseInventoryId != null) {
      editSnapshotRef.current = {
        ...item,
        zone: item.zone === '—' ? '' : item.zone,
        rack: item.rack === '—' ? '' : item.rack,
      };
      setStockQtyDraft(buildStockQtyDraft(item));
      setIsEditMode(true);
    } else {
      editSnapshotRef.current = null;
      setStockQtyDraft({});
      setIsEditMode(false);
    }
  }, [item, initialEditMode]);

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
          const err = res.error;
          setLocationHistoryError(
            typeof err === 'string' ? err : err?.message ?? 'Failed to load location history'
          );
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

  useEffect(() => {
    const wid = selectedItem?.warehouseInventoryId;
    if (!wid) {
      setStockByLocation(null);
      setStockByLocationLoading(false);
      return;
    }

    let cancelled = false;
    setStockByLocationLoading(true);
    setStockByLocation(null);
    if (isEditMode) setRackQtyDraft(null);
    fetchStockByLocation(wid)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setStockByLocation(res.data);
          if (isEditMode) setRackQtyDraft(buildRackDraftFromPayload(res.data));
        }
      })
      .finally(() => {
        if (!cancelled) setStockByLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, selectedItem?.warehouseInventoryId]);

  const updateInventoryField = (field: keyof InventoryItem, value: number | string) => {
    setSelectedItem((prev) => {
      if (!prev) return prev;
      const updated: InventoryItem = { ...prev, [field]: value as never };
      if (field === 'whStock' || field === 'ml1Stock' || field === 'ml2Stock' || field === 'reserved') {
        updated.stockInHand = updated.whStock + updated.ml1Stock + updated.ml2Stock;
        updated.available = warehouseInventoryAvailable(updated.stockInHand, updated.reserved);
      }
      return updated;
    });
  };

  const handleStockQtyInput = (field: StockQtyInputField, raw: string) => {
    const sanitized = sanitizeQtyInputString(raw);
    setStockQtyDraft((prev) => ({ ...prev, [field]: sanitized }));
    updateInventoryField(field, parseQtyInputString(sanitized));
  };

  const stockQtyInputValue = (field: StockQtyInputField): string => {
    if (field in stockQtyDraft) return stockQtyDraft[field] ?? '';
    if (!selectedItem) return '';
    return formatQtyInputDisplay(selectedItem[field]);
  };

  const startEdit = () => {
    if (!selectedItem) return;
    editSnapshotRef.current = { ...selectedItem };
    setSelectedItem((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        zone: prev.zone === '—' ? '' : prev.zone,
        rack: prev.rack === '—' ? '' : prev.rack,
      };
    });
    setAdjustNote('');
    setStockQtyDraft(buildStockQtyDraft(selectedItem));
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    if (editSnapshotRef.current) {
      setSelectedItem(editSnapshotRef.current);
    }
    editSnapshotRef.current = null;
    setAdjustNote('');
    setRackQtyDraft(null);
    setStockQtyDraft({});
    setStockByLocation(null);
    setIsEditMode(false);
  };

  const refreshHistory = async (wid: number) => {
    const res = await fetchWarehouseLocationHistory(wid);
    if (res.success && res.data) {
      setLocationHistory(res.data.history ?? []);
    }
  };

  const handleSaveEdit = async () => {
    const itemToSave = selectedItem;
    if (!itemToSave || itemToSave.warehouseInventoryId == null) {
      setIsEditMode(false);
      return;
    }
    const wid = itemToSave.warehouseInventoryId;
    setSavingEdit(true);
    const noteTrim = adjustNote.trim();
    const rack_quantities =
      rackQtyDraft && rackQtyDraft.length > 0
        ? rackQtyDraft.map((r) => ({ rackId: r.rackId, qtyWh: r.qtyWh }))
        : undefined;
    const whFromRacks = rack_quantities
      ? rack_quantities.reduce((s, r) => s + r.qtyWh, 0)
      : itemToSave.whStock;
    const res = await updateWarehouseStock(wid, {
      wh_stock: whFromRacks,
      ml1_stock: itemToSave.ml1Stock,
      ml2_stock: itemToSave.ml2Stock,
      ...(rack_quantities ? { rack_quantities } : {}),
      reserved: itemToSave.reserved,
      in_transit: itemToSave.inTransit,
      ...(!(rack_quantities && (itemToSave.type === 'RM' || itemToSave.type === 'PM' || itemToSave.type === 'FG/PR'))
        ? { zone: itemToSave.zone ?? '', rack: itemToSave.rack ?? '' }
        : {}),
      qc_status: (itemToSave.qcStatus ?? 'In Stock').trim() || 'In Stock',
      wh_unit: itemToSave.whUnit?.trim() || 'KG',
      reorder_pt: itemToSave.reorderPt,
      avg_mo: itemToSave.avgMo,
      batch_number: itemToSave.batchNumber?.trim() ?? '',
      expiry_date: itemToSave.expiryDate?.trim() ?? '',
      ...(noteTrim ? { note: noteTrim } : {}),
    });
    setSavingEdit(false);
    if (res.success && res.data) {
      const d = res.data;
      const wh = numOr(d.wh_stock, itemToSave.whStock);
      const ml1 = numOr(d.ml1_stock, itemToSave.ml1Stock);
      const ml2 = numOr(d.ml2_stock, itemToSave.ml2Stock);
      const stockInHand = numOr(d.stock_in_hand, wh + ml1 + ml2);
      const reorderPt = numOr(d.reorder_pt, itemToSave.reorderPt);
      const qc = d.qc_status != null ? String(d.qc_status) : itemToSave.qcStatus ?? 'In Stock';
      const reserved = numOr(d.reserved, itemToSave.reserved);
      const status = deriveWarehouseInventoryDisplayStatus(qc, stockInHand, reorderPt, reserved);

      const updated: InventoryItem = {
        ...itemToSave,
        whStock: wh,
        ml1Stock: ml1,
        ml2Stock: ml2,
        stockInHand,
        available: warehouseInventoryAvailable(stockInHand, reserved),
        reserved,
        inTransit: numOr(d.in_transit, itemToSave.inTransit),
        zone: displayZoneRack(d.zone != null ? String(d.zone) : itemToSave.zone),
        rack: displayZoneRack(d.rack != null ? String(d.rack) : itemToSave.rack),
        whUnit: d.wh_unit != null ? String(d.wh_unit) : itemToSave.whUnit,
        reorderPt,
        avgMo: numOr(d.avg_mo, itemToSave.avgMo),
        qcStatus: qc,
        status,
        batchNumber: d.batch_number ? String(d.batch_number) : undefined,
        expiryDate: d.expiry_date ? String(d.expiry_date).slice(0, 10) : undefined,
      };
      setSelectedItem(updated);
      if (onItemUpdated) onItemUpdated(updated);
      editSnapshotRef.current = null;
      setIsEditMode(false);
      setAdjustNote('');
      setRackQtyDraft(null);
      setStockQtyDraft({});
      await refreshHistory(wid);
      const locRes = await fetchStockByLocation(wid);
      if (locRes.success && locRes.data) {
        setStockByLocation(locRes.data);
      }
    }
  };

  if (!selectedItem) return null;

  const qcSelectValue = (() => {
    const v = (selectedItem.qcStatus ?? 'In Stock').trim() || 'In Stock';
    const preset = QC_STATUS_PRESETS.find((p) => p === v);
    return preset ?? '__custom__';
  })();

  const warehouseStoreLabel = warehouseStoreLabelForItemType(selectedItem.type);
  const whLocationHint =
    'Adjust stock in any warehouse zone and rack. New inbound (GRN) posts to the facility default warehouse zone.';

  const isModal = variant === 'modal';
  return (
    <div
      className={
        isModal
          ? 'w-full max-w-xl max-h-[90vh] bg-surface rounded-xl shadow-2xl overflow-y-auto border border-border'
          : 'h-full w-full max-w-xl bg-surface border-l border-border shadow-2xl overflow-y-auto'
      }
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink">Inventory — {selectedItem.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md border border-border text-ink-2 hover:bg-surface-2"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-soft text-brand text-[10px] font-semibold">
            SIH: {selectedItem.stockInHand} {selectedItem.whUnit}
          </span>
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-soft text-brand text-[10px] font-semibold">
            W1: {selectedItem.whStock}
          </span>
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-soft text-brand text-[10px] font-semibold">
            ML1: {selectedItem.ml1Stock}
          </span>
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-soft text-brand text-[10px] font-semibold">
            ML2: {selectedItem.ml2Stock}
          </span>
          <span className="px-2 py-0.5 rounded border border-warn bg-warn-soft text-warn text-[10px] font-semibold">
            Reserved: {selectedItem.reserved}
          </span>
          <span className="px-2 py-0.5 rounded border border-err bg-err-soft text-err text-[10px] font-semibold">
            In Transit: {selectedItem.inTransit}
          </span>
          <span className="px-2 py-0.5 rounded border border-ok bg-ok-soft text-ok text-[10px] font-semibold">
            {selectedItem.status}
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-2 text-ink-2 text-[10px] font-semibold">
            {selectedItem.type}
          </span>
        </div>

        {selectedItem.warehouseInventoryId != null && (
          <div className="bg-surface-2 border border-border rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
              {isEditMode ? 'Adjust WH stock by rack' : 'WH stock distribution'}
            </p>
            {isEditMode ? (
              <p className="text-[10px] text-ink-3">
                {whLocationHint} WH total follows the sum of rack quantities in{' '}
                <span className="font-semibold text-ink-2">{warehouseStoreLabel}</span> (all zones listed below).
              </p>
            ) : (
              <p className="text-[10px] text-ink-3">
                How warehouse stock is split in <span className="font-semibold">{warehouseStoreLabel}</span>. Click a WH
                stock cell in the table for the same view, or Edit item to adjust.
              </p>
            )}
            <StockByLocationPanel
              data={stockByLocation}
              loading={stockByLocationLoading}
              compact
              viewMode="both"
              editable={isEditMode}
              rackDraft={isEditMode ? rackQtyDraft : undefined}
              onRackQtyChange={isEditMode ? handleRackQtyChange : undefined}
            />
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">Item Details</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Item Code</p>
              <p className="text-[11px] font-semibold text-brand">{selectedItem.code}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Input Category</p>
              <p className="text-[11px] font-semibold text-ink">
                {selectedItem.subtitle.split('·')[0]?.trim() ?? '—'}
              </p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">UOM</p>
              {isEditMode ? (
                <input
                  type="text"
                  value={selectedItem.whUnit}
                  onChange={(e) => updateInventoryField('whUnit', e.target.value)}
                  className="mt-0.5 w-full border border-border rounded px-1.5 py-0.5 text-[11px] font-semibold text-ok bg-surface"
                  aria-label="UOM"
                />
              ) : (
                <p className="text-[11px] font-semibold text-ok">{selectedItem.whUnit}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">
            {selectedItem.type === 'PM' ? 'Packaging location' : selectedItem.type === 'RM' ? 'RM location' : 'Location / Zone & Rack'}
          </p>
          {isEditMode && (selectedItem.type === 'RM' || selectedItem.type === 'PM' || selectedItem.type === 'FG/PR') ? (
            <div className="bg-brand-soft border border-brand rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-brand">{warehouseStoreLabel}</p>
              <p className="text-[10px] text-brand/80">
                Zone and rack are set from rack quantities above — not typed manually for {selectedItem.type} items.
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[9px] uppercase text-ink-3 block">Zone (from racks)</span>
                  <span className="font-medium text-ink">{displayZoneRack(selectedItem.zone)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-ink-3 block">Rack (from racks)</span>
                  <span className="font-medium text-ink">{displayZoneRack(selectedItem.rack)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-2 border border-border rounded p-2">
                <p className="text-[9px] uppercase text-ink-3">Zone / Location</p>
                {isEditMode ? (
                  <input
                    type="text"
                    value={selectedItem.zone}
                    onChange={(e) => updateInventoryField('zone', e.target.value)}
                    className="mt-0.5 w-full border border-border rounded px-2 py-1 text-sm bg-surface"
                    aria-label="Zone / Location"
                  />
                ) : (
                  <p className="text-[11px] font-semibold text-ink">{displayZoneRack(selectedItem.zone)}</p>
                )}
              </div>
              <div className="bg-surface-2 border border-border rounded p-2">
                <p className="text-[9px] uppercase text-ink-3">Rack</p>
                {isEditMode ? (
                  <input
                    type="text"
                    value={selectedItem.rack}
                    onChange={(e) => updateInventoryField('rack', e.target.value)}
                    className="mt-0.5 w-full border border-border rounded px-2 py-1 text-sm bg-surface"
                    aria-label="Rack"
                  />
                ) : (
                  <p className="text-[11px] font-semibold text-ink">{displayZoneRack(selectedItem.rack)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">Stock & pipeline</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">WH stock</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('whStock')}
                  readOnly={rackQtyDraft != null && rackQtyDraft.length > 0}
                  title={
                    rackQtyDraft != null && rackQtyDraft.length > 0
                      ? 'Derived from rack quantities above'
                      : undefined
                  }
                  onChange={(e) => handleStockQtyInput('whStock', e.target.value)}
                  className={`w-full border border-border rounded px-2 py-1 text-sm text-brand ${
                    rackQtyDraft != null && rackQtyDraft.length > 0
                      ? 'bg-surface-3 cursor-default'
                      : 'bg-surface'
                  }`}
                />
              ) : (
                <p className="text-base font-bold text-brand">{selectedItem.whStock}</p>
              )}
            </label>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">ML1 stock</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('ml1Stock')}
                  onChange={(e) => handleStockQtyInput('ml1Stock', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-brand"
                />
              ) : (
                <p className="text-base font-bold text-brand">{selectedItem.ml1Stock}</p>
              )}
            </label>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">ML2 stock</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('ml2Stock')}
                  onChange={(e) => handleStockQtyInput('ml2Stock', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-brand"
                />
              ) : (
                <p className="text-base font-bold text-brand">{selectedItem.ml2Stock}</p>
              )}
            </label>
            <div className="bg-ok-soft border border-ok rounded p-2">
              <p className="text-[9px] uppercase text-ok">Available (SIH − reserved)</p>
              <p className="text-base font-bold text-ok">
                {warehouseInventoryAvailable(selectedItem.stockInHand, selectedItem.reserved)}{' '}
                {selectedItem.whUnit}
              </p>
              {selectedItem.reserved > 0 ? (
                <p className="text-[10px] text-ok/80 mt-0.5">
                  Physical total {selectedItem.stockInHand} {selectedItem.whUnit}
                </p>
              ) : null}
            </div>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">Reserved</p>
              {isEditMode ? (
                <input
                  type="number"
                  value={selectedItem.reserved}
                  onChange={(e) => updateInventoryField('reserved', Number(e.target.value) || 0)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-warn"
                />
              ) : (
                <p className="text-sm font-bold text-warn">
                  {selectedItem.reserved} {selectedItem.whUnit}
                </p>
              )}
            </label>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">In transit</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('inTransit')}
                  onChange={(e) => handleStockQtyInput('inTransit', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-err"
                />
              ) : (
                <p className="text-sm font-bold text-err">
                  {selectedItem.inTransit} {selectedItem.whUnit}
                </p>
              )}
            </label>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">
            Planning / QC / lot
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">Reorder point</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('reorderPt')}
                  onChange={(e) => handleStockQtyInput('reorderPt', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="text-[11px] font-semibold text-ink">{selectedItem.reorderPt}</p>
              )}
            </label>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">Avg monthly</p>
              {isEditMode ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockQtyInputValue('avgMo')}
                  onChange={(e) => handleStockQtyInput('avgMo', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="text-[11px] font-semibold text-ink">{selectedItem.avgMo}</p>
              )}
            </label>
            <div className="bg-surface-2 border border-border rounded p-2 col-span-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">QC status (stored)</p>
              {isEditMode ? (
                <div className="space-y-1">
                  <select
                    value={qcSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') return;
                      updateInventoryField('qcStatus', v);
                    }}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-surface"
                    aria-label="QC status"
                  >
                    {QC_STATUS_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="__custom__">Other (type below)</option>
                  </select>
                  {qcSelectValue === '__custom__' && (
                    <input
                      type="text"
                      value={selectedItem.qcStatus ?? ''}
                      onChange={(e) => updateInventoryField('qcStatus', e.target.value)}
                      placeholder="Custom QC status"
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-surface"
                      aria-label="Custom QC status"
                    />
                  )}
                </div>
              ) : (
                <p className="text-[11px] font-semibold text-ink">{selectedItem.qcStatus ?? '—'}</p>
              )}
            </div>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">Batch / lot</p>
              {isEditMode ? (
                <input
                  type="text"
                  value={selectedItem.batchNumber ?? ''}
                  onChange={(e) => updateInventoryField('batchNumber', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="text-[11px] font-semibold text-ink">{selectedItem.batchNumber || 'N/A'}</p>
              )}
            </label>
            <label className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3 mb-1">Expiry</p>
              {isEditMode ? (
                <input
                  type="date"
                  value={(selectedItem.expiryDate ?? '').slice(0, 10)}
                  onChange={(e) => updateInventoryField('expiryDate', e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="text-[11px] font-semibold text-ink">{selectedItem.expiryDate || 'N/A'}</p>
              )}
            </label>
          </div>
        </div>

        {isEditMode && selectedItem.warehouseInventoryId != null && (
          <div className="bg-warn-soft/60 border border-warn rounded p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-warn">Audit note</p>
            <p className="text-[10px] text-warn/80">
              Optional. Saved on the history entry when you change anything, or alone to log a note.
            </p>
            <textarea
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              rows={2}
              placeholder="e.g. Physical count correction, GRN reconciliation…"
              className="w-full border border-warn rounded px-2 py-1.5 text-sm bg-surface"
              aria-label="Audit note"
            />
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">
            Avg Consumption (Monthly)
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Avg 2025</p>
              <p className="text-[11px] font-semibold text-ink">
                {Math.round(selectedItem.avgMo * 0.9)} {selectedItem.whUnit}
              </p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Sep 2025</p>
              <p className="text-[11px] font-semibold text-ink">
                {Math.round(selectedItem.avgMo * 0.8)} {selectedItem.whUnit}
              </p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Oct 2025</p>
              <p className="text-[11px] font-semibold text-ink">
                {Math.round(selectedItem.avgMo)} {selectedItem.whUnit}
              </p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">3-Month Avg</p>
              <p className="text-[11px] font-semibold text-ink">
                {selectedItem.avgMo} {selectedItem.whUnit}/month
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">Item Specifications</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Manufacturer</p>
              <p className="text-[11px] font-semibold text-ink">{selectedItem.manufacturer || 'N/A'}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Quality Grade</p>
              <p className="text-[11px] font-semibold text-ok">{selectedItem.qualityGrade || 'N/A'}</p>
            </div>
            <div className="col-span-2 bg-surface-2 border border-border rounded p-2">
              <p className="text-[9px] uppercase text-ink-3">Storage Condition</p>
              <p className="text-[11px] font-semibold text-ink">{selectedItem.storageCondition || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-2">
            Movement & adjustment history
          </p>
          <div className="bg-surface-2 border border-border rounded p-3 max-h-56 overflow-y-auto">
            {locationHistoryLoading ? (
              <p className="text-[11px] text-ink-3">Loading history…</p>
            ) : locationHistoryError ? (
              <p className="text-[11px] text-err">{locationHistoryError}</p>
            ) : locationHistory.length === 0 ? (
              <p className="text-[11px] text-ink-3 italic">No history recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-[11px] text-ink-2">
                {locationHistory.map((h) => {
                  const adjustLines =
                    h.actionType === 'INVENTORY_ADJUST' ? inventoryAdjustChangeLines(h.changesJson) : [];
                  return (
                  <li key={h.id} className="flex items-start justify-between gap-2 border-b border-hairline pb-2 last:border-0">
                    <div className="flex items-start gap-2 min-w-0">
                      {h.actionType === 'INVENTORY_ADJUST' ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-brand-soft text-brand">
                          <ClipboardList className="w-3.5 h-3.5" />
                        </span>
                      ) : h.actionType === 'BMR_RESERVED' || h.actionType === 'BPR_RESERVED' ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-warn-soft text-warn">
                          R
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-brand-soft text-brand">
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                      <div className="min-w-0">
                        {h.actionType === 'INVENTORY_ADJUST' ? (
                          <div>
                            <div className="font-semibold text-brand">Inventory adjust</div>
                            {adjustLines.length > 0 ? (
                              <ul className="mt-1 list-disc list-inside text-[10px] text-ink-2 space-y-0.5">
                                {adjustLines.map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[10px] text-ink-3 italic">No field diff (note-only?)</p>
                            )}
                            {h.note ? (
                              <p className="mt-1 text-[10px] text-ink-2">
                                <span className="font-medium text-ink-2">Note:</span> {h.note}
                              </p>
                            ) : null}
                            {h.qtyDelta != null && h.qtyDelta !== 0 ? (
                              <p className="text-[10px] text-ink-3">SIH Δ {h.qtyDelta}</p>
                            ) : null}
                          </div>
                        ) : h.actionType === 'BMR_RESERVED' || h.actionType === 'BPR_RESERVED' ? (
                          <div className="font-semibold">
                            <span className="text-warn">
                              Reserved +{h.reservedDelta ?? '—'} → {h.reservedAfter ?? '—'}{' '}
                              {h.batchNo ? `· ${h.batchNo}` : ''}
                            </span>
                          </div>
                        ) : h.fromZone || h.fromRack ? (
                          <div className="font-semibold">
                            <span className="text-ink-2">
                              {h.fromZone || '—'} / {h.fromRack || '—'}
                            </span>
                            <span className="mx-1 text-ink-4">→</span>
                            <span className="text-brand">
                              {h.toZone || '—'} / {h.toRack || '—'}
                            </span>
                          </div>
                        ) : (
                          <div className="font-semibold text-brand">
                            Set to {h.toZone || '—'} / {h.toRack || '—'}
                          </div>
                        )}
                        <p className="text-[10px] text-ink-3">{new Date(h.movedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border flex flex-wrap justify-end gap-2 sticky bottom-0 bg-surface">
        {selectedItem.warehouseInventoryId != null &&
          (isEditMode ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingEdit}
                className="px-3 py-1.5 bg-surface-3 text-ink rounded-md text-xs font-semibold hover:bg-surface-3 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-semibold hover:bg-brand-press disabled:opacity-60"
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-semibold hover:bg-brand-press transition-colors"
            >
              Edit item
            </button>
          ))}
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-ink-2 text-white rounded-md text-xs font-semibold hover:bg-ink transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default WarehouseInventorySidebar;
