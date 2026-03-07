import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPlanningExtractedList,
  fetchItemsInvolvedByPlanningId,
  type PlanningExtractedRow,
  type ItemsInvolvedForPiRow,
} from '../services/planningExtracted.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';

/** Ordered product row for left panel (from planning extracted). */
type OrderedProductRow = {
  id: string;
  mo: string;
  batches: number;
  qty: string;
  productName: string;
  pack: string;
  status: string;
};

/** Table row for items involved (from API). */
type ItemsInvolvedTableRow = {
  id: string;
  item: string;
  category: string;
  reqQty: number;
  unit: string;
  groupQty: string;
  stockOnHand: number;
  reservedQty: number;
  netStock: number;
  status: string;
};

function mapPlanningToOrderedProduct(row: PlanningExtractedRow): OrderedProductRow {
  return {
    id: row.id,
    mo: row.soNumber || row.id,
    batches: row.batchesRequired ?? 0,
    qty: row.orderQty || '',
    productName: row.productName || row.productCode || '',
    pack: row.batchSize || '',
    status: row.bomStatus || 'Planning',
  };
}

function mapApiToTableRow(r: ItemsInvolvedForPiRow): ItemsInvolvedTableRow {
  const reqQty = Number(r.totalRequired) || 0;
  const stockOnHand = r.sih ?? 0;
  const reservedQty = r.reserved ?? 0;
  const netStock = r.netStock ?? stockOnHand - reservedQty;
  const status = (reqQty > 0 && netStock >= reqQty) ? 'ok' : (netStock < reqQty ? 'short' : 'ok');
  return {
    id: r.id ?? String(r.raw_material_id ?? r.pack_material_id),
    item: r.item ?? r.name ?? r.code ?? '',
    category: r.category ?? r.type ?? 'RM',
    reqQty,
    unit: (r.unit || 'kg').toLowerCase(),
    groupQty: '',
    stockOnHand,
    reservedQty,
    netStock,
    status,
  };
}

