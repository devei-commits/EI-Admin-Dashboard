import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPRProducts, type PRProductListItem } from '../../services/productsMaster.service';
import {
  buildPrProductLookup,
  getPrMasterEditPath,
  resolveMasterLinkedPrProductRows,
  type MasterLinkedPrProductRow,
} from '../../lib/masterLinkedPrProducts';

type MasterLinkedPrProductsPanelProps = {
  codes: string[];
  accent?: 'teal' | 'violet';
  variant?: 'compact' | 'table';
  className?: string;
};

const ACCENT_STYLES = {
  teal: {
    link: 'text-brand hover:text-brand focus:ring-[color:var(--ring)]',
    code: 'text-brand',
    rowHover: 'hover:bg-brand-soft/40',
  },
  violet: {
    link: 'text-brand hover:text-brand focus:ring-[color:var(--ring)]',
    code: 'text-brand',
    rowHover: 'hover:bg-brand-soft/40',
  },
} as const;

function PrMasterLink({
  productId,
  accent,
  label = 'Open PR',
}: {
  productId: number;
  accent: 'teal' | 'violet';
  label?: string;
}): React.ReactElement {
  const styles = ACCENT_STYLES[accent];
  return (
    <Link
      to={getPrMasterEditPath(productId)}
      className={`inline-flex items-center gap-1 rounded text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 ${styles.link}`}
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function CompactLinkedPrList({
  rows,
  accent,
  loading,
}: {
  rows: MasterLinkedPrProductRow[];
  accent: 'teal' | 'violet';
  loading: boolean;
}): React.ReactElement {
  const styles = ACCENT_STYLES[accent];
  return (
    <ul className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
      {loading ? (
        <li className="text-xs text-ink-3">Loading product master…</li>
      ) : null}
      {rows.map(({ sku, product }, i) => (
        <li
          key={`${sku}-${i}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <span className={`font-mono font-semibold ${styles.code}`}>{sku}</span>
            {product?.product_name ? (
              <span className="ml-2 text-ink-2">{product.product_name}</span>
            ) : (
              <span className="ml-2 text-ink-4">Not found in PR master</span>
            )}
          </div>
          {product?.product_id ? (
            <PrMasterLink productId={product.product_id} accent={accent} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PrRecordTypeBadge({ type }: { type?: PRProductListItem['pr_record_type'] }): React.ReactElement {
  if (type === 'temporary') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30">
        Temporary
      </span>
    );
  }
  if (type === 'permanent') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-3 text-ink border border-border">
        Permanent
      </span>
    );
  }
  return <span className="text-ink-4 text-xs">—</span>;
}

function TableLinkedPrList({
  rows,
  accent,
  loading,
}: {
  rows: MasterLinkedPrProductRow[];
  accent: 'teal' | 'violet';
  loading: boolean;
}): React.ReactElement {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="overflow-auto max-h-[70vh] rounded-lg border border-border">
      <table className="w-full min-w-[720px]">
        <thead className="sticky top-0 z-1 bg-surface-3 border-b border-border">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wide">Code</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wide">Record</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wide">Category</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wide">Sub-category</th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-ink-3 uppercase tracking-wide">RM ings.</th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-ink-3 uppercase tracking-wide">Pack items</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ sku, product }, i) => (
            <tr key={`${sku}-${i}`} className={`bg-surface transition-colors ${styles.rowHover}`}>
              <td className="px-4 py-3 text-sm font-mono font-semibold text-ink break-all">
                {product?.product_code?.trim() || sku}
                {!product ? (
                  <p className="mt-0.5 text-[10px] font-sans font-normal text-ink-4">Not in PR master</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap">
                {product ? <PrRecordTypeBadge type={product.pr_record_type} /> : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-ink-3">{product?.category?.trim() || '—'}</td>
              <td className="px-4 py-3 text-sm text-ink-3 wrap-break-word">
                {product?.pr_sub_category?.trim() || '—'}
              </td>
              <td className="px-4 py-3 text-sm font-mono font-semibold text-brand text-center">
                {product ? (product.rm_ingredients_count ?? 0) : '—'}
              </td>
              <td className="px-4 py-3 text-sm font-mono font-semibold text-warn text-center">
                {product ? (product.pack_items_count ?? 0) : '—'}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {product?.product_id ? (
                  <PrMasterLink productId={product.product_id} accent={accent} label="Open PR master" />
                ) : (
                  <span className="text-ink-4 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? (
        <p className="border-t border-hairline px-4 py-2 text-xs text-ink-3">Loading product master…</p>
      ) : null}
    </div>
  );
}

export const MasterLinkedPrProductsPanel: React.FC<MasterLinkedPrProductsPanelProps> = ({
  codes,
  accent = 'teal',
  variant = 'compact',
  className = '',
}) => {
  const uniqueCodes = useMemo(
    () => [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))],
    [codes]
  );

  const { data: prProductsLookupResult, isFetching } = useQuery({
    queryKey: ['pr-products-lookup-for-linked-master-items'],
    queryFn: () => fetchPRProducts(),
    enabled: uniqueCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const linkedRows = useMemo(() => {
    const ok = prProductsLookupResult?.success === true;
    const rows = ok ? prProductsLookupResult.data ?? [] : [];
    const lookup = buildPrProductLookup(rows);
    return resolveMasterLinkedPrProductRows(uniqueCodes, lookup);
  }, [prProductsLookupResult, uniqueCodes]);

  if (uniqueCodes.length === 0) return null;

  return (
    <div className={className}>
      {prProductsLookupResult && prProductsLookupResult.success === false ? (
        <p className="mb-2 rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          Could not load Products master. Linked codes are still listed below.
        </p>
      ) : null}
      {variant === 'table' ? (
        <TableLinkedPrList rows={linkedRows} accent={accent} loading={isFetching} />
      ) : (
        <CompactLinkedPrList rows={linkedRows} accent={accent} loading={isFetching} />
      )}
    </div>
  );
};
