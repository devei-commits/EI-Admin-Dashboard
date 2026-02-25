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

interface EnquiryDetailPopupProps {
 enquiry: Enquiry;
 onClose: () => void;
}

const EnquiryDetailPopup: React.FC<EnquiryDetailPopupProps> = ({ enquiry, onClose }) => {
 const [responseMessage, setResponseMessage] = useState('');
 const [status, setStatus] = useState(enquiry.status);

 const getStatusColor = (statusValue: string) => {
  switch (statusValue) {
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

 const handleSendResponse = () => {
  if (responseMessage.trim()) {
   alert('Response sent successfully!');
   setResponseMessage('');
   setStatus('responded');
  }
 };

 const handleClose = () => {
  setStatus('closed');
  alert('Enquiry marked as closed!');
  onClose();
 };

 return (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
   <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
    {/* Header */}
    <div className="flex justify-between items-center p-5 border-b border-gray-100 sticky top-0 bg-white">
     <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
       <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
       </svg>
      </div>
      <div>
       <h3 className="text-lg font-semibold text-gray-800">Enquiry Details</h3>
       <p className="text-sm text-gray-500">{enquiry.id}</p>
      </div>
     </div>
     <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Content */}
    <div className="p-5 space-y-6">
     {/* Contact Information */}
     <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-4">Contact Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">Contact Name</p>
        <p className="text-sm font-medium text-gray-900">{enquiry.contactName}</p>
       </div>
       <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">Email Address</p>
        <p className="text-sm font-medium text-gray-900 break-all">{enquiry.email}</p>
       </div>
       <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">Mobile Number</p>
        <p className="text-sm font-medium text-gray-900">{enquiry.mobileNumber}</p>
       </div>
       <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">Date</p>
        <p className="text-sm font-medium text-gray-900">{enquiry.date}</p>
       </div>
      </div>
     </div>

     {/* Status */}
     <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Status</h4>
      <div className="flex items-center gap-2">
       <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
       </span>
      </div>
     </div>

     {/* Message */}
     <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Message</h4>
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
       <p className="text-sm text-gray-700 leading-relaxed">{enquiry.message}</p>
      </div>
     </div>

     {/* Response Section */}
     {status !== 'closed' && (
      <div>
       <h4 className="text-sm font-semibold text-gray-700 mb-3">Send Response</h4>
       <textarea
        value={responseMessage}
        onChange={(e) => setResponseMessage(e.target.value)}
        placeholder="Type your response message here..."
        className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none transition-all resize-none bg-gray-50/50"
        rows={4}
       />
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col-reverse sm:flex-row gap-3 justify-end sticky bottom-0">
     <button
      onClick={onClose}
      className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
     >
      Close
     </button>
     {status !== 'closed' && (
      <>
       <button
        onClick={handleSendResponse}
        disabled={!responseMessage.trim()}
        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:bg-gray-300 rounded-lg transition-colors disabled:cursor-not-allowed"
       >
        Send Response
       </button>
       <button
        onClick={handleClose}
        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
       >
        Mark as Closed
       </button>
      </>
     )}
    </div>
   </div>
  </div>
 );
};

export default EnquiryDetailPopup;
