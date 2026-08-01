import React from 'react';
import { Link } from 'react-router-dom';
import {
  buildQualityGrnQueueRow,
  type QualityGrnQueueInput,
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
  if (grns.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-20 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr className="[&_th]:bg-slate-50">
            <th scope="col" className="px-4 py-3 text-left">GRN #</th>
            <th scope="col" className="px-4 py-3 text-left">Item</th>
            <th scope="col" className="px-4 py-3 text-left">PO</th>
            <th scope="col" className="px-4 py-3 text-left">Vendor</th>
            <th scope="col" className="px-4 py-3 text-left">Status</th>
            <th scope="col" className="px-4 py-3 text-left">QC</th>
            <th scope="col" className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grns.map((grn) => {
            const row = buildQualityGrnQueueRow(grn);
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-teal-700">{row.grnNo}</td>
                <td className="px-4 py-3 text-slate-800">{row.itemLabel}</td>
                <td className="px-4 py-3 text-slate-700">{row.poNo}</td>
                <td className="px-4 py-3 text-slate-700">{row.vendor}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.statusLabel}</td>
                <td className="px-4 py-3 text-slate-700">{row.qcStatus}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/warehouse/inbound"
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
  );
};

export default QualityGrnQueueTable;
