/**
 * Batch RM/PM dispensing progress — pure helpers for the Dispensing & Tray tab.
 */

export interface DispensingLineLike {
  code: string;
  inci?: string;
  name?: string;
  required: number;
  dispensed: number;
  done: boolean;
  trayContainer?: string;
  traySlot?: string;
  container?: string;
  slot?: string;
  tray_id?: string;
  dispensedAt?: string;
  dispensed_at?: string;
}

export interface MuDispensingBundleLike {
  at: string;
  rm?: { code: string; qty: number }[];
  pm?: { code: string; qty: number }[];
}

export interface DispensingTrayBatchContext {
  batchNo: string;
  mainVessel?: string;
  fillingLine?: string;
  muDispensingBundles?: MuDispensingBundleLike[];
}

export type DispensingLineStatus = 'pending' | 'partial' | 'done';

export interface DispensingLineSummary {
  code: string;
  label: string;
  required: number;
  dispensed: number;
  done: boolean;
  status: DispensingLineStatus;
}

export interface DispensingLineTrayDetail extends DispensingLineSummary {
  trayLabel: string;
  statusText: string;
  unit: string;
}

export type DispensingPhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'na';

export interface DispensingPhaseProgress {
  done: number;
  partial: number;
  dispensed: number;
  total: number;
  pct: number;
  status: DispensingPhaseStatus;
}

export interface BatchDispensingSummary {
  rmLines: DispensingLineSummary[];
  pmLines: DispensingLineSummary[];
  rm: DispensingPhaseProgress;
  pm: DispensingPhaseProgress;
  hasAnyDispensingActivity: boolean;
}

export type DispensingTrayFilter = 'all' | 'rm_pending' | 'rm_done' | 'pm_pending' | 'pm_done' | 'active';

function roundPct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function formatDispensingTrayTimestamp(iso: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace('T', ' ');
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return `${date} ${time}`;
}

function trayContainerFromLine(line: DispensingLineLike): string {
  return String(line.trayContainer || line.container || line.tray_id || '').trim();
}

function traySlotFromLine(line: DispensingLineLike): string {
  return String(line.traySlot || line.slot || '').trim();
}

function dispensedAtFromLine(line: DispensingLineLike): string {
  return String(line.dispensedAt || line.dispensed_at || '').trim();
}

function lookupDispensedAtFromBundles(
  code: string,
  kind: 'rm' | 'pm',
  bundles: MuDispensingBundleLike[] | undefined,
): string {
  const list = Array.isArray(bundles) ? [...bundles].reverse() : [];
  for (const bundle of list) {
    const lines = kind === 'rm' ? bundle.rm : bundle.pm;
    if (!Array.isArray(lines)) continue;
    if (lines.some((l) => l.code === code && (Number(l.qty) || 0) > 0)) {
      return bundle.at || '';
    }
  }
  return '';
}

export function getDispensingLineStatus(line: Pick<DispensingLineLike, 'required' | 'dispensed' | 'done'>): DispensingLineStatus {
  if (line.done) return 'done';
  const dispensed = Number(line.dispensed) || 0;
  if (dispensed > 0) return 'partial';
  return 'pending';
}

export function countDispensedTrayLines(lines: DispensingLineSummary[]): number {
  return lines.filter((l) => l.status !== 'pending').length;
}

export function summarizeDispensingLines(lines: DispensingLineLike[] | undefined): DispensingLineSummary[] {
  return (lines ?? []).map((line) => ({
    code: line.code,
    label: String(line.inci || line.name || line.code || '').trim() || line.code,
    required: Number(line.required) || 0,
    dispensed: Number(line.dispensed) || 0,
    done: Boolean(line.done),
    status: getDispensingLineStatus(line),
  }));
}

export function buildDispensingLineTrayDetail(
  line: DispensingLineLike,
  summary: DispensingLineSummary,
  kind: 'rm' | 'pm',
  batch: DispensingTrayBatchContext,
): DispensingLineTrayDetail {
  const unit = kind === 'rm' ? 'KG' : 'units';
  const hasActivity = summary.status !== 'pending';
  let container = trayContainerFromLine(line);
  let slot = traySlotFromLine(line);

  if (!container && hasActivity) {
    container = kind === 'rm'
      ? String(batch.mainVessel || 'RM Tray').trim()
      : String(batch.fillingLine || 'PM Tray').trim();
  }
  if (!slot && hasActivity) {
    slot = `${batch.batchNo}/A`;
  }

  const trayLabel = hasActivity && container
    ? `${container}${slot ? ` · ${slot}` : ''}`
    : '— · pending';

  let statusText = 'pending';
  if (summary.status === 'done') {
    const at = dispensedAtFromLine(line) || lookupDispensedAtFromBundles(line.code, kind, batch.muDispensingBundles);
    statusText = at ? `✓ ${formatDispensingTrayTimestamp(at)}` : '✓ done';
  } else if (summary.status === 'partial') {
    statusText = 'partial';
  }

  return {
    ...summary,
    trayLabel,
    statusText,
    unit,
  };
}

