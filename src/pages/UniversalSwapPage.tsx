import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const mockOrderedProducts = [
  {
    id: 'SO-02996',
    mo: 'SO-02996',
    batches: 1,
    qty: '5000',
    productName: 'Sunscreen Gel SPF50 50g',
    pack: '50g Tube',
    status: 'Planning',
  },
  {
    id: 'SO-03074',
    mo: 'SO-03074',
    batches: 2,
    qty: '14000',
    productName: 'Anti-Acne Facewash 100g',
    pack: '100g Tube',
    status: 'Planning',
  },
];

const mockAllItems = [
    { id: '1', name: 'POLYESTER 40x45', category: 'RM', code: 'RM-P001' },
    { id: '2', name: 'ALPHA ARBUTIN', category: 'RM', code: 'RM-A002' },
    { id: '3', name: 'NIACINAMIDE', category: 'RM', code: 'RM-N003' },
    { id: '4', name: 'ALLANTOIN (BASF ENTERPRISES)', category: 'RM', code: 'RM-A004' },
    { id: '5', name: 'CUCUMBER DRY PVT.', category: 'RM', code: 'RM-C005' },
    { id: '6', name: 'ETHYL PO2- AB', category: 'RM', code: 'RM-E006' },
    { id: '7', name: 'D3 CERAMIX V', category: 'RM', code: 'RM-D007' },
    { id: '8', name: 'ALOE VERA (VE)', category: 'RM', code: 'RM-A008' },
    { id: '9', name: 'VEGAMOL 1838', category: 'RM', code: 'RM-V009' },
    { id: '10', name: 'GLYCERINB GSTA', category: 'RM', code: 'RM-G010' },
    { id: '11', name: '50g Tube', category: 'PM', code: 'PM-T001' },
    { id: '12', name: '100g Tube', category: 'PM', code: 'PM-T002' },
];

const mockItemsInvolved = [
    { id: '1', item: 'POLYESTER 40x45', category: 'RM', reqQty: 7.50, unit: 'kg', groupQty: '', stockOnHand: 50.25, reservedQty: 20.00, netStock: 30.25, status: 'ok' },
    { id: '2', item: 'ALPHA ARBUTIN', category: 'RM', reqQty: 0.28, unit: 'kg', groupQty: '', stockOnHand: 2.60, reservedQty: 0.58, netStock: 2.02, status: 'ok' },
    { id: '3', item: 'NIACINAMIDE', category: 'RM', reqQty: 0.02, unit: 'kg', groupQty: '', stockOnHand: 240.05, reservedQty: 0.03, netStock: 240.02, status: 'ok' },
    { id: '4', item: 'ALLANTOIN (BASF ENTERPRISES)', category: 'RM', reqQty: 1.88, unit: 'kg', groupQty: '', stockOnHand: 3.29, reservedQty: 0.00, netStock: 3.29, status: 'ok' },
    { id: '5', item: 'CUCUMBER DRY PVT.', category: 'RM', reqQty: 7.50, unit: 'kg', groupQty: '', stockOnHand: 56.73, reservedQty: 0.00, netStock: 56.73, status: 'ok' },
    { id: '6', item: 'ETHYL PO2- AB', category: 'RM', reqQty: 1.88, unit: 'kg', groupQty: '', stockOnHand: 73.75, reservedQty: 0.00, netStock: 73.75, status: 'ok' },
    { id: '7', item: 'D3 CERAMIX V', category: 'RM', reqQty: 0.38, unit: 'kg', groupQty: '', stockOnHand: 4.46, reservedQty: 0.00, netStock: 4.46, status: 'ok' },
    { id: '8', item: 'ALOE VERA (VE)', category: 'RM', reqQty: 3.75, unit: 'kg', groupQty: '', stockOnHand: 28.50, reservedQty: 0.00, netStock: 28.50, status: 'ok' },
    { id: '9', item: 'VEGAMOL 1838', category: 'RM', reqQty: 7.50, unit: 'kg', groupQty: '', stockOnHand: 215.05, reservedQty: 0.03, netStock: 215.02, status: 'ok' },
    { id: '10', item: 'GLYCERINB GSTA', category: 'RM', reqQty: 0.75, unit: 'kg', groupQty: '', stockOnHand: 136.71, reservedQty: 0.00, netStock: 136.71, status: 'ok' },
    { id: '11', item: '50g Tube', category: 'PM', reqQty: 1, unit: 'pcs', groupQty: '', stockOnHand: 5000, reservedQty: 2000, netStock: 3000, status: 'ok' },
];

