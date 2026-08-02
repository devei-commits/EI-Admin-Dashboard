import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  fetchGRNAssignableUsers,
  fetchGRNQcReference,
  generateGRNLabels,
  grnLineItemDisplayName,
  updateGRN,
  type AssignableUser,
  type GeneratedLabel,
  type UpdateGRNPayload,
} from '../../services/grn.service';
import { deriveGrnQcStatusFromSpecs, type GrnQcSpecsStored } from '../../lib/grnQcSpecs';
import { raiseRtv } from '../../services/poGrnException.service';
import type { InboundGrnSourceDocuments } from '../../lib/inboundGrnSourceDocs';
import {
  allGrnReceiptChecksPass,
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
} from '../../lib/inboundGrnStatus';
import { displayInboundGrnNo } from '../../lib/inboundGrnTableDisplay';
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
import { GrnPackagingListSection } from './GrnPackagingListSection';
import { GrnGenerateLabelsSection } from './GrnGenerateLabelsSection';
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
  /** Linked PO id — used to raise a vendor return (RTV) when QC rejects. */
  purchaseOrderId?: number | null;
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

type DocFileUploadCellProps = {
  docKey: GrnCopyDocUploadKey;
  fileName: string | null;
  uploaded: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
};

const DocFileUploadCell: React.FC<DocFileUploadCellProps> = ({
  fileName,
  uploaded,
  disabled,
  onUpload,
  onClear,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const acceptFile = (file: File | undefined): void => {
    if (!file || disabled) return;
    onUpload(file);
  };

  const openFilePicker = (): void => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div className="min-w-[12rem]">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        disabled={disabled}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {uploaded && fileName ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ok">{fileName} ✓ uploaded</span>
          {!disabled ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-ink-3 underline hover:text-err"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex min-h-[2.25rem] w-full items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
            disabled
              ? 'cursor-not-allowed border-border text-ink-4 opacity-60'
              : dragActive
                ? 'cursor-copy border-ok bg-ok-soft text-ok'
                : 'cursor-pointer border-border text-ink-2 hover:border-border hover:bg-surface-2'
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              openFilePicker();
            }}
            className="text-xs font-semibold text-ink underline-offset-2 hover:underline disabled:no-underline disabled:text-ink-4"
          >
            Choose file
          </button>
          <span className="text-xs font-normal text-ink-3">· drag &amp; drop</span>
        </div>
      )}
    </div>
  );
};

