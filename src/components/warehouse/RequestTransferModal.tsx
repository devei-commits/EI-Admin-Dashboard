import React, { useEffect, useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { createMRN, type MRNRecordFromApi } from '../../services/mrn.service';
import { fetchFacilityAreas, type FacilityAreaDTO } from '../../services/facilityAreas.service';
import { fetchWarehouseInventory, type WarehouseInventoryRow } from '../../services/warehouseInventory.service';
import MaterialMasterTypeahead from '../MaterialMasterTypeahead';
import { type MaterialTypeaheadOption } from '../../lib/materialTypeahead';
import {
  buildTransferLocationOptions,
  defaultRequiredByDate,
  formatTransferQty,
  sihAtZoneForInventoryRow,
  type TransferSourceType,
} from '../../lib/transferRequestLocationStock';
import { materialQtyToNum, sanitizeMrnLineItemQuantity } from '../../utils/materialQtyCompare';

type TransferRequestLine = {
  id: string;
  catalogKey: string;
  itemCode: string;
  itemName: string;
  unit: string;
  rawMaterialId?: number;
  packMaterialId?: number;
  requestedQty: number;
  notes: string;
};

type RequestTransferModalProps = {
  onClose: () => void;
  onCreated: (mrn: MRNRecordFromApi) => void;
};

const SOURCE_TYPES: readonly TransferSourceType[] = ['Production', 'Warehouse', 'Internal'];

function createEmptyLine(): TransferRequestLine {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    catalogKey: '',
    itemCode: '',
    itemName: '',
    unit: 'KG',
    requestedQty: 0,
    notes: '',
  };
}

