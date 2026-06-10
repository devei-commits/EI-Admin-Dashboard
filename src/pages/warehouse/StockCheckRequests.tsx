import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProcurementRequests,
  updateProcurementRequest,
  type ProcurementRequest,
  type ProcurementRequestItem,
} from '../../services/procurement.service';
import { computeInventoryAuditGap } from '../../lib/inventoryAuditGap';
import { parseStockCheckNotes } from '../../lib/stockCheckNotes';
import { fetchWarehouseInventory, updateWarehouseStock, type WarehouseInventoryRow } from '../../services/warehouseInventory.service';

type StockCheckOutcome = 'all_ok' | 'not_ok';

type LineDraft = {
  key: string;
  itemCode: string;
  itemName: string;
  requestedQty: number;
  systemQty: number;
  physicalQty: number;
  consumptionQty: number;
  updatedStockQty: number;
  remarks: string;
  location: string;
  warehouseInventoryId: number | null;
  unit: string;
};

function parseNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPendingStockCheck(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'pending' || s === 'requested' || s === 'in progress';
}

function isCompletedStockCheck(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toLowerCase() === 'completed';
}

function requestItemNames(req: ProcurementRequest): string {
  const names = (Array.isArray(req.items) ? req.items : [])
    .map((line) => String(line.name ?? '').trim())
    .filter(Boolean);
  if (names.length === 0) return req.planningProductName || 'Item';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

const StockCheckRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<'Pending' | 'In Progress' | 'Completed'>('Pending');
  const [outcomeDraft, setOutcomeDraft] = useState<StockCheckOutcome>('all_ok');
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: procurementRes } = useQuery({
    queryKey: ['procurement-requests', 'warehouse-stock-checks'],
    queryFn: async () => fetchProcurementRequests(),
  });

  const { data: inventoryRes } = useQuery({
    queryKey: ['warehouse-inventory', 'stock-check-requests'],
    queryFn: async () => fetchWarehouseInventory(),
  });

  const requests = procurementRes?.data ?? [];
  const inventoryRows = inventoryRes?.data?.rows ?? [];

  const requestsForWarehouse = useMemo(
    () =>
      requests.filter((r) => {
        const s = String(r.stockCheckStatus ?? '').trim();
        return s.length > 0;
      }),
    [requests],
  );

  const inventoryByCode = useMemo(() => {
    const m = new Map<string, WarehouseInventoryRow>();
    for (const row of inventoryRows) {
      const key = String(row.code ?? '').trim().toLowerCase();
      if (key) m.set(key, row);
    }
    return m;
  }, [inventoryRows]);

  const inventoryByName = useMemo(() => {
    const m = new Map<string, WarehouseInventoryRow>();
    for (const row of inventoryRows) {
      const key = String(row.name ?? '').trim().toLowerCase();
      if (key) m.set(key, row);
    }
    return m;
  }, [inventoryRows]);

  const openRequest = (req: ProcurementRequest) => {
    const notesParsed = parseStockCheckNotes(req.stockCheckNotes);
    const itemLines: ProcurementRequestItem[] = Array.isArray(req.items) ? req.items : [];
    let nextLines: LineDraft[] = itemLines.map((line, idx) => {
      const itemCode = String(line.code ?? '').trim() || `ITEM-${idx + 1}`;
      const itemName = String(line.name ?? '').trim() || itemCode;
      const byCode = inventoryByCode.get(itemCode.toLowerCase());
      const byName = inventoryByName.get(itemName.toLowerCase());
      const inv = byCode ?? byName ?? null;
      const existingLine = notesParsed?.lines?.find(
        (x) =>
          String(x.itemCode ?? '').trim().toLowerCase() === itemCode.toLowerCase() ||
          String(x.itemName ?? '').trim().toLowerCase() === itemName.toLowerCase(),
      );
      const systemQty = parseNumber(inv?.stockInHand);
      const physicalQty = existingLine?.physicalQty != null ? parseNumber(existingLine.physicalQty) : systemQty;
      const consumptionQty =
        existingLine?.consumptionQty != null ? parseNumber(existingLine.consumptionQty) : 0;
      const updatedStockQty =
        existingLine?.updatedStockQty != null ? parseNumber(existingLine.updatedStockQty) : physicalQty;
      const location = String(existingLine?.location ?? existingLine?.zone ?? inv?.zone ?? 'MAIN').trim() || 'MAIN';
      return {
        key: `${req.id}-${itemCode}-${idx}`,
        itemCode,
        itemName,
        requestedQty: parseNumber(line.quantity_requested),
        systemQty,
        physicalQty,
        consumptionQty,
        updatedStockQty,
        remarks: String(existingLine?.remarks ?? ''),
        location,
        warehouseInventoryId: inv?.warehouseInventoryId ?? null,
        unit: String(line.unit ?? inv?.whUnit ?? '').trim() || 'KG',
      };
    });
    if (nextLines.length === 0) {
      const fallbackCode = String(req.planningProductCode ?? '').trim() || `REQ-${req.id}`;
      const fallbackName = String(req.planningProductName ?? '').trim() || `Request ${req.id}`;
      const invByCode = inventoryByCode.get(fallbackCode.toLowerCase());
      const invByName = inventoryByName.get(fallbackName.toLowerCase());
      const inv = invByCode ?? invByName ?? null;
      const systemQty = parseNumber(inv?.stockInHand);
      nextLines = [
        {
          key: `${req.id}-${fallbackCode}-fallback`,
          itemCode: fallbackCode,
          itemName: fallbackName,
          requestedQty: 0,
          systemQty,
          physicalQty: systemQty,
          consumptionQty: 0,
          updatedStockQty: systemQty,
          remarks: '',
          location: String(inv?.zone ?? 'MAIN').trim() || 'MAIN',
          warehouseInventoryId: inv?.warehouseInventoryId ?? null,
          unit: String(inv?.whUnit ?? 'KG'),
        },
      ];
    }

    setActiveRequestId(req.id);
    setStatusDraft(
      isCompletedStockCheck(req.stockCheckStatus) ? 'Completed' : isPendingStockCheck(req.stockCheckStatus) ? 'Pending' : 'In Progress',
    );
    setOutcomeDraft(notesParsed?.outcome === 'not_ok' ? 'not_ok' : 'all_ok');
    setLineDrafts(nextLines);
    setFormError(null);
  };

  const activeRequest = activeRequestId != null ? requestsForWarehouse.find((r) => r.id === activeRequestId) ?? null : null;
  // Keep the stock update field visible once status is completed so users can clearly see
  // where to update when switching to "Not OK".
  const showStockUpdateField = statusDraft === 'Completed' || outcomeDraft === 'not_ok';

  const handleSave = async () => {
    if (!activeRequest) return;
    setSaving(true);
    setFormError(null);
    try {
      if (statusDraft === 'Completed' && outcomeDraft === 'not_ok') {
        for (const line of lineDrafts) {
          if (line.updatedStockQty < 0) {
            throw new Error(`Updated stock cannot be negative for ${line.itemCode}`);
          }
          if (line.warehouseInventoryId != null) {
            const res = await updateWarehouseStock(line.warehouseInventoryId, { wh_stock: line.updatedStockQty });
            if (!res.success) {
              throw new Error(typeof res.error === 'string' ? res.error : `Failed stock update for ${line.itemCode}`);
            }
          }
        }
      }

      const notesPayload = {
        version: 1,
        outcome: statusDraft === 'Completed' ? outcomeDraft : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Warehouse Team',
        lines: lineDrafts.map((l) => {
          const gapQty = computeInventoryAuditGap(l.systemQty, l.physicalQty, l.consumptionQty);
          return {
            itemCode: l.itemCode,
            itemName: l.itemName,
            systemQty: l.systemQty,
            physicalQty: l.physicalQty,
            consumptionQty: l.consumptionQty,
            gapQty,
            location: l.location,
            zone: l.location,
            updatedStockQty: l.updatedStockQty,
            remarks: l.remarks || undefined,
          };
        }),
      };

      const upd = await updateProcurementRequest(activeRequest.id, {
        stockCheckAssignedTo: activeRequest.stockCheckAssignedTo || 'Warehouse Team',
        stockCheckStatus: statusDraft,
        stockCheckNotes: JSON.stringify(notesPayload),
      });
      if (!upd.success) {
        throw new Error(typeof upd.error === 'string' ? upd.error : 'Failed to update stock check');
      }

      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', 'stock-check-requests'] });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-white p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Stock Check Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Requests raised from Procurement for warehouse quantity verification.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Requests
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
              {requestsForWarehouse.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-500 text-center">No stock-check requests yet.</div>
              )}
              {requestsForWarehouse.map((req) => {
                const pending = isPendingStockCheck(req.stockCheckStatus);
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => openRequest(req)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                      activeRequestId === req.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{requestItemNames(req)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Req {req.id} · {req.planningSoNumber || 'SO —'} · {req.planningProductCode || req.planningProductName || 'Product'}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          pending
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : isCompletedStockCheck(req.stockCheckStatus)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        {req.stockCheckStatus || 'Pending'}
                      </span>
                      <span className="text-[10px] text-slate-500">By {req.requestedBy || 'Procurement'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {!activeRequest ? (
              <div className="px-6 py-10 text-sm text-slate-500 text-center">Select a request to update stock check details.</div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{requestItemNames(activeRequest)}</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Req {activeRequest.id} · Requested by {activeRequest.requestedBy || 'Procurement'} · Assigned to {activeRequest.stockCheckAssignedTo || 'Warehouse'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as 'Pending' | 'In Progress' | 'Completed')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <select
                      value={outcomeDraft}
                      onChange={(e) => setOutcomeDraft(e.target.value as StockCheckOutcome)}
                      disabled={statusDraft !== 'Completed'}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white disabled:bg-slate-100"
                    >
                      <option value="all_ok">All OK</option>
                      <option value="not_ok">Not OK</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                  {lineDrafts.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No request line items were mapped. A fallback row is created so warehouse can still send stock update to procurement.
                    </div>
                  ) : null}
                  {lineDrafts.map((line) => (
                    <div key={line.key} className="rounded-lg border border-slate-200 p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{line.itemName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{line.itemCode}</p>
                        </div>
                        <p className="text-xs text-slate-600">Requested: {line.requestedQty} {line.unit}</p>
                      </div>
                      <div
                        className={`grid grid-cols-1 ${showStockUpdateField ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-3`}
                      >
                        <label className="text-xs text-slate-600">
                          System Qty
                          <input
                            value={line.systemQty}
                            disabled
                            className="mt-1 w-full rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Physical Qty Found
                          <input
                            type="number"
                            value={line.physicalQty}
                            onChange={(e) =>
                              setLineDrafts((prev) =>
                                prev.map((x) => (x.key === line.key ? { ...x, physicalQty: parseNumber(e.target.value) } : x)),
                              )
                            }
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Consumption (window)
                          <input
                            type="number"
                            min={0}
                            value={line.consumptionQty}
                            onChange={(e) =>
                              setLineDrafts((prev) =>
                                prev.map((x) =>
                                  x.key === line.key ? { ...x, consumptionQty: parseNumber(e.target.value) } : x
                                ),
                              )
                            }
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          />
                        </label>
                        {showStockUpdateField ? (
                          <label className="text-xs text-slate-600">
                            Updated Stock Qty (Inventory)
                            <input
                              type="number"
                              value={line.updatedStockQty}
                              onChange={(e) =>
                                setLineDrafts((prev) =>
                                  prev.map((x) => (x.key === line.key ? { ...x, updatedStockQty: parseNumber(e.target.value) } : x)),
                                )
                              }
                              disabled={!(statusDraft === 'Completed' && outcomeDraft === 'not_ok')}
                              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100"
                            />
                          </label>
                        ) : null}
                      </div>
                      {(() => {
                        const gap = computeInventoryAuditGap(
                          line.systemQty,
                          line.physicalQty,
                          line.consumptionQty
                        );
                        if (Math.abs(gap) < 1e-6) return null;
                        return (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                            Gap (auto):{' '}
                            <span className="font-semibold tabular-nums">
                              {gap > 0 ? '+' : ''}
                              {gap.toLocaleString('en-IN')} {line.unit}
                            </span>
                            {gap > 0 ? ' — procurement may approve to add to PR / PO qty' : ''}
                          </p>
                        );
                      })()}
                      <label className="text-xs text-slate-600 block">
                        Remarks
                        <input
                          value={line.remarks}
                          onChange={(e) =>
                            setLineDrafts((prev) =>
                              prev.map((x) => (x.key === line.key ? { ...x, remarks: e.target.value } : x)),
                            )
                          }
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          placeholder="Optional note"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                {formError && <p className="text-xs text-red-600">{formError}</p>}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save and Notify Procurement'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockCheckRequests;
