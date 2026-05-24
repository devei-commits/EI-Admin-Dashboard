import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  filterPmTypeaheadOptions,
  PM_TYPEAHEAD_MAX_SUGGESTIONS,
  type PmTypeaheadOption,
} from '../lib/pmTypeahead';

export type PmMasterTypeaheadProps = {
  options: PmTypeaheadOption[];
  value: string;
  onValueChange: (next: string) => void;
  selectedId: string;
  onSelect: (opt: PmTypeaheadOption) => void;
  onClearSelection: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export default function PmMasterTypeahead({
  options,
  value,
  onValueChange,
  selectedId,
  onSelect,
  onClearSelection,
  loading = false,
  disabled = false,
  placeholder = 'Search PM by code or description…',
  className = '',
}: PmMasterTypeaheadProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () => filterPmTypeaheadOptions(options, value, PM_TYPEAHEAD_MAX_SUGGESTIONS),
    [options, value]
  );

  useEffect(() => {
    setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pick = (opt: PmTypeaheadOption) => {
    if (opt.disabled) return;
    onSelect(opt);
    setOpen(false);
  };

  const onInputChange = (next: string) => {
    onValueChange(next);
    if (selectedId) onClearSelection();
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  const showList = open && !disabled && !loading && suggestions.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled || loading}
        placeholder={loading ? 'Loading pack materials…' : placeholder}
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((opt, idx) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={idx === activeIndex}
              className={`cursor-pointer px-2 py-1.5 ${
                opt.disabled
                  ? 'cursor-not-allowed text-slate-400'
                  : idx === activeIndex
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-slate-800 hover:bg-slate-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(opt);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {opt.label}
              {opt.disabled ? <span className="ml-1 text-[10px] text-slate-400">(already added)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open && !loading && value.trim() && suggestions.length === 0 ? (
        <p className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 shadow">
          No match — text will be saved as manual PM description.
        </p>
      ) : null}
    </div>
  );
}
