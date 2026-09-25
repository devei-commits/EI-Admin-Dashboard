import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Search, X, Printer } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import {
  fetchGRNList, fetchGRNById, updateGRN, fetchGRNAssignableUsers, fetchGRNQcReference, grnLineItemDisplayName,
  type AssignableUser, type GeneratedLabel,
} from '../../services/grn.service';
import { readGrnBatchesMeta } from '../../lib/inboundGrnBatchesMeta';
import { readGrnPackagingMeta } from '../../lib/inboundGrnPackagingMeta';
import { printPackLabels } from '../../lib/grnPackLabelPrint';
import { GrnQcInspectionPanel } from '../../components/warehouse/GrnQcInspectionPanel';
import {
  deriveGrnQcStatusFromSpecs,
  grnQcCompletionBlockers,
  type GrnQcSpecsStored,
} from '../../lib/grnQcSpecs';
import {
  findGrnLineItemByIdOrCode,
  normalizeGrnLineItemIds,
} from '../../lib/grnLineItemIds';
import { SortableTableTh, type SortDirection } from '../../components/ui/SortableTableTh';
import {
  fetchFacilityAreas,
  ensureCustomZoneAndRack,
  type FacilityAreaDTO,
  type ZoneDTO,
} from '../../services/facilityAreas.service';
import {
  INBOUND_GRN_SOURCE_TABS,
  inboundGrnSourceEmptyMessage,
  matchesInboundGrnSourceTab,
  resolveGrnReceiptSource,
  type InboundGrnSourceTab,
} from '../../lib/inboundGrnSourceFilter';
import GrnCopyReceiptModal from '../../components/warehouse/GrnCopyReceiptModal';
import GroupedGrnReceiptModal from '../../components/warehouse/GroupedGrnReceiptModal';
import GrnPostRackingPhotosSection from '../../components/warehouse/GrnPostRackingPhotosSection';
import type { EvidencePhoto } from '../../components/warehouse/StockCheckEvidenceCapture';
import {
  inboundSourceDocRequirementLabel,
  isInboundSourceDocUploaded,
  INBOUND_SOURCE_DOC_REQUIREMENTS,
  type InboundGrnSourceDocuments,
} from '../../lib/inboundGrnSourceDocs';
import { printGrnCopyPdf } from '../../lib/grnCopyPdfPrint';
import {
  buildInboundGrnTableRowView,
  buildInboundGrnSlaView,
  displayInboundGrnNo,
  formatInboundQty,
  inboundShipmentSortValue,
  formatInboundSourceDocSet,
  formatInboundStorage,
  inboundGrnArrivalConfirmPayload,
  inboundGrnSlaClass,
  inboundGrnStatusClass,
  resolveInboundWarehouseCode,
  type InboundGrnRowInput,
} from '../../lib/inboundGrnTableDisplay';
import { inboundGrnRackAssignedPayload, inboundGrnSendToQcPayload, INBOUND_GRN_RACK_ASSIGNED_STEP } from '../../lib/inboundGrnStatus';
import { requiredGrnDocsError } from '../../lib/grnCopyReceiptDisplay';
import {
  buildPostRackingPhotosMeta,
  extractPostRackingRackTargets,
  postRackingPhotoBlockers,
} from '../../lib/grnPostRackingPhotos';
import {
  buildQualityOrderManagementRowForGrnLine,
  type QualityOrderManagementInput,
  type QualityOrderManagementRow,
} from '../../lib/qualityOrderManagementTableDisplay';
import QualityCheckModal from '../../components/quality/QualityCheckModal';
import QcQuickDecisionModal from '../../components/quality/QcQuickDecisionModal';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { procInputClass, procChipClass } from '../../components/procurement/ProcSection';

type GRNType = 'RM' | 'PM';
type QCStatus = 'Under test' | 'Quality checked' | 'Passed' | 'Rejected';
type GRNStatus = 'GRN Complete' | 'Under GRN' | 'In Transit' | 'On Hold' | 'Delayed' | 'Pending' | 'Verified';

/** Map legacy API qc_status to QCStatus */
function normalizeQcStatus(s: string | undefined): QCStatus {
  const v = (s || '').trim();
  if (v === 'Passed') return 'Passed';
  if (v === 'Rejected' || v === 'Failed') return 'Rejected';
  if (v === 'Quality checked') return 'Under test';
  return 'Under test';
}

/** Display-only GRN formatter: remove legacy "PO" token from GRN number. */
function displayGrnNo(grnNo: string | null | undefined): string {
  const raw = String(grnNo ?? '').trim();
  if (!raw) return '—';
  return raw.replace(/^GRN-PO-/i, 'GRN-');
}
type WorkflowStep = 'PO Received' | 'Qty Check' | 'QC Inspection' | 'Label Generation' | 'Dispatch Ready';

const WORKFLOW_STEPS_REQUIRED: WorkflowStep[] = ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'];

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

const GRN_QTY_EPSILON = 0.0001;

function parseGrnQty(raw: string | number | null | undefined): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function grnQtysEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= GRN_QTY_EPSILON;
}

function validateUnitsPerBoxList(
  rcvdQty: number,
  unitsList: number[]
): { ok: true } | { ok: false; message: string } {
  const total = unitsList.reduce((s, n) => s + (Number(n) || 0), 0);
  const remaining = rcvdQty - total;
  if (!grnQtysEqual(remaining, 0)) {
    const remainingRounded = Math.round(remaining * 1000) / 1000;
    return {
      ok: false,
      message: `Sum of Units/box must equal received quantity. Remaining: ${remainingRounded > 0 ? remainingRounded : 0}, over by: ${remainingRounded < 0 ? -remainingRounded : 0}.`,
    };
  }
  return { ok: true };
}

interface LineItem {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
  /** Quantity shipped on this line's truck; undefined for direct-PO/legacy lines. */
  shippedQty?: number;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  unit?: string;
  diff?: number;
  qcStatus: 'Pass' | 'Hold' | 'Pending' | 'Fail';
  qcBy: string;
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
  labelGenerated?: boolean;
  generatedLabels?: GeneratedLabel[] | null;
}

interface GRNRecord {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: GRNType;
  receiptSource?: string;
  purchaseOrderId?: number | null;
  items: number;
  poValue: number;
  expectedDate?: string | null;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: QCStatus;
  qcBy: string;
  qcSpecs?: GrnQcSpecsStored | null;
  status: GRNStatus;
  invoiceNo?: string;
  invoiceAmount?: number;
  grnDate?: string;
  createdAt?: string | null;
  /** GRN-level shipped total (shipment batch); fallback for legacy lines lacking per-line shippedQty. */
  shippedQty?: number | null;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  locationZone?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
}

type InboundSortColumn =
  | 'shipment'
  | 'grnNo'
  | 'po'
  | 'loc'
  | 'item'
  | 'poQty'
  | 'shipped'
  | 'received'
  | 'storage'
  | 'sourceDoc'
  | 'status'
  | 'sla'
  | 'related';

interface InboundTableRow {
  rowId: string;
  grn: GRNRecord;
  lineItem: LineItem | null;
}

type InboundReceiptModalState = {
  grn: GRNRecord;
  lineItem: LineItem;
  mode: 'confirm-receipt' | 'grn-copy';
} | null;

function grnRecordToQualityInput(grn: GRNRecord, lineItem: LineItem | null): QualityOrderManagementInput {
  return {
    id: grn.id,
    grnNo: grn.grnNo,
    poNo: grn.poNo,
    vendor: grn.vendor,
    type: grn.type,
    status: grn.status,
    qcStatus: grn.qcStatus,
    assignedTo: grn.assignedTo,
    qcBy: grn.qcBy,
    grnDate: grn.grnDate ?? null,
    // Drives the "GRN Date" column — when the record was created, not the shipment date.
    createdAt: grn.createdAt ?? null,
    receivedDate: grn.receivedDate,
    expectedDate: grn.expectedDate ?? null,
    receiptSource: grn.receiptSource,
    purchaseOrderId: grn.purchaseOrderId,
    locationZone: grn.locationZone,
    workflowSteps: grn.workflowSteps,
    generatedLabels: grn.generatedLabels,
    shippedQty: grn.shippedQty,
    lineItems: lineItem
      ? [
          {
            item: lineItem.item,
            itemCode: lineItem.itemCode,
            poQty: lineItem.poQty,
            shippedQty: lineItem.shippedQty,
            rcvdQty: lineItem.rcvdQty,
            diff: lineItem.diff,
            unit: lineItem.unit,
            qcStatus: lineItem.qcStatus,
          },
        ]
      : grn.lineItems,
  };
}

function openInboundRowAction(
  grn: GRNRecord,
  lineItem: LineItem | null,
  actionLabel: string,
  openReceipt: (state: InboundReceiptModalState) => void,
  openDetail: (grn: GRNRecord, lineItem?: LineItem | null, mode?: 'detail' | 'assign-rack') => void,
  onConfirmArrival?: (grn: GRNRecord) => void,
  onSendToQc?: (grn: GRNRecord) => void,
  onOpenQcCheck?: (grn: GRNRecord, lineItem: LineItem | null) => void,
  onOpenQcDecision?: (grn: GRNRecord, lineItem: LineItem | null) => void,
): void {
  if (actionLabel === 'Send to QC' && onSendToQc) {
    onSendToQc(grn);
    return;
  }
  if (actionLabel === 'QC Check' && onOpenQcCheck) {
    onOpenQcCheck(grn, lineItem);
    return;
  }
  if (actionLabel === 'Awaiting QC' && onOpenQcDecision) {
    onOpenQcDecision(grn, lineItem);
    return;
  }
  if (actionLabel === 'Assign Rack') {
    openDetail(grn, lineItem, 'assign-rack');
    return;
  }
  // Receiving runs entirely through the staged modal — vehicle/shipment details, documents, pack
  // counts, QC and quarantine all live there. The monolithic GRN detail modal is no longer part of
  // this flow; 'Complete GRN' and any unmatched label land in the staged flow too rather than
  // dropping the operator into a single all-at-once form.
  //
  // A GRN whose line items did not resolve renders one row with lineItem = null, so recover the
  // line from the GRN itself; only a GRN with no line at all can't be shown staged.
  const line = lineItem ?? (Array.isArray(grn.lineItems) ? (grn.lineItems[0] ?? null) : null);
  if (line) {
    openReceipt({
      grn,
      lineItem: line,
      mode: actionLabel === 'Confirm Receipt' ? 'confirm-receipt' : 'grn-copy',
    });
    return;
  }
  // No resolvable line — the staged modal cannot open. Arrival confirmation still has a direct
  // fallback (this was the 'Confirm' branch's behaviour before both labels were merged).
  if (actionLabel === 'Confirm Receipt' && onConfirmArrival) {
    onConfirmArrival(grn);
    return;
  }
  openDetail(grn);
}

function toInboundRowInput(grn: GRNRecord, lineItem: LineItem | null): InboundGrnRowInput {
  return {
    grnNo: grn.grnNo,
    poNo: grn.poNo,
    vendor: grn.vendor,
    status: grn.status,
    qcStatus: grn.qcStatus,
    receiptSource: grn.receiptSource,
    purchaseOrderId: grn.purchaseOrderId,
    // "GRN Date" (formatInboundShipmentLabel) prefers createdAt over grnDate/receivedDate/expectedDate
    // — a fresh in-transit GRN has neither grnDate nor receivedDate yet, so omitting createdAt here
    // fell through all the way to expectedDate (the ETA), making "GRN Date" and "SLA · ETA" show the
    // identical estimated-arrival date instead of when the GRN was actually raised.
    createdAt: grn.createdAt,
    expectedDate: grn.expectedDate,
    receivedDate: grn.receivedDate,
    grnDate: grn.grnDate,
    locationZone: grn.locationZone,
    locationPrefix: grn.locationPrefix,
    assignedTo: grn.assignedTo,
    grnBatchMfg: grn.grnBatchMfg,
    mfgBatch: grn.mfgBatch,
    noOfBoxes: grn.noOfBoxes,
    unitsPerBox: grn.unitsPerBox,
    invoiceNo: grn.invoiceNo,
    workflowSteps: grn.workflowSteps,
    generatedLabels: grn.generatedLabels,
    sourceDocuments: grn.sourceDocuments,
    lineItemsCount: Array.isArray(grn.lineItems) ? grn.lineItems.length : 0,
    lineItem: lineItem
      ? {
          item: lineItem.item,
          itemCode: lineItem.itemCode,
          poQty: lineItem.poQty,
          rcvdQty: lineItem.rcvdQty,
          unit: lineItem.unit,
          diff: lineItem.diff,
          qcStatus: lineItem.qcStatus,
        }
      : null,
  };
}

