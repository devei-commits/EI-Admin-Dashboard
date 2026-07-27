/**
 * "Quarantine → QC" step (step 6): after labels are generated, move the whole GRN into
 * quarantine and hand it to the Quality team for inspection. This is the warehouse's last
 * action before QC; Complete GRN (step 7) happens once QC passes.
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface GrnQuarantineQcSectionProps {
  itemLine: string;
  totalPacks: number;
  receivedQty: number;
  unit?: string;
  qcNotes?: string | null;
  sentAt?: string | null;
}

function fmtQty(n: number, unit?: string): string {
  return `${n.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`;
}

export const GrnQuarantineQcSection: React.FC<GrnQuarantineQcSectionProps> = ({
  itemLine,
  totalPacks,
  receivedQty,
  unit,
  qcNotes,
  sentAt,
}) => {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">6 · Quarantine → QC</h3>
          <p className="mt-1 text-xs text-slate-500">
            Move the received goods into quarantine and send them to the Quality team for inspection.
            The GRN stays on hold until QC passes.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-2 pr-4 pl-3 font-medium text-slate-600">Item</td>
              <td className="py-2 pr-3 font-semibold text-slate-900">{itemLine}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 pl-3 font-medium text-slate-600">Packs to quarantine</td>
              <td className="py-2 pr-3 font-semibold text-slate-900">{totalPacks}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 pl-3 font-medium text-slate-600">Received Qty</td>
              <td className="py-2 pr-3 font-semibold text-slate-900">{fmtQty(receivedQty, unit)}</td>
            </tr>
            {qcNotes ? (
              <tr>
                <td className="py-2 pr-4 pl-3 font-medium text-slate-600">Notes for QC</td>
                <td className="py-2 pr-3 text-slate-800">{qcNotes}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {sentAt ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          ✓ Sent to Quarantine → QC. The GRN is On Hold pending Quality inspection.
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          On send, the GRN moves to <strong>On Hold</strong> and appears in the Quality team's queue.
        </p>
      )}
    </section>
  );
};
