/**
 * TanStack Query hooks for vendor-client — list (optional type filter) and by id.
 */
import { queryKeys } from '../lib/queryClient';
import { createListQueryWithParams, useDetailQuery, createMutation } from '../lib/queryHooksFactory';
import * as vendorClientService from '../services/vendorClient.service';

type VendorClientType = 'vendor' | 'client' | undefined;

export const useVendorClientsList = createListQueryWithParams<
  vendorClientService.VendorClientRecord[],
  { type?: VendorClientType }
>(
  (params) => [...queryKeys.vendorClients, params.type ?? 'all'],
  (params) => vendorClientService.fetchVendorClients(params.type),
  { staleTime: 2 * 60 * 1000 },
);

export function useVendorClient(id: string | null) {
  return createDetailQuery(
    (i) => queryKeys.vendorClient(i),
    id,
    () => (id ? vendorClientService.fetchVendorClientById(id) : Promise.resolve(null)),
    { enabled: !!id },
  );
}

export const useCreateVendorClient = createMutation(vendorClientService.createVendorClient, [
  queryKeys.vendorClients,
]);
export const useUpdateVendorClient = createMutation(
  ({ id, payload }: { id: string; payload: Parameters<typeof vendorClientService.updateVendorClient>[1] }) =>
    vendorClientService.updateVendorClient(id, payload),
  (_, { id }) => [queryKeys.vendorClients, queryKeys.vendorClient(id)],
);
export const useDeleteVendorClient = createMutation(vendorClientService.deleteVendorClient, [
  queryKeys.vendorClients,
]);
