/**
 * Production Page — Manufacturing Management System
 * BMR: draft > batch_confirmed > rm_reserved > scheduled > rm_connected > dispensing > in_production > bulk_qc > cleared
 * BPR: draft > pm_reserved > pm_connected > pm_dispensing > scheduled > filling > fill_qc > packaging > pack_qc > fg_ready
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import eiLogo from '../assets/logo/eilogofull.svg';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, FlaskConical, Package,
  Wrench, Users, Menu, X, Check, AlertTriangle, Printer,
  ClipboardList, Link2, Scale, Microscope, Zap, Info, Factory,
  Settings, Activity, Eye, CheckCircle2, ArrowRight, Send,
  ShieldCheck, Sparkles, Droplets, CircleDot, Layers, Cylinder, Pencil, RotateCcw,
  Truck, Search,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  fetchEquipment, fetchTeam, fetchBatches, syncBatchesFromPlanning,
  updateBatch as apiBatchUpdate,
  createRworkBatch as apiCreateRworkBatch,
  createEquipment as apiCreateEquipment,
  updateEquipment as apiUpdateEquipment,
  deleteEquipment as apiDeleteEquipment,
  createTeamMember as apiCreateTeamMember,
  updateTeamMember as apiUpdateTeamMember,
  deleteTeamMember as apiDeleteTeamMember,
  searchUsers as apiSearchUsers,
  type EquipmentData as APIEquipmentData, type BatchRow, type TeamMemberRow,
  type UserSearchResult,
  type CreateReworkOptions,
  type QcReferencePayload,
  type QCSpec,
  type QcSpecsStored,
  type QcSpecsByScope,
} from '../services/production.service';
import {
  fetchFacilityAreas,
  ensureCustomZoneAndRack,
  type FacilityAreaDTO,
  type ZoneDTO,
} from '../services/facilityAreas.service';
import { fetchWarehouseInventory, type WarehouseInventoryRow } from '../services/warehouseInventory.service';
import { fetchDepartments } from '../services/department.service';
import { fetchSalesOrders } from '../services/salesPurchase.service';
import {
  fetchPlanningExtractedList,
  fetchItemsInvolvedByPlanningId,
  fetchSentBatchSummary,
  fetchAllBatches,
  type SentBatchSummaryRow,
  type ItemsInvolvedForPiRow,
} from '../services/planningExtracted.service';
import {
  createMRN, fetchMRNList, fetchMRNById, updateMRN, getApiErrorMessage, fetchMRNAssignablePickers, generateMRNLabels, fetchMRNLocationHistory,
  type MRNRecordFromApi, type GeneratedMRNLabel, type MRNLocationHistoryEntry, type AssignablePicker as MRNAssignablePicker,
} from '../services/mrn.service';
import { fetchPRProducts } from '../services/productsMaster.service';
import { fetchBOMByProductId, type BOMRecord, type BOMRmLine, type BOMPmLine } from '../services/bom.service';
import { fetchBOMByBatchId } from '../services/production.service';
import {
  addDaysToDateStr,
  isEquipmentFreeOnDate as isEquipFreeOnDateLib,
  getEquipDisplayName,
  computeBestScheduleRecommendation,
  computeRecommendedScheduleForSlot,
  computeRmVolumeBreakdown,
  computeVolumeFromBomRmLines,
  isBatchMaterialsAvailable,
  getFillLineCapacityUsedOnDate,
  getFillLineRemainingCapacity,
  getFillLineDailyCapacity,
  getPackLineCapacityUsedOnDate,
  getPackLineRemainingCapacity,
  getPackLineDailyCapacity,
  DEFAULT_WORKING_HOURS_PER_DAY,
  type ScheduleRecommendationResult,
} from '../lib/productionScheduleMath';

/* ─────────────────────────── TYPES ─────────────────────────── */

type Section = 'calendar' | 'bmr' | 'bpr' | 'yield-report' | 'equipment' | 'team' | 'transfers';
export type ScheduleSlot = { equipId: string; category: 'mfg' | 'fill' | 'pack'; dateIso: string };
type BMRStatus = 'draft' | 'batch_confirmed' | 'rm_reserved' | 'scheduled' | 'rm_connected' | 'dispensing' | 'in_production' | 'bulk_qc' | 'qc_failed' | 'cleared';
type BPRStatus = 'draft' | 'pm_reserved' | 'scheduled' | 'pm_connected' | 'pm_dispensing' | 'filling' | 'fill_qc' | 'packaging' | 'pack_qc' | 'qc_failed' | 'fg_ready';
type ProcessType = 'hot' | 'cold';
type FillingType = 'bottle' | 'tube' | 'jar' | 'manual';
type Department = 'Manufacturing' | 'Filling' | 'Packaging' | 'Quality';

interface DispensingItem { code: string; inci?: string; name?: string; required: number; dispensed: number; done: boolean; }

interface MfgEquipment { id: string; name: string; cap: number; type: 'jacketed' | 'simple' | 'support'; homogenizer: boolean; processType: ProcessType[]; status: string; _pk?: number; }
interface FillingEquipment { id: string; name: string; speed: number; type: FillingType; compatible: string[]; status: string; _pk?: number; }
interface PackagingEquipment { id: string; name: string; speed: number; type: string; supports: string[]; status: string; _pk?: number; }

interface EquipmentData {
  manufacturing: MfgEquipment[];
  filling: FillingEquipment[];
  packaging: PackagingEquipment[];
}

interface TeamMember { id: string; userId: number | null; name: string; role: string; dept: Department; avail: boolean; _pk?: number; }

interface Batch {
  bmrNo: string; bprNo: string; productName: string; sku: string; soNo: string; orderQty: number;
  batchSize: number; batchNo: string; batchIndex: number; totalBatches: number;
  bmrStatus: BMRStatus; bprStatus: BPRStatus; color: string;
  processType: ProcessType; homogenizer: boolean;
  mainVessel: string; supportingTanks: string[];
  fillingLine: string; fillingType: FillingType; packagingLine: string; monocarton: boolean; shrink: boolean;
  teamBMR: string[]; teamBPR: string[]; qcOfficerBMR: string; qcOfficerBPR: string;
  mfgDate: string; fillDate: string; packDate: string; fgDate: string; rmConnectDate: string; pmConnectDate: string;
  rmReserved: boolean; pmReserved: boolean; rmConnected: boolean; pmConnected: boolean;
  dispensingRM: DispensingItem[]; dispensingPM: DispensingItem[];
  bulkYield: number | null; fillYield: number | null; fgYield: number | null;
  bulkBatchAccepted: boolean | null; fillBatchAccepted: boolean | null; fgBatchAccepted: boolean | null;
  qcSpecs: QcSpecsStored; remarks: string; dueDate: string;
  compatibleVessels?: string[]; compatibleFillLines?: string[]; compatiblePackLines?: string[];
  requiredVolumeLiters?: number | null;
  /** Production batch DB id — required for loading batch-specific BOM (planning_batches) in Reserve RM/PM. */
  _pk?: number;
  /** When set, batch is linked to planning; can be used as base for creating rework batch (BMR-*-rw-01). */
  planningBatchId?: number | null;
  /** Latest bundle id for RM+PM quantities consumed from MU in one save. */
  muDispensingBundleId?: string | null;
  /** Snapshots: each save that consumes stock appends { bundleId, PRs, rm[], pm[] }. */
  muDispensingBundles?: Array<{
    bundleId: string;
    at: string;
    procurementRequests: { id: number; planningBatchId: number | null; status: string | null }[];
    rm: { code: string; qty: number }[];
    pm: { code: string; qty: number }[];
  }>;
}

interface PipelineStep { key: string; label: string; icon: React.ReactNode; }

interface ProductionState {
  batches: Batch[];
  equipment: EquipmentData;
  team: TeamMember[];
  lastUpdated: string;
}

/** Units to fill/pack for this batch (from order qty split across batches). Used for FL/PL capacity scheduling. */
function getBatchFillPackUnits(b: Batch): { fillUnitsRequired: number; packUnitsRequired: number } {
  const total = (b.totalBatches && b.totalBatches > 0) ? b.totalBatches : 1;
  const units = Math.ceil((b.orderQty ?? 0) / total);
  return { fillUnitsRequired: units, packUnitsRequired: units };
}

/** BPR scheduling context: planned batch size vs actual bulk from BMR QC (when recorded). */
function ScheduleYieldContextBanner({ batch }: { batch: Batch }) {
  const plannedKg = batch.batchSize;
  const bulk = batch.bulkYield != null ? Number(batch.bulkYield) : NaN;
  const hasBulk = Number.isFinite(bulk) && bulk > 0;
  const bmrCleared = batch.bmrStatus === 'cleared';
  const fillY = batch.fillYield != null ? Number(batch.fillYield) : NaN;
  const hasFill = Number.isFinite(fillY) && fillY > 0;
  const fgY = batch.fgYield != null ? Number(batch.fgYield) : NaN;
  const hasFg = Number.isFinite(fgY) && fgY > 0;
  return (
    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5 mb-4 text-[11px] text-slate-700">
      <div className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] mb-1.5">Bulk &amp; BPR yields (for scheduling)</div>
      <p className="mb-2">
        <span className="text-slate-500">Planned batch size:</span>{' '}
        <b>{plannedKg} KG</b>
        {hasBulk ? (
          <>
            {' · '}
            <span className="text-slate-500">Actual bulk (BMR QC):</span>{' '}
            <b className="text-indigo-800">{bulk} KG</b>
            {!bmrCleared && <span className="text-amber-700 font-medium"> (recorded; BMR not cleared yet)</span>}
          </>
        ) : (
          <>
            {' · '}
            <span className="text-amber-800 font-medium">No bulk yield yet — fill/pack capacity below still uses order-based unit split until BMR bulk QC records actual KG.</span>
          </>
        )}
      </p>
      {(hasFill || hasFg) && (
        <p className="text-slate-600 border-t border-indigo-100/80 pt-2 mt-2">
          {hasFill && (
            <span className="mr-3">
              Fill QC yield: <b>{fillY}</b> units
            </span>
          )}
          {hasFg && (
            <span>
              Pack / FG yield: <b>{fgY}</b> units
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Saving the schedule modal must not rewind BMR (e.g. bulk_qc → scheduled) — that broke workflows
 * and made "Edit schedule" appear to do nothing or corrupt state.
 */
function bmrStatusAfterScheduleSave(batch: Batch, canMoveToScheduled: boolean): BMRStatus {
  const locked: BMRStatus[] = ['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
  if (locked.includes(batch.bmrStatus)) return batch.bmrStatus;
  if (batch.bmrStatus === 'scheduled') return 'scheduled';
  return canMoveToScheduled ? 'scheduled' : 'batch_confirmed';
}

/**
 * Reschedule (batch already has mfg date): do not send bmrStatus — client batch may be stale (e.g. still
 * "scheduled" after DB was advanced to cleared via QC). Sending stale bmr_status caused apparent
 * "revert" to RM transfer / scheduled in the UI until refetch.
 */
function scheduleSaveBmrStatusPatch(batch: Batch, canMoveToScheduled: boolean): Partial<Pick<Batch, 'bmrStatus'>> {
  const hasMfgDate = !!(batch.mfgDate && String(batch.mfgDate).trim());
  if (hasMfgDate) return {};
  return { bmrStatus: bmrStatusAfterScheduleSave(batch, canMoveToScheduled) };
}

/** Shift MFG / fill / pack / FG dates while BPR is active (e.g. waiting on BMR QC release). */
function canRescheduleProductionDates(batch: Batch): boolean {
  if (batch.bmrStatus === 'draft') return false;
  if (batch.bprStatus === 'fg_ready') return false;
  if (batch.mfgDate || batch.fillDate || batch.packDate || batch.fgDate) return true;
  if (batch.bmrStatus === 'scheduled') return true;
  if (['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'].includes(batch.bmrStatus)) return true;
  return ['pm_reserved', 'pm_connected', 'pm_dispensing', 'scheduled', 'filling', 'fill_qc', 'packaging', 'pack_qc', 'qc_failed'].includes(batch.bprStatus);
}

/** True once bulk QC approved (cleared) — also accept flag if bmrStatus is briefly stale after PATCH/refresh. */
function bmrBulkQcReleased(batch: Batch): boolean {
  return batch.bmrStatus === 'cleared' || batch.bulkBatchAccepted === true;
}

/** BPR is mid-flight before FG; used for copy in dispensing / schedule. */
function bprAwaitingBmrRelease(batch: Batch): boolean {
  return !bmrBulkQcReleased(batch) && ['pm_dispensing', 'scheduled', 'filling'].includes(batch.bprStatus);
}

/** BMR pipeline when `rm_connected` flag is set but `bmr_status` was not yet advanced from rm_reserved/scheduled. */
function bmrStatusForPipelineDisplay(batch: Batch): BMRStatus {
  const pastRmConnectUi = ['dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
  if (pastRmConnectUi.includes(batch.bmrStatus)) return batch.bmrStatus;
  if (batch.rmConnected && (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled')) {
    return 'rm_connected';
  }
  return batch.bmrStatus;
}

/** Offer RM dispensing after transfer — tolerate rm_connected flag OR status, and pre-dispensing BMR steps only. */
function canOfferRmDispensingUi(batch: Batch): boolean {
  const preDispense: BMRStatus[] = ['rm_reserved', 'scheduled', 'rm_connected'];
  return (batch.rmConnected || batch.bmrStatus === 'rm_connected') && preDispense.includes(batch.bmrStatus);
}

/** Footer: avoid duplicate Set Schedule + Reschedule when only first-time scheduling applies. */
function canShowRescheduleFooterButton(batch: Batch): boolean {
  if (!canRescheduleProductionDates(batch)) return false;
  if (batch.mfgDate || batch.fillDate || batch.packDate || batch.fgDate) return true;
  if (['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'].includes(batch.bmrStatus)) return true;
  return ['pm_dispensing', 'scheduled', 'filling', 'fill_qc', 'packaging', 'pack_qc', 'qc_failed'].includes(batch.bprStatus);
}

/** Batches that have schedule dates, with fill/pack units for capacity math. */
function toScheduledBatchesWithUnits(batches: Batch[]) {
  return batches
    .filter((b) => b.mfgDate || b.fillDate || b.packDate)
    .map((b) => {
      const { fillUnitsRequired, packUnitsRequired } = getBatchFillPackUnits(b);
      return {
        mainVessel: b.mainVessel,
        mfgDate: b.mfgDate,
        fillingLine: b.fillingLine,
        fillDate: b.fillDate,
        packagingLine: b.packagingLine,
        packDate: b.packDate,
        fillUnitsRequired,
        packUnitsRequired,
        bmrNo: b.bmrNo,
      };
    });
}

/* ─────────────────────── PIPELINE DEFS ─────────────────────── */

const PS = 9; // pipeline icon size

const BMR_PIPELINE: PipelineStep[] = [
  { key: 'draft', label: 'Draft', icon: <ClipboardList size={PS} /> },
  { key: 'batch_confirmed', label: 'Confirmed', icon: <CheckCircle2 size={PS} /> },
  { key: 'rm_reserved', label: 'RM Reserved', icon: <Package size={PS} /> },
  { key: 'scheduled', label: 'Scheduled', icon: <Calendar size={PS} /> },
  { key: 'rm_connected', label: 'RM Connected', icon: <Link2 size={PS} /> },
  { key: 'dispensing', label: 'Dispensing', icon: <Scale size={PS} /> },
  { key: 'in_production', label: 'In Production', icon: <FlaskConical size={PS} /> },
  { key: 'bulk_qc', label: 'Bulk QC', icon: <Microscope size={PS} /> },
  { key: 'cleared', label: 'Cleared', icon: <Check size={PS} /> },
];

const BPR_PIPELINE: PipelineStep[] = [
  { key: 'draft', label: 'Draft', icon: <ClipboardList size={PS} /> },
  { key: 'pm_reserved', label: 'PM Reserved', icon: <Package size={PS} /> },
  { key: 'pm_connected', label: 'PM Connected', icon: <Link2 size={PS} /> },
  { key: 'pm_dispensing', label: 'PM Dispensing', icon: <Scale size={PS} /> },
  { key: 'scheduled', label: 'Scheduled', icon: <Calendar size={PS} /> },
  { key: 'filling', label: 'Filling', icon: <Droplets size={PS} /> },
  { key: 'fill_qc', label: 'Fill QC', icon: <Microscope size={PS} /> },
  { key: 'packaging', label: 'Packaging', icon: <Package size={PS} /> },
  { key: 'pack_qc', label: 'Pack QC', icon: <Microscope size={PS} /> },
  { key: 'fg_ready', label: 'FG Ready', icon: <Check size={PS} /> },
];

/* ─────────────────────── DEFAULT DATA ─────────────────────── */

const DEFAULT_EQUIPMENT: EquipmentData = {
  manufacturing: [
    { id: 'MV-01', name: 'Manufacturing Vessel 01', cap: 500, type: 'jacketed', homogenizer: true, processType: ['hot', 'cold'], status: 'idle' },
    { id: 'MV-02', name: 'Manufacturing Vessel 02', cap: 300, type: 'jacketed', homogenizer: true, processType: ['hot', 'cold'], status: 'idle' },
    { id: 'MV-03', name: 'Manufacturing Vessel 03', cap: 200, type: 'simple', homogenizer: false, processType: ['cold'], status: 'idle' },
    { id: 'ST-01', name: 'Supporting Tank 01', cap: 100, type: 'support', homogenizer: false, processType: ['hot', 'cold'], status: 'idle' },
    { id: 'ST-02', name: 'Supporting Tank 02', cap: 100, type: 'support', homogenizer: false, processType: ['hot', 'cold'], status: 'idle' },
    { id: 'ST-03', name: 'Supporting Tank 03', cap: 50, type: 'support', homogenizer: false, processType: ['cold'], status: 'idle' },
  ],
  filling: [
    { id: 'FL-01', name: 'Filling Line 01 (Bottle)', speed: 3000, type: 'bottle', compatible: ['bottle'], status: 'idle' },
    { id: 'FL-02', name: 'Filling Line 02 (Tube)', speed: 2000, type: 'tube', compatible: ['tube'], status: 'idle' },
    { id: 'FL-03', name: 'Filling Line 03 (Jar)', speed: 500, type: 'jar', compatible: ['jar'], status: 'idle' },
    { id: 'FL-04', name: 'Filling Line 04 (Manual)', speed: 200, type: 'manual', compatible: ['bottle', 'tube', 'jar', 'sachet'], status: 'idle' },
  ],
  packaging: [
    { id: 'PL-01', name: 'Packaging Line 01', speed: 4000, type: 'auto', supports: ['carton', 'label', 'shrink'], status: 'idle' },
    { id: 'PL-02', name: 'Packaging Line 02', speed: 2500, type: 'semi', supports: ['carton', 'label'], status: 'idle' },
    { id: 'SK-01', name: 'Shrink Wrap Station', speed: 1500, type: 'shrink', supports: ['shrink'], status: 'idle' },
  ],
};

const DEFAULT_TEAM: TeamMember[] = [];

/** Sum by trimmed material code — multiple warehouse_inventory rows can exist per RM/PM (e.g. batches). */
function buildStockMap(inv: WarehouseInventoryRow[], type: 'RM' | 'PM'): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of inv) {
    if (r.type !== type) continue;
    const c = String(r.code ?? '').trim();
    if (!c) continue;
    const add = Number(r.stockInHand) || 0;
    map[c] = (map[c] ?? 0) + add;
  }
  return map;
}

function buildReservedMap(inv: WarehouseInventoryRow[], type: 'RM' | 'PM'): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of inv) {
    if (r.type !== type) continue;
    const c = String(r.code ?? '').trim();
    if (!c) continue;
    map[c] = (map[c] ?? 0) + (Number(r.reserved) || 0);
  }
  return map;
}

/** At production facility by code (all non-WH stocks) for MTR modal — dynamic, not tied to MU1/MU2 columns. */
function buildAtFacilityMap(inv: WarehouseInventoryRow[], type: 'RM' | 'PM'): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of inv) {
    if (r.type !== type) continue;
    const c = String(r.code ?? '').trim();
    if (!c) continue;
    // At facility = everything not currently in WH storage.
    const add = Math.max(0, (Number(r.stockInHand) || 0) - (Number(r.whStock) || 0));
    map[c] = (map[c] ?? 0) + add;
  }
  return map;
}

/** WH stock only (excl. ML1/ML2) by code. Available to transfer = whStockOnly - reserved. */
function buildWhStockOnlyMap(inv: WarehouseInventoryRow[], type: 'RM' | 'PM'): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of inv) {
    if (r.type !== type) continue;
    const c = String(r.code ?? '').trim();
    if (!c) continue;
    map[c] = (map[c] ?? 0) + (Number(r.whStock) || 0);
  }
  return map;
}

/** Set `VITE_DEBUG_PRODUCTION_RESERVE=1` in admin-dashboard `.env` or use dev server — traces Reserve RM/PM vs warehouse-inventory. */
function debugProductionReserveEnabled(): boolean {
  try {
    return (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.DEV === true || import.meta.env.VITE_DEBUG_PRODUCTION_RESERVE === '1')
    );
  } catch {
    return false;
  }
}

function logProductionReserve(message: string, data?: unknown): void {
  if (!debugProductionReserveEnabled() || typeof console === 'undefined' || !console.log) return;
  console.log(`[EI production-reserve debug] ${message}`, data !== undefined ? data : '');
}

function makeDefaultBatches(): Batch[] {
  return [
    {
      bmrNo: 'BMR-2026-001', bprNo: 'BPR-2026-001', productName: 'Gentle Foaming Facewash', sku: 'EI-FW-150',
      soNo: 'SO-2026-001', orderQty: 30000, batchSize: 500, batchNo: 'B-01', batchIndex: 1, totalBatches: 3,
      bmrStatus: 'in_production', bprStatus: 'draft', color: 'teal',
      processType: 'hot', homogenizer: true, mainVessel: 'MV-01', supportingTanks: ['ST-01'],
      fillingLine: 'FL-01', fillingType: 'bottle', packagingLine: 'PL-01', monocarton: true, shrink: false,
      teamBMR: ['T01', 'T02', 'T04'], teamBPR: ['T08', 'T10'], qcOfficerBMR: 'T05', qcOfficerBPR: 'T07',
      mfgDate: '2026-03-04', fillDate: '2026-03-08', packDate: '2026-03-09', fgDate: '2026-03-10',
      rmConnectDate: '2026-03-02', pmConnectDate: '2026-03-06',
      rmReserved: true, pmReserved: false, rmConnected: true, pmConnected: false,
      dispensingRM: [
        { code: 'RM-001', inci: 'Aqua (Water)', required: 350, dispensed: 350, done: true },
        { code: 'RM-002', inci: 'Sodium Laureth Sulfate', required: 75, dispensed: 75, done: true },
        { code: 'RM-003', inci: 'Cocamidopropyl Betaine', required: 40, dispensed: 40, done: true },
        { code: 'RM-004', inci: 'Glycerin', required: 25, dispensed: 25, done: true },
        { code: 'RM-005', inci: 'Fragrance', required: 10, dispensed: 10, done: true },
      ],
      dispensingPM: [
        { code: 'PM-001', name: '150ml Bottle', required: 10000, dispensed: 0, done: false },
        { code: 'PM-002', name: 'Flip Cap', required: 10000, dispensed: 0, done: false },
        { code: 'PM-003', name: 'Label', required: 10000, dispensed: 0, done: false },
        { code: 'PM-004', name: 'Mono Carton', required: 10000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [], remarks: '', dueDate: '2026-03-12',
    },
    {
      bmrNo: 'BMR-2026-002', bprNo: 'BPR-2026-002', productName: 'Gentle Foaming Facewash', sku: 'EI-FW-150',
      soNo: 'SO-2026-001', orderQty: 30000, batchSize: 500, batchNo: 'B-02', batchIndex: 2, totalBatches: 3,
      bmrStatus: 'scheduled', bprStatus: 'draft', color: 'teal',
      processType: 'hot', homogenizer: true, mainVessel: 'MV-01', supportingTanks: ['ST-01'],
      fillingLine: 'FL-01', fillingType: 'bottle', packagingLine: 'PL-01', monocarton: true, shrink: false,
      teamBMR: ['T01', 'T02'], teamBPR: [], qcOfficerBMR: 'T05', qcOfficerBPR: '',
      mfgDate: '2026-03-06', fillDate: '2026-03-10', packDate: '2026-03-11', fgDate: '2026-03-12',
      rmConnectDate: '2026-03-04', pmConnectDate: '2026-03-08',
      rmReserved: true, pmReserved: false, rmConnected: false, pmConnected: false,
      dispensingRM: [
        { code: 'RM-001', inci: 'Aqua (Water)', required: 350, dispensed: 0, done: false },
        { code: 'RM-002', inci: 'Sodium Laureth Sulfate', required: 75, dispensed: 0, done: false },
        { code: 'RM-003', inci: 'Cocamidopropyl Betaine', required: 40, dispensed: 0, done: false },
      ],
      dispensingPM: [
        { code: 'PM-001', name: '150ml Bottle', required: 10000, dispensed: 0, done: false },
        { code: 'PM-002', name: 'Flip Cap', required: 10000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [], remarks: '', dueDate: '2026-03-14',
    },
    {
      bmrNo: 'BMR-2026-003', bprNo: 'BPR-2026-003', productName: 'Gentle Foaming Facewash', sku: 'EI-FW-150',
      soNo: 'SO-2026-001', orderQty: 30000, batchSize: 500, batchNo: 'B-03', batchIndex: 3, totalBatches: 3,
      bmrStatus: 'batch_confirmed', bprStatus: 'draft', color: 'teal',
      processType: 'hot', homogenizer: true, mainVessel: '', supportingTanks: [],
      fillingLine: '', fillingType: 'bottle', packagingLine: '', monocarton: true, shrink: false,
      teamBMR: [], teamBPR: [], qcOfficerBMR: '', qcOfficerBPR: '',
      mfgDate: '', fillDate: '', packDate: '', fgDate: '',
      rmConnectDate: '', pmConnectDate: '',
      rmReserved: false, pmReserved: false, rmConnected: false, pmConnected: false,
      dispensingRM: [
        { code: 'RM-001', inci: 'Aqua (Water)', required: 350, dispensed: 0, done: false },
        { code: 'RM-002', inci: 'Sodium Laureth Sulfate', required: 75, dispensed: 0, done: false },
      ],
      dispensingPM: [
        { code: 'PM-001', name: '150ml Bottle', required: 10000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [], remarks: '', dueDate: '2026-03-16',
    },
    {
      bmrNo: 'BMR-2026-004', bprNo: 'BPR-2026-004', productName: 'Invisible Sunscreen SPF50', sku: 'EI-SS-50',
      soNo: 'SO-2026-002', orderQty: 20000, batchSize: 300, batchNo: 'B-01', batchIndex: 1, totalBatches: 2,
      bmrStatus: 'bulk_qc', bprStatus: 'pm_reserved', color: 'amber',
      processType: 'hot', homogenizer: true, mainVessel: 'MV-02', supportingTanks: ['ST-02'],
      fillingLine: 'FL-02', fillingType: 'tube', packagingLine: 'PL-01', monocarton: true, shrink: true,
      teamBMR: ['T01', 'T04'], teamBPR: ['T08', 'T09', 'T10', 'T11'], qcOfficerBMR: 'T05', qcOfficerBPR: 'T07',
      mfgDate: '2026-03-03', fillDate: '2026-03-07', packDate: '2026-03-08', fgDate: '2026-03-09',
      rmConnectDate: '2026-03-01', pmConnectDate: '2026-03-05',
      rmReserved: true, pmReserved: true, rmConnected: true, pmConnected: false,
      dispensingRM: [
        { code: 'RM-006', inci: 'Titanium Dioxide', required: 45, dispensed: 45, done: true },
        { code: 'RM-007', inci: 'Zinc Oxide', required: 30, dispensed: 30, done: true },
        { code: 'RM-001', inci: 'Aqua', required: 150, dispensed: 150, done: true },
        { code: 'RM-008', inci: 'Silicone Emulsion', required: 50, dispensed: 50, done: true },
      ],
      dispensingPM: [
        { code: 'PM-005', name: '50ml Tube', required: 10000, dispensed: 0, done: false },
        { code: 'PM-006', name: 'Tube Cap', required: 10000, dispensed: 0, done: false },
        { code: 'PM-003', name: 'Label', required: 10000, dispensed: 0, done: false },
        { code: 'PM-004', name: 'Mono Carton', required: 10000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [
        { param: 'pH', spec: '6.5 - 7.5', result: '7.0', passed: true },
        { param: 'Viscosity', spec: '8000-12000 cps', result: '9500', passed: true },
        { param: 'SPF Value', spec: '>= 50', result: '52', passed: true },
        { param: 'Appearance', spec: 'White smooth lotion', result: 'Conforms', passed: true },
      ],
      remarks: '', dueDate: '2026-03-10',
    },
    {
      bmrNo: 'BMR-2026-005', bprNo: 'BPR-2026-005', productName: 'Invisible Sunscreen SPF50', sku: 'EI-SS-50',
      soNo: 'SO-2026-002', orderQty: 20000, batchSize: 300, batchNo: 'B-02', batchIndex: 2, totalBatches: 2,
      bmrStatus: 'draft', bprStatus: 'draft', color: 'amber',
      processType: 'hot', homogenizer: true, mainVessel: '', supportingTanks: [],
      fillingLine: '', fillingType: 'tube', packagingLine: '', monocarton: true, shrink: true,
      teamBMR: [], teamBPR: [], qcOfficerBMR: '', qcOfficerBPR: '',
      mfgDate: '', fillDate: '', packDate: '', fgDate: '',
      rmConnectDate: '', pmConnectDate: '',
      rmReserved: false, pmReserved: false, rmConnected: false, pmConnected: false,
      dispensingRM: [
        { code: 'RM-006', inci: 'Titanium Dioxide', required: 45, dispensed: 0, done: false },
        { code: 'RM-007', inci: 'Zinc Oxide', required: 30, dispensed: 0, done: false },
      ],
      dispensingPM: [
        { code: 'PM-005', name: '50ml Tube', required: 10000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [], remarks: '', dueDate: '2026-03-18',
    },
    {
      bmrNo: 'BMR-2026-006', bprNo: 'BPR-2026-006', productName: 'Hydra-Boost Moisturiser', sku: 'EI-MO-200',
      soNo: 'SO-2026-003', orderQty: 15000, batchSize: 200, batchNo: 'B-01', batchIndex: 1, totalBatches: 1,
      bmrStatus: 'draft', bprStatus: 'draft', color: 'purple',
      processType: 'cold', homogenizer: false, mainVessel: 'MV-03', supportingTanks: [],
      fillingLine: 'FL-03', fillingType: 'jar', packagingLine: 'PL-02', monocarton: true, shrink: false,
      teamBMR: [], teamBPR: [], qcOfficerBMR: '', qcOfficerBPR: '',
      mfgDate: '', fillDate: '', packDate: '', fgDate: '',
      rmConnectDate: '', pmConnectDate: '',
      rmReserved: false, pmReserved: false, rmConnected: false, pmConnected: false,
      dispensingRM: [
        { code: 'RM-001', inci: 'Aqua', required: 140, dispensed: 0, done: false },
        { code: 'RM-009', inci: 'Hyaluronic Acid', required: 5, dispensed: 0, done: false },
        { code: 'RM-010', inci: 'Shea Butter', required: 30, dispensed: 0, done: false },
      ],
      dispensingPM: [
        { code: 'PM-007', name: '200ml Jar', required: 15000, dispensed: 0, done: false },
        { code: 'PM-008', name: 'Jar Lid', required: 15000, dispensed: 0, done: false },
      ],
      bulkYield: null, fillYield: null, fgYield: null,
      bulkBatchAccepted: null, fillBatchAccepted: null, fgBatchAccepted: null,
      qcSpecs: [], remarks: '', dueDate: '2026-03-20',
    },
  ];
}

/* ─────────────────────── UTILITIES ─────────────────────────── */

function today(): string { return new Date().toISOString().split('T')[0]; }
function fmt(n: number): string { return n.toLocaleString('en-IN'); }

const addDaysStr = addDaysToDateStr;

function getWeekStart(date: Date): Date {
  const d = new Date(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
}
function addDays(date: Date, n: number): Date { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function isoDate(d: Date): string { return d.toISOString().split('T')[0]; }
function formatWeekLabel(monday: Date): string {
  return `Week of ${monday.getDate()} ${monday.toLocaleString('en-IN', { month: 'short' })} ${monday.getFullYear()}`;
}
function buildWeekDays(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { label: d.toLocaleString('en-IN', { weekday: 'short' }), date: d.getDate().toString(), month: d.toLocaleString('en-IN', { month: 'short' }), iso: isoDate(d) };
  });
}
/** Week offset (for URL) that would show the week containing the given ISO date. 0 = this week. */
function getWeekOffsetForDate(isoDateStr: string): number {
  const thisMonday = getWeekStart(new Date());
  const thatMonday = getWeekStart(new Date(isoDateStr + 'T12:00:00'));
  const diffMs = thatMonday.getTime() - thisMonday.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function pipelineIndex(status: string, pipeline: PipelineStep[]): number {
  return pipeline.findIndex(p => p.key === status);
}

const isEquipFreeOnDate = isEquipFreeOnDateLib;

const batchColorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const bmrStatusLabel: Record<BMRStatus, string> = {
  draft: 'Draft', batch_confirmed: 'Confirmed', rm_reserved: 'RM Reserved', scheduled: 'Scheduled',
  rm_connected: 'RM Connected', dispensing: 'Dispensing', in_production: 'In Production', bulk_qc: 'Bulk QC', qc_failed: 'QC Failed', cleared: 'Cleared',
};
const bprStatusLabel: Record<BPRStatus, string> = {
  draft: 'Draft', pm_reserved: 'PM Reserved', pm_connected: 'PM Connected', pm_dispensing: 'PM Dispensing',
  scheduled: 'Scheduled', filling: 'Filling', fill_qc: 'Fill QC', packaging: 'Packaging', pack_qc: 'Pack QC', qc_failed: 'QC Failed', fg_ready: 'FG Ready',
};

function canAdjustBatchSize(batch: Batch): boolean {
  if (batch.bprStatus === 'fg_ready') return false;
  if (batch.bmrStatus === 'draft') return false;
  return true;
}

/* ────────────────────── API HELPERS ─────────────────────────── */

function apiBatchToBatch(r: BatchRow): Batch {
  return {
    bmrNo: r.bmrNo, bprNo: r.bprNo, productName: r.productName, sku: r.sku,
    soNo: r.soNo, orderQty: r.orderQty, batchSize: r.batchSize, batchNo: r.batchNo,
    batchIndex: r.batchIndex, totalBatches: r.totalBatches,
    bmrStatus: r.bmrStatus as BMRStatus, bprStatus: r.bprStatus as BPRStatus,
    color: r.color, processType: (r.processType || 'cold') as ProcessType,
    homogenizer: r.homogenizer, mainVessel: r.mainVessel,
    supportingTanks: r.supportingTanks || [], fillingLine: r.fillingLine,
    fillingType: (r.fillingType || 'bottle') as FillingType,
    packagingLine: r.packagingLine, monocarton: r.monocarton, shrink: r.shrink,
    teamBMR: r.teamBMR || [], teamBPR: r.teamBPR || [],
    qcOfficerBMR: r.qcOfficerBMR, qcOfficerBPR: r.qcOfficerBPR,
    mfgDate: r.mfgDate, fillDate: r.fillDate, packDate: r.packDate, fgDate: r.fgDate,
    rmConnectDate: r.rmConnectDate, pmConnectDate: r.pmConnectDate,
    rmReserved: r.rmReserved, pmReserved: r.pmReserved,
    rmConnected: r.rmConnected, pmConnected: r.pmConnected,
    dispensingRM: r.dispensingRM || [], dispensingPM: r.dispensingPM || [],
    bulkYield: r.bulkYield, fillYield: r.fillYield, fgYield: r.fgYield,
    bulkBatchAccepted: r.bulkBatchAccepted, fillBatchAccepted: r.fillBatchAccepted,
    fgBatchAccepted: r.fgBatchAccepted,
    qcSpecs: r.qcSpecs || [], remarks: r.remarks, dueDate: r.dueDate,
    compatibleVessels: r.compatibleVessels, compatibleFillLines: r.compatibleFillLines,
    compatiblePackLines: r.compatiblePackLines,
    requiredVolumeLiters: r.requiredVolumeLiters ?? undefined,
    _pk: r._pk,
    planningBatchId: r.planningBatchId ?? undefined,
    muDispensingBundleId: r.muDispensingBundleId ?? null,
    muDispensingBundles: Array.isArray(r.muDispensingBundles) ? r.muDispensingBundles : [],
  } as Batch & { _pk: number };
}

function apiEquipToEquipData(d: APIEquipmentData): EquipmentData {
  type MfgRow = { id?: string; name?: string; cap?: number; capacity?: number; type?: string; homogenizer?: boolean; processType?: string[]; status?: string; _pk?: number };
  const mfg = (d?.manufacturing ?? []) as MfgRow[];
  return {
    manufacturing: mfg.map(r => ({
      id: r.id ?? '', name: r.name ?? '', cap: r.cap ?? r.capacity ?? 0, type: (r.type ?? 'simple') as 'jacketed' | 'simple' | 'support',
      homogenizer: !!r.homogenizer, processType: (r.processType || []) as ProcessType[], status: r.status ?? 'idle', _pk: r._pk ?? 0,
    })),
    filling: (d?.filling ?? []).map(r => ({
      id: r.id, name: r.name, speed: r.speed, type: r.type as FillingType,
      compatible: r.compatible || [], status: r.status, _pk: r._pk,
    })),
    packaging: (d?.packaging ?? []).map(r => ({
      id: r.id, name: r.name, speed: r.speed, type: r.type,
      supports: r.supports || [], status: r.status, _pk: r._pk,
    })),
  } as EquipmentData;
}

function apiTeamToTeam(rows: TeamMemberRow[]): TeamMember[] {
  return rows.map(r => ({ id: r.id, userId: r.userId, name: r.name, role: r.role, dept: r.dept as Department, avail: r.avail, _pk: r._pk }));
}

function defaultState(): ProductionState {
  return { batches: [], equipment: DEFAULT_EQUIPMENT, team: DEFAULT_TEAM, lastUpdated: new Date().toISOString() };
}

/* ──────────────── SHARED UI COMPONENTS ─────────────────────── */

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap leading-none inline-flex items-center gap-1 ${className}`}>{children}</span>;
}

function Modal({ onClose, title, subtitle, children, size = 'md' }: {
  onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl';
}) {
  const w = size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-[2px] p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${w} my-4 border border-gray-100`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string; icon?: React.ReactNode }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-gray-100 mb-5">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-semibold border-b-2 transition-colors ${active === t.key ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          {t.icon && <span className={active === t.key ? 'text-orange-500' : 'text-gray-400'}>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Tip({ color = 'blue', icon, children }: { color?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const cm: Record<string, string> = {
    orange: 'bg-orange-50 border-orange-100 text-orange-800',
    teal: 'bg-teal-50 border-teal-100 text-teal-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
  };
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-[11px] leading-relaxed mb-4 ${cm[color] || cm.blue}`}>
      {icon && <span className="shrink-0 mt-0.5 opacity-70">{icon}</span>}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function PipelineStrip({ pipeline, currentStatus, failed }: { pipeline: PipelineStep[]; currentStatus: string; failed?: boolean }) {
  const idx = pipelineIndex(currentStatus, pipeline);
  return (
    <div className="flex items-center gap-0.5">
      {pipeline.map((p, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        const isFailed = failed && state === 'active';
        return (
          <div key={p.key} className="flex items-center gap-0.5">
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border ${isFailed ? 'bg-red-100 border-red-300 text-red-600' :
              state === 'done' ? 'bg-emerald-100 border-emerald-300 text-emerald-600' :
                state === 'active' ? 'bg-orange-100 border-orange-300 text-orange-600' :
                  'bg-gray-50 border-gray-200 text-gray-300'
              }`} title={isFailed ? `${p.label} (Failed)` : p.label}>
              {isFailed ? <X size={10} strokeWidth={3} /> : state === 'done' ? <Check size={10} strokeWidth={3} /> : state === 'active' ? p.icon : <CircleDot size={8} />}
            </div>
            {i < pipeline.length - 1 && <div className={`w-2.5 h-px ${i < idx ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

/** BMR pipeline labels for the detail modal strip (Step X of 9, pipe-node with text). */
const BMR_PIPELINE_LABELS: Record<string, string> = {
  draft: 'Draft',
  batch_confirmed: 'Batch Confirmed',
  rm_reserved: 'RM Reserved',
  scheduled: 'Scheduled',
  rm_connected: 'RM Connected',
  dispensing: 'Dispensing',
  in_production: 'In Production',
  bulk_qc: 'Bulk QC',
  qc_failed: 'Bulk QC',
  cleared: 'Cleared',
};

function PipelineStripWithLabels({ pipeline, currentStatus, failed, title = 'BMR Progress' }: { pipeline: PipelineStep[]; currentStatus: string; failed?: boolean; title?: string }) {
  const idx = pipelineIndex(currentStatus, pipeline);
  const stepNum = idx < 0 ? 0 : idx + 1;
  return (
    <div className="mb-[18px] overflow-x-auto pb-1">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{title} — Step {stepNum} of {pipeline.length}</div>
      <div className="flex items-center gap-0 flex-wrap">
        {pipeline.map((p, i) => {
          const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
          const isFailed = failed && state === 'active';
          const label = BMR_PIPELINE_LABELS[p.key] ?? p.label;
          return (
            <div key={p.key} className="flex items-center shrink-0">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap ${isFailed ? 'bg-red-100 text-red-700 border border-red-200' : state === 'done' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : state === 'active' ? 'bg-orange-100 text-orange-700 border border-orange-200 ring-1 ring-orange-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                {label}
              </span>
              {i < pipeline.length - 1 && <span className="text-gray-300 mx-0.5 font-bold">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors';
const LBL = 'block text-[11px] font-semibold text-gray-500 mb-1 tracking-wide';

/* ──────────────── CONFIRM BATCH MODAL ──────────────────────── */

function ConfirmBatchModal({ batch, equipment, team, onClose, onSave }: {
  batch: Batch; equipment: EquipmentData; team: TeamMember[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const [tab, setTab] = useState('process');
  const [form, setForm] = useState({
    processType: batch.processType,
    batchSize: batch.batchSize,
    homogenizer: batch.homogenizer,
    fillingType: batch.fillingType,
    monocarton: batch.monocarton,
    shrink: batch.shrink,
    compatibleVessels: batch.compatibleVessels || [] as string[],
    supportingTanks: batch.supportingTanks || [] as string[],
    compatibleFillLines: batch.compatibleFillLines || [] as string[],
    compatiblePackLines: batch.compatiblePackLines || [] as string[],
    teamBMR: batch.teamBMR || [] as string[],
    teamBPR: batch.teamBPR || [] as string[],
    qcOfficerBMR: batch.qcOfficerBMR || '',
    qcOfficerBPR: batch.qcOfficerBPR || '',
  });

  const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleSave = () => {
    const updates: Partial<Batch> = { ...form, bmrStatus: 'batch_confirmed' as BMRStatus };
    const oldSize = batch.batchSize || 1;
    const newSize = form.batchSize || oldSize;
    if (newSize !== oldSize && (batch.dispensingRM?.length > 0 || batch.dispensingPM?.length > 0)) {
      const scale = newSize / oldSize;
      if (batch.dispensingRM?.length) {
        updates.dispensingRM = batch.dispensingRM.map((r) => ({
          ...r,
          required: Math.round(r.required * scale * 100) / 100,
        }));
      }
      if (batch.dispensingPM?.length) {
        updates.dispensingPM = batch.dispensingPM.map((p) => ({
          ...p,
          required: Math.round(p.required * scale),
        }));
      }
    }
    onSave(updates);
    onClose();
  };

  return (
    <Modal onClose={onClose} title={`Confirm Batch - ${batch.bmrNo}`} subtitle={`${batch.productName} - ${batch.batchSize} KG`} size="lg">
      <TabBar tabs={[
        { key: 'process', label: 'Process & Filling', icon: <Settings size={13} /> },
        { key: 'equipment', label: 'Equipment', icon: <Factory size={13} /> },
        { key: 'team', label: 'Team', icon: <Users size={13} /> },
      ]} active={tab} onChange={setTab} />

      {tab === 'process' && (
        <>
          <Tip color="orange" icon={<Zap size={14} />}>Define process parameters. <b>No dates here</b> - dates are set during Schedule after confirmation.</Tip>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className={LBL}>Process Type</label><select className={INP} value={form.processType} onChange={e => setForm(f => ({ ...f, processType: e.target.value as ProcessType }))}><option value="hot">Hot Process</option><option value="cold">Cold Process</option></select></div>
            <div><label className={LBL}>Batch Size (KG)</label><input className={INP} type="number" value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: parseFloat(e.target.value) || 0 }))} /></div>
            <div><label className={LBL}>Homogenizer</label><select className={INP} value={form.homogenizer ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, homogenizer: e.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div><label className={LBL}>Filling Type</label><select className={INP} value={form.fillingType} onChange={e => setForm(f => ({ ...f, fillingType: e.target.value as FillingType }))}><option value="bottle">Bottle</option><option value="tube">Tube</option><option value="jar">Jar</option><option value="manual">Manual</option></select></div>
            <div><label className={LBL}>Monocarton</label><select className={INP} value={form.monocarton ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, monocarton: e.target.value === 'yes' }))}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div><label className={LBL}>Shrink Wrap</label><select className={INP} value={form.shrink ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, shrink: e.target.value === 'yes' }))}><option value="no">No</option><option value="yes">Yes</option></select></div>
          </div>
          <Tip color="teal" icon={<Info size={14} />}>Process: <b>{form.processType.toUpperCase()}</b> - Batch: <b>{form.batchSize} KG</b> - Homogenizer: <b>{form.homogenizer ? 'Required' : 'Not Required'}</b>. If you change batch size, RM/PM quantities will scale proportionally when you confirm.</Tip>
        </>
      )}

      {tab === 'equipment' && (
        <>
          <Tip color="teal" icon={<Factory size={14} />}>Mark <b>all possible vessels, lines &amp; tanks</b> for this batch. During scheduling, the system will pick available ones. Capacity filter: {form.batchSize} KG - Filling: {form.fillingType.toUpperCase()}</Tip>
          <div className="mb-5">
            <SectionLabel icon={<FlaskConical size={13} />} color="text-teal-600">Manufacturing Vessels</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {equipment.manufacturing.filter(e => e.type !== 'support').map(e => {
                const ok = e.cap >= form.batchSize;
                const checked = form.compatibleVessels.includes(e.id) || (form.compatibleVessels.length === 0 && ok);
                return (
                  <label key={e.id} className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${ok ? (checked ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-white hover:bg-gray-50') : 'border-red-200 bg-red-50/50 opacity-50 cursor-not-allowed'}`}>
                    <input type="checkbox" className="mt-0.5 accent-emerald-500" checked={ok && checked} disabled={!ok}
                      onChange={() => ok && setForm(f => ({ ...f, compatibleVessels: toggle(f.compatibleVessels, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold text-gray-800">{e.id} <span className="text-gray-400">({e.cap}L)</span></div>
                      <div className="text-[10px] text-gray-500">{e.name}</div>
                      <div className="text-[10px] text-gray-400">{e.homogenizer ? 'Homogenizer' : 'No homogenizer'} - {e.processType.join(', ').toUpperCase()}</div>
                      {!ok && <div className="text-[10px] text-red-500 font-semibold mt-0.5 flex items-center gap-0.5"><X size={10} /> {e.cap}L &lt; {form.batchSize} KG</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="mb-5">
            <SectionLabel icon={<Cylinder size={13} />} color="text-blue-600">Supporting Tanks</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {equipment.manufacturing.filter(e => e.type === 'support').map(e => {
                const checked = form.supportingTanks.includes(e.id);
                return (
                  <label key={e.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200'}`}>
                    <input type="checkbox" className="accent-blue-500" checked={checked}
                      onChange={() => setForm(f => ({ ...f, supportingTanks: toggle(f.supportingTanks, e.id) }))} />
                    <span className="text-xs font-semibold">{e.id} <span className="text-gray-400">{e.cap}L</span></span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="mb-5">
            <SectionLabel icon={<Droplets size={13} />} color="text-purple-600">Filling Lines</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {equipment.filling.map(e => {
                const ok = e.compatible.includes(form.fillingType);
                const checked = form.compatibleFillLines.includes(e.id) || (form.compatibleFillLines.length === 0 && ok);
                return (
                  <label key={e.id} className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${ok ? (checked ? 'border-purple-300 bg-purple-50/60' : 'border-gray-200 hover:bg-gray-50') : 'border-gray-200 bg-gray-50/50 opacity-50 cursor-not-allowed'}`}>
                    <input type="checkbox" className="mt-0.5 accent-purple-500" checked={ok && checked} disabled={!ok}
                      onChange={() => ok && setForm(f => ({ ...f, compatibleFillLines: toggle(f.compatibleFillLines, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold">{e.id} <Badge className="bg-purple-100 text-purple-700">{e.type.toUpperCase()}</Badge></div>
                      <div className="text-[10px] text-gray-500">{e.name} - {fmt(e.speed)}/hr</div>
                      {!ok && <div className="text-[10px] text-red-500 flex items-center gap-0.5"><X size={10} /> Not compatible with {form.fillingType.toUpperCase()}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <SectionLabel icon={<Package size={13} />} color="text-emerald-600">Packaging Lines</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {equipment.packaging.map(e => {
                const checked = form.compatiblePackLines.includes(e.id) || form.compatiblePackLines.length === 0;
                return (
                  <label key={e.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200'}`}>
                    <input type="checkbox" className="accent-emerald-500" checked={checked}
                      onChange={() => setForm(f => ({ ...f, compatiblePackLines: toggle(f.compatiblePackLines, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold">{e.id}</div>
                      <div className="text-[10px] text-gray-500">{e.type.toUpperCase()} - {fmt(e.speed)}/hr</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'team' && (
        <>
          <Tip color="orange" icon={<Users size={14} />}>Assign team members to each production stage. Unavailable members are shown but cannot be selected.</Tip>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <SectionLabel icon={<FlaskConical size={13} />} color="text-orange-600">Manufacturing Team</SectionLabel>
              {team.filter(t => t.dept === 'Manufacturing').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-orange-500" checked={form.teamBMR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBMR: toggle(f.teamBMR, t.id) }))} />
                  <div>
                    <div className="text-xs font-semibold">{t.name}</div>
                    <div className="text-[10px] text-gray-400">{t.role}{!t.avail && ' - Unavailable'}</div>
                  </div>
                </label>
              ))}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className={LBL}>QC Officer - Bulk</label>
                <select className={INP} value={form.qcOfficerBMR} onChange={e => setForm(f => ({ ...f, qcOfficerBMR: e.target.value }))}>
                  <option value="">Select QC Officer</option>
                  {team.filter(t => t.dept === 'Quality').map(t => <option key={t.id} value={t.id} disabled={!t.avail}>{t.name} {t.avail ? '' : '(Unavailable)'}</option>)}
                </select>
              </div>
            </div>
            <div>
              <SectionLabel icon={<Droplets size={13} />} color="text-purple-600">Filling Team</SectionLabel>
              {team.filter(t => t.dept === 'Filling').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-purple-500" checked={form.teamBPR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBPR: toggle(f.teamBPR, t.id) }))} />
                  <div><div className="text-xs font-semibold">{t.name}</div><div className="text-[10px] text-gray-400">{t.role}</div></div>
                </label>
              ))}
            </div>
            <div>
              <SectionLabel icon={<Package size={13} />} color="text-emerald-600">Packaging Team</SectionLabel>
              {team.filter(t => t.dept === 'Packaging').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-emerald-500" checked={form.teamBPR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBPR: toggle(f.teamBPR, t.id) }))} />
                  <div><div className="text-xs font-semibold">{t.name}</div><div className="text-[10px] text-gray-400">{t.role}</div></div>
                </label>
              ))}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className={LBL}>QC Officer - Fill/Pack</label>
                <select className={INP} value={form.qcOfficerBPR} onChange={e => setForm(f => ({ ...f, qcOfficerBPR: e.target.value }))}>
                  <option value="">Select QC Officer</option>
                  {team.filter(t => t.dept === 'Quality').map(t => <option key={t.id} value={t.id} disabled={!t.avail}>{t.name} {t.avail ? '' : '(Unavailable)'}</option>)}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><CheckCircle2 size={13} /> Confirm Batch</button>
      </div>
    </Modal>
  );
}

/* ──────────────── ADJUST BATCH SIZE (post-confirm BMR/BPR) ───── */

function AdjustBatchSizeModal({ batch, onClose, onSave }: {
  batch: Batch;
  onClose: () => void;
  onSave: (updates: Partial<Batch>) => void;
}) {
  const [batchSize, setBatchSize] = useState(batch.batchSize || 0);

  const handleSave = () => {
    const updates: Partial<Batch> = { batchSize };
    const oldSize = batch.batchSize || 1;
    const newSize = batchSize || oldSize;
    if (newSize !== oldSize && (batch.dispensingRM?.length > 0 || batch.dispensingPM?.length > 0)) {
      const scale = newSize / oldSize;
      if (batch.dispensingRM?.length) {
        updates.dispensingRM = batch.dispensingRM.map((r) => ({
          ...r,
          required: Math.round(r.required * scale * 100) / 100,
        }));
      }
      if (batch.dispensingPM?.length) {
        updates.dispensingPM = batch.dispensingPM.map((p) => ({
          ...p,
          required: Math.round(p.required * scale),
        }));
      }
    }
    onSave(updates);
    onClose();
  };

  return (
    <Modal onClose={onClose} title={`Adjust batch size — ${batch.bmrNo}`} subtitle={`${batch.productName} · Current ${batch.batchSize} KG`} size="md">
      <Tip color="orange" icon={<Settings size={14} />}>Change the batch size during BMR or BPR. RM/PM required quantities scale proportionally; when the batch is linked to Planning, the planning batch row is updated on save.</Tip>
      <div className="mt-3">
        <label className={LBL}>Batch size (KG)</label>
        <input className={INP} type="number" value={batchSize || ''} onChange={e => setBatchSize(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><CheckCircle2 size={13} /> Save</button>
      </div>
    </Modal>
  );
}

/* ─────────── SECTION LABEL (shared subheading) ─────────────── */

function SectionLabel({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <h4 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2.5 ${color}`}>
      {icon}{children}
    </h4>
  );
}

/* ──────────── RESERVE MATERIAL MODAL ───────────────────────── */

/** Normalize SO identifier so "EI-SO-2026-001", "SO-2026-001", "2026-001" all compare equal. */
function normalizeSoId(id: string): string {
  const s = (id || '').trim();
  if (!s) return '';
  return s.replace(/^(EI-)?(SO-)?/i, '').trim() || s;
}

/** True if batch belongs to the given sales order (compare normalized or exact). */
function batchMatchesSo(batchSoNo: string | undefined, selectedSoId: string): boolean {
  if (!selectedSoId) return false;
  const a = normalizeSoId(batchSoNo ?? '');
  const b = normalizeSoId(selectedSoId);
  if (a && b && a === b) return true;
  return (batchSoNo ?? '') === (selectedSoId ?? '');
}

/** Match batch to a planning-extracted row (SO + product). Prefer SKU/productCode, then flexible product name. */
function findPlanningRowForBatch(
  rows: { id: string; soNumber?: string; productName?: string; productCode?: string }[],
  batch: { soNo?: string; productName?: string; sku?: string }
) {
  const soNorm = normalizeSoId(batch.soNo ?? '');
  const sku = (batch.sku ?? '').trim();
  const batchProductName = (batch.productName ?? '').trim().toLowerCase();
  const productNameMatches = (a: string, b: string) => {
    const ax = (a ?? '').trim().toLowerCase();
    const bx = (b ?? '').trim().toLowerCase();
    return ax.length > 0 && bx.length > 0 && (ax.includes(bx) || bx.includes(ax));
  };

  if (rows.length === 0) return null;
  if (soNorm) {
    const bySo = rows.filter((r) => normalizeSoId(r.soNumber ?? '') === soNorm);
    if (bySo.length === 0) return null;
    const bySku = bySo.find((r) => (r.productCode ?? '').trim() === sku);
    if (bySku) return bySku;
    const byProductName = bySo.find((r) => productNameMatches(r.productName ?? '', batch.productName ?? ''));
    if (byProductName) return byProductName;
    return bySo[0];
  }
  if (!sku && !batchProductName) return null;
  const bySku = rows.find((r) => (r.productCode ?? '').trim() === sku);
  if (bySku) return bySku;
  const byProductName = rows.find((r) => productNameMatches(r.productName ?? '', batch.productName ?? ''));
  return byProductName ?? null;
}

function ReserveMaterialModal({ batch, type, stockMap, reservedMap, inventoryRows, onClose, onSave }: {
  batch: Batch; type: 'rm' | 'pm'; stockMap: Record<string, number>; reservedMap?: Record<string, number>;
  inventoryRows?: WarehouseInventoryRow[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const batchItems = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const unit = type === 'rm' ? 'KG' : 'pcs';

  const [derivedRm, setDerivedRm] = useState<DispensingItem[]>([]);
  const [derivedPm, setDerivedPm] = useState<DispensingItem[]>([]);
  const [loadingRm, setLoadingRm] = useState(false);
  const [loadingPm, setLoadingPm] = useState(false);
  const [rmLoadError, setRmLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [planningCoverageByCode, setPlanningCoverageByCode] = useState<Record<string, number>>({});

  const needLoadRm = type === 'rm' && batchItems.length === 0;
  const needLoadPm = type === 'pm' && batchItems.length === 0;
  // Load RM from batch-specific BOM (planning_batches only). Never show master BOM in Reserve RM.
  useEffect(() => {
    if (!needLoadRm || (!batch.sku && !batch.productName)) return;
    setLoadingRm(true);
    setRmLoadError(null);
    const batchPk = batch._pk;
    console.log('[BOM-DEBUG] Reserve RM: BMR card batch', {
      production_batch_id: batchPk,
      bmrNo: batch.bmrNo,
      soNo: batch.soNo,
      sku: batch.sku,
      productName: batch.productName,
      batchIndex: batch.batchIndex,
      batchNo: batch.batchNo,
      table_for_copy_bom: 'planning_batches (copy BOM from Planning BOM editor)',
    });
    const loadBatchBom = batchPk
      ? fetchBOMByBatchId(batchPk)
      : (batch.bmrNo ? fetchBatches().then(rows => { const r = rows.find((x: { bmrNo: string }) => x.bmrNo === batch.bmrNo); return (r as { _pk?: number })?._pk ? fetchBOMByBatchId((r as { _pk: number })._pk) : { success: false as const, data: undefined }; }) : Promise.resolve({ success: false as const, data: undefined }));
    loadBatchBom
      .then((batchBomRes) => {
        console.log('[BOM-DEBUG] Reserve RM: Batch BOM API response', {
          success: batchBomRes.success,
          source: batchBomRes.data?.source,
          rmLines_count: batchBomRes.data?.rmLines?.length ?? 0,
          pmLines_count: batchBomRes.data?.pmLines?.length ?? 0,
          using: batchBomRes.success && batchBomRes.data?.source === 'planning_batch' ? 'COPY BOM (planning_batches)' : batchBomRes.success && batchBomRes.data?.source === 'product_bom' ? 'MASTER BOM (product boms table) — will show error' : 'fallback or failed',
        });
        // Reserve RM must use batch-specific BOM from planning_batches (Planning BOM editor). Never show master BOM when backend says source is product_bom.
        if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'planning_batch') {
          const batchSizeKg = (batchBomRes.data.batchSizeKg != null && batchBomRes.data.batchSizeKg > 0)
            ? batchBomRes.data.batchSizeKg
            : (batch.batchSize || 0);
          const rmLines = (batchBomRes.data.rmLines ?? []) as BOMRmLine[];
          const rmItems: DispensingItem[] = rmLines
            .filter((line) => line.rm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.rm_code || (line as { code?: string }).code) as string;
              const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
              const required = (batchSizeKg * pct) / 100;
              return { code, inci: (line.inci_name ?? (line as { inci_name?: string }).inci_name) as string, required, dispensed: 0, done: false };
            })
            .filter((x) => x.required > 0);
          setDerivedRm(rmItems);
          setRmLoadError(null);
          return;
        }
        if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'product_bom') {
          setDerivedRm([]);
          setRmLoadError('Batch not linked to Planning BOM. In Planning, send batches to Production, then run Sync from Planning on this page to use the batch-specific BOM.');
          return;
        }
        return fetchPRProducts().then((res) => {
          if (!res.success || !res.data?.length) return null;
          const product = res.data.find((p: { product_sku?: string; product_name?: string }) => p.product_sku === batch.sku || p.product_name === batch.productName);
          return product ? fetchBOMByProductId(product.product_id) : null;
        });
      })
      .then((bomRes) => {
        if (!bomRes) return;
        if (!(bomRes as { success?: boolean; data?: BOMRecord })?.success || !(bomRes as { data?: BOMRecord }).data?.rmLines?.length) {
          setDerivedRm([]);
          setRmLoadError('No BOM or RM lines for this product.');
          return;
        }
        const bom = (bomRes as { data: BOMRecord }).data;
        const batchSizeKg = batch.batchSize || 0;
        const rmLines = (bom.rmLines ?? []) as BOMRmLine[];
        const rmItems: DispensingItem[] = rmLines
          .filter((line) => line.rm_code || (line as { code?: string }).code)
          .map((line) => {
            const code = (line.rm_code || (line as { code?: string }).code) as string;
            const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
            const required = (batchSizeKg * pct) / 100;
            return { code, inci: (line.inci_name ?? (line as { inci_name?: string }).inci_name) as string, required, dispensed: 0, done: false };
          })
          .filter((x) => x.required > 0);
        setDerivedRm(rmItems);
        setRmLoadError(null);
      })
      .catch(() => {
        setDerivedRm([]);
        setRmLoadError('Failed to load BOM.');
      })
      .finally(() => setLoadingRm(false));
  }, [needLoadRm, batch.sku, batch.productName, batch.batchSize, batch._pk, batch.bmrNo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!needLoadPm || !batch.sku) return;
    setLoadingPm(true);
    const batchPk = batch._pk;
    console.log('[BOM-DEBUG] Reserve PM: BMR card batch', { production_batch_id: batchPk, bmrNo: batch.bmrNo, soNo: batch.soNo, table_for_copy_bom: 'planning_batches' });
    const loadBatchBom = batchPk
      ? fetchBOMByBatchId(batchPk)
      : (batch.bmrNo ? fetchBatches().then(rows => { const r = rows.find((x: { bmrNo: string }) => x.bmrNo === batch.bmrNo); return (r as { _pk?: number })?._pk ? fetchBOMByBatchId((r as { _pk: number })._pk) : { success: false as const, data: undefined }; }) : Promise.resolve({ success: false as const, data: undefined }));
    loadBatchBom
      .then((batchBomRes) => {
        console.log('[BOM-DEBUG] Reserve PM: Batch BOM API response', { source: batchBomRes.data?.source, pmLines_count: batchBomRes.data?.pmLines?.length ?? 0 });
        // Reserve PM must use batch-specific BOM from planning_batches. Never show master when backend says product_bom.
        if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'planning_batch') {
          const pmLines = (batchBomRes.data.pmLines ?? []) as BOMPmLine[];
          const batchUnits = (batchBomRes.data.batchSizeKg != null && batchBomRes.data.batchSizeKg > 0)
            ? Math.round(batchBomRes.data.batchSizeKg)
            : (batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : batch.batchSize || 0);
          const pmItems: DispensingItem[] = pmLines
            .filter((line) => line.pm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.pm_code || (line as { code?: string }).code) as string;
              const qtyPerUnit = Number((line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1)) || 1;
              const required = qtyPerUnit * batchUnits;
              return { code, name: (line.description ?? code) as string, required, dispensed: 0, done: false };
            })
            .filter((x) => x.required > 0);
          setDerivedPm(pmItems);
          return;
        }
        if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'product_bom') {
          setDerivedPm([]);
          return;
        }
        return fetchPRProducts().then((res) => {
          if (!res.success || !res.data?.length) return null;
          const product = res.data.find((p: { product_sku?: string; product_name?: string }) => p.product_sku === batch.sku || p.product_name === batch.productName);
          return product ? fetchBOMByProductId(product.product_id) : null;
        });
      })
      .then((bomRes) => {
        if (!bomRes) return;
        if (!(bomRes as { success?: boolean; data?: BOMRecord })?.success || !(bomRes as { data?: BOMRecord }).data?.pmLines?.length) { setDerivedPm([]); return; }
        const bom = (bomRes as { data: BOMRecord }).data;
        const pmLines = (bom.pmLines ?? []) as BOMPmLine[];
        const batchUnits = batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : batch.batchSize || 0;
        const pmItems: DispensingItem[] = pmLines
          .filter((line) => line.pm_code || (line as { code?: string }).code)
          .map((line) => {
            const code = (line.pm_code || (line as { code?: string }).code) as string;
            const qtyPerUnit = Number((line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1)) || 1;
            const required = qtyPerUnit * batchUnits;
            return { code, name: (line.description ?? code) as string, required, dispensed: 0, done: false };
          })
          .filter((x) => x.required > 0);
        setDerivedPm(pmItems);
      })
      .catch(() => setDerivedPm([]))
      .finally(() => setLoadingPm(false));
  }, [needLoadPm, batch.sku, batch.productName, batch.batchSize, batch.orderQty, batch.totalBatches, (batch as Batch & { _pk?: number })._pk]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setPlanningCoverageByCode({});
    fetchPlanningExtractedList()
      .then((rows) => {
        const row = findPlanningRowForBatch(rows, batch);
        if (!row) return [];
        return fetchItemsInvolvedByPlanningId(row.id);
      })
      .then((involved) => {
        if (cancelled || !Array.isArray(involved)) return;
        const next: Record<string, number> = {};
        involved
          .filter((x) => (type === 'rm' ? x.type === 'RM' : x.type === 'PM'))
          .forEach((x) => {
            const code = String(x.code ?? '').trim();
            if (!code) return;
            next[code] = Number(x.coverage ?? 0) || 0;
          });
        setPlanningCoverageByCode(next);
      })
      .catch(() => {
        if (!cancelled) setPlanningCoverageByCode({});
      });
    return () => {
      cancelled = true;
    };
  }, [batch.soNo, batch.productName, batch.sku, batch.batchNo, type]);

  const items = type === 'rm'
    ? (batchItems.length > 0 ? batchItems : derivedRm)
    : (batchItems.length > 0 ? batchItems : derivedPm);
  const usedDerived = type === 'rm' && batchItems.length === 0 && derivedRm.length > 0;

  const reserveItemsFingerprint = useMemo(() => {
    const src =
      type === 'rm'
        ? (batch.dispensingRM.length > 0 ? batch.dispensingRM : derivedRm)
        : (batch.dispensingPM.length > 0 ? batch.dispensingPM : derivedPm);
    return src.map((it) => `${String(it.code ?? '').trim()}:${Number(it.required) || 0}`).join('|');
  }, [type, batch.dispensingRM, batch.dispensingPM, derivedRm, derivedPm]);

  useEffect(() => {
    if (!debugProductionReserveEnabled() || items.length === 0) return;
    const stockKeys = Object.keys(stockMap);
    const bomCodes = items.map((it) => String(it.code ?? '').trim()).filter(Boolean);
    const bomSet = new Set(bomCodes);
    const missingFromWarehouse = bomCodes.filter((c) => !Object.prototype.hasOwnProperty.call(stockMap, c));
    const perLine = items.map((it, i) => {
      const code = String(it.code ?? '').trim();
      const hasKey = Object.prototype.hasOwnProperty.call(stockMap, code);
      const sih = stockMap[code] ?? 0;
      const reserved = reservedMap?.[code] ?? 0;
      const available = Math.max(0, sih - reserved);
      const planningCoverage = planningCoverageByCode[code] ?? 0;
      const planningCovered = planningCoverage >= 100;
      const ciKey =
        !hasKey && code
          ? stockKeys.find((k) => k.toLowerCase() === code.toLowerCase()) ?? null
          : null;
      return {
        row: i,
        bomCodeRaw: it.code,
        bomCodeTrimmed: code,
        hasKeyInStockMap: hasKey,
        caseInsensitiveMatchInWarehouse: ciKey,
        SIH: sih,
        reserved_R: reserved,
        available_Y: available,
        planningCoveragePct: planningCoverage,
        planningCovered,
        required: it.required,
        short: !planningCovered && available < it.required,
      };
    });
    logProductionReserve('Reserve modal: BOM vs warehouse stockMap', {
      type,
      bmrNo: batch.bmrNo,
      bprNo: batch.bprNo,
      formula: 'available_Y = SIH - reserved_R; Short when planningCoveragePct < 100 and available_Y < required',
      stockMapSource: 'GET /api/v1/warehouse-inventory → buildStockMap (sums SIH per trimmed code)',
      bomLineCount: items.length,
      distinctBomCodes: [...new Set(bomCodes)],
      warehouseDistinctKeys: stockKeys.length,
      sampleWarehouseRMOrPMKeys: stockKeys.slice(0, 50),
      missingFromWarehouse,
      warehouseKeysNotOnThisBOM: stockKeys.filter((k) => !bomSet.has(k)).slice(0, 30),
      perLine,
      hint:
        missingFromWarehouse.length > 0
          ? 'Fix: align planning/BOM rm_code (or pm_code) with raw_materials.code / pack_materials.code. Check trim and case — lookup is case-sensitive.'
          : perLine.some((p) => p.short)
            ? 'Keys match but quantity short: increase SIH or reduce reserved elsewhere.'
            : undefined,
    });
  }, [reserveItemsFingerprint, stockMap, reservedMap, planningCoverageByCode, type, batch.bmrNo, batch.bprNo]);

  useEffect(() => {
    const next: Record<number, boolean> = {};
    items.forEach((_, i) => { next[i] = selected[i] !== false; });
    setSelected(prev => (Object.keys(next).length ? next : prev));
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (type === 'rm') {
      const updates: Partial<Batch> = { rmReserved: true, bmrStatus: batch.bmrStatus === 'batch_confirmed' ? 'rm_reserved' : batch.bmrStatus };
      if (usedDerived) updates.dispensingRM = derivedRm;
      onSave(updates);
    } else {
      onSave({ pmReserved: true, bprStatus: 'pm_reserved' });
    }
    onClose();
  };

  const title = type === 'rm' ? `Reserve RM — ${batch.bmrNo}` : `Reserve PM — ${batch.bprNo}`;
  const alertMsg = type === 'rm'
    ? <>Select RM items to reserve in Warehouse against BMR <b>{batch.bmrNo}</b>. Available = WH SIH − Reserved. Reserved stock won&apos;t be allocated to other orders. After reserving, use <b>RM Transfer</b> in batch detail to raise a transfer request.</>
    : <>Reserve Packaging Materials for BPR <b>{batch.bprNo}</b>. Available = SIH − Reserved.</>;

  /** Reserve allocates warehouse free stock only — Planning “coverage” must not override SIH − reserved. */
  const itemHasWhShort = (r: DispensingItem) => {
    const code = String(r.code ?? '').trim();
    const sih = stockMap[code] ?? 0;
    const reserved = reservedMap?.[code] ?? 0;
    const available = Math.max(0, sih - reserved);
    return available < r.required;
  };
  const rmHasShort = type === 'rm' && items.some(itemHasWhShort);
  const pmHasShort = type === 'pm' && items.some(itemHasWhShort);
  const reserveDisabled = items.length === 0 || rmHasShort || pmHasShort;
  const processOwnerText = (parts: { underGrn: number; inTransit: number; poOpen: number }) => {
    if (parts.underGrn > 0) return 'Contact Warehouse GRN/QC team';
    if (parts.inTransit > 0) return 'Contact Procurement logistics follow-up';
    if (parts.poOpen > 0) return 'Contact Procurement PO owner/vendor';
    return 'Check Planning/Procurement release and stock coding';
  };

  return (
    <Modal onClose={onClose} title={title} size="lg">
      <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2.5 flex gap-2 items-start text-xs mb-4">
        <div>{alertMsg}</div>
      </div>
      {(type === 'rm' && needLoadRm && loadingRm) || (type === 'pm' && needLoadPm && loadingPm) ? (
        <div className="py-6 text-center text-sm text-gray-500">Loading {type.toUpperCase()} requirements…</div>
      ) : null}
      {type === 'rm' && needLoadRm && !loadingRm && rmLoadError && (
        <div className="py-3 px-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">{rmLoadError}</div>
      )}
      {items.length === 0 && !(type === 'rm' && needLoadRm && loadingRm) && !(type === 'pm' && needLoadPm && loadingPm) && (
        <div className="py-3 px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">No {type.toUpperCase()} items for this batch. {type === 'rm' ? 'Ensure the product has a BOM with RM lines (same as RM & PM Availability tab).' : 'Ensure the product has a BOM with PM lines.'}</div>
      )}
      {items.length > 0 && (
        <div className="tbl-wrap overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-3 py-2.5 w-10 text-left font-semibold text-gray-500"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">{type === 'rm' ? 'RM / INCI' : 'PM'}</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">{type === 'rm' ? 'Required KG' : 'Required'}</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">{type === 'rm' ? 'WH SIH' : 'SIH'}</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Reserved</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Available</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((r, i) => {
                const code = String(r.code ?? '').trim();
                const sih = stockMap[code] ?? 0;
                const reserved = reservedMap?.[code] ?? 0;
                const available = Math.max(0, sih - reserved);
                const planningCoverage = planningCoverageByCode[code] ?? 0;
                const whOk = available >= r.required;
                const checked = selected[i] !== false;
                const stageRows = (inventoryRows ?? []).filter((row) =>
                  row.type === (type === 'rm' ? 'RM' : 'PM') && String(row.code ?? '').trim() === code
                );
                const inTransitStage = stageRows.reduce((s, row) => s + (Number(row.inTransit) || 0), 0);
                const underGrnStage = stageRows.reduce((s, row) => s + (Number((row as WarehouseInventoryRow & { underGrn?: number }).underGrn) || 0), 0);
                const poOpenStage = stageRows.reduce((s, row) => s + (Number(row.poQuantity) || 0), 0);
                const shortageQty = Math.max(0, r.required - available);
                return (
                  <tr key={i} className={!whOk ? 'bg-red-50/50' : ''}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" id={`res-${i}`} checked={checked} onChange={e => setSelected(prev => ({ ...prev, [i]: e.target.checked }))} className="rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-800">{r.inci || r.name || r.code}</div>
                      <div className="text-[9px] text-gray-500">{r.code}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold">{type === 'rm' ? `${fmt(r.required)} KG` : `${fmt(r.required)} pcs`}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700">{type === 'rm' ? `${fmt(sih)} KG` : `${fmt(sih)} pcs`}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-600">{type === 'rm' ? `${fmt(reserved)} KG` : `${fmt(reserved)} pcs`}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${whOk ? 'text-emerald-600' : 'text-red-600'}`}>{type === 'rm' ? `${fmt(available)} KG` : `${fmt(available)} pcs`}</td>
                    <td className="px-3 py-2.5">
                      {whOk ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[8.5px]">OK</Badge>
                      ) : (
                        <div className="space-y-1.5">
                          <span title={`Planning Items Involved coverage (reference): ${planningCoverage}%. Reserve still needs WH available ≥ required.`}>
                            <Badge className="bg-red-100 text-red-600 text-[8.5px]"><AlertTriangle size={10} /> Short</Badge>
                          </span>
                          <div className="text-[10px] leading-tight text-red-700">
                            <div>
                              Short {fmt(shortageQty)} {unit} | Under GRN {fmt(underGrnStage)} | In Transit {fmt(inTransitStage)} | PO open {fmt(poOpenStage)}
                            </div>
                            <div className="text-[9px] text-red-800/80">
                              {processOwnerText({ underGrn: underGrnStage, inTransit: inTransitStage, poOpen: poOpenStage })}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        {type === 'rm' && rmHasShort && (
          <span className="text-xs text-red-600 font-medium mr-auto">Cannot reserve RM while free warehouse stock is below required (SIH − Reserved). Match Planning Items Involved — receive stock or release procurement first.</span>
        )}
        {type === 'pm' && pmHasShort && (
          <span className="text-xs text-red-600 font-medium mr-auto">Cannot reserve PM while free warehouse stock is below required (SIH − Reserved).</span>
        )}
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={reserveDisabled}>
          Reserve {type === 'rm' ? 'RM' : 'PM'}
        </button>
      </div>
    </Modal>
  );
}

/* ──────────── SMART SCHEDULE MODAL ─────────────────────────── */

interface SalesOrderOption { orderId: string; customerName?: string; }

function ScheduleModal({ batch: initialBatch, equipment, batches, stockRM, stockPM, sentSummary, onClose, onSave, onBatchChange }: {
  batch: Batch | null; equipment: EquipmentData; batches: Batch[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  sentSummary: SentBatchSummaryRow[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onBatchChange: (bmrNo: string) => void;
}) {
  const [salesOrders, setSalesOrders] = useState<SalesOrderOption[]>([]);
  const [selectedSoId, setSelectedSoId] = useState(initialBatch?.soNo ?? '');
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(initialBatch ?? null);

  // Only batches sent from Planning (all shortfall resolved + Send To Production) can be scheduled
  // Match batch so_no to SO orderId: backend may store SO as "EI-SO-2026-003" and batch as "SO-2026-003" (or vice versa)
  const batchesForSo = batches.filter(b => batchMatchesSo(b.soNo, selectedSoId));
  // Show unscheduled batches for this SO (RM/PM can be reserved later in BMR steps)
  const schedulableForSo = batchesForSo.filter(b => !b.mfgDate);

  useEffect(() => {
    fetchSalesOrders().then(({ data }) => {
      if (data && data.length) setSalesOrders(data.map(o => ({ orderId: o.orderId, customerName: o.customerName })));
    });
  }, []);

  useEffect(() => {
    if (initialBatch) {
      setSelectedSoId(initialBatch.soNo);
      setSelectedBatch(initialBatch);
    }
  }, [initialBatch?.bmrNo, initialBatch?.soNo]);

  const handleSoChange = (soId: string) => {
    setSelectedSoId(soId);
    setSelectedBatch(null);
  };

  const handleBatchSwitch = (bmrNo: string) => {
    const found = batches.find(b => b.bmrNo === bmrNo);
    if (found) { setSelectedBatch(found); onBatchChange(bmrNo); }
  };

  const batch = selectedBatch;
  const isScheduled = batch ? (batch.bmrStatus === 'scheduled' || !!batch.mfgDate) : false;
  const batchVolL = batch ? (batch.requiredVolumeLiters ?? batch.batchSize) : 0;
  const mfgList = equipment?.manufacturing ?? [];
  const compatVBase = batch ? (batch.compatibleVessels?.length ? batch.compatibleVessels : mfgList.filter(e => e.type !== 'support' && (e.cap ?? 0) >= batchVolL).map(e => e.id)) : [];
  const compatV = compatVBase.length > 0 ? compatVBase : mfgList.filter(e => e.type !== 'support').map(e => e.id);
  const compatF = batch ? (batch.compatibleFillLines?.length ? batch.compatibleFillLines : (equipment?.filling ?? []).filter(e => e.compatible?.includes(batch.fillingType || 'bottle')).map(e => e.id)) : [];
  const compatP = batch ? (batch.compatiblePackLines?.length ? batch.compatiblePackLines : (equipment?.packaging ?? []).map(e => e.id)) : [];

  const scheduledBatchesWithUnits = useMemo(() => toScheduledBatchesWithUnits(batches), [batches]);
  const batchWithUnits = batch
    ? { ...batch, ...getBatchFillPackUnits(batch), bmrNo: batch.bmrNo }
    : null;
  const bestRecommendation = batchWithUnits
    ? computeBestScheduleRecommendation(batchWithUnits, equipment, scheduledBatchesWithUnits)
    : null;

  const [mfgDate, setMfgDate] = useState(batch?.mfgDate || today());
  const [fillDate, setFillDate] = useState(batch?.fillDate || addDaysStr(batch?.mfgDate || today(), 3));
  const [packDate, setPackDate] = useState(batch?.packDate || addDaysStr(batch?.fillDate || addDaysStr(today(), 3), 1));
  const [fgDate, setFgDate] = useState(batch?.fgDate || addDaysStr(batch?.packDate || addDaysStr(today(), 4), 1));
  const [rmDate, setRmDate] = useState(batch?.rmConnectDate || addDaysStr(batch?.mfgDate || today(), -2));
  const [pmDate, setPmDate] = useState(batch?.pmConnectDate || addDaysStr(batch?.fillDate || addDaysStr(today(), 3), -2));
  const [vessel, setVessel] = useState(batch?.mainVessel || compatV[0] || '');
  const [fillLine, setFillLine] = useState(batch?.fillingLine || compatF[0] || '');
  const [packLine, setPackLine] = useState(batch?.packagingLine || compatP[0] || '');

  useEffect(() => {
    if (!batch) return;
    setMfgDate(batch.mfgDate || today());
    setFillDate(batch.fillDate || addDaysStr(batch.mfgDate || today(), 3));
    setPackDate(batch.packDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), 1));
    setFgDate(batch.fgDate || addDaysStr(batch.packDate || addDaysStr(today(), 4), 1));
    setRmDate(batch.rmConnectDate || addDaysStr(batch.mfgDate || today(), -2));
    setPmDate(batch.pmConnectDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), -2));
    setVessel(batch.mainVessel || compatV[0] || '');
    setFillLine(batch.fillingLine || compatF[0] || '');
    setPackLine(batch.packagingLine || compatP[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.bmrNo]);

  useEffect(() => {
    if (!batch) return;
    setMfgDate(batch.mfgDate || today());
    setFillDate(batch.fillDate || addDaysStr(batch.mfgDate || today(), 3));
    setPackDate(batch.packDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), 1));
    setFgDate(batch.fgDate || addDaysStr(batch.packDate || addDaysStr(today(), 4), 1));
    setRmDate(batch.rmConnectDate || addDaysStr(batch.mfgDate || today(), -2));
    setPmDate(batch.pmConnectDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), -2));
    setVessel(batch.mainVessel || compatV[0] || '');
    setFillLine(batch.fillingLine || compatF[0] || '');
    setPackLine(batch.packagingLine || compatP[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.bmrNo]);

  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(addDaysStr(val, -2));
    const f = addDaysStr(val, 3); setFillDate(f); setPmDate(addDaysStr(f, -2));
    const p = addDaysStr(f, 1); setPackDate(p); setFgDate(addDaysStr(p, 1));
  };

  const handleSave = () => {
    if (!batch || !mfgDate) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    onSave({
      mfgDate, fillDate, packDate, fgDate, rmConnectDate: rmDate, pmConnectDate: pmDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine,
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleConfirmRecommendation = () => {
    if (!batch || !bestRecommendation) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    onSave({
      mfgDate: bestRecommendation.mfgDate,
      fillDate: bestRecommendation.fillDate,
      packDate: bestRecommendation.packDate,
      fgDate: bestRecommendation.fgDate,
      rmConnectDate: bestRecommendation.rmConnectDate,
      pmConnectDate: bestRecommendation.pmConnectDate,
      mainVessel: bestRecommendation.vessel,
      fillingLine: bestRecommendation.fillLine,
      packagingLine: bestRecommendation.packLine,
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleUnschedule = () => {
    if (!batch || !confirm(`Clear schedule for ${batch.bmrNo}? Dates and equipment assignments will be removed.`)) return;
    const lockedBmr: BMRStatus[] = ['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
    onSave({
      mfgDate: '', fillDate: '', packDate: '', fgDate: '', rmConnectDate: '', pmConnectDate: '',
      mainVessel: '', fillingLine: '', packagingLine: '',
      ...(lockedBmr.includes(batch.bmrStatus)
        ? {}
        : { bmrStatus: batch.rmReserved ? 'rm_reserved' : 'batch_confirmed' }),
    });
    onClose();
  };

  const scheduleRow = (icon: React.ReactNode, label: string, color: string, dateVal: string, setDate: (v: string) => void, equipList: string[], equipVal: string, setEquip: (v: string) => void) => (
    <div className={`grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-3 rounded-xl border mb-2 ${color}`}>
      <span className="text-gray-500">{icon}</span>
      <div className="text-[11px] font-bold text-gray-700">{label}</div>
      <div><label className={LBL}>Date</label><input type="date" className={INP} value={dateVal} onChange={e => setDate(e.target.value)} /></div>
      <div><label className={LBL}>Equipment</label>
        <select className={INP} value={equipVal} onChange={e => setEquip(e.target.value)}>
          <option value="">-- Select --</option>
          {equipList.map(id => {
            const free = isEquipFreeOnDate(batches, id, dateVal);
            return <option key={id} value={id}>{id} {free ? '(Free)' : '(Busy)'}</option>;
          })}
        </select>
      </div>
    </div>
  );

  const subtitle = batch
    ? `${batch.productName} - Batch ${batch.batchIndex}/${batch.totalBatches} - ${batch.batchSize} KG`
    : 'Select Sales Order and batch (BMR/BPR) to schedule';

  return (
    <Modal onClose={onClose} title="Schedule Batch" subtitle={subtitle} size="xl">
      {/* Sales Order selector */}
      <div className="mb-4">
        <label className={LBL}>Sales Order (SO)</label>
        <select className={INP} value={selectedSoId} onChange={e => handleSoChange(e.target.value)}>
          <option value="">-- Select SO --</option>
          {salesOrders.map(so => (
            <option key={so.orderId} value={so.orderId}>
              {so.orderId}{so.customerName ? ` — ${so.customerName}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Batch selector (filtered by SO) */}
      <div className="mb-4">
        <label className={LBL}>Select Batch (BMR / BPR)</label>
        <select
          className={INP}
          value={batch?.bmrNo ?? ''}
          onChange={e => handleBatchSwitch(e.target.value)}
          disabled={!selectedSoId}
        >
          <option value="">-- Select batch --</option>
          {batchesForSo.map(b => (
            <option key={b.bmrNo} value={b.bmrNo}>
              {b.bmrNo} / {b.bprNo} — {b.productName} ({b.batchSize} KG) [{bmrStatusLabel[b.bmrStatus]}]{b.mfgDate ? ` · ${b.mfgDate}` : ''}
            </option>
          ))}
        </select>
        {selectedSoId && batchesForSo.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No batches found for this SO. Create batches for this SO first (e.g. from Planning).</p>
        )}
      </div>

      {!batch && (
        <>
          <p className="text-sm text-gray-500 mb-4">Select a Sales Order and a batch above to set the schedule.</p>
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </>
      )}

      {batch && (
        <>
          <ScheduleYieldContextBanner batch={batch} />
          {bprAwaitingBmrRelease(batch) && (
            <Tip color="amber" icon={<Calendar size={14} />}>
              BMR is not cleared yet — you can still <b>move fill, pack, and FG dates</b> here if the BPR plan slips while waiting on bulk QC release.
            </Tip>
          )}
          {/* Recommended schedule from occupancy + volume (MV/FL/PL capacity vs batch volume) */}
          {bestRecommendation && !isScheduled && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 mb-5">
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Recommended schedule (by occupancy &amp; volume)</div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{bestRecommendation.confidenceScore}% optimal</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/60 mb-2">
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5">Manufacturing</div>
                  <div className="text-[11.5px] font-bold text-teal-700">{bestRecommendation.vesselName}</div>
                  <div className="text-[10px] text-gray-500">{bestRecommendation.mfgDate}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5">Filling</div>
                  <div className="text-[11.5px] font-bold text-purple-700">{bestRecommendation.fillLineName}</div>
                  <div className="text-[10px] text-gray-500">{bestRecommendation.fillDate}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5">Packaging</div>
                  <div className="text-[11.5px] font-bold text-emerald-700">{bestRecommendation.packLineName}</div>
                  <div className="text-[10px] text-gray-500">{bestRecommendation.packDate}</div>
                </div>
              </div>
              {(batch.requiredVolumeLiters != null || (bestRecommendation.vessel && equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)?.cap != null)) && (
                <div className="text-[10px] text-gray-600 mb-2">
                  {batch.requiredVolumeLiters != null && <span className="mr-3">Batch volume: <b>{batch.requiredVolumeLiters.toFixed(1)} L</b></span>}
                  {bestRecommendation.vessel && equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)?.cap != null && (
                    <span>Vessel capacity: <b>{equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)!.cap} L</b></span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {bestRecommendation.reasons.map((r, i) => (
                  <div key={i} className="flex-1 min-w-0 text-[9.5px] text-gray-600 bg-white/60 rounded px-2 py-1 border border-gray-100">{r}</div>
                ))}
              </div>
              <button type="button" onClick={handleConfirmRecommendation} className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <Check size={14} /> One-click confirm
              </button>
            </div>
          )}

          {/* Material Availability from DB */}
          <div className="mb-5">
            <SectionLabel icon={<Package size={13} />} color="text-orange-600">Material Availability - Warehouse Inventory</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SectionLabel icon={<FlaskConical size={12} />} color="text-teal-600">Raw Materials</SectionLabel>
                {batch.dispensingRM.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
                    <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">RM</th><th className="px-2 py-1.5 text-left">Req</th><th className="px-2 py-1.5 text-left">SIH</th><th className="px-2 py-1.5 text-left">Status</th></tr></thead>
                      <tbody className="divide-y divide-gray-50">{batch.dispensingRM.map((r, i) => {
                        const sih = stockRM[r.code] ?? 0; const ok = sih >= r.required;
                        return <tr key={i} className={!ok ? 'bg-red-50/50' : ''}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 font-mono">{r.required}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-emerald-100 text-emerald-700">OK</Badge> : <Badge className="bg-red-100 text-red-600">Short</Badge>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-gray-400 italic">No RM items on this batch</p>}
              </div>
              <div>
                <SectionLabel icon={<Package size={12} />} color="text-purple-600">Packaging Materials</SectionLabel>
                {batch.dispensingPM.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
                    <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">PM</th><th className="px-2 py-1.5 text-left">Req</th><th className="px-2 py-1.5 text-left">SIH</th><th className="px-2 py-1.5 text-left">Status</th></tr></thead>
                      <tbody className="divide-y divide-gray-50">{batch.dispensingPM.map((p, i) => {
                        const sih = stockPM[p.code] ?? 0; const ok = sih >= p.required;
                        return <tr key={i} className={!ok ? 'bg-red-50/50' : ''}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 font-mono">{fmt(p.required)}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-emerald-100 text-emerald-700">OK</Badge> : <Badge className="bg-red-100 text-red-600">Short</Badge>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-gray-400 italic">No PM items on this batch</p>}
              </div>
            </div>
          </div>

          {/* Sequential Schedule */}
          <div className="border border-orange-100 rounded-2xl p-5 bg-orange-50/20">
            <SectionLabel icon={<Calendar size={13} />} color="text-orange-600">Sequential Schedule - Manufacturing {'>'} Filling {'>'} Packaging</SectionLabel>
            <Tip color="teal" icon={<Sparkles size={14} />}>System auto-suggested dates based on equipment availability. Adjust if needed.</Tip>

            {scheduleRow(<FlaskConical size={16} />, 'STAGE 1 - Manufacturing', 'border-teal-200 bg-teal-50/40', mfgDate, handleMfgChange, compatV, vessel, setVessel)}

            <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-gray-100 bg-gray-50/50 mb-2">
              <Package size={14} className="text-gray-400" /><div className="text-[10px] text-gray-500 font-semibold">RM Ready at WH by</div>
              <div><input type="date" className={INP} value={rmDate} onChange={e => setRmDate(e.target.value)} /></div>
              <div className="text-[10px] text-gray-400">Suggest: 2 days before MFG</div>
            </div>

            {scheduleRow(<Droplets size={16} />, 'STAGE 2 - Filling', 'border-purple-200 bg-purple-50/40', fillDate, setFillDate, compatF, fillLine, setFillLine)}

            <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-gray-100 bg-gray-50/50 mb-2">
              <Package size={14} className="text-gray-400" /><div className="text-[10px] text-gray-500 font-semibold">PM Ready at WH by</div>
              <div><input type="date" className={INP} value={pmDate} onChange={e => setPmDate(e.target.value)} /></div>
              <div className="text-[10px] text-gray-400">Suggest: 2 days before Fill</div>
            </div>

            {scheduleRow(<Package size={16} />, 'STAGE 3 - Packaging', 'border-emerald-200 bg-emerald-50/40', packDate, setPackDate, compatP, packLine, setPackLine)}

            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/40">
              <CheckCircle2 size={16} className="text-blue-500" /><div className="text-[11px] font-bold text-blue-700">FG Ready</div>
              <div><label className={LBL}>FG Date</label><input type="date" className={INP} value={fgDate} onChange={e => setFgDate(e.target.value)} /></div>
              <div></div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
              <span>MFG: <b>{mfgDate}</b></span><span>Fill: <b>{fillDate}</b></span><span>Pack: <b>{packDate}</b></span>
              <span>FG: <b>{fgDate}</b></span><span>RM@WH: <b>{rmDate}</b></span><span>PM@WH: <b>{pmDate}</b></span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <div>
              {isScheduled && (
                <button onClick={handleUnschedule} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><X size={12} /> Unschedule</button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!batch} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><CheckCircle2 size={13} /> {isScheduled ? 'Update Schedule' : 'Save Schedule'}</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ──────────── SMART SCHEDULE MODAL (from calendar cell) ─────── */

function SmartScheduleModal({ slot, batch: initialBatch, equipment, batches, stockRM, stockPM, sentSummary, onClose, onSave, onBatchChange }: {
  slot: ScheduleSlot; batch: Batch | null; equipment: EquipmentData; batches: Batch[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  sentSummary: SentBatchSummaryRow[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onBatchChange: (bmrNo: string) => void;
}) {
  // SOs raised to production = distinct soNo from batches
  const soListRaised = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => { if (b.soNo) set.add(b.soNo); });
    return Array.from(set).sort();
  }, [batches]);
  // Batches raised to production = schedulable (batch_confirmed or rm_reserved, not yet scheduled)
  const batchesRaised = useMemo(() => batches.filter(b =>
    !b.mfgDate && (b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved')
  ), [batches]);

  const [selectedSoId, setSelectedSoId] = useState(initialBatch?.soNo ?? '');
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(initialBatch ?? null);

  const batchVolL = (b: Batch) => b.requiredVolumeLiters ?? b.batchSize;
  const mfgForCompat = equipment?.manufacturing ?? [];
  const compatForSlot = (b: Batch): boolean => {
    const compatVBase = b.compatibleVessels?.length ? b.compatibleVessels : mfgForCompat.filter(e => e.type !== 'support' && (e.cap ?? 0) >= batchVolL(b)).map(e => e.id);
    const compatV = compatVBase.length > 0 ? compatVBase : mfgForCompat.filter(e => e.type !== 'support').map(e => e.id);
    const compatF = b.compatibleFillLines?.length ? b.compatibleFillLines : (equipment?.filling ?? []).filter(e => e.compatible?.includes(b.fillingType || 'bottle')).map(e => e.id);
    const compatP = b.compatiblePackLines?.length ? b.compatiblePackLines : (equipment?.packaging ?? []).map(e => e.id);
    if (slot.category === 'mfg') return compatV.includes(slot.equipId);
    if (slot.category === 'fill') return compatF.includes(slot.equipId);
    return compatP.includes(slot.equipId);
  };

  const batchesForSo = batchesRaised.filter(b => batchMatchesSo(b.soNo, selectedSoId));

  useEffect(() => {
    if (initialBatch) {
      setSelectedSoId(initialBatch.soNo ?? '');
      setSelectedBatch(initialBatch);
    }
  }, [initialBatch?.bmrNo]);

  const batch = selectedBatch;
  const scheduledBatchesWithUnits = useMemo(() => toScheduledBatchesWithUnits(batches), [batches]);
  const batchWithUnits = batch
    ? { ...batch, ...getBatchFillPackUnits(batch), bmrNo: batch.bmrNo }
    : null;
  const recommendation: ScheduleRecommendationResult | null = batchWithUnits
    ? computeRecommendedScheduleForSlot(slot, batchWithUnits, equipment, scheduledBatchesWithUnits)
    : null;

  const [bomVolumeRequired, setBomVolumeRequired] = useState<number | null>(null);

  // Fetch batch BOM (planning batch when available) and compute volume from rm_lines
  useEffect(() => {
    if (!batch?.sku && !batch?.productName) {
      setBomVolumeRequired(null);
      return;
    }
    setBomVolumeRequired(null);
    const batchPk = (batch as Batch & { _pk?: number })._pk;
    const loadBatchBom = batchPk ? fetchBOMByBatchId(batchPk) : Promise.resolve({ success: false, data: undefined });
    loadBatchBom
      .then((batchBomRes) => {
        // Use batch-specific BOM from planning_batches for volume; do not fall back to master when source is planning_batch.
        const useBatchBom = batchBomRes.success && batchBomRes.data && (
          batchBomRes.data.source === 'planning_batch' || (batchBomRes.data.rmLines?.length ?? 0) > 0
        );
        if (useBatchBom && batchBomRes.data) {
          const rmLines = (batchBomRes.data.rmLines ?? []) as BOMRmLine[];
          const vol = rmLines.length
            ? computeVolumeFromBomRmLines(batch!.batchSize ?? 0, rmLines)
            : null;
          setBomVolumeRequired(vol);
          return;
        }
        return fetchPRProducts().then((res) => {
          if (!res.success || !res.data?.length) return null;
          const product = res.data.find((p: { product_sku?: string; product_name?: string }) => p.product_sku === batch!.sku || p.product_name === batch!.productName);
          return product ? fetchBOMByProductId(product.product_id) : null;
        });
      })
      .then((bomRes) => {
        if (!bomRes || !(bomRes as { success?: boolean; data?: BOMRecord })?.success || !(bomRes as { data?: BOMRecord }).data?.rmLines?.length) return;
        const vol = computeVolumeFromBomRmLines(batch!.batchSize ?? 0, (bomRes as { data: BOMRecord }).data.rmLines as BOMRmLine[]);
        setBomVolumeRequired(vol);
      })
      .catch(() => setBomVolumeRequired(null));
  }, [batch?.bmrNo, batch?.sku, batch?.productName, batch?.batchSize, (batch as Batch & { _pk?: number })?._pk]);

  // Log RM volume breakdown when batch is selected (Smart Schedule)
  useEffect(() => {
    if (!batch?.dispensingRM?.length) return;
    const breakdown = computeRmVolumeBreakdown(
      batch.dispensingRM.map((r) => ({ code: r.code, required: r.required, specificGravity: (r as { specificGravity?: number }).specificGravity })),
    );
    console.log('[Smart Schedule] RM volume breakdown:', {
      batch: batch.bmrNo,
      totalRMs: breakdown.lines.length,
      lines: breakdown.lines.map((l) => `${l.code}: ${l.kg} kg → SG ${l.specificGravity} → ${l.volumeL} L`),
      totalVolumeL: breakdown.totalVolumeL,
    });
  }, [batch?.bmrNo, batch?.dispensingRM]);

  const [mfgDate, setMfgDate] = useState(recommendation?.mfgDate ?? today());
  const [fillDate, setFillDate] = useState(recommendation?.fillDate ?? addDaysStr(today(), 3));
  const [packDate, setPackDate] = useState(recommendation?.packDate ?? addDaysStr(today(), 4));
  const [fgDate, setFgDate] = useState(recommendation?.fgDate ?? addDaysStr(today(), 5));
  const [rmDate, setRmDate] = useState(recommendation?.rmConnectDate ?? addDaysStr(today(), -2));
  const [pmDate, setPmDate] = useState(recommendation?.pmConnectDate ?? addDaysStr(today(), 3));
  const [vessel, setVessel] = useState(recommendation?.vessel ?? '');
  const [fillLine, setFillLine] = useState(recommendation?.fillLine ?? '');
  const [packLine, setPackLine] = useState(recommendation?.packLine ?? '');

  useEffect(() => {
    if (!recommendation) return;
    setMfgDate(recommendation.mfgDate ?? today());
    setFillDate(recommendation.fillDate ?? addDaysStr(today(), 3));
    setPackDate(recommendation.packDate ?? addDaysStr(today(), 4));
    setFgDate(recommendation.fgDate ?? addDaysStr(today(), 5));
    setRmDate(recommendation.rmConnectDate ?? addDaysStr(today(), -2));
    setPmDate(recommendation.pmConnectDate ?? addDaysStr(today(), 3));
    setVessel(recommendation.vessel ?? '');
    setFillLine(recommendation.fillLine ?? '');
    setPackLine(recommendation.packLine ?? '');
  }, [recommendation?.mfgDate, recommendation?.fillDate, recommendation?.packDate, recommendation?.vessel, recommendation?.fillLine, recommendation?.packLine]);

  const batchVolLNum = batch ? (batch.requiredVolumeLiters ?? batch.batchSize) : 0;
  const mfgList = equipment?.manufacturing ?? [];
  const compatVBase = batch ? (batch.compatibleVessels?.length ? batch.compatibleVessels : mfgList.filter(e => e.type !== 'support' && (e.cap ?? 0) >= batchVolLNum).map(e => e.id)) : [];
  const compatV = compatVBase.length > 0 ? compatVBase : mfgList.filter(e => e.type !== 'support').map(e => e.id);
  const compatF = batch ? (batch.compatibleFillLines?.length ? batch.compatibleFillLines : (equipment?.filling ?? []).filter(e => e.compatible?.includes(batch.fillingType || 'bottle')).map(e => e.id)) : [];
  const compatP = batch ? (batch.compatiblePackLines?.length ? batch.compatiblePackLines : (equipment?.packaging ?? []).map(e => e.id)) : [];

  const handleAcceptRecommendation = () => {
    if (!recommendation || !batch) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    onSave({
      mfgDate: recommendation.mfgDate, fillDate: recommendation.fillDate, packDate: recommendation.packDate, fgDate: recommendation.fgDate,
      rmConnectDate: recommendation.rmConnectDate, pmConnectDate: recommendation.pmConnectDate,
      mainVessel: recommendation.vessel, fillingLine: recommendation.fillLine, packagingLine: recommendation.packLine,
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleSaveManual = () => {
    if (!batch || !mfgDate) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    onSave({
      mfgDate, fillDate, packDate, fgDate, rmConnectDate: rmDate, pmConnectDate: pmDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine,
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(addDaysStr(val, -2));
    const f = addDaysStr(val, 3); setFillDate(f); setPmDate(addDaysStr(f, -2));
    const p = addDaysStr(f, 1); setPackDate(p); setFgDate(addDaysStr(p, 1));
  };

  const modalTitle = batch ? `Smart Schedule — ${batch.bmrNo}` : 'Smart Schedule — Select batch';
  const modalSub = batch ? `${batch.productName} · Batch ${batch.batchIndex}/${batch.totalBatches} · ${batch.batchSize} KG` : 'Choose a batch to schedule in this slot';

  const vesselCap = vessel ? (equipment.manufacturing.find(e => e.id === vessel)?.cap ?? null) : null;
  const batchVol = batch?.requiredVolumeLiters ?? null;
  const volumeRequiredFromRm = batch?.dispensingRM?.length
    ? computeRmVolumeBreakdown(batch.dispensingRM.map((r) => ({ code: r.code, required: r.required, specificGravity: (r as { specificGravity?: number }).specificGravity }))).totalVolumeL
    : null;
  const volumeRequiredInBatch = bomVolumeRequired ?? volumeRequiredFromRm ?? batchVol;
  const otherOnVesselDate = batches.filter(b => b.mainVessel === vessel && b.mfgDate === mfgDate && b.bmrNo !== batch?.bmrNo);
  const totalScheduledL = otherOnVesselDate.reduce((s, b) => s + (b.requiredVolumeLiters ?? 0), 0);
  const totalWithThis = (totalScheduledL + (volumeRequiredInBatch ?? batchVol ?? 0));
  const overCapacity = vesselCap != null && (volumeRequiredInBatch ?? batchVol) != null && (volumeRequiredInBatch ?? batchVol)! > vesselCap;
  const overTotalCapacity = vesselCap != null && totalWithThis > vesselCap;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-[2px] p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 border border-gray-100" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="modal-title text-base font-bold text-gray-900 tracking-tight" id="sch-title">{modalTitle}</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5" id="sch-sub">{modalSub}</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Close">×</button>
        </div>

        <div className="modal-body px-6 py-5 max-h-[65vh] overflow-y-auto" id="sch-body">
          {/* SO and Batch dropdowns — always shown so user can pick/change BMR */}
          <div className="mb-4 space-y-4">
            <div>
              <label className={LBL}>SOs raised to production</label>
              <select className={INP} value={selectedSoId} onChange={e => { setSelectedSoId(e.target.value); setSelectedBatch(null); }}>
                <option value="">— Select SO —</option>
                {soListRaised.map(so => (
                  <option key={so} value={so}>{so}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LBL}>Batches raised to production</label>
              <select className={INP} value={batch?.bmrNo ?? ''} onChange={e => {
                const list = selectedSoId ? batchesForSo : batchesRaised;
                const b = list.find(x => x.bmrNo === e.target.value) ?? null;
                setSelectedBatch(b);
                if (b) onBatchChange(b.bmrNo);
              }}>
                <option value="">— Select batch —</option>
                {(selectedSoId ? batchesForSo : batchesRaised).map(b => (
                  <option key={b.bmrNo} value={b.bmrNo}>{b.bmrNo} — {b.productName ?? b.sku ?? 'Product'} ({b.batchSize} KG){b.mfgDate ? ` (scheduled ${b.mfgDate})` : ' (unscheduled)'}</option>
                ))}
              </select>
              {selectedSoId && batchesForSo.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No unscheduled batches for this SO.</p>
              )}
            </div>
          </div>

          {batch && <ScheduleYieldContextBanner batch={batch} />}
          {batch && bprAwaitingBmrRelease(batch) && (
            <div className="mb-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/80 text-[11px] text-amber-900">
              <span className="font-semibold">Awaiting BMR QC release</span> — you can still adjust <b>fill / pack / FG dates</b> (and MFG if shown) to absorb BPR-side delays.
            </div>
          )}

          {!batch && (
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          )}

          {batch && recommendation && (
            <>
              {/* Recommended schedule card */}
              <div className="rec-card rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 mb-4">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="rec-card-title text-[10px] font-bold text-gray-600 uppercase tracking-wider">Recommended schedule</div>
                  <span className="rec-score text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{recommendation.confidenceScore}% optimal</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/60 mb-2">
                  <div>
                    <div className="text-[9px] text-gray-500 mb-0.5">Manufacturing</div>
                    <div className="text-[11.5px] font-bold text-teal-700">{recommendation.vesselName || recommendation.vessel || '—'}</div>
                    <div className="text-[10px] text-gray-500">{recommendation.mfgDate || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-500 mb-0.5">Filling</div>
                    <div className="text-[11.5px] font-bold text-purple-700">{recommendation.fillLineName || recommendation.fillLine || '—'}</div>
                    <div className="text-[10px] text-gray-500">{recommendation.fillDate || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-500 mb-0.5">Packaging</div>
                    <div className="text-[11.5px] font-bold text-emerald-700">{recommendation.packLineName || recommendation.packLine || '—'}</div>
                    <div className="text-[10px] text-gray-500">{recommendation.packDate || '—'}</div>
                  </div>
                </div>
                {(batch?.requiredVolumeLiters != null || (recommendation.vessel && equipment.manufacturing.find(e => e.id === recommendation.vessel)?.cap != null)) && (
                  <div className="text-[10px] text-gray-600 mb-2">
                    {batch?.requiredVolumeLiters != null && <span className="rec-item">Batch volume: <b>{batch.requiredVolumeLiters.toFixed(1)} L</b></span>}
                    {recommendation.vessel && equipment.manufacturing.find(e => e.id === recommendation.vessel)?.cap != null && (
                      <span className="ml-3 rec-item">Vessel capacity: <b>{equipment.manufacturing.find(e => e.id === recommendation.vessel)!.cap} L</b></span>
                    )}
                    {recommendation.vessel && vesselCap != null && batchVol != null && batchVol <= vesselCap && totalWithThis <= vesselCap && vesselCap > totalWithThis && (
                      <div className="mt-1 rec-item font-medium text-emerald-600">{Math.round((vesselCap - totalWithThis) * 10) / 10} L more capacity left after scheduling.</div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-gray-600 mb-3">
                  <div className="rec-item">RM at WH: <b>{recommendation.rmConnectDate ?? '—'}</b></div>
                  <div className="rec-item">PM at WH: <b>{recommendation.pmConnectDate ?? '—'}</b></div>
                  <div className="rec-item">FG Ready: <b>{recommendation.fgDate ?? '—'}</b></div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {recommendation.reasons.map((r, i) => (
                    <div key={i} className="rec-item flex-1 min-w-0 text-[9.5px] text-gray-600 bg-white/60 rounded px-2 py-1 border border-gray-100">{r}</div>
                  ))}
                </div>
                <button type="button" onClick={handleAcceptRecommendation} className="rec-btn w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <Check size={14} /> One-click confirm
                </button>
              </div>

              {/* Manual override */}
              <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-2">Manual override</div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-teal-50/80 border border-teal-100 text-[11px] text-teal-800 mb-3">
                  <div>Or adjust dates and equipment below if needed.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="field"><label className={LBL}>Mfg date</label><input type="date" className={INP} value={mfgDate ?? ''} onChange={e => handleMfgChange(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Fill date</label><input type="date" className={INP} value={fillDate ?? ''} onChange={e => setFillDate(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Pack date</label><input type="date" className={INP} value={packDate ?? ''} onChange={e => setPackDate(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Vessel</label>
                    <select className={INP} value={vessel} onChange={e => setVessel(e.target.value)}>
                      {compatV.map(id => (
                        <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'mfg')} {isEquipFreeOnDate(batches, id, mfgDate) ? '(Free)' : '(Busy)'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(batchVol != null || vesselCap != null || volumeRequiredInBatch != null) && (
                  <div className={`mb-3 p-3 rounded-lg border text-xs ${overCapacity || overTotalCapacity ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="font-semibold mb-1.5">Volume & capacity</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Volume required in this batch: <b>{volumeRequiredInBatch != null ? `${volumeRequiredInBatch.toFixed(1)} L` : '—'}</b></span>
                      {batchVol != null && <span>Batch volume: <b>{batchVol.toFixed(1)} L</b></span>}
                      {vesselCap != null && <span>Vessel capacity: <b>{vesselCap} L</b></span>}
                      {vessel && mfgDate && <span>Total on this vessel/date: <b>{totalWithThis.toFixed(1)} L</b></span>}
                    </div>
                    {overCapacity && <p className="mt-1.5 font-medium">Batch volume exceeds vessel capacity.</p>}
                    {!overCapacity && overTotalCapacity && <p className="mt-1.5 font-medium">Total scheduled volume exceeds vessel capacity.</p>}
                    {!overCapacity && !overTotalCapacity && vesselCap != null && totalWithThis < vesselCap && (
                      <p className="mt-1.5 font-medium text-emerald-600">{Math.max(0, Math.round((vesselCap - totalWithThis) * 10) / 10).toFixed(1)} L more capacity left on this vessel/date.</p>
                    )}
                  </div>
                )}
                {batchWithUnits && (batchWithUnits.fillUnitsRequired > 0 || batchWithUnits.packUnitsRequired > 0) && (equipment?.filling?.some(e => (e.speed ?? 0) > 0) || equipment?.packaging?.some(e => (e.speed ?? 0) > 0)) && (
                  <div className="mb-3 p-3 rounded-lg border border-purple-200 bg-purple-50/40 text-xs text-slate-700">
                    <div className="font-semibold mb-1.5">Filling & packaging capacity (units/day)</div>
                    <p className="text-[10.5px] text-slate-600 mb-2">
                      PM type: <b>{(batch?.fillingType ?? 'bottle').toUpperCase()}</b>
                      {' · '}Planned split (order ÷ batches): <b>{batchWithUnits.fillUnitsRequired} fill</b>, <b>{batchWithUnits.packUnitsRequired} pack</b> units
                      {batch?.bulkYield != null && Number(batch.bulkYield) > 0 && (
                        <span className="block mt-1 text-indigo-800 font-medium">
                          BMR bulk recorded: <b>{Number(batch.bulkYield)} KG</b> vs planned <b>{batch.batchSize} KG</b> — use fill/pack QC yields when available for true output.
                        </span>
                      )}
                      {batch?.fillYield != null && Number(batch.fillYield) > 0 && (
                        <span className="block mt-1 text-purple-800 font-medium">Fill QC yield on file: <b>{Number(batch.fillYield)}</b> units.</span>
                      )}
                      {batch?.fgYield != null && Number(batch.fgYield) > 0 && (
                        <span className="block mt-1 text-emerald-800 font-medium">Pack QC / FG yield on file: <b>{Number(batch.fgYield)}</b> units.</span>
                      )}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fillLine && fillDate && (() => {
                        const fillEquip = equipment.filling?.find(e => e.id === fillLine);
                        const dailyCap = fillEquip ? getFillLineDailyCapacity(fillEquip, DEFAULT_WORKING_HOURS_PER_DAY) : 0;
                        const used = getFillLineCapacityUsedOnDate(scheduledBatchesWithUnits, fillLine, fillDate, batch?.bmrNo);
                        const remaining = getFillLineRemainingCapacity(equipment.filling ?? [], fillLine, fillDate, scheduledBatchesWithUnits, DEFAULT_WORKING_HOURS_PER_DAY, batch?.bmrNo);
                        const afterThis = remaining - (batchWithUnits.fillUnitsRequired ?? 0);
                        return (
                          <div className="rounded-lg bg-white/60 p-2 border border-purple-100">
                            <div className="font-medium text-purple-800">{fillLine} on {fillDate}</div>
                            <div className="mt-1 space-y-0.5 text-[10.5px]">
                              <span>Capacity: <b>{dailyCap.toLocaleString()}</b>/day ({fillEquip?.speed != null ? `${fillEquip.speed}/hr` : '—'})</span>
                              <br />
                              <span>Already used: <b>{used.toLocaleString()}</b> units</span>
                              <br />
                              <span>This batch: <b>{batchWithUnits.fillUnitsRequired}</b> units</span>
                              <br />
                              {afterThis >= 0 ? (
                                <span className="text-emerald-600 font-medium">Remaining after: <b>{afterThis.toLocaleString()}</b> units</span>
                              ) : (
                                <span className="text-amber-600 font-medium">Over by <b>{(-afterThis).toLocaleString()}</b> units (consider another line or date)</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {packLine && packDate && (() => {
                        const packEquip = equipment.packaging?.find(e => e.id === packLine);
                        const dailyCap = packEquip ? getPackLineDailyCapacity(packEquip, DEFAULT_WORKING_HOURS_PER_DAY) : 0;
                        const used = getPackLineCapacityUsedOnDate(scheduledBatchesWithUnits, packLine, packDate, batch?.bmrNo);
                        const remaining = getPackLineRemainingCapacity(equipment.packaging ?? [], packLine, packDate, scheduledBatchesWithUnits, DEFAULT_WORKING_HOURS_PER_DAY, batch?.bmrNo);
                        const afterThis = remaining - (batchWithUnits.packUnitsRequired ?? 0);
                        return (
                          <div className="rounded-lg bg-white/60 p-2 border border-emerald-100">
                            <div className="font-medium text-emerald-800">{packLine} on {packDate}</div>
                            <div className="mt-1 space-y-0.5 text-[10.5px]">
                              <span>Capacity: <b>{dailyCap.toLocaleString()}</b>/day ({packEquip?.speed != null ? `${packEquip.speed}/hr` : '—'})</span>
                              <br />
                              <span>Already used: <b>{used.toLocaleString()}</b> units</span>
                              <br />
                              <span>This batch: <b>{batchWithUnits.packUnitsRequired}</b> units</span>
                              <br />
                              {afterThis >= 0 ? (
                                <span className="text-emerald-600 font-medium">Remaining after: <b>{afterThis.toLocaleString()}</b> units</span>
                              ) : (
                                <span className="text-amber-600 font-medium">Over by <b>{(-afterThis).toLocaleString()}</b> units (consider another line or date)</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="field"><label className={LBL}>Fill line</label>
                    <select className={INP} value={fillLine} onChange={e => setFillLine(e.target.value)}>
                      {compatF.map(id => {
                        const fillEquip = equipment.filling?.find(e => e.id === id);
                        const speedLabel = fillEquip?.speed != null ? ` ${fillEquip.speed}/hr` : '';
                        return (
                          <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'fill')}{speedLabel} {isEquipFreeOnDate(batches, id, fillDate) ? '(Free)' : '(Busy)'}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="field"><label className={LBL}>Pack line</label>
                    <select className={INP} value={packLine} onChange={e => setPackLine(e.target.value)}>
                      {compatP.map(id => {
                        const packEquip = equipment.packaging?.find(e => e.id === id);
                        const speedLabel = packEquip?.speed != null ? ` ${packEquip.speed}/hr` : '';
                        return (
                          <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'pack')}{speedLabel} {isEquipFreeOnDate(batches, id, packDate) ? '(Free)' : '(Busy)'}</option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <button type="button" onClick={handleSaveManual} className="btn btn-blue btn-sm py-2 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors">
                  Save manual schedule
                </button>
              </div>
            </>
          )}
        </div>

        {batch && recommendation && (
          <div className="modal-foot flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="button" onClick={handleSaveManual} className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition-colors">
              <Calendar size={14} /> Confirm schedule & lock dates
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────── DISPENSING MODAL ──────────────────────────────── */

function DispensingModal({ batch, type, onClose, onSave, onReschedule }: {
  batch: Batch; type: 'rm' | 'pm'; onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  /** Open schedule modal to shift MFG / fill / pack dates (e.g. BPR delays while awaiting BMR QC). */
  onReschedule?: () => void;
}) {
  const batchItems = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const initKey = `${type}-${type === 'rm' ? batch.bmrNo : batch.bprNo}`;
  const [localItems, setLocalItems] = useState<DispensingItem[]>(() => (Array.isArray(batchItems) ? batchItems : []).map(i => ({ ...i })));
  const [inputVals, setInputVals] = useState<Record<number, string>>({});
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [dispenseErr, setDispenseErr] = useState<string | null>(null);
  const done = localItems.filter(r => r.done).length;
  const total = localItems.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const unit = type === 'rm' ? 'KG' : 'pcs';
  /** BPR cannot move to Filling until BMR bulk QC is released (cleared or approved flag). */
  const bprBlockedByBmr = type === 'pm' && !bmrBulkQcReleased(batch);

  useEffect(() => {
    const base = (Array.isArray(batchItems) ? batchItems : []).map(i => ({ ...i }));
    setLocalItems(base);
    setInputVals({});
    setReqError(null);
    setDispenseErr(null);

    // If the server hasn't persisted dispensing lines yet, load per-batch BOM requirements so
    // the operator can dispense and so the backend sees a real delta for warehouse consumption.
    if (base.length > 0) return;
    const batchPk = (batch as Batch & { _pk?: number })._pk;
    if (!batchPk) {
      setReqError('Batch id missing — cannot load dispensing requirements.');
      return;
    }

    let cancelled = false;
    setReqLoading(true);
    fetchBOMByBatchId(batchPk)
      .then((res) => {
        if (cancelled) return;
        if (!res?.success || !res.data) {
          setReqError(res?.error || 'Could not load dispensing requirements.');
          return;
        }
        if (res.data.source !== 'planning_batch') {
          // Allow dispensing to proceed even if planning BOM is missing, but surface a warning.
          setReqError('Batch not linked to planning BOM — using master BOM requirements for dispensing.');
        }

        const batchSizeKg =
          res.data.batchSizeKg != null && Number.isFinite(res.data.batchSizeKg) && res.data.batchSizeKg > 0
            ? res.data.batchSizeKg
            : (batch.batchSize || 0);

        if (type === 'rm') {
          const rmLines = Array.isArray(res.data.rmLines) ? (res.data.rmLines as BOMRmLine[]) : [];
          const rmItems: DispensingItem[] = rmLines
            .filter((line) => line.rm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.rm_code || (line as { code?: string }).code) as string;
              const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
              const required = (batchSizeKg * pct) / 100;
              return {
                code,
                inci: (line.inci_name ?? (line as { inci_name?: string }).inci_name) as string,
                required,
                dispensed: 0,
                done: false,
              };
            })
            .filter((x) => x.required > 0 && String(x.code || '').trim().length > 0);
          setLocalItems(rmItems);
        } else {
          const pmLines = Array.isArray(res.data.pmLines) ? (res.data.pmLines as BOMPmLine[]) : [];
          const batchUnits =
            res.data.batchSizeKg != null && Number.isFinite(res.data.batchSizeKg) && res.data.batchSizeKg > 0
              ? Math.round(res.data.batchSizeKg)
              : (batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : (batch.batchSize || 0));
          const pmItems: DispensingItem[] = pmLines
            .filter((line) => line.pm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.pm_code || (line as { code?: string }).code) as string;
              const qtyPerUnit = Number((line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1)) || 1;
              const required = qtyPerUnit * batchUnits;
              return {
                code,
                name: (line.description ?? (line as { description?: string }).description ?? code) as string,
                required,
                dispensed: 0,
                done: false,
              };
            })
            .filter((x) => x.required > 0 && String(x.code || '').trim().length > 0);
          setLocalItems(pmItems);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReqError('Failed to load dispensing requirements.');
      })
      .finally(() => {
        if (cancelled) return;
        setReqLoading(false);
      });

    return () => { cancelled = true; };
  }, [initKey]); // batchItems/localItems init handled inside

  const handleDispense = (idx: number) => {
    setDispenseErr(null);
    const inputNum = parseFloat(inputVals[idx] || '');
    const requiredNum = Number(localItems[idx]?.required);
    const val =
      Number.isFinite(inputNum) && !Number.isNaN(inputNum)
        ? inputNum
        : (Number.isFinite(requiredNum) && !Number.isNaN(requiredNum) ? requiredNum : NaN);

    if (!Number.isFinite(val) || val <= 0) {
      setDispenseErr(`Enter a valid ${unit === 'KG' ? 'weight (KG)' : 'count'} before marking Done.`);
      return;
    }

    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, done: true, dispensed: val } : it));
  };

  const handleComplete = () => {
    if (localItems.length === 0) return;
    if (!localItems.every(r => r.done)) return;
    if (type === 'rm') onSave({ dispensingRM: localItems, bmrStatus: 'in_production' });
    else {
      if (bprBlockedByBmr) return;
      onSave({ dispensingPM: localItems, bprStatus: 'filling' });
    }
    onClose();
  };

  const handleSaveProgress = () => {
    if (type === 'rm') onSave({ dispensingRM: localItems });
    else onSave({ dispensingPM: localItems });
    onClose();
  };

  return (
    <Modal onClose={onClose} title={`${type.toUpperCase()} Dispensing - ${type === 'rm' ? batch.bmrNo : batch.bprNo}`} size="lg">
      <Tip color="purple" icon={<Scale size={14} />}>Weigh and dispense each item exactly as specified. Record actual weight.</Tip>
      {reqError && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 text-red-700 px-3 py-2 text-xs mt-3">
          {reqError}
        </div>
      )}
      {bprBlockedByBmr && (
        <Tip color="amber" icon={<AlertTriangle size={14} />}>
          Awaiting BMR QC release — BPR cannot move to <strong>Filling</strong> until the BMR is <strong>Cleared</strong>. You can still push <strong>fill / pack / FG dates</strong> using <b>Reschedule dates</b> below if the BPR plan slips.
        </Tip>
      )}
      {dispenseErr && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 text-amber-900 px-3 py-2 text-xs mt-2">
          {dispenseErr}
        </div>
      )}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Progress</span><span className="font-mono font-bold text-emerald-600">{done}/{total} ({pct}%)</span></div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="space-y-2">
        {reqLoading ? (
          <div className="py-4 text-center text-sm text-gray-500">Loading {type === 'rm' ? 'RM' : 'PM'} requirements…</div>
        ) : localItems.length === 0 ? (
          <div className="py-3 px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">
            No {type === 'rm' ? 'RM' : 'PM'} items to dispense for this batch. If this is expected, verify the batch is linked to Planning BOM.
          </div>
        ) : (
          localItems.map((r, idx) => (
            <div key={idx} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${r.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.done ? 'bg-emerald-100 border border-emerald-300 text-emerald-600' : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>
                {r.done ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800">{r.inci || r.name || r.code}</div>
                <div className="text-[10px] text-gray-400">{r.code} - Target: <b>{type === 'rm' ? r.required + ' KG' : fmt(r.required) + ' pcs'}</b></div>
              </div>
              {r.done ? (
                <div className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 font-semibold"><Check size={12} /> {r.dispensed} {unit}</div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={String(r.required)}
                    value={inputVals[idx] || ''}
                    onChange={e => setInputVals(prev => ({ ...prev, [idx]: e.target.value }))}
                    className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-300 focus:outline-none"
                  />
                  <button onClick={() => handleDispense(idx)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors"><Check size={10} /> Done</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        {onReschedule && (
          <button type="button" onClick={onReschedule} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
            <Calendar size={13} /> Reschedule dates
          </button>
        )}
        <button
          onClick={handleSaveProgress}
          disabled={reqLoading || localItems.length === 0}
          className={`px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          Save Progress
        </button>
        {localItems.length > 0 && localItems.every(r => r.done) && (
          <button
            onClick={handleComplete}
            disabled={bprBlockedByBmr}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${bprBlockedByBmr ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
          >
            <CheckCircle2 size={13} /> Complete Dispensing
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ──────────── QC MODAL ─────────────────────────────────────── */

function getStoredQcSpecsForType(stored: QcSpecsStored | undefined, qcType: 'bmr' | 'fill' | 'pack'): QCSpec[] {
  if (!stored) return [];
  if (Array.isArray(stored)) return qcType === 'bmr' ? stored : [];
  const arr = stored[qcType];
  return Array.isArray(arr) ? arr : [];
}

function getRemarksForQcType(batch: Batch, qcType: 'bmr' | 'fill' | 'pack'): string {
  const q = batch.qcSpecs;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    const o = q as QcSpecsByScope;
    if (qcType === 'bmr') return (o.remarksBmr ?? batch.remarks) ?? '';
    if (qcType === 'fill') return o.remarksFill ?? '';
    return o.remarksPack ?? '';
  }
  if (qcType === 'bmr') return batch.remarks ?? '';
  return '';
}

function mergeQcSpecsWithRemarks(
  batch: Batch,
  qcType: 'bmr' | 'fill' | 'pack',
  specs: QCSpec[],
  remarks: string
): QcSpecsStored {
  const prev = batch.qcSpecs as QcSpecsStored | undefined;
  let bmr: QCSpec[] = [];
  let fill: QCSpec[] = [];
  let pack: QCSpec[] = [];
  let remarksBmr: string | undefined;
  let remarksFill: string | undefined;
  let remarksPack: string | undefined;
  if (Array.isArray(prev)) {
    bmr = [...prev];
    remarksBmr = batch.remarks;
  } else if (prev && typeof prev === 'object') {
    const o = prev as QcSpecsByScope;
    bmr = Array.isArray(o.bmr) ? [...o.bmr] : [];
    fill = Array.isArray(o.fill) ? [...o.fill] : [];
    pack = Array.isArray(o.pack) ? [...o.pack] : [];
    remarksBmr = o.remarksBmr ?? batch.remarks;
    remarksFill = o.remarksFill;
    remarksPack = o.remarksPack;
  }
  if (qcType === 'bmr') {
    bmr = specs;
    remarksBmr = remarks;
  } else if (qcType === 'fill') {
    fill = specs;
    remarksFill = remarks;
  } else {
    pack = specs;
    remarksPack = remarks;
  }
  return { bmr, fill, pack, remarksBmr, remarksFill, remarksPack };
}

/** Detail drawer: show each QC stage separately when stored as object. */
function collectQcSpecsRowsForDisplay(batch: Batch): { label: string; rows: QCSpec[] }[] {
  const q = batch.qcSpecs;
  const out: { label: string; rows: QCSpec[] }[] = [];
  if (Array.isArray(q)) {
    if (q.length > 0) out.push({ label: 'Bulk QC (BMR)', rows: q });
    return out;
  }
  if (q && typeof q === 'object') {
    const o = q as QcSpecsByScope;
    const add = (label: string, key: 'bmr' | 'fill' | 'pack') => {
      const rows = Array.isArray(o[key]) ? o[key]! : [];
      if (rows.length > 0) out.push({ label, rows });
    };
    add('Bulk QC (BMR)', 'bmr');
    add('Fill QC', 'fill');
    add('Pack QC', 'pack');
  }
  return out;
}

const DEFAULT_QC_SPECS: Record<string, QCSpec[]> = {
  bmr: [
    { param: 'pH', spec: 'See BMR specification', result: '', passed: null },
    { param: 'Viscosity (cps)', spec: 'See BMR specification', result: '', passed: null },
    { param: 'Appearance', spec: 'As per standard', result: '', passed: null },
    { param: 'Homogeneity', spec: 'No lumps/undissolved', result: '', passed: null },
    { param: 'Odour', spec: 'Characteristic', result: '', passed: null },
  ],
  fill: [
    { param: 'Fill Volume/Weight', spec: '±3% of label claim', result: '', passed: null },
    { param: 'Seal Integrity', spec: 'No leakage', result: '', passed: null },
    { param: 'Label Application', spec: 'Straight, no wrinkles', result: '', passed: null },
    { param: 'Container Integrity', spec: 'No cracks/deformation', result: '', passed: null },
  ],
  pack: [
    { param: 'Monocarton Fitment', spec: 'Correct size, no bulging', result: '', passed: null },
    { param: 'Batch/MFG/EXP on carton', spec: 'Correct and legible', result: '', passed: null },
    { param: 'Count per shipper', spec: 'Per BOM spec', result: '', passed: null },
    { param: 'Shrink quality', spec: 'Tight, clear, no tears', result: '', passed: null },
  ],
};

function deriveQcSpecsFromBatch(batch: Batch, qcType: 'bmr' | 'fill' | 'pack'): QCSpec[] {
  const forType = getStoredQcSpecsForType(batch.qcSpecs, qcType);
  if (forType.length > 0) return forType.map((s) => ({ ...s }));
  return (DEFAULT_QC_SPECS[qcType] || []).map((s) => ({ ...s }));
}

function QCModal({ batch, qcType, team, batchPk, onClose, onSave }: {
  batch: Batch; qcType: 'bmr' | 'fill' | 'pack'; team: TeamMember[];
  /** Production batch DB id — loads master RM/PM bulk specs (BMR) and FG Specs & Stability (Pack QC). */
  batchPk?: number;
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const [specs, setSpecs] = useState(() => deriveQcSpecsFromBatch(batch, qcType));
  const [yieldVal, setYieldVal] = useState('');
  const [remarks, setRemarks] = useState(() => getRemarksForQcType(batch, qcType));

  const batchPkId = (batch as Batch & { _pk?: number })._pk;
  const qcSpecsFingerprint = JSON.stringify(batch.qcSpecs ?? null);

  useEffect(() => {
    setSpecs(deriveQcSpecsFromBatch(batch, qcType));
    setRemarks(getRemarksForQcType(batch, qcType));
  }, [
    batch.bmrNo,
    batchPkId,
    qcType,
    batch.bmrStatus,
    batch.bprStatus,
    qcSpecsFingerprint,
    batch.remarks,
    batch.bulkBatchAccepted,
    batch.fillBatchAccepted,
    batch.fgBatchAccepted,
  ]);

  useEffect(() => {
    if (qcType === 'bmr') {
      setYieldVal(batch.bulkYield != null && Number.isFinite(Number(batch.bulkYield)) ? String(batch.bulkYield) : '');
    } else if (qcType === 'fill') {
      setYieldVal(batch.fillYield != null && Number.isFinite(Number(batch.fillYield)) ? String(batch.fillYield) : '');
    } else {
      setYieldVal(batch.fgYield != null && Number.isFinite(Number(batch.fgYield)) ? String(batch.fgYield) : '');
    }
  }, [batch.bmrNo, qcType, batch.bulkYield, batch.fillYield, batch.fgYield, batch.bmrStatus, batch.bprStatus]);
  const [qcRef, setQcRef] = useState<QcReferencePayload | null>(null);
  const [qcRefLoading, setQcRefLoading] = useState(false);
  const [qcRefErr, setQcRefErr] = useState<string | null>(null);
  const titles: Record<string, string> = { bmr: 'Bulk QC Review', fill: 'Filling QC Review', pack: 'Packaging QC Review' };
  const yieldLabels: Record<string, string> = {
    bmr: `Bulk yield (KG) — actual manufactured`,
    fill: 'Fill yield — units filled',
    pack: 'Pack yield — finished units',
  };
  const qcOfficer = team.find(t => t.id === (qcType === 'bmr' ? batch.qcOfficerBMR : batch.qcOfficerBPR));

  useEffect(() => {
    if (!batchPk || (qcType !== 'bmr' && qcType !== 'pack')) {
      setQcRef(null);
      setQcRefLoading(false);
      setQcRefErr(null);
      return;
    }
    let cancelled = false;
    setQcRefLoading(true);
    setQcRefErr(null);
    fetchBOMByBatchId(batchPk).then((res) => {
      if (cancelled) return;
      setQcRefLoading(false);
      if (res.success && res.data?.qcReference) setQcRef(res.data.qcReference);
      else {
        setQcRef(null);
        if (!res.success) setQcRefErr(res.error || 'Could not load reference specs');
      }
    });
    return () => { cancelled = true; };
  }, [batchPk, qcType]);

  const passed = specs.filter(s => s.passed === true).length;
  const failed = specs.filter(s => s.passed === false).length;
  const pending = specs.filter(s => s.passed === null).length;
  const allReviewed = pending === 0 && specs.length > 0;
  const allPassed = allReviewed && failed === 0;
  const hasFails = failed > 0;
  const allResultsFilled = specs.length > 0 && specs.every((s) => String(s.result ?? '').trim().length > 0);

  const trimmedYield = yieldVal.trim();
  const parsedYieldNum = parseFloat(trimmedYield.replace(/,/g, ''));
  const bulkYieldNum = parsedYieldNum;
  const fillFgYieldNum = parsedYieldNum;
  const yieldValid =
    qcType === 'bmr'
      ? Number.isFinite(bulkYieldNum) && bulkYieldNum > 0
      : qcType === 'fill'
        ? Number.isFinite(fillFgYieldNum) && fillFgYieldNum > 0
        : Number.isFinite(fillFgYieldNum) && fillFgYieldNum > 0;

  const toggleResult = (idx: number) => {
    setSpecs(prev => prev.map((sp, j) => {
      if (j !== idx) return sp;
      if (sp.passed === null) return { ...sp, passed: true };
      if (sp.passed === true) return { ...sp, passed: false };
      return { ...sp, passed: null };
    }));
  };

  const handleApprove = () => {
    if (!yieldValid || !allResultsFilled) return;
    const merged = mergeQcSpecsWithRemarks(batch, qcType, specs, remarks);
    const upd: Partial<Batch> = { qcSpecs: merged };
    if (qcType === 'bmr') {
      upd.remarks = remarks;
      upd.bulkYield = bulkYieldNum; upd.bulkBatchAccepted = true;
      upd.bmrStatus = 'cleared'; upd.bprStatus = batch.bprStatus === 'draft' ? 'pm_reserved' : batch.bprStatus;
    } else if (qcType === 'fill') {
      upd.fillYield = fillFgYieldNum; upd.fillBatchAccepted = true; upd.bprStatus = 'packaging';
    } else {
      upd.fgYield = fillFgYieldNum; upd.fgBatchAccepted = true; upd.bprStatus = 'fg_ready';
    }
    onSave(upd); onClose();
  };

  const handleReject = () => {
    if (!allResultsFilled) return;
    const rejectNote = remarks || 'Rejected - deviation raised';
    const merged = mergeQcSpecsWithRemarks(batch, qcType, specs, rejectNote);
    const upd: Partial<Batch> = { qcSpecs: merged };
    if (qcType === 'bmr') {
      upd.remarks = rejectNote;
      upd.bulkBatchAccepted = false; upd.bmrStatus = 'qc_failed';
    } else if (qcType === 'fill') {
      upd.fillBatchAccepted = false; upd.bprStatus = 'qc_failed';
    } else {
      upd.fgBatchAccepted = false; upd.bprStatus = 'qc_failed';
    }
    onSave(upd); onClose();
  };

  const modalW = qcType === 'bmr' || qcType === 'pack' ? 'xl' : 'lg';
  const fgSpecEntries = qcRef?.fgProductSpecs ? Object.entries(qcRef.fgProductSpecs) : [];
  /** BMR bulk QC: show master specs for raw materials only (not packaging). */
  const bmrBulkRmSpecs = (qcRef?.ingredientBulkSpecs ?? []).filter((row) => row.type === 'RM');

  return (
    <Modal onClose={onClose} title={`${titles[qcType]} - ${qcType === 'bmr' ? batch.bmrNo : batch.bprNo}`} size={modalW}>
      <Tip color="blue" icon={<Microscope size={14} />}>QC Officer: <b>{qcOfficer?.name || '-'}</b> reviewing <b>{qcType === 'bmr' ? batch.bmrNo : batch.bprNo}</b>. Click each parameter to cycle: pending {'>'} pass {'>'} fail.</Tip>

      {qcType === 'bmr' && (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-2">Master bulk quality (RM)</div>
          {qcRefLoading && <p className="text-xs text-gray-500">Loading specs from item master…</p>}
          {qcRefErr && !qcRefLoading && <p className="text-xs text-amber-700">{qcRefErr}</p>}
          {!qcRefLoading && !batchPk && (
            <p className="text-xs text-gray-500">Batch id missing — cannot load BOM-linked master specs.</p>
          )}
          {!qcRefLoading && batchPk && bmrBulkRmSpecs.length === 0 && (
            <p className="text-xs text-gray-500">No RM lines on this batch BOM, or RMs could not be resolved / have no bulk quality in master.</p>
          )}
          {bmrBulkRmSpecs.length > 0 && (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {bmrBulkRmSpecs.map((row) => {
                const specEntries = Object.entries(row.specs || {});
                return (
                  <div key={`${row.type}-${row.id}`} className="rounded-lg border border-white/80 bg-white/70 p-2.5 text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono font-bold text-indigo-700">{row.code}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">RM</span>
                      <span className="text-gray-700 font-medium truncate">{row.name || row.inci || '—'}</span>
                    </div>
                    {specEntries.length === 0 ? (
                      <p className="text-[10px] text-gray-400">No bulk quality specs in master for this item.</p>
                    ) : (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                        {specEntries.map(([k, v]) => (
                          <div key={k} className="flex gap-1">
                            <dt className="text-gray-500 shrink-0">{k}:</dt>
                            <dd className="text-gray-800 font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {qcType === 'pack' && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-2">Finished product — Specs &amp; Stability (BOM / PR master)</div>
          {qcRefLoading && <p className="text-xs text-gray-500">Loading product specs…</p>}
          {qcRefErr && !qcRefLoading && <p className="text-xs text-amber-700">{qcRefErr}</p>}
          {!qcRefLoading && !batchPk && (
            <p className="text-xs text-gray-500">Batch id missing — cannot load product specs.</p>
          )}
          {!qcRefLoading && batchPk && fgSpecEntries.length === 0 && (
            <p className="text-xs text-gray-500">No Specs &amp; Stability on file for this SKU. Edit the product under BOM → Specs &amp; Stability.</p>
          )}
          {fgSpecEntries.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs max-h-[200px] overflow-y-auto">
              {fgSpecEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row sm:gap-2 rounded-md bg-white/60 px-2 py-1 border border-white/90">
                  <dt className="text-gray-500 shrink-0 font-semibold">{k}</dt>
                  <dd className="text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-gray-500">{specs.length} params:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]"><Check size={10} /> {passed}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]"><X size={10} /> {failed}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold text-[10px]"><CircleDot size={10} /> {pending}</span>
        </div>
        {allPassed && <span className="ml-auto text-[10px] font-bold text-emerald-600 flex items-center gap-1"><ShieldCheck size={12} /> All Passed</span>}
        {hasFails && allReviewed && <span className="ml-auto text-[10px] font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {failed} Failed</span>}
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_90px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <div>Parameter</div>
          <div>Result <span className="text-red-500">*</span></div>
          <div>Verdict</div>
        </div>
        {specs.map((s, i) => {
          const rowBg = s.passed === true ? 'bg-emerald-50/40' : s.passed === false ? 'bg-red-50/40' : '';
          return (
            <div key={i} className={`grid grid-cols-[1fr_1fr_1fr_90px] gap-2 px-3 py-2.5 border-b border-gray-50 items-center ${rowBg} transition-colors`}>
              <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                {s.passed === true && <Check size={12} className="text-emerald-500 shrink-0" />}
                {s.passed === false && <X size={12} className="text-red-500 shrink-0" />}
                {s.passed === null && <CircleDot size={12} className="text-gray-300 shrink-0" />}
                {s.param}
              </div>
              {/* <div className="text-xs text-gray-500 font-mono">{s.spec}</div> */}
              <input
                className={`border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white ${String(s.result ?? '').trim() ? 'border-gray-200' : 'border-amber-300 ring-1 ring-amber-100'}`}
                value={s.result}
                placeholder="Required — enter measured result"
                onChange={e => setSpecs(prev => prev.map((sp, j) => j === i ? { ...sp, result: e.target.value } : sp))}
              />
              <button
                onClick={() => toggleResult(i)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${s.passed === true ? 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200' :
                  s.passed === false ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' :
                    'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
              >
                {s.passed === true ? 'Pass' : s.passed === false ? 'Fail' : 'Pending'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LBL}>{yieldLabels[qcType]} <span className="text-red-500">*</span></label>
          <input
            className={`${INP} ${allPassed && !yieldValid ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
            type="number"
            min={qcType === 'bmr' ? 0.01 : 1}
            step={qcType === 'bmr' ? '0.01' : 1}
            placeholder={(() => {
              if (qcType === 'bmr') return `e.g. ${batch.batchSize} (planned batch size KG)`;
              // BPR (fill / pack): mirror BMR's placeholder shape so users see the expected count
              // derived from the actual BMR bulk yield (or planned batch size when bulk not yet recorded).
              const plannedKg = Number(batch.batchSize) || 0;
              const plannedUnits = Number(batch.orderQty) || 0;
              const kgPerUnit = plannedKg > 0 && plannedUnits > 0 ? plannedKg / plannedUnits : 0;
              const actualBulkKg =
                batch.bulkYield != null && Number.isFinite(Number(batch.bulkYield)) && Number(batch.bulkYield) > 0
                  ? Number(batch.bulkYield)
                  : plannedKg;
              const expectedUnits = kgPerUnit > 0 ? Math.round(actualBulkKg / kgPerUnit) : plannedUnits;
              const sourceLabel = batch.bulkYield != null && Number(batch.bulkYield) > 0
                ? 'actual bulk KG'
                : 'planned batch KG';
              return `e.g. ${expectedUnits} units (expected from ${actualBulkKg} ${sourceLabel})`;
            })()}
            value={yieldVal}
            onChange={e => setYieldVal(e.target.value)}
          />
          {qcType === 'bmr' && (
            <p className="text-[10px] text-gray-500 mt-1">Required to approve. Compare to planned batch size <b>{batch.batchSize} KG</b> (order line / formula).</p>
          )}
          {qcType === 'fill' && (
            <p className="text-[10px] text-gray-500 mt-1">Required — how many sellable units were filled (feeds BPR / packaging planning).</p>
          )}
          {qcType === 'pack' && (
            <p className="text-[10px] text-gray-500 mt-1">Required — finished good units after packaging QC.</p>
          )}
          {allPassed && !yieldValid && (
            <p className="text-[10px] text-amber-700 mt-1 font-semibold">Enter a yield quantity greater than zero to approve.</p>
          )}
        </div>
        <div><label className={LBL}>QC Remarks</label><input className={INP} placeholder="Overall remarks..." value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
        <div className="text-[10px] text-gray-400">
          {!allReviewed && `${pending} parameter${pending !== 1 ? 's' : ''} still pending review`}
          {allReviewed && !allResultsFilled && 'Enter a Result for every parameter before Approve or Reject.'}
          {allReviewed && allResultsFilled && hasFails && `${failed} parameter${failed !== 1 ? 's' : ''} failed — reject to raise deviation`}
          {allPassed && allResultsFilled && yieldValid && 'All parameters passed — ready to approve'}
          {allPassed && allResultsFilled && !yieldValid && 'All parameters passed — enter yield quantity to approve'}
          {allPassed && !allResultsFilled && 'Enter a Result for each parameter to approve.'}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleReject} disabled={!allReviewed || !hasFails || !allResultsFilled}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <X size={12} /> Reject ({failed})
          </button>
          <button onClick={handleApprove} disabled={!allPassed || !yieldValid || !allResultsFilled}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ShieldCheck size={13} /> Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Outbound MTR helpers — match backend lineItemsIndicateRm / lineItemsIndicatePm when ids are absent. */
function mrnLineItemsLookLikeRm(m: Pick<MRNRecordFromApi, 'lineItems'>): boolean {
  const items = m.lineItems ?? [];
  return items.some((li) => li.raw_material_id != null || String(li.unit || '').toUpperCase() === 'KG');
}
function mrnLineItemsLookLikePm(m: Pick<MRNRecordFromApi, 'lineItems'>): boolean {
  const items = m.lineItems ?? [];
  const u = (s: string | undefined) => String(s || '').toUpperCase();
  return items.some((li) => li.pack_material_id != null || u(li.unit) === 'PCS' || u(li.unit) === 'PC');
}
function batchHasOpenRmMtr(bmrNo: string, list: MRNRecordFromApi[]): boolean {
  const isClosed = (status: string | undefined) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'completed' || s === 'succeeded';
  };
  return list.some(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikeRm(m) &&
      !isClosed(m.status),
  );
}
function batchHasOpenPmMtr(bmrNo: string, list: MRNRecordFromApi[]): boolean {
  const isClosed = (status: string | undefined) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'completed' || s === 'succeeded';
  };
  return list.some(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikePm(m) &&
      !isClosed(m.status),
  );
}

/** Open outbound RM MTR for this BMR (WH → MU), if any. */
function findOpenRmMtrForBatch(bmrNo: string, list: MRNRecordFromApi[]): MRNRecordFromApi | null {
  const isClosed = (status: string | undefined) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'completed' || s === 'succeeded';
  };
  const found = list.find(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikeRm(m) &&
      !isClosed(m.status),
  );
  return found ?? null;
}

/** Any outbound RM MTR for this BMR (open or closed). */
function findAnyRmMtrForBatch(bmrNo: string, list: MRNRecordFromApi[]): MRNRecordFromApi | null {
  const rows = list.filter(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikeRm(m),
  );
  if (rows.length === 0) return null;
  return rows
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(String((a as { createdAt?: string }).createdAt || '')) || 0;
      const tb = Date.parse(String((b as { createdAt?: string }).createdAt || '')) || 0;
      return tb - ta;
    })[0] ?? rows[0];
}

/** Open outbound PM MTR for this BMR, if any. */
function findOpenPmMtrForBatch(bmrNo: string, list: MRNRecordFromApi[]): MRNRecordFromApi | null {
  const isClosed = (status: string | undefined) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'completed' || s === 'succeeded';
  };
  const found = list.find(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikePm(m) &&
      !isClosed(m.status),
  );
  return found ?? null;
}

/** Any outbound PM MTR for this BMR (open or closed). */
function findAnyPmMtrForBatch(bmrNo: string, list: MRNRecordFromApi[]): MRNRecordFromApi | null {
  const rows = list.filter(
    (m) =>
      m.bmrNo === bmrNo &&
      m.source === 'MTR' &&
      !m.isInboundFromMu &&
      mrnLineItemsLookLikePm(m),
  );
  if (rows.length === 0) return null;
  return rows
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(String((a as { createdAt?: string }).createdAt || '')) || 0;
      const tb = Date.parse(String((b as { createdAt?: string }).createdAt || '')) || 0;
      return tb - ta;
    })[0] ?? rows[0];
}

/**
 * WH→MU transfer is done for RM when the batch flag is set OR every outbound RM MTR is closed
 * (Succeeded/Completed) — avoids a stuck UI when inventory/backend advanced but batch row lags.
 */
function effectiveRmConnected(batch: Batch, outboundMrns: MRNRecordFromApi[]): boolean {
  if (batch.rmConnected) return true;
  const open = findOpenRmMtrForBatch(batch.bmrNo, outboundMrns);
  const any = findAnyRmMtrForBatch(batch.bmrNo, outboundMrns);
  return !open && any != null;
}

/** Same for PM MTR vs pm_connected. */
function effectivePmConnected(batch: Batch, outboundMrns: MRNRecordFromApi[]): boolean {
  if (batch.pmConnected) return true;
  const open = findOpenPmMtrForBatch(batch.bmrNo, outboundMrns);
  const any = findAnyPmMtrForBatch(batch.bmrNo, outboundMrns);
  return !open && any != null;
}

/** Short label for BMR/BPR chip — reflects warehouse pipeline (not editable). */
function outboundMtrStageTitle(m: MRNRecordFromApi): string {
  const s = String(m.status || '').trim();
  if (s === 'Pending') return 'MTR: Awaiting warehouse (Initiate transfer → In transit)';
  if (s === 'Picked') return 'MTR: Picked at warehouse — Initiate transfer in Warehouse when ready';
  if (s === 'In Transfer') return 'MTR: In transfer — Warehouse: Initiate transfer again to set In transit';
  if (s === 'In Transit') return 'MTR: In transit (released from WH)';
  if (s === 'Received at MU') return 'MTR: At MU — finish put-away';
  return 'MTR: In progress';
}

function outboundMtrStageHint(m: MRNRecordFromApi): string {
  const s = String(m.status || '').trim();
  if (s === 'Pending') return 'Warehouse → Transfer orders: assign picker, then Initiate transfer (sets In transit).';
  if (s === 'Picked') return 'Warehouse → Transfer orders: Initiate transfer when goods leave the warehouse (In transit).';
  if (s === 'In Transfer') return 'Warehouse → Transfer orders: tap Initiate transfer to set In transit.';
  if (s === 'In Transit') return 'Stock left the warehouse. When material arrives at MU, tap Verify / Received at MU.';
  if (s === 'Received at MU') return 'Enter MU zone and rack, then Mark Succeeded to complete the move.';
  return 'Complete steps in Transfer orders.';
}

/** Picker / transfer team from warehouse MRN — shown on BMR/BPR MTR chips (read-only). */
function outboundMtrWarehouseMeta(m: MRNRecordFromApi | null | undefined): string | null {
  if (!m) return null;
  const p = String(m.assignedPicker || '').trim();
  const t = String(m.transferTeam || '').trim();
  if (!p && !t) return null;
  if (p && t) return `Picker: ${p} · Transfer: ${t}`;
  if (p) return `Picker: ${p}`;
  return `Transfer: ${t}`;
}

function outboundMtrLogisticsMeta(m: MRNRecordFromApi | null | undefined): string | null {
  if (!m) return null;
  const tracking = String(m.logisticsTrackingNo || '').trim();
  const transporter = String(m.logisticsTransporter || '').trim();
  const vehicle = String(m.logisticsVehicleNo || '').trim();
  const parts = [
    tracking ? `Tracking: ${tracking}` : null,
    transporter ? `Transporter: ${transporter}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Mirrors backend outbound MTR allowed transitions. Returns error message or null. */
const OUTBOUND_MTR_ALLOWED: readonly [string, string][] = [
  ['Pending', 'Picked'],
  ['Pending', 'In Transit'],
  ['Pending', 'In Transfer'],
  ['Picked', 'In Transit'],
  ['Picked', 'In Transfer'],
  ['In Transfer', 'In Transit'],
  ['In Transit', 'Received at MU'],
  ['Received at MU', 'Completed'],
];

function validateOutboundMtrTransition(currentStatus: string | undefined, nextStatus: string): string | null {
  const curRaw = String(currentStatus || '').trim();
  const cur = curRaw.toLowerCase() === 'succeeded' ? 'Completed' : curRaw;
  const nextRaw = String(nextStatus || '').trim();
  const next = nextRaw.toLowerCase() === 'succeeded' ? 'Completed' : nextRaw;

  if (cur === next) return null;

  if (cur === 'Completed') {
    return 'This transfer is already completed; the status cannot be changed.';
  }

  const ok = OUTBOUND_MTR_ALLOWED.some(([a, b]) => a === cur && b === next);
  if (ok) return null;

  const hintByStatus: Record<string, string> = {
    Pending:
      'In Warehouse → Transfer orders, assign picker and tap Initiate transfer when ready (sets In transit).',
    Picked:
      'In Warehouse → Transfer orders, tap Initiate transfer to set In transit.',
    'In Transfer':
      'In Warehouse → Transfer orders, tap Initiate transfer to set In transit; when goods arrive at MU use Verify / Received at MU.',
    'In Transit':
      'When goods arrive at MU, tap Verify / Received at MU in Transfer orders before completing.',
    'Received at MU':
      'Enter MU zone and MU rack, then tap Mark Succeeded to complete.',
  };

  const hint =
    hintByStatus[cur] ||
    'Follow Warehouse → Transfer orders (Initiate transfer) → In transit → Received at MU → Mark Succeeded.';
  return `This step cannot be done yet (cannot move from "${cur}" to "${next}"). ${hint}`;
}

/** RM line on MTR (matches backend lineItemsIndicateRm heuristic). */
function mtrLineItemIsRm(li: { unit?: string; raw_material_id?: number }): boolean {
  if (li.raw_material_id != null) return true;
  return String(li.unit || '').toUpperCase() === 'KG';
}

function mtrLineItemIsPm(li: { unit?: string; pack_material_id?: number }): boolean {
  if (li.pack_material_id != null) return true;
  const u = String(li.unit || '').toUpperCase();
  return u === 'PCS' || u === 'PC' || u === 'PIECES';
}

const MTR_LINE_PHASE_SHORT: Record<string, string> = {
  not_initiated: 'WH pending',
  in_transit: 'In transit',
  received_at_mu: 'At MU',
  completed: 'Done',
};

function formatMtrLinePhaseShort(phase: string | undefined): string {
  return MTR_LINE_PHASE_SHORT[phase || 'not_initiated'] || phase || '';
}

function mtrLinePhaseRaw(mrn: MRNRecordFromApi, lineId: string): string {
  return String(mrn.lineTransferStatus?.[lineId] || 'not_initiated');
}

function mtrAllLinesCompletedApi(m: MRNRecordFromApi): boolean {
  const ids = m.lineItems?.map((li) => li.id) || [];
  const lts = m.lineTransferStatus || {};
  return ids.length > 0 && ids.every((id) => lts[id] === 'completed');
}

/** Every RM line on this MTR is verified at MU (or stock move completed) — required before starting RM dispensing. */
function mtrAllRmLinesReceivedAtMu(mrn: MRNRecordFromApi): boolean {
  const lines = (mrn.lineItems || []).filter(mtrLineItemIsRm);
  if (lines.length === 0) return true;
  return lines.every((li) => {
    const p = mtrLinePhaseRaw(mrn, li.id);
    return p === 'received_at_mu' || p === 'completed';
  });
}

function mtrAllPmLinesReceivedAtMu(mrn: MRNRecordFromApi): boolean {
  const lines = (mrn.lineItems || []).filter(mtrLineItemIsPm);
  if (lines.length === 0) return true;
  return lines.every((li) => {
    const p = mtrLinePhaseRaw(mrn, li.id);
    return p === 'received_at_mu' || p === 'completed';
  });
}

/* ──────────── MTR MODAL ────────────────────────────────────── */
/* Transfer endpoints are dynamic from Facility Management areas/zones/racks. */

function MTRModal({ batch, type, stockRM: _stockRM, stockPM: _stockPM, atFacilityRM, atFacilityPM, whStockOnlyRM, whStockOnlyPM, reservedRM, reservedPM, initialRmItems, onClose, onSave, onMtrCreated }: {
  batch: Batch; type: 'rm' | 'pm';
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  /** At production facility by code — for "already at facility" and to-transfer = required - atFacility */
  atFacilityRM?: Record<string, number>; atFacilityPM?: Record<string, number>;
  /** WH stock only (available to transfer = whStockOnly - reserved) */
  whStockOnlyRM?: Record<string, number>; whStockOnlyPM?: Record<string, number>;
  reservedRM?: Record<string, number>; reservedPM?: Record<string, number>;
  /** When batch.dispensingRM is empty (e.g. opened from Reserve RM), pass RM list from planning */
  initialRmItems?: DispensingItem[] | null;
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  /** After outbound MRN is created (not when skipping MTR via “all at MU”) */
  onMtrCreated?: () => void;
}) {
  const batchItems = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const passedItems = type === 'rm' ? (initialRmItems ?? []) : [];
  const baseItems = type === 'rm'
    ? (batchItems.length > 0 ? batchItems : passedItems)
    : batchItems;
  const atFacilityMap = type === 'rm' ? (atFacilityRM ?? {}) : (atFacilityPM ?? {});
  const whStockOnlyMap = type === 'rm' ? (whStockOnlyRM ?? {}) : (whStockOnlyPM ?? {});
  const reservedMap = type === 'rm' ? (reservedRM ?? {}) : (reservedPM ?? {});
  const unit = type === 'rm' ? 'KG' : 'pcs';

  // Troubleshooting: log MTR maps when batch/type change
  useEffect(() => {
    console.log('[MTRModal] maps', {
      type,
      batch: batch.bmrNo,
      atFacilityMap: { ...atFacilityMap },
      whStockOnlyMap: { ...whStockOnlyMap },
      reservedMap: { ...reservedMap },
    });
  }, [type, batch.bmrNo, atFacilityMap, whStockOnlyMap, reservedMap]);

  const [priority, setPriority] = useState('Normal');
  const [reqDate, setReqDate] = useState(type === 'rm' ? (batch.rmConnectDate || today()) : (batch.pmConnectDate || today()));
  const [warehouseAreas, setWarehouseAreas] = useState<FacilityAreaDTO[]>([]);
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  const [transferTo, setTransferTo] = useState('');
  const [derivedItems, setDerivedItems] = useState<DispensingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const effectiveItems = baseItems.length > 0 ? baseItems : derivedItems;
  // localItems[].required = qty to request (to transfer); default max(0, batch need - at facility)
  const [localItems, setLocalItems] = useState<DispensingItem[]>(() => effectiveItems.map(i => ({ ...i })));
  const shortages = localItems.map((it) => {
    const toTransfer = it.required;
    const availableWH = Math.max(0, (whStockOnlyMap[it.code] ?? 0) - (reservedMap[it.code] ?? 0));
    return { code: it.code, required: toTransfer, available: availableWH, short: toTransfer > availableWH };
  }).filter(x => x.short);
  const hasShortage = shortages.length > 0;

  const allWhZones = warehouseAreas.flatMap(a => a.zones);
  const allProductionZones = productionAreas.flatMap(a => a.zones);
  const mainWarehouseZone = allWhZones[0];

  const needLoadInMtr = (type === 'rm' && batchItems.length === 0 && passedItems.length === 0) || (type === 'pm' && batchItems.length === 0);
  useEffect(() => {
    if (!needLoadInMtr) return;
    setLoadingItems(true);
    const batchPk = (batch as Batch & { _pk?: number })._pk;
    const loadBatchBom = batchPk
      ? fetchBOMByBatchId(batchPk)
      : (batch.bmrNo ? fetchBatches().then((rows: BatchRow[]) => {
        const r = rows.find((x) => x.bmrNo === batch.bmrNo);
        return (r as { _pk?: number })?._pk ? fetchBOMByBatchId((r as { _pk: number })._pk) : { success: false as const, data: undefined };
      }) : Promise.resolve({ success: false as const, data: undefined }));

    // PM: use batch BOM (planning_batches) like ReserveMaterialModal so PM lines always show for this SO
    if (type === 'pm') {
      loadBatchBom
        .then((batchBomRes) => {
          if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'planning_batch' && (batchBomRes.data.pmLines?.length ?? 0) > 0) {
            const pmLines = (batchBomRes.data.pmLines ?? []) as BOMPmLine[];
            const batchUnits = (batchBomRes.data.batchSizeKg != null && batchBomRes.data.batchSizeKg > 0)
              ? Math.round(batchBomRes.data.batchSizeKg)
              : (batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : batch.batchSize || 0);
            const pmItems: DispensingItem[] = pmLines
              .filter((line) => line.pm_code || (line as { code?: string }).code)
              .map((line) => {
                const code = (line.pm_code || (line as { code?: string }).code) as string;
                const qtyPerUnit = Number((line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1)) || 1;
                const required = qtyPerUnit * batchUnits;
                return { code, name: (line.description ?? code) as string, inci: (line.description ?? code) as string, required, dispensed: 0, done: false };
              })
              .filter((x) => x.required > 0);
            setDerivedItems(pmItems);
            return;
          }
          // Fallback: planning-extracted items-involved
          return fetchPlanningExtractedList().then((rows) => {
            const row = findPlanningRowForBatch(rows, batch);
            if (!row) { setDerivedItems([]); return; }
            return fetchItemsInvolvedByPlanningId(row.id).then((involved) => {
              const batchCount = Math.max(1, batch.totalBatches || (row as { batchesRequired?: number }).batchesRequired || 1);
              const filtered = involved.filter((x) => x.type === 'PM');
              const items: DispensingItem[] = filtered.map((x) => ({
                code: x.code || '',
                inci: x.name || x.item,
                name: x.name || x.item,
                required: (x.totalRequired ?? 0) / batchCount,
                dispensed: 0,
                done: false,
              })).filter((x) => x.code && x.required > 0);
              setDerivedItems(items);
            });
          });
        })
        .catch(() => setDerivedItems([]))
        .finally(() => setLoadingItems(false));
      return;
    }

    // RM: planning-extracted + items-involved
    fetchPlanningExtractedList()
      .then((rows) => {
        const row = findPlanningRowForBatch(rows, batch);
        if (!row) {
          setDerivedItems([]);
          return;
        }
        return fetchItemsInvolvedByPlanningId(row.id).then((involved) => {
          const batchCount = Math.max(1, batch.totalBatches || (row as { batchesRequired?: number }).batchesRequired || 1);
          const filtered = involved.filter((x) => x.type === 'RM');
          const items: DispensingItem[] = filtered.map((x) => ({
            code: x.code || '',
            inci: x.name || x.item,
            name: x.name || x.item,
            required: (x.totalRequired ?? 0) / batchCount,
            dispensed: 0,
            done: false,
          })).filter((x) => x.code && x.required > 0);
          setDerivedItems(items);
        });
      })
      .catch(() => setDerivedItems([]))
      .finally(() => setLoadingItems(false));
  }, [needLoadInMtr, type, batch.soNo, batch.productName, batch.sku, batch.totalBatches, batch.bmrNo, batch.orderQty, batch.batchSize, (batch as Batch & { _pk?: number })._pk]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (effectiveItems.length > 0) {
      const next = effectiveItems.map(i => ({
        ...i,
        required: Math.max(0, (i.required ?? 0) - (atFacilityMap[i.code] ?? 0)),
        dispensed: 0,
        done: false,
      }));
      console.log('[MTRModal] initial localItems (from effectiveItems)', {
        type,
        batch: batch.bmrNo,
        items: effectiveItems.map((i, idx) => ({
          code: i.code,
          requiredTotal: i.required,
          atFacility: atFacilityMap[i.code] ?? 0,
          initialToTransfer: next[idx]?.required ?? 0,
        })),
      });
      setLocalItems(next);
    }
  }, [batch.bmrNo, type, effectiveItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (needLoadInMtr && derivedItems.length > 0 && localItems.length === 0) {
      const next = derivedItems.map(i => ({
        ...i,
        required: Math.max(0, (i.required ?? 0) - (atFacilityMap[i.code] ?? 0)),
        dispensed: 0,
        done: false,
      }));
      console.log('[MTRModal] initial localItems (from derivedItems)', {
        type,
        batch: batch.bmrNo,
        items: derivedItems.map((i, idx) => ({
          code: i.code,
          requiredTotal: i.required,
          atFacility: atFacilityMap[i.code] ?? 0,
          initialToTransfer: next[idx]?.required ?? 0,
        })),
      });
      setLocalItems(next);
    }
  }, [needLoadInMtr, derivedItems, localItems.length]); // eslint-disable-line react-hooks/exhaustive-deps  

  useEffect(() => {
    Promise.all([
      fetchFacilityAreas('warehouse'),
      fetchFacilityAreas('production'),
    ]).then(([whRes, prodRes]) => {
      const wh = whRes.data || [];
      const prod = prodRes.data || [];
      setWarehouseAreas(wh);
      setProductionAreas(prod);
      const whZones = wh.flatMap(a => a.zones);
      const mainWh = whZones[0];
      const prodZones = prod.flatMap((a) => a.zones);
      if (type === 'rm' && !transferTo) setTransferTo(prodZones[0]?.code ?? '');
      if (type === 'pm' && mainWh && !transferTo) setTransferTo(mainWh.code);
    });
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const transferFrom = type === 'rm' ? (mainWarehouseZone?.code ?? '') : (allProductionZones[0]?.code ?? '');
  const fromLabel = type === 'rm' ? 'Main Warehouse' : (allProductionZones.find(z => z.code === transferFrom)?.name ?? 'Production');
  const toLabel = type === 'rm'
    ? (allProductionZones.find(z => z.code === transferTo)?.name ?? transferTo)
    : (allWhZones.find(z => z.code === transferTo)?.name ?? 'Main Warehouse');

  const { addToast } = useToast();
  const [sending, setSending] = useState(false);
  const setItemQty = (index: number, qty: number) => {
    setLocalItems(prev => prev.map((it, i) => i === index ? { ...it, required: qty } : it));
  };

  const linesToSend = localItems.filter((it) => (it.required ?? 0) > 0);
  const allAtMu = localItems.length > 0 && linesToSend.length === 0;

  const applyStepUpdates = (): Partial<Batch> => {
    const updates: Partial<Batch> = type === 'rm'
      ? { rmConnected: true, bmrStatus: (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') ? 'rm_connected' : batch.bmrStatus }
      : { pmConnected: true, bprStatus: batch.bprStatus === 'pm_reserved' ? 'pm_connected' : batch.bprStatus };
    if (type === 'rm' && effectiveItems.length > 0) {
      updates.dispensingRM = effectiveItems.map((i) => ({ ...i, dispensed: 0, done: false }));
    } else if (type === 'pm' && effectiveItems.length > 0) {
      updates.dispensingPM = effectiveItems.map((i) => ({ ...i, dispensed: 0, done: false }));
    }
    return updates;
  };

  const handleCompleteStep = () => {
    if (effectiveItems.length === 0) return;
    setSending(true);
    onSave(applyStepUpdates());
    onClose();
    setSending(false);
  };

  const handleSubmit = async () => {
    // Only include lines with quantity to transfer (required > 0)
    if (linesToSend.length === 0) return;
    console.log('[MTRModal] submit payload', {
      type,
      batch: batch.bmrNo,
      lineItems: linesToSend.map(({ code, required }) => ({ code, quantity: required })),
    });
    setSending(true);
    try {
      await createMRN({
        requestedBy: 'Production (MTR)',
        notes: `MTR for ${type === 'rm' ? batch.bmrNo : batch.bprNo}`,
        lineItems: linesToSend.map((it, i) => ({
          id: `m${i + 1}`,
          code: it.code,
          itemCode: it.code,
          quantity: it.required ?? 0,
          unit: type === 'rm' ? 'KG' : 'PCS',
          notes: it.inci || it.name || '',
        })),
        bmrNo: batch.bmrNo,
        source: 'MTR',
        itemType: type,
      });
      addToast(
        'success',
        'Transfer request created. Warehouse → Transfer orders: assign picker and Initiate transfer (In transit), then use Transfer orders here for Received at MU and complete to unlock RM/PM dispensing.',
      );
      onMtrCreated?.();
      onClose();
    } catch (err) {
      const e = err as Error & { body?: { error?: string }; status?: number };
      const bodyErr = e.body && typeof e.body === 'object' && e.body && 'error' in e.body && typeof (e.body as { error?: string }).error === 'string'
        ? (e.body as { error: string }).error
        : null;
      addToast('error', bodyErr || e.message || 'Failed to create MTR (MRN).');
    } finally {
      setSending(false);
    }
  };

  const fmt = (n: number) => (type === 'rm' ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(Math.round(n)));

  return (
    <Modal onClose={onClose} title={`Material Transfer Request - ${type === 'rm' ? batch.bmrNo : batch.bprNo}`}>
      <Tip color="orange" icon={<Send size={14} />}>Request transfer of {type.toUpperCase()} from <b>{fromLabel}</b> to <b>{toLabel}</b></Tip>
      {hasShortage && (
        <div className="mt-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span><strong>Insufficient at source:</strong> To transfer exceeds Available (WH) for some items. Reduce &quot;To transfer&quot; or ensure more stock is available at warehouse (WH − reserved).</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className={LBL}>Transfer From</label>
          <div className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">{fromLabel}</div>
        </div>
        <div>
          <label className={LBL}>Transfer To</label>
          {type === 'rm' ? (
            <select className={INP} value={transferTo} onChange={e => setTransferTo(e.target.value)}>
              {allProductionZones.length === 0 && <option value="">No production zones configured</option>}
              {allProductionZones.map(z => (
                <option key={z.code} value={z.code}>{z.name}</option>
              ))}
            </select>
          ) : (
            <select className={INP} value={transferTo} onChange={e => setTransferTo(e.target.value)}>
              {allWhZones.length === 0 && <option value="">Loading...</option>}
              {allWhZones.map(z => (
                <option key={z.code} value={z.code}>{z.name}{z.zoneLabel ? ` — ${z.zoneLabel}` : ''}</option>
              ))}
            </select>
          )}
        </div>
        <div><label className={LBL}>Required By Date</label><input type="date" className={INP} value={reqDate} onChange={e => setReqDate(e.target.value)} /></div>
        <div><label className={LBL}>Priority</label><select className={INP} value={priority} onChange={e => setPriority(e.target.value)}><option>Urgent</option><option>Normal</option><option>Low</option></select></div>
      </div>
      <SectionLabel icon={<Package size={12} />} color="text-gray-600">
        Items to Transfer — x = needed, y = already at production facility, to transfer = max(0, x−y). Available at source = WH − reserved.
      </SectionLabel>
      {loadingItems && (
        <div className="py-4 text-center text-sm text-gray-500">Loading items for this batch…</div>
      )}
      {!loadingItems && localItems.length === 0 && (
        <div className="py-3 px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">No {type.toUpperCase()} items for this batch. Confirm BOM in Planning for this SO{type === 'rm' ? ', or reserve RM first' : ', or reserve PM first'}.</div>
      )}
      {localItems.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
          <table className="w-full">
            <thead><tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Item</th>
              <th className="px-2 py-1.5 text-left">Code</th>
              <th className="px-2 py-1.5 text-right">Required</th>
              <th className="px-2 py-1.5 text-right">At production facility</th>
              <th className="px-2 py-1.5 text-left">To transfer</th>
              <th className="px-2 py-1.5 text-right">Available (WH)</th>
              <th className="px-2 py-1.5 text-left">Unit</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">{localItems.map((r, i) => {
              const batchNeed = effectiveItems[i]?.required ?? r.required;
              const atFacility = atFacilityMap[r.code] ?? 0;
              const toTransfer = r.required;
              const availableWH = Math.max(0, (whStockOnlyMap[r.code] ?? 0) - (reservedMap[r.code] ?? 0));
              const short = toTransfer > availableWH;
              return (
                <tr key={i} className={short ? 'bg-amber-50/60' : ''}>
                  <td className="px-2 py-1.5 font-semibold">{r.inci || r.name}</td>
                  <td className="px-2 py-1.5 text-gray-500 font-mono">{r.code}</td>
                  <td className="px-2 py-1.5 font-mono text-right">{fmt(batchNeed)}</td>
                  <td className="px-2 py-1.5 font-mono text-right text-blue-600">{fmt(atFacility)}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" className="w-20 px-1.5 py-0.5 border border-gray-200 rounded font-mono text-right" min={0} step={type === 'rm' ? 0.01 : 1} value={type === 'rm' ? toTransfer : toTransfer} onChange={e => setItemQty(i, type === 'rm' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value, 10) || 0)} />
                  </td>
                  <td className={`px-2 py-1.5 font-mono text-right ${short ? 'text-amber-600' : 'text-gray-700'}`}>
                    {fmt(availableWH)}{short && <span className="text-red-600 ml-1">(short {fmt(toTransfer - availableWH)})</span>}
                  </td>
                  <td className="px-2 py-1.5">{unit}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        {allAtMu ? (
          <button onClick={handleCompleteStep} disabled={sending} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"><CheckCircle2 size={13} /> {sending ? 'Completing…' : 'Complete step'}</button>
        ) : (
          <button onClick={handleSubmit} disabled={sending || linesToSend.length === 0} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"><Send size={13} /> {sending ? 'Sending…' : 'Send MTR'}</button>
        )}
      </div>
    </Modal>
  );
}

/* ──────────── TRANSFER ORDERS (MU INBOUND) ────────────────────── */
const MRN_STATUS_OPTIONS = ['Pending', 'In Transit', 'Received at MU', 'Succeeded'];

/** Scan simulator: paste QR payload JSON → show decoded text + action (like GRN). */
function MRNScanSimulator({ mrnNo }: { mrnNo: string }) {
  const [pasteInput, setPasteInput] = useState('');
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  useEffect(() => {
    const raw = pasteInput.trim();
    if (!raw) { setDecoded(null); setParseError(null); return; }
    try {
      setDecoded(JSON.parse(raw) as Record<string, unknown>);
      setParseError(null);
    } catch {
      setDecoded(null);
      setParseError('Invalid JSON. Paste the exact QR payload.');
    }
  }, [pasteInput]);
  return (
    <div className="space-y-3">
      <textarea
        value={pasteInput}
        onChange={(e) => setPasteInput(e.target.value)}
        placeholder='Paste QR payload e.g. {"mrn_no":"EI-MRN-2026-001","box_index":1,...}'
        rows={2}
        className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white"
      />
      {parseError && <p className="text-xs text-red-600">{parseError}</p>}
      {decoded && !parseError && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700 uppercase">Decoded</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-800">
            {Object.entries(decoded).map(([k, v]) => (
              <span key={k} className="col-span-2 sm:col-span-1"><dt className="inline font-medium">{k}:</dt> <dd className="inline">{String(v ?? '—')}</dd></span>
            ))}
          </dl>
          <p className="text-xs font-semibold text-emerald-700 pt-2 border-t border-slate-200">Action: Put away at MU location (from QR) and record movement.</p>
        </div>
      )}
    </div>
  );
}

function muFacilityZoneDisplayLabel(zone: ZoneDTO): string {
  const zl = zone.zoneLabel?.trim();
  if (zl) return zl;
  return `${zone.code} — ${zone.name}`.trim();
}

/** Match saved MRN MU zone/rack strings to production facility hierarchy (area_type=production). */
function matchMrnMuLocationToFacility(
  muReceiveZone: string | null | undefined,
  muReceiveRack: string | null | undefined,
  areas: FacilityAreaDTO[]
): { areaId: number; zoneId: number; rackId: number } | null {
  const zt = (muReceiveZone || '').trim();
  const rt = (muReceiveRack || '').trim();
  if (!rt) return null;

  type Item = { areaId: number; zoneId: number; rackId: number; zone: ZoneDTO };
  const matches: Item[] = [];
  for (const area of areas) {
    for (const zone of area.zones || []) {
      for (const rack of zone.racks || []) {
        const code = String(rack.code || '').trim();
        const name = String(rack.name || '').trim();
        if (code !== rt && name !== rt) continue;
        matches.push({ areaId: area.id, zoneId: zone.id, rackId: rack.id, zone });
      }
    }
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const m = matches[0]!;
    return { areaId: m.areaId, zoneId: m.zoneId, rackId: m.rackId };
  }
  if (zt) {
    const byZoneCode = matches.find((m) => m.zone.code === zt);
    if (byZoneCode) return { areaId: byZoneCode.areaId, zoneId: byZoneCode.zoneId, rackId: byZoneCode.rackId };
    const byLabel = matches.find(
      (m) => muFacilityZoneDisplayLabel(m.zone) === zt || m.zone.name?.trim() === zt
    );
    if (byLabel) return { areaId: byLabel.areaId, zoneId: byLabel.zoneId, rackId: byLabel.rackId };
  }
  const sorted = [...matches].sort((a, b) => a.areaId - b.areaId || a.zoneId - b.zoneId || a.rackId - b.rackId);
  const m = sorted[0]!;
  return { areaId: m.areaId, zoneId: m.zoneId, rackId: m.rackId };
}

function MRNDetailModal({
  mrn,
  assignablePickers = [],
  onClose,
  onSave,
}: {
  mrn: MRNRecordFromApi;
  assignablePickers: MRNAssignablePicker[];
  onClose: () => void;
  onSave: (updated: MRNRecordFromApi) => void;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: productionFacilityRaw = [], isLoading: productionFacilityLoading } = useQuery({
    queryKey: ['facility-areas', 'production', 'mrn-modal'],
    queryFn: async () => {
      const res = await fetchFacilityAreas('production');
      return res.success ? res.data : [];
    },
  });
  const productionFacilityData = useMemo(() => productionFacilityRaw as FacilityAreaDTO[], [productionFacilityRaw]);

  const [status, setStatus] = useState(mrn.status);
  const [assignedPicker, setAssignedPicker] = useState(mrn.assignedPicker || '');
  const [receivedAtMu, setReceivedAtMu] = useState(mrn.receivedAtMu ? (mrn.receivedAtMu as string).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [muReceiveZone, setMuReceiveZone] = useState(mrn.muReceiveZone ?? '');
  const [muReceiveRack, setMuReceiveRack] = useState(mrn.muReceiveRack ?? '');
  const [muLocationSource, setMuLocationSource] = useState<'facility' | 'custom'>('facility');
  const [selectedMuAreaId, setSelectedMuAreaId] = useState<number | ''>('');
  const [selectedMuZoneId, setSelectedMuZoneId] = useState<number | ''>('');
  const [selectedMuRackId, setSelectedMuRackId] = useState<number | ''>('');
  const [noOfBoxes, setNoOfBoxes] = useState(String(mrn.noOfBoxes ?? 1));
  const [unitsPerBox, setUnitsPerBox] = useState(String(mrn.unitsPerBox ?? ''));
  const [locationPrefix, setLocationPrefix] = useState(mrn.locationPrefix ?? '');
  const [grnBatchMfg, setGrnBatchMfg] = useState(mrn.grnBatchMfg ?? '');
  const [expiry, setExpiry] = useState((mrn.expiry as string) ?? '');
  const [mfgBatch, setMfgBatch] = useState(mrn.mfgBatch ?? '');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>(mrn.lineItems?.[0]?.id ?? '');
  const [labels, setLabels] = useState<GeneratedMRNLabel[] | null>(mrn.generatedLabels ?? null);
  const [labelsGenerated, setLabelsGenerated] = useState(!!(mrn.generatedLabels && mrn.generatedLabels.length > 0));
  const [generatingLabels, setGeneratingLabels] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logisticsModalOpen, setLogisticsModalOpen] = useState(false);
  const [logisticsTrackingNo, setLogisticsTrackingNo] = useState(mrn.logisticsTrackingNo ?? '');
  const [logisticsTransporter, setLogisticsTransporter] = useState(mrn.logisticsTransporter ?? '');
  const [logisticsDispatchDate, setLogisticsDispatchDate] = useState((mrn.logisticsDispatchDate as string) ?? new Date().toISOString().slice(0, 10));
  const [logisticsEtaDate, setLogisticsEtaDate] = useState((mrn.logisticsEtaDate as string) ?? '');
  const [logisticsVehicleNo, setLogisticsVehicleNo] = useState(mrn.logisticsVehicleNo ?? '');
  const [locationHistory, setLocationHistory] = useState<MRNLocationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedLineItem = mrn.lineItems?.find((li) => li.id === selectedLineItemId) ?? mrn.lineItems?.[0];

  const inTransitLineIds = useMemo(
    () =>
      (mrn.lineItems || [])
        .filter((li) => mtrLinePhaseRaw(mrn, li.id) === 'in_transit')
        .map((li) => li.id),
    [mrn.lineItems, mrn.lineTransferStatus],
  );
  const receivedAtMuLineIds = useMemo(
    () =>
      (mrn.lineItems || [])
        .filter((li) => mtrLinePhaseRaw(mrn, li.id) === 'received_at_mu')
        .map((li) => li.id),
    [mrn.lineItems, mrn.lineTransferStatus],
  );

  const [recvLinePick, setRecvLinePick] = useState<Record<string, boolean>>({});
  const [completeLinePick, setCompleteLinePick] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    inTransitLineIds.forEach((id) => {
      next[id] = true;
    });
    setRecvLinePick(next);
  }, [mrn.id, JSON.stringify(inTransitLineIds)]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    receivedAtMuLineIds.forEach((id) => {
      next[id] = true;
    });
    setCompleteLinePick(next);
  }, [mrn.id, JSON.stringify(receivedAtMuLineIds)]);

  useEffect(() => {
    setStatus(mrn.status);
    setAssignedPicker(mrn.assignedPicker || '');
    setReceivedAtMu(mrn.receivedAtMu ? (mrn.receivedAtMu as string).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNoOfBoxes(String(mrn.noOfBoxes ?? 1));
    setUnitsPerBox(String(mrn.unitsPerBox ?? ''));
    setLabels(mrn.generatedLabels ?? null);
    setLabelsGenerated(!!(mrn.generatedLabels && mrn.generatedLabels.length > 0));
    setLogisticsTrackingNo(mrn.logisticsTrackingNo ?? '');
    setLogisticsTransporter(mrn.logisticsTransporter ?? '');
    setLogisticsDispatchDate((mrn.logisticsDispatchDate as string) ?? new Date().toISOString().slice(0, 10));
    setLogisticsEtaDate((mrn.logisticsEtaDate as string) ?? '');
    setLogisticsVehicleNo(mrn.logisticsVehicleNo ?? '');
  }, [mrn.id, mrn.status, mrn.assignedPicker, mrn.receivedAtMu, mrn.noOfBoxes, mrn.unitsPerBox, mrn.generatedLabels, mrn.lineTransferStatus]);

  useEffect(() => {
    if (productionFacilityLoading) return;
    const areas = productionFacilityData;
    if (areas.length === 0) {
      setMuLocationSource('custom');
      setSelectedMuAreaId('');
      setSelectedMuZoneId('');
      setSelectedMuRackId('');
      setMuReceiveZone(mrn.muReceiveZone ?? '');
      setMuReceiveRack(mrn.muReceiveRack ?? '');
      setLocationPrefix(mrn.locationPrefix ?? '');
      return;
    }
    const m = matchMrnMuLocationToFacility(mrn.muReceiveZone, mrn.muReceiveRack, areas);
    if (m) {
      setMuLocationSource('facility');
      setSelectedMuAreaId(m.areaId);
      setSelectedMuZoneId(m.zoneId);
      setSelectedMuRackId(m.rackId);
      const area = areas.find((a) => a.id === m.areaId);
      const zone = area?.zones?.find((z) => z.id === m.zoneId);
      const rack = zone?.racks?.find((r) => r.id === m.rackId);
      if (zone) setMuReceiveZone(zone.code);
      if (rack) {
        setMuReceiveRack(rack.code);
        setLocationPrefix(rack.code);
      }
    } else {
      setMuLocationSource('custom');
      setSelectedMuAreaId('');
      setSelectedMuZoneId('');
      setSelectedMuRackId('');
      setMuReceiveZone(mrn.muReceiveZone ?? '');
      setMuReceiveRack(mrn.muReceiveRack ?? '');
      setLocationPrefix(mrn.locationPrefix ?? '');
    }
  }, [mrn.id, mrn.muReceiveZone, mrn.muReceiveRack, mrn.locationPrefix, productionFacilityData, productionFacilityLoading]);

  useEffect(() => {
    if (muLocationSource !== 'facility') return;
    const area = productionFacilityData.find((a) => a.id === selectedMuAreaId);
    const zone = area?.zones?.find((z) => z.id === selectedMuZoneId);
    const rack = zone?.racks?.find((r) => r.id === selectedMuRackId);
    if (zone) setMuReceiveZone(zone.code);
    else setMuReceiveZone('');
    if (rack) {
      setMuReceiveRack(rack.code);
      setLocationPrefix(rack.code);
    } else {
      setMuReceiveRack('');
      setLocationPrefix('');
    }
  }, [muLocationSource, selectedMuAreaId, selectedMuZoneId, selectedMuRackId, productionFacilityData]);

  useEffect(() => {
    setHistoryLoading(true);
    fetchMRNLocationHistory(mrn.id)
      .then(setLocationHistory)
      .catch(() => setLocationHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [mrn.id]);

  const selectedMuArea = useMemo(
    () => productionFacilityData.find((a) => a.id === selectedMuAreaId),
    [productionFacilityData, selectedMuAreaId]
  );
  const muZoneOptions = selectedMuArea?.zones ?? [];
  const selectedMuZone = useMemo(
    () => muZoneOptions.find((z) => z.id === selectedMuZoneId),
    [muZoneOptions, selectedMuZoneId]
  );
  const muRackOptionsSorted = useMemo(() => {
    const racks = selectedMuZone?.racks ?? [];
    return [...racks].sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  }, [selectedMuZone]);

  const isOutboundMtr = mrn.source === 'MTR' && !mrn.isInboundFromMu;
  const muStorageFilled = Boolean(muReceiveZone.trim() && muReceiveRack.trim());
  const hasInTransitForReceive = isOutboundMtr && inTransitLineIds.length > 0;
  const hasReceivedLinesToComplete = isOutboundMtr && receivedAtMuLineIds.length > 0;
  const canCompleteOutboundTransfer = isOutboundMtr && hasReceivedLinesToComplete && muStorageFilled;

  const isClosedStatus = (value: string | undefined) => {
    const s = String(value || '').trim().toLowerCase();
    return s === 'completed' || s === 'succeeded';
  };

  const persistUpdate = async (payload: Partial<MRNRecordFromApi> & {
    initiateTransferLineIds?: string[];
    receiveAtMuLineIds?: string[];
    completeTransferLineIds?: string[];
  }) => {
    if (saving) return;

    if (isOutboundMtr && isClosedStatus(mrn.status)) {
      const touchesWorkflow =
        payload.status !== undefined ||
        (Array.isArray(payload.initiateTransferLineIds) && payload.initiateTransferLineIds.length > 0) ||
        (Array.isArray(payload.receiveAtMuLineIds) && payload.receiveAtMuLineIds.length > 0) ||
        (Array.isArray(payload.completeTransferLineIds) && payload.completeTransferLineIds.length > 0);
      if (touchesWorkflow) {
        const msg = 'This transfer is already completed.';
        setSaveError(msg);
        addToast('error', msg);
        return;
      }
    }

    if (
      isOutboundMtr &&
      Array.isArray(payload.receiveAtMuLineIds) &&
      payload.receiveAtMuLineIds.length > 0
    ) {
      const anyInTransit = payload.receiveAtMuLineIds.some((id) => mtrLinePhaseRaw(mrn, id) === 'in_transit');
      if (!anyInTransit) {
        const msg = 'No selected lines are still in transit. Refresh the transfer and try again.';
        setSaveError(msg);
        addToast('error', msg);
        return;
      }
    }

    if (
      isOutboundMtr &&
      Array.isArray(payload.completeTransferLineIds) &&
      payload.completeTransferLineIds.length > 0
    ) {
      const anyReceived = payload.completeTransferLineIds.some((id) => mtrLinePhaseRaw(mrn, id) === 'received_at_mu');
      if (!anyReceived) {
        const msg = 'No selected lines are still in received-at-MU state. Refresh the transfer and try again.';
        setSaveError(msg);
        addToast('error', msg);
        return;
      }
    }

    const nextStatus = payload.status !== undefined ? payload.status : status;
    if (isOutboundMtr && payload.status !== undefined) {
      const st = String(payload.status);
      if (st !== 'Succeeded' && st !== 'Completed') {
        const err = validateOutboundMtrTransition(mrn.status, String(payload.status));
        if (err) {
          setSaveError(err);
          addToast('error', err);
          return;
        }
      }
    }
    if (nextStatus === 'Succeeded' && !isClosedStatus(mrn.status) && isOutboundMtr) {
      const z = String((payload.muReceiveZone !== undefined ? payload.muReceiveZone : muReceiveZone) || '').trim();
      const r = String((payload.muReceiveRack !== undefined ? payload.muReceiveRack : muReceiveRack) || '').trim();
      if (!z || !r) {
        const msg =
          muLocationSource === 'facility'
            ? 'Select production area, zone, and rack from Facility Management before completing the transfer.'
            : 'Enter MU zone and MU rack before completing the transfer.';
        setSaveError(msg);
        addToast('error', msg);
        return;
      }
      const hasRecv = (mrn.lineItems || []).some((li) => mtrLinePhaseRaw(mrn, li.id) === 'received_at_mu');
      if (!hasRecv) {
        const msg = 'Mark at least one line as received at MU first.';
        setSaveError(msg);
        addToast('error', msg);
        return;
      }
    }

    const isInitiatingTransfer =
      isOutboundMtr &&
      String(nextStatus).trim() === 'In Transit' &&
      Array.isArray(payload.initiateTransferLineIds) &&
      payload.initiateTransferLineIds.length > 0;
    const missingInitiationLogistics =
      !logisticsTrackingNo.trim() ||
      !logisticsTransporter.trim() ||
      !logisticsVehicleNo.trim() ||
      !logisticsDispatchDate;
    if (isInitiatingTransfer && missingInitiationLogistics) {
      setLogisticsModalOpen(true);
      addToast('error', 'Enter transfer details in the popup before initiating transfer.');
      return;
    }
    const mlZoneForInitiate = String(
      (payload.muReceiveZone !== undefined ? payload.muReceiveZone : muReceiveZone) || ''
    ).trim();
    if (isInitiatingTransfer && !mlZoneForInitiate) {
      const msg = 'Select ML location (destination MU zone) before initiating transfer.';
      setSaveError(msg);
      addToast('error', msg);
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      // When the user typed a custom production zone/rack for MU receive, auto-register
      // it into Facility Management so the pair becomes selectable next time.
      // Idempotent: reuses an existing zone/rack when the text matches. Non-fatal: if
      // registration fails we still persist the MRN so the user's save is not lost.
      const effMuZone = String((payload.muReceiveZone as string | undefined) ?? muReceiveZone ?? '').trim();
      const effMuRack = String((payload.muReceiveRack as string | undefined) ?? muReceiveRack ?? '').trim();
      if (muLocationSource === 'custom' && effMuZone && effMuRack) {
        try {
          const ensured = await ensureCustomZoneAndRack({
            areaType: 'production',
            zoneText: effMuZone,
            rackText: effMuRack,
          });
          if (ensured.success) {
            queryClient.invalidateQueries({ queryKey: ['facility-areas'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
          } else if (ensured.error) {
            console.warn('[MRN] ensureCustomZoneAndRack failed:', ensured.error);
          }
        } catch (e) {
          console.warn('[MRN] ensureCustomZoneAndRack threw:', e);
        }
      }

      const res = await updateMRN(mrn.id, {
        status,
        ...(!isOutboundMtr ? { assignedPicker: assignedPicker || undefined } : {}),
        receivedAtMu: receivedAtMu || undefined,
        muReceiveZone: muReceiveZone || undefined,
        muReceiveRack: muReceiveRack || undefined,
        logisticsTrackingNo: logisticsTrackingNo.trim() || undefined,
        logisticsTransporter: logisticsTransporter.trim() || undefined,
        logisticsDispatchDate: logisticsDispatchDate || undefined,
        logisticsEtaDate: logisticsEtaDate || undefined,
        logisticsVehicleNo: logisticsVehicleNo.trim() || undefined,
        noOfBoxes: noOfBoxes ? parseInt(noOfBoxes, 10) : undefined,
        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : undefined,
        locationPrefix: locationPrefix || undefined,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        ...payload,
      });
      const updated = res as MRNRecordFromApi;
      setStatus(updated.status);
      onSave(updated);
      const closed =
        (payload.status === 'Succeeded' || payload.status === 'Completed') &&
        mtrAllLinesCompletedApi(updated);
      if (closed) onClose();
    } catch (e) {
      const msg = getApiErrorMessage(e) || 'Failed to save';
      setSaveError(msg);
      if (
        msg.toLowerCase().includes('before initiating transfer') &&
        !msg.toLowerCase().includes('ml location')
      ) {
        setLogisticsModalOpen(true);
      }
      addToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLabels = async () => {
    const numBoxes = Math.max(1, parseInt(noOfBoxes, 10) || 1);
    const numUnits = parseInt(unitsPerBox, 10) || 0;
    if (mrn.lineItems && mrn.lineItems.length > 0 && selectedLineItem && numBoxes * numUnits !== selectedLineItem.quantity) {
      setLabelError(`No of boxes × Units/box (${numBoxes} × ${numUnits}) should equal line quantity (${selectedLineItem.quantity}) for selected item.`);
      return;
    }
    setLabelError(null);
    setGeneratingLabels(true);
    try {
      const res = await generateMRNLabels(mrn.id, {
        noOfBoxes: numBoxes,
        unitsPerBox: numUnits || undefined,
        locationPrefix: locationPrefix || undefined,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        productName: selectedLineItem?.item,
        itemCode: selectedLineItem?.itemCode,
      });
      setLabels(res.labels);
      setLabelsGenerated(true);
      const updated = await updateMRN(mrn.id, { generatedLabels: res.labels });
      onSave(updated as MRNRecordFromApi);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setLabelError(err?.response?.data?.error || (e instanceof Error ? e.message : 'Failed to generate labels'));
    } finally {
      setGeneratingLabels(false);
    }
  };

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—');
  const logisticsSummary = outboundMtrLogisticsMeta(mrn);
  const initiateSelectedIds = Object.entries(recvLinePick)
    .filter(([k, v]) => v && mtrLinePhaseRaw(mrn, k) === 'not_initiated')
    .map(([k]) => k);
  const handleSubmitLogistics = () => {
    if (initiateSelectedIds.length === 0) {
      addToast('error', 'Select at least one line that is pending initiation.');
      return;
    }
    if (!logisticsTrackingNo.trim() || !logisticsTransporter.trim() || !logisticsVehicleNo.trim() || !logisticsDispatchDate) {
      addToast('error', 'Fill required transfer details: Tracking/LR no, driver/transporter, vehicle no, and dispatch date.');
      return;
    }
    setLogisticsModalOpen(false);
    persistUpdate({
      status: 'In Transit',
      initiateTransferLineIds: initiateSelectedIds,
      logisticsTrackingNo: logisticsTrackingNo.trim(),
      logisticsTransporter: logisticsTransporter.trim(),
      logisticsDispatchDate,
      logisticsEtaDate: logisticsEtaDate || undefined,
      logisticsVehicleNo: logisticsVehicleNo.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Transfer order — {mrn.mrnNo}</h2>
            <p className="text-sm text-slate-600 mt-0.5">{mrn.requestedBy} {mrn.bmrNo ? ` · ${mrn.bmrNo}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-amber-100 text-amber-700 border-amber-300">{status}</span>
            {mrn.source && <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-xs font-semibold">{mrn.source}</span>}
          </div>

          <section className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Assign & receive</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status</label>
                {isOutboundMtr ? (
                  <div className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
                    <span className="font-semibold text-slate-900">{status}</span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{outboundMtrStageHint({ ...mrn, status })}</p>
                  </div>
                ) : (
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {MRN_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Assigned picker</label>
                {isOutboundMtr ? (
                  <div className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
                    <span className={mrn.assignedPicker ? 'font-medium text-slate-900' : 'text-slate-500'}>
                      {mrn.assignedPicker?.trim() || 'Unassigned'}
                    </span>
                    {mrn.transferTeam?.trim() ? (
                      <p className="text-[11px] text-slate-800 mt-1 font-medium">Transfer: {mrn.transferTeam}</p>
                    ) : null}
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      Picker is assigned in Warehouse → Transfer orders (locked after first save). Production sees the same values here.
                    </p>
                  </div>
                ) : (
                  <select value={assignedPicker} onChange={(e) => setAssignedPicker(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">Unassigned</option>
                    {assignablePickers.map((u) => <option key={u.id} value={u.displayName}>{u.displayName}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Received at MU (date)</label>
                <input type="date" value={receivedAtMu} onChange={(e) => setReceivedAtMu(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            {isOutboundMtr && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-700">Shared logistics</p>
                    <p className="mt-1 text-sm text-slate-800">{logisticsSummary || 'Capture on Initiate transfer. Production and Warehouse read the same MRN values.'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dispatch: {formatDate(mrn.logisticsDispatchDate || logisticsDispatchDate || '')} · ETA: {formatDate(mrn.logisticsEtaDate || logisticsEtaDate || '')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-semibold text-slate-700">
                  MU put-away <span className="text-red-500">*</span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mrn-mu-location-source"
                    className="rounded-full border-slate-300"
                    checked={muLocationSource === 'facility'}
                    onChange={() => {
                      setMuLocationSource('facility');
                      const m = matchMrnMuLocationToFacility(muReceiveZone, muReceiveRack, productionFacilityData);
                      if (m) {
                        setSelectedMuAreaId(m.areaId);
                        setSelectedMuZoneId(m.zoneId);
                        setSelectedMuRackId(m.rackId);
                      }
                    }}
                  />
                  Facility Management (production)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mrn-mu-location-source"
                    className="rounded-full border-slate-300"
                    checked={muLocationSource === 'custom'}
                    onChange={() => setMuLocationSource('custom')}
                  />
                  Custom (type zone / rack)
                </label>
              </div>
              <p className="text-[10px] text-slate-500">
                Production areas, zones, and racks are maintained under <strong>Facility Management</strong> (type Production). Zone <span className="font-mono">code</span> is stored for stock routing (e.g. include <span className="font-mono">MU02</span> or <span className="font-mono">LOC-MU02</span> for ML2).
              </p>

              {muLocationSource === 'facility' && productionFacilityLoading && (
                <p className="text-xs text-slate-500">Loading production locations…</p>
              )}
              {muLocationSource === 'facility' && !productionFacilityLoading && productionFacilityData.length === 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  No production areas found. Add a production area, zones, and racks in Facility Management, or use Custom.
                </p>
              )}

              {muLocationSource === 'facility' && !productionFacilityLoading && productionFacilityData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Production area</label>
                    <select
                      value={selectedMuAreaId === '' ? '' : String(selectedMuAreaId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuAreaId(v ? parseInt(v, 10) : '');
                        setSelectedMuZoneId('');
                        setSelectedMuRackId('');
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="">— Select area —</option>
                      {productionFacilityData.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Zone</label>
                    <select
                      value={selectedMuZoneId === '' ? '' : String(selectedMuZoneId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuZoneId(v ? parseInt(v, 10) : '');
                        setSelectedMuRackId('');
                      }}
                      disabled={selectedMuAreaId === ''}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">— Select zone —</option>
                      {muZoneOptions.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.code} — {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Rack (code)</label>
                    <select
                      value={selectedMuRackId === '' ? '' : String(selectedMuRackId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuRackId(v ? parseInt(v, 10) : '');
                      }}
                      disabled={selectedMuZoneId === ''}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">— Select rack —</option>
                      {muRackOptionsSorted.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code}
                          {r.name ? ` — ${r.name}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedMuZoneId !== '' && muRackOptionsSorted.length === 0 && (
                      <p className="text-[10px] text-amber-700 mt-1">No racks in this zone. Add racks in Facility Management or use Custom.</p>
                    )}
                  </div>
                </div>
              )}

              {muLocationSource === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">MU zone</label>
                    <input
                      type="text"
                      value={muReceiveZone}
                      onChange={(e) => setMuReceiveZone(e.target.value)}
                      placeholder="e.g. LOC-MU01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">MU rack</label>
                    <input
                      type="text"
                      value={muReceiveRack}
                      onChange={(e) => setMuReceiveRack(e.target.value)}
                      placeholder="e.g. R1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {muLocationSource === 'facility' && !productionFacilityLoading && muReceiveZone && muReceiveRack && (
                <p className="text-[10px] text-slate-600">
                  Saved on MRN / movement log: <span className="font-mono font-medium">zone</span> = {muReceiveZone} ·{' '}
                  <span className="font-mono font-medium">rack</span> = {muReceiveRack}
                </p>
              )}
            </div>
          </section>

          {mrn.lineItems && mrn.lineItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Code</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Quantity</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Unit</th>
                      {isOutboundMtr && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Line transfer</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mrn.lineItems.map((item) => {
                      const phase = mtrLinePhaseRaw(mrn, item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 ${phase === 'completed' ? 'bg-slate-100/80 text-slate-500' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-900">{item.item}</td>
                          <td className="px-3 py-2 text-slate-500">{item.itemCode}</td>
                          <td className="px-3 py-2 text-center font-medium">{item.quantity}</td>
                          <td className="px-3 py-2 text-center">{item.unit}</td>
                          {isOutboundMtr && (
                            <td className="px-3 py-2 text-[10px] text-slate-700 align-top">
                              <div className="font-medium text-slate-800">{formatMtrLinePhaseShort(phase)}</div>
                              {phase === 'not_initiated' && (
                                <>
                                  <p className="mt-1 text-slate-500 italic">Pending release from warehouse — add logistics to initiate transfer.</p>
                                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!recvLinePick[item.id]}
                                      onChange={(e) =>
                                        setRecvLinePick((p) => ({ ...p, [item.id]: e.target.checked }))
                                      }
                                    />
                                    <span>Include in initiate transfer</span>
                                  </label>
                                </>
                              )}
                              {phase === 'in_transit' && (
                                <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!recvLinePick[item.id]}
                                    onChange={(e) =>
                                      setRecvLinePick((p) => ({ ...p, [item.id]: e.target.checked }))
                                    }
                                  />
                                  <span>Mark received</span>
                                </label>
                              )}
                              {phase === 'received_at_mu' && (
                                <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!completeLinePick[item.id]}
                                    onChange={(e) =>
                                      setCompleteLinePick((p) => ({ ...p, [item.id]: e.target.checked }))
                                    }
                                  />
                                  <span>Include in stock move</span>
                                </label>
                              )}
                              {phase === 'completed' && (
                                <p className="mt-1 text-slate-500">Stock move completed — no further action.</p>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Labels (QR per box for MU put-away)</h3>
            {mrn.lineItems && mrn.lineItems.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select line item for labels</label>
                <select value={selectedLineItemId} onChange={(e) => setSelectedLineItemId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  {mrn.lineItems.map((li) => <option key={li.id} value={li.id}>{li.item} ({li.itemCode}) — Qty: {li.quantity}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">No of boxes</label><input type="number" min={1} value={noOfBoxes} onChange={(e) => setNoOfBoxes(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Units/box</label><input type="number" min={0} value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Location prefix (MU)</label><input type="text" value={locationPrefix} onChange={(e) => setLocationPrefix(e.target.value)} placeholder="e.g. MU1-A" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Batch / expiry</label><input type="text" value={grnBatchMfg} onChange={(e) => setGrnBatchMfg(e.target.value)} placeholder="Batch" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></div>
            </div>
            <div className="flex items-center gap-3">
              {!labelsGenerated ? (
                <button onClick={handleGenerateLabels} disabled={generatingLabels} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50">
                  {generatingLabels ? 'Generating…' : 'Generate Labels'}
                </button>
              ) : (
                <button onClick={() => { setLabelsGenerated(false); setLabels(null); }} className="px-4 py-2 bg-slate-400 text-white rounded-lg font-medium text-sm hover:bg-slate-500">Hide Labels</button>
              )}
            </div>
            {labelError && <p className="text-sm text-red-600">{labelError}</p>}
          </section> */}

          {/* {labelsGenerated && labels && labels.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Label preview (one QR per box)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {labels.map((label) => {
                  let payload: Record<string, unknown> = {};
                  try { payload = JSON.parse(label.qrPayload); } catch { }
                  return (
                    <div key={label.boxIndex} className="bg-white border-2 border-slate-300 rounded-lg p-4 shadow-sm">
                      <p className="text-xs font-mono font-bold text-slate-900 mb-2">Box {label.boxIndex}</p>
                      <div className="flex justify-center mb-3"><img src={label.qrImageDataUrl} alt={`QR Box ${label.boxIndex}`} className="w-32 h-32 object-contain" /></div>
                      <div className="space-y-1 text-xs text-slate-600">
                        {payload.location_prefix && <p><span className="font-semibold">Location:</span> {String(payload.location_prefix)}</p>}
                        <p><span className="font-semibold">MRN:</span> {String(payload.mrn_no ?? '')}</p>
                        <p><span className="font-semibold">Units/box:</span> {String(payload.units_per_box ?? '')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2">On scan — simulate</h4>
                <MRNScanSimulator mrnNo={mrn.mrnNo} />
              </div>
            </section>
          )} */}

          {/* <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Movement history (MU)</h3>
            {historyLoading ? <p className="text-xs text-slate-500">Loading…</p> : locationHistory.length === 0 ? <p className="text-xs text-slate-500">No movement recorded yet. Complete this transfer with MU zone/rack to log put-away.</p> : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Action</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">From</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">To</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {locationHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-medium">{h.actionType ?? '—'}</td>
                        <td className="px-3 py-2">{h.fromZone || h.fromRack ? `${h.fromZone || ''}/${h.fromRack || ''}` : '—'}</td>
                        <td className="px-3 py-2">{h.toZone || h.toRack ? `${h.toZone || ''}/${h.toRack || ''}` : '—'}</td>
                        <td className="px-3 py-2 text-center">{h.qtyDelta != null ? h.qtyDelta : '—'}</td>
                        <td className="px-3 py-2">{formatDate(h.movedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section> */}

          {saveError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{saveError}</div>}

          {isOutboundMtr && !isClosedStatus(status) && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Warehouse initiates transfer <strong>per line</strong> (checkboxes in Warehouse). Here: mark <strong>received</strong> and <strong>stock move</strong> per line (checkboxes in the table), then <strong>MU zone / rack</strong> and <strong>Mark Succeeded</strong> for selected lines. The MRN stays open until every line is completed.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50">Close</button>
            <button onClick={() => persistUpdate({})} disabled={saving} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium text-sm hover:bg-slate-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
            {!isOutboundMtr && (status === 'Pending' || status === 'Picked' || status === 'In Transfer') && (
              <button
                onClick={() => persistUpdate({ status: 'In Transit' })}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Release from Warehouse
              </button>
            )}
            {(isOutboundMtr
              ? (initiateSelectedIds.length > 0 || hasInTransitForReceive)
              : status === 'In Transit') && (
              <button
                type="button"
                onClick={() => {
                  if (isOutboundMtr) {
                    if (initiateSelectedIds.length > 0) {
                      setLogisticsModalOpen(true);
                      return;
                    }
                    const ids = Object.entries(recvLinePick)
                      .filter(([k, v]) => v && mtrLinePhaseRaw(mrn, k) === 'in_transit')
                      .map(([k]) => k);
                    if (ids.length === 0) {
                      addToast('error', 'Select at least one line to initiate or receive.');
                      return;
                    }
                    persistUpdate({
                      status: 'Received at MU',
                      receiveAtMuLineIds: ids,
                      receivedAtMu: receivedAtMu || new Date().toISOString().slice(0, 10),
                    });
                    return;
                  }
                  const ids = Object.entries(recvLinePick)
                    .filter(([k, v]) => v && mtrLinePhaseRaw(mrn, k) === 'in_transit')
                    .map(([k]) => k);
                  if (ids.length === 0) {
                    addToast('error', 'Select at least one line that is in transit from the warehouse to mark received.');
                    return;
                  }
                  persistUpdate({
                    status: 'Received at MU',
                    receiveAtMuLineIds: ids,
                    receivedAtMu: receivedAtMu || new Date().toISOString().slice(0, 10),
                  });
                }}
                disabled={saving}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {isOutboundMtr ? (initiateSelectedIds.length > 0 ? 'Initiate transfer' : 'Verify / Received at MU') : 'Verify / Received at MU'}
              </button>
            )}
            {!isClosedStatus(status) && (
              <button
                type="button"
                onClick={() => {
                  const ids = Object.entries(completeLinePick)
                    .filter(([k, v]) => v && mtrLinePhaseRaw(mrn, k) === 'received_at_mu')
                    .map(([k]) => k);
                  if (ids.length === 0) {
                    addToast('error', 'Select at least one line that is received at MU to complete the stock move.');
                    return;
                  }
                  persistUpdate({
                    status: 'Succeeded',
                    completeTransferLineIds: ids,
                    muReceiveZone: muReceiveZone.trim() || undefined,
                    muReceiveRack: muReceiveRack.trim() || undefined,
                  });
                }}
                disabled={saving || (isOutboundMtr && !canCompleteOutboundTransfer)}
                title={
                  isOutboundMtr && !canCompleteOutboundTransfer
                    ? !hasReceivedLinesToComplete
                      ? 'No lines are at received_at_mu yet.'
                      : !muStorageFilled
                        ? muLocationSource === 'facility'
                          ? 'Select production area, zone, and rack from Facility Management.'
                          : 'Enter MU zone and MU rack before completing.'
                        : undefined
                    : undefined
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Succeeded
              </button>
            )}
          </div>
        </div>
      </div>
      {logisticsModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Initiate transfer</h3>
                <p className="text-xs text-slate-500 mt-1">Provide transfer details before moving selected lines to `In Transit`.</p>
              </div>
              <button onClick={() => setLogisticsModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close logistics popup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Tracking / LR no.</label>
                <input value={logisticsTrackingNo} onChange={(e) => setLogisticsTrackingNo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Driver / transporter</label>
                <input value={logisticsTransporter} onChange={(e) => setLogisticsTransporter(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Dispatch date</label>
                <input type="date" value={logisticsDispatchDate} onChange={(e) => setLogisticsDispatchDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">ETA (optional)</label>
                <input type="date" value={logisticsEtaDate} onChange={(e) => setLogisticsEtaDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Vehicle no.</label>
                <input value={logisticsVehicleNo} onChange={(e) => setLogisticsVehicleNo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button onClick={() => setLogisticsModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSubmitLogistics} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Save & initiate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferOrdersView(props?: { onOutboundMtrCompleted?: () => void; onMrnListChanged?: () => void }) {
  const { onOutboundMtrCompleted, onMrnListChanged } = props ?? {};
  const [mrnList, setMrnList] = useState<MRNRecordFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignablePickers, setAssignablePickers] = useState<MRNAssignablePicker[]>([]);
  const [selectedMRN, setSelectedMRN] = useState<MRNRecordFromApi | null>(null);
  const [detailMRN, setDetailMRN] = useState<MRNRecordFromApi | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMRNList({ transferType: 'outbound' }), fetchMRNAssignablePickers()])
      .then(([list, pickers]) => {
        setMrnList(list);
        setAssignablePickers(pickers);
      })
      .catch(() => setMrnList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMRN) {
      setDetailMRN(null);
      return;
    }
    setDetailMRN(null);
    fetchMRNById(selectedMRN.id)
      .then(setDetailMRN)
      .catch(() => setDetailMRN(selectedMRN));
  }, [selectedMRN?.id]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return mrnList;
    const q = searchQuery.toLowerCase();
    return mrnList.filter((m) =>
      m.mrnNo.toLowerCase().includes(q) ||
      (m.requestedBy || '').toLowerCase().includes(q) ||
      (m.bmrNo || '').toLowerCase().includes(q) ||
      (m.status || '').toLowerCase().includes(q)
    );
  }, [mrnList, searchQuery]);

  const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—');

  return (
    <div className="flex-1 overflow-auto bg-slate-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transfer orders</h1>
          <p className="text-sm text-slate-600 mt-1">MRNs sent from Production (MTR) — receive at MU, verify, generate QR labels, and complete.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search MRN, BMR, requested by…" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">MRN No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Requested by</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">BMR No.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading transfer orders…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No MRNs found. Raise an MTR from a batch (BMR/BPR) to see it here.</td></tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-amber-50/50 cursor-pointer transition-colors" onClick={() => setSelectedMRN(m)}>
                      <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-blue-600">{m.mrnNo}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-800">{m.requestedBy}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${String(m.status).toLowerCase() === 'succeeded' || m.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          m.status === 'Received at MU' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            m.status === 'In Transit' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              m.status === 'In Transfer' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                                m.status === 'Picked' ? 'bg-violet-100 text-violet-800 border-violet-200' :
                                  'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{m.bmrNo ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-700">{(m.lineItems?.length ?? 0)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(m.createdAt as string)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedMRN && (detailMRN ?? selectedMRN) && (
          <MRNDetailModal
            mrn={detailMRN ?? selectedMRN}
            assignablePickers={assignablePickers}
            onClose={() => { setSelectedMRN(null); setDetailMRN(null); }}
            onSave={(updated) => {
              setMrnList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
              setSelectedMRN(updated);
              setDetailMRN(updated);
              onMrnListChanged?.();
              {
                const st = String(updated.status || '').trim().toLowerCase();
                if ((st === 'succeeded' || st === 'completed') && updated.source === 'MTR' && !updated.isInboundFromMu) {
                  onOutboundMtrCompleted?.();
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ──────────── BATCH DETAIL MODAL — 6 tabs ──────────────────── */

function BatchDetailModal({ batch, team, stockRM, stockPM, reservedRM, reservedPM, outboundMrns, onClose, onSave, onAction, initialTab = 'bmr' }: {
  batch: Batch; team: TeamMember[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  reservedRM: Record<string, number>; reservedPM: Record<string, number>;
  outboundMrns: MRNRecordFromApi[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onAction: (action: string, batch: Batch, extra?: { mtrRmItems?: DispensingItem[]; mtrPmItems?: DispensingItem[] }) => void;
  initialTab?: 'bmr' | 'bpr';
}) {
  const [tab, setTab] = useState('overview');
  const [type, setType] = useState<'bmr' | 'bpr'>(initialTab);
  const pipeline = type === 'bmr' ? BMR_PIPELINE : BPR_PIPELINE;

  const [bomRmItems, setBomRmItems] = useState<DispensingItem[]>([]);
  const [bomPmItems, setBomPmItems] = useState<DispensingItem[]>([]);
  const [bomLoading, setBomLoading] = useState(false);

  const openRmMtrForBatch = useMemo(() => findOpenRmMtrForBatch(batch.bmrNo, outboundMrns), [batch.bmrNo, outboundMrns]);
  const anyRmMtrForBatch = useMemo(() => findAnyRmMtrForBatch(batch.bmrNo, outboundMrns), [batch.bmrNo, outboundMrns]);
  const openPmMtrForBatch = useMemo(() => findOpenPmMtrForBatch(batch.bmrNo, outboundMrns), [batch.bmrNo, outboundMrns]);
  const anyPmMtrForBatch = useMemo(() => findAnyPmMtrForBatch(batch.bmrNo, outboundMrns), [batch.bmrNo, outboundMrns]);
  const effectiveRmConnectedUi = useMemo(() => effectiveRmConnected(batch, outboundMrns), [batch.bmrNo, batch.rmConnected, outboundMrns]);
  const effectivePmConnectedUi = useMemo(() => effectivePmConnected(batch, outboundMrns), [batch.bmrNo, batch.pmConnected, outboundMrns]);
  const openRmMtrWarehouseMeta = useMemo(() => outboundMtrWarehouseMeta(openRmMtrForBatch), [openRmMtrForBatch]);
  const openPmMtrWarehouseMeta = useMemo(() => outboundMtrWarehouseMeta(openPmMtrForBatch), [openPmMtrForBatch]);

  const bmrDisplayForStripAndBadge = useMemo(() => {
    const pastRmConnectUi = ['dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
    if (pastRmConnectUi.includes(batch.bmrStatus)) return batch.bmrStatus;
    if (effectiveRmConnected(batch, outboundMrns) && (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled')) return 'rm_connected';
    return batch.bmrStatus;
  }, [batch.bmrNo, batch.bmrStatus, batch.rmConnected, outboundMrns]);
  const bprDisplayForStripAndBadge = useMemo(() => {
    if (batch.bprStatus === 'qc_failed') return batch.fillBatchAccepted === false ? 'fill_qc' : 'pack_qc';
    if (effectivePmConnected(batch, outboundMrns) && batch.bprStatus === 'pm_reserved') return 'pm_dispensing';
    return batch.bprStatus;
  }, [batch.bmrNo, batch.bprStatus, batch.pmConnected, outboundMrns]);
  const curStatus = type === 'bmr' ? bmrDisplayForStripAndBadge : bprDisplayForStripAndBadge;
  const pIdx = pipelineIndex(curStatus, pipeline);

  useEffect(() => {
    if (!batch.sku && !batch.productName) return;
    const batchPk = (batch as Batch & { _pk?: number })._pk;
    setBomLoading(true);
    const loadFromBatchBom = batchPk
      ? fetchBOMByBatchId(batchPk)
      : Promise.resolve({ success: false, data: undefined });
    loadFromBatchBom
      .then((batchBomRes) => {
        // Use batch-specific BOM from planning_batches when API says so (same table as Planning BOM editor).
        // Do not fall back to master BOM when source is planning_batch — that is the BOM for this batch.
        const useBatchBom = batchBomRes.success && batchBomRes.data && (
          batchBomRes.data.source === 'planning_batch' ||
          (batchBomRes.data.rmLines?.length || batchBomRes.data.pmLines?.length)
        );
        if (useBatchBom && batchBomRes.data) {
          const rmLines = (batchBomRes.data.rmLines ?? []) as BOMRmLine[];
          const pmLines = (batchBomRes.data.pmLines ?? []) as BOMPmLine[];
          const batchSizeKg = (batchBomRes.data.batchSizeKg != null && batchBomRes.data.batchSizeKg > 0)
            ? batchBomRes.data.batchSizeKg
            : (batch.batchSize || 0);
          const batchUnits = (batchBomRes.data.batchSizeKg != null && batchBomRes.data.batchSizeKg > 0)
            ? Math.round(batchBomRes.data.batchSizeKg)
            : (batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : batch.batchSize || 0);
          const rmItems: DispensingItem[] = rmLines
            .filter((line) => line.rm_code || (line as any).code)
            .map((line) => {
              const code = (line.rm_code || (line as any).code) as string;
              const pct = Number((line.pct_w_w ?? (line as any).pct ?? 0)) || 0;
              const required = (batchSizeKg * pct) / 100;
              return { code, inci: (line.inci_name ?? (line as any).inci_name) as string, required, dispensed: 0, done: false };
            })
            .filter((x) => x.required > 0);
          const pmItems: DispensingItem[] = pmLines
            .filter((line) => line.pm_code || (line as any).code)
            .map((line) => {
              const code = (line.pm_code || (line as any).code) as string;
              const qtyPerUnit = Number((line.qty_per_unit ?? (line as any).qty ?? 1)) || 1;
              const required = qtyPerUnit * batchUnits;
              return { code, name: (line.description ?? code) as string, required, dispensed: 0, done: false };
            })
            .filter((x) => x.required > 0);
          setBomRmItems(rmItems);
          setBomPmItems(pmItems);
          return;
        }
        return fetchPRProducts().then((res) => {
          if (!res.success || !res.data?.length) return null;
          const product = res.data.find((p) => p.product_sku === batch.sku || p.product_name === batch.productName);
          return product ? fetchBOMByProductId(product.product_id) : null;
        });
      })
      .then((bomRes) => {
        if (!bomRes) return;
        if (!(bomRes as any).success && !(bomRes as any).data) return;
        const bom = (bomRes as { data: BOMRecord }).data;
        if (!bom) return;
        const batchSizeKg = batch.batchSize || 0;
        const rmLines = (bom.rmLines ?? []) as BOMRmLine[];
        const rmItems: DispensingItem[] = rmLines
          .filter((line) => line.rm_code || (line as any).code)
          .map((line) => {
            const code = (line.rm_code || (line as any).code) as string;
            const pct = Number((line.pct_w_w ?? (line as any).pct ?? 0)) || 0;
            const required = (batchSizeKg * pct) / 100;
            return { code, inci: (line.inci_name ?? (line as any).inci_name) as string, required, dispensed: 0, done: false };
          })
          .filter((x) => x.required > 0);
        const pmLines = (bom.pmLines ?? []) as BOMPmLine[];
        const batchUnits = batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : batch.batchSize || 0;
        const pmItems: DispensingItem[] = pmLines
          .filter((line) => line.pm_code || (line as any).code)
          .map((line) => {
            const code = (line.pm_code || (line as any).code) as string;
            const qtyPerUnit = Number((line.qty_per_unit ?? (line as any).qty ?? 1)) || 1;
            const required = qtyPerUnit * batchUnits;
            return { code, name: (line.description ?? code) as string, required, dispensed: 0, done: false };
          })
          .filter((x) => x.required > 0);
        setBomRmItems(rmItems);
        setBomPmItems(pmItems);
      })
      .catch(() => { setBomRmItems([]); setBomPmItems([]); })
      .finally(() => setBomLoading(false));
  }, [batch.sku, batch.productName, batch.batchSize, batch.orderQty, batch.totalBatches, (batch as Batch & { _pk?: number })._pk]);

  const pipelineForStrip = type === 'bmr' ? BMR_PIPELINE : BPR_PIPELINE;
  const stripTitle = type === 'bmr' ? 'BMR Progress' : 'BPR Progress';
  const qcDetailSections = useMemo(() => collectQcSpecsRowsForDisplay(batch), [batch.qcSpecs]);

  const overviewCards: [string, string][] = [
    ['BMR No', batch.bmrNo], ['BPR No', batch.bprNo], ['Product', batch.productName ?? ''],
    ['SKU', batch.sku ?? ''], ['Sale Order', batch.soNo], ['Order Qty', batch.orderQty != null ? `${fmt(batch.orderQty)} units` : '-'],
    ['Batch No', `B-${String(batch.batchIndex).padStart(2, '0')} of ${batch.totalBatches}`], ['Batch Size', `${batch.batchSize} KG`],
    ['Process', (batch.processType ?? 'hot').toUpperCase()], ['Homogenizer', batch.homogenizer ? 'Yes' : 'No'],
    ['Main Vessel', batch.mainVessel || '-'], ['Support Tanks', (batch.supportingTanks ?? []).length ? (batch.supportingTanks ?? []).join(', ') : 'None'],
    ['Filling Line', batch.fillingLine || '-'], ['Filling Type', (batch.fillingType ?? 'bottle').toUpperCase()],
    ['Pack Line', batch.packagingLine || '-'], ['Monocarton', batch.monocarton ? 'Yes' : 'No'],
    ['Shrink', batch.shrink ? 'Yes' : 'No'], ['Due Date', batch.dueDate || '-'],
    ['MU bundle (latest)', batch.muDispensingBundleId || '-'],
    ['Team (Mfg)', (team.filter(t => (batch.teamBMR ?? []).includes(t.id)).map(t => t.name).join(', ')) || '-'],
    ['Team (Fill)', (team.filter(t => (batch.teamBPR ?? []).includes(t.id)).map(t => t.name).join(', ')) || '-'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-[2px] p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4 border border-gray-100 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* modal-hdr */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 tracking-tight" id="bdm-title">{batch.bmrNo}</div>
              <div className="text-[10.5px] text-gray-500 mt-0.5" id="bdm-sub">
                {batch.productName ?? '-'} · Batch {batch.batchIndex}/{batch.totalBatches} · {batch.batchSize} KG · SO: {batch.soNo}
              </div>
            </div>
            <div id="bdm-status-badges" className="flex gap-1.5 flex-wrap shrink-0 items-center">
              <button type="button" onClick={() => setType('bmr')} className={`text-[10px] px-2 py-0.5 rounded font-semibold border transition-colors ${type === 'bmr' ? 'bg-orange-500 text-white border-orange-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>BMR</button>
              <button type="button" onClick={() => setType('bpr')} className={`text-[10px] px-2 py-0.5 rounded font-semibold border transition-colors ${type === 'bpr' ? 'bg-purple-500 text-white border-purple-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>BPR</button>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">{bmrStatusLabel[bmrDisplayForStripAndBadge]}</span>
              {batch.bmrStatus === 'batch_confirmed' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Confirmed</span>}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">{bprStatusLabel[bprDisplayForStripAndBadge]}</span>
            </div>
          </div>
          <div className="flex gap-1.5 items-center shrink-0">
            <button type="button" onClick={() => { /* print */ }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Print</button>
            <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">×</button>
          </div>
        </div>

        {/* modal-body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Pipeline strip */}
          <PipelineStripWithLabels pipeline={pipelineForStrip} currentStatus={curStatus} failed={type === 'bmr' ? batch.bmrStatus === 'qc_failed' : batch.bprStatus === 'qc_failed'} title={stripTitle} />

          {/* Navigation + Tabs */}
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono mb-1">Navigation</div>
          <div className="flex flex-wrap gap-1 mb-4">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'rmpm', label: 'RM & PM Availability' },
              { key: 'schedule', label: 'Schedule' },
              { key: 'dispensing', label: 'Dispensing' },
              { key: 'qc', label: 'QC' },
              { key: 'stepper', label: 'Stage Tracker' },
            ].map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${tab === t.key ? 'bg-orange-500 text-white border-orange-500' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div id="bdm-content">
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {overviewCards.map(([k, v]) => (
                    <div key={k} className="bg-black/5 border border-gray-200 rounded-md px-3 py-2.5">
                      <div className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{k}</div>
                      <div className="text-xs font-semibold text-gray-800 wrap-break-word">{v || '-'}</div>
                    </div>
                  ))}
                </div>
                {batch.remarks && (
                  <div className="mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs"><div>{batch.remarks}</div></div>
                )}
              </>
            )}

            {tab === 'rmpm' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SectionLabel icon={<FlaskConical size={12} />} color="text-teal-600">Raw Materials (PR BOM)</SectionLabel>
                    {batch.rmReserved && <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> Reserved</Badge>}
                    {type === 'bmr' && (batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !batch.rmReserved && (
                      <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reserveRM', batch); }}>Reserve RM</Btn>
                    )}
                  </div>
                  {bomLoading ? (
                    <div className="rounded-xl border border-gray-100 px-3 py-4 text-xs text-gray-500">Loading BOM…</div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 text-xs overflow-hidden">
                      <table className="w-full">
                        <thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">RM</th><th className="px-2 py-1.5 text-center">Req</th><th className="px-2 py-1.5 text-center">SIH</th><th className="px-2 py-1.5 text-center">Reserved</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {(batch.dispensingRM.length > 0 ? batch.dispensingRM : bomRmItems).map((r, i) => {
                            const sih = stockRM[r.code] ?? 0; const res = reservedRM[r.code] ?? 0; const ok = sih >= r.required;
                            return <tr key={i}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 text-center font-mono">{fmt(r.required)}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5 text-center font-mono text-amber-700">{fmt(res)}</td></tr>;
                          })}
                        </tbody>
                      </table>
                      {(batch.dispensingRM.length === 0 && bomRmItems.length === 0 && !bomLoading) && <div className="px-3 py-4 text-gray-500 text-center">No RM in BOM or product not found.</div>}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SectionLabel icon={<Package size={12} />} color="text-purple-600">Packaging Materials (PR BOM)</SectionLabel>
                    {batch.pmReserved && <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> Reserved</Badge>}
                    {type === 'bpr' && (batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !batch.pmReserved && (
                      <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reservePM', batch); }}>Reserve PM</Btn>
                    )}
                  </div>
                  {bomLoading ? (
                    <div className="rounded-xl border border-gray-100 px-3 py-4 text-xs text-gray-500">Loading BOM…</div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 text-xs overflow-hidden">
                      <table className="w-full">
                        <thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">PM</th><th className="px-2 py-1.5 text-center">Req</th><th className="px-2 py-1.5 text-center">SIH</th><th className="px-2 py-1.5 text-center">Reserved</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {(batch.dispensingPM.length > 0 ? batch.dispensingPM : bomPmItems).map((p, i) => {
                            const sih = stockPM[p.code] ?? 0; const res = reservedPM[p.code] ?? 0; const ok = sih >= p.required;
                            return <tr key={i}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 text-center font-mono">{fmt(p.required)}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5 text-center font-mono text-amber-700">{fmt(res)}</td></tr>;
                          })}
                        </tbody>
                      </table>
                      {(batch.dispensingPM.length === 0 && bomPmItems.length === 0 && !bomLoading) && <div className="px-3 py-4 text-gray-500 text-center">No PM in BOM or product not found.</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'schedule' && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {([['Mfg Date', batch.mfgDate], ['Fill Date', batch.fillDate], ['Pack Date', batch.packDate],
                  ['FG Date', batch.fgDate], ['RM Connect', batch.rmConnectDate], ['PM Connect', batch.pmConnectDate],
                  ['Main Vessel', batch.mainVessel], ['Filling Line', batch.fillingLine], ['Packaging Line', batch.packagingLine],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k}><div className="text-[10px] text-gray-400 font-medium">{k}</div><div className="text-sm font-semibold text-gray-800">{v || '-'}</div></div>
                  ))}
                </div>
                {canRescheduleProductionDates(batch) && (
                  <button type="button" onClick={() => { onClose(); onAction('schedule', batch); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                    <Calendar size={12} /> {batch.mfgDate || batch.fillDate || batch.packDate ? 'Reschedule dates' : 'Set / adjust schedule'}
                  </button>
                )}
              </div>
            )}

            {tab === 'dispensing' && (
              <div className="space-y-5">
                {(batch.muDispensingBundleId || (batch.muDispensingBundles && batch.muDispensingBundles.length > 0)) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                    <div className="font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                      <Package size={14} className="text-slate-500" /> MU consumption bundles (RM + PM qty from ML1/ML2/WH)
                    </div>
                    {batch.muDispensingBundleId && (
                      <p className="text-slate-600 mb-2">
                        <span className="text-slate-500">Latest bundle:</span>{' '}
                        <span className="font-mono font-semibold text-indigo-800">{batch.muDispensingBundleId}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 mb-2">Each bundle groups all RM/PM lines consumed in one dispensing save. Procurement requests (PR) for the same planning extract are listed for traceability.</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {([...(batch.muDispensingBundles || [])]).reverse().map((b) => (
                        <div key={b.bundleId + b.at} className="rounded-lg border border-white/80 bg-white/90 p-2.5">
                          <div className="font-mono text-[11px] font-bold text-indigo-800">{b.bundleId}</div>
                          <div className="text-[10px] text-slate-500">{new Date(b.at).toLocaleString()}</div>
                          {b.procurementRequests?.length > 0 && (
                            <div className="mt-1.5 text-[10px]">
                              <span className="text-slate-500 font-semibold">PRs:</span>{' '}
                              {b.procurementRequests.map((pr) => (
                                <span key={pr.id} className="inline-block mr-2">#{pr.id}{pr.status ? ` (${pr.status})` : ''}</span>
                              ))}
                            </div>
                          )}
                          {b.rm?.length > 0 && (
                            <div className="mt-1 text-[10px] text-teal-800"><span className="font-semibold">RM:</span> {b.rm.map((l) => `${l.code} ${l.qty}`).join(' · ')}</div>
                          )}
                          {b.pm?.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-purple-800"><span className="font-semibold">PM:</span> {b.pm.map((l) => `${l.code} ${l.qty}`).join(' · ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <SectionLabel icon={<FlaskConical size={12} />} color="text-teal-600">RM Dispensing ({batch.dispensingRM.filter(r => r.done).length}/{batch.dispensingRM.length})</SectionLabel>
                  {batch.dispensingRM.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-1 ${r.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100'}`}>
                      <div className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold ${r.done ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{r.done ? <Check size={10} strokeWidth={3} /> : i + 1}</div>
                      <span className="text-xs font-semibold flex-1">{r.inci || r.code}</span>
                      <span className="text-xs font-mono text-gray-500">{r.required} KG</span>
                      {r.done && <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-0.5"><ArrowRight size={10} /> {r.dispensed} KG</span>}
                    </div>
                  ))}
                </div>
                <div>
                  <SectionLabel icon={<Package size={12} />} color="text-purple-600">PM Dispensing ({batch.dispensingPM.filter(r => r.done).length}/{batch.dispensingPM.length})</SectionLabel>
                  {batch.dispensingPM.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-1 ${p.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100'}`}>
                      <div className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold ${p.done ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{p.done ? <Check size={10} strokeWidth={3} /> : i + 1}</div>
                      <span className="text-xs font-semibold flex-1">{p.name || p.code}</span>
                      <span className="text-xs font-mono text-gray-500">{fmt(p.required)} pcs</span>
                      {p.done && <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-0.5"><ArrowRight size={10} /> {fmt(p.dispensed)} pcs</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'qc' && (
              <div>
                {qcDetailSections.length > 0 ? (
                  <div className="space-y-4">
                    {qcDetailSections.map((section) => (
                      <div key={section.label} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-100/80 border-b border-gray-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">{section.label}</div>
                        <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          <div>Parameter</div><div>Specification</div><div>Result</div><div>Pass/Fail</div>
                        </div>
                        {section.rows.map((s, i) => (
                          <div key={`${section.label}-${i}`} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 border-b border-gray-50 items-center text-xs">
                            <div className="font-semibold">{s.param}</div>
                            <div className="text-gray-500 font-mono">{s.spec}</div>
                            <div className="font-mono">{s.result || '-'}</div>
                            <div>{s.passed === true ? <Badge className="bg-emerald-100 text-emerald-700">Pass</Badge> : s.passed === false ? <Badge className="bg-red-100 text-red-600">Fail</Badge> : <span className="text-gray-400">-</span>}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">No QC results yet. Submit batch for QC review.</div>
                )}
                {batch.bulkYield != null && <div className="mt-3 text-xs"><span className="text-gray-500">Bulk Yield:</span> <b>{batch.bulkYield} KG</b> {batch.bulkBatchAccepted ? <Badge className="bg-emerald-100 text-emerald-700">Accepted</Badge> : ''}</div>}
                {batch.fillYield != null && <div className="mt-1 text-xs"><span className="text-gray-500">Fill Yield:</span> <b>{fmt(batch.fillYield)} units</b></div>}
                {batch.fgYield != null && <div className="mt-1 text-xs"><span className="text-gray-500">FG Yield:</span> <b>{fmt(batch.fgYield)} units</b></div>}
              </div>
            )}

            {tab === 'stepper' && (
              <div className="space-y-0.5">
                {pipeline.map((p, i) => {
                  const state = i < pIdx ? 'done' : i === pIdx ? 'active' : 'pending';
                  return (
                    <div key={p.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 ${state === 'done' ? 'bg-emerald-100 border-emerald-400 text-emerald-600' :
                          state === 'active' ? 'bg-orange-100 border-orange-400 text-orange-600 ring-2 ring-orange-100' :
                            'bg-gray-50 border-gray-200 text-gray-300'
                          }`}>{state === 'done' ? <Check size={12} strokeWidth={3} /> : p.icon}</div>
                        {i < pipeline.length - 1 && <div className={`w-0.5 h-6 ${i < pIdx ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                      </div>
                      <div className="pb-4">
                        <div className={`text-xs font-bold ${state === 'done' ? 'text-emerald-600' : state === 'active' ? 'text-orange-600' : 'text-gray-400'}`}>{p.label}</div>
                        <div className="text-[10px] text-gray-400">
                          {state === 'pending' ? 'Awaiting previous step' : state === 'active' ? 'Currently at this stage' : 'Completed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* modal-foot */}
        <div id="bdm-actions" className="flex flex-wrap gap-2 items-center px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Close</button>
          {batch.bmrStatus === 'draft' && <Btn color="orange" icon={<Zap size={12} />} onClick={() => { onClose(); onAction('confirm', batch); }}>Confirm Batch</Btn>}
          {type === 'bmr' && (batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !batch.rmReserved && <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reserveRM', batch); }}>Reserve RM</Btn>}
          {type === 'bpr' && (batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !batch.pmReserved && <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reservePM', batch); }}>Reserve PM</Btn>}
          {canAdjustBatchSize(batch) && (
            <Btn color="orange" icon={<Settings size={12} />} onClick={() => { onClose(); onAction('adjustBatch', batch); }}>Adjust batch size</Btn>
          )}
          {(batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && batch.rmReserved && batch.pmReserved && !batch.mfgDate && !batch.fillDate && !batch.packDate && (
            <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>Set Schedule</Btn>
          )}
          {canShowRescheduleFooterButton(batch) && (
            <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>Reschedule dates</Btn>
          )}
          {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && !effectiveRmConnectedUi && !anyRmMtrForBatch && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrRM', batch, batch.dispensingRM.length > 0 ? undefined : { mtrRmItems: bomRmItems }); }}>RM Transfer</Btn>}
          {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && !effectiveRmConnectedUi && openRmMtrForBatch && (
            <span className="inline-flex flex-col gap-1 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg max-w-xl" title={outboundMtrStageHint(openRmMtrForBatch)}>
              <span className="inline-flex items-center gap-1.5">
                <Info size={14} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openRmMtrForBatch)}</span>
              </span>
              {openRmMtrWarehouseMeta && (
                <span className="text-[10px] font-semibold text-amber-950/90 leading-snug pl-5 border-l-2 border-amber-300/60 ml-1">
                  {openRmMtrWarehouseMeta}
                </span>
              )}
              {openRmMtrForBatch.lineTransferStatus && openRmMtrForBatch.lineItems && (
                <span className="text-[10px] font-normal text-amber-900/90 leading-snug">
                  {openRmMtrForBatch.lineItems.filter(mtrLineItemIsRm).map((li) => (
                    <span key={li.id} className="mr-2 inline-block">
                      <span className="font-mono">{li.itemCode}</span>: {formatMtrLinePhaseShort(mtrLinePhaseRaw(openRmMtrForBatch, li.id))}
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
          {effectiveRmConnectedUi && (batch.bmrStatus === 'rm_connected' || batch.bmrStatus === 'dispensing' || batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && (!openRmMtrForBatch || mtrAllRmLinesReceivedAtMu(openRmMtrForBatch)) && (
            <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispenseRM', batch); }}>Start RM Dispensing</Btn>
          )}
          {effectiveRmConnectedUi && (batch.bmrStatus === 'rm_connected' || batch.bmrStatus === 'dispensing' || batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && openRmMtrForBatch && !mtrAllRmLinesReceivedAtMu(openRmMtrForBatch) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg" title="Verify every RM line at MU in Transfer orders before dispensing.">
              <Info size={14} /> Receive all RM lines at MU first
            </span>
          )}
          {/* {canOfferRmDispensingUi(batch) && <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispenseRM', batch); }}>Start RM Dispensing</Btn>} */}
          {(batch.bmrStatus === 'in_production' || batch.bmrStatus === 'qc_failed') && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcBMR', batch); }}>Submit to Bulk QC</Btn>}
          {batch.bprStatus === 'pm_reserved' && !effectivePmConnectedUi && !anyPmMtrForBatch && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrPM', batch, batch.dispensingPM.length > 0 ? undefined : { mtrPmItems: bomPmItems }); }}>PM Transfer</Btn>}
          {batch.bprStatus === 'pm_reserved' && !effectivePmConnectedUi && openPmMtrForBatch && (
            <span className="inline-flex flex-col gap-1 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg max-w-xl" title={outboundMtrStageHint(openPmMtrForBatch)}>
              <span className="inline-flex items-center gap-1.5">
                <Info size={14} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openPmMtrForBatch)}</span>
              </span>
              {openPmMtrWarehouseMeta && (
                <span className="text-[10px] font-semibold text-amber-950/90 leading-snug pl-5 border-l-2 border-amber-300/60 ml-1">
                  {openPmMtrWarehouseMeta}
                </span>
              )}
              {openPmMtrForBatch.lineTransferStatus && openPmMtrForBatch.lineItems && (
                <span className="text-[10px] font-normal text-amber-900/90 leading-snug">
                  {openPmMtrForBatch.lineItems.filter(mtrLineItemIsPm).map((li) => (
                    <span key={li.id} className="mr-2 inline-block">
                      <span className="font-mono">{li.itemCode}</span>: {formatMtrLinePhaseShort(mtrLinePhaseRaw(openPmMtrForBatch, li.id))}
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
          {effectivePmConnectedUi && (batch.bprStatus === 'pm_connected' || batch.bprStatus === 'pm_reserved' || batch.bprStatus === 'pm_dispensing') && (!openPmMtrForBatch || mtrAllPmLinesReceivedAtMu(openPmMtrForBatch)) && (
            <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispensePM', batch); }}>PM Dispensing</Btn>
          )}
          {effectivePmConnectedUi && (batch.bprStatus === 'pm_connected' || batch.bprStatus === 'pm_reserved' || batch.bprStatus === 'pm_dispensing') && openPmMtrForBatch && !mtrAllPmLinesReceivedAtMu(openPmMtrForBatch) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg" title="Verify every PM line at MU in Transfer orders before PM dispensing.">
              <Info size={14} /> Receive all PM lines at MU first
            </span>
          )}
          {batch.bprStatus === 'filling' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcFill', batch); }}>Fill QC</Btn>}
          {batch.bprStatus === 'packaging' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcPack', batch); }}>Pack QC</Btn>}
          {batch.bprStatus === 'qc_failed' && batch.fillBatchAccepted === false && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcFill', batch); }}>Retry Fill QC</Btn>}
          {batch.bprStatus === 'qc_failed' && batch.fgBatchAccepted === false && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcPack', batch); }}>Retry Pack QC</Btn>}
          <button type="button" onClick={() => { /* print */ }} className="inline-flex items-center gap-1 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 ml-auto transition-colors"><Printer size={12} /> Print BMR/BPR</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Action Button helper ──────────────────────────────────── */

function Btn({ color, icon, onClick, children }: { color: string; icon?: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  const cm: Record<string, string> = {
    orange: 'bg-orange-500 hover:bg-orange-600', amber: 'bg-amber-500 hover:bg-amber-600',
    teal: 'bg-teal-500 hover:bg-teal-600', purple: 'bg-purple-500 hover:bg-purple-600',
    blue: 'bg-blue-500 hover:bg-blue-600', red: 'bg-red-500 hover:bg-red-600',
    emerald: 'bg-emerald-500 hover:bg-emerald-600',
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs text-white rounded-lg font-semibold transition-colors ${cm[color] || cm.orange}`}>
      {icon}{children}
    </button>
  );
}

/* ──────────── CREATE NEW BATCH (REWORK) MODAL ───────────────── */

function CreateNewBatchModal({
  batches,
  preset,
  onClose,
  onSuccess,
  createRworkBatch,
  addToast,
}: {
  batches: Batch[];
  /** When set (e.g. from Yield Report), SO and base BMR are fixed and selects are hidden. */
  preset?: { soNo: string; bmrNo: string } | null;
  onClose: () => void;
  onSuccess: (created?: BatchRow) => void;
  createRworkBatch: (baseBatchId: number, reasonOrOptions?: string | CreateReworkOptions) => Promise<BatchRow>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  type BatchWithPk = Batch & { _pk?: number; planningBatchId?: number | null };
  const soList = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => { if (b.soNo) set.add(b.soNo); });
    return Array.from(set).sort();
  }, [batches]);
  const [selectedSoNo, setSelectedSoNo] = useState('');
  const [selectedBmrNo, setSelectedBmrNo] = useState('');
  const [reason, setReason] = useState('');
  const [reworkQty, setReworkQty] = useState('');
  const [reworkBatchSizeKg, setReworkBatchSizeKg] = useState('');
  const [reworkItemsPreview, setReworkItemsPreview] = useState<ItemsInvolvedForPiRow[]>([]);
  const [reworkItemsLoading, setReworkItemsLoading] = useState(false);
  const [reworkItemsError, setReworkItemsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const batchesForSo = useMemo(
    () => (selectedSoNo ? batches.filter(b => b.soNo === selectedSoNo) : []) as BatchWithPk[],
    [batches, selectedSoNo],
  );
  const selected = batchesForSo.find(b => b.bmrNo === selectedBmrNo);
  const plannedUnits = selected
    ? (selected.totalBatches > 0
      ? Math.ceil((Number(selected.orderQty) || 0) / selected.totalBatches)
      : (Number(selected.orderQty) || 0))
    : 0;
  const actualUnits = selected ? (Number(selected.fgYield) || Number(selected.fillYield) || 0) : 0;
  const shortfallUnits = Math.max(0, Math.round(plannedUnits - actualUnits));
  const parsedReworkQty = Math.round(Number(reworkQty));
  const canReworkSelected =
    selected?._pk != null
    && selected.planningBatchId != null
    && reason.trim().length > 0
    && Number.isFinite(parsedReworkQty)
    && parsedReworkQty > 0;
  const previewShortageRows = useMemo(
    () => reworkItemsPreview
      .filter((it) => Number(it.totalRequired || 0) > 0)
      .map((it) => {
        const req = Number(it.totalRequired) || 0;
        const free = Number(it.sih || 0) + Number(it.inTransit || 0);
        const shortage = Math.max(0, req - free);
        return { ...it, req, free, shortage };
      })
      .filter((it) => it.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage)
      .slice(0, 8),
    [reworkItemsPreview],
  );

  const onSoChange = (so: string) => {
    setSelectedSoNo(so);
    setSelectedBmrNo('');
    setReworkQty('');
    setReworkBatchSizeKg('');
    setReworkItemsPreview([]);
    setReworkItemsError(null);
  };

  const presetLocked = Boolean(preset?.soNo && preset?.bmrNo);
  useEffect(() => {
    if (!preset?.soNo || !preset?.bmrNo) return;
    setSelectedSoNo(preset.soNo);
    setSelectedBmrNo(preset.bmrNo);
    setReason('');
  }, [preset?.soNo, preset?.bmrNo]);

  useEffect(() => {
    if (!selected) {
      setReworkQty('');
      setReworkBatchSizeKg('');
      setReworkItemsPreview([]);
      setReworkItemsError(null);
      return;
    }
    setReworkQty(shortfallUnits > 0 ? String(shortfallUnits) : '');
    setReworkBatchSizeKg('');
  }, [selectedBmrNo, selectedSoNo, shortfallUnits, selected]);

  useEffect(() => {
    let cancelled = false;
    const loadReworkItemsPreview = async () => {
      if (!selected?.planningBatchId) {
        setReworkItemsPreview([]);
        setReworkItemsError(null);
        return;
      }
      setReworkItemsLoading(true);
      setReworkItemsError(null);
      try {
        const allBatches = await fetchAllBatches();
        const planningBatch = allBatches.find((b) => Number(b.id) === Number(selected.planningBatchId));
        const planningExtractedId = planningBatch?.planningExtractedId;
        if (!planningExtractedId) {
          if (!cancelled) {
            setReworkItemsPreview([]);
            setReworkItemsError('Planning mapping not found for selected batch.');
          }
          return;
        }
        const items = await fetchItemsInvolvedByPlanningId(String(planningExtractedId));
        if (!cancelled) setReworkItemsPreview(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) {
          setReworkItemsPreview([]);
          setReworkItemsError('Failed to load RM/PM shortfall preview.');
        }
      } finally {
        if (!cancelled) setReworkItemsLoading(false);
      }
    };
    loadReworkItemsPreview();
    return () => { cancelled = true; };
  }, [selected?.planningBatchId]);

  const handleCreate = async () => {
    if (!selected?._pk) {
      addToast('error', 'Select a batch to rework from');
      return;
    }
    if (!selected.planningBatchId) {
      addToast('error', 'Selected batch is not linked to planning. Use a batch that was sent from Planning.');
      return;
    }
    if (!Number.isFinite(parsedReworkQty) || parsedReworkQty <= 0) {
      addToast('error', 'Enter a valid rework quantity (units).');
      return;
    }
    const manualBatchSize = reworkBatchSizeKg.trim() ? Number(reworkBatchSizeKg) : null;
    if (manualBatchSize != null && (!Number.isFinite(manualBatchSize) || manualBatchSize <= 0)) {
      addToast('error', 'Batch size must be a valid number greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      const baseOrderQty = Number(selected.orderQty) || 0;
      const baseBatchSize = Number(selected.batchSize) || 0;
      const suggestedBatchSize =
        manualBatchSize != null
          ? manualBatchSize
          : (baseOrderQty > 0 && baseBatchSize > 0
            ? Math.round((baseBatchSize * parsedReworkQty * 100) / baseOrderQty) / 100
            : null);
      const created = await createRworkBatch(selected._pk, {
        reason: reason.trim(),
        targetOrderQty: parsedReworkQty,
        ...(suggestedBatchSize != null ? { targetBatchSizeKg: suggestedBatchSize } : {}),
      });
      addToast('success', `Rework batch created (e.g. ${selected.bmrNo}-rw-01). Refreshing list.`);
      onSuccess(created);
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to create rework batch';
      addToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Create New Batch (Rework)</h2>
            {presetLocked && (
              <p className="text-[11px] font-medium text-emerald-700 mt-0.5">Pre-filled from Yield Report — confirm reason and quantities below.</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            When a batch fails, create a new batch for the same SO to continue production. The new batch will be in the planning table and named with suffix <strong>rw-01</strong>, <strong>rw-02</strong>, etc.
          </p>
          {presetLocked ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wide">Base batch (from yield)</p>
              <div className="text-sm text-gray-900"><span className="text-gray-500 text-xs mr-1">SO</span><strong>{preset!.soNo}</strong></div>
              <div className="text-sm text-gray-900"><span className="text-gray-500 text-xs mr-1">BMR</span><strong>{preset!.bmrNo}</strong></div>
              <p className="text-[10px] text-gray-600">To pick a different SO or batch, close this dialog and use <strong>Create New Batch</strong> from the BMR tab.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sales order</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedSoNo}
                  onChange={e => onSoChange(e.target.value)}
                >
                  <option value="">— Select SO —</option>
                  {soList.map(so => (
                    <option key={so} value={so}>{so}</option>
                  ))}
                </select>
                {soList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No batches in production. Sync or send batches from Planning first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rework from batch</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedBmrNo}
                  onChange={e => setSelectedBmrNo(e.target.value)}
                  disabled={!selectedSoNo}
                >
                  <option value="">— Select batch —</option>
                  {batchesForSo.map(b => (
                    <option key={b.bmrNo} value={b.bmrNo}>
                      {b.bmrNo} — {b.productName ?? b.sku}
                      {b.planningBatchId ? '' : ' (not linked to planning)'}
                    </option>
                  ))}
                </select>
                {selectedSoNo && batchesForSo.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No batches for this SO.</p>
                )}
                {selected && selected._pk != null && selected.planningBatchId != null && !reason.trim() && (
                  <p className="text-xs text-amber-600 mt-1">Enter a reason for the rework.</p>
                )}
                {selected && !selected.planningBatchId && (
                  <p className="text-xs text-amber-600 mt-1">This batch is not linked to planning. Send it from Planning first, or choose another batch.</p>
                )}
              </div>
            </>
          )}
          {presetLocked && selected && selected._pk != null && selected.planningBatchId != null && !reason.trim() && (
            <p className="text-xs text-amber-600 -mt-2">Enter a reason for the rework.</p>
          )}
          {presetLocked && selected && !selected.planningBatchId && (
            <p className="text-xs text-amber-600 -mt-2">This batch is not linked to planning. Send it from Planning first, or use BMR Create New Batch to choose another batch.</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason for rework <span className="text-red-500">*</span></label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              placeholder="e.g. QC failure – pH out of spec; bulk rework required"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
            />
          </div>
          {selected && selected._pk != null && selected.planningBatchId != null && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-orange-900">Rework Preview (BMR)</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border border-orange-200 bg-white px-2 py-1.5">
                  <p className="text-gray-500 uppercase">Planned</p>
                  <p className="font-semibold text-gray-900">{plannedUnits.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded border border-orange-200 bg-white px-2 py-1.5">
                  <p className="text-gray-500 uppercase">Actual</p>
                  <p className="font-semibold text-gray-900">{Math.round(actualUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded border border-orange-200 bg-white px-2 py-1.5">
                  <p className="text-gray-500 uppercase">Shortfall</p>
                  <p className="font-semibold text-orange-700">{shortfallUnits.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Rework Qty (units)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={reworkQty}
                    onChange={e => setReworkQty(e.target.value)}
                    className="w-full border border-orange-200 rounded-lg px-2.5 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Batch Size (KG, optional)</label>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={reworkBatchSizeKg}
                    onChange={e => setReworkBatchSizeKg(e.target.value)}
                    placeholder="Auto-scaled"
                    className="w-full border border-orange-200 rounded-lg px-2.5 py-2 text-sm bg-white"
                  />
                </div>
              </div>
              <div className="rounded border border-orange-200 bg-white p-2.5">
                <p className="text-[11px] font-semibold text-gray-800 mb-1.5">RM/PM shortfall preview (Planning Items Involved)</p>
                {reworkItemsLoading ? (
                  <p className="text-[11px] text-gray-500">Loading item-level shortfall…</p>
                ) : reworkItemsError ? (
                  <p className="text-[11px] text-amber-700">{reworkItemsError}</p>
                ) : previewShortageRows.length === 0 ? (
                  <p className="text-[11px] text-emerald-700">No immediate RM/PM shortage detected for this planning line.</p>
                ) : (
                  <div className="space-y-1">
                    {previewShortageRows.map((row) => (
                      <div key={`${row.type}-${row.code}`} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 text-[11px] border-b border-gray-100 pb-1">
                        <span className={`font-semibold ${row.type === 'RM' ? 'text-blue-700' : 'text-purple-700'}`}>{row.type}</span>
                        <span className="truncate text-gray-700" title={`${row.code} ${row.name}`}>{row.code} - {row.name}</span>
                        <span className="text-gray-500">need {row.req.toLocaleString('en-IN')} {row.unit}</span>
                        <span className="font-semibold text-red-700">short {row.shortage.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-500 pt-1">
                      Rework request creates a new Planning batch entry; use Planning (PIs Extracted / Items Involved) to handle procurement in the normal flow.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={!canReworkSelected || submitting} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create rework batch'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────── BMR VIEW ─────────────────────────────────────── */

function BMRView({ batches, outboundMrns, onAction, onCreateBatch, onExportBMR }: {
  batches: Batch[];
  outboundMrns: MRNRecordFromApi[];
  onAction: (action: string, batch: Batch) => void;
  onCreateBatch?: () => void;
  onExportBMR?: () => void;
}) {
  const bmrBatches = useMemo(() => batches.filter(b => b.bmrStatus !== 'cleared'), [batches]);
  const [filter, setFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const productOptions = useMemo(
    () => Array.from(new Set(bmrBatches.map(b => b.productName).filter(Boolean))).sort(),
    [bmrBatches],
  );
  const statusFiltered = useMemo(() => {
    if (filter === 'all') return bmrBatches;
    if (filter === 'pending_confirm') return bmrBatches.filter(b => b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed');
    if (filter === 'in_production') return bmrBatches.filter(b => b.bmrStatus === 'in_production' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'rm_connected' || b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved');
    if (filter === 'bulk_qc') return bmrBatches.filter(b => b.bmrStatus === 'bulk_qc');
    if (filter === 'cleared') return batches.filter(b => b.bmrStatus === 'cleared');
    if (filter === 'qc_failed') return bmrBatches.filter(b => b.bmrStatus === 'qc_failed');
    return bmrBatches.filter(b => b.bmrStatus === filter);
  }, [filter, bmrBatches, batches]);
  const productFiltered = productFilter ? statusFiltered.filter(b => b.productName === productFilter) : statusFiltered;
  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? productFiltered.filter(b => b.bmrNo.toLowerCase().includes(searchLower) || (b.batchNo && b.batchNo.toLowerCase().includes(searchLower)) || (b.productName && b.productName.toLowerCase().includes(searchLower)))
    : productFiltered;

  const pendingCount = bmrBatches.filter(b => b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed').length;
  const inProdCount = bmrBatches.filter(b => b.bmrStatus === 'in_production' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'rm_connected' || b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved').length;
  const qcCount = bmrBatches.filter(b => b.bmrStatus === 'bulk_qc').length;
  const clearedCount = batches.filter(b => b.bmrStatus === 'cleared').length;
  const failedCount = bmrBatches.filter(b => b.bmrStatus === 'qc_failed').length;

  const clearFilters = () => { setFilter('all'); setProductFilter(''); setSearch(''); };

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-bmr">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">BMR — Batch Manufacturing Records</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">Bulk production tracking · Weighing → Manufacturing → QC → Clearance</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => onCreateBatch?.()} className="btn btn-sm btn-primary inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors">
            <Plus size={13} /> Create New Batch
          </button>
          <button type="button" onClick={() => onExportBMR?.()} className="btn btn-sm btn-ghost inline-flex items-center gap-1.5 text-gray-600 border border-gray-200 hover:bg-gray-50 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors">
            Export BMR
          </button>
        </div>
      </div>
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0" id="bmr-kpis">
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Pending</div><div className="kpi-val text-lg font-extrabold text-amber-600">{pendingCount}</div><div className="kpi-sub text-[10px] text-gray-400">Draft / Confirm</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">In Prod</div><div className="kpi-val text-lg font-extrabold text-orange-600">{inProdCount}</div><div className="kpi-sub text-[10px] text-gray-400">Manufacturing flow</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">QC</div><div className="kpi-val text-lg font-extrabold text-blue-600">{qcCount}</div><div className="kpi-sub text-[10px] text-gray-400">Bulk QC</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Cleared</div><div className="kpi-val text-lg font-extrabold text-emerald-600">{clearedCount}</div><div className="kpi-sub text-[10px] text-gray-400">BMR done</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">QC Failed</div><div className="kpi-val text-lg font-extrabold text-red-600">{failedCount}</div><div className="kpi-sub text-[10px] text-gray-400">Retry required</div></div>
      </div>
      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <span className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">Status:</span>
        {[
          { k: 'all', l: 'All' },
          { k: 'pending_confirm', l: 'Pending' },
          { k: 'in_production', l: 'In Prod' },
          { k: 'bulk_qc', l: 'QC' },
          { k: 'cleared', l: 'Cleared' },
          ...(failedCount ? [{ k: 'qc_failed', l: `QC Failed (${failedCount})` }] : []),
        ].map(s => (
          <button key={s.k} type="button" onClick={() => setFilter(s.k)} className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${filter === s.k ? 'active bg-orange-500 text-white border-orange-500' : s.k === 'qc_failed' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{s.l}</button>
        ))}
        <div className="w-px h-[18px] bg-gray-200" />
        <select id="bmr-prod-filter" value={productFilter} onChange={e => setProductFilter(e.target.value)} className="text-[10.5px] px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-orange-300">
          <option value="">All Products</option>
          {productOptions.map(p => (<option key={p} value={p}>{p}</option>))}
        </select>
        <input type="text" className="search-box flex-1 min-w-[120px] max-w-[200px] text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-orange-300" id="bmr-search" placeholder="Search BMR, batch…" value={search} onInput={e => setSearch((e.target as HTMLInputElement).value)} />
        <button type="button" onClick={clearFilters} className="btn btn-xs btn-ghost ml-auto text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-[10px]" aria-label="Clear filters">×</button>
      </div>
      <div className="flex-1 overflow-auto p-5" id="bmr-list">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FlaskConical size={32} className="mb-2 opacity-20" /><p className="text-sm">No batches match this filter</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(b => {
              const colors = batchColorMap[b.color] || batchColorMap.teal;
              const openRmMtr = findOpenRmMtrForBatch(b.bmrNo, outboundMrns);
              const anyRmMtr = findAnyRmMtrForBatch(b.bmrNo, outboundMrns);
              const effectiveRm = effectiveRmConnected(b, outboundMrns);
              const bmrDisplayForStrip = b.bmrStatus === 'qc_failed' ? 'bulk_qc' : (() => {
                const pastRmConnectUi = ['dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
                if (pastRmConnectUi.includes(b.bmrStatus)) return b.bmrStatus;
                if (effectiveRm && (b.bmrStatus === 'rm_reserved' || b.bmrStatus === 'scheduled')) return 'rm_connected';
                return b.bmrStatus;
              })();
              const rmMtrWhMeta = outboundMtrWarehouseMeta(openRmMtr);
              return (
                <div key={b.bmrNo} className={`rounded-xl border p-4 ${b.bmrStatus === 'qc_failed' ? 'bg-red-50/60 border-red-200' : `${colors.bg} ${colors.border}`} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onAction('detail', b)}>
                  <div className="mb-3"><PipelineStrip pipeline={BMR_PIPELINE} currentStatus={bmrDisplayForStrip} failed={b.bmrStatus === 'qc_failed'} /></div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{b.bmrNo}</div>
                      <div className="text-xs text-gray-600 font-medium">{b.productName}</div>
                    </div>
                    {b.bmrStatus === 'qc_failed'
                      ? <Badge className="bg-red-100 text-red-700 border border-red-300">QC Failed</Badge>
                      : <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>{bmrStatusLabel[bmrDisplayForStrip]}</Badge>}
                  </div>
                  {b.bmrStatus === 'qc_failed' && b.remarks && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-lg bg-red-100/60 border border-red-200 text-[10px] text-red-700">
                      <AlertTriangle size={11} className="shrink-0" /> {b.remarks}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                    <div><span className="text-gray-400">Batch:</span> <b>{b.batchNo} ({b.batchIndex}/{b.totalBatches})</b></div>
                    <div><span className="text-gray-400">Size:</span> <b>{b.batchSize} KG</b></div>
                    <div><span className="text-gray-400">Process:</span> <b>{b.processType.toUpperCase()}</b></div>
                    <div><span className="text-gray-400">Vessel:</span> <b>{b.mainVessel || '-'}</b></div>
                    <div><span className="text-gray-400">MFG:</span> <b>{b.mfgDate || '-'}</b></div>
                    <div><span className="text-gray-400">SO:</span> <b>{b.soNo}</b></div>
                    <div><span className="text-gray-400">RM:</span> <b className="inline-flex items-center gap-0.5">{b.rmReserved ? <><Check size={10} className="text-emerald-600" /> Reserved</> : '-'}</b></div>
                    <div><span className="text-gray-400">Due:</span> <b>{b.dueDate || '-'}</b></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                    {b.bmrStatus === 'draft' && <Btn color="orange" icon={<Zap size={11} />} onClick={() => onAction('confirm', b)}>Confirm</Btn>}
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') && !b.rmReserved && <Btn color="amber" icon={<Package size={11} />} onClick={() => onAction('reserveRM', b)}>Reserve RM</Btn>}
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') && b.rmReserved && b.pmReserved && !b.mfgDate && !b.fillDate && !b.packDate && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Schedule</Btn>
                    )}
                    {canShowRescheduleFooterButton(b) && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Reschedule</Btn>
                    )}
                    {canAdjustBatchSize(b) && (
                      <Btn color="orange" icon={<Settings size={11} />} onClick={() => onAction('adjustBatch', b)}>Adjust size</Btn>
                    )}
                    {(b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved') && !effectiveRm && !anyRmMtr && <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrRM', b)}>RM Transfer</Btn>}
                    {(b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved') && !effectiveRm && openRmMtr && (
                      <span
                        className="inline-flex flex-col gap-0.5 items-start px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg max-w-[min(100%,28rem)]"
                        title={outboundMtrStageHint(openRmMtr)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Info size={10} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openRmMtr)}</span>
                        </span>
                        {rmMtrWhMeta && (
                          <span className="text-[9px] font-semibold text-amber-950/90 leading-snug pl-4 border-l border-amber-300/50">
                            {rmMtrWhMeta}
                          </span>
                        )}
                        {openRmMtr.lineTransferStatus && openRmMtr.lineItems && (
                          <span className="text-[9px] font-normal text-amber-900/85 leading-snug pl-4">
                            {openRmMtr.lineItems.filter(mtrLineItemIsRm).map((li) => (
                              <span key={li.id} className="mr-1.5 inline-block">
                                <span className="font-mono">{li.itemCode}</span>: {formatMtrLinePhaseShort(mtrLinePhaseRaw(openRmMtr, li.id))}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                    {effectiveRm && (b.bmrStatus === 'rm_connected' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'rm_reserved' || b.bmrStatus === 'scheduled') && (!openRmMtr || mtrAllRmLinesReceivedAtMu(openRmMtr)) && (
                      <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispenseRM', b)}>Dispense</Btn>
                    )}
                    {effectiveRm && (b.bmrStatus === 'rm_connected' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'rm_reserved' || b.bmrStatus === 'scheduled') && openRmMtr && !mtrAllRmLinesReceivedAtMu(openRmMtr) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg" title="Receive all RM lines at MU in Transfer orders first.">
                        <Info size={10} /> Receive RM at MU
                      </span>
                    )}
                    {/* {canOfferRmDispensingUi(b) && <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispenseRM', b)}>Dispense</Btn>} */}
                    {b.bmrStatus === 'in_production' && <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>Bulk QC</Btn>}
                    {b.bmrStatus === 'bulk_qc' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>Review QC</Btn>}
                    {b.bmrStatus === 'qc_failed' && <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>Retry QC</Btn>}
                    <button onClick={() => onAction('detail', b)} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg hover:bg-white/80 transition-colors"><Eye size={10} /> Details</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────── BPR VIEW ─────────────────────────────────────── */

function BPRView({ batches, outboundMrns, onAction, onExportBPR }: {
  batches: Batch[];
  outboundMrns: MRNRecordFromApi[];
  onAction: (action: string, batch: Batch) => void;
  onExportBPR?: () => void;
}) {
  const bprBatches = batches.filter(b => b.bmrStatus !== 'draft');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const statusFiltered = filter === 'all' ? bprBatches : filter === 'qc_failed' ? bprBatches.filter(b => b.bprStatus === 'qc_failed') : filter === 'filling' ? bprBatches.filter(b => ['filling', 'pm_connected', 'pm_dispensing'].includes(b.bprStatus)) : filter === 'fill_qc' ? bprBatches.filter(b => b.bprStatus === 'fill_qc' || b.bprStatus === 'pack_qc') : bprBatches.filter(b => b.bprStatus === filter);
  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower ? statusFiltered.filter(b => b.bprNo.toLowerCase().includes(searchLower) || (b.batchNo && b.batchNo.toLowerCase().includes(searchLower)) || (b.productName && b.productName.toLowerCase().includes(searchLower))) : statusFiltered;
  const failedCount = bprBatches.filter(b => b.bprStatus === 'qc_failed').length;
  const fillingCount = bprBatches.filter(b => b.bprStatus === 'filling' || b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_dispensing').length;
  const packagingCount = bprBatches.filter(b => b.bprStatus === 'packaging').length;
  const fillQcCount = bprBatches.filter(b => b.bprStatus === 'fill_qc' || b.bprStatus === 'pack_qc').length;
  const fgReadyCount = bprBatches.filter(b => b.bprStatus === 'fg_ready').length;

  const clearFilters = () => { setFilter('all'); setSearch(''); };

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-bpr">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">BPR — Batch Packaging Records</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">Filling & packaging tracking · PM Dispensing → Filling → QC → Packaging → FG Ready</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => onExportBPR?.()} className="btn btn-sm btn-ghost inline-flex items-center gap-1.5 text-gray-600 border border-gray-200 hover:bg-gray-50 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors">
            Export BPR
          </button>
        </div>
      </div>
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0" id="bpr-kpis">
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Filling</div><div className="kpi-val text-lg font-extrabold text-purple-600">{fillingCount}</div><div className="kpi-sub text-[10px] text-gray-400">In fill flow</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Packaging</div><div className="kpi-val text-lg font-extrabold text-emerald-600">{packagingCount}</div><div className="kpi-sub text-[10px] text-gray-400">In pack flow</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">QC</div><div className="kpi-val text-lg font-extrabold text-blue-600">{fillQcCount}</div><div className="kpi-sub text-[10px] text-gray-400">Fill / Pack QC</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">FG Ready</div><div className="kpi-val text-lg font-extrabold text-emerald-600">{fgReadyCount}</div><div className="kpi-sub text-[10px] text-gray-400">Completed</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">QC Failed</div><div className="kpi-val text-lg font-extrabold text-red-600">{failedCount}</div><div className="kpi-sub text-[10px] text-gray-400">Retry required</div></div>
      </div>
      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <span className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">Status:</span>
        {[
          { k: 'all', l: 'All' },
          { k: 'filling', l: 'Filling' },
          { k: 'packaging', l: 'Packaging' },
          { k: 'fill_qc', l: 'QC' },
          { k: 'fg_ready', l: 'FG Ready' },
          ...(failedCount ? [{ k: 'qc_failed', l: `QC Failed (${failedCount})` }] : []),
        ].map(s => (
          <button key={s.k} type="button" onClick={() => setFilter(s.k)} className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${filter === s.k ? 'active bg-purple-500 text-white border-purple-500' : s.k === 'qc_failed' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{s.l}</button>
        ))}
        <input type="text" className="search-box flex-1 min-w-[120px] max-w-[200px] text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-purple-300 ml-auto" id="bpr-search" placeholder="Search BPR, batch…" value={search} onInput={e => setSearch((e.target as HTMLInputElement).value)} />
        <button type="button" onClick={clearFilters} className="btn btn-xs btn-ghost text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-[10px]" aria-label="Clear filters">×</button>
      </div>
      <div className="flex-1 overflow-auto p-5" id="bpr-list">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400"><Package size={32} className="mb-2 opacity-20" /><p className="text-sm text-center max-w-md">No BPR records match this filter. After BMR batch is confirmed, the batch appears here for filling and packaging.</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(b => {
              const colors = batchColorMap[b.color] || batchColorMap.purple;
              const openPmMtr = findOpenPmMtrForBatch(b.bmrNo, outboundMrns);
              const anyPmMtr = findAnyPmMtrForBatch(b.bmrNo, outboundMrns);
              const effectivePm = effectivePmConnected(b, outboundMrns);
              const bprDisplayForStrip = b.bprStatus === 'qc_failed' ? (b.fillBatchAccepted === false ? 'fill_qc' : 'pack_qc') : (effectivePm && b.bprStatus === 'pm_reserved' ? 'pm_dispensing' : b.bprStatus);
              const pmMtrWhMeta = outboundMtrWarehouseMeta(openPmMtr);
              return (
                <div key={b.bprNo} className={`rounded-xl border p-4 ${b.bprStatus === 'qc_failed' ? 'bg-red-50/60 border-red-200' : `${colors.bg} ${colors.border}`} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onAction('detail', b)}>
                  <div className="mb-3"><PipelineStrip pipeline={BPR_PIPELINE} currentStatus={bprDisplayForStrip} failed={b.bprStatus === 'qc_failed'} /></div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{b.bprNo}</div>
                      <div className="text-xs text-gray-600 font-medium">{b.productName}</div>
                    </div>
                    {b.bprStatus === 'qc_failed'
                      ? <Badge className="bg-red-100 text-red-700 border border-red-300">QC Failed{b.fillBatchAccepted === false ? ' (Fill)' : ' (Pack)'}</Badge>
                      : <Badge className="bg-purple-100 text-purple-700 border border-purple-200">{bprStatusLabel[bprDisplayForStrip]}</Badge>}
                  </div>
                  {b.bprStatus === 'qc_failed' && b.remarks && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-lg bg-red-100/60 border border-red-200 text-[10px] text-red-700">
                      <AlertTriangle size={11} className="shrink-0" /> {b.remarks}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                    <div><span className="text-gray-400">Batch:</span> <b>{b.batchNo}</b></div>
                    <div><span className="text-gray-400">Fill Line:</span> <b>{b.fillingLine || '-'}</b></div>
                    <div><span className="text-gray-400">Fill Type:</span> <b>{b.fillingType.toUpperCase()}</b></div>
                    <div><span className="text-gray-400">Pack Line:</span> <b>{b.packagingLine || '-'}</b></div>
                    <div><span className="text-gray-400">Fill:</span> <b>{b.fillDate || '-'}</b></div>
                    <div><span className="text-gray-400">Pack:</span> <b>{b.packDate || '-'}</b></div>
                    <div><span className="text-gray-400">PM:</span> <b className="inline-flex items-center gap-0.5">{b.pmReserved ? <><Check size={10} className="text-emerald-600" /></> : '-'}</b></div>
                    <div><span className="text-gray-400">FG:</span> <b>{b.fgDate || '-'}</b></div>
                    <div className="col-span-2 sm:col-span-4 min-w-0">
                      <span className="text-gray-400">MU bundle:</span>{' '}
                      <b className="font-mono text-[10px] text-gray-800 break-all" title={b.muDispensingBundleId || undefined}>
                        {b.muDispensingBundleId || '—'}
                      </b>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') && !b.pmReserved && (
                      <Btn color="amber" icon={<Package size={11} />} onClick={() => onAction('reservePM', b)}>Reserve PM</Btn>
                    )}
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') && b.rmReserved && b.pmReserved && !b.mfgDate && !b.fillDate && !b.packDate && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Schedule</Btn>
                    )}
                    {canAdjustBatchSize(b) && (
                      <Btn color="orange" icon={<Settings size={11} />} onClick={() => onAction('adjustBatch', b)}>Adjust size</Btn>
                    )}
                    {b.bprStatus === 'pm_reserved' && !effectivePm && !anyPmMtr && <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrPM', b)}>PM Transfer</Btn>}
                    {b.bprStatus === 'pm_reserved' && !effectivePm && openPmMtr && (
                      <span className="inline-flex flex-col gap-0.5 items-start px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg max-w-[min(100%,28rem)]" title={outboundMtrStageHint(openPmMtr)}>
                        <span className="inline-flex items-center gap-1">
                          <Info size={10} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openPmMtr)}</span>
                        </span>
                        {pmMtrWhMeta && (
                          <span className="text-[9px] font-semibold text-amber-950/90 leading-snug pl-4 border-l border-amber-300/50">
                            {pmMtrWhMeta}
                          </span>
                        )}
                        {openPmMtr.lineTransferStatus && openPmMtr.lineItems && (
                          <span className="text-[9px] font-normal text-amber-900/85 leading-snug pl-4">
                            {openPmMtr.lineItems.filter(mtrLineItemIsPm).map((li) => (
                              <span key={li.id} className="mr-1.5 inline-block">
                                <span className="font-mono">{li.itemCode}</span>: {formatMtrLinePhaseShort(mtrLinePhaseRaw(openPmMtr, li.id))}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                    {effectivePm && (b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_reserved' || b.bprStatus === 'pm_dispensing') && (!openPmMtr || mtrAllPmLinesReceivedAtMu(openPmMtr)) && (
                      <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispensePM', b)}>PM Dispense</Btn>
                    )}
                    {effectivePm && (b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_reserved' || b.bprStatus === 'pm_dispensing') && openPmMtr && !mtrAllPmLinesReceivedAtMu(openPmMtr) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg" title="Receive all PM lines at MU in Transfer orders first.">
                        <Info size={10} /> Receive PM at MU
                      </span>
                    )}
                    {canShowRescheduleFooterButton(b) && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Reschedule</Btn>
                    )}
                    {b.bprStatus === 'filling' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcFill', b)}>Fill QC</Btn>}
                    {b.bprStatus === 'packaging' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcPack', b)}>Pack QC</Btn>}
                    {b.bprStatus === 'qc_failed' && b.fillBatchAccepted === false && <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcFill', b)}>Retry Fill QC</Btn>}
                    {b.bprStatus === 'qc_failed' && b.fgBatchAccepted === false && <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcPack', b)}>Retry Pack QC</Btn>}
                    {b.bprStatus === 'fg_ready' && <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> FG Ready</Badge>}
                    <button onClick={() => onAction('detail', b)} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg hover:bg-white/80 transition-colors"><Eye size={10} /> Details</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Unit shortfall vs planned batch allocation (same basis as rework modal). */
function yieldBatchReworkShortfallUnits(batch: Batch): number {
  const plannedUnits = batch.totalBatches > 0
    ? Math.ceil((Number(batch.orderQty) || 0) / batch.totalBatches)
    : (Number(batch.orderQty) || 0);
  const actualUnits = Number(batch.fgYield) || Number(batch.fillYield) || 0;
  return Math.max(0, Math.round(plannedUnits - actualUnits));
}

function yieldBatchEligibleForRework(batch: Batch): boolean {
  return batch._pk != null
    && batch.planningBatchId != null
    && yieldBatchReworkShortfallUnits(batch) > 0;
}

function YieldReworkPreflightModal({
  batch,
  onClose,
  onContinue,
}: {
  batch: Batch;
  onClose: () => void;
  onContinue: () => void;
}) {
  const plannedKg = Number(batch.batchSize) || 0;
  const bmrYieldKg = Number(batch.bulkYield) || 0;
  const bmrWastageKg = Math.max(0, plannedKg - bmrYieldKg);
  const bprBulkUnits = Number(batch.fillYield) || 0;
  const builtUnits = Number(batch.fgYield) || bprBulkUnits;
  const orderQty = Number(batch.orderQty) || 0;
  const plannedUnits = batch.totalBatches > 0 ? Math.ceil(orderQty / batch.totalBatches) : orderQty;
  const shortfallUnits = yieldBatchReworkShortfallUnits(batch);
  const bprWastageUnits = Math.max(0, bprBulkUnits - builtUnits);
  const linkageOk = batch._pk != null && batch.planningBatchId != null;
  const canContinue = linkageOk && shortfallUnits > 0;

  return (
    <Modal
      onClose={onClose}
      title="Confirm rework from yield"
      subtitle={`${batch.bmrNo} · ${batch.productName ?? batch.sku}`}
      size="lg"
    >
      <p className="text-xs text-gray-600 mb-4">
        Review quantities and shortfall. The next step opens the rework form with <strong>SO</strong> and <strong>base BMR</strong> filled in automatically.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">SO</p><p className="font-semibold text-gray-900">{batch.soNo || '—'}</p></div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BMR</p><p className="font-semibold text-gray-900">{batch.bmrNo}</p></div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BPR</p><p className="font-semibold text-gray-900">{batch.bprNo}</p></div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">Batch no.</p><p className="font-semibold text-gray-900">{batch.batchNo || '—'}</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <h4 className="text-xs font-bold text-blue-900 mb-2">BMR (KG)</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-600">Planned</span><b>{plannedKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
            <div className="flex justify-between"><span className="text-gray-600">Yield</span><b>{bmrYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
            <div className="flex justify-between"><span className="text-gray-600">Wastage</span><b className="text-amber-700">{bmrWastageKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></div>
          </div>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
          <h4 className="text-xs font-bold text-purple-900 mb-2">BPR (units)</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-600">Bulk to fill</span><b>{fmt(Math.round(bprBulkUnits))}</b></div>
            <div className="flex justify-between"><span className="text-gray-600">FG / output</span><b>{fmt(Math.round(builtUnits))}</b></div>
            <div className="flex justify-between"><span className="text-gray-600">BPR wastage</span><b className="text-rose-700">{fmt(Math.round(bprWastageUnits))}</b></div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3 mb-4">
        <h4 className="text-xs font-bold text-orange-900 mb-2">Rework basis (units)</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-gray-500">Planned</p><p className="font-semibold">{fmt(Math.round(plannedUnits))}</p></div>
          <div><p className="text-gray-500">Actual</p><p className="font-semibold">{fmt(Math.round(builtUnits))}</p></div>
          <div><p className="text-gray-500">Shortfall</p><p className="font-semibold text-orange-800">{fmt(shortfallUnits)}</p></div>
        </div>
        {!linkageOk && (
          <p className="text-[11px] text-amber-800 mt-2">This batch is missing production id or planning link — rework cannot be created from here. Use Planning / BMR flows to fix linkage.</p>
        )}
        {linkageOk && shortfallUnits <= 0 && (
          <p className="text-[11px] text-gray-700 mt-2">No unit shortfall vs plan; rework from yield is not needed for this batch.</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          Continue to rework form
        </button>
      </div>
    </Modal>
  );
}

/* ──────────── YIELD REPORT VIEW ────────────────────────────── */
function YieldReportView({ batches, onRequestReworkPreflight }: { batches: Batch[]; onRequestReworkPreflight?: (b: Batch) => void }) {
  const [search, setSearch] = useState('');
  const [selectedBmrNo, setSelectedBmrNo] = useState<string | null>(null);
  const fgReadyBatches = useMemo(() => batches.filter((b) => b.bprStatus === 'fg_ready'), [batches]);
  const searchLower = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = searchLower
      ? fgReadyBatches.filter((b) =>
        b.bmrNo.toLowerCase().includes(searchLower)
        || b.bprNo.toLowerCase().includes(searchLower)
        || (b.batchNo || '').toLowerCase().includes(searchLower)
        || (b.productName || '').toLowerCase().includes(searchLower)
        || (b.soNo || '').toLowerCase().includes(searchLower))
      : fgReadyBatches;
    return filtered.map((b) => {
      const plannedKg = Number(b.batchSize) || 0;
      const bmrYieldKg = Number(b.bulkYield) || 0;
      const bprBulkUnits = Number(b.fillYield) || 0;
      const builtUnits = Number(b.fgYield) || bprBulkUnits;
      const orderQty = Number(b.orderQty) || 0;
      const plannedUnits = b.totalBatches > 0 ? Math.ceil(orderQty / b.totalBatches) : orderQty;
      const bmrWastageKg = Math.max(0, plannedKg - bmrYieldKg);
      const bprWastageUnits = Math.max(0, bprBulkUnits - builtUnits);
      const overallWastageUnits = Math.max(0, plannedUnits - builtUnits);
      const bmrYieldPct = plannedKg > 0 ? Math.max(0, Math.min(100, (bmrYieldKg / plannedKg) * 100)) : 0;
      const outputVsPlanPct = plannedUnits > 0 ? Math.max(0, Math.min(100, (builtUnits / plannedUnits) * 100)) : 0;
      return {
        b, plannedKg, plannedUnits,
        bmrYieldKg, bmrWastageKg, bmrYieldPct,
        bprBulkUnits, builtUnits, bprWastageUnits, overallWastageUnits, outputVsPlanPct,
      };
    });
  }, [fgReadyBatches, searchLower]);
  const totalYieldKg = rows.reduce((s, r) => s + r.bmrYieldKg, 0);
  const totalActualOutputUnits = rows.reduce((s, r) => s + r.builtUnits, 0);
  const totalBmrWastageKg = rows.reduce((s, r) => s + r.bmrWastageKg, 0);
  const totalBprWastageUnits = rows.reduce((s, r) => s + r.bprWastageUnits, 0);
  const selectedRow = selectedBmrNo ? rows.find((r) => r.b.bmrNo === selectedBmrNo) ?? null : null;

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-yield-report">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Yield Report</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">FG-ready batch-wise output report from QC-yield inputs.</div>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BMR/BPR, batch, SO, product…"
          className="w-full sm:w-72 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-emerald-300"
        />
      </div>
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0">
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">FG Ready Batches</div><div className="kpi-val text-lg font-extrabold text-emerald-600">{rows.length}</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">BMR Yield (KG)</div><div className="kpi-val text-lg font-extrabold text-blue-600">{totalYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Actual Output (Units)</div><div className="kpi-val text-lg font-extrabold text-purple-600">{fmt(Math.round(totalActualOutputUnits))}</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">BMR Wastage (KG)</div><div className="kpi-val text-lg font-extrabold text-amber-600">{totalBmrWastageKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div></div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">BPR Wastage (Units)</div><div className="kpi-val text-lg font-extrabold text-rose-600">{fmt(Math.round(totalBprWastageUnits))}</div></div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400"><Activity size={30} className="mb-2 opacity-20" /><p className="text-sm">No FG-ready batches found for yield reporting.</p></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs bg-white">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Batch</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Product / SO</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BMR Plan (KG)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BMR Yield (KG)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BMR Waste (KG)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BMR Yield %</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BPR Bulk (Units)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Actual Output (Units)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">BPR Waste (Units)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Overall Waste (Units)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Output vs Plan %</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Rework</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.b.bmrNo} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-800">{r.b.bmrNo}</div>
                      <div className="text-[10px] text-gray-500">{r.b.bprNo} · {r.b.batchNo || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-800">{r.b.productName}</div>
                      <div className="text-[10px] text-gray-500">{r.b.soNo || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.plannedKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{r.bmrYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">{r.bmrWastageKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.bmrYieldPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(Math.round(r.bprBulkUnits))}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-purple-700">{fmt(Math.round(r.builtUnits))}</td>
                    <td className="px-3 py-2 text-right font-mono text-rose-700">{fmt(Math.round(r.bprWastageUnits))}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(Math.round(r.overallWastageUnits))}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.outputVsPlanPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={!onRequestReworkPreflight || !yieldBatchEligibleForRework(r.b)}
                        title={
                          !onRequestReworkPreflight
                            ? ''
                            : !yieldBatchEligibleForRework(r.b)
                              ? (!r.b._pk || !r.b.planningBatchId
                                ? 'Rework needs a planning-linked batch with production id'
                                : 'No unit shortfall vs planned batch')
                              : 'Create rework batch from this yield row'
                        }
                        onClick={() => onRequestReworkPreflight?.(r.b)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Layers size={10} /> Rework
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedBmrNo(r.b.bmrNo)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedRow && (
        <Modal
          onClose={() => setSelectedBmrNo(null)}
          title={`Yield Detail — ${selectedRow.b.bmrNo}`}
          subtitle={`${selectedRow.b.productName} · ${selectedRow.b.bprNo} · ${selectedRow.b.batchNo || '—'}`}
          size="xl"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">SO</p><p className="text-xs font-semibold text-gray-800">{selectedRow.b.soNo || '—'}</p></div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">FG Date</p><p className="text-xs font-semibold text-gray-800">{selectedRow.b.fgDate || '—'}</p></div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BMR Status</p><p className="text-xs font-semibold text-gray-800">{bmrStatusLabel[selectedRow.b.bmrStatus]}</p></div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500 uppercase">BPR Status</p><p className="text-xs font-semibold text-gray-800">{bprStatusLabel[selectedRow.b.bprStatus]}</p></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <h4 className="text-sm font-bold text-blue-900 mb-3">BMR (Manufacturing) Detail</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Planned batch weight</span><b>{selectedRow.plannedKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</b></div>
                <div className="flex justify-between"><span className="text-gray-600">Actual yield weight</span><b>{selectedRow.bmrYieldKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</b></div>
                <div className="flex justify-between"><span className="text-gray-600">BMR wastage</span><b className="text-amber-700">{selectedRow.bmrWastageKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</b></div>
                <div className="flex justify-between"><span className="text-gray-600">Yield efficiency</span><b>{selectedRow.bmrYieldPct.toFixed(1)}%</b></div>
              </div>
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <h4 className="text-sm font-bold text-purple-900 mb-3">BPR (Filling & Packing) Detail</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Bulk available to fill</span><b>{fmt(Math.round(selectedRow.bprBulkUnits))} units</b></div>
                <div className="flex justify-between"><span className="text-gray-600">Actual output produced</span><b>{fmt(Math.round(selectedRow.builtUnits))} units</b></div>
                <div className="flex justify-between"><span className="text-gray-600">BPR wastage</span><b className="text-rose-700">{fmt(Math.round(selectedRow.bprWastageUnits))} units</b></div>
                <div className="flex justify-between"><span className="text-gray-600">Output vs planned units</span><b>{selectedRow.outputVsPlanPct.toFixed(1)}%</b></div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <h4 className="text-sm font-bold text-emerald-900 mb-3">Combined Batch Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><p className="text-gray-500">Planned units</p><p className="font-semibold">{fmt(Math.round(selectedRow.plannedUnits))}</p></div>
              <div><p className="text-gray-500">Actual output units</p><p className="font-semibold">{fmt(Math.round(selectedRow.builtUnits))}</p></div>
              <div><p className="text-gray-500">Overall unit wastage</p><p className="font-semibold text-amber-700">{fmt(Math.round(selectedRow.overallWastageUnits))}</p></div>
              <div><p className="text-gray-500">Overall quality state</p><p className="font-semibold">{selectedRow.b.bprStatus === 'fg_ready' ? 'FG Ready' : 'In Progress'}</p></div>
            </div>
          </div>
          {onRequestReworkPreflight && (
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={!yieldBatchEligibleForRework(selectedRow.b)}
                title={
                  !yieldBatchEligibleForRework(selectedRow.b)
                    ? (!selectedRow.b._pk || !selectedRow.b.planningBatchId
                      ? 'Rework needs a planning-linked batch with production id'
                      : 'No unit shortfall vs planned batch')
                    : 'Confirm quantities, then open rework form with SO and BMR filled in'
                }
                onClick={() => { onRequestReworkPreflight(selectedRow.b); setSelectedBmrNo(null); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Layers size={14} /> Create rework batch…
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ──────────── CALENDAR VIEW ────────────────────────────────── */

function CalendarView({ batches, equipment, onBatchClick, onSchedule, weekOffset, onWeekOffsetChange, schedulableBatches = [], onManualSchedule }: {
  batches: Batch[]; equipment: EquipmentData;
  onBatchClick: (b: Batch) => void; onSchedule: (slot?: ScheduleSlot) => void;
  weekOffset: number; onWeekOffsetChange: (n: number) => void;
  schedulableBatches?: Batch[];
  onManualSchedule?: (batch: Batch, updates: Partial<Batch>) => void;
}) {
  const monday = useMemo(() => addDays(getWeekStart(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => buildWeekDays(monday), [monday]);
  const weekLabel = formatWeekLabel(monday);
  const todayStr = isoDate(new Date());
  const todayIndex = weekDays.findIndex(d => d.iso === todayStr);

  const [manualDate, setManualDate] = useState(todayStr);
  const [manualBatchId, setManualBatchId] = useState('');

  const weekIsos = useMemo(() => new Set(weekDays.map(d => d.iso)), [weekDays]);
  // Only show batches that were explicitly scheduled (Schedule modal); ignore draft/confirmed/rm_reserved even if they have dates
  const calendarBatches = useMemo(() => batches.filter(b =>
    b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_connected' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'in_production' || b.bmrStatus === 'bulk_qc' || b.bmrStatus === 'qc_failed' || b.bmrStatus === 'cleared' ||
    (b.mfgDate && (b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved'))
  ), [batches]);
  const weekBatches = useMemo(() => calendarBatches.filter(b =>
    (b.mfgDate && weekIsos.has(b.mfgDate)) ||
    (b.fillDate && weekIsos.has(b.fillDate)) ||
    (b.packDate && weekIsos.has(b.packDate))
  ), [calendarBatches, weekIsos]);

  // Include all manufacturing (vessels + supporting tanks) in calendar, matching HTML grouping
  const allEquip = [
    ...equipment.manufacturing.map(e => ({ ...e, _cat: 'mfg' as const })),
    ...equipment.filling.map(e => ({ ...e, _cat: 'fill' as const })),
    ...equipment.packaging.map(e => ({ ...e, _cat: 'pack' as const })),
  ];

  const active = batches.filter(b => b.bmrStatus === 'in_production' || b.bmrStatus === 'dispensing').length;
  const scheduledWithDates = batches.filter(b => (b.mfgDate || b.fillDate || b.packDate) && (b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_connected' || b.bmrStatus === 'dispensing' || b.bmrStatus === 'in_production' || b.bmrStatus === 'bulk_qc' || b.bmrStatus === 'qc_failed' || b.bmrStatus === 'cleared' || b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved')).length;
  const fgReady = batches.filter(b => b.bprStatus === 'fg_ready').length;
  const mfgTotal = equipment.manufacturing.length;
  const mfgBusy = useMemo(() => new Set(calendarBatches.filter(b => b.mainVessel).map(b => b.mainVessel)), [calendarBatches]);
  const vesselsIdle = mfgTotal - mfgBusy.size;
  const fillTotal = equipment.filling.length;
  const fillBusy = useMemo(() => new Set(calendarBatches.filter(b => b.fillingLine).map(b => b.fillingLine)), [calendarBatches]);
  const fillingLinesIdle = fillTotal - fillBusy.size;

  function getBatches(equipId: string, dayIso: string, cat: string): Batch[] {
    if (cat === 'mfg') return calendarBatches.filter(b => b.mainVessel === equipId && b.mfgDate === dayIso);
    if (cat === 'fill') return calendarBatches.filter(b => b.fillingLine === equipId && b.fillDate === dayIso);
    if (cat === 'pack') return calendarBatches.filter(b => b.packagingLine === equipId && b.packDate === dayIso);
    return [];
  }

  const isEquipBusy = (equipId: string, cat: string) => {
    if (cat === 'mfg') return calendarBatches.some(b => b.mainVessel === equipId);
    if (cat === 'fill') return calendarBatches.some(b => b.fillingLine === equipId);
    if (cat === 'pack') return calendarBatches.some(b => b.packagingLine === equipId);
    return false;
  };

  const batchProductShort = (b: Batch) => `${b.batchSize}KG`;

  const catColors = { mfg: 'bg-teal-500', fill: 'bg-purple-500', pack: 'bg-emerald-500' };
  const catLabels = { mfg: 'Manufacturing Vessels', fill: 'Filling Lines', pack: 'Packaging Lines' };
  const catGroupHdr = { mfg: 'Manufacturing Vessels', fill: 'Filling Lines', pack: 'Packaging Lines' };
  const colGrid = '130px repeat(7, 110px)';

  const [calView, setCalView] = useState<'week' | 'day'>('week');

  const manualBatch = manualBatchId
    ? (schedulableBatches.find(b => b.bmrNo === manualBatchId) ?? null)
    : null;
  const handleManualScheduleSubmit = () => {
    if (!manualBatch || !onManualSchedule) return;
    const mfgDate = manualDate;
    const fillDate = addDaysStr(mfgDate, 3);
    const packDate = addDaysStr(fillDate, 1);
    const fgDate = addDaysStr(packDate, 1);
    const rmConnectDate = addDaysStr(mfgDate, -2);
    const pmConnectDate = addDaysStr(fillDate, -2);
    const batchVolL = manualBatch.requiredVolumeLiters ?? manualBatch.batchSize;
    const mfgList = equipment?.manufacturing ?? [];
    const compatVBase = manualBatch.compatibleVessels?.length ? manualBatch.compatibleVessels : mfgList.filter(e => e.type !== 'support' && (e.cap ?? 0) >= batchVolL).map(e => e.id);
    const compatV = compatVBase.length > 0 ? compatVBase : mfgList.filter(e => e.type !== 'support').map(e => e.id);
    const compatF = manualBatch.compatibleFillLines?.length ? manualBatch.compatibleFillLines : (equipment?.filling ?? []).filter(e => e.compatible?.includes(manualBatch.fillingType || 'bottle')).map(e => e.id);
    const compatP = manualBatch.compatiblePackLines?.length ? manualBatch.compatiblePackLines : (equipment?.packaging ?? []).map(e => e.id);
    const free = (equipId: string, dateStr: string) => isEquipFreeOnDate(batches, equipId, dateStr);
    const firstFree = (ids: string[], dateStr: string) => ids.find(id => free(id, dateStr)) || ids[0] || '';
    const vessel = firstFree(compatV, mfgDate);
    const fillLine = firstFree(compatF, fillDate);
    const packLine = firstFree(compatP, packDate);
    const canMoveToScheduled = manualBatch.rmReserved && manualBatch.pmReserved;
    onManualSchedule(manualBatch, {
      mfgDate, fillDate, packDate, fgDate, rmConnectDate, pmConnectDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine,
      ...scheduleSaveBmrStatusPatch(manualBatch, canMoveToScheduled),
    });
    setManualBatchId('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-calendar">
      {/* Section header — Production Calendar */}
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Production Calendar</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">Vessel & Line wise scheduling — Manufacturing · Filling · Packaging</div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => onWeekOffsetChange(weekOffset - 1)} className="btn btn-sm btn-ghost px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs font-medium">Prev</button>
          <span className="font-mono text-[11.5px] text-gray-500">{weekLabel}</span>
          <button type="button" onClick={() => onWeekOffsetChange(weekOffset + 1)} className="btn btn-sm btn-ghost px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs font-medium">Next</button>
          <div className="w-px h-[18px] bg-gray-200" />
          <button type="button" onClick={() => setCalView('week')} className={`btn btn-sm px-2 py-1 rounded-lg text-xs font-medium ${calView === 'week' ? 'border border-orange-300 text-orange-600 bg-orange-50' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>Week</button>
          <button type="button" onClick={() => setCalView('day')} className={`btn btn-sm btn-ghost px-2 py-1 rounded-lg text-xs font-medium border border-transparent ${calView === 'day' ? 'text-orange-600' : 'text-gray-500 hover:bg-gray-50'}`}>Day</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0" id="cal-kpis">
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Active Batches</div>
          <div className="kpi-val text-lg font-extrabold text-orange-600">{active}</div>
          <div className="kpi-sub text-[10px] text-gray-400">In production flow</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Vessels Idle</div>
          <div className="kpi-val text-lg font-extrabold text-indigo-600">{vesselsIdle}</div>
          <div className="kpi-sub text-[10px] text-gray-400">of {mfgTotal} manufacturing</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Filling Lines Idle</div>
          <div className="kpi-val text-lg font-extrabold text-blue-600">{fillingLinesIdle}</div>
          <div className="kpi-sub text-[10px] text-gray-400">of {fillTotal} lines</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Scheduled Batches</div>
          <div className="kpi-val text-lg font-extrabold text-teal-600">{scheduledWithDates}</div>
          <div className="kpi-sub text-[10px] text-gray-400">with dates assigned</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold tracking-wider">FG Ready</div>
          <div className="kpi-val text-lg font-extrabold text-emerald-600">{fgReady}</div>
          <div className="kpi-sub text-[10px] text-gray-400">Batches completed</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2.5 mb-2.5 px-6 flex-wrap items-center shrink-0 pt-2">
        <span className="text-[10px] text-gray-500">Legend:</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-teal-300/80 inline-block" />Manufacturing</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-purple-300/80 inline-block" />Filling</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-emerald-300/80 inline-block" />Packaging</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-amber-300/80 inline-block" />QC Hold</span>
        <span className="w-px h-3.5 bg-gray-200 inline-block" />
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-orange-400/80 inline-block" /><span className="border-l-2 border-orange-500 pl-1">Hot Process</span></span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-sky-400/80 inline-block" /><span className="border-l-2 border-sky-400 pl-1">Cold Process</span></span>
      </div>

      {/* Calendar grid */}
      <div className="cal-wrap flex-1 overflow-auto px-6 pb-4" id="cal-wrap">
        <div className="cal-grid min-w-[900px]">
          <div className="cal-header grid border-b border-gray-100 bg-white sticky top-0 z-10 shadow-xs" style={{ gridTemplateColumns: colGrid }}>
            <div className="cal-header-cell col-span-1 px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100">Equipment</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`cal-header-cell text-center py-2.5 border-r border-gray-50 ${i === todayIndex ? 'today-col bg-orange-50/60 text-orange-700' : 'text-gray-600'}`}>
                {d.label} {d.date}
                <div className="text-[8px] mt-0.5 text-gray-400">{d.month}</div>
              </div>
            ))}
          </div>

          {(['mfg', 'fill', 'pack'] as const).map(cat => (
            <React.Fragment key={cat}>
              <div className="cal-group-hdr text-[11px] font-bold text-gray-600 uppercase tracking-wider py-1.5 px-0 border-b border-gray-100">{catGroupHdr[cat]}</div>
              {allEquip.filter(e => e._cat === cat).map(eq => {
                const busy = isEquipBusy(eq.id, cat);
                const capLabel = 'cap' in eq && eq.cap ? `${eq.cap}L` : 'speed' in eq && eq.speed ? `${fmt(eq.speed)}/h` : '';
                return (
                  <div key={eq.id} className="cal-row grid border-b border-gray-50 hover:bg-gray-50/40 transition-colors" style={{ gridTemplateColumns: colGrid }}>
                    <div className="cal-label flex items-center justify-between px-3 py-2 border-r border-gray-100">
                      <div>
                        <div className="cal-label-name text-xs font-bold text-gray-800">{eq.id}</div>
                        <div className="cal-label-cap text-[10px] text-gray-400">{capLabel}</div>
                      </div>
                      <span className={`badge text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${busy ? 'b-orange bg-amber-100 text-amber-700' : 'b-green bg-emerald-100 text-emerald-700'}`}>{busy ? 'Busy' : 'Free'}</span>
                    </div>
                    {weekDays.map((d, i) => {
                      const dayBatches = getBatches(eq.id, d.iso, cat);
                      const vesselCapL = cat === 'mfg' && 'cap' in eq ? (eq.cap ?? 0) : 0;
                      const totalScheduledL = dayBatches.reduce((s, b) => s + (b.requiredVolumeLiters ?? b.batchSize ?? 0), 0);
                      const hasCapacityLeft = cat === 'mfg' && vesselCapL > 0 && totalScheduledL < vesselCapL;
                      const showAddSlot = dayBatches.length === 0 || hasCapacityLeft;
                      return (
                        <div
                          key={i}
                          className={`cal-cell min-h-14 border-r border-gray-50 p-0.5 flex flex-col gap-0.5 cursor-pointer ${i === todayIndex ? 'today-col bg-orange-50/30' : ''}`}
                          onClick={() => showAddSlot && onSchedule({ equipId: eq.id, category: cat, dateIso: d.iso })}
                          role="gridcell"
                        >
                          {dayBatches.length === 0 && !hasCapacityLeft ? (
                            <div className="empty-slot flex-1 min-h-10 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">+</div>
                          ) : (
                            <>
                              {dayBatches.map((batch) => (
                                <div
                                  key={batch.bmrNo}
                                  className={`batch-block rounded text-[10px] font-semibold px-1.5 py-1 flex flex-col justify-center overflow-hidden shadow-xs cursor-pointer hover:brightness-95 transition-all shrink-0 border-l-[3px] ${cat === 'mfg' ? 'batch-block-mfg bg-teal-100/90 border-teal-400' : cat === 'fill' ? 'batch-block-fill bg-purple-100/90 border-purple-400' : 'batch-block-pack bg-emerald-100/90 border-emerald-400'} ${batch.processType === 'hot' ? 'border-l-orange-500' : 'border-l-sky-400'}`}
                                  style={{ borderLeftColor: batch.processType === 'hot' ? '#f97316' : '#38bdf8' }}
                                  onClick={e => { e.stopPropagation(); onBatchClick(batch); }}
                                  title={`${batch.bmrNo} · ${batch.productName} · ${batch.processType.toUpperCase()} process`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`inline-block w-2 h-2 rounded-sm shrink-0 ${batch.processType === 'hot' ? 'bg-orange-400' : 'bg-sky-400'}`} title={batch.processType === 'hot' ? 'Hot Process' : 'Cold Process'} aria-hidden />
                                    {batch.bmrNo.replace(/^BMR-\d+-/, 'B')}
                                  </div>
                                  <div className="opacity-80 text-[8px]">{batchProductShort(batch)}</div>
                                </div>
                              ))}
                              {hasCapacityLeft && (
                                <div className="empty-slot flex-1 min-h-10 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0" title="Add another batch (capacity left)">+</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Manual scheduling — date + batch only; BMR/BPR and equipment assigned internally */}
      {onManualSchedule && schedulableBatches.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Manual scheduling</div>
          <p className="text-[11px] text-gray-500 mb-3">Select date and batch. Vessel and lines are assigned automatically from first available.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Date</label>
              <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-orange-300 focus:outline-none" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="min-w-[220px]">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Batch</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-orange-300 focus:outline-none" value={manualBatchId} onChange={e => setManualBatchId(e.target.value)}>
                <option value="">— Select batch —</option>
                {schedulableBatches.map(b => (
                  <option key={b.bmrNo} value={b.bmrNo}>{b.bmrNo} — {b.productName} ({b.batchSize} KG)</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleManualScheduleSubmit} disabled={!manualBatchId} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors">
              <Calendar size={14} /> Schedule
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ──────────── EQUIPMENT VIEW ───────────────────────────────── */

function EquipmentView({ equipment, batches, onUpdate, onRefresh }: {
  equipment: EquipmentData; batches: Batch[];
  onUpdate: (eq: EquipmentData) => void;
  onRefresh: () => void;
}) {
  const { addToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addCat, setAddCat] = useState<'manufacturing' | 'filling' | 'packaging'>('manufacturing');
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [addCap, setAddCap] = useState('');
  const [addType, setAddType] = useState('jacketed');
  const [addHomogenizer, setAddHomogenizer] = useState(true);
  const [addProcessTypes, setAddProcessTypes] = useState<string[]>(['hot', 'cold']);
  const [addCompatible, setAddCompatible] = useState('');
  const [addSupports, setAddSupports] = useState('');
  const [saving, setSaving] = useState(false);

  const [editPk, setEditPk] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCap, setEditCap] = useState('');
  const [editType, setEditType] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editHomogenizer, setEditHomogenizer] = useState(false);
  const [editProcessTypes, setEditProcessTypes] = useState<string[]>([]);
  const [editCompatible, setEditCompatible] = useState('');
  const [editSupports, setEditSupports] = useState('');
  const [editCat, setEditCat] = useState<'manufacturing' | 'filling' | 'packaging'>('manufacturing');

  const isBusy = (id: string) => batches.some(b => (b.mainVessel === id || b.fillingLine === id || b.packagingLine === id) && !['draft', 'cleared', 'fg_ready'].includes(b.bmrStatus));

  const handleRemove = async (cat: keyof EquipmentData, eqId: string) => {
    if (!confirm(`Remove ${eqId}? This will permanently delete it from the database.`)) return;
    const item = (equipment[cat] as Array<{ id: string; _pk?: number }>).find(e => e.id === eqId);
    if (item?._pk) {
      try {
        await apiDeleteEquipment(item._pk);
        addToast('success', `${eqId} removed`);
        onRefresh();
      } catch {
        addToast('error', `Failed to remove ${eqId}`);
      }
    } else {
      const updated = { ...equipment, [cat]: (equipment[cat] as Array<{ id: string }>).filter(e => e.id !== eqId) };
      onUpdate(updated);
    }
  };

  const handleAdd = async () => {
    if (!addId.trim() || !addName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        equipment_id: addId.trim(),
        name: addName.trim(),
        category: addCat,
        type: addType,
        status: 'idle',
      };
      if (addCat === 'manufacturing') {
        payload.capacity = parseInt(addCap) || 200;
        payload.homogenizer = addHomogenizer;
        payload.process_types = addProcessTypes;
      } else if (addCat === 'filling') {
        payload.speed = parseInt(addCap) || 1000;
        payload.compatible = addCompatible.split(',').map(s => s.trim()).filter(Boolean);
        if (!payload.compatible || (payload.compatible as string[]).length === 0) payload.compatible = [addType];
      } else {
        payload.speed = parseInt(addCap) || 2000;
        payload.supports = addSupports.split(',').map(s => s.trim()).filter(Boolean);
        if (!payload.supports || (payload.supports as string[]).length === 0) payload.supports = ['carton', 'label'];
      }
      await apiCreateEquipment(payload);
      addToast('success', `${addId} added`);
      setShowAdd(false); setAddId(''); setAddName(''); setAddCap(''); setAddCompatible(''); setAddSupports('');
      onRefresh();
    } catch {
      addToast('error', 'Failed to create equipment');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (cat: 'manufacturing' | 'filling' | 'packaging', e: { id: string; name: string; _pk?: number; cap?: number; speed?: number; type?: string; status?: string; homogenizer?: boolean; processType?: string[]; compatible?: string[]; supports?: string[] }) => {
    if (!e._pk) return;
    setEditPk(e._pk); setEditCat(cat);
    setEditName(e.name); setEditStatus(e.status || 'idle'); setEditType(e.type || '');
    setEditCap(String(e.cap ?? e.speed ?? '')); setEditHomogenizer(!!e.homogenizer);
    setEditProcessTypes(e.processType || []); setEditCompatible((e.compatible || []).join(', '));
    setEditSupports((e.supports || []).join(', '));
  };

  const handleEditSave = async () => {
    if (!editPk) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: editName, type: editType, status: editStatus };
      if (editCat === 'manufacturing') {
        payload.capacity = parseInt(editCap) || 0;
        payload.homogenizer = editHomogenizer;
        payload.process_types = editProcessTypes;
      } else if (editCat === 'filling') {
        payload.speed = parseInt(editCap) || 0;
        payload.compatible = editCompatible.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        payload.speed = parseInt(editCap) || 0;
        payload.supports = editSupports.split(',').map(s => s.trim()).filter(Boolean);
      }
      await apiUpdateEquipment(editPk, payload);
      addToast('success', 'Equipment updated');
      setEditPk(null);
      onRefresh();
    } catch {
      addToast('error', 'Failed to update equipment');
    } finally {
      setSaving(false);
    }
  };

  const catMeta: { key: 'manufacturing' | 'filling' | 'packaging'; label: string; color: string; icon: React.ReactNode }[] = [
    { key: 'manufacturing', label: 'Manufacturing Vessels', color: 'text-teal-600', icon: <FlaskConical size={14} /> },
    { key: 'filling', label: 'Filling Lines', color: 'text-purple-600', icon: <Droplets size={14} /> },
    { key: 'packaging', label: 'Packaging Lines', color: 'text-emerald-600', icon: <Package size={14} /> },
  ];

  const totalEquip = equipment.manufacturing.length + equipment.filling.length + equipment.packaging.length;
  const busyCount = [...equipment.manufacturing, ...equipment.filling, ...equipment.packaging].filter(e => isBusy(e.id)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-equipment">
      <div className="sec-hdr flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Equipment & Capacity</div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><RotateCcw size={12} /> Refresh</button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Equipment</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6" id="equip-content">
        {catMeta.map(cat => (
          <div key={cat.key} className="mb-8">
            <h3 className={`flex items-center gap-2 text-sm font-bold ${cat.color} uppercase tracking-wide mb-3`}>
              {cat.icon}{cat.label}
              <Badge className="bg-gray-100 text-gray-500 ml-1">{(equipment[cat.key] as unknown[]).length}</Badge>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(equipment[cat.key] as Array<{ id: string; name: string; _pk?: number; cap?: number; speed?: number; type?: string; status?: string; homogenizer?: boolean; processType?: string[]; compatible?: string[]; supports?: string[] }>).map((e) => {
                const busy = isBusy(e.id);
                const activeBatches = batches.filter(b => (b.mainVessel === e.id || b.fillingLine === e.id || b.packagingLine === e.id) && !['draft', 'cleared', 'fg_ready'].includes(b.bmrStatus));
                const utilPct = Math.min(100, activeBatches.length > 0 ? Math.round((activeBatches.length / Math.max(batches.length, 1)) * 100) : 0);
                return (
                  <div key={e.id} className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${busy ? 'border-orange-200' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className={`text-sm font-bold font-mono ${cat.color}`}>{e.id}</div>
                        <div className="text-xs text-gray-600 font-medium">{e.name}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {e.status === 'maintenance' && <Badge className="bg-amber-100 text-amber-700">MAINTENANCE</Badge>}
                        {e.status !== 'maintenance' && <Badge className={busy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}>{busy ? 'IN USE' : 'IDLE'}</Badge>}
                      </div>
                    </div>
                    {busy && activeBatches.length > 0 && (
                      <div className="text-[10px] text-orange-600 mb-1.5 flex items-center gap-1"><Activity size={10} /> Running: {activeBatches.map(b => b.bmrNo).join(', ')}</div>
                    )}
                    {e.cap != null && <div className="text-[11px] text-gray-500">Capacity: <b className="text-gray-800">{e.cap}L</b></div>}
                    {e.speed != null && <div className="text-[11px] text-gray-500">Speed: <b className="text-gray-800">{fmt(e.speed)}/hr</b></div>}
                    {e.type && <div className="text-[11px] text-gray-500">Type: <b className="text-gray-800">{(e.type as string).toUpperCase()}</b></div>}
                    {e.homogenizer !== undefined && cat.key === 'manufacturing' && <div className="text-[11px] text-gray-500 inline-flex items-center gap-0.5">Homogenizer: <b className={e.homogenizer ? 'text-emerald-600 inline-flex items-center gap-0.5' : 'text-gray-400'}>{e.homogenizer ? <><Check size={11} /> Yes</> : 'No'}</b></div>}
                    {e.processType && e.processType.length > 0 && <div className="text-[11px] text-gray-500">Process: <b>{(e.processType as string[]).join(', ').toUpperCase()}</b></div>}
                    {e.compatible && e.compatible.length > 0 && <div className="text-[11px] text-gray-500">Compatible: <b>{(e.compatible as string[]).join(', ')}</b></div>}
                    {e.supports && e.supports.length > 0 && <div className="text-[11px] text-gray-500">Supports: <b>{(e.supports as string[]).join(', ')}</b></div>}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Utilization</span><span>{utilPct}%</span></div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${utilPct > 50 ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: `${utilPct}%` }} /></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(cat.key, e)} className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors"><Pencil size={10} /> Edit</button>
                      <button onClick={() => handleRemove(cat.key, e.id)} disabled={busy}
                        className={`inline-flex items-center gap-0.5 px-2 py-1 text-[10px] border rounded-lg transition-colors ${busy ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-red-500 border-red-100 hover:bg-red-50'}`}>
                        <X size={10} /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              <div onClick={() => { setAddCat(cat.key); setShowAdd(true); }} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-colors min-h-35">
                <Plus size={22} className="text-gray-300" />
                <span className="text-xs font-semibold text-gray-400">Add Equipment</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Equipment Modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add Equipment">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Category</label><select className={INP} value={addCat} onChange={e => { setAddCat(e.target.value as typeof addCat); setAddType(e.target.value === 'manufacturing' ? 'jacketed' : e.target.value === 'filling' ? 'bottle' : 'auto'); }}><option value="manufacturing">Manufacturing Vessel</option><option value="filling">Filling Line</option><option value="packaging">Packaging Line</option></select></div>
            <div><label className={LBL}>Equipment ID</label><input className={INP} value={addId} onChange={e => setAddId(e.target.value)} placeholder="e.g. MV-04" /></div>
            <div><label className={LBL}>Name</label><input className={INP} value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Manufacturing Vessel 04" /></div>
            <div><label className={LBL}>{addCat === 'manufacturing' ? 'Capacity (L)' : 'Speed (units/hr)'}</label><input className={INP} type="number" value={addCap} onChange={e => setAddCap(e.target.value)} placeholder={addCat === 'manufacturing' ? 'e.g. 500' : 'e.g. 3000'} /></div>
            <div><label className={LBL}>Type</label><select className={INP} value={addType} onChange={e => setAddType(e.target.value)}>
              {addCat === 'manufacturing' && <><option value="jacketed">Jacketed</option><option value="simple">Simple</option><option value="support">Support Tank</option></>}
              {addCat === 'filling' && <><option value="bottle">Bottle</option><option value="tube">Tube</option><option value="jar">Jar</option><option value="manual">Manual</option></>}
              {addCat === 'packaging' && <><option value="auto">Auto Pack</option><option value="semi">Semi-Auto</option><option value="shrink">Shrink Wrap</option></>}
            </select></div>
            {addCat === 'manufacturing' && (
              <>
                <div className="flex items-center gap-2">
                  <label className={LBL}>Homogenizer</label>
                  <input type="checkbox" checked={addHomogenizer} onChange={e => setAddHomogenizer(e.target.checked)} className="rounded border-gray-300" />
                </div>
                <div className="col-span-2 flex gap-3 items-center">
                  <label className={`${LBL} mb-0`}>Process Types:</label>
                  {['hot', 'cold'].map(pt => (
                    <label key={pt} className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={addProcessTypes.includes(pt)} onChange={e => setAddProcessTypes(prev => e.target.checked ? [...prev, pt] : prev.filter(p => p !== pt))} className="rounded border-gray-300" />
                      {pt.toUpperCase()}
                    </label>
                  ))}
                </div>
              </>
            )}
            {addCat === 'filling' && (
              <div className="col-span-2"><label className={LBL}>Compatible (comma-separated)</label><input className={INP} value={addCompatible} onChange={e => setAddCompatible(e.target.value)} placeholder="e.g. bottle, tube" /></div>
            )}
            {addCat === 'packaging' && (
              <div className="col-span-2"><label className={LBL}>Supports (comma-separated)</label><input className={INP} value={addSupports} onChange={e => setAddSupports(e.target.value)} placeholder="e.g. carton, label, shrink" /></div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !addId.trim() || !addName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : <><Plus size={13} /> Add</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Equipment Modal */}
      {editPk !== null && (
        <Modal onClose={() => setEditPk(null)} title="Edit Equipment">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Name</label><input className={INP} value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><label className={LBL}>{editCat === 'manufacturing' ? 'Capacity (L)' : 'Speed (units/hr)'}</label><input className={INP} type="number" value={editCap} onChange={e => setEditCap(e.target.value)} /></div>
            <div><label className={LBL}>Type</label><select className={INP} value={editType} onChange={e => setEditType(e.target.value)}>
              {editCat === 'manufacturing' && <><option value="jacketed">Jacketed</option><option value="simple">Simple</option><option value="support">Support Tank</option></>}
              {editCat === 'filling' && <><option value="bottle">Bottle</option><option value="tube">Tube</option><option value="jar">Jar</option><option value="manual">Manual</option></>}
              {editCat === 'packaging' && <><option value="auto">Auto Pack</option><option value="semi">Semi-Auto</option><option value="shrink">Shrink Wrap</option></>}
            </select></div>
            <div><label className={LBL}>Status</label><select className={INP} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              <option value="idle">Idle</option><option value="maintenance">Maintenance</option><option value="offline">Offline</option>
            </select></div>
            {editCat === 'manufacturing' && (
              <>
                <div className="flex items-center gap-2">
                  <label className={LBL}>Homogenizer</label>
                  <input type="checkbox" checked={editHomogenizer} onChange={e => setEditHomogenizer(e.target.checked)} className="rounded border-gray-300" />
                </div>
                <div className="col-span-2 flex gap-3 items-center">
                  <label className={`${LBL} mb-0`}>Process Types:</label>
                  {['hot', 'cold'].map(pt => (
                    <label key={pt} className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={editProcessTypes.includes(pt)} onChange={e => setEditProcessTypes(prev => e.target.checked ? [...prev, pt] : prev.filter(p => p !== pt))} className="rounded border-gray-300" />
                      {pt.toUpperCase()}
                    </label>
                  ))}
                </div>
              </>
            )}
            {editCat === 'filling' && (
              <div className="col-span-2"><label className={LBL}>Compatible (comma-separated)</label><input className={INP} value={editCompatible} onChange={e => setEditCompatible(e.target.value)} /></div>
            )}
            {editCat === 'packaging' && (
              <div className="col-span-2"><label className={LBL}>Supports (comma-separated)</label><input className={INP} value={editSupports} onChange={e => setEditSupports(e.target.value)} /></div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setEditPk(null)} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleEditSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : <><Check size={13} /> Save</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────── TEAM VIEW ────────────────────────────────────── */

function TeamView({ team, onUpdate, onRefresh, canEdit, departmentList }: {
  team: TeamMember[]; onUpdate: (t: TeamMember[]) => void;
  onRefresh: () => void; canEdit: boolean; departmentList: string[];
}) {
  const { addToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addDept, setAddDept] = useState<Department>('Manufacturing');
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [addRole, setAddRole] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setSelectedUser(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await apiSearchUsers(q.trim());
        const existingUserIds = new Set(team.filter(t => t.userId).map(t => t.userId));
        setSearchResults(results.filter(r => !existingUserIds.has(r.userid)));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.display_name);
    setSearchResults([]);
    setAddRole(user.role_name || '');
    if (user.department) {
      const deptMap: Record<string, Department> = {
        manufacturing: 'Manufacturing', filling: 'Filling', packaging: 'Packaging', quality: 'Quality',
      };
      const mapped = deptMap[user.department.toLowerCase()];
      if (mapped) setAddDept(mapped);
    }
  };

  const handleAdd = async () => {
    if (!selectedUser || !addRole.trim()) return;
    setSaving(true);
    try {
      const memberId = `T${String(team.length + 1).padStart(2, '0')}`;
      await apiCreateTeamMember({
        member_id: memberId,
        user_id: selectedUser.userid,
        name: selectedUser.display_name,
        role: addRole.trim(),
        department: addDept,
        available: true,
      });
      addToast('success', `${selectedUser.display_name} added to team`);
      setShowAdd(false); setSearchQuery(''); setSelectedUser(null); setAddRole('');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add team member';
      addToast('error', msg.includes('already') ? 'This user is already on the production team' : msg);
    } finally { setSaving(false); }
  };

  const toggleAvail = async (member: TeamMember) => {
    if (!canEdit) return;
    if (member._pk) {
      try {
        await apiUpdateTeamMember(member._pk, { available: !member.avail });
        onRefresh();
      } catch { addToast('error', 'Failed to update availability'); }
    } else {
      onUpdate(team.map(t => t.id === member.id ? { ...t, avail: !t.avail } : t));
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!canEdit) return;
    if (!confirm(`Remove ${member.name} from the production team?`)) return;
    if (member._pk) {
      try {
        await apiDeleteTeamMember(member._pk);
        addToast('success', `${member.name} removed`);
        onRefresh();
      } catch { addToast('error', 'Failed to remove team member'); }
    } else {
      onUpdate(team.filter(t => t.id !== member.id));
    }
  };

  const depts: { key: Department; color: string; icon: React.ReactNode }[] = [
    { key: 'Manufacturing', color: 'text-orange-600', icon: <FlaskConical size={14} /> },
    { key: 'Filling', color: 'text-purple-600', icon: <Droplets size={14} /> },
    { key: 'Packaging', color: 'text-emerald-600', icon: <Package size={14} /> },
    { key: 'Quality', color: 'text-blue-600', icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-team">
      <div className="sec-hdr flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Team Management</div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><RotateCcw size={12} /> Refresh</button>
          {canEdit && (
            <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Member</button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6" id="team-content">
        {depts.map(dept => {
          const members = team.filter(t => t.dept === dept.key);
          return (
            <div key={dept.key} className="mb-8">
              <h3 className={`flex items-center gap-2 text-sm font-bold ${dept.color} uppercase tracking-wide mb-3`}>
                {dept.icon}{dept.key}
                <Badge className="bg-gray-100 text-gray-500 ml-1">{members.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map(t => (
                  <div key={t.id} className={`bg-white rounded-xl border p-3.5 flex items-start gap-3 transition-shadow hover:shadow-md ${t.avail ? 'border-gray-100' : 'border-red-100'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${t.avail ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                      {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800">{t.name}</div>
                      <div className="text-[10px] text-gray-500">{t.role}</div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        <Badge className={t.avail ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}>{t.avail ? 'Available' : 'Unavailable'}</Badge>
                        <Badge className="bg-gray-100 text-gray-500">{t.id}</Badge>
                        {t.userId && <Badge className="bg-blue-50 text-blue-500">Linked</Badge>}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 mt-2.5">
                          <button onClick={() => toggleAvail(t)} className="text-[10px] px-2 py-0.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">{t.avail ? 'Set Unavail' : 'Set Avail'}</button>
                          <button onClick={() => removeMember(t)} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"><X size={10} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {canEdit && (
                  <div onClick={() => { setAddDept(dept.key); setShowAdd(true); }} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-colors min-h-25">
                    <Plus size={20} className="text-gray-300" />
                    <span className="text-xs font-semibold text-gray-400">Add to {dept.key}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setSearchQuery(''); setSelectedUser(null); setSearchResults([]); }} title="Add Team Member">
          <Tip color="blue" icon={<Info size={14} />}>
            Search for a registered user by name. The person must already exist in <b>User Management</b> before they can be added to the production team.
          </Tip>

          {/* User search autocomplete */}
          <div className="relative mb-4">
            <label className={LBL}>Search User by Name</label>
            <input className={INP} value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
              placeholder="Start typing a name..." autoFocus />
            {searching && <div className="absolute right-3 top-8 text-[10px] text-gray-400">Searching...</div>}
            {searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto">
                {searchResults.map(u => (
                  <button key={u.userid} onClick={() => handleSelectUser(u)}
                    className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0">
                    <div className="text-xs font-semibold text-gray-800">{u.display_name}</div>
                    <div className="text-[10px] text-gray-400">{u.email}{u.department ? ` · ${u.department}` : ''}{u.role_name ? ` · ${u.role_name}` : ''}</div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && !selectedUser && (
              <div className="text-[10px] text-gray-400 mt-1">No matching registered users found. Add them in User Management first.</div>
            )}
          </div>

          {/* Auto-filled fields (read-only except role/dept) */}
          {selectedUser && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">User selected: {selectedUser.display_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LBL}>Employee ID</label><input value={`EMP-${selectedUser.userid}`} readOnly className="bg-gray-50 cursor-not-allowed border border-gray-200 rounded-lg px-3 py-2 text-xs w-full" /></div>
                <div><label className={LBL}>Email</label><input value={selectedUser.email} readOnly className="bg-gray-50 cursor-not-allowed border border-gray-200 rounded-lg px-3 py-2 text-xs w-full" /></div>
                <div><label className={LBL}>Role / Position</label><input className={INP} value={addRole} onChange={e => setAddRole(e.target.value)} placeholder="e.g. Production Executive" /></div>
                <div><label className={LBL}>Department</label><select className={INP} value={addDept} onChange={e => setAddDept(e.target.value as Department)}>{departmentList.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => { setShowAdd(false); setSearchQuery(''); setSelectedUser(null); setSearchResults([]); }} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !selectedUser || !addRole.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50">
              {saving ? 'Adding...' : <><Plus size={13} /> Add Member</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────── SIDEBAR & HEADER ─────────────────────────────── */

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'calendar', label: 'Production Calendar', icon: <Calendar size={15} /> },
  { id: 'bmr', label: 'BMR - Manufacturing', icon: <FlaskConical size={15} /> },
  { id: 'bpr', label: 'BPR - Filling & Packing', icon: <Package size={15} /> },
  { id: 'yield-report', label: 'Yield Report', icon: <Activity size={15} /> },
  { id: 'transfers', label: 'Transfer orders', icon: <Truck size={15} /> },
  { id: 'equipment', label: 'Equipment & Capacity', icon: <Wrench size={15} /> },
  { id: 'team', label: 'Team Management', icon: <Users size={15} /> },
];

function ProductionSidebar({ active, onChange, mobileOpen, onMobileClose }: {
  active: Section; onChange: (s: Section) => void; mobileOpen: boolean; onMobileClose: () => void;
}) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={onMobileClose} />}
      <aside className={`fixed top-0 left-0 h-full z-40 w-48 bg-white border-r border-gray-100 shadow-sm flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:translate-x-0 md:flex md:shrink-0`}>
        <div className="px-4 pt-5 pb-4 border-b border-gray-50">
          <img src={eiLogo} alt="EI Logo" className="h-7 w-auto object-contain object-left" />
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => { onChange(item.id); onMobileClose(); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[11px] font-medium transition-all duration-150 ${active === item.id ? 'bg-orange-50 text-orange-600 border-l-2 border-orange-500 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-l-2 border-transparent'}`}>
              <span className="shrink-0">{item.icon}</span>
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

function TopHeader({ batches, onMenuClick, onSchedule }: {
  batches: Batch[]; onMenuClick: () => void; onSchedule: () => void;
}) {
  const active = batches.filter(b => b.bmrStatus === 'in_production' || b.bmrStatus === 'dispensing').length;
  const pending = batches.filter(b => b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed').length;
  const awaitingQC = batches.filter(b => b.bmrStatus === 'bulk_qc' || b.bprStatus === 'fill_qc' || b.bprStatus === 'pack_qc').length;
  const qcFailed = batches.filter(b => b.bmrStatus === 'qc_failed' || b.bprStatus === 'qc_failed').length;
  const filling = batches.filter(b => b.bprStatus === 'filling' || b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_dispensing').length;
  const fgReady = batches.filter(b => b.bprStatus === 'fg_ready').length;
  const weekLabel = formatWeekLabel(getWeekStart(new Date()));

  return (
    <header className="h-13 bg-white border-b border-gray-100 shadow-xs flex items-center px-5 gap-3 shrink-0 z-20">
      <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" onClick={onMenuClick}><Menu size={18} /></button>
      <div className="hidden md:flex items-center gap-2">
        <span className="text-[11px] text-gray-400 font-medium tracking-wide">Manufacturing Management</span>
        <Badge className="bg-gray-100 text-gray-500 border border-gray-200">{batches.length} Batches</Badge>
      </div>
      <div className="flex items-center gap-1.5 ml-3 overflow-x-auto">
        {active > 0 && <Badge className="bg-orange-50 text-orange-600 border border-orange-200">{active} Active</Badge>}
        {filling > 0 && <Badge className="bg-purple-50 text-purple-600 border border-purple-200">{filling} Filling</Badge>}
        {pending > 0 && <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{pending} Pending</Badge>}
        {awaitingQC > 0 && <Badge className="bg-sky-50 text-sky-600 border border-sky-200">{awaitingQC} QC</Badge>}
        {qcFailed > 0 && <Badge className="bg-red-50 text-red-600 border border-red-200">{qcFailed} Failed</Badge>}
        {fgReady > 0 && <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200">{fgReady} FG Ready</Badge>}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:block text-[11px] text-gray-400 font-medium">{weekLabel}</span>
        <button onClick={onSchedule} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm">
          <Plus size={14} /> Schedule
        </button>
      </div>
    </header>
  );
}

/* ──────────── MAIN PAGE COMPONENT ──────────────────────────── */

const Production = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { isAdmin, canPerformAction } = usePermissions();
  const canEditTeam = isAdmin || canPerformAction('order-management', 'production-team', 'canEdit');
  const [deptList, setDeptList] = useState<string[]>(['Manufacturing', 'Filling', 'Packaging', 'Quality']);

  const rawSection = searchParams.get('section') as Section | null;
  const activeSection: Section = rawSection && NAV_ITEMS.some(n => n.id === rawSection) ? rawSection : 'calendar';
  const weekOffset = parseInt(searchParams.get('week') ?? '0', 10) || 0;

  const setSection = useCallback((s: Section) => {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('section', s); return p; });
  }, [setSearchParams]);
  const setWeekOffset = useCallback((n: number) => {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('week', String(n)); return p; });
  }, [setSearchParams]);

  const [state, setState] = useState<ProductionState>(defaultState);
  const [whInventory, setWhInventory] = useState<WarehouseInventoryRow[]>([]);
  const [outboundMrns, setOutboundMrns] = useState<MRNRecordFromApi[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [modalBatch, setModalBatch] = useState<Batch | null>(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<ScheduleSlot | null>(null);
  const [pendingMtrItems, setPendingMtrItems] = useState<DispensingItem[] | null>(null);
  const [sentSummary, setSentSummary] = useState<SentBatchSummaryRow[]>([]);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [createBatchPreset, setCreateBatchPreset] = useState<{ soNo: string; bmrNo: string } | null>(null);
  const [yieldReworkPreflightBatch, setYieldReworkPreflightBatch] = useState<Batch | null>(null);
  const loadedFromApi = useRef(false);

  const whStockRM = useMemo(() => buildStockMap(whInventory, 'RM'), [whInventory]);
  const whStockPM = useMemo(() => buildStockMap(whInventory, 'PM'), [whInventory]);
  const whReservedRM = useMemo(() => buildReservedMap(whInventory, 'RM'), [whInventory]);
  const whReservedPM = useMemo(() => buildReservedMap(whInventory, 'PM'), [whInventory]);
  const atFacilityRM = useMemo(() => buildAtFacilityMap(whInventory, 'RM'), [whInventory]);
  const atFacilityPM = useMemo(() => buildAtFacilityMap(whInventory, 'PM'), [whInventory]);
  const whStockOnlyRM = useMemo(() => buildWhStockOnlyMap(whInventory, 'RM'), [whInventory]);
  const whStockOnlyPM = useMemo(() => buildWhStockOnlyMap(whInventory, 'PM'), [whInventory]);

  useEffect(() => {
    if (!debugProductionReserveEnabled()) return;
    const rmRows = whInventory.filter((r) => r.type === 'RM');
    const byCode = new Map<string, { rowIds: string[]; perRowSih: number[]; summedSih: number }>();
    for (const r of rmRows) {
      const c = String(r.code ?? '').trim();
      if (!c) continue;
      const sih = Number(r.stockInHand) || 0;
      const prev = byCode.get(c);
      if (!prev) byCode.set(c, { rowIds: [r.id], perRowSih: [sih], summedSih: sih });
      else {
        prev.rowIds.push(r.id);
        prev.perRowSih.push(sih);
        prev.summedSih += sih;
      }
    }
    const duplicateCodes = [...byCode.entries()].filter(([, v]) => v.rowIds.length > 1);
    logProductionReserve('Page load / whInventory: RM rows from API', {
      totalInventoryRows: whInventory.length,
      rmRowCount: rmRows.length,
      distinctTrimmedRMCodes: byCode.size,
      duplicateWarehouseRowsSameCode: duplicateCodes.slice(0, 20),
      note:
        duplicateCodes.length > 0
          ? 'Multiple warehouse_inventory rows share one RM code; stock maps now SUM SIH/reserved/wh/ml per code.'
          : 'One row per code (or no duplicates) — map sum matches single-row SIH.',
    });
  }, [whInventory]);

  useEffect(() => {
    if (loadedFromApi.current) return;
    loadedFromApi.current = true;
    syncBatchesFromPlanning()
      .catch(() => { /* ignore sync errors; still load batches */ })
      .then(() => Promise.all([
        fetchBatches(),
        fetchEquipment(),
        fetchTeam(),
        fetchWarehouseInventory(),
        fetchDepartments(),
        fetchSentBatchSummary(),
        fetchMRNList({ transferType: 'outbound' }),
      ]))
      .then(([batchRows, equipData, teamRows, invResult, deptRows, sent, outboundList]) => {
        const batches = batchRows.length ? batchRows.map(apiBatchToBatch) : [];
        const equipment = apiEquipToEquipData(equipData);
        const team = teamRows.length ? apiTeamToTeam(teamRows) : DEFAULT_TEAM;
        setState({ batches, equipment, team, lastUpdated: new Date().toISOString() });
        if (invResult.success && invResult.data.rows.length) setWhInventory(invResult.data.rows);
        if (deptRows.length) setDeptList(deptRows.filter(d => d.is_active).map(d => d.name).sort());
        setSentSummary(Array.isArray(sent) ? sent : []);
        setOutboundMrns(Array.isArray(outboundList) ? outboundList : []);
      })
      .catch(() => {
        setState(defaultState());
      });
  }, []);

  const refreshEquipment = useCallback(() => {
    fetchEquipment()
      .then(equipData => {
        setState(prev => ({ ...prev, equipment: apiEquipToEquipData(equipData), lastUpdated: new Date().toISOString() }));
      })
      .catch(() => { });
  }, []);

  const refreshTeam = useCallback(() => {
    fetchTeam()
      .then(teamData => {
        setState(prev => ({ ...prev, team: apiTeamToTeam(teamData), lastUpdated: new Date().toISOString() }));
      })
      .catch(() => { });
  }, []);

  const refreshBatches = useCallback(() => {
    fetchBatches()
      .then(rows => {
        const batches = rows.length ? rows.map(apiBatchToBatch) : [];
        setState(prev => ({ ...prev, batches, lastUpdated: new Date().toISOString() }));
      })
      .catch(() => { });
  }, []);

  const refreshOutboundMrns = useCallback(() => {
    fetchMRNList({ transferType: 'outbound' })
      .then((list) => setOutboundMrns(Array.isArray(list) ? list : []))
      .catch(() => { });
  }, []);

  /** After any MRN save from Transfer orders — keep BMR/BPR chips and batch state in sync with WH. */
  const refreshAfterMrnSave = useCallback(() => {
    refreshOutboundMrns();
    refreshBatches();
    fetchWarehouseInventory()
      .then((invResult) => {
        if (invResult?.success && invResult?.data?.rows?.length) setWhInventory(invResult.data.rows);
      })
      .catch(() => { /* non-fatal */ });
  }, [refreshOutboundMrns, refreshBatches]);

  const syncProductionAfterMrn = useCallback(() => {
    refreshBatches();
    refreshOutboundMrns();
    fetchWarehouseInventory()
      .then((invResult) => {
        if (invResult?.success && invResult?.data?.rows?.length) setWhInventory(invResult.data.rows);
      })
      .catch(() => { /* non-fatal */ });
  }, [refreshBatches, refreshOutboundMrns]);

  const DISPENDING_MU_ERR_TAG = '[dispending-mu-error]';

  const updateBatch = useCallback((bmrNo: string, updates: Partial<Batch>) => {
    const batch = state.batches.find(b => b.bmrNo === bmrNo) as (Batch & { _pk?: number }) | undefined;
    const touchesDispensing =
      updates.dispensingRM !== undefined || updates.dispensingPM !== undefined;
    if (touchesDispensing) {
      console.log(DISPENDING_MU_ERR_TAG, 'updateBatch: client about to PATCH', {
        bmrNo,
        batchPk: batch?._pk ?? null,
        hasPk: !!batch?._pk,
        updateKeys: Object.keys(updates),
        dispensingRM: Array.isArray(updates.dispensingRM)
          ? updates.dispensingRM.map((l) => ({ code: l.code, dispensed: l.dispensed, required: l.required, done: l.done }))
          : undefined,
        dispensingPM: Array.isArray(updates.dispensingPM)
          ? updates.dispensingPM.map((l) => ({ code: l.code, dispensed: l.dispensed, required: l.required, done: l.done }))
          : undefined,
      });
      if (!batch?._pk) {
        console.warn(DISPENDING_MU_ERR_TAG, 'updateBatch: NO batch._pk — PATCH will not run; MU stock will not update', { bmrNo });
      }
    }
    if (batch?._pk) {
      const rmCodes = Array.isArray(updates.dispensingRM) ? updates.dispensingRM.map((l) => l.code) : [];
      const pmCodes = Array.isArray(updates.dispensingPM) ? updates.dispensingPM.map((l) => l.code) : [];
      apiBatchUpdate(batch._pk, updates)
        .then((patched: any) => {
          const row = patched as BatchRow;
          if (row?.bmrNo) {
            setState((prev) => ({
              ...prev,
              batches: prev.batches.map((b) => (b.bmrNo === bmrNo ? apiBatchToBatch(row) : b)),
              lastUpdated: new Date().toISOString(),
            }));
          }
          if (touchesDispensing) {
            console.log(DISPENDING_MU_ERR_TAG, 'updateBatch: PATCH success', {
              batchPk: batch._pk,
              bmrNo,
              bmrStatus: patched?.bmrStatus ?? patched?.bmr_status,
              bprStatus: patched?.bprStatus ?? patched?.bpr_status,
              dispensingRMReturned: Array.isArray(patched?.dispensingRM)
                ? patched.dispensingRM.map((l: { code?: string; dispensed?: number }) => ({ code: l?.code, dispensed: l?.dispensed }))
                : Array.isArray(patched?.dispensing_rm)
                  ? patched.dispensing_rm.map((l: { code?: string; dispensed?: number }) => ({ code: l?.code, dispensed: l?.dispensed }))
                  : null,
            });
            // Log what backend returns and where inventory ended up.
            console.log('[DISPENSING-TRACE] Frontend: PATCH /production/batches success', {
              batchId: batch._pk,
              bmrNo,
              bmrStatus: patched?.bmrStatus ?? patched?.bmr_status,
              bprStatus: patched?.bprStatus ?? patched?.bpr_status,
              dispensingRM: Array.isArray(patched?.dispensingRM)
                ? patched.dispensingRM.slice(0, 5)
                : Array.isArray(patched?.dispensing_rm)
                  ? patched.dispensing_rm.slice(0, 5)
                  : undefined,
              dispensingPM: Array.isArray(patched?.dispensingPM)
                ? patched.dispensingPM.slice(0, 5)
                : Array.isArray(patched?.dispensing_pm)
                  ? patched.dispensing_pm.slice(0, 5)
                  : undefined,
              rmCodes,
              pmCodes,
              payload: {
                dispensingRM_count: Array.isArray(updates.dispensingRM) ? updates.dispensingRM.length : 0,
                dispensingPM_count: Array.isArray(updates.dispensingPM) ? updates.dispensingPM.length : 0,
              },
            });

            return fetchWarehouseInventory().then((invResult) => {
              if (invResult.success && invResult.data?.rows?.length) {
                setWhInventory(invResult.data.rows);
                const matches = invResult.data.rows.filter((r: WarehouseInventoryRow) => (
                  (r.type === 'RM' && rmCodes.includes(r.code)) || (r.type === 'PM' && pmCodes.includes(r.code))
                ));
                console.log(DISPENDING_MU_ERR_TAG, 'updateBatch: after GET warehouse-inventory', {
                  rowCount: invResult.data.rows.length,
                  rmCodes,
                  pmCodes,
                  matchCount: matches.length,
                  matches: matches.map((r: WarehouseInventoryRow) => ({
                    type: r.type,
                    code: r.code,
                    whStock: r.whStock,
                    ml1Stock: r.ml1Stock,
                    ml2Stock: r.ml2Stock,
                    stockInHand: r.stockInHand,
                    reserved: r.reserved,
                  })),
                });
                if ((rmCodes.length > 0 || pmCodes.length > 0) && matches.length === 0) {
                  console.warn(DISPENDING_MU_ERR_TAG, 'updateBatch: no inventory rows matched dispensing codes — check code strings vs warehouse list', {
                    rmCodes,
                    pmCodes,
                  });
                }
                console.log('[DISPENSING-TRACE] Frontend: after refetch warehouse-inventory (dispensing)', {
                  matches: matches.map((r: WarehouseInventoryRow) => ({
                    type: r.type,
                    code: r.code,
                    whStock: r.whStock,
                    ml1Stock: r.ml1Stock,
                    ml2Stock: r.ml2Stock,
                    stockInHand: r.stockInHand,
                    reserved: r.reserved,
                    inTransit: r.inTransit,
                  })),
                });
              } else if (touchesDispensing) {
                console.warn(DISPENDING_MU_ERR_TAG, 'updateBatch: warehouse-inventory refetch failed or empty', {
                  success: invResult.success,
                  error: invResult.error,
                });
              }
            });
          }
        })
        .catch((err) => {
          if (touchesDispensing) {
            console.warn(DISPENDING_MU_ERR_TAG, 'updateBatch: PATCH failed', err);
          }
          const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: unknown }).body : undefined;
          const apiMsg =
            body && typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error: unknown }).error === 'string'
              ? (body as { error: string }).error
              : null;
          addToast('error', apiMsg || (err instanceof Error ? err.message : 'Failed to save batch'));
          refreshBatches();
        });
    } else {
      setState((prev) => ({ ...prev, batches: prev.batches.map((b) => (b.bmrNo === bmrNo ? { ...b, ...updates } : b)) }));
    }
  }, [state.batches, addToast, refreshBatches]);

  const openScheduleWizard = useCallback((slot?: ScheduleSlot) => {
    setScheduleSlot(slot ?? null);
    setModalBatch(null);
    setModalType('schedule');
  }, []);

  const handleAction = useCallback((action: string, batch: Batch) => {
    setModalBatch(batch); setModalType(action);
  }, []);

  const handleModalSave = useCallback((updates: Partial<Batch>) => {
    if (!modalBatch) return;
    if (modalType === 'dispenseRM' || modalType === 'dispensePM') {
      const pk = (modalBatch as Batch & { _pk?: number })?._pk;
      console.log('[dispending-mu-error]', 'handleModalSave: dispensing submit', {
        modalType,
        bmrNo: modalBatch.bmrNo,
        batchPk: pk ?? null,
        bprNo: modalBatch.bprNo,
        dispensingRM: Array.isArray(updates.dispensingRM) ? updates.dispensingRM.map((l) => ({ code: l.code, required: l.required, dispensed: l.dispensed, done: l.done })) : undefined,
        dispensingPM: Array.isArray(updates.dispensingPM) ? updates.dispensingPM.map((l) => ({ code: l.code, required: l.required, dispensed: l.dispensed, done: l.done })) : undefined,
      });
      console.log('[DISPENSING-TRACE] Frontend: submitting dispensing save', {
        modalType,
        bmrNo: modalBatch.bmrNo,
        bprNo: modalBatch.bprNo,
        dispensingRM: Array.isArray(updates.dispensingRM) ? updates.dispensingRM.map((l) => ({ code: l.code, required: l.required, dispensed: l.dispensed, done: l.done })) : undefined,
        dispensingPM: Array.isArray(updates.dispensingPM) ? updates.dispensingPM.map((l) => ({ code: l.code, required: l.required, dispensed: l.dispensed, done: l.done })) : undefined,
      });
    }
    if (modalType === 'reserveRM' || modalType === 'reservePM') {
      console.log('[RESERVE-DEBUG] Frontend: Reserve save', {
        type: modalType,
        bmrNo: modalBatch.bmrNo,
        updates: {
          rmReserved: updates.rmReserved,
          pmReserved: updates.pmReserved,
          bmrStatus: updates.bmrStatus,
          bprStatus: updates.bprStatus,
          dispensingRM_count: updates.dispensingRM?.length,
          dispensingPM_count: updates.dispensingPM?.length,
          dispensingRM_requireds: updates.dispensingRM?.map((r) => ({ code: r.code, required: r.required })),
          dispensingPM_requireds: updates.dispensingPM?.map((p) => ({ code: p.code, required: p.required })),
        },
      });
      console.log('[RESERVE-DEBUG] Frontend: PATCH /batches (then refetch warehouse-inventory). Available = SIH - reserved; after reserve: reserved_new = R + X, available_new = SIH - reserved_new.');
    }
    updateBatch(modalBatch.bmrNo, updates);
    if (modalType === 'confirm' || modalType === 'adjustBatch') {
      queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
    }
    // Dispensing: warehouse refetch runs after PATCH succeeds inside updateBatch (ML1/ML2 delta applied on server).
    if (modalType === 'reserveRM' || modalType === 'reservePM' || modalType === 'mtrRM' || modalType === 'mtrPM' || modalType === 'qcPack') {
      fetchWarehouseInventory().then((invResult) => {
        if (invResult.success && invResult.data?.rows?.length) {
          setWhInventory(invResult.data.rows);
          const rows = invResult.data.rows as WarehouseInventoryRow[];
          console.log('[RESERVE-DEBUG] Frontend: After refetch warehouse-inventory', {
            rowCount: rows.length,
            sampleRM: rows.filter((r) => r.type === 'RM').slice(0, 3).map((r) => ({ code: r.code, SIH: r.stockInHand, reserved: r.reserved, available: Math.max(0, (r.stockInHand ?? 0) - (r.reserved ?? 0)) })),
            samplePM: rows.filter((r) => r.type === 'PM').slice(0, 2).map((r) => ({ code: r.code, SIH: r.stockInHand, reserved: r.reserved, available: Math.max(0, (r.stockInHand ?? 0) - (r.reserved ?? 0)) })),
          });
        }
      });
    }
    const msg = modalType === 'confirm' ? `${modalBatch.bmrNo} confirmed`
      : modalType === 'adjustBatch' ? `${modalBatch.bmrNo} batch size updated`
        : modalType === 'reserveRM' ? `RM Reserved for ${modalBatch.bmrNo}`
          : modalType === 'reservePM' ? `PM Reserved for ${modalBatch.bprNo}`
            : modalType === 'schedule' ? `${modalBatch.bmrNo} scheduled`
              : modalType === 'dispenseRM' || modalType === 'dispensePM' ? 'Dispensing updated'
                : modalType === 'qcBMR' || modalType === 'qcFill' || modalType === 'qcPack' ? 'QC review saved'
                  : modalType === 'mtrRM' || modalType === 'mtrPM' ? 'MTR sent'
                    : 'Batch updated';
    addToast('success', msg);
  }, [modalBatch, modalType, updateBatch, addToast, queryClient]);

  const closeModal = useCallback(() => { setModalBatch(null); setModalType(null); setScheduleSlot(null); setPendingMtrItems(null); }, []);

  const schedulableForManual = useMemo(() => state.batches.filter(b =>
    !b.mfgDate && (b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved')
  ), [state.batches]);

  const handleManualSchedule = useCallback((batch: Batch, updates: Partial<Batch>) => {
    updateBatch(batch.bmrNo, updates);
    addToast('success', `${batch.bmrNo} scheduled`);
    if (updates.mfgDate) setWeekOffset(getWeekOffsetForDate(updates.mfgDate));
  }, [updateBatch, addToast, setWeekOffset]);

  function renderContent() {
    switch (activeSection) {
      case 'calendar':
        return (
          <CalendarView
            batches={state.batches}
            equipment={state.equipment}
            onBatchClick={b => handleAction('detail', b)}
            onSchedule={openScheduleWizard}
            weekOffset={weekOffset}
            onWeekOffsetChange={setWeekOffset}
            schedulableBatches={schedulableForManual}
            onManualSchedule={handleManualSchedule}
          />
        );
      case 'bmr':
        return <BMRView batches={state.batches} outboundMrns={outboundMrns} onAction={handleAction} onCreateBatch={() => { setCreateBatchPreset(null); setShowCreateBatchModal(true); }} onExportBMR={() => addToast('info', 'Export BMR coming soon')} />;
      case 'bpr':
        return <BPRView batches={state.batches} outboundMrns={outboundMrns} onAction={handleAction} onExportBPR={() => addToast('info', 'Export BPR coming soon')} />;
      case 'yield-report':
        return (
          <YieldReportView
            batches={state.batches}
            onRequestReworkPreflight={(b) => setYieldReworkPreflightBatch(b)}
          />
        );
      case 'transfers':
        return <TransferOrdersView onOutboundMtrCompleted={syncProductionAfterMrn} onMrnListChanged={refreshAfterMrnSave} />;
      case 'equipment':
        return <EquipmentView equipment={state.equipment} batches={state.batches} onUpdate={eq => setState(prev => ({ ...prev, equipment: eq }))} onRefresh={refreshEquipment} />;
      case 'team':
        return <TeamView team={state.team} onUpdate={t => setState(prev => ({ ...prev, team: t }))} onRefresh={refreshTeam} canEdit={canEditTeam} departmentList={deptList} />;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <TopHeader batches={state.batches} onMenuClick={() => setMobileSidebarOpen(true)} onSchedule={openScheduleWizard} />
      <div className="flex flex-1 overflow-hidden">
        <ProductionSidebar active={activeSection} onChange={setSection} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
        <main className="flex-1 overflow-hidden flex flex-col bg-white">{renderContent()}</main>
      </div>

      {/* MODALS */}
      {modalBatch && modalType === 'confirm' && (
        <ConfirmBatchModal batch={modalBatch} equipment={state.equipment} team={state.team} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'adjustBatch' && (
        <AdjustBatchSizeModal batch={modalBatch} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'reserveRM' && (
        <ReserveMaterialModal
          batch={modalBatch}
          type="rm"
          stockMap={whStockRM}
          reservedMap={whReservedRM}
          inventoryRows={whInventory}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && modalType === 'reservePM' && (
        <ReserveMaterialModal
          batch={modalBatch}
          type="pm"
          stockMap={whStockPM}
          reservedMap={whReservedPM}
          inventoryRows={whInventory}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalType === 'schedule' && scheduleSlot && (
        <SmartScheduleModal slot={scheduleSlot} batch={modalBatch} equipment={state.equipment} batches={state.batches}
          stockRM={whStockRM} stockPM={whStockPM} sentSummary={sentSummary}
          onClose={closeModal}
          onSave={updates => {
            handleModalSave(updates);
            closeModal();
            if (updates.mfgDate && activeSection === 'calendar') {
              const offset = getWeekOffsetForDate(updates.mfgDate);
              setWeekOffset(offset);
            }
          }}
          onBatchChange={bmrNo => { const b = state.batches.find(x => x.bmrNo === bmrNo); if (b) setModalBatch(b); }} />
      )}
      {yieldReworkPreflightBatch && (
        <YieldReworkPreflightModal
          batch={yieldReworkPreflightBatch}
          onClose={() => setYieldReworkPreflightBatch(null)}
          onContinue={() => {
            const b = yieldReworkPreflightBatch;
            setCreateBatchPreset({ soNo: b.soNo, bmrNo: b.bmrNo });
            setYieldReworkPreflightBatch(null);
            setShowCreateBatchModal(true);
          }}
        />
      )}
      {showCreateBatchModal && (
        <CreateNewBatchModal
          batches={state.batches}
          preset={createBatchPreset}
          onClose={() => { setShowCreateBatchModal(false); setCreateBatchPreset(null); }}
          onSuccess={(created) => {
            refreshBatches();
            queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
            if (created?.bmrNo) {
              setSection('bmr');
              setTimeout(() => {
                const createdBatch = state.batches.find((b) => b.bmrNo === created.bmrNo) ?? apiBatchToBatch(created);
                setModalBatch(createdBatch);
                setModalType('detail');
              }, 350);
            }
          }}
          createRworkBatch={apiCreateRworkBatch}
          addToast={addToast}
        />
      )}
      {modalType === 'schedule' && !scheduleSlot && (
        <ScheduleModal batch={modalBatch} equipment={state.equipment} batches={state.batches}
          stockRM={whStockRM} stockPM={whStockPM} sentSummary={sentSummary}
          onClose={closeModal}
          onSave={updates => {
            handleModalSave(updates);
            closeModal();
            if (updates.mfgDate && activeSection === 'calendar') {
              const offset = getWeekOffsetForDate(updates.mfgDate);
              setWeekOffset(offset);
            }
          }}
          onBatchChange={bmrNo => { const b = state.batches.find(x => x.bmrNo === bmrNo); if (b) setModalBatch(b); }} />
      )}
      {modalBatch && modalType === 'dispenseRM' && (
        <DispensingModal
          batch={modalBatch}
          type="rm"
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
          onReschedule={canShowRescheduleFooterButton(modalBatch) ? () => { setScheduleSlot(null); setModalType('schedule'); } : undefined}
        />
      )}
      {modalBatch && modalType === 'dispensePM' && (
        <DispensingModal
          batch={modalBatch}
          type="pm"
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
          onReschedule={canShowRescheduleFooterButton(modalBatch) ? () => { setScheduleSlot(null); setModalType('schedule'); } : undefined}
        />
      )}
      {modalBatch && modalType === 'qcBMR' && (
        <QCModal
          key={`qc-${(modalBatch as Batch & { _pk?: number })._pk ?? modalBatch.bmrNo}-qcBMR`}
          batch={modalBatch}
          qcType="bmr"
          team={state.team}
          batchPk={(modalBatch as Batch & { _pk?: number })._pk}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && modalType === 'qcFill' && (
        <QCModal
          key={`qc-${(modalBatch as Batch & { _pk?: number })._pk ?? modalBatch.bmrNo}-qcFill`}
          batch={modalBatch}
          qcType="fill"
          team={state.team}
          batchPk={(modalBatch as Batch & { _pk?: number })._pk}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && modalType === 'qcPack' && (
        <QCModal
          key={`qc-${(modalBatch as Batch & { _pk?: number })._pk ?? modalBatch.bmrNo}-qcPack`}
          batch={modalBatch}
          qcType="pack"
          team={state.team}
          batchPk={(modalBatch as Batch & { _pk?: number })._pk}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && (modalType === 'mtrRM' || modalType === 'mtrPM') && (
        <MTRModal
          batch={modalBatch}
          type={modalType === 'mtrRM' ? 'rm' : 'pm'}
          stockRM={whStockRM}
          stockPM={whStockPM}
          atFacilityRM={atFacilityRM}
          atFacilityPM={atFacilityPM}
          whStockOnlyRM={whStockOnlyRM}
          whStockOnlyPM={whStockOnlyPM}
          reservedRM={whReservedRM}
          reservedPM={whReservedPM}
          initialRmItems={modalType === 'mtrRM' ? pendingMtrItems : undefined}
          onClose={closeModal}
          onSave={updates => { handleModalSave(updates); closeModal(); }}
          onMtrCreated={refreshOutboundMrns}
        />
      )}
      {modalBatch && modalType === 'detail' && (
        <BatchDetailModal batch={modalBatch} team={state.team} stockRM={whStockRM} stockPM={whStockPM} reservedRM={whReservedRM} reservedPM={whReservedPM} outboundMrns={outboundMrns} onClose={closeModal}
          onSave={updates => { handleModalSave(updates); }}
          onAction={(action, batch, extra) => { closeModal(); if (extra?.mtrRmItems) setPendingMtrItems(extra.mtrRmItems); else if (extra?.mtrPmItems) setPendingMtrItems(extra.mtrPmItems); else setPendingMtrItems(null); setTimeout(() => handleAction(action, batch), 100); }}
          initialTab={activeSection === 'bpr' ? 'bpr' : 'bmr'} />
      )}
    </div>
  );
};

export default Production;
