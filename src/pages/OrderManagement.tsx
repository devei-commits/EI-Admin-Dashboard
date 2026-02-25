import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';

const CPO_STATUS_MAP: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    checkout_pending: { label: 'Checkout Pending', color: 'bg-blue-100 text-blue-700' },
    customer_approval_pending: { label: 'Awaiting Customer Approval', color: 'bg-yellow-100 text-yellow-700' },
    payment_pending: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700' },
    advance_paid: { label: 'Advance Paid', color: 'bg-green-100 text-green-700' },
    so_created: { label: 'SO Created', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

let cpoSeqCounter = 1200; // Start after existing seed data (CPO-1196 was last)

const OrderManagement: React.FC = () => {
    const { state, dispatch } = useGlobalState();
    const [showNewCPO, setShowNewCPO] = useState(false);
    const [selectedCPOId, setSelectedCPOId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // ─── New CPO form state ────────────────────────────────────────────────────
    const [newCPO, setNewCPO] = useState({
        clientId: '',
        source: 'customer',
        bdRep: '',
        product: '',
        sku: '',
        qty: '',
        unitPrice: '',
        termsId: '',
        notes: '',
    });

    const clientOptions = state.masters?.clients || [];
    const termOptions = state.masters?.paymentTerms || [];

    const orderValue = useMemo(() => {
        const qty = Number(newCPO.qty) || 0;
        const price = Number(newCPO.unitPrice) || 0;
        return qty * price;
    }, [newCPO.qty, newCPO.unitPrice]);

    const selectedTerms = useMemo(
        () => termOptions.find((t: any) => t.id === newCPO.termsId),
        [newCPO.termsId, termOptions]
    );

    const advanceAmt = useMemo(
        () => selectedTerms ? Math.round(orderValue * (selectedTerms.advancePct || 0) / 100) : 0,
        [orderValue, selectedTerms]
    );

    const handleSaveNewCPO = () => {
        if (!newCPO.product || !newCPO.qty || !newCPO.unitPrice) {
            alert('Fill product, qty, and unit price.');
            return;
        }
        if (newCPO.source === 'bd_team' && !newCPO.bdRep) {
            alert('Enter BD representative name.');
            return;
        }

        const seq = ++cpoSeqCounter;
        const poNo = `CPO-${seq}`;
        const now = new Date();
        const isoNow = now.toISOString().slice(0, 10);
        const terms = termOptions.find((t: any) => t.id === newCPO.termsId);
        const advPct = terms?.advancePct || 0;
        const value = orderValue;
        const adv = Math.round(value * advPct / 100);

        let status = newCPO.source === 'bd_team'
            ? 'draft'
            : advPct > 0 ? 'payment_pending' : 'checkout_pending';

        const timeline = newCPO.source === 'bd_team'
            ? [
                { stage: 'BD Draft Created', date: isoNow, done: true },
                { stage: 'Sent to Customer', date: null, done: false },
                { stage: 'Customer Approval', date: null, done: false },
                ...(advPct > 0 ? [
                    { stage: 'Advance Requested', date: null, done: false },
                    { stage: 'Advance Paid', date: null, done: false },
                ] : []),
                { stage: 'SO Created', date: null, done: false },
                { stage: 'Balance Payment', date: null, done: false },
                { stage: 'Dispatched', date: null, done: false },
            ]
            : [
                { stage: 'PO Received', date: isoNow, done: true },
                { stage: 'Finance Review', date: null, done: false },
                ...(advPct > 0 ? [
                    { stage: 'Advance Requested', date: null, done: false },
                    { stage: 'Advance Paid', date: null, done: false },
                ] : []),
                { stage: 'SO Created', date: null, done: false },
                { stage: 'Balance Payment', date: null, done: false },
                { stage: 'Dispatched', date: null, done: false },
            ];

        const payments = advPct > 0
            ? [{
                type: 'advance', pct: advPct, amt: adv,
                due: new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10),
                paid: false, paidOn: null, ref: null,
            }]
            : [];

        const client = clientOptions.find((c: any) => c.id === newCPO.clientId);
        dispatch({
            type: 'ADD_CUSTOMER_PO',
            payload: {
                po: poNo, poSeq: seq,
                clientId: newCPO.clientId,
                client: client?.name || newCPO.clientId,
                source: newCPO.source,
                bdRep: newCPO.source === 'bd_team' ? newCPO.bdRep : null,
                createdAt: isoNow,
                receivedAt: newCPO.source === 'customer' ? isoNow : null,
                value, termsId: newCPO.termsId, advancePct: advPct, advanceAmt: adv,
                status, soRef: null, payments,
                products: [{
                    product: newCPO.product, sku: newCPO.sku,
                    qty: Number(newCPO.qty), unitPrice: Number(newCPO.unitPrice), lineValue: value,
                }],
                notes: newCPO.notes, timeline,
            },
        });

        setNewCPO({ clientId: '', source: 'customer', bdRep: '', product: '', sku: '', qty: '', unitPrice: '', termsId: '', notes: '' });
        setShowNewCPO(false);
    };

    // ─── CPO status transitions ────────────────────────────────────────────────
    const markFinanceReviewed = (cpo: any) => {
        const today = new Date().toISOString().slice(0, 10);
        const newStatus = cpo.advancePct > 0 ? 'payment_pending' : 'checkout_pending';
        dispatch({
            type: 'UPDATE_CUSTOMER_PO',
            payload: {
                poId: cpo.po,
                updatedFields: {
                    status: newStatus,
                    timeline: (cpo.timeline || []).map((t: any) =>
                        t.stage === 'Finance Review' ? { ...t, date: today, done: true } : t
                    ),
                },
            },
        });
        // No local state update needed — selectedCPO derives live from global state
    };

    const markAdvancePaid = (cpo: any) => {
        const today = new Date().toISOString().slice(0, 10);
        dispatch({
            type: 'UPDATE_CUSTOMER_PO',
            payload: {
                poId: cpo.po,
                updatedFields: {
                    status: 'advance_paid',
                    payments: (cpo.payments || []).map((p: any) =>
                        p.type === 'advance' ? { ...p, paid: true, paidOn: today, ref: 'UTR-' + Math.floor(Math.random() * 900000 + 100000) } : p
                    ),
                    timeline: (cpo.timeline || []).map((t: any) =>
                        t.stage === 'Advance Paid' ? { ...t, date: today, done: true } : t
                    ),
                },
            },
        });
        // No local state update needed — selectedCPO derives live from global state
    };

    const createSalesOrder = (cpo: any) => {
        const today = new Date().toISOString().slice(0, 10);
        const soSeq = 3100 + state.orders.salesOrders.length;
        const soNo = `SO-0${soSeq}`;
        const soData = {
            so: soNo,
            client: cpo.clientId,
            clientName: cpo.client,
            poRef: cpo.po,
            units: cpo.products?.[0]?.qty || 0,
            due: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
            createdAt: today,
            internalStatus: 'Pending',
            customerStatus: 'Confirmed',
            planning: 0,
            splitBatches: 0,
            notes: cpo.notes || '',
            timeline: [
                { stage: 'PO Received', date: today, done: true },
                { stage: 'SO Created', date: today, done: true },
                { stage: 'Approved', date: null, done: false },
                { stage: 'Batch Created', date: null, done: false },
                { stage: 'BMR Active', date: null, done: false },
                { stage: 'BPR / Packaging', date: null, done: false },
                { stage: 'QC Clearance', date: null, done: false },
                { stage: 'Dispatched', date: null, done: false },
                { stage: 'Delivered', date: null, done: false },
            ],
        };
        const product = cpo.products?.[0];
        const opId = `OP-${Date.now()}`;
        const orderedProduct = {
            id: opId,
            so: soNo,
            client: cpo.client,
            product: product?.product || '',
            sku: product?.sku || '',
            qty: product?.qty || 0,
            orderDate: today,
            deliveryDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
            stage: 'Review',
        };
        dispatch({ type: 'CREATE_SO_FROM_CPO', payload: { cpoId: cpo.po, soData, orderedProduct } });
        // No local state update needed — selectedCPO derives live from global state
    };

    // ─── Filtered CPOs ─────────────────────────────────────────────────────────
    const cpos: any[] = state.orders?.customerPOs || [];

    // Always derive the live CPO from global state — never use a stale snapshot
    const selectedCPO = useMemo(
        () => cpos.find((c) => c.po === selectedCPOId) || null,
        [cpos, selectedCPOId]
    );

    const filteredCPOs = useMemo(() => {
        if (!searchTerm) return cpos;
        const t = searchTerm.toLowerCase();
        return cpos.filter((c) =>
            c.po?.toLowerCase().includes(t) ||
            c.client?.toLowerCase().includes(t) ||
            c.products?.[0]?.product?.toLowerCase().includes(t)
        );
    }, [cpos, searchTerm]);

    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Customer Purchase Orders</h1>
                        <div className="flex items-center gap-2 mt-2 text-sm bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 rounded-lg">
                            <Link to="/" className="text-blue-600 hover:underline">Dashboard</Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Order Management</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/order-hub"
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                        >
                            Order Hub →
                        </Link>
                        <button
                            onClick={() => setShowNewCPO(true)}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                        >
                            + New PO
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total CPOs', value: cpos.length, color: 'bg-blue-50 border-blue-100 text-blue-700' },
                    { label: 'Payment Pending', value: cpos.filter((c: any) => c.status === 'payment_pending').length, color: 'bg-orange-50 border-orange-100 text-orange-700' },
                    { label: 'Advance Paid', value: cpos.filter((c: any) => c.status === 'advance_paid').length, color: 'bg-green-50 border-green-100 text-green-700' },
                    { label: 'SO Created', value: cpos.filter((c: any) => c.status === 'so_created').length, color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                ].map((kpi) => (
                    <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
                        <p className="text-xs font-medium opacity-75">{kpi.label}</p>
                        <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by PO, client, product…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <span className="text-sm text-gray-500">{filteredCPOs.length} orders</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                {['PO No.', 'Client', 'Source', 'Product', 'Value', 'Status', 'SO Ref', 'Created', 'Action'].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCPOs.map((cpo: any) => {
                                const statusInfo = CPO_STATUS_MAP[cpo.status] || { label: cpo.status, color: 'bg-gray-100 text-gray-700' };
                                return (
                                    <tr key={cpo.po} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCPOId(cpo.po)}>
                                        <td className="px-4 py-3 font-mono font-bold text-gray-800">{cpo.po}</td>
                                        <td className="px-4 py-3 text-gray-700">{cpo.client}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cpo.source === 'bd_team' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {cpo.source === 'bd_team' ? `BD – ${cpo.bdRep || ''}` : 'Customer'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{cpo.products?.[0]?.product || '—'}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-800">{fmt(cpo.value || 0)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600">{cpo.soRef || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{typeof cpo.createdAt === 'string' ? cpo.createdAt : new Date(cpo.createdAt).toISOString().slice(0, 10)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedCPOId(cpo.po); }}
                                                className="text-xs text-blue-600 hover:underline font-medium"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredCPOs.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-gray-400">
                                        No orders found. Create one with "+ New PO".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══ NEW CPO MODAL ══════════════════════════════════════════════════════ */}
            {showNewCPO && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-start justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">New Customer PO</h2>
                                <p className="text-sm text-gray-500 mt-0.5">Create direct or BD-assisted order</p>
                            </div>
                            <button onClick={() => setShowNewCPO(false)} className="p-1 text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
                                    <select value={newCPO.clientId} onChange={(e) => setNewCPO({ ...newCPO, clientId: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                        <option value="">Select client…</option>
                                        {clientOptions.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
                                    <select value={newCPO.source} onChange={(e) => setNewCPO({ ...newCPO, source: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                        <option value="customer">Customer sent PO</option>
                                        <option value="bd_team">BD Team created</option>
                                    </select>
                                </div>
                            </div>

                            {newCPO.source === 'bd_team' && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">BD Representative</label>
                                    <input value={newCPO.bdRep} onChange={(e) => setNewCPO({ ...newCPO, bdRep: e.target.value })}
                                        placeholder="Name of BD rep" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Product</label>
                                    <input value={newCPO.product} onChange={(e) => setNewCPO({ ...newCPO, product: e.target.value })}
                                        placeholder="e.g. Anti-Acne Facewash" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">SKU</label>
                                    <input value={newCPO.sku} onChange={(e) => setNewCPO({ ...newCPO, sku: e.target.value })}
                                        placeholder="e.g. 100g Tube" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity (units)</label>
                                    <input type="number" min="1" value={newCPO.qty} onChange={(e) => setNewCPO({ ...newCPO, qty: e.target.value })}
                                        placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Price (₹)</label>
                                    <input type="number" min="0" value={newCPO.unitPrice} onChange={(e) => setNewCPO({ ...newCPO, unitPrice: e.target.value })}
                                        placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms</label>
                                    <select value={newCPO.termsId} onChange={(e) => setNewCPO({ ...newCPO, termsId: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                                        <option value="">Select terms…</option>
                                        {termOptions.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Order Value</p>
                                    <p className="text-lg font-bold text-gray-800">{fmt(orderValue)}</p>
                                    {advanceAmt > 0 && <p className="text-xs text-orange-600">{selectedTerms?.advancePct}% advance = {fmt(advanceAmt)}</p>}
                                    {advanceAmt === 0 && newCPO.termsId && <p className="text-xs text-green-600">No advance required</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                                <textarea value={newCPO.notes} onChange={(e) => setNewCPO({ ...newCPO, notes: e.target.value })}
                                    rows={2} placeholder="Optional notes…"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setShowNewCPO(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                            <button onClick={handleSaveNewCPO} className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition">Create PO</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CPO DETAIL MODAL ══════════════════════════════════════════════════ */}
            {selectedCPO && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
                        <div className="flex items-start justify-between p-6 border-b sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">{selectedCPO.po}</h2>
                                <p className="text-sm text-gray-500 mt-0.5">{selectedCPO.client} · {selectedCPO.products?.[0]?.product}</p>
                            </div>
                            <button onClick={() => setSelectedCPOId(null)} className="p-1 text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Status badge */}
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const info = CPO_STATUS_MAP[selectedCPO.status] || { label: selectedCPO.status, color: 'bg-gray-100 text-gray-700' };
                                    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${info.color}`}>{info.label}</span>;
                                })()}
                                {selectedCPO.soRef && (
                                    <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-700 font-semibold">SO: {selectedCPO.soRef}</span>
                                )}
                            </div>

                            {/* Products */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs font-semibold text-gray-500 mb-2">PRODUCTS</p>
                                {(selectedCPO.products || []).map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-800 font-medium">{p.product} · {p.sku}</span>
                                        <span className="text-gray-600">{p.qty?.toLocaleString()} units @ ₹{p.unitPrice} = <strong>{fmt(p.lineValue)}</strong></span>
                                    </div>
                                ))}
                            </div>

                            {/* Timeline */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 mb-3">TIMELINE</p>
                                <div className="space-y-2">
                                    {(selectedCPO.timeline || []).map((t: any, i: number) => (
                                        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${t.done ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-500'}`}>
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${t.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                {t.done ? '✓' : i + 1}
                                            </span>
                                            <span className="font-medium flex-1">{t.stage}</span>
                                            {t.date && <span className="text-xs opacity-75">{typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().slice(0, 10)}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedCPO.notes && (
                                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800">
                                    <strong>Note:</strong> {selectedCPO.notes}
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="p-6 pt-0 space-y-2">
                            {(selectedCPO.status === 'checkout_pending' || selectedCPO.status === 'payment_pending') && selectedCPO.status !== 'so_created' && (
                                <>
                                    {!selectedCPO.timeline?.find((t: any) => t.stage === 'Finance Review')?.done && (
                                        <button onClick={() => markFinanceReviewed(selectedCPO)}
                                            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition">
                                            ✓ Mark Finance Reviewed
                                        </button>
                                    )}
                                </>
                            )}
                            {selectedCPO.status === 'payment_pending' && (
                                <button onClick={() => markAdvancePaid(selectedCPO)}
                                    className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition">
                                    ✓ Mark Advance Paid
                                </button>
                            )}
                            {(selectedCPO.status === 'advance_paid' || (selectedCPO.status === 'checkout_pending' && selectedCPO.advancePct === 0)) && !selectedCPO.soRef && (
                                <button onClick={() => createSalesOrder(selectedCPO)}
                                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition">
                                    🏭 Create Sales Order
                                </button>
                            )}
                            <button onClick={() => setSelectedCPOId(null)}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderManagement;
