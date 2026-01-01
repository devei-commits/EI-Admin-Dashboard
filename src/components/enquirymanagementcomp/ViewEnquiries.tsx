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

const ViewEnquiries: React.FC<ViewEnquiriesProps> = ({ onSelectEnquiry }) => {
  const [enquiries] = useState<Enquiry[]>([
    {
      id: 'ENQ001',
      contactName: 'John Doe',
      email: 'john.doe@example.com',
      mobileNumber: '9876543210',
      message: 'I am interested in your product samples',
      date: '2025-12-15',
      status: 'new',
    },
    {
      id: 'ENQ002',
      contactName: 'Jane Smith',
      email: 'jane.smith@example.com',
      mobileNumber: '8765432109',
      message: 'Can you provide bulk pricing?',
      date: '2025-12-14',
      status: 'responded',
    },
    {
      id: 'ENQ003',
      contactName: 'Mike Johnson',
      email: 'mike.j@example.com',
      mobileNumber: '7654321098',
      message: 'What are the payment terms?',
      date: '2025-12-13',
      status: 'closed',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'responded' | 'closed'>('all');

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

  const filteredEnquiries = enquiries.filter((enquiry) => {
    const matchesSearch =
      enquiry.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enquiry.mobileNumber.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || enquiry.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full space-y-4">
      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <div className="relative">
            <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all bg-gray-50/50"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'new' | 'responded' | 'closed')}
          className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all bg-gray-50/50"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="responded">Responded</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredEnquiries.length > 0 ? (
          filteredEnquiries.map((enquiry) => (
            <div key={enquiry.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <span className="font-semibold text-gray-800">{enquiry.id}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
                  {getStatusIcon(enquiry.status)}
                  {enquiry.status.charAt(0).toUpperCase() + enquiry.status.slice(1)}
                </span>
              </div>
              <div className="space-y-2 text-sm mb-4">
                <p><span className="font-medium text-gray-400">Name:</span> <span className="text-gray-700">{enquiry.contactName}</span></p>
                <p><span className="font-medium text-gray-400">Email:</span> <span className="text-gray-700 break-all">{enquiry.email}</span></p>
                <p><span className="font-medium text-gray-400">Mobile:</span> <span className="text-gray-700">{enquiry.mobileNumber}</span></p>
                <p><span className="font-medium text-gray-400">Date:</span> <span className="text-gray-700">{enquiry.date}</span></p>
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
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-500">No enquiries found</p>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Enquiry ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Mobile</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredEnquiries.length > 0 ? (
              filteredEnquiries.map((enquiry) => (
                <tr key={enquiry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">{enquiry.id}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{enquiry.contactName}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{enquiry.email}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{enquiry.mobileNumber}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{enquiry.date}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
                      {getStatusIcon(enquiry.status)}
                      {enquiry.status.charAt(0).toUpperCase() + enquiry.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onSelectEnquiry(enquiry)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
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
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  No enquiries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Entries Counter */}
      <div className="flex justify-between items-center text-sm text-gray-400 mt-4 pt-4 border-t border-gray-100">
        <span>Showing {filteredEnquiries.length} of {enquiries.length} enquiries</span>
      </div>
    </div>
  );
};

export default ViewEnquiries;
