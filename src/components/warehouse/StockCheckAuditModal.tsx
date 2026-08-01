import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import StockCheckEvidenceCapture, {
  type EvidencePhoto,
} from './StockCheckEvidenceCapture';
import type { ProcurementRequest as ApiProcurementRequest } from '../../services/procurement.service';
import { updateProcurementRequest } from '../../services/procurement.service';
import type { ProcurementRequest } from '../../types/procurement.types';
import { computeInventoryAuditGap } from '../../lib/inventoryAuditGap';
import {
  findStockCheckNoteForItem,
  parseStockCheckNotes,
  type ParsedStockCheckNoteLine,
} from '../../lib/stockCheckNotes';
import {
  fetchConsumptionBetween,
  fetchStockByLocation,
  fetchWarehouseLocationHistory,
  type WarehouseInventoryRow,
} from '../../services/warehouseInventory.service';
import {
  buildAuditProgressSteps,
  buildAuditResultSummary,
  buildRackSystemRows,
  formatItemCategory,
  formatQtyWithUnit,
  formatRackVariance,
  mergeRackAuditDrafts,
  resolveWarehouseDisplayName,
  type WarehouseRackAuditRow,
} from '../../lib/warehouseStockCheckAuditDisplay';
import {
  formatAssigneeShortName,
  type WarehouseStockCheckTableRow,
} from '../../lib/warehouseStockCheckTableDisplay';
import {
  canUserPerformStockCheck,
  isStockCheckAssigneeOpen,
  stockCheckLockedMessage,
} from '../../lib/stockCheckAssigneeAccess';

function parseNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function consumptionWindowFromRequest(req: ApiProcurementRequest): { from: string; to: string } {
  const notesParsed = parseStockCheckNotes(req.stockCheckNotes);
  const fromIso =
    notesParsed?.requestedAt ??
    (req.createdAt ? String(req.createdAt) : new Date().toISOString());
  const from = fromIso.slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  return { from, to };
}

export type StockCheckAuditModalProps = {
  row: WarehouseStockCheckTableRow;
  apiRequest: ApiProcurementRequest;
  mappedRequest: ProcurementRequest;
  inventoryRow: WarehouseInventoryRow | null;
  currentActorName: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  onAssigneeClaimed?: (assignee: string) => void;
};

