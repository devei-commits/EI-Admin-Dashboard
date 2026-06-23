/**
 * Quote PDF generation (jsPDF + autotable v5).
 * Two variants:
 *   - 'client'   : customer-facing — price + delivery only, no cost internals.
 *   - 'internal' : full cost breakdown (RM/PM/Conv/OH/Cost/Margin) + RM & PM
 *                  ingredient/component breakdowns.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SavedQuoteFull } from '../services/quotations.service';

export type PdfVariant = 'client' | 'internal';

const f2 = (n: number | null | undefined) => (n == null ? '-' : Number(n).toFixed(2));
const pct = (n: number | null | undefined) => (n == null ? '-' : (Number(n) * 100).toFixed(1) + '%');
const lastY = (doc: jsPDF, fallback: number) =>
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  (doc.lastAutoTable?.finalY ?? fallback);

export function generateQuotePdf(quote: SavedQuoteFull, variant: PdfVariant = 'client'): void {
  const r = quote.result;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── Header band ──
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Esthetic Insights', margin, 34);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(variant === 'internal' ? 'Manufacturing Quotation — Internal' : 'Manufacturing Quotation', margin, 52);
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
  const meta = [
    quote.customer_name && `Customer: ${quote.customer_name}`,
    r.bom_code && `BOM: ${r.bom_code}`,
    r.pack_size && `Pack: ${r.pack_size}`,
    r.grade_name,
  ].filter(Boolean) as string[];
  doc.text(meta.join('    '), margin, y);
  y += 20;

  if (variant === 'client') {
    // Customer-facing: MOQ · Sell · Delivery
    autoTable(doc, {
      startY: y,
      head: [['MOQ (units)', 'Unit Price (Rs)', 'Delivery']],
      body: r.bands.map((b) => [b.moq, f2(b.sell_price), `~${b.timeline.weeks} weeks`]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      styles: { cellPadding: 6 },
    });
  } else {
    // Internal: full cost breakdown
    const hasTarget = (r.bands?.[0]?.target ?? 0) > 0;
    const head = [['MOQ', 'RM', 'PM', 'Conv.', 'OH', 'Cost', 'Markup', 'Margin', 'Sell']];
    if (hasTarget) head[0].push('Gap');
    autoTable(doc, {
      startY: y,
      head,
      body: r.bands.map((b) => {
        const row = [b.moq, f2(b.rm), f2(b.pm), f2(b.conversion), f2(b.overhead), f2(b.total_cost), pct(b.markup_pct), pct(b.gross_margin_pct), f2(b.sell_price)];
        if (hasTarget) row.push(f2(b.gap));
        return row;
      }),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      bodyStyles: { fontSize: 8, halign: 'right' },
      styles: { cellPadding: 4 },
    });
  }

  // ── Timeline (both variants) ──
  y = lastY(doc, y) + 24;
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

  // ── Internal-only: RM & PM breakdowns ──
  if (variant === 'internal') {
    y = lastY(doc, y) + 24;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('Raw Material Breakdown', margin, y);
    autoTable(doc, {
      startY: y + 8,
      head: [['Ingredient', '% w/w', 'Rs/kg', 'Landed/kg']],
      body: r.rm_detail.map((x) => [x.name, String(x.pct_w_w), f2(x.price_per_kg), f2(x.landed_per_kg)]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 200 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 3 },
    });
    y = lastY(doc, y) + 18;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('Pack Material Breakdown', margin, y);
    autoTable(doc, {
      startY: y + 8,
      head: [['Component', 'Qty', 'Rs/pc', 'Line']],
      body: r.pm_detail.map((x) => [x.name, String(x.qty_per_unit), f2(x.price_per_pc), f2(x.line_total)]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 200 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 3 },
    });
  }

  // ── Footer ──
  y = lastY(doc, y) + 24;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
  const terms = [`GST: ${quote.gst_pct ?? 18}% extra`];
  if (quote.valid_until) terms.push(`Valid until: ${quote.valid_until}`);
  if (quote.prepared_by) terms.push(`Prepared by: ${quote.prepared_by}`);
  doc.text(terms.join('    '), margin, y);
  if (quote.notes) {
    y += 14;
    doc.text(doc.splitTextToSize(`Notes: ${quote.notes}`, pageW - margin * 2), margin, y);
  }

  doc.save(`${quote.quote_ref}-${variant}.pdf`);
}
