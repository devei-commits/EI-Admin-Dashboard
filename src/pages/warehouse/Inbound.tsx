import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { fetchGRNList, updateGRN, fetchGRNAssignableUsers, generateGRNLabels, type AssignableUser, type GeneratedLabel } from '../../services/grn.service';

type GRNType = 'RM' | 'PM';
type QCStatus = 'Under test' | 'Quality checked' | 'Passed' | 'Rejected';
type GRNStatus = 'GRN Complete' | 'Under GRN' | 'In Transit' | 'On Hold' | 'Delayed' | 'Pending';

const QC_STATUS_OPTIONS: Array<Extract<QCStatus, 'Passed' | 'Rejected'>> = ['Passed', 'Rejected'];

/** Map legacy API qc_status to QCStatus */
function normalizeQcStatus(s: string | undefined): QCStatus {
  const v = (s || '').trim();
  if (v === 'Passed') return 'Passed';
  if (v === 'Rejected' || v === 'Failed') return 'Rejected';
  if (v === 'Quality checked') return 'Under test';
  return 'Under test';
}
type WorkflowStep = 'PO Received' | 'Qty Check' | 'QC Inspection' | 'Label Generation' | 'Dispatch Ready';

const WORKFLOW_STEPS_REQUIRED: WorkflowStep[] = ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'];

/** Compare boxes × units to received qty without float drift; supports large integer quantities. */
function boxesTimesUnitsEqualsRcvd(noOfBoxes: number, unitsPerBox: number, rcvdQty: number): boolean {
  if (!Number.isFinite(rcvdQty) || rcvdQty < 0) return false;
  const boxes = Math.max(1, Math.trunc(noOfBoxes) || 1);
  const units = Math.max(0, Math.trunc(unitsPerBox) || 0);
  try {
    return BigInt(boxes) * BigInt(units) === BigInt(Math.trunc(rcvdQty));
  } catch {
    return boxes * units === rcvdQty;
  }
}

/** Uniform cartons, or full cartons + optional partial last box: (n−1)×u + last = rcvd. */
/** Item code from the first saved/generated QR (GRN stores one label set at a time). */
function parseItemCodeFromGeneratedLabels(labels: GeneratedLabel[] | null | undefined): string | null {
  if (!labels?.length) return null;
  try {
    const p = JSON.parse(labels[0].qrPayload || '{}') as { item_code?: string };
    const c = String(p.item_code || '').trim();
    return c || null;
  } catch {
    return null;
  }
}

function labelPackagingMatchesRcvd(
  rcvdQty: number,
  numBoxes: number,
  unitsPerBox: number,
  lastBoxUnitsStr: string
): { ok: true } | { ok: false; message: string } {
  const n = Math.max(1, Math.trunc(numBoxes) || 1);
  const u = Math.max(0, Math.trunc(unitsPerBox) || 0);
  const lastTrim = lastBoxUnitsStr.trim();
  if (!lastTrim) {
    if (!boxesTimesUnitsEqualsRcvd(n, u, rcvdQty)) {
      const prod =
        typeof BigInt !== 'undefined'
          ? String(BigInt(n) * BigInt(u))
          : String(n * u);
      return {
        ok: false,
        message: `No of boxes × Units/box (${n} × ${u} = ${prod}) must equal received quantity (${rcvdQty}). Or use “Last box (remainder)” for a partial final carton.`,
      };
    }
    return { ok: true };
  }
  if (u < 1) {
    return { ok: false, message: 'Set units per full box (e.g. 20) before entering remainder in last box.' };
  }
  const last = Math.trunc(Number(lastTrim)) || 0;
  if (last < 1 || last > u) {
    return { ok: false, message: `Last box units must be between 1 and ${u} (nominal full carton).` };
  }
  try {
    const total = BigInt(n - 1) * BigInt(u) + BigInt(last);
    const rcvd = BigInt(Math.trunc(rcvdQty));
    if (total !== rcvd) {
      return {
        ok: false,
        message: `(${n - 1} full × ${u}) + ${last} (last) = ${total.toString()} must equal received quantity (${rcvdQty}).`,
      };
    }
  } catch {
    if ((n - 1) * u + last !== rcvdQty) {
      return {
        ok: false,
        message: `(${n - 1} full × ${u}) + ${last} (last) must equal received quantity (${rcvdQty}).`,
      };
    }
  }
  return { ok: true };
}

interface LineItem {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  diff?: number;
  qcStatus: 'Pass' | 'Hold' | 'Pending' | 'Fail';
  qcBy: string;
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
}

interface GRNRecord {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: GRNType;
  items: number;
  poValue: number;
  expectedDate: string;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: QCStatus;
  qcBy: string;
  status: GRNStatus;
  invoiceNo?: string;
  invoiceAmount?: number;
  grnDate?: string;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
}

