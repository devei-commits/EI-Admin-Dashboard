/**
 * Structured payment terms: type + advance % → single string for APIs that store one field.
 * Aligns with Planning “Release to PO” style (advance split vs net vs COD vs contract).
 */

export type PaymentTermsStructuredType =
  | 'advance_on_delivery'
  | 'advance_before_dispatch'
  | 'net_15'
  | 'net_30'
  | 'net_45'
  | 'net_60'
  | 'cod'
  | 'as_per_contract';

export const PAYMENT_TERMS_TYPE_OPTIONS: { value: PaymentTermsStructuredType; label: string }[] = [
  { value: 'advance_on_delivery', label: 'Advance — balance on delivery' },
  { value: 'advance_before_dispatch', label: 'Advance — balance before dispatch' },
  { value: 'net_15', label: 'No advance, Net 15' },
  { value: 'net_30', label: 'No advance, Net 30' },
  { value: 'net_45', label: 'No advance, Net 45' },
  { value: 'net_60', label: 'No advance, Net 60' },
  { value: 'cod', label: 'COD' },
  { value: 'as_per_contract', label: 'As per contract' },
];

export function paymentTermsTypeRequiresAdvancePercent(t: PaymentTermsStructuredType): boolean {
  return t === 'advance_on_delivery' || t === 'advance_before_dispatch';
}

export function formatPaymentTermsString(type: PaymentTermsStructuredType, advancePercent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(Number(advancePercent) || 0)));
  const rest = Math.max(0, 100 - p);
  switch (type) {
    case 'advance_on_delivery':
      return `${p}% Advance, ${rest}% on delivery`;
    case 'advance_before_dispatch':
      return `${p}% Advance, ${rest}% before dispatch`;
    case 'net_15':
      return 'No advance, Net 15';
    case 'net_30':
      return 'No advance, Net 30';
    case 'net_45':
      return 'No advance, Net 45';
    case 'net_60':
      return 'No advance, Net 60';
    case 'cod':
      return 'COD';
    case 'as_per_contract':
      return 'As per contract';
    default:
      return 'As per contract';
  }
}

const LEGACY_ADV_DELIVERY = /^(\d+)%\s*Advance,\s*(\d+)%\s*on delivery$/i;
const LEGACY_ADV_DISPATCH = /^(\d+)%\s*Advance,\s*(\d+)%\s*before dispatch$/i;

function numField(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Items List / checkout stores `payment_terms` as JSON:
 * `{ advance_pct, pre_shipment_pct, post_shipment_pct, credit_days }`.
 */
export function parseItemsListPaymentTermsJson(o: Record<string, unknown>): {
  type: PaymentTermsStructuredType;
  advancePercent: number;
} | null {
  const hasShape =
    'advance_pct' in o ||
    'pre_shipment_pct' in o ||
    'post_shipment_pct' in o ||
    'credit_days' in o;
  if (!hasShape) return null;

  const adv = numField(o.advance_pct);
  const pre = numField(o.pre_shipment_pct);
  const post = numField(o.post_shipment_pct);
  const cd = numField(o.credit_days);

  if (adv < 0.5) {
    if (cd === 15) return { type: 'net_15', advancePercent: 0 };
    if (cd === 30) return { type: 'net_30', advancePercent: 0 };
    if (cd === 45) return { type: 'net_45', advancePercent: 0 };
    if (cd === 60) return { type: 'net_60', advancePercent: 0 };
    if (cd <= 0) return { type: 'net_30', advancePercent: 0 };
    if (cd <= 22) return { type: 'net_15', advancePercent: 0 };
    if (cd <= 37) return { type: 'net_30', advancePercent: 0 };
    if (cd <= 52) return { type: 'net_45', advancePercent: 0 };
    return { type: 'net_60', advancePercent: 0 };
  }

  const roundedAdv = Math.max(1, Math.min(99, Math.round(adv)));
  if (post > pre) {
    return { type: 'advance_on_delivery', advancePercent: roundedAdv };
  }
  return { type: 'advance_before_dispatch', advancePercent: roundedAdv };
}

export function paymentTermsToDisplayLabel(raw: string | null | undefined): string {
  const { type, advancePercent } = parsePaymentTermsString(raw);
  return formatPaymentTermsString(type, advancePercent);
}

/**
 * Map a stored label / legacy free text to structured fields for form prefill.
 */
export function parsePaymentTermsString(raw: string | null | undefined): {
  type: PaymentTermsStructuredType;
  advancePercent: number;
} {
  const s = (raw ?? '').trim();
  if (!s) return { type: 'as_per_contract', advancePercent: 0 };

  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s) as unknown;
      if (j && typeof j === 'object' && !Array.isArray(j)) {
        const fromJson = parseItemsListPaymentTermsJson(j as Record<string, unknown>);
        if (fromJson) return fromJson;
      }
    } catch {
      // fall through to legacy parsing
    }
  }

  const mDel = s.match(LEGACY_ADV_DELIVERY);
  if (mDel) {
    return { type: 'advance_on_delivery', advancePercent: Number(mDel[1]) || 50 };
  }
  const mDisp = s.match(LEGACY_ADV_DISPATCH);
  if (mDisp) {
    return { type: 'advance_before_dispatch', advancePercent: Number(mDisp[1]) || 30 };
  }

  const lower = s.toLowerCase();
  if (lower.includes('as per contract')) return { type: 'as_per_contract', advancePercent: 0 };
  if (lower === 'cod' || lower.includes('cash on delivery')) return { type: 'cod', advancePercent: 0 };
  if (s.includes('Net 15') || /\bnet\s*15\b/i.test(s)) return { type: 'net_15', advancePercent: 0 };
  if (s.includes('Net 45') || /\bnet\s*45\b/i.test(s)) return { type: 'net_45', advancePercent: 0 };
  if (s.includes('Net 60') || /\bnet\s*60\b/i.test(s)) return { type: 'net_60', advancePercent: 0 };
  if (s.includes('Net 30') || /\bnet\s*30\b/i.test(s)) return { type: 'net_30', advancePercent: 0 };

  // Vendor/client style: "Advanced X% + Before dispatch ..."
  const advMatch = s.match(/advanced\s*(\d+)\s*%/i) ?? s.match(/(\d+)\s*%\s*advance/i);
  const advPct = advMatch ? Number(advMatch[1]) : NaN;
  if (lower.includes('before dispatch') && Number.isFinite(advPct)) {
    return { type: 'advance_before_dispatch', advancePercent: advPct };
  }
  if ((lower.includes('on delivery') || lower.includes('after dispatch')) && Number.isFinite(advPct)) {
    return { type: 'advance_on_delivery', advancePercent: advPct };
  }
  if (lower === 'advance' || (lower.includes('advance') && !lower.includes('net'))) {
    return {
      type: lower.includes('before dispatch') || lower.includes('dispatch') ? 'advance_before_dispatch' : 'advance_on_delivery',
      advancePercent: Number.isFinite(advPct) ? advPct : 50,
    };
  }

  return { type: 'as_per_contract', advancePercent: 0 };
}

export function validateAdvancePercentForType(
  type: PaymentTermsStructuredType,
  advancePercent: number
): string | null {
  if (!paymentTermsTypeRequiresAdvancePercent(type)) return null;
  const p = Number(advancePercent);
  if (!Number.isFinite(p) || p < 1 || p > 99) {
    return 'Advance % must be between 1 and 99 for advance payment terms.';
  }
  return null;
}
