import { useState, useEffect } from 'react';
import ZoneDetailsSidebar from './ZoneDetailsSidebar';
import { CardSkeleton } from '../../components/ui/Skeleton';
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
      <div className="flex-1 overflow-auto bg-surface p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="mt-6 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6 relative">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-ink">Warehouse Overview</h1>
            <p className="mt-1 text-sm text-ink-3">Live snapshot of warehouse zones, inventory movement, GRNs and material requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-warn-soft bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
                <span className="h-2 w-2 rounded-full bg-warn" />
                {alertCount} alerts
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-sm">
              Hyderabad Plant 1
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map(card => (
            <div key={card.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between min-h-27.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{card.value}</p>
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
            <h2 className="text-base font-semibold text-ink">Warehouse Zones — Utilisation</h2>
            <p className="text-xs text-ink-3 mt-1">Zone-wise capacity, alerts and utilization across the warehouse.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {zones.map(zone => (
              <button
                key={zone.id}
                type="button"
                onClick={() => handleOpenZone(zone)}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col gap-3 text-left hover:border-ok hover:bg-ok-soft/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">{zone.name}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{zone.title}</p>
                    <p className="mt-1 text-xs text-ink-3 max-w-xs">{zone.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-ok">{zone.utilization}%</span>
                    <div className="relative h-1.5 w-20 rounded-full bg-surface-3">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${zone.utilization}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-4">Utilisation</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-ink-4">Items</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{zone.items}</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-ink-4">Racks</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{zone.racks}</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                    <p className="text-[10px] font-medium text-ink-4">Alerts</p>
                    <p className="mt-0.5 text-sm font-semibold text-ok">{zone.alerts}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="mb-1 inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-3 border border-hairline">{zone.footprint}</span>
                  {zone.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-medium text-ok border border-ok-soft">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3 items-start">
          <div className="xl:col-span-2 space-y-3">
            <h2 className="text-base font-semibold text-ink">Recent Activity</h2>
            <div className="rounded-2xl border border-border bg-surface shadow-sm divide-y divide-hairline">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${item.type === 'grn' ? 'bg-brand' : item.type === 'mrn' ? 'bg-brand' : 'bg-brand'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                      <span className="text-[11px] text-ink-4 whitespace-nowrap">{item.meta}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3 truncate">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Low / Critical Stock</h2>
              </div>
              {lowCriticalItems.length === 0 ? (
                <div className="px-4 py-3 text-xs text-ink-4">All items currently within safe inventory range.</div>
              ) : (
                <div className="divide-y divide-hairline text-xs">
                  {lowCriticalItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{item.code}</p>
                        <p className="text-[11px] text-ink-3 truncate">{item.name} · {item.stockInHand} {item.whUnit} (reorder {item.reorderPt})</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn border border-warn-soft">{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Open GRNs</h2>
              </div>
              {openGRNs.length === 0 ? (
                <div className="px-4 py-3 text-xs text-ink-4">No open GRNs.</div>
              ) : (
                <div className="divide-y divide-hairline text-xs">
                  {openGRNs.slice(0, 5).map((g) => (
                    <div key={g.id} className="flex items-center px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{g.grnNo}</p>
                        <p className="text-[11px] text-ink-3 truncate">{g.poNo} · {g.vendor}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand border border-brand-soft">{g.status}</span>
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
