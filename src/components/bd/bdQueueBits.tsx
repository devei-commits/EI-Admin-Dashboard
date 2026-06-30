/**
 * Shared light-design building blocks for the BD Phase-2 queues (§3F/§3G/§3H):
 * status pills, SLA clock cell, client identity cell, source/severity tags.
 * Lucide icons only — mirrors the Customer Tracker chrome.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock } from 'lucide-react';
import {
  TIER_CONFIG, SOURCE_CONFIG, SLA_LEVEL_CLASSES, SLA_LEVEL_ICON, slaLevelFromHours,
  formatDMY, type StatusConfig, type BdSource,
} from '../../constants/bd';
import type { BdClientChip } from '../../types/bd.types';

/** Generic status pill from any StatusConfig (tier/lifecycle/query/grievance/meeting). */
export function StatusPill({ cfg, icon: Icon }: { cfg?: StatusConfig; icon?: LucideIcon }) {
  if (!cfg) return <span className="text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      {Icon && <Icon size={10} className="shrink-0" />} {cfg.label}
    </span>
  );
}

export function SourceTag({ origin }: { origin: BdSource }) {
  const c = SOURCE_CONFIG[origin] ?? SOURCE_CONFIG.customer;
  return <span className={`rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
}

/** Customer identity cell: C-code (mono) + name + tier chip. */
export function ClientCell({ client, onOpen }: { client: BdClientChip; onOpen?: (code: string) => void }) {
  const tier = TIER_CONFIG[client.tier] ?? TIER_CONFIG.bronze;
  const TierIcon = tier.icon;
  const body = (
    <>
      <span className="block font-mono text-[11px] font-semibold text-blue-600">{client.displayCode}</span>
      <span className="block max-w-[160px] truncate text-xs font-semibold text-slate-800" title={client.name}>{client.name}</span>
      <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${tier.text} ${tier.bg} ${tier.border}`}>
        <TierIcon size={9} className="shrink-0" /> {tier.label}
      </span>
    </>
  );
  return onOpen && client.code
    ? <button onClick={() => onOpen(client.code as string)} className="text-left hover:underline decoration-dotted">{body}</button>
    : <div className="text-left">{body}</div>;
}

/**
 * SLA clock: hours elapsed (open) or hours-to-resolve (closed) vs target.
 * Green ok / amber warn / red breached. Returns '—' when no target.
 */
export function SlaCell({ createdAt, targetHrs, resolvedAt, now = Date.now() }:
  { createdAt: string; targetHrs: number | null; resolvedAt?: string | null; now?: number }) {
  if (!targetHrs) return <span className="text-slate-400">—</span>;
  const start = new Date(createdAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : now;
  const hrs = Math.max(0, (end - start) / 3_600_000);
  const level = slaLevelFromHours(hrs, targetHrs);
  const Icon = SLA_LEVEL_ICON[level];
  const label = resolvedAt
    ? (level === 'bad' ? 'late' : 'on time')
    : (hrs >= 24 ? `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h` : `${Math.round(hrs)}h`);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${SLA_LEVEL_CLASSES[level]}`} title={`Target ${targetHrs}h`}>
      <Icon size={11} className="shrink-0" /> {label}
    </span>
  );
}

/** "Related To" chip — type + ref (e.g. "Order · SO-123"). */
export function RelatedCell({ type, ref, info }: { type: string | null; ref: string | null; info: string | null }) {
  if (!type && !ref && !info) return <span className="text-slate-400">—</span>;
  return (
    <div className="text-[11px] text-slate-600">
      {type && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{type}</span>}
      {ref && <span className="ml-1 font-mono text-slate-500">{ref}</span>}
      {info && <span className="mt-0.5 block max-w-[150px] truncate text-slate-400" title={info}>{info}</span>}
    </div>
  );
}

export function MetaClock({ date, label }: { date: string | null; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <Clock size={11} className="shrink-0 text-slate-400" /> {label ? `${label} ` : ''}{formatDMY(date)}
    </span>
  );
}

/** Read-only labelled field for the detail popups. */
export const ReadField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-0.5 text-sm text-slate-800">{children}</div>
  </div>
);
