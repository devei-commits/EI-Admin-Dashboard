import { parsePaymentTermsString } from '../../lib/paymentTermsStructured';
import {
  describeStagedPaymentTerms,
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
  /** Order value, so each stage can show what it is actually worth. Omit when not known. */
  amount?: number | null;
  className?: string;
};

const STAGE_BAR: Record<string, string> = {
  advance: 'bg-warn',
  pre_shipment: 'bg-brand',
  post_shipment: 'bg-ok',
};
const STAGE_DOT: Record<string, string> = {
  advance: 'bg-warn',
  pre_shipment: 'bg-brand',
  post_shipment: 'bg-ok',
};

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Payment terms as a payment schedule rather than a row of four numbers.
 *
 * The grid gave "0" the same weight as the stage carrying the whole payment, put a duration
 * (credit days) in the same row as three percentages, and never said when anything fell due — so
 * "0 · 100 · 0 · 60" had to be decoded. This shows only the stages that carry money, when each
 * falls due, and what each is worth when the order value is known.
 */
function StagedPaymentTermsSchedule({
  staged,
  amount,
  className,
}: {
  staged: StagedPaymentTerms;
  amount?: number | null;
  className?: string;
}) {
  const { stages, creditDays, pctWarning } = describeStagedPaymentTerms(staged, amount);

  return (
    <div className={`w-full max-w-md rounded-lg border border-border bg-surface overflow-hidden ${className ?? ''}`}>
      {stages.length > 0 && (
        <>
          {/* Proportion bar — the split is read at a glance instead of summed in the head. */}
          <div className="flex h-1.5 w-full" role="presentation">
            {stages.map((s) => (
              <div key={s.key} className={STAGE_BAR[s.key] ?? 'bg-brand'} style={{ width: `${s.pct}%` }} />
            ))}
          </div>
          <ul className="divide-y divide-hairline">
            {stages.map((s) => (
              <li key={s.key} className="flex items-baseline gap-2 px-3 py-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAGE_DOT[s.key] ?? 'bg-brand'}`} />
                <span className="text-xs font-semibold text-ink">{s.label}</span>
                <span className="text-[10px] text-ink-4 truncate">{s.when}</span>
                <span className="ml-auto shrink-0 text-xs font-bold text-ink tabular-nums">{s.pct}%</span>
                {s.amount != null && (
                  <span className="shrink-0 text-[11px] text-ink-3 tabular-nums w-20 text-right">{inr(s.amount)}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Credit days is a duration, not a slice of the value — it gets its own line. */}
      {creditDays > 0 && (
        <div className={`flex items-baseline gap-2 px-3 py-1.5 bg-surface-3 ${stages.length > 0 ? 'border-t border-hairline' : ''}`}>
          <span className="text-xs font-semibold text-ink-2">Credit period</span>
          <span className="ml-auto text-xs font-bold text-ink tabular-nums">{creditDays} days</span>
        </div>
      )}

      {stages.length === 0 && creditDays === 0 && (
        <div className="px-3 py-1.5 text-xs text-ink-4">No payment schedule set</div>
      )}

      {pctWarning && (
        <div className="px-3 py-1 text-[10px] font-semibold text-warn bg-warn-soft border-t border-hairline">
          {pctWarning}
        </div>
      )}
    </div>
  );
}

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
        <thead className="sticky top-0 z-20">
          <tr className="bg-surface-3 text-left text-ink-3 [&_th]:bg-surface-3">
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
export function PaymentTermsDisplay({ value, compact, amount, className = '' }: Props) {
  // Table cells (Issued POs grid) stay on the tight grid — the schedule needs vertical room.
  const render = (staged: StagedPaymentTerms) =>
    compact ? (
      <StagedPaymentTermsTable staged={staged} compact className={className} />
    ) : (
      <StagedPaymentTermsSchedule staged={staged} amount={amount} className={className} />
    );
  const raw = value != null ? String(value) : '';
  const textSize = compact ? 'text-[10px]' : 'text-xs';

  if (!raw.trim()) {
    return <span className={`text-ink-4 ${textSize} ${className}`}>—</span>;
  }

  const fromJson = parseStagedPaymentTerms(raw);
  if (fromJson) {
    return render(fromJson);
  }

  const fromVendorText = parseVendorThreeWayFromPlainText(raw);
  if (fromVendorText) {
    return render(fromVendorText);
  }

  const parsed = parsePaymentTermsString(raw);
  if (parsed.type === 'as_per_contract') {
    return (
      <span className={`text-ink-2 ${textSize} ${className}`.trim()}>
        {formatStagedPaymentTermsSummary(raw)}
      </span>
    );
  }

  return render(stagedPaymentTermsFromStructured(parsed.type, parsed.advancePercent));
}
