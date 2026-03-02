import React, { useState, useMemo } from 'react';

interface InventoryItem {
  id: string;
  code: string;
  itemName: string;
  category: string;
  type: 'RM' | 'PM' | 'FG/PR';
  zone: string;
  rack: string;
  whStock: number;
  ml1Stock: number;
  ml2Stock: number;
  stockInHand: number;
  reserved: number;
  inTransit: number;
  reorderPt: number;
  avgMo: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock' | 'Under QC';
}

// Sample inventory data
const INVENTORY_DATA: InventoryItem[] = [
  {
    id: '1',
    code: 'EI-RM-BASE-001',
    itemName: 'Aqua (Purified Water)',
    category: 'Aqua - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S3',
    whStock: 380,
    ml1Stock: 120,
    ml2Stock: 60,
    stockInHand: 560,
    reserved: 200,
    inTransit: 300,
    reorderPt: 400,
    avgMo: 400,
    status: 'In Stock'
  },
  {
    id: '2',
    code: 'EI-RM-ACT-001',
    itemName: 'Glycerin',
    category: 'Glycerin - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S2',
    whStock: 95,
    ml1Stock: 30,
    ml2Stock: 15,
    stockInHand: 140,
    reserved: 60,
    inTransit: 80,
    reorderPt: 90,
    avgMo: 90,
    status: 'In Stock'
  },
  {
    id: '3',
    code: 'EI-RM-EMUL-001',
    itemName: 'Cetearyl Alcohol',
    category: 'Cetearyl Alcohol - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S4',
    whStock: 42,
    ml1Stock: 8,
    ml2Stock: 5,
    stockInHand: 55,
    reserved: 30,
    inTransit: 40,
    reorderPt: 20,
    avgMo: 20,
    status: 'In Stock'
  },
  {
    id: '4',
    code: 'EI-RM-EMUL-002',
    itemName: 'Ceteareth-20',
    category: 'Ceteareth-20 - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S1',
    whStock: 28,
    ml1Stock: 5,
    ml2Stock: 3,
    stockInHand: 36,
    reserved: 20,
    inTransit: 25,
    reorderPt: 20,
    avgMo: 25,
    status: 'In Stock'
  },
  {
    id: '5',
    code: 'EI-RM-POLY-001',
    itemName: 'Carbomer 980',
    category: 'Carbomer - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S3',
    whStock: 12,
    ml1Stock: 2,
    ml2Stock: 1,
    stockInHand: 15,
    reserved: 8,
    inTransit: 10,
    reorderPt: 10,
    avgMo: 10,
    status: 'Low Stock'
  },
  {
    id: '6',
    code: 'EI-RM-POLY-002',
    itemName: 'Carbopol 940',
    category: 'Carbomer - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S3',
    whStock: 10,
    ml1Stock: 2,
    ml2Stock: 0,
    stockInHand: 12,
    reserved: 6,
    inTransit: 10,
    reorderPt: 10,
    avgMo: 7,
    status: 'Low Stock'
  },
  {
    id: '7',
    code: 'EI-RM-PRES-001',
    itemName: 'Phenoxyethanol',
    category: 'Phenoxyethanol - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A3-L1-S1',
    whStock: 18,
    ml1Stock: 4,
    ml2Stock: 2,
    stockInHand: 24,
    reserved: 12,
    inTransit: 15,
    reorderPt: 15,
    avgMo: 12,
    status: 'In Stock'
  },
  {
    id: '8',
    code: 'EI-RM-EXCIP-001',
    itemName: 'Sodium Hydroxide 50%',
    category: 'Sodium Hydroxide - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A3-L1-S1',
    whStock: 35,
    ml1Stock: 5,
    ml2Stock: 3,
    stockInHand: 43,
    reserved: 15,
    inTransit: 25,
    reorderPt: 15,
    avgMo: 15,
    status: 'In Stock'
  },
  {
    id: '9',
    code: 'EI-RM-EXCIP-002',
    itemName: 'Citric Acid Monohydrate',
    category: 'Citric Acid - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A3-L1-S1',
    whStock: 22,
    ml1Stock: 3,
    ml2Stock: 2,
    stockInHand: 27,
    reserved: 10,
    inTransit: 10,
    reorderPt: 8,
    avgMo: 8,
    status: 'In Stock'
  },
  {
    id: '10',
    code: 'EI-RM-SURF-001',
    itemName: 'SLES 70%',
    category: 'Sodium Laureth Sulfate - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S2',
    whStock: 95,
    ml1Stock: 25,
    ml2Stock: 15,
    stockInHand: 135,
    reserved: 60,
    inTransit: 80,
    reorderPt: 75,
    avgMo: 75,
    status: 'In Stock'
  },
  {
    id: '11',
    code: 'EI-RM-SURF-002',
    itemName: 'CAPB 35%',
    category: 'Cocamidopropyl Betaine - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S3',
    whStock: 55,
    ml1Stock: 15,
    ml2Stock: 8,
    stockInHand: 78,
    reserved: 30,
    inTransit: 40,
    reorderPt: 35,
    avgMo: 35,
    status: 'In Stock'
  },
  {
    id: '12',
    code: 'EI-RM-SURF-003',
    itemName: 'SCI (Sodium Cocoyl Isethionate)',
    category: 'Sodium Cocoyl Isethionate - KG',
    type: 'RM',
    zone: 'A',
    rack: 'A1-L1-S3',
    whStock: 30,
    ml1Stock: 8,
    ml2Stock: 4,
    stockInHand: 42,
    reserved: 20,
    inTransit: 25,
    reorderPt: 25,
    avgMo: 20,
    status: 'In Stock'
  },
];

