import React, { useState } from 'react';

interface Enquiry {
  id: string;
  contactName: string;
  email: string;
  mobileNumber: string;
  message: string;
  date: string;
  status: 'new' | 'responded' | 'closed';
}

interface ViewEnquiriesProps {
  onSelectEnquiry: (enquiry: Enquiry) => void;
}

// SortButton component extracted outside to avoid re-creation during render
interface SortButtonProps {
  field: keyof Enquiry;
  children: React.ReactNode;
  sortField: keyof Enquiry;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Enquiry) => void;
}

const SortButton: React.FC<SortButtonProps> = ({ 
  field, 
  children, 
  sortField, 
  sortDirection, 
  onSort 
}) => (
  <button
    onClick={() => onSort(field)}
    className="flex items-center gap-1 hover:bg-gray-50 p-2 rounded transition-colors min-w-0 w-full justify-start"
  >
    <span className="truncate">{children}</span>
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      )}
    </svg>
  </button>
);

const ViewEnquiries: React.FC<ViewEnquiriesProps> = ({ onSelectEnquiry }) => {
  const [enquiries] = useState<Enquiry[]>([
    {
      id: 'ENQ001',
      contactName: 'John Doe',
      email: 'john.doe@example.com',
      mobileNumber: '9876543210',
      message: 'I am interested in your product samples',
      date: '2026-01-15',
      status: 'new',
    },
    {
      id: 'ENQ002',
      contactName: 'Jane Smith',
      email: 'jane.smith@example.com',
      mobileNumber: '8765432109',
      message: 'Can you provide bulk pricing?',
      date: '2026-01-14',
      status: 'responded',
    },
    {
      id: 'ENQ003',
      contactName: 'Mike Johnson',
      email: 'mike.j@example.com',
      mobileNumber: '7654321098',
      message: 'What are the payment terms?',
      date: '2026-01-13',
      status: 'closed',
    },
    {
      id: 'ENQ004',
      contactName: 'Sarah Wilson',
      email: 'sarah.w@example.com',
      mobileNumber: '6543210987',
      message: 'Need technical specifications',
      date: '2026-01-12',
      status: 'new',
    },
    {
      id: 'ENQ005',
      contactName: 'David Brown',
      email: 'david.b@example.com',
      mobileNumber: '5432109876',
      message: 'Interested in partnership',
      date: '2026-01-11',
      status: 'responded',
    },
    {
      id: 'ENQ006',
      contactName: 'Lisa Davis',
      email: 'lisa.d@example.com',
      mobileNumber: '4321098765',
      message: 'Request for quotation',
      date: '2026-01-10',
      status: 'new',
    },
  ]);

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'responded' | 'closed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<keyof Enquiry | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 3;

  // Calculate stats
  const stats = {
    total: enquiries.length,
    new: enquiries.filter(e => e.status === 'new').length,
    responded: enquiries.filter(e => e.status === 'responded').length,
    closed: enquiries.filter(e => e.status === 'closed').length,
  };

  // Sorting function
  const handleSort = (field: keyof Enquiry) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort enquiries
  const filteredAndSortedEnquiries = (() => {
    let filtered = enquiries.filter((enquiry) => {
      const matchesSearch =
        enquiry.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        enquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        enquiry.mobileNumber.includes(searchTerm) ||
        enquiry.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || enquiry.status === filterStatus;
      
      const matchesDateRange = (() => {
        if (!dateFrom && !dateTo) return true;
        const enquiryDate = new Date(enquiry.date);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        
        if (fromDate && toDate) return enquiryDate >= fromDate && enquiryDate <= toDate;
        if (fromDate) return enquiryDate >= fromDate;
        if (toDate) return enquiryDate <= toDate;
        return true;
      })();
      
      return matchesSearch && matchesStatus && matchesDateRange;
    });

    // Sort
    if (sortField) {
      filtered = filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  })();

  // Pagination
  const totalRecords = filteredAndSortedEnquiries.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentEnquiries = filteredAndSortedEnquiries.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'responded':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'closed':
        return 'bg-gray-100 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'responded':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'closed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Sort handler for the SortButton
  const handleSortField = (field: keyof Enquiry) => {
    handleSort(field);
  };

  return (
    <div className="w-full space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-linear-to-rrom-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
            </div>
            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-linear-to-r from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">New</p>
              <p className="text-2xl font-bold text-amber-900">{stats.new}</p>
            </div>
            <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-linear-to-r from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Responded</p>
              <p className="text-2xl font-bold text-emerald-900">{stats.responded}</p>
            </div>
            <div className="w-8 h-8 bg-emerald-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-linear-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Closed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.closed}</p>
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, mobile, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'new' | 'responded' | 'closed')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="responded">Responded</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
                setDateFrom('');
                setDateTo('');
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Records info */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <p className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} of {totalRecords} enquiries
          </p>
          <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-600 flex items-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              Next
            </button>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {currentEnquiries.length > 0 ? (
            currentEnquiries.map((enquiry) => (
              <div key={enquiry.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-semibold text-gray-800">{enquiry.id}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
                    {getStatusIcon(enquiry.status)}
                    {enquiry.status.charAt(0).toUpperCase() + enquiry.status.slice(1)}
                  </span>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <p><span className="font-medium text-gray-500">Name:</span> <span className="text-gray-800">{enquiry.contactName}</span></p>
                  <p><span className="font-medium text-gray-500">Email:</span> <span className="text-gray-800 break-all">{enquiry.email}</span></p>
                  <p><span className="font-medium text-gray-500">Mobile:</span> <span className="text-gray-800">{enquiry.mobileNumber}</span></p>
                  <p><span className="font-medium text-gray-500">Date:</span> <span className="text-gray-800">{enquiry.date}</span></p>
                </div>
                <button
                  onClick={() => onSelectEnquiry(enquiry)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Details
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500 font-medium">No enquiries found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-20">
                    <SortButton field="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Enquiry ID</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-35">
                    <SortButton field="contactName" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Contact Name</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-45">
                    <SortButton field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Email</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-27.5">
                    <SortButton field="mobileNumber" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Mobile</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-25">
                    <SortButton field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Date</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-25">
                    <SortButton field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSortField}>Status</SortButton>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-20">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentEnquiries.length > 0 ? (
                  currentEnquiries.map((enquiry) => (
                    <tr key={enquiry.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {enquiry.id}
                      </td>
                      <td className="px-2 sm:px-4 py-4 text-sm font-medium text-gray-900">
                        <div className="max-w-35 truncate" title={enquiry.contactName}>
                          {enquiry.contactName}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-4 text-sm text-gray-900">
                        <div className="max-w-45 truncate" title={enquiry.email}>
                          {enquiry.email}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {enquiry.mobileNumber}
                      </td>
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {enquiry.date}
                      </td>
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
                          {getStatusIcon(enquiry.status)}
                          {enquiry.status.charAt(0).toUpperCase() + enquiry.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onSelectEnquiry(enquiry)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-gray-500 font-medium">No enquiries found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEnquiries;
