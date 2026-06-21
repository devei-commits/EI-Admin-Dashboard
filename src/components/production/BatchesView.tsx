import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Eye,
  FlaskConical,
  Info,
  Layers,
  Microscope,
  Package,
  Plus,
  Scale,
  Send,
  Settings,
  X,
  Zap,
} from 'lucide-react';
import {
  batchLifecycleLabel,
  batchMatchesLifecycleFilter,
  canShowPackagingActions,
  formatUnifiedBatchLabel,
  type BatchLifecycleFilter,
} from '../../lib/batchLifecycle';
import type { MRNRecordFromApi } from '../../services/mrn.service';
import type { ProductionReservedItemRow } from '../../services/production.service';

export interface BatchesViewBatch {
  bmrNo: string;
  bprNo: string;
  productName: string;
  batchNo: string;
  batchIndex: number;
  totalBatches: number;
  batchSize: number;
  processType: string;
  fillingType: string;
  mainVessel: string;
  supportingTanks?: string[];
  fillingLine: string;
  packagingLine: string;
  soNo: string;
  dueDate: string;
  mfgDate: string;
  fillDate: string;
  packDate: string;
  fgDate: string;
  color: string;
  bmrStatus: string;
  bprStatus: string;
  rmReserved: boolean;
  pmReserved: boolean;
  bulkBatchAccepted: boolean | null;
  fillBatchAccepted: boolean | null;
  fgBatchAccepted: boolean | null;
  remarks: string;
  muDispensingBundleId?: string | null;
}

export interface BatchesViewHelpers {
  batchLifecycleDisplayForBatch: (batch: BatchesViewBatch, outboundMrns: MRNRecordFromApi[]) => string;
  UnifiedPipelineStrip: React.FC<{ batch: BatchesViewBatch; outboundMrns: MRNRecordFromApi[] }>;
  batchColorMap: Record<string, { bg: string; border: string; text: string; dot: string }>;
  getBatchStageDateAlert: (batch: BatchesViewBatch) => { stageLabel: string; daysUntil: number; date: string } | null;
  effectiveRmConnected: (batch: BatchesViewBatch, outboundMrns: MRNRecordFromApi[]) => boolean;
  effectivePmConnected: (batch: BatchesViewBatch, outboundMrns: MRNRecordFromApi[]) => boolean;
  findOpenRmMtrForBatch: (bmrNo: string, outboundMrns: MRNRecordFromApi[]) => MRNRecordFromApi | null;
  findAnyRmMtrForBatch: (bmrNo: string, outboundMrns: MRNRecordFromApi[]) => MRNRecordFromApi | null;
  findOpenPmMtrForBatch: (bmrNo: string, outboundMrns: MRNRecordFromApi[]) => MRNRecordFromApi | null;
  findAnyPmMtrForBatch: (bmrNo: string, outboundMrns: MRNRecordFromApi[]) => MRNRecordFromApi | null;
  outboundMtrWarehouseMeta: (m: MRNRecordFromApi | null | undefined) => string | null;
  outboundMtrStageHint: (m: MRNRecordFromApi) => string;
  outboundMtrStageTitle: (m: MRNRecordFromApi) => string;
  mtrLineItemIsRm: (li: { itemCode?: string }) => boolean;
  mtrLineItemIsPm: (li: { itemCode?: string }) => boolean;
  mtrLinePhaseRaw: (m: MRNRecordFromApi, lineId: number) => string;
  formatMtrLinePhaseShort: (phase: string) => string;
  mtrAllRmLinesReceivedAtMu: (m: MRNRecordFromApi | null) => boolean;
  mtrAllPmLinesReceivedAtMu: (m: MRNRecordFromApi | null) => boolean;
  hasProductionBatchSchedule: (batch: BatchesViewBatch) => boolean;
  canConfirmProductionBatch: (batch: BatchesViewBatch) => boolean;
  canUnreserveRmForBatch: (batch: BatchesViewBatch, outboundMrns: MRNRecordFromApi[], reservedItems: ProductionReservedItemRow[]) => boolean;
  canUnreservePmForBatch: (batch: BatchesViewBatch, outboundMrns: MRNRecordFromApi[], reservedItems: ProductionReservedItemRow[]) => boolean;
  canReservePmForBatch: (batch: BatchesViewBatch) => boolean;
  canShowRescheduleFooterButton: (batch: BatchesViewBatch) => boolean;
  canAdjustBatchSize: (batch: BatchesViewBatch) => boolean;
  Badge: React.FC<{ className?: string; children: React.ReactNode }>;
  Btn: React.FC<{ color: string; icon?: React.ReactNode; onClick: () => void; children: React.ReactNode }>;
}

