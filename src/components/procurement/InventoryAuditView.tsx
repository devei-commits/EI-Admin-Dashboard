import React, { useEffect, useMemo, useState } from 'react';
import { buildInventoryAuditLines, type InventoryAuditLine } from '../../lib/inventoryAuditLines';
import type { ProcurementRequest } from '../../types/procurement.types';
import { formatDateWithIsoWeek } from '../../pages/procurement/procurementDataMappers';
import { InventoryAuditDetailModal } from './InventoryAuditDetailModal';
import { ProcSection, ProcSectionHeader, ProcFilterBar, ProcSearch, procChipClass, ProcTableCard, ProcThead, ProcEmpty } from './ProcSection';

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
  if (s === 'completed') return 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30';
  if (s === 'in progress') return 'bg-brand-soft text-brand border-brand-soft';
  return 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30';
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
      <ProcSection>
        <ProcSectionHeader
          title="Inventory audit"
          subtitle="Stock-check item lines from warehouse. Click a row for audit details; approve positive gaps to add qty to the procurement request and draft PO."
          stats={[
            { value: lines.length, label: `line${lines.length === 1 ? '' : 's'}` },
            { value: requestCount, label: `stock-check request${requestCount === 1 ? '' : 's'}` },
          ]}
        />
        <ProcFilterBar>
          {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)} className={procChipClass(statusFilter === status)}>
              {status}
            </button>
          ))}
          <ProcSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search audit ref, item, request…" className="ml-auto w-64 min-w-[12rem]" />
        </ProcFilterBar>

        {lines.length === 0 ? (
          <ProcEmpty>
            <p className="text-ink-2 font-medium">No stock-check item lines yet</p>
            <p className="text-sm text-ink-3 mt-1 max-w-md mx-auto">
              Use <span className="font-semibold">Stock Check</span> on a procurement request to send lines to warehouse.
              They will appear here for audit.
            </p>
          </ProcEmpty>
        ) : (
          <ProcTableCard>
              <ProcThead cols={['Audit', 'Request', 'Item', { label: 'Gap', align: 'right' }, 'Status', 'Due', 'Context']} />
              <tbody className="divide-y divide-hairline">
                {lines.map((line) => (
                  <tr
                    key={line.lineKey}
                    className="border-b border-hairline hover:bg-brand-soft cursor-pointer"
                    onClick={() => setSelectedLine(line)}
                  >
                    <td className="px-4 py-2 align-top whitespace-nowrap font-mono text-[11px] font-bold text-brand">
                      {line.auditRef}
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {onOpenRequest ? (
                        <button
                          type="button"
                          onClick={() => onOpenRequest(line.requestId)}
                          className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-3 text-ink hover:bg-surface-3"
                        >
                          {line.requestCode}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] font-bold text-ink-2">{line.requestCode}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top min-w-[10rem]">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            requestTypeClass[line.type] ?? 'bg-surface-3 text-ink-2 border-border'
                          }`}
                        >
                          {line.type}
                        </span>
                        <span className="font-semibold text-ink">{line.itemName}</span>
                      </div>
                      <p className="text-[10px] text-ink-3 font-mono">{line.itemCode}</p>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums align-top whitespace-nowrap">
                      {line.gapQty > 0 ? (
                        <span className="text-warn">+{line.gapQty.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold border bg-surface-2 text-ink-2 border-border">
                        {line.uiStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-2 align-top whitespace-nowrap">
                      {formatDateWithIsoWeek(line.stockCheckDueDate)}
                    </td>
                    <td className="px-4 py-2 text-ink-3 align-top text-[10px] max-w-[8rem]">
                      {line.planningSoNumber ? (
                        <p>
                          <span className="font-semibold text-ink-2">SO</span> {line.planningSoNumber}
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
          </ProcTableCard>
        )}
      </ProcSection>

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
