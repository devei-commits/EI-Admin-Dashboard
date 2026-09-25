import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  fetchGRNAssignableUsers,
  fetchGRNQcReference,
  fetchNextVendorBatchNos,
  generateGRNLabels,
  grnLineItemDisplayName,
  saveGRNPackLabels,
  updateGRN,
  type AssignableUser,
  type GeneratedLabel,
  type GeneratedPackLabel,
  type UpdateGRNPayload,
} from '../../services/grn.service';
import { deriveGrnQcStatusFromSpecs, type GrnQcSpecsStored } from '../../lib/grnQcSpecs';
import { raiseRtv } from '../../services/poGrnException.service';
import type { InboundGrnSourceDocuments } from '../../lib/inboundGrnSourceDocs';
import {
  allGrnReceiptChecksPass,
  missingRequiredGrnDocs,
  requiredGrnDocKeys,
  requiredGrnDocsError,
  docFileNameFor,
  GRN_REQUIRED_DOC_LABELS,
  allGrnCoreMatchChecksPass,
  buildGrnCopyDocumentRows,
  buildGrnCopyReceiptHeaderFields,
  buildGrnCopyReceiptHeaderView,
  buildGrnMatchChecks,
  deriveGrnPackRows,
  docRefsToSourceDocuments,
  grnReceiptDocumentsLocked,
  grnReceiptPrerequisitesMet,
  initialGrnCopyDocRefs,
  resolveGrnExistingLabels,
  type GrnCopyDocRefKey,
  type GrnCopyDocUploadKey,
  type GrnPackCheckRow,
} from '../../lib/grnCopyReceiptDisplay';
import {
  inboundGrnMismatchQuarantinePayload,
  inboundGrnSendToQuarantineQcPayload,
  inboundGrnVerifiedAfterLabelsPayload,
  isInboundGrnQcComplete,
  isInboundGrnQcRejected,
} from '../../lib/inboundGrnStatus';
import { displayInboundGrnNo, inboundGrnArrivalConfirmPayload } from '../../lib/inboundGrnTableDisplay';
import { resolveGrnReceiptSource } from '../../lib/inboundGrnSourceFilter';
import { printGrnCopyPdf } from '../../lib/grnCopyPdfPrint';
import { fetchMRNList } from '../../services/mrn.service';
import {
  grnReceiptValidationErrors,
  readGrnReceiptMeta,
  type InboundGrnReceiptMeta,
} from '../../lib/inboundGrnReceiptMeta';
import {
  grnDetailsValidationErrors,
  readGrnDetailsMeta,
  type InboundGrnDetailsMeta,
} from '../../lib/inboundGrnDetailsMeta';
import {
  emptyBatchRow,
  grnBatchesValidationErrors,
  readGrnBatchesMeta,
  reconcileBatchRows,
  type GrnBatchRow,
} from '../../lib/inboundGrnBatchesMeta';
import {
  buildPackagingRows,
  grnPackagingValidationErrors,
  readGrnPackagingMeta,
  receivedQtyFromPackaging,
  reconcilePackagingRows,
  type GrnPackagingRow,
} from '../../lib/inboundGrnPackagingMeta';
import { GrnLabelPreview } from './GrnLabelPreview';
import { GrnReceiptStepper } from './GrnReceiptStepper';
import { GrnConfirmReceiptSection } from './GrnConfirmReceiptSection';
import { GrnConfirmDetailsSection } from './GrnConfirmDetailsSection';
import { GrnBatchDetailsSection } from './GrnBatchDetailsSection';
import { DocFileUploadCell } from './DocFileUploadCell';
import { GrnPackagingListSection } from './GrnPackagingListSection';
import { GrnGenerateLabelsSection } from './GrnGenerateLabelsSection';
import { buildGeneratedPackLabels, printStoredPackLabels } from '../../lib/grnPackLabelPrint';
import { GrnQuarantineQcSection } from './GrnQuarantineQcSection';
import { GrnQcCompleteSection } from './GrnQcCompleteSection';
import { ModalOverlay } from '../ui/ModalOverlay';

/** Workflow steps the backend's "GRN Complete" gate expects (mirrors Inbound.tsx). */
const GRN_COMPLETE_WORKFLOW_STEPS = ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'];

export type GrnCopyReceiptLineItem = {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
  shippedQty?: number;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  unit?: string;
  generatedLabels?: GeneratedLabel[] | null;
};

export type GrnCopyReceiptGrn = {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  expectedDate?: string | null;
  receivedDate?: string | null;
  grnDate?: string | null;
  invoiceNo?: string | null;
  shippedQty?: number | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationZone?: string | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
  workflowSteps?: string[];
  generatedLabels?: GeneratedLabel[] | null;
  lineItems?: Array<Pick<GrnCopyReceiptLineItem, 'itemCode' | 'generatedLabels'>>;
  status?: string | null;
  qcStatus?: string | null;
  qcBy?: string | null;
  invoiceAmount?: number | null;
  locationPrefix?: string | null;
  assignedTo?: string | null;
  /** Linked PO id — used to raise a vendor return (RTV) when QC rejects. */
  purchaseOrderId?: number | null;
  /** Distinguishes GRN by Transfer (no vendor paperwork) from GRN by PO — see resolveGrnReceiptSource. */
  receiptSource?: string | null;
  mrnId?: number | string | null;
};

type GrnCopyReceiptModalMode = 'confirm-receipt' | 'grn-copy';

type GrnCopyReceiptModalProps = {
  grn: GrnCopyReceiptGrn;
  lineItem: GrnCopyReceiptLineItem;
  mode: GrnCopyReceiptModalMode;
  onClose: () => void;
  onSaved: (grn: GrnCopyReceiptGrn) => void;
  onQuarantined?: () => void;
};

function displayGrnNo(grnNo: string): string {
  return displayInboundGrnNo(grnNo);
}


