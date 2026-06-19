import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMRNList, fetchMRNAssignablePickers, updateMRN, getApiErrorMessage, type MRNRecordFromApi, type AssignablePicker, type MtrLineTransferPhase, mrnSourceDocFromApi, formatMrnDisplayDate, mrnDisplayPrName, mrnDisplayExpectedDate, mrnDisplayBatchNumber } from '../../services/mrn.service';
import { fetchFacilityAreas, type FacilityAreaDTO } from '../../services/facilityAreas.service';
import { parseQtyInputString } from '../../utils/qtyInput';
import { materialQtyToNum, sanitizeMrnLineItemQuantity } from '../../utils/materialQtyCompare';

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

/** WH may only batch-initiate lines still in not_initiated; later phases are read-only in this modal. */
function mtrOutboundLinePhase(
  lineId: string,
  lineTransferStatus: Record<string, MtrLineTransferPhase | string> | undefined
): string {
  return String(lineTransferStatus?.[lineId] ?? 'not_initiated');
}

function mtrLineLockedAtWh(lineId: string, lineTransferStatus: Record<string, MtrLineTransferPhase | string> | undefined): boolean {
  return mtrOutboundLinePhase(lineId, lineTransferStatus) !== 'not_initiated';
}

function initiateLineKey(mrnId: string, lineId: string): string {
  return `${mrnId}::${lineId}`;
}

function defaultInitiateLinesForMrn(mrn: MRN): Record<string, boolean> {
  const sel: Record<string, boolean> = {};
  mrn.lineItems.forEach((li) => {
    if (!isMtrOutbound(mrn) || !mtrLineLockedAtWh(li.id, mrn.lineTransferStatus)) {
      sel[initiateLineKey(mrn.id, li.id)] = true;
    }
  });
  return sel;
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

function mrnSourceDoc(mrn: Pick<MRN, 'source' | 'mtrKind' | 'sourceRef' | 'bmrNo' | 'bprNo' | 'lineItems'>): {
  kind: 'bmr' | 'bpr';
  id: string;
} | null {
  return mrnSourceDocFromApi(mrn);
}

type MrnSortColumn =
  | 'mrnNo'
  | 'type'
  | 'source'
  | 'ItemName'
  | 'requestDate'
  | 'expectedDate'
  | 'batchNumber'
  | 'picker'
  | 'status';

type SortDirection = 'asc' | 'desc';

function sortValueForMrn(mrn: MRN, column: MrnSortColumn): string {
  switch (column) {
    case 'mrnNo':
      return mrn.mrnNo.toLowerCase();
    case 'type':
      return mrn.isInboundFromMu ? TRANSFER_TYPE_LABEL.inbound_from_mu : TRANSFER_TYPE_LABEL.outbound;
    case 'source': {
      const src = mrnSourceDoc(mrn);
      return src ? `${src.kind}:${src.id}`.toLowerCase() : '';
    }
    case 'ItemName':
      return mrnDisplayPrName(mrn).toLowerCase();
    case 'requestDate':
      return mrn.createdAt || '';
    case 'expectedDate':
      return mrn.requiredByDate || '';
    case 'batchNumber':
      return mrnDisplayBatchNumber(mrn).toLowerCase();
    case 'picker':
      return (mrn.assignedPicker || '').toLowerCase();
    case 'status':
      return mrn.status.toLowerCase();
    default:
      return '';
  }
}

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
  bprNo?: string;
  productName?: string;
  batchNo?: string;
  mtrKind?: 'rm' | 'pm' | null;
  sourceRef?: string;
  source?: string;
  createdAt?: string | null;
  isInboundFromMu: boolean;
  lineTransferStatus?: Record<string, MtrLineTransferPhase | string>;
  logisticsTrackingNo?: string | null;
  logisticsTransporter?: string | null;
  logisticsDispatchDate?: string | null;
  logisticsEtaDate?: string | null;
  logisticsVehicleNo?: string | null;
  requiredByDate?: string | null;
  whDispatchZone?: string;
  muReceiveZone?: string;
  muReceiveRack?: string;
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
    bprNo: r.bprNo || '',
    productName: r.productName || '',
    batchNo: r.batchNo || '',
    mtrKind: r.mtrKind ?? null,
    sourceRef: r.sourceRef || '',
    source: r.source || '',
    createdAt: r.createdAt ?? null,
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
    logisticsTrackingNo: r.logisticsTrackingNo ?? null,
    logisticsTransporter: r.logisticsTransporter ?? null,
    logisticsDispatchDate: r.logisticsDispatchDate ?? null,
    logisticsEtaDate: r.logisticsEtaDate ?? null,
    logisticsVehicleNo: r.logisticsVehicleNo ?? null,
    requiredByDate: r.requiredByDate ?? null,
    whDispatchZone: r.whDispatchZone ?? undefined,
    muReceiveZone: r.muReceiveZone ?? undefined,
    muReceiveRack: r.muReceiveRack ?? undefined,
  };
}

