/**
 * Production Page — Manufacturing Management System
 * BMR: draft (schedule: mfg date + MU site) > confirm on mfg date > batch_confirmed > rm_reserved > scheduled > rm_connected > …
 * BPR: draft > pm_reserved > pm_connected > pm_dispensing > scheduled > filling > fill_qc > packaging > pack_qc > fg_ready
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { NavSidebar } from '../components/ui/NavSidebar';
import {
  Plus, Calendar, FlaskConical, Package,
  Wrench, Users, Menu, X, Check, AlertTriangle, Printer,
  ClipboardList, Link2, Scale, Microscope, Zap, Info, Factory,
  Settings, Activity, Eye, CheckCircle2, ArrowRight, Send,
  ShieldCheck, Sparkles, Droplets, CircleDot, Layers, Cylinder, Pencil, RotateCcw,
  Truck, Search, Loader2, MapPin, Download,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import AdminMainMenuButton from '../components/AdminMainMenuButton';
import { ModalOverlay } from '../components/ui/ModalOverlay';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RecordDetailModal } from '../components/ui/RecordDetailModal';
import {
  fetchEquipment, fetchTeam, fetchBatches, fetchBatchMtrReserved, syncBatchesFromPlanning,
  fetchProductionReservedItems, reserveProductionBatchLines, unreserveProductionBatchLines,
  // TEMPORARY dev tooling — remove with src/production/devDispensingSeed.js.
  devSeedDispensingTray,
  updateBatch as apiBatchUpdate,
  createRworkBatch as apiCreateRworkBatch,
  splitBatchForVessel as apiSplitBatchForVessel,
  createEquipment as apiCreateEquipment,
  updateEquipment as apiUpdateEquipment,
  deleteEquipment as apiDeleteEquipment,
  type EquipmentData as APIEquipmentData, type BatchRow, type TeamMemberRow,
  type CreateReworkOptions,
  type QcReferencePayload,
  type QCSpec,
  type QcSpecsStored,
  type QcSpecsByScope,
  type BatchBOMResponse,
} from '../services/production.service';
import {
  fetchFacilityAreas,
  ensureCustomZoneAndRack,
  type FacilityAreaDTO,
  type ZoneDTO,
} from '../services/facilityAreas.service';
import { fetchWarehouseInventory, type WarehouseInventoryRow } from '../services/warehouseInventory.service';
import {
  calcShortageQtyForKind,
  formatQtyExact,
  formatQtyShortage,
  formatQtyWithUnit,
  isQtyShort,
  normalizeQtyForCompare,
  roundMaterialQty,
  qtyAvailable,
  qtyMtrFromReserved,
  scaleQty,
} from '../utils/formatQty';
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
  mrnSourceDocFromApi,
  formatMrnDisplayDate,
  mrnDisplayPrName,
  mrnDisplayExpectedDate,
  mrnDisplayBatchNumber,
  type MRNRecordFromApi, type GeneratedMRNLabel, type MRNLocationHistoryEntry, type AssignablePicker as MRNAssignablePicker,
} from '../services/mrn.service';
import { fetchPRProducts } from '../services/productsMaster.service';
import { fetchBOMByProductId, type BOMRecord, type BOMRmLine, type BOMPmLine } from '../services/bom.service';
import { fetchBOMByBatchId, fetchBatchDispensingMuStock, fetchBatchReservationCoverage, qaApproveBatchDoc, ipqaVerifyBatch, productionConfirmBatch, type PreProductionGate } from '../services/production.service';
import BMRPrintTemplate from '../components/orders/BMRPrintTemplate';
import BPRPrintTemplate from '../components/orders/BPRPrintTemplate';
import { fetchAvailablePacks, splitPack, type WarehousePack } from '../services/warehousePacks.service';
import {
  buildDispensingPickList,
  downloadDispensingPickList,
  pickListStatusLabel,
  type PickList,
} from '../lib/dispensingPickList';
import { downloadDispensingPickListPdf } from '../lib/dispensingPickListPdf';
import { useAuth } from '../context/AuthContext';
import {
  batchHasReservedMaterial,
  batchLineFullyReserved,
  coverageSummaryLabel,
  type BatchMaterialCoverage,
  type ProductionReservedItemRow,
} from '../lib/productionBatchReserve';
import { parseQtyInputString } from '../utils/qtyInput';
import {
  capPmDispenseConsumption,
  materialQtyGte,
  materialQtyGteForDispensing,
  materialQtyLte,
  materialQtyLteForDispensing,
  materialQtyToNum,
  qtyForDispensingCompare,
  sanitizeMrnLineItemQuantity,
  toQtyString,
} from '../utils/materialQtyCompare';
import {
  addDaysToDateStr,
  isEquipmentFreeOnDate as isEquipFreeOnDateLib,
  hasBatchEquipmentReserved,
  validateScheduleEquipmentReservation,
  getCompatibleVesselIds,
  getCompatibleFillLineIds,
  getCompatiblePackLineIds,
  resolveScheduleEquipIds,
  equipmentAvailableFromDate,
  getEquipmentOccupiedOnDate,
  getEquipDisplayName,
  computeBestScheduleRecommendation,
  computeRecommendedScheduleForSlot,
  computeRmVolumeBreakdown,
  computeVolumeFromBomRmLines,
  isBatchMaterialsAvailable,
  computeBatchMaterialsAvailableBy,
  suggestedRmConnectDate,
  suggestedPmConnectDate,
  earliestMfgDateAfterRmAvailable,
  type BatchMaterialsAvailableBySummary,
  getFillLineCapacityUsedOnDate,
  getFillLineRemainingCapacity,
  getFillLineDailyCapacity,
  getPackLineCapacityUsedOnDate,
  getPackLineRemainingCapacity,
  getPackLineDailyCapacity,
  DEFAULT_WORKING_HOURS_PER_DAY,
  type ScheduleRecommendationResult,
} from '../lib/productionScheduleMath';
import {
  batchLifecycleLabel,
  canShowPackagingActions,
  countProductionStatusBuckets,
  formatUnifiedBatchLabel,
  formatUnifiedBatchLabelShort,
  getBatchLifecycleDisplayStage,
  isPackagingPhase,
  type BatchLifecycleStage,
} from '../lib/batchLifecycle';
import { ScheduleTeamAssignmentSection } from '../components/production/ScheduleTeamAssignmentSection';
import {
  scheduleTeamPayloadFromState,
  scheduleTeamStateFromBatch,
  teamMembersForDept,
  type ScheduleTeamAssignmentState,
} from '../lib/productionScheduleTeam';
import {
  batchEligibleForVesselSplit,
  proposeVesselSplitSizes,
} from '../lib/productionVesselSplit';
import { BatchesView } from '../components/production/BatchesView';
import { DispensingTrayView } from '../components/production/DispensingTrayView';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Tabs } from '../components/ui/Tabs';

/* ─────────────────────────── TYPES ─────────────────────────── */

type Section = 'calendar' | 'batches' | 'dispensing-tray' | 'material-reservation' | 'yield-report' | 'equipment' | 'team';
export type ScheduleSlot = { equipId: string; category: 'mfg' | 'fill' | 'pack'; dateIso: string };
type BMRStatus = 'draft' | 'batch_confirmed' | 'rm_reserved' | 'scheduled' | 'rm_connected' | 'dispensing' | 'in_production' | 'bulk_qc' | 'qc_failed' | 'cleared';
type BPRStatus = 'draft' | 'pm_reserved' | 'scheduled' | 'pm_connected' | 'pm_dispensing' | 'filling' | 'fill_qc' | 'packaging' | 'pack_qc' | 'qc_failed' | 'fg_ready';
type ProcessType = 'hot' | 'cold';
type FillingType = 'bottle' | 'tube' | 'jar' | 'manual';
type Department = 'Manufacturing' | 'Filling' | 'Packaging' | 'Quality';

interface DispensingItem {
  code: string;
  inci?: string;
  name?: string;
  required: number;
  dispensed: number;
  done: boolean;
  trayContainer?: string;
  traySlot?: string;
  dispensedAt?: string;
  /** RM master id (for the FEFO pick lookup). */
  rawMaterialId?: number;
  /**
   * Every rack this line was picked from. One requirement is often made up from several racks —
   * "Pick full" takes a rack's whole quantity, "Split" takes a custom amount so the rest can come
   * from another rack. The line is picked once these total the required qty.
   */
  picks?: DispensingPick[];
  // Summary of `picks` (first pack + total qty). Kept in sync so the persisted dispensing_rm JSON
  // stays readable to anything reading the original single-pick shape.
  pickedPackId?: number;
  pickedPackNo?: string;
  pickedPackQty?: number;
  pickedZone?: string;
  pickedRack?: string;
  vendorBatch?: string;
  mfgDate?: string;
  expDate?: string;
  leftoverQty?: number;
  dispensedBy?: string;
}

/** One rack's contribution to a dispensing line. */
interface DispensingPick {
  packId?: number;
  packNo: string;
  qty: number;
  zone?: string;
  rack?: string;
  vendorBatch?: string;
  mfgDate?: string;
  expDate?: string;
}

/** Picks on a line, reading legacy single-pick rows as a one-entry list. */
function linePicks(line: DispensingItem): DispensingPick[] {
  if (Array.isArray(line.picks) && line.picks.length > 0) return line.picks;
  if (line.pickedPackNo) {
    return [{
      packId: line.pickedPackId,
      packNo: line.pickedPackNo,
      qty: Number(line.pickedPackQty) || 0,
      zone: line.pickedZone,
      rack: line.pickedRack,
      vendorBatch: line.vendorBatch,
      mfgDate: line.mfgDate,
      expDate: line.expDate,
    }];
  }
  return [];
}

/** Total quantity picked for a line across every rack. */
function linePickedQty(line: DispensingItem): number {
  return linePicks(line).reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
}

/** True once the line has any pick at all (drives the PICKED / PENDING PICK chip). */
function lineIsPicked(line: DispensingItem): boolean {
  return linePicks(line).length > 0;
}

/** Collapse picks into the single-pick summary fields persisted alongside them. */
function pickSummaryFields(picks: DispensingPick[]): Partial<DispensingItem> {
  const first = picks[0];
  if (!first) {
    return {
      picks: [], pickedPackId: undefined, pickedPackNo: undefined, pickedPackQty: undefined,
      pickedZone: undefined, pickedRack: undefined, vendorBatch: undefined, mfgDate: undefined, expDate: undefined,
    };
  }
  const total = picks.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const zones = [...new Set(picks.map((p) => p.zone).filter(Boolean))].join(', ');
  const racks = [...new Set(picks.map((p) => p.rack).filter(Boolean))].join(', ');
  return {
    picks,
    pickedPackId: first.packId,
    pickedPackNo: picks.length === 1 ? first.packNo : `${first.packNo} +${picks.length - 1}`,
    pickedPackQty: total,
    pickedZone: zones,
    pickedRack: racks,
    vendorBatch: first.vendorBatch ?? '',
    mfgDate: first.mfgDate ?? '',
    expDate: first.expDate ?? '',
  };
}

interface MfgEquipment { id: string; name: string; cap: number; type: 'jacketed' | 'simple' | 'support'; homogenizer: boolean; processType: ProcessType[]; status: string; _pk?: number; }
interface FillingEquipment { id: string; name: string; speed: number; type: FillingType; compatible: string[]; status: string; _pk?: number; }
interface PackagingEquipment { id: string; name: string; speed: number; type: string; supports: string[]; status: string; _pk?: number; }

interface EquipmentData {
  manufacturing: MfgEquipment[];
  filling: FillingEquipment[];
  packaging: PackagingEquipment[];
}

interface TeamMember { id: string; userId: number | null; name: string; role: string; dept: Department; avail: boolean; _pk?: number; }

type BatchPriority = 'LOW' | 'MEDIUM' | 'HIGH';
const BATCH_PRIORITIES: BatchPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
/** Higher rank sorts first in the Batches view. */
const BATCH_PRIORITY_RANK: Record<BatchPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
function normalizeBatchPriority(raw: unknown): BatchPriority {
  const v = String(raw ?? '').trim().toUpperCase();
  return v === 'HIGH' || v === 'LOW' ? v : 'MEDIUM';
}

interface Batch {
  bmrNo: string; bprNo: string; productName: string; sku: string; soNo: string; orderQty: number;
  batchSize: number; batchNo: string; batchIndex: number; totalBatches: number;
  bmrStatus: BMRStatus; bprStatus: BPRStatus; color: string;
  processType: ProcessType; homogenizer: boolean;
  mainVessel: string; supportingTanks: string[];
  fillingLine: string; fillingType: FillingType; packagingLine: string; monocarton: boolean; shrink: boolean;
  teamBMR: string[]; teamBPR: string[]; shiftLeadBMR: string; shiftLeadBPR: string; qcOfficerBMR: string; qcOfficerBPR: string;
  scheduledMuZone?: string;
  scheduleRemarks?: string;
  mfgDate: string; fillDate: string; packDate: string; fgDate: string; rmConnectDate: string; pmConnectDate: string;
  rmReserved: boolean; pmReserved: boolean; rmConnected: boolean; pmConnected: boolean;
  dispensingRM: DispensingItem[]; dispensingPM: DispensingItem[];
  bulkYield: number | null; fillYield: number | null; fgYield: number | null;
  bulkBatchAccepted: boolean | null; fillBatchAccepted: boolean | null; fgBatchAccepted: boolean | null;
  qcSpecs: QcSpecsStored; remarks: string; dueDate: string;
  /** Batch priority (LOW | MEDIUM | HIGH) — drives Batches-view ordering. Defaults to MEDIUM. */
  priority?: BatchPriority;
  /** Free-text need-by note shown to the Shift Lead (distinct from `remarks`). */
  needByNote?: string;
  /** BMR/BPR document QA review — 'pending' | 'approved' (gates Initiate Dispensing). */
  bmrQaStatus?: string;
  bmrQaApprovedBy?: string;
  bmrQaReviewedAt?: string;
  bprQaStatus?: string;
  bprQaApprovedBy?: string;
  bprQaReviewedAt?: string;
  /** IPQA pre-production gate (verifications + production confirms). */
  preProductionGate?: PreProductionGate | null;
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
    <div className="rounded-xl border border-brand-soft/80 bg-brand-soft/50 p-3.5 mb-4 text-[11px] text-ink-2">
      <div className="font-bold text-brand uppercase tracking-wider text-[10px] mb-1.5">Bulk &amp; BPR yields (for scheduling)</div>
      <p className="mb-2">
        <span className="text-ink-3">Planned batch size:</span>{' '}
        <b>{plannedKg} KG</b>
        {hasBulk ? (
          <>
            {' · '}
            <span className="text-ink-3">Actual bulk (BMR QC):</span>{' '}
            <b className="text-brand">{formatYieldKg(bulk)} KG</b>
            {!bmrCleared && <span className="text-warn font-medium"> (recorded; BMR not cleared yet)</span>}
          </>
        ) : (
          <>
            {' · '}
            <span className="text-warn font-medium">No bulk yield yet — fill/pack capacity below still uses order-based unit split until BMR bulk QC records actual KG.</span>
          </>
        )}
      </p>
      {(hasFill || hasFg) && (
        <p className="text-ink-2 border-t border-brand-soft/80 pt-2 mt-2">
          {hasFill && (
            <span className="mr-3">
              Fill QC yield: <b>{formatYieldUnits(fillY)}</b> units
            </span>
          )}
          {hasFg && (
            <span>
              Pack / FG yield: <b>{formatYieldUnits(fgY)}</b> units
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
/** Batch has manufacturing date, MU site, and equipment reservation saved from Schedule step. */
function hasProductionBatchSchedule(batch: Batch): boolean {
  return Boolean(
    String(batch.mfgDate || '').trim()
    && String(batch.scheduledMuZone || '').trim()
    && hasBatchEquipmentReserved(batch),
  );
}

/** Confirm is allowed on or after the scheduled manufacturing date. */
function canConfirmProductionBatch(batch: Batch): boolean {
  if (!hasProductionBatchSchedule(batch)) return false;
  const mfg = String(batch.mfgDate || '').trim();
  const today = new Date().toISOString().slice(0, 10);
  return today >= mfg;
}

function bmrStatusAfterScheduleSave(batch: Batch, canMoveToScheduled: boolean): BMRStatus {
  const locked: BMRStatus[] = ['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
  if (locked.includes(batch.bmrStatus)) return batch.bmrStatus;
  if (batch.bmrStatus === 'scheduled') return 'scheduled';
  if (batch.bmrStatus === 'draft') return 'draft';
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
  if (batch.bmrStatus === 'draft') return hasProductionBatchSchedule(batch);
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

/** Reserve PM only after BMR bulk QC is cleared, and only while it still means something. */
function canReservePmForBatch(batch: Batch): boolean {
  if (batch.pmReserved) return false;
  // Material that has already been dispensed cannot be "reserved" — offering the action on a
  // packed/FG-Ready batch is just a stale pm_reserved flag showing through.
  if (batchHasPmDispensed(batch)) return false;
  if (batch.pmConnected) return false;
  return bmrBulkQcReleased(batch);
}

function batchHasRmDispensed(batch: Batch): boolean {
  return batch.dispensingRM.some((l) => (Number(l.dispensed) || 0) > 0);
}

function batchHasPmDispensed(batch: Batch): boolean {
  return batch.dispensingPM.some((l) => (Number(l.dispensed) || 0) > 0);
}

/** Remove RM reservation only before connect / MTR / dispensing (batch or line-level). */
function canUnreserveRmForBatch(
  batch: Batch,
  outboundMrns: MRNRecordFromApi[] = [],
  reservedItems: ProductionReservedItemRow[] = [],
): boolean {
  if (!batchHasReservedMaterial(batch, reservedItems, 'RM')) return false;
  if (batch.rmConnected) return false;
  if (batchHasRmDispensed(batch)) return false;
  if (!['batch_confirmed', 'rm_reserved', 'scheduled'].includes(batch.bmrStatus)) return false;
  if (findAnyRmMtrForBatch(batch.bmrNo, outboundMrns)) return false;
  return true;
}

/** Remove PM reservation only before connect / MTR / dispensing. */
function canUnreservePmForBatch(
  batch: Batch,
  outboundMrns: MRNRecordFromApi[] = [],
  reservedItems: ProductionReservedItemRow[] = [],
): boolean {
  if (!batchHasReservedMaterial(batch, reservedItems, 'PM')) return false;
  if (batch.pmConnected) return false;
  if (batchHasPmDispensed(batch)) return false;
  if (!['draft', 'pm_reserved'].includes(batch.bprStatus)) return false;
  if (findAnyPmMtrForBatch(batch.bmrNo, outboundMrns)) return false;
  return true;
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

type BatchStageDateAlert = {
  stageLabel: string;
  date: string;
  daysUntil: number;
};

function parseIsoDateAtNoon(isoDateStr: string): Date | null {
  const raw = String(isoDateStr || '').trim();
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getBatchStageDateAlert(batch: Batch): BatchStageDateAlert | null {
  const candidates: Array<{ stageLabel: string; date: string | undefined }> = [
    { stageLabel: 'MFG', date: batch.mfgDate },
    { stageLabel: 'Fill', date: batch.fillDate },
    { stageLabel: 'Pack', date: batch.packDate },
    { stageLabel: 'FG', date: batch.fgDate },
  ];
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const nearDue: BatchStageDateAlert[] = candidates
    .map((item) => {
      const target = parseIsoDateAtNoon(item.date || '');
      if (!target) return null;
      const daysUntil = Math.round((target.getTime() - todayNoon.getTime()) / (24 * 60 * 60 * 1000));
      return { stageLabel: item.stageLabel, date: String(item.date || ''), daysUntil };
    })
    .filter((item): item is BatchStageDateAlert => Boolean(item && item.daysUntil >= 0 && item.daysUntil <= 1))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  return nearDue[0] ?? null;
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
        supportingTanks: b.supportingTanks,
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

/** Unified manufacturing → packaging lifecycle (single linear pipeline). */
const BATCH_LIFECYCLE_PIPELINE: PipelineStep[] = [
  ...BMR_PIPELINE.map((p) => (p.key === 'cleared' ? { ...p, label: 'Bulk Cleared' } : p)),
  { key: 'pm_reserved', label: 'PM Reserved', icon: <Package size={PS} /> },
  { key: 'pm_connected', label: 'PM Connected', icon: <Link2 size={PS} /> },
  { key: 'pm_dispensing', label: 'PM Dispensing', icon: <Scale size={PS} /> },
  { key: 'fill_scheduled', label: 'Fill/Pack Scheduled', icon: <Calendar size={PS} /> },
  { key: 'filling', label: 'Filling', icon: <Droplets size={PS} /> },
  { key: 'fill_qc', label: 'Fill QC', icon: <Microscope size={PS} /> },
  { key: 'packaging', label: 'Packaging', icon: <Package size={PS} /> },
  { key: 'pack_qc', label: 'Pack QC', icon: <Microscope size={PS} /> },
  { key: 'fg_ready', label: 'FG Ready', icon: <Check size={PS} /> },
];

function batchActionLabelFromModalType(modalType: string | null): string {
  const map: Record<string, string> = {
    confirm: 'Confirming batch…',
    adjustBatch: 'Updating batch size…',
    editBatch: 'Saving batch…',
    confirmSchedule: 'Confirming schedule…',
    reviewBmrBpr: 'Reviewing BMR/BPR…',
    initiateDispensing: 'Initiating dispensing…',
    initiateProduction: 'Starting production…',
    reserveRM: 'Reserving raw materials…',
    reservePM: 'Reserving packaging materials…',
    schedule: 'Saving schedule…',
    dispenseRM: 'Saving RM dispensing…',
    dispensePM: 'Saving PM dispensing…',
    qcBMR: 'Saving bulk QC…',
    qcFill: 'Saving fill QC…',
    qcPack: 'Saving pack QC…',
    mtrRM: 'Updating RM transfer…',
    mtrPM: 'Updating PM transfer…',
  };
  return modalType ? (map[modalType] ?? 'Processing…') : 'Processing…';
}

function batchActionLabelFromUpdates(updates: Partial<Batch>): string {
  if (updates.rmReserved === false) return 'Removing RM reservation…';
  if (updates.pmReserved === false) return 'Removing PM reservation…';
  if (updates.rmReserved) return 'Reserving raw materials…';
  if (updates.pmReserved) return 'Reserving packaging materials…';
  if (updates.dispensingRM !== undefined) return 'Saving RM dispensing…';
  if (updates.dispensingPM !== undefined) return 'Saving PM dispensing…';
  if (updates.bulkBatchAccepted !== undefined || updates.bmrStatus === 'cleared' || updates.bmrStatus === 'qc_failed') {
    return 'Saving bulk QC…';
  }
  if (updates.fillBatchAccepted !== undefined || updates.fgBatchAccepted !== undefined) {
    return 'Saving QC results…';
  }
  if (updates.bmrStatus === 'batch_confirmed') return 'Confirming batch…';
  if (updates.mfgDate !== undefined || updates.fillDate !== undefined || updates.packDate !== undefined) {
    return 'Saving schedule…';
  }
  if (updates.rmConnected || updates.pmConnected) return 'Updating material transfer…';
  return 'Saving batch…';
}

function BatchProcessLoader({ label, batchNo }: { label: string; batchNo?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-surface rounded-xl shadow-xl px-8 py-6 flex flex-col items-center gap-3 max-w-sm mx-4">
        <Loader2 className="h-10 w-10 text-brand animate-spin" aria-hidden />
        <p className="text-sm font-semibold text-ink text-center">{label}</p>
        {batchNo ? <p className="text-xs font-mono text-ink-3">{batchNo}</p> : null}
        <p className="text-[11px] text-ink-4">Please wait for the server response</p>
      </div>
    </div>
  );
}

function ModalSavingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-surface/90 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-9 w-9 text-brand animate-spin" aria-hidden />
      <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-[11px] text-ink-3">Please wait for the server response</p>
    </div>
  );
}

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

/** Map batch scheduled MU zone code → ML1 or ML2 bucket (matches backend muZoneCodeToMlBucket). */
function muBucketFromScheduledZone(zoneCode: string): 'ml1' | 'ml2' {
  const z = String(zoneCode || '').trim().toUpperCase();
  if (z.includes('ML2') || z === 'LOC-ML2' || z.includes('MU02')) return 'ml2';
  return 'ml1';
}

/** Stock at the batch manufacturing site only (ML1 or ML2 column per scheduled_mu_zone). */
function buildAtBatchMuZoneMap(
  inv: WarehouseInventoryRow[],
  type: 'RM' | 'PM',
  scheduledMuZone: string
): Record<string, number> {
  const bucket = muBucketFromScheduledZone(scheduledMuZone);
  const map: Record<string, number> = {};
  for (const r of inv) {
    if (r.type !== type) continue;
    const c = String(r.code ?? '').trim();
    if (!c) continue;
    const qty = bucket === 'ml2' ? Number(r.ml2Stock) || 0 : Number(r.ml1Stock) || 0;
    map[c] = (map[c] ?? 0) + qty;
  }
  return map;
}

/** WH stock only (excl. ML1/ML2) by code. MTR uses reserved qty at WH (see qtyMtrFromReserved). */
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

function warehouseRowsForMaterialAvailability(
  inventoryRows: WarehouseInventoryRow[] | undefined,
): Parameters<typeof computeBatchMaterialsAvailableBy>[2] {
  return (inventoryRows ?? [])
    .filter((r) => r.type === 'RM' || r.type === 'PM')
    .map((r) => ({
      code: r.code,
      type: r.type,
      available: r.available ?? Math.max(0, (Number(r.stockInHand) || 0) - (Number(r.reserved) || 0)),
      stockInHand: r.stockInHand,
      reserved: r.reserved,
      underGrn: r.underGrn,
      poQuantity: r.poQuantity,
      poConnectingDate: r.poConnectingDate,
      inTransitBreakdown: r.inTransitBreakdown,
    }));
}

function formatMaterialAvailableByLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function lookupMaterialAvailableBy(
  summary: BatchMaterialsAvailableBySummary | null,
  code: string,
  kind: 'rm' | 'pm',
): string {
  if (!summary) return '—';
  const line = (kind === 'rm' ? summary.rm : summary.pm).find((l) => l.code === String(code).trim());
  if (!line) return '—';
  if (line.coveredNow) return 'Now';
  if (line.availableBy) return formatMaterialAvailableByLabel(line.availableBy);
  if (line.needsUnknownPipeline) return 'Pending ETA';
  return 'Short';
}
function fmt(n: number): string { return n.toLocaleString('en-IN'); }

const YIELD_KG_DECIMALS = 8;
const YIELD_UNIT_DECIMALS = 8;

function roundYieldKg(n: number): number {
  const f = 10 ** YIELD_KG_DECIMALS;
  return Math.round(n * f) / f;
}

function roundYieldUnits(n: number): number {
  const f = 10 ** YIELD_UNIT_DECIMALS;
  return Math.round(n * f) / f;
}

function formatYieldKg(n: number): string {
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: YIELD_KG_DECIMALS,
    minimumFractionDigits: 0,
  });
}

function formatYieldUnits(n: number): string {
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: YIELD_UNIT_DECIMALS,
    minimumFractionDigits: 0,
  });
}

function yieldValueToInputString(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(Number(value));
}

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
  teal: { bg: 'bg-brand-soft', border: 'border-brand-soft', text: 'text-brand', dot: 'bg-brand' },
  amber: { bg: 'bg-warn-soft', border: 'border-warn-soft', text: 'text-warn', dot: 'bg-warn' },
  purple: { bg: 'bg-brand-soft', border: 'border-brand-soft', text: 'text-brand', dot: 'bg-brand' },
  blue: { bg: 'bg-brand-soft', border: 'border-brand-soft', text: 'text-brand', dot: 'bg-brand' },
  red: { bg: 'bg-err-soft', border: 'border-err-soft', text: 'text-err', dot: 'bg-err' },
  green: { bg: 'bg-ok-soft', border: 'border-ok-soft', text: 'text-ok', dot: 'bg-ok' },
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

function canSplitBatchForVessel(batch: Batch): boolean {
  return batch._pk != null
    && batch.planningBatchId != null
    && batchEligibleForVesselSplit(batch.bmrStatus, batch.bprStatus);
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
    shiftLeadBMR: r.shiftLeadBMR ?? '', shiftLeadBPR: r.shiftLeadBPR ?? '',
    qcOfficerBMR: r.qcOfficerBMR, qcOfficerBPR: r.qcOfficerBPR,
    scheduledMuZone: r.scheduledMuZone || '',
    scheduleRemarks: r.scheduleRemarks || '',
    mfgDate: r.mfgDate, fillDate: r.fillDate, packDate: r.packDate, fgDate: r.fgDate,
    rmConnectDate: r.rmConnectDate, pmConnectDate: r.pmConnectDate,
    rmReserved: r.rmReserved, pmReserved: r.pmReserved,
    rmConnected: r.rmConnected, pmConnected: r.pmConnected,
    dispensingRM: r.dispensingRM || [], dispensingPM: r.dispensingPM || [],
    bulkYield: r.bulkYield, fillYield: r.fillYield, fgYield: r.fgYield,
    bulkBatchAccepted: r.bulkBatchAccepted, fillBatchAccepted: r.fillBatchAccepted,
    fgBatchAccepted: r.fgBatchAccepted,
    qcSpecs: r.qcSpecs || [], remarks: r.remarks, dueDate: r.dueDate,
    priority: normalizeBatchPriority(r.priority), needByNote: r.needByNote || '',
    bmrQaStatus: r.bmrQaStatus || 'pending', bmrQaApprovedBy: r.bmrQaApprovedBy || '', bmrQaReviewedAt: r.bmrQaReviewedAt || '',
    bprQaStatus: r.bprQaStatus || 'pending', bprQaApprovedBy: r.bprQaApprovedBy || '', bprQaReviewedAt: r.bprQaReviewedAt || '',
    preProductionGate: r.preProductionGate ?? null,
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
  // Thin wrapper over the shared ui StatusBadge (size="sm"). Color comes via className,
  // so an empty colorMap suppresses the shared neutral fallback.
  return (
    <StatusBadge
      status=""
      colorMap={{ '': '' }}
      label={children}
      size="sm"
      className={`whitespace-nowrap leading-none ${className}`}
    />
  );
}

function Modal({
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  disableDismiss = false,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  disableDismiss?: boolean;
}) {
  const w = size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-lg';
  const dismiss = disableDismiss ? undefined : onClose;
  return (
    <ModalOverlay onClose={onClose} z="z-50" align="start" scroll dismissable={!disableDismiss} className="pt-10">
      <div className={`bg-surface rounded-2xl shadow-2xl w-full ${w} my-4 border border-hairline`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"generic-modal-title"}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <h2 className="text-sm font-bold text-ink tracking-tight" id="generic-modal-title">{title}</h2>
            {subtitle && <p className="text-[11px] text-ink-4 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={disableDismiss}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </ModalOverlay>
  );
}

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string; icon?: React.ReactNode }[]; active: string; onChange: (k: string) => void }) {
  // Thin wrapper over the shared ui Tabs (folds the module's inline underline tab-bar).
  return <Tabs tabs={tabs} value={active} onChange={onChange} className="mb-5" />;
}

function Tip({ color = 'blue', icon, children }: { color?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const cm: Record<string, string> = {
    orange: 'bg-brand-soft border-brand-soft text-brand',
    teal: 'bg-brand-soft border-brand-soft text-brand',
    amber: 'bg-warn-soft border-warn-soft text-warn',
    blue: 'bg-brand-soft border-brand-soft text-brand',
    red: 'bg-err-soft border-err-soft text-err',
    green: 'bg-ok-soft border-ok-soft text-ok',
    purple: 'bg-brand-soft border-brand-soft text-brand',
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
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border ${isFailed ? 'bg-err-soft border-err-soft text-err' :
              state === 'done' ? 'bg-ok-soft border-ok-soft text-ok' :
                state === 'active' ? 'bg-brand-soft border-brand-soft text-brand' :
                  'bg-surface-2 border-border text-ink-4'
              }`} title={isFailed ? `${p.label} (Failed)` : p.label}>
              {isFailed ? <X size={10} strokeWidth={3} /> : state === 'done' ? <Check size={10} strokeWidth={3} /> : state === 'active' ? p.icon : <CircleDot size={8} />}
            </div>
            {i < pipeline.length - 1 && <div className={`w-2.5 h-px ${i < idx ? 'bg-ok' : 'bg-surface-3'}`} />}
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

const BATCH_LIFECYCLE_LABELS: Record<string, string> = {
  ...BMR_PIPELINE_LABELS,
  pm_reserved: 'PM Reserved',
  pm_connected: 'PM Connected',
  pm_dispensing: 'PM Dispensing',
  fill_scheduled: 'Fill/Pack Scheduled',
  filling: 'Filling',
  fill_qc: 'Fill QC',
  packaging: 'Packaging',
  pack_qc: 'Pack QC',
  fg_ready: 'FG Ready',
};

function PipelineStripWithLabels({ pipeline, currentStatus, failed, title = 'BMR Progress' }: { pipeline: PipelineStep[]; currentStatus: string; failed?: boolean; title?: string }) {
  const idx = pipelineIndex(currentStatus, pipeline);
  const stepNum = idx < 0 ? 0 : idx + 1;
  return (
    <div className="mb-[18px] overflow-x-auto pb-1">
      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-1.5">{title} — Step {stepNum} of {pipeline.length}</div>
      <div className="flex items-center gap-0 flex-wrap">
        {pipeline.map((p, i) => {
          const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
          const isFailed = failed && state === 'active';
          const label = BATCH_LIFECYCLE_LABELS[p.key] ?? BMR_PIPELINE_LABELS[p.key] ?? p.label;
          return (
            <div key={p.key} className="flex items-center shrink-0">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap ${isFailed ? 'bg-err-soft text-err border border-err-soft' : state === 'done' ? 'bg-ok-soft text-ok border border-ok-soft' : state === 'active' ? 'bg-brand-soft text-brand border border-brand-soft ring-1 ring-brand' : 'bg-surface-2 text-ink-4 border border-border'}`}>
                {label}
              </span>
              {i < pipeline.length - 1 && <span className="text-ink-4 mx-0.5 font-bold">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INP = 'w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand-soft transition-colors';
const LBL = 'block text-[11px] font-semibold text-ink-3 mb-1 tracking-wide';

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
          required: scaleQty(r.required, scale),
        }));
      }
      if (batch.dispensingPM?.length) {
        updates.dispensingPM = batch.dispensingPM.map((p) => ({
          ...p,
          required: scaleQty(p.required, scale),
        }));
      }
    }
    void Promise.resolve(onSave(updates)).then(() => onClose());
  };

  return (
    <Modal onClose={onClose} title={`Confirm Batch - ${formatUnifiedBatchLabel(batch)}`} subtitle={`${batch.productName} - ${batch.batchSize} KG`} size="lg">
      <TabBar tabs={[
        { key: 'process', label: 'Process & Filling', icon: <Settings size={13} /> },
        { key: 'equipment', label: 'Equipment', icon: <Factory size={13} /> },
        { key: 'team', label: 'Team', icon: <Users size={13} /> },
      ]} active={tab} onChange={setTab} />

      {tab === 'process' && (
        <>
          <Tip color="orange" icon={<Zap size={14} />}>Define process parameters. <b>Schedule the batch first</b> (mfg date + manufacturing site), then confirm on the scheduled manufacturing date.</Tip>
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
            <SectionLabel icon={<FlaskConical size={13} />} color="text-brand">Manufacturing Vessels</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {equipment.manufacturing.filter(e => e.type !== 'support').map(e => {
                const ok = e.cap >= form.batchSize;
                const checked = form.compatibleVessels.includes(e.id) || (form.compatibleVessels.length === 0 && ok);
                return (
                  <label key={e.id} className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${ok ? (checked ? 'border-ok-soft bg-ok-soft/60' : 'border-border bg-surface hover:bg-surface-2') : 'border-err-soft bg-err-soft/50 opacity-50 cursor-not-allowed'}`}>
                    <input type="checkbox" className="mt-0.5 accent-ok" checked={ok && checked} disabled={!ok}
                      onChange={() => ok && setForm(f => ({ ...f, compatibleVessels: toggle(f.compatibleVessels, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold text-ink">{e.id} <span className="text-ink-4">({e.cap}L)</span></div>
                      <div className="text-[10px] text-ink-3">{e.name}</div>
                      <div className="text-[10px] text-ink-4">{e.homogenizer ? 'Homogenizer' : 'No homogenizer'} - {e.processType.join(', ').toUpperCase()}</div>
                      {!ok && <div className="text-[10px] text-err font-semibold mt-0.5 flex items-center gap-0.5"><X size={10} /> {e.cap}L &lt; {form.batchSize} KG</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="mb-5">
            <SectionLabel icon={<Cylinder size={13} />} color="text-brand">Supporting Tanks</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {equipment.manufacturing.filter(e => e.type === 'support').map(e => {
                const checked = form.supportingTanks.includes(e.id);
                return (
                  <label key={e.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-brand-soft bg-brand-soft/60' : 'border-border'}`}>
                    <input type="checkbox" className="accent-brand" checked={checked}
                      onChange={() => setForm(f => ({ ...f, supportingTanks: toggle(f.supportingTanks, e.id) }))} />
                    <span className="text-xs font-semibold">{e.id} <span className="text-ink-4">{e.cap}L</span></span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="mb-5">
            <SectionLabel icon={<Droplets size={13} />} color="text-brand">Filling Lines</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {equipment.filling.map(e => {
                const ok = e.compatible.includes(form.fillingType);
                const checked = form.compatibleFillLines.includes(e.id) || (form.compatibleFillLines.length === 0 && ok);
                return (
                  <label key={e.id} className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${ok ? (checked ? 'border-brand-soft bg-brand-soft/60' : 'border-border hover:bg-surface-2') : 'border-border bg-surface-2/50 opacity-50 cursor-not-allowed'}`}>
                    <input type="checkbox" className="mt-0.5 accent-brand" checked={ok && checked} disabled={!ok}
                      onChange={() => ok && setForm(f => ({ ...f, compatibleFillLines: toggle(f.compatibleFillLines, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold">{e.id} <Badge className="bg-brand-soft text-brand">{e.type.toUpperCase()}</Badge></div>
                      <div className="text-[10px] text-ink-3">{e.name} - {fmt(e.speed)}/hr</div>
                      {!ok && <div className="text-[10px] text-err flex items-center gap-0.5"><X size={10} /> Not compatible with {form.fillingType.toUpperCase()}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <SectionLabel icon={<Package size={13} />} color="text-ok">Packaging Lines</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {equipment.packaging.map(e => {
                const checked = form.compatiblePackLines.includes(e.id) || form.compatiblePackLines.length === 0;
                return (
                  <label key={e.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-ok-soft bg-ok-soft/60' : 'border-border'}`}>
                    <input type="checkbox" className="accent-ok" checked={checked}
                      onChange={() => setForm(f => ({ ...f, compatiblePackLines: toggle(f.compatiblePackLines, e.id) }))} />
                    <div>
                      <div className="text-xs font-bold">{e.id}</div>
                      <div className="text-[10px] text-ink-3">{e.type.toUpperCase()} - {fmt(e.speed)}/hr</div>
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
              <SectionLabel icon={<FlaskConical size={13} />} color="text-brand">Manufacturing Team</SectionLabel>
              {team.filter(t => t.dept === 'Manufacturing').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-brand" checked={form.teamBMR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBMR: toggle(f.teamBMR, t.id) }))} />
                  <div>
                    <div className="text-xs font-semibold">{t.name}</div>
                    <div className="text-[10px] text-ink-4">{t.role}{!t.avail && ' - Unavailable'}</div>
                  </div>
                </label>
              ))}
              <div className="mt-3 pt-3 border-t border-hairline">
                <label className={LBL}>QC Officer - Bulk</label>
                <select className={INP} value={form.qcOfficerBMR} onChange={e => setForm(f => ({ ...f, qcOfficerBMR: e.target.value }))}>
                  <option value="">Select QC Officer</option>
                  {team.filter(t => t.dept === 'Quality').map(t => <option key={t.id} value={t.id} disabled={!t.avail}>{t.name} {t.avail ? '' : '(Unavailable)'}</option>)}
                </select>
              </div>
            </div>
            <div>
              <SectionLabel icon={<Droplets size={13} />} color="text-brand">Filling Team</SectionLabel>
              {team.filter(t => t.dept === 'Filling').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-brand" checked={form.teamBPR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBPR: toggle(f.teamBPR, t.id) }))} />
                  <div><div className="text-xs font-semibold">{t.name}</div><div className="text-[10px] text-ink-4">{t.role}</div></div>
                </label>
              ))}
            </div>
            <div>
              <SectionLabel icon={<Package size={13} />} color="text-ok">Packaging Team</SectionLabel>
              {team.filter(t => t.dept === 'Packaging').map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1.5 ${!t.avail ? 'opacity-40' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="accent-ok" checked={form.teamBPR.includes(t.id)} disabled={!t.avail}
                    onChange={() => t.avail && setForm(f => ({ ...f, teamBPR: toggle(f.teamBPR, t.id) }))} />
                  <div><div className="text-xs font-semibold">{t.name}</div><div className="text-[10px] text-ink-4">{t.role}</div></div>
                </label>
              ))}
              <div className="mt-3 pt-3 border-t border-hairline">
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

/* ──────────────── CONFIRM & GENERATE BMR/BPR (post-reservation schedule confirm) ───── */

function ConfirmScheduleModal({ batch, equipment, batches, team, onClose, onSave }: {
  batch: Batch;
  equipment: EquipmentData;
  batches: Batch[];
  team: TeamMember[];
  onClose: () => void;
  onSave: (updates: Partial<Batch>) => void;
}) {
  const batchPk = (batch as Batch & { _pk?: number })._pk;

  // Material readiness (reservation coverage + physical ML1 presence).
  const [coverage, setCoverage] = useState<{ rm: BatchMaterialCoverage; pm: BatchMaterialCoverage } | null>(null);
  const [mlStock, setMlStock] = useState<{ rmByCode: Record<string, string>; pmByCode: Record<string, string> } | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(true);

  // Schedule / equipment / team state, seeded from the batch's already-set schedule.
  const [mfgDate, setMfgDate] = useState(batch.mfgDate || today());
  const [fillDate, setFillDate] = useState(batch.fillDate || addDaysStr(batch.mfgDate || today(), 3));
  const [packDate, setPackDate] = useState(batch.packDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), 1));
  const [fgDate, setFgDate] = useState(batch.fgDate || addDaysStr(batch.packDate || addDaysStr(today(), 4), 1));
  const [rmDate, setRmDate] = useState(batch.rmConnectDate || addDaysStr(batch.mfgDate || today(), -2));
  const [vessel, setVessel] = useState(batch.mainVessel || '');
  const [fillLine, setFillLine] = useState(batch.fillingLine || '');
  const [teamAssignment, setTeamAssignment] = useState<ScheduleTeamAssignmentState>(() => scheduleTeamStateFromBatch(batch));
  const [qaApprover, setQaApprover] = useState(batch.qcOfficerBMR || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (batchPk == null) { setLoadingReadiness(false); return; }
    void Promise.all([
      fetchBatchReservationCoverage(batchPk),
      fetchBatchDispensingMuStock(batchPk),
    ])
      .then(([cov, mu]) => {
        if (cancelled) return;
        setCoverage(cov);
        if (mu && mu.success) setMlStock({ rmByCode: mu.rmByCode ?? {}, pmByCode: mu.pmByCode ?? {} });
      })
      .finally(() => { if (!cancelled) setLoadingReadiness(false); });
    return () => { cancelled = true; };
  }, [batchPk]);

  const occupancy = useMemo(
    () => batches.map((b) => ({
      mainVessel: b.mainVessel, mfgDate: b.mfgDate, supportingTanks: b.supportingTanks,
      fillingLine: b.fillingLine, fillDate: b.fillDate, packagingLine: b.packagingLine, packDate: b.packDate, bmrNo: b.bmrNo,
    })),
    [batches],
  );

  // Date cascade: Production start (mfg) drives the rest, matching ScheduleModal's offsets.
  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(addDaysStr(val, -2));
    const f = addDaysStr(val, 3); setFillDate(f);
    const p = addDaysStr(f, 1); setPackDate(p);
    setFgDate(addDaysStr(p, 1));
  };

  // Readiness figures.
  const rmCov = coverage?.rm;
  const pmCov = coverage?.pm;
  const rmReady = rmCov ? rmCov.lines.filter((l) => l.fullyReserved).length : 0;
  const rmTotal = rmCov ? rmCov.lines.length : 0;
  const pmReady = pmCov ? pmCov.lines.filter((l) => l.fullyReserved).length : 0;
  const pmTotal = pmCov ? pmCov.lines.length : 0;
  const rmFullyReserved = !!rmCov?.fullyReserved;
  const lockedPct = rmCov
    ? (rmCov.fullyReserved
        ? 100
        : (() => {
            const req = rmCov.lines.reduce((s, l) => s + (Number(l.required) || 0), 0);
            const res = rmCov.lines.reduce((s, l) => s + Math.min(Number(l.reserved) || 0, Number(l.required) || 0), 0);
            return req > 0 ? Math.round((res / req) * 100) : 0;
          })())
    : 0;
  const rmAtMl1 = mlStock ? Object.values(mlStock.rmByCode).filter((v) => Number(v) > 0).length : 0;
  const pmAtMl1 = mlStock ? Object.values(mlStock.pmByCode).filter((v) => Number(v) > 0).length : 0;

  // Bulk Ready = derived display label (mfg + 2d); not stored.
  const bulkReady = mfgDate ? addDaysStr(mfgDate, 2) : '';
  // vs Due buffer (days between FG Ready and the batch due date).
  const bufferDays = batch.dueDate && fgDate
    ? Math.round((Date.parse(batch.dueDate) - Date.parse(fgDate)) / 86400000)
    : null;

  const vesselOptions = (equipment?.manufacturing ?? []).filter((e) => e.type !== 'support');
  const fillOptions = equipment?.filling ?? [];

  const canConfirm = rmFullyReserved && !!mfgDate && !!vessel && !!fillLine && !saving;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const updates: Partial<Batch> = {
      mfgDate, fillDate, packDate, fgDate,
      rmConnectDate: rmDate,
      mainVessel: vessel, fillingLine: fillLine,
      ...scheduleTeamPayloadFromState(teamAssignment),
      qcOfficerBMR: qaApprover,
      bmrStatus: 'scheduled', // forward-only; backend reconcile prevents any rewind
    };
    setSaving(true);
    void Promise.resolve(onSave(updates)).then(() => onClose());
  };

  const readyChip = (label: string, ready: number, total: number, ok: boolean) => (
    <div className={`rounded-lg border px-3 py-2 ${ok ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-bold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{ready} of {total}</div>
    </div>
  );

  const equipSelect = (label: string, stageDate: string, options: { id: string; name: string }[], val: string, setVal: (v: string) => void) => (
    <div>
      <label className={LBL}>{label}</label>
      <select className={INP} value={val} onChange={(e) => setVal(e.target.value)}>
        <option value="">— Select —</option>
        {options.map((o) => {
          const free = !stageDate || isEquipFreeOnDate(occupancy, o.id, stageDate, batch.bmrNo);
          return (
            <option key={o.id} value={o.id} disabled={!free && o.id !== val}>
              {o.id} · {o.name} {free ? '(Free)' : '(Busy)'}
            </option>
          );
        })}
      </select>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      title={`Confirm Schedule — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`${batch.productName} · re-confirm vessel · filling line · production team · final dates`}
      size="lg"
    >
      {/* Material readiness */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Package size={12} /> Material readiness {loadingReadiness ? '· loading…' : ''}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {readyChip('RM reserved', rmReady, rmTotal, rmFullyReserved)}
          {readyChip('PM reserved', pmReady, pmTotal, pmTotal > 0 && pmReady === pmTotal)}
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Reservations</div>
            <div className={`text-sm font-bold ${rmFullyReserved ? 'text-emerald-700' : 'text-amber-700'}`}>{lockedPct}% locked</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">At ML1</div>
            <div className="text-sm font-medium text-gray-800">RM {rmAtMl1} · PM {pmAtMl1}</div>
          </div>
        </div>
        {!loadingReadiness && !rmFullyReserved ? (
          <Tip color="orange" icon={<AlertTriangle size={14} />}>
            All RM lines must be fully reserved before you can Confirm & Generate BMR/BPR. Reserve the remaining
            {' '}{Math.max(0, rmTotal - rmReady)} RM line(s) first.
          </Tip>
        ) : null}
      </div>

      {/* Re-confirm vessel + filling line */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Settings size={12} /> Re-confirm equipment
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {equipSelect('Mfg Tank / Vessel', mfgDate, vesselOptions.map((e) => ({ id: e.id, name: e.name })), vessel, setVessel)}
          {equipSelect('Filling Line', fillDate, fillOptions.map((e) => ({ id: e.id, name: e.name })), fillLine, setFillLine)}
        </div>
      </div>

      {/* Re-confirm persons */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Droplets size={12} /> Re-confirm persons
        </div>
        <ScheduleTeamAssignmentSection team={team} value={teamAssignment} onChange={setTeamAssignment} />
        <div className="mt-3 max-w-xs">
          <label className={LBL}>QA Approver</label>
          <select className={INP} value={qaApprover} onChange={(e) => setQaApprover(e.target.value)}>
            <option value="">Select QA Approver</option>
            {team.filter((t) => t.dept === 'Quality').map((t) => (
              <option key={t.id} value={t.id} disabled={!t.avail}>{t.name}{t.avail ? '' : ' (Unavailable)'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Final dates */}
      <div className="mb-2">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Calendar size={12} /> Final dates (locked from this point)
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><label className={LBL}>Dispensing</label><input type="date" className={INP} value={rmDate} onChange={(e) => setRmDate(e.target.value)} /></div>
          <div><label className={LBL}>Production start</label><input type="date" className={INP} value={mfgDate} onChange={(e) => handleMfgChange(e.target.value)} /></div>
          <div>
            <label className={LBL}>Bulk Ready (auto)</label>
            <div className={`${INP} bg-gray-50 text-gray-600`}>{bulkReady || '—'}</div>
          </div>
          <div><label className={LBL}>Filling start</label><input type="date" className={INP} value={fillDate} onChange={(e) => setFillDate(e.target.value)} /></div>
          <div><label className={LBL}>Pack start</label><input type="date" className={INP} value={packDate} onChange={(e) => setPackDate(e.target.value)} /></div>
          <div><label className={LBL}>FG Ready</label><input type="date" className={INP} value={fgDate} onChange={(e) => setFgDate(e.target.value)} /></div>
        </div>
        {batch.dueDate ? (
          <p className="mt-2 text-[11px]">
            <span className="text-gray-500">vs Due {batch.dueDate}:</span>{' '}
            {bufferDays == null ? '—' : bufferDays >= 0
              ? <span className="text-emerald-600 font-semibold">✓ {bufferDays}d buffer</span>
              : <span className="text-red-600 font-semibold">⚠ {Math.abs(bufferDays)}d over</span>}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-gray-100">
        <span className="text-[11px] text-gray-500">
          {rmFullyReserved ? coverageSummaryLabel(rmCov) + ' · all green to proceed' : 'Reserve all RM to proceed'}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={!rmFullyReserved ? 'Reserve all RM lines to confirm' : undefined}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <CheckCircle2 size={13} /> Confirm &amp; Generate BMR/BPR
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────── REVIEW BMR & BPR (QA sign-off, gates dispensing) ───── */

const BMR_SECTIONS = [
  'Cover sheet — batch, product, mfg dates, vessel, team',
  'Formula breakdown — RM list with required qty + actuals (filled at dispense)',
  'Process flow — heat / cool / mix steps with time targets',
  'In-process checks — pH / viscosity / appearance',
  'Sample collection plan + Bulk QC sign-off',
  'Final approval signature block',
];
const BPR_SECTIONS = [
  'Cover sheet — batch, product, filling line, packing config',
  'PM list — bottles / caps / labels / cartons with required qty',
  'Filling parameters — fill weight, cap torque, label position',
  'Pack configuration — units/carton, cartons/pallet',
  'In-process checks — fill weight, cap torque',
  'Pack QC sample point + sign-off',
];

function ReviewBmrBprModal({ batch, canApprove, onClose, onApproved }: {
  batch: Batch;
  canApprove: boolean;
  onClose: () => void;
  onApproved: () => void;
}) {
  const { addToast } = useToast();
  const batchPk = (batch as Batch & { _pk?: number })._pk;
  const [bmrStatus, setBmrStatus] = useState(batch.bmrQaStatus || 'pending');
  const [bprStatus, setBprStatus] = useState(batch.bprQaStatus || 'pending');
  const [bmrApprovedBy, setBmrApprovedBy] = useState(batch.bmrQaApprovedBy || '');
  const [bprApprovedBy, setBprApprovedBy] = useState(batch.bprQaApprovedBy || '');
  const [busy, setBusy] = useState<'bmr' | 'bpr' | null>(null);
  const [bom, setBom] = useState<BatchBOMResponse['data'] | null>(null);
  const [preview, setPreview] = useState<'bmr' | 'bpr' | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (batchPk == null) return;
    void fetchBOMByBatchId(batchPk).then((res) => {
      if (!cancelled && res.success) setBom(res.data ?? null);
    });
    return () => { cancelled = true; };
  }, [batchPk]);

  const approve = async (doc: 'bmr' | 'bpr'): Promise<boolean> => {
    if (!canApprove || batchPk == null) return false;
    setBusy(doc);
    const res = await qaApproveBatchDoc(batchPk, doc);
    setBusy(null);
    if (res.success && res.data) {
      if (doc === 'bmr') { setBmrStatus('approved'); setBmrApprovedBy(res.data.bmrQaApprovedBy || ''); }
      else { setBprStatus('approved'); setBprApprovedBy(res.data.bprQaApprovedBy || ''); }
      addToast('success', `${doc.toUpperCase()} approved`);
      onApproved();
      return true;
    }
    addToast('error', res.error || 'Approval failed');
    return false;
  };

  const approveBoth = async () => {
    if (bmrStatus !== 'approved') { const ok = await approve('bmr'); if (!ok) return; }
    if (bprStatus !== 'approved') await approve('bpr');
  };

  // Build the printable doc models from real batch + BOM data.
  const bsk = (bom?.batchSizeKg && bom.batchSizeKg > 0) ? bom.batchSizeKg : (batch.batchSize || 0);
  const units = (bom?.batchUnits && bom.batchUnits > 0) ? bom.batchUnits : (batch.orderQty || 0);
  const rmDocLines = (bom?.rmLines ?? []).map((l) => {
    const r = l as Record<string, unknown>;
    const pct = Number(r.pct_w_w ?? r.pct ?? 0) || 0;
    return {
      itemId: String(r.rm_code ?? r.code ?? ''),
      name: String(r.inci_name ?? r.name ?? ''),
      required: pct > 0 ? Math.round(bsk * (pct / 100) * 1000) / 1000 : 0,
      uom: 'kg',
    };
  });
  const pmDocLines = (bom?.pmLines ?? []).map((l) => {
    const p = l as Record<string, unknown>;
    const qpu = Number(p.qty_per_unit ?? p.qty ?? 1) || 1;
    return {
      itemId: String(p.pm_code ?? p.code ?? ''),
      name: String(p.description ?? p.name ?? ''),
      required: units * qpu,
      uom: 'pcs',
    };
  });
  const mfgSteps = (bom?.processSteps?.production ?? []).map((s, i) => {
    const st = s as Record<string, unknown>;
    const dur = Number(st.duration_minutes ?? st.durationMinutes ?? 0) || 0;
    return { step: Number(st.step_number ?? st.stepNumber ?? i + 1) || i + 1, desc: String(st.description ?? ''), target: dur > 0 ? `${dur} min` : '' };
  });
  const packingOps = (bom?.processSteps?.packaging ?? []).map((s, i) => {
    const st = s as Record<string, unknown>;
    return { step: Number(st.step_number ?? st.stepNumber ?? i + 1) || i + 1, activity: String(st.description ?? ''), check: '' };
  });
  const fgSpecs = bom?.qcReference?.fgProductSpecs ?? {};
  const specRows = Object.entries(fgSpecs).map(([param, spec]) => ({ param, spec: String(spec), check: param }));

  const cover = {
    batchNo: batch.batchNo || formatUnifiedBatchLabel(batch),
    product: batch.productName,
    sku: batch.sku,
    units,
    bulkKg: batch.batchSize,
    scheduleDate: batch.mfgDate || '',
  };
  const bmrDoc = {
    ...cover, docNo: batch.bmrNo, mfgArea: batch.scheduledMuZone || '', tankId: batch.mainVessel || '',
    rmLines: rmDocLines, mfgSteps, batchSpecs: specRows.map((r) => ({ param: r.param, spec: r.spec })),
  };
  const bprDoc = {
    ...cover, docNo: batch.bprNo, fillingLine: batch.fillingLine || '',
    pmLines: pmDocLines, packingOps, qcChecks: specRows.map((r) => ({ check: r.check, spec: r.spec })),
  };

  const docRow = (
    kind: 'bmr' | 'bpr',
    docNo: string,
    title: string,
    sections: string[],
    pages: string,
    reviewer: string,
    status: string,
    approvedBy: string,
  ) => (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-800">{kind === 'bmr' ? '📘' : '📗'} {docNo}.pdf</div>
          <div className="text-[11px] font-medium text-gray-500">{title}</div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-600 list-disc pl-4">
            {sections.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-gray-400">{pages}</div>
          <div className="text-[11px] text-gray-600 mt-1">QA: {reviewer || '—'}</div>
          {status === 'approved'
            ? <span className="mt-1 inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">APPROVED{approvedBy ? ` · ${approvedBy}` : ''}</span>
            : <span className="mt-1 inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">PENDING REVIEW</span>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button type="button" onClick={() => setPreview(kind)} className="px-2.5 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50">👁 Preview</button>
            {status !== 'approved' && (
              <button
                type="button"
                onClick={() => approve(kind)}
                disabled={!canApprove || busy === kind}
                title={!canApprove ? 'Requires QA (quality.approve) permission' : undefined}
                className="px-2.5 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
              >
                {busy === kind ? '…' : '✓ Approve'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const bothApproved = bmrStatus === 'approved' && bprStatus === 'approved';

  return (
    <Modal
      onClose={onClose}
      title={`Review BMR & BPR — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`${batch.productName} · Auto-generated · QA review required before Initiate Dispensing`}
      size="lg"
    >
      {!canApprove ? (
        <Tip color="orange" icon={<AlertTriangle size={14} />}>
          You don't have QA approval permission (order-management → Quality → approve). You can preview the
          documents, but only QA can approve them.
        </Tip>
      ) : null}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={approveBoth}
          disabled={!canApprove || bothApproved || busy != null}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
        >
          <CheckCircle2 size={13} /> QA Approve Both
        </button>
      </div>
      <div className="space-y-3">
        {docRow('bmr', batch.bmrNo, 'Batch Manufacturing Record', BMR_SECTIONS, `${rmDocLines.length} RM lines · ~${6 + Math.ceil(rmDocLines.length / 12)} pages`, batch.qcOfficerBMR || '', bmrStatus, bmrApprovedBy)}
        {docRow('bpr', batch.bprNo, 'Batch Packing Record', BPR_SECTIONS, `${pmDocLines.length} PM lines · ~${6 + Math.ceil(pmDocLines.length / 12)} pages`, batch.qcOfficerBPR || '', bprStatus, bprApprovedBy)}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        {bothApproved
          ? <span className="text-emerald-600 font-semibold">✓ Both approved — Initiate Dispensing is now enabled.</span>
          : 'Initiate Dispensing stays locked until both BMR and BPR are QA-approved.'}
      </div>

      {preview === 'bmr' && <BMRPrintTemplate bmr={bmrDoc} onClose={() => setPreview(null)} />}
      {preview === 'bpr' && <BPRPrintTemplate bpr={bprDoc} onClose={() => setPreview(null)} />}
    </Modal>
  );
}

/* ──────────────── INITIATE PRODUCTION (IPQA pre-production gate) ───── */

const IPQA_VERIFICATIONS: { key: string; label: string }[] = [
  { key: 'vessel_clean', label: 'Vessel confirmed clean & ready' },
  { key: 'prod_assignee', label: 'Production assignee confirmed' },
  { key: 'tray_approved', label: 'Dispensing Tray approved (qty / labels / photos vs BMR)' },
  { key: 'gate_signoff', label: 'IPQA pre-production gate overall sign-off' },
];
const PRODUCTION_CONFIRMS: { key: string; label: string }[] = [
  { key: 'bmr_read', label: 'BMR received & read' },
  { key: 'tray_verified', label: 'Dispensing Tray physically verified at vessel' },
  { key: 'team_briefed', label: 'Team members available & briefed' },
  { key: 'vessel_inspected', label: 'Vessel visually inspected · CIP cleared' },
];

function InitiateProductionModal({ batch, canApprove, onClose, onStart, onGateUpdated, onRefresh }: {
  batch: Batch;
  canApprove: boolean;
  onClose: () => void;
  onStart: () => void;
  onGateUpdated: (updated: Batch) => void;
  onRefresh: () => void;
}) {
  const { addToast } = useToast();
  const batchPk = (batch as Batch & { _pk?: number })._pk;
  const [busy, setBusy] = useState<string | null>(null);
  const gate: PreProductionGate = batch.preProductionGate ?? {};
  const verifications = gate.verifications ?? {};
  const confirms = gate.confirms ?? {};
  const allVerified = IPQA_VERIFICATIONS.every((v) => verifications[v.key]?.status === 'pass');
  const allConfirmed = PRODUCTION_CONFIRMS.every((c) => !!confirms[c.key]?.at);
  const canStart = allVerified && allConfirmed;

  const verify = async (key: string, status: 'pass' | 'fail') => {
    if (batchPk == null) return;
    setBusy(`v:${key}`);
    const res = await ipqaVerifyBatch(batchPk, key, status);
    setBusy(null);
    if (res.success && res.data) onGateUpdated(apiBatchToBatch(res.data));
    else addToast('error', res.error || 'Verification failed');
  };
  const confirm = async (key: string) => {
    if (batchPk == null) return;
    setBusy(`c:${key}`);
    const res = await productionConfirmBatch(batchPk, key);
    setBusy(null);
    if (res.success && res.data) onGateUpdated(apiBatchToBatch(res.data));
    else addToast('error', res.error || 'Confirmation failed');
  };

  const fmtAt = (at?: string) => (at ? new Date(at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <Modal
      onClose={onClose}
      title={`Initiate Production — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`Vessel ${batch.mainVessel || '—'} · Shift Lead ${batch.shiftLeadBMR || '—'} · ${allVerified ? 'IPQA gate cleared' : 'awaiting IPQA cross-confirmation'}`}
      size="lg"
    >
      {/* IPQA gate mirror */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">🟢 IPQA Pre-Production Gate</span>
          <button type="button" onClick={onRefresh} title="Re-pull latest gate state" className="text-[11px] text-blue-600 hover:underline">↻ Refresh</button>
        </div>
        <div className="rounded-lg border border-gray-100 divide-y divide-gray-50">
          {IPQA_VERIFICATIONS.map((v) => {
            const st = verifications[v.key];
            const passed = st?.status === 'pass';
            const failed = st?.status === 'fail';
            return (
              <div key={v.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-800">{v.label}</div>
                  <div className="text-[10px] text-gray-400">{st?.by ? `${st.by} · ${fmtAt(st.at)}` : 'Quality window'}</div>
                </div>
                {passed ? <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">✓ Confirmed</span>
                  : failed ? <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold">✗ Failed</span>
                  : <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">⏳ in progress</span>}
                {canApprove && (
                  <span className="inline-flex gap-1">
                    <button type="button" disabled={busy === `v:${v.key}`} onClick={() => verify(v.key, 'pass')} className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] disabled:opacity-50">✓</button>
                    <button type="button" disabled={busy === `v:${v.key}`} onClick={() => verify(v.key, 'fail')} className="px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 text-[10px] disabled:opacity-50">✗</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {!canApprove ? <p className="mt-1 text-[10px] text-gray-400">IPQA verifications are marked by Quality (mirrored here). Use Refresh to pull updates.</p> : null}
      </div>

      {/* Production-side confirmations */}
      <div className="mb-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">✋ Production assignee confirmations</div>
        <div className="rounded-lg border border-gray-100 divide-y divide-gray-50">
          {PRODUCTION_CONFIRMS.map((c) => {
            const done = !!confirms[c.key]?.at;
            return (
              <div key={c.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                <div className="flex-1 min-w-0 text-gray-800">{c.label}</div>
                {done ? <span className="text-emerald-600 font-semibold text-[11px]">✓ {confirms[c.key]?.by} · {fmtAt(confirms[c.key]?.at)}</span>
                  : <button type="button" disabled={busy === `c:${c.key}`} onClick={() => confirm(c.key)} className="px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-semibold disabled:opacity-50">Confirm</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Final start details */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-gray-400">Production Start</div><div className="text-sm font-medium text-gray-800">{batch.mfgDate || '—'}</div></div>
        <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-gray-400">Vessel</div><div className="text-sm font-medium text-gray-800">{batch.mainVessel || '—'}</div></div>
        <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-gray-400">Expected Bulk-Ready</div><div className="text-sm font-medium text-gray-800">{batch.fillDate ? addDaysStr(batch.mfgDate || batch.fillDate, 1) : '—'}</div></div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
        <span className="text-[11px] text-gray-500">{canStart ? 'All checks cleared — ready to start.' : 'Start Production unlocks when all IPQA verifications ✓ and confirmations done.'}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100">Cancel</button>
          <button type="button" onClick={onStart} disabled={!canStart}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg">
            🏭 Start Production
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────── INITIATE DISPENSING (create dispense tray) ───── */

function InitiateDispensingModal({ batch, team, onClose, onSave }: {
  batch: Batch;
  team: TeamMember[];
  onClose: () => void;
  onSave: (updates: Partial<Batch>) => void;
}) {
  const batchPk = (batch as Batch & { _pk?: number })._pk;
  const [bom, setBom] = useState<BatchBOMResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamAssignment, setTeamAssignment] = useState<ScheduleTeamAssignmentState>(() => scheduleTeamStateFromBatch(batch));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (batchPk == null) { setLoading(false); return; }
    void fetchBOMByBatchId(batchPk)
      .then((res) => { if (!cancelled && res.success) setBom(res.data ?? null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchPk]);

  const confirmedDispenseDate = batch.rmConnectDate || batch.mfgDate || '';
  const expectedTrayReady = confirmedDispenseDate ? `${confirmedDispenseDate} · 14:00` : '—';
  const shiftLeadName = team.find((t) => t.id === (teamAssignment.shiftLeadBmr || batch.shiftLeadBMR))?.name
    || teamAssignment.shiftLeadBmr || batch.shiftLeadBMR || '—';

  const buildLines = (): { dispensingRM: DispensingItem[]; dispensingPM: DispensingItem[] } => {
    const bsk = (bom?.batchSizeKg && bom.batchSizeKg > 0) ? bom.batchSizeKg : (batch.batchSize || 0);
    const units = (bom?.batchUnits && bom.batchUnits > 0)
      ? bom.batchUnits
      : (batch.totalBatches ? Math.ceil((batch.orderQty || 0) / batch.totalBatches) : (batch.orderQty || 0));
    const slot = `${batch.batchNo || batch.bmrNo}/A`;
    const rmContainer = String(batch.mainVessel || '').trim();
    const pmContainer = String(batch.fillingLine || '').trim();
    const dispensingRM: DispensingItem[] = (bom?.rmLines ?? []).map((l) => {
      const r = l as Record<string, unknown>;
      const pct = Number(r.pct_w_w ?? r.pct ?? 0) || 0;
      const rmId = Number(r.raw_material_id ?? r.rawMaterialId);
      return {
        code: String(r.rm_code ?? r.code ?? ''),
        inci: String(r.inci_name ?? r.name ?? ''),
        required: roundMaterialQty((bsk * pct) / 100, 'kg'),
        dispensed: 0,
        done: false,
        trayContainer: rmContainer,
        traySlot: slot,
        ...(Number.isFinite(rmId) && rmId > 0 ? { rawMaterialId: rmId } : {}),
      };
    }).filter((x) => x.required > 0 && x.code.trim().length > 0);
    const dispensingPM: DispensingItem[] = (bom?.pmLines ?? []).map((l) => {
      const p = l as Record<string, unknown>;
      const qpu = Number(p.qty_per_unit ?? p.qty ?? 1) || 1;
      return {
        code: String(p.pm_code ?? p.code ?? ''),
        name: String(p.description ?? p.name ?? ''),
        required: roundMaterialQty(qpu * units, 'pcs'),
        dispensed: 0,
        done: false,
        trayContainer: pmContainer,
        traySlot: slot,
      };
    }).filter((x) => x.required > 0 && x.code.trim().length > 0);
    return { dispensingRM, dispensingPM };
  };

  const handleInitiate = () => {
    const { dispensingRM, dispensingPM } = buildLines();
    setSaving(true);
    void Promise.resolve(onSave({
      bmrStatus: 'dispensing',
      dispensingRM,
      dispensingPM,
      ...scheduleTeamPayloadFromState(teamAssignment),
    })).then(() => onClose());
  };

  const idCard = (label: string, value: string) => (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate" title={value}>{value || '—'}</div>
    </div>
  );

  const rmCount = (bom?.rmLines ?? []).length;
  const pmCount = (bom?.pmLines ?? []).length;

  return (
    <Modal
      onClose={onClose}
      title={`Initiate Dispensing — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`${batch.scheduledMuZone || 'ML'} · all materials at ML · Shift Lead ${shiftLeadName}`}
      size="lg"
    >
      {/* Locked batch info */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Info size={12} /> Batch info (locked)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {idCard('Batch', batch.bmrNo)}
          {idCard('Product', batch.productName)}
          {idCard('Bulk Size', `${batch.batchSize || 0} kg`)}
          {idCard('MFG Loc', batch.scheduledMuZone || '')}
        </div>
      </div>

      {/* Schedule basis */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Calendar size={12} /> Schedule basis &amp; expected tray-ready
        </div>
        <div className="grid grid-cols-2 gap-2">
          {idCard('Confirmed Dispense Date', confirmedDispenseDate)}
          {idCard('Expected Tray Ready', expectedTrayReady)}
        </div>
      </div>

      {/* Dispense team */}
      <div className="mb-2">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Droplets size={12} /> Dispense team
        </div>
        <ScheduleTeamAssignmentSection team={team} value={teamAssignment} onChange={setTeamAssignment} />
      </div>

      <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-gray-100">
        <span className="text-[11px] text-gray-500">
          {loading ? 'Loading materials…' : `Creates RM 🧪 ${rmCount} · PM 📦 ${pmCount} tray lines`}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleInitiate}
            disabled={saving || loading || (rmCount === 0 && pmCount === 0)}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Scale size={13} /> Initiate &amp; Create Dispense Tray
          </button>
        </div>
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
          required: scaleQty(r.required, scale),
        }));
      }
      if (batch.dispensingPM?.length) {
        updates.dispensingPM = batch.dispensingPM.map((p) => ({
          ...p,
          required: scaleQty(p.required, scale),
        }));
      }
    }
    void Promise.resolve(onSave(updates)).then(() => onClose());
  };

  return (
    <Modal onClose={onClose} title={`Adjust batch size — ${formatUnifiedBatchLabel(batch)}`} subtitle={`${batch.productName} · Current ${batch.batchSize} KG`} size="md">
      <Tip color="orange" icon={<Settings size={14} />}>Change the batch size during BMR or BPR. RM/PM required quantities scale proportionally; when the batch is linked to Planning, the planning batch row is updated on save.</Tip>
      <div className="mt-3">
        <label className={LBL}>Batch size (KG)</label>
        <input className={INP} type="number" aria-label="Batch size (KG)" value={batchSize || ''} onChange={e => setBatchSize(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><CheckCircle2 size={13} /> Save</button>
      </div>
    </Modal>
  );
}

/* ──────────────── EDIT BATCH (units resize + priority + need-by) ───── */

function EditBatchModal({ batch, onClose, onSave }: {
  batch: Batch;
  onClose: () => void;
  onSave: (updates: Partial<Batch>) => void;
}) {
  const oldKg = batch.batchSize || 0;
  const [loading, setLoading] = useState(true);
  const [kgPerUnit, setKgPerUnit] = useState<number | null>(null);
  const [client, setClient] = useState('');
  // Size is edited in units when kg-per-unit is known; otherwise fall back to editing kg directly.
  const [unitsInput, setUnitsInput] = useState('');
  const [kgInput, setKgInput] = useState(oldKg);
  const [priority, setPriority] = useState<BatchPriority>(batch.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState(batch.dueDate || '');
  const [needByNote, setNeedByNote] = useState(batch.needByNote || '');
  const [saving, setSaving] = useState(false);
  const [scheduledMuZone, setScheduledMuZone] = useState(batch.scheduledMuZone || '');
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);

  const batchPk = (batch as Batch & { _pk?: number })._pk;

  useEffect(() => {
    let cancelled = false;
    void fetchFacilityAreas('production').then((res) => {
      if (!cancelled) setProductionAreas(res.data || []);
    });
    return () => { cancelled = true; };
  }, []);

  const allProductionZones = useMemo(
    () => productionAreas.flatMap((a) => a.zones || []),
    [productionAreas],
  );
  const zoneChanged =
    String(scheduledMuZone || '').trim() !== String(batch.scheduledMuZone || '').trim();
  // The backend licence-checks the zone but does not gate it by stage. Once material has been
  // transferred to the scheduled unit and dispensing has begun, moving the batch elsewhere would
  // leave that stock stranded at the old MU, so lock the field from dispensing onwards.
  const zoneLocked =
    ['dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'].includes(
      String(batch.bmrStatus || '').toLowerCase(),
    )
    || (batch.dispensingRM?.length ?? 0) > 0
    || (batch.dispensingPM?.length ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;
    if (batchPk == null) { setLoading(false); return; }
    void fetchBOMByBatchId(batchPk)
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const kpu = res.data.kgPerUnit ?? null;
        setKgPerUnit(kpu && kpu > 0 ? kpu : null);
        setClient(res.data.client || '');
        const units = res.data.batchUnits;
        if (units != null && units > 0) setUnitsInput(String(units));
        else if (kpu && kpu > 0 && oldKg > 0) setUnitsInput(String(Math.round(oldKg / kpu)));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchPk, oldKg]);

  const usingUnits = kgPerUnit != null && kgPerUnit > 0;
  const newKg = usingUnits
    ? Math.round((parseFloat(unitsInput) || 0) * (kgPerUnit as number))
    : (kgInput || 0);
  const scale = oldKg > 0 && newKg > 0 ? newKg / oldKg : 1;
  const sizeChanged = newKg > 0 && newKg !== oldKg;
  const hasReservations = batch.rmReserved || batch.pmReserved;

  const handleSave = () => {
    const updates: Partial<Batch> = { priority, dueDate, needByNote };
    // Only send the zone when it actually changed. The backend gate fires on
    // "zone set or changed" (products/prFacilityLicenceGate.js), so resending the same value on an
    // unrelated edit would re-run the licence check and could block a size/priority change on a
    // batch whose licence lapsed after it was scheduled.
    if (zoneChanged) updates.scheduledMuZone = scheduledMuZone;
    if (newKg > 0) updates.batchSize = newKg;
    if (sizeChanged && (batch.dispensingRM?.length > 0 || batch.dispensingPM?.length > 0)) {
      if (batch.dispensingRM?.length) {
        updates.dispensingRM = batch.dispensingRM.map((r) => ({ ...r, required: scaleQty(r.required, scale) }));
      }
      if (batch.dispensingPM?.length) {
        updates.dispensingPM = batch.dispensingPM.map((p) => ({ ...p, required: scaleQty(p.required, scale) }));
      }
    }
    setSaving(true);
    void Promise.resolve(onSave(updates)).then(() => onClose());
  };

  const idCard = (label: string, value: string) => (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate" title={value}>{value || '—'}</div>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      title={`Edit Batch — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`${batch.productName} · current status ${String(batch.bmrStatus || '').toUpperCase()} · syncs to Planning + downstream`}
      size="lg"
    >
      {/* Read-only identifiers (Planning owns) */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Info size={12} /> Identifiers (read-only — Planning owns)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {idCard('Batch #', formatUnifiedBatchLabel(batch))}
          {idCard('Product', batch.productName)}
          {idCard('SO #', batch.soNo)}
          {idCard('Client', loading ? '…' : client)}
        </div>
      </div>

      {hasReservations ? (
        <Tip color="orange" icon={<AlertTriangle size={14} />}>
          This batch is already RM/PM-reserved. Changing the size updates the BOM/Planning quantities, but the
          existing reservations are <b>not</b> rescaled automatically — un-reserve and re-reserve RM/PM to sync them.
        </Tip>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Batch size */}
        <div className="sm:col-span-2">
          <label className={LBL}>{usingUnits ? 'Batch Size (units)' : 'Batch Size (KG) bulk'}</label>
          {usingUnits ? (
            <>
              <input
                className={INP}
                type="number"
                min={0}
                value={unitsInput}
                disabled={loading}
                onChange={(e) => setUnitsInput(e.target.value)}
              />
              <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                <span>Bulk kg</span>
                <b className="text-gray-700">{fmt(oldKg)}</b>
                <ArrowRight size={11} />
                <b className="text-gray-800">{fmt(newKg)} (auto)</b>
                {sizeChanged ? (
                  <span className="ml-1 text-orange-600">· BOM RM/PM × {scale.toFixed(2)}</span>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <input
                className={INP}
                type="number"
                min={0}
                value={kgInput || ''}
                onChange={(e) => setKgInput(parseFloat(e.target.value) || 0)}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Per-unit size unavailable for this batch — editing bulk kg directly. RM/PM scale × {scale.toFixed(2)}.
              </p>
            </>
          )}
        </div>

        {/* Manufacturing location (MU zone) */}
        <div className="sm:col-span-2">
          <label className={LBL}>Manufacturing location</label>
          <select
            className={INP}
            value={scheduledMuZone}
            disabled={zoneLocked}
            onChange={(e) => setScheduledMuZone(e.target.value)}
          >
            <option value="">— Select manufacturing site —</option>
            {productionAreas.map((a) => (
              <optgroup key={a.id} label={`${a.name} (manufacturing unit)`}>
                {(a.zones || []).map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}{z.zoneLabel ? ` — ${z.zoneLabel}` : ''} ({z.code})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {zoneLocked ? (
            <p className="mt-1 text-[11px] text-gray-500">
              Locked — dispensing has started at this site. Moving the batch now would strand the material
              already transferred here.
            </p>
          ) : allProductionZones.length === 0 ? (
            <p className="mt-1 text-[11px] text-warn">
              Add manufacturing zones under Masters → Facility Management.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-400">
              Dispensing draws stock from this site only. Changing it is licence-checked against the PR master
              and rejected if this product is not cleared for the new unit.
            </p>
          )}
          {zoneChanged && (batch.rmReserved || batch.pmReserved) ? (
            <p className="mt-1 text-[11px] text-orange-600">
              RM/PM are reserved against the current site — un-reserve and re-reserve after moving the batch,
              or dispensing will look for stock at the new unit.
            </p>
          ) : null}
        </div>

        {/* Priority */}
        <div>
          <label className={LBL}>Priority</label>
          <select className={INP} value={priority} onChange={(e) => setPriority(normalizeBatchPriority(e.target.value))}>
            {BATCH_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-400">Resorts the Batches view.</p>
        </div>

        {/* Need-by date */}
        <div>
          <label className={LBL}>Need-by date</label>
          <input className={INP} type="date" value={dueDate || ''} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {/* Need-by note */}
        <div className="sm:col-span-2">
          <label className={LBL}>Need-by note (shown to Shift Lead)</label>
          <textarea
            className={`${INP} min-h-[64px]`}
            value={needByNote}
            onChange={(e) => setNeedByNote(e.target.value)}
            placeholder='e.g. "Client expects ahead of 14-Aug · run before holiday"'
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors"
        >
          <CheckCircle2 size={13} /> Save &amp; Sync
        </button>
      </div>
    </Modal>
  );
}

/* ──────────────── SPLIT BATCH FOR VESSEL CAPACITY ──────────── */

function SplitForVesselModal({
  batch,
  vesselCapacityLiters,
  onClose,
  onComplete,
}: {
  batch: Batch;
  vesselCapacityLiters: number;
  onClose: () => void;
  onComplete: (original: Batch, split: Batch) => void;
}) {
  const { addToast } = useToast();
  const proposal = useMemo(
    () => proposeVesselSplitSizes(batch.batchSize, batch.requiredVolumeLiters, vesselCapacityLiters),
    [batch.batchSize, batch.requiredVolumeLiters, vesselCapacityLiters],
  );
  const [firstRunKg, setFirstRunKg] = useState(proposal?.firstRunKg ?? batch.batchSize);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (proposal?.firstRunKg) setFirstRunKg(proposal.firstRunKg);
  }, [proposal?.firstRunKg, batch.bmrNo]);

  const remainderKg = Math.max(0, Math.round((batch.batchSize - firstRunKg) * 1000) / 1000);
  const canSubmit = batch._pk != null
    && firstRunKg > 0
    && firstRunKg < batch.batchSize
    && remainderKg >= 1
    && !submitting;

  const handleSplit = async (): Promise<void> => {
    if (!batch._pk || !canSubmit) return;
    setSubmitting(true);
    try {
      const result = await apiSplitBatchForVessel(batch._pk, firstRunKg, reason.trim() || undefined);
      const original = apiBatchToBatch(result.original);
      const split = apiBatchToBatch(result.split);
      addToast(
        'success',
        `Split complete — ${formatUnifiedBatchLabel(original)} (${original.batchSize} KG) + ${formatUnifiedBatchLabel(split)} (${split.batchSize} KG). Schedule the split batch next.`,
      );
      onComplete(original, split);
      onClose();
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to split batch';
      addToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Split for vessel — ${formatUnifiedBatchLabel(batch)}`}
      subtitle={`${batch.productName} · ${batch.batchSize} KG total · vessel ${vesselCapacityLiters} L`}
      size="md"
    >
      <Tip color="orange" icon={<Layers size={14} />}>
        When batch volume exceeds vessel capacity (e.g. 800 KG in a 500 L vessel), split into a first run on this batch
        and a new <b>sp-NN</b> sibling batch for the remainder. RM/PM quantities scale automatically; reschedule the split batch separately.
      </Tip>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LBL}>First run on this batch (KG)</label>
          <input
            className={INP}
            type="number"
            aria-label="First run on this batch (KG)"
            min={1}
            max={batch.batchSize - 1}
            value={firstRunKg || ''}
            onChange={(e) => setFirstRunKg(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={LBL}>Remainder → new split batch (KG)</label>
          <input className={INP} type="number" aria-label="Remainder → new split batch (KG)" readOnly value={remainderKg || ''} />
        </div>
      </div>
      <div className="mt-3">
        <label className={LBL}>Reason (optional)</label>
        <input
          className={INP}
          type="text"
          aria-label="Reason (optional)"
          placeholder="e.g. 500 L vessel — split 800 KG batch"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-hairline">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSplit()}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-brand hover:bg-brand disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors"
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
          Split &amp; create sp batch
        </button>
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

function ReserveMaterialModal({ batch, type, stockMap, reservedMap, inventoryRows, onClose, onReserved }: {
  batch: Batch; type: 'rm' | 'pm'; stockMap: Record<string, number>; reservedMap?: Record<string, number>;
  inventoryRows?: WarehouseInventoryRow[];
  onClose: () => void; onReserved: () => Promise<void>;
}) {
  const { addToast } = useToast();
  const batchItems = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const unit = type === 'rm' ? 'KG' : 'pcs';
  const qtyKind = type === 'rm' ? ('kg' as const) : ('pcs' as const);
  const fmtQty = (n: number) => formatQtyExact(n, qtyKind);
  const fmtQtyU = (n: number) => formatQtyWithUnit(n, qtyKind);

  const [derivedRm, setDerivedRm] = useState<DispensingItem[]>([]);
  const [derivedPm, setDerivedPm] = useState<DispensingItem[]>([]);
  const [loadingRm, setLoadingRm] = useState(false);
  const [loadingPm, setLoadingPm] = useState(false);
  const [rmLoadError, setRmLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [planningCoverageByCode, setPlanningCoverageByCode] = useState<Record<string, number>>({});
  const [batchReservedByCode, setBatchReservedByCode] = useState<Record<string, number>>({});
  const [otherBatchesReservedByCode, setOtherBatchesReservedByCode] = useState<Record<string, number>>({});
  const [loadingBatchReserveMaps, setLoadingBatchReserveMaps] = useState(false);
  const batchPk = (batch as Batch & { _pk?: number })._pk;

  const needLoadRm = type === 'rm' && batchItems.length === 0;
  const needLoadPm = type === 'pm' && batchItems.length === 0;
  const resolveRmBatchSizeKg = (apiBatchSizeKg?: number | null): number => {
    const fromApi = Number(apiBatchSizeKg) || 0;
    if (fromApi > 0) return fromApi;
    const fromBatch = Number(batch.batchSize) || 0;
    if (fromBatch > 0) return fromBatch;
    const orderQty = Number(batch.orderQty) || 0;
    const batches = Number(batch.totalBatches) || 0;
    if (orderQty > 0 && batches > 0) return orderQty / batches;
    return 0;
  };
  const flattenBomRmLines = (lines: BOMRmLine[]): BOMRmLine[] => {
    const out: BOMRmLine[] = [];
    for (const line of lines) {
      const nested = (line as { ingredients?: BOMRmLine[] }).ingredients;
      if (Array.isArray(nested) && nested.length > 0) out.push(...nested);
      else out.push(line);
    }
    return out;
  };
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
          const batchSizeKg = resolveRmBatchSizeKg(batchBomRes.data.batchSizeKg);
          const rmLines = flattenBomRmLines((batchBomRes.data.rmLines ?? []) as BOMRmLine[]);
          const rmItems: DispensingItem[] = rmLines
            .filter((line) => line.rm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.rm_code || (line as { code?: string }).code) as string;
              const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
              // Prefer percentage rows; fall back to direct quantity rows used by some BOM payloads.
              const directQty = Number((line as { qty_per_unit?: number; quantity?: number; qty?: number }).qty_per_unit
                ?? (line as { quantity?: number }).quantity
                ?? (line as { qty?: number }).qty
                ?? 0) || 0;
              const requiredRaw = pct > 0 ? (batchSizeKg * pct) / 100 : directQty;
              const required = normalizeQtyForCompare(requiredRaw, 'kg');
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
          const product = res.data.find((p: { zoho_sku_code?: string; product_sku?: string; product_name?: string }) => (p.zoho_sku_code ?? p.product_sku) === batch.sku || p.product_name === batch.productName);
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
        const batchSizeKg = resolveRmBatchSizeKg(undefined);
        const rmLines = flattenBomRmLines((bom.rmLines ?? []) as BOMRmLine[]);
        const rmItems: DispensingItem[] = rmLines
          .filter((line) => line.rm_code || (line as { code?: string }).code)
          .map((line) => {
            const code = (line.rm_code || (line as { code?: string }).code) as string;
            const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
            const directQty = Number((line as { qty_per_unit?: number; quantity?: number; qty?: number }).qty_per_unit
              ?? (line as { quantity?: number }).quantity
              ?? (line as { qty?: number }).qty
              ?? 0) || 0;
            const requiredRaw = pct > 0 ? (batchSizeKg * pct) / 100 : directQty;
            const required = normalizeQtyForCompare(requiredRaw, 'kg');
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
          const batchUnits =
            batchBomRes.data.batchSizeKg != null && Number(batchBomRes.data.batchSizeKg) > 0
              ? Number(batchBomRes.data.batchSizeKg)
              : batch.totalBatches
                ? Math.ceil((batch.orderQty || 0) / batch.totalBatches)
                : Number(batch.batchSize) || 0;
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
          const product = res.data.find((p: { zoho_sku_code?: string; product_sku?: string; product_name?: string }) => (p.zoho_sku_code ?? p.product_sku) === batch.sku || p.product_name === batch.productName);
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

  useEffect(() => {
    if (!batchPk) {
      setBatchReservedByCode({});
      setOtherBatchesReservedByCode({});
      return;
    }
    setLoadingBatchReserveMaps(true);
    fetchBatchMtrReserved(batchPk)
      .then(({ byCode, otherBatchesByCode }) => {
        setBatchReservedByCode(byCode || {});
        setOtherBatchesReservedByCode(otherBatchesByCode || {});
      })
      .catch(() => {
        setBatchReservedByCode({});
        setOtherBatchesReservedByCode({});
      })
      .finally(() => setLoadingBatchReserveMaps(false));
  }, [batchPk, batch.bmrNo, batch.bprNo, type]);

  const items = type === 'rm'
    ? (batchItems.length > 0 ? batchItems : derivedRm)
    : (batchItems.length > 0 ? batchItems : derivedPm);
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
      const available = qtyAvailable(sih, reserved);
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
    items.forEach((it, i) => {
      const code = String(it.code ?? '').trim();
      const alreadyFull = batchLineFullyReserved(
        normalizeQtyForCompare(it.required, qtyKind),
        normalizeQtyForCompare(batchReservedByCode[code] ?? 0, qtyKind),
        qtyKind,
      );
      next[i] = alreadyFull ? false : selected[i] !== false;
    });
    setSelected(prev => (Object.keys(next).length ? next : prev));
  }, [items.length, reserveItemsFingerprint, batchReservedByCode, qtyKind]); // eslint-disable-line react-hooks/exhaustive-deps

  const linesToReserve = useMemo(
    () =>
      items.filter((it, i) => {
        if (selected[i] === false) return false;
        const code = String(it.code ?? '').trim();
        if (!code) return false;
        return !batchLineFullyReserved(
          normalizeQtyForCompare(it.required, qtyKind),
          normalizeQtyForCompare(batchReservedByCode[code] ?? 0, qtyKind),
          qtyKind,
        );
      }),
    [items, selected, batchReservedByCode, qtyKind],
  );

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (saving || !batchPk) return;
    const codesToReserve = linesToReserve
      .map((it) => String(it.code ?? '').trim())
      .filter(Boolean);
    if (codesToReserve.length === 0) {
      addToast('error', 'Select at least one RM/PM line that is not already fully reserved.');
      return;
    }
    // Short stock is no longer a blocker: the claim is recorded either way. Whatever the facility
    // can back is reserved now; the rest is queued and allocated automatically (oldest claim first)
    // as soon as the material is received.
    setSaving(true);
    try {
      const res = await reserveProductionBatchLines(batchPk, {
        kind: type === 'rm' ? 'RM' : 'PM',
        codes: codesToReserve,
      });
      if (!res.success) {
        addToast('error', res.error || 'Reserve failed');
        return;
      }
      await onReserved();
      const kindLabel = type === 'rm' ? 'RM' : 'PM';
      const okMsg = `Reserved ${codesToReserve.length} ${kindLabel} line(s) for ${formatUnifiedBatchLabel(batch)}`;
      const pending = res.pending ?? [];
      if (pending.length > 0) {
        const detail = pending.slice(0, 3).map((p) => `${p.code} ${p.pending} ${p.unit}`).join(', ');
        const more = pending.length > 3 ? ` +${pending.length - 3} more` : '';
        addToast(
          'info',
          `${okMsg} — ${pending.length} awaiting stock (${detail}${more}). These allocate automatically when the material is received.`,
        );
      } else {
        addToast('success', okMsg);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'rm' ? `Reserve RM — ${formatUnifiedBatchLabel(batch)}` : `Reserve PM — ${formatUnifiedBatchLabel(batch)}`;
  const alertMsg = type === 'rm'
    ? <>Reserve RM for batch <b>{formatUnifiedBatchLabel(batch)}</b> only. <b>Available = SIH − reserved by other batches.</b> This batch&apos;s own reservation is tracked separately and cannot be used by other batches. After reserving, use <b>RM Transfer</b> for this batch.</>
    : <>Reserve PM for batch <b>{formatUnifiedBatchLabel(batch)}</b> only. <b>Available = SIH − reserved by other batches.</b> Other production batches cannot consume this allocation.</>;

  const otherReservedForCode = (code: string): number => {
    const trimmed = String(code ?? '').trim();
    if (!trimmed) return 0;
    if (Object.prototype.hasOwnProperty.call(otherBatchesReservedByCode, trimmed)) {
      return otherBatchesReservedByCode[trimmed] ?? 0;
    }
    const global = reservedMap?.[trimmed] ?? 0;
    const self = batchReservedByCode[trimmed] ?? 0;
    return Math.max(0, global - self);
  };

  /** Reserve allocates warehouse free stock excluding other batches' RBI rows. */
  const itemHasWhShort = (r: DispensingItem) => {
    const code = String(r.code ?? '').trim();
    const sih = stockMap[code] ?? 0;
    const otherReserved = otherReservedForCode(code);
    const available = qtyAvailable(sih, otherReserved);
    return isQtyShort(available, r.required, qtyKind);
  };
  // Short lines are still highlighted, but they no longer disable Reserve: the shortfall becomes a
  // pending claim that the warehouse fills automatically (FIFO) when the material is received.
  const selectedShort = linesToReserve.some(itemHasWhShort);
  const shortCount = linesToReserve.filter(itemHasWhShort).length;
  const reserveDisabled = linesToReserve.length === 0 || loadingBatchReserveMaps || saving;
  const processOwnerText = (parts: { underGrn: number; inTransit: number; poOpen: number }) => {
    if (parts.underGrn > 0) return 'Contact Warehouse GRN/QC team';
    if (parts.inTransit > 0) return 'Contact Procurement logistics follow-up';
    if (parts.poOpen > 0) return 'Contact Procurement PO owner/vendor';
    return 'Check Planning/Procurement release and stock coding';
  };

  return (
    <Modal onClose={onClose} title={title} size="lg">
      <div className="rounded-lg border border-warn-soft bg-warn-soft text-warn px-3 py-2.5 flex gap-2 items-start text-xs mb-4">
        <div>{alertMsg}</div>
      </div>
      {selectedShort && (
        <div className="rounded-lg border border-brand-soft bg-brand-soft text-brand px-3 py-2.5 text-xs mb-4">
          <b>{shortCount} selected line(s) exceed free stock.</b> You can still reserve them — the
          available quantity is held now and the shortfall is queued against incoming stock. It is
          allocated to this batch automatically (oldest claim first) as soon as the material is received.
        </div>
      )}
      {(type === 'rm' && needLoadRm && loadingRm) || (type === 'pm' && needLoadPm && loadingPm) ? (
        <div className="py-6 text-center text-sm text-ink-3">Loading {type.toUpperCase()} requirements…</div>
      ) : null}
      {type === 'rm' && needLoadRm && !loadingRm && rmLoadError && (
        <div className="py-3 px-3 rounded-lg bg-warn-soft border border-warn-soft text-warn text-xs">{rmLoadError}</div>
      )}
      {items.length === 0 && !(type === 'rm' && needLoadRm && loadingRm) && !(type === 'pm' && needLoadPm && loadingPm) && (
        <div className="py-3 px-3 rounded-lg bg-surface-2 border border-border text-ink-2 text-xs">No {type.toUpperCase()} items for this batch. {type === 'rm' ? 'Ensure the product has a BOM with RM lines (same as RM & PM Availability tab).' : 'Ensure the product has a BOM with PM lines.'}</div>
      )}
      {items.length > 0 && (
        <div className="tbl-wrap overflow-auto max-h-[70vh] rounded-xl border border-hairline">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2">
              <th scope="col" className="px-3 py-2.5 w-10 text-left font-semibold text-ink-3"></th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">{type === 'rm' ? 'RM / INCI' : 'PM'}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">{type === 'rm' ? 'Required KG' : 'Required'}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">{type === 'rm' ? 'WH SIH' : 'SIH'}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Other batches</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">This batch</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Free</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-hairline">
              {items.map((r, i) => {
                const code = String(r.code ?? '').trim();
                const sih = stockMap[code] ?? 0;
                const otherReserved = otherReservedForCode(code);
                const thisBatchReserved = batchReservedByCode[code] ?? 0;
                const requiredQty = normalizeQtyForCompare(r.required, qtyKind);
                const available = qtyAvailable(
                  normalizeQtyForCompare(sih, qtyKind),
                  normalizeQtyForCompare(otherReserved, qtyKind),
                );
                const planningCoverage = planningCoverageByCode[code] ?? 0;
                const whOk = !isQtyShort(available, requiredQty, qtyKind);
                const alreadyFull = batchLineFullyReserved(requiredQty, thisBatchReserved, qtyKind);
                const checked = alreadyFull || selected[i] !== false;
                const stageRows = (inventoryRows ?? []).filter((row) =>
                  row.type === (type === 'rm' ? 'RM' : 'PM') && String(row.code ?? '').trim() === code
                );
                const inTransitStage = stageRows.reduce((s, row) => s + (Number(row.inTransit) || 0), 0);
                const underGrnStage = stageRows.reduce((s, row) => s + (Number((row as WarehouseInventoryRow & { underGrn?: number }).underGrn) || 0), 0);
                const poOpenStage = stageRows.reduce((s, row) => s + (Number(row.poQuantity) || 0), 0);
                const shortageQty = calcShortageQtyForKind(available, requiredQty, qtyKind);
                return (
                  <tr key={i} className={!whOk ? 'bg-err-soft/50' : ''}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        id={`res-${i}`}
                        checked={checked}
                        disabled={alreadyFull}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                        className="rounded border-border text-warn focus:ring-warn disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-ink">{r.inci || r.name || r.code}</div>
                      <div className="text-[9px] text-ink-3">{r.code}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold">{fmtQtyU(requiredQty)}</td>
                    <td className="px-3 py-2.5 font-mono text-ink-2">{fmtQtyU(sih)}</td>
                    <td className="px-3 py-2.5 font-mono text-warn" title="Reserved by other BMR/BPR batches">{fmtQtyU(otherReserved)}</td>
                    <td className="px-3 py-2.5 font-mono text-brand" title="Already reserved for this batch">{fmtQtyU(thisBatchReserved)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${whOk ? 'text-ok' : 'text-err'}`} title="SIH minus other batches' reservation">{fmtQtyU(available)}</td>
                    <td className="px-3 py-2.5">
                      {alreadyFull ? (
                        <Badge className="bg-brand-soft text-brand text-[8.5px]">Fully reserved</Badge>
                      ) : whOk ? (
                        <Badge className="bg-ok-soft text-ok text-[8.5px]">OK</Badge>
                      ) : (
                        <div className="space-y-1.5">
                          <span title={`Planning Items Involved coverage (reference): ${planningCoverage}%. Reserve still needs WH available ≥ required.`}>
                            <Badge className="bg-err-soft text-err text-[8.5px]"><AlertTriangle size={10} /> Short</Badge>
                          </span>
                          <div className="text-[10px] leading-tight text-err">
                            <div>
                              Short {formatQtyShortage(shortageQty, qtyKind)} {unit} | Under GRN {fmtQty(underGrnStage)} | In Transit {fmtQty(inTransitStage)} | PO open {fmtQty(poOpenStage)}
                            </div>
                            {!whOk && (
                              <div className="text-[9px] text-err/90 font-mono">
                                Need {fmtQtyU(requiredQty)} · Free {fmtQtyU(available)}
                                {shortageQty > 0 ? ` · Gap ${formatQtyShortage(shortageQty, qtyKind)} ${unit}` : null}
                              </div>
                            )}
                            <div className="text-[9px] text-err/80">
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
      <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-4 border-t border-hairline">
        {selectedShort && (
          <span className="text-xs text-err font-medium mr-auto">
            Cannot reserve selected lines — free stock (SIH − other batches&apos; reservation) is below required.
          </span>
        )}
        <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSave()} disabled={reserveDisabled} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-warn hover:bg-warn text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <><Loader2 size={13} className="animate-spin" /> Reserving…</> : <>Reserve selected ({linesToReserve.length})</>}
        </button>
      </div>
    </Modal>
  );
}

/* ──────────── SMART SCHEDULE MODAL ─────────────────────────── */

interface SalesOrderOption { orderId: string; customerName?: string; }

function ScheduleModal({ batch: initialBatch, equipment, batches, team, stockRM, stockPM, inventoryRows, sentSummary, onClose, onSave, onBatchChange }: {
  batch: Batch | null; equipment: EquipmentData; batches: Batch[];
  team: TeamMember[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  inventoryRows?: WarehouseInventoryRow[];
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
  const schedulableForSo = batchesForSo.filter(b => !hasProductionBatchSchedule(b));

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
  const fillList = equipment?.filling ?? [];
  const packList = equipment?.packaging ?? [];
  const batchForCompat = batch ?? { batchSize: 0, fillingType: 'bottle' as const };
  const compatV = batch ? resolveScheduleEquipIds(getCompatibleVesselIds(batchForCompat, mfgList), mfgList.filter((e) => e.type !== 'support').map((e) => e.id)) : [];
  const compatF = batch ? resolveScheduleEquipIds(getCompatibleFillLineIds(batchForCompat, fillList), fillList.map((e) => e.id)) : [];
  const compatP = batch ? resolveScheduleEquipIds(getCompatiblePackLineIds(batchForCompat, packList), packList.map((e) => e.id)) : [];
  const compatSupport = mfgList.filter((e) => e.type === 'support').map((e) => e.id);

  const scheduledBatchesForOccupancy = useMemo(
    () => batches.map((b) => ({
      mainVessel: b.mainVessel,
      mfgDate: b.mfgDate,
      supportingTanks: b.supportingTanks,
      fillingLine: b.fillingLine,
      fillDate: b.fillDate,
      packagingLine: b.packagingLine,
      packDate: b.packDate,
      bmrNo: b.bmrNo,
    })),
    [batches],
  );

  const scheduledBatchesWithUnits = useMemo(() => toScheduledBatchesWithUnits(batches), [batches]);
  const batchWithUnits = batch
    ? { ...batch, ...getBatchFillPackUnits(batch), bmrNo: batch.bmrNo }
    : null;
  const bestRecommendation = batchWithUnits
    ? computeBestScheduleRecommendation(batchWithUnits, equipment, scheduledBatchesWithUnits)
    : null;

  const materialsAvailability = useMemo((): BatchMaterialsAvailableBySummary | null => {
    if (!batch) return null;
    return computeBatchMaterialsAvailableBy(
      batch.dispensingRM,
      batch.dispensingPM,
      warehouseRowsForMaterialAvailability(inventoryRows),
      today(),
    );
  }, [batch?.bmrNo, batch?.dispensingRM, batch?.dispensingPM, inventoryRows]);

  const earliestMfgAfterRm = materialsAvailability?.maxRmAvailableBy
    ? earliestMfgDateAfterRmAvailable(materialsAvailability.maxRmAvailableBy)
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
  const [supportingTanks, setSupportingTanks] = useState<string[]>(batch?.supportingTanks ?? []);
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  const [scheduledMuZone, setScheduledMuZone] = useState(batch?.scheduledMuZone || '');
  const [scheduleRemarks, setScheduleRemarks] = useState(batch?.scheduleRemarks || '');
  const [teamAssignment, setTeamAssignment] = useState<ScheduleTeamAssignmentState>(() =>
    scheduleTeamStateFromBatch(initialBatch ?? {}),
  );

  const allProductionZones = useMemo(
    () => productionAreas.flatMap((a) => a.zones || []),
    [productionAreas],
  );

  useEffect(() => {
    fetchFacilityAreas('production').then((res) => {
      setProductionAreas(res.data || []);
    });
  }, []);

  useEffect(() => {
    if (!batch) return;
    const todayIso = today();
    const mfg = batch.mfgDate || todayIso;
    const fill = batch.fillDate || addDaysStr(mfg, 3);
    const maxRm = materialsAvailability?.maxRmAvailableBy ?? null;
    const maxPm = materialsAvailability?.maxPmAvailableBy ?? null;
    setMfgDate(mfg);
    setFillDate(fill);
    setPackDate(batch.packDate || addDaysStr(fill, 1));
    setFgDate(batch.fgDate || addDaysStr(batch.packDate || addDaysStr(fill, 1), 1));
    setRmDate(batch.rmConnectDate || suggestedRmConnectDate(mfg, maxRm, todayIso));
    setPmDate(batch.pmConnectDate || suggestedPmConnectDate(fill, maxPm, todayIso));
    setVessel(batch.mainVessel || compatV[0] || '');
    setFillLine(batch.fillingLine || compatF[0] || '');
    setPackLine(batch.packagingLine || compatP[0] || '');
    setSupportingTanks(batch.supportingTanks ?? []);
    setScheduledMuZone(batch.scheduledMuZone || '');
    setScheduleRemarks(batch.scheduleRemarks || '');
    setTeamAssignment(scheduleTeamStateFromBatch(batch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    batch?.bmrNo,
    batch?.mfgDate,
    batch?.fillDate,
    batch?.packDate,
    batch?.fgDate,
    batch?.rmConnectDate,
    batch?.pmConnectDate,
    batch?.mainVessel,
    batch?.fillingLine,
    batch?.packagingLine,
    batch?.supportingTanks,
    materialsAvailability?.maxRmAvailableBy,
    materialsAvailability?.maxPmAvailableBy,
  ]);

  useEffect(() => {
    if (scheduledMuZone || allProductionZones.length === 0) return;
    const defaultZone = allProductionZones.find((z) => z.isDefault) ?? allProductionZones[0];
    if (defaultZone?.code) setScheduledMuZone(defaultZone.code);
  }, [allProductionZones, scheduledMuZone]);

  const scheduleEquipmentValidation = useMemo(() => {
    if (!batch) return { ok: false, errors: [] as string[] };
    return validateScheduleEquipmentReservation(
      {
        mainVessel: vessel,
        fillingLine: fillLine,
        packagingLine: packLine,
        supportingTanks,
        mfgDate,
        fillDate,
        packDate,
      },
      scheduledBatchesForOccupancy,
      batch.bmrNo,
    );
  }, [batch, vessel, fillLine, packLine, supportingTanks, mfgDate, fillDate, packDate, scheduledBatchesForOccupancy]);

  const pickFirstFreeEquipment = (
    ids: string[],
    stageDate: string,
  ): string => ids.find((id) => isEquipFreeOnDate(scheduledBatchesForOccupancy, id, stageDate, batch?.bmrNo)) ?? '';

  useEffect(() => {
    if (!batch || !mfgDate || compatV.length === 0) return;
    if (vessel && isEquipFreeOnDate(scheduledBatchesForOccupancy, vessel, mfgDate, batch.bmrNo)) return;
    const next = pickFirstFreeEquipment(compatV, mfgDate);
    if (next !== vessel) setVessel(next);
  }, [batch?.bmrNo, mfgDate, compatV, scheduledBatchesForOccupancy]);

  useEffect(() => {
    if (!batch || !fillDate || compatF.length === 0) return;
    if (fillLine && isEquipFreeOnDate(scheduledBatchesForOccupancy, fillLine, fillDate, batch.bmrNo)) return;
    const next = pickFirstFreeEquipment(compatF, fillDate);
    if (next !== fillLine) setFillLine(next);
  }, [batch?.bmrNo, fillDate, compatF, scheduledBatchesForOccupancy]);

  useEffect(() => {
    if (!batch || !packDate || compatP.length === 0) return;
    if (packLine && isEquipFreeOnDate(scheduledBatchesForOccupancy, packLine, packDate, batch.bmrNo)) return;
    const next = pickFirstFreeEquipment(compatP, packDate);
    if (next !== packLine) setPackLine(next);
  }, [batch?.bmrNo, packDate, compatP, scheduledBatchesForOccupancy]);

  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(suggestedRmConnectDate(val, materialsAvailability?.maxRmAvailableBy ?? null, today()));
    const f = addDaysStr(val, 3);
    setFillDate(f);
    setPmDate(suggestedPmConnectDate(f, materialsAvailability?.maxPmAvailableBy ?? null, today()));
    const p = addDaysStr(f, 1);
    setPackDate(p);
    setFgDate(addDaysStr(p, 1));
  };

  const buildSchedulePayload = (dates: {
    mfgDate: string; fillDate: string; packDate: string; fgDate: string;
    rmConnectDate: string; pmConnectDate: string;
    mainVessel: string; fillingLine: string; packagingLine: string;
    supportingTanks?: string[];
  }): Partial<Batch> => {
    if (!batch) return {};
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    return {
      ...dates,
      supportingTanks: dates.supportingTanks ?? supportingTanks,
      scheduledMuZone: String(scheduledMuZone || '').trim(),
      scheduleRemarks: String(scheduleRemarks || '').trim(),
      ...scheduleTeamPayloadFromState(teamAssignment),
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    };
  };

  const handleSave = () => {
    if (!batch || !mfgDate) return;
    if (!String(scheduledMuZone || '').trim()) return;
    if (!scheduleEquipmentValidation.ok) return;
    onSave(buildSchedulePayload({
      mfgDate, fillDate, packDate, fgDate, rmConnectDate: rmDate, pmConnectDate: pmDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine, supportingTanks,
    }));
    onClose();
  };

  const handleConfirmRecommendation = () => {
    if (!batch || !bestRecommendation) return;
    if (!String(scheduledMuZone || '').trim()) return;
    const recValidation = validateScheduleEquipmentReservation(
      {
        mainVessel: bestRecommendation.vessel,
        fillingLine: bestRecommendation.fillLine,
        packagingLine: bestRecommendation.packLine,
        supportingTanks,
        mfgDate: bestRecommendation.mfgDate,
        fillDate: bestRecommendation.fillDate,
        packDate: bestRecommendation.packDate,
      },
      scheduledBatchesForOccupancy,
      batch.bmrNo,
    );
    if (!recValidation.ok) return;
    const todayIso = today();
    onSave(buildSchedulePayload({
      mfgDate: bestRecommendation.mfgDate,
      fillDate: bestRecommendation.fillDate,
      packDate: bestRecommendation.packDate,
      fgDate: bestRecommendation.fgDate,
      rmConnectDate: suggestedRmConnectDate(
        bestRecommendation.mfgDate,
        materialsAvailability?.maxRmAvailableBy ?? null,
        todayIso,
      ),
      pmConnectDate: suggestedPmConnectDate(
        bestRecommendation.fillDate,
        materialsAvailability?.maxPmAvailableBy ?? null,
        todayIso,
      ),
      mainVessel: bestRecommendation.vessel,
      fillingLine: bestRecommendation.fillLine,
      packagingLine: bestRecommendation.packLine,
      supportingTanks,
    }));
    onClose();
  };

  const handleUnschedule = () => {
    if (!batch || !confirm(`Clear schedule for ${formatUnifiedBatchLabel(batch)}? Dates, manufacturing site, and equipment assignments will be removed.`)) return;
    const lockedBmr: BMRStatus[] = ['rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'];
    onSave({
      mfgDate: '', fillDate: '', packDate: '', fgDate: '', rmConnectDate: '', pmConnectDate: '',
      mainVessel: '', fillingLine: '', packagingLine: '', supportingTanks: [],
      scheduledMuZone: '', scheduleRemarks: '',
      ...(lockedBmr.includes(batch.bmrStatus)
        ? {}
        : { bmrStatus: batch.bmrStatus === 'draft' ? 'draft' : batch.rmReserved ? 'rm_reserved' : 'batch_confirmed' }),
    });
    onClose();
  };

  const scheduledSiteLabel = zoneLabelInAreas(productionAreas, scheduledMuZone);

  const equipmentReserveSelect = (
    label: string,
    borderClass: string,
    stageDate: string,
    equipList: string[],
    equipVal: string,
    setEquip: (v: string) => void,
    equipKind: 'mfg' | 'fill' | 'pack',
  ) => (
    <div className={`rounded-lg border ${borderClass} bg-surface/70 px-3 py-2`}>
      <label className={LBL}>{label}</label>
      <select
        className={INP}
        value={equipVal}
        onChange={(e) => setEquip(e.target.value)}
      >
        <option value="">— Select equipment —</option>
        {equipList.map((id) => {
          const free = !stageDate || isEquipFreeOnDate(scheduledBatchesForOccupancy, id, stageDate, batch?.bmrNo);
          const occupiedOn = stageDate
            ? getEquipmentOccupiedOnDate(scheduledBatchesForOccupancy, id, stageDate, batch?.bmrNo)
            : null;
          return (
            <option key={id} value={id} disabled={!free && id !== equipVal}>
              {id} · {getEquipDisplayName(equipment, id, equipKind)}{' '}
              {free ? '(Free)' : occupiedOn ? `(Available from ${equipmentAvailableFromDate(occupiedOn)})` : '(Busy)'}
            </option>
          );
        })}
      </select>
      <div className="text-[10px] text-ink-3 mt-1">Stage date: {stageDate || '—'}</div>
      {equipList.length === 0 && (
        <p className="text-[10px] text-warn mt-1">No lines configured — add under Production → Equipment.</p>
      )}
    </div>
  );

  const scheduleRow = (
    icon: React.ReactNode,
    label: string,
    color: string,
    dateVal: string,
    setDate: (v: string) => void,
  ) => (
    <div className={`grid grid-cols-[auto_1fr_1fr] gap-3 items-center px-4 py-3 rounded-xl border mb-2 ${color}`}>
      <span className="text-ink-3">{icon}</span>
      <div className="text-[11px] font-bold text-ink-2">{label}</div>
      <div><label className={LBL}>Date</label><input type="date" className={INP} value={dateVal} onChange={e => setDate(e.target.value)} /></div>
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

      {!initialBatch && (
        <>
          {/* Batch selector (filtered by SO) */}
          <div className="mb-4">
            <label className={LBL}>Select Batch</label>
            <select
              className={INP}
              value={batch?.bmrNo ?? ''}
              onChange={e => handleBatchSwitch(e.target.value)}
              disabled={!selectedSoId}
            >
              <option value="">-- Select batch --</option>
              {batchesForSo.map(b => (
                <option key={b.bmrNo} value={b.bmrNo}>
                  {formatUnifiedBatchLabel(b)} — {b.productName} ({b.batchSize} KG) [{bmrStatusLabel[b.bmrStatus]}]{b.mfgDate ? ` · ${b.mfgDate}` : ''}
                </option>
              ))}
            </select>
            {selectedSoId && batchesForSo.length === 0 && (
              <p className="text-xs text-warn mt-1">No batches found for this SO. Create batches for this SO first (e.g. from Planning).</p>
            )}
          </div>
        </>
      )}

      {!batch && (
        <>
          <p className="text-sm text-ink-3 mb-4">Select a Sales Order and a batch above to set the schedule.</p>
          <div className="flex justify-end pt-4 border-t border-hairline">
            <button onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
          </div>
        </>
      )}

      {batch && (
        <>
          <ScheduleYieldContextBanner batch={batch} />
          <div className="mb-5 rounded-2xl border border-brand-soft bg-brand-soft/30 p-4">
            <SectionLabel icon={<Factory size={13} />} color="text-brand">Manufacturing site &amp; plan</SectionLabel>
            <Tip color="teal" icon={<MapPin size={14} />}>
              Choose where this batch will run. <b>MTR transfers</b> will send RM/PM to this manufacturing unit (ML) automatically.
            </Tip>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className={LBL}>Manufacturing location (MU zone) <span className="text-err">*</span></label>
                <select
                  className={INP}
                  value={scheduledMuZone}
                  onChange={(e) => setScheduledMuZone(e.target.value)}
                  required
                >
                  <option value="">— Select manufacturing site —</option>
                  {productionAreas.map((a) => (
                    <optgroup key={a.id} label={`${a.name} (manufacturing unit)`}>
                      {(a.zones || []).map((z) => (
                        <option key={z.code} value={z.code}>
                          {z.name}{z.zoneLabel ? ` — ${z.zoneLabel}` : ''} ({z.code})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {allProductionZones.length === 0 && (
                  <p className="text-[10px] text-warn mt-1">Add manufacturing zones under Masters → Facility Management.</p>
                )}
              </div>
              <div>
                <label className={LBL}>Planned manufacturing date</label>
                <div className="text-sm font-semibold text-ink mt-1.5">{mfgDate || '—'}</div>
                <p className="text-[10px] text-ink-3 mt-0.5">Set in Stage 1 below. Batch confirmation is allowed on or after this date.</p>
              </div>
            </div>
            <div className="mt-3">
              <label className={LBL}>Schedule notes / other details</label>
              <textarea
                className={`${INP} min-h-16 resize-y`}
                value={scheduleRemarks}
                onChange={(e) => setScheduleRemarks(e.target.value)}
                placeholder="Shift, line constraints, special handling, contact on site…"
              />
            </div>
            {scheduledMuZone && (
              <p className="text-[10px] text-brand mt-2">
                MTR receive zone: <b>{scheduledSiteLabel}</b> ({scheduledMuZone})
              </p>
            )}
          </div>
          {bprAwaitingBmrRelease(batch) && (
            <Tip color="amber" icon={<Calendar size={14} />}>
              BMR is not cleared yet — you can still <b>move fill, pack, and FG dates</b> here if the BPR plan slips while waiting on bulk QC release.
            </Tip>
          )}
          {/* Recommended schedule from occupancy + volume (MV/FL/PL capacity vs batch volume) */}
          {bestRecommendation && !isScheduled && (
            <div className="rounded-xl border border-ok-soft bg-ok-soft/30 p-4 mb-5">
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[10px] font-bold text-ink-2 uppercase tracking-wider">Recommended schedule (by occupancy &amp; volume)</div>
                <span className="text-[10px] font-bold text-ok bg-ok-soft px-2 py-0.5 rounded-full">{bestRecommendation.confidenceScore}% optimal</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-ok-soft/60 border border-ok-soft/60 mb-2">
                <div>
                  <div className="text-[9px] text-ink-3 mb-0.5">Manufacturing</div>
                  <div className="text-[11.5px] font-bold text-brand">{bestRecommendation.vesselName}</div>
                  <div className="text-[10px] text-ink-3">{bestRecommendation.mfgDate}</div>
                </div>
                <div>
                  <div className="text-[9px] text-ink-3 mb-0.5">Filling</div>
                  <div className="text-[11.5px] font-bold text-brand">{bestRecommendation.fillLineName}</div>
                  <div className="text-[10px] text-ink-3">{bestRecommendation.fillDate}</div>
                </div>
                <div>
                  <div className="text-[9px] text-ink-3 mb-0.5">Packaging</div>
                  <div className="text-[11.5px] font-bold text-ok">{bestRecommendation.packLineName}</div>
                  <div className="text-[10px] text-ink-3">{bestRecommendation.packDate}</div>
                </div>
              </div>
              {(batch.requiredVolumeLiters != null || (bestRecommendation.vessel && equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)?.cap != null)) && (
                <div className="text-[10px] text-ink-2 mb-2">
                  {batch.requiredVolumeLiters != null && <span className="mr-3">Batch volume: <b>{batch.requiredVolumeLiters.toFixed(1)} L</b></span>}
                  {bestRecommendation.vessel && equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)?.cap != null && (
                    <span>Vessel capacity: <b>{equipment.manufacturing.find(e => e.id === bestRecommendation.vessel)!.cap} L</b></span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {bestRecommendation.reasons.map((r, i) => (
                  <div key={i} className="flex-1 min-w-0 text-[9.5px] text-ink-2 bg-surface/60 rounded px-2 py-1 border border-hairline">{r}</div>
                ))}
              </div>
              <button type="button" onClick={handleConfirmRecommendation} className="w-full py-2.5 rounded-lg bg-ok hover:bg-ok text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <Check size={14} /> One-click confirm
              </button>
            </div>
          )}

          {/* Material Availability from DB */}
          <div className="mb-5">
            <SectionLabel icon={<Package size={13} />} color="text-brand">Material Availability - Warehouse Inventory</SectionLabel>
            {materialsAvailability && batch.dispensingRM.length > 0 && (
              <div className="mb-3 rounded-xl border border-brand-soft bg-brand-soft/80 px-4 py-3">
                <p className="text-xs font-bold text-brand">
                  All RM available at WH by:{' '}
                  {materialsAvailability.maxRmAvailableBy ? (
                    <span className="font-mono text-sm">{formatMaterialAvailableByLabel(materialsAvailability.maxRmAvailableBy)}</span>
                  ) : materialsAvailability.rmIncomplete ? (
                    <span className="text-warn">Pending — some RMs lack GRN/PO arrival dates</span>
                  ) : (
                    <span className="text-ok">Now (warehouse covers batch)</span>
                  )}
                </p>
                <p className="text-[10px] text-brand/90 mt-1 leading-relaxed">
                  Schedule manufacturing after the latest RM arrival. Uses WH stock, Under GRN, in-transit GRN/PO ETAs, and open PO pipeline.
                  {earliestMfgAfterRm ? (
                    <>
                      {' '}
                      Earliest suggested MFG: <span className="font-semibold font-mono">{formatMaterialAvailableByLabel(earliestMfgAfterRm)}</span>
                    </>
                  ) : null}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SectionLabel icon={<FlaskConical size={12} />} color="text-brand">Raw Materials</SectionLabel>
                {batch.dispensingRM.length > 0 ? (
                  <div className="overflow-auto max-h-[70vh] rounded-xl border border-hairline text-xs">
                    <table className="w-full"><thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2"><th scope="col" className="px-2 py-1.5 text-left font-semibold text-ink-3">RM</th><th scope="col" className="px-2 py-1.5 text-left">Req</th><th scope="col" className="px-2 py-1.5 text-left">SIH</th><th scope="col" className="px-2 py-1.5 text-left whitespace-nowrap">Available by</th><th scope="col" className="px-2 py-1.5 text-left">Status</th></tr></thead>
                      <tbody className="divide-y divide-hairline">{batch.dispensingRM.map((r, i) => {
                        const sih = stockRM[r.code] ?? 0; const ok = !isQtyShort(sih, r.required);
                        const availBy = lookupMaterialAvailableBy(materialsAvailability, r.code, 'rm');
                        return <tr key={i} className={!ok ? 'bg-err-soft/50' : ''}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 font-mono">{formatQtyExact(r.required, 'kg')}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-ok' : 'text-err'}`}>{formatQtyExact(sih, 'kg')}</td><td className="px-2 py-1.5 font-medium text-brand whitespace-nowrap">{availBy}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-ok-soft text-ok">OK</Badge> : <Badge className="bg-err-soft text-err">Short</Badge>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-ink-4 italic">No RM items on this batch</p>}
              </div>
              <div>
                <SectionLabel icon={<Package size={12} />} color="text-brand">Packaging Materials</SectionLabel>
                {batch.dispensingPM.length > 0 ? (
                  <div className="overflow-auto max-h-[70vh] rounded-xl border border-hairline text-xs">
                    <table className="w-full"><thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2"><th scope="col" className="px-2 py-1.5 text-left font-semibold text-ink-3">PM</th><th scope="col" className="px-2 py-1.5 text-left">Req</th><th scope="col" className="px-2 py-1.5 text-left">SIH</th><th scope="col" className="px-2 py-1.5 text-left whitespace-nowrap">Available by</th><th scope="col" className="px-2 py-1.5 text-left">Status</th></tr></thead>
                      <tbody className="divide-y divide-hairline">{batch.dispensingPM.map((p, i) => {
                        const sih = stockPM[p.code] ?? 0; const ok = !isQtyShort(sih, p.required);
                        const availBy = lookupMaterialAvailableBy(materialsAvailability, p.code, 'pm');
                        return <tr key={i} className={!ok ? 'bg-err-soft/50' : ''}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 font-mono">{formatQtyExact(p.required, 'pcs')}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-ok' : 'text-err'}`}>{formatQtyExact(sih, 'pcs')}</td><td className="px-2 py-1.5 font-medium text-brand whitespace-nowrap">{availBy}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-ok-soft text-ok">OK</Badge> : <Badge className="bg-err-soft text-err">Short</Badge>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-ink-4 italic">No PM items on this batch</p>}
              </div>
            </div>
          </div>

          {/* Sequential Schedule */}
          <div className="border border-brand-soft rounded-2xl p-5 bg-brand-soft/20">
            <SectionLabel icon={<Calendar size={13} />} color="text-brand">Sequential Schedule - Manufacturing {'>'} Filling {'>'} Packaging</SectionLabel>
            <Tip color="teal" icon={<Sparkles size={14} />}>System auto-suggested dates based on equipment availability. Adjust if needed.</Tip>

            {scheduleRow(<FlaskConical size={16} />, 'STAGE 1 - Manufacturing', 'border-brand-soft bg-brand-soft/40', mfgDate, handleMfgChange)}

            <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-brand-soft bg-brand-soft/50 mb-2">
              <Package size={14} className="text-brand" />
              <div>
                <div className="text-[10px] text-brand font-bold">RM will be available at WH by</div>
                <div className="text-[9px] text-brand/80">Latest date across all batch RMs (warehouse + pipeline)</div>
              </div>
              <div>
                <div className="text-sm font-bold text-brand font-mono mb-1">
                  {materialsAvailability?.maxRmAvailableBy
                    ? formatMaterialAvailableByLabel(materialsAvailability.maxRmAvailableBy)
                    : materialsAvailability?.allRmCoveredNow
                      ? 'Now'
                      : 'Pending ETA'}
                </div>
                <label className={LBL}>RM connect date</label>
                <input type="date" className={INP} value={rmDate} onChange={e => setRmDate(e.target.value)} />
              </div>
              <div className="text-[10px] text-brand/90 leading-snug">
                {earliestMfgAfterRm && mfgDate && mfgDate < earliestMfgAfterRm ? (
                  <span className="font-semibold text-warn">MFG is before all RM are ready — move MFG to {formatMaterialAvailableByLabel(earliestMfgAfterRm)} or later.</span>
                ) : (
                  <>Prefilled from latest RM arrival (or 2 days before MFG).</>
                )}
              </div>
            </div>

            {scheduleRow(<Droplets size={16} />, 'STAGE 2 - Filling', 'border-brand-soft bg-brand-soft/40', fillDate, setFillDate)}

            <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-hairline bg-surface-2/50 mb-2">
              <Package size={14} className="text-ink-4" />
              <div>
                <div className="text-[10px] text-ink-3 font-semibold">PM available at WH by</div>
                <div className="text-[9px] text-ink-4">Latest across all batch PMs</div>
              </div>
              <div>
                <div className="text-sm font-bold text-brand font-mono mb-1">
                  {materialsAvailability?.maxPmAvailableBy
                    ? formatMaterialAvailableByLabel(materialsAvailability.maxPmAvailableBy)
                    : materialsAvailability?.allPmCoveredNow
                      ? 'Now'
                      : 'Pending ETA'}
                </div>
                <label className={LBL}>PM connect date</label>
                <input type="date" className={INP} value={pmDate} onChange={e => setPmDate(e.target.value)} />
              </div>
              <div className="text-[10px] text-ink-4">Prefilled from latest PM arrival (or 2 days before Fill)</div>
            </div>

            {scheduleRow(<Package size={16} />, 'STAGE 3 - Packaging', 'border-ok-soft bg-ok-soft/40', packDate, setPackDate)}

            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2.5 rounded-xl border border-brand-soft bg-brand-soft/40">
              <CheckCircle2 size={16} className="text-brand" /><div className="text-[11px] font-bold text-brand">FG Ready</div>
              <div><label className={LBL}>FG Date</label><input type="date" className={INP} value={fgDate} onChange={e => setFgDate(e.target.value)} /></div>
              <div></div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4 px-3 py-2.5 rounded-xl bg-ok-soft border border-ok-soft text-xs text-ok">
              <span>MFG: <b>{mfgDate}</b></span><span>Fill: <b>{fillDate}</b></span><span>Pack: <b>{packDate}</b></span>
              <span>FG: <b>{fgDate}</b></span><span>RM@WH: <b>{rmDate}</b></span><span>PM@WH: <b>{pmDate}</b></span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-brand-soft bg-brand-soft/30 p-4">
            <SectionLabel icon={<Factory size={13} />} color="text-brand">Equipment reservation</SectionLabel>
            <p className="text-[10px] text-brand/80 mb-3">
              Select vessel, fill line, and pack line for the stage dates above. Equipment reserved on a date is available for other batches from the next day onward.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {equipmentReserveSelect('Manufacturing vessel', 'border-brand-soft', mfgDate, compatV, vessel, setVessel, 'mfg')}
              {equipmentReserveSelect('Filling line', 'border-brand-soft', fillDate, compatF, fillLine, setFillLine, 'fill')}
              {equipmentReserveSelect('Packaging line', 'border-ok-soft', packDate, compatP, packLine, setPackLine, 'pack')}
            </div>
            {compatSupport.length > 0 && (
              <div className="mt-3 px-3 py-3 rounded-lg border border-brand-soft bg-surface/70">
                <div className="text-[10px] font-bold text-brand mb-2">Supporting tanks (MFG date)</div>
                <div className="flex flex-wrap gap-2">
                  {compatSupport.map((id) => {
                    const eq = mfgList.find((e) => e.id === id);
                    const checked = supportingTanks.includes(id);
                    const free = !mfgDate || isEquipFreeOnDate(scheduledBatchesForOccupancy, id, mfgDate, batch?.bmrNo);
                    const occupiedOn = mfgDate
                      ? getEquipmentOccupiedOnDate(scheduledBatchesForOccupancy, id, mfgDate, batch?.bmrNo)
                      : null;
                    return (
                      <label
                        key={id}
                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked ? 'border-brand-soft bg-brand-soft' : 'border-border bg-surface hover:bg-surface-2'
                        } ${!free && !checked ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={checked}
                          disabled={!free && !checked}
                          onChange={() => setSupportingTanks((prev) => (
                            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                          ))}
                        />
                        <span className="font-semibold text-ink">
                          {id}{eq?.cap != null ? ` (${eq.cap}L)` : ''}{' '}
                          <span className={free || checked ? 'text-ok' : 'text-err'}>
                            {free ? '(Free)' : occupiedOn ? `(From ${equipmentAvailableFromDate(occupiedOn)})` : '(Busy)'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {(vessel || fillLine || packLine) && (
              <p className="text-[10px] text-brand mt-3">
                Reserved:{' '}
                <b>
                  {vessel ? `${vessel} (${mfgDate})` : '—'}
                  {fillLine ? ` · ${fillLine} (${fillDate})` : ''}
                  {packLine ? ` · ${packLine} (${packDate})` : ''}
                </b>
              </p>
            )}
            {!scheduleEquipmentValidation.ok && (
              <ul className="mt-3 space-y-1" role="alert">
                {scheduleEquipmentValidation.errors.map((err) => (
                  <li key={err} className="text-xs text-err flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ScheduleTeamAssignmentSection
            team={team}
            value={teamAssignment}
            onChange={setTeamAssignment}
          />

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-hairline">
            <div>
              {isScheduled && (
                <button onClick={handleUnschedule} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-err border border-err-soft rounded-lg hover:bg-err-soft transition-colors"><X size={12} /> Unschedule</button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
              <button type="button" onClick={handleSave} disabled={!batch || !mfgDate || !String(scheduledMuZone || '').trim() || !scheduleEquipmentValidation.ok} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-brand hover:bg-brand text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><CheckCircle2 size={13} /> {isScheduled ? 'Update Schedule' : 'Save Schedule & Reserve Equipment'}</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ──────────── SMART SCHEDULE MODAL (from calendar cell) ─────── */

function SmartScheduleModal({ slot, batch: initialBatch, equipment, batches, team, stockRM, stockPM, inventoryRows, sentSummary, onClose, onSave, onBatchChange, onRequestVesselSplit }: {
  slot: ScheduleSlot; batch: Batch | null; equipment: EquipmentData; batches: Batch[];
  team: TeamMember[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  inventoryRows?: WarehouseInventoryRow[];
  sentSummary: SentBatchSummaryRow[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onBatchChange: (bmrNo: string) => void;
  onRequestVesselSplit?: (batch: Batch, vesselCapacityLiters: number) => void;
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

  const materialsAvailability = useMemo((): BatchMaterialsAvailableBySummary | null => {
    if (!batch) return null;
    return computeBatchMaterialsAvailableBy(
      batch.dispensingRM,
      batch.dispensingPM,
      warehouseRowsForMaterialAvailability(inventoryRows),
      today(),
    );
  }, [batch?.bmrNo, batch?.dispensingRM, batch?.dispensingPM, inventoryRows]);

  const earliestMfgAfterRm = materialsAvailability?.maxRmAvailableBy
    ? earliestMfgDateAfterRmAvailable(materialsAvailability.maxRmAvailableBy)
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
          const product = res.data.find((p: { zoho_sku_code?: string; product_sku?: string; product_name?: string }) => (p.zoho_sku_code ?? p.product_sku) === batch!.sku || p.product_name === batch!.productName);
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
  const [teamAssignment, setTeamAssignment] = useState<ScheduleTeamAssignmentState>(() =>
    scheduleTeamStateFromBatch(initialBatch ?? {}),
  );

  useEffect(() => {
    if (batch) setTeamAssignment(scheduleTeamStateFromBatch(batch));
  }, [batch?.bmrNo]);

  useEffect(() => {
    if (!recommendation) return;
    const todayIso = today();
    const mfg = recommendation.mfgDate ?? todayIso;
    const fill = recommendation.fillDate ?? addDaysStr(todayIso, 3);
    const maxRm = materialsAvailability?.maxRmAvailableBy ?? null;
    const maxPm = materialsAvailability?.maxPmAvailableBy ?? null;
    setMfgDate(mfg);
    setFillDate(fill);
    setPackDate(recommendation.packDate ?? addDaysStr(todayIso, 4));
    setFgDate(recommendation.fgDate ?? addDaysStr(todayIso, 5));
    setRmDate(suggestedRmConnectDate(mfg, maxRm, todayIso));
    setPmDate(suggestedPmConnectDate(fill, maxPm, todayIso));
    setVessel(recommendation.vessel ?? '');
    setFillLine(recommendation.fillLine ?? '');
    setPackLine(recommendation.packLine ?? '');
  }, [
    recommendation?.mfgDate,
    recommendation?.fillDate,
    recommendation?.packDate,
    recommendation?.vessel,
    recommendation?.fillLine,
    recommendation?.packLine,
    materialsAvailability?.maxRmAvailableBy,
    materialsAvailability?.maxPmAvailableBy,
  ]);

  const batchVolLNum = batch ? (batch.requiredVolumeLiters ?? batch.batchSize) : 0;
  const mfgList = equipment?.manufacturing ?? [];
  const compatVBase = batch ? (batch.compatibleVessels?.length ? batch.compatibleVessels : mfgList.filter(e => e.type !== 'support' && (e.cap ?? 0) >= batchVolLNum).map(e => e.id)) : [];
  const compatV = compatVBase.length > 0 ? compatVBase : mfgList.filter(e => e.type !== 'support').map(e => e.id);
  const compatF = batch ? (batch.compatibleFillLines?.length ? batch.compatibleFillLines : (equipment?.filling ?? []).filter(e => e.compatible?.includes(batch.fillingType || 'bottle')).map(e => e.id)) : [];
  const compatP = batch ? (batch.compatiblePackLines?.length ? batch.compatiblePackLines : (equipment?.packaging ?? []).map(e => e.id)) : [];

  const scheduledBatchesForOccupancy = useMemo(
    () => batches.map((b) => ({
      mainVessel: b.mainVessel,
      mfgDate: b.mfgDate,
      supportingTanks: b.supportingTanks,
      fillingLine: b.fillingLine,
      fillDate: b.fillDate,
      packagingLine: b.packagingLine,
      packDate: b.packDate,
      bmrNo: b.bmrNo,
    })),
    [batches],
  );

  const scheduleEquipmentValidation = useMemo(() => {
    if (!batch) return { ok: false, errors: [] as string[] };
    return validateScheduleEquipmentReservation(
      {
        mainVessel: vessel,
        fillingLine: fillLine,
        packagingLine: packLine,
        supportingTanks: batch.supportingTanks ?? [],
        mfgDate,
        fillDate,
        packDate,
      },
      scheduledBatchesForOccupancy,
      batch.bmrNo,
    );
  }, [batch, vessel, fillLine, packLine, mfgDate, fillDate, packDate, scheduledBatchesForOccupancy]);

  const handleAcceptRecommendation = () => {
    if (!recommendation || !batch) return;
    const recValidation = validateScheduleEquipmentReservation(
      {
        mainVessel: recommendation.vessel,
        fillingLine: recommendation.fillLine,
        packagingLine: recommendation.packLine,
        supportingTanks: batch.supportingTanks ?? [],
        mfgDate: recommendation.mfgDate,
        fillDate: recommendation.fillDate,
        packDate: recommendation.packDate,
      },
      scheduledBatchesForOccupancy,
      batch.bmrNo,
    );
    if (!recValidation.ok) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    const todayIso = today();
    onSave({
      mfgDate: recommendation.mfgDate, fillDate: recommendation.fillDate, packDate: recommendation.packDate, fgDate: recommendation.fgDate,
      rmConnectDate: suggestedRmConnectDate(
        recommendation.mfgDate,
        materialsAvailability?.maxRmAvailableBy ?? null,
        todayIso,
      ),
      pmConnectDate: suggestedPmConnectDate(
        recommendation.fillDate,
        materialsAvailability?.maxPmAvailableBy ?? null,
        todayIso,
      ),
      mainVessel: recommendation.vessel, fillingLine: recommendation.fillLine, packagingLine: recommendation.packLine,
      supportingTanks: batch.supportingTanks ?? [],
      ...scheduleTeamPayloadFromState(teamAssignment),
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleSaveManual = () => {
    if (!batch || !mfgDate) return;
    if (!scheduleEquipmentValidation.ok) return;
    const canMoveToScheduled = batch.rmReserved && batch.pmReserved;
    onSave({
      mfgDate, fillDate, packDate, fgDate, rmConnectDate: rmDate, pmConnectDate: pmDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine,
      supportingTanks: batch.supportingTanks ?? [],
      ...scheduleTeamPayloadFromState(teamAssignment),
      ...scheduleSaveBmrStatusPatch(batch, canMoveToScheduled),
    });
    onClose();
  };

  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(suggestedRmConnectDate(val, materialsAvailability?.maxRmAvailableBy ?? null, today()));
    const f = addDaysStr(val, 3);
    setFillDate(f);
    setPmDate(suggestedPmConnectDate(f, materialsAvailability?.maxPmAvailableBy ?? null, today()));
    const p = addDaysStr(f, 1);
    setPackDate(p);
    setFgDate(addDaysStr(p, 1));
  };

  const modalTitle = batch ? `Smart Schedule — ${formatUnifiedBatchLabel(batch)}` : 'Smart Schedule — Select batch';
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
    <ModalOverlay onClose={onClose} z="z-50" align="start" scroll className="pt-10">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl my-4 border border-hairline" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"sch-title"}>
        <div className="modal-hdr flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <div className="modal-title text-base font-bold text-ink tracking-tight" id="sch-title">{modalTitle}</div>
            <div className="text-[10.5px] text-ink-3 mt-0.5" id="sch-sub">{modalSub}</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm p-1.5 rounded-lg hover:bg-surface-3 text-ink-3 transition-colors" aria-label="Close">×</button>
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
                  <option key={b.bmrNo} value={b.bmrNo}>{formatUnifiedBatchLabel(b)} — {b.productName ?? b.sku ?? 'Product'} ({b.batchSize} KG){b.mfgDate ? ` (scheduled ${b.mfgDate})` : ' (unscheduled)'}</option>
                ))}
              </select>
              {selectedSoId && batchesForSo.length === 0 && (
                <p className="text-xs text-warn mt-1">No unscheduled batches for this SO.</p>
              )}
            </div>
          </div>

          {batch && <ScheduleYieldContextBanner batch={batch} />}
          {batch && materialsAvailability && batch.dispensingRM.length > 0 && (
            <div className="mb-3 rounded-xl border border-brand-soft bg-brand-soft/80 px-4 py-3">
              <p className="text-xs font-bold text-brand">
                All RM available at WH by:{' '}
                {materialsAvailability.maxRmAvailableBy ? (
                  <span className="font-mono text-sm">{formatMaterialAvailableByLabel(materialsAvailability.maxRmAvailableBy)}</span>
                ) : materialsAvailability.rmIncomplete ? (
                  <span className="text-warn">Pending — check GRN/PO ETAs</span>
                ) : (
                  <span className="text-ok">Now</span>
                )}
              </p>
              {earliestMfgAfterRm && (
                <p className="text-[10px] text-brand/90 mt-1">
                  Earliest suggested MFG: <span className="font-semibold font-mono">{formatMaterialAvailableByLabel(earliestMfgAfterRm)}</span>
                  {mfgDate && mfgDate < earliestMfgAfterRm ? (
                    <span className="text-warn font-semibold"> — current MFG date is earlier than all RM are ready.</span>
                  ) : null}
                </p>
              )}
            </div>
          )}
          {batch && bprAwaitingBmrRelease(batch) && (
            <div className="mb-3 p-2.5 rounded-lg border border-warn-soft bg-warn-soft/80 text-[11px] text-warn">
              <span className="font-semibold">Awaiting BMR QC release</span> — you can still adjust <b>fill / pack / FG dates</b> (and MFG if shown) to absorb BPR-side delays.
            </div>
          )}

          {!batch && (
            <div className="flex justify-end pt-4 border-t border-hairline">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
            </div>
          )}

          {batch && recommendation && (
            <>
              {/* Recommended schedule card */}
              <div className="rec-card rounded-xl border border-ok-soft bg-ok-soft/30 p-4 mb-4">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="rec-card-title text-[10px] font-bold text-ink-2 uppercase tracking-wider">Recommended schedule</div>
                  <span className="rec-score text-[10px] font-bold text-ok bg-ok-soft px-2 py-0.5 rounded-full">{recommendation.confidenceScore}% optimal</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-ok-soft/60 border border-ok-soft/60 mb-2">
                  <div>
                    <div className="text-[9px] text-ink-3 mb-0.5">Manufacturing</div>
                    <div className="text-[11.5px] font-bold text-brand">{recommendation.vesselName || recommendation.vessel || '—'}</div>
                    <div className="text-[10px] text-ink-3">{recommendation.mfgDate || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-ink-3 mb-0.5">Filling</div>
                    <div className="text-[11.5px] font-bold text-brand">{recommendation.fillLineName || recommendation.fillLine || '—'}</div>
                    <div className="text-[10px] text-ink-3">{recommendation.fillDate || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-ink-3 mb-0.5">Packaging</div>
                    <div className="text-[11.5px] font-bold text-ok">{recommendation.packLineName || recommendation.packLine || '—'}</div>
                    <div className="text-[10px] text-ink-3">{recommendation.packDate || '—'}</div>
                  </div>
                </div>
                {(batch?.requiredVolumeLiters != null || (recommendation.vessel && equipment.manufacturing.find(e => e.id === recommendation.vessel)?.cap != null)) && (
                  <div className="text-[10px] text-ink-2 mb-2">
                    {batch?.requiredVolumeLiters != null && <span className="rec-item">Batch volume: <b>{batch.requiredVolumeLiters.toFixed(1)} L</b></span>}
                    {recommendation.vessel && equipment.manufacturing.find(e => e.id === recommendation.vessel)?.cap != null && (
                      <span className="ml-3 rec-item">Vessel capacity: <b>{equipment.manufacturing.find(e => e.id === recommendation.vessel)!.cap} L</b></span>
                    )}
                    {recommendation.vessel && vesselCap != null && batchVol != null && batchVol <= vesselCap && totalWithThis <= vesselCap && vesselCap > totalWithThis && (
                      <div className="mt-1 rec-item font-medium text-ok">{Math.round((vesselCap - totalWithThis) * 10) / 10} L more capacity left after scheduling.</div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-ink-2 mb-3">
                  <div className="rec-item">
                    RM at WH:{' '}
                    <b>
                      {materialsAvailability?.maxRmAvailableBy
                        ? formatMaterialAvailableByLabel(materialsAvailability.maxRmAvailableBy)
                        : (recommendation.rmConnectDate ?? '—')}
                    </b>
                  </div>
                  <div className="rec-item">
                    PM at WH:{' '}
                    <b>
                      {materialsAvailability?.maxPmAvailableBy
                        ? formatMaterialAvailableByLabel(materialsAvailability.maxPmAvailableBy)
                        : (recommendation.pmConnectDate ?? '—')}
                    </b>
                  </div>
                  <div className="rec-item">FG Ready: <b>{recommendation.fgDate ?? '—'}</b></div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {recommendation.reasons.map((r, i) => (
                    <div key={i} className="rec-item flex-1 min-w-0 text-[9.5px] text-ink-2 bg-surface/60 rounded px-2 py-1 border border-hairline">{r}</div>
                  ))}
                </div>
                <button type="button" onClick={handleAcceptRecommendation} className="rec-btn w-full py-2.5 rounded-lg bg-ok hover:bg-ok text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <Check size={14} /> One-click confirm
                </button>
              </div>

              {/* Manual override */}
              <div className="mt-4 p-4 rounded-xl bg-surface-2 border border-border">
                <div className="text-[10.5px] font-bold text-ink-3 uppercase tracking-wider mb-2">Manual override</div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-brand-soft/80 border border-brand-soft text-[11px] text-brand mb-3">
                  <div>Or adjust dates and equipment below if needed.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="field"><label className={LBL}>Mfg date</label><input type="date" className={INP} value={mfgDate ?? ''} onChange={e => handleMfgChange(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Fill date</label><input type="date" className={INP} value={fillDate ?? ''} onChange={e => setFillDate(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Pack date</label><input type="date" className={INP} value={packDate ?? ''} onChange={e => setPackDate(e.target.value)} /></div>
                  <div className="field"><label className={LBL}>Vessel</label>
                    <select className={INP} value={vessel} onChange={e => setVessel(e.target.value)}>
                      {compatV.map(id => (
                        <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'mfg')} {isEquipFreeOnDate(scheduledBatchesForOccupancy, id, mfgDate, batch?.bmrNo) ? '(Free)' : '(Busy)'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(batchVol != null || vesselCap != null || volumeRequiredInBatch != null) && (
                  <div className={`mb-3 p-3 rounded-lg border text-xs ${overCapacity || overTotalCapacity ? 'bg-err-soft border-err-soft text-err' : 'bg-surface-2 border-border text-ink-2'}`}>
                    <div className="font-semibold mb-1.5">Volume & capacity</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Volume required in this batch: <b>{volumeRequiredInBatch != null ? `${volumeRequiredInBatch.toFixed(1)} L` : '—'}</b></span>
                      {batchVol != null && <span>Batch volume: <b>{batchVol.toFixed(1)} L</b></span>}
                      {vesselCap != null && <span>Vessel capacity: <b>{vesselCap} L</b></span>}
                      {vessel && mfgDate && <span>Total on this vessel/date: <b>{totalWithThis.toFixed(1)} L</b></span>}
                    </div>
                    {overCapacity && <p className="mt-1.5 font-medium">Batch volume exceeds vessel capacity.</p>}
                    {overCapacity && batch && vesselCap != null && canSplitBatchForVessel(batch) && onRequestVesselSplit && (
                      <button
                        type="button"
                        onClick={() => onRequestVesselSplit(batch, vesselCap)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold bg-surface border border-err-soft text-err rounded-lg hover:bg-err-soft transition-colors"
                      >
                        <Layers size={12} /> Split batch for vessel ({vesselCap} L) &amp; reschedule remainder
                      </button>
                    )}
                    {!overCapacity && overTotalCapacity && <p className="mt-1.5 font-medium">Total scheduled volume exceeds vessel capacity.</p>}
                    {!overCapacity && !overTotalCapacity && vesselCap != null && totalWithThis < vesselCap && (
                      <p className="mt-1.5 font-medium text-ok">{Math.max(0, Math.round((vesselCap - totalWithThis) * 10) / 10).toFixed(1)} L more capacity left on this vessel/date.</p>
                    )}
                  </div>
                )}
                {batchWithUnits && (batchWithUnits.fillUnitsRequired > 0 || batchWithUnits.packUnitsRequired > 0) && (equipment?.filling?.some(e => (e.speed ?? 0) > 0) || equipment?.packaging?.some(e => (e.speed ?? 0) > 0)) && (
                  <div className="mb-3 p-3 rounded-lg border border-brand-soft bg-brand-soft/40 text-xs text-ink-2">
                    <div className="font-semibold mb-1.5">Filling & packaging capacity (units/day)</div>
                    <p className="text-[10.5px] text-ink-2 mb-2">
                      PM type: <b>{(batch?.fillingType ?? 'bottle').toUpperCase()}</b>
                      {' · '}Planned split (order ÷ batches): <b>{batchWithUnits.fillUnitsRequired} fill</b>, <b>{batchWithUnits.packUnitsRequired} pack</b> units
                      {batch?.bulkYield != null && Number(batch.bulkYield) > 0 && (
                        <span className="block mt-1 text-brand font-medium">
                          BMR bulk recorded: <b>{formatYieldKg(Number(batch.bulkYield))} KG</b> vs planned <b>{batch.batchSize} KG</b> — use fill/pack QC yields when available for true output.
                        </span>
                      )}
                      {batch?.fillYield != null && Number(batch.fillYield) > 0 && (
                        <span className="block mt-1 text-brand font-medium">Fill QC yield on file: <b>{formatYieldUnits(Number(batch.fillYield))}</b> units.</span>
                      )}
                      {batch?.fgYield != null && Number(batch.fgYield) > 0 && (
                        <span className="block mt-1 text-ok font-medium">Pack QC / FG yield on file: <b>{formatYieldUnits(Number(batch.fgYield))}</b> units.</span>
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
                          <div className="rounded-lg bg-surface/60 p-2 border border-brand-soft">
                            <div className="font-medium text-brand">{fillLine} on {fillDate}</div>
                            <div className="mt-1 space-y-0.5 text-[10.5px]">
                              <span>Capacity: <b>{dailyCap.toLocaleString()}</b>/day ({fillEquip?.speed != null ? `${fillEquip.speed}/hr` : '—'})</span>
                              <br />
                              <span>Already used: <b>{used.toLocaleString()}</b> units</span>
                              <br />
                              <span>This batch: <b>{batchWithUnits.fillUnitsRequired}</b> units</span>
                              <br />
                              {afterThis >= 0 ? (
                                <span className="text-ok font-medium">Remaining after: <b>{afterThis.toLocaleString()}</b> units</span>
                              ) : (
                                <span className="text-warn font-medium">Over by <b>{(-afterThis).toLocaleString()}</b> units (consider another line or date)</span>
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
                          <div className="rounded-lg bg-surface/60 p-2 border border-ok-soft">
                            <div className="font-medium text-ok">{packLine} on {packDate}</div>
                            <div className="mt-1 space-y-0.5 text-[10.5px]">
                              <span>Capacity: <b>{dailyCap.toLocaleString()}</b>/day ({packEquip?.speed != null ? `${packEquip.speed}/hr` : '—'})</span>
                              <br />
                              <span>Already used: <b>{used.toLocaleString()}</b> units</span>
                              <br />
                              <span>This batch: <b>{batchWithUnits.packUnitsRequired}</b> units</span>
                              <br />
                              {afterThis >= 0 ? (
                                <span className="text-ok font-medium">Remaining after: <b>{afterThis.toLocaleString()}</b> units</span>
                              ) : (
                                <span className="text-warn font-medium">Over by <b>{(-afterThis).toLocaleString()}</b> units (consider another line or date)</span>
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
                          <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'fill')}{speedLabel} {isEquipFreeOnDate(scheduledBatchesForOccupancy, id, fillDate, batch?.bmrNo) ? '(Free)' : '(Busy)'}</option>
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
                          <option key={id} value={id}>{id} {getEquipDisplayName(equipment, id, 'pack')}{speedLabel} {isEquipFreeOnDate(scheduledBatchesForOccupancy, id, packDate, batch?.bmrNo) ? '(Free)' : '(Busy)'}</option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                {batch && (
                  <ScheduleTeamAssignmentSection
                    team={team}
                    value={teamAssignment}
                    onChange={setTeamAssignment}
                  />
                )}
                <button type="button" onClick={handleSaveManual} disabled={!scheduleEquipmentValidation.ok} className="btn btn-blue btn-sm py-2 px-4 rounded-lg bg-brand hover:bg-brand text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-3">
                  Save manual schedule
                </button>
                {!scheduleEquipmentValidation.ok && (
                  <p className="text-xs text-err mt-2" role="alert">{scheduleEquipmentValidation.errors[0]}</p>
                )}
              </div>
            </>
          )}
        </div>

        {batch && recommendation && (
          <div className="modal-foot flex items-center justify-end gap-2 px-6 py-4 border-t border-hairline bg-surface-2/50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
            <button type="button" onClick={handleSaveManual} disabled={!scheduleEquipmentValidation.ok} className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-brand hover:bg-brand text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Calendar size={14} /> Confirm schedule & reserve equipment
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/* ──────────── DISPENSING MODAL ──────────────────────────────── */

function qtyMeetsRequired(dispensed: unknown, required: unknown, kind: QtyKind): boolean {
  return materialQtyGteForDispensing(dispensed, required, kind);
}

function qtyWithinMuStock(needed: unknown, atMu: unknown, kind: QtyKind): boolean {
  return materialQtyLteForDispensing(needed, atMu, kind);
}

/* ──────────── PICK FROM RACK (FEFO packs) ─────────────────── */

function PickFromRackModal({ line, batch, muZone, muLabel, resolvedName, onClose, onPicked }: {
  line: DispensingItem;
  batch: Batch;
  /** Master name when the line carries only a code. */
  resolvedName?: string;
  /** Batch manufacturing site (location code, e.g. LOC-ML1) — dispensing may only consume stock here. */
  muZone?: string;
  /** Short label for that site (ML1 / ML2) for user-facing copy. */
  muLabel?: string;
  onClose: () => void;
  onPicked: (pick: Partial<DispensingItem>) => void;
}) {
  const { addToast } = useToast();
  const [packs, setPacks] = useState<WarehousePack[]>([]);
  const [loading, setLoading] = useState(true);
  // Keyed by row `key` (`pack-<id>` / `stock-rack-<id>`), NOT a numeric id: a pack id and a rack id
  // can collide, which would open the split input on the wrong row.
  const [splitKey, setSplitKey] = useState<string | null>(null);
  const [splitQty, setSplitQty] = useState('');
  const [busy, setBusy] = useState(false);
  // Picks accumulated in this session, seeded from whatever the line already holds.
  const [picks, setPicks] = useState<DispensingPick[]>(() => linePicks(line));

  const pickedTotal = picks.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const remaining = Math.max(0, roundMaterialQty(line.required - pickedTotal, 'kg'));
  /** Quantity already taken from a rack in this session — a rack cannot be over-picked. */
  const takenFromRack = (p: WarehousePack) =>
    picks.filter((x) => (x.rack ?? '') === (p.rack ?? '') && (x.zone ?? '') === (p.zone ?? ''))
      .reduce((s, x) => s + (Number(x.qty) || 0), 0);
  const availableOnRow = (p: WarehousePack) => Math.max(0, roundMaterialQty(p.qty - takenFromRack(p), 'kg'));

  useEffect(() => {
    let cancelled = false;
    if (line.rawMaterialId == null) { setLoading(false); return; }
    // Scope to the batch's manufacturing site. Dispensing may only consume stock that is already
    // there (the backend enforces the same rule), so offering packs from other sites just lets the
    // operator pick something that will be rejected at Confirm.
    void fetchAvailablePacks({ rawMaterialId: line.rawMaterialId, zone: muZone || null })
      .then((rows) => { if (!cancelled) setPacks(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [line.rawMaterialId, muZone]);

  /**
   * Add one rack's contribution. The dialog stays open so the operator can keep picking from other
   * racks until the requirement is covered — closing early is what forced a single-rack pick before.
   */
  const addPick = (packId: number | undefined, packNo: string, qty: number, p: WarehousePack) => {
    // A line only counts as picked when the pack has a label. Committing a blank one used to close
    // the dialog while the row silently stayed PENDING PICK — refuse instead of no-op'ing.
    if (!String(packNo || '').trim()) {
      addToast('error', 'Could not label a pack for this stock — nothing was picked.');
      return;
    }
    setPicks((prev) => [...prev, {
      packId,
      packNo,
      qty,
      zone: p.zone ?? '',
      rack: p.rack ?? '',
      vendorBatch: p.vendorBatch ?? '',
      mfgDate: p.mfgDate ?? '',
      expDate: p.expDate ?? '',
    }]);
    setSplitKey(null);
    setSplitQty('');
  };

  /**
   * Loose rack stock has no pack, and picking must NOT create one.
   *
   * An earlier version called `materialize` to mint a pack label per pick. That put the two sides
   * out of step: the picker nets loose stock against GRN packs only, while `materialize` nets
   * against ALL available packs — so the pack minted by the first pick made the same rack read as
   * "No loose stock on this rack to split" on the very next click, even though the qty was untouched.
   *
   * Picking is a floor action, not a stock movement, so it stays client-side: record the rack and
   * quantity, leave `packId` undefined. Consumption happens at Dispense. Loose stock carries no
   * vendor batch or expiry, so no traceability is lost by not labelling it.
   */
  const addLoosePick = (p: WarehousePack, qty: number) => {
    const where = [p.zone, p.rack].map((x) => String(x ?? '').trim()).filter(Boolean).join('/');
    addPick(undefined, `LOOSE · ${where || 'rack'}`, qty, p);
  };

  const isLooseStock = (p: WarehousePack) => p.kind === 'stock' || p.packId == null;

  /**
   * Pick full — fill the line from this rack without typing a quantity.
   *
   * Capped at what the line still needs: a rack holding 6 kg against a 3 kg requirement gives 3 and
   * leaves 3 on the rack. Taking the rack's whole quantity would send twice the required material to
   * the dispensing station and strand the rest there. When the rack holds less than the outstanding
   * amount it gives everything, which is the case that sends you to a second rack.
   * Deliberate over-picking is still possible — that is what Split is for.
   */
  const pickFull = (p: WarehousePack) => {
    const avail = availableOnRow(p);
    if (avail <= 0) { addToast('error', 'Nothing left to take from this rack.'); return; }
    if (remaining <= 1e-9) {
      addToast('info', `${formatQtyExact(line.required, 'kg')} kg is already picked for this line — use Split to take extra.`);
      return;
    }
    const qty = roundMaterialQty(Math.min(avail, remaining), 'kg');
    if (isLooseStock(p)) { addLoosePick(p, qty); return; }
    addPick(p.packId as number, p.packagingNo ?? '', qty, p);
  };

  /** Split — a custom quantity from this rack, so the balance can come from another one. */
  const doSplit = async (p: WarehousePack) => {
    const q = parseFloat(splitQty);
    const avail = availableOnRow(p);
    if (!(q > 0) || q > avail + 1e-9) {
      addToast('error', `Enter a qty between 0 and ${formatQtyExact(avail, 'kg')} kg for this rack.`);
      return;
    }
    if (isLooseStock(p)) { addLoosePick(p, q); return; }
    setBusy(true);
    try {
      const res = await splitPack(p.packId as number, [q]);
      const child = res.children?.[0];
      addPick(child?.packId ?? child?.id ?? (p.packId as number), child?.packagingNo ?? p.packagingNo ?? '', q, p);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Split failed');
    } finally {
      setBusy(false);
    }
  };

  const removePick = (i: number) => setPicks((prev) => prev.filter((_, idx) => idx !== i));

  const confirmPicks = () => {
    onPicked(pickSummaryFields(picks));
    onClose();
  };

  const th = 'px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap';
  const td = 'px-2 py-1.5 whitespace-nowrap';

  return (
    <Modal
      onClose={onClose}
      title={`Pick from Rack — ${line.inci || line.name || resolvedName || line.code} (${line.code})`}
      subtitle={`Batch ${batch.batchNo || batch.bmrNo} · Required ${formatQtyExact(line.required, 'kg')} kg${muLabel ? ` · at site ${muLabel} only` : ''} · FEFO (earliest expiry first)`}
      size="xl"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
        <span className="text-gray-500">Picked</span>
        <span className="font-mono font-bold text-gray-800">
          {formatQtyExact(pickedTotal, 'kg')} / {formatQtyExact(line.required, 'kg')} kg
        </span>
        {remaining > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
            {formatQtyExact(remaining, 'kg')} kg still to pick
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">requirement covered</span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          Pick full takes what this line still needs from that rack · Split takes a custom amount, so the rest can come from another rack
        </span>
      </div>

      {picks.length > 0 && (
        <div className="mb-3 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <span>Picked so far ({picks.length})</span>
            {picks.length > 1 && (
              <button
                type="button"
                onClick={() => setPicks([])}
                className="ml-auto text-[10px] font-semibold normal-case text-red-600 hover:underline"
              >
                Remove all
              </button>
            )}
          </div>
          {picks.map((pk, i) => (
            <div key={`${pk.packNo}-${i}`} className="flex items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-[11px] last:border-b-0">
              <span className="font-mono text-gray-700">{pk.packNo}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{pk.zone || '—'} / {pk.rack || '—'}</span>
              <span className="ml-auto font-mono font-semibold text-gray-800">{formatQtyExact(pk.qty, 'kg')} kg</span>
              <button
                type="button"
                onClick={() => removePick(i)}
                title={`Remove this ${formatQtyExact(pk.qty, 'kg')} kg pick — the qty goes back to ${pk.rack || 'the rack'}`}
                className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <X size={10} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {line.rawMaterialId == null ? (
        <Tip color="amber" icon={<AlertTriangle size={14} />}>No RM master id on this line — cannot look up packs.</Tip>
      ) : loading ? (
        <div className="py-6 text-center text-sm text-gray-500">Loading available packs…</div>
      ) : packs.length === 0 ? (
        <div className="py-4 px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">
          {muLabel
            ? `No stock for this material at ${muLabel}, this batch's manufacturing site. Raise an MTR to move it from the warehouse first — stock at other sites cannot be dispensed to this batch.`
            : 'No available packs for this material.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[860px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={th}>FEFO</th>
                <th className={th}>Packaging No</th>
                <th className={th}>Zone</th>
                <th className={th}>Rack</th>
                <th className={th}>Vendor Batch</th>
                <th className={th}>MFG</th>
                <th className={th}>EXP</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p, i) => (
                <tr key={p.key} className="border-b border-gray-100">
                  <td className={td}>{i + 1}{i === 0 ? ' · FEFO' : ''}</td>
                  <td className={`${td} font-mono`}>
                    {p.packagingNo || (
                      <span className="text-gray-400">{p.unassigned ? 'unassigned stock' : 'loose stock'}</span>
                    )}
                  </td>
                  <td className={td}>{p.zone || '—'}</td>
                  <td className={td}>
                    {p.rack || (p.unassigned
                      ? <span className="text-amber-600" title="At this site but not yet put away on a rack">not on a rack</span>
                      : '—')}
                  </td>
                  <td className={td}>{p.vendorBatch || '—'}</td>
                  <td className={td}>{p.mfgDate || '—'}</td>
                  <td className={td}>{p.expDate || '—'}</td>
                  <td className={`${td} text-right font-mono`}>
                    {formatQtyExact(availableOnRow(p), 'kg')} {p.unit || 'kg'}
                    {takenFromRack(p) > 0 && (
                      <span className="ml-1 text-[10px] text-emerald-600">(−{formatQtyExact(takenFromRack(p), 'kg')} picked)</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {availableOnRow(p) <= 0 ? (
                      <span className="text-[10px] text-gray-400">fully picked</span>
                    ) : splitKey === p.key ? (
                      <span className="inline-flex items-center gap-1">
                        <input type="number" value={splitQty} min={0} max={availableOnRow(p)} step="any" placeholder="qty"
                          onChange={(e) => setSplitQty(e.target.value)}
                          className="w-16 px-1.5 py-1 border border-gray-200 rounded text-[11px] font-mono" />
                        <button type="button" disabled={busy} onClick={() => void doSplit(p)} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50">OK</button>
                        <button type="button" onClick={() => { setSplitKey(null); setSplitQty(''); }} className="px-1.5 py-1 text-gray-400 text-[10px]">✕</button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" disabled={busy} onClick={() => pickFull(p)} title={`Take ${formatQtyExact(Math.min(availableOnRow(p), remaining > 0 ? remaining : availableOnRow(p)), 'kg')} kg from this rack — what the line still needs`} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold disabled:opacity-50">
                          {busy ? '…' : '🎯 Pick full'}
                        </button>
                        {/* Loose stock splits too — it gets labelled into a pack first. */}
                        <button type="button" disabled={busy} title="Take part of this rack — the balance can come from another rack" onClick={() => { setSplitKey(p.key); setSplitQty(String(Math.min(remaining > 0 ? remaining : line.required, availableOnRow(p)))); }} className="px-2 py-1 rounded border border-gray-300 text-gray-700 text-[10px] disabled:opacity-50">✂ Split</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
        {picks.length > 0 && remaining > 0 && (
          <span className="mr-auto text-[11px] text-amber-700">
            Short by {formatQtyExact(remaining, 'kg')} kg — pick from another rack, or finish and dispense what you have.
          </span>
        )}
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100">Cancel</button>
        <button type="button" disabled={busy || picks.length === 0} onClick={confirmPicks}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg">
          <CheckCircle2 size={13} /> Done — {formatQtyExact(pickedTotal, 'kg')} kg from {picks.length} rack{picks.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}

/* ──────────── PICK LIST (what to collect, and a CSV of it) ─────── */

function PickListModal({ list, onClose }: { list: PickList; onClose: () => void }) {
  const q = (n: number) => formatQtyExact(n, list.qtyKind);
  const th = 'px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap';
  const td = 'px-2 py-1.5 align-top';
  const statusClass = (s: PickList['rows'][number]['status']) =>
    s === 'dispensed' ? 'text-emerald-700'
      : s === 'picked' ? 'text-blue-700'
        : s === 'short-pick' ? 'text-amber-700' : 'text-gray-400';

  return (
    <Modal
      onClose={onClose}
      title={`Pick list — ${list.kind} · ${list.batchLabel}`}
      subtitle={`${list.productName}${list.soNo ? ` · SO ${list.soNo}` : ''}${list.site ? ` · collect from ${list.site}` : ''} · ${list.rows.length} items`}
      size="xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[880px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={th}>#</th>
              <th className={th}>Code</th>
              <th className={th}>Material</th>
              <th className={`${th} text-right`}>Required</th>
              <th className={`${th} text-right`}>Picked</th>
              <th className={`${th} text-right`}>Dispensed</th>
              <th className={`${th} text-right`}>Balance</th>
              <th className={th}>Picked from</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((r) => (
              <tr key={`${r.code}-${r.index}`} className="border-b border-gray-100">
                <td className={td}>{r.index}</td>
                <td className={`${td} font-mono`}>{r.code}</td>
                <td className={td}>
                  {r.name || <span className="text-gray-400">—</span>}
                  {r.tray ? <span className="block text-[10px] text-gray-400">{r.tray}</span> : null}
                </td>
                <td className={`${td} text-right font-mono font-semibold`}>{q(r.required)} {r.unit}</td>
                <td className={`${td} text-right font-mono`}>{q(r.picked)}</td>
                <td className={`${td} text-right font-mono`}>{q(r.dispensed)}</td>
                <td className={`${td} text-right font-mono ${r.balance > 1e-9 ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{q(r.balance)}</td>
                <td className={`${td} text-gray-600`}>{r.sources || <span className="text-gray-400">not picked yet</span>}</td>
                <td className={`${td} font-semibold ${statusClass(r.status)}`}>{pickListStatusLabel(r.status)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className={td} colSpan={3}>TOTAL — {list.rows.length} items</td>
              <td className={`${td} text-right font-mono`}>{q(list.totals.required)} {list.unit}</td>
              <td className={`${td} text-right font-mono`}>{q(list.totals.picked)}</td>
              <td className={`${td} text-right font-mono`}>{q(list.totals.dispensed)}</td>
              <td className={`${td} text-right font-mono`}>{q(list.totals.balance)}</td>
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100">Close</button>
        <button
          type="button"
          onClick={() => downloadDispensingPickList(list)}
          title="Spreadsheet-friendly export"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold rounded-lg"
        >
          <Download size={13} /> CSV
        </button>
        <button
          type="button"
          onClick={() => downloadDispensingPickListPdf(list)}
          title="Printable sheet for the floor, with a signature strip"
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
        >
          <Printer size={13} /> Download PDF
        </button>
      </div>
    </Modal>
  );
}

/* ──────────── DISPENSE CONFIRM (tolerance + leftover + split) ─── */

function DispenseConfirmModal({ line, batch, resolvedName, onClose, onConfirm }: {
  line: DispensingItem;
  batch: Batch;
  /** Master name when the line carries only a code. */
  resolvedName?: string;
  onClose: () => void;
  onConfirm: (patch: Partial<DispensingItem>) => void;
}) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [qtyStr, setQtyStr] = useState(String(line.required));
  const [busy, setBusy] = useState(false);

  const dispensed = parseFloat(qtyStr) || 0;
  const loTol = line.required * 0.995;
  const hiTol = line.required * 1.005;
  const inTolerance = dispensed >= loTol && dispensed <= hiTol;
  // A requirement can be made up from several racks — validate against the TOTAL picked, not one pack.
  const picks = linePicks(line);
  const packQty = linePickedQty(line);
  const leftover = Math.max(0, roundMaterialQty(packQty - dispensed, 'kg'));
  const overPack = dispensed > packQty + 1e-9;

  const handleConfirm = async () => {
    if (!inTolerance || overPack) return;
    setBusy(true);
    try {
      // Consume the picks in order; the one that ends up partly used is split so its leftover goes
      // back to the rack under a new PKG-SPLIT label. Packs used in full need no split.
      let toConsume = dispensed;
      for (const pk of picks) {
        if (toConsume <= 1e-9) break;
        const take = Math.min(toConsume, pk.qty);
        if (pk.packId != null && take > 0 && take < pk.qty - 1e-9) {
          await splitPack(pk.packId, [roundMaterialQty(take, 'kg')]);
        }
        toConsume = roundMaterialQty(toConsume - take, 'kg');
      }
      onConfirm({
        dispensed: roundMaterialQty(dispensed, 'kg'),
        leftoverQty: leftover,
        dispensedBy: user?.name || 'Operator',
        dispensedAt: new Date().toISOString(),
        done: true,
        trayContainer: line.trayContainer || String(batch.mainVessel || '').trim(),
        traySlot: line.traySlot || `${batch.batchNo || batch.bmrNo}/A`,
      });
      onClose();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Dispense failed');
    } finally {
      setBusy(false);
    }
  };

  const kv = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1.5 border-b border-gray-50 text-xs">
      <div className="text-gray-500">{label}</div>
      <div className="text-gray-800 font-medium">{value}</div>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      title={`Dispense — ${line.inci || line.name || resolvedName || line.code} (${line.code})`}
      subtitle={`Batch ${batch.batchNo || batch.bmrNo} · ${picks.length} rack${picks.length === 1 ? '' : 's'} picked · ${formatQtyExact(packQty, 'kg')} kg available`}
      size="lg"
    >
      <div className="rounded-lg border border-gray-100 p-3">
        {kv(picks.length === 1 ? 'Picked from Pack' : `Picked from ${picks.length} racks`, (
          <span className="flex flex-col gap-0.5">
            {picks.length === 0 ? '—' : picks.map((pk, i) => (
              <span key={`${pk.packNo}-${i}`} className="font-mono text-[11px]">
                {pk.packNo} · {formatQtyExact(pk.qty, 'kg')} kg · {pk.zone || '—'} / {pk.rack || '—'}
              </span>
            ))}
            {picks.length > 1 && (
              <span className="text-[11px] font-semibold text-gray-600">Total {formatQtyExact(packQty, 'kg')} kg</span>
            )}
          </span>
        ))}
        {kv('Vendor Batch · MFG · EXP', `${line.vendorBatch || '—'} · ${line.mfgDate || '—'} · ${line.expDate || '—'}`)}
        {kv('Required Qty', `${formatQtyExact(line.required, 'kg')} kg`)}
        {kv('Confirm Dispensed Qty', (
          <span className="inline-flex items-center gap-2">
            <input type="number" value={qtyStr} min={0} step="any" onChange={(e) => setQtyStr(e.target.value)}
              className={`w-28 px-2 py-1 border rounded text-xs font-mono ${inTolerance && !overPack ? 'border-gray-200' : 'border-red-400 bg-red-50/40'}`} />
            <span className="text-[10px] text-gray-400">±0.5% ({formatQtyExact(loTol, 'kg')}–{formatQtyExact(hiTol, 'kg')} kg)</span>
          </span>
        ))}
        {kv('Leftover Qty (auto)', <span>{formatQtyExact(leftover, 'kg')} kg <span className="text-[10px] text-gray-400">{leftover > 0 ? '· returned to rack (new label)' : ''}</span></span>)}
        {kv('Dispensed by', `${user?.name || 'Operator'} (auto)`)}
        {kv('Dispensed into', `${line.traySlot || `${batch.batchNo}/A`} · ${line.trayContainer || batch.mainVessel || 'SS Container'}`)}
      </div>
      {overPack ? <Tip color="amber" icon={<AlertTriangle size={14} />}>Dispensed qty exceeds what was picked ({formatQtyExact(packQty, 'kg')} kg across {picks.length} rack{picks.length === 1 ? '' : 's'}). Pick more from another rack first.</Tip>
        : !inTolerance ? <Tip color="amber" icon={<AlertTriangle size={14} />}>Dispensed qty is out of the ±0.5% tolerance.</Tip> : null}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100">Cancel</button>
        <button type="button" onClick={handleConfirm} disabled={busy || !inTolerance || overPack}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg">
          <CheckCircle2 size={13} /> Complete Dispense
        </button>
      </div>
    </Modal>
  );
}

function DispensingModal({ batch, type, atMuZoneByCode, scheduledMuZone, nameByCode, onClose, onSave, onReschedule }: {
  batch: Batch;
  type: 'rm' | 'pm';
  /** Fallback MU qty from warehouse list (ml1/ml2 column); prefer API fetch in modal. */
  atMuZoneByCode?: Record<string, number>;
  scheduledMuZone?: string;
  /** Material names by code — used when a dispensing line carries only a code. */
  nameByCode?: Record<string, string>;
  onClose: () => void;
  onSave: (updates: Partial<Batch>) => void;
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
  const qtyKind = type === 'rm' ? 'kg' : 'pcs';
  const muZone = String(scheduledMuZone || batch.scheduledMuZone || '').trim();
  const muBucketLabel = muBucketFromScheduledZone(muZone) === 'ml2' ? 'ML2' : 'ML1';
  const [muStockByCode, setMuStockByCode] = useState<Record<string, string>>({});
  const [muStockLoading, setMuStockLoading] = useState(false);
  // RM two-stage pick → dispense (Phase 1).
  const isRm = type === 'rm';
  const [pickForIdx, setPickForIdx] = useState<number | null>(null);
  const [dispenseForIdx, setDispenseForIdx] = useState<number | null>(null);
  const [showPickList, setShowPickList] = useState(false);
  const applyLinePatch = (idx: number, patch: Partial<DispensingItem>) =>
    setLocalItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  /**
   * Drop every pick on a line so it returns to Pending pick. Clears BOTH the picks array and the
   * legacy single-pick summary fields — leaving either behind would keep the row looking picked.
   * Refuses on a dispensed line: that would erase the provenance of material already consumed.
   */
  const clearLinePicks = (idx: number) => {
    const line = localItems[idx];
    if (!line) return;
    if (line.done || (Number(line.dispensed) || 0) > 0) {
      addToast('error', `${line.code} is already dispensed — its pick cannot be removed.`);
      return;
    }
    applyLinePatch(idx, pickSummaryFields([]));
  };
  const pickedCount = isRm ? localItems.filter(r => lineIsPicked(r) && !r.done).length : 0;
  const pendingPickCount = isRm ? localItems.filter(r => !lineIsPicked(r) && !r.done).length : 0;
  /** Built from the live rows, so the sheet always matches what the operator is looking at. */
  const pickList = useMemo(
    () => buildDispensingPickList(
      {
        bmrNo: batch.bmrNo,
        bprNo: batch.bprNo,
        batchNo: batch.batchNo,
        productName: batch.productName,
        batchSize: batch.batchSize,
        soNo: batch.soNo,
        scheduledMuZone: muZone,
      },
      localItems,
      type === 'rm' ? 'RM' : 'PM',
      { siteLabel: muZone ? `${muZone} (${muBucketLabel})` : '', nameByCode },
    ),
    [batch, localItems, type, muZone, muBucketLabel, nameByCode],
  );

  const shiftLeadName = batch.shiftLeadBMR || '';
  /** BPR cannot move to Filling until BMR bulk QC is released (cleared or approved flag). */
  const bprBlockedByBmr = type === 'pm' && !bmrBulkQcReleased(batch);

  useEffect(() => {
    const base = (Array.isArray(batchItems) ? batchItems : []).map((i) => ({
      ...i,
      required: roundMaterialQty(i.required, qtyKind),
      dispensed: i.dispensed != null ? roundMaterialQty(i.dispensed, qtyKind) : 0,
    }));
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
              const required = roundMaterialQty((batchSizeKg * pct) / 100, 'kg');
              const rmId = Number((line as { raw_material_id?: number; rawMaterialId?: number }).raw_material_id
                ?? (line as { rawMaterialId?: number }).rawMaterialId);
              return {
                code,
                inci: (line.inci_name ?? (line as { inci_name?: string }).inci_name) as string,
                required,
                dispensed: 0,
                done: false,
                ...(Number.isFinite(rmId) && rmId > 0 ? { rawMaterialId: rmId } : {}),
              };
            })
            .filter((x) => x.required > 0 && String(x.code || '').trim().length > 0);
          setLocalItems(rmItems);
        } else {
          const pmLines = Array.isArray(res.data.pmLines) ? (res.data.pmLines as BOMPmLine[]) : [];
          const batchUnits =
            res.data.batchSizeKg != null && Number.isFinite(res.data.batchSizeKg) && res.data.batchSizeKg > 0
              ? Number(res.data.batchSizeKg)
              : batch.totalBatches
                ? Math.ceil((batch.orderQty || 0) / batch.totalBatches)
                : Number(batch.batchSize) || 0;
          const pmItems: DispensingItem[] = pmLines
            .filter((line) => line.pm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.pm_code || (line as { code?: string }).code) as string;
              const qtyPerUnit = Number((line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1)) || 1;
              const required = roundMaterialQty(qtyPerUnit * batchUnits, 'pcs');
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

  useEffect(() => {
    const batchPk = (batch as Batch & { _pk?: number })._pk;
    if (!batchPk || !muZone) {
      setMuStockByCode({});
      return;
    }
    let cancelled = false;
    setMuStockLoading(true);
    fetchBatchDispensingMuStock(batchPk)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setMuStockByCode(type === 'rm' ? (res.rmByCode ?? {}) : (res.pmByCode ?? {}));
        }
      })
      .finally(() => {
        if (!cancelled) setMuStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, muZone, type, initKey]);

  const muQtyStrForCode = (code: string): string => {
    const c = String(code ?? '').trim();
    if (!c) return '0';
    if (c in muStockByCode) return toQtyString(muStockByCode[c]);
    const fallback = atMuZoneByCode?.[c];
    return fallback != null ? toQtyString(fallback) : '0';
  };

  /** At-site stock below batch target — cannot mark Done until MTR fills the gap. */
  const isDispensingLineShort = (line: DispensingItem): boolean => {
    if (!muZone || muStockLoading) return false;
    const required = qtyForDispensingCompare(line.required, qtyKind);
    if (materialQtyToNum(required) <= 0) return false;
    const atMu = qtyForDispensingCompare(muQtyStrForCode(line.code), qtyKind);
    return !materialQtyGteForDispensing(atMu, required, qtyKind);
  };

  const validateDispenseLine = (line: DispensingItem, qty: unknown): string | null => {
    if (!muZone) {
      return 'Schedule this batch and select a manufacturing site before dispensing.';
    }
    const required = line.required;
    const dispensed = toQtyString(qty);
    if (materialQtyToNum(required) > 0 && !qtyMeetsRequired(dispensed, required, qtyKind)) {
      return `${line.code}: dispensed ${formatQtyWithUnit(dispensed, qtyKind)} is below required ${formatQtyWithUnit(required, qtyKind)}.`;
    }
    const atMu = muQtyStrForCode(line.code);
    if (!qtyWithinMuStock(dispensed, atMu, qtyKind)) {
      return `${line.code}: dispensing ${formatQtyWithUnit(dispensed, qtyKind)} but only ${formatQtyWithUnit(atMu, qtyKind)} at ${muZone} (${muBucketLabel}). Send MTR to this site first.`;
    }
    return null;
  };

  const validateAllDispensedLines = (items: DispensingItem[]): string | null => {
    if (!muZone) {
      return 'Schedule this batch and select a manufacturing site before dispensing.';
    }
    for (const it of items) {
      if (!it.done) continue;
      const qty = Number(it.dispensed) || 0;
      if (qty <= 0) continue;
      // RM pack-picked lines were already tolerance-validated in DispenseConfirmModal (and consume from
      // the picked pack, not the aggregate MU stock) — skip the legacy below-required / MU-stock checks.
      if (type === 'rm' && lineIsPicked(it)) continue;
      const err = validateDispenseLine(it, qty);
      if (err) return err;
    }
    return null;
  };

  const effectiveDispenseQty = (line: DispensingItem, rawVal: number): number => {
    if (!Number.isFinite(rawVal) || rawVal <= 0) return rawVal;
    if (type !== 'pm') return rawVal;
    const atMu = materialQtyToNum(muQtyStrForCode(line.code));
    return capPmDispenseConsumption(rawVal, atMu);
  };

  const handleDispense = (idx: number) => {
    setDispenseErr(null);
    const rawInput = inputVals[idx] || '';
    const parsed = parseQtyInputString(rawInput);
    const line = localItems[idx];
    const atMuForLine = line ? materialQtyToNum(muQtyStrForCode(line.code)) : 0;
    const requiredRaw = line?.required;
    const defaultQty =
      type === 'pm' && atMuForLine > 0
        ? capPmDispenseConsumption(requiredRaw ?? 0, atMuForLine)
        : materialQtyToNum(requiredRaw);
    const val =
      rawInput.trim() !== ''
        ? parsed
        : defaultQty > 0
          ? defaultQty
          : NaN;

    if (!Number.isFinite(val) || val <= 0) {
      setDispenseErr(`Enter a valid ${unit === 'KG' ? 'weight (KG)' : 'count'} before marking Done.`);
      return;
    }

    const finalVal = line ? effectiveDispenseQty(line, val) : val;
    const lineErr = line ? validateDispenseLine(line, finalVal) : null;
    if (lineErr) {
      setDispenseErr(lineErr);
      return;
    }

    const trayContainer = type === 'rm' ? String(batch.mainVessel || '').trim() : String(batch.fillingLine || '').trim();
    const traySlot = `${batch.batchNo}/A`;
    setLocalItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      done: true,
      dispensed: finalVal,
      trayContainer: trayContainer || it.trayContainer,
      traySlot: it.traySlot || traySlot,
      dispensedAt: new Date().toISOString(),
    } : it));
  };

  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    if (saving || localItems.length === 0 || !localItems.every((r) => r.done)) return;
    if (type === 'pm' && bprBlockedByBmr) return;
    const lineBlock = validateAllDispensedLines(localItems);
    if (lineBlock) {
      setDispenseErr(lineBlock);
      return;
    }
    setSaving(true);
    try {
      // Completing the tray keeps the batch at 'dispensing' (tray complete) — the IPQA pre-production gate
      // (Initiate Production) now performs the → in_production transition once verifications pass.
      if (type === 'rm') await Promise.resolve(onSave({ dispensingRM: localItems }));
      else await Promise.resolve(onSave({ dispensingPM: localItems, bprStatus: 'filling' }));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = async () => {
    if (saving) return;
    const lineBlock = validateAllDispensedLines(localItems);
    if (lineBlock) {
      setDispenseErr(lineBlock);
      return;
    }
    setSaving(true);
    try {
      if (type === 'rm') await Promise.resolve(onSave({ dispensingRM: localItems }));
      else await Promise.resolve(onSave({ dispensingPM: localItems }));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`${type.toUpperCase()} Dispensing - ${formatUnifiedBatchLabel(batch)}`} size="lg">
      <Tip color="purple" icon={<Scale size={14} />}>
        Weigh and dispense each item to the required quantity. Stock must be at this batch&apos;s manufacturing site
        {muZone ? (
          <>
            {' '}
            (<b>{muZone}</b> · {muBucketLabel})
          </>
        ) : (
          ' — schedule the batch first'
        )}
        . Use MTR from warehouse if qty at site is insufficient.
      </Tip>
      {reqError && (
        <div className="rounded-lg border border-err-soft bg-err-soft/60 text-err px-3 py-2 text-xs mt-3">
          {reqError}
        </div>
      )}
      {bprBlockedByBmr && (
        <Tip color="amber" icon={<AlertTriangle size={14} />}>
          Awaiting BMR QC release — BPR cannot move to <strong>Filling</strong> until the BMR is <strong>Cleared</strong>. You can still push <strong>fill / pack / FG dates</strong> using <b>Reschedule dates</b> below if the BPR plan slips.
        </Tip>
      )}
      {dispenseErr && (
        <div className="rounded-lg border border-warn-soft bg-warn-soft/60 text-warn px-3 py-2 text-xs mt-2">
          {dispenseErr}
        </div>
      )}
      <div className="mb-4">
        {isRm ? (
          <div className="mb-1.5 text-[11px] text-gray-600">
            <b>{total}</b> items · <b className="text-emerald-600">{done} dispensed</b> · <b className="text-blue-600">{pickedCount} picked</b> · <b className="text-amber-600">{pendingPickCount} pending pick</b>
            {shiftLeadName ? <> · assigned to <b>{shiftLeadName}</b></> : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-xs text-ink-3 mb-1.5">
          <span className="inline-flex items-center gap-2">
            Progress
            <button
              type="button"
              onClick={() => setShowPickList(true)}
              disabled={localItems.length === 0}
              title="Everything this batch needs, where it is picked from, and what is still outstanding — viewable and downloadable"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border text-[10px] font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClipboardList size={11} /> Pick list
            </button>
          </span>
          <span className="font-mono font-bold text-ok">{done}/{total} ({pct}%)</span>
        </div>
        <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-ok' : pct > 50 ? 'bg-warn' : 'bg-err'}`} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="space-y-2">
        {reqLoading ? (
          <div className="py-4 text-center text-sm text-ink-3">Loading {type === 'rm' ? 'RM' : 'PM'} requirements…</div>
        ) : localItems.length === 0 ? (
          <div className="py-3 px-3 rounded-lg bg-surface-2 border border-border text-ink-2 text-xs">
            No {type === 'rm' ? 'RM' : 'PM'} items to dispense for this batch. If this is expected, verify the batch is linked to Planning BOM.
          </div>
        ) : (
          localItems.map((r, idx) => (
            <div key={idx} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${r.done ? 'border-ok-soft bg-ok-soft/60' : 'border-border'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.done ? 'bg-ok-soft border border-ok-soft text-ok' : 'bg-surface-3 border border-border text-ink-3'}`}>
                {r.done ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink">{r.inci || r.name || nameByCode?.[r.code] || r.code}</div>
                <div className="text-[10px] text-ink-4">
                  {r.code} — Target:{' '}
                  <b>{type === 'rm' ? formatQtyWithUnit(r.required, 'kg') : formatQtyWithUnit(r.required, 'pcs')}</b>
                  {' · '}
                  At site{muZone ? ` (${muBucketLabel})` : ''}:{' '}
                  <b
                    className={
                      !qtyWithinMuStock(r.required, muQtyStrForCode(r.code), qtyKind)
                        ? 'text-warn'
                        : 'text-brand'
                    }
                  >
                    {muStockLoading ? '…' : formatQtyWithUnit(muQtyStrForCode(r.code), qtyKind)}
                  </b>
                </div>
              </div>
              {r.done ? (
                <div className="inline-flex items-center gap-1 text-xs font-mono text-ok font-semibold">
                  <Check size={12} /> {formatQtyExact(r.dispensed, qtyKind)} {unit}
                  {isRm && (r.leftoverQty ?? 0) > 0 ? <span className="text-[10px] text-gray-400">({formatQtyExact(r.leftoverQty ?? 0, 'kg')} kg leftover)</span> : null}
                </div>
              ) : isRm ? (
                <div className="flex items-center gap-2">
                  {lineIsPicked(r) ? (
                    <>
                      {(() => {
                        // Picking can span several racks, so show how much of the requirement is
                        // actually covered — a short pick would otherwise look ready to dispense.
                        const got = linePickedQty(r);
                        const short = got < r.required - 1e-9;
                        return (
                          <span
                            title={linePicks(r).map((pk) => `${pk.packNo} · ${formatQtyExact(pk.qty, 'kg')} kg · ${pk.zone || '—'}/${pk.rack || '—'}`).join('\n')}
                            className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${short ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            PICKED {formatQtyExact(got, 'kg')}/{formatQtyExact(r.required, 'kg')}
                            {linePicks(r).length > 1 ? ` · ${linePicks(r).length} racks` : ''}
                          </span>
                        );
                      })()}
                      <button type="button" onClick={() => setPickForIdx(idx)} title="Add or remove racks for this line" className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold rounded-lg border border-emerald-500 text-emerald-700 hover:bg-emerald-50">🎯 Edit picks</button>
                      {/* Undo the whole pick in one click — picking is a floor decision, and the
                          operator must be able to put it back without going through the dialog. */}
                      <button
                        type="button"
                        onClick={() => clearLinePicks(idx)}
                        title="Remove this pick and return the line to Pending pick"
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold rounded-lg border border-border text-ink-2 hover:bg-surface-2"
                      >
                        <X size={11} /> Remove pick
                      </button>
                      <button type="button" onClick={() => setDispenseForIdx(idx)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white">🧪 Dispense</button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold">PENDING PICK</span>
                      <button type="button" disabled={r.rawMaterialId == null} title={r.rawMaterialId == null ? 'No RM master id on this line' : undefined} onClick={() => setPickForIdx(idx)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white">🎯 Pick</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={formatQtyExact(r.required, qtyKind)}
                    value={inputVals[idx] || ''}
                    onChange={e => setInputVals(prev => ({ ...prev, [idx]: e.target.value }))}
                    min={0}
                    step={type === 'rm' ? 'any' : 1}
                    className="w-20 px-2 py-1.5 border border-border rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleDispense(idx)}
                    disabled={isDispensingLineShort(r)}
                    title={
                      isDispensingLineShort(r)
                        ? `Short ${formatQtyShortage(
                            calcShortageQtyForKind(
                              materialQtyToNum(muQtyStrForCode(r.code)),
                              materialQtyToNum(r.required),
                              qtyKind
                            ),
                            qtyKind
                          )} at ${muZone} — MTR to this site first`
                        : undefined
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                      isDispensingLineShort(r)
                        ? 'bg-warn text-white cursor-not-allowed opacity-90'
                        : 'bg-ok hover:bg-ok text-white'
                    }`}
                  >
                    {isDispensingLineShort(r) ? (
                      <>
                        <AlertTriangle size={10} aria-hidden />
                        Short
                      </>
                    ) : (
                      <>
                        <Check size={10} aria-hidden />
                        Done
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 mt-5 pt-4 border-t border-hairline">
        <button onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
        {onReschedule && (
          <button type="button" onClick={onReschedule} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-brand bg-brand-soft border border-brand-soft rounded-lg hover:bg-brand-soft transition-colors">
            <Calendar size={13} /> Reschedule dates
          </button>
        )}
        <button
          onClick={handleSaveProgress}
          disabled={reqLoading || localItems.length === 0}
          className={`px-4 py-2 text-xs text-ink-2 border border-border rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          Save Progress
        </button>
        {localItems.length > 0 && localItems.every(r => r.done) && (
          <button
            onClick={handleComplete}
            disabled={bprBlockedByBmr}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${bprBlockedByBmr ? 'bg-ink-4 text-ink-3 cursor-not-allowed' : 'bg-ok hover:bg-ok text-white'}`}
          >
            <CheckCircle2 size={13} /> {isRm ? 'Complete Tray' : 'Complete Dispensing'}
          </button>
        )}
      </div>
      {showPickList && <PickListModal list={pickList} onClose={() => setShowPickList(false)} />}
      {isRm && pickForIdx != null && localItems[pickForIdx] && (
        <PickFromRackModal
          line={localItems[pickForIdx]}
          batch={batch}
          muZone={muZone}
          muLabel={muBucketLabel}
          resolvedName={nameByCode?.[localItems[pickForIdx].code]}
          onClose={() => setPickForIdx(null)}
          onPicked={(pick) => applyLinePatch(pickForIdx, pick)}
        />
      )}
      {isRm && dispenseForIdx != null && localItems[dispenseForIdx] && (
        <DispenseConfirmModal
          line={localItems[dispenseForIdx]}
          batch={batch}
          resolvedName={nameByCode?.[localItems[dispenseForIdx].code]}
          onClose={() => setDispenseForIdx(null)}
          onConfirm={(patch) => applyLinePatch(dispenseForIdx, patch)}
        />
      )}
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
      setYieldVal(yieldValueToInputString(batch.bulkYield));
    } else if (qcType === 'fill') {
      setYieldVal(yieldValueToInputString(batch.fillYield));
    } else {
      setYieldVal(yieldValueToInputString(batch.fgYield));
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
  const bulkYieldNum = roundYieldKg(parsedYieldNum);
  const fillFgYieldNum = roundYieldUnits(parsedYieldNum);
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

  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    if (saving || !yieldValid || !allResultsFilled) return;
    const merged = mergeQcSpecsWithRemarks(batch, qcType, specs, remarks);
    const upd: Partial<Batch> = { qcSpecs: merged };
    if (qcType === 'bmr') {
      upd.remarks = remarks;
      upd.bulkYield = bulkYieldNum; upd.bulkBatchAccepted = true;
      upd.bmrStatus = 'cleared';
    } else if (qcType === 'fill') {
      upd.fillYield = fillFgYieldNum; upd.fillBatchAccepted = true; upd.bprStatus = 'packaging';
    } else {
      upd.fgYield = fillFgYieldNum; upd.fgBatchAccepted = true; upd.bprStatus = 'fg_ready';
    }
    setSaving(true);
    try {
      await Promise.resolve(onSave(upd));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (saving || !allResultsFilled) return;
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
    setSaving(true);
    try {
      await Promise.resolve(onSave(upd));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modalW = qcType === 'bmr' || qcType === 'pack' ? 'xl' : 'lg';
  const fgSpecEntries = qcRef?.fgProductSpecs ? Object.entries(qcRef.fgProductSpecs) : [];
  /** BMR bulk QC: show master specs for raw materials only (not packaging). */
  const bmrBulkRmSpecs = (qcRef?.ingredientBulkSpecs ?? []).filter((row) => row.type === 'RM');
  const savingLabel =
    qcType === 'bmr' ? 'Saving bulk QC…' : qcType === 'fill' ? 'Saving fill QC…' : 'Saving pack QC…';

  return (
    <Modal
      onClose={onClose}
      disableDismiss={saving}
      title={`${titles[qcType]} - ${formatUnifiedBatchLabel(batch)}`}
      size={modalW}
    >
      <div className="relative min-h-[8rem]">
        {saving ? <ModalSavingOverlay label={savingLabel} /> : null}
        <Tip color="blue" icon={<Microscope size={14} />}>QC Officer: <b>{qcOfficer?.name || '-'}</b> reviewing <b>{formatUnifiedBatchLabel(batch)}</b>. Click each parameter to cycle: pending {'>'} pass {'>'} fail.</Tip>

      {qcType === 'bmr' && (
        <div className="mb-4 rounded-xl border border-brand-soft bg-brand-soft/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand mb-2">Master bulk quality (RM)</div>
          {qcRefLoading && <p className="text-xs text-ink-3">Loading specs from item master…</p>}
          {qcRefErr && !qcRefLoading && <p className="text-xs text-warn">{qcRefErr}</p>}
          {!qcRefLoading && !batchPk && (
            <p className="text-xs text-ink-3">Batch id missing — cannot load BOM-linked master specs.</p>
          )}
          {!qcRefLoading && batchPk && bmrBulkRmSpecs.length === 0 && (
            <p className="text-xs text-ink-3">No RM lines on this batch BOM, or RMs could not be resolved / have no bulk quality in master.</p>
          )}
          {bmrBulkRmSpecs.length > 0 && (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {bmrBulkRmSpecs.map((row) => {
                const specEntries = Object.entries(row.specs || {});
                return (
                  <div key={`${row.type}-${row.id}`} className="rounded-lg border border-white/80 bg-surface/70 p-2.5 text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono font-bold text-brand">{row.code}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand">RM</span>
                      <span className="text-ink-2 font-medium truncate">{row.name || row.inci || '—'}</span>
                    </div>
                    {specEntries.length === 0 ? (
                      <p className="text-[10px] text-ink-4">No bulk quality specs in master for this item.</p>
                    ) : (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                        {specEntries.map(([k, v]) => (
                          <div key={k} className="flex gap-1">
                            <dt className="text-ink-3 shrink-0">{k}:</dt>
                            <dd className="text-ink font-medium">{v}</dd>
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
        <div className="mb-4 rounded-xl border border-ok-soft bg-ok-soft/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ok mb-2">Finished product — Specs &amp; Stability (BOM / PR master)</div>
          {qcRefLoading && <p className="text-xs text-ink-3">Loading product specs…</p>}
          {qcRefErr && !qcRefLoading && <p className="text-xs text-warn">{qcRefErr}</p>}
          {!qcRefLoading && !batchPk && (
            <p className="text-xs text-ink-3">Batch id missing — cannot load product specs.</p>
          )}
          {!qcRefLoading && batchPk && fgSpecEntries.length === 0 && (
            <p className="text-xs text-ink-3">No Specs &amp; Stability on file for this SKU. Edit the product under BOM → Specs &amp; Stability.</p>
          )}
          {fgSpecEntries.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs max-h-[200px] overflow-y-auto">
              {fgSpecEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row sm:gap-2 rounded-md bg-surface/60 px-2 py-1 border border-white/90">
                  <dt className="text-ink-3 shrink-0 font-semibold">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-xl border border-hairline bg-surface-2/50">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-ink-3">{specs.length} params:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ok-soft text-ok font-bold text-[10px]"><Check size={10} /> {passed}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-err-soft text-err font-bold text-[10px]"><X size={10} /> {failed}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 text-ink-3 font-bold text-[10px]"><CircleDot size={10} /> {pending}</span>
        </div>
        {allPassed && <span className="ml-auto text-[10px] font-bold text-ok flex items-center gap-1"><ShieldCheck size={12} /> All Passed</span>}
        {hasFails && allReviewed && <span className="ml-auto text-[10px] font-bold text-err flex items-center gap-1"><AlertTriangle size={12} /> {failed} Failed</span>}
      </div>

      <div className="rounded-xl border border-hairline overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_90px] gap-2 px-3 py-2 bg-surface-2/80 border-b border-hairline text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
          <div>Parameter</div>
          <div>Result <span className="text-err">*</span></div>
          <div>Verdict</div>
        </div>
        {specs.map((s, i) => {
          const rowBg = s.passed === true ? 'bg-ok-soft/40' : s.passed === false ? 'bg-err-soft/40' : '';
          return (
            <div key={i} className={`grid grid-cols-[1fr_1fr_1fr_90px] gap-2 px-3 py-2.5 border-b border-hairline items-center ${rowBg} transition-colors`}>
              <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                {s.passed === true && <Check size={12} className="text-ok shrink-0" />}
                {s.passed === false && <X size={12} className="text-err shrink-0" />}
                {s.passed === null && <CircleDot size={12} className="text-ink-4 shrink-0" />}
                {s.param}
              </div>
              {/* <div className="text-xs text-ink-3 font-mono">{s.spec}</div> */}
              <input
                disabled={saving}
                className={`border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-brand focus:outline-none bg-surface disabled:bg-surface-2 ${String(s.result ?? '').trim() ? 'border-border' : 'border-warn-soft ring-1 ring-warn'}`}
                value={s.result}
                placeholder="Required — enter measured result"
                onChange={e => setSpecs(prev => prev.map((sp, j) => j === i ? { ...sp, result: e.target.value } : sp))}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => toggleResult(i)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${s.passed === true ? 'bg-ok-soft border-ok-soft text-ok hover:bg-ok-soft' :
                  s.passed === false ? 'bg-err-soft border-err-soft text-err hover:bg-err-soft' :
                    'bg-surface-2 border-border text-ink-4 hover:bg-surface-3 hover:text-ink-2'
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
          <label className={LBL}>{yieldLabels[qcType]} <span className="text-err">*</span></label>
          <input
            disabled={saving}
            className={`${INP} ${allPassed && !yieldValid ? 'border-warn-soft ring-1 ring-warn' : ''}`}
            type="number"
            min={0.001}
            step={qcType === 'bmr' ? '0.001' : '0.001'}
            inputMode="decimal"
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
              const expectedUnits = kgPerUnit > 0 ? actualBulkKg / kgPerUnit : plannedUnits;
              const sourceLabel = batch.bulkYield != null && Number(batch.bulkYield) > 0
                ? 'actual bulk KG'
                : 'planned batch KG';
              return `e.g. ${formatYieldUnits(expectedUnits)} units (from ${formatYieldKg(actualBulkKg)} ${sourceLabel})`;
            })()}
            value={yieldVal}
            onChange={e => setYieldVal(e.target.value)}
          />
          {qcType === 'bmr' && (
            <p className="text-[10px] text-ink-3 mt-1">
              Required to approve (decimals allowed, e.g. 498.75 KG). Compare to planned batch size{' '}
              <b>{batch.batchSize} KG</b> (order line / formula).
            </p>
          )}
          {qcType === 'fill' && (
            <p className="text-[10px] text-ink-3 mt-1">Required — how many sellable units were filled (feeds BPR / packaging planning).</p>
          )}
          {qcType === 'pack' && (
            <p className="text-[10px] text-ink-3 mt-1">Required — finished good units after packaging QC.</p>
          )}
          {allPassed && !yieldValid && (
            <p className="text-[10px] text-warn mt-1 font-semibold">Enter a yield quantity greater than zero to approve.</p>
          )}
        </div>
        <div><label className={LBL}>QC Remarks</label><input className={INP} placeholder="Overall remarks..." value={remarks} onChange={e => setRemarks(e.target.value)} disabled={saving} /></div>
      </div>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-hairline">
        <div className="text-[10px] text-ink-4">
          {!allReviewed && `${pending} parameter${pending !== 1 ? 's' : ''} still pending review`}
          {allReviewed && !allResultsFilled && 'Enter a Result for every parameter before Approve or Reject.'}
          {allReviewed && allResultsFilled && hasFails && `${failed} parameter${failed !== 1 ? 's' : ''} failed — reject to raise deviation`}
          {allPassed && allResultsFilled && yieldValid && 'All parameters passed — ready to approve'}
          {allPassed && allResultsFilled && !yieldValid && 'All parameters passed — enter yield quantity to approve'}
          {allPassed && !allResultsFilled && 'Enter a Result for each parameter to approve.'}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={saving || !allReviewed || !hasFails || !allResultsFilled}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-err hover:bg-err text-white font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            {saving ? 'Saving…' : `Reject (${failed})`}
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={saving || !allPassed || !yieldValid || !allResultsFilled}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-ok hover:bg-ok text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
            {saving ? 'Saving…' : 'Approve'}
          </button>
        </div>
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

function batchLifecycleDisplayForBatch(batch: Batch, outboundMrns: MRNRecordFromApi[]): BatchLifecycleStage {
  return getBatchLifecycleDisplayStage(batch, {
    effectiveRmConnected: effectiveRmConnected(batch, outboundMrns),
    effectivePmConnected: effectivePmConnected(batch, outboundMrns),
  });
}

function UnifiedPipelineStrip({ batch, outboundMrns }: { batch: Batch; outboundMrns: MRNRecordFromApi[] }) {
  const currentStatus = batchLifecycleDisplayForBatch(batch, outboundMrns);
  const idx = pipelineIndex(currentStatus, BATCH_LIFECYCLE_PIPELINE);
  const failed = batch.bmrStatus === 'qc_failed' || batch.bprStatus === 'qc_failed';
  const clearedIdx = pipelineIndex('cleared', BATCH_LIFECYCLE_PIPELINE);
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
      {BATCH_LIFECYCLE_PIPELINE.map((p, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        const isFailed = failed && state === 'active';
        const showDivider = i === clearedIdx + 1;
        return (
          <React.Fragment key={p.key}>
            {showDivider && (
              <div className="shrink-0 px-1 text-[8px] font-bold text-brand uppercase tracking-tighter" title="Packaging phase">
                →
              </div>
            )}
            <div className="flex items-center gap-0.5 shrink-0">
              <div
                className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border ${
                  isFailed ? 'bg-err-soft border-err-soft text-err'
                    : state === 'done' ? 'bg-ok-soft border-ok-soft text-ok'
                      : state === 'active' ? 'bg-brand-soft border-brand-soft text-brand'
                        : 'bg-surface-2 border-border text-ink-4'
                }`}
                title={isFailed ? `${p.label} (Failed)` : p.label}
              >
                {isFailed ? <X size={10} strokeWidth={3} /> : state === 'done' ? <Check size={10} strokeWidth={3} /> : state === 'active' ? p.icon : <CircleDot size={8} />}
              </div>
              {i < BATCH_LIFECYCLE_PIPELINE.length - 1 && (
                <div className={`w-2.5 h-px ${i < idx ? 'bg-ok' : 'bg-surface-3'}`} />
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
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
  /** WH stock only — MTR transferable pool = min(reserved, whStockOnly) */
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
  const batchPk = (batch as Batch & { _pk?: number })._pk;
  const [batchReservedMap, setBatchReservedMap] = useState<Record<string, number>>({});
  const [loadingBatchReserved, setLoadingBatchReserved] = useState(false);

  useEffect(() => {
    if (!batchPk) {
      setBatchReservedMap({});
      return;
    }
    setLoadingBatchReserved(true);
    fetchBatchMtrReserved(batchPk)
      .then(({ byCode }) => setBatchReservedMap(byCode || {}))
      .catch(() => setBatchReservedMap({}))
      .finally(() => setLoadingBatchReserved(false));
  }, [batchPk, batch.bmrNo, type]);

  // Troubleshooting: log MTR maps when batch/type change
  useEffect(() => {
    console.log('[MTRModal] maps', {
      type,
      batch: batch.bmrNo,
      atFacilityMap: { ...atFacilityMap },
      whStockOnlyMap: { ...whStockOnlyMap },
      reservedMap: { ...reservedMap },
      batchReservedMap: { ...batchReservedMap },
    });
  }, [type, batch.bmrNo, atFacilityMap, whStockOnlyMap, reservedMap, batchReservedMap]);

  const [priority, setPriority] = useState('Normal');
  const [reqDate, setReqDate] = useState(type === 'rm' ? (batch.rmConnectDate || today()) : (batch.pmConnectDate || today()));
  const [warehouseAreas, setWarehouseAreas] = useState<FacilityAreaDTO[]>([]);
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  /** Warehouse zone (RM and PM/BPR MTR) — from Facility Management */
  const [transferFromCode, setTransferFromCode] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [derivedItems, setDerivedItems] = useState<DispensingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const effectiveItems = baseItems.length > 0 ? baseItems : derivedItems;
  // localItems[].required = qty to request (to transfer); default max(0, batch need - at facility)
  const [localItems, setLocalItems] = useState<DispensingItem[]>(() => effectiveItems.map(i => ({ ...i })));
  const shortages = localItems
    .map((it) => {
      const toTransfer = it.required ?? 0;
      if (toTransfer <= 0) return null;
      const code = String(it.code ?? '').trim();
      const batchRes = batchReservedMap[code];
      const mtrPool = qtyMtrFromReserved(
        whStockOnlyMap[code] ?? 0,
        reservedMap[code] ?? 0,
        batchRes,
      );
      return {
        code,
        required: toTransfer,
        available: mtrPool,
        short: isQtyShort(mtrPool, toTransfer, type === 'rm' ? 'kg' : 'pcs'),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null && x.short);
  const hasShortage = !loadingBatchReserved && shortages.length > 0;

  const allWhZones = warehouseAreas.flatMap(a => a.zones);
  const allProductionZones = productionAreas.flatMap(a => a.zones);

  const needLoadInMtr = (type === 'rm' && batchItems.length === 0 && passedItems.length === 0) || (type === 'pm' && batchItems.length === 0);

  const loadRmItemsFromPlanningExtracted = (): Promise<void> =>
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
      });

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

    const resolveRmBatchSizeKg = (apiBatchSizeKg?: number | null): number => {
      const fromApi = Number(apiBatchSizeKg) || 0;
      if (fromApi > 0) return fromApi;
      const fromBatch = Number(batch.batchSize) || 0;
      if (fromBatch > 0) return fromBatch;
      const orderQty = Number(batch.orderQty) || 0;
      const batches = Number(batch.totalBatches) || 0;
      if (orderQty > 0 && batches > 0) return orderQty / batches;
      return 0;
    };
    const flattenBomRmLines = (lines: BOMRmLine[]): BOMRmLine[] => {
      const out: BOMRmLine[] = [];
      for (const line of lines) {
        const nested = (line as { ingredients?: BOMRmLine[] }).ingredients;
        if (Array.isArray(nested) && nested.length > 0) out.push(...nested);
        else out.push(line);
      }
      return out;
    };

    // PM: use batch BOM (planning_batches) like ReserveMaterialModal so PM lines always show for this SO
    if (type === 'pm') {
      loadBatchBom
        .then((batchBomRes) => {
          if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'planning_batch' && (batchBomRes.data.pmLines?.length ?? 0) > 0) {
            const pmLines = (batchBomRes.data.pmLines ?? []) as BOMPmLine[];
            const batchUnits =
              batchBomRes.data.batchSizeKg != null && Number(batchBomRes.data.batchSizeKg) > 0
                ? Number(batchBomRes.data.batchSizeKg)
                : batch.totalBatches
                  ? Math.ceil((batch.orderQty || 0) / batch.totalBatches)
                  : Number(batch.batchSize) || 0;
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

    // RM: batch BOM first (same as Reserve RM), then planning-extracted fallback
    loadBatchBom
      .then((batchBomRes) => {
        if (batchBomRes.success && batchBomRes.data && batchBomRes.data.source === 'planning_batch' && (batchBomRes.data.rmLines?.length ?? 0) > 0) {
          const batchSizeKg = resolveRmBatchSizeKg(batchBomRes.data.batchSizeKg);
          const rmLines = flattenBomRmLines((batchBomRes.data.rmLines ?? []) as BOMRmLine[]);
          const rmItems: DispensingItem[] = rmLines
            .filter((line) => line.rm_code || (line as { code?: string }).code)
            .map((line) => {
              const code = (line.rm_code || (line as { code?: string }).code) as string;
              const pct = Number((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0)) || 0;
              const directQty = Number((line as { qty_per_unit?: number; quantity?: number; qty?: number }).qty_per_unit
                ?? (line as { quantity?: number }).quantity
                ?? (line as { qty?: number }).qty
                ?? 0) || 0;
              const requiredRaw = pct > 0 ? (batchSizeKg * pct) / 100 : directQty;
              const required = normalizeQtyForCompare(requiredRaw, 'kg');
              return {
                code,
                inci: (line.inci_name ?? (line as { inci_name?: string }).inci_name ?? code) as string,
                name: (line.inci_name ?? (line as { inci_name?: string }).inci_name ?? code) as string,
                required,
                dispensed: 0,
                done: false,
              };
            })
            .filter((x) => x.required > 0);
          setDerivedItems(rmItems);
          return;
        }
        return loadRmItemsFromPlanningExtracted();
      })
      .catch(() => setDerivedItems([]))
      .finally(() => setLoadingItems(false));
  }, [needLoadInMtr, type, batch.soNo, batch.productName, batch.sku, batch.totalBatches, batch.bmrNo, batch.orderQty, batch.batchSize, (batch as Batch & { _pk?: number })._pk]); // eslint-disable-line react-hooks/exhaustive-deps

  /** When BOM paths fail but RM is already reserved, show reserved lines so MTR can proceed. */
  useEffect(() => {
    if (type !== 'rm' || batchItems.length > 0 || passedItems.length > 0) return;
    if (loadingItems || loadingBatchReserved || derivedItems.length > 0 || localItems.length > 0) return;
    const reservedEntries = Object.entries(batchReservedMap).filter(([, qty]) => (Number(qty) || 0) > 0);
    if (reservedEntries.length === 0) return;
    setDerivedItems(
      reservedEntries.map(([code, qty]) => ({
        code,
        inci: code,
        name: code,
        required: qty,
        dispensed: 0,
        done: false,
      })),
    );
  }, [type, batchItems.length, passedItems.length, loadingItems, loadingBatchReserved, batchReservedMap, derivedItems.length, localItems.length]);

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
  }, [batch.bmrNo, type, effectiveItems, atFacilityMap]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [needLoadInMtr, derivedItems, localItems.length, atFacilityMap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      fetchFacilityAreas('warehouse'),
      fetchFacilityAreas('production'),
    ]).then(([whRes, prodRes]) => {
      const wh = whRes.data || [];
      const prod = prodRes.data || [];
      setWarehouseAreas(wh);
      setProductionAreas(prod);
    });
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduledMuFromBatch = String(batch.scheduledMuZone || '').trim();

  useEffect(() => {
    setTransferFromCode('');
    if (!scheduledMuFromBatch) setTransferTo('');
  }, [type, scheduledMuFromBatch]);

  useEffect(() => {
    if (allWhZones.length === 0 && allProductionZones.length === 0) return;
    /* RM and BPR/PM MTR: same route WH (pick) → production (manufacturing unit receive). */
    setTransferFromCode((prev) => prev || (allWhZones[0]?.code ?? ''));
    if (scheduledMuFromBatch) {
      setTransferTo(scheduledMuFromBatch);
      return;
    }
    setTransferTo((prev) => prev || (allProductionZones[0]?.code ?? ''));
  }, [type, allWhZones.length, allProductionZones.length, scheduledMuFromBatch]);

  const fromLabel = zoneLabelInAreas(warehouseAreas, transferFromCode);
  const toLabel = zoneLabelInAreas(productionAreas, transferTo);

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

  const handleCompleteStep = async () => {
    if (sending || effectiveItems.length === 0) return;
    setSending(true);
    try {
      await Promise.resolve(onSave(applyStepUpdates()));
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    // Only include lines with quantity to transfer (required > 0)
    if (linesToSend.length === 0) return;
    if (hasShortage) {
      addToast(
        'error',
        'Cannot send MTR: reserved qty at warehouse is less than the quantity to transfer for one or more items. Reserve material for this batch or reduce transfer qty.',
      );
      return;
    }
    if (!String(transferTo || '').trim()) {
      addToast('error', allProductionZones.length === 0
        ? 'No manufacturing zones in Facility Management. Add production areas/zones under Masters first.'
        : 'Select Transfer To (manufacturing zone) before sending MTR.');
      return;
    }
    console.log('[MTRModal] submit payload', {
      type,
      batch: batch.bmrNo,
      lineItems: linesToSend.map(({ code, required }) => ({ code, quantity: required })),
    });
    setSending(true);
    try {
      await createMRN({
        requestedBy: 'Production (MTR)',
        notes: `MTR for ${formatUnifiedBatchLabel(batch)}`,
        lineItems: linesToSend.map((it, i) => ({
          id: `m${i + 1}`,
          code: it.code,
          itemCode: it.code,
          quantity: materialQtyToNum(sanitizeMrnLineItemQuantity(it.required ?? 0)),
          unit: type === 'rm' ? 'KG' : 'PCS',
          notes: it.inci || it.name || '',
        })),
        bmrNo: batch.bmrNo,
        source: 'MTR',
        itemType: type,
        ...(String(transferFromCode || '').trim() ? { whDispatchZone: String(transferFromCode).trim() } : {}),
        ...(String(transferTo || '').trim() ? { muReceiveZone: String(transferTo).trim() } : {}),
        ...(String(reqDate || '').trim() ? { requiredByDate: String(reqDate).trim().slice(0, 10) } : {}),
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

  const qtyKindMtr = type === 'rm' ? ('kg' as const) : ('pcs' as const);
  const fmtQtyMtr = (n: number) => formatQtyExact(n, qtyKindMtr);

  return (
    <Modal onClose={onClose} title={`Material Transfer Request - ${formatUnifiedBatchLabel(batch)}`} size="lg">
      <Tip color="orange" icon={<Send size={14} />}>Request transfer of {type.toUpperCase()} from <b>{fromLabel}</b> to <b>{toLabel}</b></Tip>
      {scheduledMuFromBatch && (
        <Tip color="teal" icon={<MapPin size={14} />}>
          Manufacturing site from batch schedule: <b>{toLabel}</b>. MTR will receive at this ML zone.
        </Tip>
      )}
      {loadingBatchReserved && (
        <div className="mt-3 text-xs text-ink-3">Loading batch reservation…</div>
      )}
      {hasShortage && (
        <div className="mt-3 px-3 py-2.5 rounded-lg border border-err-soft bg-err-soft text-err text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span><strong>Send MTR blocked:</strong> &quot;To transfer&quot; exceeds what can move from WH for this batch (pool = batch reserved, capped by WH stock). Reserve RM/PM for this batch first, lower transfer qty, or use <b>Complete step</b> if stock is already at the production facility.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className={LBL}>Transfer From</label>
          <select className={INP} value={transferFromCode} onChange={e => setTransferFromCode(e.target.value)}>
            {allWhZones.length === 0 && <option value="">No warehouse zones in Facility Management</option>}
            {warehouseAreas.map((a) => (
              <optgroup key={a.id} label={`${a.name} (warehouse)`}>
                {(a.zones || []).map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}{z.zoneLabel ? ` — ${z.zoneLabel}` : ''} ({z.code})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={LBL}>Transfer To (ML / MU zone)</label>
          <select
            className={INP}
            value={transferTo}
            onChange={e => setTransferTo(e.target.value)}
            disabled={!!scheduledMuFromBatch}
            title={scheduledMuFromBatch ? 'Set during Schedule Batch; change there if needed.' : undefined}
          >
            {allProductionZones.length === 0 && <option value="">No production zones in Facility Management</option>}
            {productionAreas.map((a) => (
              <optgroup key={a.id} label={`${a.name} (manufacturing unit)`}>
                {(a.zones || []).map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}{z.zoneLabel ? ` — ${z.zoneLabel}` : ''} ({z.code})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div><label className={LBL}>Required By Date</label><input type="date" className={INP} value={reqDate} onChange={e => setReqDate(e.target.value)} /></div>
        <div><label className={LBL}>Priority</label><select className={INP} value={priority} onChange={e => setPriority(e.target.value)}><option>Urgent</option><option>Normal</option><option>Low</option></select></div>
      </div>
      <SectionLabel icon={<Package size={12} />} color="text-ink-2">
        Items to Transfer — x = needed, y = already at production facility, to transfer = max(0, x−y). At WH for MTR = reserved (production allocation), not free stock.
      </SectionLabel>
      {loadingItems && (
        <div className="py-4 text-center text-sm text-ink-3">Loading items for this batch…</div>
      )}
      {!loadingItems && localItems.length === 0 && (
        <div className="py-3 px-3 rounded-lg bg-surface-2 border border-border text-ink-2 text-xs">No {type.toUpperCase()} items for this batch. Confirm BOM in Planning for this SO{type === 'rm' ? ', or reserve RM first' : ', or reserve PM first'}.</div>
      )}
      {localItems.length > 0 && (
        <div className="overflow-auto max-h-[70vh] rounded-xl border border-hairline text-xs">
          <table className="w-full">
            <thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-ink-3">Item</th>
              <th scope="col" className="px-2 py-1.5 text-left">Code</th>
              <th scope="col" className="px-2 py-1.5 text-right">Required</th>
              <th scope="col" className="px-2 py-1.5 text-right">At production facility</th>
              <th scope="col" className="px-2 py-1.5 text-left">To transfer</th>
              <th scope="col" className="px-2 py-1.5 text-right">Reserved (WH)</th>
              <th scope="col" className="px-2 py-1.5 text-left">Unit</th>
            </tr></thead>
            <tbody className="divide-y divide-hairline">{localItems.map((r, i) => {
              const batchNeed = effectiveItems[i]?.required ?? r.required;
              const atFacility = atFacilityMap[r.code] ?? 0;
              const toTransfer = r.required;
              const code = String(r.code ?? '').trim();
              const batchRes = batchReservedMap[code];
              const mtrPool = qtyMtrFromReserved(
                whStockOnlyMap[code] ?? 0,
                reservedMap[code] ?? 0,
                batchRes,
              );
              const short = toTransfer > 0 && isQtyShort(mtrPool, toTransfer, qtyKindMtr);
              return (
                <tr key={i} className={short ? 'bg-warn-soft/60' : ''}>
                  <td className="px-2 py-1.5 font-semibold">{r.inci || r.name}</td>
                  <td className="px-2 py-1.5 text-ink-3 font-mono">{r.code}</td>
                  <td className="px-2 py-1.5 font-mono text-right">{fmtQtyMtr(batchNeed)}</td>
                  <td className="px-2 py-1.5 font-mono text-right text-brand">{fmtQtyMtr(atFacility)}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      className="w-20 px-1.5 py-0.5 border border-border rounded font-mono text-right"
                      min={0}
                      step={type === 'rm' ? 'any' : 1}
                      value={toTransfer}
                      onChange={(e) => setItemQty(i, materialQtyToNum(parseQtyInputString(e.target.value)))}
                    />
                  </td>
                  <td className={`px-2 py-1.5 font-mono text-right ${short ? 'text-warn' : 'text-ink-2'}`}>
                    {fmtQtyMtr(mtrPool)}{short && <span className="text-err ml-1">(short {fmtQtyMtr(calcShortageQtyForKind(mtrPool, toTransfer, qtyKindMtr))})</span>}
                  </td>
                  <td className="px-2 py-1.5">{unit}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-hairline">
        <button onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
        {allAtMu ? (
          <button onClick={handleCompleteStep} disabled={sending} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-ok hover:bg-ok text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"><CheckCircle2 size={13} /> {sending ? 'Completing…' : 'Complete step'}</button>
        ) : (
          <button onClick={handleSubmit} disabled={sending || loadingBatchReserved || linesToSend.length === 0 || hasShortage} title={hasShortage ? 'Insufficient batch reserved stock at WH for one or more lines' : undefined} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-brand hover:bg-brand text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"><Send size={13} /> {sending ? 'Sending…' : 'Send MTR'}</button>
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
        className="w-full text-xs font-mono border border-border rounded-lg px-3 py-2 bg-surface"
      />
      {parseError && <p className="text-xs text-err">{parseError}</p>}
      {decoded && !parseError && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-2 uppercase">Decoded</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink">
            {Object.entries(decoded).map(([k, v]) => (
              <span key={k} className="col-span-2 sm:col-span-1"><dt className="inline font-medium">{k}:</dt> <dd className="inline">{String(v ?? '—')}</dd></span>
            ))}
          </dl>
          <p className="text-xs font-semibold text-ok pt-2 border-t border-border">Action: Put away at MU location (from QR) and record movement.</p>
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

/** When MTR saved only a destination zone (no rack), map zone code to production area + zone. */
function matchMrnZoneCodeToFacility(
  muReceiveZone: string | null | undefined,
  areas: FacilityAreaDTO[]
): { areaId: number; zoneId: number; zone: ZoneDTO } | null {
  const zt = (muReceiveZone || '').trim();
  if (!zt) return null;
  for (const area of areas) {
    for (const zone of area.zones || []) {
      if (zone.code === zt) return { areaId: area.id, zoneId: zone.id, zone };
      if (muFacilityZoneDisplayLabel(zone) === zt || (zone.name || '').trim() === zt) {
        return { areaId: area.id, zoneId: zone.id, zone };
      }
    }
  }
  return null;
}

function zoneLabelInAreas(areas: FacilityAreaDTO[], zoneCode: string): string {
  const zc = (zoneCode || '').trim();
  if (!zc) return '—';
  for (const a of areas) {
    for (const z of a.zones || []) {
      if (z.code === zc) {
        return `${a.name} — ${z.name}${z.zoneLabel ? ` — ${z.zoneLabel}` : ''}`.trim();
      }
    }
  }
  return zc;
}

function MRNDetailModal({
  mrn: mrnProp,
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
  // Keep a live copy of the MRN so per-line phases refresh after each partial
  // receive/complete action. Reading the frozen prop caused the modal to show
  // stale "In transit" lines and fire doomed re-receive requests that the
  // backend rejects ("line already received_at_mu").
  const [liveMrn, setLiveMrn] = useState<MRNRecordFromApi>(mrnProp);
  useEffect(() => { setLiveMrn(mrnProp); }, [mrnProp]);
  // Fetch the freshest MRN on open so a stale list snapshot (e.g. a line already
  // received at MU in another session) self-corrects instead of firing a doomed
  // re-receive request.
  useEffect(() => {
    let cancelled = false;
    fetchMRNById(mrnProp.id)
      .then((fresh) => { if (!cancelled && fresh) setLiveMrn(fresh); })
      .catch(() => { /* keep snapshot on failure */ });
    return () => { cancelled = true; };
  }, [mrnProp.id]);
  const mrn = liveMrn;
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

  const isOutboundMtr = mrn.source === 'MTR' && !mrn.isInboundFromMu;

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

  const mtrMuDestLocked = isOutboundMtr && Boolean(String(mrn.muReceiveZone || '').trim());

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
      const zOnly =
        isOutboundMtr && !String(mrn.muReceiveRack || '').trim()
          ? matchMrnZoneCodeToFacility(mrn.muReceiveZone, areas)
          : null;
      if (zOnly) {
        setMuLocationSource('facility');
        setSelectedMuAreaId(zOnly.areaId);
        setSelectedMuZoneId(zOnly.zoneId);
        setMuReceiveZone(zOnly.zone.code);
        const racks = [...(zOnly.zone.racks || [])].sort((a, b) =>
          String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
        );
        const first = racks[0];
        if (first) {
          setSelectedMuRackId(first.id);
          setMuReceiveRack(first.code);
          setLocationPrefix(first.code);
        } else {
          setSelectedMuRackId('');
          setMuReceiveRack(mrn.muReceiveRack ?? '');
          setLocationPrefix(mrn.locationPrefix ?? '');
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
    }
  }, [mrn.id, mrn.muReceiveZone, mrn.muReceiveRack, mrn.locationPrefix, productionFacilityData, productionFacilityLoading, isOutboundMtr]);

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
      setLiveMrn(updated);
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
      setLiveMrn(updated as MRNRecordFromApi);
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
  const hasSavedPickForOutbound = !isOutboundMtr || Boolean(String(mrn.assignedPicker || '').trim() || String(mrn.transferTeam || '').trim());
  const canInitiateOutboundTransfer = !isOutboundMtr || hasSavedPickForOutbound;
  const handleSubmitLogistics = () => {
    if (isOutboundMtr && !canInitiateOutboundTransfer) {
      addToast('error', 'Save pick first, then initiate transfer.');
      return;
    }
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
    <ModalOverlay onClose={onClose} z="z-50" dismissable={false}>
      <div className="bg-surface rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"transfer-order-modal-title"}>
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink" id="transfer-order-modal-title">Transfer order — {mrn.mrnNo}</h2>
            <p className="text-sm text-ink-2 mt-0.5">
              {mrn.requestedBy}
              {(() => {
                const src = mrnSourceDocFromApi(mrn);
                return src ? ` · ${src.kind.toUpperCase()} ${src.id}` : '';
              })()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-lg text-ink-2" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-warn-soft text-warn border-warn-soft">{status}</span>
            {mrn.source && <span className="px-3 py-1 bg-brand-soft text-brand border border-brand-soft rounded-full text-xs font-semibold">{mrn.source}</span>}
          </div>

          <section className="bg-surface-2/80 rounded-xl p-5 border border-border/80 space-y-4">
            <h3 className="text-sm font-semibold text-ink-2">Assign & receive</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 uppercase mb-1">Status</label>
                {isOutboundMtr ? (
                  <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-2">
                    <span className="font-semibold text-ink">{status}</span>
                    <p className="text-[11px] text-ink-2 mt-1 leading-snug">{outboundMtrStageHint({ ...mrn, status })}</p>
                  </div>
                ) : (
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    {MRN_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-2 uppercase mb-1">Assigned picker</label>
                {isOutboundMtr ? (
                  <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-2">
                    <span className={mrn.assignedPicker ? 'font-medium text-ink' : 'text-ink-3'}>
                      {mrn.assignedPicker?.trim() || 'Unassigned'}
                    </span>
                    {mrn.transferTeam?.trim() ? (
                      <p className="text-[11px] text-ink mt-1 font-medium">Transfer: {mrn.transferTeam}</p>
                    ) : null}
                    <p className="text-[11px] text-ink-2 mt-1 leading-snug">
                      Picker is assigned in Warehouse → Transfer orders (locked after first save). Production sees the same values here.
                    </p>
                  </div>
                ) : (
                  <select value={assignedPicker} onChange={(e) => setAssignedPicker(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">Unassigned</option>
                    {assignablePickers.map((u) => <option key={u.id} value={u.displayName}>{u.displayName}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-2 uppercase mb-1">Received at MU (date)</label>
                <input type="date" value={receivedAtMu} onChange={(e) => setReceivedAtMu(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
            {isOutboundMtr && (
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-ink-2">Shared logistics</p>
                    <p className="mt-1 text-sm text-ink">{logisticsSummary || 'Capture on Initiate transfer. Production and Warehouse read the same MRN values.'}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      Dispatch: {formatDate(mrn.logisticsDispatchDate || logisticsDispatchDate || '')} · ETA: {formatDate(mrn.logisticsEtaDate || logisticsEtaDate || '')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-border bg-surface-2/90 p-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-semibold text-ink-2">
                  MU put-away <span className="text-err">*</span>
                </span>
                <label className={`flex items-center gap-1.5 text-xs ${mtrMuDestLocked ? 'text-ink-3 cursor-not-allowed' : 'text-ink-2 cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="mrn-mu-location-source"
                    className="rounded-full border-border"
                    disabled={mtrMuDestLocked}
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
                <label className={`flex items-center gap-1.5 text-xs ${mtrMuDestLocked ? 'text-ink-3 cursor-not-allowed' : 'text-ink-2 cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="mrn-mu-location-source"
                    className="rounded-full border-border"
                    disabled={mtrMuDestLocked}
                    checked={muLocationSource === 'custom'}
                    onChange={() => setMuLocationSource('custom')}
                  />
                  Custom (type zone / rack)
                </label>
              </div>
              <p className="text-[10px] text-ink-3">
                Production areas, zones, and racks are maintained under <strong>Facility Management</strong> (type Production). Zone <span className="font-mono">code</span> is stored for stock routing (e.g. include <span className="font-mono">MU02</span> or <span className="font-mono">LOC-MU02</span> for ML2).
              </p>
              {mtrMuDestLocked && (
                <p className="text-[10px] text-warn bg-warn-soft border border-warn-soft rounded-md px-2 py-1.5">
                  Destination manufacturing zone is fixed from <strong>Send MTR</strong>. Choose the <strong>rack</strong> for put-away, or change rack if needed.
                </p>
              )}

              {muLocationSource === 'facility' && productionFacilityLoading && (
                <p className="text-xs text-ink-3">Loading production locations…</p>
              )}
              {muLocationSource === 'facility' && !productionFacilityLoading && productionFacilityData.length === 0 && (
                <p className="text-xs text-warn bg-warn-soft border border-warn-soft rounded-md px-2 py-1.5">
                  No production areas found. Add a production area, zones, and racks in Facility Management, or use Custom.
                </p>
              )}

              {muLocationSource === 'facility' && !productionFacilityLoading && productionFacilityData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1">Production area</label>
                    <select
                      value={selectedMuAreaId === '' ? '' : String(selectedMuAreaId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuAreaId(v ? parseInt(v, 10) : '');
                        setSelectedMuZoneId('');
                        setSelectedMuRackId('');
                      }}
                      disabled={mtrMuDestLocked}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface disabled:bg-surface-3 disabled:text-ink-3"
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
                    <label className="block text-xs font-medium text-ink-2 mb-1">Zone</label>
                    <select
                      value={selectedMuZoneId === '' ? '' : String(selectedMuZoneId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuZoneId(v ? parseInt(v, 10) : '');
                        setSelectedMuRackId('');
                      }}
                      disabled={selectedMuAreaId === '' || mtrMuDestLocked}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface disabled:bg-surface-3 disabled:text-ink-4"
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
                    <label className="block text-xs font-medium text-ink-2 mb-1">Rack (code)</label>
                    <select
                      value={selectedMuRackId === '' ? '' : String(selectedMuRackId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedMuRackId(v ? parseInt(v, 10) : '');
                      }}
                      disabled={selectedMuZoneId === ''}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface disabled:bg-surface-3 disabled:text-ink-4"
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
                      <p className="text-[10px] text-warn mt-1">No racks in this zone. Add racks in Facility Management or use Custom.</p>
                    )}
                  </div>
                </div>
              )}

              {muLocationSource === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1">MU zone</label>
                    <input
                      type="text"
                      value={muReceiveZone}
                      readOnly={mtrMuDestLocked}
                      onChange={(e) => setMuReceiveZone(e.target.value)}
                      placeholder="e.g. LOC-MU01"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm read-only:bg-surface-3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1">MU rack</label>
                    <input
                      type="text"
                      value={muReceiveRack}
                      onChange={(e) => setMuReceiveRack(e.target.value)}
                      placeholder="e.g. R1"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {muLocationSource === 'facility' && !productionFacilityLoading && muReceiveZone && muReceiveRack && (
                <p className="text-[10px] text-ink-2">
                  Saved on MRN / movement log: <span className="font-mono font-medium">zone</span> = {muReceiveZone} ·{' '}
                  <span className="font-mono font-medium">rack</span> = {muReceiveRack}
                </p>
              )}
            </div>
          </section>

          {mrn.lineItems && mrn.lineItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-2">Line items</h3>
              <div className="overflow-auto max-h-[70vh] border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-20 bg-surface-3 border-b border-border [&_th]:bg-surface-3">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Item</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Code</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Quantity</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Unit</th>
                      {isOutboundMtr && (
                        <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Line transfer</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {mrn.lineItems.map((item) => {
                      const phase = mtrLinePhaseRaw(mrn, item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-surface-2 ${phase === 'completed' ? 'bg-surface-3/80 text-ink-3' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium text-ink">{item.item}</td>
                          <td className="px-3 py-2 text-ink-3">{item.itemCode}</td>
                          <td className="px-3 py-2 text-center font-medium">{item.quantity}</td>
                          <td className="px-3 py-2 text-center">{item.unit}</td>
                          {isOutboundMtr && (
                            <td className="px-3 py-2 text-[10px] text-ink-2 align-top">
                              <div className="font-medium text-ink">{formatMtrLinePhaseShort(phase)}</div>
                              {phase === 'not_initiated' && (
                                <>
                                  <p className="mt-1 text-ink-3 italic">Pending release from warehouse — add logistics to initiate transfer.</p>
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
                                <p className="mt-1 text-ink-3">Stock move completed — no further action.</p>
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
            <h3 className="text-sm font-semibold text-ink-2">Labels (QR per box for MU put-away)</h3>
            {mrn.lineItems && mrn.lineItems.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Select line item for labels</label>
                <select value={selectedLineItemId} onChange={(e) => setSelectedLineItemId(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm">
                  {mrn.lineItems.map((li) => <option key={li.id} value={li.id}>{li.item} ({li.itemCode}) — Qty: {li.quantity}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-ink-2 mb-1">No of boxes</label><input type="number" min={1} value={noOfBoxes} onChange={(e) => setNoOfBoxes(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">Units/box</label><input type="number" min={0} value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">Location prefix (MU)</label><input type="text" value={locationPrefix} onChange={(e) => setLocationPrefix(e.target.value)} placeholder="e.g. MU1-A" className="w-full px-2 py-1.5 border border-border rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-ink-2 mb-1">Batch / expiry</label><input type="text" value={grnBatchMfg} onChange={(e) => setGrnBatchMfg(e.target.value)} placeholder="Batch" className="w-full px-2 py-1.5 border border-border rounded text-sm" /></div>
            </div>
            <div className="flex items-center gap-3">
              {!labelsGenerated ? (
                <button onClick={handleGenerateLabels} disabled={generatingLabels} className="px-4 py-2 bg-ok text-white rounded-lg font-medium text-sm hover:bg-ok disabled:opacity-50">
                  {generatingLabels ? 'Generating…' : 'Generate Labels'}
                </button>
              ) : (
                <button onClick={() => { setLabelsGenerated(false); setLabels(null); }} className="px-4 py-2 bg-ink-4 text-white rounded-lg font-medium text-sm hover:bg-ink-2">Hide Labels</button>
              )}
            </div>
            {labelError && <p className="text-sm text-err">{labelError}</p>}
          </section> */}

          {/* {labelsGenerated && labels && labels.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-2">Label preview (one QR per box)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {labels.map((label) => {
                  let payload: Record<string, unknown> = {};
                  try { payload = JSON.parse(label.qrPayload); } catch { }
                  return (
                    <div key={label.boxIndex} className="bg-surface border-2 border-border rounded-lg p-4 shadow-sm">
                      <p className="text-xs font-mono font-bold text-ink mb-2">Box {label.boxIndex}</p>
                      <div className="flex justify-center mb-3"><img src={label.qrImageDataUrl} alt={`QR Box ${label.boxIndex}`} className="w-32 h-32 object-contain" /></div>
                      <div className="space-y-1 text-xs text-ink-2">
                        {payload.location_prefix && <p><span className="font-semibold">Location:</span> {String(payload.location_prefix)}</p>}
                        <p><span className="font-semibold">MRN:</span> {String(payload.mrn_no ?? '')}</p>
                        <p><span className="font-semibold">Units/box:</span> {String(payload.units_per_box ?? '')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border-2 border-dashed border-border bg-surface-2 p-4">
                <h4 className="text-xs font-semibold text-ink-2 uppercase mb-2">On scan — simulate</h4>
                <MRNScanSimulator mrnNo={mrn.mrnNo} />
              </div>
            </section>
          )} */}

          {/* <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2">Movement history (MU)</h3>
            {historyLoading ? <p className="text-xs text-ink-3">Loading…</p> : locationHistory.length === 0 ? <p className="text-xs text-ink-3">No movement recorded yet. Complete this transfer with MU zone/rack to log put-away.</p> : (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-surface-3 border-b border-border">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Action</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">From</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">To</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Qty</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
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

          {saveError && <div className="rounded-lg bg-err-soft border border-err-soft px-4 py-2 text-sm text-err">{saveError}</div>}

          {isOutboundMtr && !isClosedStatus(status) && (
            <p className="text-xs text-ink-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
              Warehouse initiates transfer <strong>per line</strong> (checkboxes in Warehouse). Here: mark <strong>received</strong> and <strong>stock move</strong> per line (checkboxes in the table), then <strong>MU zone / rack</strong> and <strong>Mark Succeeded</strong> for selected lines. The MRN stays open until every line is completed.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 border border-border rounded-lg text-ink font-medium text-sm hover:bg-surface-2 disabled:opacity-50">Close</button>
            <button onClick={() => persistUpdate({})} disabled={saving} className="px-4 py-2 bg-ink-2 text-white rounded-lg font-medium text-sm hover:bg-ink-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
            {!isOutboundMtr && (status === 'Pending' || status === 'Picked' || status === 'In Transfer') && (
              <button
                onClick={() => persistUpdate({ status: 'In Transit' })}
                disabled={saving}
                className="px-4 py-2 bg-brand text-white rounded-lg font-medium text-sm hover:bg-brand disabled:opacity-50"
              >
                Release from Warehouse
              </button>
            )}
            {(isOutboundMtr
              ? ((canInitiateOutboundTransfer && initiateSelectedIds.length > 0) || hasInTransitForReceive)
              : status === 'In Transit') && (
              <button
                type="button"
                onClick={() => {
                  if (isOutboundMtr) {
                    if (initiateSelectedIds.length > 0) {
                      if (!canInitiateOutboundTransfer) {
                        addToast('error', 'Save pick first, then initiate transfer.');
                        return;
                      }
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
                className="px-4 py-2 bg-warn text-white rounded-lg font-medium text-sm hover:bg-warn disabled:opacity-50"
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
                className="px-4 py-2 bg-ok text-white rounded-lg font-medium text-sm hover:bg-ok disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Succeeded
              </button>
            )}
          </div>
        </div>
      </div>
      {logisticsModalOpen && canInitiateOutboundTransfer && (
        <ModalOverlay onClose={() => setLogisticsModalOpen(false)} z="z-[60]" dismissable={false}>
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl border border-border" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"initiate-transfer-modal-title"}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-ink" id="initiate-transfer-modal-title">Initiate transfer</h3>
                <p className="text-xs text-ink-3 mt-1">Provide transfer details before moving selected lines to `In Transit`.</p>
              </div>
              <button onClick={() => setLogisticsModalOpen(false)} className="rounded-lg p-2 text-ink-3 hover:bg-surface-3" aria-label="Close logistics popup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-ink-2 mb-1">Tracking / LR no.</label>
                <input value={logisticsTrackingNo} onChange={(e) => setLogisticsTrackingNo(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-ink-2 mb-1">Driver / transporter</label>
                <input value={logisticsTransporter} onChange={(e) => setLogisticsTransporter(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-ink-2 mb-1">Dispatch date</label>
                <input type="date" value={logisticsDispatchDate} onChange={(e) => setLogisticsDispatchDate(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-ink-2 mb-1">ETA (optional)</label>
                <input type="date" value={logisticsEtaDate} onChange={(e) => setLogisticsEtaDate(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-ink-2 mb-1">Vehicle no.</label>
                <input value={logisticsVehicleNo} onChange={(e) => setLogisticsVehicleNo(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
              <button onClick={() => setLogisticsModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">Cancel</button>
              <button onClick={handleSubmitLogistics} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand">
                Save & initiate
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </ModalOverlay>
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
      (m.bprNo || '').toLowerCase().includes(q) ||
      (m.sourceRef || '').toLowerCase().includes(q) ||
      (m.productName || '').toLowerCase().includes(q) ||
      (m.batchNo || '').toLowerCase().includes(q) ||
      (m.lineItems || []).some((li) =>
        String(li.item || li.itemCode || li.notes || '').toLowerCase().includes(q)
      ) ||
      (m.status || '').toLowerCase().includes(q)
    );
  }, [mrnList, searchQuery]);

  return (
    <div className="flex-1 overflow-auto bg-surface-2/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Transfer orders</h1>
          <p className="text-sm text-ink-2 mt-1">MRNs sent from Production (MTR) — receive at MU, verify, generate QR labels, and complete.</p>
        </div>

        <div className="bg-surface rounded-xl border border-border/80 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search MRN, PR name, batch…" className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-border rounded-lg text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-warn" />
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-surface-2 border-b border-border [&_th]:bg-surface-2">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">MRN No.</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-ink-2 uppercase">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Source</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">PR name</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Request date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Expected date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2 uppercase">Batch number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-3">Loading transfer orders…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-3">No MRNs found. Raise an MTR from a batch (BMR/BPR) to see it here.</td></tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-warn-soft/50 cursor-pointer transition-colors" onClick={() => setSelectedMRN(m)}>
                      <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-brand">{m.mrnNo}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${String(m.status).toLowerCase() === 'succeeded' || m.status === 'Completed' ? 'bg-ok-soft text-ok border-ok-soft' :
                          m.status === 'Received at MU' ? 'bg-warn-soft text-warn border-warn-soft' :
                            m.status === 'In Transit' ? 'bg-brand-soft text-brand border-brand-soft' :
                              m.status === 'In Transfer' ? 'bg-brand-soft text-brand border-brand-soft' :
                                m.status === 'Picked' ? 'bg-brand-soft text-brand border-brand-soft' :
                                  'bg-surface-3 text-ink-2 border-border'
                          }`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const src = mrnSourceDocFromApi(m);
                          if (!src) return <span className="text-sm text-ink-4">—</span>;
                          return (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                  src.kind === 'bpr'
                                    ? 'bg-brand-soft text-brand border border-brand-soft'
                                    : 'bg-brand-soft text-brand border border-brand-soft'
                                }`}
                              >
                                {src.kind === 'bpr' ? 'BPR' : 'BMR'}
                              </span>
                              <span className="font-mono text-ink-2">{src.id}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink max-w-[220px] truncate" title={mrnDisplayPrName(m)}>
                        {mrnDisplayPrName(m)}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-2 whitespace-nowrap">{formatMrnDisplayDate(m.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-ink-2 whitespace-nowrap">{mrnDisplayExpectedDate(m)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-ink">{mrnDisplayBatchNumber(m)}</td>
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

function BatchDetailModal({ batch, team, stockRM, stockPM, reservedRM, reservedPM, outboundMrns, reservedItems, onClose, onSave, onAction, onMrnUpdated }: {
  batch: Batch; team: TeamMember[];
  stockRM: Record<string, number>; stockPM: Record<string, number>;
  reservedRM: Record<string, number>; reservedPM: Record<string, number>;
  outboundMrns: MRNRecordFromApi[];
  reservedItems: ProductionReservedItemRow[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onAction: (action: string, batch: Batch, extra?: { mtrRmItems?: DispensingItem[]; mtrPmItems?: DispensingItem[] }) => void;
  onMrnUpdated?: () => void;
}) {
  const [tab, setTab] = useState('overview');
  const [mrnDetailTarget, setMrnDetailTarget] = useState<MRNRecordFromApi | null>(null);
  const { data: batchMrnPickers = [] } = useQuery({
    queryKey: ['mrn-assignable-pickers', 'batch-detail'],
    queryFn: fetchMRNAssignablePickers,
    staleTime: 5 * 60 * 1000,
  });
  const packagingUnlocked = canShowPackagingActions(batch);
  const lifecycleDisplayStage = batchLifecycleDisplayForBatch(batch, outboundMrns);
  const pipeline = BATCH_LIFECYCLE_PIPELINE;

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

  const curStatus = lifecycleDisplayStage;
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
          const batchUnits =
            batchBomRes.data.batchSizeKg != null && Number(batchBomRes.data.batchSizeKg) > 0
              ? Number(batchBomRes.data.batchSizeKg)
              : batch.totalBatches
                ? Math.ceil((batch.orderQty || 0) / batch.totalBatches)
                : Number(batch.batchSize) || 0;
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
          const product = res.data.find((p) => ((p as unknown as { zoho_sku_code?: string }).zoho_sku_code ?? (p as unknown as { product_sku?: string }).product_sku) === batch.sku || p.product_name === batch.productName);
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

  const pipelineForStrip = BATCH_LIFECYCLE_PIPELINE;
  const stripTitle = 'Batch Lifecycle';
  const lifecyclePhaseLabel = isPackagingPhase(lifecycleDisplayStage) ? 'Packaging' : 'Manufacturing';
  const qcDetailSections = useMemo(() => collectQcSpecsRowsForDisplay(batch), [batch.qcSpecs]);

  const overviewCards: [string, string][] = [
    ['Batch ID', formatUnifiedBatchLabel(batch)], ['Product', batch.productName ?? ''],
    ['SKU', batch.sku ?? ''], ['Sale Order', batch.soNo], ['Order Qty', batch.orderQty != null ? `${fmt(batch.orderQty)} units` : '-'],
    ['Batch No', `B-${String(batch.batchIndex).padStart(2, '0')} of ${batch.totalBatches}`], ['Batch Size', `${batch.batchSize} KG`],
    ['Process', (batch.processType ?? 'hot').toUpperCase()], ['Homogenizer', batch.homogenizer ? 'Yes' : 'No'],
    ['Main Vessel', batch.mainVessel || '-'], ['Support Tanks', (batch.supportingTanks ?? []).length ? (batch.supportingTanks ?? []).join(', ') : 'None'],
    ['Filling Line', batch.fillingLine || '-'], ['Filling Type', (batch.fillingType ?? 'bottle').toUpperCase()],
    ['Pack Line', batch.packagingLine || '-'], ['Monocarton', batch.monocarton ? 'Yes' : 'No'],
    ['Shrink', batch.shrink ? 'Yes' : 'No'], ['Due Date', batch.dueDate || '-'],
    ['MU bundle (latest)', batch.muDispensingBundleId || '-'],
    ['Shift Lead (Mfg)', team.find(t => t.id === batch.shiftLeadBMR)?.name || '-'],
    ['Team (Mfg)', (team.filter(t => (batch.teamBMR ?? []).includes(t.id)).map(t => t.name).join(', ')) || '-'],
    ['Filling Lead', team.find(t => t.id === batch.shiftLeadBPR)?.name || '-'],
    ['Team (Fill)', (team.filter(t => (batch.teamBPR ?? []).includes(t.id)).map(t => t.name).join(', ')) || '-'],
  ];

  return (
    <>
    <ModalOverlay onClose={onClose} z="z-50" align="start" scroll className="pt-10">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl my-4 border border-hairline flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"bdm-title"}>
        {/* modal-hdr */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-hairline shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink tracking-tight" id="bdm-title">{formatUnifiedBatchLabel(batch)}</div>
              <div className="text-[10.5px] text-ink-3 mt-0.5" id="bdm-sub">
                {batch.productName ?? '-'} · Batch {batch.batchIndex}/{batch.totalBatches} · {batch.batchSize} KG · SO: {batch.soNo}
              </div>
            </div>
            <div id="bdm-status-badges" className="flex gap-1.5 flex-wrap shrink-0 items-center">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-3 text-ink-2 border border-border">{lifecyclePhaseLabel}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-soft text-brand border border-brand-soft">{batchLifecycleLabel(lifecycleDisplayStage)}</span>
              {batch.bmrStatus === 'batch_confirmed' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-ok-soft text-ok border border-ok-soft">Confirmed</span>}
            </div>
          </div>
          <div className="flex gap-1.5 items-center shrink-0">
            <button type="button" onClick={() => { /* print */ }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 rounded-lg transition-colors">Print</button>
            <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-8 h-8 text-ink-3 hover:bg-surface-3 rounded-lg transition-colors" aria-label="Close">×</button>
          </div>
        </div>

        {/* modal-body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Pipeline strip */}
          <PipelineStripWithLabels pipeline={pipelineForStrip} currentStatus={curStatus} failed={batch.bmrStatus === 'qc_failed' || batch.bprStatus === 'qc_failed'} title={stripTitle} />

          {/* Navigation + Tabs */}
          <div className="text-[9px] font-bold text-ink-4 uppercase tracking-widest font-mono mb-1">Navigation</div>
          <div className="flex flex-wrap gap-1 mb-4">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'rmpm', label: 'RM & PM Availability' },
              { key: 'schedule', label: 'Schedule' },
              { key: 'dispensing', label: 'Dispensing' },
              { key: 'qc', label: 'QC' },
              { key: 'stepper', label: 'Stage Tracker' },
              { key: 'transfers', label: 'Transfers' },
            ].map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${tab === t.key ? 'bg-brand text-white border-brand-soft' : 'text-ink-2 border-border hover:bg-surface-2'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div id="bdm-content">
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {overviewCards.map(([k, v]) => (
                    <div key={k} className="bg-black/5 border border-border rounded-md px-3 py-2.5">
                      <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-wider mb-0.5">{k}</div>
                      <div className="text-xs font-semibold text-ink wrap-break-word">{v || '-'}</div>
                    </div>
                  ))}
                </div>
                {batch.remarks && (
                  <div className="mt-2.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-warn-soft border border-warn-soft text-warn text-xs"><div>{batch.remarks}</div></div>
                )}
              </>
            )}

            {tab === 'rmpm' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SectionLabel icon={<FlaskConical size={12} />} color="text-brand">Raw Materials (PR BOM)</SectionLabel>
                    {batch.rmReserved && <Badge className="bg-ok-soft text-ok"><Check size={10} /> Reserved</Badge>}
                    {canUnreserveRmForBatch(batch, outboundMrns, reservedItems) && (
                      <Btn color="gray" icon={<X size={12} />} onClick={() => { onClose(); onAction('unreserveRM', batch); }}>Remove RM reserve</Btn>
                    )}
                    {(batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !batch.rmReserved && (
                      <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reserveRM', batch); }}>Reserve RM</Btn>
                    )}
                  </div>
                  {bomLoading ? (
                    <div className="rounded-xl border border-hairline px-3 py-4 text-xs text-ink-3">Loading BOM…</div>
                  ) : (
                    <div className="rounded-xl border border-hairline text-xs overflow-hidden">
                      <table className="w-full">
                        <thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2"><th scope="col" className="px-2 py-1.5 text-left font-semibold text-ink-3">RM</th><th scope="col" className="px-2 py-1.5 text-center">Req</th><th scope="col" className="px-2 py-1.5 text-center">SIH</th><th scope="col" className="px-2 py-1.5 text-center">Reserved</th></tr></thead>
                        <tbody className="divide-y divide-hairline">
                          {(batch.dispensingRM.length > 0 ? batch.dispensingRM : bomRmItems).map((r, i) => {
                            const sih = stockRM[r.code] ?? 0; const res = reservedRM[r.code] ?? 0; const avail = qtyAvailable(sih, res); const ok = !isQtyShort(avail, r.required);
                            return <tr key={i}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 text-center font-mono">{formatQtyExact(r.required, 'kg')}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-ok' : 'text-err'}`}>{formatQtyExact(sih, 'kg')}</td><td className="px-2 py-1.5 text-center font-mono text-warn">{formatQtyExact(res, 'kg')}</td></tr>;
                          })}
                        </tbody>
                      </table>
                      {(batch.dispensingRM.length === 0 && bomRmItems.length === 0 && !bomLoading) && <div className="px-3 py-4 text-ink-3 text-center">No RM in BOM or product not found.</div>}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SectionLabel icon={<Package size={12} />} color="text-brand">Packaging Materials (PR BOM)</SectionLabel>
                    {batch.pmReserved && <Badge className="bg-ok-soft text-ok"><Check size={10} /> Reserved</Badge>}
                    {packagingUnlocked && canUnreservePmForBatch(batch, outboundMrns, reservedItems) && (
                      <Btn color="gray" icon={<X size={12} />} onClick={() => { onClose(); onAction('unreservePM', batch); }}>Remove PM reserve</Btn>
                    )}
                    {packagingUnlocked && canReservePmForBatch(batch) && (
                      <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reservePM', batch); }}>Reserve PM</Btn>
                    )}
                  </div>
                  {bomLoading ? (
                    <div className="rounded-xl border border-hairline px-3 py-4 text-xs text-ink-3">Loading BOM…</div>
                  ) : (
                    <div className="rounded-xl border border-hairline text-xs overflow-hidden">
                      <table className="w-full">
                        <thead className="sticky top-0 z-20"><tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2"><th scope="col" className="px-2 py-1.5 text-left font-semibold text-ink-3">PM</th><th scope="col" className="px-2 py-1.5 text-center">Req</th><th scope="col" className="px-2 py-1.5 text-center">SIH</th><th scope="col" className="px-2 py-1.5 text-center">Reserved</th></tr></thead>
                        <tbody className="divide-y divide-hairline">
                          {(batch.dispensingPM.length > 0 ? batch.dispensingPM : bomPmItems).map((p, i) => {
                            const sih = stockPM[p.code] ?? 0; const res = reservedPM[p.code] ?? 0; const avail = qtyAvailable(sih, res); const ok = !isQtyShort(avail, p.required);
                            return <tr key={i}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 text-center font-mono">{formatQtyExact(p.required, 'pcs')}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-ok' : 'text-err'}`}>{formatQtyExact(sih, 'pcs')}</td><td className="px-2 py-1.5 text-center font-mono text-warn">{formatQtyExact(res, 'pcs')}</td></tr>;
                          })}
                        </tbody>
                      </table>
                      {(batch.dispensingPM.length === 0 && bomPmItems.length === 0 && !bomLoading) && <div className="px-3 py-4 text-ink-3 text-center">No PM in BOM or product not found.</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'schedule' && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {([['Mfg Date', batch.mfgDate], ['Manufacturing site', batch.scheduledMuZone || ''],
                  ['Fill Date', batch.fillDate], ['Pack Date', batch.packDate],
                  ['FG Date', batch.fgDate], ['RM Connect', batch.rmConnectDate], ['PM Connect', batch.pmConnectDate],
                  ['Main Vessel', batch.mainVessel], ['Filling Line', batch.fillingLine], ['Packaging Line', batch.packagingLine],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k}><div className="text-[10px] text-ink-4 font-medium">{k}</div><div className="text-sm font-semibold text-ink">{v || '-'}</div></div>
                  ))}
                </div>
                {batch.scheduleRemarks && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs text-ink-2">
                    <span className="font-semibold text-ink-3">Schedule notes:</span> {batch.scheduleRemarks}
                  </div>
                )}
                {canRescheduleProductionDates(batch) && (
                  <button type="button" onClick={() => { onClose(); onAction('schedule', batch); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-brand bg-brand-soft border border-brand-soft rounded-lg hover:bg-brand-soft transition-colors">
                    <Calendar size={12} /> {batch.mfgDate || batch.fillDate || batch.packDate ? 'Reschedule dates' : 'Set / adjust schedule'}
                  </button>
                )}
              </div>
            )}

            {tab === 'dispensing' && (
              <div className="space-y-5">
                {(batch.muDispensingBundleId || (batch.muDispensingBundles && batch.muDispensingBundles.length > 0)) && (
                  <div className="rounded-xl border border-border bg-surface-2/60 p-3 text-xs">
                    <div className="font-bold text-ink-2 mb-1.5 flex items-center gap-2">
                      <Package size={14} className="text-ink-3" /> MU consumption bundles (RM + PM qty from ML1/ML2/WH)
                    </div>
                    {batch.muDispensingBundleId && (
                      <p className="text-ink-2 mb-2">
                        <span className="text-ink-3">Latest bundle:</span>{' '}
                        <span className="font-mono font-semibold text-brand">{batch.muDispensingBundleId}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-ink-3 mb-2">Each bundle groups all RM/PM lines consumed in one dispensing save. Procurement requests (PR) for the same planning extract are listed for traceability.</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {([...(batch.muDispensingBundles || [])]).reverse().map((b) => (
                        <div key={b.bundleId + b.at} className="rounded-lg border border-white/80 bg-surface/90 p-2.5">
                          <div className="font-mono text-[11px] font-bold text-brand">{b.bundleId}</div>
                          <div className="text-[10px] text-ink-3">{new Date(b.at).toLocaleString()}</div>
                          {b.procurementRequests?.length > 0 && (
                            <div className="mt-1.5 text-[10px]">
                              <span className="text-ink-3 font-semibold">PRs:</span>{' '}
                              {b.procurementRequests.map((pr) => (
                                <span key={pr.id} className="inline-block mr-2">#{pr.id}{pr.status ? ` (${pr.status})` : ''}</span>
                              ))}
                            </div>
                          )}
                          {b.rm?.length > 0 && (
                            <div className="mt-1 text-[10px] text-brand"><span className="font-semibold">RM:</span> {b.rm.map((l) => `${l.code} ${l.qty}`).join(' · ')}</div>
                          )}
                          {b.pm?.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-brand"><span className="font-semibold">PM:</span> {b.pm.map((l) => `${l.code} ${l.qty}`).join(' · ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <SectionLabel icon={<FlaskConical size={12} />} color="text-brand">RM Dispensing ({batch.dispensingRM.filter(r => r.done).length}/{batch.dispensingRM.length})</SectionLabel>
                  {batch.dispensingRM.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-1 ${r.done ? 'border-ok-soft bg-ok-soft/60' : 'border-hairline'}`}>
                      <div className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold ${r.done ? 'bg-ok-soft text-ok' : 'bg-surface-3 text-ink-4'}`}>{r.done ? <Check size={10} strokeWidth={3} /> : i + 1}</div>
                      <span className="text-xs font-semibold flex-1">{r.inci || r.code}</span>
                      <span className="text-xs font-mono text-ink-3">{r.required} KG</span>
                      {r.done && <span className="text-[10px] text-ok font-mono flex items-center gap-0.5"><ArrowRight size={10} /> {r.dispensed} KG</span>}
                    </div>
                  ))}
                </div>
                <div>
                  <SectionLabel icon={<Package size={12} />} color="text-brand">PM Dispensing ({batch.dispensingPM.filter(r => r.done).length}/{batch.dispensingPM.length})</SectionLabel>
                  {batch.dispensingPM.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-1 ${p.done ? 'border-ok-soft bg-ok-soft/60' : 'border-hairline'}`}>
                      <div className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold ${p.done ? 'bg-ok-soft text-ok' : 'bg-surface-3 text-ink-4'}`}>{p.done ? <Check size={10} strokeWidth={3} /> : i + 1}</div>
                      <span className="text-xs font-semibold flex-1">{p.name || p.code}</span>
                      <span className="text-xs font-mono text-ink-3">{formatQtyWithUnit(p.required, 'pcs')}</span>
                      {p.done && <span className="text-[10px] text-ok font-mono flex items-center gap-0.5"><ArrowRight size={10} /> {fmt(p.dispensed)} pcs</span>}
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
                      <div key={section.label} className="rounded-xl border border-hairline overflow-hidden">
                        <div className="px-3 py-1.5 bg-surface-3/80 border-b border-hairline text-[10px] font-bold text-ink-2 uppercase tracking-wider">{section.label}</div>
                        <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-surface-2/80 border-b border-hairline text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                          <div>Parameter</div><div>Specification</div><div>Result</div><div>Pass/Fail</div>
                        </div>
                        {section.rows.map((s, i) => (
                          <div key={`${section.label}-${i}`} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 border-b border-hairline items-center text-xs">
                            <div className="font-semibold">{s.param}</div>
                            <div className="text-ink-3 font-mono">{s.spec}</div>
                            <div className="font-mono">{s.result || '-'}</div>
                            <div>{s.passed === true ? <Badge className="bg-ok-soft text-ok">Pass</Badge> : s.passed === false ? <Badge className="bg-err-soft text-err">Fail</Badge> : <span className="text-ink-4">-</span>}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-ink-4 text-sm">No QC results yet. Submit batch for QC review.</div>
                )}
                {batch.bulkYield != null && (
                  <div className="mt-3 text-xs">
                    <span className="text-ink-3">Bulk Yield:</span>{' '}
                    <b>{formatYieldKg(Number(batch.bulkYield))} KG</b>{' '}
                    {batch.bulkBatchAccepted ? <Badge className="bg-ok-soft text-ok">Accepted</Badge> : ''}
                  </div>
                )}
                {batch.fillYield != null && (
                  <div className="mt-1 text-xs">
                    <span className="text-ink-3">Fill Yield:</span>{' '}
                    <b>{formatYieldUnits(Number(batch.fillYield))} units</b>
                  </div>
                )}
                {batch.fgYield != null && (
                  <div className="mt-1 text-xs">
                    <span className="text-ink-3">FG Yield:</span>{' '}
                    <b>{formatYieldUnits(Number(batch.fgYield))} units</b>
                  </div>
                )}
              </div>
            )}

            {tab === 'stepper' && (
              <div className="space-y-0.5">
                {pipeline.map((p, i) => {
                  const state = i < pIdx ? 'done' : i === pIdx ? 'active' : 'pending';
                  return (
                    <div key={p.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 ${state === 'done' ? 'bg-ok-soft border-ok-soft text-ok' :
                          state === 'active' ? 'bg-brand-soft border-brand-soft text-brand ring-2 ring-brand' :
                            'bg-surface-2 border-border text-ink-4'
                          }`}>{state === 'done' ? <Check size={12} strokeWidth={3} /> : p.icon}</div>
                        {i < pipeline.length - 1 && <div className={`w-0.5 h-6 ${i < pIdx ? 'bg-ok' : 'bg-surface-3'}`} />}
                      </div>
                      <div className="pb-4">
                        <div className={`text-xs font-bold ${state === 'done' ? 'text-ok' : state === 'active' ? 'text-brand' : 'text-ink-4'}`}>{p.label}</div>
                        <div className="text-[10px] text-ink-4">
                          {state === 'pending' ? 'Awaiting previous step' : state === 'active' ? 'Currently at this stage' : 'Completed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'transfers' && (() => {
              const batchMrns = outboundMrns.filter(
                (m) => m.bmrNo === batch.bmrNo && m.source === 'MTR' && !m.isInboundFromMu,
              );
              if (batchMrns.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-ink-4">
                    No transfer requests (MTRs) raised for this batch yet. Use <b>Send MTR</b> to request material transfer to the production facility.
                  </div>
                );
              }
              const statusStyle = (s: string): string => {
                const u = String(s).toUpperCase();
                if (u.includes('COMPLETED') || u.includes('GRN')) return 'bg-ok-soft text-ok';
                if (u.includes('DELIVERED')) return 'bg-brand-soft text-brand';
                if (u.includes('SHIPPED')) return 'bg-brand-soft text-brand';
                if (u.includes('PROCESS') || u.includes('PICK')) return 'bg-warn-soft text-warn';
                return 'bg-surface-3 text-ink-2';
              };
              return (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-ink-4 border-b border-border [&_th]:bg-surface-2">
                        <th scope="col" className="py-2 pr-3">MRN #</th>
                        <th scope="col" className="py-2 pr-3">Item</th>
                        <th scope="col" className="py-2 pr-3 text-right">Required Qty</th>
                        <th scope="col" className="py-2 pr-3">Source</th>
                        <th scope="col" className="py-2 pr-3">Destination</th>
                        <th scope="col" className="py-2 pr-3">Need-by</th>
                        <th scope="col" className="py-2 pr-3">MRN Status</th>
                        <th scope="col" className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchMrns.flatMap((m) =>
                        (m.lineItems || []).map((li) => (
                          <tr key={`${m.id}-${li.id}`} className="border-b border-hairline align-top">
                            <td className="py-2 pr-3 font-medium text-warn whitespace-nowrap">{m.mrnNo}</td>
                            <td className="py-2 pr-3 text-ink">
                              {li.name} <span className="text-ink-4 font-mono">{li.itemCode}</span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{li.quantity} {li.unit}</td>
                            <td className="py-2 pr-3 text-ink-2 whitespace-nowrap">{m.whDispatchZone || 'MW'}</td>
                            <td className="py-2 pr-3 text-ink-2 whitespace-nowrap">{m.muReceiveZone || m.locationPrefix || 'ML1'}</td>
                            <td className="py-2 pr-3 text-ink-2 whitespace-nowrap">{mrnDisplayExpectedDate(m)}</td>
                            <td className="py-2 pr-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle(m.status)}`}>
                                {m.status || '—'}
                              </span>
                            </td>
                            <td className="py-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setMrnDetailTarget(m)}
                                className="px-2 py-1 rounded-md bg-brand hover:bg-brand text-white text-[10px] font-semibold whitespace-nowrap"
                              >
                                ▶ Receive / Manage
                              </button>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

          </div>
        </div>

        {/* modal-foot */}
        <div id="bdm-actions" className="flex flex-wrap gap-2 items-center px-5 py-4 border-t border-hairline shrink-0 bg-surface-2/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Close</button>
          {batch.bmrStatus === 'draft' && (
            <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>
              {hasProductionBatchSchedule(batch) ? 'Edit Schedule' : 'Schedule Batch'}
            </Btn>
          )}
          {batch.bmrStatus === 'draft' && hasProductionBatchSchedule(batch) && !canConfirmProductionBatch(batch) && (
            <span className="inline-flex items-center px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg">
              Confirm available on {batch.mfgDate}
            </span>
          )}
          {batch.bmrStatus === 'draft' && canConfirmProductionBatch(batch) && (
            <Btn color="orange" icon={<Zap size={12} />} onClick={() => { onClose(); onAction('confirm', batch); }}>Confirm Batch</Btn>
          )}
          {canUnreserveRmForBatch(batch, outboundMrns, reservedItems) && (
            <Btn color="gray" icon={<X size={12} />} onClick={() => { onClose(); onAction('unreserveRM', batch); }}>Remove RM reserve</Btn>
          )}
          {(batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && !batch.rmReserved && <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reserveRM', batch); }}>Reserve RM</Btn>}
          {packagingUnlocked && canUnreservePmForBatch(batch, outboundMrns, reservedItems) && (
            <Btn color="gray" icon={<X size={12} />} onClick={() => { onClose(); onAction('unreservePM', batch); }}>Remove PM reserve</Btn>
          )}
          {packagingUnlocked && canReservePmForBatch(batch) && <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reservePM', batch); }}>Reserve PM</Btn>}
          <Btn color="orange" icon={<Settings size={12} />} onClick={() => { onClose(); onAction('editBatch', batch); }}>Edit Batch</Btn>
          {batch.rmReserved && (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'scheduled') && (
            <Btn color="emerald" icon={<CheckCircle2 size={12} />} onClick={() => { onClose(); onAction('confirmSchedule', batch); }}>Confirm &amp; Generate BMR/BPR</Btn>
          )}
          {hasProductionBatchSchedule(batch) && !(batch.bmrQaStatus === 'approved' && batch.bprQaStatus === 'approved') && (
            <Btn color="blue" icon={<ClipboardList size={12} />} onClick={() => { onClose(); onAction('reviewBmrBpr', batch); }}>Review BMR &amp; BPR</Btn>
          )}
          {(batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') && !hasProductionBatchSchedule(batch) && (
            <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>Set Schedule</Btn>
          )}
          {canShowRescheduleFooterButton(batch) && (
            <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>Reschedule dates</Btn>
          )}
          {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && batch.rmReserved && !effectiveRmConnectedUi && !anyRmMtrForBatch && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrRM', batch, batch.dispensingRM.length > 0 ? undefined : { mtrRmItems: bomRmItems }); }}>RM Transfer</Btn>}
          {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled' || batch.bmrStatus === 'batch_confirmed') && !batch.rmReserved && !anyRmMtrForBatch && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg">
              <Info size={14} className="shrink-0" /> Reserve all RM lines before RM Transfer
            </span>
          )}
          {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && !effectiveRmConnectedUi && openRmMtrForBatch && (
            <span className="inline-flex flex-col gap-1 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg max-w-xl" title={outboundMtrStageHint(openRmMtrForBatch)}>
              <span className="inline-flex items-center gap-1.5">
                <Info size={14} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openRmMtrForBatch)}</span>
              </span>
              {openRmMtrWarehouseMeta && (
                <span className="text-[10px] font-semibold text-warn/90 leading-snug pl-5 border-l-2 border-warn-soft/60 ml-1">
                  {openRmMtrWarehouseMeta}
                </span>
              )}
              {openRmMtrForBatch.lineTransferStatus && openRmMtrForBatch.lineItems && (
                <span className="text-[10px] font-normal text-warn/90 leading-snug">
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
            !(batch.bmrQaStatus === 'approved' && batch.bprQaStatus === 'approved')
              ? <Btn color="gray" icon={<ClipboardList size={12} />} onClick={() => { onClose(); onAction('reviewBmrBpr', batch); }}>Initiate Dispensing (QA pending)</Btn>
              : batch.bmrStatus !== 'dispensing'
                ? <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('initiateDispensing', batch); }}>Initiate Dispensing</Btn>
                : <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispenseRM', batch); }}>Start RM Dispensing</Btn>
          )}
          {effectiveRmConnectedUi && (batch.bmrStatus === 'rm_connected' || batch.bmrStatus === 'dispensing' || batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && openRmMtrForBatch && !mtrAllRmLinesReceivedAtMu(openRmMtrForBatch) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg" title="Verify every RM line at MU in Transfer orders before dispensing.">
              <Info size={14} /> Receive all RM lines at MU first
            </span>
          )}
          {/* {canOfferRmDispensingUi(batch) && <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispenseRM', batch); }}>Start RM Dispensing</Btn>} */}
          {batch.bmrStatus === 'dispensing' && batch.dispensingRM.length > 0 && batch.dispensingRM.every((l) => l.done) && (
            <Btn color="emerald" icon={<Factory size={12} />} onClick={() => { onClose(); onAction('initiateProduction', batch); }}>🏭 Initiate Production</Btn>
          )}
          {(batch.bmrStatus === 'in_production' || batch.bmrStatus === 'qc_failed') && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcBMR', batch); }}>Submit to Bulk QC</Btn>}
          {packagingUnlocked && batch.bprStatus === 'pm_reserved' && batch.pmReserved && !effectivePmConnectedUi && !anyPmMtrForBatch && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrPM', batch, batch.dispensingPM.length > 0 ? undefined : { mtrPmItems: bomPmItems }); }}>PM Transfer</Btn>}
          {packagingUnlocked && batch.bprStatus === 'pm_reserved' && !batch.pmReserved && !anyPmMtrForBatch && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg">
              <Info size={14} className="shrink-0" /> Reserve all PM lines before PM Transfer
            </span>
          )}
          {packagingUnlocked && batch.bprStatus === 'pm_reserved' && !effectivePmConnectedUi && openPmMtrForBatch && (
            <span className="inline-flex flex-col gap-1 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg max-w-xl" title={outboundMtrStageHint(openPmMtrForBatch)}>
              <span className="inline-flex items-center gap-1.5">
                <Info size={14} className="shrink-0" /> <span className="leading-tight">{outboundMtrStageTitle(openPmMtrForBatch)}</span>
              </span>
              {openPmMtrWarehouseMeta && (
                <span className="text-[10px] font-semibold text-warn/90 leading-snug pl-5 border-l-2 border-warn-soft/60 ml-1">
                  {openPmMtrWarehouseMeta}
                </span>
              )}
              {openPmMtrForBatch.lineTransferStatus && openPmMtrForBatch.lineItems && (
                <span className="text-[10px] font-normal text-warn/90 leading-snug">
                  {openPmMtrForBatch.lineItems.filter(mtrLineItemIsPm).map((li) => (
                    <span key={li.id} className="mr-2 inline-block">
                      <span className="font-mono">{li.itemCode}</span>: {formatMtrLinePhaseShort(mtrLinePhaseRaw(openPmMtrForBatch, li.id))}
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
          {packagingUnlocked && effectivePmConnectedUi && (batch.bprStatus === 'pm_connected' || batch.bprStatus === 'pm_reserved' || batch.bprStatus === 'pm_dispensing') && (!openPmMtrForBatch || mtrAllPmLinesReceivedAtMu(openPmMtrForBatch)) && (
            <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispensePM', batch); }}>PM Dispensing</Btn>
          )}
          {packagingUnlocked && effectivePmConnectedUi && (batch.bprStatus === 'pm_connected' || batch.bprStatus === 'pm_reserved' || batch.bprStatus === 'pm_dispensing') && openPmMtrForBatch && !mtrAllPmLinesReceivedAtMu(openPmMtrForBatch) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg" title="Verify every PM line at MU in Transfer orders before PM dispensing.">
              <Info size={14} /> Receive all PM lines at MU first
            </span>
          )}
          {packagingUnlocked && batch.bprStatus === 'filling' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcFill', batch); }}>Fill QC</Btn>}
          {packagingUnlocked && batch.bprStatus === 'packaging' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcPack', batch); }}>Pack QC</Btn>}
          {packagingUnlocked && batch.bprStatus === 'qc_failed' && batch.fillBatchAccepted === false && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcFill', batch); }}>Retry Fill QC</Btn>}
          {packagingUnlocked && batch.bprStatus === 'qc_failed' && batch.fgBatchAccepted === false && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcPack', batch); }}>Retry Pack QC</Btn>}
          <button type="button" onClick={() => { /* print */ }} className="inline-flex items-center gap-1 px-3 py-2 text-xs text-ink-3 border border-border rounded-lg hover:bg-surface-2 ml-auto transition-colors"><Printer size={12} /> Print BMR/BPR</button>
        </div>
      </div>
    </ModalOverlay>
    {mrnDetailTarget && (
      <MRNDetailModal
        mrn={mrnDetailTarget}
        assignablePickers={batchMrnPickers}
        onClose={() => setMrnDetailTarget(null)}
        onSave={(updated) => { onMrnUpdated?.(); setMrnDetailTarget(updated); }}
      />
    )}
    </>
  );
}

/* ─── Action Button helper ──────────────────────────────────── */

function Btn({ color, icon, onClick, children }: { color: string; icon?: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  const cm: Record<string, string> = {
    orange: 'bg-brand hover:bg-brand',
    amber: 'bg-warn hover:bg-warn',
    teal: 'bg-brand hover:bg-brand',
    purple: 'bg-brand hover:bg-brand',
    blue: 'bg-brand hover:bg-brand',
    red: 'bg-err hover:bg-err',
    emerald: 'bg-ok hover:bg-ok',
    gray: 'bg-surface-3 hover:bg-surface-3 text-ink border border-border',
  };
  const textClass = color === 'gray' ? '' : 'text-white';
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${textClass} ${cm[color] || cm.orange}`}>
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
      addToast('success', `Rework batch created (e.g. ${formatUnifiedBatchLabelShort(selected)}-rw-01). Refreshing list.`);
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
    <ModalOverlay onClose={onClose} z="z-50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-hairline" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={"rework-batch-modal-title"}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <h2 className="text-base font-bold text-ink" id="rework-batch-modal-title">Create New Batch (Rework)</h2>
            {presetLocked && (
              <p className="text-[11px] font-medium text-ok mt-0.5">Pre-filled from Yield Report — confirm reason and quantities below.</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-3" aria-label="Close">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-ink-2">
            When a batch fails, create a new batch for the same SO to continue production. The new batch will be in the planning table and named with suffix <strong>rw-01</strong>, <strong>rw-02</strong>, etc.
          </p>
          {presetLocked ? (
            <div className="rounded-lg border border-ok-soft bg-ok-soft/80 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-ok uppercase tracking-wide">Base batch (from yield)</p>
              <div className="text-sm text-ink"><span className="text-ink-3 text-xs mr-1">SO</span><strong>{preset!.soNo}</strong></div>
              <div className="text-sm text-ink"><span className="text-ink-3 text-xs mr-1">Batch</span><strong>{formatUnifiedBatchLabel(preset!)}</strong></div>
              <p className="text-[10px] text-ink-2">To pick a different SO or batch, close this dialog and use <strong>Create New Batch</strong> from the Batches tab.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">Sales order</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                  value={selectedSoNo}
                  onChange={e => onSoChange(e.target.value)}
                >
                  <option value="">— Select SO —</option>
                  {soList.map(so => (
                    <option key={so} value={so}>{so}</option>
                  ))}
                </select>
                {soList.length === 0 && (
                  <p className="text-xs text-warn mt-1">No batches in production. Sync or send batches from Planning first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">Rework from batch</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                  value={selectedBmrNo}
                  onChange={e => setSelectedBmrNo(e.target.value)}
                  disabled={!selectedSoNo}
                >
                  <option value="">— Select batch —</option>
                  {batchesForSo.map(b => (
                    <option key={b.bmrNo} value={b.bmrNo}>
                      {formatUnifiedBatchLabel(b)} — {b.productName ?? b.sku}
                      {b.planningBatchId ? '' : ' (not linked to planning)'}
                    </option>
                  ))}
                </select>
                {selectedSoNo && batchesForSo.length === 0 && (
                  <p className="text-xs text-warn mt-1">No batches for this SO.</p>
                )}
                {selected && selected._pk != null && selected.planningBatchId != null && !reason.trim() && (
                  <p className="text-xs text-warn mt-1">Enter a reason for the rework.</p>
                )}
                {selected && !selected.planningBatchId && (
                  <p className="text-xs text-warn mt-1">This batch is not linked to planning. Send it from Planning first, or choose another batch.</p>
                )}
              </div>
            </>
          )}
          {presetLocked && selected && selected._pk != null && selected.planningBatchId != null && !reason.trim() && (
            <p className="text-xs text-warn -mt-2">Enter a reason for the rework.</p>
          )}
          {presetLocked && selected && !selected.planningBatchId && (
            <p className="text-xs text-warn -mt-2">This batch is not linked to planning. Send it from Planning first, or use BMR Create New Batch to choose another batch.</p>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Reason for rework <span className="text-err">*</span></label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm min-h-[80px]"
              placeholder="e.g. QC failure – pH out of spec; bulk rework required"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
            />
          </div>
          {selected && selected._pk != null && selected.planningBatchId != null && (
            <div className="rounded-lg border border-brand-soft bg-brand-soft/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-brand">Rework Preview (BMR)</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border border-brand-soft bg-surface px-2 py-1.5">
                  <p className="text-ink-3 uppercase">Planned</p>
                  <p className="font-semibold text-ink">{plannedUnits.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded border border-brand-soft bg-surface px-2 py-1.5">
                  <p className="text-ink-3 uppercase">Actual</p>
                  <p className="font-semibold text-ink">{Math.round(actualUnits).toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded border border-brand-soft bg-surface px-2 py-1.5">
                  <p className="text-ink-3 uppercase">Shortfall</p>
                  <p className="font-semibold text-brand">{shortfallUnits.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-ink-2 mb-1">Rework Qty (units)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={reworkQty}
                    onChange={e => setReworkQty(e.target.value)}
                    className="w-full border border-brand-soft rounded-lg px-2.5 py-2 text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-2 mb-1">Batch Size (KG, optional)</label>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={reworkBatchSizeKg}
                    onChange={e => setReworkBatchSizeKg(e.target.value)}
                    placeholder="Auto-scaled"
                    className="w-full border border-brand-soft rounded-lg px-2.5 py-2 text-sm bg-surface"
                  />
                </div>
              </div>
              <div className="rounded border border-brand-soft bg-surface p-2.5">
                <p className="text-[11px] font-semibold text-ink mb-1.5">RM/PM shortfall preview (Planning Items Involved)</p>
                {reworkItemsLoading ? (
                  <p className="text-[11px] text-ink-3">Loading item-level shortfall…</p>
                ) : reworkItemsError ? (
                  <p className="text-[11px] text-warn">{reworkItemsError}</p>
                ) : previewShortageRows.length === 0 ? (
                  <p className="text-[11px] text-ok">No immediate RM/PM shortage detected for this planning line.</p>
                ) : (
                  <div className="space-y-1">
                    {previewShortageRows.map((row) => (
                      <div key={`${row.type}-${row.code}`} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 text-[11px] border-b border-hairline pb-1">
                        <span className={`font-semibold ${row.type === 'RM' ? 'text-brand' : 'text-brand'}`}>{row.type}</span>
                        <span className="truncate text-ink-2" title={`${row.code} ${row.name}`}>{row.code} - {row.name}</span>
                        <span className="text-ink-3">need {row.req.toLocaleString('en-IN')} {row.unit}</span>
                        <span className="font-semibold text-err">short {row.shortage.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-ink-3 pt-1">
                      Rework request creates a new Planning batch entry; use Planning (PIs Extracted / Items Involved) to handle procurement in the normal flow.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-hairline">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink-2 rounded-lg hover:bg-surface-3">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={!canReworkSelected || submitting} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create rework batch'}
          </button>
        </div>
      </div>
    </ModalOverlay>
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
      subtitle={`${formatUnifiedBatchLabel(batch)} · ${batch.productName ?? batch.sku}`}
      size="lg"
    >
      <p className="text-xs text-ink-2 mb-4">
        Review quantities and shortfall. The next step opens the rework form with <strong>SO</strong> and <strong>base BMR</strong> filled in automatically.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
        <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">Batch</p><p className="font-semibold text-ink">{formatUnifiedBatchLabel(batch)}</p></div>
        <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">SO</p><p className="font-semibold text-ink">{batch.soNo || '—'}</p></div>
        <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">Seq</p><p className="font-semibold text-ink">{batch.batchIndex}/{batch.totalBatches}</p></div>
        <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">Size</p><p className="font-semibold text-ink">{batch.batchSize} KG</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-brand-soft bg-brand-soft/50 p-3">
          <h4 className="text-xs font-bold text-brand mb-2">BMR (KG)</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-ink-2">Planned</span><b>{formatYieldKg(plannedKg)}</b></div>
            <div className="flex justify-between"><span className="text-ink-2">Yield</span><b>{formatYieldKg(bmrYieldKg)}</b></div>
            <div className="flex justify-between"><span className="text-ink-2">Wastage</span><b className="text-warn">{formatYieldKg(bmrWastageKg)}</b></div>
          </div>
        </div>
        <div className="rounded-xl border border-brand-soft bg-brand-soft/50 p-3">
          <h4 className="text-xs font-bold text-brand mb-2">BPR (units)</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-ink-2">Bulk to fill</span><b>{formatYieldUnits(bprBulkUnits)}</b></div>
            <div className="flex justify-between"><span className="text-ink-2">FG / output</span><b>{formatYieldUnits(builtUnits)}</b></div>
            <div className="flex justify-between"><span className="text-ink-2">BPR wastage</span><b className="text-err">{formatYieldUnits(bprWastageUnits)}</b></div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-brand-soft bg-brand-soft/70 p-3 mb-4">
        <h4 className="text-xs font-bold text-brand mb-2">Rework basis (units)</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-ink-3">Planned</p><p className="font-semibold">{fmt(Math.round(plannedUnits))}</p></div>
          <div><p className="text-ink-3">Actual</p><p className="font-semibold">{fmt(Math.round(builtUnits))}</p></div>
          <div><p className="text-ink-3">Shortfall</p><p className="font-semibold text-brand">{fmt(shortfallUnits)}</p></div>
        </div>
        {!linkageOk && (
          <p className="text-[11px] text-warn mt-2">This batch is missing production id or planning link — rework cannot be created from here. Use Planning / BMR flows to fix linkage.</p>
        )}
        {linkageOk && shortfallUnits <= 0 && (
          <p className="text-[11px] text-ink-2 mt-2">No unit shortfall vs plan; rework from yield is not needed for this batch.</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink-2 rounded-lg hover:bg-surface-3">Cancel</button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand disabled:opacity-50"
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
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-hairline bg-surface shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-ink tracking-tight">Yield Report</div>
          <div className="sec-sub text-[11px] text-ink-4 mt-0.5">FG-ready batch-wise output report from QC-yield inputs.</div>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BMR/BPR, batch, SO, product…"
          className="w-full sm:w-72 text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink placeholder-gray-400 outline-none focus:ring-1 focus:ring-ok"
        />
      </div>
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-6 py-3.5 bg-surface-2/50 border-b border-hairline shrink-0">
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold">FG Ready Batches</div><div className="kpi-val text-lg font-extrabold text-ok">{rows.length}</div></div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold">BMR Yield (KG)</div><div className="kpi-val text-lg font-extrabold text-brand">{formatYieldKg(totalYieldKg)}</div></div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold">Actual Output (Units)</div><div className="kpi-val text-lg font-extrabold text-brand">{formatYieldUnits(totalActualOutputUnits)}</div></div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold">BMR Wastage (KG)</div><div className="kpi-val text-lg font-extrabold text-warn">{formatYieldKg(totalBmrWastageKg)}</div></div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2 shadow-xs"><div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold">BPR Wastage (Units)</div><div className="kpi-val text-lg font-extrabold text-err">{formatYieldUnits(totalBprWastageUnits)}</div></div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-ink-4"><Activity size={30} className="mb-2 opacity-20" /><p className="text-sm">No FG-ready batches found for yield reporting.</p></div>
        ) : (
          <div className="overflow-auto max-h-[70vh] rounded-xl border border-hairline">
            <table className="w-full text-xs bg-surface">
              <thead className="sticky top-0 z-20 bg-surface-2 border-b border-hairline [&_th]:bg-surface-2">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Batch</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Product / SO</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BMR Plan (KG)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BMR Yield (KG)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BMR Waste (KG)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BMR Yield %</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BPR Bulk (Units)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Actual Output (Units)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">BPR Waste (Units)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Overall Waste (Units)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Output vs Plan %</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Rework</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.b.bmrNo} className="border-b border-hairline hover:bg-surface-2/50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink">{formatUnifiedBatchLabel(r.b)}</div>
                      <div className="text-[10px] text-ink-3">{r.b.soNo || '—'} · Seq {r.b.batchIndex}/{r.b.totalBatches}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-ink">{r.b.productName}</div>
                      <div className="text-[10px] text-ink-3">{r.b.soNo || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatYieldKg(r.plannedKg)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-brand">{formatYieldKg(r.bmrYieldKg)}</td>
                    <td className="px-3 py-2 text-right font-mono text-warn">{formatYieldKg(r.bmrWastageKg)}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.bmrYieldPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{formatYieldUnits(r.bprBulkUnits)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-brand">{formatYieldUnits(r.builtUnits)}</td>
                    <td className="px-3 py-2 text-right font-mono text-err">{formatYieldUnits(r.bprWastageUnits)}</td>
                    <td className="px-3 py-2 text-right font-mono text-warn">{formatYieldUnits(r.overallWastageUnits)}</td>
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
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-brand border border-brand-soft rounded-lg hover:bg-brand-soft disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Layers size={10} /> Rework
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedBmrNo(r.b.bmrNo)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-ink-2 border border-border rounded-lg hover:bg-surface-2"
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
          title={`Yield Detail — ${formatUnifiedBatchLabel(selectedRow.b)}`}
          subtitle={`${selectedRow.b.productName} · SO ${selectedRow.b.soNo || '—'} · Seq ${selectedRow.b.batchIndex}/${selectedRow.b.totalBatches}`}
          size="xl"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">SO</p><p className="text-xs font-semibold text-ink">{selectedRow.b.soNo || '—'}</p></div>
            <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">FG Date</p><p className="text-xs font-semibold text-ink">{selectedRow.b.fgDate || '—'}</p></div>
            <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">BMR Status</p><p className="text-xs font-semibold text-ink">{bmrStatusLabel[selectedRow.b.bmrStatus]}</p></div>
            <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"><p className="text-[10px] text-ink-3 uppercase">BPR Status</p><p className="text-xs font-semibold text-ink">{bprStatusLabel[selectedRow.b.bprStatus]}</p></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-brand-soft bg-brand-soft/50 p-4">
              <h4 className="text-sm font-bold text-brand mb-3">BMR (Manufacturing) Detail</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-ink-2">Planned batch weight</span><b>{formatYieldKg(selectedRow.plannedKg)} KG</b></div>
                <div className="flex justify-between"><span className="text-ink-2">Actual yield weight</span><b>{formatYieldKg(selectedRow.bmrYieldKg)} KG</b></div>
                <div className="flex justify-between"><span className="text-ink-2">BMR wastage</span><b className="text-warn">{formatYieldKg(selectedRow.bmrWastageKg)} KG</b></div>
                <div className="flex justify-between"><span className="text-ink-2">Yield efficiency</span><b>{selectedRow.bmrYieldPct.toFixed(1)}%</b></div>
              </div>
            </div>
            <div className="rounded-xl border border-brand-soft bg-brand-soft/50 p-4">
              <h4 className="text-sm font-bold text-brand mb-3">BPR (Filling & Packing) Detail</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-ink-2">Bulk available to fill</span><b>{formatYieldUnits(selectedRow.bprBulkUnits)} units</b></div>
                <div className="flex justify-between"><span className="text-ink-2">Actual output produced</span><b>{formatYieldUnits(selectedRow.builtUnits)} units</b></div>
                <div className="flex justify-between"><span className="text-ink-2">BPR wastage</span><b className="text-err">{formatYieldUnits(selectedRow.bprWastageUnits)} units</b></div>
                <div className="flex justify-between"><span className="text-ink-2">Output vs planned units</span><b>{selectedRow.outputVsPlanPct.toFixed(1)}%</b></div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-ok-soft bg-ok-soft/60 p-4">
            <h4 className="text-sm font-bold text-ok mb-3">Combined Batch Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><p className="text-ink-3">Planned units</p><p className="font-semibold">{fmt(Math.round(selectedRow.plannedUnits))}</p></div>
              <div><p className="text-ink-3">Actual output units</p><p className="font-semibold">{formatYieldUnits(selectedRow.builtUnits)}</p></div>
              <div><p className="text-ink-3">Overall unit wastage</p><p className="font-semibold text-warn">{formatYieldUnits(selectedRow.overallWastageUnits)}</p></div>
              <div><p className="text-ink-3">Overall quality state</p><p className="font-semibold">{selectedRow.b.bprStatus === 'fg_ready' ? 'FG Ready' : 'In Progress'}</p></div>
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand disabled:opacity-40 disabled:pointer-events-none"
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
  /** Any batch with stage dates (from Planning sync or Schedule modal) appears on the calendar. */
  const calendarBatches = useMemo(() => batches.filter(b =>
    Boolean(b.mfgDate || b.fillDate || b.packDate)
    || ['scheduled', 'rm_connected', 'dispensing', 'in_production', 'bulk_qc', 'qc_failed', 'cleared'].includes(b.bmrStatus)
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

  const CAL_UNASSIGNED = '__unassigned__';

  function getBatches(equipId: string, dayIso: string, cat: string): Batch[] {
    if (equipId === CAL_UNASSIGNED) {
      if (cat === 'mfg') return calendarBatches.filter(b => b.mfgDate === dayIso && !String(b.mainVessel || '').trim());
      if (cat === 'fill') return calendarBatches.filter(b => b.fillDate === dayIso && !String(b.fillingLine || '').trim());
      if (cat === 'pack') return calendarBatches.filter(b => b.packDate === dayIso && !String(b.packagingLine || '').trim());
      return [];
    }
    if (cat === 'mfg') return calendarBatches.filter(b => b.mainVessel === equipId && b.mfgDate === dayIso);
    if (cat === 'fill') return calendarBatches.filter(b => b.fillingLine === equipId && b.fillDate === dayIso);
    if (cat === 'pack') return calendarBatches.filter(b => b.packagingLine === equipId && b.packDate === dayIso);
    return [];
  }

  const unassignedInWeek = useMemo(() => ({
    mfg: calendarBatches.some(b => b.mfgDate && weekIsos.has(b.mfgDate) && !String(b.mainVessel || '').trim()),
    fill: calendarBatches.some(b => b.fillDate && weekIsos.has(b.fillDate) && !String(b.fillingLine || '').trim()),
    pack: calendarBatches.some(b => b.packDate && weekIsos.has(b.packDate) && !String(b.packagingLine || '').trim()),
  }), [calendarBatches, weekIsos]);

  const isEquipBusy = (equipId: string, cat: string) => {
    if (cat === 'mfg') return calendarBatches.some(b => b.mainVessel === equipId);
    if (cat === 'fill') return calendarBatches.some(b => b.fillingLine === equipId);
    if (cat === 'pack') return calendarBatches.some(b => b.packagingLine === equipId);
    return false;
  };

  const batchProductShort = (b: Batch) => `${b.batchSize}KG`;

  const catColors = { mfg: 'bg-brand', fill: 'bg-brand', pack: 'bg-ok' };
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
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 bg-surface border-b border-hairline shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-ink tracking-tight">Production Calendar</div>
          <div className="sec-sub text-[11px] text-ink-4 mt-0.5">Vessel & Line wise scheduling — Manufacturing · Filling · Packaging</div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => onWeekOffsetChange(weekOffset - 1)} className="btn btn-sm btn-ghost px-2 py-1 rounded-lg border border-border hover:bg-surface-2 text-ink-3 text-xs font-medium">Prev</button>
          <span className="font-mono text-[11.5px] text-ink-3">{weekLabel}</span>
          <button type="button" onClick={() => onWeekOffsetChange(weekOffset + 1)} className="btn btn-sm btn-ghost px-2 py-1 rounded-lg border border-border hover:bg-surface-2 text-ink-3 text-xs font-medium">Next</button>
          <div className="w-px h-[18px] bg-surface-3" />
          <button type="button" onClick={() => setCalView('week')} className={`btn btn-sm px-2 py-1 rounded-lg text-xs font-medium ${calView === 'week' ? 'border border-brand-soft text-brand bg-brand-soft' : 'border border-border hover:bg-surface-2 text-ink-2'}`}>Week</button>
          <button type="button" onClick={() => setCalView('day')} className={`btn btn-sm btn-ghost px-2 py-1 rounded-lg text-xs font-medium border border-transparent ${calView === 'day' ? 'text-brand' : 'text-ink-3 hover:bg-surface-2'}`}>Day</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 px-6 py-3.5 bg-surface-2/50 border-b border-hairline shrink-0" id="cal-kpis">
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold tracking-wider">Active Batches</div>
          <div className="kpi-val text-lg font-extrabold text-brand">{active}</div>
          <div className="kpi-sub text-[10px] text-ink-4">In production flow</div>
        </div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold tracking-wider">Vessels Idle</div>
          <div className="kpi-val text-lg font-extrabold text-brand">{vesselsIdle}</div>
          <div className="kpi-sub text-[10px] text-ink-4">of {mfgTotal} manufacturing</div>
        </div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold tracking-wider">Filling Lines Idle</div>
          <div className="kpi-val text-lg font-extrabold text-brand">{fillingLinesIdle}</div>
          <div className="kpi-sub text-[10px] text-ink-4">of {fillTotal} lines</div>
        </div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold tracking-wider">Scheduled Batches</div>
          <div className="kpi-val text-lg font-extrabold text-brand">{scheduledWithDates}</div>
          <div className="kpi-sub text-[10px] text-ink-4">with dates assigned</div>
        </div>
        <div className="kpi-card bg-surface rounded-xl border border-hairline px-3 py-2.5 shadow-xs">
          <div className="kpi-label text-[10px] text-ink-3 uppercase font-semibold tracking-wider">FG Ready</div>
          <div className="kpi-val text-lg font-extrabold text-ok">{fgReady}</div>
          <div className="kpi-sub text-[10px] text-ink-4">Batches completed</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2.5 mb-2.5 px-6 flex-wrap items-center shrink-0 pt-2">
        <span className="text-[10px] text-ink-3">Legend:</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-brand/80 inline-block" />Manufacturing</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-brand/80 inline-block" />Filling</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-ok/80 inline-block" />Packaging</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-warn/80 inline-block" />QC Hold</span>
        <span className="w-px h-3.5 bg-surface-3 inline-block" />
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-brand/80 inline-block" /><span className="border-l-2 border-brand-soft pl-1">Hot Process</span></span>
        <span className="flex items-center gap-1 text-[10px] text-ink-2"><span className="w-3 h-3 rounded-sm bg-brand/80 inline-block" /><span className="border-l-2 border-brand-soft pl-1">Cold Process</span></span>
      </div>

      {/* Calendar grid */}
      <div className="cal-wrap flex-1 overflow-auto px-6 pb-4" id="cal-wrap">
        <div className="cal-grid min-w-[900px]">
          <div className="cal-header grid border-b border-hairline bg-surface sticky top-0 z-10 shadow-xs" style={{ gridTemplateColumns: colGrid }}>
            <div className="cal-header-cell col-span-1 px-3 py-2.5 text-[10px] font-semibold text-ink-3 uppercase tracking-wider border-r border-hairline">Equipment</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`cal-header-cell text-center py-2.5 border-r border-hairline ${i === todayIndex ? 'today-col bg-brand-soft/60 text-brand' : 'text-ink-2'}`}>
                {d.label} {d.date}
                <div className="text-[8px] mt-0.5 text-ink-4">{d.month}</div>
              </div>
            ))}
          </div>

          {(['mfg', 'fill', 'pack'] as const).map(cat => (
            <React.Fragment key={cat}>
              <div className="cal-group-hdr text-[11px] font-bold text-ink-2 uppercase tracking-wider py-1.5 px-0 border-b border-hairline">{catGroupHdr[cat]}</div>
              {unassignedInWeek[cat] && (
                <div className="cal-row grid border-b border-warn-soft bg-warn-soft/30 hover:bg-warn-soft/50 transition-colors" style={{ gridTemplateColumns: colGrid }}>
                  <div className="cal-label flex items-center justify-between px-3 py-2 border-r border-warn-soft">
                    <div>
                      <div className="cal-label-name text-xs font-bold text-warn">Awaiting line</div>
                      <div className="cal-label-cap text-[10px] text-warn">From Planning — assign in Schedule</div>
                    </div>
                    <span className="badge text-[8px] font-semibold px-1.5 py-0.5 rounded-full b-orange bg-warn-soft text-warn">TBD</span>
                  </div>
                  {weekDays.map((d, i) => {
                    const dayBatches = getBatches(CAL_UNASSIGNED, d.iso, cat);
                    return (
                      <div
                        key={`unassigned-${cat}-${i}`}
                        className={`cal-cell min-h-14 border-r border-warn-soft p-0.5 flex flex-col gap-0.5 ${i === todayIndex ? 'today-col bg-brand-soft/30' : ''}`}
                        role="gridcell"
                      >
                        {dayBatches.map((batch) => (
                          <div
                            key={batch.bmrNo}
                            className={`batch-block rounded text-[10px] font-semibold px-1.5 py-1 flex flex-col justify-center overflow-hidden shadow-xs cursor-pointer hover:brightness-95 transition-all shrink-0 border-l-[3px] border-dashed border-warn-soft bg-warn-soft/80`}
                            onClick={() => onBatchClick(batch)}
                            title={`${formatUnifiedBatchLabel(batch)} · ${batch.productName} · assign equipment in Schedule`}
                          >
                            <div>{formatUnifiedBatchLabelShort(batch)}</div>
                            <div className="opacity-80 text-[8px]">{batchProductShort(batch)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              {allEquip.filter(e => e._cat === cat).map(eq => {
                const busy = isEquipBusy(eq.id, cat);
                const capLabel = 'cap' in eq && eq.cap ? `${eq.cap}L` : 'speed' in eq && eq.speed ? `${fmt(eq.speed)}/h` : '';
                return (
                  <div key={eq.id} className="cal-row grid border-b border-hairline hover:bg-surface-2/40 transition-colors" style={{ gridTemplateColumns: colGrid }}>
                    <div className="cal-label flex items-center justify-between px-3 py-2 border-r border-hairline">
                      <div>
                        <div className="cal-label-name text-xs font-bold text-ink">{eq.id}</div>
                        <div className="cal-label-cap text-[10px] text-ink-4">{capLabel}</div>
                      </div>
                      <span className={`badge text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${busy ? 'b-orange bg-warn-soft text-warn' : 'b-green bg-ok-soft text-ok'}`}>{busy ? 'Busy' : 'Free'}</span>
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
                          className={`cal-cell min-h-14 border-r border-hairline p-0.5 flex flex-col gap-0.5 cursor-pointer ${i === todayIndex ? 'today-col bg-brand-soft/30' : ''}`}
                          onClick={() => showAddSlot && onSchedule({ equipId: eq.id, category: cat, dateIso: d.iso })}
                          role="gridcell"
                        >
                          {dayBatches.length === 0 && !hasCapacityLeft ? (
                            <div className="empty-slot flex-1 min-h-10 rounded border border-dashed border-border flex items-center justify-center text-ink-4 text-lg hover:bg-surface-2 hover:border-border transition-colors">+</div>
                          ) : (
                            <>
                              {dayBatches.map((batch) => (
                                <div
                                  key={batch.bmrNo}
                                  className={`batch-block rounded text-[10px] font-semibold px-1.5 py-1 flex flex-col justify-center overflow-hidden shadow-xs cursor-pointer hover:brightness-95 transition-all shrink-0 border-l-[3px] ${cat === 'mfg' ? 'batch-block-mfg bg-brand-soft/90 border-brand-soft' : cat === 'fill' ? 'batch-block-fill bg-brand-soft/90 border-brand-soft' : 'batch-block-pack bg-ok-soft/90 border-ok-soft'} ${batch.processType === 'hot' ? 'border-l-orange-500' : 'border-l-sky-400'}`}
                                  style={{ borderLeftColor: batch.processType === 'hot' ? '#f97316' : '#38bdf8' }}
                                  onClick={e => { e.stopPropagation(); onBatchClick(batch); }}
                                  title={`${formatUnifiedBatchLabel(batch)} · ${batch.productName} · ${batch.processType.toUpperCase()} process`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`inline-block w-2 h-2 rounded-sm shrink-0 ${batch.processType === 'hot' ? 'bg-brand' : 'bg-brand'}`} title={batch.processType === 'hot' ? 'Hot Process' : 'Cold Process'} aria-hidden />
                                    {formatUnifiedBatchLabelShort(batch)}
                                  </div>
                                  <div className="opacity-80 text-[8px]">{batchProductShort(batch)}</div>
                                </div>
                              ))}
                              {hasCapacityLeft && (
                                <div className="empty-slot flex-1 min-h-10 rounded border border-dashed border-border flex items-center justify-center text-ink-4 text-lg hover:bg-surface-2 hover:border-border transition-colors shrink-0" title="Add another batch (capacity left)">+</div>
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
        <div className="px-6 py-4 border-t border-hairline bg-surface-2/50 shrink-0">
          <div className="text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-2">Manual scheduling</div>
          <p className="text-[11px] text-ink-3 mb-3">Select date and batch. Vessel and lines are assigned automatically from first available.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-ink-3 mb-1">Date</label>
              <input type="date" className="border border-border rounded-lg px-3 py-2 text-xs font-medium text-ink focus:ring-2 focus:ring-brand focus:outline-none" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="min-w-[220px]">
              <label className="block text-[10px] font-semibold text-ink-3 mb-1">Batch</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-xs font-medium text-ink focus:ring-2 focus:ring-brand focus:outline-none" value={manualBatchId} onChange={e => setManualBatchId(e.target.value)}>
                <option value="">— Select batch —</option>
                {schedulableBatches.map(b => (
                  <option key={b.bmrNo} value={b.bmrNo}>{formatUnifiedBatchLabel(b)} — {b.productName} ({b.batchSize} KG)</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleManualScheduleSubmit} disabled={!manualBatchId} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors">
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
    { key: 'manufacturing', label: 'Manufacturing Vessels', color: 'text-brand', icon: <FlaskConical size={14} /> },
    { key: 'filling', label: 'Filling Lines', color: 'text-brand', icon: <Droplets size={14} /> },
    { key: 'packaging', label: 'Packaging Lines', color: 'text-ok', icon: <Package size={14} /> },
  ];

  const totalEquip = equipment.manufacturing.length + equipment.filling.length + equipment.packaging.length;
  const busyCount = [...equipment.manufacturing, ...equipment.filling, ...equipment.packaging].filter(e => isBusy(e.id)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-equipment">
      <div className="sec-hdr flex items-center justify-between px-6 pt-5 pb-4 border-b border-hairline bg-surface shrink-0">
        <div className="sec-title text-lg font-bold text-ink tracking-tight">Equipment & Capacity</div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs text-ink-3 font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 transition-colors"><RotateCcw size={12} /> Refresh</button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Equipment</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6" id="equip-content">
        {catMeta.map(cat => (
          <div key={cat.key} className="mb-8">
            <h3 className={`flex items-center gap-2 text-sm font-bold ${cat.color} uppercase tracking-wide mb-3`}>
              {cat.icon}{cat.label}
              <Badge className="bg-surface-3 text-ink-3 ml-1">{(equipment[cat.key] as unknown[]).length}</Badge>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(equipment[cat.key] as Array<{ id: string; name: string; _pk?: number; cap?: number; speed?: number; type?: string; status?: string; homogenizer?: boolean; processType?: string[]; compatible?: string[]; supports?: string[] }>).map((e) => {
                const busy = isBusy(e.id);
                const activeBatches = batches.filter(b => (b.mainVessel === e.id || b.fillingLine === e.id || b.packagingLine === e.id) && !['draft', 'cleared', 'fg_ready'].includes(b.bmrStatus));
                const utilPct = Math.min(100, activeBatches.length > 0 ? Math.round((activeBatches.length / Math.max(batches.length, 1)) * 100) : 0);
                return (
                  <div key={e.id} className={`bg-surface rounded-xl border p-4 transition-shadow hover:shadow-md ${busy ? 'border-brand-soft' : 'border-hairline'}`}>
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className={`text-sm font-bold font-mono ${cat.color}`}>{e.id}</div>
                        <div className="text-xs text-ink-2 font-medium">{e.name}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {e.status === 'maintenance' && <Badge className="bg-warn-soft text-warn">MAINTENANCE</Badge>}
                        {e.status !== 'maintenance' && <Badge className={busy ? 'bg-err-soft text-err' : 'bg-ok-soft text-ok'}>{busy ? 'IN USE' : 'IDLE'}</Badge>}
                      </div>
                    </div>
                    {busy && activeBatches.length > 0 && (
                      <div className="text-[10px] text-brand mb-1.5 flex items-center gap-1"><Activity size={10} /> Running: {activeBatches.map(b => formatUnifiedBatchLabelShort(b)).join(', ')}</div>
                    )}
                    {e.cap != null && <div className="text-[11px] text-ink-3">Capacity: <b className="text-ink">{e.cap}L</b></div>}
                    {e.speed != null && <div className="text-[11px] text-ink-3">Speed: <b className="text-ink">{fmt(e.speed)}/hr</b></div>}
                    {e.type && <div className="text-[11px] text-ink-3">Type: <b className="text-ink">{(e.type as string).toUpperCase()}</b></div>}
                    {e.homogenizer !== undefined && cat.key === 'manufacturing' && <div className="text-[11px] text-ink-3 inline-flex items-center gap-0.5">Homogenizer: <b className={e.homogenizer ? 'text-ok inline-flex items-center gap-0.5' : 'text-ink-4'}>{e.homogenizer ? <><Check size={11} /> Yes</> : 'No'}</b></div>}
                    {e.processType && e.processType.length > 0 && <div className="text-[11px] text-ink-3">Process: <b>{(e.processType as string[]).join(', ').toUpperCase()}</b></div>}
                    {e.compatible && e.compatible.length > 0 && <div className="text-[11px] text-ink-3">Compatible: <b>{(e.compatible as string[]).join(', ')}</b></div>}
                    {e.supports && e.supports.length > 0 && <div className="text-[11px] text-ink-3">Supports: <b>{(e.supports as string[]).join(', ')}</b></div>}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-ink-4 mb-1"><span>Utilization</span><span>{utilPct}%</span></div>
                      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${utilPct > 50 ? 'bg-brand' : 'bg-ok'}`} style={{ width: `${utilPct}%` }} /></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(cat.key, e)} className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] text-brand border border-brand-soft rounded-lg hover:bg-brand-soft transition-colors"><Pencil size={10} /> Edit</button>
                      <button onClick={() => handleRemove(cat.key, e.id)} disabled={busy}
                        className={`inline-flex items-center gap-0.5 px-2 py-1 text-[10px] border rounded-lg transition-colors ${busy ? 'text-ink-4 border-hairline cursor-not-allowed' : 'text-err border-err-soft hover:bg-err-soft'}`}>
                        <X size={10} /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              <div onClick={() => { setAddCat(cat.key); setShowAdd(true); }} className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-soft hover:bg-brand-soft/20 transition-colors min-h-35">
                <Plus size={22} className="text-ink-4" />
                <span className="text-xs font-semibold text-ink-4">Add Equipment</span>
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
                  <input type="checkbox" checked={addHomogenizer} onChange={e => setAddHomogenizer(e.target.checked)} className="rounded border-border" />
                </div>
                <div className="col-span-2 flex gap-3 items-center">
                  <label className={`${LBL} mb-0`}>Process Types:</label>
                  {['hot', 'cold'].map(pt => (
                    <label key={pt} className="inline-flex items-center gap-1 text-xs text-ink-2">
                      <input type="checkbox" checked={addProcessTypes.includes(pt)} onChange={e => setAddProcessTypes(prev => e.target.checked ? [...prev, pt] : prev.filter(p => p !== pt))} className="rounded border-border" />
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
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-hairline">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !addId.trim() || !addName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-brand hover:bg-brand text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50">
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
                  <input type="checkbox" checked={editHomogenizer} onChange={e => setEditHomogenizer(e.target.checked)} className="rounded border-border" />
                </div>
                <div className="col-span-2 flex gap-3 items-center">
                  <label className={`${LBL} mb-0`}>Process Types:</label>
                  {['hot', 'cold'].map(pt => (
                    <label key={pt} className="inline-flex items-center gap-1 text-xs text-ink-2">
                      <input type="checkbox" checked={editProcessTypes.includes(pt)} onChange={e => setEditProcessTypes(prev => e.target.checked ? [...prev, pt] : prev.filter(p => p !== pt))} className="rounded border-border" />
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
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-hairline">
            <button onClick={() => setEditPk(null)} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">Cancel</button>
            <button onClick={handleEditSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-brand hover:bg-brand text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : <><Check size={13} /> Save</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────── TEAM VIEW ────────────────────────────────────── */

function TeamView({ team, onRefresh }: {
  team: TeamMember[];
  onRefresh: () => void;
}) {
  const depts: { key: Department; color: string; icon: React.ReactNode }[] = [
    { key: 'Manufacturing', color: 'text-brand', icon: <FlaskConical size={14} /> },
    { key: 'Filling', color: 'text-brand', icon: <Droplets size={14} /> },
    { key: 'Packaging', color: 'text-ok', icon: <Package size={14} /> },
    { key: 'Quality', color: 'text-brand', icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-team">
      <div className="sec-hdr flex items-center justify-between px-6 pt-5 pb-4 border-b border-hairline bg-surface shrink-0">
        <div className="sec-title text-lg font-bold text-ink tracking-tight">Team Management</div>
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs text-ink-3 font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 transition-colors">
          <RotateCcw size={12} /> Refresh
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6" id="team-content">
        <Tip color="blue" icon={<Info size={14} />}>
          Production team members are active users with <b>Super Admin</b>, <b>Admin</b>, or <b>Production</b> roles.
          Assign roles in <b>User Management</b> — there is no separate production team list.
        </Tip>
        {depts.map(dept => {
          const members = teamMembersForDept(team, dept.key);
          return (
            <div key={dept.key} className="mb-8 mt-6">
              <h3 className={`flex items-center gap-2 text-sm font-bold ${dept.color} uppercase tracking-wide mb-3`}>
                {dept.icon}{dept.key}
                <Badge className="bg-surface-3 text-ink-3 ml-1">{members.length}</Badge>
              </h3>
              {members.length === 0 ? (
                <p className="text-xs text-ink-4">No eligible users for this department.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map(t => (
                    <div key={`${dept.key}-${t.id}`} className="bg-surface rounded-xl border border-hairline p-3.5 flex items-start gap-3 transition-shadow hover:shadow-md">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-ok-soft text-ok border border-ok-soft">
                        {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-ink">{t.name}</div>
                        <div className="text-[10px] text-ink-3">{t.role}</div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          <Badge className="bg-ok-soft text-ok">Active</Badge>
                          {t.userId != null && <Badge className="bg-brand-soft text-brand">User #{t.userId}</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────── MATERIAL RESERVATION VIEW ─────────────────────── */

function batchEligibleForMaterialReserve(batch: Batch, kind: 'rm' | 'pm'): boolean {
  const pk = (batch as Batch & { _pk?: number })._pk;
  if (!pk) return false;
  if (kind === 'rm') {
    if (batch.rmConnected || batch.bmrStatus === 'cleared') return false;
    if (!['batch_confirmed', 'rm_reserved', 'scheduled'].includes(batch.bmrStatus)) return false;
    return !batch.rmReserved;
  }
  if (batch.pmConnected || batch.bprStatus === 'fg_ready') return false;
  if (batch.pmReserved) return false;
  return canReservePmForBatch(batch) || batch.bprStatus === 'pm_reserved';
}

function ReserveForBatchPickerModal({
  batches,
  onClose,
  onContinue,
}: {
  batches: Batch[];
  onClose: () => void;
  onContinue: (batch: Batch, type: 'rm' | 'pm') => void;
}) {
  const [materialType, setMaterialType] = useState<'rm' | 'pm'>('rm');
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBmr, setSelectedBmr] = useState('');

  const eligibleBatches = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    return batches
      .filter((b) => batchEligibleForMaterialReserve(b, materialType))
      .filter((b) => {
        if (!q) return true;
        return [b.bmrNo, b.bprNo, b.batchNo, b.productName, b.soNo, b.sku]
          .some((v) => String(v ?? '').toLowerCase().includes(q));
      })
      .sort((a, b) => a.bmrNo.localeCompare(b.bmrNo));
  }, [batches, materialType, batchSearch]);

  useEffect(() => {
    if (eligibleBatches.length === 0) {
      setSelectedBmr('');
      return;
    }
    if (!eligibleBatches.some((b) => b.bmrNo === selectedBmr)) {
      setSelectedBmr(eligibleBatches[0].bmrNo);
    }
  }, [eligibleBatches, selectedBmr]);

  const selectedBatch = eligibleBatches.find((b) => b.bmrNo === selectedBmr) ?? null;

  return (
    <Modal onClose={onClose} title="Reserve for batch" size="md">
      <p className="text-xs text-ink-3 mb-4">
        Choose a production batch and material type, then select which RM or PM lines to reserve from warehouse stock.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-[10px] font-bold text-ink-3 uppercase tracking-wider self-center">Material:</span>
        {(['rm', 'pm'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setMaterialType(k)}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
              materialType === k
                ? k === 'rm'
                  ? 'bg-brand text-white border-brand-soft'
                  : 'bg-brand text-white border-brand-soft'
                : 'bg-surface text-ink-2 border-border hover:bg-surface-2'
            }`}
          >
            {k === 'rm' ? 'Raw materials (RM)' : 'Packaging (PM)'}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <label htmlFor="reserve-batch-search" className="block text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-1.5">
          Search batch
        </label>
        <input
          id="reserve-batch-search"
          type="text"
          value={batchSearch}
          onChange={(e) => setBatchSearch(e.target.value)}
          placeholder="BMR, BPR, product, SO…"
          className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-ink placeholder-gray-400 outline-none focus:ring-1 focus:ring-warn"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="reserve-batch-select" className="block text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-1.5">
          Batch
        </label>
        {eligibleBatches.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-4 text-xs text-ink-3 text-center">
            No batches eligible for {materialType === 'rm' ? 'RM' : 'PM'} reservation with current filters.
          </div>
        ) : (
          <select
            id="reserve-batch-select"
            value={selectedBmr}
            onChange={(e) => setSelectedBmr(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-surface text-ink outline-none focus:ring-1 focus:ring-warn"
          >
            {eligibleBatches.map((b) => (
              <option key={b.bmrNo} value={b.bmrNo}>
                {formatUnifiedBatchLabel(b)} · {b.productName} ({b.bmrStatus}{materialType === 'pm' ? ` / ${b.bprStatus}` : ''})
              </option>
            ))}
          </select>
        )}
      </div>
      {selectedBatch && (
        <div className="rounded-lg border border-warn-soft bg-warn-soft/60 px-3 py-2.5 text-xs text-warn mb-4">
          <div className="font-semibold">{selectedBatch.productName}</div>
          <div className="text-[10px] text-warn/90 mt-0.5">
            SO {selectedBatch.soNo} · Batch {selectedBatch.batchIndex}/{selectedBatch.totalBatches}
            {materialType === 'rm' ? ` · ${selectedBatch.batchSize} KG` : ''}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-ink-3 rounded-lg hover:bg-surface-3 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedBatch}
          onClick={() => { if (selectedBatch) onContinue(selectedBatch, materialType); }}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-warn hover:bg-warn text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package size={13} /> Continue to select lines
        </button>
      </div>
    </Modal>
  );
}

function MaterialReservationView({
  batches,
  outboundMrns,
  inventoryRows,
  stockRM,
  stockPM,
  reservedRM,
  reservedPM,
  onAction,
  onRefresh,
  onReserved,
}: {
  batches: Batch[];
  outboundMrns: MRNRecordFromApi[];
  inventoryRows: WarehouseInventoryRow[];
  stockRM: Record<string, number>;
  stockPM: Record<string, number>;
  reservedRM: Record<string, number>;
  reservedPM: Record<string, number>;
  onAction: (action: string, batch: Batch) => void;
  onRefresh: () => void;
  onReserved: () => Promise<void>;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ProductionReservedItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'RM' | 'PM'>('all');
  const [search, setSearch] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reserveTarget, setReserveTarget] = useState<{ batch: Batch; type: 'rm' | 'pm' } | null>(null);
  const [resDetail, setResDetail] = useState<ProductionReservedItemRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProductionReservedItems()
      .then((data) => setRows(data))
      .catch(() => setError('Failed to load reserved items'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const batchByPk = useMemo(() => {
    const map = new Map<number, Batch>();
    batches.forEach((b) => {
      const pk = (b as Batch & { _pk?: number })._pk;
      if (pk) map.set(pk, b);
    });
    return map;
  }, [batches]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== 'all') list = list.filter((r) => r.itemType === filter);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.bmrNo, r.bprNo, r.soNo, r.productName, r.code, r.name].some((v) =>
        String(v ?? '').toLowerCase().includes(q),
      ),
    );
  }, [rows, filter, search]);

  const canRemoveRow = (row: ProductionReservedItemRow): boolean => {
    const batch = batchByPk.get(row.productionBatchId);
    if (!batch) return false;
    if (row.itemType === 'RM') return canUnreserveRmForBatch(batch, outboundMrns, rows);
    return canUnreservePmForBatch(batch, outboundMrns, rows);
  };

  const handleRemove = async (row: ProductionReservedItemRow): Promise<void> => {
    if (!canRemoveRow(row)) {
      addToast('error', 'This reservation cannot be removed — check connect, MTR, or dispensing status.');
      return;
    }
    const batch = batchByPk.get(row.productionBatchId);
    const batchLabel = batch
      ? formatUnifiedBatchLabel(batch)
      : row.bmrNo || row.bprNo || `batch #${row.productionBatchId}`;
    const ok = window.confirm(`Remove ${row.itemType} reservation for ${row.code} (${row.name}) on ${batchLabel}?`);
    if (!ok) return;
    setRemovingId(row.id);
    try {
      const res = await unreserveProductionBatchLines(row.productionBatchId, {
        kind: row.itemType,
        codes: [row.code],
      });
      if (!res.success) {
        addToast('error', res.error || 'Failed to remove reservation');
        return;
      }
      addToast('success', `Removed ${row.itemType} reservation for ${row.code}`);
      load();
      onRefresh();
    } finally {
      setRemovingId(null);
    }
  };

  const handleReserveMore = (row: ProductionReservedItemRow): void => {
    const batch = batchByPk.get(row.productionBatchId);
    if (!batch) {
      addToast('error', 'Batch not found — refresh and try again.');
      return;
    }
    onAction(row.itemType === 'RM' ? 'reserveRM' : 'reservePM', batch);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-material-reservation">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-hairline bg-surface shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-ink tracking-tight">Material Reservation</div>
          <div className="sec-sub text-[11px] text-ink-4 mt-0.5">
            All RM/PM reserved for production batches · remove individual lines or reserve more per batch
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-warn hover:bg-warn text-white shadow-sm transition-colors"
          >
            <Plus size={13} /> Reserve for batch
          </button>
          <button
            type="button"
            onClick={() => { load(); onRefresh(); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-border text-ink-2 hover:bg-surface-2 transition-colors"
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>
      </div>
      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-hairline bg-surface shrink-0">
        <span className="text-[9.5px] font-bold text-ink-3 uppercase tracking-wider">Type:</span>
        {(['all', 'RM', 'PM'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              filter === k ? 'active bg-warn text-white border-warn-soft' : 'bg-surface text-ink-2 border-border hover:bg-surface-2'
            }`}
          >
            {k === 'all' ? 'All' : k}
          </button>
        ))}
        <input
          type="text"
          className="search-box flex-1 min-w-[120px] max-w-[220px] text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink placeholder-gray-400 outline-none focus:ring-1 focus:ring-warn ml-auto"
          placeholder="Search batch, code, product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Badge className="bg-surface-3 text-ink-2 border border-border">{filtered.length} lines</Badge>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No reserved materials match this filter."
            description="Use Reserve for batch or reserve from batch cards."
            action={
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-warn hover:bg-warn text-white shadow-sm transition-colors"
              >
                <Plus size={13} /> Reserve for batch
              </button>
            }
          />
        ) : (
          <div className="tbl-wrap overflow-auto max-h-[70vh] rounded-xl border border-hairline bg-surface">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-surface-2/80 border-b border-hairline [&_th]:bg-surface-2">
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Type</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Batch</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Product</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Code</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold text-ink-3">Material</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-3">Qty reserved</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((row) => {
                  const batch = batchByPk.get(row.productionBatchId);
                  const removable = canRemoveRow(row);
                  return (
                    <tr key={row.id} onClick={() => setResDetail(row)} className="cursor-pointer hover:bg-surface-2/50">
                      <td className="px-3 py-2.5">
                        <Badge className={row.itemType === 'RM' ? 'bg-brand-soft text-brand border border-brand-soft' : 'bg-brand-soft text-brand border border-brand-soft'}>
                          {row.itemType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-ink-2">
                        {batch ? formatUnifiedBatchLabel(batch) : (row.bmrNo || row.bprNo || '—')}
                      </td>
                      <td className="px-3 py-2.5 text-ink-2 max-w-[10rem] truncate" title={row.productName || undefined}>
                        {row.productName || '—'}
                        {row.soNo && <div className="text-[9px] text-ink-4">{row.soNo}</div>}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-ink">{row.code}</td>
                      <td className="px-3 py-2.5 text-ink-2 max-w-[12rem] truncate" title={row.name}>{row.name}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                        {formatQtyExact(row.quantityReserved, row.itemType === 'RM' ? 'kg' : 'pcs')} {row.unit}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {batch && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleReserveMore(row); }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-warn bg-warn-soft border border-warn-soft rounded-lg hover:bg-warn-soft transition-colors"
                            >
                              <Package size={10} /> Reserve more
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!removable || removingId === row.id}
                            title={removable ? 'Remove this reservation line' : 'Blocked by connect, MTR, or dispensing'}
                            onClick={(e) => { e.stopPropagation(); void handleRemove(row); }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-err bg-err-soft border border-err-soft rounded-lg hover:bg-err-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {removingId === row.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pickerOpen && (
        <ReserveForBatchPickerModal
          batches={batches}
          onClose={() => setPickerOpen(false)}
          onContinue={(batch, type) => {
            setPickerOpen(false);
            setReserveTarget({ batch, type });
          }}
        />
      )}
      {reserveTarget && (
        <ReserveMaterialModal
          batch={reserveTarget.batch}
          type={reserveTarget.type}
          stockMap={reserveTarget.type === 'rm' ? stockRM : stockPM}
          reservedMap={reserveTarget.type === 'rm' ? reservedRM : reservedPM}
          inventoryRows={inventoryRows}
          onClose={() => setReserveTarget(null)}
          onReserved={async () => {
            await onReserved();
            load();
            onRefresh();
            setReserveTarget(null);
          }}
        />
      )}
      <RecordDetailModal
        open={!!resDetail}
        onClose={() => setResDetail(null)}
        eyebrow="Material Reservation"
        title={resDetail?.name}
        subtitle={resDetail?.code}
        sections={resDetail ? [
          {
            title: 'Reservation',
            fields: [
              { label: 'Item Type', value: resDetail.itemType },
              { label: 'Code', value: resDetail.code, mono: true },
              { label: 'Name', value: resDetail.name },
              { label: 'Quantity Reserved', value: `${formatQtyExact(resDetail.quantityReserved, resDetail.itemType === 'RM' ? 'kg' : 'pcs')} ${resDetail.unit}` },
              { label: 'Unit', value: resDetail.unit },
              { label: 'Updated At', value: resDetail.updatedAt ? new Date(resDetail.updatedAt).toLocaleString('en-IN') : '—' },
            ],
          },
          {
            title: 'Batch context',
            fields: [
              { label: 'BMR No', value: resDetail.bmrNo, mono: true },
              { label: 'BPR No', value: resDetail.bprNo, mono: true },
              { label: 'SO No', value: resDetail.soNo, mono: true },
              { label: 'Product Name', value: resDetail.productName },
            ],
          },
        ] : []}
      />
    </div>
  );
}

/* ──────────── SIDEBAR & HEADER ─────────────────────────────── */

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'batches', label: 'Batches', icon: <Layers size={15} /> },
  { id: 'dispensing-tray', label: 'Dispensing & Tray', icon: <Scale size={15} /> },
  { id: 'calendar', label: 'Production Calendar', icon: <Calendar size={15} /> },
  { id: 'material-reservation', label: 'Material Reservation', icon: <Layers size={15} /> },
  { id: 'yield-report', label: 'Yield Report', icon: <Activity size={15} /> },
  { id: 'equipment', label: 'Equipment & Capacity', icon: <Wrench size={15} /> },
  { id: 'team', label: 'Team Management', icon: <Users size={15} /> },
];

const PRODUCTION_SIDEBAR_COLLAPSE_KEY = 'production-sidebar-collapsed';

function ProductionSidebar({ active, onChange, mobileOpen, onMobileClose, navItems }: {
  active: Section; onChange: (s: Section) => void; mobileOpen: boolean; onMobileClose: () => void;
  navItems: { id: Section; label: string; icon: React.ReactNode }[];
}) {
  return (
    <NavSidebar
      title="Production"
      moduleName="production"
      collapseKey={PRODUCTION_SIDEBAR_COLLAPSE_KEY}
      activeKey={active}
      onNavigate={(k) => onChange(k as Section)}
      sections={navItems.map((item) => ({ key: item.id, label: item.label, icon: item.icon }))}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      hideMobileHeader
    />
  );
}

function TopHeader({ batches, onMenuClick, onSchedule }: {
  batches: Batch[]; onMenuClick: () => void; onSchedule: () => void;
}) {
  const statusCounts = countProductionStatusBuckets(batches, (b) => ({
    effectiveRmConnected: Boolean(b.rmConnected),
    effectivePmConnected: Boolean(b.pmConnected),
  }));
  const weekLabel = formatWeekLabel(getWeekStart(new Date()));

  const statusBadges: { label: string; count: number; className: string }[] = [
    { label: 'Batches', count: statusCounts.total, className: 'bg-surface-3 text-ink-2 border-border' },
    { label: 'Dispensing', count: statusCounts.dispensing, className: 'bg-brand-soft text-brand border-brand-soft' },
    { label: 'Production', count: statusCounts.production, className: 'bg-brand-soft text-brand border-brand-soft' },
    { label: 'Filling', count: statusCounts.filling, className: 'bg-brand-soft text-brand border-brand-soft' },
    { label: 'Packing', count: statusCounts.packing, className: 'bg-brand-soft text-brand border-brand-soft' },
    { label: 'FG Ready', count: statusCounts.fgReady, className: 'bg-ok-soft text-ok border-ok-soft' },
  ];

  return (
    <header className="h-13 bg-surface border-b border-hairline shadow-xs flex items-center px-5 gap-3 shrink-0 z-20">
      <AdminMainMenuButton />
      <button className="md:hidden p-1.5 rounded-lg hover:bg-surface-3 text-ink-3 transition-colors" onClick={onMenuClick} aria-label="Open menu"><Menu size={18} /></button>
      <div className="hidden md:flex items-center gap-2">
        <span className="text-[11px] text-ink-4 font-medium tracking-wide">Manufacturing Management</span>
      </div>
      <div className="flex items-center gap-1.5 ml-1 md:ml-3 overflow-x-auto">
        {statusBadges.map((badge) => (
          <Badge key={badge.label} className={`${badge.className} whitespace-nowrap`}>
            {badge.label} · {badge.count}
          </Badge>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:block text-[11px] text-ink-4 font-medium">{weekLabel}</span>
        <button onClick={onSchedule} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm">
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
  const canViewBmr = isAdmin || canPerformAction('order-management', 'production-bmr', 'canView');
  const canViewBpr = isAdmin || canPerformAction('order-management', 'production-bpr', 'canView');
  const canQaApprove = isAdmin || canPerformAction('order-management', 'quality', 'canApprove');
  const canViewTransferYield = isAdmin || canPerformAction('order-management', 'production-transfer-yield', 'canView');
  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.id === 'batches') return canViewBmr || canViewBpr;
        if (item.id === 'dispensing-tray') return canViewBmr || canViewBpr;
        if (item.id === 'material-reservation') return canViewBmr || canViewBpr;
        if (item.id === 'yield-report') return canViewTransferYield;
        return true;
      }),
    [canViewBmr, canViewBpr, canViewTransferYield]
  );

  const rawSectionParam = searchParams.get('section');
  const legacySection = (rawSectionParam === 'bmr' || rawSectionParam === 'bpr' ? 'batches' : rawSectionParam) as Section | null;
  const defaultSection = (visibleNavItems[0]?.id ?? 'batches') as Section;
  const activeSection: Section = legacySection && visibleNavItems.some(n => n.id === legacySection) ? legacySection : defaultSection;

  useEffect(() => {
    if (rawSectionParam === 'bmr' || rawSectionParam === 'bpr') {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('section', 'batches');
        return p;
      });
    }
  }, [rawSectionParam, setSearchParams]);
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
  const [reservedItems, setReservedItems] = useState<ProductionReservedItemRow[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [modalBatch, setModalBatch] = useState<Batch | null>(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [splitVesselCapLiters, setSplitVesselCapLiters] = useState<number | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<ScheduleSlot | null>(null);
  const [pendingMtrItems, setPendingMtrItems] = useState<DispensingItem[] | null>(null);
  const [sentSummary, setSentSummary] = useState<SentBatchSummaryRow[]>([]);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [createBatchPreset, setCreateBatchPreset] = useState<{ soNo: string; bmrNo: string } | null>(null);
  const [yieldReworkPreflightBatch, setYieldReworkPreflightBatch] = useState<Batch | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState<{ bmrNo: string; label: string } | null>(null);
  const batchActionPendingRef = useRef(0);
  const productionBmrDeepLinkAppliedRef = useRef(false);
  const deepLinkBmr = searchParams.get('bmr')?.trim() ?? '';
  const loadedFromApi = useRef(false);
  const prevActiveSectionRef = useRef<Section | null>(null);

  const beginBatchAction = useCallback((bmrNo: string, label: string) => {
    batchActionPendingRef.current += 1;
    setBatchActionLoading({ bmrNo, label });
  }, []);

  const endBatchAction = useCallback(() => {
    batchActionPendingRef.current = Math.max(0, batchActionPendingRef.current - 1);
    if (batchActionPendingRef.current === 0) setBatchActionLoading(null);
  }, []);

  const whStockRM = useMemo(() => buildStockMap(whInventory, 'RM'), [whInventory]);
  const whStockPM = useMemo(() => buildStockMap(whInventory, 'PM'), [whInventory]);
  const whReservedRM = useMemo(() => buildReservedMap(whInventory, 'RM'), [whInventory]);
  const whReservedPM = useMemo(() => buildReservedMap(whInventory, 'PM'), [whInventory]);
  /** Material names by code — dispensing lines often carry only a code, so the UI resolves it. */
  const materialNameByCode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of whInventory) {
      const c = String(r.code ?? '').trim();
      if (c && r.name && !m[c]) m[c] = String(r.name);
    }
    return m;
  }, [whInventory]);
  const atFacilityRM = useMemo(() => buildAtFacilityMap(whInventory, 'RM'), [whInventory]);
  const atFacilityPM = useMemo(() => buildAtFacilityMap(whInventory, 'PM'), [whInventory]);

  const atMuZoneForBatch = useCallback(
    (batch: Batch, itemType: 'RM' | 'PM') =>
      buildAtBatchMuZoneMap(whInventory, itemType, String(batch.scheduledMuZone || '').trim()),
    [whInventory]
  );
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
        fetchSentBatchSummary(),
        fetchMRNList({ transferType: 'outbound' }),
        fetchProductionReservedItems(),
      ]))
      .then(([batchRows, equipData, teamRows, invResult, sent, outboundList, reservedRows]) => {
        const batches = batchRows.length ? batchRows.map(apiBatchToBatch) : [];
        const equipment = apiEquipToEquipData(equipData);
        const team = teamRows.length ? apiTeamToTeam(teamRows) : DEFAULT_TEAM;
        setState({ batches, equipment, team, lastUpdated: new Date().toISOString() });
        if (invResult.success && invResult.data.rows.length) setWhInventory(invResult.data.rows);
        setSentSummary(Array.isArray(sent) ? sent : []);
        setOutboundMrns(Array.isArray(outboundList) ? outboundList : []);
        setReservedItems(Array.isArray(reservedRows) ? reservedRows : []);
      })
      .catch(() => {
        setState(defaultState());
      });
  }, []);

  useEffect(() => {
    if (!deepLinkBmr || productionBmrDeepLinkAppliedRef.current || state.batches.length === 0) return;
    const batch = state.batches.find((b) => String(b.bmrNo).trim() === deepLinkBmr);
    if (!batch) return;
    productionBmrDeepLinkAppliedRef.current = true;
    setSection('batches');
    setModalBatch(batch);
    setModalType('detail');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('bmr');
      return p;
    }, { replace: true });
  }, [deepLinkBmr, state.batches, setSection, setSearchParams]);

  /** When opening Calendar, jump to the nearest week that has scheduled stage dates if the current week is empty. */
  useEffect(() => {
    const openedCalendar = activeSection === 'calendar' && prevActiveSectionRef.current !== 'calendar';
    prevActiveSectionRef.current = activeSection;
    if (!openedCalendar || state.batches.length === 0) return;

    const monday = addDays(getWeekStart(new Date()), weekOffset * 7);
    const weekIsos = new Set(buildWeekDays(monday).map((d) => d.iso));
    const hasInCurrentWeek = state.batches.some((b) =>
      (b.mfgDate && weekIsos.has(b.mfgDate))
      || (b.fillDate && weekIsos.has(b.fillDate))
      || (b.packDate && weekIsos.has(b.packDate)),
    );
    if (hasInCurrentWeek) return;

    const stageDates = state.batches
      .flatMap((b) => [b.mfgDate, b.fillDate, b.packDate])
      .filter((d): d is string => Boolean(d));
    if (stageDates.length === 0) return;

    const today = isoDate(new Date());
    const target = stageDates.filter((d) => d >= today).sort()[0] ?? [...stageDates].sort().pop();
    if (!target) return;
    setWeekOffset(getWeekOffsetForDate(target));
  }, [activeSection, state.batches, weekOffset, setWeekOffset]);

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

  const refreshReservedItems = useCallback(() => {
    fetchProductionReservedItems()
      .then((items) => setReservedItems(items))
      .catch(() => { /* keep stale list */ });
  }, []);

  const refreshBatches = useCallback(() => {
    fetchBatches()
      .then(rows => {
        const batches = rows.length ? rows.map(apiBatchToBatch) : [];
        setState(prev => ({ ...prev, batches, lastUpdated: new Date().toISOString() }));
      })
      .catch(() => { });
    refreshReservedItems();
  }, [refreshReservedItems]);

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

  const updateBatch = useCallback((bmrNo: string, updates: Partial<Batch>, actionLabel?: string): Promise<void> => {
    const batch = state.batches.find(b => b.bmrNo === bmrNo) as (Batch & { _pk?: number }) | undefined;
    const label = actionLabel ?? batchActionLabelFromUpdates(updates);
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
    if (!batch?._pk) {
      setState((prev) => ({ ...prev, batches: prev.batches.map((b) => (b.bmrNo === bmrNo ? { ...b, ...updates } : b)) }));
      return Promise.resolve();
    }

    beginBatchAction(bmrNo, label);
    const rmCodes = Array.isArray(updates.dispensingRM) ? updates.dispensingRM.map((l) => l.code) : [];
    const pmCodes = Array.isArray(updates.dispensingPM) ? updates.dispensingPM.map((l) => l.code) : [];
    return apiBatchUpdate(batch._pk, updates)
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
          throw err;
        })
        .finally(() => {
          endBatchAction();
        });
  }, [state.batches, addToast, refreshBatches, beginBatchAction, endBatchAction]);

  const openScheduleWizard = useCallback((slot?: ScheduleSlot) => {
    setScheduleSlot(slot ?? null);
    setModalBatch(null);
    setModalType('schedule');
  }, []);

  const refreshInventory = useCallback(() => {
    fetchWarehouseInventory()
      .then((invResult) => {
        if (invResult.success && invResult.data?.rows?.length) setWhInventory(invResult.data.rows);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  const handleUnreserveRm = useCallback(
    async (batch: Batch) => {
      if (!canUnreserveRmForBatch(batch, outboundMrns, reservedItems)) {
        addToast('error', 'RM reservation cannot be removed — check connect, MTR, or dispensing status.');
        return;
      }
      const pk = (batch as Batch & { _pk?: number })._pk;
      if (!pk) {
        addToast('error', 'Batch id missing — refresh and try again.');
        return;
      }
      const { byCode } = await fetchBatchMtrReserved(pk);
      const codes = Object.entries(byCode || {})
        .filter(([, qty]) => (Number(qty) || 0) > 0)
        .map(([code]) => code);
      if (codes.length === 0) {
        addToast('error', 'No RM lines reserved for this batch.');
        return;
      }
      const ok = window.confirm(
        `Remove RM reservation for ${codes.length} line(s) on ${formatUnifiedBatchLabel(batch)}? Warehouse stock will be released for other batches.`,
      );
      if (!ok) return;
      beginBatchAction('Removing RM reservation…', batch.bmrNo);
      try {
        const res = await unreserveProductionBatchLines(pk, { kind: 'RM', codes });
        if (!res.success) {
          addToast('error', res.error || 'Failed to remove RM reservation');
          return;
        }
        addToast('success', `RM reservation removed for ${formatUnifiedBatchLabel(batch)}`);
        refreshBatches();
        refreshInventory();
      } finally {
        endBatchAction();
      }
    },
    [addToast, outboundMrns, reservedItems, refreshBatches, refreshInventory, beginBatchAction, endBatchAction],
  );

  const handleUnreservePm = useCallback(
    async (batch: Batch) => {
      if (!canUnreservePmForBatch(batch, outboundMrns, reservedItems)) {
        addToast('error', 'PM reservation cannot be removed — check connect, MTR, or dispensing status.');
        return;
      }
      const pk = (batch as Batch & { _pk?: number })._pk;
      if (!pk) {
        addToast('error', 'Batch id missing — refresh and try again.');
        return;
      }
      const { byCode } = await fetchBatchMtrReserved(pk);
      const codes = Object.entries(byCode || {})
        .filter(([, qty]) => (Number(qty) || 0) > 0)
        .map(([code]) => code);
      if (codes.length === 0) {
        addToast('error', 'No PM lines reserved for this batch.');
        return;
      }
      const ok = window.confirm(
        `Remove PM reservation for ${codes.length} line(s) on ${formatUnifiedBatchLabel(batch)}? Warehouse stock will be released for other batches.`,
      );
      if (!ok) return;
      beginBatchAction('Removing PM reservation…', batch.bmrNo);
      try {
        const res = await unreserveProductionBatchLines(pk, { kind: 'PM', codes });
        if (!res.success) {
          addToast('error', res.error || 'Failed to remove PM reservation');
          return;
        }
        addToast('success', `PM reservation removed for ${formatUnifiedBatchLabel(batch)}`);
        refreshBatches();
        refreshInventory();
      } finally {
        endBatchAction();
      }
    },
    [addToast, outboundMrns, reservedItems, refreshBatches, refreshInventory, beginBatchAction, endBatchAction],
  );

  const handleReserveRefresh = useCallback(async () => {
    try {
      const rows = await fetchBatches();
      const batches = rows.length ? rows.map(apiBatchToBatch) : [];
      setState((prev) => ({ ...prev, batches, lastUpdated: new Date().toISOString() }));
    } catch {
      refreshBatches();
    }
    refreshInventory();
    refreshReservedItems();
  }, [refreshBatches, refreshInventory, refreshReservedItems]);

  /* ── TEMPORARY dev tooling: seed a dispensing tray ────────────────────────────────────────
     Always available — the tray it produces is a mock, so no stock moves. Remove this block, the
     DispensingTrayView props, and src/production/devDispensingSeed.js once testing is done. */
  const [seedingBmrNo, setSeedingBmrNo] = useState<string | null>(null);

  const handleSeedTestTray = useCallback(
    async (batch: Batch, fill: 'empty' | 'full') => {
      const batchPk = (batch as Batch & { _pk?: number })._pk;
      if (!batchPk) {
        addToast('error', 'Batch id missing — cannot seed a tray.');
        return;
      }
      setSeedingBmrNo(batch.bmrNo);
      try {
        const res = await devSeedDispensingTray(batchPk, { kind: 'both', fill });
        if (!res.success) {
          addToast('error', res.error || 'Could not seed the tray');
          return;
        }
        const seed = res.seed;
        addToast(
          'info',
          `Test tray seeded for ${batch.bmrNo}: ${seed?.rmLines ?? 0} RM / ${seed?.pmLines ?? 0} PM line(s)`
          + `${fill === 'full' ? ', all marked dispensed' : ''}. Mock only — no stock was consumed.`,
        );
        await handleReserveRefresh();
      } finally {
        setSeedingBmrNo(null);
      }
    },
    [addToast, handleReserveRefresh],
  );

  const handleAction = useCallback(
    (action: string, batch: Batch) => {
      if (action === 'unreserveRM') {
        void handleUnreserveRm(batch);
        return;
      }
      if (action === 'unreservePM') {
        void handleUnreservePm(batch);
        return;
      }
      if (action === 'mtrRM' && !batch.rmReserved) {
        addToast('error', 'Reserve all RM lines for this batch before starting RM Transfer.');
        return;
      }
      if (action === 'mtrPM' && !batch.pmReserved) {
        addToast('error', 'Reserve all PM lines for this batch before starting PM Transfer.');
        return;
      }
      setModalBatch(batch);
      setModalType(action);
    },
    [handleUnreservePm, handleUnreserveRm, addToast],
  );

  const handleModalSave = useCallback(async (updates: Partial<Batch>) => {
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
    try {
      await updateBatch(modalBatch.bmrNo, updates, batchActionLabelFromModalType(modalType));
      if (modalType === 'confirm' || modalType === 'adjustBatch' || modalType === 'editBatch' || modalType === 'confirmSchedule' || modalType === 'initiateDispensing' || modalType === 'initiateProduction') {
        await queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
        await queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      }
      // Dispensing: warehouse refetch runs after PATCH succeeds inside updateBatch (ML1/ML2 delta applied on server).
      if (modalType === 'reserveRM' || modalType === 'reservePM' || modalType === 'mtrRM' || modalType === 'mtrPM' || modalType === 'qcPack') {
        const invResult = await fetchWarehouseInventory();
        if (invResult.success && invResult.data?.rows?.length) {
          setWhInventory(invResult.data.rows);
          const rows = invResult.data.rows as WarehouseInventoryRow[];
          console.log('[RESERVE-DEBUG] Frontend: After refetch warehouse-inventory', {
            rowCount: rows.length,
            sampleRM: rows.filter((r) => r.type === 'RM').slice(0, 3).map((r) => ({ code: r.code, SIH: r.stockInHand, reserved: r.reserved, available: Math.max(0, (r.stockInHand ?? 0) - (r.reserved ?? 0)) })),
            samplePM: rows.filter((r) => r.type === 'PM').slice(0, 2).map((r) => ({ code: r.code, SIH: r.stockInHand, reserved: r.reserved, available: Math.max(0, (r.stockInHand ?? 0) - (r.reserved ?? 0)) })),
          });
        }
      }
      const msg = modalType === 'confirm' ? `${formatUnifiedBatchLabel(modalBatch)} confirmed`
        : modalType === 'initiateProduction' ? `${formatUnifiedBatchLabel(modalBatch)} — production started`
        : modalType === 'initiateDispensing' ? `${formatUnifiedBatchLabel(modalBatch)} dispensing initiated — tray created`
        : modalType === 'confirmSchedule' ? `${formatUnifiedBatchLabel(modalBatch)} schedule confirmed — BMR/BPR locked`
        : modalType === 'editBatch' ? `${formatUnifiedBatchLabel(modalBatch)} updated & synced`
        : modalType === 'adjustBatch' ? `${formatUnifiedBatchLabel(modalBatch)} batch size updated`
          : modalType === 'reserveRM' ? `RM Reserved for ${formatUnifiedBatchLabel(modalBatch)}`
            : modalType === 'reservePM' ? `PM Reserved for ${formatUnifiedBatchLabel(modalBatch)}`
              : modalType === 'schedule' ? `${formatUnifiedBatchLabel(modalBatch)} scheduled`
                : modalType === 'dispenseRM' || modalType === 'dispensePM' ? 'Dispensing updated'
                  : modalType === 'qcBMR' || modalType === 'qcFill' || modalType === 'qcPack' ? 'QC review saved'
                    : modalType === 'mtrRM' || modalType === 'mtrPM' ? 'Transfer step updated'
                      : 'Batch updated';
      addToast('success', msg);
    } catch {
      /* error toast shown in updateBatch */
    }
  }, [modalBatch, modalType, updateBatch, addToast, queryClient]);

  const closeModal = useCallback(() => {
    setModalBatch(null);
    setModalType(null);
    setScheduleSlot(null);
    setPendingMtrItems(null);
    setSplitVesselCapLiters(null);
  }, []);

  const refreshProductionBatches = useCallback(async (): Promise<Batch[]> => {
    const rows = await fetchBatches();
    const batches = rows.map(apiBatchToBatch);
    setState((prev) => ({ ...prev, batches, lastUpdated: new Date().toISOString() }));
    await queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
    await queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
    return batches;
  }, [queryClient]);

  const schedulableForManual = useMemo(() => state.batches.filter(b =>
    !hasProductionBatchSchedule(b)
    && (b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved')
  ), [state.batches]);

  const handleManualSchedule = useCallback(async (batch: Batch, updates: Partial<Batch>) => {
    try {
      await updateBatch(batch.bmrNo, updates, 'Saving schedule…');
      addToast('success', `${formatUnifiedBatchLabel(batch)} scheduled`);
      if (updates.mfgDate) setWeekOffset(getWeekOffsetForDate(updates.mfgDate));
    } catch {
      /* error toast shown in updateBatch */
    }
  }, [updateBatch, addToast, setWeekOffset]);

  const batchesViewHelpers = useMemo(
    () => ({
      batchLifecycleDisplayForBatch,
      UnifiedPipelineStrip,
      batchColorMap,
      getBatchStageDateAlert,
      effectiveRmConnected,
      effectivePmConnected,
      findOpenRmMtrForBatch,
      findAnyRmMtrForBatch,
      findOpenPmMtrForBatch,
      findAnyPmMtrForBatch,
      outboundMtrWarehouseMeta,
      outboundMtrStageHint,
      outboundMtrStageTitle,
      mtrLineItemIsRm,
      mtrLineItemIsPm,
      mtrLinePhaseRaw,
      formatMtrLinePhaseShort,
      mtrAllRmLinesReceivedAtMu,
      mtrAllPmLinesReceivedAtMu,
      hasProductionBatchSchedule,
      canConfirmProductionBatch,
      canUnreserveRmForBatch,
      canUnreservePmForBatch,
      canReservePmForBatch,
      canShowRescheduleFooterButton,
      canAdjustBatchSize,
      Badge,
      Btn,
    }),
    [],
  );

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
      case 'batches':
        if (!canViewBmr && !canViewBpr) {
          return <div className="p-8 text-sm text-ink-3">You do not have permission to view Batches.</div>;
        }
        return (
          <BatchesView
            batches={state.batches}
            outboundMrns={outboundMrns}
            reservedItems={reservedItems}
            onAction={handleAction}
            onCreateBatch={() => { setCreateBatchPreset(null); setShowCreateBatchModal(true); }}
            helpers={batchesViewHelpers}
          />
        );
      case 'dispensing-tray':
        if (!canViewBmr && !canViewBpr) {
          return <div className="p-8 text-sm text-ink-3">You do not have permission to view Dispensing &amp; Tray.</div>;
        }
        return (
          <DispensingTrayView
            batches={state.batches}
            onAction={(action, batch) => handleAction(action, batch)}
            onSeedTestTray={(batch, fill) => { void handleSeedTestTray(batch, fill); }}
            seedingBmrNo={seedingBmrNo}
            inventory={whInventory}
          />
        );
      case 'material-reservation':
        if (!canViewBmr && !canViewBpr) {
          return <div className="p-8 text-sm text-ink-3">You do not have permission to view Material Reservation.</div>;
        }
        return (
          <MaterialReservationView
            batches={state.batches}
            outboundMrns={outboundMrns}
            inventoryRows={whInventory}
            stockRM={whStockRM}
            stockPM={whStockPM}
            reservedRM={whReservedRM}
            reservedPM={whReservedPM}
            onAction={handleAction}
            onRefresh={() => {
              refreshBatches();
              refreshInventory();
            }}
            onReserved={handleReserveRefresh}
          />
        );
      case 'yield-report':
        if (!canViewTransferYield) return <div className="p-8 text-sm text-ink-3">You do not have permission to view Yield Report.</div>;
        return (
          <YieldReportView
            batches={state.batches}
            onRequestReworkPreflight={(b) => setYieldReworkPreflightBatch(b)}
          />
        );
      case 'equipment':
        return <EquipmentView equipment={state.equipment} batches={state.batches} onUpdate={eq => setState(prev => ({ ...prev, equipment: eq }))} onRefresh={refreshEquipment} />;
      case 'team':
        return <TeamView team={state.team} onRefresh={refreshTeam} />;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink overflow-hidden">
      <TopHeader batches={state.batches} onMenuClick={() => setMobileSidebarOpen(true)} onSchedule={openScheduleWizard} />
      <div className="flex flex-1 overflow-hidden">
        <ProductionSidebar active={activeSection} onChange={setSection} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} navItems={visibleNavItems} />
        <main className="flex-1 overflow-hidden flex flex-col bg-surface">{renderContent()}</main>
      </div>

      {/* MODALS */}
      {batchActionLoading && (
        <BatchProcessLoader label={batchActionLoading.label} batchNo={batchActionLoading.bmrNo} />
      )}

      {modalBatch && modalType === 'confirm' && (
        <ConfirmBatchModal batch={modalBatch} equipment={state.equipment} team={state.team} onClose={closeModal} onSave={async (updates) => { await handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'adjustBatch' && (
        <AdjustBatchSizeModal batch={modalBatch} onClose={closeModal} onSave={async (updates) => { await handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'editBatch' && (
        <EditBatchModal batch={modalBatch} onClose={closeModal} onSave={async (updates) => { await handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'confirmSchedule' && (
        <ConfirmScheduleModal
          batch={modalBatch}
          equipment={state.equipment}
          batches={state.batches}
          team={state.team}
          onClose={closeModal}
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && modalType === 'reviewBmrBpr' && (
        <ReviewBmrBprModal
          batch={modalBatch}
          canApprove={canQaApprove}
          onClose={closeModal}
          onApproved={async () => {
            const fresh = await refreshProductionBatches();
            const updated = fresh.find((b) => b.bmrNo === modalBatch.bmrNo);
            if (updated) setModalBatch(updated);
            await queryClient.invalidateQueries({ queryKey: ['production-batches'] });
          }}
        />
      )}
      {modalBatch && modalType === 'initiateDispensing' && (
        <InitiateDispensingModal
          batch={modalBatch}
          team={state.team}
          onClose={closeModal}
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
        />
      )}
      {modalBatch && modalType === 'initiateProduction' && (
        <InitiateProductionModal
          batch={modalBatch}
          canApprove={canQaApprove}
          onClose={closeModal}
          onStart={async () => { await handleModalSave({ bmrStatus: 'in_production' }); closeModal(); }}
          onGateUpdated={(updated) => setModalBatch(updated)}
          onRefresh={async () => {
            const fresh = await refreshProductionBatches();
            const u = fresh.find((b) => b.bmrNo === modalBatch.bmrNo);
            if (u) setModalBatch(u);
          }}
        />
      )}
      {modalBatch && modalType === 'splitForVessel' && splitVesselCapLiters != null && (
        <SplitForVesselModal
          batch={modalBatch}
          vesselCapacityLiters={splitVesselCapLiters}
          onClose={closeModal}
          onComplete={async (_original, split) => {
            const batches = await refreshProductionBatches();
            const splitBatch = batches.find((b) => b.bmrNo === split.bmrNo) ?? split;
            setScheduleSlot(null);
            setModalBatch(splitBatch);
            setModalType('schedule');
          }}
        />
      )}
      {modalBatch && modalType === 'reserveRM' && (
        <ReserveMaterialModal
          batch={modalBatch}
          type="rm"
          stockMap={whStockRM}
          reservedMap={whReservedRM}
          inventoryRows={whInventory}
          onClose={closeModal}
          onReserved={handleReserveRefresh}
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
          onReserved={handleReserveRefresh}
        />
      )}
      {modalType === 'schedule' && scheduleSlot && (
        <SmartScheduleModal slot={scheduleSlot} batch={modalBatch} equipment={state.equipment} batches={state.batches} team={state.team}
          stockRM={whStockRM} stockPM={whStockPM} inventoryRows={whInventory} sentSummary={sentSummary}
          onClose={closeModal}
          onSave={async (updates) => {
            await handleModalSave(updates);
            closeModal();
            if (updates.mfgDate && activeSection === 'calendar') {
              const offset = getWeekOffsetForDate(updates.mfgDate);
              setWeekOffset(offset);
            }
          }}
          onBatchChange={bmrNo => { const b = state.batches.find(x => x.bmrNo === bmrNo); if (b) setModalBatch(b); }}
          onRequestVesselSplit={(b, vesselCap) => {
            setModalBatch(b);
            setSplitVesselCapLiters(vesselCap);
            setModalType('splitForVessel');
          }}
        />
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
              setSection('batches');
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
        <ScheduleModal batch={modalBatch} equipment={state.equipment} batches={state.batches} team={state.team}
          stockRM={whStockRM} stockPM={whStockPM} inventoryRows={whInventory} sentSummary={sentSummary}
          onClose={closeModal}
          onSave={async (updates) => {
            await handleModalSave(updates);
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
          scheduledMuZone={modalBatch.scheduledMuZone}
          atMuZoneByCode={atMuZoneForBatch(modalBatch, 'RM')}
          nameByCode={materialNameByCode}
          onClose={closeModal}
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
          onReschedule={canShowRescheduleFooterButton(modalBatch) ? () => { setScheduleSlot(null); setModalType('schedule'); } : undefined}
        />
      )}
      {modalBatch && modalType === 'dispensePM' && (
        <DispensingModal
          batch={modalBatch}
          type="pm"
          scheduledMuZone={modalBatch.scheduledMuZone}
          atMuZoneByCode={atMuZoneForBatch(modalBatch, 'PM')}
          nameByCode={materialNameByCode}
          onClose={closeModal}
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
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
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
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
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
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
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
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
          onSave={async (updates) => { await handleModalSave(updates); closeModal(); }}
          onMtrCreated={refreshOutboundMrns}
        />
      )}
      {modalBatch && modalType === 'detail' && (
        <BatchDetailModal batch={modalBatch} team={state.team} stockRM={whStockRM} stockPM={whStockPM} reservedRM={whReservedRM} reservedPM={whReservedPM} outboundMrns={outboundMrns} reservedItems={reservedItems} onClose={closeModal}
          onSave={async (updates) => { await handleModalSave(updates); }}
          onMrnUpdated={refreshAfterMrnSave}
          onAction={(action, batch, extra) => { closeModal(); if (extra?.mtrRmItems) setPendingMtrItems(extra.mtrRmItems); else if (extra?.mtrPmItems) setPendingMtrItems(extra.mtrPmItems); else setPendingMtrItems(null); setTimeout(() => handleAction(action, batch), 100); }} />
      )}
    </div>
  );
};

export default Production;
