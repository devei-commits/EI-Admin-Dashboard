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
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="text-right">
      <div className="font-mono text-gray-900">{formatLeadDaysLabel(stats.avgDays, 'actual')}</div>
      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
        {stats.subLabel}
        {stats.trendLabel ? (
          <>
            <br />
            <span className="text-amber-600">{stats.trendLabel}</span>
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
        <h4 className="text-[11px] font-semibold text-gray-700 mb-2">
          RM lines · {rmRows.length} material{rmRows.length === 1 ? '' : 's'} · with actual lead-time from history
        </h4>
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px]">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[140px]">Item</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Vendor</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Req Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">SIH</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Reserved (other)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Free</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Quoted Lead</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Avg Actual Lead</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Earliest in-house</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {rmRows.map((row) => (
                <tr key={row.key} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 text-gray-900">
                    <span className="font-medium text-xs block">{row.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{row.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.vendorName}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                    {formatQtyExact(row.reqQty, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                    {formatQtyExact(row.sih, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                    {formatQtyExact(row.reserved, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">
                    {formatQtyExact(row.free, 'kg')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">
                    {formatLeadDaysLabel(row.quotedLeadDays, 'quoted')}
                  </td>
                  <td className="px-3 py-2.5">
                    <ActualLeadCell stats={row.actualLead} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-700">{row.earliestInHouse}</td>
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
        <h4 className="text-[11px] font-semibold text-gray-700 mb-2">
          PM lines · {pmRows.length} material{pmRows.length === 1 ? '' : 's'} · with actual lead-time from history
        </h4>
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px]">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[140px]">Item</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Vendor</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Req Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">SIH</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Quoted</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Avg Actual</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {pmRows.map((row) => (
                <tr key={row.key} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 text-gray-900">
                    <span className="font-medium text-xs block">{row.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{row.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.vendorName}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                    {Math.round(row.reqQty).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                    {Math.round(row.sih).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">
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
