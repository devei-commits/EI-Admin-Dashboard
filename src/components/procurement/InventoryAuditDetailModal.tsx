import React from 'react';
import type { InventoryAuditLine } from '../../lib/inventoryAuditLines';
import { formatDateEnInSafe } from '../../pages/procurement/procurementDataMappers';

export type InventoryAuditDetailModalProps = {
  line: InventoryAuditLine;
  onClose: () => void;
  onApproveGap?: (line: InventoryAuditLine) => Promise<void>;
  approving?: boolean;
};

function fmtQty(n: number | null, unit: string): string {
  if (n == null) return '—';
  return `${n.toLocaleString('en-IN')} ${unit}`.trim();
}

function fmtGap(gap: number, unit: string): string {
  if (Math.abs(gap) < 1e-6) return '0';
  const sign = gap > 0 ? '+' : '';
  return `${sign}${gap.toLocaleString('en-IN')} ${unit}`.trim();
}

function statusBadgeClass(uiStatus: string): string {
  const s = uiStatus.toLowerCase();
  if (s.includes('gap approved')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s.includes('awaiting')) return 'bg-amber-50 text-amber-900 border-amber-200';
  if (s === 'audited') return 'bg-teal-50 text-teal-800 border-teal-200';
  if (s.includes('progress')) return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function InventoryAuditDetailModal({
  line,
  onClose,
  onApproveGap,
  approving = false,
}: InventoryAuditDetailModalProps): React.ReactElement {
  const canApproveGap =
    line.gapQty > 1e-6 &&
    !line.gapApproved &&
    line.stockCheckStatus.trim().toLowerCase() === 'completed' &&
    onApproveGap != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inventory-audit-detail-title"
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Inventory audit
            </p>
            <h2 id="inventory-audit-detail-title" className="text-lg font-bold text-slate-900 mt-0.5">
              {line.auditRef}
            </h2>
            <p className="text-sm text-slate-700 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{line.itemCode}</span>
              <span className="text-slate-400">·</span>
              <span className="font-medium">{line.itemName}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 bg-slate-100 text-slate-700">
                {line.location}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Item</p>
              <p className="text-slate-900 font-medium">
                {line.itemCode} · {line.itemName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</p>
              <p className="text-slate-900 font-medium">{line.location}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Requested by</p>
              <p className="text-slate-800">
                {line.requestedBy}
                {line.requestedAt ? (
                  <span className="text-slate-500"> on {formatDateEnInSafe(line.requestedAt)}</span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</p>
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${statusBadgeClass(line.uiStatus)}`}
              >
                {line.uiStatus}
              </span>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Audited by</p>
              <p className="text-slate-800">
                {line.auditedBy || line.stockCheckAssignedTo}
                {line.auditedAt ? (
                  <span className="text-slate-500"> on {formatDateEnInSafe(line.auditedAt)}</span>
                ) : (
                  <span className="text-slate-400"> — pending warehouse completion</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Inventory numbers
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Qty @ request (system)</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {line.systemQty != null ? line.systemQty.toLocaleString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Qty @ audit (physical)</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {line.physicalQty != null ? line.physicalQty.toLocaleString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Consumption (window)</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {line.consumptionQty != null ? line.consumptionQty.toLocaleString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Gap (auto)</p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    line.gapQty > 0 ? 'text-amber-700' : line.gapQty < 0 ? 'text-sky-700' : 'text-slate-900'
                  }`}
                >
                  {fmtGap(line.gapQty, line.unit)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              PR line qty: {fmtQty(line.requestedQty, line.unit)} · Gap = system − physical − consumption
            </p>
          </div>

          {line.remarks ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[10px] font-semibold text-amber-900 uppercase tracking-wide mb-1">WH remarks</p>
              <p className="text-sm text-amber-950 leading-relaxed">{line.remarks}</p>
            </div>
          ) : null}

          {line.gapApproved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
              Gap <strong>+{line.gapQty.toLocaleString('en-IN')}</strong> approved
              {line.gapApprovedBy ? ` by ${line.gapApprovedBy}` : ''}
              {line.gapApprovedAt ? ` on ${formatDateEnInSafe(line.gapApprovedAt)}` : ''}. Request and draft PO
              quantities were increased.
            </div>
          ) : null}

          {(line.planningSoNumber || line.planningProductName) && (
            <div className="text-xs text-slate-600">
              {line.planningSoNumber ? (
                <p>
                  <span className="font-semibold text-slate-700">SO</span> {line.planningSoNumber}
                </p>
              ) : null}
              {line.planningProductName ? <p>{line.planningProductName}</p> : null}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white"
          >
            Close
          </button>
          {canApproveGap ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => void onApproveGap(line)}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 disabled:opacity-60"
            >
              {approving ? 'Approving…' : `Approve gap (+${line.gapQty.toLocaleString('en-IN')} ${line.unit})`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
