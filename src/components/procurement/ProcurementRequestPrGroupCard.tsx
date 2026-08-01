import React from 'react';
import type { ProcurementRequestItemLine } from '../../lib/procurementRequestItemLines';
import type { DraftPO, ProcurementRequest } from '../../types/procurement.types';
import { formatDateWithIsoWeek } from '../../pages/procurement/procurementDataMappers';
import { formatQtyWithPrimaryUnit } from '../../lib/rmUnitConversion';

export type ProcurementRequestPrGroupCardProps = {
  request: ProcurementRequest;
  lines: ProcurementRequestItemLine[];
  daysLeft: number;
  expectedDisplay: string;
  statusBadgeClass: string;
  priorityBadgeClass: string;
  linkedDraft?: DraftPO;
  isPlanningQuotation: boolean;
  stockCheckPending: boolean;
  onView: () => void;
  onAddQuotation?: () => void;
  onStockCheck: () => void;
  onPriority: () => void;
  onReleaseToDraftPo: () => void;
  onViewQuotes: () => void;
  onReleasePo?: () => void;
};

function lineTypeLabel(type: ProcurementRequestItemLine['type']): string {
  if (type === 'PM') return 'PM';
  if (type === 'FG') return 'FG';
  return 'RM';
}

function lineTypeBadgeClass(type: ProcurementRequestItemLine['type']): string {
  if (type === 'PM') return 'bg-brand-soft text-brand border-brand-soft';
  if (type === 'FG') return 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30';
  return 'bg-brand-soft text-brand border-brand-soft';
}

