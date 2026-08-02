import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { formatQtyExact } from '../../utils/formatQty';
import { itemsInvolvedUsesDecimalQty, normRmPrimaryUom } from '../../lib/rmUnitConversion';

export interface ItemsInvolvedReleaseInventoryItem {
  itemType: 'RM' | 'PM';
  unit: string;
  totalRequired: number;
  batchCount: number;
  sihNum: number;
  reservedNum: number;
  plannedQtyNum: number;
  poQtyNum: number;
  inTransitQtyNum: number;
  netNum: number;
  supplyTowardGrossNum: number;
  coverage: string;
}

function fmtQty(value: number, itemType: 'RM' | 'PM', unit?: string): string {
  if (!Number.isFinite(Number(value))) return '0';
  const kind = itemsInvolvedUsesDecimalQty(itemType, unit) ? 'kg' : 'pcs';
  return formatQtyExact(value, kind);
}

function unitLabel(itemType: 'RM' | 'PM', unit?: string): string {
  if (itemType === 'PM') return 'pcs';
  return normRmPrimaryUom(unit);
}

function StatCard({
  label,
  value,
  subtitle,
  tone = 'slate',
}: {
  label: string;
  value: string;
  subtitle: string;
  tone?: 'slate' | 'cyan' | 'amber' | 'blue' | 'rose' | 'emerald' | 'indigo';
}): React.ReactElement {
  const toneClasses: Record<typeof tone, string> = {
    slate: 'border-border bg-surface-2/80',
    cyan: 'border-brand-soft bg-brand-soft/70',
    amber: 'border-warn-soft bg-warn-soft/70',
    blue: 'border-brand-soft bg-brand-soft/70',
    rose: 'border-err-soft bg-err-soft/70',
    emerald: 'border-ok-soft bg-ok-soft/70',
    indigo: 'border-brand-soft bg-brand-soft/70',
  };
  const valueClasses: Record<typeof tone, string> = {
    slate: 'text-ink',
    cyan: 'text-brand',
    amber: 'text-warn',
    blue: 'text-brand',
    rose: 'text-err',
    emerald: 'text-ok',
    indigo: 'text-brand',
  };

  return (
    <div className={`rounded-lg border p-2.5 sm:p-3 min-w-0 ${toneClasses[tone]}`}>
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`text-base sm:text-lg font-extrabold tabular-nums leading-tight mt-0.5 ${valueClasses[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-ink-3 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}

export function ItemsInvolvedReleaseInventoryPanel({
  item,
  vendorHint,
}: {
  item: ItemsInvolvedReleaseInventoryItem;
  vendorHint?: string | null;
}): React.ReactElement {
  const u = unitLabel(item.itemType, item.unit);
  const fmt = (n: number) => fmtQty(n, item.itemType, item.unit);
  const physicalSih = Math.max(0, (Number(item.sihNum) || 0) + (Number(item.reservedNum) || 0));
  const available = Math.max(0, Number(item.sihNum) || 0);
  const batchCount = Math.max(0, Number(item.batchCount) || 0);
  const coverageOk = Number(item.netNum) >= -1e-6;
  const coverageLabel = coverageOk ? 'OK' : item.coverage || 'Short';

  return (
    <section
      className="mb-4 rounded-xl border border-border bg-surface-2 p-3 sm:p-4 shadow-[var(--e1)]"
      aria-label="Inventory and demand summary"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-2.5">
        Inventory context (same as Warehouse → Inventory)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
        <StatCard
          label="Consolidated Req"
          value={fmt(item.totalRequired)}
          subtitle={`${u}${batchCount > 0 ? ` · ${batchCount} batch${batchCount === 1 ? '' : 'es'}` : ''}`}
          tone="indigo"
        />
        <StatCard
          label="SIH"
          value={fmt(physicalSih)}
          subtitle="all locations"
          tone="cyan"
        />
        <StatCard
          label="Reserved"
          value={fmt(item.reservedNum)}
          subtitle="already locked"
          tone="amber"
        />
        <StatCard
          label="Planned Qty"
          value={fmt(item.plannedQtyNum)}
          subtitle="in open requests"
          tone="blue"
        />
        <StatCard
          label="Under PO"
          value={fmt(item.poQtyNum)}
          subtitle={
            item.inTransitQtyNum > 0
              ? `in transit ${fmt(item.inTransitQtyNum)}`
              : 'on vendor PO'
          }
          tone="rose"
        />
        <StatCard
          label="Available"
          value={fmt(available)}
          subtitle="SIH − Reserved"
          tone="emerald"
        />
        <div
          className={`col-span-2 sm:col-span-3 rounded-lg border p-2.5 sm:p-3 flex items-center justify-between gap-2 min-w-0 ${
            coverageOk ? 'border-ok-soft bg-ok-soft/80' : 'border-err-soft bg-err-soft/80'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-ink-3">Coverage</p>
            <p
              className={`text-sm sm:text-base font-extrabold mt-0.5 inline-flex items-center gap-1 ${
                coverageOk ? 'text-ok' : 'text-err'
              }`}
            >
              {coverageOk ? <Check size={16} className="shrink-0" aria-hidden /> : <AlertTriangle size={16} className="shrink-0" aria-hidden />}
              {coverageLabel}
            </p>
            <p className="text-[10px] text-ink-3 mt-0.5 leading-snug">
              Supply {fmt(item.supplyTowardGrossNum)} vs req {fmt(item.totalRequired)}
            </p>
          </div>
        </div>
      </div>
      {vendorHint ? (
        <p className="text-[11px] text-ink-2 mt-2.5 pt-2.5 border-t border-border/80 font-medium truncate" title={vendorHint}>
          {vendorHint}
        </p>
      ) : null}
    </section>
  );
}
