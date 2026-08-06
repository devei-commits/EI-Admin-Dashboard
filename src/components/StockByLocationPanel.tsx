import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { StockByLocationPayload } from '../services/warehouseInventory.service';
import {
  formatQtyInputDisplay,
  parseQtyInputString,
  sanitizeQtyInputString,
} from '../utils/qtyInput';

export type RackQtyDraft = { rackId: number; qtyWh: number };

export type WhDistributionSegment = {
  locationName: string;
  locationCode: string;
  rackCode: string;
  qty: number;
  pct: number;
};

interface Props {
  data: StockByLocationPayload | null;
  loading: boolean;
  compact?: boolean;
  /** distribution = total + per-rack breakdown (non-zero only); detail = zone/rack tree; both = summary then tree */
  viewMode?: 'distribution' | 'detail' | 'both';
  /** Hide warehouse zones/racks (e.g. ML1/ML2 popover). */
  warehouseOnly?: boolean;
  /** Hide warehouse; show ML1/ML2 only. */
  manufacturingOnly?: boolean;
  editable?: boolean;
  rackDraft?: RackQtyDraft[] | null;
  onRackQtyChange?: (rackId: number, qtyWh: number) => void;
}

function qtyForRack(draft: RackQtyDraft[] | null | undefined, rackId: number, fallback: number): number {
  if (!draft) return fallback;
  const row = draft.find((d) => d.rackId === rackId);
  return row != null ? row.qtyWh : fallback;
}

export function buildWhDistribution(
  data: StockByLocationPayload,
  rackDraft?: RackQtyDraft[] | null,
  editable?: boolean
): { unit: string; total: number; segments: WhDistributionSegment[]; unallocated: number } {
  const unit = data.whUnit || 'KG';
  const total =
    editable && rackDraft
      ? rackDraft.reduce((s, r) => s + (Number.isFinite(r.qtyWh) ? r.qtyWh : 0), 0)
      : data.whStock;

  const segments: WhDistributionSegment[] = [];
  for (const loc of data.warehouse) {
    for (const r of loc.racks) {
      const qty = qtyForRack(rackDraft, r.rackId, r.qtyWh);
      if (qty > 0) {
        segments.push({
          locationName: loc.locationName,
          locationCode: loc.locationCode,
          rackCode: r.rackCode,
          qty,
          pct: total > 0 ? Math.round((qty / total) * 1000) / 10 : 0,
        });
      }
    }
  }
  segments.sort((a, b) => b.qty - a.qty);

  const rackSum = segments.reduce((s, x) => s + x.qty, 0);
  const unallocated = editable ? Math.max(0, total - rackSum) : data.unallocatedWh;

  return { unit, total, segments, unallocated };
}

