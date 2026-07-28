import { useState, useEffect } from 'react';
import ZoneDetailsSidebar from './ZoneDetailsSidebar';
import { fetchWarehouseLocationById, type WarehouseLocationDTO } from '../../services/warehouseLocations.service';
import {
  fetchWarehouseOverview,
  type WarehouseOverviewKpi,
  type WarehouseOverviewZone,
  type WarehouseRecentActivityItem,
  type OpenGrnItem,
  type WarehouseLowStockItem,
} from '../../services/warehouseOverview.service';

type KpiCard = WarehouseOverviewKpi;
type Zone = WarehouseOverviewZone;
type ActivityItem = WarehouseRecentActivityItem;

const Overview = () => {
  // Landing loads ONLY the lightweight summary (counts, zone summaries, recent activity, open GRNs,
  // top low-stock). Granular rack/stock data is fetched lazily when a zone is opened.
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [openGRNs, setOpenGRNs] = useState<OpenGrnItem[]>([]);
  const [lowCriticalItems, setLowCriticalItems] = useState<WarehouseLowStockItem[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<{
    id: string;
    name: string;
    type: string;
    location: string;
    utilization: number;
    items: number;
    racks: number;
  } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocationDTO | null>(null);
  const [zoneDetailLoading, setZoneDetailLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchWarehouseOverview();
        if (cancelled || !data) return;
        setKpis(data.kpis ?? []);
        setZones(data.zones ?? []);
        setRecentActivity(data.recentActivity ?? []);
        setOpenGRNs(data.openGrns ?? []);
        setLowCriticalItems(data.lowStockItems ?? []);
        setAlertCount(data.alertCount ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleOpenZone = async (zone: Zone) => {
    setSelectedZone({
      id: zone.id,
      name: zone.name,
      type: zone.title,
      location: zone.footprint,
      utilization: zone.utilization,
      items: zone.items,
      racks: zone.racks,
    });
    setSelectedItemId(null);
    setSelectedLocation(null);
    // Lazily load the granular rack/stock data for just this zone (id is "zone-<locationId>").
    const locId = zone.id.replace(/^zone-/, '');
    setZoneDetailLoading(true);
    try {
      const res = await fetchWarehouseLocationById(locId);
      if (res.success && res.data) setSelectedLocation(res.data);
    } finally {
      setZoneDetailLoading(false);
    }
  };

  const handleCloseZone = () => {
    setSelectedZone(null);
    setSelectedLocation(null);
    setSelectedItemId(null);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-white p-6 flex items-center justify-center">
        <p className="text-slate-600">Loading warehouse overview…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white p-6 relative">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Warehouse Overview</h1>
            <p className="mt-1 text-sm text-slate-500">Live snapshot of warehouse zones, inventory movement, GRNs and material requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {alertCount} alerts
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              Hyderabad Plant 1
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map(card => (
            <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between min-h-27.5">
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

        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Warehouse Zones — Utilisation</h2>
            <p className="text-xs text-slate-500 mt-1">Zone-wise capacity, alerts and utilization across the warehouse.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {zones.map(zone => (
              <button
                key={zone.id}
                type="button"
                onClick={() => handleOpenZone(zone)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 text-left hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
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
                      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${zone.utilization}%` }} />
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
                  <span className="mb-1 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-100">{zone.footprint}</span>
                  {zone.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3 items-start">
          <div className="xl:col-span-2 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${item.type === 'grn' ? 'bg-sky-500' : item.type === 'mrn' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
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

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Low / Critical Stock</h2>
              </div>
              {lowCriticalItems.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400">All items currently within safe inventory range.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {lowCriticalItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.code}</p>
                        <p className="text-[11px] text-slate-500 truncate">{item.name} · {item.stockInHand} {item.whUnit} (reorder {item.reorderPt})</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Open GRNs</h2>
              </div>
              {openGRNs.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400">No open GRNs.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {openGRNs.slice(0, 5).map((g) => (
                    <div key={g.id} className="flex items-center px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{g.grnNo}</p>
                        <p className="text-[11px] text-slate-500 truncate">{g.poNo} · {g.vendor}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-100">{g.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedZone && (
        <ZoneDetailsSidebar
          zone={selectedZone}
          location={selectedLocation}
          loading={zoneDetailLoading}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onClearSelectedItem={() => setSelectedItemId(null)}
          onClose={handleCloseZone}
        />
      )}
    </div>
  );
};

export default Overview;
