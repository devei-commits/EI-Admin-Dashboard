import { useEffect, useMemo, useState } from 'react';
import api from '../lib/apiClient';

interface ProcessSampleRequest {
 id: number;
 productId: string;
 reqNos: string;
 comments: string;
 customer: string;
 date: string;
 status?: 'New' | 'Responded' | 'Closed';
}

interface ProductSampleRequest {
 id: number;
 productId: string;
 reqNos: number;
 comments: string;
 customer: string;
 customerDetails?: string;
 date: string;
}

interface QuotationRequest {
 id: number;
 productId: string;
 requestedNumbers: number;
 comments: string;
 date: string;
}

interface TechnicalDocRequest {
 id: number;
 productId: string;
 comments: string;
 date: string;
}

interface OtherRequest {
 id: number;
 productId: string;
 comments: string;
 date: string;
}

type TabType = 'process' | 'product' | 'quotation' | 'technical' | 'other';

type EnquiryApiRow = {
 id?: string;
 ticketNumber?: string;
 subject?: string;
 description?: string;
 category?: string;
 createdAt?: string;
 customer?: {
  name?: string;
 };
};

type RequestType = TabType;

const inferRequestType = (row: EnquiryApiRow): RequestType => {
 const text = `${row.category || ''} ${row.subject || ''} ${row.description || ''}`.toLowerCase();
 if (text.includes('process')) return 'process';
 if (text.includes('product') && text.includes('sample')) return 'product';
 if (text.includes('quotation') || text.includes('quote')) return 'quotation';
 if (text.includes('technical') || text.includes('doc')) return 'technical';
 return 'other';
};

const formatDate = (iso?: string): string => {
 if (!iso) return '-';
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return '-';
 return d.toLocaleDateString('en-GB');
};

const toProcessRow = (row: EnquiryApiRow, index: number): ProcessSampleRequest => ({
 id: index + 1,
 productId: row.subject || row.category || '-',
 reqNos: row.ticketNumber || row.id || '-',
 comments: row.description || '',
 customer: row.customer?.name || 'Website client',
 date: formatDate(row.createdAt),
});

const toProductRow = (row: EnquiryApiRow, index: number): ProductSampleRequest => ({
 id: index + 1,
 productId: row.subject || row.category || '-',
 reqNos: 1,
 comments: row.description || '',
 customer: row.customer?.name || 'Website client',
 customerDetails: row.customer?.name || 'Website client',
 date: formatDate(row.createdAt),
});

const toQuotationRow = (row: EnquiryApiRow, index: number): QuotationRequest => ({
 id: index + 1,
 productId: row.subject || row.category || '-',
 requestedNumbers: 1,
 comments: row.description || '',
 date: formatDate(row.createdAt),
});

const toTechnicalRow = (row: EnquiryApiRow, index: number): TechnicalDocRequest => ({
 id: index + 1,
 productId: row.subject || row.category || '-',
 comments: row.description || '',
 date: formatDate(row.createdAt),
});

const toOtherRow = (row: EnquiryApiRow, index: number): OtherRequest => ({
 id: index + 1,
 productId: row.subject || row.category || '-',
 comments: row.description || '',
 date: formatDate(row.createdAt),
});

