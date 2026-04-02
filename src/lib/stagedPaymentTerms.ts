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

/**
 * Vendor master (VendorForm) saves a single line like:
 * `Advanced X% + Before dispatch Y% + After dispatch/On delivery Z%`
 * Parse into staged percents for display / Items List JSON.
 */
export function parseVendorThreeWayFromPlainText(raw: string | null | undefined): StagedPaymentTerms | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(
    /Advanced\s*([\d.]+)\s*%\s*\+\s*Before\s*dispatch\s*([\d.]+)\s*%\s*\+\s*After\s*dispatch(?:\/On\s*delivery)?\s*([\d.]+)\s*%/i,
  );
  if (!m) return null;
  return {
    advance_pct: clampPct(m[1]),
    pre_shipment_pct: clampPct(m[2]),
    post_shipment_pct: clampPct(m[3]),
    credit_days: 0,
  };
}

/**
 * Legacy one-line summary from `formatStagedPaymentTermsObject`
 * (e.g. Adv 0% · Pre 100% · Post 0% · Net 30d).
 */
export function parseStagedOneLineDotFormat(raw: string | null | undefined): StagedPaymentTerms | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(
    /Adv\s*([\d.]+)\s*%\s*·\s*Pre\s*([\d.]+)\s*%\s*·\s*Post\s*([\d.]+)\s*%/i,
  );
  if (!m) return null;
  let cd = 0;
  const netM = s.match(/Net\s*(\d+)\s*d/i);
  if (netM) cd = Math.max(0, parseInt(netM[1], 10));
  return {
    advance_pct: clampPct(m[1]),
    pre_shipment_pct: clampPct(m[2]),
    post_shipment_pct: clampPct(m[3]),
    credit_days: cd,
  };
}

/** Read payables* fields from vendor-client `data` blob (same keys as VendorForm / ClientForm). */
export function stagedPaymentTermsFromVendorData(
  data: Record<string, unknown> | null | undefined,
): StagedPaymentTerms | null {
  if (!data || typeof data !== 'object') return null;
  const adv = Number(String((data as { payablesAdvancedPct?: unknown }).payablesAdvancedPct ?? '').replace(/[^\d.-]/g, ''));
  const pre = Number(String((data as { payablesBeforeDispatchPct?: unknown }).payablesBeforeDispatchPct ?? '').replace(/[^\d.-]/g, ''));
  const post = Number(String((data as { payablesAfterDispatchPct?: unknown }).payablesAfterDispatchPct ?? '').replace(/[^\d.-]/g, ''));
  const a = Number.isFinite(adv) ? adv : 0;
  const b = Number.isFinite(pre) ? pre : 0;
  const c = Number.isFinite(post) ? post : 0;
  if (a === 0 && b === 0 && c === 0) return null;
  return {
    advance_pct: clampPct(a),
    pre_shipment_pct: clampPct(b),
    post_shipment_pct: clampPct(c),
    credit_days: 0,
  };
}

/**
 * RM/PM vendor picker: staged terms from JSON `payment_terms`, else VendorForm payables in `data`,
 * else legacy one-line dot format, else `parsePaymentTermsString` → staged.
 */
export function resolveStagedPaymentTermsFromVendorRecord(
  paymentTerms: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
): StagedPaymentTerms {
  const rawTop = (paymentTerms ?? '').trim();
  const rawFromData =
    data && typeof data === 'object'
      ? String((data as Record<string, unknown>).paymentTerms ?? '').trim()
      : '';
  /** Prefer row-level `paymentTerms`; else `data.paymentTerms` (Vendor Master stores both). */
  const raw = rawTop || rawFromData;
  if (raw.startsWith('{')) {
    const j = parseStagedPaymentTerms(raw);
    if (j) return j;
  }
  const fromData = stagedPaymentTermsFromVendorData(data);
  if (fromData) return fromData;
  const threeWay = parseVendorThreeWayFromPlainText(raw);
  if (threeWay) return threeWay;
  const dot = parseStagedOneLineDotFormat(raw);
  if (dot) return dot;
  const parsed = parsePaymentTermsString(raw);
  return stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent);
}

/**
 * Merge credit days from ClientForm `data.receivablesCreditDays` when JSON/text has no credit period.
 */
export function mergeCreditDaysFromClientData(
  staged: StagedPaymentTerms,
  data: Record<string, unknown> | null | undefined,
): StagedPaymentTerms {
  if (!data || typeof data !== 'object') return staged;
  if (staged.credit_days > 0) return staged;
  const raw =
    (data as { receivablesCreditDays?: unknown }).receivablesCreditDays ??
    (data as { creditDays?: unknown }).creditDays;
  const n = Math.max(0, Math.floor(Number(String(raw ?? '').replace(/[^\d]/g, '')) || 0));
  if (n <= 0) return staged;
  return { ...staged, credit_days: n };
}

/**
 * Resolve staged payment terms for Fulfillment SO from customer master:
 * JSON on `payment_terms`, else ClientForm payables % in `data`, else legacy `payment_terms` text.
 */
export function resolveStagedPaymentTermsFromCustomerMaster(
  rawPaymentTerms: string | null | undefined,
  clientData: Record<string, unknown> | null | undefined,
): StagedPaymentTerms {
  const trimmed = (rawPaymentTerms ?? '').trim();
  if (trimmed.startsWith('{')) {
    const j = parseStagedPaymentTerms(trimmed);
    if (j) return mergeCreditDaysFromClientData(j, clientData);
  }
  const fromData = stagedPaymentTermsFromVendorData(clientData);
  if (fromData) {
    return mergeCreditDaysFromClientData({ ...fromData, credit_days: fromData.credit_days }, clientData);
  }
  const parsed = parsePaymentTermsString(trimmed);
  return mergeCreditDaysFromClientData(
    stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent),
    clientData,
  );
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
  const A = clampPct(a);
  const B = clampPct(b);
  const C = clampPct(c);
  const t = A + B + C;
  if (t > 100.0001) {
    return `Advance + pre-shipment + post-shipment must total at most 100% (currently ${t.toFixed(1)}%).`;
  }
  /** All zero = unset / "as per contract" — no staged split to validate. */
  if (A === 0 && B === 0 && C === 0) return null;
  if (Math.abs(t - 100) > 0.01) {
    return `Advance + pre-shipment + post-shipment must total exactly 100% (currently ${t.toFixed(1)}%).`;
  }
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

/** Invoice due offset (days after invoice date) from stored payment_terms JSON or legacy text. */
export function creditDaysFromPaymentTermsStored(raw: string | null | undefined): number {
  const s = (raw ?? '').trim();
  if (s.startsWith('{')) {
    const j = parseStagedPaymentTerms(s);
    if (j) return Math.max(0, Math.floor(Number(j.credit_days) || 0));
  }
  if (!s) return 30;
  const parsed = parsePaymentTermsString(s);
  switch (parsed.type) {
    case 'net_15':
      return 15;
    case 'net_30':
      return 30;
    case 'net_45':
      return 45;
    case 'net_60':
      return 60;
    case 'cod':
      return 0;
    default:
      return 30;
  }
}
