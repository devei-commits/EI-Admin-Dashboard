import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { VendorClient as VendorClientType } from '../context/VendorClientContext';
import {
 fetchVendorClientsPage,
 fetchVendorClientById,
 updateVendorClient as updateVendorClientApi,
 deleteVendorClient as deleteVendorClientApi,
 importClientMasterExcel,
 importVendorMasterExcel,
} from '../services/vendorClient.service';
import { useToast } from '../context/ToastContext';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import { EmptyState } from '../components/ui/EmptyState';
import VendorForm from './VendorForm.tsx';
import ClientForm from './ClientForm.tsx';

type VendorClientSortColumn =
 | 'code'
 | 'name'
 | 'zohoId'
 | 'category'
 | 'email'
 | 'phone'
 | 'state'
 | 'status'
 | 'updated';

function compareSortValues(av: string | number, bv: string | number, direction: SortDirection): number {
 let cmp: number;
 if (typeof av === 'number' && typeof bv === 'number') {
  cmp = av - bv;
 } else {
  cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
 }
 return direction === 'asc' ? cmp : -cmp;
}

function sortValueForVendorClientRow(row: VendorClientType, col: VendorClientSortColumn): string | number {
 switch (col) {
  case 'code':
   return String(row.data?.entityCode || '');
  case 'name':
   return row.name || '';
  case 'zohoId':
   return row.zohoId || String((row.data as { zohoId?: string } | undefined)?.zohoId || '');
  case 'category':
   return row.category || '';
  case 'email':
   return row.email || '';
  case 'phone':
   return row.phone || '';
  case 'state':
   return row.location || '';
  case 'status':
   return row.status || '';
  case 'updated':
   return row.lastModified ? new Date(row.lastModified).getTime() : 0;
  default:
   return '';
 }
}

const VendorClientField: React.FC<{ label: string; value?: unknown; mono?: boolean }> = ({ label, value, mono }) => {
 const isEl = React.isValidElement(value);
 const display =
  value === null || value === undefined || value === ''
   ? '-'
   : !isEl
     ? String(value)
     : null;
 return (
  <div>
   <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</div>
   <div className={`text-sm text-gray-800 mt-1 ${mono ? 'font-mono' : ''}`}>{isEl ? value : display}</div>
  </div>
 );
};

const STATUS_OPTIONS: VendorClientType['status'][] = ['active', 'inactive', 'pending'];