function compareSortValues(av: string | number, bv: string | number, direction: SortDirection): number {
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  return direction === 'asc' ? cmp : -cmp;
}

function sortValueForInboundRow(row: InboundTableRow, col: InboundSortColumn): string | number {
  const { grn, lineItem } = row;
  const input = toInboundRowInput(grn, lineItem);
  switch (col) {
    case 'shipment':
      // Sort on the instant, not the "24-Jul" label — the label sorts alphabetically.
      return inboundShipmentSortValue(input);
    case 'grnNo':
      return displayInboundGrnNo(grn.grnNo);
    case 'po':
      return grn.poNo ?? '';
    case 'loc':
      return resolveInboundWarehouseCode(input, lineItem);
    case 'item':
      return lineItem ? `${lineItem.item} ${lineItem.itemCode}` : '';
    case 'poQty':
      return lineItem?.poQty ?? -1;
    case 'shipped':
      return lineItem?.shippedQty ?? grn.shippedQty ?? -1;
    case 'received':
      return lineItem?.rcvdQty ?? -1;
    case 'storage':
      return formatInboundStorage(input);
    case 'sourceDoc':
      return formatInboundSourceDocSet(input).uploaded;
    case 'status':
      return grn.status || '';
    case 'sla':
      return buildInboundGrnSlaView(input).label;
    case 'related':
      return buildInboundGrnTableRowView(input).relatedPrimary ?? '';
    default:
      return '';
  }
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
        aria-label="Paste QR payload"
        placeholder='Paste QR payload e.g. {"grn_no":"GRN-001","box_index":1,...}'
        rows={2}
        className="w-full text-xs font-mono border border-border rounded-lg px-3 py-2 bg-surface"
      />
      {parseError && <p className="text-xs text-err">{parseError}</p>}
      {decoded && !parseError && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-2 uppercase">Decoded (all text)</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink">
            {Object.entries(decoded).map(([k, v]) => (
              <span key={k} className="col-span-2 sm:col-span-1"><dt className="inline font-medium">{k}:</dt> <dd className="inline">{String(v ?? '—')}</dd></span>
            ))}
          </dl>
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-ok">Action</p>
            <p className="text-sm text-ink">View GRN {(decoded as { grn_no?: string }).grn_no || grnNo} in Warehouse → Inbound (open this GRN popup).</p>
            <p className="text-[10px] text-ink-3 mt-1">When material moves to MU, a new QR set can be generated for MTR/location; scan then shows move-related action.</p>
          </div>
        </div>
      )}
    </div>
  );
};

function zoneDisplayLabel(zone: ZoneDTO): string {
  const zl = zone.zoneLabel?.trim();
  if (zl) return zl;
  return `${zone.code} — ${zone.name}`.trim();
}

/** Match saved GRN rack code to a rack under Facility Management (warehouse areas). */
function matchGrnLocationToFacility(
  locationPrefix: string | null | undefined,
  areas: FacilityAreaDTO[]
): { areaId: number; zoneId: number; rackId: number } | null {
  const prefix = (locationPrefix || '').trim();
  if (!prefix) return null;
  for (const area of areas) {
    for (const zone of area.zones || []) {
      for (const rack of zone.racks || []) {
        if (String(rack.code).trim() === prefix) {
          return { areaId: area.id, zoneId: zone.id, rackId: rack.id };
        }
      }
    }
  }
  return null;
}

