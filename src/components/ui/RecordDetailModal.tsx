import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';

/**
 * RecordDetailModal — the ONE canonical "click a record → see everything" view.
 *
 * A centered, sectioned detail modal (composes ModalOverlay for backdrop / escape /
 * focus-trap / scroll-lock). Every module wires its list rows to open this with a
 * per-record-type set of sections, so the pattern reads identically app-wide.
 *
 * Sections are either a responsive key/value grid (`fields`) or arbitrary
 * `content` (a line-items sub-table, a timeline, related records, …).
 */
export interface DetailField {
  label: ReactNode;
  value: ReactNode;
  /** Column span within the section grid. 'full' = whole row. */
  span?: 1 | 2 | 3 | 'full';
  mono?: boolean;
}

export interface DetailSection {
  title?: ReactNode;
  icon?: ReactNode;
  /** Key/value fields, laid out in a responsive grid. */
  fields?: DetailField[];
  /** …or arbitrary content (sub-table, timeline, chart, related list). Rendered after fields. */
  content?: ReactNode;
  /** Force a fixed column count for this section's field grid. */
  cols?: 2 | 3;
}

export interface RecordDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Small label above the title — usually the record type or code. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A status badge / pill node. */
  status?: ReactNode;
  icon?: ReactNode;
  sections: DetailSection[];
  /** Footer action buttons. */
  actions?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE: Record<NonNullable<RecordDetailModalProps['size']>, string> = {
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

function Field({ f }: { f: DetailField }) {
  const span =
    f.span === 'full' ? 'col-span-full'
    : f.span === 3 ? 'sm:col-span-3'
    : f.span === 2 ? 'sm:col-span-2'
    : '';
  const empty = f.value === null || f.value === undefined || f.value === '';
  return (
    <div className={`min-w-0 ${span}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{f.label}</dt>
      <dd className={`mt-0.5 text-sm break-words ${empty ? 'text-ink-4' : `text-ink ${f.mono ? 'font-mono text-[13px]' : 'font-medium'}`}`}>
        {empty ? '—' : f.value}
      </dd>
    </div>
  );
}

export function RecordDetailModal({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  status,
  icon,
  sections,
  actions,
  size = 'lg',
}: RecordDetailModalProps) {
  if (!open) return null;
  return (
    <ModalOverlay onClose={onClose} scroll z="z-[100]">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${SIZE[size]} my-auto flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--e3)]`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border bg-surface-2 px-5 py-4 shrink-0">
          {icon && <div className="mt-0.5 shrink-0 text-brand">{icon}</div>}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{eyebrow}</p>}
            <h2 className="text-lg font-semibold text-ink leading-tight break-words">{title}</h2>
            {subtitle && <p className="text-sm text-ink-3 mt-0.5 break-words">{subtitle}</p>}
          </div>
          {status && <div className="shrink-0">{status}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="shrink-0 -mr-1 p-1.5 rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4 [scrollbar-gutter:stable]">
          {sections.map((s, i) => {
            const hasFields = s.fields && s.fields.length > 0;
            if (!hasFields && !s.content) return null;
            return (
              <section key={i} className="rounded-xl border border-border bg-surface-2 p-4">
                {(s.title || s.icon) && (
                  <div className="flex items-center gap-2 mb-3">
                    {s.icon && <span className="text-ink-3 inline-flex">{s.icon}</span>}
                    {s.title && <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{s.title}</h3>}
                  </div>
                )}
                {hasFields && (
                  <dl className={`grid grid-cols-2 ${s.cols === 3 ? 'sm:grid-cols-3' : s.cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-x-6 gap-y-3`}>
                    {s.fields!.map((f, j) => <Field key={j} f={f} />)}
                  </dl>
                )}
                {s.content && <div className={hasFields ? 'mt-4' : ''}>{s.content}</div>}
              </section>
            );
          })}
        </div>

        {/* Footer */}
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

export default RecordDetailModal;