const STATUS_BADGE_CLASS: Record<VendorClientType['status'], string> = {
 active: 'bg-green-50 text-green-700 border-green-200',
 inactive: 'bg-gray-100 text-gray-600 border-gray-200',
 pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const StatusSelect: React.FC<{
 value: VendorClientType['status'];
 onChange: (next: VendorClientType['status']) => void;
}> = ({ value, onChange }) => {
 const current = value || 'pending';
 return (
  <select
   value={current}
   aria-label="Status"
   onClick={(e) => e.stopPropagation()}
   onChange={(e) => onChange(e.target.value as VendorClientType['status'])}
   className={`px-2 py-1 rounded-lg border text-xs font-semibold capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${STATUS_BADGE_CLASS[current]}`}
  >
   {STATUS_OPTIONS.map((opt) => (
    <option key={opt} value={opt}>{opt}</option>
   ))}
  </select>
 );
};

const VendorClientSection: React.FC<{ title: string; icon?: string; children: React.ReactNode }> = ({ title, icon, children }) => (
 <div className="mt-6">
  <div className="flex items-center gap-2 mb-3">
   {icon && <span className="text-base leading-none">{icon}</span>}
   <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</div>
  </div>
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">{children}</div>
 </div>
);

const VendorClient: React.FC = () => {
 const { addToast } = useToast();
  const queryClient = useQueryClient();
 const [activeTab, setActiveTab] = useState<'vendor-master' | 'client-master'>('vendor-master');
 const [vendorCreateModalOpen, setVendorCreateModalOpen] = useState(false);
 const [clientCreateModalOpen, setClientCreateModalOpen] = useState(false);
 const [editing, setEditing] = useState<{ id: string; type: 'vendor' | 'client' } | null>(null);

 const [viewing, setViewing] = useState<VendorClientType | null>(null);

 const [vendorSearch, setVendorSearch] = useState('');
 const [vendorStatus, setVendorStatus] = useState<'all' | VendorClientType['status']>('all');
 const [vendorCategory, setVendorCategory] = useState<string>('all');
 const [vendorPage, setVendorPage] = useState(1);
 const [vendorPageSize, setVendorPageSize] = useState(10);

 const [clientSearch, setClientSearch] = useState('');
 const [clientStatus, setClientStatus] = useState<'all' | VendorClientType['status']>('all');
 const [clientCategory, setClientCategory] = useState<string>('all');
 const [clientPage, setClientPage] = useState(1);
 const [clientPageSize, setClientPageSize] = useState(10);
 const [vendorSortColumn, setVendorSortColumn] = useState<VendorClientSortColumn | null>(null);
 const [vendorSortDirection, setVendorSortDirection] = useState<SortDirection>('asc');
 const [clientSortColumn, setClientSortColumn] = useState<VendorClientSortColumn | null>(null);
 const [clientSortDirection, setClientSortDirection] = useState<SortDirection>('asc');
 const [importingClientExcel, setImportingClientExcel] = useState(false);
 const [importingVendorExcel, setImportingVendorExcel] = useState(false);
 const clientExcelFileRef = useRef<HTMLInputElement>(null);
 const vendorExcelFileRef = useRef<HTMLInputElement>(null);

 const csvEscape = (value: unknown) => {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
 };

 const downloadCsv = (rows: Array<Record<string, unknown>>, fileName: string) => {
  const headers = Object.keys(rows[0] || {});
  const csv = [
   headers.join(','),
   ...rows.map(r => headers.map(h => csvEscape(r[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
 };

 const tabs = [
  { id: 'vendor-master' as const, label: 'Vendor Master', icon: '' },
  { id: 'client-master' as const, label: 'Client Master', icon: '' },
 ];

 const vendorOffset = (vendorPage - 1) * vendorPageSize;
 const clientOffset = (clientPage - 1) * clientPageSize;

 const trimmedVendorSearch = vendorSearch.trim();
 const trimmedClientSearch = clientSearch.trim();

 const { data: vendorPageData } = useQuery({
  queryKey: [
   'vendor-client-page',
   'vendor',
   trimmedVendorSearch,
   vendorStatus,
   vendorCategory,
   vendorPageSize,
   vendorPage,
  ],
  queryFn: () =>
   fetchVendorClientsPage({
    type: 'vendor',
    search: trimmedVendorSearch || undefined,
    status: vendorStatus,
    category: vendorCategory,
    limit: vendorPageSize,
    offset: vendorOffset,
   }),
  staleTime: 2 * 60 * 1000,
  placeholderData: (previousData) => previousData,
 });

 const { data: clientPageData } = useQuery({
  queryKey: [
   'vendor-client-page',
   'client',
   trimmedClientSearch,
   clientStatus,
   clientCategory,
   clientPageSize,
   clientPage,
  ],
  queryFn: () =>
   fetchVendorClientsPage({
    type: 'client',
    search: trimmedClientSearch || undefined,
    status: clientStatus,
    category: clientCategory,
    limit: clientPageSize,
    offset: clientOffset,
   }),
  staleTime: 2 * 60 * 1000,
  placeholderData: (previousData) => previousData,
 });

 const vendors = vendorPageData?.rows ?? [];
 const clients = clientPageData?.rows ?? [];

 const vendorCategories = useMemo(() => {
  const cats = Array.from(new Set(vendors.map(v => v.category).filter(Boolean))).sort();
  return cats;
 }, [vendors]);

 const clientCategories = useMemo(() => {
  const cats = Array.from(new Set(clients.map(v => v.category).filter(Boolean))).sort();
  return cats;
 }, [clients]);

 const filteredVendors = vendors;
 const filteredClients = clients;

 const vendorTotal = vendorPageData?.total ?? 0;
 const clientTotal = clientPageData?.total ?? 0;

 const vendorTotalPages = Math.max(1, Math.ceil(vendorTotal / vendorPageSize));
 const clientTotalPages = Math.max(1, Math.ceil(clientTotal / clientPageSize));

 // Server returns rows for the requested page (so no additional slicing).
 const pagedVendors = filteredVendors;
 const pagedClients = filteredClients;

 const sortedPagedVendors = useMemo(() => {
  if (!vendorSortColumn) return pagedVendors;
  return [...pagedVendors].sort((a, b) => {
   const cmp = compareSortValues(
    sortValueForVendorClientRow(a, vendorSortColumn),
    sortValueForVendorClientRow(b, vendorSortColumn),
    vendorSortDirection
   );
   if (cmp !== 0) return cmp;
   return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
  });
 }, [pagedVendors, vendorSortColumn, vendorSortDirection]);

 const sortedPagedClients = useMemo(() => {
  if (!clientSortColumn) return pagedClients;
  return [...pagedClients].sort((a, b) => {
   const cmp = compareSortValues(
    sortValueForVendorClientRow(a, clientSortColumn),
    sortValueForVendorClientRow(b, clientSortColumn),
    clientSortDirection
   );
   if (cmp !== 0) return cmp;
   return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
  });
 }, [pagedClients, clientSortColumn, clientSortDirection]);

 const toggleVendorSort = (column: VendorClientSortColumn) => {
  if (vendorSortColumn === column) {
   setVendorSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
   return;
  }
  setVendorSortColumn(column);
  setVendorSortDirection('asc');
 };

 const toggleClientSort = (column: VendorClientSortColumn) => {
  if (clientSortColumn === column) {
   setClientSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
   return;
  }
  setClientSortColumn(column);
  setClientSortDirection('asc');
 };

 useEffect(() => {
  setVendorPage(1);
 }, [trimmedVendorSearch, vendorStatus, vendorCategory]);

 useEffect(() => {
  setClientPage(1);
 }, [trimmedClientSearch, clientStatus, clientCategory]);

 useEffect(() => {
  if (!vendorPageData) return;
  if (vendorPage > vendorTotalPages) setVendorPage(vendorTotalPages);
 }, [vendorPage, vendorTotalPages, vendorPageData]);

 useEffect(() => {
  if (!clientPageData) return;
  if (clientPage > clientTotalPages) setClientPage(clientTotalPages);
 }, [clientPage, clientTotalPages, clientPageData]);

 const openVendorCreate = () => {
  setVendorCreateModalOpen(true);
 };

 const openClientCreate = () => {
  setClientCreateModalOpen(true);
 };

 const openVendorEdit = (id: string) => {
  setViewing(null);
  setEditing({ id, type: 'vendor' });
 };

 const openClientEdit = (id: string) => {
  setViewing(null);
  setEditing({ id, type: 'client' });
 };

 const handleDelete = async (id: string) => {
  const ok = window.confirm('Delete this record? This cannot be undone.');
  if (!ok) return;

  const res = await deleteVendorClientApi(id);
  if (!res.success) {
   addToast('error', res.error?.message ?? 'Failed to delete');
   return;
  }

  // Close details panel if the deleted record is being viewed/edited.
  if (viewing?.id === id) setViewing(null);
  if (editing?.id === id) setEditing(null);

  await queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
  addToast('success', 'Record deleted');
 };

 const handleStatusChange = async (id: string, status: VendorClientType['status']) => {
  const res = await updateVendorClientApi(id, { status });
  if (!res.success) {
   addToast('error', res.error?.message ?? 'Failed to update status');
   return;
  }

  // Keep side panel in sync if the same record is open.
  if (viewing?.id === id) {
   setViewing(prev => (prev && prev.id === id ? { ...prev, status } : prev));
  }

  await queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
  addToast('success', 'Status updated');
 };

 const openView = useCallback(
  async (vc: VendorClientType) => {
   // The paginated list rows can be stale and sometimes omit large nested JSON blobs.
   // Always refetch the latest record so "Vendor Items & Price List" reflects recent saves.
   try {
    const res = await fetchVendorClientById(String(vc.id));
    if (res.success && res.data) {
     setViewing(res.data as unknown as VendorClientType);
     return;
    }
   } catch {
    // Ignore and fall back to the list row.
   }
   setViewing(vc);
  },
  []
 );

 const closeView = () => {
  setViewing(null);
 };

 const closeEdit = () => {
  setEditing(null);
 };

 const handleVendorExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  setImportingVendorExcel(true);
  try {
   const res = await importVendorMasterExcel(file, { details: true });
   const s = res.summary;
   if (!res.ok) {
    addToast('error', res.error ?? 'Vendor import failed');
    return;
   }
   const ps = res.parse_stats;
   const is = res.import_stats;
   const skipHint =
    ps && (ps.skipped_no_identity || ps.skipped_no_name)
     ? ` (${ps.skipped_no_identity ?? 0} empty rows, ${ps.skipped_no_name ?? 0} without name skipped)`
     : '';
   const zohoHint =
    ps?.zoho_unreliable_rows
     ? ` · ${ps.zoho_unreliable_rows} rows matched by vendor details (scientific Zoho IDs in Excel)`
     : '';
   const mergeHint =
    is && (is.merged_duplicate_rows || is.zoho_id_collisions_cleared)
     ? ` · ${is.unique_zoho_ids ?? 0} unique Zoho IDs (${is.merged_duplicate_rows ?? 0} duplicate lines merged, ${is.zoho_id_collisions_cleared ?? 0} ID collisions split)`
     : is?.unique_zoho_ids != null
       ? ` · ${is.unique_zoho_ids} unique Zoho IDs`
       : '';
   addToast(
    'success',
    `Vendors: ${s?.vendors_created ?? 0} created, ${s?.vendors_updated ?? 0} updated, ${res.rows_imported ?? res.rows_total ?? 0} imported from ${res.rows_total ?? 0} Excel rows${mergeHint}${zohoHint}${skipHint}, ${s?.errors ?? 0} errors`
   );
   if ((s?.errors ?? 0) > 0 && res.row_log?.length) {
    const sample = res.row_log
     .filter((r) => r.action === 'error')
     .slice(0, 3)
     .map((r) => `row ${r.excel_row}: ${r.reason ?? r.action}`)
     .join('; ');
    if (sample) addToast('info', `Sample issues: ${sample}`);
   }
   await queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
  } catch (err) {
   addToast('error', err instanceof Error ? err.message : 'Vendor import failed');
  } finally {
   setImportingVendorExcel(false);
  }
 };

 const handleClientExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  setImportingClientExcel(true);
  try {
   const res = await importClientMasterExcel(file, { details: true });
   const s = res.summary;
   if (!res.ok) {
    addToast('error', res.error ?? 'Client import failed');
    return;
   }
   const ps = res.parse_stats;
   const is = res.import_stats;
   const skipHint =
    ps && (ps.skipped_no_identity || ps.skipped_no_name)
     ? ` (${ps.skipped_no_identity ?? 0} empty rows, ${ps.skipped_no_name ?? 0} without name skipped)`
     : '';
   const zohoHint =
    ps?.zoho_unreliable_rows
     ? ` · ${ps.zoho_unreliable_rows} rows matched by client details (scientific Zoho IDs in Excel)`
     : '';
   const mergeHint =
    is && (is.merged_duplicate_rows || is.zoho_id_collisions_cleared)
     ? ` · ${is.unique_zoho_ids ?? 0} unique Zoho IDs (${is.merged_duplicate_rows ?? 0} duplicate lines merged, ${is.zoho_id_collisions_cleared ?? 0} ID collisions split)`
     : is?.unique_zoho_ids != null
       ? ` · ${is.unique_zoho_ids} unique Zoho IDs`
       : '';
   addToast(
    'success',
    `Clients: ${s?.clients_created ?? 0} created, ${s?.clients_updated ?? 0} updated, ${res.rows_imported ?? res.rows_total ?? 0} imported from ${res.rows_total ?? 0} Excel rows${mergeHint}${zohoHint}${skipHint}, ${s?.errors ?? 0} errors`
   );
   if ((s?.errors ?? 0) > 0 && res.row_log?.length) {
    const sample = res.row_log
     .filter((r) => r.action === 'error')
     .slice(0, 3)
     .map((r) => `row ${r.excel_row}: ${r.reason ?? r.action}`)
     .join('; ');
    if (sample) addToast('info', `Sample issues: ${sample}`);
   }
   await queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
  } catch (err) {
   addToast('error', err instanceof Error ? err.message : 'Client import failed');
  } finally {
   setImportingClientExcel(false);
  }
 };

 const renderListTable = (
  headers: string[],
  rows: Array<Array<unknown>>,
 ) => (
  <div className="overflow-auto max-h-[70vh]">
   <table className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
    <thead className="sticky top-0 z-20 bg-gray-100">
     <tr className="[&_th]:bg-gray-100">
      {headers.map(h => (
       <th scope="col" key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-600">{h}</th>
      ))}
     </tr>
    </thead>
    <tbody>
     {rows.length === 0 ? (
      <tr>
       <td colSpan={headers.length} className="px-3 py-4 text-sm text-gray-500 text-center">No records</td>
      </tr>
     ) : (
      rows.map((r, idx) => (
       <tr key={idx} className="border-t border-gray-200">
        {r.map((cell, cidx) => (
         <td key={cidx} className="px-3 py-2 text-sm text-gray-800">{cell === '' || cell === null || cell === undefined ? '-' : String(cell)}</td>
        ))}
       </tr>
      ))
     )}
    </tbody>
   </table>
  </div>
 );

 const renderCellValue = (value: unknown) => {
  const display = value === null || value === undefined || value === '' ? '-' : String(value);
  const isDash = display === '-';
  return (
   <span className={isDash ? 'block text-center text-gray-500' : ''}>
    {display}
   </span>
  );
 };

 const renderContent = () => {
  switch (activeTab) {
   case 'vendor-master':
    return (
     <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
       <div>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Vendor Master</h2>
        <p className="text-sm text-gray-500">{vendorTotal} vendor(s)</p>
       </div>
       <div className="flex flex-wrap gap-2">
        <input
         ref={vendorExcelFileRef}
         type="file"
         accept=".xlsx,.xlsm"
         className="hidden"
         onChange={handleVendorExcelChange}
        />
        <button
         type="button"
         disabled={importingVendorExcel}
         onClick={() => vendorExcelFileRef.current?.click()}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 hover:border-amber-300 transition font-medium shadow-sm text-sm disabled:opacity-50"
        >
         {importingVendorExcel ? 'Importing…' : 'Import vendors (Excel)'}
        </button>
        <button
         type="button"
         onClick={() => {
          const rows = filteredVendors.map(v => ({
           code: String(v.data?.entityCode || ''),
           name: v.name,
           category: v.category,
           email: v.email,
           phone: v.phone,
           state: v.location,
           country: v.country,
           status: v.status,
           updated: v.lastModified,
           created: v.createdAt,
          }));
          downloadCsv(rows, `vendors_${new Date().toISOString().slice(0, 10)}.csv`);
         }}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 hover:border-amber-300 transition font-medium shadow-sm text-sm"
        >
         <span className="hidden sm:inline">Export CSV</span>
         <span className="sm:hidden">Export</span>
        </button>
        <button
         type="button"
         onClick={openVendorCreate}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition font-medium shadow text-sm"
        >
         + Add Vendor
        </button>
       </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-4">
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <input
         value={vendorSearch}
         onChange={(e) => setVendorSearch(e.target.value)}
         placeholder="Search by code, name, email..."
         aria-label="Search vendors by code, name, email"
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        />
        <select
         value={vendorStatus}
         aria-label="Filter by status"
         onChange={(e) => setVendorStatus(e.target.value as any)}
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        >
         <option value="all">All Status</option>
         <option value="active">Active</option>
         <option value="inactive">Inactive</option>
         <option value="pending">Pending</option>
        </select>
        <select
         value={vendorCategory}
         aria-label="Filter by category"
         onChange={(e) => setVendorCategory(e.target.value)}
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        >
         <option value="all">All Categories</option>
         {vendorCategories.map(c => (
          <option key={c} value={c}>{c}</option>
         ))}
        </select>
       </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto max-h-[70vh] bg-white border border-gray-200 rounded-xl">
       <table className="w-full">
        <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
         <tr className="[&_th]:bg-gray-50">
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Sr No</th>
          <SortableTableTh label="Code" column="code" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Vendor" column="name" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Zoho ID" column="zohoId" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Category" column="category" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Email" column="email" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Phone" column="phone" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="State" column="state" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Status" column="status" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <SortableTableTh label="Updated" column="updated" sortColumn={vendorSortColumn} sortDirection={vendorSortDirection} onSort={toggleVendorSort} />
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Actions</th>
         </tr>
        </thead>
        <tbody>
         {vendorTotal === 0 ? (
          <tr>
           <td colSpan={11}><EmptyState compact title="No vendors found." /></td>
          </tr>
         ) : (
          sortedPagedVendors.map((v, idx) => (
           <tr key={v.id} className="border-t border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{vendorOffset + idx + 1}</td>
            <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{renderCellValue(String(v.data?.entityCode || '-'))}</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{renderCellValue(v.name || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.zohoId || (v.data as any)?.zohoId || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.category || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 max-w-48 truncate">{renderCellValue(v.email || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.phone || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.location || '-')}</td>
            <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
             <StatusSelect value={v.status} onChange={(next) => handleStatusChange(v.id, next)} />
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">{renderCellValue(v.lastModified ? new Date(v.lastModified).toLocaleDateString() : '-')}</td>
            <td className="px-4 py-3 text-sm">
             <div className="flex gap-2">
              <button
               type="button"
               onClick={() => openView(v)}
               className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium"
              >
               View
              </button>
              <button
               type="button"
               onClick={() => openVendorEdit(v.id)}
               className="px-3 py-1.5 rounded-lg border border-gray-200 text-amber-800 hover:bg-gray-50 font-medium"
              >
               Edit
              </button>
             </div>
            </td>
           </tr>
          ))
         )}
        </tbody>
       </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
       {vendorTotal === 0 ? (
        <div className="bg-white rounded-xl border"><EmptyState compact title="No vendors found." /></div>
       ) : (
        sortedPagedVendors.map((v) => (
         <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
           <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono">Code: {String(v.data?.entityCode || '-')}</p>
            <p className="font-semibold text-gray-800 truncate">{v.name}</p>
            <p className="text-sm text-slate-800">{v.category}</p>
           </div>
           <StatusSelect value={v.status} onChange={(next) => handleStatusChange(v.id, next)} />
          </div>
          <div className="space-y-1 text-sm border-t border-gray-100 pt-3">
           <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 truncate ml-2 max-w-[60%] text-right">{v.email || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="text-gray-800">{v.phone || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">State</span>
            <span className="text-gray-800">{v.location || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">Updated</span>
            <span className="text-gray-800">{v.lastModified ? new Date(v.lastModified).toLocaleDateString() : '-'}</span>
           </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
           <button
            type="button"
            onClick={() => openView(v)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium text-sm"
           >
            View
           </button>
           <button
            type="button"
            onClick={() => openVendorEdit(v.id)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-amber-800 hover:bg-gray-50 font-medium text-sm"
           >
            Edit
           </button>
          </div>
         </div>
        ))
       )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mt-4">
       <div className="text-sm text-gray-600">
        Page {Math.min(vendorPage, vendorTotalPages)} of {vendorTotalPages} • Showing {pagedVendors.length} of {vendorTotal}
       </div>
       <div className="flex flex-wrap items-center gap-2">
        <select
         value={vendorPageSize}
         aria-label="Rows per page"
         onChange={(e) => {
          setVendorPageSize(parseInt(e.target.value, 10));
          setVendorPage(1);
         }}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
        >
         <option value={10}>10 / page</option>
         <option value={20}>20 / page</option>
         <option value={50}>50 / page</option>
        </select>
        <button
         type="button"
         onClick={() => setVendorPage(p => Math.max(1, p - 1))}
         disabled={vendorPage <= 1}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
         Prev
        </button>
        <button
         type="button"
         onClick={() => setVendorPage(p => Math.min(vendorTotalPages, p + 1))}
         disabled={vendorPage >= vendorTotalPages}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    );
   case 'client-master':
    return (
     <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
       <div>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Client Master</h2>
        <p className="text-sm text-gray-500">{clientTotal} client(s)</p>
       </div>
       <div className="flex flex-wrap gap-2">
        <input
         ref={clientExcelFileRef}
         type="file"
         accept=".xlsx,.xlsm"
         className="hidden"
         onChange={handleClientExcelChange}
        />
        <button
         type="button"
         disabled={importingClientExcel}
         onClick={() => clientExcelFileRef.current?.click()}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 hover:border-amber-300 transition font-medium shadow-sm text-sm disabled:opacity-50"
        >
         {importingClientExcel ? 'Importing…' : 'Import clients (Excel)'}
        </button>
        <button
         type="button"
         onClick={() => {
          const rows = filteredClients.map(c => ({
           code: String(c.data?.entityCode || ''),
           name: c.name,
           category: c.category,
           email: c.email,
           phone: c.phone,
           state: c.location,
           country: c.country,
           status: c.status,
           updated: c.lastModified,
           created: c.createdAt,
          }));
          downloadCsv(rows, `clients_${new Date().toISOString().slice(0, 10)}.csv`);
         }}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 hover:border-amber-300 transition font-medium shadow-sm text-sm"
        >
         <span className="hidden sm:inline">Export CSV</span>
         <span className="sm:hidden">Export</span>
        </button>
        <button
         type="button"
         onClick={openClientCreate}
         className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition font-medium shadow text-sm"
        >
         + Add Client
        </button>
       </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-4">
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <input
         value={clientSearch}
         onChange={(e) => setClientSearch(e.target.value)}
         placeholder="Search by code, name, email..."
         aria-label="Search clients by code, name, email"
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        />
        <select
         value={clientStatus}
         aria-label="Filter by status"
         onChange={(e) => setClientStatus(e.target.value as any)}
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        >
         <option value="all">All Status</option>
         <option value="active">Active</option>
         <option value="inactive">Inactive</option>
         <option value="pending">Pending</option>
        </select>
        <select
         value={clientCategory}
         aria-label="Filter by category"
         onChange={(e) => setClientCategory(e.target.value)}
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        >
         <option value="all">All Categories</option>
         {clientCategories.map(c => (
          <option key={c} value={c}>{c}</option>
         ))}
        </select>
       </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto max-h-[70vh] bg-white border border-gray-200 rounded-xl">
       <table className="w-full">
        <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
         <tr className="[&_th]:bg-gray-50">
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Sr No</th>
          <SortableTableTh label="Code" column="code" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Client" column="name" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Zoho ID" column="zohoId" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Category" column="category" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Email" column="email" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Phone" column="phone" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="State" column="state" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Status" column="status" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <SortableTableTh label="Updated" column="updated" sortColumn={clientSortColumn} sortDirection={clientSortDirection} onSort={toggleClientSort} />
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Actions</th>
         </tr>
        </thead>
        <tbody>
         {clientTotal === 0 ? (
          <tr>
           <td colSpan={11}><EmptyState compact title="No clients found." /></td>
          </tr>
         ) : (
          sortedPagedClients.map((c, idx) => (
           <tr key={c.id} className="border-t border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{clientOffset + idx + 1}</td>
            <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{renderCellValue(String(c.data?.entityCode || '-'))}</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{renderCellValue(c.name || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.zohoId || (c.data as any)?.zohoId || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.category || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 max-w-48 truncate">{renderCellValue(c.email || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.phone || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.location || '-')}</td>
            <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
             <StatusSelect value={c.status} onChange={(next) => handleStatusChange(c.id, next)} />
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">{renderCellValue(c.lastModified ? new Date(c.lastModified).toLocaleDateString() : '-')}</td>
            <td className="px-4 py-3 text-sm">
             <div className="flex gap-2">
              <button
               type="button"
               onClick={() => openView(c)}
               className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium"
              >
               View
              </button>
              <button
               type="button"
               onClick={() => openClientEdit(c.id)}
               className="px-3 py-1.5 rounded-lg border border-gray-200 text-amber-800 hover:bg-gray-50 font-medium"
              >
               Edit
              </button>
             </div>
            </td>
           </tr>
          ))
         )}
        </tbody>
       </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
       {clientTotal === 0 ? (
        <div className="bg-white rounded-xl border"><EmptyState compact title="No clients found." /></div>
       ) : (
        sortedPagedClients.map((c) => (
         <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
           <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono">Code: {String(c.data?.entityCode || '-')}</p>
            <p className="font-semibold text-gray-800 truncate">{c.name}</p>
            <p className="text-sm text-slate-800">{c.category}</p>
           </div>
           <StatusSelect value={c.status} onChange={(next) => handleStatusChange(c.id, next)} />
          </div>
          <div className="space-y-1 text-sm border-t border-gray-100 pt-3">
           <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 truncate ml-2 max-w-[60%] text-right">{c.email || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="text-gray-800">{c.phone || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">State</span>
            <span className="text-gray-800">{c.location || '-'}</span>
           </div>
           <div className="flex justify-between">
            <span className="text-gray-500">Updated</span>
            <span className="text-gray-800">{c.lastModified ? new Date(c.lastModified).toLocaleDateString() : '-'}</span>
           </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
           <button
            type="button"
            onClick={() => openView(c)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium text-sm"
           >
            View
           </button>
           <button
            type="button"
            onClick={() => openClientEdit(c.id)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-amber-800 hover:bg-gray-50 font-medium text-sm"
           >
            Edit
           </button>
          </div>
         </div>
        ))
       )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mt-4">
       <div className="text-sm text-gray-600">
        Page {Math.min(clientPage, clientTotalPages)} of {clientTotalPages} • Showing {pagedClients.length} of {clientTotal}
       </div>
       <div className="flex flex-wrap items-center gap-2">
        <select
         value={clientPageSize}
         aria-label="Rows per page"
         onChange={(e) => {
          setClientPageSize(parseInt(e.target.value, 10));
          setClientPage(1);
         }}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
        >
         <option value={10}>10 / page</option>
         <option value={20}>20 / page</option>
         <option value={50}>50 / page</option>
        </select>
        <button
         type="button"
         onClick={() => setClientPage(p => Math.max(1, p - 1))}
         disabled={clientPage <= 1}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
         Prev
        </button>
        <button
         type="button"
         onClick={() => setClientPage(p => Math.min(clientTotalPages, p + 1))}
         disabled={clientPage >= clientTotalPages}
         className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    );
  }
 };

 return (
  <div className="min-h-screen bg-gray-50/50 p-4 md:p-6">
   <div className="max-w-7xl mx-auto">
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
     {/* Master tabs: Vendor | Client */}
     <div className="border-b border-gray-200">
      <div className="flex">
       {tabs.map((tab) => (
        <button
         key={tab.id}
         type="button"
         onClick={() => setActiveTab(tab.id)}
         className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
          activeTab === tab.id
           ? 'border-b-2 border-slate-800 text-slate-900 bg-gray-50'
           : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
         }`}
        >
         <span>{tab.icon}</span>
         <span>{tab.label}</span>
        </button>
       ))}
      </div>
     </div>

     {/* Tab Content */}
     <div className="min-h-96">
      {renderContent()}
     </div>
    </div>
   </div>

   {/* View Modal */}
  {viewing && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="vendor-client-view-title"
   >
    <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
    <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50">
       <div>
        <h3 id="vendor-client-view-title" className="text-lg font-bold text-gray-800">{viewing.type === 'vendor' ? 'Vendor' : 'Client'} Details</h3>
        <p className="text-sm text-gray-500 font-mono">{String(viewing.data?.entityCode || viewing.id)}</p>
       </div>
       <button
        type="button"
        onClick={closeView}
        className="px-3 py-2 rounded-lg border border-gray-200 text-amber-900 hover:bg-gray-50 font-medium"
       >
        Close
       </button>
      </div>

      <div className="p-5 overflow-y-auto">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VendorClientField label="Code" value={viewing.data?.entityCode || viewing.id} mono />
        <VendorClientField label="Type" value={viewing.type} />
        <VendorClientField label="Name" value={viewing.name} />
        <VendorClientField label="Category" value={viewing.category} />
        <VendorClientField label="Email" value={viewing.email} />
        {viewing.userId ? (
          <VendorClientField
            label="Linked user (User Management)"
            value={
              <a href={`/user-management`} className="text-blue-600 hover:underline font-mono">
                User #{viewing.userId}
              </a>
            }
          />
        ) : null}
        <VendorClientField label="Phone" value={viewing.phone} />
        <VendorClientField label="State" value={viewing.location} />
        <VendorClientField label="Country" value={viewing.country} />
        <VendorClientField
         label="Status"
         value={<StatusSelect value={viewing.status} onChange={(next) => handleStatusChange(viewing.id, next)} />}
        />
        <VendorClientField label="Payment Terms" value={viewing.paymentTerms} />
        <VendorClientField label="Created" value={viewing.createdAt ? new Date(viewing.createdAt).toLocaleString() : ''} />
        <VendorClientField label="Last Updated" value={viewing.lastModified ? new Date(viewing.lastModified).toLocaleString() : ''} />
       </div>

       <VendorClientSection title="Setup & Coding" icon="">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <VendorClientField label="Entity Type" value={viewing.data?.setupType} />
         <VendorClientField label="Setup Category" value={viewing.data?.setupCategory} />
         <VendorClientField label="Prefix" value={viewing.data?.setupPrefix} mono />
         <VendorClientField label="Legal Name" value={viewing.data?.legalName} />
         <VendorClientField label="Trade Name" value={viewing.data?.tradeName} />
         {viewing.type === 'client' && <VendorClientField label="Brand Name" value={viewing.data?.brandName} />}
         <VendorClientField label="Primary Email" value={viewing.data?.primaryEmail} />
         <VendorClientField label="Primary Phone" value={viewing.data?.primaryPhone} />
        </div>
       </VendorClientSection>

       <VendorClientSection title="Organization Details" icon="">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <VendorClientField label="Billing Address" value={viewing.data?.billingAddress} />
         <VendorClientField label="Shipping Address" value={viewing.data?.shippingAddress} />
         <VendorClientField label="State" value={viewing.data?.state} />
         <VendorClientField label="Country" value={viewing.data?.country} />
         <VendorClientField label="Website" value={viewing.data?.website} />
         <VendorClientField label="Segment" value={viewing.data?.segment} />
         {viewing.type === 'client' && (
          <>
           <VendorClientField label="Industry" value={viewing.data?.industry} />
           <VendorClientField label="Business Type" value={viewing.data?.businessType} />
          </>
         )}
         <VendorClientField label="Notes" value={viewing.data?.notes} />
        </div>
       </VendorClientSection>

       <VendorClientSection title="Tax, Compliance & Documents" icon="">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
         <VendorClientField label="GSTIN" value={viewing.data?.gstin} mono />
         <VendorClientField label="PAN" value={viewing.data?.pan} mono />
         {viewing.type === 'vendor' ? (
          <>
           <VendorClientField label="MSME" value={viewing.data?.msme} />
           <VendorClientField label="IEC" value={viewing.data?.iec} />
          </>
         ) : (
          <>
           <VendorClientField label="TAN" value={viewing.data?.tan} mono />
           <VendorClientField label="CIN" value={viewing.data?.cin} mono />
           <VendorClientField label="FSSAI License" value={viewing.data?.fssaiLicense} />
           <VendorClientField label="Drug License" value={viewing.data?.drugLicense} />
          </>
         )}
        </div>
        {renderListTable(
         ['Doc Type', 'Link', 'Date'],
         (Array.isArray(viewing.data?.documents) ? viewing.data.documents : []).map((d: any) => [d.type, d.link, d.date])
        )}
       </VendorClientSection>

       <VendorClientSection title="Multi-level POCs" icon="">
        {renderListTable(
         ['Name', 'Role', 'Email', 'Phone', 'Level', 'Preferred', 'Notes'],
         (Array.isArray(viewing.data?.pocs) ? viewing.data.pocs : []).map((p: any) => [p.name, p.role, p.email, p.phone, p.level, p.preferred, p.notes])
        )}
       </VendorClientSection>

       <VendorClientSection title="Bank Details" icon="">
        {renderListTable(
         ['Beneficiary', 'Bank', 'Account No', 'IFSC', 'Branch', 'Type', 'UPI', 'Default', 'Notes'],
         (Array.isArray(viewing.data?.banks) ? viewing.data.banks : []).map((b: any) => [
          b.beneficiaryName,
          b.bankName,
          b.accountNo,
          b.ifsc,
          b.branch,
          b.accountType,
          b.upiId,
          b.isDefault,
          b.notes,
         ])
        )}
       </VendorClientSection>

       <VendorClientSection title="Payment Terms & Credit" icon="">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <VendorClientField label="Payment Terms" value={viewing.data?.paymentTerms} />
         <VendorClientField label="Custom Terms" value={viewing.data?.customTerms} />

         <VendorClientField
          label="Advanced (%)"
          value={viewing.data?.payablesAdvancedPct ?? viewing.data?.advanceRequired ?? ''}
         />
         <VendorClientField
          label="Before dispatch (%)"
          value={viewing.data?.payablesBeforeDispatchPct ?? ''}
         />
         <VendorClientField
          label="After dispatch / On delivery (%)"
          value={viewing.data?.payablesAfterDispatchPct ?? ''}
         />
         <VendorClientField label="Credit Type" value={viewing.data?.paymentCreditType ?? ''} />

         <VendorClientField label="Credit Limit" value={viewing.data?.creditLimit} />
         {viewing.type === 'vendor' ? (
          <VendorClientField label="Penalty" value={viewing.data?.penalty} />
         ) : null}
         <VendorClientField label="TDS Applicable" value={viewing.data?.tdsApplicable} />
         <VendorClientField label="Preferred Payment Mode" value={viewing.data?.preferredPaymentMode} />
         <VendorClientField label="Payment Notes" value={viewing.data?.paymentNotes} />
        </div>
       </VendorClientSection>

       {viewing.type === 'client' && (
        <VendorClientSection title="Product Interest & Requirements" icon="">
         {renderListTable(
          ['Category', 'Type', 'Expected Volume', 'Frequency', 'Target Price', 'Specifications', 'Priority'],
          (Array.isArray(viewing.data?.productInterests) ? viewing.data.productInterests : []).map((pi: any) => [
           pi.productCategory,
           pi.productType,
           pi.expectedVolume,
           pi.frequency,
           pi.targetPrice,
           pi.specifications,
           pi.priority,
          ])
         )}
        </VendorClientSection>
       )}

       <VendorClientSection title="Agreements & Status" icon="">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <VendorClientField label="Agreement Type" value={viewing.data?.agreementType} />
         <VendorClientField label="Agreement Status" value={viewing.data?.agreementStatus} />
         <VendorClientField label="Start Date" value={viewing.data?.startDate} />
         <VendorClientField label="End Date" value={viewing.data?.endDate} />
         <VendorClientField label="Agreement Link" value={viewing.data?.agreementLink} />
         <VendorClientField label="Owner" value={viewing.data?.owner} />
         <VendorClientField label="Agreement Notes" value={viewing.data?.agreementNotes} />
        </div>
       </VendorClientSection>

       {viewing.type === 'client' && (
        <VendorClientSection title="Client Lifecycle & Ownership" icon="">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VendorClientField label="Sales Owner" value={viewing.data?.salesOwner} />
          <VendorClientField label="Account Manager" value={viewing.data?.accountManager} />
          <VendorClientField label="Lead Source" value={viewing.data?.leadSource} />
          <VendorClientField label="Referred By" value={viewing.data?.referredBy} />
          <VendorClientField label="Client Stage" value={viewing.data?.clientStage} />
          <VendorClientField label="Potential Value" value={viewing.data?.potentialValue} />
          <VendorClientField label="Acquisition Date" value={viewing.data?.acquisitionDate} />
         </div>
        </VendorClientSection>
       )}

       <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Raw data (advanced)</summary>
        <pre className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs overflow-auto max-h-72">{JSON.stringify(viewing.data, null, 2)}</pre>
       </details>
      </div>
     </div>
    </div>
  )}

  {vendorCreateModalOpen && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="vendor-create-title"
   >
    <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
     <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50 shrink-0">
      <div>
       <h3 id="vendor-create-title" className="text-lg font-bold text-gray-800">Add Vendor</h3>
       <p className="text-sm text-gray-500">Complete the wizard to create a new vendor master record.</p>
      </div>
      <button
       type="button"
       onClick={() => setVendorCreateModalOpen(false)}
       className="px-3 py-2 rounded-lg border border-gray-200 text-amber-900 hover:bg-gray-50 font-medium"
      >
       Close
      </button>
     </div>
     <div className="overflow-y-auto flex-1 min-h-0">
      <VendorForm
       editingId={null}
       onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
        setVendorCreateModalOpen(false);
       }}
      />
     </div>
    </div>
   </div>
  )}

  {clientCreateModalOpen && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="client-create-title"
   >
    <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
     <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50 shrink-0">
      <div>
       <h3 id="client-create-title" className="text-lg font-bold text-gray-800">Add Client</h3>
       <p className="text-sm text-gray-500">Complete the wizard to create a new client master record.</p>
      </div>
      <button
       type="button"
       onClick={() => setClientCreateModalOpen(false)}
       className="px-3 py-2 rounded-lg border border-gray-200 text-amber-900 hover:bg-gray-50 font-medium"
      >
       Close
      </button>
     </div>
     <div className="overflow-y-auto flex-1 min-h-0">
      <ClientForm
       editingId={null}
       onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
        setClientCreateModalOpen(false);
       }}
      />
     </div>
    </div>
   </div>
  )}

  {editing && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="vendor-client-edit-title"
   >
    <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
    <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50">
     <div>
      <h3 id="vendor-client-edit-title" className="text-lg font-bold text-gray-800">Edit {editing.type === 'vendor' ? 'Vendor' : 'Client'}</h3>
      <p className="text-sm text-gray-500">Update record details without leaving the dashboard.</p>
     </div>
     <button
      type="button"
      onClick={closeEdit}
      className="px-3 py-2 rounded-lg border border-gray-200 text-amber-900 hover:bg-gray-50 font-medium"
     >
      Close
     </button>
    </div>
    <div className="overflow-y-auto">
     {editing.type === 'vendor' ? (
      <VendorForm
      editingId={editing.id}
      onSaved={() => {
       void queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
       closeEdit();
      }}
      />
  ) : (
      <ClientForm
      editingId={editing.id}
      onSaved={() => {
       void queryClient.invalidateQueries({ queryKey: ['vendor-client-page'] });
       closeEdit();
      }}
      />
     )}
    </div>
    </div>
   </div>
  )}
  </div>
 );
};

export default VendorClient;