/** Simulate scanning a QR: paste payload JSON → show decoded text + suggested action */
const ScanSimulator = ({ grnNo }: { grnNo: string }) => {
  const [pasteInput, setPasteInput] = useState('');
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const raw = pasteInput.trim();
    if (!raw) {
      setDecoded(null);
      setParseError(null);
      return;
    }
    try {
      const obj = JSON.parse(raw);
      setDecoded(obj as Record<string, unknown>);
      setParseError(null);
    } catch {
      setDecoded(null);
      setParseError('Invalid JSON. Paste the exact QR payload.');
    }
  }, [pasteInput]);

  return (
    <div className="space-y-3">
      <textarea
        value={pasteInput}
        onChange={(e) => setPasteInput(e.target.value)}
        placeholder='Paste QR payload e.g. {"grn_no":"GRN-001","box_index":1,...}'
        rows={2}
        className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white"
      />
      {parseError && <p className="text-xs text-red-600">{parseError}</p>}
      {decoded && !parseError && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700 uppercase">Decoded (all text)</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-800">
            {Object.entries(decoded).map(([k, v]) => (
              <span key={k} className="col-span-2 sm:col-span-1"><dt className="inline font-medium">{k}:</dt> <dd className="inline">{String(v ?? '—')}</dd></span>
            ))}
          </dl>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-emerald-700">Action</p>
            <p className="text-sm text-slate-900">View GRN {(decoded as { grn_no?: string }).grn_no || grnNo} in Warehouse → Inbound (open this GRN popup).</p>
            <p className="text-[10px] text-slate-500 mt-1">When material moves to MU, a new QR set can be generated for MTR/location; scan then shows move-related action.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// GRN Detail Modal Component
const GRNDetailModal = ({ grn, onClose, onSaveChanges, assignableUsers = [] }: { grn: GRNRecord; onClose: () => void; onSaveChanges: (updatedGRN: GRNRecord) => void; assignableUsers?: AssignableUser[] }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [assignedTo, setAssignedTo] = useState(grn.assignedTo || '');
  const [grnDate, setGrnDate] = useState(grn.grnDate || new Date().toISOString().split('T')[0]);
  const [editedLineItems, setEditedLineItems] = useState<LineItem[]>(() =>
    (grn.lineItems || []).map(li => ({
      ...li,
      rcvdQty: (li.rcvdQty != null && li.rcvdQty !== 0) ? li.rcvdQty : li.poQty,
    }))
  );
  const [labelsGenerated, setLabelsGenerated] = useState(!!(grn.generatedLabels && grn.generatedLabels.length > 0));
  const [labels, setLabels] = useState<GeneratedLabel[] | null>(grn.generatedLabels ?? null);
  /** Which box's label is shown in the preview dropdown (1-based box index from API). */
  const [selectedLabelBoxIndex, setSelectedLabelBoxIndex] = useState<number | null>(null);
  const [generatingLabels, setGeneratingLabels] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('');
  const [noOfBoxes, setNoOfBoxes] = useState(String(grn.noOfBoxes ?? 1));
  const [unitsPerBox, setUnitsPerBox] = useState(String(grn.unitsPerBox ?? ''));
  const [lastBoxUnitsStr, setLastBoxUnitsStr] = useState(
    grn.lastBoxUnits != null && grn.lastBoxUnits !== undefined ? String(grn.lastBoxUnits) : ''
  );
  const [locationPrefix, setLocationPrefix] = useState(grn.locationPrefix ?? '');
  const [grnBatchMfg, setGrnBatchMfg] = useState(grn.grnBatchMfg ?? '');
  const [expiry, setExpiry] = useState(grn.expiry ?? '');
  const [mfgBatch, setMfgBatch] = useState(grn.mfgBatch ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentWorkflowSteps, setCurrentWorkflowSteps] = useState<WorkflowStep[]>(grn.workflowSteps || []);
  const [qcStatus, setQcStatus] = useState<QCStatus>(normalizeQcStatus(grn.qcStatus));
  const [qcBy, setQcBy] = useState(grn.qcBy || '');
  const [qcByInput, setQcByInput] = useState(grn.qcBy || '');
  const [showQcByDropdown, setShowQcByDropdown] = useState(false);

  const selectedLineItem = editedLineItems.find(li => li.id === selectedLineItemId) ?? null;

  const labelItemCodeOnFile = useMemo(() => parseItemCodeFromGeneratedLabels(labels), [labels]);
  const labelsAreForSelectedLine = Boolean(
    selectedLineItem &&
      labelItemCodeOnFile &&
      labelItemCodeOnFile.toLowerCase() === selectedLineItem.itemCode.trim().toLowerCase(),
  );
  /** Show primary Generate when a line is selected and there are no labels yet, or saved QRs are for a different line. */
  const needsGenerateForSelection = Boolean(
    selectedLineItemId && (!labelItemCodeOnFile || !labelsAreForSelectedLine),
  );

  useEffect(() => {
    if (!labels || labels.length === 0) {
      setSelectedLabelBoxIndex(null);
      return;
    }
    setSelectedLabelBoxIndex((prev) => {
      if (prev != null && labels.some((l) => l.boxIndex === prev)) return prev;
      return labels[0].boxIndex;
    });
  }, [labels]);

  /** When reopening a GRN that already has saved labels, preselect the line item from QR payload so Regenerate works. */
  useEffect(() => {
    if (selectedLineItemId) return;
    const gl = grn.generatedLabels;
    if (!Array.isArray(gl) || gl.length === 0) return;
    try {
      const p = JSON.parse(gl[0].qrPayload || '{}') as { item_code?: string };
      const code = String(p.item_code || '').trim();
      if (!code) return;
      const match = editedLineItems.find((li) => li.itemCode === code);
      if (match) setSelectedLineItemId(match.id);
    } catch {
      /* ignore */
    }
  }, [grn.id, grn.generatedLabels, editedLineItems, selectedLineItemId]);

  useEffect(() => {
    setQcStatus(normalizeQcStatus(grn.qcStatus));
    setQcBy(grn.qcBy || '');
    setQcByInput(grn.qcBy || '');
  }, [grn.id, grn.qcStatus, grn.qcBy]);

  const filteredQcByUsers = assignableUsers.filter(
    u => (u.displayName || '').toLowerCase().includes((qcByInput || '').toLowerCase().trim())
  );

  const handleLineItemChange = (itemId: string, field: 'rcvdQty' | 'qcStatus', value: string | number) => {
    setEditedLineItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const next = {
          ...item,
          [field === 'rcvdQty' ? 'rcvdQty' : 'qcStatus']:
            field === 'rcvdQty' ? Math.trunc(Number(value)) || 0 : value,
        };
        if (field === 'rcvdQty') {
          const rcvdQty = next.rcvdQty;
          const diff = rcvdQty - item.poQty;
          if (diff < 0) next.qcStatus = 'Hold'; // shortfall => auto Hold
        }
        return next;
      })
    );
  };

  const persistUpdate = async (payload: { status?: string; qcStatus?: string; workflowSteps?: string[] }): Promise<GRNRecord | null> => {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await updateGRN(grn.id, {
        assignedTo,
        grnDate: grnDate || undefined,
        lineItems: editedLineItems,
        noOfBoxes: noOfBoxes ? parseInt(noOfBoxes, 10) : undefined,
        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : undefined,
        lastBoxUnits: lastBoxUnitsStr.trim() ? parseInt(lastBoxUnitsStr, 10) : null,
        locationPrefix: locationPrefix || undefined,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        qcStatus: qcStatus as string,
        qcBy: qcBy || undefined,
        ...payload,
      });
      const updated: GRNRecord = {
        id: res.id,
        grnNo: res.grnNo,
        poNo: res.poNo,
        vendor: res.vendor,
        type: res.type as GRNType,
        items: res.items,
        poValue: res.poValue,
        expectedDate: res.expectedDate,
        receivedDate: res.receivedDate,
        assignedTo: res.assignedTo,
        qcStatus: normalizeQcStatus(res.qcStatus),
        qcBy: res.qcBy || '',
        status: res.status as GRNStatus,
        lineItems: res.lineItems,
        workflowSteps: (res.workflowSteps || []) as WorkflowStep[],
        invoiceNo: res.invoiceNo ?? undefined,
        invoiceAmount: res.invoiceAmount ?? undefined,
        grnDate: res.grnDate ?? undefined,
        noOfBoxes: res.noOfBoxes ?? undefined,
        unitsPerBox: res.unitsPerBox ?? undefined,
        lastBoxUnits: res.lastBoxUnits ?? undefined,
        locationPrefix: res.locationPrefix ?? undefined,
        grnBatchMfg: res.grnBatchMfg ?? undefined,
        expiry: res.expiry ?? undefined,
        mfgBatch: res.mfgBatch ?? undefined,
        generatedLabels: res.generatedLabels ?? undefined,
      };
      onSaveChanges(updated);
      if (payload.status === 'GRN Complete') {
        // Planning batch availability depends on warehouse inventory (SIH) and planning-extracted derived data.
        // Invalidate so the Planning screen refreshes without a full page reload.
        queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
        queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
        queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
        onClose();
      }
      return updated;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = () => {
    void persistUpdate({});
  };

  const runGenerateLabels = async () => {
    if (qcStatus !== 'Passed') {
      setLabelError('QC must be Passed before generating labels.');
      return;
    }
    if (!qcBy.trim()) {
      setLabelError('Assign QC by before generating labels.');
      return;
    }
    if (!assignedTo.trim()) {
      setLabelError('Assign this GRN (Assigned To) before generating labels.');
      return;
    }
    if (!selectedLineItemId || !selectedLineItem) {
      setLabelError('Please select a product / line item before generating labels.');
      return;
    }
    const numBoxes = Math.max(1, parseInt(noOfBoxes, 10) || 1);
    const numUnitsPerBox = parseInt(unitsPerBox, 10) || 0;
    if (selectedLineItem != null) {
      const pack = labelPackagingMatchesRcvd(
        selectedLineItem.rcvdQty,
        numBoxes,
        numUnitsPerBox,
        lastBoxUnitsStr
      );
      if (!pack.ok) {
        setLabelError(pack.message);
        return;
      }
    }
    const wasRegenerating = Boolean(labelItemCodeOnFile && labelsAreForSelectedLine);
    setLabelError(null);
    setGeneratingLabels(true);
    try {
      const saved = await persistUpdate({});
      if (!saved) {
        addToast('error', 'Could not save changes. Fix the error above, then try again.');
        return;
      }
      const res = await generateGRNLabels(grn.id, {
        noOfBoxes: numBoxes,
        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : undefined,
        lastBoxUnits: lastBoxUnitsStr.trim() ? parseInt(lastBoxUnitsStr, 10) : null,
        locationPrefix: locationPrefix || undefined,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        productName: selectedLineItem?.item || undefined,
        itemCode: selectedLineItem?.itemCode || undefined,
      });
      setLabels(res.labels);
      setLabelsGenerated(true);
      if (res.workflowSteps) {
        setCurrentWorkflowSteps(res.workflowSteps as WorkflowStep[]);
      }
      const merged: GRNRecord = {
        ...saved,
        generatedLabels: res.labels,
        workflowSteps: (res.workflowSteps ?? saved.workflowSteps) as WorkflowStep[],
      };
      onSaveChanges(merged);
      addToast(
        'success',
        wasRegenerating ? 'QR labels regenerated with your updates.' : 'QR labels generated.',
      );
    } catch (e: unknown) {
      const err = e as { status?: number; body?: { error?: string }; message?: string };
      const status = err?.status;
      const bodyError =
        err?.body && typeof err.body === 'object' && 'error' in err.body
          ? (err.body as { error?: string }).error
          : undefined;
      const msg = bodyError || (e instanceof Error ? e.message : 'Failed to generate labels');
      setLabelError(msg);
      if (status === 403) {
        addToast(
          'error',
          'QC must be Passed on the server before labels can be generated. Save failed or QC was not persisted.',
        );
      } else {
        addToast('error', msg);
      }
    } finally {
      setGeneratingLabels(false);
    }
  };

  const completionBlockers: string[] = [];
  if (qcStatus !== 'Passed') completionBlockers.push('QC status must be Passed.');
  if (!qcBy.trim()) completionBlockers.push('QC by (inspector name) is required.');
  if (!assignedTo.trim()) completionBlockers.push('Assigned To must be allocated.');
  if (!(labelsGenerated || currentWorkflowSteps.includes('Label Generation'))) {
    completionBlockers.push('QR labels must be generated.');
  }
  const canMarkComplete = completionBlockers.length === 0;

  const activeLabel: GeneratedLabel | null =
    labels && labels.length > 0
      ? labels.find((l) => l.boxIndex === selectedLabelBoxIndex) ?? labels[0]
      : null;

  const handleCompleteGRN = () => {
    if (!canMarkComplete) {
      setSaveError(`Cannot mark complete yet: ${completionBlockers.join(' ')}`);
      return;
    }
    void persistUpdate({
      status: 'GRN Complete',
      qcStatus: 'Passed',
      workflowSteps: WORKFLOW_STEPS_REQUIRED,
    });
  };

  const getWorkflowStepColor = (step: WorkflowStep) => {
    if (!currentWorkflowSteps.length) return 'bg-slate-100 text-slate-600 border-slate-300';

    const stepIndex = WORKFLOW_STEPS_REQUIRED.indexOf(step);
    const completedUpTo = WORKFLOW_STEPS_REQUIRED.findIndex(s => !currentWorkflowSteps.includes(s));

    if (currentWorkflowSteps.includes(step)) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    } else if (completedUpTo === stepIndex) {
      return 'bg-amber-100 text-amber-700 border-amber-300';
    }
    return 'bg-slate-100 text-slate-600 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">GRN — {grn.grnNo}</h2>
            <p className="text-sm text-slate-600 mt-0.5">{grn.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Status, type, QC */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${currentWorkflowSteps.length === WORKFLOW_STEPS_REQUIRED.length
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-amber-100 text-amber-700 border-amber-300'
              }`}>
              {grn.status}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-xs font-semibold">
              {grn.type}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${qcStatus === 'Passed' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                qcStatus === 'Rejected' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                  qcStatus === 'Quality checked' ? 'bg-sky-100 text-sky-700 border-sky-300' :
                    'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
              QC: {qcStatus}
              {qcBy && <span className="ml-1 opacity-90">({qcBy})</span>}
            </span>
          </div>

          {/* QC section: status + QC by (for label generation) */}
          <section className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">QC status &amp; QC by</h3>
            <p className="text-xs text-slate-600">Labels (QR) can only be generated after QC is Passed. Select QC status and the user who performed QC.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">QC status</label>
                <select
                  value={qcStatus}
                  onChange={(e) => setQcStatus(e.target.value as QCStatus)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {qcStatus !== 'Passed' && qcStatus !== 'Rejected' && (
                    <option value={qcStatus} disabled>{qcStatus}</option>
                  )}
                  {QC_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">QC by</label>
                <input
                  type="text"
                  value={qcByInput}
                  onChange={(e) => {
                    setQcByInput(e.target.value);
                    const match = assignableUsers.find(u => (u.displayName || '').toLowerCase() === e.target.value.trim().toLowerCase());
                    if (match) setQcBy(match.displayName);
                    else setQcBy(e.target.value.trim());
                    setShowQcByDropdown(true);
                  }}
                  onFocus={() => setShowQcByDropdown(true)}
                  onBlur={() => setTimeout(() => setShowQcByDropdown(false), 200)}
                  placeholder="Type name to search registered users"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {showQcByDropdown && (filteredQcByUsers.length > 0 || assignableUsers.length > 0) && (
                  <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                    {(qcByInput.trim() ? filteredQcByUsers : assignableUsers).slice(0, 10).map((u) => (
                      <li
                        key={u.id}
                        onMouseDown={() => {
                          setQcBy(u.displayName);
                          setQcByInput(u.displayName);
                          setShowQcByDropdown(false);
                        }}
                        className="px-4 py-2 text-sm text-slate-800 hover:bg-amber-50 cursor-pointer"
                      >
                        {u.displayName}
                        {u.email && <span className="text-slate-500 text-xs block">{u.email}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Workflow Steps */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {WORKFLOW_STEPS_REQUIRED.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${getWorkflowStepColor(step)}`}
                >
                  {currentWorkflowSteps.includes(step) ? 'Done' : '-'} {step}
                </div>
                {idx < WORKFLOW_STEPS_REQUIRED.length - 1 && (
                  <span className="text-slate-400 text-lg">&gt;</span>
                )}
              </div>
            ))}
          </div>

          {/* PO Details Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">PO & shipment</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">GRN NO.</p>
                <p className="text-sm font-mono font-bold text-blue-600">{grn.grnNo}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO NO.</p>
                <p className="text-sm font-mono font-bold text-emerald-600">{grn.poNo}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Vendor</p>
                <p className="text-sm font-medium text-slate-900">{grn.vendor}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO Value</p>
                <p className="text-sm font-bold text-amber-700">₹{grn.poValue.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Expected Date</p>
                <p className="text-sm font-medium text-slate-900">{new Date(grn.expectedDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Received Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
              {grn.invoiceNo && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Invoice No.</p>
                  <p className="text-sm font-mono font-medium text-slate-900">{grn.invoiceNo}</p>
                </div>
              )}
              {grn.invoiceAmount && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Invoice Amount</p>
                  <p className="text-sm font-bold text-amber-700">₹{grn.invoiceAmount.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          </section>

          {/* Assign GRN Team Section */}
          <section className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Assign & dates</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.displayName}>{u.displayName}</option>
                  ))}
                  {assignedTo && !assignableUsers.some((u) => u.displayName === assignedTo) && (
                    <option value={assignedTo}>{assignedTo}</option>
                  )}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  GRN Date
                </label>
                <input
                  type="date"
                  value={grnDate}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          {grn.lineItems && grn.lineItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Line items — qty</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">PO QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">RCVD QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Invoice QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Unit Price</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editedLineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-left">
                          <div className="font-medium text-slate-900">{item.item}</div>
                          <div className="text-slate-500">{item.itemCode}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-slate-900">{item.poQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={item.rcvdQty}
                            onChange={(e) => handleLineItemChange(item.id, 'rcvdQty', e.target.value)}
                            className="w-16 px-3 py-2 border-2 border-blue-300 rounded-lg bg-white text-slate-900 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-slate-900">{item.invoiceQty}</td>
                        <td className="px-3 py-2 text-center font-medium text-amber-600">₹{item.unitPrice}</td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const calculatedDiff = item.rcvdQty - item.poQty; // positive = over-received, negative = shortfall
                            return (
                              <span className={`font-bold ${calculatedDiff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {calculatedDiff === 0 ? '0' : calculatedDiff > 0 ? `+${calculatedDiff}` : calculatedDiff}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Label data & Generate QR Labels */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Labels (QR per box)</h3>
            <p className="text-xs text-slate-600">One QR per box for this GRN. Each box gets a unique QR (Box 1, Box 2, …) with product, GRN, units in that box, location, batch, and expiry. If received quantity does not divide evenly into full cartons (e.g. 49 items, 20 per carton), set <strong>Last box (remainder)</strong> so (full boxes × units/box) + last box = received qty. <strong>Generate Labels</strong> saves first, then creates QR codes.</p>
            {qcStatus !== 'Passed' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <strong>QC must be Passed</strong> before generating labels. Set QC status to &quot;Passed&quot;, assign &quot;QC by&quot;, and allocate &quot;Assigned To&quot;, then use Generate Labels (it will save automatically).
              </div>
            )}

            {/* Product / Line Item Selection */}
            {editedLineItems.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select product / line item <span className="text-red-500">*</span></label>
                <select
                  value={selectedLineItemId}
                  onChange={(e) => {
                    setSelectedLineItemId(e.target.value);
                    setLabelError(null);
                  }}
                  className={`w-full px-2 py-1.5 border rounded text-sm ${!selectedLineItemId ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                >
                  <option value="">— Select a product —</option>
                  {editedLineItems.map((li) => (
                    <option key={li.id} value={li.id}>{li.item} ({li.itemCode}) — PO Qty: {li.poQty}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">No of boxes</label>
                <input type="number" min={1} value={noOfBoxes} onChange={(e) => setNoOfBoxes(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Units/box (full carton)</label>
                <input type="number" min={0} value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last box (remainder)</label>
                <input
                  type="number"
                  min={0}
                  value={lastBoxUnitsStr}
                  onChange={(e) => setLastBoxUnitsStr(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  placeholder="e.g. 9 for 2×20 + 9"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Optional. Leave empty when every box has the same count. Must be ≤ full carton size.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location prefix (rack code)</label>
                <input
                  type="text"
                  value={locationPrefix}
                  onChange={(e) => setLocationPrefix(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  placeholder="e.g. A1-L2-S3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GRN batch mfg</label>
                <input type="text" value={grnBatchMfg} onChange={(e) => setGrnBatchMfg(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry</label>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mfg batch</label>
                <input type="text" value={mfgBatch} onChange={(e) => setMfgBatch(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                {needsGenerateForSelection && (
                  <button
                    type="button"
                    onClick={() => void runGenerateLabels()}
                    disabled={generatingLabels || saving || qcStatus !== 'Passed' || !selectedLineItemId}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : generatingLabels ? 'Generating…' : 'Generate Labels'}
                  </button>
                )}
                {labelsAreForSelectedLine && labelsGenerated && labels && labels.length > 0 && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 max-w-xl">
                    Labels on file match this line. Change boxes, rack/location, or batch above, then use{' '}
                    <strong>Regenerate all QR labels</strong> in the preview section to update every box QR.
                  </p>
                )}
              </div>
              {labelItemCodeOnFile && selectedLineItem && !labelsAreForSelectedLine && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xl">
                  Saved QR labels are for item <span className="font-mono font-semibold">{labelItemCodeOnFile}</span>.
                  Select another line or use <strong>Generate Labels</strong> to create QR codes for{' '}
                  <span className="font-semibold">{selectedLineItem.item}</span> (this replaces the previous set for this GRN).
                </p>
              )}
            </div>
            {labelError && <p className="text-sm text-red-600">{labelError}</p>}
          </section>

          {/* QR Label Preview — dropdown to pick a box; regenerate updates all QRs from form fields */}
          {labelsGenerated && labels && labels.length > 0 && activeLabel && labelsAreForSelectedLine && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Label preview (one QR per box)</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Select generated label</label>
                  <select
                    value={selectedLabelBoxIndex ?? activeLabel.boxIndex}
                    onChange={(e) => setSelectedLabelBoxIndex(parseInt(e.target.value, 10) || null)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                  >
                    {labels.map((label) => {
                      let unitsSummary = '—';
                      try {
                        const p = JSON.parse(label.qrPayload) as { units_per_box?: number };
                        unitsSummary = p.units_per_box != null ? String(p.units_per_box) : '—';
                      } catch {
                        unitsSummary = '—';
                      }
                      return (
                        <option key={label.boxIndex} value={label.boxIndex}>
                          Box {label.boxIndex} — {unitsSummary} units
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void runGenerateLabels()}
                  disabled={generatingLabels || saving || qcStatus !== 'Passed' || !selectedLineItemId}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : generatingLabels ? 'Regenerating…' : 'Regenerate all QR labels'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Updating applies to <strong>all</strong> boxes (same product line, packaging, and location fields). Pick a box here to inspect its QR; then adjust fields in &quot;Labels (QR per box)&quot; above and regenerate.
              </p>
              {(() => {
                const label = activeLabel;
                let payload: {
                  grn_id?: number;
                  grn_no?: string;
                  product_name?: string;
                  item_code?: string;
                  units_per_box?: number;
                  full_carton_units?: number;
                  partial_last_box?: boolean;
                  location_prefix?: string;
                  toRack?: string | null;
                  toZone?: string | null;
                  rack?: string | null;
                  zone?: string | null;
                  grn_batch_mfg?: string;
                  expiry?: string;
                  mfg_batch?: string;
                  box_index?: number;
                } = {};
                try {
                  payload = JSON.parse(label.qrPayload);
                } catch {
                  payload = {};
                }
                return (
                  <div className="bg-white border-2 border-slate-300 rounded-lg p-4 shadow-sm max-w-md">
                    <div className="text-center mb-2">
                      <p className="text-xs font-mono font-bold text-slate-900">Box {label.boxIndex}</p>
                    </div>
                    <div className="flex justify-center mb-3">
                      <img src={label.qrImageDataUrl} alt={`QR Box ${label.boxIndex}`} className="w-40 h-40 object-contain" />
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      {payload.product_name && (
                        <p>
                          <span className="font-semibold">Product:</span> {payload.product_name}
                        </p>
                      )}
                      {payload.item_code && (
                        <p>
                          <span className="font-semibold">Item code:</span> {payload.item_code}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold">GRN:</span> {payload.grn_no || payload.grn_id}
                      </p>
                      <p>
                        <span className="font-semibold">Units in this box:</span> {payload.units_per_box}
                      </p>
                      {payload.full_carton_units != null && (
                        <p>
                          <span className="font-semibold">Full carton size:</span> {payload.full_carton_units}
                        </p>
                      )}
                      {payload.partial_last_box && <p className="text-amber-700 font-medium">Partial last carton</p>}
                      <p>
                        <span className="font-semibold">Rack:</span>{' '}
                        {payload.toRack || payload.rack || payload.location_prefix || '—'}
                      </p>
                      <p>
                        <span className="font-semibold">Zone:</span> {payload.toZone || payload.zone || '—'}
                      </p>
                      <p>
                        <span className="font-semibold">Batch mfg:</span> {payload.grn_batch_mfg || '—'}
                      </p>
                      <p>
                        <span className="font-semibold">Expiry:</span> {payload.expiry || '—'}
                      </p>
                      <p>
                        <span className="font-semibold">Mfg batch:</span> {payload.mfg_batch || '—'}
                      </p>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">On scan: decoder shows all text above + action (e.g. View GRN).</p>
                  </div>
                );
              })()}

              {/* On scan: simulate paste payload → show all text + action */}
              {/* <div className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">On scan — show all text &amp; action</h4>
                <p className="text-xs text-slate-600 mb-2">Paste the QR payload (JSON) below to simulate a scan. The decoder will show all decoded fields and the suggested action.</p>
                <ScanSimulator grnNo={grn.grnNo} />
              </div> */}
            </section>
          )}

          {/* Save error */}
          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleSaveOnly}
              disabled={saving}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={handleCompleteGRN}
              disabled={saving || !canMarkComplete}
              className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${grn.status === 'In Transit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {grn.status === 'In Transit' ? 'Complete GRN & Initiate Stock' : 'Mark complete'}
            </button>
            {!canMarkComplete && (
              <p className="w-full text-right text-xs text-amber-700">
                Mark complete is disabled until: {completionBlockers.join(' ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function mapApiToGRNRecord(r: {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: 'RM' | 'PM';
  items: number;
  poValue: number;
  expectedDate: string;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: string;
  qcBy?: string;
  status: string;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  grnDate?: string | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
}): GRNRecord {
  return {
    id: r.id,
    grnNo: r.grnNo,
    poNo: r.poNo,
    vendor: r.vendor,
    type: r.type,
    items: r.items,
    poValue: r.poValue,
    expectedDate: r.expectedDate,
    receivedDate: r.receivedDate,
    assignedTo: r.assignedTo,
    qcStatus: normalizeQcStatus(r.qcStatus),
    qcBy: r.qcBy ?? '',
    status: r.status as GRNStatus,
    lineItems: r.lineItems,
    workflowSteps: r.workflowSteps,
    invoiceNo: r.invoiceNo ?? undefined,
    invoiceAmount: r.invoiceAmount ?? undefined,
    grnDate: r.grnDate ?? undefined,
    noOfBoxes: r.noOfBoxes ?? undefined,
    unitsPerBox: r.unitsPerBox ?? undefined,
    lastBoxUnits: r.lastBoxUnits ?? undefined,
    locationPrefix: r.locationPrefix ?? undefined,
    grnBatchMfg: r.grnBatchMfg ?? undefined,
    expiry: r.expiry ?? undefined,
    mfgBatch: r.mfgBatch ?? undefined,
    generatedLabels: r.generatedLabels ?? undefined,
  };
}

const WarehouseInbound = () => {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Under GRN' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [grnData, setGrnData] = useState<GRNRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedGRN, setSelectedGRN] = useState<GRNRecord | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>('');

  useEffect(() => {
    fetchGRNList()
      .then((list) => {
        setGrnData(list.map(mapApiToGRNRecord));
      })
      .catch(() => {
        setGrnData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchGRNAssignableUsers()
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
  }, []);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastRef.current) window.clearTimeout(toastRef.current);
    setToast({ message, type });
    toastRef.current = window.setTimeout(() => {
      setToast(null);
      toastRef.current = null;
    }, 2500);
  };

  // Handle saving changes from modal back to dashboard
  const handleSaveChanges = (updatedGRN: GRNRecord) => {
    setGrnData(prev =>
      prev.map(grn => (grn.grnNo === updatedGRN.grnNo ? updatedGRN : grn))
    );
    setSelectedGRN(updatedGRN);
  };

  // Helper function to check if all workflow steps are completed
  const isGRNReady = (grn: GRNRecord): boolean => {
    if (!grn.workflowSteps || grn.workflowSteps.length === 0) return false;
    return WORKFLOW_STEPS_REQUIRED.every(step => grn.workflowSteps?.includes(step));
  };

  // Calculate stats
  const totalGRNs = grnData.length;
  const underGRN = grnData.filter(g => g.status === 'Under GRN').length;
  const onHold = grnData.filter(g => g.status === 'On Hold').length;
  const inTransit = grnData.filter(g => g.status === 'In Transit').length;
  const completed = grnData.filter(g => g.status === 'GRN Complete').length;

  // Filter data based on tab and search
  const filteredData = grnData.filter(grn => {
    // Tab filter
    if (activeTab === 'Pending' && grn.status !== 'Pending' && grn.status !== 'In Transit') return false;
    if (activeTab === 'Under GRN' && grn.status !== 'Under GRN') return false;
    if (activeTab === 'Completed' && grn.status !== 'GRN Complete') return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        grn.grnNo.toLowerCase().includes(query) ||
        grn.poNo.toLowerCase().includes(query) ||
        grn.vendor.toLowerCase().includes(query) ||
        grn.assignedTo.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getQCStatusColor = (status: QCStatus) => {
    switch (status) {
      case 'Passed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Failed':
        return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getStatusColor = (status: GRNStatus) => {
    switch (status) {
      case 'GRN Complete':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Under GRN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'In Transit':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'On Hold':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Delayed':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Pending':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/80 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-3 py-2 rounded-lg border text-sm font-medium shadow-lg ${toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Inbound</h1>
          <p className="text-sm text-slate-600 mt-1">Goods receipt notes — receive, check, and complete GRNs</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Total GRNs</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{totalGRNs}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Under GRN</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{underGRN}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hidden sm:block">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">On Hold</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{onHold}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">In Transit</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{inTransit}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{completed}</p>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Pending', 'Under GRN', 'Completed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GRN, PO, vendor…"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">GRN No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">PO No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">PO Value</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Received</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">QC</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading GRNs…</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">No GRNs found</td>
                  </tr>
                ) : (
                  filteredData.map((grn) => (
                    <tr
                      key={grn.id}
                      className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedGRN(grn)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedGRN(grn); } }}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-mono font-medium text-blue-600">{grn.grnNo}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-mono text-emerald-600">{grn.poNo}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-slate-800">{grn.vendor}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${grn.type === 'RM'
                            ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                            : 'bg-violet-100 text-violet-700 border-violet-200'
                          }`}>
                          {grn.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-700">{grn.items}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-amber-700">{formatCurrency(grn.poValue)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-slate-600">{formatDate(grn.expectedDate)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {grn.receivedDate ? (
                          <span className="text-sm text-slate-600">{formatDate(grn.receivedDate)}</span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm ${grn.assignedTo === 'Unassigned' ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                          {grn.assignedTo}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getQCStatusColor(grn.qcStatus)}`}>
                          {grn.qcStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(grn.status)}`}>
                          {grn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRN Detail Modal */}
        {selectedGRN && <GRNDetailModal grn={selectedGRN} onClose={() => setSelectedGRN(null)} onSaveChanges={handleSaveChanges} assignableUsers={assignableUsers} />}
      </div>
    </div>
  );
};

export default WarehouseInbound;
