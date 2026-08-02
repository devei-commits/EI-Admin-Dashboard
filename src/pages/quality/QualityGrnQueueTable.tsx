import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';
import RecordDetailModal from '../../components/ui/RecordDetailModal';
import {
  buildQualityGrnQueueRow,
  type QualityGrnQueueInput,
  type QualityGrnQueueRow,
} from '../../lib/qualityGrnQueueDisplay';

type QualityGrnQueueTableProps = {
  grns: QualityGrnQueueInput[];
  emptyMessage: string;
  actionLabel?: string;
};

const QualityGrnQueueTable: React.FC<QualityGrnQueueTableProps> = ({
  grns,
  emptyMessage,
  actionLabel = 'Open in Warehouse',
}) => {
  const [detail, setDetail] = useState<QualityGrnQueueRow | null>(null);

  if (grns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-ink-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-surface-2 text-xs uppercase tracking-wide text-ink-2">
            <tr className="[&_th]:bg-surface-2">
              <th scope="col" className="px-4 py-3 text-left">GRN #</th>
              <th scope="col" className="px-4 py-3 text-left">Item</th>
              <th scope="col" className="px-4 py-3 text-left">PO</th>
              <th scope="col" className="px-4 py-3 text-left">Vendor</th>
              <th scope="col" className="px-4 py-3 text-left">Status</th>
              <th scope="col" className="px-4 py-3 text-left">QC</th>
              <th scope="col" className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {grns.map((grn) => {
              const row = buildQualityGrnQueueRow(grn);
              return (
                <tr
                  key={row.id}
                  onClick={() => setDetail(row)}
                  className="hover:bg-surface-2 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-teal-700">{row.grnNo}</td>
                  <td className="px-4 py-3 text-ink">{row.itemLabel}</td>
                  <td className="px-4 py-3 text-ink-2">{row.poNo}</td>
                  <td className="px-4 py-3 text-ink-2">{row.vendor}</td>
                  <td className="px-4 py-3 font-medium text-ink">{row.statusLabel}</td>
                  <td className="px-4 py-3 text-ink-2">{row.qcStatus}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/warehouse/inbound"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      {actionLabel}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RecordDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        eyebrow="GRN"
        icon={<PackageCheck className="w-5 h-5" />}
        title={detail?.grnNo ?? ''}
        subtitle={detail?.itemLabel}
        sections={
          detail
            ? [
                {
                  title: 'GRN',
                  fields: [
                    { label: 'GRN #', value: detail.grnNo, mono: true },
                    { label: 'PO #', value: detail.poNo, mono: true },
                    { label: 'Vendor', value: detail.vendor },
                    { label: 'Status', value: detail.statusLabel },
                    { label: 'QC Status', value: detail.qcStatus },
                  ],
                },
                {
                  title: 'Item',
                  fields: [{ label: 'Item', value: detail.itemLabel, span: 'full' }],
                },
              ]
            : []
        }
      />
    </>
  );
};

export default QualityGrnQueueTable;
