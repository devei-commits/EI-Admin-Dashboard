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
    <div className="flex-1 overflow-auto bg-white p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Stock Check Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Verify physical qty for procurement requests. Gaps are notified to Procurement only — inventory updates
            after Procurement approves the gap.
          </p>
        </div>

        {formError ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 tabular-nums">
              {procurementLoading
                ? 'Loading stock-check requests…'
                : `${tableRows.length} stock-check line${tableRows.length === 1 ? '' : 's'}`}
            </p>
            <button
              type="button"
              onClick={() => void refetchProcurementRequests()}
              disabled={procurementLoading}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {procurementError ? (
            <div className="px-6 py-10 text-sm text-center">
              <p className="text-red-700 font-medium">Could not load stock-check requests.</p>
              <p className="text-slate-500 mt-1">
                {procurementErrorDetail instanceof Error
                  ? procurementErrorDetail.message
                  : 'Please try again.'}
              </p>
            </div>
          ) : procurementLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500 text-center">Loading stock-check requests…</div>
          ) : tableRows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500 text-center">
              No stock-check requests yet. Raise one from Procurement → Requests → Stock Check.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Req Date</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Audit #</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">WH</th>
                    <th className="px-4 py-2 font-semibold min-w-[10rem]">Item</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Source Dept</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Priority</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Assign</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Target Date</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">SLA</th>
                    <th className="px-4 py-2 font-semibold whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.lineKey} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-800 tabular-nums">
                        {row.reqDateDisplay}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800">
                        {row.auditRef}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-slate-800">
                        {row.warehouse}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[9rem]">
                        <p className="font-semibold text-slate-900 leading-snug">{row.itemName}</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">{row.itemCode}</p>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{row.sourceDept}</td>
                      <td className={`px-4 py-3 align-top whitespace-nowrap text-[11px] tracking-wide ${row.priorityClass}`}>
                        {row.priorityDisplay}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {row.isCompleted ? (
                          <span className="text-slate-700">{row.assignDisplay}</span>
                        ) : (
                          <label className="inline-flex items-center gap-0.5 text-slate-800">
                            <span className="sr-only">Assign checker for {row.itemName}</span>
                            <select
                              value={row.assignedTo}
                              disabled={assignSavingId === row.requestId}
                              onChange={(e) => void handleQuickAssign(row, e.target.value)}
                              className="appearance-none bg-transparent border-0 p-0 text-xs font-medium text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 rounded disabled:opacity-60 max-w-[6.5rem] truncate"
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
                            <span className="text-slate-500 text-[10px] leading-none" aria-hidden="true">
                              ▾
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-800 tabular-nums">
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
                          className="text-[11px] font-semibold text-slate-800 hover:text-slate-950 hover:underline"
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