const StockCheckAuditModal: React.FC<StockCheckAuditModalProps> = ({
  row,
  apiRequest,
  mappedRequest,
  inventoryRow,
  currentActorName,
  canEdit,
  onClose,
  onSaved,
  onAssigneeClaimed,
}) => {
  const queryClient = useQueryClient();
  const readOnly = row.isCompleted || !canEdit;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState(row.assignedTo);
  const [rackDrafts, setRackDrafts] = useState<WarehouseRackAuditRow[]>([]);
  const [systemQtyAtRequest, setSystemQtyAtRequest] = useState(0);
  const [consumptionQty, setConsumptionQty] = useState(0);
  const [consumptionFrom, setConsumptionFrom] = useState('');
  const [consumptionTo, setConsumptionTo] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [savedEvidencePhotoCount, setSavedEvidencePhotoCount] = useState(0);
  const [newRackLabel, setNewRackLabel] = useState('');
  const [claimingAssignee, setClaimingAssignee] = useState(false);

  const unit = useMemo(
    () => String(inventoryRow?.whUnit ?? 'kg').trim() || 'kg',
    [inventoryRow?.whUnit],
  );
  const warehouseName = resolveWarehouseDisplayName(row.warehouse);
  const category = formatItemCategory(row.itemType === 'FG' ? 'FG' : row.itemType, inventoryRow?.subtitle);
  const linkedPr = mappedRequest.code || `PR-REQ-${String(apiRequest.id).padStart(3, '0')}`;
  const sourceDept = row.sourceDept;

  const notesParsed = useMemo(
    () => parseStockCheckNotes(apiRequest.stockCheckNotes),
    [apiRequest.stockCheckNotes],
  );
  const existingLine = useMemo(
    () => findStockCheckNoteForItem(apiRequest.stockCheckNotes, row.itemCode, row.itemName),
    [apiRequest.stockCheckNotes, row.itemCode, row.itemName],
  );

  const progressSteps = useMemo(
    () =>
      buildAuditProgressSteps({
        requestedAt: notesParsed?.requestedAt ?? apiRequest.createdAt,
        assignee: assignedTo || row.assignedTo,
        initiatedAt: notesParsed?.auditInitiatedAt ?? (assignedTo ? apiRequest.updatedAt : null),
        completedAt: notesParsed?.updatedAt ?? row.auditedAt,
        isCompleted: readOnly,
      }),
    [
      notesParsed?.requestedAt,
      notesParsed?.auditInitiatedAt,
      notesParsed?.updatedAt,
      apiRequest.createdAt,
      apiRequest.updatedAt,
      assignedTo,
      row.assignedTo,
      row.auditedAt,
      readOnly,
    ],
  );

  const systemTotal = useMemo(
    () => rackDrafts.reduce((sum, r) => sum + r.systemQty, 0),
    [rackDrafts],
  );
  const auditedTotal = useMemo(
    () => rackDrafts.reduce((sum, r) => sum + r.auditedQty, 0),
    [rackDrafts],
  );

  const loadAuditContext = useCallback(async () => {
    setLoading(true);
    setFormError(null);
    try {
      const whId = inventoryRow?.warehouseInventoryId ?? null;
      const systemQty = parseNumber(inventoryRow?.stockInHand);
      const systemAtRequest =
        existingLine?.systemQtyAtRequest != null
          ? parseNumber(existingLine.systemQtyAtRequest)
          : systemQty;
      setSystemQtyAtRequest(systemAtRequest);

      const { from, to } = consumptionWindowFromRequest(apiRequest);
      setConsumptionFrom(from);
      setConsumptionTo(to);

      let consumption = parseNumber(existingLine?.consumptionQty);
      if (inventoryRow?.type === 'RM' || inventoryRow?.type === 'PM') {
        const itemType = inventoryRow.type;
        const rawMaterialId =
          itemType === 'RM' && Number(inventoryRow.sourceId) > 0 ? Number(inventoryRow.sourceId) : undefined;
        const packMaterialId =
          itemType === 'PM' && Number(inventoryRow.sourceId) > 0 ? Number(inventoryRow.sourceId) : undefined;
        const consRes = await fetchConsumptionBetween({
          itemType,
          ...(rawMaterialId != null ? { rawMaterialId } : {}),
          ...(packMaterialId != null ? { packMaterialId } : {}),
          from,
          to,
        });
        if (consRes.success) {
          consumption = parseNumber(consRes.data?.consumption);
        }
      }
      setConsumptionQty(consumption);

      let systemRows = buildRackSystemRows(null, row.warehouse, unit, inventoryRow?.batchNumber, []);
      if (whId != null && whId > 0) {
        const [stockRes, historyRes] = await Promise.all([
          fetchStockByLocation(whId),
          fetchWarehouseLocationHistory(whId),
        ]);
        const history = historyRes.success ? (historyRes.data?.history ?? []) : [];
        if (stockRes.success && stockRes.data) {
          systemRows = buildRackSystemRows(
            stockRes.data,
            row.warehouse,
            unit,
            inventoryRow?.batchNumber,
            history,
          );
        }
      }

      setRackDrafts(mergeRackAuditDrafts(systemRows, existingLine));
      setSavedEvidencePhotoCount(notesParsed?.evidencePhotoCount ?? 0);
      setEvidencePhotos([]);
      setAssignedTo(row.assignedTo);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [
    apiRequest,
    existingLine,
    inventoryRow,
    notesParsed?.evidencePhotoCount,
    row.assignedTo,
    row.warehouse,
    unit,
  ]);

  useEffect(() => {
    void loadAuditContext();
  }, [loadAuditContext]);

  useEffect(() => {
    if (loading || claimingAssignee || readOnly || row.isCompleted || !canEdit || !currentActorName.trim()) {
      return;
    }
    if (!isStockCheckAssigneeOpen(assignedTo)) return;

    let cancelled = false;
    const claim = async () => {
      setClaimingAssignee(true);
      try {
        const notesParsedNow = parseStockCheckNotes(apiRequest.stockCheckNotes);
        const notesPayload = {
          version: 1,
          requestedAt: notesParsedNow?.requestedAt ?? apiRequest.createdAt ?? new Date().toISOString(),
          requestedBy: notesParsedNow?.requestedBy ?? apiRequest.requestedBy ?? 'Procurement Team',
          auditInitiatedAt: notesParsedNow?.auditInitiatedAt ?? new Date().toISOString(),
          auditInitiatedBy: notesParsedNow?.auditInitiatedBy ?? currentActorName,
          updatedAt: notesParsedNow?.updatedAt,
          updatedBy: notesParsedNow?.updatedBy,
          evidencePhotoCount: notesParsedNow?.evidencePhotoCount,
          lines: notesParsedNow?.lines,
        };
        const upd = await updateProcurementRequest(apiRequest.id, {
          stockCheckAssignedTo: currentActorName,
          stockCheckStatus: 'In Progress',
          stockCheckNotes: JSON.stringify(notesPayload),
        });
        if (!upd.success) {
          throw new Error(typeof upd.error === 'string' ? upd.error : 'Failed to claim stock check');
        }
        if (cancelled) return;
        setAssignedTo(currentActorName);
        onAssigneeClaimed?.(currentActorName);
        await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      } catch (e) {
        if (!cancelled) {
          setFormError(e instanceof Error ? e.message : 'Failed to claim stock check');
        }
      } finally {
        if (!cancelled) setClaimingAssignee(false);
      }
    };

    void claim();
    return () => {
      cancelled = true;
    };
  }, [
    apiRequest.createdAt,
    apiRequest.id,
    apiRequest.requestedBy,
    apiRequest.stockCheckNotes,
    assignedTo,
    canEdit,
    currentActorName,
    onAssigneeClaimed,
    queryClient,
    readOnly,
    row.isCompleted,
    loading,
    claimingAssignee,
  ]);

  const updateRackDraft = (key: string, patch: Partial<WarehouseRackAuditRow>) => {
    setRackDrafts((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addNewRackRow = () => {
    const label = newRackLabel.trim();
    if (!label) return;
    setRackDrafts((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        rackLabel: label,
        rackId: null,
        locationCode: '',
        rackCode: '',
        packBreakdown: '—',
        systemQty: 0,
        unit,
        grnBatch: '—',
        lastUpdated: '',
        lastUpdatedDisplay: '—',
        isStale: false,
        auditedQty: 0,
        notes: '',
        isNew: true,
      },
    ]);
    setNewRackLabel('');
  };

  const removeRackDraft = (key: string) => {
    setRackDrafts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.key !== key);
    });
  };

  const canRemoveRackRow = (rackCount: number): boolean => !readOnly && rackCount > 1;

  const resolveRequestItems = (): { code: string; name: string }[] => {
    const items = Array.isArray(apiRequest.items) ? apiRequest.items : [];
    if (items.length > 0) {
      return items.map((line, idx) => ({
        code: String(line.code ?? '').trim() || `ITEM-${idx + 1}`,
        name: String(line.name ?? '').trim() || `Item ${idx + 1}`,
      }));
    }
    return [
      {
        code: String(apiRequest.planningProductCode ?? '').trim() || `REQ-${apiRequest.id}`,
        name: String(apiRequest.planningProductName ?? '').trim() || `Request ${apiRequest.id}`,
      },
    ];
  };

  const buildNoteLineForItem = (): ParsedStockCheckNoteLine => {
    const physicalQty = auditedTotal;
    const gapQty = computeInventoryAuditGap(systemQtyAtRequest, physicalQty, consumptionQty);
    return {
      itemCode: row.itemCode,
      itemName: row.itemName,
      systemQty: parseNumber(inventoryRow?.stockInHand),
      systemQtyAtRequest,
      physicalQty,
      consumptionQty,
      consumptionFrom,
      consumptionTo,
      gapQty,
      location: rackDrafts[0]?.rackLabel ?? row.warehouse,
      zone: row.warehouse,
      updatedStockQty: physicalQty,
      remarks: rackDrafts.map((r) => r.notes).filter(Boolean).join(' · ') || undefined,
      rackAudits: rackDrafts.map((r) => ({
        rackLabel: r.rackLabel,
        rackId: r.rackId,
        systemQty: r.systemQty,
        physicalQty: r.auditedQty,
        notes: r.notes || undefined,
        grnBatch: r.grnBatch !== '—' ? r.grnBatch : undefined,
        isNew: r.isNew,
      })),
    };
  };

  const allRequestItemsAudited = (
    mergedLines: ParsedStockCheckNoteLine[],
    requestItems: { code: string; name: string }[],
  ): boolean =>
    requestItems.every((item) =>
      mergedLines.some(
        (ln) =>
          (String(ln.itemCode ?? '').trim().toLowerCase() === item.code.toLowerCase() ||
            String(ln.itemName ?? '').trim().toLowerCase() === item.name.toLowerCase()) &&
          ln.physicalQty != null,
      ),
    );

  const handleCompleteAudit = async () => {
    const assignee = assignedTo.trim() || currentActorName.trim();
    if (!assignee) {
      setFormError('Sign in to complete the stock check.');
      return;
    }
    if (!canUserPerformStockCheck(assignedTo, currentActorName) && !isStockCheckAssigneeOpen(assignedTo)) {
      setFormError(stockCheckLockedMessage(assignedTo));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const requestItems = resolveRequestItems();
      const existingLines = Array.isArray(notesParsed?.lines) ? [...notesParsed.lines] : [];
      const auditedLine = buildNoteLineForItem();
      const withoutCurrent = existingLines.filter(
        (ln) =>
          String(ln.itemCode ?? '').trim().toLowerCase() !== row.itemCode.toLowerCase() &&
          String(ln.itemName ?? '').trim().toLowerCase() !== row.itemName.toLowerCase(),
      );
      const mergedLines = [...withoutCurrent, auditedLine];
      const allDone = allRequestItemsAudited(mergedLines, requestItems);

      const notesPayload = {
        version: 1,
        requestedAt: notesParsed?.requestedAt ?? apiRequest.createdAt ?? new Date().toISOString(),
        requestedBy: notesParsed?.requestedBy ?? apiRequest.requestedBy ?? 'Procurement Team',
        auditInitiatedAt:
          notesParsed?.auditInitiatedAt ??
          (assignee ? new Date().toISOString() : undefined),
        auditInitiatedBy: notesParsed?.auditInitiatedBy ?? assignee,
        updatedAt: new Date().toISOString(),
        updatedBy: currentActorName.trim() || assignee,
        evidencePhotoCount: evidencePhotos.length > 0 ? evidencePhotos.length : savedEvidencePhotoCount,
        lines: mergedLines,
      };

      const upd = await updateProcurementRequest(apiRequest.id, {
        stockCheckAssignedTo: assignee,
        stockCheckStatus: allDone ? 'Completed' : 'In Progress',
        stockCheckNotes: JSON.stringify(notesPayload),
      });
      if (!upd.success) {
        throw new Error(typeof upd.error === 'string' ? upd.error : 'Failed to complete audit');
      }

      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      onSaved();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save audit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div
        className="relative w-full max-w-5xl max-h-[92vh] bg-surface rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-check-audit-title"
      >
        <div className="shrink-0 border-b border-border px-5 py-4 bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="stock-check-audit-title" className="text-lg font-semibold text-ink">
                🔍 Audit — {row.itemName} {row.itemCode}
              </h2>
              <p className="text-xs text-ink-2 mt-1">
                {row.auditRef} · {row.warehouse} · {warehouseName} · Requested by {sourceDept} · Linked{' '}
                {linkedPr}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => void handleCompleteAudit()}
                  disabled={saving || loading || claimingAssignee}
                  className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink-2 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Complete Audit'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="text-ink-4 hover:text-ink-2 text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {loading || claimingAssignee ? (
          <div className="px-6 py-12 text-sm text-ink-3 text-center">
            {claimingAssignee ? 'Claiming stock check…' : 'Loading audit details…'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {readOnly && !row.isCompleted ? (
              <p className="text-xs text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2">
                {stockCheckLockedMessage(row.assignedTo || assignedTo)}
              </p>
            ) : null}
            {readOnly && row.isCompleted ? (
              <p className="text-xs text-ok bg-ok-soft border border-ok rounded-lg px-3 py-2">
                Audit completed — read-only view.
              </p>
            ) : null}

            <section className="rounded-lg border border-border bg-surface-2/60 p-4">
              <h3 className="text-xs font-bold tracking-wide text-ink-3 mb-3">📦 Item information</h3>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <dt className="text-ink-3">Item Code</dt>
                  <dd className="font-mono font-semibold text-ink mt-0.5">{row.itemCode}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Item Name</dt>
                  <dd className="font-semibold text-ink mt-0.5">{row.itemName}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Category</dt>
                  <dd className="text-ink mt-0.5">{category}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">UoM</dt>
                  <dd className="text-ink mt-0.5">{unit}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="text-xs font-bold tracking-wide text-ink-3 mb-2">
                📍 Current racking (system) — with pack breakdown + inventory batch
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wide text-ink-3 bg-surface-2 border-b border-border">
                      <th scope="col" className="px-3 py-2 font-semibold">Rack Location</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Pack Count × Pack Qty</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Total Qty</th>
                      <th scope="col" className="px-3 py-2 font-semibold">GRN Batch</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rackDrafts.filter((r) => !r.isNew).map((rack) => (
                      <tr key={`sys-${rack.key}`} className="border-b border-hairline">
                        <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{rack.rackLabel}</td>
                        <td className="px-3 py-2 text-ink-2">{rack.packBreakdown}</td>
                        <td className="px-3 py-2 text-ink tabular-nums">{formatQtyWithUnit(rack.systemQty, unit)}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-ink-2">{rack.grnBatch}</td>
                        <td className="px-3 py-2 text-ink-2 whitespace-nowrap">
                          {rack.lastUpdatedDisplay}
                          {rack.isStale ? (
                            <span className="ml-1 text-warn" title="Stale stock position">
                              ⚠ stale
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-ink-3 mt-2">
                Total system SIH: {formatQtyWithUnit(systemTotal, unit)} across{' '}
                {rackDrafts.filter((r) => !r.isNew).length} rack position
                {rackDrafts.filter((r) => !r.isNew).length === 1 ? '' : 's'} ·{' '}
                {new Set(rackDrafts.filter((r) => r.grnBatch && r.grnBatch !== '—').map((r) => r.grnBatch)).size} GRN
                batch{rackDrafts.filter((r) => r.grnBatch && r.grnBatch !== '—').length === 1 ? '' : 'es'}.
              </p>
            </section>

            <section>
              <h3 className="text-xs font-bold tracking-wide text-ink-3 mb-3">🔄 Audit progress</h3>
              <ol className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                {progressSteps.map((step) => (
                  <li key={step.key} className="flex-1 min-w-0">
                    <p
                      className={`text-[10px] font-bold tracking-wide ${
                        step.status === 'done'
                          ? 'text-ok'
                          : step.status === 'current'
                            ? 'text-brand'
                            : 'text-ink-4'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-ink-2 mt-0.5">{step.detail}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h3 className="text-xs font-bold tracking-wide text-ink-3 mb-2">
                ✏ Audited qty + racking update
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wide text-ink-3 bg-surface-2 border-b border-border">
                      <th scope="col" className="px-3 py-2 font-semibold">Rack Location</th>
                      <th scope="col" className="px-3 py-2 font-semibold">System Qty</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Audited Qty (physical count)</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Variance</th>
                      <th scope="col" className="px-3 py-2 font-semibold min-w-[10rem]">Notes</th>
                      {!readOnly ? <th scope="col" className="px-3 py-2 font-semibold w-16" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rackDrafts.map((rack) => (
                      <tr key={`audit-${rack.key}`} className="border-b border-hairline align-top">
                        <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">
                          {rack.isNew && !readOnly ? (
                            <input
                              value={rack.rackLabel}
                              onChange={(e) => updateRackDraft(rack.key, { rackLabel: e.target.value })}
                              aria-label="Rack location label"
                              className="w-full min-w-[10rem] rounded border border-border px-2 py-1 text-xs font-medium"
                            />
                          ) : (
                            rack.rackLabel
                          )}
                        </td>
                        <td className="px-3 py-2 text-ink-2 tabular-nums">
                          {formatQtyWithUnit(rack.systemQty, unit)}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={rack.auditedQty}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateRackDraft(rack.key, { auditedQty: parseNumber(e.target.value) })
                            }
                            aria-label={`Audited qty for ${rack.rackLabel}`}
                            className="w-24 rounded border border-border px-2 py-1 text-xs tabular-nums disabled:bg-surface-3"
                          />
                          <span className="ml-1 text-ink-3">{unit}</span>
                        </td>
                        <td
                          className={`px-3 py-2 tabular-nums font-semibold ${
                            rack.auditedQty - rack.systemQty > 0
                              ? 'text-warn'
                              : rack.auditedQty - rack.systemQty < 0
                                ? 'text-err'
                                : 'text-ink-2'
                          }`}
                        >
                          {formatRackVariance(rack.systemQty, rack.auditedQty)}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={rack.notes}
                            disabled={readOnly}
                            onChange={(e) => updateRackDraft(rack.key, { notes: e.target.value })}
                            placeholder="—"
                            aria-label={`Notes for ${rack.rackLabel}`}
                            className="w-full min-w-[8rem] rounded border border-border px-2 py-1 text-xs disabled:bg-surface-3"
                          />
                        </td>
                        {!readOnly ? (
                          <td className="px-3 py-2 align-middle">
                            {canRemoveRackRow(rackDrafts.length) ? (
                              <button
                                type="button"
                                onClick={() => removeRackDraft(rack.key)}
                                className="text-[11px] font-semibold text-err hover:text-err hover:underline whitespace-nowrap"
                                aria-label={`Remove rack row ${rack.rackLabel}`}
                              >
                                Remove
                              </button>
                            ) : (
                              <span className="text-ink-4 text-[11px]">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!readOnly ? (
                      <tr className="border-b border-hairline bg-surface-2/50">
                        <td className="px-3 py-2" colSpan={6}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-ink-2 font-medium">{row.warehouse} · + add new rack ▾</span>
                            <input
                              value={newRackLabel}
                              onChange={(e) => setNewRackLabel(e.target.value)}
                              placeholder="Rack label e.g. MW · Rack-A12-D2"
                              aria-label="New rack label"
                              className="flex-1 min-w-[12rem] rounded border border-border px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={addNewRackRow}
                              disabled={!newRackLabel.trim()}
                              className="px-2 py-1 rounded border border-border text-xs font-semibold text-ink-2 hover:bg-surface disabled:opacity-50"
                            >
                              Add row
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-medium text-ink mt-2">
                Audit result: {buildAuditResultSummary(systemTotal, auditedTotal, unit)}
              </p>
            </section>

            <section>
              <h3 className="text-xs font-bold tracking-wide text-ink-3 mb-2">📷 Evidence photos (post-audit)</h3>
              <StockCheckEvidenceCapture
                readOnly={readOnly}
                savedPhotoCount={savedEvidencePhotoCount}
                photos={evidencePhotos}
                onPhotosChange={setEvidencePhotos}
              />
            </section>

            {!readOnly ? (
              <p className="text-xs text-ink-2">
                Assigned to{' '}
                <span className="font-semibold text-ink">
                  {formatAssigneeShortName(assignedTo || currentActorName)}
                </span>
              </p>
            ) : null}

            {formError ? (
              <p className="text-xs text-err" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
        )}

        <div className="shrink-0 border-t border-border px-5 py-3 flex justify-end gap-2 bg-surface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-2"
          >
            Close
          </button>
          {!readOnly && !loading && !claimingAssignee ? (
            <button
              type="button"
              onClick={() => void handleCompleteAudit()}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink-2 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Complete Audit'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StockCheckAuditModal;
