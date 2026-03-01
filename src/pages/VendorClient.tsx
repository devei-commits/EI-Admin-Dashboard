import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useVendorClient, type VendorClient as VendorClientType } from '../context/VendorClientContext';
import { fetchVendorClients } from '../services/vendorClient.service';
import { useToast } from '../context/ToastContext';
import VendorForm from './VendorForm.tsx';
import ClientForm from './ClientForm.tsx';

const VendorClientField: React.FC<{ label: string; value?: unknown; mono?: boolean }> = ({ label, value, mono }) => {
 const display = value === null || value === undefined || value === '' ? '-' : String(value);
 return (
  <div>
   <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</div>
   <div className={`text-sm text-gray-800 mt-1 ${mono ? 'font-mono' : ''}`}>{display}</div>
  </div>
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
 const { deleteVendorClient, updateVendorClient } = useVendorClient();
 const { addToast } = useToast();
 const [apiVendors, setApiVendors] = useState<VendorClientType[]>([]);
 const [apiClients, setApiClients] = useState<VendorClientType[]>([]);
 const [loading, setLoading] = useState(true);
 const [useApi, setUseApi] = useState(true);

 const loadFromApi = useCallback(async () => {
  setLoading(true);
  const [vRes, cRes] = await Promise.all([
   fetchVendorClients('vendor'),
   fetchVendorClients('client'),
  ]);
  if (vRes.success && vRes.data) setApiVendors(vRes.data as VendorClientType[]);
  else setApiVendors([]);
  if (cRes.success && cRes.data) setApiClients(cRes.data as VendorClientType[]);
  else setApiClients([]);
  if (!vRes.success || !cRes.success) {
   setUseApi(false);
   addToast('error', 'Could not load from server; showing local data.');
  }
  setLoading(false);
 }, [addToast]);

 useEffect(() => {
  loadFromApi();
 }, [loadFromApi]);

 const vendorClients = [...apiVendors, ...apiClients];
 const [activeTab, setActiveTab] = useState<'vendor-master' | 'client-master' | 'vendor-form' | 'client-form'>('vendor-master');
 const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
 const [editingClientId, setEditingClientId] = useState<string | null>(null);
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
  { id: 'vendor-master', label: 'Vendor Master', icon: '🏭' },
  { id: 'client-master', label: 'Client Master', icon: '👥' },
  { id: 'vendor-form', label: 'Vendor Form', icon: '📋' },
  { id: 'client-form', label: 'Client Form', icon: '📝' },
 ] as const;

 const vendors = useMemo(
  () => vendorClients.filter(v => v.type === 'vendor'),
  [vendorClients]
 );

 const clients = useMemo(
  () => vendorClients.filter(v => v.type === 'client'),
  [vendorClients]
 );

 const vendorCategories = useMemo(() => {
  const cats = Array.from(new Set(vendors.map(v => v.category).filter(Boolean))).sort();
  return cats;
 }, [vendors]);

 const clientCategories = useMemo(() => {
  const cats = Array.from(new Set(clients.map(v => v.category).filter(Boolean))).sort();
  return cats;
 }, [clients]);

 const filteredVendors = useMemo(() => {
  const q = vendorSearch.trim().toLowerCase();
  const result = vendors
   .filter(v => (vendorStatus === 'all' ? true : v.status === vendorStatus))
   .filter(v => (vendorCategory === 'all' ? true : v.category === vendorCategory))
   .filter(v => {
    if (!q) return true;
    const code = String(v.data?.entityCode || '').toLowerCase();
    return (
     v.name.toLowerCase().includes(q) ||
     v.email.toLowerCase().includes(q) ||
     v.phone.toLowerCase().includes(q) ||
     v.location.toLowerCase().includes(q) ||
     v.category.toLowerCase().includes(q) ||
     code.includes(q)
    );
   })
   .sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
  return result;
 }, [vendors, vendorSearch, vendorStatus, vendorCategory]);

 const filteredClients = useMemo(() => {
  const q = clientSearch.trim().toLowerCase();
  const result = clients
   .filter(v => (clientStatus === 'all' ? true : v.status === clientStatus))
   .filter(v => (clientCategory === 'all' ? true : v.category === clientCategory))
   .filter(v => {
    if (!q) return true;
    const code = String(v.data?.entityCode || '').toLowerCase();
    return (
     v.name.toLowerCase().includes(q) ||
     v.email.toLowerCase().includes(q) ||
     v.phone.toLowerCase().includes(q) ||
     v.location.toLowerCase().includes(q) ||
     v.category.toLowerCase().includes(q) ||
     code.includes(q)
    );
   })
   .sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
  return result;
 }, [clients, clientSearch, clientStatus, clientCategory]);

 const vendorTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredVendors.length / vendorPageSize)), [filteredVendors.length, vendorPageSize]);
 const clientTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredClients.length / clientPageSize)), [filteredClients.length, clientPageSize]);

 const pagedVendors = useMemo(() => {
  const safePage = Math.min(vendorPage, vendorTotalPages);
  const start = (safePage - 1) * vendorPageSize;
  return filteredVendors.slice(start, start + vendorPageSize);
 }, [filteredVendors, vendorPage, vendorPageSize, vendorTotalPages]);

 const pagedClients = useMemo(() => {
  const safePage = Math.min(clientPage, clientTotalPages);
  const start = (safePage - 1) * clientPageSize;
  return filteredClients.slice(start, start + clientPageSize);
 }, [filteredClients, clientPage, clientPageSize, clientTotalPages]);

 const openVendorCreate = () => {
  setEditingVendorId(null);
  setActiveTab('vendor-form');
 };

 const openClientCreate = () => {
  setEditingClientId(null);
  setActiveTab('client-form');
 };

 const openVendorEdit = (id: string) => {
  setViewing(null);
  setEditingVendorId(id);
  setEditing({ id, type: 'vendor' });
 };

 const openClientEdit = (id: string) => {
  setViewing(null);
  setEditingClientId(id);
  setEditing({ id, type: 'client' });
 };

 const handleDelete = (id: string) => {
  const ok = window.confirm('Delete this record? This cannot be undone.');
  if (!ok) return;
  deleteVendorClient(id);
 };

 const handleStatusChange = (id: string, status: VendorClientType['status']) => {
  updateVendorClient(id, { status });
 };

 const openView = (vc: VendorClientType) => {
  setViewing(vc);
 };

 const closeView = () => {
  setViewing(null);
 };

 const closeEdit = () => {
  setEditing(null);
  setEditingVendorId(null);
  setEditingClientId(null);
 };

 const renderListTable = (
  headers: string[],
  rows: Array<Array<unknown>>,
 ) => (
  <div className="overflow-x-auto">
   <table className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
    <thead className="bg-gray-100">
     <tr>
      {headers.map(h => (
       <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-600">{h}</th>
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
        <p className="text-sm text-gray-500">{filteredVendors.length} vendor(s)</p>
       </div>
       <div className="flex gap-2">
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
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        />
        <select
         value={vendorStatus}
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
      <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
       <table className="w-full">
        <thead className="bg-gray-900" style={{ backgroundColor: '#111827' }}>
         <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Code</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Vendor</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Category</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Email</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Phone</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>State</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Updated</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'white' }}>Actions</th>
         </tr>
        </thead>
        <tbody>
         {filteredVendors.length === 0 ? (
          <tr>
           <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">No vendors found.</td>
          </tr>
         ) : (
          pagedVendors.map((v) => (
           <tr key={v.id} className="border-t border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{renderCellValue(String(v.data?.entityCode || '-'))}</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{renderCellValue(v.name || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.category || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 max-w-48 truncate">{renderCellValue(v.email || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.phone || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(v.location || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700">{renderCellValue(v.status || '-')}</td>
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
       {filteredVendors.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border">No vendors found.</div>
       ) : (
        pagedVendors.map((v) => (
         <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
           <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono">Code: {String(v.data?.entityCode || '-')}</p>
            <p className="font-semibold text-gray-800 truncate">{v.name}</p>
            <p className="text-sm text-slate-800">{v.category}</p>
           </div>
           <span className="text-xs font-medium text-gray-600">{v.status || '-'}</span>
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
        Page {Math.min(vendorPage, vendorTotalPages)} of {vendorTotalPages} • Showing {pagedVendors.length} of {filteredVendors.length}
       </div>
       <div className="flex flex-wrap items-center gap-2">
        <select
         value={vendorPageSize}
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
        <p className="text-sm text-gray-500">{filteredClients.length} client(s)</p>
       </div>
       <div className="flex gap-2">
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
         className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 text-sm"
        />
        <select
         value={clientStatus}
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
      <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
       <table className="w-full">
        <thead className="bg-gray-900" style={{ backgroundColor: '#111827' }}>
         <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Code</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Client</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Category</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Email</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Phone</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>State</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'white' }}>Updated</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'white' }}>Actions</th>
         </tr>
        </thead>
        <tbody>
         {filteredClients.length === 0 ? (
          <tr>
           <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">No clients found.</td>
          </tr>
         ) : (
          pagedClients.map((c) => (
           <tr key={c.id} className="border-t border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">{renderCellValue(String(c.data?.entityCode || '-'))}</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{renderCellValue(c.name || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.category || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 max-w-48 truncate">{renderCellValue(c.email || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.phone || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{renderCellValue(c.location || '-')}</td>
            <td className="px-4 py-3 text-sm text-gray-700">{renderCellValue(c.status || '-')}</td>
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
       {filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border">No clients found.</div>
       ) : (
        pagedClients.map((c) => (
         <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
           <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono">Code: {String(c.data?.entityCode || '-')}</p>
            <p className="font-semibold text-gray-800 truncate">{c.name}</p>
            <p className="text-sm text-slate-800">{c.category}</p>
           </div>
           <span className="text-xs font-medium text-gray-600">{c.status || '-'}</span>
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
        Page {Math.min(clientPage, clientTotalPages)} of {clientTotalPages} • Showing {pagedClients.length} of {filteredClients.length}
       </div>
       <div className="flex flex-wrap items-center gap-2">
        <select
         value={clientPageSize}
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
  case 'vendor-form':
   return (
    <VendorForm
    editingId={editingVendorId}
    onSaved={() => {
     loadFromApi();
     setEditingVendorId(null);
     setActiveTab('vendor-master');
    }}
    />
   );
  case 'client-form':
   return (
    <ClientForm
    editingId={editingClientId}
    onSaved={() => {
     loadFromApi();
     setEditingClientId(null);
     setActiveTab('client-master');
    }}
    />
   );
  }
 };

 return (
  <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
   <div className="max-w-7xl mx-auto">
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
     {/* Tab Header */}
     <div className="border-b border-gray-200">
      <div className="flex">
       {tabs.map((tab) => (
        <button
         key={tab.id}
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
   >
    <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
    <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50">
       <div>
        <h3 className="text-lg font-bold text-gray-800">{viewing.type === 'vendor' ? '🏭' : '👥'} {viewing.type === 'vendor' ? 'Vendor' : 'Client'} Details</h3>
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
        <VendorClientField label="Phone" value={viewing.phone} />
        <VendorClientField label="State" value={viewing.location} />
        <VendorClientField label="Country" value={viewing.country} />
        <VendorClientField label="Status" value={viewing.status} />
        <VendorClientField label="Payment Terms" value={viewing.paymentTerms} />
        <VendorClientField label="Created" value={viewing.createdAt ? new Date(viewing.createdAt).toLocaleString() : ''} />
        <VendorClientField label="Last Updated" value={viewing.lastModified ? new Date(viewing.lastModified).toLocaleString() : ''} />
       </div>

       <VendorClientSection title="Setup & Coding" icon="⚙️">
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

       <VendorClientSection title="Organization Details" icon="🏢">
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

       <VendorClientSection title="Tax, Compliance & Documents" icon="🛡️">
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

       <VendorClientSection title="Multi-level POCs" icon="👤">
        {renderListTable(
         ['Name', 'Role', 'Email', 'Phone', 'Level', 'Preferred', 'Notes'],
         (Array.isArray(viewing.data?.pocs) ? viewing.data.pocs : []).map((p: any) => [p.name, p.role, p.email, p.phone, p.level, p.preferred, p.notes])
        )}
       </VendorClientSection>

       <VendorClientSection title="Bank Details" icon="🏦">
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

       <VendorClientSection title="Payment Terms & Credit" icon="💳">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <VendorClientField label="Payment Terms" value={viewing.data?.paymentTerms} />
         <VendorClientField label="Custom Terms" value={viewing.data?.customTerms} />
         <VendorClientField label="Credit Limit" value={viewing.data?.creditLimit} />
         {viewing.type === 'vendor' ? (
          <VendorClientField label="Penalty" value={viewing.data?.penalty} />
         ) : (
          <VendorClientField label="Advance Required" value={viewing.data?.advanceRequired} />
         )}
         <VendorClientField label="TDS Applicable" value={viewing.data?.tdsApplicable} />
         <VendorClientField label="Preferred Payment Mode" value={viewing.data?.preferredPaymentMode} />
         <VendorClientField label="Payment Notes" value={viewing.data?.paymentNotes} />
        </div>
       </VendorClientSection>

       {viewing.type === 'vendor' ? (
        <VendorClientSection title="Vendor Items & Price List" icon="📦">
         {renderListTable(
          ['Type', 'Code', 'Name', 'UoM', 'MOQ', 'Unit Price', 'Lead Time', 'Valid Till', 'GST', 'HSN', 'Payment Override'],
          (Array.isArray(viewing.data?.vendorItems) ? viewing.data.vendorItems : []).map((it: any) => [
           it.itemType,
           it.itemCode,
           it.itemName,
           it.uom,
           it.moq,
           it.unitPrice,
           it.leadTime,
           it.priceValidTill,
           it.gst,
           it.hsn,
           it.paymentTermsOverride,
          ])
         )}
        </VendorClientSection>
       ) : (
        <VendorClientSection title="Product Interest & Requirements" icon="🎯">
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

       <VendorClientSection title="Agreements & Status" icon="🤝">
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
        <VendorClientSection title="Client Lifecycle & Ownership" icon="📈">
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

  {editing && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-4"
    role="dialog"
    aria-modal="true"
   >
    <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
    <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gray-50">
     <div>
      <h3 className="text-lg font-bold text-gray-800">Edit {editing.type === 'vendor' ? 'Vendor' : 'Client'}</h3>
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
       loadFromApi();
       closeEdit();
       setActiveTab('vendor-master');
      }}
      />
     ) : (
      <ClientForm
      editingId={editing.id}
      onSaved={() => {
       loadFromApi();
       closeEdit();
       setActiveTab('client-master');
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
