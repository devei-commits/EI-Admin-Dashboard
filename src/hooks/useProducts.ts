/**
 * TanStack Query hooks for products (PR/catalogue list and detail).
 */
import { queryKeys } from '../lib/queryClient';
import { createListQuery, createDetailQuery } from '../lib/queryHooksFactory';
import * as productsMasterService from '../services/productsMaster.service';

export const useProductsList = createListQuery(
  queryKeys.products,
  () => productsMasterService.fetchPRProducts(),
  { staleTime: 2 * 60 * 1000 },
);

export function useProductDetail(productId: number | string | null) {
  return createDetailQuery(
    (id) => queryKeys.product(id),
    productId != null ? String(productId) : null,
    () =>
      productId != null
        ? productsMasterService.fetchPRProductDetail(productId)
        : Promise.resolve(null),
    { enabled: productId != null },
  );
}
