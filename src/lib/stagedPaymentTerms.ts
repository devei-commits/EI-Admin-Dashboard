/** Staged payment terms stored as JSON on item_list_vendor_rates.payment_terms */

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
