import React from 'react';

/**
 * Skeleton — token-driven loading placeholders (appearance only).
 * `Skeleton` is the base pulse block; `SkeletonText` renders shimmer lines;
 * `TableSkeleton` fills a table body while rows load; `CardSkeleton` covers a card.
 * All are decorative (`aria-hidden`) except the container variants, which expose
 * a `role="status"` + visually-hidden "Loading…" for screen readers.
 */
export const Skeleton: React.FC<{ className?: string; rounded?: string }> = ({
  className = '',
  rounded = 'rounded-md',
}) => (
  <span className={`block animate-pulse bg-surface-3 ${rounded} ${className}`} aria-hidden="true" />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <span
        key={i}
        className={`block h-3 animate-pulse rounded bg-surface-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 6,
  cols = 5,
  className = '',
}) => (
  <div className={`w-full ${className}`} role="status" aria-label="Loading">
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <span
              key={c}
              className={`h-3.5 animate-pulse rounded bg-surface-3 ${c === 0 ? 'w-[14%] shrink-0' : 'flex-1'}`}
              style={{ animationDelay: `${(r * cols + c) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
    <span className="sr-only">Loading…</span>
  </div>
);

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`rounded-[var(--r-lg)] border border-hairline bg-surface p-4 ${className}`}
    role="status"
    aria-label="Loading"
  >
    <span className="block h-3 w-1/3 animate-pulse rounded bg-surface-3" />
    <span className="mt-3 block h-7 w-1/2 animate-pulse rounded bg-surface-3" />
    <span className="mt-3 block h-3 w-2/3 animate-pulse rounded bg-surface-3" />
    <span className="sr-only">Loading…</span>
  </div>
);
