/**
 * Purchase Order PDF (Flowchart Sub-flow F — "Generate PO PDF").
 * Builds a formal, print-friendly PO document in a standalone window and triggers
 * the browser print dialog (choose "Save as PDF"). No backend / PDF library needed —
 * mirrors the existing warehouse label-print approach.
 */

export interface PoDocLine {
  item: string;
  itemCode?: string;
  unit?: string;
  qty: number | string;
  pricePerUnit: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
}

export interface PoDocumentData {
  poNumber: string;
  poType?: string;
  reference?: string;
  orderDate?: string;
  expectedDelivery?: string;
  vendor: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  lines: PoDocLine[];
  notes?: string;
  /** Optional pre-computed totals; recomputed from lines when omitted. */
  subtotal?: number;
  gstTotal?: number;
  grandTotal?: number;
}

const COMPANY = {
  name: 'Esthetic Insights Pvt Ltd',
  addr: 'IDA Jeedimetla, Hyderabad, Telangana – 500 055',
  gstin: '36AAFCE1234M1Z2',
};
const DEFAULT_SHIP_TO = 'EI Plant 1, IDA Jeedimetla, Hyderabad – 500 055';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(n: number): string {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}

function qtyNum(v: number | string): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildPoDocumentHtml(data: PoDocumentData): string {
  const subtotal =
    data.subtotal != null ? data.subtotal : data.lines.reduce((s, l) => s + (Number(l.lineTotal) || 0) - (Number(l.gstAmount) || 0), 0);
  const gstTotal = data.gstTotal != null ? data.gstTotal : data.lines.reduce((s, l) => s + (Number(l.gstAmount) || 0), 0);
  const grandTotal = data.grandTotal != null ? data.grandTotal : subtotal + gstTotal;

  const rows = data.lines
    .map((l, i) => {
      const q = qtyNum(l.qty);
      const lineBase = q * (Number(l.pricePerUnit) || 0);
      return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>
          <div class="b">${esc(l.item || '—')}</div>
          ${l.itemCode ? `<div class="mono muted">${esc(l.itemCode)}</div>` : ''}
        </td>
        <td class="r">${esc(l.qty)}${l.unit ? ` ${esc(l.unit)}` : ''}</td>
        <td class="r">${money(Number(l.pricePerUnit) || 0)}</td>
        <td class="r">${money(lineBase)}</td>
        <td class="r">${(Number(l.gstPercent) || 0)}%<div class="muted">${money(Number(l.gstAmount) || 0)}</div></td>
        <td class="r b">${money(Number(l.lineTotal) || 0)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order ${esc(data.poNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; padding: 28px 34px; margin: 0; font-size: 12px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
  .hdr h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .04em; }
  .co { font-size: 11px; color: #475569; line-height: 1.5; }
  .meta { text-align: right; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #334155; }
  .meta .po { font-size: 15px; font-weight: 700; color: #0f172a; }
  .pill { display: inline-block; border: 1px solid #94a3b8; border-radius: 10px; padding: 1px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; margin-top: 4px; }
  .parties { display: flex; gap: 20px; margin: 6px 0 14px; }
  .parties > div { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 11px; }
  .lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 7px 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th.r, td.r { text-align: right; }
  th.c, td.c { text-align: center; }
  .b { font-weight: 700; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 10px; }
  .muted { color: #64748b; font-size: 10px; }
  .totals { margin-top: 12px; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 2px; }
  .totals .grand { border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 7px; font-size: 14px; font-weight: 700; }
  .terms { margin-top: 18px; font-size: 11px; }
  .terms ol { margin: 6px 0 0; padding-left: 18px; color: #334155; line-height: 1.6; }
  .signs { display: flex; justify-content: space-between; margin-top: 46px; gap: 24px; }
  .signs > div { flex: 1; border-top: 1px solid #0f172a; padding-top: 5px; font-size: 10.5px; color: #475569; text-align: center; }
  .foot { margin-top: 22px; font-size: 9.5px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { padding: 12px 16px; } .noprint { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>PURCHASE ORDER</h1>
      <div class="co"><b>${esc(COMPANY.name)}</b><br />${esc(COMPANY.addr)}<br />GSTIN: ${esc(COMPANY.gstin)}</div>
    </div>
    <div class="meta">
      <div class="po">${esc(data.poNumber)}</div>
      <div>Date: ${esc(fmtDate(data.orderDate))}</div>
      ${data.reference ? `<div>Ref: ${esc(data.reference)}</div>` : ''}
      ${data.poType ? `<div class="pill">${esc(data.poType)}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="lbl">Vendor</div>
      <div class="b">${esc(data.vendor || '—')}</div>
    </div>
    <div>
      <div class="lbl">Ship to</div>
      <div>${esc(data.deliveryAddress || DEFAULT_SHIP_TO)}</div>
      ${data.expectedDelivery ? `<div class="muted">Expected: ${esc(fmtDate(data.expectedDelivery))}</div>` : ''}
    </div>
    <div>
      <div class="lbl">Payment terms</div>
      <div>${esc(data.paymentTerms || 'As per contract')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c">#</th><th>Item</th><th class="r">Qty</th>
        <th class="r">Rate</th><th class="r">Amount</th><th class="r">GST</th><th class="r">Line total</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="7" class="c muted">No line items</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal (ex GST)</span><span>${money(subtotal)}</span></div>
    <div><span>GST</span><span>${money(gstTotal)}</span></div>
    <div class="grand"><span>Grand total</span><span>${money(grandTotal)}</span></div>
  </div>

  ${data.notes ? `<div class="terms"><div class="lbl">Notes</div>${esc(data.notes)}</div>` : ''}

  <div class="terms">
    <div class="lbl">Terms &amp; conditions</div>
    <ol>
      <li>Goods must match the specifications, quantity and rate stated above.</li>
      <li>Delivery to the ship-to address by the expected date; notify delays in advance.</li>
      <li>A valid tax invoice, COA/MSDS (where applicable) and e-way bill must accompany the shipment.</li>
      <li>Payment is per the terms above, subject to goods receipt (GRN) and 3-way match.</li>
      <li>EI reserves the right to reject non-conforming goods at the vendor's cost.</li>
    </ol>
  </div>

  <div class="signs">
    <div>Prepared by<br />Procurement</div>
    <div>Approved by<br />Procurement Head / CFO</div>
    <div>Authorised Signatory<br />${esc(COMPANY.name)}</div>
  </div>

  <div class="foot">Computer-generated Purchase Order · ${esc(COMPANY.name)} · ${esc(data.poNumber)}</div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;
}

/**
 * Open a formal PO document in a new window and trigger print (Save as PDF).
 * Returns false if the popup was blocked.
 */
export function openPurchaseOrderPdf(data: PoDocumentData): boolean {
  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) return false;
  win.document.write(buildPoDocumentHtml(data));
  win.document.close();
  return true;
}
