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
import {
  fetchConsumptionBetween,
  fetchWarehouseInventory,
  type WarehouseInventoryRow,
} from '../../services/warehouseInventory.service';
import { fetchStaffUsers } from '../../services/user.service';

type LineDraft = {
  key: string;
  itemCode: string;
  itemName: string;
  itemType: 'RM' | 'PM';
  rawMaterialId: number | null;
  packMaterialId: number | null;
  requestedQty: number;
  systemQty: number;
  systemQtyAtRequest: number;
  physicalQty: number;
  consumptionQty: number;
  consumptionFrom: string;
  consumptionTo: string;
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

function consumptionWindowFromRequest(req: ProcurementRequest): { from: string; to: string } {
  const notesParsed = parseStockCheckNotes(req.stockCheckNotes);
  const fromIso =
    notesParsed?.requestedAt ??
    (req.createdAt ? String(req.createdAt) : new Date().toISOString());
  const from = fromIso.slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  return { from, to };
}

async function fetchLineConsumption(
  line: Pick<LineDraft, 'itemType' | 'rawMaterialId' | 'packMaterialId'>,
  from: string,
  to: string
): Promise<number> {
  const res = await fetchConsumptionBetween({
    itemType: line.itemType,
    ...(line.rawMaterialId != null && line.rawMaterialId > 0
      ? { rawMaterialId: line.rawMaterialId }
      : {}),
    ...(line.packMaterialId != null && line.packMaterialId > 0
      ? { packMaterialId: line.packMaterialId }
      : {}),
    from,
    to,
  });
  return res.success ? parseNumber(res.data?.consumption) : 0;
}

const StockCheckRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [assignedToDraft, setAssignedToDraft] = useState('');
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
  const { data: staffUsersRes } = useQuery({
    queryKey: ['staff-users', 'stock-check-assignee'],
    queryFn: async () => fetchStaffUsers(),
  });

  const requests = procurementRes?.data ?? [];
  const inventoryRows = inventoryRes?.data?.rows ?? [];
  const staffUsers = staffUsersRes?.data ?? [];
  const assigneeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const u of staffUsers) {
      // Internal team only: ignore users linked to vendor/client profiles
      // and any non-internal user types that may still leak from API.
      if (u.vendor_client_id != null && Number(u.vendor_client_id) > 0) continue;
      const vendorClientType = String(u.vendor_client_type ?? '').trim().toLowerCase();
      if (vendorClientType === 'vendor' || vendorClientType === 'client') continue;
      const userType = String(u.usertype ?? '').trim().toLowerCase();
      if (
        userType === 'vendor' ||
        userType === 'client' ||
        userType === 'customer' ||
        userType === 'doctor' ||
        userType === 'supplier' ||
        userType === 'partner'
      ) {
        continue;
      }
      const name = String(u.display_name ?? '').trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [staffUsers]);

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

  const openRequest = async (req: ProcurementRequest) => {
    setLoadingLines(true);
    setFormError(null);
    try {
      const notesParsed = parseStockCheckNotes(req.stockCheckNotes);
      const { from: consumptionFrom, to: consumptionTo } = consumptionWindowFromRequest(req);
      const itemLines: ProcurementRequestItem[] = Array.isArray(req.items) ? req.items : [];
      let nextLines: LineDraft[] = [];
      for (const [idx, line] of itemLines.entries()) {
        const itemCode = String(line.code ?? '').trim() || `ITEM-${idx + 1}`;
        const itemName = String(line.name ?? '').trim() || itemCode;
        const itemType: 'RM' | 'PM' = line.type === 'PM' ? 'PM' : 'RM';
        const byCode = inventoryByCode.get(itemCode.toLowerCase());
        const byName = inventoryByName.get(itemName.toLowerCase());
        const inv = byCode ?? byName ?? null;
        const rawMaterialId =
          line.raw_material_id != null && Number(line.raw_material_id) > 0
            ? Number(line.raw_material_id)
            : inv?.type === 'RM' && Number(inv.sourceId) > 0
              ? Number(inv.sourceId)
              : null;
        const packMaterialId =
          line.pack_material_id != null && Number(line.pack_material_id) > 0
            ? Number(line.pack_material_id)
            : inv?.type === 'PM' && Number(inv.sourceId) > 0
              ? Number(inv.sourceId)
              : null;
        const existingLine = notesParsed?.lines?.find(
          (x) =>
            String(x.itemCode ?? '').trim().toLowerCase() === itemCode.toLowerCase() ||
            String(x.itemName ?? '').trim().toLowerCase() === itemName.toLowerCase(),
        );
        const systemQty = parseNumber(inv?.stockInHand);
        const systemQtyAtRequest =
          existingLine?.systemQtyAtRequest != null
            ? parseNumber(existingLine.systemQtyAtRequest)
            : systemQty;
        const physicalQty =
          existingLine?.physicalQty != null ? parseNumber(existingLine.physicalQty) : systemQtyAtRequest;
        const consumptionQty = await fetchLineConsumption(
          { itemType, rawMaterialId, packMaterialId },
          consumptionFrom,
          consumptionTo
        );
        const updatedStockQty =
          existingLine?.updatedStockQty != null ? parseNumber(existingLine.updatedStockQty) : physicalQty;
        const location =
          String(existingLine?.location ?? existingLine?.zone ?? inv?.zone ?? 'MAIN').trim() || 'MAIN';
        nextLines.push({
          key: `${req.id}-${itemCode}-${idx}`,
          itemCode,
          itemName,
          itemType,
          rawMaterialId,
          packMaterialId,
          requestedQty: parseNumber(line.quantity_requested),
          systemQty,
          systemQtyAtRequest,
          physicalQty,
          consumptionQty,
          consumptionFrom,
          consumptionTo,
          updatedStockQty,
          remarks: String(existingLine?.remarks ?? ''),
          location,
          warehouseInventoryId: inv?.warehouseInventoryId ?? null,
          unit: String(line.unit ?? inv?.whUnit ?? '').trim() || 'KG',
        });
      }
      if (nextLines.length === 0) {
        const fallbackCode = String(req.planningProductCode ?? '').trim() || `REQ-${req.id}`;
        const fallbackName = String(req.planningProductName ?? '').trim() || `Request ${req.id}`;
        const invByCode = inventoryByCode.get(fallbackCode.toLowerCase());
        const invByName = inventoryByName.get(fallbackName.toLowerCase());
        const inv = invByCode ?? invByName ?? null;
        const systemQty = parseNumber(inv?.stockInHand);
        const consumptionQty = 0;
        nextLines = [
          {
            key: `${req.id}-${fallbackCode}-fallback`,
            itemCode: fallbackCode,
            itemName: fallbackName,
            itemType: 'RM',
            rawMaterialId: null,
            packMaterialId: null,
            requestedQty: 0,
            systemQty,
            systemQtyAtRequest: systemQty,
            physicalQty: systemQty,
            consumptionQty,
            consumptionFrom,
            consumptionTo,
            updatedStockQty: systemQty,
            remarks: '',
            location: String(inv?.zone ?? 'MAIN').trim() || 'MAIN',
            warehouseInventoryId: inv?.warehouseInventoryId ?? null,
            unit: String(inv?.whUnit ?? 'KG'),
          },
        ];
      }

      setActiveRequestId(req.id);
      setAssignedToDraft(String(req.stockCheckAssignedTo ?? '').trim());
      setLineDrafts(nextLines);
    } finally {
      setLoadingLines(false);
    }
  };

  const activeRequest =
    activeRequestId != null ? requestsForWarehouse.find((r) => r.id === activeRequestId) ?? null : null;
  const activeRequestReadOnly = isCompletedStockCheck(activeRequest?.stockCheckStatus);

  const refreshConsumptionForDrafts = async () => {
    if (!activeRequest || lineDrafts.length === 0) return;
    const { from, to } = consumptionWindowFromRequest(activeRequest);
    const refreshed = await Promise.all(
      lineDrafts.map(async (line) => ({
        ...line,
        consumptionFrom: from,
        consumptionTo: to,
        consumptionQty: await fetchLineConsumption(line, from, to),
      }))
    );
    setLineDrafts(refreshed);
  };

  const handleSave = async () => {
    if (!activeRequest) return;
    const assignedTo = assignedToDraft.trim();
    if (!assignedTo) {
      setFormError('Assign a warehouse person before saving stock check.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { from, to } = consumptionWindowFromRequest(activeRequest);
      const linesWithConsumption = await Promise.all(
        lineDrafts.map(async (line) => ({
          ...line,
          consumptionFrom: from,
          consumptionTo: to,
          consumptionQty: await fetchLineConsumption(line, from, to),
        }))
      );

      const notesParsed = parseStockCheckNotes(activeRequest.stockCheckNotes);
      const notesPayload = {
        version: 1,
        requestedAt: notesParsed?.requestedAt ?? activeRequest.createdAt ?? new Date().toISOString(),
        requestedBy: notesParsed?.requestedBy ?? activeRequest.requestedBy ?? 'Procurement Team',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Warehouse Team',
        lines: linesWithConsumption.map((l) => {
          const gapQty = computeInventoryAuditGap(
            l.systemQtyAtRequest,
            l.physicalQty,
            l.consumptionQty
          );
          return {
            itemCode: l.itemCode,
            itemName: l.itemName,
            systemQty: l.systemQty,
            systemQtyAtRequest: l.systemQtyAtRequest,
            physicalQty: l.physicalQty,
            consumptionQty: l.consumptionQty,
            consumptionFrom: l.consumptionFrom,
            consumptionTo: l.consumptionTo,
            gapQty,
            location: l.location,
            zone: l.location,
            updatedStockQty: l.physicalQty,
            remarks: l.remarks || undefined,
          };
        }),
      };

      const upd = await updateProcurementRequest(activeRequest.id, {
        stockCheckAssignedTo: assignedTo || null,
        stockCheckStatus: 'completed',
        stockCheckNotes: JSON.stringify(notesPayload),
      });
      if (!upd.success) {
        throw new Error(typeof upd.error === 'string' ? upd.error : 'Failed to update stock check');
      }

      setLineDrafts(linesWithConsumption);

      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      await queryClient.invalidateQueries({
        queryKey: ['procurement-requests', 'warehouse-stock-checks'],
      });
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
          <p className="text-sm text-slate-500 mt-1">
            Verify physical qty for procurement requests. Gaps are notified to Procurement only — inventory updates
            after Procurement approves the gap.
          </p>
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
                    onClick={() => void openRequest(req)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                      activeRequestId === req.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{requestItemNames(req)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Req {req.id} · {req.planningSoNumber || 'SO —'} ·{' '}
                      {req.planningProductCode || req.planningProductName || 'Product'}
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
              <div className="px-6 py-10 text-sm text-slate-500 text-center">
                Select a request to update stock check details.
              </div>
            ) : loadingLines ? (
              <div className="px-6 py-10 text-sm text-slate-500 text-center">Loading stock check lines…</div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{requestItemNames(activeRequest)}</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Req {activeRequest.id} · Requested by {activeRequest.requestedBy || 'Procurement'} · Assigned
                      to {assignedToDraft || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      list="stock-check-assignee-suggestions"
                      value={assignedToDraft}
                      onChange={(e) => setAssignedToDraft(e.target.value)}
                      disabled={activeRequestReadOnly}
                      placeholder="Assign checker person"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white min-w-[180px] disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <datalist id="stock-check-assignee-suggestions">
                      {assigneeSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      Status auto: Completed
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshConsumptionForDrafts()}
                      disabled={activeRequestReadOnly}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Refresh consumption
                    </button>
                  </div>
                </div>
                {activeRequestReadOnly ? (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                    Stock check is completed. Request is now read-only.
                  </p>
                ) : null}

                <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                  {lineDrafts.map((line) => (
                    <div key={line.key} className="rounded-lg border border-slate-200 p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{line.itemName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{line.itemCode}</p>
                        </div>
                        <p className="text-xs text-slate-600">
                          Requested: {line.requestedQty} {line.unit}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="text-xs text-slate-600">
                          System Qty (at request)
                          <input
                            value={line.systemQtyAtRequest}
                            disabled
                            className="mt-1 w-full rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Current system Qty
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
                                prev.map((x) =>
                                  x.key === line.key
                                    ? { ...x, physicalQty: parseNumber(e.target.value) }
                                    : x
                                ),
                              )
                            }
                            disabled={activeRequestReadOnly}
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Consumption ({line.consumptionFrom} → {line.consumptionTo})
                          <input
                            type="number"
                            min={0}
                            value={line.consumptionQty}
                            disabled
                            className="mt-1 w-full rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs"
                          />
                        </label>
                      </div>
                      {(() => {
                        const gap = computeInventoryAuditGap(
                          line.systemQtyAtRequest,
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
                            {' — '}
                            sent to Procurement for approval (inventory not updated here).
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
                          disabled={activeRequestReadOnly}
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-500"
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
                    disabled={saving || activeRequestReadOnly}
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
