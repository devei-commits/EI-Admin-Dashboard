import { useEffect, useRef, useState } from 'react';
import { fetchMRNList, fetchMRNAssignablePickers, updateMRN, getApiErrorMessage, type MRNRecordFromApi, type AssignablePicker, type MtrLineTransferPhase } from '../../services/mrn.service';

/** API status -> UI display (outbound list). MTR uses full workflow incl. In Transit / Received at MU. */
export type OutboundUiStatus =
  | 'Pending Pick'
  | 'In Pick'
  | 'In Transfer'
  | 'In Transit'
  | 'Received at MU'
  | 'Completed';

function mapApiStatusToUi(raw: string | undefined): OutboundUiStatus {
  const s = String(raw || '').trim();
  if (s === 'Succeeded' || s === 'Completed') return 'Completed';
  if (s === 'Pending') return 'Pending Pick';
  if (s === 'Picked') return 'In Pick';
  if (s === 'In Transfer') return 'In Transfer';
  if (s === 'In Transit') return 'In Transit';
  if (s === 'Received at MU') return 'Received at MU';
  return 'Pending Pick';
}

const UI_TO_API_STATUS: Record<OutboundUiStatus, string> = {
  'Pending Pick': 'Pending',
  'In Pick': 'Picked',
  'In Transfer': 'In Transfer',
  'In Transit': 'In Transit',
  'Received at MU': 'Received at MU',
  Completed: 'Completed',
};

/** Non–MTR (ad-hoc) outbound: linear manual steps only. */
const NON_MTR_MANUAL_FLOW: OutboundUiStatus[] = ['Pending Pick', 'In Pick', 'In Transfer', 'Completed'];

function isMtrOutbound(mrn: { source?: string }): boolean {
  return String(mrn.source || '').trim() === 'MTR';
}

function manualStatusOptions(current: OutboundUiStatus): OutboundUiStatus[] {
  if (['In Transit', 'Received at MU'].includes(current)) return [current];
  const idx = NON_MTR_MANUAL_FLOW.indexOf(current);
  if (idx === -1) return [current];
  const next = NON_MTR_MANUAL_FLOW[idx + 1];
  return next ? [NON_MTR_MANUAL_FLOW[idx], next] : [NON_MTR_MANUAL_FLOW[idx]];
}

type StatusFilter = 'All' | 'Pending Pick' | 'In Pick' | 'In Transfer' | 'Completed';

function statusMatchesFilter(mrnStatus: OutboundUiStatus, filter: StatusFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'In Transfer') {
    return ['In Transfer', 'In Transit', 'Received at MU'].includes(mrnStatus);
  }
  return mrnStatus === filter;
}

/** Display label for transfer direction. */
const TRANSFER_TYPE_LABEL = {
  outbound: 'Outbound (to MU)',
  inbound_from_mu: 'Inbound from MU',
} as const;

interface MRN {
  id: string;
  mrnNo: string;
  requestedBy: string;
  status: OutboundUiStatus;
  assignedPicker: string;
  transferTeam: string;
  itemsCount: number;
  notes: string;
  lineItems: { id: string; name: string; itemCode: string; quantity: number; unit: string; notes?: string; raw_material_id?: number; pack_material_id?: number; product_id?: number }[];
  bmrNo?: string;
  source?: string;
  isInboundFromMu: boolean;
  lineTransferStatus?: Record<string, MtrLineTransferPhase | string>;
}

interface PickLineItem {
  id: string;
  name: string;
  location: string;
  available: number;
  required: number;
  uom: string;
}

