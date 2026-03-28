import { formatStagedPaymentTermsSummary, parseStagedPaymentTerms } from '../../lib/stagedPaymentTerms';

type Props = {
  value?: string | null;
  /** Tighter typography for table cells (e.g. Issued POs grid) */
  compact?: boolean;
  className?: string;
};

/**
 * Renders Items List / PO `payment_terms`: when stored as staged JSON, show a small table;
 * otherwise a single human-readable line (legacy text or derived from structured type).
 */
export function PaymentTermsDisplay({ value, compact, className = '' }: Props) {
  const raw = value != null ? String(value) : '';
  const staged = parseStagedPaymentTerms(raw);
  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const cell = compact ? 'px-1 py-0.5' : 'px-2 py-1.5';

  if (!raw.trim()) {
    return <span className={`text-slate-400 ${textSize} ${className}`}>—</span>;
  }

  if (staged) {
    return (
      <div className={className}>
        <table
          className={`w-full max-w-md border-collapse border border-slate-200 rounded-md overflow-hidden bg-white ${textSize}`}
        >
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className={`${cell} font-semibold border-b border-slate-200`}>Advance %</th>
              <th className={`${cell} font-semibold border-b border-slate-200`}>Pre-ship %</th>
              <th className={`${cell} font-semibold border-b border-slate-200`}>Post-ship %</th>
              <th className={`${cell} font-semibold border-b border-slate-200`}>Credit days</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-slate-900">
              <td className={`${cell} text-center tabular-nums border-t border-slate-100`}>{staged.advance_pct}</td>
              <td className={`${cell} text-center tabular-nums border-t border-slate-100`}>{staged.pre_shipment_pct}</td>
              <td className={`${cell} text-center tabular-nums border-t border-slate-100`}>{staged.post_shipment_pct}</td>
              <td className={`${cell} text-center tabular-nums border-t border-slate-100`}>{staged.credit_days}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <span className={`text-slate-700 ${textSize} ${className}`.trim()}>
      {formatStagedPaymentTermsSummary(raw)}
    </span>
  );
}
