import { useId } from 'react';
import { X } from 'lucide-react';
import { grnLineItemDisplayName, type GRNRecordFromApi } from '../../services/grn.service';

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
  if (s === 'GRN Complete') return 'bg-ok-soft border-[color:var(--st-green-fg)]/30 text-ok';
  if (s === 'Under GRN') return 'bg-brand-soft border-brand-soft text-brand';
  return 'bg-warn-soft border-[color:var(--st-amber-fg)]/30 text-warn';
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
      <span className="text-ink-3 shrink-0">{label}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}

function LineItemsTable({ lineItems }: { lineItems: NonNullable<GRNRecordFromApi['lineItems']> }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-[11px] text-ink">
          <thead>
            <tr className="bg-surface-3 border-b border-border text-[10px] tracking-wide uppercase text-ink-3">
              <th scope="col" className="px-3 py-2 text-left">Item</th>
              <th scope="col" className="px-3 py-2 text-left">Code</th>
              <th scope="col" className="px-3 py-2 text-right">PO</th>
              <th scope="col" className="px-3 py-2 text-right">Rcvd</th>
              <th scope="col" className="px-3 py-2 text-right">Billed qty</th>
              <th scope="col" className="px-3 py-2 text-right">Price</th>
              <th scope="col" className="px-3 py-2 text-right">Diff</th>
              <th scope="col" className="px-3 py-2 text-center">QC</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr key={li.id ?? `${li.itemCode}-${idx}`} className="border-b border-hairline last:border-0">
                <td className="px-3 py-2 align-top font-medium text-ink">{grnLineItemDisplayName(li)}</td>
                <td className="px-3 py-2 align-top font-mono text-[10px] text-ok">{li.itemCode || '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.poQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.rcvdQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{li.invoiceQty ?? '—'}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {li.unitPrice != null ? fmtMoney(li.unitPrice) : '—'}
                </td>
                <td
                  className={`px-3 py-2 align-top text-right tabular-nums font-semibold ${
                    (li.diff ?? 0) < 0 ? 'text-err' : 'text-ink-2'
                  }`}
                >
                  {li.diff ?? '—'}
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-surface-3 text-[10px]">{li.qcStatus ?? '—'}</span>
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
  const headingId = useId();

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/20" />
      <div
        className="w-full sm:w-[28rem] lg:w-[36rem] max-w-[100vw] bg-surface border-l border-brand-soft shadow-2xl overflow-y-auto flex flex-col max-h-[100vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-brand-soft px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-3 font-mono mb-1">{grn.poNo || '—'}</p>
            <h2 id={headingId} className="text-lg font-bold font-archivo text-ink leading-tight">{grn.grnNo}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusBadgeClass(grn.status)}`}
              >
                {displayStatus(grn.status)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${grn.type === 'RM' ? 'bg-brand-soft text-brand border border-brand-soft' : 'bg-brand-soft text-brand border border-brand-soft'}`}
              >
                {grn.type}
              </span>
              {loading ? <span className="text-[10px] text-ink-4">Refreshing…</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-4 hover:text-ink-2 p-1 rounded transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-4 sm:px-5 py-4 space-y-5 text-sm">
          <div className="rounded-lg border border-border bg-surface-3 divide-y divide-hairline text-xs">
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
              <p className="text-[10px] tracking-wide text-ink-3 uppercase mb-2">Workflow</p>
              <div className="flex flex-wrap gap-1.5">
                {workflowSteps.map((step, idx) => (
                  <span
                    key={`${step}-${idx}`}
                    className="px-2 py-0.5 rounded-full bg-brand-soft border border-brand-soft text-[10px] font-medium text-brand"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] tracking-wide text-ink-3 uppercase mb-2">
              Line items ({lineItems.length})
            </p>
            {lineItems.length === 0 ? (
              <p className="text-xs text-ink-3 rounded-lg border border-border bg-surface-3 px-4 py-6 text-center">
                No line items on this GRN.
              </p>
            ) : (
              <LineItemsTable lineItems={lineItems} />
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-brand-soft px-4 sm:px-5 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-ink-3 text-sm font-semibold hover:bg-surface-2 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrnMonitorDetailPanel;