function mapApiToMRN(r: MRNRecordFromApi): MRN {
  const status = mapApiStatusToUi(r.status);
  return {
    id: r.id,
    mrnNo: r.mrnNo,
    requestedBy: r.requestedBy || '—',
    status,
    assignedPicker: r.assignedPicker || '',
    transferTeam: r.transferTeam || '',
    itemsCount: (r.lineItems || []).length,
    notes: r.notes || '',
    bmrNo: r.bmrNo || '',
    source: r.source || '',
    isInboundFromMu: Boolean(r.isInboundFromMu),
    lineItems: (r.lineItems || []).map((li) => ({
      id: li.id,
      name: li.item || li.itemCode || '—',
      itemCode: li.itemCode || '',
      quantity: li.quantity,
      unit: li.unit || '',
      notes: li.notes,
      raw_material_id: li.raw_material_id,
      pack_material_id: li.pack_material_id,
      product_id: li.product_id,
    })),
    lineTransferStatus: r.lineTransferStatus,
  };
}

const OutboundDashboard = () => {
  const [mrnData, setMrnData] = useState<MRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignablePickers, setAssignablePickers] = useState<AssignablePicker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [selectedMRNId, setSelectedMRNId] = useState<string | null>(null);
  const [assignedPicker, setAssignedPicker] = useState('');
  const [assignedTransferBy, setAssignedTransferBy] = useState('');
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [pickedQty, setPickedQty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [pickStateByMrn, setPickStateByMrn] = useState<
    Record<
      string,
      {
        assignedPicker: string;
        assignedTransferBy: string;
        pickedItems: Record<string, boolean>;
        pickedQty: Record<string, string>;
      }
    >
  >({});

  const selectedMRN = mrnData.find((mrn) => mrn.id === selectedMRNId) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, pickers] = await Promise.all([
          fetchMRNList({ transferType: 'outbound' }),
          fetchMRNAssignablePickers(),
        ]);
        if (!cancelled) {
          setMrnData(list.map(mapApiToMRN));
          setAssignablePickers(pickers);
        }
      } catch {
        if (!cancelled) setMrnData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const activePickItems: PickLineItem[] = selectedMRN
    ? selectedMRN.lineItems.map((li) => ({
        id: li.id,
        name: li.name,
        location: '—',
        available: 0,
        required: li.quantity,
        uom: li.unit,
      }))
    : [];

  const handleOpenPanel = (mrn: MRN, _mode: 'pick' | 'view') => {
    setSelectedMRNId(mrn.id);

    const existingState = pickStateByMrn[mrn.id];
    setAssignedPicker(existingState?.assignedPicker ?? mrn.assignedPicker ?? '');
    setAssignedTransferBy(existingState?.assignedTransferBy ?? mrn.transferTeam ?? '');
    setPickedItems(existingState?.pickedItems ?? {});

    const initialQty: Record<string, string> = {};
    mrn.lineItems.forEach((li) => {
      initialQty[li.id] = existingState?.pickedQty?.[li.id] ?? String(li.quantity);
    });
    setPickedQty(initialQty);
  };

  const closePickPanel = () => {
    setSelectedMRNId(null);
  };

  const persistPanelState = (mrnId: string) => {
    setPickStateByMrn((prev) => ({
      ...prev,
      [mrnId]: {
        assignedPicker,
        assignedTransferBy,
        pickedItems,
        pickedQty,
      },
    }));
  };

  const buildLineItemsForSave = () => {
    if (!selectedMRN) return [];
    return selectedMRN.lineItems.map((li) => ({
      id: li.id,
      raw_material_id: li.raw_material_id,
      pack_material_id: li.pack_material_id,
      product_id: li.product_id,
      quantity: Math.max(0, parseInt(String(pickedQty[li.id]), 10) || li.quantity),
      unit: li.unit || '',
      notes: li.notes || '',
    }));
  };

  const handleSaveChanges = async () => {
    if (!selectedMRN) return;
    persistPanelState(selectedMRN.id);
    try {
      await updateMRN(selectedMRN.id, {
        assignedPicker: assignedPicker || undefined,
        transferTeam: assignedTransferBy || undefined,
        lineItems: buildLineItemsForSave(),
      });
      setMrnData((prev) =>
        prev.map((mrn) =>
          mrn.id === selectedMRN.id
            ? { ...mrn, assignedPicker, transferTeam: assignedTransferBy, lineItems: selectedMRN.lineItems.map((li) => ({ ...li, quantity: Math.max(0, parseInt(String(pickedQty[li.id]), 10) || li.quantity) })) }
            : mrn
        )
      );
      showToast('Changes saved.');
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to save changes', 'error');
    }
  };

  const handleSavePick = async () => {
    if (!selectedMRN) return;
    persistPanelState(selectedMRN.id);
    try {
      await updateMRN(selectedMRN.id, {
        status: UI_TO_API_STATUS['In Pick'],
        assignedPicker: assignedPicker || undefined,
        transferTeam: assignedTransferBy || undefined,
        lineItems: buildLineItemsForSave(),
      });
      setMrnData((prev) =>
        prev.map((mrn) =>
          mrn.id === selectedMRN.id ? { ...mrn, assignedPicker, transferTeam: assignedTransferBy, status: 'In Pick' as const } : mrn
        )
      );
      showToast(`Pick saved for ${selectedMRN.mrnNo}. Status updated to In Pick.`);
      closePickPanel();
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to save pick', 'error');
    }
  };

  const handleInitiateTransfer = async () => {
    if (!selectedMRN) return;
    persistPanelState(selectedMRN.id);
    const mtrOutbound = isMtrOutbound(selectedMRN);
    if (mtrOutbound && selectedMRN.status === 'Completed') {
      showToast('This transfer is completed.', 'error');
      return;
    }
    try {
      if (mtrOutbound) {
        const lts = selectedMRN.lineTransferStatus || {};
        const checkedIds = selectedMRN.lineItems
          .filter((li) => pickedItems[li.id])
          .map((li) => li.id);
        if (checkedIds.length === 0) {
          showToast('Select at least one line (checkbox) to initiate transfer.', 'error');
          return;
        }
        const toInitiate = checkedIds.filter((id) => (lts[id] as string | undefined) === 'not_initiated');
        if (toInitiate.length === 0) {
          showToast('Selected lines are already initiated or completed.', 'error');
          return;
        }
        const updatedApi = await updateMRN(selectedMRN.id, {
          initiateTransferLineIds: toInitiate,
          assignedPicker: assignedPicker || undefined,
          transferTeam: assignedTransferBy || undefined,
          lineItems: buildLineItemsForSave(),
        });
        const mapped = mapApiToMRN(updatedApi as MRNRecordFromApi);
        setMrnData((prev) => prev.map((mrn) => (mrn.id === selectedMRN.id ? mapped : mrn)));
        showToast(`${selectedMRN.mrnNo}: initiated ${toInitiate.length} line(s) to in transit.`);
      } else {
        await updateMRN(selectedMRN.id, {
          status: UI_TO_API_STATUS['In Transfer'],
          assignedPicker: assignedPicker || undefined,
          transferTeam: assignedTransferBy || undefined,
          lineItems: buildLineItemsForSave(),
        });
        setMrnData((prev) =>
          prev.map((mrn) =>
            mrn.id === selectedMRN.id
              ? { ...mrn, assignedPicker, transferTeam: assignedTransferBy, status: 'In Transfer' as const }
              : mrn
          )
        );
        showToast(`Transfer initiated for ${selectedMRN.mrnNo}. Status updated to In Transfer.`);
      }
      closePickPanel();
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to initiate transfer', 'error');
    }
  };

  const getStatusCounts = () => {
    return {
      total: mrnData.length,
      pendingPick: mrnData.filter(m => m.status === 'Pending Pick').length,
      inPick: mrnData.filter(m => m.status === 'In Pick').length,
      inTransfer: mrnData.filter(m => m.status === 'In Transfer').length,
      completed: mrnData.filter(m => m.status === 'Completed').length,
    };
  };

  const counts = getStatusCounts();

  const filteredMRNs = mrnData.filter(mrn => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      mrn.mrnNo.toLowerCase().includes(q) ||
      mrn.requestedBy.toLowerCase().includes(q) ||
      (mrn.notes || '').toLowerCase().includes(q) ||
      (mrn.bmrNo || '').toLowerCase().includes(q) ||
      (mrn.source || '').toLowerCase().includes(q);
    const matchesStatus = statusMatchesFilter(mrn.status, statusFilter);
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Pending Pick':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'In Pick':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'In Transfer':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'In Transit':
        return 'bg-sky-50 text-sky-800 border border-sky-200';
      case 'Received at MU':
        return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const handleStatusChange = async (mrn: MRN, newStatus: OutboundUiStatus) => {
    if (isMtrOutbound(mrn)) return;
    const allowed = manualStatusOptions(mrn.status);
    if (!allowed.includes(newStatus)) {
      showToast('Complete the previous step before moving to this status.', 'error');
      return;
    }
    try {
      await updateMRN(mrn.id, { status: UI_TO_API_STATUS[newStatus] });
      setMrnData((prev) =>
        prev.map((m) => (m.id === mrn.id ? { ...m, status: newStatus } : m))
      );
      showToast(`Status updated to ${newStatus}.`);
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to update status', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-white relative">
      {toast && (
        <div className="fixed top-4 right-4 z-70">
          <div
            className={`px-3 py-2 rounded-md border text-xs font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="p-6 w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-cyan-200 rounded-lg p-4">
            <div className="text-cyan-700 text-xs font-semibold uppercase tracking-wider mb-2">Total MRNs</div>
            <div className="text-3xl font-bold text-cyan-400">{counts.total}</div>
          </div>
          <div className="bg-white border border-rose-200 rounded-lg p-4">
            <div className="text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">Pending Pick</div>
            <div className="text-3xl font-bold text-rose-600">{counts.pendingPick}</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-lg p-4">
            <div className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">In Pick</div>
            <div className="text-3xl font-bold text-amber-600">{counts.inPick}</div>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">In Transfer</div>
            <div className="text-3xl font-bold text-blue-600">{counts.inTransfer}</div>
          </div>
          <div className="bg-white border border-emerald-200 rounded-lg p-4">
            <div className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-2">Completed</div>
            <div className="text-3xl font-bold text-emerald-600">{counts.completed}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white border border-slate-200 rounded-lg">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900 mb-4">Outbound transfers</h1>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {(['All', 'Pending Pick', 'In Pick', 'In Transfer', 'Completed'] as StatusFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    statusFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search MRN, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Request ID (MRN)</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Source / BMR</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requested By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Picker</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Loading transfer orders…</td></tr>
                ) : filteredMRNs.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">No transfer orders found.</td></tr>
                ) : (
                  filteredMRNs.map(mrn => (
                    <tr
                      key={mrn.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleOpenPanel(mrn, 'view')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenPanel(mrn, 'view'); } }}
                    >
                      <td className="px-6 py-4">
                        <div className="text-amber-700 font-medium text-sm">{mrn.mrnNo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${mrn.isInboundFromMu ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                          {mrn.isInboundFromMu ? TRANSFER_TYPE_LABEL.inbound_from_mu : TRANSFER_TYPE_LABEL.outbound}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {mrn.source === 'MTR' && mrn.bmrNo ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-medium">MTR</span>
                            <span className="text-slate-600">{mrn.bmrNo}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 text-sm">{mrn.requestedBy}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-600 text-sm max-w-[200px] truncate" title={mrn.notes}>{mrn.notes || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 text-sm">{mrn.itemsCount} items</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${mrn.assignedPicker ? 'text-slate-900' : 'text-slate-400'}`}>
                          {mrn.assignedPicker || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {isMtrOutbound(mrn) ? (
                          <span
                            className={`inline-flex items-center px-2 py-1.5 text-xs font-medium rounded border ${getStatusBadgeColor(mrn.status)}`}
                            title="MTR: status follows the Production transfer workflow (not editable here)."
                          >
                            {mrn.status}
                          </span>
                        ) : (
                          <select
                            value={mrn.status}
                            onChange={(e) => handleStatusChange(mrn, e.target.value as OutboundUiStatus)}
                            className={`text-xs rounded border px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${getStatusBadgeColor(mrn.status)}`}
                          >
                            {manualStatusOptions(mrn.status).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedMRN && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closePickPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mrn-modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id="mrn-modal-title" className="text-base font-bold text-slate-900">Stock Request — {selectedMRN.mrnNo}</h2>
              <button
                onClick={closePickPanel}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="inline-flex px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-semibold">
                {selectedMRN.status}
              </div>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">Request Details</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">MRN No.</p>
                    <p className="text-[11px] font-semibold text-amber-700">{selectedMRN.mrnNo}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500 uppercase">Requested By</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedMRN.requestedBy}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 col-span-2">
                    <p className="text-[9px] text-slate-500 uppercase">Notes</p>
                    <p className="text-[11px] font-semibold text-slate-900">{selectedMRN.notes || '—'}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">Assign Picker / Transfer Team</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Picker</label>
                    <select
                      value={assignedPicker}
                      onChange={(e) => setAssignedPicker(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    >
                      <option value="">— Assign Picker —</option>
                      {assignablePickers.map((p) => (
                        <option key={p.id} value={p.displayName}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">Transfer Team</label>
                    <input
                      type="text"
                      value={assignedTransferBy}
                      onChange={(e) => setAssignedTransferBy(e.target.value)}
                      placeholder="Transfer team / person"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">
                  Pick List — {activePickItems.length} Items
                </h3>
                {isMtrOutbound(selectedMRN) && (
                  <p className="text-[9px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-1.5">
                    MTR: tick lines to include in <strong>Initiate transfer</strong>. Only <em>WH pending</em> lines move to in transit; you can release lines in separate batches.
                  </p>
                )}
                <div className="rounded border border-slate-200 overflow-hidden">
                  {activePickItems.map((item) => {
                    const shortQty = pickedQty[item.id] ?? String(item.required);
                    const hasShort = Number(shortQty) < item.required;
                    return (
                      <div key={item.id} className="px-2.5 py-2 border-b border-slate-100 last:border-b-0 bg-white">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!pickedItems[item.id]}
                            onChange={(e) => setPickedItems((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-900">
                              {item.name}
                              {isMtrOutbound(selectedMRN) && selectedMRN.lineTransferStatus?.[item.id] && (
                                <span className="ml-1 font-normal text-[9px] text-slate-500">
                                  ({String(selectedMRN.lineTransferStatus[item.id]).replace(/_/g, ' ')})
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500">Required: {item.required} {item.uom}{item.location !== '—' ? ` · At ${item.location}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">Required:</span>
                            <input
                              value={shortQty}
                              onChange={(e) => setPickedQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] text-slate-900"
                            />
                            <span className="text-[10px] text-slate-500">{item.uom}</span>
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${hasShort ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {hasShort ? 'Short' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {selectedMRN.notes && (
                <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-700">
                  {selectedMRN.notes}
                </div>
              )}
            </div>

            <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={handleSaveChanges}
                className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-semibold"
              >
                Save changes
              </button>
              <button
                onClick={handleSavePick}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-[11px] font-semibold"
              >
                Save Pick
              </button>
              <button
                type="button"
                onClick={handleInitiateTransfer}
                disabled={isMtrOutbound(selectedMRN) && selectedMRN.status === 'Completed'}
                title={
                  isMtrOutbound(selectedMRN)
                    ? 'Check lines to release from warehouse, then initiate (only not-initiated lines move).'
                    : undefined
                }
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
              >
                Initiate Transfer
              </button>
              <button
                onClick={closePickPanel}
                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundDashboard;
