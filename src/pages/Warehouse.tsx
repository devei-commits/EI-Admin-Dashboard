import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CardSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import WarehouseSidebar from '../components/WarehouseSidebar';
import WarehouseInventory from './WarehouseInventory';
import { fetchWarehouseOverview } from '../services/warehouseOverview.service';
import type { WarehouseOverviewKpi, WarehouseOverviewZone, WarehouseRecentActivityItem } from '../services/warehouseOverview.service';

const Warehouse: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'overview' | 'inventory' | 'grn' | 'stock-requests' | 'locations'>('overview');

  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useQuery({
    queryKey: ['warehouse-overview'],
    queryFn: async () => {
      const data = await fetchWarehouseOverview();
      if (data == null) throw new Error('Failed to load overview');
      return data;
    },
    enabled: activeView === 'overview',
  });

  const kpis: WarehouseOverviewKpi[] = overview?.kpis ?? [];
  const zones: WarehouseOverviewZone[] = overview?.zones ?? [];
  const recentActivity: WarehouseRecentActivityItem[] = overview?.recentActivity ?? [];
  const openGrns = overview?.openGrns ?? [];
  const alertCount = overview?.alertCount ?? 0;

  const handleTopNavClick = (target: string) => {
    setActiveView(target as typeof activeView);
    
    // Navigate to external routes if needed
    switch (target) {
      case 'grn':
        navigate('/procurement');
        break;
      case 'stock-requests':
        navigate('/procurement');
        break;
      case 'locations':
        navigate('/item-groups');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-row min-h-screen bg-background">
      <WarehouseSidebar activeSection={activeView} onSectionChange={(id) => handleTopNavClick(id)} />
      <div className="flex-1 pt-14 md:pt-0 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Warehouse Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live snapshot of warehouse zones, inventory movement, GRNs and material requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {alertCount > 0 && (
            <button
              type="button"
              onClick={() => handleTopNavClick('inventory')}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {alertCount} alert{alertCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
          >
            Hyderabad Plant 1
          </button>
        </div>
        </div>

        {/* Top navigation pills */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'inventory', label: 'Inventory' },
          { id: 'grn', label: 'GRN' },
          { id: 'stock-requests', label: 'Stock Requests' },
          { id: 'locations', label: 'Locations' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTopNavClick(tab.id)}
            type="button"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${activeView === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}
            `}
          >
            {tab.label}
          </button>
        ))}
        </div>

        {/* Conditional content rendering */}
        {activeView === 'inventory' ? (
          <WarehouseInventory />
        ) : overviewLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : overviewError ? (
          <ErrorState message="Failed to load warehouse overview. Please try again." />
        ) : (
        <>
        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map(card => (
          <div
            key={card.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between min-h-27.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
              <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border ${card.accentColor}`}>
                {card.subtitle}
              </div>
            </div>
          </div>
        ))}
        </div>

        {/* Zones */}
        <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Warehouse Zones — Utilisation</h2>
            <p className="text-xs text-slate-500 mt-1">
              Zone-wise capacity, alerts and utilization across the warehouse.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleTopNavClick('locations')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Manage Locations
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {zones.map(zone => (
            <div
              key={zone.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{zone.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{zone.title}</p>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">{zone.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-semibold text-emerald-600">{zone.utilization}%</span>
                  <div className="relative h-1.5 w-20 rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                      style={{ width: `${zone.utilization}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Utilisation</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] font-medium text-slate-400">Items</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{zone.items}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] font-medium text-slate-400">Racks</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{zone.racks}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] font-medium text-slate-400">Alerts</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">{zone.alerts}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="mb-1 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-100">
                  {zone.footprint}
                </span>
                {zone.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom section: activity + side tables */}
      <div className="grid gap-4 xl:grid-cols-3 items-start">
        {/* Recent Activity */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0
                    ${item.type === 'grn' ? 'bg-sky-500' : item.type === 'mrn' ? 'bg-indigo-500' : 'bg-amber-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.meta}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Low stock + Open GRNs */}
        <div className="space-y-4">
          {/* Low / Critical Stock */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Low / Critical Stock</h2>
              <button
                type="button"
                onClick={() => handleTopNavClick('inventory')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                View All
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-slate-400">All items currently within safe inventory range.</div>
          </div>

          {/* Open GRNs */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Open GRNs</h2>
              <button
                type="button"
                onClick={() => handleTopNavClick('grn')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {openGrns.length === 0 ? (
                <div className="px-4 py-3 text-slate-400">No open GRNs.</div>
              ) : (
                openGrns.map((grn) => (
                  <div key={grn.id} className="flex items-center px-4 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{grn.grnNo}</p>
                      <p className="text-[11px] text-slate-500 truncate">{grn.poNo}{grn.vendor ? ` · ${grn.vendor}` : ''}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                      grn.status === 'In Transit' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {grn.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
        </>
        )}
        </div>
      </div>
    </div>
  );
};

export default Warehouse;
