import React, { useState, useMemo, useEffect } from 'react';
import { fetchWarehouseInventory } from '../services/warehouseInventory.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

const WarehouseInventory: React.FC = () => {
  const [filterType, setFilterType] = useState<'All' | 'RM' | 'PM' | 'FG/PR' | 'Low'>('All');
  const [itemGroupFilter, setItemGroupFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryData, setInventoryData] = useState<WarehouseInventoryRow[]>([]);
  const [itemGroups, setItemGroups] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWarehouseInventory()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setInventoryData(res.data.rows);
          setItemGroups(
            (res.data.itemGroups ?? []).map((g) => ({
              id: String(g.id),
              code: g.code,
              name: g.name || g.code,
            }))
          );
        } else {
          setInventoryData([]);
          setError(res.error || 'Failed to load inventory');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInventoryData([]);
          setError('Failed to load inventory');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredData = useMemo(() => {
    let filtered = inventoryData;
    if (filterType === 'RM') filtered = filtered.filter((item) => item.type === 'RM');
    else if (filterType === 'PM') filtered = filtered.filter((item) => item.type === 'PM');
    else if (filterType === 'FG/PR') filtered = filtered.filter((item) => item.type === 'FG/PR');
    else if (filterType === 'Low') filtered = filtered.filter((item) => item.status === 'Low Stock' || item.status === 'Critical');
    if (itemGroupFilter) {
      filtered = filtered.filter((item) => item.itemGroupCodes.includes(itemGroupFilter));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.code.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term) ||
          item.subtitle.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [filterType, itemGroupFilter, searchTerm, inventoryData]);

  const kpis = useMemo(
    () => ({
      totalSKUs: inventoryData.length,
      inStock: inventoryData.filter((item) => item.status === 'In Stock').length,
      lowStock: inventoryData.filter((item) => item.status === 'Low Stock').length,
      criticalOut: inventoryData.filter((item) => item.status === 'Critical').length,
      fgUnderQC: 0,
      inTransit: inventoryData.reduce((sum, item) => sum + item.inTransit, 0),
    }),
    [inventoryData]
  );

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
                { label: 'All', value: 'All' as const, count: inventoryData.length },
                { label: 'RM', value: 'RM' as const, count: inventoryData.filter((i) => i.type === 'RM').length },
                { label: 'PM', value: 'PM' as const, count: inventoryData.filter((i) => i.type === 'PM').length },
                { label: 'FG/PR', value: 'FG/PR' as const, count: inventoryData.filter((i) => i.type === 'FG/PR').length },
                { label: '△ Low', value: 'Low' as const, count: inventoryData.filter((i) => i.status === 'Low Stock' || i.status === 'Critical').length },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filterType === filter.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>

          {/* Search, Item group filter & Actions */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search item, code, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <select
              value={itemGroupFilter}
              onChange={(e) => setItemGroupFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]"
            >
              <option value="">All item groups</option>
              {itemGroups.map((g) => (
                <option key={g.id} value={g.code}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
            <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              + Location
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              + Rack
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <TableSkeleton rows={8} cols={14} />
        )}
        {error && !loading && (
          <ErrorState message={error} />
        )}
        {!loading && !error && (
        <div className="w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">CODE</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">ITEM NAME</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">TYPE</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">ITEM GROUPS</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">ZONE/RACK</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">WH STOCK</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">ML1 STOCK</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">ML2 STOCK</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">IN TRANSIT</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">IN HAND</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">RESERVED</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">REORDER</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">AVG/MO</th>
                <th scope="col" className="px-2 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                  <td className="px-2 py-2 font-mono text-blue-600 font-semibold text-xs">{item.code}</td>
                  <td className="px-2 py-2">
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.subtitle}</p>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block whitespace-nowrap ${getTypeColor(item.type)}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.itemGroupNames.length > 0
                        ? item.itemGroupNames.map((gn) => (
                            <span key={gn} className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-medium">
                              {gn}
                            </span>
                          ))
                        : <span className="text-gray-400 text-[10px]">—</span>}
                    </div>
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
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-semibold text-xs border border-indigo-200 inline-block">
                      {item.inTransit}
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

        {/* Results Info */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <p>Showing {filteredData.length} of {inventoryData.length} items</p>
        </div>
        </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseInventory;
