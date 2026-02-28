import { useMemo, useState } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import { Link } from 'react-router-dom';
import CpoDetailModal from '../components/ordermanagementcomp/CpoDetailModal';
import BatchPlannerModal from '../components/ordermanagementcomp/BatchPlannerModal';
import { Search, Sparkles } from 'lucide-react';

const OrderedProducts = () => {
    const { state } = useGlobalState();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCpoForDetails, setSelectedCpoForDetails] = useState<any>(null);
    const [selectedProductForBatching, setSelectedProductForBatching] = useState<any>(null);

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
            draft: 'bg-gray-100 text-gray-700 border border-gray-200',
            customer_approval_pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
            advance_paid: 'bg-blue-100 text-blue-800 border border-blue-200',
            so_created: 'bg-green-100 text-green-800 border border-green-200',
            batch_planning: 'bg-purple-100 text-purple-800 border border-purple-200',
            in_production: 'bg-orange-100 text-orange-800 border border-orange-200',
            completed: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        };
        return colors[stage] || 'bg-gray-100 text-gray-700 border border-gray-200';
    };

    const formatStageLabel = (stage: string) =>
        stage
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

    const totalOrders = new Set(filteredProducts.map((p) => p.soRef)).size;
    const totalUnits = filteredProducts.reduce((sum, p) => sum + (p.qty || 0), 0);
    const avgExecution = Math.round(filteredProducts.reduce((sum, p) => sum + (p.execPercent || 0), 0) / (filteredProducts.length || 1));
    const needsPlanning = filteredProducts.filter((p) => !p.batches).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Order Management</h1>
                    <div className="mt-2 flex gap-2 text-sm">
                        <Link to="/" className="text-blue-600 hover:underline">
                            Dashboard
                        </Link>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-600">Ordered Products</span>
                    </div>
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                    <Sparkles className="h-4 w-4" />
                    Run Planner
                </button>
            </div>

            {/* Search Bar */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by SO, product name, or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    Showing <span className="font-semibold text-gray-700">{filteredProducts.length}</span> product{filteredProducts.length === 1 ? '' : 's'}
                </p>
            </div>

            {/* Products Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">SO</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Product</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Qty</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Availability</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Exec%</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Stage</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Batches</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product, idx) => (
                                    <tr key={product.id} className={`border-b border-gray-100 transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                                        <td className="px-4 py-4">
                                            <div className="min-w-0">
                                                <p className="whitespace-nowrap font-semibold text-blue-600 hover:text-blue-700">{product.soRef}</p>
                                                <p className="text-xs text-gray-500 whitespace-nowrap">20 Feb 2026</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="min-w-0 max-w-48">
                                                <p className="truncate font-medium text-gray-900">{product.productName}</p>
                                                <p className="truncate text-xs text-gray-500">{product.sku}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium tabular-nums text-gray-700 whitespace-nowrap">{product.qty?.toLocaleString()}</td>
                                        <td className="px-4 py-4">
                                            <div className="space-y-0.5 text-sm">
                                                <p className="whitespace-nowrap text-gray-700">
                                                    <span className="font-medium">RM</span> {product.availability.rm}
                                                </p>
                                                <p className="whitespace-nowrap text-gray-700">
                                                    <span className="font-medium">PM</span> {product.availability.pm}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="text-sm">
                                                <span className="font-semibold text-orange-600">{product.execPercent}%</span>
                                                <p className="whitespace-nowrap text-xs text-gray-500">{product.execStatus}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStageColor(product.stage)}`}>
                                                {formatStageLabel(product.stage)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {product.batches ? (
                                                <span className="inline-flex whitespace-nowrap rounded-full bg-green-50 px-2.5 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-200">{product.batches}</span>
                                            ) : (
                                                <span className="text-sm text-gray-400">No batches</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link to="/universal-swap-page">
                                                    <button className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700 transition hover:bg-purple-100">
                                                        Swapping
                                                    </button>
                                                </Link>
                                                {product.batches ? (
                                                    <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                                                        View
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            // Map product data to match BatchPlannerModal expected format
                                                            const batchPlannerProduct = {
                                                                so: product.soRef,
                                                                product: product.productName,
                                                                sku: product.sku,
                                                                qty: product.qty,
                                                                deliveryDate: '2026-03-15' // Default delivery date
                                                            };
                                                            setSelectedProductForBatching(batchPlannerProduct);
                                                        }}
                                                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        Plan
                                                    </button>
                                                )}
                                            </div>
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Orders</p>
                        <p className="mt-1 text-3xl font-bold leading-none text-gray-900">{totalOrders}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Units</p>
                        <p className="mt-1 text-3xl font-bold leading-none text-gray-900">{totalUnits.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Avg Execution</p>
                        <p className="mt-1 text-3xl font-bold leading-none text-gray-900">{avgExecution}%</p>
                    </div>
                    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Needs Planning</p>
                        <p className="mt-1 text-3xl font-bold leading-none text-orange-600">{needsPlanning}</p>
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

            {/* Batch Planner Modal */}
            {selectedProductForBatching && (
                <BatchPlannerModal
                    orderedProduct={selectedProductForBatching}
                    onClose={() => setSelectedProductForBatching(null)}
                />
            )}
        </div>
    );
};

export default OrderedProducts;
