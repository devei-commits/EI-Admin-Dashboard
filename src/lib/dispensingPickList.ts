/**
 * Dispensing pick list — what the operator takes to the floor.
 *
 * One row per material: what the batch needs, what has been picked (and from which racks), what
 * has actually been dispensed, and what is still outstanding. Pure functions so the numbers can be
 * tested without rendering; the view and the CSV share the same rows and therefore can't disagree.
 */
import { formatQtyExact, type QtyKind } from '../utils/formatQty';

/** One rack's contribution to a line. Mirrors DispensingPick in the production page. */
export interface PickListPick {
  packId?: number;
  packNo: string;
  qty: number;
  zone?: string;
  rack?: string;
}

export interface PickListSourceLine {
  code: string;
  inci?: string;
  name?: string;
  required: number;
  dispensed: number;
  done: boolean;
  unit?: string;
  trayContainer?: string;
  traySlot?: string;
  picks?: PickListPick[];
  // Legacy single-pick shape.
  pickedPackNo?: string;
  pickedPackQty?: number;
  pickedZone?: string;
  pickedRack?: string;
}

export interface PickListBatch {
  bmrNo?: string;
  bprNo?: string;
  batchNo?: string;
  productName?: string;
  batchSize?: number;
  soNo?: string;
  scheduledMuZone?: string;
}

export type PickListLineStatus = 'dispensed' | 'picked' | 'short-pick' | 'pending';

export interface PickListRow {
  index: number;
  code: string;
  name: string;
  required: number;
  picked: number;
  dispensed: number;
  /** Still to dispense against the requirement. */
  balance: number;
  unit: string;
  /** "ML1/DEFAULT 1.3 kg; ML1/R2 0.45 kg" — where the material is coming from. */
  sources: string;
  tray: string;
  status: PickListLineStatus;
}

export interface PickList {
  batchLabel: string;
  productName: string;
  soNo: string;
  site: string;
  kind: 'RM' | 'PM';
  qtyKind: QtyKind;
  unit: string;
  generatedAt: Date;
  rows: PickListRow[];
  totals: { required: number; picked: number; dispensed: number; balance: number };
}

/** Picks on a line, reading the legacy single-pick shape as a one-entry list. */
export function pickListPicksOf(line: PickListSourceLine): PickListPick[] {
  if (Array.isArray(line.picks) && line.picks.length > 0) return line.picks;
  if (line.pickedPackNo) {
    return [{
      packNo: line.pickedPackNo,
      qty: Number(line.pickedPackQty) || 0,
      zone: line.pickedZone,
      rack: line.pickedRack,
    }];
  }
  return [];
}

function rowStatus(required: number, picked: number, dispensed: number, done: boolean): PickListLineStatus {
  if (done || dispensed >= required - 1e-9) return 'dispensed';
  if (picked <= 1e-9) return 'pending';
  return picked >= required - 1e-9 ? 'picked' : 'short-pick';
}

export function buildDispensingPickList(
  batch: PickListBatch,
  lines: PickListSourceLine[] | undefined,
  kind: 'RM' | 'PM',
  opts: { siteLabel?: string; generatedAt?: Date; nameByCode?: Record<string, string> } = {},
): PickList {
  const qtyKind: QtyKind = kind === 'RM' ? 'kg' : 'pcs';
  const unit = kind === 'RM' ? 'KG' : 'PCS';
  const rows: PickListRow[] = (lines ?? []).map((line, i) => {
    const picks = pickListPicksOf(line);
    const picked = picks.reduce((s, p) => s + (Number(p.qty) || 0), 0);
    const required = Number(line.required) || 0;
    const dispensed = Number(line.dispensed) || 0;
    const sources = picks
      .map((p) => {
        const where = [p.zone, p.rack].map((x) => String(x ?? '').trim()).filter(Boolean).join('/');
        return `${where || p.packNo} ${formatQtyExact(p.qty, qtyKind)} ${line.unit || unit}`;
      })
      .join('; ');
    const tray = [line.trayContainer, line.traySlot].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
    return {
      index: i + 1,
      code: String(line.code ?? '').trim(),
      name: String(line.inci || line.name || opts.nameByCode?.[String(line.code ?? '').trim()] || '').trim(),
      required,
      picked,
      dispensed,
      balance: Math.max(0, required - dispensed),
      unit: line.unit || unit,
      sources,
      tray,
      status: rowStatus(required, picked, dispensed, line.done === true),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      required: acc.required + r.required,
      picked: acc.picked + r.picked,
      dispensed: acc.dispensed + r.dispensed,
      balance: acc.balance + r.balance,
    }),
    { required: 0, picked: 0, dispensed: 0, balance: 0 },
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

const PICK_LIST_STATUS_LABEL: Record<PickListLineStatus, string> = {
  dispensed: 'Dispensed',
  picked: 'Picked — ready',
  'short-pick': 'Short pick',
  pending: 'Pending pick',
};

export function pickListStatusLabel(status: PickListLineStatus): string {
  return PICK_LIST_STATUS_LABEL[status];
}

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Spreadsheet-ready CSV: a short batch preamble, then the table, then a totals row. */
export function dispensingPickListCsv(list: PickList): string {
  const q = (n: number) => formatQtyExact(n, list.qtyKind);
  const preamble = [
    ['Pick list', `${list.kind} dispensing`],
    ['Batch', list.batchLabel],
    ['Product', list.productName],
    ['SO', list.soNo],
    ['Manufacturing site', list.site],
    ['Generated', list.generatedAt.toLocaleString()],
  ].map((r) => r.map(csvCell).join(','));

  const header = ['#', 'Code', 'Material', `Required (${list.unit})`, `Picked (${list.unit})`,
    `Dispensed (${list.unit})`, `Balance (${list.unit})`, 'Picked from', 'Tray', 'Status'];

  const body = list.rows.map((r) => [
    r.index, r.code, r.name, q(r.required), q(r.picked), q(r.dispensed), q(r.balance),
    r.sources, r.tray, pickListStatusLabel(r.status),
  ].map(csvCell).join(','));

  const totals = ['', '', 'TOTAL', q(list.totals.required), q(list.totals.picked),
    q(list.totals.dispensed), q(list.totals.balance), '', '', `${list.rows.length} items`]
    .map(csvCell).join(',');

  return [...preamble, '', header.map(csvCell).join(','), ...body, totals].join('\n');
}

export function pickListFileName(list: PickList): string {
  const safe = list.batchLabel.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'batch';
  return `pick-list-${list.kind.toLowerCase()}-${safe}-${list.generatedAt.toISOString().slice(0, 10)}.csv`;
}

/** Download the pick list as CSV (same Blob approach as the app's other exports). */
export function downloadDispensingPickList(list: PickList): void {
  const blob = new Blob([dispensingPickListCsv(list)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pickListFileName(list);
  a.click();
  URL.revokeObjectURL(url);
}
