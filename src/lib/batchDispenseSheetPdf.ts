/**
 * Batch RM + PM dispense sheet as a printable PDF (jsPDF + autotable) — one document, RM table
 * then PM table, each with a shortage summary line and a signature strip. Opened via `window.print`
 * on the PDF itself (jsPDF's `autoPrint`) so the header "Print" action hands the operator a print
 * dialog directly, the same way `dispensingPickListPdf.ts` hands one back for a single tray's list.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EI_COMPANY_LETTERHEAD } from '../constants/eiCompanyLetterhead';
import { formatQtyExact } from '../utils/formatQty';
import { dispenseSheetStatusLabel, type DispenseSheet } from './batchDispenseSheet';

const lastY = (doc: jsPDF, fallback: number): number =>
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  (doc.lastAutoTable?.finalY ?? fallback);

function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function addSheetSection(doc: jsPDF, sheet: DispenseSheet, startY: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const q = (n: number) => formatQtyExact(n, sheet.qtyKind);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${sheet.kind} DISPENSE SHEET`, margin, startY);

  autoTable(doc, {
    startY: startY + 8,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
    body: [
      [`Batch : ${sheet.batchLabel}`, `SO : ${sheet.soNo || '—'}`],
      [`Product : ${sheet.productName || '—'}`, `Site : ${sheet.site || '—'}`],
      [
        `Items : ${sheet.rows.length}${sheet.totals.shortCount > 0 ? `  (${sheet.totals.shortCount} SHORT)` : ''}`,
        `Generated : ${formatStamp(sheet.generatedAt)}`,
      ],
    ],
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: contentW * 0.6 }, 1: { cellWidth: contentW * 0.4 } },
    didParseCell: (data) => {
      // Flag the "N SHORT" summary cell red so it reads at a glance.
      if (data.row.index === 2 && data.column.index === 0 && sheet.totals.shortCount > 0) {
        data.cell.styles.textColor = [180, 30, 30];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  autoTable(doc, {
    startY: lastY(doc, startY + 40) + 8,
    head: [[
      '#', 'Code', 'Material',
      `Required\n(${sheet.unit})`, `At site\n(${sheet.unit})`, `Dispensed\n(${sheet.unit})`,
      `Balance\n(${sheet.unit})`, `Short by\n(${sheet.unit})`, 'Status',
    ]],
    body: sheet.rows.map((r) => [
      String(r.index), r.code, r.name || '—',
      q(r.required), q(r.atSite), q(r.dispensed), q(r.balance),
      r.shortageQty > 0 ? q(r.shortageQty) : '—', dispenseSheetStatusLabel(r.status),
    ]),
    foot: [[
      '', '', 'TOTAL',
      q(sheet.totals.required), q(sheet.totals.atSite), q(sheet.totals.dispensed), q(sheet.totals.balance),
      '', `${sheet.totals.shortCount} of ${sheet.rows.length} short`,
    ]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', textColor: [30, 30, 30] },
    headStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [248, 248, 248], textColor: [20, 20, 20], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'right' },
      1: { cellWidth: 48 },
      3: { cellWidth: 44, halign: 'right' },
      4: { cellWidth: 44, halign: 'right' },
      5: { cellWidth: 44, halign: 'right' },
      6: { cellWidth: 44, halign: 'right' },
      7: { cellWidth: 44, halign: 'right' },
    },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    // Short rows carry the row's own shortfall — worth flagging on the floor even without a legend.
    didParseCell: (data) => {
      const row = sheet.rows[data.row.index];
      if (row && row.status === 'short') {
        data.cell.styles.fillColor = [253, 235, 235];
        if (data.column.index === 8) data.cell.styles.textColor = [180, 30, 30];
      }
    },
  });

  let y = lastY(doc, startY + 100) + 24;
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

  return y + 40;
}

/** Build the combined RM + PM dispense sheet PDF (caller may save, preview, or print). */
export function buildBatchDispenseSheetPdfDoc(sheets: DispenseSheet[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(EI_COMPANY_LETTERHEAD.legalName, margin, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(EI_COMPANY_LETTERHEAD.addressLines.join(', '), margin, 60, { maxWidth: contentW });

  let y = 84;
  sheets.forEach((sheet, i) => {
    // Each material kind gets its own page — keeps RM and PM sheets independently printable/handed
    // off, rather than a PM table starting mid-page under an unrelated RM signature strip.
    if (i > 0) {
      doc.addPage();
      y = 60;
    }
    y = addSheetSection(doc, sheet, y);
  });

  return doc;
}

function dispenseSheetsFileBase(sheets: DispenseSheet[]): string {
  const safe = (sheets[0]?.batchLabel || 'batch').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'batch';
  const stamp = (sheets[0]?.generatedAt ?? new Date()).toISOString().slice(0, 10);
  return `dispense-sheet-${safe}-${stamp}`;
}

export function downloadBatchDispenseSheetPdf(sheets: DispenseSheet[]): void {
  buildBatchDispenseSheetPdfDoc(sheets).save(`${dispenseSheetsFileBase(sheets)}.pdf`);
}

/** Open the PDF in a new tab and hand the operator the browser's print dialog directly. */
export function printBatchDispenseSheetPdf(sheets: DispenseSheet[]): void {
  const doc = buildBatchDispenseSheetPdfDoc(sheets);
  doc.autoPrint();
  const url = doc.output('bloburl');
  const win = window.open(url as unknown as string, '_blank');
  // Popup blocked or otherwise unavailable — fall back to a normal download so the sheet isn't lost.
  if (!win) doc.save(`${dispenseSheetsFileBase(sheets)}.pdf`);
}
