/** Staged payment terms stored as JSON on item_list_vendor_rates.payment_terms */

import {
  parsePaymentTermsString,
  type PaymentTermsStructuredType,
} from './paymentTermsStructured';

export interface StagedPaymentTerms {
  advance_pct: number;
  pre_shipment_pct: number;
  post_shipment_pct: number;
  credit_days: number;
}

export function clampPct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function parseStagedPaymentTerms(raw: string | null | undefined): StagedPaymentTerms | null {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (!s.startsWith('{')) return null;
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    return {
      advance_pct: clampPct(o.advance_pct ?? o.advancePct),
      pre_shipment_pct: clampPct(o.pre_shipment_pct ?? o.preShipmentPct),
      post_shipment_pct: clampPct(o.post_shipment_pct ?? o.postShipmentPct),
      credit_days: o.credit_days != null || o.creditDays != null
        ? Math.max(0, Math.floor(Number(o.credit_days ?? o.creditDays)))
        : 0,
    };
  } catch {
    return null;
  }
}

export function serializeStagedPaymentTerms(p: StagedPaymentTerms): string {
  return JSON.stringify({
    advance_pct: clampPct(p.advance_pct),
    pre_shipment_pct: clampPct(p.pre_shipment_pct),
    post_shipment_pct: clampPct(p.post_shipment_pct),
    credit_days: Math.max(0, Math.floor(Number(p.credit_days) || 0)),
  });
}

export function validateStagedPercents(a: number, b: number, c: number): string | null {
  const t = clampPct(a) + clampPct(b) + clampPct(c);
  if (t > 100.0001) return `Advance + pre-shipment + post-shipment must total at most 100% (currently ${t.toFixed(1)}%).`;
  return null;
}

/** Map Planning / SO structured type + advance % to staged percents (aligned with Items List defaults). */
export function stagedPaymentTermsFromStructured(
  type: PaymentTermsStructuredType,
  advancePercent: number
): StagedPaymentTerms {
  const p = Math.max(0, Math.min(100, Math.round(Number(advancePercent) || 0)));
  const rest = Math.max(0, 100 - p);
  switch (type) {
    case 'net_15':
      return { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 15 };
    case 'net_30':
      return { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 30 };
    case 'net_45':
      return { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 45 };
    case 'net_60':
      return { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 60 };
    case 'advance_before_dispatch':
      return { advance_pct: p, pre_shipment_pct: rest, post_shipment_pct: 0, credit_days: 0 };
    case 'advance_on_delivery':
      return { advance_pct: p, pre_shipment_pct: 0, post_shipment_pct: rest, credit_days: 0 };
    case 'cod':
      return { advance_pct: 0, pre_shipment_pct: 0, post_shipment_pct: 100, credit_days: 0 };
    case 'as_per_contract':
    default:
      return { advance_pct: 0, pre_shipment_pct: 0, post_shipment_pct: 0, credit_days: 0 };
  }
}

export function formatStagedPaymentTermsObject(p: StagedPaymentTerms): string {
  const cd = Math.max(0, Math.floor(Number(p.credit_days) || 0));
  return `Adv ${clampPct(p.advance_pct)}% · Pre ${clampPct(p.pre_shipment_pct)}% · Post ${clampPct(p.post_shipment_pct)}%${cd ? ` · Net ${cd}d` : ''}`;
}

/**
 * One-line summary for tables (Items List, Planning vendor rows). Uses JSON when present; otherwise legacy text → structured → staged.
 */
export function formatStagedPaymentTermsSummary(raw: string | null | undefined): string {
  const staged = parseStagedPaymentTerms(raw ?? '');
  if (staged) return formatStagedPaymentTermsObject(staged);
  const parsed = parsePaymentTermsString(raw ?? '');
  if (parsed.type === 'as_per_contract') return (raw?.trim() || 'As per contract');
  return formatStagedPaymentTermsObject(stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent));
}

/** Prefer rate JSON when `raw` is valid staged JSON; else derive from structured type + advance %. */
export function resolveStagedPaymentTermsForForm(
  raw: string | null | undefined,
  type: PaymentTermsStructuredType,
  advancePercent: number
): StagedPaymentTerms {
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed) {
    const j = parseStagedPaymentTerms(trimmed);
    if (j) return j;
  }
  return stagedPaymentTermsFromStructured(type, advancePercent);
}
