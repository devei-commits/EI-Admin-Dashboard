import React, { useState } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';

const PurchaseOrders: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'planned' | 'draft' | 'issued' | 'treasury' | 'grn'>('planned');
    const { state } = useGlobalState();

    const planned = state.po?.planned || [];

    const fmt = (n: number | undefined) => {
        if (!n) return '0';
        return Math.round(n).toLocaleString();
    };

    const tabs = [
        { id: 'planned', label: 'PO Planned', count: planned.length },
        { id: 'draft', label: 'Draft POs', count: 0 },
        { id: 'treasury', label: 'Treasury', count: 0 },
        { id: 'issued', label: 'Issued POs', count: 0 },
        { id: 'grn', label: 'GRN & Labels', count: 0 },
    ];

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders Module</h1>
                <p className="text-sm text-gray-600 mt-1">End-to-end PO flow with sub dashboards</p>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 px-4 py-4 font-semibold text-sm transition-all border-b-2 text-center ${
                                activeTab === tab.id
                                    ? 'text-blue-600 border-blue-600 bg-blue-50'
                                    : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="p-8 bg-white min-h-96">
                    {activeTab === 'planned' && (
                        <div>
                            {planned.length === 0 ? (
                                <div>
                                    <h2 className="text-gray-900 font-semibold mb-3">No PO planned lines</h2>
                                    <p className="text-gray-600 text-sm">
                                        <a href="/material-planning" className="text-blue-600 hover:text-blue-700 font-medium">
                                            Go to Procurement → Release to Planned
                                        </a>
                                        {' '}to create transition lines.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h2 className="text-gray-900 font-semibold mb-4">Planned PO Lines</h2>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Item</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Vendor</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Quantity</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Unit Price</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Est. Value</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Lead Days</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {planned.map((line: any) => (
                                                    <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="font-semibold text-gray-900">{line.itemName}</p>
                                                                <p className="text-xs text-gray-500">{line.itemId}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700">{line.vendor}</td>
                                                        <td className="px-4 py-3 font-semibold text-gray-800">{fmt(line.qty)}</td>
                                                        <td className="px-4 py-3 text-gray-700">₹{fmt(line.unit)}</td>
                                                        <td className="px-4 py-3 font-semibold text-gray-800">₹{fmt(line.qty * line.unit)}</td>
                                                        <td className="px-4 py-3 text-gray-700">{line.leadDays || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                                                                {line.status || 'Planned'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button className="text-blue-600 hover:text-blue-700 font-semibold text-xs">
                                                                Draft
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'draft' && (
                        <div>
                            <h2 className="text-gray-900 font-semibold mb-3">Draft POs</h2>
                            <p className="text-gray-600 text-sm">No draft POs yet.</p>
                        </div>
                    )}

                    {activeTab === 'issued' && (
                        <div>
                            <h2 className="text-gray-900 font-semibold mb-3">Issued POs</h2>
                            <p className="text-gray-600 text-sm">No issued POs yet.</p>
                        </div>
                    )}

                    {activeTab === 'treasury' && (
                        <div>
                            <h2 className="text-gray-900 font-semibold mb-3">Treasury</h2>
                            <p className="text-gray-600 text-sm">Treasury data will appear here.</p>
                        </div>
                    )}

                    {activeTab === 'grn' && (
                        <div>
                            <h2 className="text-gray-900 font-semibold mb-3">GRN & Labels</h2>
                            <p className="text-gray-600 text-sm">GRN and label data will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrders;
