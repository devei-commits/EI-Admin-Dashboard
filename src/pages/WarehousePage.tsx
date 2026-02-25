import React, { useState } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';

// ─── Warehouse Page ─────────────────────────────────────────────────────────
const WarehousePage: React.FC = () => {
    const { state } = useGlobalState();
    const items: any[] = state.items || [];

    const [activeTab, setActiveTab] = useState<'stock' | 'mtr'>('stock');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'RM' | 'PM'>('ALL');
    const [mtrs, setMtrs] = useState<any[]>([]);
    const [showMTRModal, setShowMTRModal] = useState(false);
    const [mtrForm, setMtrForm] = useState({ itemId: '', from: '', to: '', qty: '', reason: '' });

    // Derived: all unique warehouse names
    const allWarehouses = Array.from(
        new Set(items.flatMap(i => (i.warehouses || []).map((w: any) => w.name)))
    );

    // Filter items
    const filteredItems = items.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.id.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'ALL' || item.type === typeFilter;
        return matchSearch && matchType;
    });

    // Per-warehouse totals
    const warehouseTotals = allWarehouses.map(wh => ({
        name: wh,
        total: items.reduce((sum, item) => {
            const w = (item.warehouses || []).find((w: any) => w.name === wh);
            return sum + (w?.qty || 0);
        }, 0),
        itemCount: items.filter(item => (item.warehouses || []).some((w: any) => w.name === wh)).length,
    }));

    const handleCreateMTR = () => {
        if (!mtrForm.itemId || !mtrForm.from || !mtrForm.to || !mtrForm.qty) {
            alert('Please fill all required fields.');
            return;
        }
        const item = items.find(i => i.id === mtrForm.itemId);
        setMtrs(prev => [...prev, {
            id: `MTR-${String(Date.now()).slice(-5)}`,
            itemId: mtrForm.itemId,
            itemName: item?.name || mtrForm.itemId,
            from: mtrForm.from,
            to: mtrForm.to,
            qty: Number(mtrForm.qty),
            reason: mtrForm.reason,
            status: 'Pending',
            createdAt: new Date().toISOString().slice(0, 10),
        }]);
        setShowMTRModal(false);
        setMtrForm({ itemId: '', from: '', to: '', qty: '', reason: '' });
    };

    const approveMTR = (mtrId: string) => {
        setMtrs(prev => prev.map(m => m.id === mtrId ? { ...m, status: 'Approved' } : m));
    };

    const stockStatusColor = (item: any) => {
        const available = (item.stock || 0) - (item.reserved || 0);
        if (available <= 0) return 'text-red-600 bg-red-50';
        if (available < (item.reserved || 0) * 0.3) return 'text-amber-600 bg-amber-50';
        return 'text-emerald-600 bg-emerald-50';
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Warehouse</h1>
                    <p className="text-sm text-gray-500 mt-1">Stock by location, transfers, and space management</p>
                </div>
                <button onClick={() => setShowMTRModal(true)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition">
                    + New Transfer Request
                </button>
            </div>

            {/* Warehouse summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {warehouseTotals.map(wh => (
                    <div key={wh.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{wh.name}</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{wh.total.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{wh.itemCount} SKU{wh.itemCount !== 1 ? 's' : ''}</p>
                    </div>
                ))}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total SKUs</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{items.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">across {allWarehouses.length} locations</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
                {(['stock', 'mtr'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'text-gray-500 hover:text-gray-800'
                            }`}>
                        {tab === 'stock' ? '📦 Stock by Location' : `🔄 Transfers (MTR) ${mtrs.length > 0 ? `· ${mtrs.length}` : ''}`}
                    </button>
                ))}
            </div>

            {/* Stock View */}
            {activeTab === 'stock' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Filters */}
                    <div className="flex items-center gap-3 p-4 border-b border-gray-100 flex-wrap">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search item name or ID..."
                            className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
                        <div className="flex gap-1">
                            {(['ALL', 'RM', 'PM'] as const).map(t => (
                                <button key={t} onClick={() => setTypeFilter(t)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${typeFilter === t
                                        ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-gray-400">{filteredItems.length} items</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
                                    <th className="px-5 py-3 text-left font-semibold">Item</th>
                                    <th className="px-4 py-3 text-center font-semibold">Type</th>
                                    <th className="px-4 py-3 text-right font-semibold">Total Stock</th>
                                    <th className="px-4 py-3 text-right font-semibold">Reserved</th>
                                    <th className="px-4 py-3 text-right font-semibold">Available</th>
                                    <th className="px-4 py-3 text-right font-semibold">In Transit</th>
                                    {allWarehouses.map(wh => (
                                        <th key={wh} className="px-4 py-3 text-right font-semibold whitespace-nowrap">{wh}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredItems.map(item => {
                                    const available = (item.stock || 0) - (item.reserved || 0);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition">
                                            <td className="px-5 py-3.5">
                                                <p className="font-medium text-gray-800">{item.name}</p>
                                                <p className="text-xs text-gray-400">{item.id} · {item.uom}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${item.type === 'RM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                    }`}>{item.type}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-700">
                                                {(item.stock || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-amber-700">
                                                {(item.reserved || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${stockStatusColor(item)}`}>
                                                    {available.toLocaleString('en-IN')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-600">
                                                {(item.inTransit || 0).toLocaleString('en-IN')}
                                            </td>
                                            {allWarehouses.map(wh => {
                                                const w = (item.warehouses || []).find((w: any) => w.name === wh);
                                                return (
                                                    <td key={wh} className="px-4 py-3 text-right text-gray-600">
                                                        {w ? w.qty.toLocaleString('en-IN') : <span className="text-gray-300">—</span>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredItems.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">No items match your filters.</div>
                        )}
                    </div>
                </div>
            )}

            {/* MTR View */}
            {activeTab === 'mtr' && (
                <div className="space-y-4">
                    {mtrs.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <p className="font-semibold text-gray-600">No transfer requests yet</p>
                            <p className="text-sm text-gray-400 mt-1 mb-4">Move stock between warehouses using Material Transfer Requests</p>
                            <button onClick={() => setShowMTRModal(true)}
                                className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition">
                                + Create First MTR
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
                                        <th className="px-5 py-3 text-left font-semibold">MTR ID</th>
                                        <th className="px-4 py-3 text-left font-semibold">Item</th>
                                        <th className="px-4 py-3 text-left font-semibold">From → To</th>
                                        <th className="px-4 py-3 text-right font-semibold">Qty</th>
                                        <th className="px-4 py-3 text-left font-semibold">Reason</th>
                                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                                        <th className="px-4 py-3 text-center font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {mtrs.map(mtr => (
                                        <tr key={mtr.id} className="hover:bg-gray-50/50">
                                            <td className="px-5 py-3 font-mono text-gray-700 font-medium">{mtr.id}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-gray-800 font-medium">{mtr.itemName}</p>
                                                <p className="text-xs text-gray-400">{mtr.itemId}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                <span className="text-gray-700 font-medium">{mtr.from}</span>
                                                <span className="text-gray-400 mx-1">→</span>
                                                <span className="text-gray-700 font-medium">{mtr.to}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-700">{mtr.qty.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{mtr.reason || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${mtr.status === 'Approved' ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>{mtr.status}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {mtr.status === 'Pending' && (
                                                    <button onClick={() => approveMTR(mtr.id)}
                                                        className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition">
                                                        Approve
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Create MTR Modal */}
            {showMTRModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-gray-800">New Material Transfer Request</h2>
                            <button onClick={() => setShowMTRModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                                <select value={mtrForm.itemId} onChange={e => setMtrForm(f => ({ ...f, itemId: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                    <option value="">Select item...</option>
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>{item.name} ({item.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
                                    <select value={mtrForm.from} onChange={e => setMtrForm(f => ({ ...f, from: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                        <option value="">Select...</option>
                                        {allWarehouses.map(wh => <option key={wh}>{wh}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                                    <select value={mtrForm.to} onChange={e => setMtrForm(f => ({ ...f, to: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                        <option value="">Select...</option>
                                        {allWarehouses.map(wh => <option key={wh}>{wh}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                                <input type="number" value={mtrForm.qty} onChange={e => setMtrForm(f => ({ ...f, qty: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    placeholder="e.g. 50" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                <textarea value={mtrForm.reason} onChange={e => setMtrForm(f => ({ ...f, reason: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    rows={2} placeholder="e.g. Space shortage in WH-1..." />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowMTRModal(false)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                                <button onClick={handleCreateMTR}
                                    className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition">Create MTR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehousePage;
