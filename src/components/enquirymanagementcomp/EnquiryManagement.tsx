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
    <div className="w-full">
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
