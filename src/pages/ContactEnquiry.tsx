import { useState } from 'react';
import { ModalOverlay } from '../components/ui/ModalOverlay';

interface ContactEnquiry {
 id: number;
 contactName: string;
 mobile: string;
 email: string;
 date: string;
 subject: string;
 status: 'New' | 'Responded' | 'Closed';
 message?: string;
 response?: string;
 responseDate?: string;
}

const ContactEnquiry = () => {
 const [enquiries] = useState<ContactEnquiry[]>([
  {
   id: 1,
   contactName: 'Dipankar Bhadra',
   mobile: '8657854326',
   email: 'Dipankar@witexecutors.co.in',
   date: '10-12-2025',
   subject: 'Architectural Products,Sales & Services,Supply',
   status: 'New'
  },
  {
   id: 2,
   contactName: 'Dipankar Bhadra',
   mobile: '8657854326',
   email: 'Dipankar@traveloclock.co.in',
   date: '10-12-2025',
   subject: 'Introducing Travel O Clock',
   status: 'New'
  },
  {
   id: 3,
   contactName: 'Saikrishna',
   mobile: '9848148893',
   email: 'Krishnasai111@gmail.com',
   date: '08-09-2025',
   subject: 'Test request',
   status: 'New'
  },
  {
   id: 4,
   contactName: 'Deevi Saikrishn',
   mobile: '9848148893',
   email: 'Saikrishna@estheticinsights.com',
   date: '08-09-2025',
   subject: 'Test request',
   status: 'New'
  },
  {
   id: 5,
   contactName: 'Deevi Saikrishn',
   mobile: '9848148893',
   email: 'Saikrishna@estheticinsights.com',
   date: '08-09-2025',
   subject: 'Hi',
   status: 'New'
  },
  {
   id: 6,
   contactName: 'Ajay bankawat',
   mobile: '9950825056',
   email: 'Ajay27.royal@gmail.com',
   date: '20-08-2025',
   subject: 'We are planning to launch 4 skincare products (fac',
   status: 'New'
  },
  {
   id: 7,
   contactName: 'LALITHYA KADIMI',
   mobile: '8686688025',
   email: 'Drlalithyak@gmail.com',
   date: '22-07-2025',
   subject: '',
   status: 'New'
  },
  {
   id: 8,
   contactName: 'Dr Rupali',
   mobile: '9820521188',
   email: 'Dr.rupaliparikh.bh@gmail.com',
   date: '21-07-2025',
   subject: 'Skin care products',
   status: 'New'
  },
  {
   id: 9,
   contactName: 'Nagendra',
   mobile: '9640670126',
   email: 'Naguesu.y@gmail.com',
   date: '20-06-2025',
   subject: '',
   status: 'New'
  }
 ]);

 const [searchTerm, setSearchTerm] = useState('');
 const [entriesPerPage, setEntriesPerPage] = useState(10);
 const [currentPage, setCurrentPage] = useState(1);
 const [sortField, setSortField] = useState<keyof ContactEnquiry | null>(null);
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [showDetailsModal, setShowDetailsModal] = useState(false);
 const [selectedEnquiry, setSelectedEnquiry] = useState<ContactEnquiry | null>(null);
 const [responseText, setResponseText] = useState('');

 // Filter enquiries based on search
 const filteredEnquiries = enquiries.filter(enquiry => 
  enquiry.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  enquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
  enquiry.mobile.includes(searchTerm) ||
  enquiry.subject.toLowerCase().includes(searchTerm.toLowerCase())
 );

 // Sort enquiries
 const sortedEnquiries = [...filteredEnquiries].sort((a, b) => {
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
 const currentEntries = sortedEnquiries.slice(indexOfFirstEntry, indexOfLastEntry);
 const totalPages = Math.ceil(sortedEnquiries.length / entriesPerPage);

 const handleSort = (field: keyof ContactEnquiry) => {
  if (sortField === field) {
   setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setSortField(field);
   setSortDirection('asc');
  }
 };

 const getStatusColor = (status: ContactEnquiry['status']) => {
  const colors = {
   'New': 'bg-brand-soft text-brand',
   'Responded': 'bg-warn-soft text-warn',
   'Closed': 'bg-ok-soft text-ok'
  };
  return colors[status];
 };

 const SortIcon = ({ field }: { field: keyof ContactEnquiry }) => (
  <span className="ml-1 text-xs text-ink-4">
   {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
 );

 return (
  <div className="p-4 md:p-8 bg-surface-2/50 min-h-screen">
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-ink">Contact Form Enquiries</h1>
    <p className="text-ink-3 mt-1">Manage contact enquiries and customer interactions</p>
   </div>

   <div className="bg-surface rounded-xl shadow-sm border border-hairline p-4 md:p-6">
    {/* Controls */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
     <div className="flex items-center gap-2">
      <span className="text-ink-2 text-sm">Show</span>
      <select
       value={entriesPerPage}
       onChange={(e) => {
        setEntriesPerPage(Number(e.target.value));
        setCurrentPage(1);
       }}
       className="px-3 py-1 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
      >
       <option value={10}>10</option>
       <option value={25}>25</option>
       <option value={50}>50</option>
       <option value={100}>100</option>
      </select>
      <span className="text-ink-2 text-sm">entries</span>
     </div>

     <div className="flex items-center gap-2">
      <span className="text-ink-2 text-sm">Search:</span>
      <input
       type="text"
       value={searchTerm}
       onChange={(e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
       }}
       className="px-3 py-1 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
       placeholder="Search..."
      />
     </div>
    </div>

    {/* Desktop Table */}
    <div className="hidden md:block overflow-auto max-h-[70vh]">
     <table className="w-full border-collapse">
      <thead className="sticky top-0 z-20">
       <tr className="[&_th]:bg-surface-2 border-b-2 border-border">
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('id')}
        >
         S.No <SortIcon field="id" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('contactName')}
        >
         Contact Name <SortIcon field="contactName" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('mobile')}
        >
         Mobile <SortIcon field="mobile" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('email')}
        >
         Email <SortIcon field="email" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('date')}
        >
         Date <SortIcon field="date" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('subject')}
        >
         Subject <SortIcon field="subject" />
        </th>
        <th scope="col" 
         className="text-left py-3 px-4 text-sm font-semibold text-ink-2 cursor-pointer hover:bg-surface-2"
         onClick={() => handleSort('status')}
        >
         Status <SortIcon field="status" />
        </th>
        <th scope="col" className="text-center py-3 px-4 text-sm font-semibold text-ink-2">
         View
        </th>
       </tr>
      </thead>
      <tbody>
       {currentEntries.map((enquiry) => (
        <tr key={enquiry.id} className="border-b border-hairline hover:bg-surface-2">
         <td className="py-3 px-4 text-sm text-ink">{enquiry.id}</td>
         <td className="py-3 px-4 text-sm text-ink">{enquiry.contactName}</td>
         <td className="py-3 px-4 text-sm text-ink">{enquiry.mobile}</td>
         <td className="py-3 px-4 text-sm text-ink">{enquiry.email}</td>
         <td className="py-3 px-4 text-sm text-ink">{enquiry.date}</td>
         <td className="py-3 px-4 text-sm text-ink max-w-xs truncate">{enquiry.subject}</td>
         <td className="py-3 px-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
           {enquiry.status}
          </span>
         </td>
         <td className="py-3 px-4 text-center">
          <button
           onClick={() => {
            setSelectedEnquiry(enquiry);
            setShowDetailsModal(true);
           }}
           className="text-brand hover:text-brand"
          >
           <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
           </svg>
          </button>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>

    {/* Mobile Cards */}
    <div className="md:hidden space-y-4">
     {currentEntries.map((enquiry) => (
      <div key={enquiry.id} className="border border-border rounded-lg p-4 bg-surface-2">
       <div className="flex justify-between items-start mb-3">
        <span className="font-semibold text-ink">#{enquiry.id}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(enquiry.status)}`}>
         {enquiry.status}
        </span>
       </div>
       <div className="space-y-2 text-sm">
        <div><strong className="text-ink-2">Name:</strong> {enquiry.contactName}</div>
        <div><strong className="text-ink-2">Mobile:</strong> {enquiry.mobile}</div>
        <div><strong className="text-ink-2">Email:</strong> {enquiry.email}</div>
        <div><strong className="text-ink-2">Date:</strong> {enquiry.date}</div>
        <div><strong className="text-ink-2">Subject:</strong> {enquiry.subject}</div>
       </div>
       <button
        onClick={() => {
         setSelectedEnquiry(enquiry);
         setShowDetailsModal(true);
        }}
        className="mt-3 w-full py-2 bg-brand text-white rounded-lg hover:bg-brand text-sm"
       >
        View Details
       </button>
      </div>
     ))}
    </div>

    {/* Pagination */}
    <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
     <div className="text-sm text-ink-2">
      Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, sortedEnquiries.length)} of {sortedEnquiries.length} entries
     </div>
     <div className="flex gap-1">
      <button
       onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
       disabled={currentPage === 1}
       className="px-3 py-1 border border-border rounded hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
           ? 'bg-brand text-white border-brand'
           : 'border-border hover:bg-surface-2'
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
       className="px-3 py-1 border border-border rounded hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
       Next
      </button>
     </div>
    </div>
   </div>

   {/* Details Modal */}
   {showDetailsModal && selectedEnquiry && (
    <ModalOverlay onClose={() => { setShowDetailsModal(false); setResponseText(''); }} z="z-50" dismissable={false} backdrop="strong">
     <div role="dialog" aria-modal="true" aria-label="Enquiry Details" onClick={(e) => e.stopPropagation()} className="bg-surface rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
       <h2 className="text-2xl font-bold text-ink mb-6">Enquiry Details</h2>
       
       <div className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Name:</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.contactName}</div>
        </div>

        {/* Email */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">EMail:</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.email}</div>
        </div>

        {/* Phone */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Phone:</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.mobile}</div>
        </div>

        {/* Subject */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Subject:</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.subject || 'N/A'}</div>
        </div>

        {/* Message */}
        <div className="grid grid-cols-12 gap-4 items-start border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Message:</label>
         <div className="col-span-9 text-ink">
          {selectedEnquiry.message || 'Hi, I would like to discuss regarding formulation of new products in skin and hair care.'}
         </div>
        </div>

        {/* Enquiry Date */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Enquiry Date :</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.date}</div>
        </div>

        {/* Enquiry Status */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Enquiry Status :</label>
         <div className="col-span-9">
          <span className="text-brand font-medium">{selectedEnquiry.status}</span>
         </div>
        </div>

        {/* Response */}
        <div className="grid grid-cols-12 gap-4 items-start border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Response :</label>
         <div className="col-span-9">
          <textarea
           value={responseText}
           onChange={(e) => setResponseText(e.target.value)}
           className="w-full h-40 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
           placeholder="Enter your response here..."
          />
         </div>
        </div>

        {/* Response Date */}
        <div className="grid grid-cols-12 gap-4 items-center border-b pb-3">
         <label className="col-span-3 text-sm text-ink-2">Response Date:</label>
         <div className="col-span-9 text-ink">{selectedEnquiry.responseDate || ''}</div>
        </div>
       </div>

       {/* Action Buttons */}
       <div className="mt-6 flex gap-3">
        <button
         onClick={() => {
          // Handle respond action
          alert('Response submitted successfully!');
          setShowDetailsModal(false);
          setResponseText('');
         }}
         className="px-6 py-2 bg-brand text-white rounded hover:bg-brand font-medium"
        >
         Respond
        </button>
        <button
         onClick={() => {
          setShowDetailsModal(false);
          setResponseText('');
         }}
         className="px-6 py-2 border border-brand text-brand rounded hover:bg-brand-soft font-medium"
        >
         Back to Enquiry
        </button>
       </div>
      </div>
     </div>
    </ModalOverlay>
   )}
  </div>
 );
};

export default ContactEnquiry;