const ProductSamples = () => {
 const [activeTab, setActiveTab] = useState<TabType>('process');
 const [enquiryRows, setEnquiryRows] = useState<EnquiryApiRow[]>([]);
 const [loading, setLoading] = useState(false);

 const [searchTerm, setSearchTerm] = useState('');
 const [productSearchTerm, setProductSearchTerm] = useState('');
 const [quotationSearchTerm, setQuotationSearchTerm] = useState('');
 const [technicalSearchTerm, setTechnicalSearchTerm] = useState('');
 const [otherSearchTerm, setOtherSearchTerm] = useState('');
 const [entriesPerPage, setEntriesPerPage] = useState(10);
 const [productEntriesPerPage, setProductEntriesPerPage] = useState(10);
 const [quotationEntriesPerPage, setQuotationEntriesPerPage] = useState(10);
 const [technicalEntriesPerPage, setTechnicalEntriesPerPage] = useState(10);
 const [otherEntriesPerPage, setOtherEntriesPerPage] = useState(10);
 const [currentPage, setCurrentPage] = useState(1);
 const [productCurrentPage, setProductCurrentPage] = useState(1);
 const [quotationCurrentPage, setQuotationCurrentPage] = useState(1);
 const [technicalCurrentPage, setTechnicalCurrentPage] = useState(1);
 const [otherCurrentPage, setOtherCurrentPage] = useState(1);
 const [sortField, setSortField] = useState<keyof ProcessSampleRequest | null>(null);
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [productSortField, setProductSortField] = useState<keyof ProductSampleRequest | null>(null);
 const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
 const [quotationSortField, setQuotationSortField] = useState<keyof QuotationRequest | null>(null);
 const [quotationSortDirection, setQuotationSortDirection] = useState<'asc' | 'desc'>('asc');
 const [technicalSortField, setTechnicalSortField] = useState<keyof TechnicalDocRequest | null>(null);
 const [technicalSortDirection, setTechnicalSortDirection] = useState<'asc' | 'desc'>('asc');
 const [otherSortField, setOtherSortField] = useState<keyof OtherRequest | null>(null);
 const [otherSortDirection, setOtherSortDirection] = useState<'asc' | 'desc'>('asc');
 const [showDetailsModal, setShowDetailsModal] = useState(false);
 const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
 const [selectedRequest] = useState<ProcessSampleRequest | null>(null);
 const [selectedProductSample, setSelectedProductSample] = useState<ProductSampleRequest | null>(null);
 const [responseText, setResponseText] = useState('');

 useEffect(() => {
  let cancelled = false;
  const loadRows = async () => {
   setLoading(true);
   try {
    const res = await api.get<{ success?: boolean; data?: EnquiryApiRow[] } | EnquiryApiRow[]>('/api/v1/enquiries');
    if (cancelled) return;
    const list = Array.isArray(res)
     ? res
     : (res && typeof res === 'object' && Array.isArray((res as { data?: EnquiryApiRow[] }).data))
      ? (res as { data: EnquiryApiRow[] }).data
      : [];
    setEnquiryRows(list);
   } catch (_err) {
    if (!cancelled) setEnquiryRows([]);
   } finally {
    if (!cancelled) setLoading(false);
   }
  };
  void loadRows();
  return () => {
   cancelled = true;
  };
 }, []);

 const requests = useMemo<ProcessSampleRequest[]>(
  () => enquiryRows.filter((r) => inferRequestType(r) === 'process').map(toProcessRow),
  [enquiryRows]
 );
 const productSamples = useMemo<ProductSampleRequest[]>(
  () => enquiryRows.filter((r) => inferRequestType(r) === 'product').map(toProductRow),
  [enquiryRows]
 );
 const quotationRequests = useMemo<QuotationRequest[]>(
  () => enquiryRows.filter((r) => inferRequestType(r) === 'quotation').map(toQuotationRow),
  [enquiryRows]
 );
 const technicalDocRequests = useMemo<TechnicalDocRequest[]>(
  () => enquiryRows.filter((r) => inferRequestType(r) === 'technical').map(toTechnicalRow),
  [enquiryRows]
 );
 const otherRequests = useMemo<OtherRequest[]>(
  () => enquiryRows.filter((r) => inferRequestType(r) === 'other').map(toOtherRow),
  [enquiryRows]
 );

 // Filter requests based on search
 const filteredRequests = requests.filter(request => 
  request.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
  request.reqNos.toLowerCase().includes(searchTerm.toLowerCase()) ||
  request.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
  request.comments.toLowerCase().includes(searchTerm.toLowerCase())
 );

 // Sort requests
 const sortedRequests = [...filteredRequests].sort((a, b) => {
  if (!sortField) return 0;
  
  const aValue = a[sortField];
  const bValue = b[sortField];
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
   return sortDirection === 'asc' 
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
   return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  }
  
  return 0;
 });

 // Pagination
 const indexOfLastEntry = currentPage * entriesPerPage;
 const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
 const currentEntries = sortedRequests.slice(indexOfFirstEntry, indexOfLastEntry);
 const totalPages = Math.ceil(sortedRequests.length / entriesPerPage);

 const handleSort = (field: keyof ProcessSampleRequest) => {
  if (sortField === field) {
   setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setSortField(field);
   setSortDirection('asc');
  }
 };

 const SortIcon = ({ field }: { field: keyof ProcessSampleRequest }) => (
  <span className="ml-1 text-xs text-gray-400">
   {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 // Filter product samples based on search
 const filteredProductSamples = productSamples.filter(sample => 
  sample.productId.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
  sample.reqNos.toString().includes(productSearchTerm.toLowerCase()) ||
  sample.customer.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
  sample.comments.toLowerCase().includes(productSearchTerm.toLowerCase())
 );

 // Sort product samples
 const sortedProductSamples = [...filteredProductSamples].sort((a, b) => {
  if (!productSortField) return 0;
  
  const aValue = a[productSortField];
  const bValue = b[productSortField];
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
   return productSortDirection === 'asc' 
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
   return productSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  }
  
  return 0;
 });

 // Product samples pagination
 const productIndexOfLastEntry = productCurrentPage * productEntriesPerPage;
 const productIndexOfFirstEntry = productIndexOfLastEntry - productEntriesPerPage;
 const currentProductEntries = sortedProductSamples.slice(productIndexOfFirstEntry, productIndexOfLastEntry);
 const productTotalPages = Math.ceil(sortedProductSamples.length / productEntriesPerPage);

 const handleProductSort = (field: keyof ProductSampleRequest) => {
  if (productSortField === field) {
   setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setProductSortField(field);
   setProductSortDirection('asc');
  }
 };

 const ProductSortIcon = ({ field }: { field: keyof ProductSampleRequest }) => (
  <span className="ml-1 text-xs text-gray-400">
   {productSortField === field ? (productSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 // Filter quotation requests based on search
 const filteredQuotationRequests = quotationRequests.filter(request => 
  request.productId.toLowerCase().includes(quotationSearchTerm.toLowerCase()) ||
  request.requestedNumbers.toString().includes(quotationSearchTerm.toLowerCase()) ||
  request.comments.toLowerCase().includes(quotationSearchTerm.toLowerCase())
 );

 // Sort quotation requests
 const sortedQuotationRequests = [...filteredQuotationRequests].sort((a, b) => {
  if (!quotationSortField) return 0;
  
  const aValue = a[quotationSortField];
  const bValue = b[quotationSortField];
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
   return quotationSortDirection === 'asc' 
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
   return quotationSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  }
  
  return 0;
 });

 // Quotation requests pagination
 const quotationIndexOfLastEntry = quotationCurrentPage * quotationEntriesPerPage;
 const quotationIndexOfFirstEntry = quotationIndexOfLastEntry - quotationEntriesPerPage;
 const currentQuotationEntries = sortedQuotationRequests.slice(quotationIndexOfFirstEntry, quotationIndexOfLastEntry);
 const quotationTotalPages = Math.ceil(sortedQuotationRequests.length / quotationEntriesPerPage);

 const handleQuotationSort = (field: keyof QuotationRequest) => {
  if (quotationSortField === field) {
   setQuotationSortDirection(quotationSortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setQuotationSortField(field);
   setQuotationSortDirection('asc');
  }
 };

 const QuotationSortIcon = ({ field }: { field: keyof QuotationRequest }) => (
  <span className="ml-1 text-xs text-gray-400">
   {quotationSortField === field ? (quotationSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 // Filter technical doc requests based on search
 const filteredTechnicalRequests = technicalDocRequests.filter(request => 
  request.productId.toLowerCase().includes(technicalSearchTerm.toLowerCase()) ||
  request.comments.toLowerCase().includes(technicalSearchTerm.toLowerCase())
 );

 // Sort technical doc requests
 const sortedTechnicalRequests = [...filteredTechnicalRequests].sort((a, b) => {
  if (!technicalSortField) return 0;
  
  const aValue = a[technicalSortField];
  const bValue = b[technicalSortField];
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
   return technicalSortDirection === 'asc' 
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
   return technicalSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  }
  
  return 0;
 });

 // Technical doc requests pagination
 const technicalIndexOfLastEntry = technicalCurrentPage * technicalEntriesPerPage;
 const technicalIndexOfFirstEntry = technicalIndexOfLastEntry - technicalEntriesPerPage;
 const currentTechnicalEntries = sortedTechnicalRequests.slice(technicalIndexOfFirstEntry, technicalIndexOfLastEntry);
 const technicalTotalPages = Math.ceil(sortedTechnicalRequests.length / technicalEntriesPerPage);

 const handleTechnicalSort = (field: keyof TechnicalDocRequest) => {
  if (technicalSortField === field) {
   setTechnicalSortDirection(technicalSortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setTechnicalSortField(field);
   setTechnicalSortDirection('asc');
  }
 };

 const TechnicalSortIcon = ({ field }: { field: keyof TechnicalDocRequest }) => (
  <span className="ml-1 text-xs text-gray-400">
   {technicalSortField === field ? (technicalSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 // Filter other requests based on search
 const filteredOtherRequests = otherRequests.filter(request => 
  request.productId.toLowerCase().includes(otherSearchTerm.toLowerCase()) ||
  request.comments.toLowerCase().includes(otherSearchTerm.toLowerCase())
 );

 // Sort other requests
 const sortedOtherRequests = [...filteredOtherRequests].sort((a, b) => {
  if (!otherSortField) return 0;
  
  const aValue = a[otherSortField];
  const bValue = b[otherSortField];
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
   return otherSortDirection === 'asc' 
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
   return otherSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  }
  
  return 0;
 });

 // Other requests pagination
 const otherIndexOfLastEntry = otherCurrentPage * otherEntriesPerPage;
 const otherIndexOfFirstEntry = otherIndexOfLastEntry - otherEntriesPerPage;
 const currentOtherEntries = sortedOtherRequests.slice(otherIndexOfFirstEntry, otherIndexOfLastEntry);
 const otherTotalPages = Math.ceil(sortedOtherRequests.length / otherEntriesPerPage);

 const handleOtherSort = (field: keyof OtherRequest) => {
  if (otherSortField === field) {
   setOtherSortDirection(otherSortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setOtherSortField(field);
   setOtherSortDirection('asc');
  }
 };

 const OtherSortIcon = ({ field }: { field: keyof OtherRequest }) => (
  <span className="ml-1 text-xs text-gray-400">
   {otherSortField === field ? (otherSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 const tabs = [
  { id: 'process' as TabType, label: 'Process Sample Request' },
  { id: 'product' as TabType, label: 'Product Sample Request' },
  { id: 'quotation' as TabType, label: 'Quotation Request' },
  { id: 'technical' as TabType, label: 'Technical Doc Request' },
  { id: 'other' as TabType, label: 'Other Request' }
 ];

 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Product Samples</h1>
    <p className="text-gray-500 mt-1">Manage product samples and distribution</p>
   </div>

   {/* Tab Navigation */}
   <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 overflow-x-auto">
    <div className="flex border-b">
     {tabs.map((tab) => (
      <button
       key={tab.id}
       onClick={() => setActiveTab(tab.id)}
       className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        activeTab === tab.id
         ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
         : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
       }`}
      >
       {tab.label}
      </button>
     ))}
    </div>
   </div>

   {/* Tab Content */}
   <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-100 p-4 md:p-6">
    {loading && (
     <div className="mb-4 text-sm text-gray-500">Loading requests...</div>
    )}
    {activeTab === 'process' && (
     <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Show</span>
        <select
         value={entriesPerPage}
         onChange={(e) => {
          setEntriesPerPage(Number(e.target.value));
          setCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
         <option value={10}>10</option>
         <option value={25}>25</option>
         <option value={50}>50</option>
         <option value={100}>100</option>
        </select>
        <span className="text-gray-600 text-sm">entries</span>
       </div>

       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Search:</span>
        <input
         type="text"
         value={searchTerm}
         onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
         placeholder="Search..."
        />
       </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full border-collapse">
        <thead>
         <tr className="border-b-2 border-gray-200">
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('id')}
          >
           S.No <SortIcon field="id" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('productId')}
          >
           Product Id <SortIcon field="productId" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('reqNos')}
          >
           Req Nos <SortIcon field="reqNos" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('comments')}
          >
           Comments <SortIcon field="comments" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('customer')}
          >
           Customer <SortIcon field="customer" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleSort('date')}
          >
           Date <SortIcon field="date" />
          </th>
         </tr>
        </thead>
        <tbody>
         {currentEntries.map((request) => (
          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
           <td className="py-3 px-4 text-sm text-gray-800">{request.id}</td>
           <td className="py-3 px-4 text-sm text-gray-800">{request.productId}</td>
           <td className="py-3 px-4 text-sm text-gray-800">{request.reqNos}</td>
           <td className="py-3 px-4 text-sm text-gray-800 max-w-xs truncate">{request.comments}</td>
           <td className="py-3 px-4 text-sm text-gray-800">{request.customer}</td>
           <td className="py-3 px-4 text-sm text-gray-800">{request.date}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
       {currentEntries.map((request) => (
        <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
         <div className="flex justify-between items-start mb-3">
          <span className="font-semibold text-gray-800">#{request.id}</span>
         </div>
         <div className="space-y-2 text-sm">
          <div><strong className="text-gray-600">Product ID:</strong> {request.productId}</div>
          <div><strong className="text-gray-600">Req Nos:</strong> {request.reqNos}</div>
          <div><strong className="text-gray-600">Comments:</strong> {request.comments}</div>
          <div><strong className="text-gray-600">Customer:</strong> {request.customer}</div>
          <div><strong className="text-gray-600">Date:</strong> {request.date}</div>
         </div>
        </div>
       ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
       <div className="text-sm text-gray-600">
        Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, sortedRequests.length)} of {sortedRequests.length} entries
       </div>
       <div className="flex gap-1">
        <button
         onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
         disabled={currentPage === 1}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Previous
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
         const pageNum = i + 1;
         return (
          <button
           key={pageNum}
           onClick={() => setCurrentPage(pageNum)}
           className={`px-3 py-1 border rounded text-sm ${
            currentPage === pageNum
             ? 'bg-blue-500 text-white border-blue-500'
             : 'border-gray-300 hover:bg-gray-50'
           }`}
          >
           {pageNum}
          </button>
         );
        })}
        {totalPages > 5 && <span className="px-2 py-1">...</span>}
        <button
         onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
         disabled={currentPage === totalPages}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    )}

    {/* Placeholder content for other tabs */}
    {activeTab === 'product' && (
     <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Show</span>
        <select
         value={productEntriesPerPage}
         onChange={(e) => {
          setProductEntriesPerPage(Number(e.target.value));
          setProductCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
         <option value={10}>10</option>
         <option value={25}>25</option>
         <option value={50}>50</option>
         <option value={100}>100</option>
        </select>
        <span className="text-gray-600 text-sm">entries</span>
       </div>

       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Search:</span>
        <input
         type="text"
         value={productSearchTerm}
         onChange={(e) => {
          setProductSearchTerm(e.target.value);
          setProductCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
         placeholder="Search..."
        />
       </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full border-collapse">
        <thead>
         <tr className="border-b-2 border-gray-200">
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('id')}
          >
           S.No <ProductSortIcon field="id" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('productId')}
          >
           Product Id <ProductSortIcon field="productId" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('reqNos')}
          >
           Req Nos <ProductSortIcon field="reqNos" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('comments')}
          >
           Comments <ProductSortIcon field="comments" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('customer')}
          >
           Customer <ProductSortIcon field="customer" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleProductSort('date')}
          >
           Date <ProductSortIcon field="date" />
          </th>
         </tr>
        </thead>
        <tbody>
         {currentProductEntries.map((sample) => (
          <tr key={sample.id} className="border-b border-gray-100 hover:bg-gray-50">
           <td className="py-3 px-4 text-sm text-gray-700">{sample.id}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{sample.productId}</td>
           <td className="py-3 px-4 text-sm text-blue-600">{sample.reqNos}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{sample.comments || '-'}</td>
           <td className="py-3 px-4 text-sm text-gray-700">
            <div className="flex flex-col gap-1">
             <span>{sample.customer}</span>
             <button
              onClick={() => {
               setSelectedProductSample(sample);
               setShowProductDetailsModal(true);
              }}
              className="text-blue-500 text-xs hover:underline text-left"
             >
              Read more
             </button>
            </div>
           </td>
           <td className="py-3 px-4 text-sm text-gray-700">{sample.date}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
       {currentProductEntries.map((sample) => (
        <div key={sample.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
         <div className="flex justify-between items-start mb-3">
          <span className="font-semibold text-gray-800">#{sample.id}</span>
         </div>
         <div className="space-y-2 text-sm">
          <div><strong className="text-gray-600">Product ID:</strong> {sample.productId}</div>
          <div><strong className="text-gray-600">Req Nos:</strong> <span className="text-blue-600">{sample.reqNos}</span></div>
          <div><strong className="text-gray-600">Comments:</strong> {sample.comments || '-'}</div>
          <div>
           <strong className="text-gray-600">Customer:</strong> {sample.customer}
           <button
            onClick={() => {
             setSelectedProductSample(sample);
             setShowProductDetailsModal(true);
            }}
            className="text-blue-500 text-xs hover:underline ml-2"
           >
            Read more
           </button>
          </div>
          <div><strong className="text-gray-600">Date:</strong> {sample.date}</div>
         </div>
        </div>
       ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
       <div className="text-sm text-gray-600">
        Showing {productIndexOfFirstEntry + 1} to {Math.min(productIndexOfLastEntry, sortedProductSamples.length)} of {sortedProductSamples.length} entries
       </div>
       <div className="flex gap-1">
        <button
         onClick={() => setProductCurrentPage(prev => Math.max(prev - 1, 1))}
         disabled={productCurrentPage === 1}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Previous
        </button>
        {Array.from({ length: Math.min(5, productTotalPages) }, (_, i) => {
         const pageNum = i + 1;
         return (
          <button
           key={pageNum}
           onClick={() => setProductCurrentPage(pageNum)}
           className={`px-3 py-1 border rounded text-sm ${
            productCurrentPage === pageNum
             ? 'bg-blue-500 text-white border-blue-500'
             : 'border-gray-300 hover:bg-gray-50'
           }`}
          >
           {pageNum}
          </button>
         );
        })}
        {productTotalPages > 5 && <span className="px-2 py-1">...</span>}
        <button
         onClick={() => setProductCurrentPage(prev => Math.min(prev + 1, productTotalPages))}
         disabled={productCurrentPage === productTotalPages}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    )}
    {activeTab === 'quotation' && (
     <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Show</span>
        <select
         value={quotationEntriesPerPage}
         onChange={(e) => {
          setQuotationEntriesPerPage(Number(e.target.value));
          setQuotationCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
         <option value={10}>10</option>
         <option value={25}>25</option>
         <option value={50}>50</option>
         <option value={100}>100</option>
        </select>
        <span className="text-gray-600 text-sm">entries</span>
       </div>

       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Search:</span>
        <input
         type="text"
         value={quotationSearchTerm}
         onChange={(e) => {
          setQuotationSearchTerm(e.target.value);
          setQuotationCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
         placeholder="Search..."
        />
       </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full border-collapse">
        <thead>
         <tr className="border-b-2 border-gray-200">
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleQuotationSort('id')}
          >
           S.No <QuotationSortIcon field="id" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleQuotationSort('productId')}
          >
           Product Id <QuotationSortIcon field="productId" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleQuotationSort('requestedNumbers')}
          >
           Requested Numbers <QuotationSortIcon field="requestedNumbers" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleQuotationSort('comments')}
          >
           Comments <QuotationSortIcon field="comments" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleQuotationSort('date')}
          >
           Date <QuotationSortIcon field="date" />
          </th>
         </tr>
        </thead>
        <tbody>
         {currentQuotationEntries.map((request) => (
          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
           <td className="py-3 px-4 text-sm text-gray-700">{request.id}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.productId}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.requestedNumbers}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.comments || '-'}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.date}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
       {currentQuotationEntries.map((request) => (
        <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
         <div className="flex justify-between items-start mb-3">
          <span className="font-semibold text-gray-800">#{request.id}</span>
         </div>
         <div className="space-y-2 text-sm">
          <div><strong className="text-gray-600">Product ID:</strong> {request.productId}</div>
          <div><strong className="text-gray-600">Requested Numbers:</strong> {request.requestedNumbers}</div>
          <div><strong className="text-gray-600">Comments:</strong> {request.comments || '-'}</div>
          <div><strong className="text-gray-600">Date:</strong> {request.date}</div>
         </div>
        </div>
       ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
       <div className="text-sm text-gray-600">
        Showing {quotationIndexOfFirstEntry + 1} to {Math.min(quotationIndexOfLastEntry, sortedQuotationRequests.length)} of {sortedQuotationRequests.length} entries
       </div>
       <div className="flex gap-1">
        <button
         onClick={() => setQuotationCurrentPage(prev => Math.max(prev - 1, 1))}
         disabled={quotationCurrentPage === 1}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Previous
        </button>
        {Array.from({ length: Math.min(5, quotationTotalPages) }, (_, i) => {
         const pageNum = i + 1;
         return (
          <button
           key={pageNum}
           onClick={() => setQuotationCurrentPage(pageNum)}
           className={`px-3 py-1 border rounded text-sm ${
            quotationCurrentPage === pageNum
             ? 'bg-blue-500 text-white border-blue-500'
             : 'border-gray-300 hover:bg-gray-50'
           }`}
          >
           {pageNum}
          </button>
         );
        })}
        {quotationTotalPages > 5 && <span className="px-2 py-1">...</span>}
        <button
         onClick={() => setQuotationCurrentPage(prev => Math.min(prev + 1, quotationTotalPages))}
         disabled={quotationCurrentPage === quotationTotalPages}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    )}
    {activeTab === 'technical' && (
     <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Show</span>
        <select
         value={technicalEntriesPerPage}
         onChange={(e) => {
          setTechnicalEntriesPerPage(Number(e.target.value));
          setTechnicalCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
         <option value={10}>10</option>
         <option value={25}>25</option>
         <option value={50}>50</option>
         <option value={100}>100</option>
        </select>
        <span className="text-gray-600 text-sm">entries</span>
       </div>

       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Search:</span>
        <input
         type="text"
         value={technicalSearchTerm}
         onChange={(e) => {
          setTechnicalSearchTerm(e.target.value);
          setTechnicalCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
         placeholder="Search..."
        />
       </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full border-collapse">
        <thead>
         <tr className="border-b-2 border-gray-200">
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleTechnicalSort('id')}
          >
           S.No <TechnicalSortIcon field="id" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleTechnicalSort('productId')}
          >
           Product Id <TechnicalSortIcon field="productId" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleTechnicalSort('comments')}
          >
           Comments <TechnicalSortIcon field="comments" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleTechnicalSort('date')}
          >
           Date <TechnicalSortIcon field="date" />
          </th>
         </tr>
        </thead>
        <tbody>
         {currentTechnicalEntries.map((request) => (
          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
           <td className="py-3 px-4 text-sm text-gray-700">{request.id}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.productId}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.comments || '-'}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.date}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
       {currentTechnicalEntries.map((request) => (
        <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
         <div className="flex justify-between items-start mb-3">
          <span className="font-semibold text-gray-800">#{request.id}</span>
         </div>
         <div className="space-y-2 text-sm">
          <div><strong className="text-gray-600">Product ID:</strong> {request.productId}</div>
          <div><strong className="text-gray-600">Comments:</strong> {request.comments || '-'}</div>
          <div><strong className="text-gray-600">Date:</strong> {request.date}</div>
         </div>
        </div>
       ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
       <div className="text-sm text-gray-600">
        Showing {technicalIndexOfFirstEntry + 1} to {Math.min(technicalIndexOfLastEntry, sortedTechnicalRequests.length)} of {sortedTechnicalRequests.length} entries
       </div>
       <div className="flex gap-1">
        <button
         onClick={() => setTechnicalCurrentPage(prev => Math.max(prev - 1, 1))}
         disabled={technicalCurrentPage === 1}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Previous
        </button>
        {Array.from({ length: Math.min(5, technicalTotalPages) }, (_, i) => {
         const pageNum = i + 1;
         return (
          <button
           key={pageNum}
           onClick={() => setTechnicalCurrentPage(pageNum)}
           className={`px-3 py-1 border rounded text-sm ${
            technicalCurrentPage === pageNum
             ? 'bg-blue-500 text-white border-blue-500'
             : 'border-gray-300 hover:bg-gray-50'
           }`}
          >
           {pageNum}
          </button>
         );
        })}
        {technicalTotalPages > 5 && <span className="px-2 py-1">...</span>}
        <button
         onClick={() => setTechnicalCurrentPage(prev => Math.min(prev + 1, technicalTotalPages))}
         disabled={technicalCurrentPage === technicalTotalPages}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    )}
    {activeTab === 'other' && (
     <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Show</span>
        <select
         value={otherEntriesPerPage}
         onChange={(e) => {
          setOtherEntriesPerPage(Number(e.target.value));
          setOtherCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
         <option value={10}>10</option>
         <option value={25}>25</option>
         <option value={50}>50</option>
         <option value={100}>100</option>
        </select>
        <span className="text-gray-600 text-sm">entries</span>
       </div>

       <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm">Search:</span>
        <input
         type="text"
         value={otherSearchTerm}
         onChange={(e) => {
          setOtherSearchTerm(e.target.value);
          setOtherCurrentPage(1);
         }}
         className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
         placeholder="Search..."
        />
       </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
       <table className="w-full border-collapse">
        <thead>
         <tr className="border-b-2 border-gray-200">
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleOtherSort('id')}
          >
           S.No <OtherSortIcon field="id" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleOtherSort('productId')}
          >
           Product Id <OtherSortIcon field="productId" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleOtherSort('comments')}
          >
           Comments <OtherSortIcon field="comments" />
          </th>
          <th 
           className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
           onClick={() => handleOtherSort('date')}
          >
           Date <OtherSortIcon field="date" />
          </th>
         </tr>
        </thead>
        <tbody>
         {currentOtherEntries.map((request) => (
          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
           <td className="py-3 px-4 text-sm text-gray-700">{request.id}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.productId}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.comments || '-'}</td>
           <td className="py-3 px-4 text-sm text-gray-700">{request.date}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
       {currentOtherEntries.map((request) => (
        <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
         <div className="flex justify-between items-start mb-3">
          <span className="font-semibold text-gray-800">#{request.id}</span>
         </div>
         <div className="space-y-2 text-sm">
          <div><strong className="text-gray-600">Product ID:</strong> {request.productId}</div>
          <div><strong className="text-gray-600">Comments:</strong> {request.comments || '-'}</div>
          <div><strong className="text-gray-600">Date:</strong> {request.date}</div>
         </div>
        </div>
       ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
       <div className="text-sm text-gray-600">
        Showing {otherIndexOfFirstEntry + 1} to {Math.min(otherIndexOfLastEntry, sortedOtherRequests.length)} of {sortedOtherRequests.length} entries
       </div>
       <div className="flex gap-1">
        <button
         onClick={() => setOtherCurrentPage(prev => Math.max(prev - 1, 1))}
         disabled={otherCurrentPage === 1}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Previous
        </button>
        {Array.from({ length: Math.min(5, otherTotalPages) }, (_, i) => {
         const pageNum = i + 1;
         return (
          <button
           key={pageNum}
           onClick={() => setOtherCurrentPage(pageNum)}
           className={`px-3 py-1 border rounded text-sm ${
            otherCurrentPage === pageNum
             ? 'bg-blue-500 text-white border-blue-500'
             : 'border-gray-300 hover:bg-gray-50'
           }`}
          >
           {pageNum}
          </button>
         );
        })}
        {otherTotalPages > 5 && <span className="px-2 py-1">...</span>}
        <button
         onClick={() => setOtherCurrentPage(prev => Math.min(prev + 1, otherTotalPages))}
         disabled={otherCurrentPage === otherTotalPages}
         className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
         Next
        </button>
       </div>
      </div>
     </div>
    )}
   </div>

   {/* Details Modal */}
   {showDetailsModal && selectedRequest && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
     <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
       <h2 className="text-2xl font-bold text-gray-800 mb-6">Request Details</h2>
       
       <div className="space-y-4">
        {/* Product ID */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Product ID:</label>
         <div className="col-span-9 text-gray-800">{selectedRequest.productId}</div>
        </div>

        {/* Req Nos */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Req Nos:</label>
         <div className="col-span-9 text-gray-800">{selectedRequest.reqNos}</div>
        </div>

        {/* Comments */}
        <div className="grid grid-cols-12 gap-4 items-start border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Comments:</label>
         <div className="col-span-9 text-gray-800">{selectedRequest.comments}</div>
        </div>

        {/* Customer */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Customer:</label>
         <div className="col-span-9 text-gray-800">{selectedRequest.customer}</div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Date:</label>
         <div className="col-span-9 text-gray-800">{selectedRequest.date}</div>
        </div>

        {/* Response */}
        <div className="grid grid-cols-12 gap-4 items-start border-b pb-3">
         <label className="col-span-3 text-sm text-gray-600">Response :</label>
         <div className="col-span-9">
          <textarea
           value={responseText}
           onChange={(e) => setResponseText(e.target.value)}
           className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
           placeholder="Enter your response here..."
          />
         </div>
        </div>
       </div>

       {/* Action Buttons */}
       <div className="mt-6 flex gap-3">
        <button
         onClick={() => {
          alert('Response submitted successfully!');
          setShowDetailsModal(false);
          setResponseText('');
         }}
         className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
        >
         Respond
        </button>
        <button
         onClick={() => {
          setShowDetailsModal(false);
          setResponseText('');
         }}
         className="px-6 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 font-medium"
        >
         Back to Request
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Product Sample Details Modal */}
   {showProductDetailsModal && selectedProductSample && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px] p-4">
     <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 px-6 py-4">
       <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Customer Details</h2>
      </div>
      <div className="p-6">
       
       <div className="space-y-4">
        {/* Product ID */}
        <div className="grid grid-cols-12 gap-4 items-center border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Product ID:</label>
         <div className="col-span-8 text-slate-800">{selectedProductSample.productId}</div>
        </div>

        {/* Req Nos */}
        <div className="grid grid-cols-12 gap-4 items-center border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Req Nos:</label>
         <div className="col-span-8 font-medium text-blue-600">{selectedProductSample.reqNos}</div>
        </div>

        {/* Customer Name */}
        <div className="grid grid-cols-12 gap-4 items-center border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Customer Name:</label>
         <div className="col-span-8 text-slate-800">{selectedProductSample.customer}</div>
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-12 gap-4 items-start border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Customer Details:</label>
         <div className="col-span-8 text-slate-800">
          {selectedProductSample.customerDetails || 'No additional details available'}
         </div>
        </div>

        {/* Comments */}
        <div className="grid grid-cols-12 gap-4 items-start border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Comments:</label>
         <div className="col-span-8 text-slate-800">
          {selectedProductSample.comments || 'No comments'}
         </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-12 gap-4 items-center border-b border-slate-100 pb-3">
         <label className="col-span-4 text-sm font-medium text-slate-500">Date:</label>
         <div className="col-span-8 text-slate-800">{selectedProductSample.date}</div>
        </div>
       </div>

       {/* Action Button */}
       <div className="mt-6">
        <button
         onClick={() => {
          setShowProductDetailsModal(false);
          setSelectedProductSample(null);
         }}
         className="px-6 py-2 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-50 transition-colors font-medium"
        >
         Close
        </button>
       </div>
      </div>
     </div>
    </div>
   )}
  </div>
 );
};

export default ProductSamples;
