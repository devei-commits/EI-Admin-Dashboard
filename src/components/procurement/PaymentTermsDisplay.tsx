import { parsePaymentTermsString } from '../../lib/paymentTermsStructured';
import {
  formatStagedPaymentTermsSummary,
  parseStagedPaymentTerms,
  parseVendorThreeWayFromPlainText,
  stagedPaymentTermsFromStructured,
  type StagedPaymentTerms,
} from '../../lib/stagedPaymentTerms';

type Props = {
  value?: string | null;
  /** Tighter typography for table cells (e.g. Issued POs grid) */
  compact?: boolean;
  className?: string;
};

function StagedPaymentTermsTable({
  staged,
  compact,
  className,
}: {
  staged: StagedPaymentTerms;
  compact?: boolean;
  className?: string;
}) {
  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const cell = compact ? 'px-1 py-0.5' : 'px-2 py-1.5';
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

/**
 * Renders payment terms as Advance / Pre-ship / Post-ship / Credit table when JSON or when text maps to a structured type;
 * otherwise one line (e.g. “As per contract” or unknown free text).
 */
export function PaymentTermsDisplay({ value, compact, className = '' }: Props) {
  const raw = value != null ? String(value) : '';
  const textSize = compact ? 'text-[10px]' : 'text-xs';

  if (!raw.trim()) {
    return <span className={`text-slate-400 ${textSize} ${className}`}>—</span>;
  }

  const fromJson = parseStagedPaymentTerms(raw);
  if (fromJson) {
    return <StagedPaymentTermsTable staged={fromJson} compact={compact} className={className} />;
  }

  const fromVendorText = parseVendorThreeWayFromPlainText(raw);
  if (fromVendorText) {
    return <StagedPaymentTermsTable staged={fromVendorText} compact={compact} className={className} />;
  }

  const parsed = parsePaymentTermsString(raw);
  if (parsed.type === 'as_per_contract') {
    return (
      <span className={`text-slate-700 ${textSize} ${className}`.trim()}>
        {formatStagedPaymentTermsSummary(raw)}
      </span>
    );
  }

  const staged = stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent);
  return <StagedPaymentTermsTable staged={staged} compact={compact} className={className} />;
}
