import React, { useEffect, useMemo, useState } from 'react';
import { buildInventoryAuditLines, type InventoryAuditLine } from '../../lib/inventoryAuditLines';
import type { ProcurementRequest } from '../../types/procurement.types';
import { formatDateWithIsoWeek } from '../../pages/procurement/procurementDataMappers';
import { InventoryAuditDetailModal } from './InventoryAuditDetailModal';

type StatusFilter = 'All' | 'Pending' | 'In Progress' | 'Completed';

function normalizeStockCheckStatus(status: string): string {
  return String(status ?? '').trim().toLowerCase();
}

function matchesStatusFilter(stockCheckStatus: string, filter: StatusFilter): boolean {
  if (filter === 'All') return true;
  const s = normalizeStockCheckStatus(stockCheckStatus);
  if (filter === 'Pending') return s === 'pending' || s === 'requested' || s === 'assigned';
  if (filter === 'In Progress') return s === 'in progress';
  if (filter === 'Completed') return s === 'completed';
  return true;
}

function stockCheckStatusClass(status: string): string {
  const s = normalizeStockCheckStatus(status);
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'in progress') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export type InventoryAuditViewProps = {
  requests: ProcurementRequest[];
  requestTypeClass: Record<string, string>;
  onOpenRequest?: (requestId: string) => void;
  onApproveGap?: (line: InventoryAuditLine) => Promise<boolean>;
};

export function InventoryAuditView({
  requests,
  requestTypeClass,
  onOpenRequest,
  onApproveGap,
}: InventoryAuditViewProps): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<InventoryAuditLine | null>(null);
  const [approving, setApproving] = useState(false);

  const lines = useMemo(() => {
    const all = buildInventoryAuditLines(requests);
    const q = searchQuery.trim().toLowerCase();
    return all.filter((line) => {
      if (!matchesStatusFilter(line.stockCheckStatus, statusFilter)) return false;
      if (!q) return true;
      return (
        line.auditRef.toLowerCase().includes(q) ||
        line.requestCode.toLowerCase().includes(q) ||
        line.itemName.toLowerCase().includes(q) ||
        line.itemCode.toLowerCase().includes(q) ||
        line.uiStatus.toLowerCase().includes(q) ||
        line.stockCheckAssignedTo.toLowerCase().includes(q) ||
        line.planningSoNumber.toLowerCase().includes(q) ||
        line.planningProductName.toLowerCase().includes(q)
      );
    });
  }, [requests, statusFilter, searchQuery]);

  const requestCount = useMemo(() => new Set(lines.map((l) => l.requestId)).size, [lines]);

  useEffect(() => {
    if (!selectedLine) return;
    const fresh = lines.find((l) => l.lineKey === selectedLine.lineKey);
    if (fresh && fresh !== selectedLine) {
      setSelectedLine(fresh);
    }
  }, [lines, selectedLine]);

  const handleApproveGap = async (line: InventoryAuditLine): Promise<void> => {
    if (!onApproveGap) return;
    setApproving(true);
    try {
      const ok = await onApproveGap(line);
      if (ok) setSelectedLine(null);
    } finally {
      setApproving(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Inventory audit</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Stock-check item lines from warehouse. Click a row for audit details; approve positive gaps to add qty
                to the procurement request and draft PO.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 rounded border text-xs ${
                    statusFilter === status
                      ? 'bg-teal-100 text-teal-900 border-teal-300'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit ref, item, request…"
                className="w-64 min-w-[12rem] px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 tabular-nums">
            {lines.length} line{lines.length === 1 ? '' : 's'} · {requestCount} stock-check request
            {requestCount === 1 ? '' : 's'}
          </p>
        </div>

        {lines.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-700 font-medium">No stock-check item lines yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Use <span className="font-semibold">Stock Check</span> on a procurement request to send lines to warehouse.
              They will appear here for audit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 font-semibold">Audit</th>
                  <th className="px-4 py-2 font-semibold">Request</th>
                  <th className="px-4 py-2 font-semibold">Item</th>
                  <th className="px-4 py-2 font-semibold text-right">Gap</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Context</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.lineKey}
                    className="border-b border-slate-100 hover:bg-teal-50/50 cursor-pointer"
                    onClick={() => setSelectedLine(line)}
                  >
                    <td className="px-4 py-2 align-top whitespace-nowrap font-mono text-[11px] font-bold text-teal-800">
                      {line.auditRef}
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {onOpenRequest ? (
                        <button
                          type="button"
                          onClick={() => onOpenRequest(line.requestId)}
                          className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 hover:bg-slate-200"
                        >
                          {line.requestCode}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] font-bold text-slate-700">{line.requestCode}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top min-w-[10rem]">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            requestTypeClass[line.type] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {line.type}
                        </span>
                        <span className="font-semibold text-slate-900">{line.itemName}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">{line.itemCode}</p>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums align-top whitespace-nowrap">
                      {line.gapQty > 0 ? (
                        <span className="text-amber-700">+{line.gapQty.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold border bg-slate-50 text-slate-700 border-slate-200">
                        {line.uiStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700 align-top whitespace-nowrap">
                      {formatDateWithIsoWeek(line.stockCheckDueDate)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 align-top text-[10px] max-w-[8rem]">
                      {line.planningSoNumber ? (
                        <p>
                          <span className="font-semibold text-slate-700">SO</span> {line.planningSoNumber}
                        </p>
                      ) : null}
                      {line.planningProductName ? (
                        <p className="truncate" title={line.planningProductName}>
                          {line.planningProductName}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLine ? (
        <InventoryAuditDetailModal
          line={selectedLine}
          onClose={() => setSelectedLine(null)}
          onApproveGap={onApproveGap ? handleApproveGap : undefined}
          approving={approving}
        />
      ) : null}
    </>
  );
}
