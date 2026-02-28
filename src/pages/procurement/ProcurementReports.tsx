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

export type QuoteStatsShape = {
  totalQuotes: number;
  confirmed: number;
  notSelected: number;
  pendingReview: number;
  quotesValue: number;
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
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-archivo text-slate-900">Procurement Reports</h2>
          <p className="text-sm text-slate-600 mt-1">Analytics and performance insights</p>
        </div>
        <button
          onClick={() => applyRouteState('Procurement', sideSection)}
          className="px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-300"
        >
          ← Back to Procurement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 tracking-widest">TOTAL PO VALUE</p>
          <p className="text-3xl font-bold text-yellow-700 mt-2">₹{quotes.reduce((sum, q) => sum + q.lines.reduce((s, l) => s + l.totalValue, 0), 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">all quotes combined</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 tracking-widest">REQUEST PIPELINE</p>
          <p className="text-3xl font-bold text-cyan-700 mt-2">{requests.length}</p>
          <p className="text-xs text-slate-500 mt-1">{requests.filter(r => r.status === 'New').length} new, {requests.filter(r => r.status === 'Quoted').length} quoted</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 tracking-widest">QUOTES STATUS</p>
          <p className="text-3xl font-bold text-emerald-700 mt-2">{quoteStats.confirmed}/{quoteStats.totalQuotes}</p>
          <p className="text-xs text-slate-500 mt-1">confirmed quotes</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 tracking-widest">COMPLETION RATE</p>
          <p className="text-3xl font-bold text-blue-700 mt-2">{Math.round((requests.filter(r => r.status === 'PO Released').length / requests.length) * 100)}%</p>
          <p className="text-xs text-slate-500 mt-1">POs released</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Request Status Breakdown</h3>
          <div className="space-y-3">
            {(['New', 'Quoted', 'PO Draft', 'PO Released', 'Delivery Pending'] as RequestStatus[]).map(status => {
              const count = requests.filter(r => r.status === status).length;
              const percentage = Math.round((count / requests.length) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium">{status}</span>
                    <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        status === 'New' ? 'bg-blue-500' :
                        status === 'Quoted' ? 'bg-yellow-500' :
                        status === 'PO Draft' ? 'bg-orange-500' :
                        status === 'PO Released' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Quote Status Distribution</h3>
          <div className="space-y-3">
            {(['Confirmed', 'Pending Review', 'Not Selected'] as QuoteStatus[]).map(status => {
              const count = quotes.filter(q => q.status === status).length;
              const percentage = Math.round((count / quotes.length) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium">{status}</span>
                    <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        status === 'Confirmed' ? 'bg-emerald-500' :
                        status === 'Pending Review' ? 'bg-yellow-500' : 'bg-slate-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-blue-200 bg-linear-to-r from-blue-50 to-cyan-50">
          <h3 className="font-bold text-slate-900">Request Timeline</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3">REQUEST CODE</th>
                <th className="px-6 py-3">TYPE</th>
                <th className="px-6 py-3">DUE DATE</th>
                <th className="px-6 py-3">PRIORITY</th>
                <th className="px-6 py-3">STATUS</th>
                <th className="px-6 py-3">QUOTES</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => {
                const relatedQuotes = quotes.filter(q => q.requestId === req.id);
                return (
                  <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-mono font-bold text-slate-900">{req.code}</td>
                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span></td>
                    <td className="px-6 py-3 text-slate-700">{new Date(req.dueDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityClass[req.priority]}`}>{req.priority}</span></td>
                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBg[req.status]}`}>{req.status}</span></td>
                    <td className="px-6 py-3 text-slate-700">{relatedQuotes.length} quotes</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ProcurementReports;
