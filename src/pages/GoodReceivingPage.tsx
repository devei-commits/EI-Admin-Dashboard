import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoodReceiving, PORequests, IssuedPOS } from '../components/ordermanagementcomp';

type TabType = 'po-requests' | 'issued-pos' | 'ongoing-grns' | 'mrn-fgs' | 'print-labels' | 'grn' | 'proofing';

const GoodReceivingPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('po-requests');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'po-requests',
      label: 'PO Requests',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    },
    {
      id: 'issued-pos',
      label: 'Issued P.O.s',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      id: 'ongoing-grns',
      label: 'Ongoing GRN\'s',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    {
      id: 'mrn-fgs',
      label: 'MRN/FG\'s',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 0v10l8 4" /></svg>
    },
    {
      id: 'print-labels',
      label: 'Print Labels',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    },
    {
      id: 'grn',
      label: 'GRN',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      id: 'proofing',
      label: 'Proofing',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    },
  ];

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Good Receiving</h1>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
              <Link to="/" className="text-amber-600 hover:text-amber-800 hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <Link to="/order-management" className="text-amber-600 hover:text-amber-800 hover:underline">
                Order Management
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">Good Receiving</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        {/* Scrollable Tab Container */}
        <div className="overflow-x-auto">
          <div className="flex border-b border-gray-200 min-w-max md:min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 md:px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b-2 border-amber-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="hidden sm:inline">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* PO Requests */}
          {activeTab === 'po-requests' && (
            <PORequests />
          )}

          {/* Issued POs */}
          {activeTab === 'issued-pos' && (
            <IssuedPOS />
          )}

          {/* Ongoing GRNs */}
          {activeTab === 'ongoing-grns' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Ongoing GRN\'s</h3>
              <p className="text-gray-500">Monitor goods receiving notes in progress</p>
            </div>
          )}

          {/* MRN/FGs */}
          {activeTab === 'mrn-fgs' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 0v10l8 4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">MRN/FG\'s</h3>
              <p className="text-gray-500">Material receiving notes and finished goods</p>
            </div>
          )}

          {/* Print Labels */}
          {activeTab === 'print-labels' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Labels</h3>
              <p className="text-gray-500">Generate and print product labels</p>
            </div>
          )}

          {/* GRN - Main Content */}
          {activeTab === 'grn' && (
            <GoodReceiving />
          )}

          {/* Proofing */}
          {activeTab === 'proofing' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Proofing</h3>
              <p className="text-gray-500">Quality assurance and proofing verification</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoodReceivingPage
