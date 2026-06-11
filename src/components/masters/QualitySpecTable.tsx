import React from 'react';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../../types/qualitySpecTable';
import { QualitySpecAttachmentsCell } from './QualitySpecAttachmentsCell';

export type QualitySpecTableProps = {
  title: string;
  subtitle?: string;
  addButtonLabel: string;
  emptyMessage: string;
  rows: QualitySpecTableRow[];
  onChange: (rows: QualitySpecTableRow[]) => void;
  idPrefix?: string;
};

const inputCls =
  'w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white';

export function QualitySpecTable({
  title,
  subtitle,
  addButtonLabel,
  emptyMessage,
  rows,
  onChange,
  idPrefix = 'qs',
}: QualitySpecTableProps): React.ReactElement {
  const updateRow = (id: string, patch: Partial<QualitySpecTableRow>): void => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string): void => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addRow = (): void => {
    onChange([...rows, createEmptyQualitySpecRow({ id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` })]);
  };

  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-0.5">{title}</h3>
          {subtitle ? <p className="text-sm font-semibold text-gray-800">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {addButtonLabel}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[960px] w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <th className="px-2 py-2 text-left font-semibold min-w-[9rem]">Parameter</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[7rem]">Spec / Limit</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[7rem]">Method</th>
              <th className="px-2 py-2 text-center font-semibold w-12">Mand</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[5rem]">Tolerance</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[5.5rem]">Frequency</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[4.5rem]">Sample</th>
              <th className="px-2 py-2 text-left font-semibold min-w-[5.5rem]">Acceptance</th>
              <th className="px-2 py-2 text-center font-semibold min-w-[9rem]">Attachments</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50/50">
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-parameter`}>
                      Parameter
                    </label>
                    <input
                      id={`${row.id}-parameter`}
                      type="text"
                      value={row.parameter}
                      onChange={(e) => updateRow(row.id, { parameter: e.target.value })}
                      className={inputCls}
                      placeholder="Parameter"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-specLimit`}>
                      Spec / Limit
                    </label>
                    <input
                      id={`${row.id}-specLimit`}
                      type="text"
                      value={row.specLimit}
                      onChange={(e) => updateRow(row.id, { specLimit: e.target.value })}
                      className={inputCls}
                      placeholder="Spec / limit"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-method`}>
                      Method
                    </label>
                    <input
                      id={`${row.id}-method`}
                      type="text"
                      value={row.method}
                      onChange={(e) => updateRow(row.id, { method: e.target.value })}
                      className={inputCls}
                      placeholder="Method"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <label className="sr-only" htmlFor={`${row.id}-mandatory`}>
                      Mandatory
                    </label>
                    <input
                      id={`${row.id}-mandatory`}
                      type="checkbox"
                      checked={row.mandatory}
                      onChange={(e) => updateRow(row.id, { mandatory: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-tolerance`}>
                      Tolerance
                    </label>
                    <input
                      id={`${row.id}-tolerance`}
                      type="text"
                      value={row.tolerance}
                      onChange={(e) => updateRow(row.id, { tolerance: e.target.value })}
                      className={inputCls}
                      placeholder="Tolerance"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-frequency`}>
                      Frequency
                    </label>
                    <input
                      id={`${row.id}-frequency`}
                      type="text"
                      value={row.frequency}
                      onChange={(e) => updateRow(row.id, { frequency: e.target.value })}
                      className={inputCls}
                      placeholder="Frequency"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-sample`}>
                      Sample
                    </label>
                    <input
                      id={`${row.id}-sample`}
                      type="text"
                      value={row.sample}
                      onChange={(e) => updateRow(row.id, { sample: e.target.value })}
                      className={inputCls}
                      placeholder="Sample"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="sr-only" htmlFor={`${row.id}-acceptance`}>
                      Acceptance
                    </label>
                    <input
                      id={`${row.id}-acceptance`}
                      type="text"
                      value={row.acceptance}
                      onChange={(e) => updateRow(row.id, { acceptance: e.target.value })}
                      className={inputCls}
                      placeholder="Acceptance"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <QualitySpecAttachmentsCell
                      rowId={row.id}
                      attachments={row.attachments}
                      onChange={(attachments) => updateRow(row.id, { attachments })}
                      onRemoveRow={() => removeRow(row.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
