/**
 * Production Page — Manufacturing Management System
 * BMR: draft > batch_confirmed > rm_reserved > scheduled > rm_connected > dispensing > in_production > bulk_qc > cleared
 * BPR: draft > pm_reserved > scheduled > pm_connected > pm_dispensing > filling > fill_qc > packaging > pack_qc > fg_ready
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import eiLogo from '../assets/logo/eilogofull.svg';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, FlaskConical, Package,
  Wrench, Users, Menu, X, Check, AlertTriangle, Printer,
  ClipboardList, Link2, Scale, Microscope, Zap, Info, Factory,
  Settings, Activity, Eye, CheckCircle2, ArrowRight, Send,
  ShieldCheck, Sparkles, Droplets, CircleDot, Layers, Cylinder,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

/* ─────────────────────────── TYPES ─────────────────────────── */

type Section = 'calendar' | 'bmr' | 'bpr' | 'equipment' | 'team';
type BMRStatus = 'draft' | 'batch_confirmed' | 'rm_reserved' | 'scheduled' | 'rm_connected' | 'dispensing' | 'in_production' | 'bulk_qc' | 'cleared';
type BPRStatus = 'draft' | 'pm_reserved' | 'scheduled' | 'pm_connected' | 'pm_dispensing' | 'filling' | 'fill_qc' | 'packaging' | 'pack_qc' | 'fg_ready';
type ProcessType = 'hot' | 'cold';
type FillingType = 'bottle' | 'tube' | 'jar' | 'manual';
type Department = 'Manufacturing' | 'Filling' | 'Packaging' | 'Quality';

interface DispensingItem { code: string; inci?: string; name?: string; required: number; dispensed: number; done: boolean; }
interface QCSpec { param: string; spec: string; result: string; passed: boolean | null; }

interface MfgEquipment { id: string; name: string; cap: number; type: 'jacketed' | 'simple' | 'support'; homogenizer: boolean; processType: ProcessType[]; status: string; }
interface FillingEquipment { id: string; name: string; speed: number; type: FillingType; compatible: string[]; status: string; }
interface PackagingEquipment { id: string; name: string; speed: number; type: string; supports: string[]; status: string; }

interface EquipmentData {
  manufacturing: MfgEquipment[];
  filling: FillingEquipment[];
  packaging: PackagingEquipment[];
}

interface TeamMember { id: string; name: string; role: string; dept: Department; avail: boolean; }

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
  qcSpecs: QCSpec[]; remarks: string; dueDate: string;
  compatibleVessels?: string[]; compatibleFillLines?: string[]; compatiblePackLines?: string[];
}

interface PipelineStep { key: string; label: string; icon: React.ReactNode; }

interface ProductionState {
  batches: Batch[];
  equipment: EquipmentData;
  team: TeamMember[];
  lastUpdated: string;
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
  { key: 'scheduled', label: 'Scheduled', icon: <Calendar size={PS} /> },
  { key: 'pm_connected', label: 'PM Connected', icon: <Link2 size={PS} /> },
  { key: 'pm_dispensing', label: 'PM Dispensing', icon: <Scale size={PS} /> },
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

const DEFAULT_TEAM: TeamMember[] = [
  { id: 'T01', name: 'Rahul Mehta', role: 'Production Lead', dept: 'Manufacturing', avail: true },
  { id: 'T02', name: 'Priya Sharma', role: 'Prod. Executive', dept: 'Manufacturing', avail: true },
  { id: 'T03', name: 'Kiran Das', role: 'Prod. Executive', dept: 'Manufacturing', avail: false },
  { id: 'T04', name: 'Amar Singh', role: 'Weighing Operator', dept: 'Manufacturing', avail: true },
  { id: 'T05', name: 'Neha Gupta', role: 'QC Officer', dept: 'Quality', avail: true },
  { id: 'T06', name: 'Ritu Patel', role: 'QC Officer', dept: 'Quality', avail: false },
  { id: 'T07', name: 'Dev Joshi', role: 'QC Executive', dept: 'Quality', avail: true },
  { id: 'T08', name: 'Sneha Roy', role: 'Filling Operator', dept: 'Filling', avail: true },
  { id: 'T09', name: 'Ajay Kumar', role: 'Filling Operator', dept: 'Filling', avail: true },
  { id: 'T10', name: 'Pooja Nair', role: 'Packing Crew Lead', dept: 'Packaging', avail: true },
  { id: 'T11', name: 'Suresh Babu', role: 'Packing Crew', dept: 'Packaging', avail: true },
  { id: 'T12', name: 'Meena Iyer', role: 'Packing Crew', dept: 'Packaging', avail: true },
];

const WH_STOCK_RM: Record<string, number> = {
  'RM-001': 600, 'RM-002': 200, 'RM-003': 80, 'RM-004': 120, 'RM-005': 300,
  'RM-006': 50, 'RM-007': 150, 'RM-008': 90, 'RM-009': 70, 'RM-010': 400,
};
const WH_STOCK_PM: Record<string, number> = {
  'PM-001': 50000, 'PM-002': 30000, 'PM-003': 20000, 'PM-004': 45000,
  'PM-005': 10000, 'PM-006': 25000, 'PM-007': 15000, 'PM-008': 5000,
};

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

function addDaysStr(dateStr: string, n: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

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

function pipelineIndex(status: string, pipeline: PipelineStep[]): number {
  return pipeline.findIndex(p => p.key === status);
}

function isEquipFreeOnDate(batches: Batch[], equipId: string, dateStr: string): boolean {
  return !batches.some(b => (b.mainVessel === equipId && b.mfgDate === dateStr) || (b.fillingLine === equipId && b.fillDate === dateStr) || (b.packagingLine === equipId && b.packDate === dateStr));
}

const batchColorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  teal:   { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  amber:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  blue:   { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  red:    { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const bmrStatusLabel: Record<BMRStatus, string> = {
  draft: 'Draft', batch_confirmed: 'Confirmed', rm_reserved: 'RM Reserved', scheduled: 'Scheduled',
  rm_connected: 'RM Connected', dispensing: 'Dispensing', in_production: 'In Production', bulk_qc: 'Bulk QC', cleared: 'Cleared',
};
const bprStatusLabel: Record<BPRStatus, string> = {
  draft: 'Draft', pm_reserved: 'PM Reserved', scheduled: 'Scheduled', pm_connected: 'PM Connected',
  pm_dispensing: 'PM Dispensing', filling: 'Filling', fill_qc: 'Fill QC', packaging: 'Packaging', pack_qc: 'Pack QC', fg_ready: 'FG Ready',
};

/* ──────────────────── LOCALSTORAGE ─────────────────────────── */

const LS_KEY = 'eiadmin.production.state.v3';

function loadState(): ProductionState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as ProductionState;
      if (p?.batches && p?.equipment && p?.team) return p;
    }
  } catch { /* ignore */ }
  return { batches: makeDefaultBatches(), equipment: DEFAULT_EQUIPMENT, team: DEFAULT_TEAM, lastUpdated: new Date().toISOString() };
}

function persistState(s: ProductionState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...s, lastUpdated: new Date().toISOString() })); } catch { /* ignore */ }
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