const GrnCopyReceiptModal: React.FC<GrnCopyReceiptModalProps> = ({
  grn,
  lineItem,
  mode,
  onClose,
  onSaved,
  onQuarantined,
}) => {
  const { addToast } = useToast();
  // A transfer receives goods from another internal warehouse, not a vendor — there is no
  // Invoice/E-Way Bill/COA/MSDS paperwork to tick or upload, so the dock document checklist
  // (and the doc-upload gate it drives) does not apply to this receipt source.
  const isTransferGrn = resolveGrnReceiptSource(grn) === 'transfer';
  const [sourceDocuments, setSourceDocuments] = useState<InboundGrnSourceDocuments>(
    () => ({ ...(grn.sourceDocuments ?? {}) }),
  );
  const [docRefs, setDocRefs] = useState(() =>
    initialGrnCopyDocRefs(grn.sourceDocuments, grn.invoiceNo),
  );
  // Received/shipped qty drives the declared pack qty; when no shipment qty was recorded
  // (0), fall back to the PO qty so the packs pull the expected quantity instead of 0.
  const seedQty = Number(lineItem.rcvdQty) || Number(lineItem.poQty) || 0;
  const [packRows, setPackRows] = useState<GrnPackCheckRow[]>(() =>
    deriveGrnPackRows({
      rcvdQty: seedQty,
      noOfBoxes: grn.noOfBoxes,
      unitsPerBox: grn.unitsPerBox,
      unit: lineItem.unit,
    }),
  );
  const [billedQty, setBilledQty] = useState(
    () => Number(lineItem.invoiceQty) || Number(lineItem.rcvdQty) || Number(lineItem.poQty) || 0,
  );
  const [verifiedUnitPrice, setVerifiedUnitPrice] = useState(
    () => Number(lineItem.unitPrice) || 0,
  );
  const [generating, setGenerating] = useState(false);
  // Set once labels come back — swaps the modal body for the preview + print step.
  const [previewLabels, setPreviewLabels] = useState<GeneratedLabel[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [confirmingDetails, setConfirmingDetails] = useState(false);
  const [confirmingBatches, setConfirmingBatches] = useState(false);
  const [confirmingPackaging, setConfirmingPackaging] = useState(false);
  const [sendingToQc, setSendingToQc] = useState(false);
  const [decidingQc, setDecidingQc] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  // QC-inspection state for step 7 (specs loaded on demand from the item master).
  const [qcSpecs, setQcSpecs] = useState<GrnQcSpecsStored | null>(null);
  const [qcLoading, setQcLoading] = useState(false);
  const [qcError, setQcError] = useState<string | null>(null);
  const [qcBy, setQcBy] = useState('');
  const [qcTestDate, setQcTestDate] = useState(grn.sourceDocuments?.qc?.testDate ?? '');
  const qcLoadedRef = useRef(false);
  const transferBatchAutoFillRef = useRef(false);
  // Captured once at mount (not derived from the live `grn` prop, which can go stale mid-session —
  // see qcAlreadyDecided below): true when QC was already decided BEFORE this modal opened, whether
  // through this wizard's own sourceDocuments.qc.verdict or a different modal entirely (the
  // fast-track QcQuickDecisionModal, which only ever sets qc_status — GRN-2026-0100).
  const qcDecidedAtOpen = useRef(
    grn.sourceDocuments?.qc?.verdict === 'accept' ||
      grn.sourceDocuments?.qc?.verdict === 'reject' ||
      isInboundGrnQcComplete(grn),
  );
  // NOTE: sourceDocuments.qc.verdict being 'accept'/'reject' does NOT mean the checklist below was
  // ever actually filled in — this wizard's own handleQcAccept sets that verdict too, but still
  // carries forward the blank reference qcSpecs (every test "passed": null) whenever qcFastTrack was
  // true, e.g. a fast-tracked GRN that was then walked through this wizard once already
  // (GRN-2026-0101: qc_status 'Passed', verdict 'accept', qc_specs entirely unreviewed). So step 7
  // must not re-demand the checklist for ANY decision made before this mount, regardless of which
  // path made it — qcDecidedAtOpen alone (below) is the right check, not a narrower "was it really
  // fast-tracked" guess.
  // Wizard: 1 Confirm Receipt · 2 Confirm Details · 3 Batch Details · 4 Packaging List · 5 Generate Labels · 6 Quarantine → QC · 7 QC → Complete.
  // Resume at the furthest confirmed step so reopening a GRN lands where the user left off.
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(() => {
    // GRN-2026-0100: QC approved via the row's fast-track QcQuickDecisionModal, then Assign Rack.
    // qcDecidedAtOpen (above) covers that case in addition to this wizard's own verdict — reading
    // sourceDocuments.qc.verdict alone left this false despite qc_status already being 'Passed', so
    // this always landed on step 7 and re-demanded a full QC checklist before Generate Labels/
    // Complete were reachable — stock stayed in_transit because Complete was never reached.
    const qcDecided = qcDecidedAtOpen.current;
    const labelsDone =
      (Array.isArray(grn.generatedLabels) && grn.generatedLabels.length > 0) ||
      (grn.workflowSteps ?? []).includes('Label Generation');
    // Once QC is decided, step 7 has nothing left to DO until labels exist — Accept there just
    // re-saves the same already-accepted QC and closes, with no visible change. Landing back on
    // step 7 on every reopen made that dead click look like a bug: "I keep clicking Accept and
    // nothing updates." Send the user straight to the step that is actually still open.
    if (qcDecided && !labelsDone) return 5;
    if (grn.sourceDocuments?.qc?.sentAt) return 7;
    if (readGrnPackagingMeta(grn.sourceDocuments).confirmedAt) return 5;
    if (readGrnBatchesMeta(grn.sourceDocuments).confirmedAt) return 4;
    if (readGrnDetailsMeta(grn.sourceDocuments).confirmedAt) return 3;
    if (readGrnReceiptMeta(grn.sourceDocuments).confirmedAt) return 2;
    return 1;
  });

  // Step blobs live inside sourceDocuments, so they ride through every existing save path
  // (draft, label generation, quarantine) with no extra plumbing.
  const receiptMeta = useMemo(() => readGrnReceiptMeta(sourceDocuments), [sourceDocuments]);
  const patchReceiptMeta = useCallback((patch: Partial<InboundGrnReceiptMeta>): void => {
    setSourceDocuments((prev) => ({
      ...prev,
      receipt: { ...readGrnReceiptMeta(prev), ...patch },
    }));
  }, []);
  const detailsMeta = useMemo(() => readGrnDetailsMeta(sourceDocuments), [sourceDocuments]);
  const patchDetailsMeta = useCallback((patch: Partial<InboundGrnDetailsMeta>): void => {
    setSourceDocuments((prev) => ({
      ...prev,
      details: { ...readGrnDetailsMeta(prev), ...patch },
    }));
  }, []);
  const batchesMeta = useMemo(() => readGrnBatchesMeta(sourceDocuments), [sourceDocuments]);
  /**
   * Record that the vendor didn't assign a batch number. Clears only vendorBatchNo so a value
   * typed before ticking the box cannot be saved as though the vendor had provided it — MFG/EXP
   * dates, COA, and pack counts are deliberately kept: they can still be on the packaging even
   * without a vendor batch no., and Step 4 / the QR labels depend on the pack counts regardless.
   */
  const setVendorBatchNotApplicable = useCallback((next: boolean): void => {
    setSourceDocuments((prev) => {
      const meta = readGrnBatchesMeta(prev);
      const rows = (meta.rows ?? []).map((r) => (next ? { ...r, vendorBatchNo: null } : r));
      return { ...prev, batches: { ...meta, rows, vendorBatchNotApplicable: next } };
    });
  }, []);

  const setBatchRow = useCallback((index: number, patch: Partial<GrnBatchRow>): void => {
    setSourceDocuments((prev) => {
      const meta = readGrnBatchesMeta(prev);
      const rows = meta.rows ? [...meta.rows] : [];
      rows[index] = { ...emptyBatchRow(), ...rows[index], ...patch };
      return { ...prev, batches: { ...meta, rows } };
    });
  }, []);

  // Keep the batch row count in sync with "No. of batches received" whenever step 3 is shown.
  // Newly-added rows get a system-generated internal Batch No. (B126-#####, backend-allocated —
  // see fetchNextVendorBatchNos) filled into the "#" column. This is distinct from "Vendor Batch
  // No.", which stays a plain manual field — staff type in whatever the vendor's own paperwork says.
  const targetBatchCount = Math.max(0, Math.floor(Number(detailsMeta.batchesReceived) || 0));
  const batchRowCount = batchesMeta.rows?.length ?? 0;
  useEffect(() => {
    if (currentStep !== 3 || targetBatchCount <= 0 || batchRowCount === targetBatchCount) return;
    const newRowCount = targetBatchCount - batchRowCount;
    if (newRowCount <= 0) {
      setSourceDocuments((prev) => {
        const meta = readGrnBatchesMeta(prev);
        return { ...prev, batches: { ...meta, rows: reconcileBatchRows(meta.rows ?? [], targetBatchCount) } };
      });
      return;
    }
    let cancelled = false;
    (async () => {
      let generatedCodes: string[] = [];
      try {
        generatedCodes = await fetchNextVendorBatchNos(newRowCount);
      } catch {
        // Backend allocation failed (offline/etc.) — new rows just show "Batch N" until retried.
      }
      if (cancelled) return;
      setSourceDocuments((prev) => {
        const meta = readGrnBatchesMeta(prev);
        const rows = reconcileBatchRows(meta.rows ?? [], targetBatchCount);
        const filledRows = rows.map((row, i) =>
          i >= batchRowCount && !row.systemBatchNo && generatedCodes[i - batchRowCount]
            ? { ...row, systemBatchNo: generatedCodes[i - batchRowCount] }
            : row,
        );
        return { ...prev, batches: { ...meta, rows: filledRows } };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, targetBatchCount, batchRowCount]);

  // GRN by Transfer: read back how many distinct batches the source MRN actually shipped (recorded
  // per picked pack at dispatch time — see handlePickSplitNext) instead of asking the receiver to
  // count/re-key it. Only fills the field once, and only when it isn't already set — a receiver
  // correcting a short/damaged receipt is never silently overwritten. Transfer GRNs carry the MRN's
  // human-readable number in `poNo` (there is no numeric mrnId on the GRN record), so the match is
  // by mrnNo, not id — see resolveGrnReceiptSource / grn.poNo usage elsewhere in this modal.
  useEffect(() => {
    if (!isTransferGrn || currentStep !== 2 || transferBatchAutoFillRef.current) return;
    if (detailsMeta.batchesReceived != null) return;
    const mrnNo = String(grn.poNo ?? '').trim();
    if (!mrnNo) return;
    transferBatchAutoFillRef.current = true;
    fetchMRNList()
      .then((list) => {
        const source = list.find((m) => m.mrnNo === mrnNo);
        const batches = new Set(
          (source?.generatedLabels ?? [])
            .map((l) => String(l.vendorBatch ?? '').trim())
            .filter((b) => b !== ''),
        );
        if (batches.size > 0) patchDetailsMeta({ batchesReceived: batches.size });
      })
      .catch(() => {
        // No source batch data available (older transfer, or MRN lookup failed) — leave the field
        // for the receiver to fill in manually, same as it works today.
      });
  }, [isTransferGrn, currentStep, detailsMeta.batchesReceived, grn.poNo, patchDetailsMeta]);

  const packagingMeta = useMemo(() => readGrnPackagingMeta(sourceDocuments), [sourceDocuments]);
  const setPackagingRow = useCallback((index: number, patch: Partial<GrnPackagingRow>): void => {
    setSourceDocuments((prev) => {
      const meta = readGrnPackagingMeta(prev);
      const rows = meta.rows ? [...meta.rows] : [];
      if (!rows[index]) return prev;
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, packaging: { ...meta, rows } };
    });
  }, []);

  // Expand the pack list from batches whenever step 4 is shown; preserve per-pack edits.
  const expectedPackaging = useMemo(
    () => buildPackagingRows(grn.grnNo, batchesMeta.rows ?? []),
    [grn.grnNo, batchesMeta.rows],
  );
  const packagingMatchesBatches =
    (packagingMeta.rows?.length ?? 0) === expectedPackaging.length &&
    (packagingMeta.rows ?? []).every((r, i) => r.packagingNo === expectedPackaging[i]?.packagingNo);
  useEffect(() => {
    if (currentStep !== 4 || packagingMatchesBatches) return;
    setSourceDocuments((prev) => {
      const meta = readGrnPackagingMeta(prev);
      return {
        ...prev,
        packaging: { ...meta, rows: reconcilePackagingRows(meta.rows ?? [], grn.grnNo, readGrnBatchesMeta(prev).rows ?? []) },
      };
    });
  }, [currentStep, packagingMatchesBatches, grn.grnNo]);

  /**
   * The box-QR labels (generateLabelsCore below) must match the REAL packs recorded in the
   * Packaging List (step 4) — packRows was previously seeded once from grn.noOfBoxes (a stale GRN
   * field that defaults to 1 and is never updated by confirming batches/packaging) plus an even
   * split of rcvdQty. That silently collapsed multiple real packs into fewer/wrong-sized generated
   * labels — e.g. two 50 pc packs in the packaging list printed as a single 100-unit box label.
   * packRows.actualQty is never hand-edited in this modal (handlePackActualChange is unused), so
   * it's safe to fully resync packRows from the packaging list whenever it changes.
   */
  useEffect(() => {
    const rows = packagingMeta.rows;
    if (!rows || rows.length === 0) return;
    setPackRows(
      rows.map((row, i) => {
        const qty = Number(row.qty) || 0;
        return {
          packIndex: i + 1,
          packTotal: rows.length,
          declaredQty: qty,
          actualQty: qty,
          variance: 0,
          condition: 'OK',
          unit: lineItem.unit ?? 'kg',
        };
      }),
    );
  }, [packagingMeta.rows, lineItem.unit]);

  useEffect(() => {
    let alive = true;
    fetchGRNAssignableUsers()
      .then((users) => { if (alive) setAssignableUsers(users); })
      .catch(() => { /* dropdown just stays empty; assignment is optional */ });
    return () => { alive = false; };
  }, []);

  // Load the item-master QC specs the first time step 7 is shown.
  useEffect(() => {
    if (currentStep !== 7 || qcLoadedRef.current) return;
    qcLoadedRef.current = true;
    setQcLoading(true);
    fetchGRNQcReference(grn.id)
      .then((res) => setQcSpecs(res.qcSpecs))
      .catch((e) => setQcError(e instanceof Error ? e.message : 'Failed to load QC specs'))
      .finally(() => setQcLoading(false));
  }, [currentStep, grn.id]);

  const sourceDocumentsWithRefs = useMemo(
    () => docRefsToSourceDocuments(docRefs, sourceDocuments),
    [docRefs, sourceDocuments],
  );

  const receiptInput = useMemo(
    () => ({
      grnNo: grn.grnNo,
      poNo: grn.poNo,
      vendor: grn.vendor,
      expectedDate: grn.expectedDate,
      receivedDate: grn.receivedDate,
      grnDate: grn.grnDate,
      generatedAt: grn.grnDate,
      invoiceNo: grn.invoiceNo,
      noOfBoxes: grn.noOfBoxes,
      unitsPerBox: grn.unitsPerBox,
      locationZone: grn.locationZone,
      // Without these, resolveGrnReceiptSource() inside buildGrnMatchChecks falls back to 'po' for
      // every transfer GRN (this object never carried them), so the step-7 Accept gate re-demanded
      // Tax Invoice/E-Way Bill/COA — paperwork that can't exist for a warehouse-to-warehouse
      // transfer — even though the component-level isTransferGrn (computed straight off `grn`)
      // already correctly hid that requirement at step 2. Keep both checks agreeing.
      receiptSource: grn.receiptSource,
      mrnId: grn.mrnId,
      sourceDocuments: sourceDocumentsWithRefs,
      lineItem: {
        ...lineItem,
        invoiceQty: billedQty,
        unitPrice: verifiedUnitPrice,
      },
    }),
    [grn, lineItem, sourceDocumentsWithRefs, billedQty, verifiedUnitPrice],
  );

  const headerView = useMemo(() => buildGrnCopyReceiptHeaderView(receiptInput), [receiptInput]);
  const headerFields = useMemo(() => buildGrnCopyReceiptHeaderFields(receiptInput), [receiptInput]);
  const documentRows = useMemo(
    () => buildGrnCopyDocumentRows(receiptInput),
    [receiptInput],
  );
  const existingLabels = useMemo(
    () =>
      resolveGrnExistingLabels({
        generatedLabels: grn.generatedLabels,
        lineItems: grn.lineItems,
        lineItem,
      }),
    [grn.generatedLabels, grn.lineItems, lineItem],
  );
  const hasExistingLabels = existingLabels.length > 0;

  // A ticked shipment-photo tag (Truck / Packs / Doc) counts as a provided photo, so the
  // requirement is satisfied by the marked tags even though the file input is reset after
  // selection (no visible filename). Keeps the check in sync with the ✓ marks the user sees.
  // Photo requirement is now satisfied by the Confirm Receipt step's stored vehicle/document photos.
  const effectivePhotoCount =
    (receiptMeta.vehiclePhotos?.length ?? 0) + (receiptMeta.documentPhotos?.length ?? 0);
  const matchChecks = useMemo(
    () =>
      buildGrnMatchChecks({
        grn: receiptInput,
        packRows,
        documentRows,
        photoCount: effectivePhotoCount,
        existingLabelCount: existingLabels.length,
        billedQty,
        verifiedUnitPrice,
      }),
    [receiptInput, packRows, documentRows, effectivePhotoCount, existingLabels.length, billedQty, verifiedUnitPrice],
  );
  const receiptChecksPass = allGrnReceiptChecksPass(matchChecks);
  const coreChecksPass = allGrnCoreMatchChecksPass(matchChecks);
  const prerequisitesMet = grnReceiptPrerequisitesMet(matchChecks);
  const receivedPacks = packRows.filter((row) => row.actualQty > 0).length;
  const physicalTotal = packRows.reduce((sum, row) => sum + row.actualQty, 0);
  const docsLocked = grnReceiptDocumentsLocked(mode, grn);
  /** Required receipt documents still missing — drives the * outlines and the step-2 block. */
  const missingDocKeys = useMemo(
    () => missingRequiredGrnDocs(sourceDocuments, { skipChecklistDocs: isTransferGrn }),
    [sourceDocuments, isTransferGrn],
  );
  /** Only the documents the dock checklist says arrived get an upload slot. */
  const requiredDocKeys = useMemo(
    () => requiredGrnDocKeys(sourceDocuments, { skipChecklistDocs: isTransferGrn }),
    [sourceDocuments, isTransferGrn],
  );

  const handleDownloadGrnCopy = (): void => {
    const ok = printGrnCopyPdf({
      grnNo: grn.grnNo,
      poNo: grn.poNo,
      vendor: grn.vendor,
      status: grn.status,
      receivedDate: grn.receivedDate,
      grnDate: grn.grnDate,
      invoiceNo: grn.invoiceNo,
      invoiceAmount: grn.invoiceAmount,
      assignedTo: grn.assignedTo,
      qcStatus: grn.qcStatus,
      qcBy: grn.qcBy ?? qcBy,
      locationZone: grn.locationZone,
      locationPrefix: grn.locationPrefix,
      documents: requiredDocKeys.map((key) => ({
        label: GRN_REQUIRED_DOC_LABELS[key],
        uploaded: Boolean(docFileNameFor(sourceDocuments, key)),
        fileName: docFileNameFor(sourceDocuments, key),
      })),
      lineItems: [
        {
          item: lineItem.item,
          itemCode: lineItem.itemCode,
          poQty: lineItem.poQty,
          shippedQty: lineItem.shippedQty,
          rcvdQty: physicalTotal || lineItem.rcvdQty,
          invoiceQty: billedQty,
          unitPrice: verifiedUnitPrice,
          diff: (physicalTotal || lineItem.rcvdQty) - lineItem.poQty,
          qcStatus: grn.qcStatus,
        },
      ],
    });
    if (!ok) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
    }
  };

  const updateDocRef = (key: GrnCopyDocRefKey, ref: string): void => {
    setDocRefs((prev) => ({ ...prev, [key]: ref }));
  };

  const [uploadingDoc, setUploadingDoc] = useState<GrnCopyDocUploadKey | null>(null);
  const DOC_FILE_MAX_BYTES = 4 * 1024 * 1024; // stored inline as base64 in sourceDocuments (JSON column) — keep it bounded

  // handleDocFileUpload / clearDocFile were previously defined but never called from any rendered
  // element — the whole "Documents received (Invoice + EWB + COA)" match check could therefore
  // never pass for ANY GRN, which is what silently blocked Generate Labels (and so GRN Complete)
  // on this and every other GRN. Made real here: an actual upload control now renders at step 2,
  // and this PATCHes immediately so the doc survives even if the modal is closed before the next
  // step's own save.
  const handleDocFileUpload = async (key: GrnCopyDocUploadKey, file: File): Promise<void> => {
    if (file.size > DOC_FILE_MAX_BYTES) {
      addToast('error', `${file.name} is over ${Math.round(DOC_FILE_MAX_BYTES / (1024 * 1024))} MB — use a smaller scan/photo.`);
      return;
    }
    setUploadingDoc(key);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const nextDocs: InboundGrnSourceDocuments = {
        ...sourceDocuments,
        [key]: {
          ...(sourceDocuments[key] ?? {}),
          fileName: file.name,
          url,
          uploadedAt: new Date().toISOString(),
        },
      };
      const merged = docRefsToSourceDocuments(docRefs, nextDocs);
      await updateGRN(grn.id, { sourceDocuments: merged });
      setSourceDocuments(nextDocs);
      // Same staleness class fixed elsewhere in this file: without echoing to onSaved, the ROW in
      // the inbound list (and receiptModal.grn, if this same modal is reopened) kept reading "0 of
      // 4 docs uploaded" until a full page reload, even though the file was already saved.
      onSaved({ ...grn, sourceDocuments: merged });
      addToast('success', `${file.name} uploaded.`);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };

  const clearDocFile = async (key: GrnCopyDocUploadKey): Promise<void> => {
    const entry = { ...(sourceDocuments[key] ?? {}) };
    delete entry.fileName;
    delete entry.uploadedAt;
    delete entry.url;
    const nextDocs: InboundGrnSourceDocuments = { ...sourceDocuments };
    if (!String(entry.ref ?? '').trim()) {
      delete nextDocs[key];
    } else {
      nextDocs[key] = entry;
    }
    try {
      const merged = docRefsToSourceDocuments(docRefs, nextDocs);
      await updateGRN(grn.id, { sourceDocuments: merged });
      setSourceDocuments(nextDocs);
      onSaved({ ...grn, sourceDocuments: merged });
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to remove document');
    }
  };


  const handlePackActualChange = (index: number, value: string): void => {
    const nextQty = Math.max(0, Number(value) || 0);
    setPackRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              actualQty: nextQty,
              variance: Math.round((nextQty - row.declaredQty) * 1000) / 1000,
            }
          : row,
      ),
    );
  };

  const buildLineItemsPayload = (physicalTotal: number): UpdateGRNPayload['lineItems'] => {
    const poQty = Number(lineItem.poQty) || 0;
    const diff = Math.round((physicalTotal - poQty) * 1000) / 1000;
    const updatedLine = {
      id: lineItem.id,
      item: lineItem.item,
      itemCode: lineItem.itemCode,
      poQty: lineItem.poQty,
      rcvdQty: physicalTotal,
      invoiceQty: billedQty,
      unitPrice: verifiedUnitPrice,
      diff,
      qcStatus: '',
      qcBy: '',
    };
    if (grn.lineItems?.length) {
      return grn.lineItems.map((li) =>
        String(li.itemCode ?? '').trim().toUpperCase() === String(lineItem.itemCode).trim().toUpperCase()
          ? { ...li, ...updatedLine }
          : li,
      ) as UpdateGRNPayload['lineItems'];
    }
    return [updatedLine] as UpdateGRNPayload['lineItems'];
  };

  /**
   * units_per_box is an `integer` column, but a pack's actual quantity is whatever unit the item
   * is measured in (e.g. kg for RM) and is routinely fractional — a 1 kg item split across 5 packs
   * gives 0.2 kg/pack. Sending that straight through 400s the update with a Postgres type error.
   * This scalar is only ever a rough summary (the real per-box breakdown is unitsPerBoxList, sent
   * separately to generateGRNLabels), so rounding here is safe.
   */
  const toIntegerUnitsPerBox = (qty: number | null | undefined): number | null =>
    qty == null ? null : Math.round(qty);

  const persistReceiptDocuments = async (
    mergedDocs: InboundGrnSourceDocuments,
    physicalTotal: number,
    extra: Record<string, unknown> = {},
  ): Promise<void> => {
    await updateGRN(grn.id, {
      sourceDocuments: mergedDocs,
      noOfBoxes: packRows.length,
      unitsPerBox: toIntegerUnitsPerBox(packRows[0]?.actualQty ?? grn.unitsPerBox ?? null),
      lineItems: buildLineItemsPayload(physicalTotal),
      ...extra,
    });
  };

  /**
   * The actual QR-label generation call, factored out so Accept (step 7) can run it inline instead
   * of forcing the user back to step 5 by hand. Does not gate on receiptChecksPass or toast/close —
   * callers decide that, since Accept and the manual step-5 button want different messaging.
   */
  const generateLabelsCore = async (): Promise<{
    labels: GeneratedLabel[];
    workflowSteps: string[];
    noOfBoxes: number;
    unitsPerBox: number | null;
    mergedDocs: InboundGrnSourceDocuments;
    status: string;
  }> => {
    const unitsPerBoxList = packRows.map((row) => row.actualQty);
    const mergedDocs = docRefsToSourceDocuments(docRefs, sourceDocuments);
    const physicalTotal = packRows.reduce((sum, row) => sum + row.actualQty, 0);
    const verifiedPayload = inboundGrnVerifiedAfterLabelsPayload(grn.workflowSteps);
    await persistReceiptDocuments(mergedDocs, physicalTotal, verifiedPayload);
    const labelRes = await generateGRNLabels(grn.id, {
      noOfBoxes: packRows.length,
      unitsPerBoxList,
      itemCode: lineItem.itemCode,
      productName: grnLineItemDisplayName(lineItem),
    });
    const noOfBoxes = packRows.length;
    const unitsPerBox = toIntegerUnitsPerBox(packRows[0]?.actualQty ?? grn.unitsPerBox ?? null);
    const workflowSteps = labelRes.workflowSteps ?? verifiedPayload.workflowSteps;
    setSourceDocuments(mergedDocs);
    setPreviewLabels(labelRes.labels ?? []);
    return { labels: labelRes.labels ?? [], workflowSteps, noOfBoxes, unitsPerBox, mergedDocs, status: verifiedPayload.status };
  };

  const handleGenerateLabels = async (): Promise<void> => {
    if (!receiptChecksPass) {
      addToast(
        'error',
        'Complete all match checks and upload at least one shipment photo before generating labels.',
      );
      return;
    }
    setGenerating(true);
    try {
      const res = await generateLabelsCore();
      const completeAfterLabelGeneration =
        qcAlreadyDecided && putawayMissing.length === 0 && Boolean(qcBy.trim());
      if (completeAfterLabelGeneration) {
        const completedWorkflowSteps = [...new Set([...res.workflowSteps, ...GRN_COMPLETE_WORKFLOW_STEPS])];
        await updateGRN(grn.id, {
          status: 'GRN Complete',
          qcStatus: 'Passed',
          qcBy: qcBy.trim(),
          workflowSteps: completedWorkflowSteps,
        });
        addToast('success', `${res.noOfBoxes} rack labels generated · GRN completed. Print the labels below.`);
        onSaved({
          ...grn,
          status: 'GRN Complete',
          qcStatus: 'Passed',
          sourceDocuments: res.mergedDocs,
          noOfBoxes: res.noOfBoxes,
          unitsPerBox: res.unitsPerBox,
          workflowSteps: completedWorkflowSteps,
          generatedLabels: res.labels,
        });
        return;
      }
      addToast(
        'success',
        `${res.noOfBoxes} rack labels generated · GRN verified · use Send to QC when ready.`,
      );
      // Push the update to the parent list, but stay open so the labels can be
      // previewed and printed here — reopening the GRN just to print was the old flow.
      onSaved({
        ...grn,
        status: res.status,
        sourceDocuments: res.mergedDocs,
        noOfBoxes: res.noOfBoxes,
        unitsPerBox: res.unitsPerBox,
        workflowSteps: res.workflowSteps,
        generatedLabels: res.labels,
      });
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to generate labels');
    } finally {
      setGenerating(false);
    }
  };

  const handleMismatchQuarantine = async (): Promise<void> => {
    if (!prerequisitesMet) {
      addToast('error', 'Upload invoice, EWB, COA, and at least one shipment photo before reporting mismatch.');
      return;
    }
    if (coreChecksPass) {
      addToast('error', 'All quantity and price checks match — use Generate Labels instead.');
      return;
    }
    setGenerating(true);
    try {
      const mergedDocs = docRefsToSourceDocuments(docRefs, {
        ...sourceDocuments,
      }) as InboundGrnSourceDocuments & {
        mismatch?: {
          detectedAt: string;
          failedChecks: string[];
          procurementNotifiedAt: string;
        };
      };
      mergedDocs.mismatch = {
        detectedAt: new Date().toISOString(),
        failedChecks: matchChecks.filter((check) => !check.pass).map((check) => check.label),
        procurementNotifiedAt: new Date().toISOString(),
      };
      const physicalTotal = packRows.reduce((sum, row) => sum + row.actualQty, 0);
      const quarantinePayload = inboundGrnMismatchQuarantinePayload(grn.workflowSteps);
      await persistReceiptDocuments(mergedDocs, physicalTotal, quarantinePayload);
      addToast(
        'warning',
        'Document-physical mismatch · GRN quarantined · Procurement notified · routed to Quality.',
      );
      onSaved({
        ...grn,
        status: quarantinePayload.status,
        sourceDocuments: mergedDocs,
        workflowSteps: quarantinePayload.workflowSteps,
      });
      onQuarantined?.();
      onClose();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to quarantine GRN');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async (): Promise<void> => {
    setSaving(true);
    try {
      const mergedDocs = docRefsToSourceDocuments(docRefs, sourceDocuments);
      await updateGRN(grn.id, { sourceDocuments: mergedDocs });
      addToast('success', 'Receipt draft saved.');
      onSaved({ ...grn, sourceDocuments: mergedDocs });
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReceipt = async (): Promise<void> => {
    const errors = grnReceiptValidationErrors(receiptMeta, { skipChecklist: isTransferGrn });
    if (errors.length) {
      addToast('error', errors[0]);
      return;
    }
    setConfirmingReceipt(true);
    try {
      const confirmedMeta: InboundGrnReceiptMeta = {
        ...receiptMeta,
        confirmedAt: new Date().toISOString(),
      };
      const mergedDocs = docRefsToSourceDocuments(docRefs, {
        ...sourceDocuments,
        receipt: confirmedMeta,
      });
      // Mirror onto the real GRN columns. received_date is DATEONLY, so send the date only —
      // the time is kept in the receipt blob for display.
      const receivedDate = confirmedMeta.receiptDate || null;
      const payload: UpdateGRNPayload = { sourceDocuments: mergedDocs };
      if (receivedDate) payload.receivedDate = receivedDate;
      // Confirming receipt IS the arrival. The old silent 'Confirm' action (status → LANDED with no
      // vehicle or photo capture) no longer exists in the receiving flow, so stamp arrival here.
      // Guarded on IN TRANSIT so a GRN already past landing is never dragged back a stage.
      if (/in[\s_-]?transit/i.test(String(grn.status ?? ''))) {
        const arrival = inboundGrnArrivalConfirmPayload(grn.workflowSteps);
        payload.status = arrival.status;
        payload.workflowSteps = arrival.workflowSteps;
        payload.grnDate = arrival.grnDate;
        if (!payload.receivedDate) payload.receivedDate = arrival.receivedDate;
      }
      if (confirmedMeta.assignmentType === 'specific' && confirmedMeta.assignedTo) {
        payload.assignedTo = confirmedMeta.assignedTo;
      }
      await updateGRN(grn.id, payload);
      setSourceDocuments((prev) => ({ ...prev, receipt: confirmedMeta }));
      addToast('success', 'Receipt confirmed. Continue with shipment details.');
      // Echo back everything the payload actually wrote. Omitting status/workflowSteps/grnDate left
      // the inbound row showing IN TRANSIT with the old date until a manual refresh revealed LANDED,
      // because handleReceiptSaved falls back to the previous value for any field not supplied.
      onSaved({
        ...grn,
        sourceDocuments: mergedDocs,
        receivedDate: payload.receivedDate ?? grn.receivedDate,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.workflowSteps ? { workflowSteps: payload.workflowSteps } : {}),
        ...(payload.grnDate ? { grnDate: payload.grnDate } : {}),
      });
      setCurrentStep(2);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to confirm receipt');
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const handleConfirmDetails = async (): Promise<void> => {
    const errors = grnDetailsValidationErrors(detailsMeta);
    if (errors.length) {
      addToast('error', errors[0]);
      return;
    }
    // Invoice / E-Way Bill / COA gate label generation and therefore completion. Refusing here —
    // where they are entered — instead of silently at step 5 keeps the reason next to the fields.
    const docsError = requiredGrnDocsError(sourceDocuments, { skipChecklistDocs: isTransferGrn });
    if (docsError) {
      addToast('error', docsError);
      return;
    }
    setConfirmingDetails(true);
    try {
      const confirmedMeta: InboundGrnDetailsMeta = {
        ...detailsMeta,
        confirmedAt: new Date().toISOString(),
      };
      const mergedDocs = docRefsToSourceDocuments(docRefs, {
        ...sourceDocuments,
        details: confirmedMeta,
      });
      await updateGRN(grn.id, { sourceDocuments: mergedDocs });
      setSourceDocuments((prev) => ({ ...prev, details: confirmedMeta }));
      addToast('success', 'Details saved. Enter batch details next.');
      onSaved({ ...grn, sourceDocuments: mergedDocs });
      setCurrentStep(3);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save details');
    } finally {
      setConfirmingDetails(false);
    }
  };

  const handleConfirmBatches = async (): Promise<void> => {
    const errors = grnBatchesValidationErrors(batchesMeta, targetBatchCount);
    if (errors.length) {
      addToast('error', errors[0]);
      return;
    }
    setConfirmingBatches(true);
    try {
      const confirmedMeta = { ...batchesMeta, confirmedAt: new Date().toISOString() };
      const mergedDocs = docRefsToSourceDocuments(docRefs, {
        ...sourceDocuments,
        batches: confirmedMeta,
      });
      await updateGRN(grn.id, { sourceDocuments: mergedDocs });
      setSourceDocuments((prev) => ({ ...prev, batches: confirmedMeta }));
      addToast('success', 'Batch details saved. Review the packaging list next.');
      onSaved({ ...grn, sourceDocuments: mergedDocs });
      setCurrentStep(4);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save batch details');
    } finally {
      setConfirmingBatches(false);
    }
  };

  // After pack labels print, flip each pack to "Labelled" and persist (non-fatal if the save fails).
  const handlePackLabelsPrinted = useCallback(async (): Promise<void> => {
    const meta = readGrnPackagingMeta(sourceDocuments);
    if (!meta.rows?.length) return;
    const nextPackaging = {
      ...meta,
      rows: meta.rows.map((r) => ({ ...r, labelStatus: 'labelled' as const })),
    };
    setSourceDocuments((prev) => ({ ...prev, packaging: nextPackaging }));
    try {
      const merged = docRefsToSourceDocuments(docRefs, { ...sourceDocuments, packaging: nextPackaging });
      await updateGRN(grn.id, { sourceDocuments: merged });
    } catch {
      /* labels already printed; the "labelled" flag will re-save on the next action */
    }
  }, [sourceDocuments, docRefs, grn.id]);

  /**
   * Persist the pack label snapshot from Generate Labels (step 5) before it's printed there, so
   * every later reprint ("Print pack labels", below) shows exactly this — never a recomputation
   * from batches/packaging, which could have since been edited.
   */
  const handlePackLabelsGenerated = useCallback(
    async (labels: GeneratedPackLabel[]): Promise<void> => {
      const saved = await saveGRNPackLabels(grn.id, labels);
      onSaved({ ...grn, generatedPackLabels: saved });
    },
    [grn, onSaved],
  );

  /**
   * Hidden, always-mounted QR canvases — only used as the one-time backfill path below, for a GRN
   * whose labels were generated before pack-label persistence existed (no grn.generatedPackLabels
   * on file yet). Kept off the main render path otherwise.
   */
  const reprintPackGridRef = useRef<HTMLDivElement>(null);
  const [reprintingPackLabels, setReprintingPackLabels] = useState(false);
  const packLabelCtx = useMemo(
    () => ({
      batches: batchesMeta.rows ?? [],
      productName: grnLineItemDisplayName(lineItem),
      productCode: lineItem.itemCode,
      vendor: grn.vendor,
      unit: lineItem.unit,
    }),
    [batchesMeta.rows, lineItem, grn.vendor],
  );

  /**
   * Reprint the pack labels persisted at Generate Labels (step 5) — available from any step, for a
   * lost/damaged label, without ever regenerating: same labels every time. The only exception is a
   * GRN whose labels were generated before pack-label persistence existed — there, this backfills a
   * snapshot once (from the current, by-then-locked batches/packaging) and persists it, so every
   * later click of this same button reprints that frozen snapshot too.
   */
  const handleReprintPackLabels = async (): Promise<void> => {
    if (reprintingPackLabels) return;
    let labels = grn.generatedPackLabels ?? [];
    if (!labels.length) {
      const rows = packagingMeta.rows ?? [];
      if (!rows.length) {
        addToast('error', 'No pack labels generated yet — use Generate Labels (step 5) first.');
        return;
      }
      const canvases = reprintPackGridRef.current
        ? Array.from(reprintPackGridRef.current.querySelectorAll<HTMLCanvasElement>('canvas'))
        : [];
      const qrDataUrls = rows.map((_, i) => canvases[i]?.toDataURL('image/png') ?? '');
      labels = buildGeneratedPackLabels(rows, qrDataUrls, packLabelCtx);
      setReprintingPackLabels(true);
      try {
        labels = await saveGRNPackLabels(grn.id, labels);
        onSaved({ ...grn, generatedPackLabels: labels });
      } catch {
        addToast('error', 'Failed to save pack labels — try again.');
        return;
      } finally {
        setReprintingPackLabels(false);
      }
    }
    if (!printStoredPackLabels(labels)) {
      addToast('error', 'Could not open print window. Allow popups and try again.');
      return;
    }
    void handlePackLabelsPrinted();
  };

  const handleConfirmPackaging = async (): Promise<void> => {
    const errors = grnPackagingValidationErrors(packagingMeta);
    if (errors.length) {
      addToast('error', errors[0]);
      return;
    }
    setConfirmingPackaging(true);
    try {
      const confirmedMeta = { ...packagingMeta, confirmedAt: new Date().toISOString() };
      const mergedDocs = docRefsToSourceDocuments(docRefs, {
        ...sourceDocuments,
        packaging: confirmedMeta,
      });
      await updateGRN(grn.id, { sourceDocuments: mergedDocs });
      setSourceDocuments((prev) => ({ ...prev, packaging: confirmedMeta }));
      addToast('success', 'Packaging list saved. Generate labels next.');
      onSaved({ ...grn, sourceDocuments: mergedDocs });
      setCurrentStep(5);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save packaging list');
    } finally {
      setConfirmingPackaging(false);
    }
  };

  /**
   * Put-away details the backend requires before a GRN can be marked Complete
   * (`grnCompletionBlockers`). They are captured by the warehouse's Assign Rack action, not by this
   * modal — so accepting QC here can save the QC result and still be refused completion. Naming the
   * gap up front turns a post-click 400 into an expected next step.
   */
  const putawayMissing = useMemo(() => {
    const missing: string[] = [];
    if (!String(grn.assignedTo ?? '').trim()) missing.push('an assignee');
    if (!String(grn.locationPrefix ?? '').trim()) missing.push('a rack code');
    if (!String(grn.locationZone ?? '').trim()) missing.push('a storage zone');
    return missing;
  }, [grn.assignedTo, grn.locationPrefix, grn.locationZone]);

  /**
   * QR labels are the other completion prerequisite, and the one that also gates the inbound row's
   * "Assign Rack" action — so a GRN that skipped step 5 cannot reach put-away at all. Pointing a
   * user at Assign Rack before labels exist sends them to a button that isn't on the row yet.
   */
  const labelsMissing = useMemo(
    () =>
      !(Array.isArray(grn.generatedLabels) && grn.generatedLabels.length > 0) &&
      !(grn.workflowSteps ?? []).includes('Label Generation'),
    [grn.generatedLabels, grn.workflowSteps],
  );

  // Put-away is deliberately NOT captured here. Free-text zone/rack fields on this step bypassed
  // the Facility Management picker (and its post-racking photo checks), so racks got invented as
  // strings. Rack assignment happens in the row's Assign Rack popup; QC accept below releases the
  // hold so that action appears immediately.
  const canCompleteAfterQc = putawayMissing.length === 0 && (!labelsMissing || receiptChecksPass);

  const qcSentAt = sourceDocuments.qc?.sentAt ?? null;
  // QC has already been decided (Accept or Reject) in this session or an earlier one. Once true,
  // step 6's forward action must NOT be "Send to QC" again — that reopens the quarantine hold on a
  // GRN that already passed. Read from sourceDocuments (proper local state) rather than grn.qcStatus
  // (a raw prop that goes stale mid-session — see the receiptModal sync fix in Inbound.tsx) for any
  // decision made THIS session; qcDecidedAtOpen (captured once at mount, same as currentStep above)
  // additionally covers a decision made earlier through a different modal entirely — the fast-track
  // QcQuickDecisionModal never touches sourceDocuments.qc, only qc_status (GRN-2026-0100).
  const qcAlreadyDecided =
    sourceDocuments.qc?.verdict === 'accept' || sourceDocuments.qc?.verdict === 'reject' || qcDecidedAtOpen.current;
  const handleSendToQc = async (): Promise<void> => {
    // GRN-2026-0185 reached QC with none of the four documents on file, because Send to QC does not
    // pass through step 2. The same requirement applies here — QC inspects against the COA, and the
    // GRN cannot be completed later without these anyway.
    const docsError = requiredGrnDocsError(sourceDocuments, { skipChecklistDocs: isTransferGrn });
    if (docsError) {
      addToast('error', docsError);
      return;
    }
    setSendingToQc(true);
    try {
      const payload = inboundGrnSendToQuarantineQcPayload(grn.workflowSteps);
      const sentAt = new Date().toISOString();
      const mergedDocs = docRefsToSourceDocuments(docRefs, { ...sourceDocuments, qc: { sentAt } });
      await updateGRN(grn.id, { ...payload, sourceDocuments: mergedDocs });
      setSourceDocuments((prev) => ({ ...prev, qc: { sentAt } }));
      addToast('warning', 'Sent to Quarantine → QC · GRN is On Hold pending Quality inspection.');
      onSaved({
        ...grn,
        status: payload.status,
        workflowSteps: payload.workflowSteps,
        sourceDocuments: mergedDocs,
      });
      // Sending to QC ends the warehouse's part: the GRN is On Hold in the Quality queue and
      // Complete GRN only happens once QC passes. Advancing to step 7 here dropped the operator
      // straight into the QC accept/reject decision, letting them settle QC themselves and skip the
      // handoff the step they just completed exists to make.
      onClose();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to send to QC');
    } finally {
      setSendingToQc(false);
    }
  };

  /** Which step actually captures the thing a failed match check is complaining about. */
  const stepForFailedCheckLabel = (label: string): 1 | 2 | 4 => {
    if (label.startsWith('Documents received')) return 2; // Receipt documents section
    if (label.startsWith('Shipment photos')) return 1; // Confirm Receipt captures photos
    return 4; // qty/price/pack-count mismatches all trace back to the packaging list
  };

  const handleQcAccept = async (): Promise<void> => {
    if (!qcSpecs) return;
    if (deriveGrnQcStatusFromSpecs(qcSpecs) === 'Rejected') {
      addToast('error', 'One or more parameters failed — use Reject → Vendor Return.');
      return;
    }
    setDecidingQc(true);
    try {
      const qcMeta = {
        ...(sourceDocuments.qc ?? {}),
        testDate: qcTestDate || null,
        verdict: 'accept' as const,
        decidedAt: new Date().toISOString(),
      };
      const mergedDocs = docRefsToSourceDocuments(docRefs, { ...sourceDocuments, qc: qcMeta });
      // Accepting QC releases the quarantine hold even when completion is still gated.
      const releasedFromHold = String(grn.status ?? '').trim() === 'On Hold';
      // qcDecidedAtOpen means QC was already fast-tracked (QcQuickDecisionModal) before this wizard
      // was even opened — qcSpecs here is still that path's unreviewed reference checklist, which
      // validateQcSpecsForPassed rejects with a 400 unless told to skip it. Without this, Accept
      // 400ed on save #1, so generate-labels-and-complete below (which needs this to succeed first)
      // never ran and stock never left in_transit (GRN-2026-0100). A genuine fresh review here
      // (qcDecidedAtOpen false) keeps full validation — the user actually filled qcSpecs in.
      // 1) Save the QC results (always succeeds).
      await updateGRN(grn.id, {
        qcSpecs,
        qcStatus: 'Passed',
        qcBy: qcBy || undefined,
        sourceDocuments: mergedDocs,
        qcFastTrack: qcDecidedAtOpen.current,
        ...(releasedFromHold ? { status: 'Under GRN' } : {}),
      });
      setSourceDocuments((prev) => ({ ...prev, qc: qcMeta }));

      if (putawayMissing.length > 0) {
        // Rack assignment lives in a different popup (Assign Rack on the inbound row), not a step
        // in this wizard — there is nowhere in here to send the user, so hand off explicitly.
        addToast('success', 'QC accepted · next: Assign Rack on the inbound row to put the stock away.');
        onSaved({ ...grn, qcStatus: 'Passed', sourceDocuments: mergedDocs, ...(releasedFromHold ? { status: 'Under GRN' } : {}) });
        onClose();
        return;
      }

      if (labelsMissing) {
        if (!receiptChecksPass) {
          // Rack is ready but labels genuinely cannot be generated yet — name exactly what's still
          // outstanding and jump straight to the step that captures it, instead of bouncing back to
          // step 5 with no explanation (the "keeps looping" complaint this replaces).
          const failed = matchChecks.filter((c) => !c.pass);
          const dest = failed.length ? stepForFailedCheckLabel(failed[0].label) : 5;
          addToast('error', `QC accepted · still needed before labels: ${failed.map((c) => c.label).join('; ')}.`);
          onSaved({ ...grn, qcStatus: 'Passed', sourceDocuments: mergedDocs, ...(releasedFromHold ? { status: 'Under GRN' } : {}) });
          setCurrentStep(dest as 1 | 2 | 3 | 4 | 5 | 6 | 7);
          return;
        }
        // Everything else is ready — generate the labels as part of this same click instead of
        // making the user do it manually on step 5, then fall through to complete immediately.
        try {
          const labelRes = await generateLabelsCore();
          await updateGRN(grn.id, {
            status: 'GRN Complete',
            qcStatus: 'Passed',
            qcFastTrack: qcDecidedAtOpen.current,
            workflowSteps: [...new Set([...labelRes.workflowSteps, ...GRN_COMPLETE_WORKFLOW_STEPS])],
          });
          addToast('success', 'QC accepted · GRN completed and stock put away. Print the labels below.');
          onSaved({
            ...grn,
            status: 'GRN Complete',
            qcStatus: 'Passed',
            sourceDocuments: labelRes.mergedDocs,
            generatedLabels: labelRes.labels,
            noOfBoxes: labelRes.noOfBoxes,
            unitsPerBox: labelRes.unitsPerBox,
          });
          // Deliberately NOT closing here. generateLabelsCore() already set previewLabels, which
          // switches this modal to the print screen (GrnLabelPreview) — that screen is the actual
          // point of generating labels: they have to be printed and physically affixed to the packs.
          // Auto-closing skipped that step entirely, so the operator never saw the labels they were
          // told had just been generated. The GRN itself is already fully completed and booked at
          // this point (status + inventory both written above); staying open only affects this
          // preview/print screen, not the completion. The header's own × closes it when they're done.
          return;
        } catch (e2: unknown) {
          addToast(
            'warning',
            `QC accepted, but labels/completion could not finish: ${e2 instanceof Error ? e2.message : 'try again from step 5'}.`,
          );
          onSaved({ ...grn, qcStatus: 'Passed', sourceDocuments: mergedDocs, ...(releasedFromHold ? { status: 'Under GRN' } : {}) });
          return;
        }
      }

      // Labels already exist (generated in an earlier session) and put-away is ready — complete now.
      try {
        await updateGRN(grn.id, {
          status: 'GRN Complete',
          qcStatus: 'Passed',
          qcFastTrack: qcDecidedAtOpen.current,
          workflowSteps: [...new Set([...(grn.workflowSteps ?? []), ...GRN_COMPLETE_WORKFLOW_STEPS])],
        });
        addToast('success', 'QC accepted · GRN completed and stock put away.');
        onSaved({ ...grn, status: 'GRN Complete', qcStatus: 'Passed', sourceDocuments: mergedDocs });
        onClose();
      } catch (e2: unknown) {
        addToast(
          'warning',
          `QC accepted, but the GRN could not be completed yet: ${e2 instanceof Error ? e2.message : 'try Assign Rack'}.`,
        );
        onSaved({ ...grn, qcStatus: 'Passed', sourceDocuments: mergedDocs, ...(releasedFromHold ? { status: 'Under GRN' } : {}) });
      }
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save QC');
    } finally {
      setDecidingQc(false);
    }
  };

  const handleQcReject = async (): Promise<void> => {
    if (!qcSpecs) return;
    setDecidingQc(true);
    try {
      const qcMeta = {
        ...(sourceDocuments.qc ?? {}),
        testDate: qcTestDate || null,
        verdict: 'reject' as const,
        decidedAt: new Date().toISOString(),
      };
      const mergedDocs = docRefsToSourceDocuments(docRefs, { ...sourceDocuments, qc: qcMeta });
      await updateGRN(grn.id, {
        qcSpecs,
        qcStatus: 'Rejected',
        qcBy: qcBy || undefined,
        sourceDocuments: mergedDocs,
      });
      setSourceDocuments((prev) => ({ ...prev, qc: qcMeta }));
      // Raise the vendor return on the linked PO, when we know it.
      let rtvNote = ' · link a PO to raise the vendor return';
      if (grn.purchaseOrderId != null) {
        const reason = String(qcSpecs.remarks || 'QC rejected at GRN inspection').slice(0, 500);
        const res = await raiseRtv(String(grn.purchaseOrderId), reason);
        rtvNote = res.success ? ' · vendor return (RTV) raised on PO' : ` · RTV not raised (${res.error})`;
      }
      addToast('warning', `QC rejected · GRN On Hold${rtvNote}.`);
      onSaved({ ...grn, status: 'On Hold', sourceDocuments: mergedDocs });
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to reject QC');
    } finally {
      setDecidingQc(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="strong" scroll align="start">
      <div
        className="relative my-4 w-full max-w-5xl rounded-xl bg-surface shadow-2xl border border-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grn-copy-receipt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-6 py-4 rounded-t-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="grn-copy-receipt-title" className="text-lg font-bold text-ink">
                {mode === 'confirm-receipt' ? '✓ Confirm Receipt — ' : '📋 '}
                GRN Copy — {displayGrnNo(headerView.titleGrnNo)} {headerView.itemTitle}
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                {[headerView.shipmentBatchRef, headerView.poNo, headerView.vendorLine, headerView.warehouseCode, headerView.warehouseName]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {previewLabels && qcAlreadyDecided ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewLabels(null);
                    setCurrentStep(7);
                  }}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok"
                >
                  Continue · Review & Complete
                </button>
              ) : null}
              {previewLabels ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2"
                >
                  Done
                </button>
              ) : null}
              {currentStep === 5 && !previewLabels && !coreChecksPass && prerequisitesMet && !hasExistingLabels ? (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void handleMismatchQuarantine()}
                  className="rounded-lg bg-err px-4 py-2 text-sm font-semibold text-white hover:bg-err disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? 'Processing…' : 'Report Mismatch & Send to QC'}
                </button>
              ) : null}
              <button
                type="button"
                hidden={!!previewLabels || currentStep !== 5}
                disabled={!receiptChecksPass || generating || !!previewLabels || currentStep !== 5}
                onClick={() => void handleGenerateLabels()}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  receiptChecksPass
                    ? undefined
                    : hasExistingLabels
                      ? 'Complete document uploads and shipment photos to regenerate labels'
                      : 'Complete document uploads, pack counts, and shipment photos to generate labels'
                }
              >
                {generating ? 'Generating…' : hasExistingLabels ? 'Regenerate Labels' : 'Generate Labels'}
              </button>
              {grn.status === 'GRN Complete' ? (
                <button
                  type="button"
                  onClick={handleDownloadGrnCopy}
                  title="Download a printable GRN copy (item details, documents checklist, QC, and quantities)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  Download GRN Copy (PDF)
                </button>
              ) : null}
              {(grn.generatedPackLabels?.length ?? packagingMeta.rows?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={reprintingPackLabels}
                  onClick={() => void handleReprintPackLabels()}
                  title={
                    grn.generatedPackLabels?.length
                      ? `Reprint the ${grn.generatedPackLabels.length} pack label${grn.generatedPackLabels.length === 1 ? '' : 's'} generated for this GRN — available from any step`
                      : 'Print pack labels for this GRN'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {reprintingPackLabels ? 'Preparing…' : 'Print pack labels'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {!previewLabels ? (
            <div className="mt-3 overflow-x-auto">
              <GrnReceiptStepper currentStep={currentStep} />
            </div>
          ) : null}
        </div>

        {/* Hidden (display:none — canvas drawing isn't tied to visibility), always-mounted QR
            canvases — only read from by handleReprintPackLabels' one-time legacy backfill path
            (a GRN whose labels predate pack-label persistence). */}
        <div aria-hidden className="hidden" ref={reprintPackGridRef}>
          {(packagingMeta.rows ?? []).map((row) => (
            <QRCodeCanvas key={row.packagingNo} value={row.packagingNo} size={132} includeMargin />
          ))}
        </div>

        {previewLabels ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-ok bg-ok-soft px-4 py-3 text-sm text-ok">
              <strong>
                {previewLabels.length} label{previewLabels.length === 1 ? '' : 's'} generated.
              </strong>{' '}
              Print them now, or reopen this GRN from Inbound to print later.{' '}
              {qcAlreadyDecided
                ? 'QC is already passed — use Continue · Review & Complete above to finish this GRN.'
                : 'The GRN is verified — use Send to QC when ready.'}
            </div>
            <GrnLabelPreview
              labels={previewLabels}
              grnNo={headerView.titleGrnNo}
              onPrintBlocked={() =>
                addToast('error', 'Could not open print window. Allow popups and try again.')
              }
            />
          </div>
        ) : (
        <div className="space-y-6 px-6 py-5">
          {currentStep === 5 && hasExistingLabels ? (
            <div className="rounded-xl border border-ok bg-ok-soft px-4 py-3 text-sm text-ok">
              <strong>{existingLabels.length} QR label{existingLabels.length === 1 ? '' : 's'} already on file</strong> for this GRN.
              Upload receipt documents and shipment photos below. The button stays disabled until those checks pass; then you can{' '}
              <strong>Regenerate Labels</strong> or save draft and continue to QC / assign rack.
            </div>
          ) : currentStep === 5 ? (
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink-2">
              No QR labels on this GRN yet. Complete documents, pack counts, and shipment photos — then <strong>Generate Labels</strong> will enable.
            </div>
          ) : null}

          <section className="rounded-xl border border-border bg-surface-2/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">📦 GRN header (auto from system)</h3>
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-hairline">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">GRN No</td>
                    <td className="py-2 pr-8 font-semibold text-ink">{displayGrnNo(headerFields.grnNo)}</td>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Shipment Date</td>
                    <td className="py-2 font-semibold text-ink">{headerFields.shipmentDate}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Received Date</td>
                    <td className="py-2 pr-8 font-semibold text-ink">{headerFields.receivedDateTime}</td>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">GRN Generated Date</td>
                    <td className="py-2 font-semibold text-ink">{headerFields.generatedDateTime}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Item</td>
                    <td className="py-2 pr-8 font-semibold text-ink">{headerFields.itemLine}</td>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">PO Number</td>
                    <td className="py-2 font-semibold text-ink">{headerFields.poNumber}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">PO Qty</td>
                    <td className="py-2 pr-8 font-semibold text-ink">{headerFields.poQty}</td>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Shipped Qty</td>
                    <td className="py-2 font-semibold text-ink">{headerFields.shippedQty}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Per Unit Price</td>
                    <td className="py-2 pr-8 font-semibold text-ink">{headerFields.unitPrice}</td>
                    <td className="py-2 pr-4 font-medium text-ink-2 whitespace-nowrap">Vendor</td>
                    <td className="py-2 font-semibold text-ink">{headerFields.vendorLine}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {currentStep === 1 ? (
            <GrnConfirmReceiptSection
              value={receiptMeta}
              onChange={patchReceiptMeta}
              assignableUsers={assignableUsers}
              disabled={docsLocked}
              hideChecklist={isTransferGrn}
            />
          ) : null}

          {currentStep === 2 ? (
            <GrnConfirmDetailsSection
              value={detailsMeta}
              onChange={patchDetailsMeta}
              disabled={docsLocked}
            />
          ) : null}

          {currentStep === 2 ? (
            <section className="mt-4 rounded-xl border border-border bg-surface-2/60 p-4">
              <h3 className="text-sm font-semibold text-ink">
                Receipt documents <span className="text-err">*</span>
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                {requiredDocKeys.length > 0 ? (
                  <>
                    Asked for per the <strong>Confirm Receipt</strong> checklist —{' '}
                    {requiredDocKeys.map((k) => GRN_REQUIRED_DOC_LABELS[k]).join(', ')}.{' '}
                    <strong>Generate Labels</strong> (step 5) stays disabled until these are on file.
                    Lorry Receipt is reference-only.
                  </>
                ) : (
                  <>
                    The dock checklist records no uploadable documents for this shipment, so none are
                    required here. <strong>Generate Labels</strong> (step 5) is not blocked on documents.
                  </>
                )}
              </p>
              {missingDocKeys.length > 0 && (
                <p className="mt-2 rounded-md border border-err bg-err-soft px-2 py-1 text-[11px] font-semibold text-err">
                  {requiredGrnDocsError(sourceDocuments, { skipChecklistDocs: isTransferGrn })}
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {requiredDocKeys.map((key) => {
                  const row = documentRows.find((d) => d.key === key);
                  return (
                    <div
                      key={key}
                      className={`rounded-lg border bg-surface p-3 ${
                        missingDocKeys.includes(key) ? 'border-err' : 'border-border'
                      }`}
                    >
                      <div className="text-xs font-semibold text-ink">
                        {/* documentRows only describes bill/waybill/lr/coa; the checklist-driven
                            documents fall back to their canonical label rather than a raw key. */}
                        {row?.docType ?? GRN_REQUIRED_DOC_LABELS[key] ?? key} <span className="text-err">*</span>
                      </div>
                      {/* Only these carry a reference number; the rest are upload-only. Keying the
                          input on anything else would write a ref under a key nothing reads. */}
                      {key === 'bill' || key === 'waybill' ? (
                        <input
                          type="text"
                          value={docRefs[key as GrnCopyDocRefKey]}
                          disabled={docsLocked}
                          onChange={(e) => updateDocRef(key as GrnCopyDocRefKey, e.target.value)}
                          placeholder={row?.refLabel ?? 'Reference no.'}
                          className="mt-1.5 mb-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3"
                        />
                      ) : null}
                      <DocFileUploadCell
                        docKey={key}
                        fileName={docFileNameFor(sourceDocuments, key)}
                        uploaded={Boolean(docFileNameFor(sourceDocuments, key))}
                        disabled={docsLocked || uploadingDoc === key}
                        onUpload={(file) => void handleDocFileUpload(key, file)}
                        onClear={() => void clearDocFile(key)}
                      />
                      {uploadingDoc === key ? <p className="mt-1 text-[11px] text-ink-3">Uploading…</p> : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 max-w-xs">
                <label className="block text-xs font-semibold text-ink">Lorry Receipt # (reference only)</label>
                <input
                  type="text"
                  value={docRefs.lr}
                  disabled={docsLocked}
                  onChange={(e) => updateDocRef('lr', e.target.value)}
                  placeholder="LR number"
                  className="mt-1.5 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3"
                />
              </div>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <GrnBatchDetailsSection
              rows={batchesMeta.rows ?? []}
              onChangeRow={setBatchRow}
              disabled={docsLocked}
              vendorBatchNotApplicable={batchesMeta.vendorBatchNotApplicable === true}
              onChangeVendorBatchNotApplicable={setVendorBatchNotApplicable}
            />
          ) : null}

          {currentStep === 4 ? (
            <GrnPackagingListSection
              rows={packagingMeta.rows ?? []}
              batches={batchesMeta.rows ?? []}
              onChangeRow={setPackagingRow}
              disabled={docsLocked}
              unit={lineItem.unit}
              poQty={Number(lineItem.poQty) || 0}
              shippedQty={lineItem.shippedQty ?? grn.shippedQty ?? null}
              billedQty={billedQty}
              onBilledQtyChange={setBilledQty}
            />
          ) : null}

          {currentStep === 5 ? (
            <GrnGenerateLabelsSection
              rows={packagingMeta.rows ?? []}
              batches={batchesMeta.rows ?? []}
              productName={grnLineItemDisplayName(lineItem)}
              productCode={lineItem.itemCode}
              vendor={grn.vendor}
              unit={lineItem.unit}
              disabled={docsLocked}
              onGenerate={handlePackLabelsGenerated}
              onGenerateFailed={() => addToast('error', 'Failed to save pack labels — try again.')}
              onPrinted={() => void handlePackLabelsPrinted()}
              onPrintBlocked={() =>
                addToast('error', 'Could not open print window. Allow popups and try again.')
              }
            />
          ) : null}

          {currentStep === 6 ? (
            <GrnQuarantineQcSection
              itemLine={headerFields.itemLine}
              totalPacks={packagingMeta.rows?.length ?? 0}
              receivedQty={receivedQtyFromPackaging(packagingMeta)}
              unit={lineItem.unit}
              qcNotes={detailsMeta.qcNotes}
              sentAt={qcSentAt}
            />
          ) : null}

          {currentStep === 7 && !canCompleteAfterQc ? (
            <div className="mb-3 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
              <p className="font-semibold">
                {putawayMissing.length > 0
                  ? 'Accept will save QC, but put-away still needs the inbound row:'
                  : 'Accept will save QC, but labels can\'t be generated yet — still needed:'}
              </p>
              <ul className="mt-1 list-disc pl-4 font-normal text-ink-3">
                {putawayMissing.length > 0 ? (
                  <li>
                    <strong>Assign Rack</strong> — pick the storage zone and rack from Facility
                    Management ({putawayMissing.join(', ')} still unset).
                  </li>
                ) : (
                  // Labels are the only gap and the checks behind them are failing — name each one
                  // (Accept will jump straight to whichever step captures it, once you fix these).
                  matchChecks
                    .filter((c) => !c.pass)
                    .map((c) => <li key={c.label}>{c.label}</li>)
                )}
              </ul>
            </div>
          ) : null}
          {currentStep === 7 && qcDecidedAtOpen.current ? (
            <section className="rounded-xl border border-border p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">7 · Quality Check → Complete</h3>
                <p className="mt-1 text-xs text-ink-3">
                  QC was already decided for this GRN — there is no spec checklist to fill in here.
                </p>
              </div>
              <div
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold ${
                  isInboundGrnQcRejected(grn)
                    ? 'border-err-soft bg-err-soft text-err'
                    : 'border-ok-soft bg-ok-soft text-ok'
                }`}
              >
                {isInboundGrnQcRejected(grn) ? '❌ QC already Rejected' : '✅ QC already Passed'}
              </div>
              <div className="max-w-xs">
                {/* Not part of the checklist — a separate accountability field the backend requires
                    before it will mark the GRN Complete ("QC by (inspector name) is required" —
                    grnCompletionBlockers in the backend controller). The fast-track decision never
                    collects it, so it has to be filled in here at least once before Accept can
                    actually complete the GRN, even though QC itself is already decided. */}
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3" htmlFor="grn-qc-analyst-fasttrack">
                  QC Analyst
                </label>
                <input
                  id="grn-qc-analyst-fasttrack"
                  type="text"
                  value={qcBy}
                  disabled={decidingQc}
                  onChange={(e) => setQcBy(e.target.value)}
                  placeholder="e.g. P. Bhatia"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3"
                />
              </div>
              <p className="text-xs text-ink-3">
                Use Accept below to generate labels and complete the GRN, or Reject to send the goods
                back to the vendor.
              </p>
            </section>
          ) : null}
          {currentStep === 7 && !qcDecidedAtOpen.current ? (
            <GrnQcCompleteSection
              qcSpecs={qcSpecs}
              loading={qcLoading}
              error={qcError}
              disabled={decidingQc}
              onChange={setQcSpecs}
              qcBy={qcBy}
              onQcByChange={setQcBy}
              testDate={qcTestDate}
              onTestDateChange={setQcTestDate}
            />
          ) : null}

          {/* Step-aware footer: Back on the left, actions on the right. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
            <div>
              {currentStep > 1 && !previewLabels ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) : s))}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
                >
                  ← Back
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {currentStep === 1 && receiptMeta.confirmedAt ? (
                <span className="text-xs font-semibold text-ok">✓ Receipt confirmed</span>
              ) : null}
              {currentStep === 2 && detailsMeta.confirmedAt ? (
                <span className="text-xs font-semibold text-ok">✓ Details saved</span>
              ) : null}
              {currentStep === 3 && batchesMeta.confirmedAt ? (
                <span className="text-xs font-semibold text-ok">✓ Batches saved</span>
              ) : null}
              {currentStep === 4 && packagingMeta.confirmedAt ? (
                <span className="text-xs font-semibold text-ok">✓ Packaging saved</span>
              ) : null}
              {!docsLocked ? (
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => void handleConfirmReceipt()}
                  disabled={confirmingReceipt}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingReceipt
                    ? 'Confirming…'
                    : receiptMeta.confirmedAt
                      ? 'Update Receipt · Next'
                      : '✅ Confirm Receipt · Move to next step'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 2 ? (
                <button
                  type="button"
                  onClick={() => void handleConfirmDetails()}
                  disabled={confirmingDetails}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingDetails
                    ? 'Saving…'
                    : detailsMeta.confirmedAt
                      ? 'Update Details · Next'
                      : 'Save & Continue · Next step'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 3 ? (
                <button
                  type="button"
                  onClick={() => void handleConfirmBatches()}
                  disabled={confirmingBatches}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingBatches
                    ? 'Saving…'
                    : batchesMeta.confirmedAt
                      ? 'Update Batches · Next'
                      : 'Save & Continue · Next step'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 4 ? (
                <button
                  type="button"
                  onClick={() => void handleConfirmPackaging()}
                  disabled={confirmingPackaging}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingPackaging
                    ? 'Saving…'
                    : packagingMeta.confirmedAt
                      ? 'Update Packaging · Next'
                      : 'Save & Continue · Next step'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 5 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(qcAlreadyDecided ? 7 : 6)}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok"
                >
                  {qcAlreadyDecided ? 'Continue · Review & Complete' : 'Continue · Quarantine → QC'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 6 && qcAlreadyDecided ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(7)}
                    className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok"
                  >
                    Continue → Review & Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendToQc()}
                    disabled={sendingToQc}
                    className="text-xs font-semibold text-ink-3 underline hover:text-ink-2 disabled:opacity-50"
                    title="Only for a genuine re-inspection — this reopens the quarantine hold on a GRN that already passed QC."
                  >
                    {sendingToQc ? 'Sending…' : 'Re-send to QC anyway'}
                  </button>
                </>
              ) : null}
              {!docsLocked && currentStep === 6 && !qcAlreadyDecided ? (
                <button
                  type="button"
                  onClick={() => void handleSendToQc()}
                  disabled={sendingToQc}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-press disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingToQc ? 'Sending…' : qcSentAt ? 'Re-send to QC' : 'Send to Quarantine → QC'}
                </button>
              ) : null}
              {currentStep === 7 ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleQcReject()}
                    disabled={decidingQc || !qcSpecs}
                    className="rounded-lg bg-err px-4 py-2 text-sm font-semibold text-white hover:bg-err disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decidingQc ? 'Working…' : '❌ Reject → Vendor Return'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQcAccept()}
                    disabled={decidingQc || !qcSpecs || !qcBy.trim()}
                    title={
                      !qcBy.trim()
                        ? 'Enter the QC Analyst name above first — the backend requires it to mark a GRN Complete.'
                        : canCompleteAfterQc
                          ? 'Generates the QR labels and completes the GRN in one step — no further screens.'
                          : putawayMissing.length > 0
                            ? 'Accept saves QC and releases the hold — rack assignment continues in Assign Rack on the inbound row.'
                            : 'Accept saves QC, but labels still can\'t be generated — see what\'s listed above.'
                    }
                    className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {/* Don't promise completion the backend will refuse: without put-away/labels,
                        accepting QC passes the goods but stops short of Complete. Name whichever gate
                        is actually still open — this used to always say "Assign Rack next" even when
                        the rack was already assigned and labels were the only thing missing. */}
                    {decidingQc
                      ? 'Working…'
                      : canCompleteAfterQc
                        ? '✅ Accept → Generate Labels → Complete GRN'
                        : putawayMissing.length > 0
                          ? '✅ Accept → Assign Rack next'
                          : '✅ Accept (still blocked — see above)'}
                  </button>
                </>
              ) : null}
              {docsLocked && currentStep < 7 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => (s < 7 ? ((s + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) : s))}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2"
                >
                  Next →
                </button>
              ) : null}
            </div>
          </div>
        </div>
        )}
      </div>
    </ModalOverlay>
  );
};

export default GrnCopyReceiptModal;
