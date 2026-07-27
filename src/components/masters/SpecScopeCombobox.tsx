import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SpecScopeComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Accent used for hover / active option — matches the rule type (quality=emerald, technical=indigo). */
  accent?: 'slate' | 'emerald' | 'indigo';
};

const ACCENTS: Record<NonNullable<SpecScopeComboboxProps['accent']>, { active: string; ring: string }> = {
  slate: { active: 'bg-slate-100 text-slate-900', ring: 'focus:border-slate-800 focus:ring-slate-800/30' },
  emerald: { active: 'bg-emerald-50 text-emerald-900', ring: 'focus:border-emerald-500 focus:ring-emerald-500/25' },
  indigo: { active: 'bg-indigo-50 text-indigo-900', ring: 'focus:border-indigo-500 focus:ring-indigo-500/25' },
};

/**
 * Themed cascading combobox — a styled input with a custom dropdown panel (native <datalist>
 * can't be themed). Accepts a typed value too, so legacy/edge scopes aren't locked out. Rendered
 * inside modal overlays, so the panel is a normal absolute child (no sidebar stacking conflict).
 */
export function SpecScopeCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  accent = 'slate',
}: SpecScopeComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const theme = ACCENTS[accent];

  const q = value.trim().toLowerCase();
  const exact = options.some((o) => o.toLowerCase() === q);
  const filtered = !q || exact ? options : options.filter((o) => o.toLowerCase().includes(q));

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const commit = (v: string): void => {
    onChange(v);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && filtered[highlight]) {
        e.preventDefault();
        commit(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div ref={wrapRef} className="relative mt-1">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          className={`w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${theme.ring}`}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 disabled:opacity-40"
          aria-label="Toggle options"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs italic text-gray-400">
              No matches — press Enter to keep “{value.trim()}”.
            </li>
          ) : (
            filtered.map((opt, i) => {
              const selected = opt.toLowerCase() === q;
              const active = i === highlight;
              return (
                <li
                  key={opt}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(opt);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                    active ? theme.active : 'text-gray-700'
                  }`}
                >
                  <span>{opt}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
