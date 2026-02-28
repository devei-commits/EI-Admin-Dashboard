import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';
import CpoDetailModal from '../components/orders/CpoDetailModal';
import SalesOrders from '../components/orders/SalesOrders';

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
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState<'customer-pos' | 'sales-orders'>('customer-pos');
    const [showNewCPO, setShowNewCPO] = useState(false);
    const [selectedCPOId, setSelectedCPOId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

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

        const status = newCPO.source === 'bd_team'
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
    };

    const markCustomerApproval = (cpo: any) => {
        const today = new Date().toISOString().slice(0, 10);
        dispatch({
            type: 'UPDATE_CUSTOMER_PO',
            payload: {
                poId: cpo.po,
                updatedFields: {
                    status: cpo.advancePct > 0 ? 'payment_pending' : 'checkout_pending',
                    timeline: (cpo.timeline || []).map((t: any) =>
                        t.stage === 'Customer Approval' ? { ...t, date: today, done: true } : t
                    ),
                },
            },
        });
    };

    const sendToCust= (cpo: any) => {
        const today = new Date().toISOString().slice(0, 10);
        dispatch({
            type: 'UPDATE_CUSTOMER_PO',
            payload: {
                poId: cpo.po,
                updatedFields: {
                    status: 'customer_approval_pending',
                    timeline: (cpo.timeline || []).map((t: any) =>
                        t.stage === 'Sent to Customer' ? { ...t, date: today, done: true } : t
                    ),
                },
            },
        });
    };

    // ─── Filtered CPOs ─────────────────────────────────────────────────────────
    const cpos: any[] = state.orders?.customerPOs || [];

    // Always derive the live CPO from global state — never use a stale snapshot
    const selectedCPO = useMemo(
        () => cpos.find((c) => c.po === selectedCPOId) || null,
        [cpos, selectedCPOId]
    );

    const filteredCPOs = useMemo(() => {
        let filtered = cpos;
        
        // Apply status filter if any
        if (statusFilter) {
            filtered = filtered.filter((c) => c.status === statusFilter);
        }
        
        // Apply search filter
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            filtered = filtered.filter((c) =>
                c.po?.toLowerCase().includes(t) ||
                c.client?.toLowerCase().includes(t) ||
                c.products?.[0]?.product?.toLowerCase().includes(t)
            );
        }
        
        return filtered;
    }, [cpos, searchTerm, statusFilter]);

    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    // Calculate status-based KPIs with totals
    const kpiData = useMemo(() => {
        const byStatus = (status: string) => cpos.filter((c: any) => c.status === status);
        const sumByStatus = (status: string) => byStatus(status).reduce((sum, c) => sum + (c.value || 0), 0);

        return [
            { label: 'Draft', status: 'draft', count: byStatus('draft').length, value: sumByStatus('draft'), color: 'bg-slate-900 text-white' },
            { label: 'Awaiting Approval', status: 'customer_approval_pending', count: byStatus('customer_approval_pending').length, value: sumByStatus('customer_approval_pending'), color: 'bg-slate-800 text-white' },
            { label: 'Payment Pending', status: 'payment_pending', count: byStatus('payment_pending').length, value: sumByStatus('payment_pending'), color: 'bg-slate-800 text-white' },
            { label: 'Advance Paid', status: 'advance_paid', count: byStatus('advance_paid').length, value: sumByStatus('advance_paid'), color: 'bg-slate-800 text-white' },
            { label: 'SO Created', status: 'so_created', count: byStatus('so_created').length, value: sumByStatus('so_created'), color: 'bg-slate-800 text-white' },
        ];
    }, [cpos]);

    return (
        <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Order Management</h1>
                        <div className="flex items-center gap-2 mt-2 text-sm bg-gray-100 px-4 py-2 rounded-lg">
                            <Link to="/" className="text-blue-600 hover:underline">Dashboard</Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Order Management</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                <button
                    onClick={() => setActiveView('customer-pos')}
                    className={`px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap border-b-2 ${
                        activeView === 'customer-pos'
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                >
                    Customer Purchase Orders
                </button>
                <button
                    onClick={() => setActiveView('sales-orders')}
                    className={`px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap border-b-2 ${
                        activeView === 'sales-orders'
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                >
                    Sales Orders
                </button>
            </div>

            {/* Customer Purchase Orders View */}
            {activeView === 'customer-pos' && (
                <div>
                    <div className="mb-4 flex justify-end">
                        <button
                            onClick={() => setShowNewCPO(true)}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                        >
                            + New PO
                        </button>
                    </div>

                    {/* Status KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                {kpiData.map((kpi) => (
                    <button
                        key={kpi.label}
                        onClick={() => setStatusFilter(statusFilter === kpi.status ? null : kpi.status)}
                        className={`rounded-lg border border-gray-200 bg-white p-4 text-left transition cursor-pointer ${
                            statusFilter === kpi.status ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
                        }`}
                    >
                        <p className="text-xs font-medium text-gray-600">{kpi.label}</p>
                        <p className="text-2xl font-bold mt-2 text-gray-800">{kpi.count}</p>
                        <p className="text-sm text-gray-600 mt-1">{fmt(kpi.value)}</p>
                    </button>
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
                                {['PO / Source', 'Client', 'Value & Terms', 'Payment', 'Status', 'SO Ref', 'Actions'].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCPOs.map((cpo: any) => {
                                const statusInfo = CPO_STATUS_MAP[cpo.status] || { label: cpo.status, color: 'bg-gray-100 text-gray-700' };
                                const advancePayment = (cpo.payments || []).find((p: any) => p.type === 'advance');
                                return (
                                    <tr key={cpo.po} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCPOId(cpo.po)}>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-mono font-bold text-gray-800">{cpo.po}</p>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${cpo.source === 'bd_team' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {cpo.source === 'bd_team' ? `BD – ${cpo.bdRep || ''}` : 'Customer'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{cpo.client}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-800 font-semibold">{fmt(cpo.value || 0)}</div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                {cpo.advancePct}% Advance, {100 - cpo.advancePct}% on delivery
                                                {cpo.advancePct > 0 && <div>{cpo.advancePct}% advance = {fmt(cpo.advanceAmt)}</div>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">
                                                {advancePayment ? (
                                                    <>
                                                        <div className="text-green-600 font-semibold">Paid: {fmt(advancePayment.amt)}</div>
                                                        <div className="text-orange-600">Pending: {fmt(cpo.value - advancePayment.amt)}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-gray-600">Paid: ₹0</div>
                                                        <div className="text-orange-600 font-semibold">Pending: {fmt(cpo.value)}</div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${statusInfo.color}`}>{statusInfo.label}</span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600">{cpo.soRef || '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 flex-wrap">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedCPOId(cpo.po); }}
                                                    className="px-2 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
                                                >
                                                    Open →
                                                </button>
                                                {cpo.status === 'payment_pending' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); markAdvancePaid(cpo); }}
                                                        className="px-2 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded hover:bg-emerald-100 transition"
                                                    >
                                                        Mark Advanced Paid
                                                    </button>
                                                )}
                                                {cpo.status === 'customer_approval_pending' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); markCustomerApproval(cpo); }}
                                                        className="px-2 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100 transition"
                                                    >
                                                        Mark Approved
                                                    </button>
                                                )}
                                                {cpo.status === 'draft' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); sendToCust(cpo); }}
                                                        className="px-2 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
                                                    >
                                                        Send to Client
                                                    </button>
                                                )}
                                                {(cpo.status === 'advance_paid' || !cpo.soRef) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); createSalesOrder(cpo); }}
                                                        className="px-2 py-1 text-xs bg-cyan-50 border border-cyan-200 text-cyan-700 rounded hover:bg-cyan-100 transition"
                                                    >
                                                        SO Ready
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredCPOs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        No orders found. Create one with "+ New PO".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
                </div>
            )}

            {/* Sales Orders View */}
            {activeView === 'sales-orders' && (
                <SalesOrders />
            )}

            {/* ══ NEW CPO MODAL ══════════════════════════════════════════════════════ */}
            {showNewCPO && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                <CpoDetailModal
                    cpo={selectedCPO}
                    onClose={() => setSelectedCPOId(null)}
                    onMarkFinanceReviewed={markFinanceReviewed}
                    onMarkAdvancePaid={markAdvancePaid}
                    onCreateSalesOrder={createSalesOrder}
                    onSendToCust={sendToCust}
                    onMarkCustomerApproval={markCustomerApproval}
                    onViewOrderedProducts={() => { navigate('/ordered-products'); setSelectedCPOId(null); }}
                />
            )}
        </div>
    );
};

export default OrderManagement;
