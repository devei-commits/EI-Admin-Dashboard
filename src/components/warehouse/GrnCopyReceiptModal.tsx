import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  generateGRNLabels,
  grnLineItemDisplayName,
  updateGRN,
  type GeneratedLabel,
} from '../../services/grn.service';
import type { InboundGrnSourceDocuments } from '../../lib/inboundGrnSourceDocs';
import {
  allGrnMatchChecksPass,
  buildGrnCopyDocumentRows,
  buildGrnCopyReceiptHeaderFields,
  buildGrnCopyReceiptHeaderView,
  buildGrnMatchChecks,
  deriveGrnPackRows,
  docRefsToSourceDocuments,
  grnReceiptDocumentsLocked,
  initialGrnCopyDocRefs,
  type GrnCopyDocRefKey,
  type GrnCopyDocUploadKey,
  type GrnPackCheckRow,
} from '../../lib/grnCopyReceiptDisplay';
import { displayInboundGrnNo } from '../../lib/inboundGrnTableDisplay';

export type GrnCopyReceiptLineItem = {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  unit?: string;
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
  lineItems?: GrnCopyReceiptLineItem[];
  status?: string | null;
};

type GrnCopyReceiptModalMode = 'confirm-receipt' | 'grn-copy';

type GrnCopyReceiptModalProps = {
  grn: GrnCopyReceiptGrn;
  lineItem: GrnCopyReceiptLineItem;
  mode: GrnCopyReceiptModalMode;
  onClose: () => void;
  onSaved: (grn: GrnCopyReceiptGrn) => void;
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
}) => {
  const { addToast } = useToast();
  const [sourceDocuments, setSourceDocuments] = useState<InboundGrnSourceDocuments>(
    () => ({ ...(grn.sourceDocuments ?? {}) }),
  );
  const [docRefs, setDocRefs] = useState(() =>
    initialGrnCopyDocRefs(grn.sourceDocuments, grn.invoiceNo),
  );
  const [packRows, setPackRows] = useState<GrnPackCheckRow[]>(() =>
    deriveGrnPackRows({
      rcvdQty: lineItem.rcvdQty,
      noOfBoxes: grn.noOfBoxes,
      unitsPerBox: grn.unitsPerBox,
      unit: lineItem.unit,
    }),
  );
  const [photoCount, setPhotoCount] = useState(0);
  const [photoTags, setPhotoTags] = useState<Record<ShipmentPhotoTag, boolean>>({
    truck: false,
    packs: false,
    doc: false,
  });
  const [generating, setGenerating] = useState(false);
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
      lineItem,
    }),
    [grn, lineItem, sourceDocumentsWithRefs],
  );

  const headerView = useMemo(() => buildGrnCopyReceiptHeaderView(receiptInput), [receiptInput]);
  const headerFields = useMemo(() => buildGrnCopyReceiptHeaderFields(receiptInput), [receiptInput]);
  const documentRows = useMemo(
    () => buildGrnCopyDocumentRows(receiptInput),
    [receiptInput],
  );
  const matchChecks = useMemo(
    () => buildGrnMatchChecks({ grn: receiptInput, packRows, documentRows, photoCount }),
    [receiptInput, packRows, documentRows, photoCount],
  );
  const allChecksPass = allGrnMatchChecksPass(matchChecks);
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

  const handleGenerateLabels = async (): Promise<void> => {
    if (!allChecksPass) {
      addToast('error', 'Complete all match checks and upload at least one shipment photo before generating labels.');
      return;
    }
    setGenerating(true);
    try {
      const unitsPerBoxList = packRows.map((row) => row.actualQty);
      const mergedDocs = docRefsToSourceDocuments(docRefs, sourceDocuments);
      await updateGRN(grn.id, {
        sourceDocuments: mergedDocs,
        noOfBoxes: packRows.length,
        unitsPerBox: packRows[0]?.actualQty ?? grn.unitsPerBox ?? null,
        workflowSteps: ['PO Received', 'Qty Check'],
        status: 'On Hold',
      });
      const labelRes = await generateGRNLabels(grn.id, {
        noOfBoxes: packRows.length,
        unitsPerBoxList,
        itemCode: lineItem.itemCode,
        productName: grnLineItemDisplayName(lineItem),
      });
      addToast('success', `${packRows.length} rack labels generated · GRN copy saved · ready to send to QC.`);
      onSaved({
        ...grn,
        status: 'On Hold',
        sourceDocuments: mergedDocs,
        noOfBoxes: packRows.length,
        unitsPerBox: packRows[0]?.actualQty ?? grn.unitsPerBox ?? null,
        workflowSteps: labelRes.workflowSteps ?? ['PO Received', 'Qty Check', 'Label Generation'],
        generatedLabels: labelRes.labels,
      });
      onClose();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to generate labels');
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
                📋 GRN Copy — {displayGrnNo(headerView.titleGrnNo)} {headerView.itemTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {[headerView.shipmentBatchRef, headerView.poNo, headerView.vendorLine, headerView.warehouseCode, headerView.warehouseName]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!allChecksPass || generating}
                onClick={() => void handleGenerateLabels()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate Labels'}
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

        <div className="space-y-6 px-6 py-5">
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
                    <th className="px-3 py-2 text-left">Pack Condition</th>
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
                      <td className="px-3 py-2 text-slate-700">{row.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
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
                <p className="text-xs text-slate-500 uppercase tracking-wide">Billed Qty</p>
                <p className="font-semibold text-slate-900">
                  {(lineItem.invoiceQty || lineItem.rcvdQty).toLocaleString('en-IN')} {lineItem.unit ?? 'kg'}
                </p>
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
            <p className={`mt-3 text-sm font-medium ${allChecksPass ? 'text-emerald-700' : 'text-amber-700'}`}>
              {allChecksPass
                ? '✓ All checks pass. Generate Labels button enabled · on click → rack labels print (one per pack) · GRN moves to VERIFIED · auto-routed to QC.'
                : 'Complete document uploads, pack counts, and shipment photos to enable Generate Labels.'}
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
      </div>
    </div>
  );
};

export default GrnCopyReceiptModal;
