/**
 * On-screen preview of generated GRN QR labels, with print actions.
 * Field rows come from labelFieldRows() — the same source the printed card uses —
 * so what's on screen is what comes out of the printer.
 */

import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import type { GeneratedLabel } from '../../services/grn.service';
import { labelFieldRows, printGrnLabels, displayGrnNo } from '../../lib/grnLabelPrint';

export interface GrnLabelPreviewProps {
  labels: GeneratedLabel[];
  grnNo: string | null | undefined;
  /** Surfaced when the browser blocks the print popup. */
  onPrintBlocked?: () => void;
}

export const GrnLabelPreview: React.FC<GrnLabelPreviewProps> = ({ labels, grnNo, onPrintBlocked }) => {
  const sorted = [...labels].sort((a, b) => a.boxIndex - b.boxIndex);
  const [selectedBox, setSelectedBox] = useState<number>(sorted[0]?.boxIndex ?? 1);
  const active = sorted.find((l) => l.boxIndex === selectedBox) ?? sorted[0];

  const print = (toPrint: GeneratedLabel[]): void => {
    if (!printGrnLabels(toPrint, grnNo)) onPrintBlocked?.();
  };

  if (!active) return null;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <div className="text-sm font-semibold text-ink">
          {sorted.length} label{sorted.length === 1 ? '' : 's'} · GRN {displayGrnNo(grnNo)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sorted.length > 1 ? (
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(Number(e.target.value))}
              aria-label="Preview box"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
            >
              {sorted.map((l) => (
                <option key={l.boxIndex} value={l.boxIndex}>
                  Box {l.boxIndex}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => print([active])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print box {active.boxIndex}
          </button>
          <button
            type="button"
            onClick={() => print(sorted)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-2"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print all {sorted.length}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 p-4">
        <div className="w-[320px] shrink-0 rounded-lg border border-border p-3">
          <div className="mb-2 text-xs font-bold text-ink">
            GRN {displayGrnNo(grnNo)} - Box {active.boxIndex}
          </div>
          <div className="mb-2 text-center">
            <img
              src={active.qrImageDataUrl}
              alt={`QR Box ${active.boxIndex}`}
              className="mx-auto h-44 w-44 object-contain"
            />
          </div>
          {labelFieldRows(active, grnNo).map((row) => (
            <p key={row.label} className="my-1 text-xs text-ink">
              <strong className="font-bold">{row.label}:</strong> {row.value}
            </p>
          ))}
        </div>

        {sorted.length > 1 ? (
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-xs font-semibold text-ink-3">All boxes</p>
            <div className="flex flex-wrap gap-2">
              {sorted.map((l) => (
                <button
                  key={l.boxIndex}
                  type="button"
                  onClick={() => setSelectedBox(l.boxIndex)}
                  className={`rounded-lg border p-1.5 ${
                    l.boxIndex === active.boxIndex
                      ? 'border-brand bg-brand-soft'
                      : 'border-border hover:border-border-strong'
                  }`}
                  title={`Box ${l.boxIndex}`}
                >
                  <img src={l.qrImageDataUrl} alt={`QR Box ${l.boxIndex}`} className="h-14 w-14 object-contain" />
                  <span className="mt-0.5 block text-center text-[10px] text-ink-2">Box {l.boxIndex}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
