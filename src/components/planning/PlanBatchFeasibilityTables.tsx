import type { ReactElement } from 'react';
import type {
  PlanBatchPmDisplayRow,
  PlanBatchRmDisplayRow,
} from '../../lib/planBatchMaterialLeadTime';
import {
  formatLeadDaysLabel,
  planBatchStatusClass,
} from '../../lib/planBatchMaterialLeadTime';
import { formatQtyExact } from '../../utils/formatQty';

interface PlanBatchFeasibilityTablesProps {
  rmRows: PlanBatchRmDisplayRow[];
  pmRows: PlanBatchPmDisplayRow[];
}

function ActualLeadCell({ stats }: { stats: PlanBatchRmDisplayRow['actualLead'] }): ReactElement {
  if (!stats) {
    return <span className="text-ink-4">—</span>;
  }
  return (
    <div className="text-right">
      <div className="font-mono text-ink">{formatLeadDaysLabel(stats.avgDays, 'actual')}</div>
      <div className="text-[10px] text-ink-3 leading-tight mt-0.5">
        {stats.subLabel}
        {stats.trendLabel ? (
          <>
            <br />
            <span className="text-warn">{stats.trendLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function PlanBatchFeasibilityTables({
  rmRows,
  pmRows,
}: PlanBatchFeasibilityTablesProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[11px] font-semibold text-ink-2 mb-2">
          RM lines · {rmRows.length} material{rmRows.length === 1 ? '' : 's'} · with actual lead-time from history
        </h4>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-[11px]">
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 min-w-[140px]">Item</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 min-w-[120px]">Vendor</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Req Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">SIH</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 text-[10px]">Reserved (other)</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Free</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 text-[10px]">Quoted Lead</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 text-[10px]">Avg Actual Lead</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 text-[10px]">Earliest in-house</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rmRows.map((row) => (
                <tr key={row.key} className="border-b border-hairline last:border-0">
                  <td className="px-3 py-2.5 text-ink">
                    <span className="font-medium text-xs block">{row.name}</span>
                    <span className="text-[10px] text-ink-3 font-mono">{row.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">{row.vendorName}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                    {formatQtyExact(row.reqQty, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-2">
                    {formatQtyExact(row.sih, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-2">
                    {formatQtyExact(row.reserved, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-ok">
                    {formatQtyExact(row.free, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-2 text-xs">
                    {formatLeadDaysLabel(row.quotedLeadDays, 'quoted')}
                  </td>
                  <td className="px-3 py-2.5">
                    <ActualLeadCell stats={row.actualLead} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-ink-2">{row.earliestInHouse}</td>
                  <td className={`px-3 py-2.5 text-right text-[11px] ${planBatchStatusClass(row.status)}`}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-semibold text-ink-2 mb-2">
          PM lines · {pmRows.length} material{pmRows.length === 1 ? '' : 's'} · with actual lead-time from history
        </h4>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-[11px]">
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 min-w-[140px]">Item</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 min-w-[120px]">Vendor</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Req Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">SIH</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Quoted</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 text-[10px]">Avg Actual</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {pmRows.map((row) => (
                <tr key={row.key} className="border-b border-hairline last:border-0">
                  <td className="px-3 py-2.5 text-ink">
                    <span className="font-medium text-xs block">{row.name}</span>
                    <span className="text-[10px] text-ink-3 font-mono">{row.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">{row.vendorName}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                    {Math.round(row.reqQty).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-2">
                    {Math.round(row.sih).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-2 text-xs">
                    {row.quotedLeadDays != null ? `${row.quotedLeadDays}d` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <ActualLeadCell stats={row.actualLead} />
                  </td>
                  <td className={`px-3 py-2.5 text-right text-[11px] ${planBatchStatusClass(row.status)}`}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
