import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { fetchProcurementRequests, updateProcurementRequest } from '../../services/procurement.service';
import { fetchWarehouseInventory } from '../../services/warehouseInventory.service';
import { fetchStaffUsers } from '../../services/user.service';
import {
  coerceProcurementRequestRows,
  mapBackendPrToRequest,
} from '../procurement/procurementDataMappers';
import StockCheckAuditModal from '../../components/warehouse/StockCheckAuditModal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ClipboardList } from 'lucide-react';
import {
  buildWarehouseStockCheckTableRows,
  formatAssigneeShortName,
  warehouseStockCheckSlaClass,
  type WarehouseStockCheckTableRow,
} from '../../lib/warehouseStockCheckTableDisplay';
import {
  canUserPerformStockCheck,
  resolveStockCheckActorName,
} from '../../lib/stockCheckAssigneeAccess';

const StockCheckRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeAuditRow, setActiveAuditRow] = useState<WarehouseStockCheckTableRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignSavingId, setAssignSavingId] = useState<string | null>(null);

  const {
    data: procurementRows,
    isLoading: procurementLoading,
    isError: procurementError,
    error: procurementErrorDetail,
    refetch: refetchProcurementRequests,
  } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await fetchProcurementRequests();
      if (!res.success) {
        throw new Error(typeof res.error === 'string' ? res.error : 'Failed to load procurement requests');
      }
      return coerceProcurementRequestRows(res.data);
    },
  });

  const requests = procurementRows ?? [];

  const { data: inventoryRes } = useQuery({
    queryKey: ['warehouse-inventory', 'stock-check-requests'],
    queryFn: async () => fetchWarehouseInventory(),
  });
  const { data: staffUsersRes } = useQuery({
    queryKey: ['staff-users', 'stock-check-assignee'],
    queryFn: async () => fetchStaffUsers(),
  });

  const inventoryRows = inventoryRes?.data?.rows ?? [];
  const staffUsers = staffUsersRes?.data ?? [];
  const assigneeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const u of staffUsers) {
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

  const currentActorName = useMemo(
    () =>
      resolveStockCheckActorName({
        authName: user?.name,
        authEmail: user?.email,
        staffUsers,
      }),
    [staffUsers, user?.email, user?.name],
  );

  const mappedRequests = useMemo(() => requests.map((r) => mapBackendPrToRequest(r)), [requests]);

  const inventoryZoneByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of inventoryRows) {
      const key = String(row.code ?? '').trim().toLowerCase();
      if (key) m.set(key, String(row.zone ?? '').trim());
    }
    return m;
  }, [inventoryRows]);

  const tableRows = useMemo(
    () => buildWarehouseStockCheckTableRows(mappedRequests, inventoryZoneByCode),
    [mappedRequests, inventoryZoneByCode],
  );

  const requestsForWarehouse = useMemo(
    () =>
      requests.filter((r) => {
        const s = String(r.stockCheckStatus ?? '').trim();
        return s.length > 0;
      }),
    [requests],
  );

  const inventoryByCode = useMemo(() => {
    const m = new Map<string, typeof inventoryRows[number]>();
    for (const row of inventoryRows) {
      const key = String(row.code ?? '').trim().toLowerCase();
      if (key) m.set(key, row);
    }
    return m;
  }, [inventoryRows]);

  const activeApiRequest = useMemo(() => {
    if (!activeAuditRow) return null;
    return requestsForWarehouse.find((r) => r.id === activeAuditRow.requestId) ?? null;
  }, [activeAuditRow, requestsForWarehouse]);

  const activeMappedRequest = useMemo(() => {
    if (!activeAuditRow) return null;
    return mappedRequests.find((r) => r.id === activeAuditRow.requestId) ?? null;
  }, [activeAuditRow, mappedRequests]);

  const activeInventoryRow = useMemo(() => {
    if (!activeAuditRow) return null;
    return inventoryByCode.get(activeAuditRow.itemCode.toLowerCase()) ?? null;
  }, [activeAuditRow, inventoryByCode]);

  const openTableRow = (row: WarehouseStockCheckTableRow) => {
    setFormError(null);
    setActiveAuditRow(row);
  };

  const activeAuditCanEdit = useMemo(() => {
    if (!activeAuditRow) return false;
    if (activeAuditRow.isCompleted) return false;
    return canUserPerformStockCheck(activeAuditRow.assignedTo, currentActorName);
  }, [activeAuditRow, currentActorName]);

  const closeAuditModal = () => {
    setActiveAuditRow(null);
    setFormError(null);
  };

  const handleQuickAssign = async (row: WarehouseStockCheckTableRow, nextAssignee: string) => {
    if (row.isCompleted) return;
    const assignedTo = nextAssignee.trim();
    setAssignSavingId(row.requestId);
    try {
      const upd = await updateProcurementRequest(row.requestId, {
        stockCheckAssignedTo: assignedTo || null,
      });
      if (!upd.success) {
        throw new Error(typeof upd.error === 'string' ? upd.error : 'Failed to assign checker');
      }
      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      if (activeAuditRow?.requestId === row.requestId) {
        setActiveAuditRow((prev) => (prev ? { ...prev, assignedTo, assignDisplay: formatAssigneeShortName(assignedTo) } : prev));
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to assign checker');
    } finally {
      setAssignSavingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Stock Check Requests</h1>
          <p className="text-sm text-ink-3 mt-1">
            Verify physical qty for procurement requests. Gaps are notified to Procurement only — inventory updates
            after Procurement approves the gap.
          </p>
        </div>

        {formError ? (
          <p className="text-xs text-err bg-err-soft border border-err/40 rounded-lg px-3 py-2" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-3 tabular-nums">
              {procurementLoading
                ? 'Loading stock-check requests…'
                : `${tableRows.length} stock-check line${tableRows.length === 1 ? '' : 's'}`}
            </p>
            <button
              type="button"
              onClick={() => void refetchProcurementRequests()}
              disabled={procurementLoading}
              className="text-[11px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {procurementError ? (
            <ErrorState
              title="Could not load stock-check requests."
              message={
                procurementErrorDetail instanceof Error
                  ? procurementErrorDetail.message
                  : 'Please try again.'
              }
              onRetry={() => void refetchProcurementRequests()}
            />
          ) : procurementLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={6} />
            </div>
          ) : tableRows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title="No stock-check requests yet."
              description="Raise one from Procurement → Requests → Stock Check."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] tracking-wide text-ink-3 border-b border-border bg-surface-2">
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Req Date</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Audit #</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">WH</th>
                    <th scope="col" className="px-4 py-2 font-semibold min-w-[10rem]">Item</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Source Dept</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Priority</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Assign</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Target Date</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">SLA</th>
                    <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.lineKey} className="border-b border-hairline hover:bg-surface-2/80">
                      <td className="px-4 py-3 align-top whitespace-nowrap text-ink-2 tabular-nums">
                        {row.reqDateDisplay}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-[11px] font-semibold text-ink-2">
                        {row.auditRef}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-ink-2">
                        {row.warehouse}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[9rem]">
                        <p className="font-semibold text-ink leading-snug">{row.itemName}</p>
                        <p className="text-[11px] text-ink-3 font-mono mt-0.5">{row.itemCode}</p>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-ink-2">{row.sourceDept}</td>
                      <td className={`px-4 py-3 align-top whitespace-nowrap text-[11px] tracking-wide ${row.priorityClass}`}>
                        {row.priorityDisplay}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {row.isCompleted ? (
                          <span className="text-ink-2">{row.assignDisplay}</span>
                        ) : (
                          <label className="inline-flex items-center gap-0.5 text-ink-2">
                            <span className="sr-only">Assign checker for {row.itemName}</span>
                            <select
                              value={row.assignedTo}
                              disabled={assignSavingId === row.requestId}
                              onChange={(e) => void handleQuickAssign(row, e.target.value)}
                              className="appearance-none bg-transparent border-0 p-0 text-xs font-medium text-ink-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-border rounded disabled:opacity-60 max-w-[6.5rem] truncate"
                            >
                              <option value="">Open</option>
                              {assigneeSuggestions.map((name) => (
                                <option key={name} value={name}>
                                  {formatAssigneeShortName(name)}
                                </option>
                              ))}
                              {row.assignedTo &&
                              !assigneeSuggestions.some(
                                (name) => name.toLowerCase() === row.assignedTo.toLowerCase(),
                              ) ? (
                                <option value={row.assignedTo}>{row.assignDisplay}</option>
                              ) : null}
                            </select>
                            <span className="text-ink-3 text-[10px] leading-none" aria-hidden="true">
                              ▾
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-ink-2 tabular-nums">
                        {row.targetDateDisplay}
                      </td>
                      <td className={`px-4 py-3 align-top whitespace-nowrap text-[11px] ${warehouseStockCheckSlaClass(row.slaTone)}`}>
                        <span className="mr-1" aria-hidden="true">
                          {row.slaIcon}
                        </span>
                        {row.slaLabel}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTableRow(row)}
                          className="text-[11px] font-semibold text-ink-2 hover:text-ink hover:underline"
                        >
                          {row.isCompleted
                            ? row.actionLabel
                            : canUserPerformStockCheck(row.assignedTo, currentActorName)
                              ? row.actionLabel
                              : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {activeAuditRow && activeApiRequest && activeMappedRequest ? (
        <StockCheckAuditModal
          row={activeAuditRow}
          apiRequest={activeApiRequest}
          mappedRequest={activeMappedRequest}
          inventoryRow={activeInventoryRow}
          currentActorName={currentActorName}
          canEdit={activeAuditCanEdit}
          onClose={closeAuditModal}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', 'stock-check-requests'] });
          }}
          onAssigneeClaimed={(assignee) => {
            setActiveAuditRow((prev) =>
              prev
                ? {
                    ...prev,
                    assignedTo: assignee,
                    assignDisplay: formatAssigneeShortName(assignee),
                  }
                : prev,
            );
          }}
        />
      ) : null}
    </div>
  );
};

export default StockCheckRequests;
