/**
 * GRN QR label rendering — shared by the generate flow (GrnCopyReceiptModal) and the
 * reprint flow (Inbound detail modal), so both show and print identical labels.
 *
 * Labels come back from POST /api/v1/grn/:id/generate-labels as { boxIndex, qrPayload, qrImageDataUrl }
 * where qrPayload is a JSON string. Printing opens a popup and calls window.print() —
 * matching the existing convention across this dashboard (purchaseOrderPdf, BMR/BPR templates).
 */

import type { GeneratedLabel } from '../services/grn.service';

/** Decoded QR payload. Every field is optional — old labels may predate any given key. */
export interface GrnLabelPayload {
  grn_id?: number;
  grn_no?: string;
  product_name?: string;
  item_code?: string;
  units_per_box?: number;
  location_prefix?: string;
  toRack?: string | null;
  rack?: string | null;
  toZone?: string | null;
  zone?: string | null;
  grn_batch_mfg?: string;
  expiry?: string;
  mfg_batch?: string;
  box_index?: number;
}

export function displayGrnNo(grnNo: string | null | undefined): string {
  const raw = String(grnNo ?? '').trim();
  if (!raw) return '—';
  return raw.replace(/^GRN-PO-/i, 'GRN-');
}

export function parseLabelPayload(label: GeneratedLabel): GrnLabelPayload {
  try {
    const parsed = JSON.parse(label.qrPayload || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as GrnLabelPayload) : {};
  } catch {
    return {};
  }
}

/**
 * The field rows shown on a label, in print order. Single source of truth so the
 * on-screen preview and the printed card can never drift apart.
 */
export function labelFieldRows(
  label: GeneratedLabel,
  grnNo: string | null | undefined,
): Array<{ label: string; value: string }> {
  const p = parseLabelPayload(label);
  const rack = p.toRack || p.rack || p.location_prefix || '—';
  const zone = p.toZone || p.zone || '—';
  const grnDisplay = displayGrnNo(String(p.grn_no || p.grn_id || grnNo || ''));
  return [
    { label: 'Product', value: p.product_name || '—' },
    { label: 'Item code', value: p.item_code || '—' },
    { label: 'GRN', value: grnDisplay },
    { label: 'Units', value: p.units_per_box != null ? String(p.units_per_box) : '—' },
    { label: 'Rack', value: String(rack) },
    { label: 'Zone', value: String(zone) },
    { label: 'Batch mfg', value: p.grn_batch_mfg || '—' },
    { label: 'Expiry', value: p.expiry || '—' },
    { label: 'Mfg batch', value: p.mfg_batch || '—' },
  ];
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelCardHtml(label: GeneratedLabel, grnNo: string | null | undefined): string {
  const rows = labelFieldRows(label, grnNo)
    .map((r) => `<p><strong>${esc(r.label)}:</strong> ${esc(r.value)}</p>`)
    .join('');
  return `
    <article class="card">
      <div class="head">GRN ${esc(displayGrnNo(grnNo))} - Box ${esc(label.boxIndex)}</div>
      <div class="img-wrap"><img src="${esc(label.qrImageDataUrl)}" alt="QR Box ${esc(label.boxIndex)}" /></div>
      ${rows}
    </article>
  `;
}

/**
 * Open a print window for one or more labels and trigger the browser print dialog.
 * Returns false if the popup was blocked, so the caller can surface a toast.
 */
export function printGrnLabels(
  labels: GeneratedLabel[],
  grnNo: string | null | undefined,
): boolean {
  if (!labels || labels.length === 0) return true;
  const many = labels.length > 1;

  const printWin = window.open('', '_blank', many ? 'width=900,height=760' : 'width=520,height=760');
  if (!printWin) return false;

  const sorted = [...labels].sort((a, b) => a.boxIndex - b.boxIndex);
  const cardsHtml = sorted.map((l) => labelCardHtml(l, grnNo)).join('');
  const title = many
    ? `QR Labels - ${esc(displayGrnNo(grnNo))}`
    : `QR Label - ${esc(displayGrnNo(grnNo))} - Box ${esc(sorted[0].boxIndex)}`;
  const imgSize = many ? 170 : 190;

  printWin.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
      .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; break-inside: avoid; ${many ? '' : 'width: 320px;'} }
      .head { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
      .img-wrap { text-align: center; margin-bottom: 8px; }
      img { width: ${imgSize}px; height: ${imgSize}px; object-fit: contain; }
      p { margin: ${many ? 3 : 4}px 0; font-size: ${many ? 11 : 12}px; }
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
  return true;
}