function PipelineStrip({ pipeline, currentStatus }: { pipeline: PipelineStep[]; currentStatus: string }) {
  const idx = pipelineIndex(currentStatus, pipeline);
  return (
    <div className="flex items-center gap-0.5">
      {pipeline.map((p, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        return (
          <div key={p.key} className="flex items-center gap-0.5">
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border ${
              state === 'done' ? 'bg-emerald-100 border-emerald-300 text-emerald-600' :
              state === 'active' ? 'bg-orange-100 border-orange-300 text-orange-600' :
              'bg-gray-50 border-gray-200 text-gray-300'
            }`} title={p.label}>
              {state === 'done' ? <Check size={10} strokeWidth={3} /> : state === 'active' ? p.icon : <CircleDot size={8} />}
            </div>
            {i < pipeline.length - 1 && <div className={`w-2.5 h-px ${i < idx ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
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
    onSave({ ...form, bmrStatus: 'batch_confirmed' as BMRStatus });
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
          <Tip color="teal" icon={<Info size={14} />}>Process: <b>{form.processType.toUpperCase()}</b> - Batch: <b>{form.batchSize} KG</b> - Homogenizer: <b>{form.homogenizer ? 'Required' : 'Not Required'}</b></Tip>
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

/* ─────────── SECTION LABEL (shared subheading) ─────────────── */

function SectionLabel({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <h4 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2.5 ${color}`}>
      {icon}{children}
    </h4>
  );
}

/* ──────────── RESERVE MATERIAL MODAL ───────────────────────── */

function ReserveMaterialModal({ batch, type, onClose, onSave }: {
  batch: Batch; type: 'rm' | 'pm'; onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const items = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const stock = type === 'rm' ? WH_STOCK_RM : WH_STOCK_PM;
  const unit = type === 'rm' ? 'KG' : 'pcs';

  const handleSave = () => {
    if (type === 'rm') {
      onSave({ rmReserved: true, bmrStatus: batch.bmrStatus === 'batch_confirmed' ? 'rm_reserved' : batch.bmrStatus });
    } else {
      onSave({ pmReserved: true });
    }
    onClose();
  };

  return (
    <Modal onClose={onClose} title={`Reserve ${type.toUpperCase()} - ${type === 'rm' ? batch.bmrNo : batch.bprNo}`} size="lg">
      <Tip color="amber" icon={<Package size={14} />}>Select {type.toUpperCase()} items to reserve in Warehouse against <b>{type === 'rm' ? batch.bmrNo : batch.bprNo}</b>.</Tip>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50/80 border-b border-gray-100">
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Item</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Required</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">WH SIH</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((r, i) => {
              const sih = stock[r.code] || 0;
              const ok = sih >= r.required;
              return (
                <tr key={i} className={!ok ? 'bg-red-50/50' : ''}>
                  <td className="px-3 py-2.5"><div className="font-semibold text-gray-800">{r.inci || r.name}</div><div className="text-gray-400">{r.code}</div></td>
                  <td className="px-3 py-2.5 font-mono font-semibold">{fmt(r.required)} {unit}</td>
                  <td className={`px-3 py-2.5 font-mono font-semibold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)} {unit}</td>
                  <td className="px-3 py-2.5">{ok ? <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> Available</Badge> : <Badge className="bg-red-100 text-red-600"><AlertTriangle size={10} /> Short {fmt(r.required - sih)} {unit}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><Package size={13} /> Reserve {type.toUpperCase()}</button>
      </div>
    </Modal>
  );
}

/* ──────────── SMART SCHEDULE MODAL ─────────────────────────── */

function ScheduleModal({ batch, equipment, batches, onClose, onSave }: {
  batch: Batch; equipment: EquipmentData; batches: Batch[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const compatV = batch.compatibleVessels?.length ? batch.compatibleVessels : equipment.manufacturing.filter(e => e.type !== 'support' && e.cap >= batch.batchSize).map(e => e.id);
  const compatF = batch.compatibleFillLines?.length ? batch.compatibleFillLines : equipment.filling.filter(e => e.compatible.includes(batch.fillingType || 'bottle')).map(e => e.id);
  const compatP = batch.compatiblePackLines?.length ? batch.compatiblePackLines : equipment.packaging.map(e => e.id);

  const [mfgDate, setMfgDate] = useState(batch.mfgDate || today());
  const [fillDate, setFillDate] = useState(batch.fillDate || addDaysStr(batch.mfgDate || today(), 3));
  const [packDate, setPackDate] = useState(batch.packDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), 1));
  const [fgDate, setFgDate] = useState(batch.fgDate || addDaysStr(batch.packDate || addDaysStr(today(), 4), 1));
  const [rmDate, setRmDate] = useState(batch.rmConnectDate || addDaysStr(batch.mfgDate || today(), -2));
  const [pmDate, setPmDate] = useState(batch.pmConnectDate || addDaysStr(batch.fillDate || addDaysStr(today(), 3), -2));
  const [vessel, setVessel] = useState(batch.mainVessel || compatV[0] || '');
  const [fillLine, setFillLine] = useState(batch.fillingLine || compatF[0] || '');
  const [packLine, setPackLine] = useState(batch.packagingLine || compatP[0] || '');

  const handleMfgChange = (val: string) => {
    setMfgDate(val);
    setRmDate(addDaysStr(val, -2));
    const f = addDaysStr(val, 3); setFillDate(f); setPmDate(addDaysStr(f, -2));
    const p = addDaysStr(f, 1); setPackDate(p); setFgDate(addDaysStr(p, 1));
  };

  const handleSave = () => {
    if (!mfgDate) return;
    onSave({
      mfgDate, fillDate, packDate, fgDate, rmConnectDate: rmDate, pmConnectDate: pmDate,
      mainVessel: vessel, fillingLine: fillLine, packagingLine: packLine,
      bmrStatus: (batch.bmrStatus === 'batch_confirmed' || batch.bmrStatus === 'rm_reserved') ? 'scheduled' : batch.bmrStatus,
    });
    onClose();
  };

  const ScheduleRow = ({ icon, label, color, dateVal, setDate, equipList, equipVal, setEquip }: {
    icon: React.ReactNode; label: string; color: string;
    dateVal: string; setDate: (v: string) => void; equipList: string[]; equipVal: string; setEquip: (v: string) => void;
  }) => (
    <div className={`grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-3 rounded-xl border mb-2 ${color}`}>
      <span className="text-gray-500">{icon}</span>
      <div className="text-[11px] font-bold text-gray-700">{label}</div>
      <div><label className={LBL}>Date</label><input type="date" className={INP} value={dateVal} onChange={e => setDate(e.target.value)} /></div>
      <div><label className={LBL}>Equipment</label>
        <select className={INP} value={equipVal} onChange={e => setEquip(e.target.value)}>
          {equipList.map(id => {
            const free = isEquipFreeOnDate(batches, id, dateVal);
            return <option key={id} value={id}>{id} {free ? 'Free' : 'Busy'}</option>;
          })}
        </select>
      </div>
    </div>
  );

  return (
    <Modal onClose={onClose} title={`Schedule - ${batch.bmrNo}`} subtitle={`${batch.productName} - Batch ${batch.batchIndex}/${batch.totalBatches} - ${batch.batchSize} KG`} size="xl">
      {/* Material Availability */}
      <div className="mb-5">
        <SectionLabel icon={<Package size={13} />} color="text-orange-600">Material Availability - Main Warehouse</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel icon={<FlaskConical size={12} />} color="text-teal-600">Raw Materials</SectionLabel>
            <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
              <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">RM</th><th className="px-2 py-1.5 text-left">Req</th><th className="px-2 py-1.5 text-left">SIH</th><th className="px-2 py-1.5 text-left">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{batch.dispensingRM.map((r, i) => {
                  const sih = WH_STOCK_RM[r.code] || 0; const ok = sih >= r.required;
                  return <tr key={i} className={!ok ? 'bg-red-50/50' : ''}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 font-mono">{r.required}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-emerald-100 text-emerald-700">OK</Badge> : <Badge className="bg-red-100 text-red-600">Short</Badge>}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
          <div>
            <SectionLabel icon={<Package size={12} />} color="text-purple-600">Packaging Materials</SectionLabel>
            <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
              <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">PM</th><th className="px-2 py-1.5 text-left">Req</th><th className="px-2 py-1.5 text-left">SIH</th><th className="px-2 py-1.5 text-left">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{batch.dispensingPM.map((p, i) => {
                  const sih = WH_STOCK_PM[p.code] || 0; const ok = sih >= p.required;
                  return <tr key={i} className={!ok ? 'bg-red-50/50' : ''}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 font-mono">{fmt(p.required)}</td><td className={`px-2 py-1.5 font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td><td className="px-2 py-1.5">{ok ? <Badge className="bg-emerald-100 text-emerald-700">OK</Badge> : <Badge className="bg-red-100 text-red-600">Short</Badge>}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Sequential Schedule */}
      <div className="border border-orange-100 rounded-2xl p-5 bg-orange-50/20">
        <SectionLabel icon={<Calendar size={13} />} color="text-orange-600">Sequential Schedule - Manufacturing ? Filling ? Packaging</SectionLabel>
        <Tip color="teal" icon={<Sparkles size={14} />}>System auto-suggested dates based on equipment availability. Adjust if needed.</Tip>

        <ScheduleRow icon={<FlaskConical size={16} />} label="STAGE 1 - Manufacturing" color="border-teal-200 bg-teal-50/40" dateVal={mfgDate} setDate={handleMfgChange} equipList={compatV} equipVal={vessel} setEquip={setVessel} />

        <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-gray-100 bg-gray-50/50 mb-2">
          <Package size={14} className="text-gray-400" /><div className="text-[10px] text-gray-500 font-semibold">RM Ready at WH by</div>
          <div><input type="date" className={INP} value={rmDate} onChange={e => setRmDate(e.target.value)} /></div>
          <div className="text-[10px] text-gray-400">Suggest: 2 days before MFG</div>
        </div>

        <ScheduleRow icon={<Droplets size={16} />} label="STAGE 2 - Filling" color="border-purple-200 bg-purple-50/40" dateVal={fillDate} setDate={setFillDate} equipList={compatF} equipVal={fillLine} setEquip={setFillLine} />

        <div className="ml-8 grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center px-4 py-2 rounded-xl border border-gray-100 bg-gray-50/50 mb-2">
          <Package size={14} className="text-gray-400" /><div className="text-[10px] text-gray-500 font-semibold">PM Ready at WH by</div>
          <div><input type="date" className={INP} value={pmDate} onChange={e => setPmDate(e.target.value)} /></div>
          <div className="text-[10px] text-gray-400">Suggest: 2 days before Fill</div>
        </div>

        <ScheduleRow icon={<Package size={16} />} label="STAGE 3 - Packaging" color="border-emerald-200 bg-emerald-50/40" dateVal={packDate} setDate={setPackDate} equipList={compatP} equipVal={packLine} setEquip={setPackLine} />

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

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><CheckCircle2 size={13} /> Save Schedule</button>
      </div>
    </Modal>
  );
}

/* ──────────── DISPENSING MODAL ──────────────────────────────── */

function DispensingModal({ batch, type, onClose, onSave }: {
  batch: Batch; type: 'rm' | 'pm'; onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const items = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const [localItems, setLocalItems] = useState(items.map(i => ({ ...i })));
  const [inputVals, setInputVals] = useState<Record<number, string>>({});
  const done = localItems.filter(r => r.done).length;
  const total = localItems.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const unit = type === 'rm' ? 'KG' : 'pcs';

  const handleDispense = (idx: number) => {
    const val = parseFloat(inputVals[idx] || '') || localItems[idx].required;
    setLocalItems(prev => prev.map((it, i) => i === idx ? { ...it, done: true, dispensed: val } : it));
  };

  const handleComplete = () => {
    if (!localItems.every(r => r.done)) return;
    if (type === 'rm') onSave({ dispensingRM: localItems, bmrStatus: 'in_production' });
    else onSave({ dispensingPM: localItems, bprStatus: 'filling' });
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
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Progress</span><span className="font-mono font-bold text-emerald-600">{done}/{total} ({pct}%)</span></div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="space-y-2">
        {localItems.map((r, idx) => (
          <div key={idx} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${r.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.done ? 'bg-emerald-100 border border-emerald-300 text-emerald-600' : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>
              {r.done ? <Check size={12} strokeWidth={3} /> : idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800">{r.inci || r.name}</div>
              <div className="text-[10px] text-gray-400">{r.code} - Target: <b>{type === 'rm' ? r.required + ' KG' : fmt(r.required) + ' pcs'}</b></div>
            </div>
            {r.done ? (
              <div className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 font-semibold"><Check size={12} /> {r.dispensed} {unit}</div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" placeholder={String(r.required)} value={inputVals[idx] || ''}
                  onChange={e => setInputVals(prev => ({ ...prev, [idx]: e.target.value }))}
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-300 focus:outline-none" />
                <button onClick={() => handleDispense(idx)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors"><Check size={10} /> Done</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSaveProgress} className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Save Progress</button>
        {localItems.every(r => r.done) && (
          <button onClick={handleComplete} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><CheckCircle2 size={13} /> Complete Dispensing</button>
        )}
      </div>
    </Modal>
  );
}

/* ──────────── QC MODAL ─────────────────────────────────────── */

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

function QCModal({ batch, qcType, team, onClose, onSave }: {
  batch: Batch; qcType: 'bmr' | 'fill' | 'pack'; team: TeamMember[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const initialSpecs = batch.qcSpecs.length > 0 ? batch.qcSpecs : (DEFAULT_QC_SPECS[qcType] || []);
  const [specs, setSpecs] = useState(initialSpecs.map(s => ({ ...s })));
  const [yieldVal, setYieldVal] = useState('');
  const [remarks, setRemarks] = useState('');
  const titles: Record<string, string> = { bmr: 'Bulk QC Review', fill: 'Filling QC Review', pack: 'Packaging QC Review' };
  const yieldLabels: Record<string, string> = { bmr: 'Bulk Yield (KG)', fill: 'Units Filled', pack: 'Units Packed' };
  const qcOfficer = team.find(t => t.id === (qcType === 'bmr' ? batch.qcOfficerBMR : batch.qcOfficerBPR));

  const handleApprove = () => {
    const upd: Partial<Batch> = { qcSpecs: specs, remarks };
    if (qcType === 'bmr') {
      upd.bulkYield = parseFloat(yieldVal) || null; upd.bulkBatchAccepted = true;
      upd.bmrStatus = 'cleared'; upd.bprStatus = batch.bprStatus === 'draft' ? 'pm_reserved' : batch.bprStatus;
    } else if (qcType === 'fill') {
      upd.fillYield = parseInt(yieldVal) || null; upd.fillBatchAccepted = true; upd.bprStatus = 'packaging';
    } else {
      upd.fgYield = parseInt(yieldVal) || null; upd.fgBatchAccepted = true; upd.bprStatus = 'fg_ready';
    }
    onSave(upd); onClose();
  };

  const handleReject = () => {
    onSave({ qcSpecs: specs, remarks: remarks || 'Rejected - deviation raised' }); onClose();
  };

  return (
    <Modal onClose={onClose} title={`${titles[qcType]} - ${qcType === 'bmr' ? batch.bmrNo : batch.bprNo}`} size="lg">
      <Tip color="blue" icon={<Microscope size={14} />}>QC Officer: <b>{qcOfficer?.name || '-'}</b> reviewing <b>{qcType === 'bmr' ? batch.bmrNo : batch.bprNo}</b></Tip>
      <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <div>Parameter</div><div>Specification</div><div>Result</div><div>Pass/Fail</div>
        </div>
        {specs.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2.5 border-b border-gray-50 items-center">
            <div className="text-xs font-semibold text-gray-800">{s.param}</div>
            <div className="text-xs text-gray-500 font-mono">{s.spec}</div>
            <input className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={s.result} placeholder="Enter result..."
              onChange={e => setSpecs(prev => prev.map((sp, j) => j === i ? { ...sp, result: e.target.value } : sp))} />
            <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={s.passed === true ? 'pass' : s.passed === false ? 'fail' : ''}
              onChange={e => setSpecs(prev => prev.map((sp, j) => j === i ? { ...sp, passed: e.target.value === 'pass' ? true : e.target.value === 'fail' ? false : null } : sp))}>
              <option value="">-</option><option value="pass">Pass</option><option value="fail">Fail</option>
            </select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LBL}>{yieldLabels[qcType]}</label><input className={INP} type="number" placeholder="Enter actual quantity" value={yieldVal} onChange={e => setYieldVal(e.target.value)} /></div>
        <div><label className={LBL}>QC Remarks</label><input className={INP} placeholder="Overall remarks..." value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleReject} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"><X size={12} /> Reject</button>
        <button onClick={handleApprove} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><ShieldCheck size={13} /> Approve</button>
      </div>
    </Modal>
  );
}

/* ──────────── MTR MODAL ────────────────────────────────────── */

function MTRModal({ batch, type, onClose, onSave }: {
  batch: Batch; type: 'rm' | 'pm'; onClose: () => void; onSave: (updates: Partial<Batch>) => void;
}) {
  const items = type === 'rm' ? batch.dispensingRM : batch.dispensingPM;
  const unit = type === 'rm' ? 'KG' : 'pcs';
  const [priority, setPriority] = useState('Normal');
  const [reqDate, setReqDate] = useState(type === 'rm' ? (batch.rmConnectDate || today()) : (batch.pmConnectDate || today()));

  const handleSubmit = () => {
    if (type === 'rm') onSave({ rmConnected: true, bmrStatus: (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') ? 'rm_connected' : batch.bmrStatus });
    else onSave({ pmConnected: true, bprStatus: batch.bprStatus === 'pm_reserved' ? 'pm_connected' : batch.bprStatus });
    onClose();
  };

  return (
    <Modal onClose={onClose} title={`Material Transfer Request - ${type === 'rm' ? batch.bmrNo : batch.bprNo}`}>
      <Tip color="orange" icon={<Send size={14} />}>Request Warehouse to transfer {type.toUpperCase()} to <b>{type === 'rm' ? batch.mainVessel + ' area' : 'Filling area'}</b></Tip>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className={LBL}>Transfer From</label><input className={INP} defaultValue="Main Warehouse - Zone A" readOnly /></div>
        <div><label className={LBL}>Transfer To</label><input className={INP} defaultValue={type === 'rm' ? `${batch.mainVessel} - Manufacturing Area` : `Filling Area - ${batch.fillingLine}`} readOnly /></div>
        <div><label className={LBL}>Required By Date</label><input type="date" className={INP} value={reqDate} onChange={e => setReqDate(e.target.value)} /></div>
        <div><label className={LBL}>Priority</label><select className={INP} value={priority} onChange={e => setPriority(e.target.value)}><option>Urgent</option><option>Normal</option><option>Low</option></select></div>
      </div>
      <SectionLabel icon={<Package size={12} />} color="text-gray-600">Items to Transfer</SectionLabel>
      <div className="overflow-x-auto rounded-xl border border-gray-100 text-xs">
        <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">Item</th><th className="px-2 py-1.5 text-left">Code</th><th className="px-2 py-1.5 text-left">Qty</th><th className="px-2 py-1.5 text-left">Unit</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{items.map((r, i) => (
            <tr key={i}><td className="px-2 py-1.5 font-semibold">{r.inci || r.name}</td><td className="px-2 py-1.5 text-gray-500 font-mono">{r.code}</td><td className="px-2 py-1.5 font-mono">{type === 'rm' ? r.required : fmt(r.required)}</td><td className="px-2 py-1.5">{unit}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
        <button onClick={handleSubmit} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><Send size={13} /> Send MTR</button>
      </div>
    </Modal>
  );
}

/* ──────────── BATCH DETAIL MODAL — 6 tabs ──────────────────── */

function BatchDetailModal({ batch, team, onClose, onSave, onAction }: {
  batch: Batch; team: TeamMember[];
  onClose: () => void; onSave: (updates: Partial<Batch>) => void;
  onAction: (action: string, batch: Batch) => void;
}) {
  const [tab, setTab] = useState('overview');
  const [type, setType] = useState<'bmr' | 'bpr'>('bmr');
  const pipeline = type === 'bmr' ? BMR_PIPELINE : BPR_PIPELINE;
  const curStatus = type === 'bmr' ? batch.bmrStatus : batch.bprStatus;
  const pIdx = pipelineIndex(curStatus, pipeline);

  return (
    <Modal onClose={onClose} title={`${batch.bmrNo} - ${batch.productName}`}
      subtitle={`Batch ${batch.batchIndex}/${batch.totalBatches} - ${batch.batchSize} KG - SO: ${batch.soNo}`} size="xl">

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setType('bmr')} className={`text-[10px] px-3 py-1 rounded-lg font-semibold border transition-colors ${type === 'bmr' ? 'bg-orange-500 text-white border-orange-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>BMR Pipeline</button>
        <button onClick={() => setType('bpr')} className={`text-[10px] px-3 py-1 rounded-lg font-semibold border transition-colors ${type === 'bpr' ? 'bg-purple-500 text-white border-purple-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>BPR Pipeline</button>
        <div className="ml-2"><PipelineStrip pipeline={pipeline} currentStatus={curStatus} /></div>
        <Badge className={`ml-auto ${type === 'bmr' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{type === 'bmr' ? bmrStatusLabel[batch.bmrStatus] : bprStatusLabel[batch.bprStatus]}</Badge>
      </div>

      <TabBar tabs={[
        { key: 'overview', label: 'Overview', icon: <Layers size={12} /> },
        { key: 'rmpm', label: 'RM & PM', icon: <Package size={12} /> },
        { key: 'schedule', label: 'Schedule', icon: <Calendar size={12} /> },
        { key: 'dispensing', label: 'Dispensing', icon: <Scale size={12} /> },
        { key: 'qc', label: 'QC', icon: <Microscope size={12} /> },
        { key: 'stepper', label: 'Stage Tracker', icon: <Activity size={12} /> },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3.5">
          {([
            ['BMR No', batch.bmrNo], ['BPR No', batch.bprNo], ['Product', batch.productName],
            ['SKU', batch.sku], ['SO No', batch.soNo], ['Order Qty', fmt(batch.orderQty)],
            ['Batch Size', `${batch.batchSize} KG`], ['Process', batch.processType.toUpperCase()], ['Homogenizer', batch.homogenizer ? 'Yes' : 'No'],
            ['Main Vessel', batch.mainVessel || '-'], ['Support Tanks', batch.supportingTanks.join(', ') || '-'],
            ['Filling Line', batch.fillingLine || '-'], ['Filling Type', batch.fillingType.toUpperCase()],
            ['Packaging Line', batch.packagingLine || '-'], ['Monocarton', batch.monocarton ? 'Yes' : 'No'],
            ['BMR Status', bmrStatusLabel[batch.bmrStatus]], ['BPR Status', bprStatusLabel[batch.bprStatus]],
            ['Due Date', batch.dueDate || '-'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}><div className="text-[10px] text-gray-400 font-medium">{k}</div><div className="text-sm font-semibold text-gray-800">{v}</div></div>
          ))}
        </div>
      )}

      {tab === 'rmpm' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SectionLabel icon={<FlaskConical size={12} />} color="text-teal-600">Raw Materials</SectionLabel>
              {batch.rmReserved && <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> Reserved</Badge>}
            </div>
            <div className="rounded-xl border border-gray-100 text-xs overflow-hidden">
              <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">RM</th><th className="px-2 py-1.5">Req</th><th className="px-2 py-1.5">SIH</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{batch.dispensingRM.map((r, i) => {
                  const sih = WH_STOCK_RM[r.code] || 0; const ok = sih >= r.required;
                  return <tr key={i}><td className="px-2 py-1.5 font-semibold">{r.inci || r.code}</td><td className="px-2 py-1.5 text-center font-mono">{r.required}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SectionLabel icon={<Package size={12} />} color="text-purple-600">Packaging Materials</SectionLabel>
              {batch.pmReserved && <Badge className="bg-emerald-100 text-emerald-700"><Check size={10} /> Reserved</Badge>}
            </div>
            <div className="rounded-xl border border-gray-100 text-xs overflow-hidden">
              <table className="w-full"><thead><tr className="bg-gray-50/80 border-b border-gray-100"><th className="px-2 py-1.5 text-left font-semibold text-gray-500">PM</th><th className="px-2 py-1.5">Req</th><th className="px-2 py-1.5">SIH</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{batch.dispensingPM.map((p, i) => {
                  const sih = WH_STOCK_PM[p.code] || 0; const ok = sih >= p.required;
                  return <tr key={i}><td className="px-2 py-1.5 font-semibold">{p.name || p.code}</td><td className="px-2 py-1.5 text-center font-mono">{fmt(p.required)}</td><td className={`px-2 py-1.5 text-center font-mono ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(sih)}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {([['Mfg Date', batch.mfgDate], ['Fill Date', batch.fillDate], ['Pack Date', batch.packDate],
            ['FG Date', batch.fgDate], ['RM Connect', batch.rmConnectDate], ['PM Connect', batch.pmConnectDate],
            ['Main Vessel', batch.mainVessel], ['Filling Line', batch.fillingLine], ['Packaging Line', batch.packagingLine],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}><div className="text-[10px] text-gray-400 font-medium">{k}</div><div className="text-sm font-semibold text-gray-800">{v || '-'}</div></div>
          ))}
        </div>
      )}

      {tab === 'dispensing' && (
        <div className="space-y-5">
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
          {batch.qcSpecs.length > 0 ? (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <div>Parameter</div><div>Specification</div><div>Result</div><div>Pass/Fail</div>
              </div>
              {batch.qcSpecs.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 border-b border-gray-50 items-center text-xs">
                  <div className="font-semibold">{s.param}</div>
                  <div className="text-gray-500 font-mono">{s.spec}</div>
                  <div className="font-mono">{s.result || '-'}</div>
                  <div>{s.passed === true ? <Badge className="bg-emerald-100 text-emerald-700">Pass</Badge> : s.passed === false ? <Badge className="bg-red-100 text-red-600">Fail</Badge> : <span className="text-gray-400">-</span>}</div>
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
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 ${
                    state === 'done' ? 'bg-emerald-100 border-emerald-400 text-emerald-600' :
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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Close</button>
        {batch.bmrStatus === 'draft' && <Btn color="orange" icon={<Zap size={12} />} onClick={() => { onClose(); onAction('confirm', batch); }}>Confirm Batch</Btn>}
        {batch.bmrStatus === 'batch_confirmed' && !batch.rmReserved && <Btn color="amber" icon={<Package size={12} />} onClick={() => { onClose(); onAction('reserveRM', batch); }}>Reserve RM</Btn>}
        {batch.bmrStatus === 'batch_confirmed' && batch.rmReserved && <Btn color="teal" icon={<Calendar size={12} />} onClick={() => { onClose(); onAction('schedule', batch); }}>Set Schedule</Btn>}
        {(batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled') && !batch.rmConnected && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrRM', batch); }}>RM Transfer</Btn>}
        {batch.rmConnected && batch.bmrStatus === 'rm_connected' && <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispenseRM', batch); }}>Start RM Dispensing</Btn>}
        {batch.bmrStatus === 'in_production' && <Btn color="amber" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcBMR', batch); }}>Submit to Bulk QC</Btn>}
        {batch.bprStatus === 'pm_reserved' && !batch.pmConnected && <Btn color="teal" icon={<Send size={12} />} onClick={() => { onClose(); onAction('mtrPM', batch); }}>PM Transfer</Btn>}
        {batch.pmConnected && (batch.bprStatus === 'pm_connected' || batch.bprStatus === 'pm_reserved') && <Btn color="purple" icon={<Scale size={12} />} onClick={() => { onClose(); onAction('dispensePM', batch); }}>PM Dispensing</Btn>}
        {batch.bprStatus === 'filling' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcFill', batch); }}>Fill QC</Btn>}
        {batch.bprStatus === 'packaging' && <Btn color="blue" icon={<Microscope size={12} />} onClick={() => { onClose(); onAction('qcPack', batch); }}>Pack QC</Btn>}
        <button onClick={() => { /* print stub */ }} className="inline-flex items-center gap-1 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 ml-auto transition-colors"><Printer size={12} />Print</button>
      </div>
    </Modal>
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

/* ──────────── BMR VIEW ─────────────────────────────────────── */

function BMRView({ batches, onAction }: {
  batches: Batch[];
  onAction: (action: string, batch: Batch) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? batches : batches.filter(b => b.bmrStatus === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div><h1 className="text-lg font-bold text-gray-900 tracking-tight">BMR - Manufacturing</h1><p className="text-[11px] text-gray-400 mt-0.5">Batch Manufacturing Records - Pipeline Management</p></div>
        <div className="flex gap-1 flex-wrap">
          {[{ k: 'all', l: 'All' }, ...BMR_PIPELINE.map(p => ({ k: p.key, l: p.label }))].map(s => (
            <button key={s.k} onClick={() => setFilter(s.k)} className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${filter === s.k ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{s.l}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FlaskConical size={32} className="mb-2 opacity-20" /><p className="text-sm">No batches match this filter</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(b => {
              const colors = batchColorMap[b.color] || batchColorMap.teal;
              return (
                <div key={b.bmrNo} className={`rounded-xl border p-4 ${colors.bg} ${colors.border} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onAction('detail', b)}>
                  <div className="mb-3"><PipelineStrip pipeline={BMR_PIPELINE} currentStatus={b.bmrStatus} /></div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{b.bmrNo}</div>
                      <div className="text-xs text-gray-600 font-medium">{b.productName}</div>
                    </div>
                    <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>{bmrStatusLabel[b.bmrStatus]}</Badge>
                  </div>
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
                    {b.bmrStatus === 'batch_confirmed' && !b.rmReserved && <Btn color="amber" icon={<Package size={11} />} onClick={() => onAction('reserveRM', b)}>Reserve RM</Btn>}
                    {b.bmrStatus === 'batch_confirmed' && b.rmReserved && <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Schedule</Btn>}
                    {b.bmrStatus === 'rm_reserved' && <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>Schedule</Btn>}
                    {b.bmrStatus === 'scheduled' && !b.rmConnected && <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrRM', b)}>RM Transfer</Btn>}
                    {b.bmrStatus === 'rm_connected' && <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispenseRM', b)}>Dispense</Btn>}
                    {b.bmrStatus === 'in_production' && <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>Bulk QC</Btn>}
                    {b.bmrStatus === 'bulk_qc' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>Review QC</Btn>}
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

function BPRView({ batches, onAction }: {
  batches: Batch[];
  onAction: (action: string, batch: Batch) => void;
}) {
  const bprBatches = batches.filter(b => b.bprStatus !== 'draft' || b.bmrStatus === 'cleared');
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? bprBatches : bprBatches.filter(b => b.bprStatus === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div><h1 className="text-lg font-bold text-gray-900 tracking-tight">BPR - Filling & Packing</h1><p className="text-[11px] text-gray-400 mt-0.5">Batch Packing Records - Filling, QC & Packaging pipeline</p></div>
        <div className="flex gap-1 flex-wrap">
          {[{ k: 'all', l: 'All' }, ...BPR_PIPELINE.filter(p => p.key !== 'draft').map(p => ({ k: p.key, l: p.label }))].map(s => (
            <button key={s.k} onClick={() => setFilter(s.k)} className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${filter === s.k ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{s.l}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400"><Package size={32} className="mb-2 opacity-20" /><p className="text-sm">No BPR records match. Batches appear here after BMR clearance.</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(b => {
              const colors = batchColorMap[b.color] || batchColorMap.purple;
              return (
                <div key={b.bprNo} className={`rounded-xl border p-4 ${colors.bg} ${colors.border} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onAction('detail', b)}>
                  <div className="mb-3"><PipelineStrip pipeline={BPR_PIPELINE} currentStatus={b.bprStatus} /></div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{b.bprNo}</div>
                      <div className="text-xs text-gray-600 font-medium">{b.productName}</div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700 border border-purple-200">{bprStatusLabel[b.bprStatus]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                    <div><span className="text-gray-400">Batch:</span> <b>{b.batchNo}</b></div>
                    <div><span className="text-gray-400">Fill Line:</span> <b>{b.fillingLine || '-'}</b></div>
                    <div><span className="text-gray-400">Fill Type:</span> <b>{b.fillingType.toUpperCase()}</b></div>
                    <div><span className="text-gray-400">Pack Line:</span> <b>{b.packagingLine || '-'}</b></div>
                    <div><span className="text-gray-400">Fill:</span> <b>{b.fillDate || '-'}</b></div>
                    <div><span className="text-gray-400">Pack:</span> <b>{b.packDate || '-'}</b></div>
                    <div><span className="text-gray-400">PM:</span> <b className="inline-flex items-center gap-0.5">{b.pmReserved ? <><Check size={10} className="text-emerald-600" /></> : '-'}</b></div>
                    <div><span className="text-gray-400">FG:</span> <b>{b.fgDate || '-'}</b></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                    {b.bprStatus === 'pm_reserved' && !b.pmConnected && <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrPM', b)}>PM Transfer</Btn>}
                    {b.pmConnected && (b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_reserved') && <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispensePM', b)}>PM Dispense</Btn>}
                    {b.bprStatus === 'filling' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcFill', b)}>Fill QC</Btn>}
                    {b.bprStatus === 'packaging' && <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcPack', b)}>Pack QC</Btn>}
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

/* ──────────── CALENDAR VIEW ────────────────────────────────── */

function CalendarView({ batches, equipment, onBatchClick, onSchedule, weekOffset, onWeekOffsetChange }: {
  batches: Batch[]; equipment: EquipmentData;
  onBatchClick: (b: Batch) => void; onSchedule: () => void;
  weekOffset: number; onWeekOffsetChange: (n: number) => void;
}) {
  const monday = useMemo(() => addDays(getWeekStart(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => buildWeekDays(monday), [monday]);
  const weekLabel = formatWeekLabel(monday);
  const todayStr = isoDate(new Date());
  const todayIndex = weekDays.findIndex(d => d.iso === todayStr);

  const active = batches.filter(b => b.bmrStatus === 'in_production' || b.bmrStatus === 'dispensing').length;
  const pending = batches.filter(b => b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed').length;
  const awaitingQC = batches.filter(b => b.bmrStatus === 'bulk_qc').length;
  const fgReady = batches.filter(b => b.bprStatus === 'fg_ready').length;

  const allEquip = [
    ...equipment.manufacturing.filter(e => e.type !== 'support').map(e => ({ ...e, _cat: 'mfg' as const })),
    ...equipment.filling.map(e => ({ ...e, _cat: 'fill' as const })),
    ...equipment.packaging.map(e => ({ ...e, _cat: 'pack' as const })),
  ];

  function getBatch(equipId: string, dayIso: string, cat: string): Batch | undefined {
    if (cat === 'mfg') return batches.find(b => b.mainVessel === equipId && b.mfgDate === dayIso);
    if (cat === 'fill') return batches.find(b => b.fillingLine === equipId && b.fillDate === dayIso);
    if (cat === 'pack') return batches.find(b => b.packagingLine === equipId && b.packDate === dayIso);
    return undefined;
  }

  const catColors = { mfg: 'bg-teal-500', fill: 'bg-purple-500', pack: 'bg-emerald-500' };
  const catLabels = { mfg: 'Manufacturing Vessels', fill: 'Filling Lines', pack: 'Packaging Lines' };
  const catIcons = { mfg: <FlaskConical size={12} />, fill: <Droplets size={12} />, pack: <Package size={12} /> };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Production Calendar</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Vessel & Line wise scheduling</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onWeekOffsetChange(weekOffset - 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronLeft size={15} /></button>
          <button onClick={() => onWeekOffsetChange(0)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 font-medium transition-colors">Today</button>
          <span className="text-sm font-medium text-gray-700 px-1">{weekLabel}</span>
          <button onClick={() => onWeekOffsetChange(weekOffset + 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronRight size={15} /></button>
          <button onClick={onSchedule} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm ml-2 transition-colors"><Plus size={13} /> Schedule Batch</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0">
        {[
          { label: 'ACTIVE', value: active, color: 'text-orange-600', icon: <FlaskConical size={14} className="text-orange-400" /> },
          { label: 'PENDING', value: pending, color: 'text-amber-600', icon: <ClipboardList size={14} className="text-amber-400" /> },
          { label: 'AWAITING QC', value: awaitingQC, color: 'text-blue-600', icon: <Microscope size={14} className="text-blue-400" /> },
          { label: 'FG READY', value: fgReady, color: 'text-emerald-600', icon: <CheckCircle2 size={14} className="text-emerald-400" /> },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-4 py-2.5 flex items-center gap-3 shadow-xs">
            {c.icon}
            <div>
              <div className={`text-xl font-extrabold ${c.color}`}>{c.value}</div>
              <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-175">
          {/* Header row */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-gray-100 shadow-xs">
            <div className="w-44 shrink-0 px-3 py-2.5 text-[10px] font-semibold text-gray-500 border-r border-gray-100 uppercase tracking-wider">Equipment</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`flex-1 text-center py-2.5 border-r border-gray-50 ${i === todayIndex ? 'bg-orange-50/60' : ''}`}>
                <div className={`text-xs font-semibold ${i === todayIndex ? 'text-orange-600' : 'text-gray-600'}`}>{d.label} {d.date}</div>
                <div className={`text-[10px] ${i === todayIndex ? 'text-orange-400' : 'text-gray-400'}`}>{d.month}</div>
                {i === todayIndex && <div className="mx-auto mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-500" />}
              </div>
            ))}
          </div>

          {(['mfg', 'fill', 'pack'] as const).map(cat => (
            <React.Fragment key={cat}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/80 border-b border-gray-100 sticky top-10 z-5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${catColors[cat]}`} />
                <span className="text-gray-500">{catIcons[cat]}</span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500">{catLabels[cat]}</span>
              </div>
              {allEquip.filter(e => e._cat === cat).map(eq => (
                <div key={eq.id} className="flex border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                  <div className="w-44 shrink-0 flex items-center px-3 py-2 border-r border-gray-100">
                    <div>
                      <div className="text-xs font-bold text-gray-800">{eq.id}</div>
                      <div className="text-[10px] text-gray-400">{'cap' in eq && eq.cap ? `${eq.cap}L` : 'speed' in eq && eq.speed ? `${fmt(eq.speed)}/hr` : ''}</div>
                    </div>
                  </div>
                  {weekDays.map((d, i) => {
                    const batch = getBatch(eq.id, d.iso, cat);
                    return (
                      <div key={i} className={`flex-1 relative h-12 border-r border-gray-50 ${i === todayIndex ? 'bg-orange-50/30' : ''}`}>
                        {batch && (
                          <div onClick={() => onBatchClick(batch)}
                            className={`absolute inset-y-1 inset-x-0.5 rounded-lg border text-[10px] font-semibold px-1.5 flex flex-col justify-center overflow-hidden shadow-xs cursor-pointer hover:brightness-95 transition-all ${
                              cat === 'mfg' ? 'bg-teal-100 border-teal-300 text-teal-800' :
                              cat === 'fill' ? 'bg-purple-100 border-purple-300 text-purple-800' :
                              'bg-emerald-100 border-emerald-300 text-emerald-800'
                            }`}>
                            <span className="truncate font-bold">{batch.bmrNo.split('-').pop()}</span>
                            <span className="truncate opacity-70">{batch.batchSize}KG</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────── EQUIPMENT VIEW ───────────────────────────────── */

function EquipmentView({ equipment, batches, onUpdate }: {
  equipment: EquipmentData; batches: Batch[];
  onUpdate: (eq: EquipmentData) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addCat, setAddCat] = useState<'manufacturing' | 'filling' | 'packaging'>('manufacturing');
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [addCap, setAddCap] = useState('');
  const [addType, setAddType] = useState('jacketed');

  const isBusy = (id: string) => batches.some(b => (b.mainVessel === id || b.fillingLine === id || b.packagingLine === id) && !['draft', 'cleared', 'fg_ready'].includes(b.bmrStatus));

  const handleRemove = (cat: keyof EquipmentData, id: string) => {
    if (!confirm(`Remove ${id}?`)) return;
    const updated = { ...equipment, [cat]: (equipment[cat] as Array<{ id: string }>).filter((e: { id: string }) => e.id !== id) };
    onUpdate(updated);
  };

  const handleAdd = () => {
    if (!addId.trim() || !addName.trim()) return;
    const updated = { ...equipment };
    if (addCat === 'manufacturing') {
      updated.manufacturing = [...updated.manufacturing, { id: addId, name: addName, cap: parseInt(addCap) || 200, type: addType as 'jacketed' | 'simple' | 'support', homogenizer: addType === 'jacketed', processType: addType === 'jacketed' ? ['hot' as ProcessType, 'cold' as ProcessType] : ['cold' as ProcessType], status: 'idle' }];
    } else if (addCat === 'filling') {
      updated.filling = [...updated.filling, { id: addId, name: addName, speed: parseInt(addCap) || 1000, type: addType as FillingType, compatible: [addType], status: 'idle' }];
    } else {
      updated.packaging = [...updated.packaging, { id: addId, name: addName, speed: parseInt(addCap) || 2000, type: addType, supports: ['carton', 'label'], status: 'idle' }];
    }
    onUpdate(updated);
    setShowAdd(false); setAddId(''); setAddName(''); setAddCap('');
  };

  const catMeta: { key: 'manufacturing' | 'filling' | 'packaging'; label: string; color: string; icon: React.ReactNode }[] = [
    { key: 'manufacturing', label: 'Manufacturing Vessels', color: 'text-teal-600', icon: <FlaskConical size={14} /> },
    { key: 'filling', label: 'Filling Lines', color: 'text-purple-600', icon: <Droplets size={14} /> },
    { key: 'packaging', label: 'Packaging Lines', color: 'text-emerald-600', icon: <Package size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div><h1 className="text-lg font-bold text-gray-900 tracking-tight">Equipment & Capacity</h1><p className="text-[11px] text-gray-400 mt-0.5">Manage all production equipment</p></div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Equipment</button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {catMeta.map(cat => (
          <div key={cat.key} className="mb-8">
            <h3 className={`flex items-center gap-2 text-sm font-bold ${cat.color} uppercase tracking-wide mb-3`}>{cat.icon}{cat.label}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(equipment[cat.key] as Array<{ id: string; name: string; cap?: number; speed?: number; type?: string; homogenizer?: boolean; processType?: string[]; compatible?: string[] }>).map((e) => {
                const busy = isBusy(e.id);
                const utilPct = Math.min(100, busy ? 60 : 0);
                return (
                  <div key={e.id} className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${busy ? 'border-red-200' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className={`text-sm font-bold font-mono ${cat.color}`}>{e.id}</div>
                        <div className="text-xs text-gray-600 font-medium">{e.name}</div>
                      </div>
                      <Badge className={busy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}>{busy ? 'IN USE' : 'IDLE'}</Badge>
                    </div>
                    {e.cap && <div className="text-[11px] text-gray-500">Capacity: <b className="text-gray-800">{e.cap}L</b></div>}
                    {e.speed && <div className="text-[11px] text-gray-500">Speed: <b className="text-gray-800">{fmt(e.speed)}/hr</b></div>}
                    {e.type && <div className="text-[11px] text-gray-500">Type: <b className="text-gray-800">{(e.type as string).toUpperCase()}</b></div>}
                    {e.homogenizer !== undefined && <div className="text-[11px] text-gray-500 inline-flex items-center gap-0.5">Homogenizer: <b className={e.homogenizer ? 'text-emerald-600 inline-flex items-center gap-0.5' : 'text-gray-400'}>{e.homogenizer ? <><Check size={11} /> Yes</> : 'No'}</b></div>}
                    {e.processType && <div className="text-[11px] text-gray-500">Process: <b>{(e.processType as string[]).join(', ').toUpperCase()}</b></div>}
                    {e.compatible && <div className="text-[11px] text-gray-500">Compatible: <b>{(e.compatible as string[]).join(', ')}</b></div>}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Utilization</span><span>{utilPct}%</span></div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${utilPct > 50 ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: `${utilPct}%` }} /></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleRemove(cat.key, e.id)} className="inline-flex items-center gap-0.5 px-2 py-1 text-[10px] text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"><X size={10} /> Remove</button>
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

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add Equipment">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Category</label><select className={INP} value={addCat} onChange={e => setAddCat(e.target.value as typeof addCat)}><option value="manufacturing">Manufacturing Vessel</option><option value="filling">Filling Line</option><option value="packaging">Packaging Line</option></select></div>
            <div><label className={LBL}>Equipment ID</label><input className={INP} value={addId} onChange={e => setAddId(e.target.value)} placeholder="e.g. MV-04" /></div>
            <div><label className={LBL}>Name</label><input className={INP} value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Manufacturing Vessel 04" /></div>
            <div><label className={LBL}>Capacity / Speed</label><input className={INP} type="number" value={addCap} onChange={e => setAddCap(e.target.value)} placeholder="e.g. 500" /></div>
            <div><label className={LBL}>Type</label><select className={INP} value={addType} onChange={e => setAddType(e.target.value)}>
              <option value="jacketed">Jacketed</option><option value="simple">Simple</option><option value="support">Support Tank</option>
              <option value="bottle">Bottle</option><option value="tube">Tube</option><option value="jar">Jar</option><option value="manual">Manual</option>
              <option value="auto">Auto Pack</option><option value="semi">Semi-Auto</option><option value="shrink">Shrink Wrap</option>
            </select></div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleAdd} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────── TEAM VIEW ────────────────────────────────────── */

function TeamView({ team, onUpdate }: { team: TeamMember[]; onUpdate: (t: TeamMember[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addId, setAddId] = useState('');
  const [addRole, setAddRole] = useState('');
  const [addDept, setAddDept] = useState<Department>('Manufacturing');

  const depts: { key: Department; color: string; icon: React.ReactNode }[] = [
    { key: 'Manufacturing', color: 'text-orange-600', icon: <FlaskConical size={14} /> },
    { key: 'Filling', color: 'text-purple-600', icon: <Droplets size={14} /> },
    { key: 'Packaging', color: 'text-emerald-600', icon: <Package size={14} /> },
    { key: 'Quality', color: 'text-blue-600', icon: <ShieldCheck size={14} /> },
  ];

  const toggleAvail = (id: string) => { onUpdate(team.map(t => t.id === id ? { ...t, avail: !t.avail } : t)); };
  const removeMember = (id: string) => { if (confirm('Remove this team member?')) onUpdate(team.filter(t => t.id !== id)); };

  const handleAdd = () => {
    if (!addName.trim() || !addId.trim() || !addRole.trim()) return;
    if (team.find(t => t.id === addId)) return;
    onUpdate([...team, { id: addId, name: addName, role: addRole, dept: addDept, avail: true }]);
    setShowAdd(false); setAddName(''); setAddId(''); setAddRole('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div><h1 className="text-lg font-bold text-gray-900 tracking-tight">Team Management</h1><p className="text-[11px] text-gray-400 mt-0.5">Manage team across all departments</p></div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Member</button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {depts.map(dept => (
          <div key={dept.key} className="mb-8">
            <h3 className={`flex items-center gap-2 text-sm font-bold ${dept.color} uppercase tracking-wide mb-3`}>{dept.icon}{dept.key}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.filter(t => t.dept === dept.key).map(t => (
                <div key={t.id} className={`bg-white rounded-xl border p-3.5 flex items-start gap-3 transition-shadow hover:shadow-md ${t.avail ? 'border-gray-100' : 'border-red-100'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${t.avail ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                    {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800">{t.name}</div>
                    <div className="text-[10px] text-gray-500">{t.role}</div>
                    <div className="flex gap-1 mt-1.5">
                      <Badge className={t.avail ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}>{t.avail ? 'Available' : 'Unavailable'}</Badge>
                      <Badge className="bg-gray-100 text-gray-500">{t.id}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => toggleAvail(t.id)} className="text-[10px] px-2 py-0.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">{t.avail ? 'Set Unavail' : 'Set Avail'}</button>
                      <button onClick={() => removeMember(t.id)} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"><X size={10} /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div onClick={() => { setAddDept(dept.key); setShowAdd(true); }} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-colors min-h-25">
                <Plus size={20} className="text-gray-300" />
                <span className="text-xs font-semibold text-gray-400">Add to {dept.key}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add Team Member">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Full Name</label><input className={INP} value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Rajesh Kumar" /></div>
            <div><label className={LBL}>Employee ID</label><input className={INP} value={addId} onChange={e => setAddId(e.target.value)} placeholder="e.g. T13" /></div>
            <div><label className={LBL}>Role</label><input className={INP} value={addRole} onChange={e => setAddRole(e.target.value)} placeholder="e.g. Production Executive" /></div>
            <div><label className={LBL}>Department</label><select className={INP} value={addDept} onChange={e => setAddDept(e.target.value as Department)}><option>Manufacturing</option><option>Filling</option><option>Packaging</option><option>Quality</option></select></div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleAdd} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-sm transition-colors"><Plus size={13} /> Add Member</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────── SIDEBAR & HEADER ─────────────────────────────── */

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'calendar',  label: 'Production Calendar',    icon: <Calendar size={15} /> },
  { id: 'bmr',       label: 'BMR - Manufacturing',    icon: <FlaskConical size={15} /> },
  { id: 'bpr',       label: 'BPR - Filling & Packing', icon: <Package size={15} /> },
  { id: 'equipment', label: 'Equipment & Capacity',   icon: <Wrench size={15} /> },
  { id: 'team',      label: 'Team Management',        icon: <Users size={15} /> },
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
  const awaitingQC = batches.filter(b => b.bmrStatus === 'bulk_qc').length;
  const fgReady = batches.filter(b => b.bprStatus === 'fg_ready').length;
  const weekLabel = formatWeekLabel(getWeekStart(new Date()));

  return (
    <header className="h-13 bg-white border-b border-gray-100 shadow-xs flex items-center px-5 gap-3 shrink-0 z-20">
      <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" onClick={onMenuClick}><Menu size={18} /></button>
      <div className="hidden md:flex items-center gap-2">
        <span className="text-[11px] text-gray-400 font-medium tracking-wide">Manufacturing Management</span>
      </div>
      <div className="flex items-center gap-1.5 ml-3 overflow-x-auto">
        {active > 0 && <Badge className="bg-orange-50 text-orange-600 border border-orange-200">{active} Active</Badge>}
        {pending > 0 && <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{pending} Pending</Badge>}
        {awaitingQC > 0 && <Badge className="bg-sky-50 text-sky-600 border border-sky-200">{awaitingQC} Awaiting QC</Badge>}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const rawSection = searchParams.get('section') as Section | null;
  const activeSection: Section = rawSection && NAV_ITEMS.some(n => n.id === rawSection) ? rawSection : 'calendar';
  const weekOffset = parseInt(searchParams.get('week') ?? '0', 10) || 0;

  const setSection = useCallback((s: Section) => {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('section', s); return p; });
  }, [setSearchParams]);
  const setWeekOffset = useCallback((n: number) => {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('week', String(n)); return p; });
  }, [setSearchParams]);

  const [state, setState] = useState<ProductionState>(loadState);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [modalBatch, setModalBatch] = useState<Batch | null>(null);
  const [modalType, setModalType] = useState<string | null>(null);

  useEffect(() => { persistState(state); }, [state]);

  const updateBatch = useCallback((bmrNo: string, updates: Partial<Batch>) => {
    setState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.bmrNo === bmrNo ? { ...b, ...updates } : b),
    }));
  }, []);

  const openScheduleWizard = useCallback(() => {
    const unscheduled = state.batches.find(b => (b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') && !b.mfgDate);
    if (unscheduled) { setModalBatch(unscheduled); setModalType('schedule'); }
    else addToast('info', 'No unscheduled confirmed batches found');
  }, [state.batches, addToast]);

  const handleAction = useCallback((action: string, batch: Batch) => {
    setModalBatch(batch); setModalType(action);
  }, []);

  const handleModalSave = useCallback((updates: Partial<Batch>) => {
    if (!modalBatch) return;
    updateBatch(modalBatch.bmrNo, updates);
    const msg = modalType === 'confirm' ? `${modalBatch.bmrNo} confirmed`
      : modalType === 'reserveRM' ? `RM Reserved for ${modalBatch.bmrNo}`
      : modalType === 'reservePM' ? `PM Reserved for ${modalBatch.bprNo}`
      : modalType === 'schedule' ? `${modalBatch.bmrNo} scheduled`
      : modalType === 'dispenseRM' || modalType === 'dispensePM' ? 'Dispensing updated'
      : modalType === 'qcBMR' || modalType === 'qcFill' || modalType === 'qcPack' ? 'QC review saved'
      : modalType === 'mtrRM' || modalType === 'mtrPM' ? 'MTR sent'
      : 'Batch updated';
    addToast('success', msg);
  }, [modalBatch, modalType, updateBatch, addToast]);

  const closeModal = useCallback(() => { setModalBatch(null); setModalType(null); }, []);

  function renderContent() {
    switch (activeSection) {
      case 'calendar':
        return <CalendarView batches={state.batches} equipment={state.equipment} onBatchClick={b => handleAction('detail', b)} onSchedule={openScheduleWizard} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />;
      case 'bmr':
        return <BMRView batches={state.batches} onAction={handleAction} />;
      case 'bpr':
        return <BPRView batches={state.batches} onAction={handleAction} />;
      case 'equipment':
        return <EquipmentView equipment={state.equipment} batches={state.batches} onUpdate={eq => setState(prev => ({ ...prev, equipment: eq }))} />;
      case 'team':
        return <TeamView team={state.team} onUpdate={t => setState(prev => ({ ...prev, team: t }))} />;
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
      {modalBatch && modalType === 'reserveRM' && (
        <ReserveMaterialModal batch={modalBatch} type="rm" onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'reservePM' && (
        <ReserveMaterialModal batch={modalBatch} type="pm" onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'schedule' && (
        <ScheduleModal batch={modalBatch} equipment={state.equipment} batches={state.batches} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'dispenseRM' && (
        <DispensingModal batch={modalBatch} type="rm" onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'dispensePM' && (
        <DispensingModal batch={modalBatch} type="pm" onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'qcBMR' && (
        <QCModal batch={modalBatch} qcType="bmr" team={state.team} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'qcFill' && (
        <QCModal batch={modalBatch} qcType="fill" team={state.team} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'qcPack' && (
        <QCModal batch={modalBatch} qcType="pack" team={state.team} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && (modalType === 'mtrRM' || modalType === 'mtrPM') && (
        <MTRModal batch={modalBatch} type={modalType === 'mtrRM' ? 'rm' : 'pm'} onClose={closeModal} onSave={updates => { handleModalSave(updates); closeModal(); }} />
      )}
      {modalBatch && modalType === 'detail' && (
        <BatchDetailModal batch={modalBatch} team={state.team} onClose={closeModal}
          onSave={updates => { handleModalSave(updates); }}
          onAction={(action, batch) => { closeModal(); setTimeout(() => handleAction(action, batch), 100); }} />
      )}
    </div>
  );
};

export default Production;
