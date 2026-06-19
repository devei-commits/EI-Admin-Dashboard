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
  if (type === 'PM') return 'bg-violet-100 text-violet-800 border-violet-200';
  if (type === 'FG') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-cyan-100 text-cyan-800 border-cyan-200';
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="px-5 py-3 bg-linear-to-r from-indigo-50 via-blue-50 to-indigo-50 border-b border-slate-200 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-md bg-slate-800 text-white text-xs font-mono font-bold">
              {request.code}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
              {lines.length} item{lines.length === 1 ? '' : 's'} · 1 PO
            </span>
            {request.batchId != null && (
              <span
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                title="Batch that raised this PR"
              >
                Batch #{request.batchId}
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                request.type === 'RM'
                  ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                  : 'bg-violet-100 text-violet-800 border border-violet-300'
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
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : stockCheckLabel.toLowerCase() === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}
              >
                Stock Check: {stockCheckLabel}
              </span>
            ) : null}
            {linkedDraft ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
                Draft {linkedDraft.dpoNumber ?? linkedDraft.id}
              </span>
            ) : null}
            {isPlanningQuotation ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Needs quotation
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>Expected {expectedDisplay}</span>
            <span
              className={`font-bold ${
                daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </span>
          </div>
        </div>
        {(request.planningSoNumber != null && String(request.planningSoNumber).trim()) ||
        (request.planningProductName != null && String(request.planningProductName).trim()) ? (
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            {request.planningSoNumber != null && String(request.planningSoNumber).trim() ? (
              <span>
                <span className="font-semibold text-slate-700">SO</span> {request.planningSoNumber}
              </span>
            ) : null}
            {request.planningCustomerName != null && String(request.planningCustomerName).trim() ? (
              <span className="truncate max-w-[200px]" title={request.planningCustomerName}>
                {request.planningCustomerName}
              </span>
            ) : null}
            {request.planningProductName != null && String(request.planningProductName).trim() ? (
              <span className="truncate max-w-[280px]" title={request.planningProductName}>
                <span className="font-semibold text-slate-700">Product</span> {request.planningProductName}
                {request.planningProductCode != null && String(request.planningProductCode).trim()
                  ? ` (${request.planningProductCode})`
                  : ''}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1">Pref. Vendor</p>
            <p
              className={`font-semibold truncate ${vendor ? 'text-indigo-600' : 'text-slate-400 italic'}`}
              title={vendor || undefined}
            >
              {vendor || 'Not chosen'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1">Total est. value</p>
            <p className="font-semibold text-amber-600">₹{totalEst.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1">Lines</p>
            <p className="font-semibold text-slate-900">{lines.length}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1">Draft PO</p>
            <p className="font-semibold text-slate-900">{linkedDraft ? linkedDraft.dpoNumber ?? linkedDraft.id : '—'}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold text-right">Qty</th>
                <th className="px-3 py-2 font-semibold text-right">MOQ</th>
                <th className="px-3 py-2 font-semibold text-right">₹/unit</th>
                <th className="px-3 py-2 font-semibold text-right">Est. ₹</th>
                <th className="px-3 py-2 font-semibold">Expected</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const unitLabel = line.unit?.trim() || (line.type === 'PM' ? 'PCS' : 'KG');
                return (
                  <tr key={line.lineKey} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${lineTypeBadgeClass(line.type)}`}
                      >
                        {lineTypeLabel(line.type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-900">{line.itemName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{line.itemCode || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                      {line.reqQty.toLocaleString('en-IN')} {unitLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {line.moq ? formatQtyWithPrimaryUnit(line.moq, unitLabel, line.type === 'PM' ? 'PM' : 'RM') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                      ₹{line.plannedPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-700 tabular-nums whitespace-nowrap">
                      ₹{line.estValue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {formatDateWithIsoWeek(line.expectedDate || line.dueDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {request.notes != null && String(request.notes).trim() ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Notes:</span> {String(request.notes)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onView}
            className="px-3 py-1.5 rounded-lg border border-blue-400 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-all"
          >
            View
          </button>
          {isPlanningQuotation && onAddQuotation ? (
            <button
              type="button"
              onClick={onAddQuotation}
              className="px-3 py-1.5 rounded-lg border border-amber-500 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-all"
            >
              Add quotation
            </button>
          ) : null}
          <button
            type="button"
            onClick={onStockCheck}
            className="px-3 py-1.5 rounded-lg border border-cyan-400 text-cyan-700 text-xs font-semibold hover:bg-cyan-50 transition-all"
          >
            Stock Check
          </button>
          <button
            type="button"
            onClick={onPriority}
            className="px-3 py-1.5 rounded-lg border border-violet-400 text-violet-700 text-xs font-semibold hover:bg-violet-50 transition-all"
          >
            Priority
          </button>
          <button
            type="button"
            onClick={onReleaseToDraftPo}
            className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 text-xs font-semibold hover:bg-amber-50 transition-all"
          >
            Release to Draft PO ({lines.length} line{lines.length === 1 ? '' : 's'})
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onViewQuotes}
            className="px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-all"
          >
            View Quotes
          </button>
          {request.status === 'PO Draft' && onReleasePo ? (
            <button
              type="button"
              disabled={stockCheckPending}
              onClick={onReleasePo}
              className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-900 text-xs font-bold hover:bg-amber-500 shadow-md transition-all disabled:opacity-50"
            >
              Release PO
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