export function enrichDispensingTrayDetails(
  lines: DispensingLineLike[] | undefined,
  kind: 'rm' | 'pm',
  batch: DispensingTrayBatchContext,
): DispensingLineTrayDetail[] {
  const summaries = summarizeDispensingLines(lines);
  return (lines ?? []).map((line, idx) => buildDispensingLineTrayDetail(line, summaries[idx], kind, batch));
}

export function summarizeDispensingPhase(lines: DispensingLineSummary[]): DispensingPhaseProgress {
  if (lines.length === 0) {
    return { done: 0, partial: 0, dispensed: 0, total: 0, pct: 0, status: 'na' };
  }
  const done = lines.filter((l) => l.status === 'done').length;
  const partial = lines.filter((l) => l.status === 'partial').length;
  const dispensed = countDispensedTrayLines(lines);
  const total = lines.length;
  let status: DispensingPhaseStatus = 'not_started';
  if (done === total) status = 'complete';
  else if (dispensed > 0) status = 'in_progress';
  return { done, partial, dispensed, total, pct: roundPct(dispensed, total), status };
}

export function summarizeBatchDispensing(
  dispensingRM: DispensingLineLike[] | undefined,
  dispensingPM: DispensingLineLike[] | undefined,
): BatchDispensingSummary {
  const rmLines = summarizeDispensingLines(dispensingRM);
  const pmLines = summarizeDispensingLines(dispensingPM);
  const rm = summarizeDispensingPhase(rmLines);
  const pm = summarizeDispensingPhase(pmLines);
  const hasAnyDispensingActivity =
    rmLines.some((l) => l.status !== 'pending')
    || pmLines.some((l) => l.status !== 'pending');
  return { rmLines, pmLines, rm, pm, hasAnyDispensingActivity };
}

export function getDispensingStageLabel(
  bmrStatus: string,
  bprStatus: string,
  summary: BatchDispensingSummary,
): string {
  const rmOpen = summary.rm.total > 0 && summary.rm.status !== 'complete';
  const pmOpen = summary.pm.total > 0 && summary.pm.status !== 'complete';
  if (rmOpen && pmOpen) return 'Dispense (RM+PM)';
  if (bmrStatus === 'dispensing' || bprStatus === 'pm_dispensing') {
    if (rmOpen && pmOpen) return 'Dispense (RM+PM)';
    if (rmOpen) return 'RM Dispensing';
    if (pmOpen) return 'PM Dispensing';
  }
  if (rmOpen) return 'RM Dispensing';
  if (pmOpen) return 'PM Dispensing';
  if (summary.rm.status === 'complete' && summary.pm.status === 'complete') return 'Dispensing complete';
  if (summary.rm.status === 'complete') return 'RM complete · PM pending';
  if (summary.pm.status === 'complete') return 'PM complete · RM pending';
  return 'Dispensing';
}

export interface DispensingTrayBatchLike {
  bmrNo: string;
  bprNo: string;
  productName: string;
  soNo: string;
  batchNo: string;
  batchSize?: number;
  scheduledMuZone?: string;
  bmrStatus: string;
  bprStatus: string;
  mainVessel?: string;
  fillingLine?: string;
  muDispensingBundles?: MuDispensingBundleLike[];
  dispensingRM?: DispensingLineLike[];
  dispensingPM?: DispensingLineLike[];
}

/** Batches relevant to the Dispensing & Tray tab (lines loaded or past connect/dispense steps). */
export function isBatchOnDispensingTray(batch: DispensingTrayBatchLike): boolean {
  const rmCount = batch.dispensingRM?.length ?? 0;
  const pmCount = batch.dispensingPM?.length ?? 0;
  if (rmCount > 0 || pmCount > 0) return true;
  const bmrDispense = ['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
  const bprDispense = ['pm_connected', 'pm_dispensing', 'scheduled', 'filling', 'fill_qc', 'packaging', 'pack_qc', 'fg_ready'];
  return bmrDispense.includes(batch.bmrStatus) || bprDispense.includes(batch.bprStatus);
}

export function batchMatchesDispensingTrayFilter(
  summary: BatchDispensingSummary,
  filter: DispensingTrayFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') {
    return summary.rm.status === 'in_progress' || summary.pm.status === 'in_progress';
  }
  if (filter === 'rm_pending') {
    return summary.rm.total > 0 && summary.rm.status !== 'complete';
  }
  if (filter === 'rm_done') {
    return summary.rm.status === 'complete';
  }
  if (filter === 'pm_pending') {
    return summary.pm.total > 0 && summary.pm.status !== 'complete';
  }
  if (filter === 'pm_done') {
    return summary.pm.status === 'complete';
  }
  return true;
}

export function batchTrayContext(batch: DispensingTrayBatchLike): DispensingTrayBatchContext {
  return {
    batchNo: batch.batchNo,
    mainVessel: batch.mainVessel,
    fillingLine: batch.fillingLine,
    muDispensingBundles: batch.muDispensingBundles,
  };
}
