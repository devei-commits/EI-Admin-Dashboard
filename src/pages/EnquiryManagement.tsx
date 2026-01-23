import { EnquiryManagementEnhanced } from '../components/enquirymanagementcomp';

const EnquiryManagement = () => {
  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Ticket Management</h1>
        <p className="text-gray-500 mt-1">Dashboard, ticket tracking, and staff assignment for customer enquiries</p>
      </div>
      <EnquiryManagementEnhanced />
    </div>
  )
}

export default EnquiryManagement