const UniversalSwapPage = () => {
  const [selectedProduct, setSelectedProduct] = useState(mockOrderedProducts[0]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([selectedProduct.id]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showRMPlan, setShowRMPlan] = useState(true);
  const [planQty, setPlanQty] = useState(selectedProduct.qty);
  const [shortfallOnly, setShortfallOnly] = useState(false);
  const [selectedTableItem, setSelectedTableItem] = useState<typeof mockItemsInvolved[0] | null>(null);
  const [swapFromItem, setSwapFromItem] = useState('');
  const [swapToItem, setSwapToItem] = useState('');
  const [addItemName, setAddItemName] = useState('');
  const [addItemCategory, setAddItemCategory] = useState('RM');
  const [addItemQty, setAddItemQty] = useState('');
  const [globalFilterSKU, setGlobalFilterSKU] = useState('');
  const [applyToSelectedOnly, setApplyToSelectedOnly] = useState(true);

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleViewRMPlan = (product: typeof mockOrderedProducts[0]) => {
    setSelectedProduct(product);
    setPlanQty(product.qty);
    setShowRMPlan(true);
  };

  const handleTableItemClick = (item: typeof mockItemsInvolved[0]) => {
    setSelectedTableItem(item);
    setSwapFromItem(item.item);
    setAddItemName(item.item);
  };

  const handleSwapItem = () => {
    if (!swapFromItem || !swapToItem) return;
    alert(`Swapping ${swapFromItem} → ${swapToItem} for ${selectedProduct.mo}`);
    // Here you would implement the actual swap logic
  };

  const handleAddItem = () => {
    if (!addItemName || !addItemQty) return;
    alert(`Adding ${addItemName} (${addItemCategory}) - Qty: ${addItemQty} to ${selectedProduct.mo}`);
    // Here you would implement the actual add logic
  };

  const filteredItems = mockItemsInvolved.filter(item => {
    if (activeFilter === 'RM Only') return item.category === 'RM';
    if (activeFilter === 'PM Only') return item.category === 'PM';
    if (shortfallOnly) return item.netStock < item.reqQty;
    return true;
  });

  const possibleProduction = Math.min(
    ...filteredItems.filter(i => i.category === 'RM').map(i => Math.floor(i.netStock / i.reqQty)),
    ...filteredItems.filter(i => i.category === 'PM').map(i => Math.floor(i.netStock / i.reqQty))
  );

  const rmLimit = Math.min(...filteredItems.filter(i => i.category === 'RM').map(i => Math.floor(i.netStock / i.reqQty)));
  const pmLimit = Math.min(...filteredItems.filter(i => i.category === 'PM').map(i => Math.floor(i.netStock / i.reqQty)));

  if (!selectedProduct || !showRMPlan) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-500">Please select a product and view RM Plan to see details.</p>
          <Link to="/procurement" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to Procurement
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
            <Link to="/procurement" className="text-gray-300 hover:text-white">
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
          {mockOrderedProducts.map((product) => (
            <div
              key={product.id}
              className={`p-4 border-b border-gray-200 cursor-pointer transition ${
                selectedProduct.id === product.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedProduct(product)}
            >
              <div className="flex items-start">
                <input 
                  type="checkbox" 
                  className="mt-1.5 mr-3 h-4 w-4 rounded border-gray-300"
                  checked={selectedOrders.includes(product.id)}
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
          <Link to="/procurement" className="text-blue-600 hover:underline text-sm font-medium">
            Back to Orders
          </Link>
        </div>

        {/* Product Info Card */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                <option>{selectedProduct.productName}</option>
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
                value={planQty}
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
                  value={planQty}
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
                {filteredItems.map(item => (
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
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.reqQty} {item.unit}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-500">{item.groupQty || '—'}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.stockOnHand.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-700">{item.reservedQty.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums font-medium text-gray-900">{item.netStock.toFixed(2)}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
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
                    {mockItemsInvolved.map(item => (
                      <option key={item.id} value={item.item}>{item.item}</option>
                    ))}
                </select>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  value={swapToItem}
                  onChange={(e) => setSwapToItem(e.target.value)}
                >
                    <option value="">Niacinamide (RM/Active)</option>
                    {mockAllItems.map(item => (
                      <option key={item.id} value={item.name}>{item.name}</option>
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
                      {mockAllItems.map(item => (
                        <option key={item.id} value={item.name}>{item.name}</option>
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
                  Apply to Selected Orders only {selectedOrders.length > 0 && `(${selectedOrders.length} selected)`}
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
          <Link to="/procurement">
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
