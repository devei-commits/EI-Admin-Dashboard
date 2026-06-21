import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Eye,
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

function TrayLineCard({
  line,
  qtyKind,
}: {
  line: DispensingLineTrayDetail;
  qtyKind: 'kg' | 'pcs';
}): React.ReactElement {
  const isDone = line.status === 'done';
  const isPartial = line.status === 'partial';
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 min-w-0 h-full ${
        isDone
          ? 'border-emerald-200 bg-emerald-50/50'
          : isPartial
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs font-semibold text-gray-900 truncate leading-tight" title={line.label}>
        {line.label}
      </div>
      <div className="mt-1 font-mono text-xs font-bold text-gray-800 tabular-nums">
        {formatQtyExact(line.dispensed, qtyKind)} / {formatQtyExact(line.required, qtyKind)} {line.unit}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[10px] text-gray-500 leading-snug border-t border-gray-100 pt-1.5">
        <div className="truncate" title={line.trayLabel}>
          {line.trayLabel}
        </div>
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="font-mono truncate" title={line.code}>
            {line.code}
          </span>
          <span
            className={`shrink-0 ${
              isDone ? 'text-emerald-700 font-semibold' : isPartial ? 'text-amber-700 font-semibold' : 'text-gray-400'
            }`}
          >
            {line.statusText}
          </span>
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
}: {
  title: string;
  icon: string;
  dispensedCount: number;
  totalCount: number;
  lines: DispensingLineTrayDetail[];
  qtyKind: 'kg' | 'pcs';
  emptyLabel: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm" aria-hidden>{icon}</span>
        <div className="text-xs font-bold text-gray-800">
          {title} · <span className="text-orange-600">{dispensedCount}/{totalCount} dispensed</span>
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {lines.map((line) => (
            <TrayLineCard key={line.code} line={line} qtyKind={qtyKind} />
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
}: {
  batch: T;
  customerName: string;
  muSiteLabel: string;
  onAction: DispensingTrayViewProps<T>['onAction'];
}): React.ReactElement {
  const summary = summarizeBatchDispensing(batch.dispensingRM, batch.dispensingPM);
  const ctx = batchTrayContext(batch);
  const rmDetails = enrichDispensingTrayDetails(batch.dispensingRM, 'rm', ctx);
  const pmDetails = enrichDispensingTrayDetails(batch.dispensingPM, 'pm', ctx);
  const stageLabel = getDispensingStageLabel(batch.bmrStatus, batch.bprStatus, summary);
  const canRm = summary.rm.total > 0 || ['rm_connected', 'dispensing', 'in_production'].includes(batch.bmrStatus);
  const canPm = summary.pm.total > 0 || ['pm_connected', 'pm_dispensing', 'filling'].includes(batch.bprStatus);

  return (
    <article className="rounded-xl border border-orange-100 bg-white shadow-sm overflow-hidden">
      <header className="px-4 py-2.5 border-b border-orange-50 bg-gradient-to-r from-orange-50/80 to-amber-50/40">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-gray-900">
          <Sun size={14} className="text-amber-500 shrink-0" aria-hidden />
          <span>{formatUnifiedBatchLabel(batch)}</span>
          <span className="text-gray-400 font-normal">·</span>
          <span className="font-semibold truncate max-w-xs">{batch.productName}</span>
          <span className="text-gray-400 font-normal">·</span>
          <span className="font-normal">{batch.batchSize} KG</span>
          {muSiteLabel ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-1.5 py-0.5 ml-auto">
              <MapPin size={10} aria-hidden />
              {muSiteLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-600">
          <span>
            <span className="text-gray-400">SO </span>
            <span className="font-semibold">{batch.soNo}</span>
          </span>
          {customerName ? (
            <>
              <span className="text-gray-300">·</span>
              <span className="truncate max-w-48">{customerName}</span>
            </>
          ) : null}
          <span className="text-gray-300">·</span>
          <span className="font-bold uppercase tracking-wide text-purple-700">{stageLabel}</span>
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
        />
        <TraySection
          title="PM Tray"
          icon="📦"
          dispensedCount={summary.pm.dispensed}
          totalCount={summary.pm.total}
          lines={pmDetails}
          qtyKind="pcs"
          emptyLabel="No PM dispensing lines loaded for this batch."
        />
      </div>

      <footer className="px-4 pb-3 flex flex-wrap gap-2 border-t border-gray-50 pt-2">
        <button
          type="button"
          onClick={() => onAction('detail', batch)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Eye size={11} /> Batch detail
        </button>
        {canRm && (
          <button
            type="button"
            onClick={() => onAction('dispenseRM', batch)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <Scale size={11} />
            {summary.rm.status === 'complete' ? 'View RM dispensing' : 'RM dispensing'}
          </button>
        )}
        {canPm && (
          <button
            type="button"
            onClick={() => onAction('dispensePM', batch)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Scale size={11} />
            {summary.pm.status === 'complete' ? 'View PM dispensing' : 'PM dispensing'}
          </button>
        )}
        {summary.rm.total === 0 && summary.pm.total === 0 && (
          <p className="w-full text-xs text-amber-700 flex items-start gap-1.5 mt-1" role="status">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Open RM or PM dispensing to load BOM lines onto the tray.
          </p>
        )}
      </footer>
    </article>
  );
}

export function DispensingTrayView<T extends DispensingTrayBatch>({
  batches,
  onAction,
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

  const resolveCustomer = (soNo: string): string => customerBySo[soNo] || '';
  const resolveMuLabel = (zoneCode?: string): string => zoneLabelInAreas(productionAreas, zoneCode || '');

  return (
    <div className="flex flex-col h-full overflow-hidden section" id="section-dispensing-tray">
      <div className="sec-hdr flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <div className="sec-title text-lg font-bold text-gray-900 tracking-tight">Dispensing &amp; Tray</div>
          <div className="sec-sub text-[11px] text-gray-400 mt-0.5">
            Batch-wise RM &amp; PM tray — material, quantity, container slot, and dispense timestamp
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-2 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 font-semibold">{kpis.total} batches</span>
          <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">{kpis.rmActive} RM active</span>
          <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-semibold">{kpis.pmActive} PM active</span>
        </div>
      </div>

      <div className="filter-bar flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider shrink-0" htmlFor="dispensing-batch-filter">
          Batch:
        </label>
        <select
          id="dispensing-batch-filter"
          className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 min-w-48 max-w-xs focus:ring-1 focus:ring-purple-300 outline-none"
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

        <span className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider ml-2 shrink-0">Status:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`chip text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
              filter === opt.id ? 'active bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="relative flex-1 min-w-36 max-w-56 ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full text-[11px] pl-8 pr-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-purple-300"
            placeholder="Search code, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-[10px] font-semibold text-gray-500">{rows.length} shown</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
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
            />
          ))
        )}
      </div>
    </div>
  );
}