export interface BatchesViewProps<T extends BatchesViewBatch> {
  batches: T[];
  outboundMrns: MRNRecordFromApi[];
  reservedItems: ProductionReservedItemRow[];
  onAction: (action: string, batch: T) => void;
  onCreateBatch?: () => void;
  helpers: BatchesViewHelpers;
}

export function BatchesView<T extends BatchesViewBatch>({
  batches,
  outboundMrns,
  reservedItems,
  onAction,
  onCreateBatch,
  helpers,
}: BatchesViewProps<T>): React.ReactElement {
  const {
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
  } = helpers;

  const [filter, setFilter] = useState<BatchLifecycleFilter>('all');
  const [productFilter, setProductFilter] = useState('');
  const [search, setSearch] = useState('');

  const displayOpts = useMemo(
    () => ({
      effectiveRmConnected: (b: BatchesViewBatch) => effectiveRmConnected(b, outboundMrns),
      effectivePmConnected: (b: BatchesViewBatch) => effectivePmConnected(b, outboundMrns),
    }),
    [outboundMrns, effectiveRmConnected, effectivePmConnected],
  );

  const activeBatches = useMemo(
    () => (filter === 'fg_ready' ? batches : batches.filter((b) => b.bprStatus !== 'fg_ready')),
    [batches, filter],
  );

  const productOptions = useMemo(
    () => Array.from(new Set(activeBatches.map((b) => b.productName).filter(Boolean))).sort(),
    [activeBatches],
  );

  const statusFiltered = useMemo(() => {
    const pool = filter === 'all' ? activeBatches : batches;
    return pool.filter((b) =>
      batchMatchesLifecycleFilter(b, filter, {
        effectiveRmConnected: displayOpts.effectiveRmConnected(b),
        effectivePmConnected: displayOpts.effectivePmConnected(b),
      }),
    );
  }, [filter, activeBatches, batches, displayOpts]);

  const productFiltered = productFilter
    ? statusFiltered.filter((b) => b.productName === productFilter)
    : statusFiltered;

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? productFiltered.filter(
        (b) =>
          b.bmrNo.toLowerCase().includes(searchLower) ||
          b.bprNo.toLowerCase().includes(searchLower) ||
          (b.batchNo && b.batchNo.toLowerCase().includes(searchLower)) ||
          (b.productName && b.productName.toLowerCase().includes(searchLower)),
      )
    : productFiltered;

  const pendingCount = batches.filter(
    (b) => b.bmrStatus === 'draft' || b.bmrStatus === 'batch_confirmed',
  ).length;
  const inMfgCount = batches.filter((b) =>
    ['rm_reserved', 'scheduled', 'rm_connected', 'dispensing', 'in_production'].includes(b.bmrStatus),
  ).length;
  const bulkQcCount = batches.filter((b) => b.bmrStatus === 'bulk_qc').length;
  const packagingCount = batches.filter(
    (b) => canShowPackagingActions(b) && b.bprStatus !== 'fg_ready' && b.bprStatus !== 'draft',
  ).length;
  const fgReadyCount = batches.filter((b) => b.bprStatus === 'fg_ready').length;
  const failedCount = batches.filter(
    (b) => b.bmrStatus === 'qc_failed' || b.bprStatus === 'qc_failed',
  ).length;

  const clearFilters = (): void => {
    setFilter('all');
    setProductFilter('');
    setSearch('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-batches">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Batches</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">
            Manufacturing → Bulk QC → Filling &amp; Packaging → FG Ready
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onCreateBatch?.()}
            className="btn btn-sm btn-primary inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={13} /> Create New Batch
          </button>
        </div>
      </div>

      <div className="kpi-row grid grid-cols-2 sm:grid-cols-6 gap-2.5 px-6 py-3.5 bg-gray-50/50 border-b border-gray-100 shrink-0" id="batches-kpis">
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Pending</div>
          <div className="kpi-val text-lg font-extrabold text-amber-600">{pendingCount}</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">In Mfg</div>
          <div className="kpi-val text-lg font-extrabold text-orange-600">{inMfgCount}</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Bulk QC</div>
          <div className="kpi-val text-lg font-extrabold text-blue-600">{bulkQcCount}</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">Packaging</div>
          <div className="kpi-val text-lg font-extrabold text-purple-600">{packagingCount}</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">FG Ready</div>
          <div className="kpi-val text-lg font-extrabold text-emerald-600">{fgReadyCount}</div>
        </div>
        <div className="kpi-card bg-white rounded-xl border border-gray-100 px-3 py-2 shadow-xs">
          <div className="kpi-label text-[10px] text-gray-500 uppercase font-semibold">QC Failed</div>
          <div className="kpi-val text-lg font-extrabold text-red-600">{failedCount}</div>
        </div>
      </div>

      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <span className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">Status:</span>
        {(
          [
            { k: 'all' as const, l: 'Active' },
            { k: 'pending' as const, l: 'Pending' },
            { k: 'in_mfg' as const, l: 'In Mfg' },
            { k: 'bulk_qc' as const, l: 'Bulk QC' },
            { k: 'packaging' as const, l: 'Packaging' },
            { k: 'fg_ready' as const, l: 'FG Ready' },
            ...(failedCount ? [{ k: 'qc_failed' as const, l: `QC Failed (${failedCount})` }] : []),
          ] as { k: BatchLifecycleFilter; l: string }[]
        ).map((s) => (
          <button
            key={s.k}
            type="button"
            onClick={() => setFilter(s.k)}
            className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              filter === s.k
                ? 'active bg-orange-500 text-white border-orange-500'
                : s.k === 'qc_failed'
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s.l}
          </button>
        ))}
        <div className="w-px h-[18px] bg-gray-200" />
        <select
          id="batches-prod-filter"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="text-[10.5px] px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-orange-300"
        >
          <option value="">All Products</option>
          {productOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="search-box flex-1 min-w-[120px] max-w-[200px] text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-orange-300"
          id="batches-search"
          placeholder="Search batch, product, SO…"
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          onClick={clearFilters}
          className="btn btn-xs btn-ghost ml-auto text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-[10px]"
          aria-label="Clear filters"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5" id="batches-list">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Layers size={32} className="mb-2 opacity-20" />
            <p className="text-sm">No batches match this filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((b) => {
              const colors = batchColorMap[b.color] || batchColorMap.teal;
              const stageDateAlert = getBatchStageDateAlert(b);
              const lifecycleStage = batchLifecycleDisplayForBatch(b, outboundMrns);
              const lifecycleLabel = batchLifecycleLabel(lifecycleStage as Parameters<typeof batchLifecycleLabel>[0]);
              const packagingUnlocked = canShowPackagingActions(b);
              const openRmMtr = findOpenRmMtrForBatch(b.bmrNo, outboundMrns);
              const anyRmMtr = findAnyRmMtrForBatch(b.bmrNo, outboundMrns);
              const effectiveRm = effectiveRmConnected(b, outboundMrns);
              const openPmMtr = findOpenPmMtrForBatch(b.bmrNo, outboundMrns);
              const anyPmMtr = findAnyPmMtrForBatch(b.bmrNo, outboundMrns);
              const effectivePm = effectivePmConnected(b, outboundMrns);
              const rmMtrWhMeta = outboundMtrWarehouseMeta(openRmMtr);
              const pmMtrWhMeta = outboundMtrWarehouseMeta(openPmMtr);
              const isFailed = b.bmrStatus === 'qc_failed' || b.bprStatus === 'qc_failed';

              return (
                <div
                  key={b.bmrNo}
                  className={`rounded-xl border p-4 ${
                    isFailed
                      ? 'bg-red-50/60 border-red-200'
                      : stageDateAlert
                        ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-200'
                        : `${colors.bg} ${colors.border}`
                  } hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onAction('detail', b)}
                >
                  <div className="mb-3">
                    <UnifiedPipelineStrip batch={b} outboundMrns={outboundMrns} />
                  </div>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {formatUnifiedBatchLabel(b)}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">{b.productName}</div>
                    </div>
                    {isFailed ? (
                      <Badge className="bg-red-100 text-red-700 border border-red-300">QC Failed</Badge>
                    ) : (
                      <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>{lifecycleLabel}</Badge>
                    )}
                  </div>
                  {isFailed && b.remarks && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-lg bg-red-100/60 border border-red-200 text-[10px] text-red-700">
                      <AlertTriangle size={11} className="shrink-0" /> {b.remarks}
                    </div>
                  )}
                  {stageDateAlert && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-[10px] text-amber-900 font-semibold">
                      <AlertTriangle size={11} className="shrink-0" />
                      {stageDateAlert.stageLabel} stage due{' '}
                      {stageDateAlert.daysUntil === 0 ? 'today' : 'tomorrow'} ({stageDateAlert.date})
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                    <div>
                      <span className="text-gray-400">Seq:</span>{' '}
                      <b>
                        {b.batchIndex}/{b.totalBatches}
                      </b>
                    </div>
                    <div>
                      <span className="text-gray-400">Size:</span> <b>{b.batchSize} KG</b>
                    </div>
                    <div>
                      <span className="text-gray-400">MFG:</span> <b>{b.mfgDate || '-'}</b>
                    </div>
                    <div>
                      <span className="text-gray-400">Fill:</span> <b>{b.fillDate || '-'}</b>
                    </div>
                    {(b.mainVessel || b.fillingLine || b.packagingLine) && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Equip:</span>{' '}
                        <b>
                          {b.mainVessel || '—'}
                          {b.fillingLine ? ` · ${b.fillingLine}` : ''}
                          {b.packagingLine ? ` · ${b.packagingLine}` : ''}
                          {(b.supportingTanks ?? []).length > 0
                            ? ` · +${(b.supportingTanks ?? []).join(', ')}`
                            : ''}
                        </b>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">RM:</span>{' '}
                      <b className="inline-flex items-center gap-0.5">
                        {b.rmReserved ? (
                          <>
                            <Check size={10} className="text-emerald-600" /> Reserved
                          </>
                        ) : (
                          '-'
                        )}
                      </b>
                    </div>
                    <div>
                      <span className="text-gray-400">PM:</span>{' '}
                      <b className="inline-flex items-center gap-0.5">
                        {b.pmReserved ? (
                          <>
                            <Check size={10} className="text-emerald-600" /> Reserved
                          </>
                        ) : packagingUnlocked ? (
                          '—'
                        ) : (
                          'Locked'
                        )}
                      </b>
                    </div>
                    <div>
                      <span className="text-gray-400">SO:</span> <b>{b.soNo}</b>
                    </div>
                    <div>
                      <span className="text-gray-400">FG:</span> <b>{b.fgDate || '-'}</b>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {b.bmrStatus === 'draft' && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>
                        {hasProductionBatchSchedule(b) ? 'Edit schedule' : 'Schedule'}
                      </Btn>
                    )}
                    {b.bmrStatus === 'draft' && hasProductionBatchSchedule(b) && !canConfirmProductionBatch(b) && (
                      <span className="inline-flex items-center px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                        Confirm on {b.mfgDate}
                      </span>
                    )}
                    {b.bmrStatus === 'draft' && canConfirmProductionBatch(b) && (
                      <Btn color="orange" icon={<Zap size={11} />} onClick={() => onAction('confirm', b)}>
                        Confirm
                      </Btn>
                    )}
                    {canUnreserveRmForBatch(b, outboundMrns, reservedItems) && (
                      <Btn color="gray" icon={<X size={11} />} onClick={() => onAction('unreserveRM', b)}>
                        Remove RM reserve
                      </Btn>
                    )}
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved' || b.bmrStatus === 'scheduled') &&
                      !b.rmReserved && (
                        <Btn color="amber" icon={<Package size={11} />} onClick={() => onAction('reserveRM', b)}>
                          Reserve RM
                        </Btn>
                      )}
                    {(b.bmrStatus === 'batch_confirmed' || b.bmrStatus === 'rm_reserved') &&
                      !hasProductionBatchSchedule(b) && (
                        <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>
                          Schedule
                        </Btn>
                      )}
                    {canShowRescheduleFooterButton(b) && (
                      <Btn color="teal" icon={<Calendar size={11} />} onClick={() => onAction('schedule', b)}>
                        Reschedule
                      </Btn>
                    )}
                    {canAdjustBatchSize(b) && (
                      <Btn color="orange" icon={<Settings size={11} />} onClick={() => onAction('adjustBatch', b)}>
                        Adjust size
                      </Btn>
                    )}
                    {(b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved') &&
                      b.rmReserved &&
                      !effectiveRm &&
                      !anyRmMtr && (
                        <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrRM', b)}>
                          RM Transfer
                        </Btn>
                      )}
                    {(b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved' || b.bmrStatus === 'batch_confirmed') &&
                      !b.rmReserved &&
                      !anyRmMtr && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                          <Info size={10} /> Reserve all RM first
                        </span>
                      )}
                    {(b.bmrStatus === 'scheduled' || b.bmrStatus === 'rm_reserved') && !effectiveRm && openRmMtr && (
                      <span
                        className="inline-flex flex-col gap-0.5 items-start px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg max-w-[min(100%,28rem)]"
                        title={outboundMtrStageHint(openRmMtr)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Info size={10} className="shrink-0" />{' '}
                          <span className="leading-tight">{outboundMtrStageTitle(openRmMtr)}</span>
                        </span>
                        {rmMtrWhMeta && (
                          <span className="text-[9px] font-semibold text-amber-950/90 leading-snug pl-4 border-l border-amber-300/50">
                            {rmMtrWhMeta}
                          </span>
                        )}
                      </span>
                    )}
                    {effectiveRm &&
                      (b.bmrStatus === 'rm_connected' ||
                        b.bmrStatus === 'dispensing' ||
                        b.bmrStatus === 'rm_reserved' ||
                        b.bmrStatus === 'scheduled') &&
                      (!openRmMtr || mtrAllRmLinesReceivedAtMu(openRmMtr)) && (
                        <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispenseRM', b)}>
                          Dispense RM
                        </Btn>
                      )}
                    {b.bmrStatus === 'in_production' && (
                      <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>
                        Bulk QC
                      </Btn>
                    )}
                    {b.bmrStatus === 'bulk_qc' && (
                      <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>
                        Review QC
                      </Btn>
                    )}
                    {b.bmrStatus === 'qc_failed' && (
                      <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcBMR', b)}>
                        Retry QC
                      </Btn>
                    )}
                    {packagingUnlocked && canUnreservePmForBatch(b, outboundMrns, reservedItems) && (
                      <Btn color="gray" icon={<X size={11} />} onClick={() => onAction('unreservePM', b)}>
                        Remove PM reserve
                      </Btn>
                    )}
                    {packagingUnlocked && canReservePmForBatch(b) && (
                      <Btn color="amber" icon={<Package size={11} />} onClick={() => onAction('reservePM', b)}>
                        Reserve PM
                      </Btn>
                    )}
                    {packagingUnlocked &&
                      b.bprStatus === 'pm_reserved' &&
                      b.pmReserved &&
                      !effectivePm &&
                      !anyPmMtr && (
                        <Btn color="teal" icon={<Send size={11} />} onClick={() => onAction('mtrPM', b)}>
                          PM Transfer
                        </Btn>
                      )}
                    {packagingUnlocked &&
                      effectivePm &&
                      (b.bprStatus === 'pm_connected' || b.bprStatus === 'pm_reserved' || b.bprStatus === 'pm_dispensing') &&
                      (!openPmMtr || mtrAllPmLinesReceivedAtMu(openPmMtr)) && (
                        <Btn color="purple" icon={<Scale size={11} />} onClick={() => onAction('dispensePM', b)}>
                          PM Dispense
                        </Btn>
                      )}
                    {packagingUnlocked && b.bprStatus === 'filling' && (
                      <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcFill', b)}>
                        Fill QC
                      </Btn>
                    )}
                    {packagingUnlocked && b.bprStatus === 'packaging' && (
                      <Btn color="blue" icon={<Microscope size={11} />} onClick={() => onAction('qcPack', b)}>
                        Pack QC
                      </Btn>
                    )}
                    {packagingUnlocked && b.bprStatus === 'qc_failed' && b.fillBatchAccepted === false && (
                      <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcFill', b)}>
                        Retry Fill QC
                      </Btn>
                    )}
                    {packagingUnlocked && b.bprStatus === 'qc_failed' && b.fgBatchAccepted === false && (
                      <Btn color="amber" icon={<Microscope size={11} />} onClick={() => onAction('qcPack', b)}>
                        Retry Pack QC
                      </Btn>
                    )}
                    {b.bprStatus === 'fg_ready' && (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <Check size={10} /> FG Ready
                      </Badge>
                    )}
                    {!packagingUnlocked && b.bmrStatus !== 'draft' && b.bprStatus === 'draft' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg">
                        <FlaskConical size={10} /> Packaging unlocks after bulk QC cleared
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onAction('detail', b)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg hover:bg-white/80 transition-colors"
                    >
                      <Eye size={10} /> Details
                    </button>
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
