import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  FlaskConical,
  MapPin,
  Scale,
  Search,
  Sun,
} from 'lucide-react';
import {
  batchMatchesDispensingTrayFilter,
  batchTrayContext,
  enrichDispensingTrayDetails,
  getDispensingStageLabel,
  isBatchOnDispensingTray,
  summarizeBatchDispensing,
  type DispensingLineTrayDetail,
  type DispensingTrayFilter,
} from '../../lib/batchDispensingStatus';
import {
  formatUnifiedBatchLabel,
} from '../../lib/batchLifecycle';
import { fetchFacilityAreas, type FacilityAreaDTO } from '../../services/facilityAreas.service';
import { fetchSalesOrders } from '../../services/salesPurchase.service';
import { formatQtyExact } from '../../utils/formatQty';

export interface DispensingTrayBatch {
  bmrNo: string;
  bprNo: string;
  productName: string;
  soNo: string;
  batchNo: string;
  batchIndex: number;
  totalBatches: number;
  batchSize: number;
  scheduledMuZone?: string;
  bmrStatus: string;
  bprStatus: string;
  mainVessel?: string;
  fillingLine?: string;
  muDispensingBundles?: Array<{
    bundleId: string;
    at: string;
    rm: { code: string; qty: number }[];
    pm: { code: string; qty: number }[];
  }>;
  dispensingRM: Array<{
    code: string;
    inci?: string;
    name?: string;
    required: number;
    dispensed: number;
    done: boolean;
    trayContainer?: string;
    traySlot?: string;
    dispensedAt?: string;
  }>;
  dispensingPM: Array<{
    code: string;
    inci?: string;
    name?: string;
    required: number;
    dispensed: number;
    done: boolean;
    trayContainer?: string;
    traySlot?: string;
    dispensedAt?: string;
  }>;
}

export interface DispensingTrayViewProps<T extends DispensingTrayBatch> {
  batches: T[];
  onAction: (action: 'dispenseRM' | 'dispensePM' | 'detail', batch: T) => void;
  /**
   * TEMPORARY dev tooling. When provided, empty trays offer a one-click seed so the steps AFTER
   * dispensing can be exercised. The tray it produces is a MOCK and consumes no stock.
   */
  onSeedTestTray?: (batch: T, fill: 'empty' | 'full') => void;
  seedingBmrNo?: string | null;
  /**
   * Warehouse rows used to colour each tray line by whether the batch's manufacturing site can
   * actually cover it, and to fill in material names for lines that carry only a code.
   */
  inventory?: TrayInventoryRow[];
}

/** Minimal shape needed from warehouse inventory — matches WarehouseInventoryRow. */
export interface TrayInventoryRow {
  code: string;
  name?: string;
  type: string;
  ml1Stock?: number;
  ml2Stock?: number;
}

const FILTER_OPTIONS: { id: DispensingTrayFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'rm_pending', label: 'RM pending' },
  { id: 'rm_done', label: 'RM complete' },
  { id: 'pm_pending', label: 'PM pending' },
  { id: 'pm_done', label: 'PM complete' },
];

function zoneLabelInAreas(areas: FacilityAreaDTO[], zoneCode: string): string {
  const zc = (zoneCode || '').trim();
  if (!zc) return '';
  for (const area of areas) {
    for (const zone of area.zones || []) {
      if (zone.code === zc) {
        const short = zone.zoneLabel || zone.name || area.name;
        return short ? String(short) : zc;
      }
    }
  }
  return zc;
}

/** Can the facility cover what this line still needs? Drives the card colour. */
type LineStockState = 'done' | 'ready' | 'short' | 'none' | 'unknown';

function lineStockState(line: DispensingLineTrayDetail, atSite: number | undefined): LineStockState {
  if (line.status === 'done') return 'done';
  if (atSite == null || !Number.isFinite(atSite)) return 'unknown';
  const outstanding = Math.max(0, line.required - line.dispensed);
  if (outstanding <= 1e-9) return 'done';
  if (atSite <= 1e-9) return 'none';
  return atSite + 1e-9 >= outstanding ? 'ready' : 'short';
}

