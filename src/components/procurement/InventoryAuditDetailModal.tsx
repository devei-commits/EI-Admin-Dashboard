import React, { useState } from 'react';
import { X, Prohibit, Package, ArrowsClockwise, Check } from '@phosphor-icons/react';
import type { InventoryAuditLine } from '../../lib/inventoryAuditLines';
import { formatDateEnInSafe } from '../../pages/procurement/procurementDataMappers';

export type InventoryAuditDetailModalProps = {
  line: InventoryAuditLine;
  onClose: () => void;
  onApproveGap?: (line: InventoryAuditLine) => Promise<void>;
  onReAudit?: (line: InventoryAuditLine, comment: string) => Promise<void>;
  onTerminate?: (line: InventoryAuditLine, reason: string) => Promise<void>;
  onSubmitPhysicalCount?: (line: InventoryAuditLine, physicalQty: number, remarks: string, completedBy: string) => Promise<void>;
  approving?: boolean;
  reAuditing?: boolean;
  terminating?: boolean;
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
  if (s.includes('gap approved')) return 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30';
  if (s.includes('awaiting')) return 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30';
  if (s === 'audited') return 'bg-brand-soft text-brand border-brand-soft';
  if (s.includes('progress')) return 'bg-brand-soft text-brand border-brand-soft';
  return 'bg-surface-3 text-ink-2 border-border';
}

