import React from 'react';
import type { GrnQcTestRow } from '../../lib/grnQcSpecs';
import { resolveGrnQcResultOutputType } from '../../lib/grnQcAutoPass';
import { parseQualitySpecDataType } from '../../lib/qualitySpecDataType';

type GrnQcResultInputProps = {
  test: GrnQcTestRow;
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
};

const inputCls =
  'w-full min-w-[7rem] border border-border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-surface disabled:bg-surface-2';

export function GrnQcResultInput({ test, disabled = false, id, onChange }: GrnQcResultInputProps): JSX.Element {
  const outputType = resolveGrnQcResultOutputType(test);
  const value = String(test.result ?? '');
  const selectOptions = test.selectOptions ?? [];

  if (outputType === 'textarea') {
    return (
      <textarea
        id={id}
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder="Enter result…"
        aria-label="Enter result"
      />
    );
  }

  if (outputType === 'date') {
    return (
      <input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        aria-label="Result date"
      />
    );
  }

  if (
    outputType === 'number' ||
    outputType === 'number-range' ||
    outputType === 'number-le' ||
    outputType === 'number-ge' ||
    outputType === 'number-match'
  ) {
    const { unit } = parseQualitySpecDataType(test.outputType);
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          id={id}
          type={outputType === 'number-range' ? 'text' : 'number'}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} flex-1 min-w-0`}
          placeholder="Measured"
          step="any"
          aria-label="Measured value"
        />
        {unit ? <span className="shrink-0 text-[10px] text-ink-3">{unit}</span> : null}
      </div>
    );
  }

  if (outputType === 'boolean') {
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label="Result">
        <option value="">Select…</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  if (outputType === 'pass-fail') {
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label="Result">
        <option value="">Select…</option>
        <option value="Pass">Pass</option>
        <option value="Fail">Fail</option>
      </select>
    );
  }

  if (outputType === 'select') {
    const options =
      selectOptions.length > 0
        ? selectOptions
        : String(test.specLimit ?? '')
            .split(/[,;|]/)
            .map((s) => s.trim())
            .filter(Boolean);
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label="Result">
        <option value="">{options.length === 0 ? 'No options' : 'Select…'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (outputType === 'text-match') {
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label="Result">
        <option value="">Select…</option>
        <option value="✓ Matches">✓ Matches</option>
        <option value="Mismatch">Mismatch</option>
        <option value="pending">pending</option>
      </select>
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      placeholder="Enter result…"
      aria-label="Enter result"
    />
  );
}
