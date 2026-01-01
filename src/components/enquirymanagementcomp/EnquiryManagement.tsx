import React, { useState } from 'react';
import ViewEnquiries from './ViewEnquiries';
import EnquiryDetailPopup from './EnquiryDetailPopup';

interface Enquiry {
  id: string;
  contactName: string;
  email: string;
  mobileNumber: string;
  message: string;
  date: string;
  status: 'new' | 'responded' | 'closed';
}

const EnquiryManagement: React.FC = () => {
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  return (
    <div className="w-full p-2 md:p-4">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">All Enquiries</h2>
        </div>
      </div>

      {/* Content */}
      <ViewEnquiries onSelectEnquiry={setSelectedEnquiry} />

      {/* Enquiry Detail Popup */}
      {selectedEnquiry && (
        <EnquiryDetailPopup enquiry={selectedEnquiry} onClose={() => setSelectedEnquiry(null)} />
      )}
    </div>
  );
};

export default EnquiryManagement;
