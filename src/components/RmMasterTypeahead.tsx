import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  filterRmTypeaheadOptions,
  RM_TYPEAHEAD_MAX_SUGGESTIONS,
  type RmTypeaheadOption,
} from '../lib/rmTypeahead';

export type RmMasterTypeaheadProps = {
  options: RmTypeaheadOption[];
  value: string;
  onValueChange: (next: string) => void;
  selectedId: string;
  onSelect: (opt: RmTypeaheadOption) => void;
  onClearSelection: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** When true, empty/no-match hint does not suggest free-text manual entry (picker-only flows). */
  requirePickFromList?: boolean;
  /** Override the input's loading/idle placeholder wording (e.g. for non-RM reuse). */
  loadingPlaceholder?: string;
  /** Override the "no match" hint text (e.g. for non-RM reuse). */
  noMatchText?: string;
};

type ListAnchor = { top: number; left: number; width: number };

/**
 * Single-field RM search + pick (replaces separate search input + long &lt;select&gt;).
 * Parent pre-builds `options` via buildRmTypeaheadOptions; filtering is capped for DOM perf.
 */
export default function RmMasterTypeahead({
  options,
  value,
  onValueChange,
  selectedId,
  onSelect,
  onClearSelection,
  loading = false,
  disabled = false,
  placeholder = 'Search by name, internal code, or SKU…',
  className = '',
  requirePickFromList = false,
  loadingPlaceholder = 'Loading raw materials…',
  noMatchText,
}: RmMasterTypeaheadProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchor, setAnchor] = useState<ListAnchor | null>(null);

  const suggestions = useMemo(
    () => filterRmTypeaheadOptions(options, value, RM_TYPEAHEAD_MAX_SUGGESTIONS),
    [options, value]
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
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      if (hintRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pick = (opt: RmTypeaheadOption) => {
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
  const showNoMatch = open && !disabled && !loading && value.trim().length > 0 && suggestions.length === 0;

  const portalStyle = anchor
    ? { position: 'fixed' as const, top: anchor.top, left: anchor.left, width: anchor.width, zIndex: 9999 }
    : undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder}
        autoComplete="off"
        disabled={disabled || loading}
        placeholder={loading ? loadingPlaceholder : placeholder}
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1.5 border border-border rounded text-sm"
      />
      {showList && anchor && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              style={portalStyle}
              className="max-h-52 overflow-auto rounded-md border border-border bg-surface py-1 text-sm shadow-lg"
            >
              {suggestions.map((opt, idx) => (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`cursor-pointer px-2 py-1.5 ${
                    opt.disabled
                      ? 'cursor-not-allowed text-ink-4'
                      : idx === activeIndex
                        ? 'bg-brand-soft text-brand'
                        : 'text-ink hover:bg-surface-3'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {opt.label}
                  {opt.disabled ? <span className="ml-1 text-[10px] text-ink-4">(already added)</span> : null}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
      {showNoMatch && anchor && typeof document !== 'undefined'
        ? createPortal(
            <p
              ref={hintRef}
              style={portalStyle}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink-3 shadow"
            >
              {noMatchText ?? (requirePickFromList ? 'No matching raw materials.' : 'No match — text will be saved as manual INCI / name.')}
            </p>,
            document.body
          )
        : null}
    </div>
  );
}
