import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  generateGRNLabels,
  grnLineItemDisplayName,
  updateGRN,
  type GeneratedLabel,
  type UpdateGRNPayload,
} from '../../services/grn.service';
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
  inboundGrnVerifiedAfterLabelsPayload,
} from '../../lib/inboundGrnStatus';
import { displayInboundGrnNo } from '../../lib/inboundGrnTableDisplay';
import { GrnLabelPreview } from './GrnLabelPreview';

export type GrnCopyReceiptLineItem = {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
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
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationZone?: string | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
  workflowSteps?: string[];
  generatedLabels?: GeneratedLabel[] | null;
  lineItems?: Array<Pick<GrnCopyReceiptLineItem, 'itemCode' | 'generatedLabels'>>;
  status?: string | null;
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

type ShipmentPhotoTag = 'truck' | 'packs' | 'doc';

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
          <span className="text-emerald-700">{fileName} ✓ uploaded</span>
          {!disabled ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-slate-500 underline hover:text-rose-600"
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
              ? 'cursor-not-allowed border-slate-200 text-slate-400 opacity-60'
              : dragActive
                ? 'cursor-copy border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'cursor-pointer border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              openFilePicker();
            }}
            className="text-xs font-semibold text-slate-800 underline-offset-2 hover:underline disabled:no-underline disabled:text-slate-400"
          >
            Choose file
          </button>
          <span className="text-xs font-normal text-slate-500">· drag &amp; drop</span>
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
  const [photoCount, setPhotoCount] = useState(0);
  const [photoTags, setPhotoTags] = useState<Record<ShipmentPhotoTag, boolean>>({
    truck: false,
    packs: false,
    doc: false,
  });
  const [generating, setGenerating] = useState(false);
  // Set once labels come back — swaps the modal body for the preview + print step.
  const [previewLabels, setPreviewLabels] = useState<GeneratedLabel[] | null>(null);
  const [saving, setSaving] = useState(false);

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
  const tagsTicked = Object.values(photoTags).filter(Boolean).length;
  const effectivePhotoCount = Math.max(photoCount, tagsTicked);
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

  const handlePhotoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, tag: ShipmentPhotoTag) => {
      const files = event.target.files;
      if (!files?.length) return;
      setPhotoCount((prev) => prev + files.length);
      setPhotoTags((prev) => ({ ...prev, [tag]: true }));
      event.target.value = '';
    },
    [],
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        className="relative my-4 w-full max-w-5xl rounded-xl bg-white shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grn-copy-receipt-title"
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 rounded-t-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="grn-copy-receipt-title" className="text-lg font-bold text-slate-900">
                {mode === 'confirm-receipt' ? '✓ Confirm Receipt — ' : '📋 '}
                GRN Copy — {displayGrnNo(headerView.titleGrnNo)} {headerView.itemTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
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
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              ) : null}
              {!previewLabels && !coreChecksPass && prerequisitesMet && !hasExistingLabels ? (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void handleMismatchQuarantine()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? 'Processing…' : 'Report Mismatch & Send to QC'}
                </button>
              ) : null}
              <button
                type="button"
                hidden={!!previewLabels}
                disabled={!receiptChecksPass || generating || !!previewLabels}
                onClick={() => void handleGenerateLabels()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {previewLabels ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
          {hasExistingLabels ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <strong>{existingLabels.length} QR label{existingLabels.length === 1 ? '' : 's'} already on file</strong> for this GRN.
              Upload receipt documents and shipment photos below. The button stays disabled until those checks pass; then you can{' '}
              <strong>Regenerate Labels</strong> or save draft and continue to QC / assign rack.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              No QR labels on this GRN yet. Complete documents, pack counts, and shipment photos — then <strong>Generate Labels</strong> will enable.
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📦 GRN header (auto from system)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">GRN No</td>
                    <td className="py-2 pr-8 font-semibold text-slate-900">{displayGrnNo(headerFields.grnNo)}</td>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Shipment Date</td>
                    <td className="py-2 font-semibold text-slate-900">{headerFields.shipmentDate}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Received Date</td>
                    <td className="py-2 pr-8 font-semibold text-slate-900">{headerFields.receivedDateTime}</td>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">GRN Generated Date</td>
                    <td className="py-2 font-semibold text-slate-900">{headerFields.generatedDateTime}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Item</td>
                    <td className="py-2 pr-8 font-semibold text-slate-900">{headerFields.itemLine}</td>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">PO Number</td>
                    <td className="py-2 font-semibold text-slate-900">{headerFields.poNumber}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">PO Qty</td>
                    <td className="py-2 pr-8 font-semibold text-slate-900">{headerFields.poQty}</td>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Shipped Qty</td>
                    <td className="py-2 font-semibold text-slate-900">{headerFields.shippedQty}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Per Unit Price</td>
                    <td className="py-2 pr-8 font-semibold text-slate-900">{headerFields.unitPrice}</td>
                    <td className="py-2 pr-4 font-medium text-slate-600 whitespace-nowrap">Vendor</td>
                    <td className="py-2 font-semibold text-slate-900">{headerFields.vendorLine}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📄 Documents received</h3>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {documentRows.slice(0, 3).map((doc) => {
                const refKey = doc.key as GrnCopyDocRefKey;
                return (
                <div key={doc.key} className="block text-sm">
                  <label htmlFor={`grn-doc-ref-${doc.key}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {doc.refLabel}
                  </label>
                  <input
                    id={`grn-doc-ref-${doc.key}`}
                    type="text"
                    value={docRefs[refKey] ?? ''}
                    disabled={docsLocked}
                    onChange={(e) => updateDocRef(refKey, e.target.value)}
                    placeholder={doc.key === 'bill' && grn.invoiceNo ? `e.g. ${grn.invoiceNo}` : undefined}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
                );
              })}
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Doc Type</th>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-center">Verified?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documentRows.filter((d) => d.key === 'bill' || d.key === 'waybill' || d.key === 'coa').map((doc) => (
                    <tr key={`file-${doc.key}`}>
                      <td className="px-3 py-2 text-slate-800">{doc.docType}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <DocFileUploadCell
                          docKey={doc.key as GrnCopyDocUploadKey}
                          fileName={doc.fileName}
                          uploaded={doc.uploaded}
                          disabled={docsLocked}
                          onUpload={(file) => handleDocFileUpload(doc.key as GrnCopyDocUploadKey, file)}
                          onClear={() => clearDocFile(doc.key as GrnCopyDocUploadKey)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">{doc.verified ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">✅ Document check (pack-wise physical count)</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Pack #</th>
                    <th className="px-3 py-2 text-right">Declared Qty (vendor)</th>
                    <th className="px-3 py-2 text-right">Actual Qty (physical)</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {packRows.map((row, index) => (
                    <tr key={row.packIndex}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        Pack {row.packIndex} of {row.packTotal}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.declaredQty.toLocaleString('en-IN')} {row.unit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {docsLocked ? (
                          <span className="tabular-nums">
                            {row.actualQty.toLocaleString('en-IN')} {row.unit}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={row.actualQty}
                            onChange={(e) => handlePackActualChange(index, e.target.value)}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                          />
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${row.variance === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {row.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Received Packs</p>
                <p className="font-semibold text-slate-900">{receivedPacks} / {packRows.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Physical Total</p>
                <p className="font-semibold text-slate-900">
                  {physicalTotal.toLocaleString('en-IN')} {packRows[0]?.unit ?? 'kg'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <label htmlFor="grn-billed-qty" className="text-xs text-slate-500 uppercase tracking-wide">
                  Billed Qty
                </label>
                {docsLocked ? (
                  <p className="font-semibold text-slate-900">
                    {billedQty.toLocaleString('en-IN')} {lineItem.unit ?? 'kg'}
                  </p>
                ) : (
                  <input
                    id="grn-billed-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={billedQty}
                    onChange={(e) => setBilledQty(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 tabular-nums"
                  />
                )}
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <label htmlFor="grn-verified-price" className="text-xs text-slate-500 uppercase tracking-wide">
                  Per Unit Price (invoice)
                </label>
                {docsLocked ? (
                  <p className="font-semibold text-slate-900">₹{verifiedUnitPrice.toLocaleString('en-IN')}</p>
                ) : (
                  <input
                    id="grn-verified-price"
                    type="number"
                    min={0}
                    step="any"
                    value={verifiedUnitPrice}
                    onChange={(e) => setVerifiedUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 tabular-nums"
                  />
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📷 Shipment photos (at receipt)</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {(['truck', 'packs', 'doc'] as ShipmentPhotoTag[]).map((tag) => (
                <label key={tag} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => handlePhotoUpload(e, tag)}
                  />
                  <span>{photoTags[tag] ? '✓' : '○'} {tag === 'truck' ? 'Truck' : tag === 'packs' ? 'Packs' : 'Doc'}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {photoCount > 0
                ? `✓ Truck ${photoTags.truck ? '✓' : '○'} ✓ Packs ${photoTags.packs ? '✓' : '○'} ✓ Doc ${photoTags.doc ? '✓' : '○'} + ${photoCount} photo${photoCount === 1 ? '' : 's'} uploaded · 1+ required to proceed`
                : 'Upload at least one shipment photo (truck, packs, or documents) to proceed.'}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">🔄 Match check (auto)</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Check</th>
                    <th className="px-3 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchChecks.map((check) => (
                    <tr key={check.label}>
                      <td className="px-3 py-2 text-slate-800">{check.label}</td>
                      <td className={`px-3 py-2 text-center font-semibold ${check.pass ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {check.pass ? '✓ Match' : '✗ Mismatch'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`mt-3 text-sm font-medium ${receiptChecksPass ? 'text-emerald-700' : coreChecksPass ? 'text-amber-700' : 'text-rose-700'}`}>
              {receiptChecksPass
                ? hasExistingLabels
                  ? '✓ Receipt checks pass. Regenerate Labels is enabled if you need new QRs; otherwise save draft and continue.'
                  : '✓ All checks pass. Generate Labels is enabled · on click → rack labels print (one per pack) · GRN moves to VERIFIED · ready for QC routing.'
                : !coreChecksPass && prerequisitesMet
                  ? '✗ Document-physical mismatch detected. Use Report Mismatch & Send to QC — Procurement will be notified and the GRN routes to Quality.'
                  : hasExistingLabels
                    ? 'Labels are on file. Complete document uploads and shipment photos to enable Regenerate Labels (or save draft and close).'
                    : 'Complete document uploads, pack counts, shipment photos, and billed qty/price before proceeding.'}
            </p>
          </section>

          {!docsLocked ? (
            <div className="flex justify-end gap-3 pb-2">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
};

export default GrnCopyReceiptModal;