const STOCK_STATE_STYLES: Record<LineStockState, { box: string; text: string }> = {
  done: { box: 'border-ok-soft bg-ok-soft/50', text: 'text-ok font-semibold' },
  ready: { box: 'border-brand-soft bg-brand-soft/30', text: 'text-brand font-semibold' },
  short: { box: 'border-warn-soft bg-warn-soft/40', text: 'text-warn font-semibold' },
  none: { box: 'border-err-soft bg-err-soft/40', text: 'text-err font-semibold' },
  unknown: { box: 'border-border bg-surface', text: 'text-ink-4' },
};

function TrayLineCard({
  line,
  qtyKind,
  atSite,
  muLabel,
  resolvedName,
}: {
  line: DispensingLineTrayDetail;
  qtyKind: 'kg' | 'pcs';
  /** Qty of this material at the batch's manufacturing site; undefined when stock isn't loaded. */
  atSite?: number;
  muLabel?: string;
  /** Name from the material master, used when the dispensing line carries only a code. */
  resolvedName?: string;
}): React.ReactElement {
  const state = lineStockState(line, atSite);
  const style = STOCK_STATE_STYLES[state];
  // `label` falls back to the code when the line has no inci/name — prefer the master name then.
  const displayName = line.label && line.label !== line.code ? line.label : (resolvedName || line.label);
  const outstanding = Math.max(0, line.required - line.dispensed);
  const site = muLabel || 'site';
  const stockNote = state === 'none'
    ? `Nothing at ${site} — needs ${formatQtyExact(outstanding, qtyKind)} ${line.unit}`
    : state === 'short'
      ? `Only ${formatQtyExact(atSite ?? 0, qtyKind)} at ${site}, needs ${formatQtyExact(outstanding, qtyKind)} ${line.unit}`
      : state === 'ready'
        ? `${formatQtyExact(atSite ?? 0, qtyKind)} ${line.unit} at ${site} — enough to dispense`
        : '';

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 min-w-0 h-full ${style.box}`}
      title={stockNote || undefined}
    >
      <div className="text-xs font-semibold text-ink leading-tight line-clamp-2" title={displayName}>
        {displayName}
      </div>
      <div className="mt-1 font-mono text-xs font-bold text-ink tabular-nums">
        {formatQtyExact(line.dispensed, qtyKind)} / {formatQtyExact(line.required, qtyKind)} {line.unit}
      </div>
      {stockNote && state !== 'ready' && (
        <div className={`mt-1 text-[10px] leading-snug ${style.text}`}>{stockNote}</div>
      )}
      <div className="mt-1.5 space-y-0.5 text-[10px] text-ink-3 leading-snug border-t border-hairline pt-1.5">
        <div className="truncate" title={line.trayLabel}>
          {line.trayLabel}
        </div>
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="font-mono truncate" title={line.code}>
            {line.code}
          </span>
          <span className={`shrink-0 ${style.text}`}>{line.statusText}</span>
        </div>
      </div>
    </div>
  );
}

function TraySection({
  title,
  icon,
  dispensedCount,
  totalCount,
  lines,
  qtyKind,
  emptyLabel,
  atSiteByCode,
  nameByCode,
  muLabel,
}: {
  title: string;
  icon: string;
  dispensedCount: number;
  totalCount: number;
  lines: DispensingLineTrayDetail[];
  qtyKind: 'kg' | 'pcs';
  emptyLabel: string;
  atSiteByCode?: Record<string, number>;
  nameByCode?: Record<string, string>;
  muLabel?: string;
}): React.ReactElement {
  // Count what the operator actually needs to act on before walking to the floor.
  const blocked = lines.filter((l) => {
    const s = lineStockState(l, atSiteByCode?.[l.code]);
    return s === 'none' || s === 'short';
  }).length;

  return (
    <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm" aria-hidden>{icon}</span>
        <div className="text-xs font-bold text-ink">
          {title} · <span className="text-brand">{dispensedCount}/{totalCount} dispensed</span>
        </div>
        {blocked > 0 && (
          <span className="text-[10px] font-semibold rounded-full bg-err-soft text-err px-2 py-0.5">
            {blocked} short of stock at {muLabel || 'site'}
          </span>
        )}
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-ink-4 italic">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {lines.map((line) => (
            <TrayLineCard
              key={line.code}
              line={line}
              qtyKind={qtyKind}
              atSite={atSiteByCode?.[line.code]}
              resolvedName={nameByCode?.[line.code]}
              muLabel={muLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchTrayCard<T extends DispensingTrayBatch>({
  batch,
  customerName,
  muSiteLabel,
  onAction,
  onSeedTestTray,
  seeding = false,
  atSiteRm,
  atSitePm,
  nameByCode,
}: {
  batch: T;
  customerName: string;
  muSiteLabel: string;
  onAction: DispensingTrayViewProps<T>['onAction'];
  onSeedTestTray?: DispensingTrayViewProps<T>['onSeedTestTray'];
  seeding?: boolean;
  /** RM/PM qty at THIS batch's manufacturing site, keyed by item code. */
  atSiteRm?: Record<string, number>;
  atSitePm?: Record<string, number>;
  nameByCode?: Record<string, string>;
}): React.ReactElement {
  const summary = summarizeBatchDispensing(batch.dispensingRM, batch.dispensingPM);
  const ctx = batchTrayContext(batch);
  const rmDetails = enrichDispensingTrayDetails(batch.dispensingRM, 'rm', ctx);
  const pmDetails = enrichDispensingTrayDetails(batch.dispensingPM, 'pm', ctx);
  const stageLabel = getDispensingStageLabel(batch.bmrStatus, batch.bprStatus, summary);
  const canRm = summary.rm.total > 0 || ['rm_connected', 'dispensing', 'in_production'].includes(batch.bmrStatus);
  const canPm = summary.pm.total > 0 || ['pm_connected', 'pm_dispensing', 'filling'].includes(batch.bprStatus);

  return (
    <article onClick={() => onAction('detail', batch)} className="cursor-pointer rounded-xl border border-brand-soft bg-surface shadow-sm overflow-hidden">
      <header className="px-4 py-2.5 border-b border-brand-soft bg-brand-soft/40">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-ink">
          <Sun size={14} className="text-warn shrink-0" aria-hidden />
          <span>{formatUnifiedBatchLabel(batch)}</span>
          <span className="text-ink-4 font-normal">·</span>
          <span className="font-semibold truncate max-w-xs">{batch.productName}</span>
          <span className="text-ink-4 font-normal">·</span>
          <span className="font-normal">{batch.batchSize} KG</span>
          {muSiteLabel ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand-soft border border-brand-soft rounded-md px-1.5 py-0.5 ml-auto">
              <MapPin size={10} aria-hidden />
              {muSiteLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-2">
          <span>
            <span className="text-ink-4">SO </span>
            <span className="font-semibold">{batch.soNo}</span>
          </span>
          {customerName ? (
            <>
              <span className="text-ink-4">·</span>
              <span className="truncate max-w-48">{customerName}</span>
            </>
          ) : null}
          <span className="text-ink-4">·</span>
          <span className="font-bold uppercase tracking-wide text-brand">{stageLabel}</span>
        </div>
      </header>

      <div className="p-3 space-y-3">
        <TraySection
          title="RM Tray"
          icon="🧪"
          dispensedCount={summary.rm.dispensed}
          totalCount={summary.rm.total}
          lines={rmDetails}
          qtyKind="kg"
          emptyLabel="No RM dispensing lines loaded for this batch."
          atSiteByCode={atSiteRm}
          nameByCode={nameByCode}
          muLabel={muSiteLabel}
        />
        <TraySection
          title="PM Tray"
          icon="📦"
          dispensedCount={summary.pm.dispensed}
          totalCount={summary.pm.total}
          lines={pmDetails}
          qtyKind="pcs"
          emptyLabel="No PM dispensing lines loaded for this batch."
          atSiteByCode={atSitePm}
          nameByCode={nameByCode}
          muLabel={muSiteLabel}
        />
      </div>

      <footer className="px-4 pb-3 flex flex-wrap gap-2 border-t border-hairline pt-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction('detail', batch); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-ink-2 bg-surface-2 border border-border rounded-lg hover:bg-surface-3 transition-colors"
        >
          <Eye size={11} /> Batch detail
        </button>
        {canRm && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction('dispenseRM', batch); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-brand bg-brand-soft border border-brand-soft rounded-lg hover:bg-brand-soft transition-colors"
          >
            <Scale size={11} />
            {summary.rm.status === 'complete' ? 'View RM dispensing' : 'RM dispensing'}
          </button>
        )}
        {canPm && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction('dispensePM', batch); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-brand bg-brand-soft border border-brand-soft rounded-lg hover:bg-brand-soft transition-colors"
          >
            <Scale size={11} />
            {summary.pm.status === 'complete' ? 'View PM dispensing' : 'PM dispensing'}
          </button>
        )}
        {summary.rm.total === 0 && summary.pm.total === 0 && (
          <p className="w-full text-xs text-warn flex items-start gap-1.5 mt-1" role="status">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Open RM or PM dispensing to load BOM lines onto the tray.
          </p>
        )}
        {onSeedTestTray && summary.rm.total === 0 && summary.pm.total === 0 && (
          <div className="w-full mt-2 rounded-lg border border-dashed border-warn-soft bg-warn-soft/30 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-warn">
              <FlaskConical size={12} aria-hidden /> Temporary test tool
            </div>
            <p className="mt-1 text-[10px] text-ink-2 leading-snug">
              Loads this batch&apos;s BOM onto the tray and moves it to <b>Dispensing</b> so the steps
              after it can be checked. <b>Mock only — consumes no stock and needs no MTR.</b>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={seeding}
                onClick={(e) => { e.stopPropagation(); onSeedTestTray(batch, 'empty'); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-warn bg-surface border border-warn-soft rounded-lg hover:bg-warn-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FlaskConical size={11} /> {seeding ? 'Seeding…' : 'Seed tray (undispensed)'}
              </button>
              <button
                type="button"
                disabled={seeding}
                onClick={(e) => { e.stopPropagation(); onSeedTestTray(batch, 'full'); }}
                title="Every line marked fully dispensed — jumps straight to the steps after dispensing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-warn bg-surface border border-warn-soft rounded-lg hover:bg-warn-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FlaskConical size={11} /> {seeding ? 'Seeding…' : 'Seed tray (fully dispensed)'}
              </button>
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}

export function DispensingTrayView<T extends DispensingTrayBatch>({
  batches,
  onAction,
  onSeedTestTray,
  seedingBmrNo = null,
  inventory,
}: DispensingTrayViewProps<T>): React.ReactElement {
  const [filter, setFilter] = useState<DispensingTrayFilter>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);
  const [customerBySo, setCustomerBySo] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFacilityAreas('production').then((res) => {
      setProductionAreas(res.data || []);
    });
    fetchSalesOrders().then(({ data }) => {
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.orderId && row.customerName) map[row.orderId] = row.customerName;
      }
      setCustomerBySo(map);
    });
  }, []);

  const trayBatches = useMemo(
    () => batches.filter(isBatchOnDispensingTray),
    [batches],
  );

  const batchOptions = useMemo(
    () => [...trayBatches].sort((a, b) => a.bmrNo.localeCompare(b.bmrNo)),
    [trayBatches],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trayBatches
      .map((batch) => ({
        batch,
        summary: summarizeBatchDispensing(batch.dispensingRM, batch.dispensingPM),
      }))
      .filter(({ batch, summary }) => {
        if (batchFilter !== 'all' && batch.bmrNo !== batchFilter) return false;
        if (!batchMatchesDispensingTrayFilter(summary, filter)) return false;
        if (!q) return true;
        const customer = customerBySo[batch.soNo] || '';
        const hay = [
          batch.bmrNo,
          batch.bprNo,
          batch.productName,
          batch.soNo,
          batch.batchNo,
          customer,
          ...summary.rmLines.map((l) => `${l.code} ${l.label}`),
          ...summary.pmLines.map((l) => `${l.code} ${l.label}`),
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.batch.bmrNo.localeCompare(b.batch.bmrNo));
  }, [trayBatches, filter, batchFilter, search, customerBySo]);

  const kpis = useMemo(() => {
    const summaries = trayBatches.map((b) => summarizeBatchDispensing(b.dispensingRM, b.dispensingPM));
    return {
      total: trayBatches.length,
      rmActive: summaries.filter((s) => s.rm.status === 'in_progress').length,
      pmActive: summaries.filter((s) => s.pm.status === 'in_progress').length,
    };
  }, [trayBatches]);

  /* ── TEMPORARY dev tooling: seed picker ───────────────────────────────────────────────────
     The per-card buttons can only reach batches ALREADY on the tray, so there was no way to put a
     further batch on it. This header control seeds any batch that is not on the tray yet, which is
     what "seed another tray" actually needs. Remove with the rest of the dev seed block. */
  const [seedPick, setSeedPick] = useState<string>('');
  // Type-to-filter instead of scrolling a plain <select> — same idea as the tray's own search box.
  const [seedQuery, setSeedQuery] = useState('');
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedHighlight, setSeedHighlight] = useState(0);
  const seedBoxRef = useRef<HTMLDivElement | null>(null);

  const seedCandidates = useMemo(() => {
    if (!onSeedTestTray) return [];
    return [...batches]
      .filter((b) => !isBatchOnDispensingTray(b))
      .sort((a, b) => a.bmrNo.localeCompare(b.bmrNo));
  }, [batches, onSeedTestTray]);

  const seedSuggestions = useMemo(() => {
    const q = seedQuery.trim().toLowerCase();
    if (!q) return seedCandidates;
    return seedCandidates.filter((b) => {
      const hay = [b.bmrNo, b.bprNo, b.batchNo, b.productName, b.soNo, customerBySo[b.soNo] || '']
        .join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [seedCandidates, seedQuery, customerBySo]);

  const selectedSeedBatch = useMemo(
    () => seedCandidates.find((b) => b.bmrNo === seedPick) ?? null,
    [seedCandidates, seedPick],
  );

  // Close the suggestion list when focus moves elsewhere on the page.
  useEffect(() => {
    if (!seedOpen) return undefined;
    const onDocDown = (e: MouseEvent) => {
      if (seedBoxRef.current && !seedBoxRef.current.contains(e.target as Node)) setSeedOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [seedOpen]);

  const chooseSeed = (b: DispensingTrayBatch) => {
    setSeedPick(b.bmrNo);
    setSeedQuery(`${formatUnifiedBatchLabel(b)} — ${b.productName}`);
    setSeedOpen(false);
  };

  const clearSeed = () => {
    setSeedPick('');
    setSeedQuery('');
    setSeedHighlight(0);
  };

  const onSeedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!seedOpen) { setSeedOpen(true); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setSeedHighlight((i) => {
        const n = seedSuggestions.length;
        return n === 0 ? 0 : (i + step + n) % n;
      });
      return;
    }
    if (e.key === 'Enter') {
      const pick = seedSuggestions[seedHighlight];
      if (seedOpen && pick) { e.preventDefault(); chooseSeed(pick); }
      return;
    }
    if (e.key === 'Escape') setSeedOpen(false);
  };

  const seedPicked = (fill: 'empty' | 'full') => {
    const batch = seedCandidates.find((b) => b.bmrNo === seedPick);
    if (!batch || !onSeedTestTray) return;
    onSeedTestTray(batch, fill);
    clearSeed();
  };

  const resolveCustomer = (soNo: string): string => customerBySo[soNo] || '';
  const resolveMuLabel = (zoneCode?: string): string => zoneLabelInAreas(productionAreas, zoneCode || '');

  /* ── Stock at the manufacturing site, per batch ──────────────────────────────────────────
     One warehouse fetch covers every batch: each row carries its ML1 and ML2 quantities, so the
     right bucket is picked per batch from its own scheduled MU zone. */
  const nameByCode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of inventory ?? []) {
      const c = String(r.code ?? '').trim();
      if (c && r.name && !m[c]) m[c] = String(r.name);
    }
    return m;
  }, [inventory]);

  const atSiteFor = useMemo(() => {
    if (!inventory || inventory.length === 0) return null;
    return (kind: 'RM' | 'PM', zoneCode?: string): Record<string, number> => {
      const z = String(zoneCode || '').trim().toUpperCase();
      const useMl2 = z.includes('ML2') || z.includes('MU02');
      const map: Record<string, number> = {};
      for (const r of inventory) {
        if (String(r.type) !== kind) continue;
        const c = String(r.code ?? '').trim();
        if (!c) continue;
        const qty = Number(useMl2 ? r.ml2Stock : r.ml1Stock) || 0;
        map[c] = (map[c] ?? 0) + qty;
      }
      return map;
    };
  }, [inventory]);

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-dispensing-tray">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-hairline bg-surface shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-ink tracking-tight">Dispensing &amp; Tray</div>
          <div className="sec-sub text-[11px] text-ink-4 mt-0.5">
            Batch-wise RM &amp; PM tray — material, quantity, container slot, and dispense timestamp
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-1 rounded-lg bg-brand-soft text-brand border border-brand-soft font-semibold">{kpis.total} batches</span>
            <span className="px-2 py-1 rounded-lg bg-warn-soft text-warn border border-warn-soft font-semibold">{kpis.rmActive} RM active</span>
            <span className="px-2 py-1 rounded-lg bg-brand-soft text-brand border border-brand-soft font-semibold">{kpis.pmActive} PM active</span>
          </div>

          {onSeedTestTray && seedCandidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-warn-soft bg-warn-soft/30 px-2 py-1.5">
              <span
                className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-warn"
                title="Temporary test tool — seeds a mock tray. Consumes no stock and needs no MTR."
              >
                <FlaskConical size={11} aria-hidden /> Seed tray
              </span>
              <div ref={seedBoxRef} className="relative">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
                  <input
                    type="text"
                    role="combobox"
                    aria-expanded={seedOpen}
                    aria-controls="seed-batch-suggestions"
                    aria-autocomplete="list"
                    aria-label="Search a batch to seed onto the dispensing tray"
                    placeholder={`Search batch, product, SO… (${seedCandidates.length})`}
                    className="text-[10.5px] w-56 pl-6 pr-6 py-1 rounded-lg border border-border bg-surface text-ink placeholder-ink-4 focus:ring-1 focus:ring-brand outline-none"
                    value={seedQuery}
                    disabled={seedingBmrNo != null}
                    onFocus={() => setSeedOpen(true)}
                    onChange={(e) => {
                      setSeedQuery(e.target.value);
                      setSeedPick('');       // typing invalidates the previous choice
                      setSeedHighlight(0);
                      setSeedOpen(true);
                    }}
                    onKeyDown={onSeedKeyDown}
                  />
                  {seedQuery && (
                    <button
                      type="button"
                      onClick={clearSeed}
                      aria-label="Clear batch search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 text-[11px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {seedOpen && (
                  <ul
                    id="seed-batch-suggestions"
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-56 w-72 overflow-auto rounded-lg border border-border bg-surface shadow-lg right-0"
                  >
                    {seedSuggestions.length === 0 ? (
                      <li className="px-2.5 py-2 text-[10.5px] text-ink-4">No batch matches “{seedQuery}”.</li>
                    ) : (
                      seedSuggestions.map((b, i) => (
                        <li key={b.bmrNo} role="option" aria-selected={b.bmrNo === seedPick}>
                          <button
                            type="button"
                            onMouseEnter={() => setSeedHighlight(i)}
                            onClick={() => chooseSeed(b)}
                            className={`w-full text-left px-2.5 py-1.5 text-[10.5px] ${
                              i === seedHighlight ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-2'
                            }`}
                          >
                            <span className="font-semibold">{formatUnifiedBatchLabel(b)}</span>
                            <span className="block truncate text-ink-3">{b.productName}</span>
                            <span className="block text-[9.5px] text-ink-4">
                              SO {b.soNo}{customerBySo[b.soNo] ? ` · ${customerBySo[b.soNo]}` : ''}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              <button
                type="button"
                disabled={!seedPick || seedingBmrNo != null}
                onClick={() => seedPicked('empty')}
                title={selectedSeedBatch
                  ? `Load ${formatUnifiedBatchLabel(selectedSeedBatch)} onto the tray with nothing dispensed yet`
                  : 'Search and choose a batch first'}
                className="px-2 py-1 text-[10px] font-semibold text-warn bg-surface border border-warn-soft rounded-lg hover:bg-warn-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingBmrNo != null ? 'Seeding…' : 'Undispensed'}
              </button>
              <button
                type="button"
                disabled={!seedPick || seedingBmrNo != null}
                onClick={() => seedPicked('full')}
                title={selectedSeedBatch
                  ? `Seed ${formatUnifiedBatchLabel(selectedSeedBatch)} with every line marked dispensed — jumps straight to the steps after dispensing`
                  : 'Search and choose a batch first'}
                className="px-2 py-1 text-[10px] font-semibold text-warn bg-surface border border-warn-soft rounded-lg hover:bg-warn-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedingBmrNo != null ? 'Seeding…' : 'Fully dispensed'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-hairline bg-surface shrink-0">
        <label className="text-[9.5px] font-bold text-ink-3 uppercase tracking-wider shrink-0" htmlFor="dispensing-batch-filter">
          Batch:
        </label>
        <select
          id="dispensing-batch-filter"
          className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink min-w-48 max-w-xs focus:ring-1 focus:ring-brand outline-none"
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
        >
          <option value="all">All batches ({batchOptions.length})</option>
          {batchOptions.map((b) => (
            <option key={b.bmrNo} value={b.bmrNo}>
              {formatUnifiedBatchLabel(b)} — {b.productName}
            </option>
          ))}
        </select>

        <span className="text-[9.5px] font-bold text-ink-3 uppercase tracking-wider ml-2 shrink-0">Status:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              filter === opt.id ? 'active bg-brand text-white border-brand-soft' : 'bg-surface text-ink-2 border-border hover:bg-surface-2'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="relative flex-1 min-w-36 max-w-56 ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            type="text"
            className="w-full text-[11px] pl-8 pr-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink placeholder-gray-400 outline-none focus:ring-1 focus:ring-brand"
            aria-label="Search code, product"
            placeholder="Search code, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-[10px] font-semibold text-ink-3">{rows.length} shown</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-ink-4">
            <Scale size={32} className="mb-2 opacity-20" />
            <p className="text-sm text-center max-w-md">
              No batches match this filter. Choose another batch or status filter.
            </p>
          </div>
        ) : (
          rows.map(({ batch }) => (
            <BatchTrayCard
              key={batch.bmrNo}
              batch={batch}
              customerName={resolveCustomer(batch.soNo)}
              muSiteLabel={resolveMuLabel(batch.scheduledMuZone)}
              onAction={onAction}
              onSeedTestTray={onSeedTestTray}
              seeding={seedingBmrNo === batch.bmrNo}
              atSiteRm={atSiteFor ? atSiteFor('RM', batch.scheduledMuZone) : undefined}
              atSitePm={atSiteFor ? atSiteFor('PM', batch.scheduledMuZone) : undefined}
              nameByCode={nameByCode}
            />
          ))
        )}
      </div>
    </div>
  );
}
