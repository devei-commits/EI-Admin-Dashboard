import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { VendorClientRecord } from '../services/vendorClient.service';

const MAX_SUGGESTIONS = 50;

function partySearchHaystack(record: VendorClientRecord): string {
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};
  const code = String(
    record.entityCode ?? data.entityCode ?? data.entity_code ?? ''
  ).trim();
  const trade = String(data.tradeName ?? data.trade_name ?? '').trim();
  const legal = String(data.legalName ?? data.legal_name ?? '').trim();
  return [
    record.name ?? '',
    code,
    trade,
    legal,
    record.email ?? '',
    record.phone ?? '',
    record.city ?? '',
    record.location ?? '',
    record.country ?? '',
    record.category ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(haystack: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const token of tokens) {
    if (!haystack.includes(token)) return -1;
    if (haystack.startsWith(token)) score += 100;
    else {
      const wordStart = haystack.split(' ').some((w) => w.startsWith(token));
      score += wordStart ? 50 : 10;
    }
  }
  return score;
}

export function filterVendorClientsForTypeahead(
  records: VendorClientRecord[],
  query: string,
  max = MAX_SUGGESTIONS
): VendorClientRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return records.slice(0, max);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const ranked = records
    .map((record) => {
      const haystack = partySearchHaystack(record);
      const score = matchScore(haystack, tokens);
      return score >= 0 ? { record, score } : null;
    })
    .filter((row): row is { record: VendorClientRecord; score: number } => row != null)
    .sort((a, b) => b.score - a.score || partySearchHaystack(a.record).localeCompare(partySearchHaystack(b.record)));
  return ranked.slice(0, max).map((r) => r.record);
}

export type VendorClientNameTypeaheadProps = {
  parties: VendorClientRecord[];
  selectedId: string;
  onSelect: (party: VendorClientRecord | null) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputId?: string;
  disabledIds?: Set<string>;
  allowClear?: boolean;
  /** Combobox mode: keep typed text (e.g. new vendor name) while still showing master suggestions. */
  allowFreeText?: boolean;
  freeTextValue?: string;
  onFreeTextChange?: (value: string) => void;
  partyKind?: 'vendor' | 'client';
};

export default function VendorClientNameTypeahead({
  parties,
  selectedId,
  onSelect,
  loading = false,
  disabled = false,
  placeholder = 'Search by client name, code, city…',
  className = '',
  inputId,
  disabledIds,
  allowClear = true,
  allowFreeText = false,
  freeTextValue,
  onFreeTextChange,
  partyKind = 'client',
}: VendorClientNameTypeaheadProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');

  const selectedParty = useMemo(
    () => parties.find((p) => String(p.id) === String(selectedId)) ?? null,
    [parties, selectedId]
  );

  useEffect(() => {
    if (allowFreeText) {
      setInputValue(freeTextValue ?? '');
      return;
    }
    if (selectedParty) {
      setInputValue(selectedParty.name ?? selectedParty.id);
    } else if (!selectedId) {
      setInputValue('');
    }
  }, [allowFreeText, freeTextValue, selectedParty, selectedId]);

  const suggestions = useMemo(() => {
    const filtered = filterVendorClientsForTypeahead(parties, inputValue, MAX_SUGGESTIONS);
    return filtered.map((p) => ({
      party: p,
      disabled: disabledIds?.has(String(p.id)) ?? false,
    }));
  }, [parties, inputValue, disabledIds]);

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

  const pick = (party: VendorClientRecord) => {
    if (disabledIds?.has(String(party.id))) return;
    const label = party.name ?? party.id;
    onSelect(party);
    setInputValue(label);
    onFreeTextChange?.(label);
    setOpen(false);
  };

  const clearSelection = () => {
    onSelect(null);
    setInputValue('');
    onFreeTextChange?.('');
    setOpen(false);
  };

  const onInputChange = (next: string) => {
    setInputValue(next);
    if (allowFreeText) {
      onFreeTextChange?.(next);
      setOpen(true);
      return;
    }
    if (selectedId) onSelect(null);
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
      const row = suggestions[activeIndex];
      if (!row.disabled) pick(row.party);
    }
  };

  const showList = open && !disabled && !loading && suggestions.length > 0;
  const showEmpty = open && !disabled && !loading && inputValue.trim() && suggestions.length === 0;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList || showEmpty}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled || loading}
          placeholder={
            loading
              ? partyKind === 'vendor'
                ? 'Loading vendors…'
                : 'Loading clients…'
              : placeholder
          }
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full min-w-[200px] rounded-lg border border-gray-300 px-3 py-1.5 pr-8 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {allowClear && (selectedId || inputValue) ? (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label={partyKind === 'vendor' ? 'Clear vendor' : 'Clear client'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-52 w-full min-w-[220px] overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((row, idx) => {
            const code = String(
              row.party.entityCode ??
                row.party.data?.entityCode ??
                row.party.data?.entity_code ??
                ''
            ).trim();
            const meta = [code, row.party.city, row.party.location].filter(Boolean).join(' · ');
            return (
              <li
                key={String(row.party.id)}
                role="option"
                aria-selected={idx === activeIndex}
                aria-disabled={row.disabled}
                className={`px-3 py-2 ${
                  row.disabled
                    ? 'cursor-not-allowed text-gray-400'
                    : idx === activeIndex
                      ? 'cursor-pointer bg-teal-50 text-teal-900'
                      : 'cursor-pointer text-gray-800 hover:bg-gray-50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!row.disabled) pick(row.party);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="font-medium">{row.party.name ?? row.party.id}</div>
                {meta ? <div className="text-xs text-gray-500">{meta}</div> : null}
                {row.disabled ? (
                  <span className="text-[10px] text-gray-400">(already has pricing)</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {showEmpty ? (
        <p className="absolute z-40 mt-1 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          {partyKind === 'vendor'
            ? 'No matching vendors. Try another name or type a new vendor.'
            : 'No matching clients. Try another name or city.'}
        </p>
      ) : null}
    </div>
  );
}