// GRN Detail Modal Component
const GRNDetailModal = ({
  grn,
  mode = 'detail',
  focusLineItem = null,
  onClose,
  onSaveChanges,
  assignableUsers = [],
}: {
  grn: GRNRecord;
  mode?: 'detail' | 'assign-rack';
  focusLineItem?: LineItem | null;
  onClose: () => void;
  onSaveChanges: (updatedGRN: GRNRecord) => void;
  assignableUsers?: AssignableUser[];
}) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: facilityAreasRaw = [], isLoading: facilityAreasLoading } = useQuery({
    queryKey: ['facility-areas', 'warehouse', 'grn-modal'],
    queryFn: async () => {
      const res = await fetchFacilityAreas('warehouse');
      return res.success ? res.data : [];
    },
  });
  const facilityAreasData = useMemo(() => facilityAreasRaw as FacilityAreaDTO[], [facilityAreasRaw]);
  const [assignedTo, setAssignedTo] = useState(grn.assignedTo || '');
  const [grnDate, setGrnDate] = useState(grn.grnDate || new Date().toISOString().split('T')[0]);
  const [editedLineItems, setEditedLineItems] = useState<LineItem[]>(() =>
    normalizeGrnLineItemIds((grn.lineItems || []).map(li => ({
      ...li,
      rcvdQty: (li.rcvdQty != null && li.rcvdQty !== 0) ? li.rcvdQty : li.poQty,
      labelGenerated: Boolean((li as { labelGenerated?: boolean; label_generated?: boolean }).labelGenerated ?? (li as { labelGenerated?: boolean; label_generated?: boolean }).label_generated),
      generatedLabels: Array.isArray((li as { generatedLabels?: GeneratedLabel[]; generated_labels?: GeneratedLabel[] }).generatedLabels)
        ? (li as { generatedLabels?: GeneratedLabel[]; generated_labels?: GeneratedLabel[] }).generatedLabels ?? null
        : Array.isArray((li as { generatedLabels?: GeneratedLabel[]; generated_labels?: GeneratedLabel[] }).generated_labels)
          ? (li as { generatedLabels?: GeneratedLabel[]; generated_labels?: GeneratedLabel[] }).generated_labels ?? null
          : null,
    })))
  );
  const [labels, setLabels] = useState<GeneratedLabel[] | null>(null);
  /** Which box's label is shown in the preview dropdown (1-based box index from API). */
  const [selectedLabelBoxIndex, setSelectedLabelBoxIndex] = useState<number | null>(null);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>(() =>
    editedLineItems.length > 0 ? editedLineItems[0].id : '',
  );
  const [noOfBoxes, setNoOfBoxes] = useState(String(grn.noOfBoxes ?? 1));
  const [unitsPerBoxListStr, setUnitsPerBoxListStr] = useState<string[]>([]);
  const [locationPrefix, setLocationPrefix] = useState(grn.locationPrefix ?? '');
  const [locationZone, setLocationZone] = useState(grn.locationZone ?? '');
  /** Use Facility Management hierarchy vs free-text (legacy / edge cases). */
  const [locationSource, setLocationSource] = useState<'facility' | 'custom'>('facility');
  const [selectedAreaId, setSelectedAreaId] = useState<number | ''>('');
  const [selectedZoneId, setSelectedZoneId] = useState<number | ''>('');
  const [selectedRackId, setSelectedRackId] = useState<number | ''>('');
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
  const [qcSpecs, setQcSpecs] = useState<GrnQcSpecsStored | null>(grn.qcSpecs ?? null);
  const [qcSpecsLoading, setQcSpecsLoading] = useState(false);
  const [qcSpecsError, setQcSpecsError] = useState<string | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<InboundGrnSourceDocuments>(
    () => ({ ...(grn.sourceDocuments ?? {}) }),
  );
  const [postRackingPhotosByRack, setPostRackingPhotosByRack] = useState<Record<string, EvidencePhoto[]>>({});

  const assignRackLineItem =
    (focusLineItem ? findGrnLineItemByIdOrCode(editedLineItems, focusLineItem) : undefined) ??
    editedLineItems.find((li) => li.id === selectedLineItemId) ??
    editedLineItems[0] ??
    null;

  const selectedLineItem =
    editedLineItems.find((li) => li.id === selectedLineItemId) ??
    (focusLineItem ? findGrnLineItemByIdOrCode(editedLineItems, focusLineItem) : undefined) ??
    editedLineItems[0] ??
    null;

  const postRackingRackTargets = useMemo(
    () =>
      extractPostRackingRackTargets({
        locationPrefix,
        locationZone,
        generatedLabels: labels ?? grn.generatedLabels,
        lineItems: editedLineItems,
        warehouseCode: resolveInboundWarehouseCode(
          {
            grnNo: grn.grnNo,
            locationZone,
            locationPrefix: grn.locationPrefix,
            lineItem: assignRackLineItem
              ? {
                  item: assignRackLineItem.item,
                  itemCode: assignRackLineItem.itemCode,
                  poQty: assignRackLineItem.poQty,
                  rcvdQty: assignRackLineItem.rcvdQty,
                  unit: assignRackLineItem.unit,
                }
              : null,
          },
          assignRackLineItem
            ? {
                item: assignRackLineItem.item,
                itemCode: assignRackLineItem.itemCode,
                poQty: assignRackLineItem.poQty,
                rcvdQty: assignRackLineItem.rcvdQty,
                unit: assignRackLineItem.unit,
              }
            : null,
        ),
      }),
    [
      assignRackLineItem,
      editedLineItems,
      grn.generatedLabels,
      grn.grnNo,
      grn.locationPrefix,
      labels,
      locationPrefix,
      locationZone,
    ],
  );

  const parsedNoOfBoxes = Math.max(1, parseInt(noOfBoxes, 10) || 1);
  const parsedUnitsPerBoxList = unitsPerBoxListStr.map((v) => Math.max(0, parseGrnQty(v)));
  const totalUnitsAllocated = parsedUnitsPerBoxList.reduce((s, n) => s + n, 0);
  const remainingUnitsForSelectedLine = selectedLineItem
    ? Math.max(0, Math.round((selectedLineItem.rcvdQty - totalUnitsAllocated) * 1000) / 1000)
    : 0;
  const overAllocatedUnits = selectedLineItem
    ? Math.max(0, Math.round((totalUnitsAllocated - selectedLineItem.rcvdQty) * 1000) / 1000)
    : 0;
  const unitsFullyAllocated =
    selectedLineItem != null && grnQtysEqual(totalUnitsAllocated, selectedLineItem.rcvdQty);

  const labelsGenerated = Boolean(labels && labels.length > 0);

  // Pack labels (one per physical pack, from GRN Copy's packaging list — separate from the box-QR
  // put-away labels above). Reprintable here too, from the same packaging + batch data, independent
  // of whether box labels were ever generated.
  const packagingMeta = useMemo(() => readGrnPackagingMeta(sourceDocuments), [sourceDocuments]);
  const batchesMeta = useMemo(() => readGrnBatchesMeta(sourceDocuments), [sourceDocuments]);
  const packLabelCtx = useMemo(
    () => ({
      batches: batchesMeta.rows ?? [],
      productName: grnLineItemDisplayName(selectedLineItem),
      productCode: selectedLineItem?.itemCode ?? '',
      vendor: grn.vendor,
      unit: selectedLineItem?.unit,
    }),
    [batchesMeta.rows, selectedLineItem, grn.vendor],
  );
  const reprintPackGridRef = useRef<HTMLDivElement>(null);
  const handleReprintPackLabels = () => {
    const rows = packagingMeta.rows ?? [];
    if (!rows.length) return;
    const canvases = reprintPackGridRef.current
      ? Array.from(reprintPackGridRef.current.querySelectorAll<HTMLCanvasElement>('canvas'))
      : [];
    const qrDataUrls = rows.map((_, i) => canvases[i]?.toDataURL('image/png') ?? '');
    if (!printPackLabels(rows, qrDataUrls, packLabelCtx)) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
    }
  };

  const handleDownloadGrnCopy = () => {
    const docRequirements = INBOUND_SOURCE_DOC_REQUIREMENTS[resolveGrnReceiptSource(grn)];
    const documents = docRequirements.map((req) => {
      const entry = sourceDocuments?.[req.key];
      return {
        label: req.label,
        uploaded: isInboundSourceDocUploaded(entry),
        fileName: entry?.fileName ?? entry?.ref ?? null,
      };
    });
    const ok = printGrnCopyPdf({
      grnNo: grn.grnNo,
      poNo: grn.poNo,
      vendor: grn.vendor,
      type: grn.type,
      status: grn.status,
      receivedDate: grn.receivedDate,
      grnDate,
      invoiceNo: grn.invoiceNo,
      invoiceAmount: grn.invoiceAmount,
      assignedTo,
      qcStatus,
      qcBy,
      locationZone,
      locationPrefix,
      documents,
      lineItems: editedLineItems.map((li) => ({
        item: li.item,
        itemCode: li.itemCode,
        poQty: li.poQty,
        shippedQty: li.shippedQty,
        rcvdQty: li.rcvdQty,
        invoiceQty: li.invoiceQty,
        unitPrice: li.unitPrice,
        diff: li.rcvdQty - li.poQty,
        qcStatus: li.qcStatus,
      })),
    });
    if (!ok) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
    }
  };

  const labeledLineItemCodes = useMemo(() => {
    const set = new Set<string>();
    for (const li of editedLineItems) {
      const code = String(li?.itemCode || '').trim().toLowerCase();
      if (!code) continue;
      if (li.labelGenerated || (Array.isArray(li.generatedLabels) && li.generatedLabels.length > 0)) set.add(code);
    }
    const legacyCode = parseItemCodeFromGeneratedLabels(grn.generatedLabels ?? null);
    if (legacyCode) set.add(legacyCode.trim().toLowerCase());
    return set;
  }, [editedLineItems, grn.generatedLabels]);
  const allLineItemsLabeled =
    editedLineItems.length > 0 &&
    editedLineItems.every((li) => labeledLineItemCodes.has(String(li.itemCode || '').trim().toLowerCase()));

  useEffect(() => {
    if (mode === 'assign-rack' && focusLineItem) {
      const match = findGrnLineItemByIdOrCode(editedLineItems, focusLineItem);
      if (match) setSelectedLineItemId(match.id);
    }
  }, [focusLineItem, mode, editedLineItems]);

  useEffect(() => {
    const activeId =
      selectedLineItemId ||
      (focusLineItem ? findGrnLineItemByIdOrCode(editedLineItems, focusLineItem)?.id : undefined) ||
      editedLineItems[0]?.id ||
      '';
    if (!activeId) {
      setLabels(null);
      return;
    }
    const li = editedLineItems.find((x) => x.id === activeId);
    const next = Array.isArray(li?.generatedLabels) ? li.generatedLabels : null;
    setLabels(next);
  }, [selectedLineItemId, editedLineItems, focusLineItem]);

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

  useEffect(() => {
    setUnitsPerBoxListStr((prev) => {
      const n = Math.max(1, parseInt(noOfBoxes, 10) || 1);
      const next = Array.from({ length: n }, (_, i) => prev[i] ?? '0');
      return next;
    });
  }, [noOfBoxes]);

  useEffect(() => {
    if (!labels || labels.length === 0) return;
    const values = [...labels]
      .sort((a, b) => a.boxIndex - b.boxIndex)
      .map((label) => {
        try {
          const p = JSON.parse(label.qrPayload || '{}') as { units_per_box?: number };
          return String(p.units_per_box ?? 0);
        } catch {
          return '0';
        }
      });
    if (values.length > 0) {
      setNoOfBoxes(String(values.length));
      setUnitsPerBoxListStr(values);
    }
  }, [labels]);

  /** When reopening a GRN, preselect first line that already has labels (line-level first, legacy fallback second). */
  useEffect(() => {
    if (selectedLineItemId) return;
    const withLineLabels = editedLineItems.find((li) => Array.isArray(li.generatedLabels) && li.generatedLabels.length > 0);
    if (withLineLabels) {
      setSelectedLineItemId(withLineLabels.id);
      return;
    }
    const legacyCode = parseItemCodeFromGeneratedLabels(grn.generatedLabels ?? null);
    if (legacyCode) {
      const match = editedLineItems.find((li) => String(li.itemCode).trim().toLowerCase() === legacyCode.trim().toLowerCase());
      if (match) {
        setSelectedLineItemId(match.id);
        return;
      }
    }
    if (editedLineItems.length > 0) setSelectedLineItemId(editedLineItems[0].id);
  }, [grn.id, grn.generatedLabels, editedLineItems, selectedLineItemId]);

  useEffect(() => {
    setQcBy(grn.qcBy || '');
    setQcByInput(grn.qcBy || '');
  }, [grn.id, grn.qcBy]);

  useEffect(() => {
    let cancelled = false;
    setQcSpecsLoading(true);
    setQcSpecsError(null);
    void fetchGRNQcReference(grn.id)
      .then((res) => {
        if (cancelled) return;
        setQcSpecs(res.qcSpecs);
        setQcStatus(normalizeQcStatus(res.derivedQcStatus || grn.qcStatus));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setQcSpecsError(e instanceof Error ? e.message : 'Could not load QC specs');
      })
      .finally(() => {
        if (!cancelled) setQcSpecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grn.id]);

  useEffect(() => {
    if (!qcSpecs) return;
    setQcStatus(normalizeQcStatus(deriveGrnQcStatusFromSpecs(qcSpecs)));
  }, [qcSpecs]);

  useEffect(() => {
    if (facilityAreasLoading) return;
    const areas = facilityAreasData;
    if (areas.length === 0) {
      setLocationSource('custom');
      setSelectedAreaId('');
      setSelectedZoneId('');
      setSelectedRackId('');
      setLocationPrefix(grn.locationPrefix ?? '');
      setLocationZone(grn.locationZone ?? '');
      return;
    }
    const m = matchGrnLocationToFacility(grn.locationPrefix, areas);
    if (m) {
      setLocationSource('facility');
      setSelectedAreaId(m.areaId);
      setSelectedZoneId(m.zoneId);
      setSelectedRackId(m.rackId);
    } else {
      setLocationSource('custom');
      setSelectedAreaId('');
      setSelectedZoneId('');
      setSelectedRackId('');
      setLocationPrefix(grn.locationPrefix ?? '');
      setLocationZone(grn.locationZone ?? '');
    }
  }, [grn.id, grn.locationPrefix, grn.locationZone, facilityAreasData, facilityAreasLoading]);

  useEffect(() => {
    if (locationSource !== 'facility') return;
    const area = facilityAreasData.find((a) => a.id === selectedAreaId);
    const zone = area?.zones?.find((z) => z.id === selectedZoneId);
    const rack = zone?.racks?.find((r) => r.id === selectedRackId);
    if (zone) setLocationZone(zoneDisplayLabel(zone));
    else setLocationZone('');
    if (rack) setLocationPrefix(rack.code);
    else setLocationPrefix('');
  }, [locationSource, selectedAreaId, selectedZoneId, selectedRackId, facilityAreasData]);

  const selectedArea = useMemo(
    () => facilityAreasData.find((a) => a.id === selectedAreaId),
    [facilityAreasData, selectedAreaId]
  );
  const zoneOptions = selectedArea?.zones ?? [];
  const selectedZone = useMemo(
    () => zoneOptions.find((z) => z.id === selectedZoneId),
    [zoneOptions, selectedZoneId]
  );
  const rackOptionsSorted = useMemo(() => {
    const racks = selectedZone?.racks ?? [];
    return [...racks].sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  }, [selectedZone]);

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
            field === 'rcvdQty' ? parseGrnQty(value) : value,
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

  const persistUpdate = async (payload: { status?: string; qcStatus?: string; qcFastTrack?: boolean; workflowSteps?: string[] }): Promise<GRNRecord | null> => {
    setSaveError(null);
    setSaving(true);
    try {
      let putawayPrefix = locationPrefix;
      let putawayZone = locationZone;
      if (locationSource === 'custom' && locationZone.trim() && locationPrefix.trim()) {
        const ensured = await ensureCustomZoneAndRack({
          areaType: 'warehouse',
          zoneText: locationZone.trim(),
          rackText: locationPrefix.trim(),
        });
        if (!ensured.success || !ensured.data?.rackCode) {
          throw new Error(ensured.error || 'Could not register custom zone and rack in the main warehouse.');
        }
        putawayPrefix = ensured.data.rackCode;
        putawayZone = ensured.data.zoneName || ensured.data.zoneCode || putawayZone;
        setLocationPrefix(putawayPrefix);
        setLocationZone(putawayZone);
        queryClient.invalidateQueries({ queryKey: ['facility-areas'] });
        queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
      }

      const mergedSourceDocuments: InboundGrnSourceDocuments = {
        ...sourceDocuments,
        postRackingPhotos: buildPostRackingPhotosMeta(
          Object.fromEntries(
            postRackingRackTargets.map((rack) => [
              rack.rackCode,
              postRackingPhotosByRack[rack.rackCode] ?? [],
            ]),
          ),
        ),
      };

      const res = await updateGRN(grn.id, {
        assignedTo,
        grnDate: grnDate || undefined,
        lineItems: editedLineItems,
        noOfBoxes: noOfBoxes ? parseInt(noOfBoxes, 10) : undefined,
        locationPrefix: putawayPrefix || undefined,
        locationZone: putawayZone || undefined,
        locationSource,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        qcSpecs: qcSpecs ?? undefined,
        qcBy: qcBy || undefined,
        sourceDocuments: mergedSourceDocuments,
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
        receivedDate: res.receivedDate,
        assignedTo: res.assignedTo,
        qcStatus: normalizeQcStatus(res.qcStatus),
        qcBy: res.qcBy || '',
        qcSpecs: res.qcSpecs ?? qcSpecs,
        status: res.status as GRNStatus,
        lineItems: res.lineItems,
        workflowSteps: (res.workflowSteps || []) as WorkflowStep[],
        invoiceNo: res.invoiceNo ?? undefined,
        invoiceAmount: res.invoiceAmount ?? undefined,
        grnDate: res.grnDate ?? undefined,
        noOfBoxes: res.noOfBoxes ?? undefined,
        unitsPerBox: res.unitsPerBox ?? undefined,
        locationPrefix: res.locationPrefix ?? undefined,
        locationZone: res.locationZone ?? undefined,
        grnBatchMfg: res.grnBatchMfg ?? undefined,
        expiry: res.expiry ?? undefined,
        mfgBatch: res.mfgBatch ?? undefined,
        generatedLabels: res.generatedLabels ?? undefined,
        sourceDocuments: res.sourceDocuments ?? mergedSourceDocuments,
      };
      setSourceDocuments(mergedSourceDocuments);
      onSaveChanges(updated);
      // Any GRN status/stage change (Landed → Under GRN → Complete) must refresh Procurement's
      // GRN Monitor (['grn-list']) and the issued-PO timeline (po-tracking caches), which live in
      // a different module and are otherwise never invalidated from Warehouse.
      queryClient.invalidateQueries({ queryKey: ['grn-list'] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking'] });
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

  /**
   * Assign Rack is not the end of the flow: it records where the stock goes, then GRN Copy prints
   * the labels (which carry this rack code) and completes the GRN. Saving and closing puts the row
   * back in the list, where its action is GRN Copy.
   */
  const handleSaveAndContinueToGrnCopy = async (): Promise<void> => {
    // Send the status/step advance explicitly. This called persistUpdate({}) with an empty payload,
    // so rack, zone and photos saved while `status` and `workflow_steps` were never touched — the
    // GRN stayed on "On Hold" with an empty stepper and the save looked like it had done nothing.
    const saved = await persistUpdate(
      // `grn.workflowSteps` and `grn.qcStatus`, not `currentWorkflowSteps`/`qcStatus`: those are
      // useState initializers that never re-run, so if QC was approved (a separate modal) after
      // this one was already open, they'd still hold the pre-approval values — releaseFromHold
      // would read false, the GRN would stay On Hold, and the "QC Inspection" step would never be
      // stamped (GRN-2026-0100).
      inboundGrnRackAssignedPayload({
        status: grn.status,
        qcStatus: grn.qcStatus,
        workflowSteps: grn.workflowSteps,
      }),
    );
    if (!saved) return;
    addToast('success', 'Put-away saved. Open GRN Copy to generate labels and complete this GRN.');
    onClose();
  };

  const qcTestBlockers = grnQcCompletionBlockers(qcSpecs);
  const isAssignRackMode = mode === 'assign-rack';
  const completionBlockers: string[] = [];
  if (!isAssignRackMode) {
    if (qcStatus !== 'Passed') {
      if (qcTestBlockers.length > 0) completionBlockers.push(...qcTestBlockers);
      else completionBlockers.push('QC status must be Passed (complete all master quality tests).');
    }
    if (!qcBy.trim()) completionBlockers.push('QC by (inspector name) is required.');
  }
  // Unlike QC/labels, this one is NOT mode-gated: GrnCopyReceiptModal's own completion check
  // (putawayMissing in GrnCopyReceiptModal.tsx) requires grn.assignedTo to be set before it will
  // mark the GRN complete. Letting Assign Rack save with "Unassigned" (as a prior fix here did,
  // reasoning the field was just being "re-picked") persists assignedTo: '' and permanently blocks
  // GRN Copy's Accept from ever completing the GRN — see GRN-2026-0186, which stayed stuck on
  // "Under GRN" through repeated Accept clicks because of exactly this.
  if (!assignedTo.trim()) completionBlockers.push('Assigned To must be allocated.');
  // Labels are NOT a blocker for this step. The rack code is printed on the QR labels, so the rack
  // is chosen first and GRN Copy — where labels are generated — is the last step. Requiring labels
  // here inverted that order and deadlocked the pair: GRN Copy asked for a rack, Assign Rack asked
  // for labels. This step now saves the put-away and hands off; GRN Copy finishes the GRN.
  const labelsPendingForHandoff = isAssignRackMode && !allLineItemsLabeled;
  if (!allLineItemsLabeled && !isAssignRackMode) {
    completionBlockers.push('QR labels must be generated in GRN Copy for all GRN materials.');
  }
  if (!locationPrefix.trim()) {
    completionBlockers.push(
      locationSource === 'facility'
        ? 'Select area, zone, and rack from Facility Management (or use Custom).'
        : 'Location prefix (rack code) is required.',
    );
  }
  if (!locationZone.trim()) {
    completionBlockers.push(
      locationSource === 'facility'
        ? 'Zone label is required (choose zone + rack from Facility Management).'
        : 'Storage zone is required.',
    );
  }
  if (mode === 'assign-rack') {
    completionBlockers.push(
      ...postRackingPhotoBlockers(
        postRackingRackTargets,
        Object.fromEntries(
          Object.entries(postRackingPhotosByRack).map(([rackCode, photos]) => [
            rackCode,
            { length: photos.length },
          ]),
        ),
        sourceDocuments.postRackingPhotos,
      ),
    );
  }
  const canMarkComplete = completionBlockers.length === 0;

  const activeLabel: GeneratedLabel | null =
    labels && labels.length > 0
      ? labels.find((l) => l.boxIndex === selectedLabelBoxIndex) ?? labels[0]
      : null;

  const handlePrintActiveLabel = () => {
    if (!activeLabel) return;
    let payload: {
      product_name?: string;
      item_code?: string;
      grn_no?: string;
      grn_id?: number;
      box_index?: number;
      units_per_box?: number;
      location_prefix?: string;
      toRack?: string | null;
      rack?: string | null;
      toZone?: string | null;
      zone?: string | null;
      grn_batch_mfg?: string;
      expiry?: string;
      mfg_batch?: string;
    } = {};
    try {
      payload = JSON.parse(activeLabel.qrPayload || '{}');
    } catch {
      payload = {};
    }

    const printWin = window.open('', '_blank', 'width=520,height=760');
    if (!printWin) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
      return;
    }

    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rack = payload.toRack || payload.rack || payload.location_prefix || '—';
    const zone = payload.toZone || payload.zone || '—';
    const grnDisplay = displayGrnNo(String(payload.grn_no || payload.grn_id || grn.grnNo || ''));

    printWin.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QR Label - ${esc(displayGrnNo(grn.grnNo))} - Box ${esc(activeLabel.boxIndex)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
      .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; width: 320px; }
      .head { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
      .img-wrap { text-align: center; margin-bottom: 8px; }
      img { width: 190px; height: 190px; object-fit: contain; }
      p { margin: 4px 0; font-size: 12px; }
      strong { font-weight: 700; }
      @media print { body { padding: 0; } .card { border: 1px solid #000; } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="head">GRN ${esc(displayGrnNo(grn.grnNo))} - Box ${esc(activeLabel.boxIndex)}</div>
      <div class="img-wrap"><img src="${esc(activeLabel.qrImageDataUrl)}" alt="QR Box ${esc(activeLabel.boxIndex)}" /></div>
      <p><strong>Product:</strong> ${esc(payload.product_name || '—')}</p>
      <p><strong>Item code:</strong> ${esc(payload.item_code || '—')}</p>
      <p><strong>GRN:</strong> ${esc(grnDisplay)}</p>
      <p><strong>Units:</strong> ${esc(payload.units_per_box ?? '—')}</p>
      <p><strong>Rack:</strong> ${esc(rack)}</p>
      <p><strong>Zone:</strong> ${esc(zone)}</p>
      <p><strong>Batch mfg:</strong> ${esc(payload.grn_batch_mfg || '—')}</p>
      <p><strong>Expiry:</strong> ${esc(payload.expiry || '—')}</p>
      <p><strong>Mfg batch:</strong> ${esc(payload.mfg_batch || '—')}</p>
    </div>
    <script>
      window.onload = function () {
        window.print();
        window.onafterprint = function () { window.close(); };
      };
    </script>
  </body>
</html>`);
    printWin.document.close();
  };

  const handlePrintAllLabels = () => {
    if (!labels || labels.length === 0) return;
    const printWin = window.open('', '_blank', 'width=900,height=760');
    if (!printWin) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
      return;
    }
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const cardsHtml = [...labels]
      .sort((a, b) => a.boxIndex - b.boxIndex)
      .map((label) => {
        let payload: {
          product_name?: string;
          item_code?: string;
          grn_no?: string;
          grn_id?: number;
          units_per_box?: number;
          toRack?: string | null;
          rack?: string | null;
          toZone?: string | null;
          zone?: string | null;
          location_prefix?: string;
          grn_batch_mfg?: string;
          expiry?: string;
          mfg_batch?: string;
        } = {};
        try {
          payload = JSON.parse(label.qrPayload || '{}');
        } catch {
          payload = {};
        }
        const rack = payload.toRack || payload.rack || payload.location_prefix || '—';
        const zone = payload.toZone || payload.zone || '—';
        const grnDisplay = displayGrnNo(String(payload.grn_no || payload.grn_id || grn.grnNo || ''));
        return `
          <article class="card">
            <div class="head">GRN ${esc(displayGrnNo(grn.grnNo))} - Box ${esc(label.boxIndex)}</div>
            <div class="img-wrap"><img src="${esc(label.qrImageDataUrl)}" alt="QR Box ${esc(label.boxIndex)}" /></div>
            <p><strong>Product:</strong> ${esc(payload.product_name || '—')}</p>
            <p><strong>Item code:</strong> ${esc(payload.item_code || '—')}</p>
            <p><strong>GRN:</strong> ${esc(grnDisplay)}</p>
            <p><strong>Units:</strong> ${esc(payload.units_per_box ?? '—')}</p>
            <p><strong>Rack:</strong> ${esc(rack)}</p>
            <p><strong>Zone:</strong> ${esc(zone)}</p>
            <p><strong>Batch mfg:</strong> ${esc(payload.grn_batch_mfg || '—')}</p>
            <p><strong>Expiry:</strong> ${esc(payload.expiry || '—')}</p>
            <p><strong>Mfg batch:</strong> ${esc(payload.mfg_batch || '—')}</p>
          </article>
        `;
      })
      .join('');

    printWin.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QR Labels - ${esc(displayGrnNo(grn.grnNo))}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
      .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; break-inside: avoid; }
      .head { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
      .img-wrap { text-align: center; margin-bottom: 8px; }
      img { width: 170px; height: 170px; object-fit: contain; }
      p { margin: 3px 0; font-size: 11px; }
      strong { font-weight: 700; }
      @media print {
        body { padding: 0; }
        .card { border: 1px solid #000; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="grid">${cardsHtml}</div>
    <script>
      window.onload = function () {
        window.print();
        window.onafterprint = function () { window.close(); };
      };
    </script>
  </body>
</html>`);
    printWin.document.close();
  };

  const handleCompleteGRN = () => {
    if (!canMarkComplete) {
      setSaveError(`Cannot mark complete yet: ${completionBlockers.join(' ')}`);
      return;
    }
    // Additive, not a replace: this used to send the bare WORKFLOW_STEPS_REQUIRED list, which
    // has no 'Rack Assigned' entry — a GRN put away to a rack literally coded DEFAULT would then
    // never satisfy the backend's completion gate (it requires that exact stamp to prove Assign
    // Rack actually ran), no matter how many times the rack was saved. Union with `grn.workflowSteps`
    // (the fresh prop, not `currentWorkflowSteps` — see handleSaveAndContinueToGrnCopy) so any
    // steps already recorded survive too.
    const steps = Array.from(
      new Set([...(grn.workflowSteps ?? []), ...WORKFLOW_STEPS_REQUIRED, INBOUND_GRN_RACK_ASSIGNED_STEP]),
    );
    // By the time Complete GRN is reachable, QC already passed (fast-tracked or full checklist) —
    // canMarkComplete above deliberately skips re-checking the checklist in assign-rack mode. But
    // re-asserting qcStatus: 'Passed' here still hits the backend's validateQcSpecsForPassed gate,
    // which 400s with "No QC tests available" for a fast-tracked GRN that never had a checklist
    // (GRN-2026-0290). qcFastTrack tells the backend this Passed status doesn't need re-validating,
    // same as Assign Rack's own save (see inboundGrnRackAssignedPayload).
    void persistUpdate({
      status: 'GRN Complete',
      qcStatus: 'Passed',
      qcFastTrack: true,
      workflowSteps: steps,
    });
  };

  const getWorkflowStepColor = (step: WorkflowStep) => {
    if (!currentWorkflowSteps.length) return 'bg-surface-3 text-ink-2 border-border';

    const stepIndex = WORKFLOW_STEPS_REQUIRED.indexOf(step);
    const completedUpTo = WORKFLOW_STEPS_REQUIRED.findIndex(s => !currentWorkflowSteps.includes(s));

    if (currentWorkflowSteps.includes(step)) {
      return 'bg-ok-soft text-ok border-ok';
    } else if (completedUpTo === stepIndex) {
      return 'bg-warn-soft text-warn border-warn';
    }
    return 'bg-surface-3 text-ink-2 border-border';
  };

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="default">
      <div className="bg-surface rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="grn-detail-modal-title" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            {mode === 'assign-rack' ? (
              <>
                <h2 id="grn-detail-modal-title" className="text-lg font-bold text-ink">
                  📍 Assign Rack — {displayGrnNo(grn.grnNo)}{' '}
                  {assignRackLineItem?.item || '—'}
                  {assignRackLineItem?.itemCode ? ` · ${assignRackLineItem.itemCode}` : ''}
                </h2>
                <p className="text-xs text-ink-2 mt-1">
                  {resolveInboundWarehouseCode(
                    {
                      grnNo: grn.grnNo,
                      locationZone,
                      locationPrefix,
                      lineItem: assignRackLineItem
                        ? {
                            item: assignRackLineItem.item,
                            itemCode: assignRackLineItem.itemCode,
                            poQty: assignRackLineItem.poQty,
                            rcvdQty: assignRackLineItem.rcvdQty,
                            unit: assignRackLineItem.unit,
                          }
                        : null,
                    },
                    assignRackLineItem
                      ? {
                          item: assignRackLineItem.item,
                          itemCode: assignRackLineItem.itemCode,
                          poQty: assignRackLineItem.poQty,
                          rcvdQty: assignRackLineItem.rcvdQty,
                          unit: assignRackLineItem.unit,
                        }
                      : null,
                  )}{' '}
                  · QC TESTED PASS ·{' '}
                  {assignRackLineItem
                    ? `${formatInboundQty(assignRackLineItem.rcvdQty)} ${assignRackLineItem.unit || 'units'} to rack`
                    : '—'}
                </p>
              </>
            ) : (
              <h2 id="grn-detail-modal-title" className="text-lg font-bold text-ink">GRN — {displayGrnNo(grn.grnNo)}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {grn.status === 'GRN Complete' && (
              <button
                type="button"
                onClick={handleDownloadGrnCopy}
                title="Download a printable GRN copy (item details, documents checklist, QC, and quantities)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-ink-2 text-xs font-semibold hover:bg-surface-2 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden />
                Download GRN Copy (PDF)
              </button>
            )}
            {labelsGenerated && labels && labels.length > 0 && (
              <button
                type="button"
                onClick={handlePrintAllLabels}
                title={`Reprint the ${labels.length} saved box QR label${labels.length === 1 ? '' : 's'} for this GRN`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-press transition-colors"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden />
                Print box label{labels.length === 1 ? '' : 's'}
              </button>
            )}
            {(packagingMeta.rows?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleReprintPackLabels}
                title={`Reprint the ${packagingMeta.rows!.length} pack label${packagingMeta.rows!.length === 1 ? '' : 's'} for this GRN`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-ink-2 text-xs font-semibold hover:bg-surface-2 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden />
                Print pack label{packagingMeta.rows!.length === 1 ? '' : 's'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-3 rounded-lg transition-colors text-ink-2"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Hidden (display:none — canvas drawing isn't tied to visibility), always-mounted QR
            canvases backing the "Print pack labels" button above. */}
        <div aria-hidden className="hidden" ref={reprintPackGridRef}>
          {(packagingMeta.rows ?? []).map((row) => (
            <QRCodeCanvas key={row.packagingNo} value={row.packagingNo} size={132} includeMargin />
          ))}
        </div>

        <div className="p-6 space-y-8">
          {/* Status, type, QC */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${currentWorkflowSteps.length === WORKFLOW_STEPS_REQUIRED.length
                ? 'bg-ok-soft text-ok border-ok'
                : 'bg-warn-soft text-warn border-warn'
              }`}>
              {grn.status}
            </span>
            <span className="px-3 py-1 bg-brand-soft text-brand border border-brand rounded-full text-xs font-semibold">
              {grn.type}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${qcStatus === 'Passed' ? 'bg-ok-soft text-ok border-ok' :
                qcStatus === 'Rejected' ? 'bg-err-soft text-err border-err' :
                  qcStatus === 'Quality checked' ? 'bg-brand-soft text-brand border-brand' :
                    'bg-surface-3 text-ink border-border'
              }`}>
              QC: {qcStatus}
              {qcBy && <span className="ml-1 opacity-90">({qcBy})</span>}
            </span>
          </div>

          {/* QC section: master specs + QC by — read-only during assign rack */}
          {!isAssignRackMode ? (
          <section className="bg-surface-2/80 rounded-xl p-5 border border-border/80 space-y-4">
            <h3 className="text-sm font-semibold text-ink-2">QC inspection &amp; QC by</h3>
            <p className="text-xs text-ink-2">
              Tests are loaded from the RM/PM master <strong>Quality Specifications</strong>. Rows marked <strong>Mand</strong> in the master must be tested (result + Pass). Optional tests may be left pending.
            </p>
            <GrnQcInspectionPanel
              qcSpecs={qcSpecs}
              loading={qcSpecsLoading}
              error={qcSpecsError}
              disabled={saving}
              onChange={setQcSpecs}
            />
            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">
                  Overall QC status
                </label>
                <div
                  className={`w-full px-4 py-3 border rounded-lg text-sm font-semibold ${
                    qcStatus === 'Passed'
                      ? 'bg-ok-soft border-ok text-ok'
                      : qcStatus === 'Rejected'
                        ? 'bg-err-soft border-err text-err'
                        : 'bg-surface-2 border-border text-ink-2'
                  }`}
                >
                  {qcStatus}
                  <span className="block text-[10px] font-normal text-ink-3 mt-1">
                    Derived from master quality tests (not manually set).
                  </span>
                </div>
              </div>
              <div className="flex-1 relative">
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">
                  QC by <span className="text-err">*</span>
                </label>
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
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand"
                />
                {showQcByDropdown && (filteredQcByUsers.length > 0 || assignableUsers.length > 0) && (
                  <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
                    {(qcByInput.trim() ? filteredQcByUsers : assignableUsers).slice(0, 10).map((u) => (
                      <li
                        key={u.id}
                        onMouseDown={() => {
                          setQcBy(u.displayName);
                          setQcByInput(u.displayName);
                          setShowQcByDropdown(false);
                        }}
                        className="px-4 py-2 text-sm text-ink hover:bg-brand-soft cursor-pointer"
                      >
                        {u.displayName}
                        {u.email && <span className="text-ink-3 text-xs block">{u.email}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
          ) : (
            <section className="rounded-xl border border-ok bg-ok-soft/80 px-4 py-3 text-sm text-ok">
              <strong>QC passed.</strong> Assign the put-away rack and upload post-racking photos here. The rack code
              is then printed on the QR labels, which are generated in <strong>GRN Copy</strong> — the final step,
              where the GRN is completed.
            </section>
          )}

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
                  <span className="text-ink-4 text-lg">&gt;</span>
                )}
              </div>
            ))}
          </div>

          {/* GRN Details Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2">GRN & shipment</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <p className="text-xs text-ink-2 uppercase tracking-wider font-semibold mb-1">GRN NO.</p>
                <p className="text-sm font-mono font-bold text-brand">{displayGrnNo(grn.grnNo)}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <p className="text-xs text-ink-2 uppercase tracking-wider font-semibold mb-1">Received Date</p>
                <p className="text-sm font-medium text-ink">
                  {grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
              {grn.invoiceNo && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <p className="text-xs text-ink-2 uppercase tracking-wider font-semibold mb-1">Invoice No.</p>
                  <p className="text-sm font-mono font-medium text-ink">{grn.invoiceNo}</p>
                </div>
              )}
              {grn.invoiceAmount && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <p className="text-xs text-ink-2 uppercase tracking-wider font-semibold mb-1">Invoice Amount</p>
                  <p className="text-sm font-bold text-brand">₹{grn.invoiceAmount.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          </section>

          {/* Assign GRN Team Section */}
          <section className="bg-surface-2/80 rounded-xl p-5 border border-border/80 space-y-4">
            <h3 className="text-sm font-semibold text-ink-2">Assign & dates</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">
                  Assigned To <span className="text-err">*</span>
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
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
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">
                  GRN Date
                </label>
                <input
                  type="date"
                  value={grnDate}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          {grn.lineItems && grn.lineItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-2">Line items — qty</h3>
              <div className="overflow-auto max-h-[70vh] border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-surface-3 border-b border-border sticky top-0 z-20 [&_th]:bg-surface-3">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Item</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">PO QTY</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">RCVD QTY</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Invoice QTY</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Unit Price</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {editedLineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2">
                        <td className="px-3 py-2 text-left">
                          <div className="font-medium text-ink">{item.item}</div>
                          <div className="text-ink-3">{item.itemCode}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-ink">{item.poQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={item.rcvdQty}
                            onChange={(e) => handleLineItemChange(item.id, 'rcvdQty', e.target.value)}
                            className="w-24 min-w-[6rem] px-2 py-2 border-2 border-brand rounded-lg bg-surface text-ink text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-ink">{item.invoiceQty}</td>
                        <td className="px-3 py-2 text-center font-medium text-brand">₹{item.unitPrice}</td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const calculatedDiff = item.rcvdQty - item.poQty; // positive = over-received, negative = shortfall
                            return (
                              <span className={`font-bold ${calculatedDiff === 0 ? 'text-ok' : 'text-err'}`}>
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

          {/* Put-away / labels — QR generation only in GRN Copy; assign rack is put-away + photos */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2">
              {isAssignRackMode ? 'Put-away location' : 'Labels (QR per box)'}
            </h3>
            {isAssignRackMode ? (
              <p className="text-xs text-ink-2">
                Select the physical rack for put-away below. Its code is printed on the QR labels, which are
                generated afterwards in <strong>GRN Copy</strong> — labels cannot be created here.
              </p>
            ) : (
              <p className="text-xs text-ink-2">
                Generate QR labels from <strong>GRN Copy</strong> on the inbound list (documents, pack counts, and shipment photos). This screen shows saved labels for reference only.
              </p>
            )}

            {!isAssignRackMode && labelsGenerated && labels && labels.length > 0 && (
              <p className="text-xs text-ok bg-ok-soft border border-ok rounded-lg px-3 py-2">
                {labels.length} QR label{labels.length === 1 ? '' : 's'} on file from GRN Copy. Open <strong>GRN Copy</strong> to regenerate after changing pack counts or documents.
              </p>
            )}

            {!isAssignRackMode && !labelsGenerated && (
              <div className="rounded-lg bg-warn-soft border border-warn px-4 py-3 text-sm text-warn">
                Use <strong>GRN Copy</strong> on the inbound table to upload receipt documents and generate QR labels before QC and assign rack.
              </div>
            )}

            {isAssignRackMode && labelsGenerated && labels && labels.length > 0 && (
              <p className="text-xs text-ink-2">
                <strong>{labels.length}</strong> box label{labels.length === 1 ? '' : 's'} from GRN Copy
                {grn.noOfBoxes != null ? ` · ${grn.noOfBoxes} box(es) configured` : ''}.
              </p>
            )}

            {isAssignRackMode && !labelsGenerated && (
              <div className="rounded-lg bg-err-soft border border-err px-4 py-3 text-sm text-err">
                Labels come after this step. Choose and <strong>save</strong> the rack below — its code is printed on
                the labels — then generate them in <strong>GRN Copy</strong>, which completes the GRN. GRN Copy needs
                the source documents, invoice qty, unit price, pack counts and a shipment photo.
              </div>
            )}

            {!isAssignRackMode && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  No of boxes
                </label>
                <input type="number" min={1} value={noOfBoxes} readOnly className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface-2 text-ink-2" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  Units/box by box
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Array.from({ length: parsedNoOfBoxes }).map((_, i) => (
                    <div key={`box-units-${i}`}>
                      <label className="block text-[10px] text-ink-3 mb-0.5">Box {i + 1}</label>
                      <input
                        type="number"
                        min={0}
                        value={unitsPerBoxListStr[i] ?? ''}
                        readOnly
                        className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface-2 text-ink-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            <div className="space-y-3 rounded-lg border border-border bg-surface-2/90 p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-xs font-semibold text-ink-2">Put-away location <span className="text-err">*</span></span>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                    <input
                      type="radio"
                      name="grn-location-source"
                      className="rounded-full border-border"
                      checked={locationSource === 'facility'}
                      onChange={() => {
                        setLocationSource('facility');
                        const m = matchGrnLocationToFacility(locationPrefix, facilityAreasData);
                        if (m) {
                          setSelectedAreaId(m.areaId);
                          setSelectedZoneId(m.zoneId);
                          setSelectedRackId(m.rackId);
                        }
                      }}
                    />
                    Facility Management
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                    <input
                      type="radio"
                      name="grn-location-source"
                      className="rounded-full border-border"
                      checked={locationSource === 'custom'}
                      onChange={() => setLocationSource('custom')}
                    />
                    Custom (type zone / rack)
                  </label>
                </div>
                <p className="text-[10px] text-ink-3">
                  Warehouse areas, zones, and racks are maintained under <strong>Facility Management</strong>. Choosing them here sets the zone label and rack code on QR labels and stock put-away.
                  Custom mode routes quantity to the <strong>default warehouse zone</strong> (not a separate custom facility).
                </p>

                {locationSource === 'facility' && facilityAreasLoading && (
                  <p className="text-xs text-ink-3">Loading warehouse locations…</p>
                )}
                {locationSource === 'facility' && !facilityAreasLoading && facilityAreasData.length === 0 && (
                  <p className="text-xs text-warn bg-warn-soft border border-warn rounded-md px-2 py-1.5">
                    No warehouse areas found. Create a warehouse area, zones, and racks in Facility Management, or use Custom.
                  </p>
                )}

                {locationSource === 'facility' && !facilityAreasLoading && facilityAreasData.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        Warehouse area <span className="text-err">*</span>
                      </label>
                      <select
                        value={selectedAreaId === '' ? '' : String(selectedAreaId)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedAreaId(v ? parseInt(v, 10) : '');
                          setSelectedZoneId('');
                          setSelectedRackId('');
                        }}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface"
                      >
                        <option value="">— Select area —</option>
                        {facilityAreasData.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        Zone <span className="text-err">*</span>
                      </label>
                      <select
                        value={selectedZoneId === '' ? '' : String(selectedZoneId)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedZoneId(v ? parseInt(v, 10) : '');
                          setSelectedRackId('');
                        }}
                        disabled={selectedAreaId === ''}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface disabled:bg-surface-3 disabled:text-ink-4"
                      >
                        <option value="">— Select zone —</option>
                        {zoneOptions.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.code} — {z.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        Rack (put-away code) <span className="text-err">*</span>
                      </label>
                      <select
                        value={selectedRackId === '' ? '' : String(selectedRackId)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedRackId(v ? parseInt(v, 10) : '');
                        }}
                        disabled={selectedZoneId === ''}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface disabled:bg-surface-3 disabled:text-ink-4"
                      >
                        <option value="">— Select rack —</option>
                        {rackOptionsSorted.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.code}
                            {r.name ? ` — ${r.name}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedZoneId !== '' && rackOptionsSorted.length === 0 && (
                        <p className="text-[10px] text-warn mt-1">No racks in this zone. Add racks in Facility Management or use Custom.</p>
                      )}
                    </div>
                  </div>
                )}

                {locationSource === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Storage zone <span className="text-err">*</span></label>
                      <input
                        type="text"
                        value={locationZone}
                        onChange={(e) => setLocationZone(e.target.value)}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm"
                        placeholder="e.g. Zone A / RM bulk"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Location prefix (rack code) <span className="text-err">*</span></label>
                      <input
                        type="text"
                        value={locationPrefix}
                        onChange={(e) => setLocationPrefix(e.target.value)}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm"
                        placeholder="e.g. A1-L2-S3"
                      />
                    </div>
                  </div>
                )}

                {locationSource === 'facility' && !facilityAreasLoading && locationZone && locationPrefix && (
                  <p className="text-[10px] text-ink-2">
                    Saved on GRN / QR: <span className="font-mono font-medium">zone</span> = {locationZone} ·{' '}
                    <span className="font-mono font-medium">rack</span> = {locationPrefix}
                  </p>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">GRN batch mfg</label>
                <input type="text" value={grnBatchMfg} onChange={(e) => setGrnBatchMfg(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Expiry</label>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Mfg batch</label>
                <input type="text" value={mfgBatch} onChange={(e) => setMfgBatch(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
              </div>
            </div>

          </section>

          {/* QR Label Preview — print only; generation happens in GRN Copy */}
          {labelsGenerated && labels && labels.length > 0 && activeLabel && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-2">Label preview (one QR per box)</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Select generated label</label>
                  <select
                    value={selectedLabelBoxIndex ?? activeLabel.boxIndex}
                    onChange={(e) => setSelectedLabelBoxIndex(parseInt(e.target.value, 10) || null)}
                    className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface"
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
                  onClick={handlePrintActiveLabel}
                  disabled={!activeLabel}
                  className="px-4 py-2 bg-ink text-white rounded-lg font-medium text-sm hover:bg-ink-2 transition-colors disabled:opacity-50"
                >
                  Print selected QR
                </button>
                <button
                  type="button"
                  onClick={handlePrintAllLabels}
                  disabled={!labels || labels.length === 0}
                  className="px-4 py-2 bg-brand text-white rounded-lg font-medium text-sm hover:bg-brand-press transition-colors disabled:opacity-50"
                >
                  Print all QR
                </button>
              </div>
              <p className="text-[11px] text-ink-3">
                Labels were generated in <strong>GRN Copy</strong>. Use print to reprint box QRs. To change pack counts or regenerate, open <strong>GRN Copy</strong> from the inbound list.
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
                  <div className="bg-surface border-2 border-border rounded-lg p-4 shadow-sm max-w-md">
                    <div className="text-center mb-2">
                      <p className="text-xs font-mono font-bold text-ink">Box {label.boxIndex}</p>
                    </div>
                    <div className="flex justify-center mb-3">
                      <img src={label.qrImageDataUrl} alt={`QR Box ${label.boxIndex}`} className="w-40 h-40 object-contain" />
                    </div>
                    <div className="space-y-1 text-xs text-ink-2">
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
                      {payload.partial_last_box && <p className="text-warn font-medium">Partial last carton</p>}
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
                    <p className="mt-2 text-[10px] text-ink-3">On scan: decoder shows all text above + action (e.g. View GRN).</p>
                  </div>
                );
              })()}

              {/* On scan: simulate paste payload → show all text + action */}
              {/* <div className="mt-4 rounded-xl border-2 border-dashed border-border bg-surface-2 p-4">
                <h4 className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">On scan — show all text &amp; action</h4>
                <p className="text-xs text-ink-2 mb-2">Paste the QR payload (JSON) below to simulate a scan. The decoder will show all decoded fields and the suggested action.</p>
                <ScanSimulator grnNo={grn.grnNo} />
              </div> */}
            </section>
          )}

          {/* Save error */}
          {saveError && (
            <div className="rounded-lg bg-err-soft border border-err px-4 py-2 text-sm text-err">
              {saveError}
            </div>
          )}

          {mode === 'assign-rack' ? (
            <GrnPostRackingPhotosSection
              racks={postRackingRackTargets}
              photosByRack={postRackingPhotosByRack}
              savedMeta={sourceDocuments.postRackingPhotos}
              disabled={saving}
              onPhotosByRackChange={setPostRackingPhotosByRack}
            />
          ) : null}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-border rounded-lg text-ink font-medium text-sm hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleSaveOnly}
              disabled={saving}
              className="px-4 py-2 bg-ink-2 text-white rounded-lg font-medium text-sm hover:bg-ink transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'assign-rack' ? 'Save draft' : 'Save changes'}
            </button>
            <button
              onClick={labelsPendingForHandoff ? handleSaveAndContinueToGrnCopy : handleCompleteGRN}
              disabled={saving || !canMarkComplete}
              className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${grn.status === 'In Transit' ? 'bg-ok hover:bg-ok-press' : 'bg-brand hover:bg-brand-press'
                }`}
            >
              {labelsPendingForHandoff
                ? saving
                  ? 'Saving…'
                  : 'Save & Continue to GRN Copy →'
                : mode === 'assign-rack'
                  ? 'Complete GRN'
                  : grn.status === 'In Transit'
                    ? 'Complete GRN & Initiate Stock'
                    : 'Mark complete'}
            </button>
            {labelsPendingForHandoff && canMarkComplete && (
              <p className="w-full text-right text-xs text-ink-3">
                Put-away is saved here; GRN Copy generates the labels (printed with rack{' '}
                {locationPrefix.trim() || '—'}) and completes the GRN.
              </p>
            )}
            {!canMarkComplete && (
              <p className="w-full text-right text-xs text-warn">
                {labelsPendingForHandoff ? 'Save & Continue is disabled until:' : 'Mark complete is disabled until:'}{' '}
                {completionBlockers.join(' ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
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
  expectedDate?: string | null;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: string;
  qcBy?: string;
  qcSpecs?: GrnQcSpecsStored | null;
  status: string;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  grnDate?: string | null;
  createdAt?: string | null;
  shippedQty?: number | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  locationZone?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
  receiptSource?: string | null;
  purchaseOrderId?: number | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
}): GRNRecord {
  return {
    id: r.id,
    grnNo: r.grnNo,
    poNo: r.poNo,
    vendor: r.vendor,
    type: r.type,
    receiptSource: r.receiptSource ?? 'po',
    purchaseOrderId: r.purchaseOrderId ?? null,
    items: r.items,
    poValue: r.poValue,
    expectedDate: r.expectedDate ?? null,
    receivedDate: r.receivedDate,
    assignedTo: r.assignedTo,
    qcStatus: normalizeQcStatus(r.qcStatus),
    qcBy: r.qcBy ?? '',
    qcSpecs: r.qcSpecs ?? null,
    status: r.status as GRNStatus,
    shippedQty: r.shippedQty ?? null,
    lineItems: r.lineItems,
    workflowSteps: r.workflowSteps,
    invoiceNo: r.invoiceNo ?? undefined,
    invoiceAmount: r.invoiceAmount ?? undefined,
    grnDate: r.grnDate ?? undefined,
    createdAt: r.createdAt ?? null,
    noOfBoxes: r.noOfBoxes ?? undefined,
    unitsPerBox: r.unitsPerBox ?? undefined,
    lastBoxUnits: r.lastBoxUnits ?? undefined,
    locationPrefix: r.locationPrefix ?? undefined,
    locationZone: r.locationZone ?? undefined,
    grnBatchMfg: r.grnBatchMfg ?? undefined,
    expiry: r.expiry ?? undefined,
    mfgBatch: r.mfgBatch ?? undefined,
    generatedLabels: r.generatedLabels ?? undefined,
    sourceDocuments: r.sourceDocuments ?? undefined,
  };
}

const WarehouseInbound = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Procurement's GRN Monitor + issued-PO timeline read caches that live outside this module and
  // are never invalidated from Warehouse. Refresh them after any GRN status change here so a
  // Landed/Under-GRN/Complete transition propagates without a manual navigation.
  const invalidateProcurementGrnCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['grn-list'] });
    queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
    queryClient.invalidateQueries({ queryKey: ['po-tracking'] });
  }, [queryClient]);
  const inboundGrnDeepLinkAppliedRef = useRef(false);
  const grnDeepLinkId = searchParams.get('grn')?.trim() ?? '';
  const [activeSourceTab, setActiveSourceTab] = useState<InboundGrnSourceTab>('po');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Under GRN' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [grnData, setGrnData] = useState<GRNRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [groupedReceiptOpen, setGroupedReceiptOpen] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRNRecord | null>(null);
  const [selectedGRNMode, setSelectedGRNMode] = useState<'detail' | 'assign-rack'>('detail');
  const [assignRackFocusLineItem, setAssignRackFocusLineItem] = useState<LineItem | null>(null);
  const [activeQcRow, setActiveQcRow] = useState<QualityOrderManagementRow | null>(null);
  const [activeQcDecisionRow, setActiveQcDecisionRow] = useState<QualityOrderManagementRow | null>(null);
  const [receiptModal, setReceiptModal] = useState<InboundReceiptModalState>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<InboundSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  useEffect(() => {
    if (inboundGrnDeepLinkAppliedRef.current || !grnDeepLinkId || loading) return;
    const grn = grnData.find(
      (g) => g.id === grnDeepLinkId || String(g.grnNo).trim() === grnDeepLinkId,
    );
    if (!grn) return;
    inboundGrnDeepLinkAppliedRef.current = true;
    setActiveSourceTab(resolveGrnReceiptSource(grn));
    setSelectedGRN(grn);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('grn');
      return p;
    }, { replace: true });
  }, [grnDeepLinkId, grnData, loading, setSearchParams]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenGrnDetail = useCallback((
    grn: GRNRecord,
    lineItem: LineItem | null = null,
    mode: 'detail' | 'assign-rack' = 'detail',
  ): void => {
    // The list only carries stripped media (see grn.service/backend list endpoint) to keep the
    // table fast, so opening a row must fetch the real record — with actual label/photo/document
    // images — rather than the lightweight one already in `grnData`. Open immediately with what
    // we have so the modal doesn't feel stalled, then swap in the full record once it lands.
    setSelectedGRN(grn);
    setSelectedGRNMode(mode);
    setAssignRackFocusLineItem(mode === 'assign-rack' ? lineItem : null);
    void fetchGRNById(grn.id).then((full) => {
      if (full) setSelectedGRN(mapApiToGRNRecord(full));
    });
  }, []);

  const handleCloseGrnDetail = (): void => {
    setSelectedGRN(null);
    setSelectedGRNMode('detail');
    setAssignRackFocusLineItem(null);
  };

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

  const handleReceiptSaved = (updated: {
    id: string;
    status?: string;
    qcStatus?: string | null;
    locationZone?: string | null;
    locationPrefix?: string | null;
    sourceDocuments?: InboundGrnSourceDocuments | null;
    workflowSteps?: string[];
    noOfBoxes?: number | null;
    unitsPerBox?: number | null;
    generatedLabels?: GeneratedLabel[] | null;
    receivedDate?: string | null;
    grnDate?: string | null;
  }) => {
    const mergeUpdate = (grn: GRNRecord): GRNRecord => ({
      ...grn,
      status: (updated.status ?? grn.status) as GRNStatus,
      qcStatus: (updated.qcStatus ?? grn.qcStatus) as GRNRecord['qcStatus'],
      locationZone: updated.locationZone ?? grn.locationZone,
      locationPrefix: updated.locationPrefix ?? grn.locationPrefix,
      receivedDate: updated.receivedDate ?? grn.receivedDate,
      grnDate: updated.grnDate ?? grn.grnDate,
      sourceDocuments: updated.sourceDocuments ?? grn.sourceDocuments,
      workflowSteps: (updated.workflowSteps ?? grn.workflowSteps) as WorkflowStep[] | undefined,
      noOfBoxes: updated.noOfBoxes ?? grn.noOfBoxes,
      unitsPerBox: updated.unitsPerBox ?? grn.unitsPerBox,
      generatedLabels: updated.generatedLabels ?? grn.generatedLabels,
    });
    setGrnData((prev) => prev.map((grn) => (grn.id === updated.id ? mergeUpdate(grn) : grn)));
    // GrnCopyReceiptModal derives labelsMissing / putawayMissing / docsLocked straight off its `grn`
    // prop. receiptModal.grn is set once when the modal opens and — unlike the row list above — was
    // never refreshed here, so every check inside the modal kept reading pre-save values for the
    // rest of that session: generate labels, and the modal still believed no labels existed; the
    // Accept button stayed stuck offering "Assign Rack next" even after the rack was assigned. Keep
    // the still-open modal's own copy in sync with every save, exactly like the row list.
    setReceiptModal((prev) => (prev && prev.grn.id === updated.id ? { ...prev, grn: mergeUpdate(prev.grn) } : prev));
  };

  const handleConfirmArrival = async (grn: GRNRecord): Promise<void> => {
    try {
      const res = await updateGRN(grn.id, inboundGrnArrivalConfirmPayload(grn.workflowSteps));
      const updated = mapApiToGRNRecord(res);
      setGrnData((prev) => prev.map((row) => (row.id === grn.id ? updated : row)));
      invalidateProcurementGrnCaches();
      showToast(`Arrival confirmed · ${displayInboundGrnNo(grn.grnNo)} is now LANDED`);
    } catch {
      showToast('Could not confirm arrival', 'error');
    }
  };

  const handleSendToQc = async (grn: GRNRecord): Promise<void> => {
    // The row's own Send to QC never passed through the GRN Copy steps, so a GRN could reach
    // Quality with no Invoice / E-Way Bill / COA on file — QC inspects against the COA, and the GRN
    // cannot be completed later without them either.
    const docsError = requiredGrnDocsError(grn.sourceDocuments);
    if (docsError) {
      showToast(docsError, 'error');
      return;
    }
    try {
      const res = await updateGRN(grn.id, inboundGrnSendToQcPayload(grn.workflowSteps));
      const updated = mapApiToGRNRecord(res);
      setGrnData((prev) => prev.map((row) => (row.id === grn.id ? updated : row)));
      invalidateProcurementGrnCaches();
      showToast(`Sent to QC · ${displayInboundGrnNo(grn.grnNo)} is now in the Quality module`);
    } catch {
      showToast('Could not send to QC', 'error');
    }
  };

  const assigneeOptions = useMemo(
    () =>
      assignableUsers
        .map((u) => String(u.displayName ?? '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [assignableUsers],
  );

  const handleOpenQcCheck = (grn: GRNRecord, lineItem: LineItem | null): void => {
    setActiveQcRow(
      buildQualityOrderManagementRowForGrnLine(grnRecordToQualityInput(grn, lineItem), null),
    );
  };

  const handleOpenQcDecision = (grn: GRNRecord, lineItem: LineItem | null): void => {
    setActiveQcDecisionRow(
      buildQualityOrderManagementRowForGrnLine(grnRecordToQualityInput(grn, lineItem), null),
    );
  };

  const reloadGrnList = useCallback(async (): Promise<void> => {
    try {
      const list = await fetchGRNList();
      setGrnData(list.map(mapApiToGRNRecord));
    } catch {
      setGrnData([]);
    }
  }, []);

  const handleQcCheckSaved = (): void => {
    setActiveQcRow(null);
    void reloadGrnList();
  };

  // Helper function to check if all workflow steps are completed
  const isGRNReady = (grn: GRNRecord): boolean => {
    if (!grn.workflowSteps || grn.workflowSteps.length === 0) return false;
    return WORKFLOW_STEPS_REQUIRED.every(step => grn.workflowSteps?.includes(step));
  };

  const sourceScopedGrns = useMemo(
    () =>
      grnData.filter((grn) =>
        matchesInboundGrnSourceTab(
          {
            receiptSource: grn.receiptSource,
            poNo: grn.poNo,
            purchaseOrderId: grn.purchaseOrderId,
          },
          activeSourceTab,
        ),
      ),
    [grnData, activeSourceTab],
  );

  // Calculate stats (scoped to active source tab)
  const totalGRNs = sourceScopedGrns.length;
  const underGRN = sourceScopedGrns.filter(g => g.status === 'Under GRN').length;
  const onHold = sourceScopedGrns.filter(g => g.status === 'On Hold').length;
  const inTransit = sourceScopedGrns.filter(g => g.status === 'In Transit').length;
  const completed = sourceScopedGrns.filter(g => g.status === 'GRN Complete').length;

  // Filter data based on source tab, status tab, and search
  const filteredData = sourceScopedGrns.filter(grn => {
    // Tab filter
    if (activeTab === 'Pending' && grn.status !== 'Pending' && grn.status !== 'In Transit') return false;
    if (activeTab === 'Under GRN' && grn.status !== 'Under GRN') return false;
    if (activeTab === 'Completed' && grn.status !== 'GRN Complete') return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const lineMatch = (grn.lineItems ?? []).some((line) => {
        const item = String(line.item ?? '').toLowerCase();
        const code = String(line.itemCode ?? '').toLowerCase();
        return item.includes(query) || code.includes(query);
      });
      return (
        grn.grnNo.toLowerCase().includes(query) ||
        grn.poNo.toLowerCase().includes(query) ||
        grn.vendor.toLowerCase().includes(query) ||
        grn.assignedTo.toLowerCase().includes(query) ||
        lineMatch
      );
    }

    return true;
  });

  const siblingGrnCountByPo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const grn of sourceScopedGrns) {
      const po = String(grn.poNo ?? '').trim().toLowerCase();
      if (!po) continue;
      counts.set(po, (counts.get(po) ?? 0) + 1);
    }
    return counts;
  }, [sourceScopedGrns]);

  const filteredItemRows = useMemo((): InboundTableRow[] => {
    return filteredData.flatMap((grn) => {
      const lineItems = Array.isArray(grn.lineItems) ? grn.lineItems : [];
      if (lineItems.length === 0) {
        return [{
          rowId: `${grn.id}-empty`,
          grn,
          lineItem: null as LineItem | null,
        }];
      }
      return lineItems.map((line) => ({
        rowId: `${grn.id}-${line.id}`,
        grn,
        lineItem: line,
      }));
    });
  }, [filteredData]);

  /** Newest shipment first, with a GRN's own lines kept together. */
  const compareLatestFirst = useCallback((a: InboundTableRow, b: InboundTableRow) => {
    const at = inboundShipmentSortValue(toInboundRowInput(a.grn, a.lineItem));
    const bt = inboundShipmentSortValue(toInboundRowInput(b.grn, b.lineItem));
    if (at !== bt) return bt - at;
    const byGrn = displayInboundGrnNo(b.grn.grnNo).localeCompare(
      displayInboundGrnNo(a.grn.grnNo), undefined, { numeric: true, sensitivity: 'base' },
    );
    if (byGrn !== 0) return byGrn;
    return a.rowId.localeCompare(b.rowId, undefined, { numeric: true, sensitivity: 'base' });
  }, []);

  const sortedItemRows = useMemo(() => {
    // No column picked: rows arrived in backend order, which interleaved July and August GRNs.
    // A receiving desk reads newest-first, so that is the default rather than "unsorted".
    if (!sortColumn) return [...filteredItemRows].sort(compareLatestFirst);
    return [...filteredItemRows].sort((a, b) => {
      const cmp = compareSortValues(
        sortValueForInboundRow(a, sortColumn),
        sortValueForInboundRow(b, sortColumn),
        sortDirection
      );
      if (cmp !== 0) return cmp;
      return a.rowId.localeCompare(b.rowId, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredItemRows, sortColumn, sortDirection, compareLatestFirst]);

  const toggleInboundSort = (column: InboundSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const getQCStatusColor = (status: QCStatus) => {
    switch (status) {
      case 'Passed':
        return 'bg-ok-soft text-ok border-ok';
      case 'In Progress':
        return 'bg-warn-soft text-warn border-warn';
      case 'Pending':
        return 'bg-surface-3 text-ink-2 border-border';
      case 'Failed':
        return 'bg-err-soft text-err border-err';
    }
  };

  const getStatusColor = (status: GRNStatus) => {
    switch (status) {
      case 'GRN Complete':
        return 'bg-ok-soft text-ok border-ok';
      case 'Under GRN':
        return 'bg-warn-soft text-warn border-warn';
      case 'In Transit':
        return 'bg-brand-soft text-brand border-brand';
      case 'On Hold':
        return 'bg-warn-soft text-warn border-warn';
      case 'Delayed':
        return 'bg-err-soft text-err border-err';
      case 'Pending':
        return 'bg-surface-3 text-ink-2 border-border';
    }
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-3 py-2 rounded-lg border text-sm font-medium shadow-lg ${toast.type === 'success'
                ? 'bg-ok-soft text-ok border-ok'
                : 'bg-err-soft text-err border-err'
              }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-xl md:text-2xl font-semibold text-ink tracking-tight">Inbound</h1>
          <p className="text-sm text-ink-3 mt-1">Goods receipt notes — receive, check, and complete GRNs</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Total GRNs</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{totalGRNs}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Under GRN</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{underGRN}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hidden sm:block">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">On Hold</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{onHold}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">In Transit</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{inTransit}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">Completed</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{completed}</p>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-surface rounded-xl border border-border/80 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* One vehicle often carries several GRNs; this confirms step 1 for all of them at once
                with a single set of details and one shared upload of the delivery paperwork. */}
            <button
              type="button"
              onClick={() => setGroupedReceiptOpen(true)}
              className="ml-auto order-last inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand hover:brightness-95"
              title="Confirm receipt for several GRNs arriving on the same vehicle"
            >
              🚚 Grouped Receipt
            </button>
            {INBOUND_GRN_SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSourceTab(tab.key)}
                className={procChipClass(activeSourceTab === tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3">
            Source-doc set per tab: {inboundSourceDocRequirementLabel(activeSourceTab)}
          </p>
          <p className="text-xs text-ink-3">
            Row actions: ✓ Confirm Receipt (LANDED) · 📋 GRN Copy (once confirmed) · 🚦 Send to QC (QUARANTINED or VERIFIED) · 📍 Assign Rack (QC TESTED · PASS)
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Status tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Pending', 'Under GRN', 'Completed'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={procChipClass(activeTab === tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GRN #, PO #, item, or vendor…"
                className={`${procInputClass} pl-10`}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full min-w-[1400px]">
              <thead className="sticky top-0 z-20 [&_th]:bg-surface-2">
                <tr className="bg-surface-2 border-b border-border">
                  <SortableTableTh
                    label="GRN Date"
                    column="shipment"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="GRN #"
                    column="grnNo"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="PO #"
                    column="po"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="Loc"
                    column="loc"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="Item"
                    column="item"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="PO Qty"
                    column="poQty"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                    align="right"
                  />
                  <SortableTableTh
                    label="Shipped"
                    column="shipped"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                    align="right"
                  />
                  <SortableTableTh
                    label="Received"
                    column="received"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                    align="right"
                  />
                  <SortableTableTh
                    label="Storage (rack · pack · GRN batch)"
                    column="storage"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                    thClassName="min-w-[12rem]"
                  />
                  <SortableTableTh
                    label={
                      <span className="inline-flex flex-col items-start normal-case tracking-normal">
                        <span>Source-doc set</span>
                        <span className="text-[10px] font-normal text-ink-3 lowercase first-letter:uppercase">
                          {inboundSourceDocRequirementLabel(activeSourceTab)}
                        </span>
                      </span>
                    }
                    column="sourceDoc"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                    thClassName="min-w-[11rem]"
                  />
                  <SortableTableTh
                    label="GRN Status"
                    column="status"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="SLA"
                    column="sla"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <SortableTableTh
                    label="Related"
                    column="related"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleInboundSort}
                  />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-ink-3">Loading GRNs…</td>
                  </tr>
                ) : sortedItemRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-ink-3">
                      {inboundGrnSourceEmptyMessage(activeSourceTab)}
                    </td>
                  </tr>
                ) : (
                  sortedItemRows.map(({ rowId, grn, lineItem }) => {
                    const rowInput = toInboundRowInput(grn, lineItem);
                    const poKey = String(grn.poNo ?? '').trim().toLowerCase();
                    const siblingGrnCount = poKey ? Math.max(0, (siblingGrnCountByPo.get(poKey) ?? 1) - 1) : 0;
                    const view = buildInboundGrnTableRowView(rowInput, siblingGrnCount);
                    // No row-level click handler: the GRN detail drawer is reached through the
                    // row's action button (GRN Copy / Assign Rack). A row click used to open a
                    // second, competing modal on top of the action's own popup.
                    return (
                    <tr
                      key={rowId}
                      className="hover:bg-surface-2 transition-colors align-top"
                    >
                      <td className="px-4 py-3.5 text-sm text-ink tabular-nums whitespace-nowrap">
                        {view.shipmentDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-mono font-semibold text-brand">{view.grnNo}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {grn.poNo ? (
                          <span className="text-xs font-mono text-brand">{grn.poNo}</span>
                        ) : (
                          <span className="text-xs text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-ink whitespace-nowrap">
                        {view.warehouse}
                      </td>
                      <td className="px-4 py-4 min-w-[9rem]">
                        {lineItem ? (
                          <div>
                            <div className="text-sm font-semibold text-ink leading-snug">{lineItem.item}</div>
                            <div className="text-[11px] text-ink-3 font-mono mt-0.5">{lineItem.itemCode}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-sm text-ink whitespace-nowrap">
                        {lineItem ? formatInboundQty(lineItem.poQty, lineItem.unit) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-sm text-ink whitespace-nowrap">
                        {(() => {
                          const shipped = lineItem?.shippedQty ?? grn.shippedQty ?? null;
                          return shipped != null ? formatInboundQty(shipped, lineItem?.unit) : '—';
                        })()}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-sm font-medium text-ink whitespace-nowrap">
                        {lineItem ? formatInboundQty(lineItem.rcvdQty, lineItem.unit) : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-ink-2 min-w-[12rem]">
                        <p>{view.storagePrimary}</p>
                        {view.storageSecondary ? (
                          <p className="text-[11px] text-ink-3 font-mono mt-0.5">{view.storageSecondary}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            view.sourceDocsComplete
                              ? 'bg-ok-soft text-ok ring-1 ring-ok'
                              : 'bg-surface-3 text-ink-2 ring-1 ring-border'
                          }`}
                          title={view.sourceDocsHint}
                        >
                          {view.sourceDocs}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className={`text-xs tracking-wide ${inboundGrnStatusClass(view.statusTone)}`}>
                          {view.statusLabel}
                        </p>
                        {view.statusSubLabel ? (
                          <p className="text-[11px] text-ink-3 mt-0.5 tabular-nums">{view.statusSubLabel}</p>
                        ) : null}
                      </td>
                      <td className={`px-4 py-4 text-xs whitespace-nowrap ${inboundGrnSlaClass(view.slaTone)}`}>
                        {view.slaIcon ? <span className="mr-1" aria-hidden="true">{view.slaIcon}</span> : null}
                        {view.slaLabel}
                      </td>
                      <td className="px-4 py-4 text-sm text-ink-2 min-w-[7rem]">
                        {view.relatedPrimary ? <p>{view.relatedPrimary}</p> : <p className="text-ink-4">—</p>}
                        {view.relatedSecondary ? (
                          <p className="text-[11px] text-ink-3 mt-0.5">{view.relatedSecondary}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {/* View is available at EVERY status, so what was submitted — receipt,
                            documents, batches, packs and put-away — stays reachable even once the
                            row's own action (e.g. Awaiting QC) has moved past those steps. */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenGrnDetail(grn, lineItem, 'detail'); }}
                          className="text-xs font-semibold text-brand hover:underline mr-2"
                          title="View submitted GRN details"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInboundRowAction(
                              grn,
                              lineItem,
                              view.actionLabel,
                              setReceiptModal,
                              handleOpenGrnDetail,
                              (row) => {
                                void handleConfirmArrival(row);
                              },
                              (row) => {
                                void handleSendToQc(row);
                              },
                              handleOpenQcCheck,
                              handleOpenQcDecision,
                            );
                          }}
                          className="text-xs font-semibold text-ink hover:text-ink hover:underline"
                        >
                          {view.actionPrefix ? `${view.actionPrefix} ` : ''}
                          {view.actionLabel}
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {groupedReceiptOpen ? (
          <GroupedGrnReceiptModal
            candidates={grnData.map((g) => ({
              id: g.id,
              grnNo: g.grnNo,
              status: g.status,
              vendor: g.vendor,
              poNo: g.poNo,
              sourceDocuments: g.sourceDocuments ?? null,
            }))}
            assignableUsers={assignableUsers}
            onClose={() => setGroupedReceiptOpen(false)}
            onApply={async (updates) => {
              // Applied one GRN at a time so a single failure cannot leave the batch half-written
              // with no record of which succeeded — each result is reported.
              const failed: string[] = [];
              for (const u of updates) {
                try {
                  const payload: Record<string, unknown> = { sourceDocuments: u.sourceDocuments };
                  if (u.receivedDate) payload.receivedDate = u.receivedDate;
                  if (u.assignedTo) payload.assignedTo = u.assignedTo;
                  const grn = grnData.find((g) => g.id === u.id);
                  if (grn && /in[\s_-]?transit/i.test(String(grn.status ?? ''))) {
                    const arrival = inboundGrnArrivalConfirmPayload(grn.workflowSteps);
                    payload.status = arrival.status;
                    payload.workflowSteps = arrival.workflowSteps;
                    payload.grnDate = arrival.grnDate;
                    if (!payload.receivedDate) payload.receivedDate = arrival.receivedDate;
                  }
                  const res = await updateGRN(u.id, payload as never);
                  const updated = mapApiToGRNRecord(res);
                  setGrnData((prev) => prev.map((row) => (row.id === u.id ? updated : row)));
                } catch {
                  failed.push(u.grnNo);
                }
              }
              invalidateProcurementGrnCaches();
              if (failed.length === 0) {
                showToast(`Receipt confirmed for ${updates.length} GRNs on one vehicle.`);
                setGroupedReceiptOpen(false);
              } else {
                showToast(
                  `${updates.length - failed.length} of ${updates.length} confirmed. Failed: ${failed.join(', ')}`,
                  'error',
                );
              }
            }}
          />
        ) : null}

        {receiptModal ? (
          <GrnCopyReceiptModal
            grn={receiptModal.grn}
            lineItem={{
              ...receiptModal.lineItem,
              // Default the unit from the material type (pcs for packaging, kg for raw)
              // so a PM item never shows the 'kg' fallback.
              unit:
                receiptModal.lineItem.unit ||
                (receiptModal.lineItem.pack_material_id != null
                  ? 'pcs'
                  : receiptModal.lineItem.raw_material_id != null
                    ? 'kg'
                    : 'pcs'),
            }}
            mode={receiptModal.mode}
            onClose={() => setReceiptModal(null)}
            onSaved={handleReceiptSaved}
            onQuarantined={() => navigate('/quality/order-management')}
          />
        ) : null}

        {/* GRN Detail Modal */}
        {selectedGRN && !receiptModal && !activeQcRow && !activeQcDecisionRow ? (
          <GRNDetailModal
            grn={selectedGRN}
            mode={selectedGRNMode}
            focusLineItem={assignRackFocusLineItem}
            onClose={handleCloseGrnDetail}
            onSaveChanges={handleSaveChanges}
            assignableUsers={assignableUsers}
          />
        ) : null}

        {activeQcRow ? (
          <QualityCheckModal
            row={activeQcRow}
            assigneeOptions={assigneeOptions}
            readOnly
            onClose={() => setActiveQcRow(null)}
            onSaved={handleQcCheckSaved}
          />
        ) : null}

        {activeQcDecisionRow ? (
          <QcQuickDecisionModal
            row={activeQcDecisionRow}
            onClose={() => setActiveQcDecisionRow(null)}
            onSaved={() => void reloadGrnList()}
          />
        ) : null}
      </div>
    </div>
  );
};

export default WarehouseInbound;
