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
    slate: 'border-slate-200 bg-slate-50/80',
    cyan: 'border-cyan-200 bg-cyan-50/70',
    amber: 'border-amber-200 bg-amber-50/70',
    blue: 'border-blue-200 bg-blue-50/70',
    rose: 'border-rose-200 bg-rose-50/70',
    emerald: 'border-emerald-200 bg-emerald-50/70',
    indigo: 'border-indigo-200 bg-indigo-50/70',
  };
  const valueClasses: Record<typeof tone, string> = {
    slate: 'text-slate-900',
    cyan: 'text-cyan-900',
    amber: 'text-amber-900',
    blue: 'text-blue-900',
    rose: 'text-rose-900',
    emerald: 'text-emerald-900',
    indigo: 'text-indigo-900',
  };

  return (
    <div className={`rounded-lg border p-2.5 sm:p-3 min-w-0 ${toneClasses[tone]}`}>
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-base sm:text-lg font-extrabold tabular-nums leading-tight mt-0.5 ${valueClasses[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p>
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
      className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-4 shadow-sm"
      aria-label="Inventory and demand summary"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
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
            coverageOk ? 'border-emerald-200 bg-emerald-50/80' : 'border-red-200 bg-red-50/80'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-500">Coverage</p>
            <p
              className={`text-sm sm:text-base font-extrabold mt-0.5 inline-flex items-center gap-1 ${
                coverageOk ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {coverageOk ? <Check size={16} className="shrink-0" aria-hidden /> : <AlertTriangle size={16} className="shrink-0" aria-hidden />}
              {coverageLabel}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Supply {fmt(item.supplyTowardGrossNum)} vs req {fmt(item.totalRequired)}
            </p>
          </div>
        </div>
      </div>
      {vendorHint ? (
        <p className="text-[11px] text-slate-600 mt-2.5 pt-2.5 border-t border-slate-200/80 font-medium truncate" title={vendorHint}>
          {vendorHint}
        </p>
      ) : null}
    </section>
  );
}