const UniversalSwapPage = () => {
  const [selectedProduct, setSelectedProduct] = useState<OrderedProductRow | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showRMPlan, setShowRMPlan] = useState(true);
  const [planQty, setPlanQty] = useState('');
  const [shortfallOnly, setShortfallOnly] = useState(false);
  const [selectedTableItem, setSelectedTableItem] = useState<ItemsInvolvedTableRow | null>(null);
  const [swapFromItem, setSwapFromItem] = useState('');
  const [swapToItem, setSwapToItem] = useState('');
  const [addItemName, setAddItemName] = useState('');
  const [addItemCategory, setAddItemCategory] = useState('RM');
  const [addItemQty, setAddItemQty] = useState('');
  const [globalFilterSKU, setGlobalFilterSKU] = useState('');
  const [applyToSelectedOnly, setApplyToSelectedOnly] = useState(true);

  const { data: planningList = [], isLoading: planningLoading } = useQuery({
    queryKey: ['planning-extracted-list'],
    queryFn: fetchPlanningExtractedList,
  });
  const orderedProducts: OrderedProductRow[] = planningList.map(mapPlanningToOrderedProduct);

  const effectiveSelected = selectedProduct ?? orderedProducts[0] ?? null;
  const effectiveSelectedId = effectiveSelected?.id;

  const { data: itemsInvolvedRaw = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['planning-extracted-items-involved', effectiveSelectedId],
    queryFn: () => (effectiveSelectedId ? fetchItemsInvolvedByPlanningId(effectiveSelectedId) : Promise.resolve([])),
    enabled: Boolean(effectiveSelectedId),
  });
  const itemsInvolved: ItemsInvolvedTableRow[] = itemsInvolvedRaw.map(mapApiToTableRow);

  const { data: rawList = [] } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
  });
  const { data: packList = [] } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
  });
  const allItems = [
    ...rawList.map((r) => ({ id: r.id, name: r.name || r.code, category: 'RM' as const, code: r.code })),
    ...packList.map((p) => ({ id: p.id, name: p.description || p.code, category: 'PM' as const, code: p.code })),
  ];

  const displayPlanQty = planQty !== '' ? planQty : (effectiveSelected?.qty ?? '');

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleViewRMPlan = (product: OrderedProductRow) => {
    setSelectedProduct(product);
    setPlanQty(product.qty);
    setShowRMPlan(true);
    setSelectedTableItem(null);
  };

  const handleProductClick = (product: OrderedProductRow) => {
    setSelectedProduct(product);
    setPlanQty(product.qty);
    if (!selectedOrders.includes(product.id)) {
      setSelectedOrders((prev) => [...prev, product.id]);
    }
  };

  const handleTableItemClick = (item: ItemsInvolvedTableRow) => {
    setSelectedTableItem(item);
    setSwapFromItem(item.item);
    setAddItemName(item.item);
  };

  const handleSwapItem = () => {
    if (!swapFromItem || !swapToItem) return;
    alert(`Swapping ${swapFromItem} → ${swapToItem} for ${effectiveSelected?.mo}`);
  };

  const handleAddItem = () => {
    if (!addItemName || !addItemQty) return;
    alert(`Adding ${addItemName} (${addItemCategory}) - Qty: ${addItemQty} to ${effectiveSelected?.mo}`);
  };

  const filteredItems = itemsInvolved.filter(item => {
    if (activeFilter === 'RM Only') return item.category === 'RM';
    if (activeFilter === 'PM Only') return item.category === 'PM';
    if (shortfallOnly) return item.netStock < item.reqQty;
    return true;
  });

  const rmFiltered = filteredItems.filter(i => i.category === 'RM');
  const pmFiltered = filteredItems.filter(i => i.category === 'PM');
  const rmLimits = rmFiltered.map(i => (i.reqQty > 0 ? Math.floor(i.netStock / i.reqQty) : 0));
  const pmLimits = pmFiltered.map(i => (i.reqQty > 0 ? Math.floor(i.netStock / i.reqQty) : 0));
  const rmLimit = rmLimits.length ? Math.min(...rmLimits) : 0;
  const pmLimit = pmLimits.length ? Math.min(...pmLimits) : 0;
  const possibleProduction = Math.min(rmLimit, pmLimit);

  if (planningLoading || orderedProducts.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-500">{planningLoading ? 'Loading orders…' : 'No planning orders found.'}</p>
          <Link to="/planning" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to Planning
          </Link>
        </div>
      </div>
    );
  }

  if (!effectiveSelected || !showRMPlan) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-500">Please select a product and view RM Plan to see details.</p>
          <Link to="/planning" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to Planning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel */}
      <div className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col lg:w-80">
        <div className="p-4 border-b border-gray-200 bg-slate-800 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Order Management System</h2>
            <Link to="/planning" className="text-gray-300 hover:text-white">
              <ArrowLeft size={18} />
            </Link>
          </div>
          <h1 className="text-lg font-bold">Order Management</h1>
          <p className="text-xs text-gray-300 mt-1">Dashboard / Order Management</p>
        </div>

        <div className="p-4 border-b border-gray-200 bg-blue-600 text-white">
          <h3 className="text-sm font-semibold">Ordered Product Management</h3>
        </div>

        <div className="grow overflow-y-auto">
          {orderedProducts.map((product) => (
            <div
              key={product.id}
              className={`p-4 border-b border-gray-200 cursor-pointer transition ${
                effectiveSelected?.id === product.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleProductClick(product)}
            >
              <div className="flex items-start">
                <input 
                  type="checkbox" 
                  className="mt-1.5 mr-3 h-4 w-4 rounded border-gray-300"
                  checked={selectedOrders.includes(product.id) || (selectedOrders.length === 0 && effectiveSelected?.id === product.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleOrderSelect(product.id);
                  }}
                />
                <div className="grow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-blue-600 text-sm">{product.mo}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewRMPlan(product);
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      View RM Plan
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium">Product Name:</span>
                      <span className="text-gray-800">{product.productName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Qty:</span>
                        <span className="ml-1 font-medium text-gray-900">{product.qty}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pack:</span>
                        <span className="ml-1 font-medium text-gray-900">{product.pack}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className="ml-1 font-medium text-blue-600">{product.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="grow p-6 overflow-y-auto bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Selected Product → Items Involved</h1>
            <p className="text-sm text-gray-500 mt-1">Stage-specific BOM (without touching masters)</p>
          </div>
          <Link to="/planning" className="text-blue-600 hover:underline text-sm font-medium">
            Back to Planning
          </Link>
        </div>

        {/* Product Info Card */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                <option>{effectiveSelected.productName}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                <option>1-to-Setup Type Batch</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
              <input 
                type="text" 
                value={displayPlanQty}
                onChange={(e) => setPlanQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Availability</label>
              <span className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-md border border-green-200">
                In Stock
              </span>
            </div>
          </div>
        </div>

        {/* Items Table Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  placeholder="PLAN Qty"
                  value={displayPlanQty}
                  onChange={(e) => setPlanQty(e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                  <Search size={16} />
                  Show Preview
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Shortfall Only</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={shortfallOnly}
                    onChange={(e) => setShortfallOnly(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600"></div>
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all peer-checked:translate-x-full"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {['All', 'RM Only', 'PM Only', 'RM Limit', 'PM Limit'].map(filter => (
                <button 
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    activeFilter === filter 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Possible Production:</span>
                <span className="ml-2 font-bold text-gray-900">{possibleProduction.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">RM Limit:</span>
                <span className="ml-2 font-bold text-gray-900">{rmLimit.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">PM Limit:</span>
                <span className="ml-2 font-bold text-gray-900">{pmLimit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-200 divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="w-[22%] py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-900">Item</th>
                  <th scope="col" className="w-[8%] px-3 py-3 text-center text-xs font-semibold text-gray-900">Category</th>
                  <th scope="col" className="w-[10%] px-3 py-3 text-right text-xs font-semibold text-gray-900">Req Qty</th>
                  <th scope="col" className="w-[10%] px-3 py-3 text-right text-xs font-semibold text-gray-900">Group Qty</th>
                  <th scope="col" className="w-[12%] px-3 py-3 text-right text-xs font-semibold text-gray-900">Stock On Hand</th>
                  <th scope="col" className="w-[12%] px-3 py-3 text-right text-xs font-semibold text-gray-900">Reserved Qty</th>
                  <th scope="col" className="w-[12%] px-3 py-3 text-right text-xs font-semibold text-gray-900">Net Stock</th>
                  <th scope="col" className="w-[10%] px-3 py-3 text-center text-xs font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {itemsLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading items…</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No items for this product.</td></tr>
                ) : filteredItems.map(item => (
                  <tr 
                    key={item.id}
                    onClick={() => handleTableItemClick(item)}
                    className={`cursor-pointer transition ${
                      selectedTableItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 pl-4 pr-3 text-sm font-medium text-gray-900 truncate">{item.item}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                        item.category === 'RM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.unit === 'pcs' ? Math.round(item.reqQty) : item.reqQty.toFixed(2)} {item.unit}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-500">{item.groupQty || '—'}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.stockOnHand.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.reservedQty.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums font-medium text-gray-900">{item.netStock.toFixed(2)}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        item.status === 'short' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Stage BOM Overrides</h3>
            <p className="text-sm text-gray-500 mb-4">Swap/add items for this specific order line (stage-specific).</p>
            
            {selectedTableItem && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Selected:</span> {selectedTableItem.item} ({selectedTableItem.category})
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  value={swapFromItem}
                  onChange={(e) => setSwapFromItem(e.target.value)}
                >
                    <option value="">Select Item</option>
                    {itemsInvolved.map(item => (
                      <option key={item.id} value={item.item}>{item.item}</option>
                    ))}
                </select>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  value={swapToItem}
                  onChange={(e) => setSwapToItem(e.target.value)}
                >
                    <option value="">Select replacement</option>
                    {allItems.map(item => (
                      <option key={item.id} value={item.name}>{item.name} ({item.category})</option>
                    ))}
                </select>
                <button 
                  onClick={handleSwapItem}
                  disabled={!swapFromItem || !swapToItem}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                    Swap Item
                </button>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Add New Item</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-4">
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm col-span-2 bg-white"
                    value={addItemName}
                    onChange={(e) => setAddItemName(e.target.value)}
                  >
                      <option value="">Select Item to Add</option>
                      {allItems.map(item => (
                        <option key={item.id} value={item.name}>{item.name} ({item.category})</option>
                      ))}
                  </select>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={addItemCategory}
                    onChange={(e) => setAddItemCategory(e.target.value)}
                  >
                      <option value="RM">RM</option>
                      <option value="PM">PM</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="e.g. 0.002 (kg) / 1 (pcs)"
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
              </div>
              <button 
                onClick={handleAddItem}
                disabled={!addItemName || !addItemQty}
                className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                  Add
              </button>
            </div>
        </div>

        <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Global Replace (Across Order Overrides)</h3>
            <div className="flex items-center mb-4">
                <input 
                  id="apply-selected" 
                  type="checkbox" 
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={applyToSelectedOnly}
                  onChange={(e) => setApplyToSelectedOnly(e.target.checked)}
                />
                <label htmlFor="apply-selected" className="ml-2 block text-sm text-gray-900">
                  Apply to Selected Orders only {(selectedOrders.length > 0 || effectiveSelected) && `(${selectedOrders.length || (effectiveSelected ? 1 : 0)} selected)`}
                </label>
            </div>
            <div className="flex items-center gap-4">
                <input 
                  type="text" 
                  placeholder="#SKU"
                  value={globalFilterSKU}
                  onChange={(e) => setGlobalFilterSKU(e.target.value)}
                  className="grow px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button 
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md text-sm font-medium hover:bg-yellow-600 transition"
                  onClick={() => alert(`Filtering by SKU: ${globalFilterSKU}`)}
                >
                    Filter By Item
                </button>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3 pb-6">
          <Link to="/planning">
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
          </Link>
          <button 
            className="px-6 py-2 bg-yellow-500 text-white rounded-md text-sm font-medium hover:bg-yellow-600 transition"
            onClick={() => alert('Saving Stage BOM Overrides...')}
          >
            Save Overrides
          </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalSwapPage;