const OutboundDashboard = () => {
  const [mrnData, setMrnData] = useState<MRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignablePickers, setAssignablePickers] = useState<AssignablePicker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortColumn, setSortColumn] = useState<MrnSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedMRNId, setSelectedMRNId] = useState<string | null>(null);
  const [assignedPicker, setAssignedPicker] = useState('');
  const [assignedTransferBy, setAssignedTransferBy] = useState('');
  const [logisticsTrackingNo, setLogisticsTrackingNo] = useState('');
  const [logisticsTransporter, setLogisticsTransporter] = useState('');
  const [logisticsDispatchDate, setLogisticsDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [logisticsEtaDate, setLogisticsEtaDate] = useState('');
  const [logisticsVehicleNo, setLogisticsVehicleNo] = useState('');
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [pickedQty, setPickedQty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [initiatingTransfer, setInitiatingTransfer] = useState(false);
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [initiateSelectedMrnIds, setInitiateSelectedMrnIds] = useState<Record<string, boolean>>({});
  const [initiateLineSelection, setInitiateLineSelection] = useState<Record<string, boolean>>({});
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
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  const [warehouseAreas, setWarehouseAreas] = useState<FacilityAreaDTO[]>([]);
  const [selectedMlLocation, setSelectedMlLocation] = useState('');

  const zoneLabelInAreas = (areas: FacilityAreaDTO[], zoneCode: string) => {
    const zc = (zoneCode || '').trim();
    if (!zc) return '—';
    for (const a of areas) {
      for (const z of a.zones || []) {
        if (z.code === zc) {
          return `${a.name} — ${z.name}${z.zoneLabel ? ` — ${z.zoneLabel}` : ''}`.trim();
        }
      }
    }
    return zc;
  };

  const allProductionZones = productionAreas.flatMap((a) =>
    (a.zones || []).map((z) => ({ areaName: a.name, ...z }))
  );

  const selectedMRN = mrnData.find((mrn) => mrn.id === selectedMRNId) ?? null;
  /** Shown read-only for outbound MTR: server `muReceiveZone` (Send MTR) or UI selection in `selectedMlLocation`. */
  const mtrMlDestinationCode = selectedMRN
    ? String(selectedMRN.muReceiveZone || selectedMlLocation || '').trim()
    : '';
  const savePickAvailable = selectedMRN?.status === 'Pending Pick';

  /** Saved picks ready for outbound dispatch (In Pick + assigned picker). */
  const savedPickMrns = mrnData.filter(
    (m) => m.status === 'In Pick' && String(m.assignedPicker || '').trim()
  );
  const selectedInitiateMrns = savedPickMrns.filter((m) => initiateSelectedMrnIds[m.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, pickers, areasProd, areasWh] = await Promise.all([
          fetchMRNList({ transferType: 'outbound' }),
          fetchMRNAssignablePickers(),
          fetchFacilityAreas('production'),
          fetchFacilityAreas('warehouse'),
        ]);
        if (!cancelled) {
          setMrnData(list.map(mapApiToMRN));
          setAssignablePickers(pickers);
          setProductionAreas((areasProd.success ? areasProd.data : []) as FacilityAreaDTO[]);
          setWarehouseAreas((areasWh.success ? areasWh.data : []) as FacilityAreaDTO[]);
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
    const serverPicker = String(mrn.assignedPicker || '').trim();
    const serverTeam = String(mrn.transferTeam || '').trim();
    setAssignedPicker(serverPicker ? mrn.assignedPicker : (existingState?.assignedPicker ?? ''));
    setAssignedTransferBy(serverTeam ? mrn.transferTeam : (existingState?.assignedTransferBy ?? ''));
    const existingMl = String(mrn.muReceiveZone || '').trim();
    setSelectedMlLocation(existingMl);

    const sessionPicked = existingState?.pickedItems ?? {};
    const nextPicked: Record<string, boolean> = {};
    mrn.lineItems.forEach((li) => {
      if (isMtrOutbound(mrn) && mtrLineLockedAtWh(li.id, mrn.lineTransferStatus)) {
        nextPicked[li.id] = false;
      } else {
        nextPicked[li.id] = !!sessionPicked[li.id];
      }
    });
    setPickedItems(nextPicked);

    const initialQty: Record<string, string> = {};
    mrn.lineItems.forEach((li) => {
      initialQty[li.id] = existingState?.pickedQty?.[li.id] ?? String(li.quantity);
    });
    setPickedQty(initialQty);
  };

  const closePickPanel = () => {
    setSelectedMRNId(null);
    setSelectedMlLocation('');
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
      quantity: materialQtyToNum(
        sanitizeMrnLineItemQuantity(
          pickedQty[li.id] != null && String(pickedQty[li.id]).trim() !== ''
            ? parseQtyInputString(String(pickedQty[li.id]))
            : li.quantity
        )
      ),
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
        muReceiveZone: selectedMlLocation || undefined,
        lineItems: buildLineItemsForSave(),
      });
      setMrnData((prev) =>
        prev.map((mrn) =>
          mrn.id === selectedMRN.id
            ? {
                ...mrn,
                assignedPicker,
                transferTeam: assignedTransferBy,
                muReceiveZone: selectedMlLocation,
                lineItems: selectedMRN.lineItems.map((li) => ({
                  ...li,
                  quantity: materialQtyToNum(
                    sanitizeMrnLineItemQuantity(
                      pickedQty[li.id] != null && String(pickedQty[li.id]).trim() !== ''
                        ? parseQtyInputString(String(pickedQty[li.id]))
                        : li.quantity
                    )
                  ),
                })),
              }
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
    if (!String(assignedPicker || '').trim()) {
      showToast('Assign a picker before saving pick.', 'error');
      return;
    }
    if (selectedMRN.status !== 'Pending Pick') {
      showToast('Pick was already saved for this transfer.', 'error');
      return;
    }
    persistPanelState(selectedMRN.id);
    try {
      await updateMRN(selectedMRN.id, {
        status: UI_TO_API_STATUS['In Pick'],
        assignedPicker: assignedPicker || undefined,
        transferTeam: assignedTransferBy || undefined,
        muReceiveZone: selectedMlLocation || undefined,
        lineItems: buildLineItemsForSave(),
      });
      setMrnData((prev) =>
        prev.map((mrn) =>
          mrn.id === selectedMRN.id ? { ...mrn, assignedPicker, transferTeam: assignedTransferBy, muReceiveZone: selectedMlLocation, status: 'In Pick' as const } : mrn
        )
      );
      showToast(`Pick saved for ${selectedMRN.mrnNo}. Status updated to In Pick.`);
      closePickPanel();
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to save pick', 'error');
    }
  };

  const openInitiateModal = () => {
    setLogisticsTrackingNo('');
    setLogisticsTransporter('');
    setLogisticsDispatchDate(new Date().toISOString().slice(0, 10));
    setLogisticsEtaDate('');
    setLogisticsVehicleNo('');
    const mrnSel: Record<string, boolean> = {};
    const lineSel: Record<string, boolean> = {};
    savedPickMrns.forEach((mrn) => {
      mrnSel[mrn.id] = true;
      Object.assign(lineSel, defaultInitiateLinesForMrn(mrn));
    });
    setInitiateSelectedMrnIds(mrnSel);
    setInitiateLineSelection(lineSel);
    setInitiateModalOpen(true);
  };

  const closeInitiateModal = () => {
    setInitiateModalOpen(false);
    setInitiateSelectedMrnIds({});
    setInitiateLineSelection({});
  };

  const toggleInitiateMrnSelection = (mrn: MRN, checked: boolean) => {
    setInitiateSelectedMrnIds((prev) => ({ ...prev, [mrn.id]: checked }));
    if (checked) {
      setInitiateLineSelection((prev) => ({ ...prev, ...defaultInitiateLinesForMrn(mrn) }));
    } else {
      setInitiateLineSelection((prev) => {
        const next = { ...prev };
        mrn.lineItems.forEach((li) => {
          delete next[initiateLineKey(mrn.id, li.id)];
        });
        return next;
      });
    }
  };

  const toggleAllInitiateMrns = (checked: boolean) => {
    if (!checked) {
      setInitiateSelectedMrnIds({});
      setInitiateLineSelection({});
      return;
    }
    const mrnSel: Record<string, boolean> = {};
    const lineSel: Record<string, boolean> = {};
    savedPickMrns.forEach((mrn) => {
      mrnSel[mrn.id] = true;
      Object.assign(lineSel, defaultInitiateLinesForMrn(mrn));
    });
    setInitiateSelectedMrnIds(mrnSel);
    setInitiateLineSelection(lineSel);
  };

  const hasInitiateLinesSelected = selectedInitiateMrns.some((mrn) =>
    mrn.lineItems.some((li) => {
      if (isMtrOutbound(mrn) && mtrLineLockedAtWh(li.id, mrn.lineTransferStatus)) return false;
      return !!initiateLineSelection[initiateLineKey(mrn.id, li.id)];
    })
  );

  const allSavedPicksSelected =
    savedPickMrns.length > 0 && savedPickMrns.every((m) => initiateSelectedMrnIds[m.id]);

  const buildLineItemsFromMrn = (mrn: MRN) =>
    mrn.lineItems.map((li) => ({
      id: li.id,
      raw_material_id: li.raw_material_id,
      pack_material_id: li.pack_material_id,
      product_id: li.product_id,
      quantity: materialQtyToNum(sanitizeMrnLineItemQuantity(li.quantity)),
      unit: li.unit || '',
      notes: li.notes || '',
    }));

  const handleInitiateTransfer = async () => {
    const selected = savedPickMrns.filter((m) => initiateSelectedMrnIds[m.id]);
    if (selected.length === 0) {
      showToast('Select at least one saved pick request from the list.', 'error');
      return;
    }
    if (!logisticsTrackingNo.trim() || !logisticsTransporter.trim() || !logisticsVehicleNo.trim() || !logisticsDispatchDate) {
      showToast('Fill required transfer details: Tracking/LR no, driver/transporter, vehicle no, and dispatch date.', 'error');
      return;
    }
    if (!hasInitiateLinesSelected) {
      showToast('Select at least one line across the chosen requests.', 'error');
      return;
    }

    setInitiatingTransfer(true);
    const logisticsPayload = {
      logisticsTrackingNo: logisticsTrackingNo.trim(),
      logisticsTransporter: logisticsTransporter.trim(),
      logisticsDispatchDate,
      logisticsEtaDate: logisticsEtaDate || undefined,
      logisticsVehicleNo: logisticsVehicleNo.trim(),
    };

    try {
      const updatedById = new Map<string, MRN>();
      let totalLines = 0;

      for (const mrn of selected) {
        const effectivePicker = String(mrn.assignedPicker || '').trim();
        if (!effectivePicker) {
          showToast(`${mrn.mrnNo}: no assigned picker — skipped.`, 'error');
          continue;
        }
        const mtrOutbound = isMtrOutbound(mrn);
        if (mtrOutbound && mrn.status === 'Completed') continue;

        if (mtrOutbound) {
          const lts = mrn.lineTransferStatus || {};
          const checkedIds = mrn.lineItems
            .filter((li) => initiateLineSelection[initiateLineKey(mrn.id, li.id)])
            .map((li) => li.id);
          if (checkedIds.length === 0) continue;

          const bad = checkedIds.filter((id) => mtrLineLockedAtWh(id, lts));
          if (bad.length > 0) {
            showToast(`${mrn.mrnNo}: remove lines already in transit from selection.`, 'error');
            return;
          }
          const toInitiate = checkedIds.filter((id) => (lts[id] as string | undefined) === 'not_initiated');
          if (toInitiate.length === 0) continue;

          const mlDestination = String(mrn.muReceiveZone || '').trim();
          if (!mlDestination) {
            showToast(`${mrn.mrnNo}: manufacturing destination (ML zone) is missing.`, 'error');
            return;
          }

          const updatedApi = await updateMRN(mrn.id, {
            initiateTransferLineIds: toInitiate,
            assignedPicker: effectivePicker,
            transferTeam: mrn.transferTeam || undefined,
            ...logisticsPayload,
            muReceiveZone: mlDestination,
            lineItems: buildLineItemsFromMrn(mrn),
          });
          updatedById.set(mrn.id, mapApiToMRN(updatedApi as MRNRecordFromApi));
          totalLines += toInitiate.length;
        } else {
          await updateMRN(mrn.id, {
            status: UI_TO_API_STATUS['In Transfer'],
            assignedPicker: effectivePicker,
            transferTeam: mrn.transferTeam || undefined,
            ...logisticsPayload,
            lineItems: buildLineItemsFromMrn(mrn),
          });
          updatedById.set(mrn.id, { ...mrn, status: 'In Transfer' as const });
          totalLines += mrn.lineItems.length;
        }
      }

      if (updatedById.size === 0) {
        showToast('No lines were initiated — check selections and try again.', 'error');
        return;
      }

      setMrnData((prev) => prev.map((m) => updatedById.get(m.id) ?? m));
      showToast(
        `Transfer initiated: ${updatedById.size} request(s), ${totalLines} line(s) — LR ${logisticsTrackingNo.trim()}.`
      );
      closeInitiateModal();
    } catch (e) {
      showToast(getApiErrorMessage(e) || 'Failed to initiate transfer', 'error');
    } finally {
      setInitiatingTransfer(false);
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

  const filteredMRNs = useMemo(() => mrnData.filter(mrn => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      mrn.mrnNo.toLowerCase().includes(q) ||
      mrn.requestedBy.toLowerCase().includes(q) ||
      (mrn.notes || '').toLowerCase().includes(q) ||
      (mrn.bmrNo || '').toLowerCase().includes(q) ||
      (mrn.bprNo || '').toLowerCase().includes(q) ||
      (mrn.sourceRef || '').toLowerCase().includes(q) ||
      (mrn.productName || '').toLowerCase().includes(q) ||
      (mrn.batchNo || '').toLowerCase().includes(q) ||
      mrn.lineItems.some((li) =>
        (li.name || li.itemCode || '').toLowerCase().includes(q)
      ) ||
      (mrn.source || '').toLowerCase().includes(q);
    const matchesStatus = statusMatchesFilter(mrn.status, statusFilter);
    return matchesSearch && matchesStatus;
  }), [mrnData, searchQuery, statusFilter]);

  const sortedMRNs = useMemo(() => {
    if (!sortColumn) return filteredMRNs;
    const rows = [...filteredMRNs];
    rows.sort((a, b) => {
      const av = sortValueForMrn(a, sortColumn);
      const bv = sortValueForMrn(b, sortColumn);
      let cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp === 0) cmp = a.mrnNo.localeCompare(b.mrnNo, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredMRNs, sortColumn, sortDirection]);

  const toggleSort = (column: MrnSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const sortIndicator = (column: MrnSortColumn): string => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h1 className="text-xl font-bold text-slate-900">Outbound transfers</h1>
              <button
                type="button"
                onClick={openInitiateModal}
                disabled={savedPickMrns.length === 0}
                title={
                  savedPickMrns.length === 0
                    ? 'No saved picks (In Pick) — assign picker and Save Pick on a request first.'
                    : 'Dispatch saved pick requests with logistics details.'
                }
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
              >
                Initiate Transfer
                {savedPickMrns.length > 0 ? ` (${savedPickMrns.length})` : ''}
              </button>
            </div>

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
              placeholder="Search MRN, Item name, batch…"
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
                  {(
                    [
                      { col: 'mrnNo' as const, label: 'Request ID (MRN)' },
                      { col: 'type' as const, label: 'Type' },
                      { col: 'source' as const, label: 'Source' },
                      { col: 'ItemName' as const, label: 'Item name' },
                      { col: 'requestDate' as const, label: 'Request date' },
                      { col: 'expectedDate' as const, label: 'Expected date' },
                      { col: 'batchNumber' as const, label: 'Batch number' },
                      { col: 'picker' as const, label: 'Picker' },
                      { col: 'status' as const, label: 'Status' },
                    ] as const
                  ).map(({ col, label }) => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        aria-sort={sortColumn === col ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={`group inline-flex items-center gap-1 -mx-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          sortColumn === col
                            ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                        }`}
                      >
                        {label}
                        <span
                          className={`text-[10px] not-italic leading-none transition-opacity duration-150 ${
                            sortColumn === col
                              ? 'opacity-100 text-cyan-600'
                              : 'opacity-0 group-hover:opacity-70 text-slate-500'
                          }`}
                          aria-hidden
                        >
                          {sortIndicator(col) || '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-500">Loading transfer orders…</td></tr>
                ) : sortedMRNs.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-500">No transfer orders found.</td></tr>
                ) : (
                  sortedMRNs.map(mrn => (
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
                        {(() => {
                          const src = mrnSourceDoc(mrn);
                          if (!src) {
                            return <span className="text-slate-400 text-xs">—</span>;
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span
                                className={`px-1.5 py-0.5 rounded font-medium ${
                                  src.kind === 'bpr'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-teal-100 text-teal-700'
                                }`}
                              >
                                {src.kind === 'bpr' ? 'BPR' : 'BMR'}
                              </span>
                              <span className="text-slate-700 font-mono">{src.id}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 text-sm max-w-[220px] truncate" title={mrnDisplayPrName(mrn)}>
                          {mrnDisplayPrName(mrn)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 text-sm whitespace-nowrap">{formatMrnDisplayDate(mrn.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 text-sm whitespace-nowrap">{mrnDisplayExpectedDate(mrn)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800 text-sm font-mono">{mrnDisplayBatchNumber(mrn)}</div>
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
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">
                      Picker <span className="text-rose-600">*</span>
                    </label>
                    {String(selectedMRN.assignedPicker || '').trim() ? (
                      <div
                        className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-800"
                        title="Picker was saved once and cannot be changed. Contact an admin if this was a mistake."
                      >
                        {selectedMRN.assignedPicker}
                      </div>
                    ) : (
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
                    )}
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
                  {isMtrOutbound(selectedMRN) && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-[9px] text-slate-500 uppercase mb-1">Transfer from (warehouse)</label>
                        <div
                          className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-800"
                          title="Set in Production when sending the MTR. Not editable in Warehouse."
                        >
                          {selectedMRN.whDispatchZone
                            ? zoneLabelInAreas(warehouseAreas, selectedMRN.whDispatchZone)
                            : '—'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] text-slate-500 uppercase mb-1">
                          Transfer to (manufacturing / ML) <span className="text-rose-600">*</span>
                        </label>
                        {String(selectedMRN.muReceiveZone || '').trim() ? (
                          <div
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-800"
                            title="Saved when Production sent the MTR."
                          >
                            {zoneLabelInAreas(productionAreas, selectedMRN.muReceiveZone!)}
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{selectedMRN.muReceiveZone}</span>
                          </div>
                        ) : allProductionZones.length > 0 ? (
                          <select
                            value={selectedMlLocation}
                            onChange={(e) => setSelectedMlLocation(e.target.value)}
                            className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                          >
                            <option value="">— Select manufacturing zone —</option>
                            {productionAreas.map((a) => (
                              <optgroup key={a.id} label={`${a.name} (manufacturing)`}>
                                {(a.zones || []).map((z) => (
                                  <option key={z.code} value={z.code}>
                                    {z.name}
                                    {z.zoneLabel ? ` — ${z.zoneLabel}` : ''} ({z.code})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
                            No manufacturing zones in Facility Management. Add a production area with zones, then refresh.
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-slate-500">
                          {String(selectedMRN.muReceiveZone || '').trim()
                            ? 'From Production (Send MTR). Use Initiate Transfer on the list page when goods leave the warehouse.'
                            : selectedMlLocation
                              ? 'Destination will be saved when you save pick.'
                              : allProductionZones.length > 0
                                ? 'Select destination above (MTR was sent without Transfer To), or re-send MTR from Production.'
                                : 'Set up production zones in Masters → Facility Management first.'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">
                  Pick List — {activePickItems.length} Items
                </h3>
                {isMtrOutbound(selectedMRN) && (
                  <p className="text-[9px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-1.5">
                    Save pick when ready. Use the page-level <strong>Initiate Transfer</strong> button to dispatch saved picks (In Pick) with logistics details.
                  </p>
                )}
                <div className="rounded border border-slate-200 overflow-hidden">
                  {activePickItems.map((item) => {
                    const shortQty = pickedQty[item.id] ?? String(item.required);
                    const hasShort = Number(shortQty) < item.required;
                    const mtr = isMtrOutbound(selectedMRN);
                    const phase = mtr ? mtrOutboundLinePhase(item.id, selectedMRN.lineTransferStatus) : 'not_initiated';
                    const locked = mtr && mtrLineLockedAtWh(item.id, selectedMRN.lineTransferStatus);
                    const phaseLabel = phase.replace(/_/g, ' ');
                    return (
                      <div
                        key={item.id}
                        className={`px-2.5 py-2 border-b border-slate-100 last:border-b-0 ${
                          locked ? 'bg-slate-100/80 border-slate-200' : 'bg-white'
                        }`}
                      >
                        <div className={`flex items-start gap-2 ${locked ? 'opacity-70' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-900">
                              {item.name}
                              {mtr && (
                                <span
                                  className={`ml-1.5 inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold ${
                                    locked
                                      ? 'border-slate-300 bg-slate-200 text-slate-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  }`}
                                  title="Per-line MTR transfer phase from server"
                                >
                                  {phaseLabel}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Required: {item.required} {item.uom}
                              {item.location !== '—' ? ` · At ${item.location}` : ''}
                              {locked && (
                                <span className="ml-1 text-slate-600 font-medium">· Already dispatched from WH</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">Qty:</span>
                            <input
                              value={shortQty}
                              disabled={mtr && locked}
                              title={mtr && locked ? 'Quantity is fixed for lines that already left WH.' : undefined}
                              onChange={(e) => setPickedQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            />
                            <span className="text-[10px] text-slate-500">{item.uom}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${
                                locked
                                  ? 'bg-slate-200 text-slate-600 border-slate-300'
                                  : hasShort
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {locked ? 'WH done' : hasShort ? 'Short' : 'Pending'}
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
              {savePickAvailable && (
                <button
                  type="button"
                  onClick={handleSavePick}
                  disabled={!savePickAvailable}
                  title={
                    !savePickAvailable
                      ? 'Pick was already saved (status is no longer Pending pick).'
                      : 'Requires an assigned picker. Sets status to In pick.'
                  }
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500"
                >
                  Save Pick
                </button>
              )}
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

      {initiateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeInitiateModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="initiate-transfer-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id="initiate-transfer-title" className="text-base font-bold text-slate-900">Initiate Transfer</h2>
              <button
                type="button"
                onClick={closeInitiateModal}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">Initiate transfer details</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="col-span-2">
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">
                      Tracking / LR no. <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={logisticsTrackingNo}
                      onChange={(e) => setLogisticsTrackingNo(e.target.value)}
                      placeholder="Enter LR or tracking number"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">
                      Driver / transporter <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={logisticsTransporter}
                      onChange={(e) => setLogisticsTransporter(e.target.value)}
                      placeholder="Driver or transporter name"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">
                      Dispatch date <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={logisticsDispatchDate}
                      onChange={(e) => setLogisticsDispatchDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">ETA (optional)</label>
                    <input
                      type="date"
                      value={logisticsEtaDate}
                      onChange={(e) => setLogisticsEtaDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] text-slate-500 uppercase mb-1">
                      Vehicle no. <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={logisticsVehicleNo}
                      onChange={(e) => setLogisticsVehicleNo(e.target.value)}
                      placeholder="Enter vehicle number"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                    Saved pick requests ({savedPickMrns.length})
                    {selectedInitiateMrns.length > 0 ? (
                      <span className="ml-1.5 font-normal normal-case text-slate-500">
                        · {selectedInitiateMrns.length} selected
                      </span>
                    ) : null}
                  </h3>
                  {savedPickMrns.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSavedPicksSelected}
                        onChange={(e) => toggleAllInitiateMrns(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Select all
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  Only requests with status <strong>In Pick</strong> (picker saved) appear here. Select one or more — all chosen requests dispatch together with the same logistics details.
                </p>
                {savedPickMrns.length === 0 ? (
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
                    No saved picks yet. Open a request, assign a picker, and tap Save Pick.
                  </div>
                ) : (
                  <div className="rounded border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {savedPickMrns.map((mrn) => {
                      const selected = !!initiateSelectedMrnIds[mrn.id];
                      return (
                        <label
                          key={mrn.id}
                          className={`flex items-start gap-2.5 w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${
                            selected ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'bg-white hover:bg-slate-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => toggleInitiateMrnSelection(mrn, e.target.checked)}
                            className="mt-0.5 rounded border-slate-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-amber-700">{mrn.mrnNo}</span>
                              <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-medium border ${getStatusBadgeColor(mrn.status)}`}>
                                {mrn.status}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-600">
                              Picker: {mrn.assignedPicker}
                              {(() => {
                                const src = mrnSourceDoc(mrn);
                                return src ? ` · ${src.kind.toUpperCase()} ${src.id}` : '';
                              })()}
                              {mrn.muReceiveZone ? ` · → ${mrn.muReceiveZone}` : ''}
                              · {mrn.itemsCount} item(s)
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {selectedInitiateMrns.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">
                    Lines ({selectedInitiateMrns.length} request{selectedInitiateMrns.length === 1 ? '' : 's'})
                  </h3>
                  <p className="text-[9px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-1.5">
                    Tick lines to include in this combined transfer. WH-pending lines only for MTR requests.
                  </p>
                  <div className="space-y-3">
                    {selectedInitiateMrns.map((mrn) => (
                      <div key={mrn.id} className="rounded border border-slate-200 overflow-hidden">
                        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-700">
                          {mrn.mrnNo}
                          {(() => {
                            const src = mrnSourceDoc(mrn);
                            return src ? ` · ${src.kind.toUpperCase()} ${src.id}` : '';
                          })()}
                        </div>
                        {mrn.lineItems.map((li) => {
                          const lineKey = initiateLineKey(mrn.id, li.id);
                          const mtr = isMtrOutbound(mrn);
                          const phase = mtr ? mtrOutboundLinePhase(li.id, mrn.lineTransferStatus) : 'not_initiated';
                          const locked = mtr && mtrLineLockedAtWh(li.id, mrn.lineTransferStatus);
                          const phaseLabel = phase.replace(/_/g, ' ');
                          return (
                            <div
                              key={lineKey}
                              className={`px-2.5 py-2 border-b border-slate-100 last:border-b-0 ${locked ? 'bg-slate-100/80' : 'bg-white'}`}
                            >
                              <div className={`flex items-start gap-2 ${locked ? 'opacity-70' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={locked ? false : !!initiateLineSelection[lineKey]}
                                  disabled={locked}
                                  title={
                                    locked
                                      ? `This line is ${phaseLabel} — already left WH or finished.`
                                      : 'Include in initiate transfer.'
                                  }
                                  onChange={(e) => {
                                    if (locked) return;
                                    setInitiateLineSelection((prev) => ({ ...prev, [lineKey]: e.target.checked }));
                                  }}
                                  className="mt-0.5 disabled:cursor-not-allowed"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-slate-900">
                                    {li.name || li.itemCode}
                                    {mtr && (
                                      <span
                                        className={`ml-1.5 inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold ${
                                          locked
                                            ? 'border-slate-300 bg-slate-200 text-slate-700'
                                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        }`}
                                      >
                                        {phaseLabel}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    Qty: {li.quantity} {li.unit}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeInitiateModal}
                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitiateTransfer}
                disabled={
                  initiatingTransfer ||
                  selectedInitiateMrns.length === 0 ||
                  savedPickMrns.length === 0 ||
                  !logisticsTrackingNo.trim() ||
                  !logisticsTransporter.trim() ||
                  !logisticsVehicleNo.trim() ||
                  !logisticsDispatchDate ||
                  !hasInitiateLinesSelected ||
                  selectedInitiateMrns.some(
                    (m) => isMtrOutbound(m) && !String(m.muReceiveZone || '').trim()
                  )
                }
                title={
                  selectedInitiateMrns.length === 0
                    ? 'Select at least one saved pick request.'
                    : !hasInitiateLinesSelected
                      ? 'Select at least one line across the chosen requests.'
                      : !logisticsTrackingNo.trim() || !logisticsTransporter.trim() || !logisticsVehicleNo.trim() || !logisticsDispatchDate
                        ? 'Fill all required transfer details.'
                        : `Dispatch ${selectedInitiateMrns.length} request(s) with shared logistics.`
                }
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
              >
                {initiatingTransfer
                  ? 'Initiating…'
                  : selectedInitiateMrns.length > 0
                    ? `Initiate Transfer (${selectedInitiateMrns.length})`
                    : 'Initiate Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundDashboard;
