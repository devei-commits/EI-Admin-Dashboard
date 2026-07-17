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
  /** Full vendor address block (newline-separated), shown under the vendor name. */
  vendorAddress?: string;
  vendorGstin?: string;
  vendorPhone?: string;
  /** e.g. "Telangana (36)" — defaults to the company's state. */
  placeOfSupply?: string;
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
  name: 'ESTHETIC INSIGHTS PRIVATE LIMITED FY2627',
  addrLines: [
    'Plot No.45/A Survey, Road No.55, off Medak Road',
    'Phase IV, IDA Jeedimetla, Quthbullapur Mandal',
    'Hyderabad Telangana 500055',
    'India',
  ],
  phone: '9703022266',
  gstin: '36AAECE7642R2ZX',
};
const COMPANY_STATE = 'Telangana (36)';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain Indian-grouped amount with 2 decimals (no currency symbol) — matches the reference table. */
function amt(n: number): string {
  return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function money(n: number): string {
  return `₹${amt(n)}`;
}

/** DD/MM/YYYY to match the reference PO. */
function fmtDate(d: string | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function qtyNum(v: number | string): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Render a newline / comma separated address block into escaped <br>-joined HTML. */
function addrHtml(addr: string | undefined): string {
  return String(addr ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => esc(l))
    .join('<br />');
}

function buildPoDocumentHtml(data: PoDocumentData): string {
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const subtotal =
    data.subtotal != null ? data.subtotal : lines.reduce((s, l) => s + qtyNum(l.qty) * (Number(l.pricePerUnit) || 0), 0);
  const gstTotal = data.gstTotal != null ? data.gstTotal : lines.reduce((s, l) => s + (Number(l.gstAmount) || 0), 0);
  const grandTotal = data.grandTotal != null ? data.grandTotal : subtotal + gstTotal;

  // Intra-state (vendor in same state as company) → CGST + SGST; else IGST. Default to intra when
  // the vendor GSTIN is unknown (matches the reference).
  const companyState = COMPANY.gstin.slice(0, 2);
  const vendorState = String(data.vendorGstin ?? '').replace(/\s/g, '').slice(0, 2);
  const intraState = !vendorState || vendorState === companyState;
  const gstPct = subtotal > 0 ? Math.round((gstTotal / subtotal) * 100) : 0;
  const halfPct = gstPct / 2;
  const half = gstTotal / 2;

  const taxRows = gstTotal <= 0
    ? ''
    : intraState
      ? `<tr><td class="tl">CGST${halfPct} (${halfPct}%)</td><td class="tr">${amt(half)}</td></tr>
         <tr><td class="tl">SGST${halfPct} (${halfPct}%)</td><td class="tr">${amt(half)}</td></tr>`
      : `<tr><td class="tl">IGST${gstPct} (${gstPct}%)</td><td class="tr">${amt(gstTotal)}</td></tr>`;

  const rows = lines
    .map((l, i) => {
      const q = qtyNum(l.qty);
      const lineBase = q * (Number(l.pricePerUnit) || 0);
      return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>
          <div>${esc(l.item || '—')}</div>
          ${l.itemCode ? `<div class="muted">${esc(l.itemCode)}</div>` : ''}
        </td>
        <td class="r">${amt(q)}${l.unit ? `<div class="muted">${esc(l.unit)}</div>` : ''}</td>
        <td class="r">${amt(Number(l.pricePerUnit) || 0)}</td>
        <td class="r">${amt(lineBase)}</td>
      </tr>`;
    })
    .join('');

  const deliverTo = data.deliveryAddress && data.deliveryAddress.trim()
    ? addrHtml(data.deliveryAddress)
    : COMPANY.addrLines.map((l) => esc(l)).join('<br />');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order ${esc(data.poNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; padding: 24px; font-size: 11px; }
  .doc { border: 1px solid #b3b3b3; max-width: 820px; margin: 0 auto; }
  .pad { padding: 12px 14px; }
  .row { display: flex; }
  .row > div { flex: 1; }
  .bdr-b { border-bottom: 1px solid #b3b3b3; }
  .bdr-r { border-right: 1px solid #b3b3b3; }
  /* Header */
  .head { align-items: flex-start; }
  .co-name { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
  .co-addr { color: #333; line-height: 1.45; }
  .title { text-align: right; }
  .title h1 { font-size: 30px; font-weight: 400; color: #4a4a4a; margin: 0; letter-spacing: -.5px; }
  /* Meta */
  .meta .k { display: inline-block; width: 108px; color: #333; }
  .meta .v { font-weight: bold; }
  .meta > div { padding: 8px 14px; }
  .meta .sub { color: #333; }
  .meta .sub .v { font-weight: bold; }
  /* Parties */
  .phead { font-weight: bold; background: #f2f2f2; }
  .pname { font-weight: bold; }
  .party { line-height: 1.5; }
  .party .muted { color: #333; }
  /* Items */
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { background: #f2f2f2; border-bottom: 1px solid #b3b3b3; padding: 6px 8px; text-align: left; font-weight: bold; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; width: 30px; }
  .muted { color: #666; font-size: 10px; margin-top: 2px; }
  /* Totals + signature */
  .foot { display: flex; }
  .foot .sign { flex: 1; padding: 14px; display: flex; align-items: flex-end; justify-content: center; color: #333; }
  .foot .tot { width: 320px; border-left: 1px solid #b3b3b3; }
  table.totals { width: 100%; border-collapse: collapse; }
  table.totals td { padding: 5px 14px; }
  table.totals td.tl { text-align: right; color: #333; }
  table.totals td.tr { text-align: right; width: 130px; }
  table.totals tr.grand td { border-top: 1px solid #b3b3b3; font-weight: bold; font-size: 12px; }
  @media print { body { padding: 0; } .doc { border: 1px solid #b3b3b3; } }
</style>
</head>
<body>
  <div class="doc">
    <!-- Header -->
    <div class="row head pad bdr-b">
      <div>
        <div class="co-name">${esc(COMPANY.name)}</div>
        <div class="co-addr">${COMPANY.addrLines.map((l) => esc(l)).join('<br />')}<br />${esc(COMPANY.phone)}<br />GSTIN: ${esc(COMPANY.gstin)}</div>
      </div>
      <div class="title"><h1>PURCHASE ORDER</h1></div>
    </div>

    <!-- Meta -->
    <div class="row meta bdr-b">
      <div class="bdr-r">
        <div><span class="k">Purchase Order#</span><span class="v">: ${esc(data.poNumber)}</span></div>
        <div><span class="k">Date</span><span class="v">: ${esc(fmtDate(data.orderDate))}</span></div>
        ${data.reference ? `<div><span class="k">Ref#</span><span class="v">: ${esc(data.reference)}</span></div>` : ''}
      </div>
      <div class="sub"><span class="k">Place Of Supply</span><span class="v">: ${esc(data.placeOfSupply || COMPANY_STATE)}</span></div>
    </div>

    <!-- Parties headers -->
    <div class="row bdr-b">
      <div class="pad bdr-r phead">Vendor Address</div>
      <div class="pad phead">Deliver To</div>
    </div>
    <!-- Parties content -->
    <div class="row bdr-b">
      <div class="pad bdr-r party">
        <div class="pname">${esc(data.vendor || '—')}</div>
        ${data.vendorAddress ? `${addrHtml(data.vendorAddress)}<br />` : ''}
        ${data.vendorGstin ? `GSTIN ${esc(data.vendorGstin)}<br />` : ''}
        ${data.vendorPhone ? `${esc(data.vendorPhone)}` : ''}
      </div>
      <div class="pad party">
        ${deliverTo}<br />${esc(COMPANY.phone)}<br />GSTIN: ${esc(COMPANY.gstin)}
      </div>
    </div>

    <!-- Items -->
    <table class="items">
      <thead>
        <tr><th class="c">#</th><th>Item &amp; Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" class="c muted">No line items</td></tr>'}</tbody>
    </table>

    <!-- Totals + Authorized Signature -->
    <div class="foot bdr-b" style="border-top: 1px solid #b3b3b3;">
      <div class="sign">Authorized Signature</div>
      <div class="tot">
        <table class="totals">
          <tr><td class="tl">Sub Total</td><td class="tr">${amt(subtotal)}</td></tr>
          ${taxRows}
          <tr class="grand"><td class="tl">Total</td><td class="tr">${money(grandTotal)}</td></tr>
        </table>
      </div>
    </div>

    ${data.notes ? `<div class="pad" style="color:#333;">${esc(data.notes)}</div>` : ''}
  </div>

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
  try {
    win.document.write(buildPoDocumentHtml(data));
    win.document.close();
    return true;
  } catch (err) {
    // Never leave a blank popup open on malformed data — close it and report failure.
    console.error('[purchaseOrderPdf] failed to build PO document', err);
    try { win.close(); } catch { /* ignore */ }
    return false;
  }
}
