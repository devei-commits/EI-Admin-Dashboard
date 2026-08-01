import React from 'react';
import type {
  ProcurementRequest,
  VendorQuote,
  RequestType,
  RequestPriority,
  RequestStatus,
  QuoteStatus,
  MainTab,
  SideSection,
} from '../../types/procurement.types';
import { formatDateEnInSafe } from './procurementDataMappers';
import {
  ProcSection, ProcSectionHeader, ProcStatCards, ProcPanel, ProcThead,
} from '../../components/procurement/ProcSection';

export type QuoteStatsShape = {
  totalQuotes: number;
  confirmed: number;
  notSelected: number;
  urgent: number;
  pendingAction: number;
};

export type ProcurementReportsProps = {
  requests: ProcurementRequest[];
  quotes: VendorQuote[];
  quoteStats: QuoteStatsShape;
  applyRouteState: (tab: MainTab, section?: SideSection) => void;
  sideSection: SideSection;
  requestTypeClass: Record<RequestType, string>;
  priorityClass: Record<RequestPriority, string>;
  statusBg: Record<RequestStatus, string>;
};

const ProcurementReports: React.FC<ProcurementReportsProps> = ({
  requests,
  quotes,
  quoteStats,
  applyRouteState,
  sideSection,
  requestTypeClass,
  priorityClass,
  statusBg,
}) => {
  const totalPoValue = quotes.reduce((sum, q) => sum + q.lines.reduce((s, l) => s + l.totalValue, 0), 0);
  const completionRate = requests.length ? Math.round((requests.filter(r => r.status === 'PO Released').length / requests.length) * 100) : 0;

  return (
    <ProcSection>
      <ProcSectionHeader
        title="Procurement Reports"
        subtitle="Analytics and performance insights"
        actions={
          <button
            onClick={() => applyRouteState('Procurement', sideSection)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-soft text-brand border border-brand-soft hover:bg-brand-soft-2"
          >
            Back to Procurement
          </button>
        }
      />

      <ProcStatCards
        cards={[
          { label: 'Total PO Value', value: `₹${totalPoValue.toLocaleString('en-IN')}`, sub: 'all quotes combined', tone: 'warn' },
          { label: 'Request Pipeline', value: requests.length, sub: `${requests.filter(r => r.status === 'New').length} new, ${requests.filter(r => r.status === 'Quoted').length} quoted`, tone: 'brand' },
          { label: 'Quotes Status', value: `${quoteStats.confirmed}/${quoteStats.totalQuotes}`, sub: 'confirmed quotes', tone: 'ok' },
          { label: 'Completion Rate', value: `${completionRate}%`, sub: 'POs released', tone: 'brand' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProcPanel title="Request Status Breakdown">
          <div className="space-y-3">
            {(['New', 'Quoted', 'PO Draft', 'PO Released', 'Delivery Pending'] as RequestStatus[]).map(status => {
              const count = requests.filter(r => r.status === status).length;
              const percentage = requests.length ? Math.round((count / requests.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink-2 font-medium">{status}</span>
                    <span className="text-sm font-bold text-ink tabular-nums">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'New' ? 'bg-brand' :
                        status === 'Quoted' ? 'bg-warn' :
                        status === 'PO Draft' ? 'bg-warn' :
                        status === 'PO Released' ? 'bg-ok' : 'bg-err'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ProcPanel>

        <ProcPanel title="Quote Status Distribution">
          <div className="space-y-3">
            {(['Confirmed', 'Pending Review', 'Not Selected'] as QuoteStatus[]).map(status => {
              const count = quotes.filter(q => q.status === status).length;
              const percentage = quotes.length ? Math.round((count / quotes.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink-2 font-medium">{status}</span>
                    <span className="text-sm font-bold text-ink tabular-nums">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'Confirmed' ? 'bg-ok' :
                        status === 'Pending Review' ? 'bg-warn' : 'bg-ink-3'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ProcPanel>
      </div>

      <ProcPanel title="Request Timeline" bodyClassName="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <ProcThead cols={['Request Code', 'Type', 'Due Date', 'Priority', 'Status', 'Quotes']} />
          <tbody className="divide-y divide-hairline">
            {requests.map(req => {
              const relatedQuotes = quotes.filter(q => q.requestId === req.id);
              return (
                <tr key={req.id} className="hover:bg-surface-3 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-ink">{req.code}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span></td>
                  <td className="px-3 py-2.5 text-ink-2">{formatDateEnInSafe(req.dueDate)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityClass[req.priority]}`}>{req.priority}</span></td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBg[req.status]}`}>{req.status}</span></td>
                  <td className="px-3 py-2.5 text-ink-2 tabular-nums">{relatedQuotes.length} quotes</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ProcPanel>
    </ProcSection>
  );
};

export default ProcurementReports;