export function MuStockDistributionSummary({
  data,
  compact,
}: {
  data: StockByLocationPayload;
  compact?: boolean;
}) {
  const unit = data.whUnit || 'KG';
  const ml1 = data.ml1Stock ?? data.manufacturing.find((m) => m.bucket === 'ML1')?.qty ?? 0;
  const ml2 = data.ml2Stock ?? data.manufacturing.find((m) => m.bucket === 'ML2')?.qty ?? 0;
  const total = ml1 + ml2;
  const zones = data.manufacturingZones ?? [];

  const segments: WhDistributionSegment[] = [];
  for (const loc of zones) {
    for (const r of loc.racks) {
      if (r.qtyWh > 0) {
        segments.push({
          locationName: loc.locationName,
          locationCode: loc.locationCode,
          rackCode: r.rackCode,
          qty: r.qtyWh,
          pct: total > 0 ? Math.round((r.qtyWh / total) * 1000) / 10 : 0,
        });
      }
    }
  }
  segments.sort((a, b) => b.qty - a.qty);

  return (
    <div className={`rounded-lg border border-brand-soft bg-brand-soft ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex flex-wrap gap-2 mb-2 text-[10px]">
        <span className="font-bold text-brand">
          ML1 total: {ml1} {unit}
        </span>
        <span className="font-bold text-brand">
          ML2 total: {ml2} {unit}
        </span>
        <span className="text-ink-2">
          MU total: {total} {unit}
        </span>
      </div>
      {segments.length === 0 ? (
        <p className="text-[11px] text-ink-2">
          {total > 0
            ? `Stock at ML1/ML2 not yet assigned to manufacturing racks.`
            : 'No manufacturing stock on racks.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {segments.map((seg) => (
            <li key={`${seg.locationCode}-${seg.rackCode}`}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-ink">
                  <span className="font-semibold text-brand tabular-nums">
                    {seg.qty} {unit}
                  </span>
                  <span className="text-ink-3"> — </span>
                  {seg.locationName}
                  <span className="text-ink-4 font-mono text-[10px]"> ({seg.locationCode})</span>
                  <span className="text-ink-3"> · rack </span>
                  <span className="font-mono font-semibold">{seg.rackCode}</span>
                </span>
                <span className="text-[10px] font-semibold text-brand">{seg.pct}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(data.unallocatedMl ?? 0) > 0 && (
        <p className="text-[10px] text-warn mt-2">
          Not on racks: {data.unallocatedMl} {unit}
        </p>
      )}
    </div>
  );
}

export function WhStockDistributionSummary({
  data,
  rackDraft,
  editable,
  compact,
}: {
  data: StockByLocationPayload;
  rackDraft?: RackQtyDraft[] | null;
  editable?: boolean;
  compact?: boolean;
}) {
  const { unit, total, segments, unallocated } = buildWhDistribution(data, rackDraft, editable);

  return (
    <div className={`rounded-lg border border-brand-soft bg-brand-soft ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Total WH stock</span>
        <span className="text-lg font-bold text-brand tabular-nums">
          {total} <span className="text-sm font-semibold">{unit}</span>
        </span>
      </div>

      {segments.length === 0 ? (
        <p className="text-[11px] text-ink-2">
          {total > 0
            ? `All ${total} ${unit} is not assigned to a rack yet.`
            : 'No warehouse stock on racks.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {segments.map((seg) => (
            <li key={`${seg.locationCode}-${seg.rackCode}`}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-ink">
                  <span className="font-semibold text-brand tabular-nums">
                    {seg.qty} {unit}
                  </span>
                  <span className="text-ink-3"> — </span>
                  {seg.locationName}
                  <span className="text-ink-4 font-mono text-[10px]"> ({seg.locationCode})</span>
                  <span className="text-ink-3"> · rack </span>
                  <span className="font-mono font-semibold text-ink-2">{seg.rackCode}</span>
                </span>
                <span className="text-[10px] font-semibold text-brand shrink-0">{seg.pct}%</span>
              </div>
              <div
                className="mt-1 h-1.5 rounded-full bg-brand-soft overflow-hidden"
                role="presentation"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${Math.min(100, seg.pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {unallocated > 0 && (
        <p className="text-[10px] text-warn mt-2 pt-2 border-t border-brand-soft">
          Unallocated on racks: <span className="font-semibold">{unallocated}</span> {unit}
        </p>
      )}

      {segments.length > 1 && (
        <p className="text-[10px] text-ink-3 mt-2">
          Sum of rack lines: {segments.reduce((s, x) => s + x.qty, 0)} {unit}
          {Math.abs(segments.reduce((s, x) => s + x.qty, 0) - total) < 0.01
            ? ' (matches total)'
            : ` (total WH: ${total} ${unit})`}
        </p>
      )}
    </div>
  );
}

const StockByLocationPanel: React.FC<Props> = ({
  data,
  loading,
  compact,
  viewMode = 'detail',
  warehouseOnly = false,
  manufacturingOnly = false,
  editable,
  rackDraft,
  onRackQtyChange,
}) => {
  const [rackQtyInputById, setRackQtyInputById] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!editable || !rackDraft) {
      setRackQtyInputById({});
      return;
    }
    setRackQtyInputById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const d of rackDraft) {
        if (!(d.rackId in next)) {
          next[d.rackId] = formatQtyInputDisplay(d.qtyWh);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [editable, rackDraft]);

  if (loading) {
    return <p className="text-[11px] text-ink-3">Loading stock by location…</p>;
  }
  if (!data) {
    return <p className="text-[11px] text-ink-3">No location breakdown available.</p>;
  }

  const unit = data.whUnit || 'KG';
  const pad = compact ? 'p-2' : 'p-3';
  const showDistribution = viewMode === 'distribution' || viewMode === 'both';
  const showDetail = viewMode === 'detail' || viewMode === 'both';

  const whTotalFromDraft =
    editable && rackDraft
      ? rackDraft.reduce((s, r) => s + (Number.isFinite(r.qtyWh) ? r.qtyWh : 0), 0)
      : data.whStock;

  return (
    <div className="space-y-3">
      {!manufacturingOnly && showDistribution && (
        <>
        <p className="text-[10px] font-semibold text-brand mb-1 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-brand-soft">Warehouse</span>
          {data.itemType === 'PM'
            ? 'Packaging (PM) storage'
            : data.itemType === 'RM'
              ? 'RM storage'
              : data.itemType === 'PR'
                ? 'Finished goods storage'
                : 'GRN & storage'}
        </p>
        <WhStockDistributionSummary
          data={data}
          rackDraft={rackDraft}
          editable={editable}
          compact={compact}
        />
        </>
      )}

      {!manufacturingOnly && showDetail && (
        <section>
          {viewMode === 'both' && (
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-2 mb-1.5">
              {editable ? 'Edit per rack' : 'All zones & racks'}
            </h4>
          )}
          {viewMode === 'detail' && (
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1.5">
              Warehouse locations
            </h4>
          )}
          {data.warehouse.length === 0 ? (
            <p className="text-[11px] text-ink-3">
              No warehouse zones configured. WH total: {data.whStock} {unit}.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.warehouse.map((loc) => {
                const locTotal = loc.racks.reduce(
                  (s, r) => s + qtyForRack(rackDraft, r.rackId, r.qtyWh),
                  0
                );
                // Show only racks that actually hold stock when viewing; while editing keep every rack
                // visible so stock can be assigned to an empty one. Zones with no stocked rack are hidden.
                const racksToShow = editable
                  ? loc.racks
                  : loc.racks.filter((r) => qtyForRack(rackDraft, r.rackId, r.qtyWh) > 0);
                if (!editable && racksToShow.length === 0) {
                  return null;
                }
                return (
                  <li
                    key={loc.locationId}
                    className={`text-[11px] border border-border rounded-lg ${pad} bg-surface`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>{loc.locationName}</span>
                      <span className="text-ink-4 font-mono text-[10px]">({loc.locationCode})</span>
                      {loc.isDefault && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-warn-soft text-warn">
                          Default
                        </span>
                      )}
                      <span className="ml-auto text-brand font-semibold">
                        {locTotal} {unit}
                      </span>
                    </div>
                    {racksToShow.map((r) => {
                      const qty = qtyForRack(rackDraft, r.rackId, r.qtyWh);
                      return (
                        <div
                          key={r.rackId}
                          className="mt-1 pl-5 flex items-center gap-2 text-[10px] text-ink-2"
                        >
                          <span className="font-mono w-14 shrink-0">{r.rackCode}</span>
                          {editable && onRackQtyChange ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                rackQtyInputById[r.rackId] ??
                                formatQtyInputDisplay(qty)
                              }
                              onChange={(e) => {
                                const sanitized = sanitizeQtyInputString(e.target.value);
                                setRackQtyInputById((prev) => ({
                                  ...prev,
                                  [r.rackId]: sanitized,
                                }));
                                onRackQtyChange(r.rackId, parseQtyInputString(sanitized));
                              }}
                              className="w-20 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface"
                              aria-label={`Rack ${r.rackCode} quantity`}
                            />
                          ) : (
                            <span className="font-mono">
                              {qty} {unit}
                            </span>
                          )}
                          {editable && <span className="text-ink-4">{unit}</span>}
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
          {!editable && viewMode === 'detail' && data.unallocatedWh > 0 && (
            <p className="text-[10px] text-warn mt-1.5">
              Unallocated WH: {data.unallocatedWh} {unit} (not assigned to a rack)
            </p>
          )}
          {editable && (
            <p className="text-[10px] text-ink-2 mt-1.5">
              WH total from racks: <span className="font-semibold text-brand">{whTotalFromDraft}</span>{' '}
              {unit} — saved with Stock &amp; pipeline.
            </p>
          )}
        </section>
      )}

      {!warehouseOnly && (
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1.5 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand">Manufacturing unit</span>
            MTR transfers from warehouse
          </h4>
          {(viewMode === 'distribution' || viewMode === 'both') && (
            <MuStockDistributionSummary data={data} compact={compact} />
          )}
          {showDetail && (data.manufacturingZones?.length ?? 0) > 0 && (
            <ul className="space-y-1.5 mt-2">
              {data.manufacturingZones!.map((loc) => {
                // Viewing: only racks holding stock (skip a zone entirely if none). Editing keeps all.
                const racksToShow = editable ? loc.racks : loc.racks.filter((r) => r.qtyWh > 0);
                if (!editable && racksToShow.length === 0) return null;
                return (
                  <li
                    key={loc.locationId}
                    className={`text-[11px] border border-brand-soft rounded-lg ${pad} bg-surface`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>{loc.locationName}</span>
                      <span className="text-ink-4 font-mono text-[10px]">({loc.locationCode})</span>
                      {loc.isDefault && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-warn-soft text-warn">
                          Default MU
                        </span>
                      )}
                      <span className="ml-auto text-brand font-semibold">
                        {loc.totalQtyWh} {unit}
                      </span>
                    </div>
                    {racksToShow.map((r) => (
                      <div key={r.rackId} className="mt-1 pl-5 text-[10px] text-ink-2 font-mono">
                        {r.rackCode}: {r.qtyWh} {unit}
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
          {!manufacturingOnly && viewMode !== 'distribution' && (
            <p className="text-[10px] text-ink-3 mt-1.5">
              ML1 / ML2 column totals match manufacturing racks after MTR complete.
            </p>
          )}
        </section>
      )}
    </div>
  );
};

export default StockByLocationPanel;