export function ProcurementRequestPrGroupCard({
  request,
  lines,
  daysLeft,
  expectedDisplay,
  statusBadgeClass,
  priorityBadgeClass,
  linkedDraft,
  isPlanningQuotation,
  stockCheckPending,
  onView,
  onAddQuotation,
  onStockCheck,
  onPriority,
  onReleaseToDraftPo,
  onViewQuotes,
  onReleasePo,
}: ProcurementRequestPrGroupCardProps): React.ReactElement {
  const totalEst = lines.reduce((sum, l) => sum + (Number(l.estValue) || 0), 0);
  const vendor = String(request.preferredVendor ?? '').trim();
  const stockCheckLabel = String(request.stockCheckStatus ?? '').trim() || (stockCheckPending ? 'Pending' : '');

  return (
    <div className="bg-surface rounded-xl border border-border shadow-[var(--e1)] hover:shadow-md transition-shadow overflow-hidden">
      <div className="px-5 py-3 bg-brand-soft border-b border-border space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-md bg-brand text-white text-xs font-mono font-bold">
              {request.code}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-brand-soft text-brand border border-brand-soft">
              {lines.length} item{lines.length === 1 ? '' : 's'} · 1 PO
            </span>
            {request.batchId != null && (
              <span
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30"
                title="Batch that raised this PR"
              >
                Batch #{request.batchId}
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                request.type === 'RM'
                  ? 'bg-brand-soft text-brand border border-brand'
                  : 'bg-brand-soft text-brand border border-brand'
              }`}
            >
              {request.type}
            </span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${priorityBadgeClass}`}>
              {request.priority}
            </span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusBadgeClass}`}>
              {request.status}
            </span>
            {stockCheckLabel ? (
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                  stockCheckPending
                    ? 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30'
                    : stockCheckLabel.toLowerCase() === 'completed'
                      ? 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30'
                      : 'bg-brand-soft text-brand border-brand-soft'
                }`}
              >
                Stock Check: {stockCheckLabel}
              </span>
            ) : null}
            {linkedDraft ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30">
                Draft {linkedDraft.dpoNumber ?? linkedDraft.id}
              </span>
            ) : null}
            {isPlanningQuotation ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/40">
                Needs quotation
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-3">
            <span>Expected {expectedDisplay}</span>
            <span
              className={`font-bold ${
                daysLeft <= 3 ? 'text-err' : daysLeft <= 7 ? 'text-warn' : 'text-ok'
              }`}
            >
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </span>
          </div>
        </div>
        {(request.planningSoNumber != null && String(request.planningSoNumber).trim()) ||
        (request.planningProductName != null && String(request.planningProductName).trim()) ? (
          <div className="text-xs text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            {request.planningSoNumber != null && String(request.planningSoNumber).trim() ? (
              <span>
                <span className="font-semibold text-ink-2">SO</span> {request.planningSoNumber}
              </span>
            ) : null}
            {request.planningCustomerName != null && String(request.planningCustomerName).trim() ? (
              <span className="truncate max-w-[200px]" title={request.planningCustomerName}>
                {request.planningCustomerName}
              </span>
            ) : null}
            {request.planningProductName != null && String(request.planningProductName).trim() ? (
              <span className="truncate max-w-[280px]" title={request.planningProductName}>
                <span className="font-semibold text-ink-2">Product</span> {request.planningProductName}
                {request.planningProductCode != null && String(request.planningProductCode).trim()
                  ? ` (${request.planningProductCode})`
                  : ''}
              </span>
            ) : null}
            {request.planningProductMrp != null && Number(request.planningProductMrp) > 0 ? (
              <span className="px-2 py-0.5 rounded bg-warn-soft border border-[color:var(--st-amber-fg)]/30 text-warn font-semibold text-[10px]">
                MRP ₹{Number(request.planningProductMrp).toLocaleString('en-IN')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-ink-3 uppercase tracking-wide mb-1">Pref. Vendor</p>
            <p
              className={`font-semibold truncate ${vendor ? 'text-brand' : 'text-ink-4 italic'}`}
              title={vendor || undefined}
            >
              {vendor || 'Not chosen'}
            </p>
          </div>
          <div>
            <p className="text-ink-3 uppercase tracking-wide mb-1">Total est. value</p>
            <p className="font-semibold text-warn">₹{totalEst.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-ink-3 uppercase tracking-wide mb-1">Lines</p>
            <p className="font-semibold text-ink">{lines.length}</p>
          </div>
          <div>
            <p className="text-ink-3 uppercase tracking-wide mb-1">Draft PO</p>
            <p className="font-semibold text-ink">{linkedDraft ? linkedDraft.dpoNumber ?? linkedDraft.id : '—'}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-wide text-ink-3 border-b border-hairline bg-surface-2">
                <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">Qty</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">MOQ</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">₹/unit</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">Est. ₹</th>
                <th scope="col" className="px-3 py-2 font-semibold">Expected</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const unitLabel = line.unit?.trim() || (line.type === 'PM' ? 'PCS' : 'KG');
                return (
                  <tr key={line.lineKey} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${lineTypeBadgeClass(line.type)}`}
                      >
                        {lineTypeLabel(line.type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-ink">{line.itemName}</div>
                      <div className="text-[10px] text-ink-3 font-mono">{line.itemCode || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                      {line.reqQty.toLocaleString('en-IN')} {unitLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {line.moq ? formatQtyWithPrimaryUnit(line.moq, unitLabel, line.type === 'PM' ? 'PM' : 'RM') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-ok tabular-nums whitespace-nowrap">
                      ₹{line.plannedPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right text-warn tabular-nums whitespace-nowrap">
                      ₹{line.estValue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-ink-2 whitespace-nowrap">
                      {formatDateWithIsoWeek(line.expectedDate || line.dueDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {request.notes != null && String(request.notes).trim() ? (
          <div className="p-3 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg">
            <p className="text-xs text-ink-3">
              <span className="font-semibold text-ink-2">Notes:</span> {String(request.notes)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-3 bg-surface-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onView}
            className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand-soft transition-all"
          >
            View
          </button>
          {isPlanningQuotation && onAddQuotation ? (
            <button
              type="button"
              onClick={onAddQuotation}
              className="px-3 py-1.5 rounded-lg border border-[color:var(--st-amber-fg)]/40 bg-warn-soft text-warn text-xs font-semibold hover:bg-warn-soft transition-all"
            >
              Add quotation
            </button>
          ) : null}
          <button
            type="button"
            onClick={onStockCheck}
            className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand-soft transition-all"
          >
            Stock Check
          </button>
          <button
            type="button"
            onClick={onPriority}
            className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand-soft transition-all"
          >
            Priority
          </button>
          <button
            type="button"
            onClick={onReleaseToDraftPo}
            className="px-3 py-1.5 rounded-lg border border-[color:var(--st-amber-fg)]/40 text-warn text-xs font-semibold hover:bg-warn-soft transition-all"
          >
            Release to Draft PO ({lines.length} line{lines.length === 1 ? '' : 's'})
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onViewQuotes}
            className="px-3 py-1.5 rounded-lg border border-[color:var(--st-green-fg)]/30 text-ok text-xs font-semibold hover:bg-ok-soft transition-all"
          >
            View Quotes
          </button>
          {request.status === 'PO Draft' && onReleasePo ? (
            <button
              type="button"
              disabled={stockCheckPending}
              onClick={onReleasePo}
              className="px-4 py-1.5 rounded-lg bg-warn text-ink text-xs font-bold hover:bg-warn shadow-md transition-all disabled:opacity-50"
            >
              Release PO
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
