/**
 * Dispensing pick list as a printable PDF (jsPDF + autotable), matching the on-screen table.
 *
 * The sheet goes to the floor, so it carries what an operator and a checker need: batch identity,
 * the site to collect from, one row per material with required / picked / dispensed / balance and
 * where each quantity comes from, a totals row, and a signature strip.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EI_COMPANY_LETTERHEAD } from '../constants/eiCompanyLetterhead';
import { formatQtyExact } from '../utils/formatQty';
import { pickListStatusLabel, type PickList } from './dispensingPickList';

const lastY = (doc: jsPDF, fallback: number): number =>
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  (doc.lastAutoTable?.finalY ?? fallback);

function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Build the pick-list PDF (caller may save or preview). */
export function buildDispensingPickListPdfDoc(list: PickList): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const q = (n: number) => formatQtyExact(n, list.qtyKind);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(EI_COMPANY_LETTERHEAD.legalName, margin, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(EI_COMPANY_LETTERHEAD.addressLines.join(', '), margin, 60, { maxWidth: contentW });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${list.kind} DISPENSING PICK LIST`, margin, 84);

  autoTable(doc, {
    startY: 92,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
    body: [
      [`Batch : ${list.batchLabel}`, `SO : ${list.soNo || '—'}`],
      [`Product : ${list.productName || '—'}`, `Collect from : ${list.site || '—'}`],
      [`Items : ${list.rows.length}`, `Generated : ${formatStamp(list.generatedAt)}`],
    ],
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: contentW * 0.6 }, 1: { cellWidth: contentW * 0.4 } },
  });

  autoTable(doc, {
    startY: lastY(doc, 140) + 8,
    head: [[
      '#', 'Code', 'Material',
      `Required\n(${list.unit})`, `Picked\n(${list.unit})`, `Dispensed\n(${list.unit})`, `Balance\n(${list.unit})`,
      'Picked from', 'Status',
    ]],
    body: list.rows.map((r) => [
      String(r.index), r.code, r.name || '—',
      q(r.required), q(r.picked), q(r.dispensed), q(r.balance),
      r.sources || 'not picked yet', pickListStatusLabel(r.status),
    ]),
    foot: [[
      '', '', 'TOTAL',
      q(list.totals.required), q(list.totals.picked), q(list.totals.dispensed), q(list.totals.balance),
      '', `${list.rows.length} items`,
    ]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', textColor: [30, 30, 30] },
    headStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [248, 248, 248], textColor: [20, 20, 20], fontStyle: 'bold' },
    // Fixed widths for the numeric/short columns; Material and "Picked from" are left to autotable
    // so they absorb the remaining width exactly — pinning every column leaves a ragged right edge.
    columnStyles: {
      0: { cellWidth: 18, halign: 'right' },
      1: { cellWidth: 52 },
      3: { cellWidth: 46, halign: 'right' },
      4: { cellWidth: 42, halign: 'right' },
      5: { cellWidth: 50, halign: 'right' },
      6: { cellWidth: 44, halign: 'right' },
      8: { cellWidth: 58 },
    },
    // Repeat the header on every page so a long list stays readable on the floor, but print the
    // TOTAL once at the end — autotable repeats the foot by default, which stamped full-list
    // totals at the bottom of page 1 as though the list had finished there.
    showHead: 'everyPage',
    showFoot: 'lastPage',
  });

  let y = lastY(doc, 200) + 24;
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 90) {
    doc.addPage();
    y = 60;
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const colW = contentW / 3;
  ['Dispensed by', 'Checked by', 'Production lead'].forEach((label, i) => {
    const x = margin + colW * i;
    doc.line(x, y, x + colW - 24, y);
    doc.text(label, x, y + 11);
    doc.text('Sign / Date', x, y + 22);
  });

  return doc;
}

export function pickListPdfFileName(list: PickList): string {
  const safe = list.batchLabel.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'batch';
  return `pick-list-${list.kind.toLowerCase()}-${safe}-${list.generatedAt.toISOString().slice(0, 10)}.pdf`;
}

export function downloadDispensingPickListPdf(list: PickList): void {
  buildDispensingPickListPdfDoc(list).save(pickListPdfFileName(list));
}
