import React from 'react';

const CPO_STATUS_MAP: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    checkout_pending: { label: 'Checkout Pending', color: 'bg-blue-100 text-blue-700' },
    customer_approval_pending: { label: 'Awaiting Customer Approval', color: 'bg-yellow-100 text-yellow-700' },
    payment_pending: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700' },
    advance_paid: { label: 'Advance Paid', color: 'bg-green-100 text-green-700' },
    so_created: { label: 'SO Created', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const fmt = (n: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(n);

interface Props {
    cpo: any;
    onClose: () => void;
    onMarkFinanceReviewed?: (cpo: any) => void;
    onMarkAdvancePaid?: (cpo: any) => void;
    onCreateSalesOrder?: (cpo: any) => void;
    onSendToCust?: (cpo: any) => void;
    onMarkCustomerApproval?: (cpo: any) => void;
    onViewOrderedProducts?: () => void;
    showActions?: boolean;
    showOrderedProductsCta?: boolean;
}

const CpoDetailModal: React.FC<Props> = ({
    cpo,
    onClose,
    onMarkFinanceReviewed,
    onMarkAdvancePaid,
    onCreateSalesOrder,
    onSendToCust,
    onMarkCustomerApproval,
    onViewOrderedProducts,
    showActions = true,
    showOrderedProductsCta = true,
}) => {
    const safeCpo = {
        po: cpo?.po || cpo?.id || cpo?.soRef || 'CPO',
        client: cpo?.client || cpo?.clientName || '—',
        value: cpo?.value || 0,
        advancePct: cpo?.advancePct ?? 0,
        payments: cpo?.payments || [],
        products: cpo?.products || [],
        timeline: cpo?.timeline || [],
        notes: cpo?.notes || '',
        status: cpo?.status || 'draft',
        soRef: cpo?.soRef || null,
    };

    const orderValue = safeCpo.value || (safeCpo.products || []).reduce((sum: number, p: any) => sum + (p.lineValue || 0), 0);
    const totalPaid = (safeCpo.payments || []).reduce((sum: number, p: any) => sum + (p.paid ? p.amt : 0), 0);
    const pendingAmount = Math.max(0, orderValue - totalPaid);
    const statusInfo = CPO_STATUS_MAP[safeCpo.status] || { label: safeCpo.status, color: 'bg-gray-100 text-gray-700' };
    const priority = cpo?.priority || 'High';
    const address = cpo?.address || cpo?.companyAddress || '—';
    const contactPerson = cpo?.contactPerson || cpo?.contactName || '—';
    const email = cpo?.email || '—';
    const phone = cpo?.phone || '—';
    const registeredAt = cpo?.registeredAt || cpo?.createdAt || '—';
    const timelineItems = (safeCpo.timeline || []).length > 0
        ? safeCpo.timeline
        : [{ stage: 'Order created', date: registeredAt !== '—' ? registeredAt : null, done: false }];

    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Order Details</h2>
                    <button onClick={onClose} className="h-8 px-3 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Close
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-500">Order ID</p>
                            <p className="font-medium text-gray-800">{safeCpo.po}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Company Name</p>
                            <p className="font-medium text-gray-800">{safeCpo.client}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Priority</p>
                            <p className="font-semibold text-amber-600">{priority}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-gray-500">Address</p>
                            <p className="text-gray-800">{address}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Contact Person</p>
                            <p className="text-gray-800">{contactPerson}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-gray-800">{email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-gray-800">{phone}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Date Registered</p>
                            <p className="text-gray-800">{registeredAt}</p>
                        </div>
                    </div>

                    <div className="border-t border-gray-200" />

                    {/* Products */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Products</h3>
                        <div className="mt-2 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Product</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Qty</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Unit Price</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(safeCpo.products || []).map((p: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="px-3 py-2 text-gray-800">{p.product}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{p.qty?.toLocaleString?.() || p.qty}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmt(Number(p.unitPrice || 0))}</td>
                                            <td className="px-3 py-2 text-right text-gray-800 font-semibold">{fmt(Number(p.lineValue || 0))}</td>
                                        </tr>
                                    ))}
                                    {(safeCpo.products || []).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-3 text-center text-xs text-gray-500">
                                                No products available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Grand Total</td>
                                        <td className="px-3 py-2 text-right font-bold text-gray-800">{fmt(orderValue)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="border-t border-gray-200" />

                    {/* Order Timeline */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Order Timeline</h3>
                        <div className="mt-2 space-y-2">
                            {timelineItems.map((t: any, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded ${t.done ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} font-semibold`}>
                                            {t.done ? 'Done' : 'Pending'}
                                        </span>
                                        <span className="text-gray-700">{t.stage}</span>
                                    </div>
                                    <span className="text-gray-500">
                                        {t.date ? (typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().slice(0, 10)) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Notes</h3>
                        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            {safeCpo.notes || '—'}
                        </div>
                    </div>

                    {showActions && (
                        <div className="pt-2 flex gap-3 flex-wrap">
                            {(safeCpo.status === 'checkout_pending' || safeCpo.status === 'payment_pending') && safeCpo.status !== 'so_created' && (
                                <>
                                    {!safeCpo.timeline?.find((t: any) => t.stage === 'Finance Review')?.done && onMarkFinanceReviewed && (
                                        <button onClick={() => onMarkFinanceReviewed(safeCpo)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">
                                            Mark Finance Reviewed
                                        </button>
                                    )}
                                </>
                            )}
                            {safeCpo.status === 'payment_pending' && onMarkAdvancePaid && (
                                <button onClick={() => onMarkAdvancePaid(safeCpo)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition">
                                    Mark Advance Paid
                                </button>
                            )}
                            {(safeCpo.status === 'advance_paid' || (safeCpo.status === 'checkout_pending' && safeCpo.advancePct === 0)) && !safeCpo.soRef && onCreateSalesOrder && (
                                <button onClick={() => onCreateSalesOrder(safeCpo)}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition">
                                    Create Sales Order
                                </button>
                            )}
                            {safeCpo.status === 'draft' && onSendToCust && (
                                <button onClick={() => onSendToCust(safeCpo)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium text-sm hover:bg-gray-700 transition">
                                    Send to Client
                                </button>
                            )}
                            {safeCpo.status === 'customer_approval_pending' && onMarkCustomerApproval && (
                                <button onClick={() => onMarkCustomerApproval(safeCpo)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">
                                    Mark Approved
                                </button>
                            )}
                            {safeCpo.soRef && onViewOrderedProducts && showOrderedProductsCta && (
                                <button onClick={onViewOrderedProducts}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition">
                                    Go to Ordered Products
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CpoDetailModal;
