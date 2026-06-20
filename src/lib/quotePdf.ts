/**
 * Quote PDF generation (jsPDF + autotable v5).
 * Produces a branded quote document: header, 7-band pricing table,
 * delivery timeline, and footer with validity/GST.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SavedQuoteFull } from '../services/quotations.service';

const f2 = (n: number | null | undefined) => (n == null ? '-' : Number(n).toFixed(2));
const pct = (n: number | null | undefined) => (n == null ? '-' : (Number(n) * 100).toFixed(1) + '%');

export function generateQuotePdf(quote: SavedQuoteFull): void {
  const r = quote.result;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── Header ──
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Esthetic Insights', margin, 34);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Manufacturing Quotation', margin, 52);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(quote.quote_ref, pageW - margin, 34, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(new Date(quote.created_at).toLocaleDateString(), pageW - margin, 50, { align: 'right' });

  // ── Meta ──
  doc.setTextColor(30, 41, 59);
  let y = 96;
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(quote.quote_name || r.bom_name || 'Quotation', margin, y);
  y += 18;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  const meta: string[] = [];
  if (quote.customer_name) meta.push(`Customer: ${quote.customer_name}`);
  if (r.bom_code) meta.push(`BOM: ${r.bom_code}`);
  if (r.pack_size) meta.push(`Pack: ${r.pack_size}`);
  if (r.grade_name) meta.push(`Grade: ${r.grade_name}`);
  doc.text(meta.join('    '), margin, y);
  y += 20;

  // ── Pricing table ──
  const hasTarget = (r.bands?.[0]?.target ?? 0) > 0;
  const head = [['MOQ', 'RM', 'PM', 'Conv.', 'OH', 'Cost', 'Markup', 'Margin', 'Sell (Rs)']];
  if (hasTarget) head[0].push('Gap');
  const body = r.bands.map((b) => {
    const row = [b.moq, f2(b.rm), f2(b.pm), f2(b.conversion), f2(b.overhead), f2(b.total_cost), pct(b.markup_pct), pct(b.gross_margin_pct), f2(b.sell_price)];
    if (hasTarget) row.push(f2(b.gap));
    return row;
  });
  autoTable(doc, {
    startY: y, head, body, margin: { left: margin, right: margin },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    bodyStyles: { fontSize: 8, halign: 'right' },
    styles: { cellPadding: 4 },
  });

  // ── Timeline table ──
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  y = (doc.lastAutoTable?.finalY ?? y) + 24;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
  doc.text('Delivery Timeline (days)', margin, y);
  autoTable(doc, {
    startY: y + 8,
    head: [['MOQ', 'Procurement', 'Manufacturing', 'QC', 'Dispatch', 'Total', 'Weeks']],
    body: r.bands.map((b) => [b.moq, b.timeline.procurement, b.timeline.manufacturing, b.timeline.qc, b.timeline.dispatch, b.timeline.total, `${b.timeline.weeks}w`]),
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    bodyStyles: { fontSize: 8, halign: 'right' },
    styles: { cellPadding: 4 },
  });

  // ── Footer ──
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  y = (doc.lastAutoTable?.finalY ?? y) + 24;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
  const terms: string[] = [`GST: ${quote.gst_pct ?? 18}% extra`];
  if (quote.valid_until) terms.push(`Valid until: ${quote.valid_until}`);
  if (quote.prepared_by) terms.push(`Prepared by: ${quote.prepared_by}`);
  doc.text(terms.join('    '), margin, y);
  if (quote.notes) {
    y += 14;
    doc.text(doc.splitTextToSize(`Notes: ${quote.notes}`, pageW - margin * 2), margin, y);
  }

  doc.save(`${quote.quote_ref}.pdf`);
}
