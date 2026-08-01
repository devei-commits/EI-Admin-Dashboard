import React, { useEffect, useMemo, useState } from 'react';
import { PrPopupShell, PopupSection, StatCell } from '../procurement/PrPopupShell';
import type { GRNRecordFromApi } from '../../services/grn.service';
import { fetchVendorClients } from '../../services/vendorClient.service';
import type { QualityOrderManagementRow } from '../../lib/qualityOrderManagementTableDisplay';
import { displayInboundGrnNo, resolveInboundWarehouseCode } from '../../lib/inboundGrnTableDisplay';
import type { GrnQcLineSpec, GrnQcTestRow } from '../../lib/grnQcSpecs';
import {
  buildQcReferenceNo,
  buildThirdPartyPoPreview,
  computeExpectedReportDate,
  defaultSampleNote,
  defaultSampleQtyForTest,
  extractThirdPartyPoRef,
  filterLabVendorsForTest,
  formatInr,
  formatThirdPartyDate,
  generateThirdPartyPoNumber,
  mergeLabVendorOptions,
  vendorRecordToLabOption,
  buildThirdPartyOrderOnRelease,
  buildThirdPartyPoPreviewInput,
  type ThirdPartyLabVendorOption,
  type ThirdPartyReleasePayload,
} from '../../lib/thirdPartyLabTest';
import ThirdPartyPoPdfPreview from './ThirdPartyPoPdfPreview';

export type ThirdPartyTestModalProps = {
  row: QualityOrderManagementRow;
  grn: GRNRecordFromApi;
  qcLine: GrnQcLineSpec;
  test: GrnQcTestRow;
  testIndex: number;
  qcApprover?: string;
  /** When set, modal opens in tracking / view mode for an already-released PO. */
  existingPoRef?: string | null;
  onClose: () => void;
  onReleased: (payload: ThirdPartyReleasePayload) => void | Promise<void>;
  /** Called after PO is saved — e.g. navigate to 3rd-Party Tracking. */
  onReleasedToTracking?: () => void;
};

const PAYMENT_TERM_OPTIONS = ['Net 30', 'Net 15', 'Net 45', 'Advance 50%'] as const;
const URGENCY_OPTIONS = ['Standard', 'Express', 'Urgent'] as const;

