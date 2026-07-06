import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  filterMaterialTypeaheadOptions,
  MATERIAL_TYPEAHEAD_MAX_SUGGESTIONS,
  type MaterialTypeaheadOption,
} from '../lib/materialTypeahead';

export type MaterialMasterTypeaheadProps = {
  options: MaterialTypeaheadOption[];
  value: string;
  onValueChange: (next: string) => void;
  selectedId: string;
  onSelect: (opt: MaterialTypeaheadOption) => void;
  onClearSelection: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  requirePickFromList?: boolean;
};

type ListAnchor = { top: number; left: number; width: number };

export default function MaterialMasterTypeahead({
  options,
  value,
  onValueChange,
  selectedId,
  onSelect,
  onClearSelection,
  loading = false,
  disabled = false,
  placeholder = 'Search RM / PM by name or code…',
  className = '',
  requirePickFromList = true,
}: MaterialMasterTypeaheadProps): React.ReactElement {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchor, setAnchor] = useState<ListAnchor | null>(null);

  const suggestions = useMemo(
    () => filterMaterialTypeaheadOptions(options, value, MATERIAL_TYPEAHEAD_MAX_SUGGESTIONS),
    [options, value],
  );

  const updateAnchor = (): void => {
    const el = inputRef.current;
    if (!el) {
      setAnchor(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    updateAnchor();
    const onReposition = (): void => updateAnchor();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, value, suggestions.length]);

  useEffect(() => {
    const onDocDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      if (hintRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pick = (opt: MaterialTypeaheadOption): void => {
    if (opt.disabled) return;
    onSelect(opt);
    setOpen(false);
  };

  const onInputChange = (next: string): void => {
    onValueChange(next);
    if (selectedId) onClearSelection();
    setOpen(true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  const showList = open && !disabled && !loading && suggestions.length > 0;
  const showNoMatch =
    open && !disabled && !loading && value.trim().length > 0 && suggestions.length === 0;

  const portalStyle = anchor
    ? { position: 'fixed' as const, top: anchor.top, left: anchor.left, width: anchor.width, zIndex: 10000 }
    : undefined;

  return (
    <div ref={rootRef} className={`relative min-w-[14rem] ${className}`.trim()}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled || loading}
        placeholder={loading ? 'Loading items…' : placeholder}
        value={value}
        onChange={(event) => onInputChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      {showList && anchor && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              style={portalStyle}
              className="max-h-52 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            >
              {suggestions.map((opt, index) => (
                <li
                  key={opt.key}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`cursor-pointer px-2 py-1.5 ${
                    opt.disabled
                      ? 'cursor-not-allowed text-slate-400'
                      : index === activeIndex
                        ? 'bg-violet-50 text-violet-900'
                        : 'text-slate-800 hover:bg-slate-50'
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="font-medium">{opt.name}</span>
                  <span className="text-slate-500"> · {opt.code}</span>
                  <span className="ml-1 text-[10px] uppercase text-slate-400">{opt.kind}</span>
                  {opt.disabled ? (
                    <span className="ml-1 text-[10px] text-slate-400">(already added)</span>
                  ) : null}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
      {showNoMatch && anchor && typeof document !== 'undefined'
        ? createPortal(
            <p
              ref={hintRef}
              style={portalStyle}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 shadow"
            >
              {requirePickFromList ? 'No matching RM / PM items.' : 'No match.'}
            </p>,
            document.body,
          )
        : null}
    </div>
  );
}
