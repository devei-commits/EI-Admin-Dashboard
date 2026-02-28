import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';

const SalesOrders: React.FC = () => {
    const { state } = useGlobalState();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSO, setSelectedSO] = useState<any>(null);

    const salesOrders: any[] = state.orders?.salesOrders || [];

    const filteredSOs = useMemo(() => {
        if (!searchTerm) return salesOrders;
        
        const t = searchTerm.toLowerCase();
        return salesOrders.filter((so) =>
            so.so?.toLowerCase().includes(t) ||
            so.clientName?.toLowerCase().includes(t) ||
            so.poRef?.toLowerCase().includes(t)
        );
    }, [salesOrders, searchTerm]);

    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

    const getStatusColor = (status: string) => {
        const statusMap: Record<string, string> = {
            'Pending': 'bg-blue-100 text-blue-700',
            'Approved': 'bg-green-100 text-green-700',
            'Batch created': 'bg-purple-100 text-purple-700',
            'BMR active': 'bg-indigo-100 text-indigo-700',
            'In production': 'bg-yellow-100 text-yellow-700',
            'QC pending': 'bg-orange-100 text-orange-700',
            'Ready to dispatch': 'bg-teal-100 text-teal-700',
            'Dispatched': 'bg-emerald-100 text-emerald-700',
            'Delivered': 'bg-green-100 text-green-700',
        };
        return statusMap[status] || 'bg-gray-100 text-gray-700';
    };

    const getTimelineWithDefaults = (so: any) => {
        if (so.timeline && so.timeline.length > 0) {
            return so.timeline;
        }
        
        // Return default timeline if not populated
        const today = new Date().toISOString().slice(0, 10);
        return [
            { stage: 'PO Received', date: today, done: true },
            { stage: 'SO Created', date: today, done: true },
            { stage: 'Approved', date: null, done: false },
            { stage: 'Batch Created', date: null, done: false },
            { stage: 'BMR Active', date: null, done: false },
            { stage: 'BPR / Packaging', date: null, done: false },
            { stage: 'QC Clearance', date: null, done: false },
            { stage: 'Dispatched', date: null, done: false },
            { stage: 'Delivered', date: null, done: false },
        ];
    };

    return (
        <div>
            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by SO, client, PO reference…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <span className="text-sm text-gray-500">{filteredSOs.length} orders</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                {['Date', 'Sales Order#', 'Customer Name', 'Batches', 'Total Qty', 'Progress', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSOs.map((so: any) => (
                                <tr key={so.so} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSO(so)}>
                                    <td className="px-4 py-3 text-gray-700">{so.createdAt}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-mono font-bold text-gray-800">{so.so}</p>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{so.clientName}</td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {so.splitBatches > 0 ? `${so.splitBatches} batches` : 'No batches'}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(so.units)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${so.planning}%` }}></div>
                                            </div>
                                            <span className="text-xs font-medium text-gray-600 min-w-fit">{so.planning}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(so.internalStatus)}`}>
                                            {so.internalStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedSO(so); }}
                                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                        >
                                            Open
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredSOs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400">
                                        No sales orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SO Detail Modal */}
            {selectedSO && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between p-6 border-b sticky top-0 bg-white">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-lg font-bold text-gray-800">{selectedSO.so}</h2>
                                    <span className="text-sm text-blue-600">{selectedSO.clientName}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    PO Ref: <span className="font-mono font-semibold">{selectedSO.poRef}</span> • 
                                    <span className="ml-2">{fmt(selectedSO.units)} units</span> • 
                                    Due: <span className="font-semibold">{selectedSO.due}</span>
                                    <span className="ml-2 text-orange-600 font-bold">Due Today</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => navigate('/ordered-products', { state: { soRef: selectedSO.so } })}
                                    className="px-3 py-2 text-sm font-medium text-cyan-600 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition"
                                >
                                    Go to Orders →
                                </button>
                                <button onClick={() => setSelectedSO(null)} className="p-2 text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                        </div>

                        {/* Content - Two Column Layout with Fixed Timeline */}
                        <div className="p-6 flex gap-6">
                            {/* Left Column - Main Content (Scrollable) */}
                            <div className="flex-1 space-y-6">
                                {/* Status Badges */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <p className="text-xs font-bold text-gray-600 uppercase">Customer Status</p>
                                        <p className="text-sm font-bold text-yellow-700 mt-2">● {selectedSO.customerStatus}</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <p className="text-xs font-bold text-gray-600 uppercase">Internal Status</p>
                                        <p className="text-sm font-bold text-green-700 mt-2">● {selectedSO.internalStatus}</p>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <p className="text-xs font-bold text-gray-600 uppercase">Planning</p>
                                        <p className="text-sm font-bold text-blue-700 mt-2">{selectedSO.planning}%</p>
                                    </div>
                                </div>

                                {/* Ordered Products */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Ordered Products</h3>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Product</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Qty</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Stage</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Batches</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-t border-gray-100">
                                                    <td className="px-4 py-3 text-gray-700">
                                                        <p className="font-medium">Anti-Acne Facewash 100g</p>
                                                        <p className="text-xs text-gray-500">100g Tube</p>
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(selectedSO.units)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">Batch setup</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-3 py-1 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">0</span>
                                                        <button className="ml-2 px-3 py-1 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition">
                                                            Create Batches
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* BMR Records */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">BMR Records</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <p className="text-sm text-gray-600">No BMRs yet — create batches first.</p>
                                    </div>
                                </div>

                                {/* Notes */}
                                {selectedSO.notes && (
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800 mb-3">Notes</h3>
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <p className="text-sm text-gray-700">{selectedSO.notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Timeline (Sticky) */}
                            <div className="w-80 shrink-0 sticky top-24">
                                <h3 className="text-sm font-bold text-gray-800 mb-4">Order Timeline</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                    {getTimelineWithDefaults(selectedSO).map((stage: any, idx: number) => {
                                        const timeline = getTimelineWithDefaults(selectedSO);
                                        return (
                                            <div key={idx} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    {stage.done ? (
                                                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs shrink-0">✓</div>
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-full border-2 shrink-0 ${
                                                            stage.stage === 'BMR Active' 
                                                                ? 'border-orange-400 bg-orange-50' 
                                                                : 'border-gray-300 bg-white'
                                                        } flex items-center justify-center`}>
                                                            {stage.stage === 'BMR Active' && <div className="w-2 h-2 bg-orange-400 rounded-full"></div>}
                                                        </div>
                                                    )}
                                                    {idx < timeline.length - 1 && (
                                                        <div className={`w-0.5 h-16 mt-1 ${stage.done ? 'bg-green-300' : 'bg-gray-300'}`}></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 pt-0.5 min-w-0">
                                                    <p className={`text-sm font-semibold ${
                                                        stage.done ? 'text-gray-800' : 
                                                        stage.stage === 'BMR Active' ? 'text-orange-700' :
                                                        'text-gray-500'
                                                    }`}>
                                                        {stage.stage}
                                                    </p>
                                                    {stage.date && (
                                                        <p className="text-xs text-gray-500">{stage.date}</p>
                                                    )}
                                                    {!stage.done && !stage.date && (
                                                        <p className="text-xs text-gray-400">Pending</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
                            <button
                                onClick={() => setSelectedSO(null)}
                                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