const ThirdPartyTestModal: React.FC<ThirdPartyTestModalProps> = ({
  row,
  grn,
  qcLine,
  test,
  testIndex,
  qcApprover,
  existingPoRef,
  onClose,
  onReleased,
  onReleasedToTracking,
}) => {
  const released = Boolean(
    existingPoRef?.trim() ||
      test.thirdPartyOrder?.poNo ||
      extractThirdPartyPoRef(test.acceptance),
  );
  const qcRef = buildQcReferenceNo(grn.grnNo, grn.id);
  const grnDisplay = displayInboundGrnNo(grn.grnNo ?? row.grnSourceNo);
  const warehouseLabel = resolveInboundWarehouseCode(
    { locationZone: grn.locationZone },
    grn.lineItems?.[0] ?? null,
  );

  const [vendors, setVendors] = useState<ThirdPartyLabVendorOption[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [sampleQty, setSampleQty] = useState(defaultSampleQtyForTest(test));
  const [sampleNote, setSampleNote] = useState(defaultSampleNote(test));
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [urgency, setUrgency] = useState<(typeof URGENCY_OPTIONS)[number]>('Standard');
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [poNo] = useState(() => existingPoRef?.trim() || generateThirdPartyPoNumber());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setVendorsLoading(true);
      try {
        const res = await fetchVendorClients('vendor');
        const apiLabs = (res.data ?? [])
          .map(vendorRecordToLabOption)
          .filter((v): v is ThirdPartyLabVendorOption => v != null);
        const merged = mergeLabVendorOptions(apiLabs);
        const filtered = filterLabVendorsForTest(merged, test);
        if (!cancelled) {
          setVendors(filtered);
          if (filtered[0]) {
            setSelectedVendorId((prev) => prev || filtered[0]!.id);
          }
        }
      } catch {
        if (!cancelled) {
          const filtered = filterLabVendorsForTest(mergeLabVendorOptions([]), test);
          setVendors(filtered);
          if (filtered[0]) {
            setSelectedVendorId((prev) => prev || filtered[0]!.id);
          }
        }
      } finally {
        if (!cancelled) setVendorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [test]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? vendors[0] ?? null;

  useEffect(() => {
    if (selectedVendor?.paymentTerms) setPaymentTerms(selectedVendor.paymentTerms);
  }, [selectedVendor?.id, selectedVendor?.paymentTerms]);

  const leadTimeDays = selectedVendor?.leadTimeDays ?? 5;
  const expectedReportIso = computeExpectedReportDate(pickupDate, leadTimeDays);
  const pricePerSample = selectedVendor?.pricePerSample ?? 0;
  const totalValue = sampleQty * pricePerSample;

  const poInput = useMemo(
    () =>
      buildThirdPartyPoPreviewInput({
        poNo,
        poDate: new Date(),
        qcRef,
        grnNo: grnDisplay,
        vendorName: selectedVendor?.name ?? '—',
        vendorCode: selectedVendor?.vendorCode ?? '—',
        vendorCity: selectedVendor?.city,
        itemCode: row.itemCode,
        itemName: row.itemName,
        testParameter: test.parameter,
        testMethod: test.method || 'NABL-accredited method',
        specLimit: test.specLimit || '—',
        sampleQty,
        sampleNote,
        pricePerSample,
        pickupDate,
        expectedReportDate: expectedReportIso,
        paymentTerms,
        warehouseLabel,
        materialVendor: grn.vendor || undefined,
        qcApprover,
      }),
    [
      poNo,
      qcRef,
      grnDisplay,
      selectedVendor,
      row.itemCode,
      row.itemName,
      test.parameter,
      test.method,
      test.specLimit,
      sampleQty,
      sampleNote,
      pricePerSample,
      pickupDate,
      expectedReportIso,
      paymentTerms,
      warehouseLabel,
      grn.vendor,
      qcApprover,
    ],
  );

  const poPreview = useMemo(() => buildThirdPartyPoPreview(poInput), [poInput]);

  const downloadPoPdf = (): void => {
    void import('../../lib/thirdPartyTestPoPdf').then((mod) => {
      mod.generateThirdPartyTestPoPdf(poInput);
    });
  };

  const handleRelease = async (): Promise<void> => {
    if (released) return;
    if (!selectedVendor) {
      setReleaseError('Select a lab vendor.');
      return;
    }
    setReleasing(true);
    setReleaseError(null);
    try {
      const ref = extractThirdPartyPoRef(poNo) ?? poNo;
      await onReleased({
        poRef: ref,
        order: buildThirdPartyOrderOnRelease({
          poNo: ref,
          poDate: new Date(),
          labVendorName: selectedVendor.name,
          labVendorCode: selectedVendor.vendorCode,
          samplePickupDate: pickupDate,
          expectedReportDate: expectedReportIso,
        }),
      });
      downloadPoPdf();
      onReleasedToTracking?.();
      onClose();
    } catch (e) {
      setReleaseError(e instanceof Error ? e.message : 'Could not release PO');
    } finally {
      setReleasing(false);
    }
  };

  const handleDownloadPdf = (): void => {
    downloadPoPdf();
  };

  const handleEmailVendor = (): void => {
    const vendorEmail = 'samples@lab.example.com';
    const subject = encodeURIComponent(`${poNo} — 3rd-party test request · ${row.itemName}`);
    const body = encodeURIComponent(poPreview);
    window.open(`mailto:${vendorEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const title = `Initiate 3rd-Party Testing — ${row.itemName} ${row.itemCode}`;
  const subtitle = (
    <>
      Linked QC: <span className="font-mono">{qcRef}</span> · Parameter: {test.parameter} · For{' '}
      <span className="font-mono">{grnDisplay}</span>
    </>
  );

  return (
    <PrPopupShell
      title={title}
      code={poNo}
      subtitle={subtitle}
      primaryLabel={released ? undefined : 'Release PO & Download'}
      onPrimary={released ? undefined : () => void handleRelease()}
      primaryDisabled={!selectedVendor || vendorsLoading}
      primaryBusy={releasing}
      onClose={onClose}
      width="max-w-5xl"
    >
      {releaseError ? (
        <p className="text-xs text-rose-700 mb-3" role="alert">
          {releaseError}
        </p>
      ) : null}

      <PopupSection title="🧪 Item & test required" first>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCell label="Item Code" value={row.itemCode} />
          <StatCell label="Item Name" value={row.itemName} />
          <StatCell label="Test Required" value={test.parameter} />
          <StatCell label="Spec to verify" value={test.specLimit || '—'} />
        </div>
      </PopupSection>

      <PopupSection title="🏢 Lab vendor selection (from price list)">
        <p className="text-[10px] text-slate-500 mb-2">
          Lab vendors filtered to Masters with category Lab / Testing or 3rd-party-lab, with accreditation
          matching the required test method ({test.method || 'external'}).
        </p>
        {vendorsLoading ? (
          <p className="text-xs text-slate-500">Loading lab vendors…</p>
        ) : vendors.length === 0 ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No matching lab vendors in Masters. Add vendors under category Lab / Testing with NABL accreditation.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="px-3 py-2 w-10">Pick</th>
                  <th scope="col" className="px-3 py-2">Lab Vendor</th>
                  <th scope="col" className="px-3 py-2">Tier</th>
                  <th scope="col" className="px-3 py-2">Price / sample</th>
                  <th scope="col" className="px-3 py-2">Lead Time</th>
                  <th scope="col" className="px-3 py-2">Last used</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => {
                  const picked = selectedVendorId === vendor.id;
                  return (
                    <tr
                      key={vendor.id}
                      className={`border-b border-slate-100 cursor-pointer ${picked ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                      onClick={() => !released && setSelectedVendorId(vendor.id)}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="radio"
                          name="lab-vendor"
                          checked={picked}
                          disabled={released}
                          onChange={() => setSelectedVendorId(vendor.id)}
                          className="accent-violet-700"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{vendor.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {vendor.vendorCode} · {vendor.accreditation}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{vendor.tier}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{formatInr(vendor.pricePerSample)}</td>
                      <td className="px-3 py-2.5 text-slate-700">{vendor.leadTimeDays}d</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatThirdPartyDate(vendor.lastUsed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PopupSection>

      <PopupSection title="📦 Order details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="block text-xs sm:col-span-2">
            <span className="font-semibold text-slate-700">Qty to ship to lab</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                value={sampleQty}
                disabled={released}
                onChange={(e) => setSampleQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 rounded border border-slate-300 px-2 py-1.5 text-xs"
              />
              <span className="text-slate-500">samples</span>
            </div>
            <input
              type="text"
              value={sampleNote}
              disabled={released}
              onChange={(e) => setSampleNote(e.target.value)}
              className="mt-1.5 w-full rounded border border-slate-300 px-2 py-1.5 text-[11px] text-slate-700"
              placeholder="e.g. 100 g each from drum 1 & 4"
              aria-label="Sample note"
            />
          </label>
          <StatCell label="Price / unit (from list)" value={formatInr(pricePerSample)} />
          <StatCell label="Total Value" value={`${formatInr(totalValue)} + GST`} />
          <label className="block text-xs">
            <span className="font-semibold text-slate-700">Payment Terms</span>
            <select
              value={paymentTerms}
              disabled={released}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs bg-white"
            >
              {PAYMENT_TERM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <StatCell label="Testing Lead Time" value={`${leadTimeDays} days`} />
          <StatCell label="Expected Report" value={formatThirdPartyDate(expectedReportIso)} />
          <label className="block text-xs">
            <span className="font-semibold text-slate-700">Sample Pickup Date</span>
            <input
              type="date"
              value={pickupDate}
              disabled={released}
              onChange={(e) => setPickupDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-slate-700">Urgency</span>
            <select
              value={urgency}
              disabled={released}
              onChange={(e) => setUrgency(e.target.value as (typeof URGENCY_OPTIONS)[number])}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs bg-white"
            >
              {URGENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PopupSection>

      <PopupSection title="4B.2 PO format preview (generated on Release)">
        <ThirdPartyPoPdfPreview poInput={poInput} />
        <details className="mt-2">
          <summary className="text-[10px] text-slate-500 cursor-pointer select-none">Plain-text summary</summary>
          <pre className="whitespace-pre-wrap text-[10px] leading-relaxed font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 max-h-40 overflow-y-auto mt-1">
            {poPreview}
          </pre>
        </details>
      </PopupSection>

      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          💾 Save as PDF
        </button>
        <button
          type="button"
          onClick={handleEmailVendor}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          📧 Email to Vendor
        </button>
        {!released ? (
          <button
            type="button"
            disabled={releasing || !selectedVendor}
            onClick={() => void handleRelease()}
            className="px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold disabled:opacity-50"
          >
            {releasing ? 'Releasing…' : '✓ Release PO & Move to Tracking'}
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            ✓ PO released — awaiting lab report (test #{testIndex + 1})
          </span>
        )}
      </div>
    </PrPopupShell>
  );
};

export default ThirdPartyTestModal;
