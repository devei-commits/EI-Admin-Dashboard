import React from 'react';
import { Calendar } from 'lucide-react';
import type { DateRangeFilterInputs as DateRangeValue } from '../utils/dateRangeFilter';
import { dateRangeFilterSummary, isDateRangeFilterEmpty } from '../utils/dateRangeFilter';

export type DateRangeFilterInputsProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** e.g. "SO date" or "Order date" */
  dateFieldLabel?: string;
  className?: string;
};

export function DateRangeFilterInputs({
  value,
  onChange,
  dateFieldLabel = 'Date',
  className = '',
}: DateRangeFilterInputsProps) {
  const active = !isDateRangeFilterEmpty(value.from, value.to);
  const summary = dateRangeFilterSummary(value.from, value.to);

  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 shrink-0">
        <Calendar size={14} className="text-ink-4" aria-hidden />
        <span>{dateFieldLabel}</span>
      </div>
      <label className="flex flex-col gap-0.5 text-[10px] font-medium text-ink-3">
        From
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="px-2 py-1.5 border border-border rounded-lg text-sm bg-surface min-w-[140px]"
          aria-label={`${dateFieldLabel} from`}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-medium text-ink-3">
        To
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="px-2 py-1.5 border border-border rounded-lg text-sm bg-surface min-w-[140px]"
          aria-label={`${dateFieldLabel} to`}
        />
      </label>
      {active && summary ? (
        <span className="text-[11px] text-brand font-medium pb-1.5">{summary}</span>
      ) : (
        <span className="text-[10px] text-ink-4 pb-1.5 max-w-[200px] leading-snug">
          From only = that day · Both = range · To only = until date
        </span>
      )}
      {active ? (
        <button
          type="button"
          onClick={() => onChange({ from: '', to: '' })}
          className="text-[11px] font-semibold text-ink-2 hover:text-ink underline pb-1.5 ml-auto"
        >
          Clear dates
        </button>
      ) : null}
    </div>
  );
}
