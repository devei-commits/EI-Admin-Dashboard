import React, { useState, useId } from 'react';
import { X } from '@phosphor-icons/react';
import type { ProcurementRequest, PackagingCondition, StockCheckLineData } from '../../types/procurement.types';

interface StockCheckLine {
  itemName: string;
  itemCode: string;
  systemQty: number;
  zone: string;
  rack: string;
  physicalQty: number;
  batchNo: string;
  packagingCondition: PackagingCondition;
}

export type StockCheckUpdateModalProps = {
  request: ProcurementRequest;
  scId: string;
  existingUpdates: Record<string, StockCheckLineData> | undefined;
  onClose: () => void;
  onSave: (updates: Record<string, StockCheckLineData>) => void;
};

const StockCheckUpdateModal: React.FC<StockCheckUpdateModalProps> = ({
  request,
  scId,
  existingUpdates,
  onClose,
  onSave,
}) => {
  const initialLines = React.useMemo(() => {
    const updatesForRequest = existingUpdates ?? {};

    const baseItems =
      (request.itemDetails && request.itemDetails.length > 0
        ? request.itemDetails.map((item, idx) => {
            const systemQty = item.reqQty;
            const itemCode = item.itemCode;
            const override = itemCode ? updatesForRequest[itemCode] : undefined;
            const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
            const defaultRack = `A1-L1-S${idx + 1}`;

            return {
              itemName: item.itemName,
              itemCode,
              systemQty,
              zone: override?.zone ?? defaultZone,
              rack: override?.rack ?? defaultRack,
              physicalQty: override?.physicalQty ?? systemQty,
              batchNo: override?.batchNo ?? `BTH-${(item.itemCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-6) || 'ITEM'}-${
                String(idx + 1).padStart(2, '0')
              }`,
              packagingCondition: override?.packagingCondition ?? ('Good' as PackagingCondition),
            };
          })
        : request.items.map((itemName, idx) => {
            const systemQty = request.quantities?.[idx] ?? 0;
            const generatedCodeBase =
              itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) ||
              String(idx + 1).padStart(3, '0');
            const itemCode = `EI-${request.type}-${generatedCodeBase}`;
            const override = updatesForRequest[itemCode];
            const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
            const defaultRack = `A1-L1-S${idx + 1}`;

            return {
              itemName,
              itemCode,
              systemQty,
              zone: override?.zone ?? defaultZone,
              rack: override?.rack ?? defaultRack,
              physicalQty: override?.physicalQty ?? systemQty,
              batchNo: override?.batchNo ?? `BTH-${generatedCodeBase}-${String(idx + 1).padStart(2, '0')}`,
              packagingCondition: override?.packagingCondition ?? ('Good' as PackagingCondition),
            };
          })) || [];

    return baseItems;
  }, [existingUpdates, request]);

  const [lines, setLines] = useState(
    initialLines.map((line) => ({ ...line })),
  );
  const [overallRemarks, setOverallRemarks] = useState('');
  const headingId = useId();

  const handleLineChange = (
    index: number,
    field: 'zone' | 'rack' | 'physicalQty' | 'batchNo' | 'packagingCondition',
    value: string,
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const target: StockCheckLine = { ...next[index] };
      if (field === 'physicalQty') {
        const parsed = Number(value.replace(/[^0-9.]/g, ''));
        target.physicalQty = Number.isFinite(parsed) ? parsed : 0;
      } else if (field === 'packagingCondition') {
        target.packagingCondition = value as PackagingCondition;
      } else if (field === 'zone') {
        target.zone = value;
      } else if (field === 'rack') {
        target.rack = value;
      } else {
        target.batchNo = value;
      }
      next[index] = target;
      return next;
    });
  };

  const handleSave = () => {
    const updates: Record<string, StockCheckLineData> = {};
    lines.forEach((line) => {
      if (!line.itemCode) {
        return;
      }
      updates[line.itemCode] = {
        zone: line.zone,
        rack: line.rack,
        physicalQty: line.physicalQty,
        batchNo: line.batchNo,
        packagingCondition: line.packagingCondition,
        remarks: overallRemarks || undefined,
      };
    });

    onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-3xl bg-surface rounded-2xl shadow-2xl border border-border max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border bg-surface-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Update Physical Count</p>
            <h2 id={headingId} className="text-sm font-semibold text-ink mt-1">{scId}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-4 hover:text-ink-2 leading-none"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-surface-3">
          {lines.map((line, idx) => {
            const variance = line.physicalQty - line.systemQty;
            return (
              <div
                key={line.itemCode ?? `${line.itemName}-${idx}`}
                className="rounded-xl border border-border bg-surface p-4 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {line.itemName}{' '}
                      <span className="text-[11px] text-ink-3 font-normal">System: {line.systemQty}</span>
                    </p>
                    <p className="text-[11px] text-ink-3 font-mono">{line.itemCode}</p>
                  </div>
                  <p className="text-[11px] text-ink-3">Variance: <span className="font-semibold text-warn">{variance}</span></p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">Zone</label>
                    <input
                      value={line.zone}
                      onChange={(e) => handleLineChange(idx, 'zone', e.target.value)}
                      aria-label="Zone"
                      className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">Rack / Location</label>
                    <input
                      value={line.rack}
                      onChange={(e) => handleLineChange(idx, 'rack', e.target.value)}
                      aria-label="Rack / Location"
                      className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">
                      Physical Qty Found *
                    </label>
                    <input
                      value={String(line.physicalQty)}
                      onChange={(e) => handleLineChange(idx, 'physicalQty', e.target.value)}
                      aria-label="Physical Qty Found"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">Packaging Condition</label>
                    <select
                      value={line.packagingCondition}
                      onChange={(e) => handleLineChange(idx, 'packagingCondition', e.target.value)}
                      aria-label="Packaging Condition"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink"
                    >
                      <option value="Good">Good</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Partially Damaged">Partially Damaged</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">
                      Batch No (comma-sep)
                    </label>
                    <input
                      value={line.batchNo}
                      onChange={(e) => handleLineChange(idx, 'batchNo', e.target.value)}
                      aria-label="Batch No (comma-sep)"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-border bg-surface p-4 text-xs space-y-2">
            <label className="block text-[10px] font-semibold text-ink-3 uppercase mb-1">Overall Remarks</label>
            <textarea
              value={overallRemarks}
              onChange={(e) => setOverallRemarks(e.target.value)}
              rows={3}
              aria-label="Overall Remarks"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink resize-none"
              placeholder="Notes on discrepancies, damages, or follow-ups"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-3"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-brand text-xs font-semibold text-white shadow-[var(--e1)] hover:bg-brand-press"
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockCheckUpdateModal;