export function InventoryAuditDetailModal({
  line,
  onClose,
  onApproveGap,
  onReAudit,
  onTerminate,
  onSubmitPhysicalCount,
  approving = false,
  reAuditing = false,
  terminating = false,
}: InventoryAuditDetailModalProps): React.ReactElement {
  const [reAuditComment, setReAuditComment] = useState('');
  const [terminateReason, setTerminateReason] = useState('');
  const [showReAudit, setShowReAudit] = useState(false);
  const [showTerminate, setShowTerminate] = useState(false);
  const [showSubmitCount, setShowSubmitCount] = useState(false);
  const [physicalQtyInput, setPhysicalQtyInput] = useState('');
  const [countRemarks, setCountRemarks] = useState('');
  const [countCompletedBy, setCountCompletedBy] = useState('');
  const [submittingCount, setSubmittingCount] = useState(false);

  const consumedAtAudit =
    line.physicalQty != null && line.systemQty != null
      ? line.physicalQty - line.systemQty
      : null;

  const canApproveGap =
    line.gapQty > 1e-6 &&
    !line.gapApproved &&
    line.stockCheckStatus.trim().toLowerCase() === 'completed' &&
    onApproveGap != null;

  const canReAudit =
    line.stockCheckStatus.trim().toLowerCase() === 'completed' &&
    !line.gapApproved &&
    onReAudit != null;

  const canTerminate = onTerminate != null && line.stockCheckStatus.trim().toLowerCase() !== 'cancelled';

  const canSubmitCount =
    onSubmitPhysicalCount != null &&
    line.stockCheckStatus.trim().toLowerCase() !== 'completed' &&
    line.stockCheckStatus.trim().toLowerCase() !== 'cancelled';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inventory-audit-detail-title"
      >
        <div className="px-5 py-4 border-b border-border bg-surface-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              Inventory audit
            </p>
            <h2 id="inventory-audit-detail-title" className="text-lg font-bold text-ink mt-0.5">
              {line.auditRef}
            </h2>
            <p className="text-sm text-ink-3 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-ink-3">{line.itemCode}</span>
              <span className="text-ink-4">·</span>
              <span className="font-medium">{line.itemName}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border bg-surface text-ink-2">
                {line.location}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 rounded-lg border border-border text-ink-3 text-sm hover:bg-surface-3"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Item</p>
              <p className="text-ink font-medium">
                {line.itemCode} · {line.itemName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Location</p>
              <p className="text-ink font-medium">{line.location}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Requested by</p>
              <p className="text-ink">
                {line.requestedBy}
                {line.requestedAt ? (
                  <span className="text-ink-3"> on {formatDateEnInSafe(line.requestedAt)}</span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Status</p>
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${statusBadgeClass(line.uiStatus)}`}
              >
                {line.uiStatus}
              </span>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Audited by</p>
              <p className="text-ink">
                {line.auditedBy || line.stockCheckAssignedTo}
                {line.auditedAt ? (
                  <span className="text-ink-3"> on {formatDateEnInSafe(line.auditedAt)}</span>
                ) : (
                  <span className="text-ink-4"> — pending warehouse completion</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-3">
              Inventory numbers
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-3">Qty @ request (system)</p>
                <p className="text-lg font-bold text-ink tabular-nums">
                  {line.systemQty != null ? line.systemQty.toLocaleString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Qty @ audit (physical)</p>
                <p className="text-lg font-bold text-ink tabular-nums">
                  {line.physicalQty != null ? line.physicalQty.toLocaleString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Consumed during audit</p>
                <p className="text-lg font-bold text-ink tabular-nums">
                  {consumedAtAudit != null ? fmtGap(consumedAtAudit, line.unit) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-3">Gap (system − physical − consumption)</p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    line.gapQty > 0 ? 'text-warn' : line.gapQty < 0 ? 'text-brand' : 'text-ink'
                  }`}
                >
                  {fmtGap(line.gapQty, line.unit)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-ink-3 mt-2">
              PR line qty: {fmtQty(line.requestedQty, line.unit)} · Consumed during audit = physical − system at request (default formula).
              {line.consumptionQty != null && line.consumptionQty !== 0 ? (
                <> Window consumption: {line.consumptionQty.toLocaleString('en-IN')} {line.unit}.</>
              ) : null}
            </p>
          </div>

          {showReAudit ? (
            <div className="rounded-lg border border-brand-soft bg-brand-soft p-3 space-y-2">
              <p className="text-[10px] font-semibold text-brand uppercase tracking-wide">Re-audit — explain why</p>
              <textarea
                value={reAuditComment}
                onChange={(e) => setReAuditComment(e.target.value)}
                rows={2}
                className="w-full border border-brand-soft rounded-lg px-2 py-1.5 text-xs"
                placeholder="Required comment for warehouse…"
                aria-label="Required comment for warehouse"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowReAudit(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">Cancel</button>
                <button
                  type="button"
                  disabled={!reAuditComment.trim() || reAuditing}
                  onClick={() => void onReAudit?.(line, reAuditComment.trim())}
                  className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-lg disabled:opacity-60"
                >
                  {reAuditing ? 'Sending…' : 'Send back to Warehouse'}
                </button>
              </div>
            </div>
          ) : null}

          {showTerminate ? (
            <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft p-3 space-y-2">
              <p className="text-[10px] font-semibold text-err uppercase tracking-wide">Terminate audit</p>
              <textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                rows={2}
                className="w-full border border-[color:var(--st-red-fg)]/30 rounded-lg px-2 py-1.5 text-xs"
                placeholder="Optional reason…"
                aria-label="Termination reason"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowTerminate(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">Cancel</button>
                <button
                  type="button"
                  disabled={terminating}
                  onClick={() => void onTerminate?.(line, terminateReason.trim())}
                  className="px-3 py-1.5 text-xs font-bold bg-err text-white rounded-lg disabled:opacity-60"
                >
                  {terminating ? 'Terminating…' : 'Terminate without action'}
                </button>
              </div>
            </div>
          ) : null}

          {showSubmitCount ? (
            <div className="rounded-lg border border-brand-soft bg-brand-soft p-3 space-y-2">
              <p className="text-[10px] font-semibold text-brand uppercase tracking-wide">Submit Physical Count</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-ink-3 block mb-1">Physical Qty ({line.unit})</label>
                  <input
                    type="number"
                    value={physicalQtyInput}
                    onChange={(e) => setPhysicalQtyInput(e.target.value)}
                    className="w-full border border-brand-soft rounded-lg px-2 py-1.5 text-xs font-mono"
                    placeholder="0"
                    min="0"
                    aria-label={`Physical Qty (${line.unit})`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-3 block mb-1">Counted by</label>
                  <input
                    type="text"
                    value={countCompletedBy}
                    onChange={(e) => setCountCompletedBy(e.target.value)}
                    className="w-full border border-brand-soft rounded-lg px-2 py-1.5 text-xs"
                    placeholder="Name"
                    aria-label="Counted by"
                  />
                </div>
              </div>
              <textarea
                value={countRemarks}
                onChange={(e) => setCountRemarks(e.target.value)}
                rows={2}
                className="w-full border border-brand-soft rounded-lg px-2 py-1.5 text-xs"
                placeholder="Remarks (optional)…"
                aria-label="Remarks (optional)"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSubmitCount(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">Cancel</button>
                <button
                  type="button"
                  disabled={!physicalQtyInput.trim() || submittingCount}
                  onClick={async () => {
                    const qty = parseFloat(physicalQtyInput);
                    if (!Number.isFinite(qty) || qty < 0) return;
                    setSubmittingCount(true);
                    try {
                      await onSubmitPhysicalCount?.(line, qty, countRemarks.trim(), countCompletedBy.trim());
                      setShowSubmitCount(false);
                    } finally {
                      setSubmittingCount(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-lg disabled:opacity-60"
                >
                  {submittingCount ? 'Submitting…' : 'Submit Count'}
                </button>
              </div>
            </div>
          ) : null}

          {line.remarks ? (
            <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft p-3">
              <p className="text-[10px] font-semibold text-warn uppercase tracking-wide mb-1">WH remarks</p>
              <p className="text-sm text-warn leading-relaxed">{line.remarks}</p>
            </div>
          ) : null}

          {line.gapApproved ? (
            <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft p-3 text-xs text-ok">
              Gap <strong>+{line.gapQty.toLocaleString('en-IN')}</strong> approved
              {line.gapApprovedBy ? ` by ${line.gapApprovedBy}` : ''}
              {line.gapApprovedAt ? ` on ${formatDateEnInSafe(line.gapApprovedAt)}` : ''}. Request and draft PO
              quantities were increased.
            </div>
          ) : null}

          {(line.planningSoNumber || line.planningProductName) && (
            <div className="text-xs text-ink-3">
              {line.planningSoNumber ? (
                <p>
                  <span className="font-semibold text-ink-2">SO</span> {line.planningSoNumber}
                </p>
              ) : null}
              {line.planningProductName ? <p>{line.planningProductName}</p> : null}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-surface flex flex-wrap items-center justify-end gap-2">
          {canTerminate && !showTerminate ? (
            <button
              type="button"
              onClick={() => { setShowTerminate(true); setShowReAudit(false); setShowSubmitCount(false); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[color:var(--st-red-fg)]/30 text-err text-sm font-semibold hover:bg-err-soft mr-auto"
            >
              <Prohibit className="w-4 h-4" /> Terminate
            </button>
          ) : null}
          {canSubmitCount && !showSubmitCount ? (
            <button
              type="button"
              onClick={() => { setShowSubmitCount(true); setShowReAudit(false); setShowTerminate(false); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-soft text-brand text-sm font-semibold hover:bg-brand-soft"
            >
              <Package className="w-4 h-4" /> Enter Physical Count
            </button>
          ) : null}
          {canReAudit && !showReAudit ? (
            <button
              type="button"
              onClick={() => { setShowReAudit(true); setShowTerminate(false); setShowSubmitCount(false); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-soft text-brand text-sm font-semibold hover:bg-brand-soft"
            >
              <ArrowsClockwise className="w-4 h-4" /> Re-Audit
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3"
          >
            Close
          </button>
          {canApproveGap ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => void onApproveGap(line)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60"
            >
              {approving ? 'Updating…' : <><Check className="w-4 h-4" /> {`Mark UPDATED — adjust SIH (+${line.gapQty.toLocaleString('en-IN')} ${line.unit})`}</>}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
