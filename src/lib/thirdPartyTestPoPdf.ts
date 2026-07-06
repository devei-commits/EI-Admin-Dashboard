/**
 * 3rd-party lab test PO PDF — Zoho-style tax document layout (jsPDF + autotable).
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  EI_COMPANY_LETTERHEAD,
  THIRD_PARTY_LAB_GST_RATE,
  THIRD_PARTY_LAB_TEST_SAC,
} from '../constants/eiCompanyLetterhead';
import { indianRupeesInWords } from './indianRupeesInWords';
import {
  formatThirdPartySampleQtyLine,
  type ThirdPartyPoPreviewInput,
} from './thirdPartyLabTest';

const lastY = (doc: jsPDF, fallback: number): number =>
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance
  (doc.lastAutoTable?.finalY ?? fallback);

function formatPdfDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fiscalYearLabel(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  const endShort = String(startYear + 1).slice(-2);
  const startShort = String(startYear).slice(-2);
  return `FY${startShort}${endShort}`;
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gstSplit(subTotal: number, ratePct: number): { cgst: number; sgst: number } {
  const half = (subTotal * ratePct) / 100 / 2;
  return {
    cgst: Math.round(half * 100) / 100,
    sgst: Math.round(half * 100) / 100,
  };
}

/** Build the PO PDF document (caller may save, preview, or export). */
export function buildThirdPartyTestPoPdfDoc(input: ThirdPartyPoPreviewInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageW - margin * 2;

  const poDate = formatPdfDate(input.poDate);
  const pickup = formatPdfDate(input.pickupDate);
  const reportDue = formatPdfDate(input.expectedReportDate);
  const approver = input.qcApprover?.trim() || 'QA Head';
  const sampleLine = formatThirdPartySampleQtyLine(input.sampleQty, input.sampleNote);
  const subTotal = input.sampleQty * input.pricePerSample;
  const gstHalf = THIRD_PARTY_LAB_GST_RATE / 2;
  const { cgst, sgst } = gstSplit(subTotal, THIRD_PARTY_LAB_GST_RATE);
  const totalBeforeRound = subTotal + cgst + sgst;
  const total = Math.round(totalBeforeRound);
  const rounding = Math.round((total - totalBeforeRound) * 100) / 100;

  const itemDescription = [
    input.testParameter,
    `${input.itemName}`,
    input.itemCode,
    `Method: ${input.testMethod}`,
    `Spec: ${input.specLimit}`,
    `Sample: ${sampleLine}`,
  ].join('\n');

  const shipToLines = [
    'Esthetic Insights — Quality Team',
    `Sample pickup: ${input.warehouseLabel}`,
    `Pickup date: ${pickup}`,
    EI_COMPANY_LETTERHEAD.qualityEmail,
    EI_COMPANY_LETTERHEAD.phone,
  ].join('\n');

  const billToLines = [
    input.vendorName,
    input.vendorCode,
    input.vendorCity ? `${input.vendorCity}` : '',
    'Attn: Sample Reception Desk',
  ]
    .filter(Boolean)
    .join('\n');

  // ── Letterhead ──
  let y = 40;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${EI_COMPANY_LETTERHEAD.legalName} ${fiscalYearLabel(input.poDate)}`, margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const line of EI_COMPANY_LETTERHEAD.addressLines) {
    doc.text(line, margin, y);
    y += 11;
  }
  doc.text(EI_COMPANY_LETTERHEAD.phone, margin, y);
  y += 11;
  doc.text(`GSTIN: ${EI_COMPANY_LETTERHEAD.gstin}`, margin, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('3RD-PARTY TEST PURCHASE ORDER', pageW / 2, y, { align: 'center' });
  y += 18;

  // ── Document meta (invoice-style header row) ──
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 3, textColor: [30, 30, 30] },
    body: [
      [
        `# : ${input.poNo}`,
        `PO Date : ${poDate}`,
        `Terms : ${input.paymentTerms}`,
        `Report Due : ${reportDue}`,
      ],
      [
        `Linked QC : ${input.qcRef}`,
        `GRN Ref : ${input.grnNo}`,
        `Place Of Supply : ${EI_COMPANY_LETTERHEAD.placeOfSupply}`,
        input.materialVendor ? `Material Vendor : ${input.materialVendor}` : '',
      ],
    ],
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: contentW * 0.26 },
      1: { cellWidth: contentW * 0.24 },
      2: { cellWidth: contentW * 0.24 },
      3: { cellWidth: contentW * 0.26 },
    },
  });

  y = lastY(doc, y) + 10;

  // ── Bill To / Ship To ──
  autoTable(doc, {
    startY: y,
    head: [['Bill To', 'Ship To']],
    body: [[billToLines, shipToLines]],
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: { fontSize: 8, valign: 'top', cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: contentW / 2 },
      1: { cellWidth: contentW / 2 },
    },
  });

  y = lastY(doc, y) + 8;

  // ── Line items (tax invoice column layout) ──
  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: '#', rowSpan: 2 },
        { content: 'Item & Description', rowSpan: 2 },
        { content: 'HSN/SAC', rowSpan: 2 },
        { content: 'Qty', rowSpan: 2 },
        { content: 'Rate', rowSpan: 2 },
        { content: 'CGST', colSpan: 2 },
        { content: 'SGST', colSpan: 2 },
        { content: 'Amount', rowSpan: 2 },
      ],
      ['%', 'Amt', '%', 'Amt'],
    ],
    body: [
      [
        '1',
        itemDescription,
        THIRD_PARTY_LAB_TEST_SAC,
        `${input.sampleQty.toFixed(2)}\nSMP`,
        formatAmount(input.pricePerSample),
        `${gstHalf}%`,
        formatAmount(cgst),
        `${gstHalf}%`,
        formatAmount(sgst),
        formatAmount(subTotal),
      ],
    ],
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: { fontSize: 7.5, valign: 'top', cellPadding: 4 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { cellWidth: 150 },
      2: { halign: 'center', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 34 },
      4: { halign: 'right', cellWidth: 38 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 34 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'right', cellWidth: 34 },
      9: { halign: 'right', cellWidth: 48 },
    },
  });

  y = lastY(doc, y) + 12;

  const notes = [
    'Please perform the enclosed test(s) and return the COA / test report by the expected date.',
    'Kindly acknowledge sample receipt by email.',
    `Reference: ${input.qcRef} · ${input.grnNo}`,
    `Authorised by: ${approver}`,
  ].join('\n');

  const summaryX = pageW - margin - 170;
  const summaryRows: Array<[string, string]> = [
    ['Sub Total', formatAmount(subTotal)],
    [`CGST${gstHalf} (${gstHalf}%)`, formatAmount(cgst)],
    [`SGST${gstHalf} (${gstHalf}%)`, formatAmount(sgst)],
  ];
  if (rounding !== 0) {
    summaryRows.push(['Rounding', formatAmount(rounding)]);
  }
  summaryRows.push(['Total', `₹${formatAmount(total)}`]);
  summaryRows.push(['Balance Due', `₹${formatAmount(total)}`]);

  // ── Footer: words + notes (left), totals (right) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Total In Words', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const words = doc.splitTextToSize(indianRupeesInWords(total), contentW * 0.55) as string[];
  doc.text(words, margin, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Notes', margin, y + 12 + words.length * 10 + 8);
  doc.setFont('helvetica', 'normal');
  const noteLines = doc.splitTextToSize(notes, contentW * 0.55) as string[];
  doc.text(noteLines, margin, y + 12 + words.length * 10 + 20);

  let summaryY = y;
  doc.setFontSize(8);
  for (const [label, value] of summaryRows) {
    const isTotal = label === 'Total' || label === 'Balance Due';
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.text(label, summaryX, summaryY, { align: 'left' });
    doc.text(value, pageW - margin, summaryY, { align: 'right' });
    summaryY += isTotal ? 14 : 12;
  }

  const footerY = Math.max(y + 12 + words.length * 10 + 20 + noteLines.length * 10, summaryY) + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Auto-generated · Quality → 3rd-Party Test · ${input.poNo} · ${poDate}`,
    margin,
    footerY,
  );

  return doc;
}

export function createThirdPartyTestPoPdfBlobUrl(input: ThirdPartyPoPreviewInput): string {
  const doc = buildThirdPartyTestPoPdfDoc(input);
  const blob = doc.output('blob') as Blob;
  return URL.createObjectURL(blob);
}

export function generateThirdPartyTestPoPdf(input: ThirdPartyPoPreviewInput): void {
  const doc = buildThirdPartyTestPoPdfDoc(input);
  doc.save(`${input.poNo.replace(/\s/g, '_')}.pdf`);
}
