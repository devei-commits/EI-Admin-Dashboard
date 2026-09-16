/**
 * "Download GRN Copy (PDF)" — a printable hard-copy summary of a completed GRN: item/PO/vendor
 * details, the required-documents checklist, QC by / QC status, and per-line quantities (PO,
 * shipped, received, invoice, unit price, diff). Follows the same popup + window.print() convention
 * as printGrnLabels (see grnLabelPrint.ts) rather than a client-side PDF library — the user's
 * browser "Save as PDF" print destination produces the actual PDF file.
 */

import { displayGrnNo } from './grnLabelPrint';

export interface GrnCopyPdfLineItem {
  item: string;
  itemCode: string;
  poQty: number;
  shippedQty?: number | null;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  diff?: number | null;
  qcStatus?: string | null;
}

export interface GrnCopyPdfDoc {
  label: string;
  uploaded: boolean;
  fileName?: string | null;
}

export interface GrnCopyPdfInput {
  grnNo: string | null | undefined;
  poNo?: string | null;
  vendor?: string | null;
  type?: string | null;
  status?: string | null;
  receivedDate?: string | null;
  grnDate?: string | null;
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  assignedTo?: string | null;
  qcStatus?: string | null;
  qcBy?: string | null;
  locationZone?: string | null;
  locationPrefix?: string | null;
  documents: GrnCopyPdfDoc[];
  lineItems: GrnCopyPdfLineItem[];
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return esc(d);
  return parsed.toLocaleDateString('en-IN');
}

function fmtQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN');
}

/**
 * Opens a print window with the GRN copy document and triggers the browser print dialog.
 * Returns false if the popup was blocked, so the caller can surface a toast.
 */
export function printGrnCopyPdf(input: GrnCopyPdfInput): boolean {
  const printWin = window.open('', '_blank', 'width=900,height=900');
  if (!printWin) return false;

  const grnDisplay = displayGrnNo(input.grnNo);
  const title = `GRN Copy - ${grnDisplay}`;

  const infoRow = (label: string, value: string) => `
    <div class="field"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;

  const docsHtml = input.documents.length
    ? input.documents
        .map(
          (d) => `
        <tr>
          <td>${esc(d.label)}</td>
          <td class="${d.uploaded ? 'ok' : 'missing'}">${d.uploaded ? 'Uploaded' : 'Missing'}</td>
          <td>${esc(d.fileName || '—')}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="muted">No documents required</td></tr>';

  const lineItemsHtml = input.lineItems
    .map(
      (li) => `
      <tr>
        <td>
          <div class="item-name">${esc(li.item)}</div>
          <div class="item-code">${esc(li.itemCode)}</div>
        </td>
        <td class="num">${fmtQty(li.poQty)}</td>
        <td class="num">${fmtQty(li.shippedQty)}</td>
        <td class="num">${fmtQty(li.rcvdQty)}</td>
        <td class="num">${fmtQty(li.invoiceQty)}</td>
        <td class="num">₹${fmtQty(li.unitPrice)}</td>
        <td class="num ${li.diff ? (li.diff > 0 ? 'over' : 'under') : ''}">
          ${li.diff == null ? '—' : li.diff === 0 ? '0' : li.diff > 0 ? `+${fmtQty(li.diff)}` : fmtQty(li.diff)}
        </td>
        <td>${esc(li.qcStatus || '—')}</td>
      </tr>`,
    )
    .join('');

  printWin.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${esc(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .subtitle { font-size: 12px; color: #475569; margin: 0 0 20px; }
      section { margin-bottom: 20px; }
      h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 0 0 10px; }
      .fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
      .field { font-size: 12px; }
      .field .k { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; }
      .field .v { display: block; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
      td.num { text-align: center; }
      .item-name { font-weight: 700; }
      .item-code { color: #64748b; font-size: 10px; }
      .ok { color: #15803d; font-weight: 700; }
      .missing { color: #b91c1c; font-weight: 700; }
      .over, .under { font-weight: 700; color: #b91c1c; }
      .muted { color: #94a3b8; text-align: center; }
      @media print {
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <h1>GRN Copy — ${esc(grnDisplay)}</h1>
    <p class="subtitle">Goods Received Note — hard copy</p>

    <section>
      <h2>GRN Details</h2>
      <div class="fields">
        ${infoRow('GRN No.', grnDisplay)}
        ${infoRow('PO No.', input.poNo || '—')}
        ${infoRow('Vendor', input.vendor || '—')}
        ${infoRow('Type', input.type || '—')}
        ${infoRow('Status', input.status || '—')}
        ${infoRow('Received Date', fmtDate(input.receivedDate))}
        ${infoRow('GRN Date', fmtDate(input.grnDate))}
        ${infoRow('Invoice No.', input.invoiceNo || '—')}
        ${infoRow('Invoice Amount', input.invoiceAmount != null ? `₹${fmtQty(input.invoiceAmount)}` : '—')}
        ${infoRow('Assigned To', input.assignedTo || '—')}
        ${infoRow('Put-away Zone', input.locationZone || '—')}
        ${infoRow('Put-away Rack', input.locationPrefix || '—')}
      </div>
    </section>

    <section>
      <h2>QC</h2>
      <div class="fields">
        ${infoRow('QC Status', input.qcStatus || '—')}
        ${infoRow('QC By / Passed By', input.qcBy || '—')}
      </div>
    </section>

    <section>
      <h2>Documents checklist</h2>
      <table>
        <thead><tr><th>Document</th><th>Status</th><th>File</th></tr></thead>
        <tbody>${docsHtml}</tbody>
      </table>
    </section>

    <section>
      <h2>Line items</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>PO Qty</th>
            <th>Shipped Qty</th>
            <th>Rcvd Qty</th>
            <th>Invoice Qty</th>
            <th>Unit Price</th>
            <th>Diff</th>
            <th>QC Status</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>
    </section>

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
