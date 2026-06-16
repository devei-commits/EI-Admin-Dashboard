import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPRProducts } from '../../services/productsMaster.service';
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
    link: 'text-teal-600 hover:text-teal-800 focus:ring-teal-400',
    code: 'text-teal-800',
    rowHover: 'hover:bg-teal-50/40',
  },
  violet: {
    link: 'text-violet-600 hover:text-violet-800 focus:ring-violet-400',
    code: 'text-violet-800',
    rowHover: 'hover:bg-violet-50/40',
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
    <ul className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      {loading ? (
        <li className="text-xs text-gray-500">Loading product master…</li>
      ) : null}
      {rows.map(({ sku, product }, i) => (
        <li
          key={`${sku}-${i}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-white px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <span className={`font-mono font-semibold ${styles.code}`}>{sku}</span>
            {product?.product_name ? (
              <span className="ml-2 text-gray-700">{product.product_name}</span>
            ) : (
              <span className="ml-2 text-gray-400">Not found in PR master</span>
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
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="sticky top-0 z-1 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Linked SKU / code</th>
            <th className="px-3 py-2">Product name</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Subcategory</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">PR master</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-800">
          {rows.map(({ sku, product }, i) => (
            <tr key={`${sku}-${i}`} className={`bg-white ${styles.rowHover}`}>
              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
              <td className={`px-3 py-2 font-mono font-semibold break-all ${styles.code}`}>{sku}</td>
              <td className="px-3 py-2 wrap-break-word">{product?.product_name ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600">{product?.category ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 wrap-break-word">{product?.pr_sub_category?.trim() || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{product?.status ?? '—'}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {product?.product_id ? (
                  <PrMasterLink productId={product.product_id} accent={accent} label="Open PR master" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">Loading product master…</p> : null}
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
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
