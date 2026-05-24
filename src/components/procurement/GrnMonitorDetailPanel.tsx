import { X } from 'lucide-react';
import type { GRNRecordFromApi } from '../../services/grn.service';

interface Props {
  grn: GRNRecordFromApi;
  loading?: boolean;
  onClose: () => void;
}

function fmtDate(value: string | null | undefined): string {
  if (!value || value === '') return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN');
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

function statusBadgeClass(status: string): string {
  const s = String(status || '').trim();
  if (s === 'GRN Complete') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s === 'Under GRN') return 'bg-sky-50 border-sky-200 text-sky-700';
  return 'bg-amber-50 border-amber-200 text-amber-800';
}

function displayStatus(status: string): string {
  const s = String(status || '').trim();
  if (s === 'GRN Complete') return 'Completed';
  return s || 'Pending';
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <motionlessSummaryRowImpl label={label} value={value} />
  );
}

function motionlessSummaryRowImpl({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

function LineItemsTable({ lineItems }: { lineItems: NonNullable<GRNRecordFromApi['lineItems']> }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-[11px] text-slate-900">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.12em] uppercase text-slate-500">
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-right">PO</th>
              <th className="px-3 py-2 text-right">Rcvd</th>
              <th className="px-3 py-2 text-right">Invoice</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Diff</th>
              <th className="px-3 py-2 text-center">QC</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr key={li.id ?? `${li.itemCode}-${idx}`} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 align-top font-medium text-slate-900">{li.item || '—'}</td>
                <td className="px-3 py-2 align-top font-mono text-[10px] text-emerald-700">{li.itemCode || '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.poQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.rcvdQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.invoiceQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {li.unitPrice != null ? fmtMoney(li.unitPrice) : '—'}
                </td>
                <td
                  className={`px-3 py-2 align-top text-right tabular-nums font-semibold ${
                    (li.diff ?? 0) < 0 ? 'text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {li.diff ?? '—'}
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">{li.qcStatus ?? '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GrnMonitorDetailPanel: React.FC<Props> = ({ grn, loading, onClose }) => {
  const lineItems = grn.lineItems ?? [];
  const workflowSteps = grn.workflowSteps ?? [];

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/20" />
      <div
        className="w-full sm:w-[28rem] lg:w-[36rem] max-w-[100vw] bg-white border-l border-blue-200 shadow-2xl overflow-y-auto flex flex-col max-h-[100vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-mono mb-1">{grn.poNo || '—'}</p>
            <h2 className="text-lg font-bold font-archivo text-slate-900 leading-tight">{grn.grnNo}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusBadgeClass(grn.status)}`}
              >
                {displayStatus(grn.status)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${grn.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}
              >
                {grn.type}
              </span>
              {loading ? <span className="text-[10px] text-slate-400">Refreshing…</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-4 sm:px-5 py-4 space-y-5 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs">
            <SummaryRow label="Vendor" value={grn.vendor || '—'} />
            <SummaryRow label="PO value" value={fmtMoney(grn.poValue)} />
            <SummaryRow label="Items count" value={grn.items ?? lineItems.length} />
            <SummaryRow label="Expected date" value={fmtDate(grn.expectedDate)} />
            <SummaryRow label="GRN date" value={fmtDate(grn.grnDate)} />
            <SummaryRow label="Received date" value={fmtDate(grn.receivedDate)} />
            <SummaryRow label="Assigned to" value={grn.assignedTo || '—'} />
            <SummaryRow label="QC status" value={grn.qcStatus || '—'} />
            <SummaryRow label="QC by" value={grn.qcBy || '—'} />
            <SummaryRow label="Invoice no." value={grn.invoiceNo || '—'} />
            <SummaryRow label="Invoice amount" value={fmtMoney(grn.invoiceAmount)} />
            {(grn.locationPrefix || grn.locationZone) && (
              <SummaryRow
                label="Location"
                value={[grn.locationZone, grn.locationPrefix].filter(Boolean).join(' · ') || '—'}
              />
            )}
            {(grn.grnBatchMfg || grn.mfgBatch || grn.expiry) && (
              <>
                <SummaryRow label="GRN batch / mfg" value={grn.grnBatchMfg || grn.mfgBatch || '—'} />
                <SummaryRow label="Expiry" value={fmtDate(grn.expiry)} />
              </>
            )}
            {(grn.noOfBoxes != null || grn.unitsPerBox != null) && (
              <SummaryRow
                label="Labels / boxes"
                value={`${grn.noOfBoxes ?? '—'} boxes · ${grn.unitsPerBox ?? '—'} units/box`}
              />
            )}
          </div>

          {workflowSteps.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Workflow</p>
              <div className="flex flex-wrap gap-1.5">
                {workflowSteps.map((step, idx) => (
                  <span
                    key={`${step}-${idx}`}
                    className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-medium text-blue-800"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">
              Line items ({lineItems.length})
            </p>
            {lineItems.length === 0 ? (
              <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                No line items on this GRN.
              </p>
            ) : (
              <LineItemsTable lineItems={lineItems} />
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-blue-200 px-4 sm:px-5 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrnMonitorDetailPanel;
