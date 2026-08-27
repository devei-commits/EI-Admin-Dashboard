/**
 * "Generate Labels" step (step 5): one printable label per pack from the Packaging List.
 * The QR encodes the packaging number; the card carries product, vendor, batch, MFG/EXP,
 * and pack quantity. Labels are rendered client-side (qrcode.react) and printed via a popup.
 */

import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer } from 'lucide-react';
import type { GrnBatchRow } from '../../lib/inboundGrnBatchesMeta';
import type { GrnPackagingRow } from '../../lib/inboundGrnPackagingMeta';
import { packLabelFields, printPackLabels } from '../../lib/grnPackLabelPrint';

export interface GrnGenerateLabelsSectionProps {
  rows: GrnPackagingRow[];
  batches: GrnBatchRow[];
  productName: string;
  productCode: string;
  vendor: string;
  unit?: string;
  disabled?: boolean;
  /** Called after a successful print, so the caller can mark packs as labelled. */
  onPrinted?: () => void;
  onPrintBlocked?: () => void;
}

export const GrnGenerateLabelsSection: React.FC<GrnGenerateLabelsSectionProps> = ({
  rows,
  batches,
  productName,
  productCode,
  vendor,
  unit,
  disabled = false,
  onPrinted,
  onPrintBlocked,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const ctx = { batches, productName, productCode, vendor, unit };
  const fieldsFor = (row: GrnPackagingRow) => packLabelFields(row, ctx);

  const handlePrint = (): void => {
    if (!rows.length) return;
    // Read the rendered QR canvases (same order as rows) into data URLs for the print doc.
    const canvases = gridRef.current
      ? Array.from(gridRef.current.querySelectorAll<HTMLCanvasElement>('canvas'))
      : [];
    const qrDataUrls = rows.map((_, i) => canvases[i]?.toDataURL('image/png') ?? '');
    if (!printPackLabels(rows, qrDataUrls, ctx)) {
      onPrintBlocked?.();
      return;
    }
    onPrinted?.();
  };

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">5 · Generate Labels</h3>
          <p className="mt-1 text-xs text-ink-3">
            One label per pack from the packaging list. The QR encodes the packaging number; print and
            affix to each pack.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={disabled || rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden /> Print all {rows.length} label{rows.length === 1 ? '' : 's'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-ink-3">
          No packs to label — complete the packaging list first.
        </p>
      ) : (
        <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.packagingNo} className="rounded-lg border border-border p-3">
              <div className="mb-2 text-xs font-bold text-ink">📦 {row.packagingNo}</div>
              <div className="mb-2 flex justify-center">
                <QRCodeCanvas value={row.packagingNo} size={132} includeMargin />
              </div>
              {fieldsFor(row).map((f) => (
                <div key={f.label} className="flex justify-between gap-2 py-0.5 text-xs">
                  <span className="font-semibold text-ink-3">{f.label}</span>
                  <span className="text-right font-bold text-ink">{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
