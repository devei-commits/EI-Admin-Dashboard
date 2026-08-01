import React, { ReactNode } from 'react';

export interface StatCardTrend {
 /** e.g. "+12%" or "3 new" */
 label: string;
 direction?: 'up' | 'down' | 'flat';
}

type StatTone = 'default' | 'brand' | 'ok' | 'warn' | 'err';

interface StatCardProps {
 /** Optional leading icon tile. Omit for a plain label/value KPI. */
 icon?: ReactNode;
 title: string;
 value: string | number;
 description?: string;
 /** Icon tile background (Tailwind class). Defaults to the brand-soft token. */
 iconBgClass?: string;
 /** Icon color (Tailwind class). Defaults to the brand token. */
 iconColorClass?: string;
 /** Value color tone (folds ProcStatCards' tone). */
 tone?: StatTone;
 /** Optional trend chip shown at the top-right. */
 trend?: StatCardTrend;
}

const TREND_TONE: Record<NonNullable<StatCardTrend['direction']>, string> = {
 up: 'bg-[color:var(--st-green-bg)] text-[color:var(--st-green-fg)]',
 down: 'bg-[color:var(--st-red-bg)] text-[color:var(--st-red-fg)]',
 flat: 'bg-[color:var(--st-neutral-bg)] text-[color:var(--st-neutral-fg)]',
};

const VALUE_TONE: Record<StatTone, string> = {
 default: 'text-ink',
 brand: 'text-brand',
 ok: 'text-ok',
 warn: 'text-warn',
 err: 'text-err',
};

/** KPI recipe — surface card, optional icon tile, tabular value, optional trend chip / tone. Theme-aware. */
export const StatCard: React.FC<StatCardProps> = ({
 icon,
 title,
 value,
 description,
 iconBgClass = 'bg-brand-soft',
 iconColorClass = 'text-brand',
 tone = 'default',
 trend,
}) => (
 <div className="bg-surface rounded-[var(--r-lg)] p-4 shadow-[var(--e1)] border border-hairline">
  <div className="flex items-start gap-3">
   {icon && (
    <div className={`p-2 rounded-[var(--r-sm)] ${iconBgClass}`}>
     <span className={iconColorClass}>{icon}</span>
    </div>
   )}
   <div className="min-w-0 flex-1">
    <div className="flex items-center justify-between gap-2">
     <p className="text-sm text-ink-3 truncate">{title}</p>
     {trend && (
      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${TREND_TONE[trend.direction ?? 'flat']}`}>
       {trend.label}
      </span>
     )}
    </div>
    <p className={`text-[28px] leading-tight font-semibold tabular-nums tracking-tight ${VALUE_TONE[tone]}`}>{value}</p>
    {description && <p className="text-xs text-ink-4 mt-0.5">{description}</p>}
   </div>
  </div>
 </div>
);

export default StatCard;
