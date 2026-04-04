import type { QueryClient } from '@tanstack/react-query';
import { fetchPackMaterialsPage } from '../services/packMaterials.service';
import { fetchRawMaterialsPage } from '../services/rawMaterials.service';
import { fetchItemGroupsPage } from '../services/itemGroups.service';
import { fetchVendorClientsPage, fetchVendorClients } from '../services/vendorClient.service';
import { fetchPriceListPage } from '../services/itemsList.service';
import { fetchProcurementRequests } from '../services/procurement.service';
import { fetchProcurementQuotations } from '../services/procurementQuotations.service';
import { fetchPurchaseOrders } from '../services/salesPurchase.service';
import { fetchWarehouseInventory } from '../services/warehouseInventory.service';
import { fetchWarehouseOverview } from '../services/warehouseOverview.service';
import { fetchPlanningExtractedList } from '../services/planningExtracted.service';

const DEFAULT_PAGE_LIMIT = 25;
const DEFAULT_VC_PAGE_LIMIT = 10;

function normalizePath(path: string): string {
  // NavLink `to` can occasionally include a trailing slash.
  return (path || '').split('?')[0].replace(/\/$/, '') || '/';
}

/**
 * Route -> "critical" TanStack Query prefetch for hover navigation.
 * Keep query keys in sync with the pages that render the data.
 */
export function prefetchCriticalRouteData(path: string, queryClient: QueryClient): void {
  const p = normalizePath(path);

  switch (p) {
    case '/raw-material': {
      void queryClient.prefetchQuery({
        queryKey: ['raw-materials-page', '', DEFAULT_PAGE_LIMIT, 0, 0],
        queryFn: () =>
          fetchRawMaterialsPage({
            search: undefined,
            limit: DEFAULT_PAGE_LIMIT,
            offset: 0,
          }),
      });
      return;
    }

    case '/packaging': {
      void queryClient.prefetchQuery({
        queryKey: ['pack-materials-page', '', DEFAULT_PAGE_LIMIT, 0, 0],
        queryFn: () =>
          fetchPackMaterialsPage({
            search: undefined,
            limit: DEFAULT_PAGE_LIMIT,
            offset: 0,
          }),
      });
      return;
    }

    case '/item-groups': {
      void queryClient.prefetchQuery({
        queryKey: ['item-groups-page', undefined, '', DEFAULT_PAGE_LIMIT, 0],
        queryFn: () =>
          fetchItemGroupsPage({
            type: undefined,
            search: undefined,
            limit: DEFAULT_PAGE_LIMIT,
            offset: 0,
          }),
      });
      return;
    }

    case '/vendor-client': {
      // Default tab on page is "vendor-master"
      void queryClient.prefetchQuery({
        queryKey: ['vendor-client-page', 'vendor', '', 'all', 'all', DEFAULT_VC_PAGE_LIMIT, 0],
        queryFn: () =>
          fetchVendorClientsPage({
            type: 'vendor',
            search: undefined,
            status: 'all',
            category: 'all',
            limit: DEFAULT_VC_PAGE_LIMIT,
            offset: 0,
          }),
      });

      void queryClient.prefetchQuery({
        queryKey: ['vendor-client-page', 'client', '', 'all', 'all', DEFAULT_VC_PAGE_LIMIT, 0],
        queryFn: () =>
          fetchVendorClientsPage({
            type: 'client',
            search: undefined,
            status: 'all',
            category: 'all',
            limit: DEFAULT_VC_PAGE_LIMIT,
            offset: 0,
          }),
      });

      return;
    }

    case '/items-list': {
      void queryClient.prefetchQuery({
        queryKey: ['items-list-vendors', 'vendor'],
        queryFn: async () => {
          const res = await fetchVendorClients('vendor');
          if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load vendors');
          return res.data;
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['items-list-vendors', 'client'],
        queryFn: async () => {
          const res = await fetchVendorClients('client');
          if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load clients');
          return res.data;
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['items-list-pageitems', 'rm'],
        queryFn: async () => {
          const res = await fetchPriceListPage('RM');
          if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load RM price list');
          return res.data;
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['items-list-pageitems', 'pm'],
        queryFn: async () => {
          const res = await fetchPriceListPage('PM');
          if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load PM price list');
          return res.data;
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['items-list-pageitems', 'pr'],
        queryFn: async () => {
          const res = await fetchPriceListPage('PR');
          if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load PR price list');
          return res.data;
        },
      });

      return;
    }

    case '/warehouse': {
      void queryClient.prefetchQuery({
        queryKey: ['warehouse-overview'],
        queryFn: async () => {
          const data = await fetchWarehouseOverview();
          if (data == null) throw new Error('Failed to load warehouse overview');
          return data;
        },
      });
      return;
    }

    case '/procurement': {
      void queryClient.prefetchQuery({
        queryKey: ['procurement-requests'],
        queryFn: async () => {
          const res = await fetchProcurementRequests();
          return res.success ? (res.data ?? []) : [];
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['procurement-quotations'],
        queryFn: async () => {
          const res = await fetchProcurementQuotations();
          return res.success ? (res.data ?? []) : [];
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['purchase-orders'],
        queryFn: async () => {
          const res = await fetchPurchaseOrders();
          return res.success ? (res.data ?? []) : [];
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['warehouse-inventory'],
        queryFn: async () => {
          const res = await fetchWarehouseInventory();
          return res.success ? res.data : null;
        },
      });

      return;
    }

    case '/planning': {
      void queryClient.prefetchQuery({
        queryKey: ['planning-extracted'],
        queryFn: () => fetchPlanningExtractedList(),
      });

      void queryClient.prefetchQuery({
        queryKey: ['procurement-requests'],
        queryFn: async () => {
          const res = await fetchProcurementRequests();
          return res.success ? (res.data ?? []) : [];
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['purchase-orders'],
        queryFn: async () => {
          const res = await fetchPurchaseOrders();
          return res.success ? (res.data ?? []) : [];
        },
      });

      void queryClient.prefetchQuery({
        queryKey: ['warehouse-inventory'],
        queryFn: async () => {
          const res = await fetchWarehouseInventory();
          return res.success ? res.data : null;
        },
      });

      return;
    }

    default:
      return;
  }
}

