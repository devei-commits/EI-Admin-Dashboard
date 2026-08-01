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
        className={`w-full max-w-md border-collapse border border-border rounded-md overflow-hidden bg-surface ${textSize}`}
      >
        <thead>
          <tr className="bg-surface-3 text-left text-ink-3">
            <th scope="col" className={`${cell} font-semibold border-b border-border`}>Advance %</th>
            <th scope="col" className={`${cell} font-semibold border-b border-border`}>Pre-ship %</th>
            <th scope="col" className={`${cell} font-semibold border-b border-border`}>Post-ship %</th>
            <th scope="col" className={`${cell} font-semibold border-b border-border`}>Credit days</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-ink">
            <td className={`${cell} text-center tabular-nums border-t border-hairline`}>{staged.advance_pct}</td>
            <td className={`${cell} text-center tabular-nums border-t border-hairline`}>{staged.pre_shipment_pct}</td>
            <td className={`${cell} text-center tabular-nums border-t border-hairline`}>{staged.post_shipment_pct}</td>
            <td className={`${cell} text-center tabular-nums border-t border-hairline`}>{staged.credit_days}</td>
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
    return <span className={`text-ink-4 ${textSize} ${className}`}>—</span>;
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
      <span className={`text-ink-2 ${textSize} ${className}`.trim()}>
        {formatStagedPaymentTermsSummary(raw)}
      </span>
    );
  }

  const staged = stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent);
  return <StagedPaymentTermsTable staged={staged} compact={compact} className={className} />;
}