const GrnCopyReceiptModal: React.FC<GrnCopyReceiptModalProps> = ({
  grn,
  lineItem,
  mode,
  onClose,
  onSaved,
  onQuarantined,
}) => {
  const { addToast } = useToast();
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
  // Wizard: 1 Confirm Receipt · 2 Confirm Details · 3 Batch Details · 4 Packaging List · 5 Generate Labels · 6 Quarantine → QC · 7 QC → Complete.
  // Resume at the furthest confirmed step so reopening a GRN lands where the user left off.
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(() => {
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
  const setBatchRow = useCallback((index: number, patch: Partial<GrnBatchRow>): void => {
    setSourceDocuments((prev) => {
      const meta = readGrnBatchesMeta(prev);
      const rows = meta.rows ? [...meta.rows] : [];
      rows[index] = { ...emptyBatchRow(), ...rows[index], ...patch };
      return { ...prev, batches: { ...meta, rows } };
    });
  }, []);

  // Keep the batch row count in sync with "No. of batches received" whenever step 3 is shown.
  const targetBatchCount = Math.max(0, Math.floor(Number(detailsMeta.batchesReceived) || 0));
  const batchRowCount = batchesMeta.rows?.length ?? 0;
  useEffect(() => {
    if (currentStep !== 3 || targetBatchCount <= 0 || batchRowCount === targetBatchCount) return;
    setSourceDocuments((prev) => {
      const meta = readGrnBatchesMeta(prev);
      return { ...prev, batches: { ...meta, rows: reconcileBatchRows(meta.rows ?? [], targetBatchCount) } };
    });
  }, [currentStep, targetBatchCount, batchRowCount]);

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

  const updateDocRef = (key: GrnCopyDocRefKey, ref: string): void => {
    setDocRefs((prev) => ({ ...prev, [key]: ref }));
  };

  const handleDocFileUpload = (key: GrnCopyDocUploadKey, file: File): void => {
    setSourceDocuments((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    }));
  };

  const clearDocFile = (key: GrnCopyDocUploadKey): void => {
    setSourceDocuments((prev) => {
      const entry = { ...(prev[key] ?? {}) };
      delete entry.fileName;
      delete entry.uploadedAt;
      delete entry.url;
      const next = { ...prev };
      if (!String(entry.ref ?? '').trim() && !String(entry.url ?? '').trim()) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return next;
    });
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

  const persistReceiptDocuments = async (
    mergedDocs: InboundGrnSourceDocuments,
    physicalTotal: number,
    extra: Record<string, unknown> = {},
  ): Promise<void> => {
    await updateGRN(grn.id, {
      sourceDocuments: mergedDocs,
      noOfBoxes: packRows.length,
      unitsPerBox: packRows[0]?.actualQty ?? grn.unitsPerBox ?? null,
      lineItems: buildLineItemsPayload(physicalTotal),
      ...extra,
    });
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
      addToast(
        'success',
        `${packRows.length} rack labels generated · GRN verified · use Send to QC when ready.`,
      );
      // Push the update to the parent list, but stay open so the labels can be
      // previewed and printed here — reopening the GRN just to print was the old flow.
      onSaved({
        ...grn,
        status: verifiedPayload.status,
        sourceDocuments: mergedDocs,
        noOfBoxes: packRows.length,
        unitsPerBox: packRows[0]?.actualQty ?? grn.unitsPerBox ?? null,
        workflowSteps: labelRes.workflowSteps ?? verifiedPayload.workflowSteps,
        generatedLabels: labelRes.labels,
      });
      setPreviewLabels(labelRes.labels ?? []);
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
    const errors = grnReceiptValidationErrors(receiptMeta);
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
      if (confirmedMeta.assignmentType === 'specific' && confirmedMeta.assignedTo) {
        payload.assignedTo = confirmedMeta.assignedTo;
      }
      await updateGRN(grn.id, payload);
      setSourceDocuments((prev) => ({ ...prev, receipt: confirmedMeta }));
      addToast('success', 'Receipt confirmed. Continue with shipment details.');
      onSaved({ ...grn, sourceDocuments: mergedDocs, receivedDate: receivedDate ?? grn.receivedDate });
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

  const qcSentAt = sourceDocuments.qc?.sentAt ?? null;
  const handleSendToQc = async (): Promise<void> => {
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
      setCurrentStep(7);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to send to QC');
    } finally {
      setSendingToQc(false);
    }
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
      // 1) Save the QC results (always succeeds).
      await updateGRN(grn.id, {
        qcSpecs,
        qcStatus: 'Passed',
        qcBy: qcBy || undefined,
        sourceDocuments: mergedDocs,
      });
      setSourceDocuments((prev) => ({ ...prev, qc: qcMeta }));
      // 2) Complete the GRN — may be gated on rack assignment / assignee.
      try {
        await updateGRN(grn.id, {
          status: 'GRN Complete',
          qcStatus: 'Passed',
          workflowSteps: [...new Set([...(grn.workflowSteps ?? []), ...GRN_COMPLETE_WORKFLOW_STEPS])],
        });
        addToast('success', 'QC accepted · GRN completed and stock put away.');
        onSaved({ ...grn, status: 'GRN Complete', sourceDocuments: mergedDocs });
        onClose();
      } catch (e2: unknown) {
        addToast(
          'warning',
          `QC accepted, but the GRN could not be completed yet: ${e2 instanceof Error ? e2.message : 'assign a rack first'}.`,
        );
        onSaved({ ...grn, sourceDocuments: mergedDocs });
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

        {previewLabels ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-ok bg-ok-soft px-4 py-3 text-sm text-ok">
              <strong>
                {previewLabels.length} label{previewLabels.length === 1 ? '' : 's'} generated.
              </strong>{' '}
              Print them now, or reopen this GRN from Inbound to print later. The GRN is verified — use
              Send to QC when ready.
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
            />
          ) : null}

          {currentStep === 2 ? (
            <GrnConfirmDetailsSection
              value={detailsMeta}
              onChange={patchDetailsMeta}
              disabled={docsLocked}
            />
          ) : null}

          {currentStep === 3 ? (
            <GrnBatchDetailsSection
              rows={batchesMeta.rows ?? []}
              onChangeRow={setBatchRow}
              disabled={docsLocked}
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

          {currentStep === 7 ? (
            <GrnQcCompleteSection
              qcSpecs={qcSpecs}
              loading={qcLoading}
              error={qcError}
              disabled={docsLocked || decidingQc}
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
              {currentStep > 1 ? (
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
                  onClick={() => setCurrentStep(6)}
                  className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok"
                >
                  Continue · Quarantine → QC
                </button>
              ) : null}
              {!docsLocked && currentStep === 6 ? (
                <button
                  type="button"
                  onClick={() => void handleSendToQc()}
                  disabled={sendingToQc}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-press disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingToQc ? 'Sending…' : qcSentAt ? 'Re-send to QC' : 'Send to Quarantine → QC'}
                </button>
              ) : null}
              {!docsLocked && currentStep === 7 ? (
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
                    disabled={decidingQc || !qcSpecs}
                    className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decidingQc ? 'Working…' : '✅ Accept → Complete GRN'}
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
