import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  filterPlanningProductFilterOptions,
  formatPlanningProductFilterDisplay,
  type PlanningProductFilterOption,
} from '../../lib/planningItemsInvolvedProductFilter';

export type PlanningItemsInvolvedProductFilterProps = {
  options: PlanningProductFilterOption[];
  selectedIds: string[];
  query: string;
  onQueryChange: (next: string) => void;
  onAddProduct: (id: string) => void;
  onRemoveProduct: (id: string) => void;
  onClearAll: () => void;
  disabled?: boolean;
  className?: string;
};

type ListAnchor = { top: number; left: number; width: number };

export default function PlanningItemsInvolvedProductFilter({
  options,
  selectedIds,
  query,
  onQueryChange,
  onAddProduct,
  onRemoveProduct,
  onClearAll,
  disabled = false,
  className = '',
}: PlanningItemsInvolvedProductFilterProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchor, setAnchor] = useState<ListAnchor | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const productSuggestions = useMemo(
    () =>
      filterPlanningProductFilterOptions(options, query).filter((opt) => !selectedSet.has(opt.id)),
    [options, query, selectedSet]
  );

  const showAllProductsRow = useMemo(() => {
    if (selectedIds.length > 0) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      'all products'.includes(q) ||
      q.includes('all') ||
      'consolidated'.includes(q) ||
      q.includes('consol')
    );
  }, [query, selectedIds.length]);

  const suggestions = useMemo(() => {
    const rows: Array<{ kind: 'all' } | { kind: 'product'; opt: PlanningProductFilterOption }> = [];
    if (showAllProductsRow) rows.push({ kind: 'all' });
    for (const opt of productSuggestions) rows.push({ kind: 'product', opt });
    return rows;
  }, [productSuggestions, showAllProductsRow]);

  const selectedChips = useMemo(
    () =>
      selectedIds
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is PlanningProductFilterOption => o != null),
    [selectedIds, options]
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
  }, [open, query, suggestions.length, selectedIds.length]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pickAll = () => {
    onClearAll();
    onQueryChange('');
    setOpen(false);
  };

  const pickProduct = (opt: PlanningProductFilterOption) => {
    onAddProduct(opt.id);
    onQueryChange('');
    setOpen(true);
    inputRef.current?.focus();
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
    if (e.key === 'Enter' && open && activeIndex >= 0) {
      const row = suggestions[activeIndex];
      if (!row) return;
      e.preventDefault();
      if (row.kind === 'all') pickAll();
      else pickProduct(row.opt);
    }
  };

  const showList = open && !disabled && suggestions.length > 0;
  const showNoMatch = open && !disabled && query.trim().length > 0 && suggestions.length === 0;

  const portalStyle = anchor
    ? { position: 'fixed' as const, top: anchor.top, left: anchor.left, width: anchor.width, zIndex: 9999 }
    : undefined;

  return (
    <div ref={rootRef} className={`flex-1 min-w-[240px] max-w-full space-y-2 ${className}`.trim()}>
      {selectedChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedChips.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-900 border border-indigo-200"
              title={formatPlanningProductFilterDisplay(opt)}
            >
              <span className="truncate">
                {opt.name}
                {opt.sku ? (
                  <span className="font-mono text-indigo-700/80"> · {opt.sku}</span>
                ) : null}
              </span>
              <button
                type="button"
                className="shrink-0 p-0.5 rounded hover:bg-indigo-100 text-indigo-700"
                aria-label={`Remove ${opt.name}`}
                onClick={() => onRemoveProduct(opt.id)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline"
            onClick={onClearAll}
          >
            Clear all
          </button>
        </div>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          id="items-involved-product-filter"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={
            selectedIds.length > 0
              ? 'Add another product (name or SKU)…'
              : 'Search product name or SKU…'
          }
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-800 bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        {showList && anchor && typeof document !== 'undefined'
          ? createPortal(
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                style={portalStyle}
                className="max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
              >
                {suggestions.map((row, idx) => {
                  if (row.kind === 'all') {
                    return (
                      <li
                        key="all-products"
                        role="option"
                        aria-selected={idx === activeIndex}
                        className={`cursor-pointer px-3 py-2 border-b border-gray-100 ${
                          idx === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-gray-50'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickAll();
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <div className="font-semibold text-sm">All products</div>
                        <div className="text-xs text-gray-500 mt-0.5">Consolidated across SOs</div>
                      </li>
                    );
                  }
                  const { opt } = row;
                  return (
                    <li
                      key={opt.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={`cursor-pointer px-3 py-2 ${
                        idx === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickProduct(opt);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="font-medium text-sm text-gray-900">{opt.name || '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {opt.sku ? <span className="font-mono">{opt.sku}</span> : '—'}
                        {opt.soNumber ? (
                          <>
                            {opt.sku ? ' · ' : null}
                            <span>{opt.soNumber}</span>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>,
              document.body
            )
          : null}
        {showNoMatch && anchor && typeof document !== 'undefined'
          ? createPortal(
              <p
                style={portalStyle}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow"
              >
                No products match — try name, SKU, or SO number.
              </p>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}
