import React, { useMemo, useState } from 'react';
import { MasterDropdownOptionsModal } from './MasterDropdownOptionsModal';
import { useOptionalMasterDropdownOptions } from '../../context/MasterDropdownOptionsContext';

type SelectOption = string | { value: string; label: string };

export type MasterSelectWithOptionsProps = {
  id: string;
  label: React.ReactNode;
  value: string;
  options: readonly SelectOption[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  fieldLabel: string;
  error?: string;
  requiredMark?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
  enableCustomOptions?: boolean;
};

const inputClass =
  'w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]';

function normalizeOptions(options: readonly SelectOption[]): { value: string; label: string }[] {
  return options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label }
  );
}

export function MasterSelectWithOptions({
  id,
  label,
  value,
  options,
  onChange,
  fieldLabel,
  error,
  requiredMark,
  disabled,
  emptyLabel = 'Select…',
  className = '',
  enableCustomOptions = true,
}: MasterSelectWithOptionsProps): JSX.Element {
  const dropdownCtx = useOptionalMasterDropdownOptions();
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState('');

  const baseValues = useMemo(
    () => normalizeOptions(options).map((o) => o.value),
    [options]
  );

  const mergedValues = useMemo(() => {
    if (!enableCustomOptions || !dropdownCtx) return baseValues;
    return dropdownCtx.getMergedOptions(fieldLabel, baseValues, value);
  }, [enableCustomOptions, dropdownCtx, fieldLabel, baseValues, value]);

  const selectOptions = useMemo(() => {
    const byValue = new Map(normalizeOptions(options).map((o) => [o.value, o.label]));
    return mergedValues.map((v) => ({ value: v, label: byValue.get(v) ?? v }));
  }, [options, mergedValues]);

  const showCustomControls = enableCustomOptions && Boolean(dropdownCtx);

  const handleQuickAdd = (): void => {
    if (!dropdownCtx) return;
    const result = dropdownCtx.addOption(fieldLabel, addValue);
    if (!result.ok) {
      setAddError(result.reason === 'duplicate' ? 'Option already exists.' : 'Enter a value.');
      return;
    }
    onChange({
      target: { id, value: result.option },
    } as React.ChangeEvent<HTMLSelectElement>);
    setAddValue('');
    setAddError('');
    setAddOpen(false);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2 mb-1">
        {label}
        {requiredMark ? <span className="text-err ml-0.5">*</span> : null}
      </label>
      <div className="flex gap-1.5 items-start">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`${inputClass} flex-1 min-w-0 ${disabled ? 'bg-surface-3' : ''}`}
        >
          <option value="">{emptyLabel}</option>
          {selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {baseValues.includes(opt.value) ? '' : ' (custom)'}
            </option>
          ))}
        </select>
        {showCustomControls ? (
          <>
            <button
              type="button"
              title="Add option"
              aria-label="Add option"
              onClick={() => {
                setAddOpen((o) => !o);
                setAddError('');
              }}
              className="shrink-0 px-2.5 py-2 border border-border rounded-lg text-sm font-semibold text-ink-2 hover:bg-surface-3"
            >
              +
            </button>
            <button
              type="button"
              title="Manage options"
              onClick={() => setManageOpen(true)}
              className="shrink-0 px-2.5 py-2 border border-border rounded-lg text-sm text-ink-2 hover:bg-surface-3"
              aria-label={`Manage options for ${fieldLabel}`}
            >
              ⚙
            </button>
          </>
        ) : null}
      </div>
      {addOpen && showCustomControls ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            aria-label={`New option for ${fieldLabel}`}
            value={addValue}
            onChange={(e) => {
              setAddValue(e.target.value);
              if (addError) setAddError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            placeholder={`New option for ${fieldLabel}`}
            className="flex-1 p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
          <button
            type="button"
            onClick={handleQuickAdd}
            className="px-3 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press"
          >
            Add
          </button>
        </div>
      ) : null}
      {addError ? (
        <p className="mt-1 text-xs text-err" role="alert">
          {addError}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-err" role="alert">
          {error}
        </p>
      ) : null}
      {showCustomControls ? (
        <MasterDropdownOptionsModal
          isOpen={manageOpen}
          onClose={() => setManageOpen(false)}
          fieldLabel={fieldLabel}
          baseOptions={baseValues}
        />
      ) : null}
    </div>
  );
}
