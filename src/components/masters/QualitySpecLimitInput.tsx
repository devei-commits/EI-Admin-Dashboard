import React from 'react';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import {
  isNumberQualitySpecKind,
  parseQualitySpecDataType,
  specLimitPlaceholder,
} from '../../lib/qualitySpecDataType';

export type QualitySpecLimitInputProps = {
  id: string;
  enabled: boolean;
  inputCls: string;
  value: string;
  onChange: (value: string) => void;
  dataType?: string;
  selectOptions?: string[];
};

export function QualitySpecLimitInput({
  id,
  enabled,
  inputCls,
  value,
  onChange,
  dataType,
  selectOptions = [],
}: QualitySpecLimitInputProps): React.ReactElement {
  const { kind, unit } = parseQualitySpecDataType(dataType);
  const displayValue = value === 'Per Master' && kind !== 'text' ? '' : value;
  const placeholder = specLimitPlaceholder(kind, unit);

  if (kind === 'textarea') {
    return (
      <textarea
        id={id}
        rows={2}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder={placeholder}
        disabled={!enabled}
      />
    );
  }

  if (kind === 'date') {
    return (
      <input
        id={id}
        type="date"
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        disabled={!enabled}
      />
    );
  }

  if (kind === 'number' || isNumberQualitySpecKind(kind)) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          id={id}
          type={kind === 'number-range' ? 'text' : 'number'}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} flex-1 min-w-0`}
          placeholder={placeholder}
          disabled={!enabled}
          step="any"
        />
        {unit ? <span className="shrink-0 text-[10px] text-gray-500">{unit}</span> : null}
      </div>
    );
  }

  if (kind === 'boolean') {
    return (
      <select
        id={id}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        disabled={!enabled}
      >
        <option value="">Select…</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  if (kind === 'pass-fail') {
    return (
      <select
        id={id}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        disabled={!enabled}
      >
        <option value="">Select…</option>
        <option value="Pass">Pass</option>
        <option value="Fail">Fail</option>
      </select>
    );
  }

  if (kind === 'select') {
    return (
      <select
        id={id}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        disabled={!enabled || selectOptions.length === 0}
      >
        <option value="">
          {selectOptions.length === 0 ? 'Add dropdown options above…' : 'Select…'}
        </option>
        {selectOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'attachment') {
    return (
      <input
        id={id}
        type="text"
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder={placeholder}
        disabled={!enabled}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      placeholder={placeholder}
      disabled={!enabled}
    />
  );
}

export function QualitySpecLimitInputFromRow({
  row,
  id,
  enabled,
  inputCls,
  onChange,
}: {
  row: QualitySpecTableRow;
  id: string;
  enabled: boolean;
  inputCls: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  if (!row.dataType) {
    return (
      <input
        id={id}
        type="text"
        value={row.specLimit}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder="Spec / limit"
        disabled={!enabled}
      />
    );
  }

  return (
    <QualitySpecLimitInput
      id={id}
      enabled={enabled}
      inputCls={inputCls}
      value={row.specLimit}
      onChange={onChange}
      dataType={row.dataType}
      selectOptions={row.selectOptions}
    />
  );
}
