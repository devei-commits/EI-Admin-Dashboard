/**
 * Pack-level GRN label printing — one label per physical pack from the Packaging List (QR encodes
 * the packaging number). Used by the Generate Labels step (GrnGenerateLabelsSection, step 5) and
 * the always-available "Print pack labels" button in GrnCopyReceiptModal's header.
 *
 * Generate Labels renders QR canvases client-side (qrcode.react), builds the label snapshot via
 * `buildGeneratedPackLabels`, and persists it (POST /:id/pack-labels) before printing. Every later
 * reprint — including "Print pack labels" from any step — prints that persisted snapshot via
 * `printStoredPackLabels`, never recomputing from the (possibly since-edited) live batches/packaging
 * data, so a lost/damaged label always reprints identical to what's physically on the pack.
 */

import type { GrnBatchRow } from './inboundGrnBatchesMeta';
import type { GrnPackagingRow } from './inboundGrnPackagingMeta';
import type { GeneratedPackLabel, PackLabelField } from '../services/grn.service';

/** yyyy-mm-dd → "MAY/2026". Falls back to the raw value when unparseable. */
export function formatMonYear(date: string | null | undefined): string {
  const raw = String(date ?? '').trim();
  if (!raw) return '—';
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
  if (!m) return raw;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? `${months[mi]}/${m[1]}` : raw;
}

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PackLabelContext {
  batches: GrnBatchRow[];
  productName: string;
  productCode: string;
  vendor: string;
  unit?: string;
}

/** The field rows shown on one pack label, in print order. */
export function packLabelFields(row: GrnPackagingRow, ctx: PackLabelContext): PackLabelField[] {
  const batch = ctx.batches[row.batchIndex];
  return [
    { label: 'Product', value: ctx.productName || '—' },
    { label: 'Product Code', value: ctx.productCode || '—' },
    { label: 'Vendor', value: ctx.vendor || '—' },
    { label: 'Vendor Batch', value: batch?.vendorBatchNo || '—' },
    { label: 'MFG', value: formatMonYear(batch?.mfgDate) },
    { label: 'EXP', value: formatMonYear(batch?.expDate) },
    { label: 'Qty in pack', value: row.qty != null ? `${row.qty}${ctx.unit ? ` ${ctx.unit}` : ''}` : '—' },
  ];
}

/**
 * Freeze the current rows/QR-canvases/context into the persistable shape (POST /:id/pack-labels).
 * `qrDataUrls` must be the same length/order as `rows` (one rendered QR canvas per row).
 */
export function buildGeneratedPackLabels(
  rows: GrnPackagingRow[],
  qrDataUrls: string[],
  ctx: PackLabelContext,
): GeneratedPackLabel[] {
  return rows.map((row, i) => ({
    packagingNo: row.packagingNo,
    qrPayload: row.packagingNo,
    qrImageDataUrl: qrDataUrls[i] ?? '',
    fields: packLabelFields(row, ctx),
  }));
}

function packLabelCardHtml(packagingNo: string, qrDataUrl: string, fields: PackLabelField[]): string {
  const fieldRows = fields
    .map((f) => `<div class="row"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`)
    .join('');
  return `
    <article class="label">
      <div class="pkg">📦 ${esc(packagingNo)}</div>
      <div class="qrwrap">${qrDataUrl ? `<img src="${esc(qrDataUrl)}" alt="QR" />` : ''}</div>
      <div class="rows">${fieldRows}</div>
      <div class="pkgfoot">${esc(packagingNo)}</div>
    </article>`;
}

/** Open a print window for the given pre-built label cards. Returns false if the popup was blocked. */
function openPackLabelsPrintWindow(cards: string): boolean {
  if (!cards) return true;
  const win = window.open('', '_blank', 'width=900,height=760');
  if (!win) return false;

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
  return true;
}

/**
 * Print pack labels freshly rendered from live rows/QR-canvases/context — used only by the
 * Generate Labels step, right before persisting that same snapshot via buildGeneratedPackLabels.
 * `qrDataUrls` must be the same length/order as `rows` (one rendered QR canvas per row).
 */
export function printPackLabels(rows: GrnPackagingRow[], qrDataUrls: string[], ctx: PackLabelContext): boolean {
  if (!rows.length) return true;
  const cards = rows.map((row, i) => packLabelCardHtml(row.packagingNo, qrDataUrls[i] ?? '', packLabelFields(row, ctx))).join('');
  return openPackLabelsPrintWindow(cards);
}

/**
 * Reprint the exact labels persisted at generation time (grn.generatedPackLabels) — no live
 * batches/packaging/QR-canvas recomputation, so this always matches what's physically on the packs.
 */
export function printStoredPackLabels(labels: GeneratedPackLabel[]): boolean {
  if (!labels.length) return true;
  const cards = labels.map((l) => packLabelCardHtml(l.packagingNo, l.qrImageDataUrl, l.fields)).join('');
  return openPackLabelsPrintWindow(cards);
}
