import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PORequests, OngoingGRNs, MRNFGs, GRNList, Proofing } from '../components/ordermanagementcomp';
import { useGlobalState } from '../context/GlobalStateContext';
import GRNWizardModal from '../components/ordermanagementcomp/GRNWizardModal';

type TabType = 'po-requests' | 'issued-pos' | 'ongoing-grns' | 'mrn-fgs' | 'print-labels' | 'grn' | 'proofing';

// Inline component that reads issued POs from global state and supports GRN completion
const IssuedPOsView: React.FC = () => {
  const { state, dispatch } = useGlobalState();
  const issuedPOs: any[] = state.po?.issued || [];
  const [grnInputs, setGrnInputs] = useState<Record<string, string>>({});
  const [grnWizard, setGrnWizard] = useState<{ poId: string; lineItemId: string } | null>(null);

  const completeGRN = (poId: string, lineItemId: string, receivedQty: number) => {
    dispatch({
      type: 'COMPLETE_GRN',
      payload: {
        poId,
        lineItemId,
        grnData: {
          status: 'Completed',
          completedAt: new Date().toISOString().slice(0, 10),
          receivedQty,
        },
      },
    });
  };

  if (!issuedPOs.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-medium">No issued POs</p>
        <p className="text-sm mt-1">Issued POs from the Treasury will appear here</p>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n));

  return (
    <div className="space-y-4">
      {issuedPOs.map((po: any) => (
        <div key={po.id} className="border border-gray-200 rounded-xl overflow-hidden">
          {/* PO Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-gray-800">{po.id}</span>
              <span className="font-semibold text-gray-700">{po.vendor}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${po.status === 'ISSUED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {po.status}
              </span>
              {po.delayed && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">⚠ Delayed</span>
              )}
            </div>
            <div className="text-sm text-gray-500 space-x-4">
              {po.expectedDelivery && (
                <span>Expected: {typeof po.expectedDelivery === 'string' ? po.expectedDelivery : new Date(po.expectedDelivery).toISOString().slice(0, 10)}</span>
              )}
              <span className={`font-medium ${po.confirmation === 'Confirmed' ? 'text-green-600' : 'text-orange-600'}`}>
                {po.confirmation || 'Pending confirmation'}
              </span>
            </div>
          </div>

          {po.notes && (
            <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700">{po.notes}</div>
          )}

          {/* Lines table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Item</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Ordered</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">GRN Status</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Receive Qty</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(po.lines || []).map((line: any) => {
                const key = `${po.id}__${line.itemId}`;
                const isDone = line.grn?.status === 'Completed';
                return (
                  <tr key={line.itemId} className={`border-b border-gray-50 ${isDone ? 'bg-green-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{line.itemName}</p>
                      <p className="text-xs text-gray-400">{line.itemId} · {line.uom}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmt(line.qty)} {line.uom}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isDone ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                        {isDone ? `✓ Received ${fmt(line.grn?.receivedQty || line.qty)}` : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isDone && (
                        <input
                          type="number"
                          min="0"
                          max={line.qty}
                          value={grnInputs[key] ?? line.qty}
                          onChange={(e) => setGrnInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isDone ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setGrnWizard({ poId: po.id, lineItemId: line.itemId })}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
                          >
                            📋 GRN Wizard
                          </button>
                          <button
                            onClick={() => {
                              const qty = Number(grnInputs[key] ?? line.qty);
                              if (qty <= 0) { alert('Enter a valid received quantity'); return; }
                              completeGRN(po.id, line.itemId, qty);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition"
                          >
                            ✓ Quick GRN
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">GRN Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* GRN Wizard Modal */}
      {grnWizard && (
        <GRNWizardModal
          poId={grnWizard.poId}
          lineItemId={grnWizard.lineItemId}
          onClose={() => setGrnWizard(null)}
        />
      )}
    </div>
  );
};

const GoodReceivingPage = () => {
  const { state } = useGlobalState();
  const issuedPOs = state.po?.issued || [];
  const [activeTab, setActiveTab] = useState<TabType>('po-requests');

  const tabs: { id: TabType; label: string; badge?: number }[] = [
    { id: 'po-requests', label: 'PO Requests' },
    { id: 'issued-pos', label: 'Issued P.O.s', badge: issuedPOs.length },
    { id: 'ongoing-grns', label: "Ongoing GRN's" },
    { id: 'mrn-fgs', label: "MRN/FG's" },
    { id: 'print-labels', label: 'Print Labels' },
    { id: 'grn', label: 'GRN' },
    { id: 'proofing', label: 'Proofing' },
  ];

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Good Receiving</h1>
            <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
              <Link to="/" className="text-slate-800 hover:text-amber-800 hover:underline">Dashboard</Link>
              <span className="text-gray-400">/</span>
              <Link to="/order-management" className="text-slate-800 hover:text-amber-800 hover:underline">Order Management</Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">Good Receiving</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex border-b border-gray-200 min-w-max md:min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 md:px-5 py-4 font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm ${activeTab === tab.id
                  ? 'bg-slate-800 text-white border-b-2 border-amber-600'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-amber-400 text-slate-900' : 'bg-blue-100 text-blue-700'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {activeTab === 'po-requests' && <PORequests />}
          {activeTab === 'issued-pos' && <IssuedPOsView />}
          {activeTab === 'ongoing-grns' && <OngoingGRNs />}
          {activeTab === 'mrn-fgs' && <MRNFGs />}
          {activeTab === 'print-labels' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Labels</h3>
              <p className="text-gray-500">Generate and print product labels</p>
            </div>
          )}
          {activeTab === 'grn' && <GRNList />}
          {activeTab === 'proofing' && <Proofing />}
        </div>
      </div>
    </div>
  );
};

export default GoodReceivingPage;
