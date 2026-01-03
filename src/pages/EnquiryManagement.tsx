import { EnquiryManagement as EnquiryManagementComponent } from '../components/enquirymanagementcomp';

const EnquiryManagement = () => {
  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Enquiry Management</h1>
        <p className="text-gray-500 mt-1">View and respond to customer enquiries</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <EnquiryManagementComponent />
      </div>
    </div>
  )
}

export default EnquiryManagement