const RequestTransferModal: React.FC<RequestTransferModalProps> = ({ onClose, onCreated }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warehouseAreas, setWarehouseAreas] = useState<FacilityAreaDTO[]>([]);
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  const [inventoryRows, setInventoryRows] = useState<WarehouseInventoryRow[]>([]);
  const [sourceType, setSourceType] = useState<TransferSourceType>('Production');
  const [fromZone, setFromZone] = useState('');
  const [toZone, setToZone] = useState('');
  const [requiredByDate, setRequiredByDate] = useState(defaultRequiredByDate());
  const [lines, setLines] = useState<TransferRequestLine[]>([createEmptyLine()]);
  const [itemQueries, setItemQueries] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchFacilityAreas('warehouse'),
      fetchFacilityAreas('production'),
      fetchWarehouseInventory(),
    ])
      .then(([whRes, prodRes, invRes]) => {
        if (cancelled) return;
        setWarehouseAreas(whRes.data ?? []);
        setProductionAreas(prodRes.data ?? []);
        setInventoryRows(invRes.success && invRes.data ? invRes.data.rows : []);
      })
      .catch(() => {
        if (!cancelled) addToast('error', 'Could not load transfer request data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const locationOptions = useMemo(
    () => buildTransferLocationOptions(warehouseAreas, productionAreas),
    [warehouseAreas, productionAreas],
  );

  useEffect(() => {
    if (locationOptions.length === 0) return;
    const whDefault = locationOptions.find((z) => z.facility === 'warehouse');
    const prodDefault = locationOptions.find((z) => z.areaType === 'production');
    setFromZone((prev) => prev || whDefault?.code || locationOptions[0].code);
    setToZone((prev) => prev || prodDefault?.code || locationOptions[1]?.code || locationOptions[0].code);
  }, [locationOptions]);

  const inventoryByCode = useMemo(() => {
    const map = new Map<string, WarehouseInventoryRow>();
    inventoryRows.forEach((row) => {
      map.set(String(row.code).trim().toUpperCase(), row);
    });
    return map;
  }, [inventoryRows]);

  // The in-stock inventory rows at the source zone ARE the transferable items — build the
  // item search straight from them (RM/PM only). This avoids fetching the full RM + PM
  // master catalogs (~3.5k rows) just to show the handful that actually have stock.
  const inStockOptions = useMemo<MaterialTypeaheadOption[]>(() => {
    const opts: MaterialTypeaheadOption[] = [];
    for (const row of inventoryRows) {
      if (row.type !== 'RM' && row.type !== 'PM') continue;
      if (sihAtZoneForInventoryRow(row, fromZone) <= 0) continue;
      const isRm = row.type === 'RM';
      opts.push({
        key: `${isRm ? 'rm' : 'pm'}:${row.sourceId}`,
        kind: isRm ? 'rm' : 'pm',
        id: String(row.sourceId),
        code: row.code,
        name: row.name,
        label: `${row.name} · ${row.code}`,
        haystack: `${row.name} ${row.code}`.toLowerCase(),
        disabled: false,
        unit: row.whUnit || (isRm ? 'KG' : 'PCS'),
        rawMaterialId: isRm ? Number(row.sourceId) || undefined : undefined,
        packMaterialId: !isRm ? Number(row.sourceId) || undefined : undefined,
      });
    }
    opts.sort((a, b) => a.name.localeCompare(b.name));
    return opts;
  }, [inventoryRows, fromZone]);

  // Per line: grey out items already picked on other lines, keep this line's own pick visible.
  const optionsForLine = (line: TransferRequestLine): MaterialTypeaheadOption[] => {
    const base = inStockOptions.map((opt) => ({
      ...opt,
      disabled: usedCatalogKeys.has(opt.key) && opt.key !== line.catalogKey,
    }));
    if (line.catalogKey && !base.some((o) => o.key === line.catalogKey)) {
      base.push({
        key: line.catalogKey,
        kind: line.rawMaterialId ? 'rm' : 'pm',
        id: String(line.rawMaterialId ?? line.packMaterialId ?? ''),
        code: line.itemCode,
        name: line.itemName,
        label: `${line.itemName} · ${line.itemCode}`,
        haystack: `${line.itemName} ${line.itemCode}`.toLowerCase(),
        disabled: false,
        unit: line.unit,
        rawMaterialId: line.rawMaterialId,
        packMaterialId: line.packMaterialId,
      });
    }
    return base;
  };

  const usedCatalogKeys = useMemo(
    () => new Set(lines.map((line) => line.catalogKey).filter(Boolean)),
    [lines],
  );

  const linesWithStock = useMemo(
    () =>
      lines.map((line) => {
        const inv = line.itemCode
          ? inventoryByCode.get(line.itemCode.trim().toUpperCase())
          : undefined;
        const sihSource = inv ? sihAtZoneForInventoryRow(inv, fromZone) : 0;
        const sihDest = inv ? sihAtZoneForInventoryRow(inv, toZone) : 0;
        return { ...line, sihSource, sihDest };
      }),
    [lines, inventoryByCode, fromZone, toZone],
  );

  const updateLine = (lineId: string, patch: Partial<TransferRequestLine>): void => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const setLineQuery = (lineId: string, query: string): void => {
    setItemQueries((prev) => ({ ...prev, [lineId]: query }));
  };

  const clearLineItem = (lineId: string): void => {
    updateLine(lineId, {
      catalogKey: '',
      itemCode: '',
      itemName: '',
      unit: 'KG',
      rawMaterialId: undefined,
      packMaterialId: undefined,
    });
    setLineQuery(lineId, '');
  };

  const applyMaterialToLine = (lineId: string, opt: MaterialTypeaheadOption): void => {
    updateLine(lineId, {
      catalogKey: opt.key,
      itemCode: opt.code,
      itemName: opt.name,
      unit: opt.unit,
      rawMaterialId: opt.rawMaterialId,
      packMaterialId: opt.packMaterialId,
    });
    setLineQuery(lineId, opt.label);
  };

  const addEmptyLine = (): void => {
    const next = createEmptyLine();
    setLines((prev) => [...prev, next]);
  };

  const removeLine = (lineId: string): void => {
    // Always keep at least one line; removing the last one resets it to an empty row.
    setLines((prev) => (prev.length <= 1 ? [createEmptyLine()] : prev.filter((line) => line.id !== lineId)));
    setItemQueries((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  };

  const lineItemQuery = (line: TransferRequestLine): string => {
    if (itemQueries[line.id] !== undefined) return itemQueries[line.id];
    if (line.catalogKey) {
      return line.itemName ? `${line.itemName} · ${line.itemCode}` : line.itemCode;
    }
    return '';
  };

  const handleSubmit = async (): Promise<void> => {
    const payloadLines = linesWithStock.filter((line) => line.itemCode && line.requestedQty > 0);
    if (!fromZone || !toZone) {
      addToast('error', 'Select both From and To locations.');
      return;
    }
    if (fromZone === toZone) {
      addToast('error', 'From and To locations must be different.');
      return;
    }
    if (payloadLines.length === 0) {
      addToast('error', 'Add at least one item with requested quantity.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createMRN({
        requestedBy: `${sourceType} (Transfer Request)`,
        source: 'TRQ',
        notes: `Transfer request ${sourceType}: ${zoneLabel(fromZone)} → ${zoneLabel(toZone)}`,
        whDispatchZone: fromZone,
        muReceiveZone: toZone,
        requiredByDate,
        lineItems: payloadLines.map((line, index) => ({
          id: `trq-${index + 1}`,
          itemCode: line.itemCode,
          code: line.itemCode,
          quantity: materialQtyToNum(sanitizeMrnLineItemQuantity(line.requestedQty)),
          unit: line.unit,
          notes: line.notes || line.itemName,
          ...(line.rawMaterialId ? { raw_material_id: line.rawMaterialId } : {}),
          ...(line.packMaterialId ? { pack_material_id: line.packMaterialId } : {}),
        })),
      });
      addToast('success', `Transfer request ${created.mrnNo} submitted.`);
      onCreated(created);
      onClose();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to submit transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const zoneLabel = (code: string): string => {
    const match = locationOptions.find((z) => z.code === code);
    return match ? match.label : code;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        className="relative my-4 w-full max-w-5xl rounded-xl border border-border bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-transfer-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-4 rounded-t-xl">
          <div>
            <h2 id="request-transfer-title" className="text-lg font-bold text-ink">
              Request Transfer
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Raise a request to move material between locations — no production batch required.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting || loading}
              onClick={() => void handleSubmit()}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          {loading ? (
            <p className="text-sm text-ink-3">Loading locations and inventory…</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Source Type
                  </span>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as TransferSourceType)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {SOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                    From Location
                  </span>
                  <select
                    value={fromZone}
                    onChange={(e) => setFromZone(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {locationOptions.map((loc) => (
                      <option key={`from-${loc.code}`} value={loc.code}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                    To Location
                  </span>
                  <select
                    value={toZone}
                    onChange={(e) => setToZone(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {locationOptions.map((loc) => (
                      <option key={`to-${loc.code}`} value={loc.code}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Supply Required By
                  </span>
                  <input
                    type="date"
                    value={requiredByDate}
                    onChange={(e) => setRequiredByDate(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <p className="text-xs text-ink-3">
                Route: <span className="font-medium text-ink-2">{zoneLabel(fromZone)}</span>
                {' → '}
                <span className="font-medium text-ink-2">{zoneLabel(toZone)}</span>
              </p>

              <section className="rounded-xl border border-border overflow-hidden">
                <div className="border-b border-border bg-surface-2 px-4 py-3">
                  <h3 className="text-sm font-semibold text-ink">📦 Items requested</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                      <tr>
                        <th scope="col" className="px-4 py-3">Item</th>
                        <th scope="col" className="px-4 py-3 text-right">SIH @ Source</th>
                        <th scope="col" className="px-4 py-3 text-right">SIH @ Dest</th>
                        <th scope="col" className="px-4 py-3 text-right">Requested Qty</th>
                        <th scope="col" className="px-4 py-3">Notes</th>
                        <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Remove</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {linesWithStock.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 min-w-[16rem]">
                            <MaterialMasterTypeahead
                              options={optionsForLine(line)}
                              value={lineItemQuery(line)}
                              selectedId={line.catalogKey}
                              onValueChange={(query) => setLineQuery(line.id, query)}
                              onSelect={(opt) => applyMaterialToLine(line.id, opt)}
                              onClearSelection={() => clearLineItem(line.id)}
                              loading={loading}
                              placeholder="Search by name or code…"
                            />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-2 whitespace-nowrap">
                            {line.itemCode ? formatTransferQty(line.sihSource, line.unit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-2 whitespace-nowrap">
                            {line.itemCode ? formatTransferQty(line.sihDest, line.unit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {line.itemCode ? (
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={line.requestedQty || ''}
                                onChange={(e) =>
                                  updateLine(line.id, {
                                    requestedQty: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-24 rounded border border-border px-2 py-1 text-right tabular-nums"
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[12rem]">
                            {line.itemCode ? (
                              <input
                                type="text"
                                value={line.notes}
                                onChange={(e) => updateLine(line.id, { notes: e.target.value })}
                                placeholder="e.g. batch reference, shortage note"
                                className="w-full rounded border border-border px-2 py-1 text-sm"
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(line.id)}
                              title="Remove item"
                              aria-label="Remove item"
                              className="inline-flex items-center justify-center rounded p-1.5 text-ink-4 hover:bg-err-soft hover:text-err"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border bg-surface-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={addEmptyLine}
                    className="text-sm font-semibold text-ink-2 hover:text-ink"
                  >
                    + add item
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestTransferModal;