const WarehouseInventory: React.FC = () => {
  const [filterType, setFilterType] = useState<'All' | 'RM' | 'PM' | 'FG/PR' | 'Low'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>(null);

  // Filter and search
  const filteredData = useMemo(() => {
    let filtered = INVENTORY_DATA;

    // Apply type filter
    if (filterType === 'RM') filtered = filtered.filter(item => item.type === 'RM');
    else if (filterType === 'PM') filtered = filtered.filter(item => item.type === 'PM');
    else if (filterType === 'FG/PR') filtered = filtered.filter(item => item.type === 'FG/PR');
    else if (filterType === 'Low') filtered = filtered.filter(item => item.status === 'Low Stock' || item.status === 'Critical');

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [filterType, searchTerm]);

  // Calculate KPIs
  const kpis = {
    totalSKUs: INVENTORY_DATA.length,
    inStock: INVENTORY_DATA.filter(item => item.status === 'In Stock').length,
    lowStock: INVENTORY_DATA.filter(item => item.status === 'Low Stock').length,
    criticalOut: INVENTORY_DATA.filter(item => item.status === 'Critical' || item.status === 'Out of Stock').length,
    fgUnderQC: INVENTORY_DATA.filter(item => item.status === 'Under QC').length,
    inTransit: INVENTORY_DATA.reduce((sum, item) => sum + item.inTransit, 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'text-teal-600 bg-teal-50 border-teal-200';
      case 'Low Stock':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Out of Stock':
        return 'text-red-700 bg-red-100 border-red-300';
      case 'Under QC':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'RM':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'PM':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'FG/PR':
        return 'bg-pink-100 text-pink-700 border-pink-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <div className="px-6 py-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-2">Monitor and manage warehouse inventory</p>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total SKUs</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.totalSKUs}</p>
          <p className="text-xs text-gray-500 mt-3">RM + PM + FG</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Stock</p>
          <p className="text-3xl font-bold text-teal-600 mt-2">{kpis.inStock}</p>
          <p className="text-xs text-gray-500 mt-3">Available</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Stock</p>
          <p className="text-3xl font-bold text-amber-500 mt-2">{kpis.lowStock}</p>
          <p className="text-xs text-gray-500 mt-3">Needs refill</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Critical/Out</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{kpis.criticalOut}</p>
          <p className="text-xs text-gray-500 mt-3">Action needed</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">FG Under QC</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{kpis.fgUnderQC}</p>
          <p className="text-xs text-gray-500 mt-3">Pending release</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Transit</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{kpis.inTransit}</p>
          <p className="text-xs text-gray-500 mt-3">KG in orders</p>
        </div>
        </div>

        {/* Inventory Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {/* Section Header & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'All', value: 'All' as const, count: INVENTORY_DATA.length },
                { label: 'RM', value: 'RM' as const, count: INVENTORY_DATA.filter(i => i.type === 'RM').length },
                { label: 'PM', value: 'PM' as const, count: INVENTORY_DATA.filter(i => i.type === 'PM').length },
                { label: 'FG/PR', value: 'FG/PR' as const, count: INVENTORY_DATA.filter(i => i.type === 'FG/PR').length },
                { label: 'Low', value: 'Low' as const, count: INVENTORY_DATA.filter(i => i.status === 'Low Stock' || i.status === 'Critical').length },
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filterType === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>

          {/* Search & Quick Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search item, code, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              + Location
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              + Rack
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">CODE</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">ITEM NAME</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">TYPE</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">ZONE/RACK</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">WH STOCK</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">ML1 STOCK</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">ML2 STOCK</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">IN HAND</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">RESERVED</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">TRANSIT</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">REORDER</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">AVG/MO</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                  <td className="px-2 py-2 font-mono text-blue-600 font-semibold text-xs">{item.code}</td>
                  <td className="px-2 py-2">
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{item.itemName}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block whitespace-nowrap ${getTypeColor(item.type)}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.972 1.972 0 013 12.172V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-gray-700 text-xs">
                        Zone {item.zone}<br /><span className="text-xs text-gray-500">{item.rack}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded font-semibold text-xs border border-teal-200 inline-block whitespace-nowrap">
                      {item.whStock}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-semibold text-xs border border-blue-200 inline-block">
                      {item.ml1Stock}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded font-semibold text-xs border border-purple-200 inline-block">
                      {item.ml2Stock}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded font-semibold text-xs border border-emerald-200 inline-block whitespace-nowrap">
                      {item.stockInHand}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded font-semibold text-xs border border-orange-200 inline-block whitespace-nowrap">
                      {item.reserved}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-semibold text-xs border border-indigo-200 inline-block">
                      {item.inTransit}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600 font-medium text-xs">{item.reorderPt}</td>
                  <td className="px-2 py-2 text-center text-gray-600 font-medium text-xs">{item.avgMo}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block whitespace-nowrap ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Results Info */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <p>Showing {filteredData.length} of {INVENTORY_DATA.length} items</p>
          <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors">
            Load More
          </button>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseInventory;
