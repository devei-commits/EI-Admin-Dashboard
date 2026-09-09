/**
 * Batch dispense sheet — the printable "what's needed, what's at site, what's short" summary for a
 * batch's RM (or PM) requirement, as of the moment it's generated.
 *
 * Distinct from `dispensingPickList.ts` (which tracks pick/dispense progress against a requirement):
 * this compares the requirement straight against *live at-site stock* (the same `atSiteByCode` feed
 * the RM/PM Dispensing tray uses), so a row this sheet calls "Short" is a row the tray would also
 * refuse to let you dispense right now. Pure functions so the numbers can be tested without
 * rendering; the on-screen table, the PDF, and the CSV all read from the same rows.
 */
import { materialQtyToNum } from '../utils/materialQtyCompare';
import { formatQtyExact, type QtyKind } from '../utils/formatQty';

export interface DispenseSheetSourceLine {
  code: string;
  inci?: string;
  name?: string;
  required: number;
  dispensed?: number;
  done?: boolean;
}

export interface DispenseSheetBatch {
  bmrNo?: string;
  bprNo?: string;
  batchNo?: string;
  productName?: string;
  batchSize?: number;
  soNo?: string;
  scheduledMuZone?: string;
}

export type DispenseSheetLineStatus = 'dispensed' | 'short' | 'ready';

export interface DispenseSheetRow {
  index: number;
  code: string;
  name: string;
  required: number;
  /** Live at-site stock for this code, as of generation time — same feed the dispensing tray reads. */
  atSite: number;
  dispensed: number;
  /** Still to dispense against the requirement. */
  balance: number;
  /** How much of the remaining balance the site can't currently cover. 0 unless status is 'short'. */
  shortageQty: number;
  unit: string;
  status: DispenseSheetLineStatus;
}

export interface DispenseSheet {
  batchLabel: string;
  productName: string;
  soNo: string;
  site: string;
  kind: 'RM' | 'PM';
  qtyKind: QtyKind;
  unit: string;
  generatedAt: Date;
  rows: DispenseSheetRow[];
  totals: { required: number; atSite: number; dispensed: number; balance: number; shortCount: number };
}

function rowStatus(balance: number, atSite: number, done: boolean): DispenseSheetLineStatus {
  if (done || balance <= 1e-9) return 'dispensed';
  return atSite + 1e-9 < balance ? 'short' : 'ready';
}

export function buildBatchDispenseSheet(
  batch: DispenseSheetBatch,
  lines: DispenseSheetSourceLine[] | undefined,
  atSiteByCode: Record<string, string | number> | undefined,
  kind: 'RM' | 'PM',
  opts: { siteLabel?: string; generatedAt?: Date; nameByCode?: Record<string, string> } = {},
): DispenseSheet {
  const qtyKind: QtyKind = kind === 'RM' ? 'kg' : 'pcs';
  const unit = kind === 'RM' ? 'KG' : 'PCS';
  const rows: DispenseSheetRow[] = (lines ?? []).map((line, i) => {
    const code = String(line.code ?? '').trim();
    const required = Number(line.required) || 0;
    const dispensed = Number(line.dispensed) || 0;
    const balance = Math.max(0, required - dispensed);
    const atSite = code in (atSiteByCode ?? {}) ? materialQtyToNum(atSiteByCode![code]) : 0;
    const done = line.done === true;
    const status = rowStatus(balance, atSite, done);
    return {
      index: i + 1,
      code,
      name: String(line.inci || line.name || opts.nameByCode?.[code] || '').trim(),
      required,
      atSite,
      dispensed,
      balance,
      shortageQty: status === 'short' ? Math.max(0, balance - atSite) : 0,
      unit,
      status,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      required: acc.required + r.required,
      atSite: acc.atSite + r.atSite,
      dispensed: acc.dispensed + r.dispensed,
      balance: acc.balance + r.balance,
      shortCount: acc.shortCount + (r.status === 'short' ? 1 : 0),
    }),
    { required: 0, atSite: 0, dispensed: 0, balance: 0, shortCount: 0 },
  );

  const batchLabel = String(batch.batchNo || batch.bmrNo || '').trim() || '—';
  return {
    batchLabel: batch.bmrNo && batch.batchNo && batch.bmrNo !== batch.batchNo
      ? `${batch.batchNo} · ${batch.bmrNo}`
      : batchLabel,
    productName: String(batch.productName ?? '').trim(),
    soNo: String(batch.soNo ?? '').trim(),
    site: String(opts.siteLabel || batch.scheduledMuZone || '').trim(),
    kind,
    qtyKind,
    unit,
    generatedAt: opts.generatedAt ?? new Date(),
    rows,
    totals,
  };
}

const DISPENSE_SHEET_STATUS_LABEL: Record<DispenseSheetLineStatus, string> = {
  dispensed: 'Dispensed',
  short: 'Short',
  ready: 'OK — ready to dispense',
};

export function dispenseSheetStatusLabel(status: DispenseSheetLineStatus): string {
  return DISPENSE_SHEET_STATUS_LABEL[status];
}

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Spreadsheet-ready CSV: a short batch preamble, then the table, then a totals row. */
export function dispenseSheetCsv(sheet: DispenseSheet): string {
  const q = (n: number) => formatQtyExact(n, sheet.qtyKind);
  const preamble = [
    ['Dispense sheet', `${sheet.kind}`],
    ['Batch', sheet.batchLabel],
    ['Product', sheet.productName],
    ['SO', sheet.soNo],
    ['Manufacturing site', sheet.site],
    ['Generated', sheet.generatedAt.toLocaleString()],
  ].map((r) => r.map(csvCell).join(','));

  const header = ['#', 'Code', 'Material', `Required (${sheet.unit})`, `At site (${sheet.unit})`,
    `Dispensed (${sheet.unit})`, `Balance (${sheet.unit})`, `Short by (${sheet.unit})`, 'Status'];

  const body = sheet.rows.map((r) => [
    r.index, r.code, r.name, q(r.required), q(r.atSite), q(r.dispensed), q(r.balance),
    r.shortageQty > 0 ? q(r.shortageQty) : '', dispenseSheetStatusLabel(r.status),
  ].map(csvCell).join(','));

  const totals = ['', '', 'TOTAL', q(sheet.totals.required), q(sheet.totals.atSite),
    q(sheet.totals.dispensed), q(sheet.totals.balance), `${sheet.totals.shortCount} short`, `${sheet.rows.length} items`]
    .map(csvCell).join(',');

  return [...preamble, '', header.map(csvCell).join(','), ...body, totals].join('\n');
}

export function dispenseSheetFileName(sheet: DispenseSheet): string {
  const safe = sheet.batchLabel.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'batch';
  return `dispense-sheet-${sheet.kind.toLowerCase()}-${safe}-${sheet.generatedAt.toISOString().slice(0, 10)}.csv`;
}

/** Download the dispense sheet as CSV (same Blob approach as the app's other exports). */
export function downloadDispenseSheet(sheet: DispenseSheet): void {
  const blob = new Blob([dispenseSheetCsv(sheet)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dispenseSheetFileName(sheet);
  a.click();
  URL.revokeObjectURL(url);
}
