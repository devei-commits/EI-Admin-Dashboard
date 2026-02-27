import { useMemo, useState } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import { Link } from 'react-router-dom';
import CpoDetailModal from '../components/ordermanagementcomp/CpoDetailModal';

const OrderedProducts = () => {
    const { state } = useGlobalState();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCpoForDetails, setSelectedCpoForDetails] = useState<any>(null);

    const mockCPOs = [
        {
            id: 'cpo-001',
            po: 'CPO-1187',
            client: 'Akash Trading',
            value: 420000,
            advancePct: 50,
            payments: [
                { type: 'advance', pct: 50, amt: 210000, due: '2025-02-20', paid: true, paidOn: '2025-02-20', ref: 'UTR-648392' },
                { type: 'balance', pct: 50, amt: 210000, due: '2025-03-10', paid: false, paidOn: null, ref: null },
            ],
            soRef: 'SO-03004',
            products: [
                {
                    product: '1 DERMA ACNE CLEAR GLOW FACE WASH-80ML',
                    sku: 'PRODP0574',
                    qty: 354,
                    unitPrice: 180,
                    lineValue: 63720,
                },
            ],
            status: 'so_created',
            timeline: [
                { stage: 'PO Received', date: '2025-02-20', done: true },
                { stage: 'Finance Review', date: '2025-02-20', done: true },
                { stage: 'Advance Requested', date: '2025-02-21', done: true },
                { stage: 'Advance Paid', date: '2025-02-21', done: true },
                { stage: 'SO Created', date: '2025-02-22', done: true },
                { stage: 'Balance Payment', date: null, done: false },
                { stage: 'Dispatched', date: null, done: false },
                { stage: 'Batch Planning Done', done: false },
            ],
        },
        {
            id: 'cpo-002',
            po: 'CPO-1188',
            client: 'SMG Global',
            value: 360000,
            advancePct: 30,
            payments: [
                { type: 'advance', pct: 30, amt: 108000, due: '2025-02-18', paid: true, paidOn: '2025-02-18', ref: 'UTR-984201' },
                { type: 'balance', pct: 70, amt: 252000, due: '2025-03-05', paid: false, paidOn: null, ref: null },
            ],
            soRef: 'SO-02996',
            products: [
                {
                    product: 'SMG GLOBAL CERALITE MOISTURIZER LOTION 250 ML',
                    sku: 'PRODP0541',
                    qty: 1500,
                    unitPrice: 240,
                    lineValue: 360000,
                },
            ],
            status: 'batch_planning',
            timeline: [
                { stage: 'PO Received', date: '2025-02-18', done: true },
                { stage: 'Finance Review', date: '2025-02-18', done: true },
                { stage: 'Advance Requested', date: '2025-02-19', done: true },
                { stage: 'Advance Paid', date: '2025-02-19', done: true },
                { stage: 'SO Created', date: '2025-02-20', done: true },
                { stage: 'Batch Planning Done', done: true },
            ],
        },
    ];

    const sourceCPOs = useMemo(() => {
        const cpos = state.orders?.customerPOs || state.orders?.cpos || [];
        return cpos.length > 0 ? cpos : mockCPOs;
    }, [state.orders?.customerPOs, state.orders?.cpos]);

    // Get all ordered products from CPOs
    const orderedProductsList = useMemo(() => {
        const products: any[] = [];

        sourceCPOs.forEach((cpo: any) => {
            cpo.products?.forEach((product: any) => {
                products.push({
                    id: `${cpo.id}-${product.sku}`,
                    soRef: cpo.soRef || 'Pending',
                    soId: cpo.id,
                    productName: product.product,
                    sku: product.sku,
                    qty: product.qty,
                    unitPrice: product.unitPrice,
                    lineValue: product.lineValue,
                    availability: {
                        rm: 0,
                        pm: 0,
                    },
                    execPercent: 0,
                    execStatus: `0 / ${product.qty}`,
                    stage: cpo.status || 'draft',
                    batches: cpo.timeline?.find((t: any) => t.stage === 'Batch Planning Done')?.done ? 'Batches' : null,
                });
            });
        });

        return products;
    }, [sourceCPOs]);

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return orderedProductsList;
        const t = searchTerm.toLowerCase();
        return orderedProductsList.filter((product) =>
            product.soRef.toLowerCase().includes(t) ||
            product.productName.toLowerCase().includes(t) ||
            product.sku.toLowerCase().includes(t)
        );
    }, [orderedProductsList, searchTerm]);

    const getStageColor = (stage: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-800',
            customer_approval_pending: 'bg-yellow-100 text-yellow-800',
            advance_paid: 'bg-blue-100 text-blue-800',
            so_created: 'bg-green-100 text-green-800',
            batch_planning: 'bg-purple-100 text-purple-800',
            in_production: 'bg-orange-100 text-orange-800',
            completed: 'bg-green-100 text-green-800',
        };
        return colors[stage] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Order Management</h1>
                    <div className="flex gap-2 mt-2 text-sm">
                        <Link to="/" className="text-blue-600 hover:underline">
                            Dashboard
                        </Link>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-600">Ordered Products</span>
                    </div>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">
                    🏭 Run Planner
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <input
                    type="text"
                    placeholder="Search by SO, product name, or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">SO</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">PRODUCT</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">QTY</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">AVAILABILITY</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">EXEC%</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">STAGE</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">BATCHES</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">#</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product, idx) => (
                                    <tr key={product.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-blue-600">{product.soRef}</p>
                                                <p className="text-xs text-gray-500">20 Feb 2026</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-gray-800">{product.productName}</p>
                                                <p className="text-xs text-gray-500">{product.sku}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-700">{product.qty?.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm space-y-1">
                                                <p className="text-gray-700">
                                                    <span className="font-medium">RM</span> {product.availability.rm}
                                                </p>
                                                <p className="text-gray-700">
                                                    <span className="font-medium">PM</span> {product.availability.pm}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                <span className="font-semibold text-orange-600">{product.execPercent}%</span>
                                                <p className="text-xs text-gray-500">{product.execStatus}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-600 text-lg">•</span>
                                                <span className="text-xs text-purple-600 font-medium">Batch setup</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {product.batches ? (
                                                <span className="text-green-600 font-medium text-sm">{product.batches}</span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">No batches</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {product.batches ? (
                                                <button className="px-4 py-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                                                    View
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        const matchedCpo = sourceCPOs.find((cpo: any) =>
                                                            cpo.soRef === product.soRef || cpo.id === product.soId
                                                        );
                                                        const fallbackCpo = {
                                                            po: product.soId || 'CPO',
                                                            client: '—',
                                                            value: product.lineValue || 0,
                                                            advancePct: 0,
                                                            payments: [],
                                                            products: [{
                                                                product: product.productName,
                                                                sku: product.sku,
                                                                qty: product.qty,
                                                                unitPrice: product.unitPrice,
                                                                lineValue: product.lineValue,
                                                            }],
                                                            timeline: [],
                                                            status: product.stage || 'draft',
                                                            soRef: product.soRef,
                                                        };
                                                        setSelectedCpoForDetails(matchedCpo || fallbackCpo);
                                                    }}
                                                    className="px-4 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                                                >
                                                    Plan
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        No ordered products found. {searchTerm && 'Try adjusting your search.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stats Footer */}
            {filteredProducts.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-600 font-medium">Total Orders</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{new Set(filteredProducts.map((p) => p.soRef)).size}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-600 font-medium">Total Units</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{filteredProducts.reduce((sum, p) => sum + (p.qty || 0), 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-600 font-medium">Avg Execution</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">
                            {Math.round(filteredProducts.reduce((sum, p) => sum + (p.execPercent || 0), 0) / (filteredProducts.length || 1))}%
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-xs text-gray-600 font-medium">Needs Planning</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{filteredProducts.filter((p) => !p.batches).length}</p>
                    </div>
                </div>
            )}

            {selectedCpoForDetails && (
                <CpoDetailModal
                    cpo={selectedCpoForDetails}
                    onClose={() => setSelectedCpoForDetails(null)}
                    showActions={false}
                    showOrderedProductsCta={false}
                />
            )}
        </div>
    );
};

export default OrderedProducts;
