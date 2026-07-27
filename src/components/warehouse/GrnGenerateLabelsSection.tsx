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

/** yyyy-mm-dd → "MAY/2026". Falls back to the raw value when unparseable. */
function formatMonYear(date: string | null | undefined): string {
  const raw = String(date ?? '').trim();
  if (!raw) return '—';
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
  if (!m) return raw;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? `${months[mi]}/${m[1]}` : raw;
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  const fieldsFor = (row: GrnPackagingRow): Array<{ label: string; value: string }> => {
    const batch = batches[row.batchIndex];
    return [
      { label: 'Product', value: productName || '—' },
      { label: 'Product Code', value: productCode || '—' },
      { label: 'Vendor', value: vendor || '—' },
      { label: 'Vendor Batch', value: batch?.vendorBatchNo || '—' },
      { label: 'MFG', value: formatMonYear(batch?.mfgDate) },
      { label: 'EXP', value: formatMonYear(batch?.expDate) },
      { label: 'Qty in pack', value: row.qty != null ? `${row.qty}${unit ? ` ${unit}` : ''}` : '—' },
    ];
  };

  const handlePrint = (): void => {
    if (!rows.length) return;
    // Read the rendered QR canvases (same order as rows) into data URLs for the print doc.
    const canvases = gridRef.current
      ? Array.from(gridRef.current.querySelectorAll<HTMLCanvasElement>('canvas'))
      : [];
    const win = window.open('', '_blank', 'width=900,height=760');
    if (!win) {
      onPrintBlocked?.();
      return;
    }
    const cards = rows
      .map((row, i) => {
        const qr = canvases[i]?.toDataURL('image/png') ?? '';
        const fieldRows = fieldsFor(row)
          .map((f) => `<div class="row"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`)
          .join('');
        return `
          <article class="label">
            <div class="pkg">📦 ${esc(row.packagingNo)}</div>
            <div class="qrwrap">${qr ? `<img src="${esc(qr)}" alt="QR" />` : ''}</div>
            <div class="rows">${fieldRows}</div>
            <div class="pkgfoot">${esc(row.packagingNo)}</div>
          </article>`;
      })
      .join('');

    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Pack Labels</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 12px; color: #0f172a; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
      .label { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; break-inside: avoid; }
      .pkg { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
      .qrwrap { text-align: center; margin-bottom: 8px; }
      .qrwrap img { width: 150px; height: 150px; object-fit: contain; }
      .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin: 3px 0; }
      .k { color: #64748b; font-weight: 600; }
      .v { color: #0f172a; font-weight: 700; text-align: right; }
      .pkgfoot { margin-top: 8px; text-align: center; font-family: monospace; font-size: 11px; color: #334155; }
      @media print { body { padding: 0; } .label { border: 1px solid #000; page-break-inside: avoid; } }
    </style>
  </head>
  <body>
    <div class="grid">${cards}</div>
    <script>
      window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };
    </script>
  </body>
</html>`);
    win.document.close();
    onPrinted?.();
  };

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">5 · Generate Labels</h3>
          <p className="mt-1 text-xs text-slate-500">
            One label per pack from the packaging list. The QR encodes the packaging number; print and
            affix to each pack.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={disabled || rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden /> Print all {rows.length} label{rows.length === 1 ? '' : 's'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          No packs to label — complete the packaging list first.
        </p>
      ) : (
        <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.packagingNo} className="rounded-lg border border-slate-300 p-3">
              <div className="mb-2 text-xs font-bold text-slate-900">📦 {row.packagingNo}</div>
              <div className="mb-2 flex justify-center">
                <QRCodeCanvas value={row.packagingNo} size={132} includeMargin />
              </div>
              {fieldsFor(row).map((f) => (
                <div key={f.label} className="flex justify-between gap-2 py-0.5 text-xs">
                  <span className="font-semibold text-slate-500">{f.label}</span>
                  <span className="text-right font-bold text-slate-800">{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
