import { useState } from 'react';

interface Appointment {
 id: number;
 doctorName: string;
 mobileNo: string;
 clinicName: string;
 date: string;
 confirmationStatus: 'confirmed' | 'pending' | 'cancelled';
 status: 'active' | 'inactive' | 'completed';
 assignTo: string;
}

const DoctorAppointments = () => {
 // Sample data
 const [appointments] = useState<Appointment[]>([
  {
   id: 1,
   doctorName: 'Dr. John Smith',
   mobileNo: '9876543210',
   clinicName: 'City Medical Center',
   date: '2026-01-05',
   confirmationStatus: 'confirmed',
   status: 'active',
   assignTo: 'Admin User'
  },
  {
   id: 2,
   doctorName: 'Dr. Sarah Johnson',
   mobileNo: '8765432109',
   clinicName: 'Health Plus Clinic',
   date: '2026-01-06',
   confirmationStatus: 'pending',
   status: 'active',
   assignTo: 'Manager A'
  },
  {
   id: 3,
   doctorName: 'Dr. Mike Brown',
   mobileNo: '7654321098',
   clinicName: 'Care First Hospital',
   date: '2026-01-07',
   confirmationStatus: 'confirmed',
   status: 'completed',
   assignTo: 'Coordinator B'
  },
  {
   id: 4,
   doctorName: 'Dr. Emily Davis',
   mobileNo: '6543210987',
   clinicName: 'Wellness Center',
   date: '2026-01-08',
   confirmationStatus: 'cancelled',
   status: 'inactive',
   assignTo: 'Admin User'
  },
  {
   id: 5,
   doctorName: 'Dr. Robert Wilson',
   mobileNo: '5432109876',
   clinicName: 'Metro Hospital',
   date: '2026-01-09',
   confirmationStatus: 'pending',
   status: 'active',
   assignTo: 'Manager C'
  }
 ]);

 const [sortField, setSortField] = useState<keyof Appointment | null>(null);
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [currentPage, setCurrentPage] = useState(1);
 const recordsPerPage = 3;

 // Sort function
 const handleSort = (field: keyof Appointment) => {
  if (sortField === field) {
   setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
   setSortField(field);
   setSortDirection('asc');
  }
 };

 // Sort appointments
 const sortedAppointments = [...appointments].sort((a, b) => {
  if (!sortField) return 0;
  
  const aValue = a[sortField];
  const bValue = b[sortField];
  
  if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
  return 0;
 });

 // Pagination
 const totalRecords = sortedAppointments.length;
 const totalPages = Math.ceil(totalRecords / recordsPerPage);
 const startIndex = (currentPage - 1) * recordsPerPage;
 const endIndex = startIndex + recordsPerPage;
 const currentAppointments = sortedAppointments.slice(startIndex, endIndex);

 const goToNextPage = () => {
  if (currentPage < totalPages) {
   setCurrentPage(currentPage + 1);
  }
 };

 const goToPreviousPage = () => {
  if (currentPage > 1) {
   setCurrentPage(currentPage - 1);
  }
 };

 const getStatusColor = (status: string) => {
  switch (status) {
   case 'confirmed':
    return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium';
   case 'pending':
    return 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium';
   case 'cancelled':
    return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium';
   case 'active':
    return 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium';
   case 'inactive':
    return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium';
   case 'completed':
    return 'bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium';
   default:
    return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium';
  }
 };

 const SortButton = ({ field, children }: { field: keyof Appointment; children: React.ReactNode }) => (
  <button
   onClick={() => handleSort(field)}
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

 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">New Appointments</h1>
    <p className="text-gray-500 mt-1">Manage and track doctor appointments</p>
   </div>
   
   <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    {/* Records info */}
    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
     <p className="text-sm text-gray-600">
      Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} of {totalRecords} records
     </p>
     <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
      <button
       onClick={goToPreviousPage}
       disabled={currentPage === 1}
       className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        currentPage === 1
         ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
         : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
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
         : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
       }`}
      >
       Next
      </button>
     </div>
    </div>

    {/* Table */}
    <div className="overflow-x-auto">
     <div className="min-w-full">
      <table className="w-full table-auto">
       <thead className="bg-gray-50">
        <tr>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-15">
          <SortButton field="id">S No</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-35">
          <SortButton field="doctorName">Doctor Name</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-27.5">
          <SortButton field="mobileNo">Mobile No</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-35">
          <SortButton field="clinicName">Clinic Name</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-25">
          <SortButton field="date">Date</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32.5">
          <SortButton field="confirmationStatus">Confirmation</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-25">
          <SortButton field="status">Status</SortButton>
         </th>
         <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-30">
          <SortButton field="assignTo">Assign To</SortButton>
         </th>
        </tr>
       </thead>
       <tbody className="bg-white divide-y divide-gray-200">
        {currentAppointments.map((appointment) => (
         <tr key={appointment.id} className="hover:bg-gray-50">
          <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
           {appointment.id}
          </td>
          <td className="px-2 sm:px-4 py-4 text-sm font-medium text-gray-900">
           <div className="max-w-35 truncate" title={appointment.doctorName}>
            {appointment.doctorName}
           </div>
          </td>
          <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900">
           {appointment.mobileNo}
          </td>
          <td className="px-2 sm:px-4 py-4 text-sm text-gray-900">
           <div className="max-w-35 truncate" title={appointment.clinicName}>
            {appointment.clinicName}
           </div>
          </td>
          <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900">
           {appointment.date}
          </td>
          <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
           <span className={getStatusColor(appointment.confirmationStatus)}>
            {appointment.confirmationStatus}
           </span>
          </td>
          <td className="px-2 sm:px-4 py-4 whitespace-nowrap">
           <span className={getStatusColor(appointment.status)}>
            {appointment.status}
           </span>
          </td>
          <td className="px-2 sm:px-4 py-4 text-sm text-gray-900">
           <div className="max-w-30 truncate" title={appointment.assignTo}>
            {appointment.assignTo}
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>
   </div>
  </div>
 )
}

export default DoctorAppointments
