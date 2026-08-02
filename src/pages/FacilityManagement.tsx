import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchFacilityAreas,
  createFacilityArea,
  createZone,
  createRack,
  setZoneAsDefault,
  type FacilityAreaDTO,
  type ZoneDTO,
  type RackDTO,
} from '../services/facilityAreas.service';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ModalOverlay } from '../components/ui/ModalOverlay';

const AREA_FORM_EMPTY = { code: '', name: '', area_type: 'warehouse' as 'warehouse' | 'production', icon: '', description: '' };
const ZONE_FORM_EMPTY = { code: '', name: '', zone_label: '', icon: '', area_sqm: '', description: '' };
const RACK_FORM_EMPTY = { code: '', name: '', description: '', levels: '4', slots_total: '16' };

type AreaForm = typeof AREA_FORM_EMPTY;
type ZoneForm = typeof ZONE_FORM_EMPTY;
type RackForm = typeof RACK_FORM_EMPTY;
type ZoneSortColumn = 'code' | 'name' | 'status' | 'label' | 'areaSqm' | 'racks' | 'default' | 'description';
type RackSortColumn = 'code' | 'name' | 'levels' | 'slots' | 'capacity' | 'description';

function compareSortValues(av: string | number, bv: string | number, direction: SortDirection): number {
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  return direction === 'asc' ? cmp : -cmp;
}

function sortValueForZone(zone: ZoneDTO, col: ZoneSortColumn): string | number {
  switch (col) {
    case 'code':
      return zone.code || '';
    case 'name':
      return zone.name || '';
    case 'status':
      return zone.isActive === false ? 0 : 1;
    case 'label':
      return zone.zoneLabel || '';
    case 'areaSqm':
      return zone.areaSqm ?? -1;
    case 'racks':
      return zone.racks?.length ?? 0;
    case 'default':
      return zone.isDefault ? 1 : 0;
    case 'description':
      return zone.description || '';
    default:
      return '';
  }
}

function sortValueForRack(rack: RackDTO, col: RackSortColumn): string | number {
  switch (col) {
    case 'code':
      return rack.code || '';
    case 'name':
      return rack.name || '';
    case 'levels':
      return rack.levels ?? 0;
    case 'slots':
      return rack.slotsTotal ?? 0;
    case 'capacity':
      return (rack.levels ?? 0) * (rack.slotsTotal ?? 0);
    case 'description':
      return rack.description || '';
    default:
      return '';
  }
}

function sortRows<T, C extends string>(
  rows: T[],
  col: C | null,
  direction: SortDirection,
  getValue: (row: T, column: C) => string | number,
  tieBreak: (a: T, b: T) => number
): T[] {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const cmp = compareSortValues(getValue(a, col), getValue(b, col), direction);
    if (cmp !== 0) return cmp;
    return tieBreak(a, b);
  });
}

function countRacksInArea(area: FacilityAreaDTO): number {
  return (area.zones || []).reduce((sum, z) => sum + (z.racks?.length ?? 0), 0);
}

function defaultZonesInAreas(areaList: FacilityAreaDTO[]): ZoneDTO[] {
  return areaList.flatMap((a) => (a.zones || []).filter((z) => z.isDefault));
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint: string;
  tone?: 'neutral' | 'warehouse' | 'production' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'border-border bg-surface',
    warehouse: 'border-brand bg-brand-soft/50',
    production: 'border-warn bg-warn-soft/50',
    warning: 'border-warn bg-warn-soft',
  };
  const valueClasses = {
    neutral: 'text-ink',
    warehouse: 'text-brand',
    production: 'text-warn',
    warning: 'text-warn',
  };
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClasses[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-2 leading-snug">{hint}</p>
    </div>
  );
};

const FacilityManagement: React.FC = () => {
  const { addToast } = useToast();

  const [areas, setAreas] = useState<FacilityAreaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [facilityGroup, setFacilityGroup] = useState<'warehouse' | 'production'>('warehouse');

  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState<AreaForm>({ ...AREA_FORM_EMPTY });
  const [areaSaving, setAreaSaving] = useState(false);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneForm, setZoneForm] = useState<ZoneForm>({ ...ZONE_FORM_EMPTY });
  const [zoneSaving, setZoneSaving] = useState(false);

  const [showRackModal, setShowRackModal] = useState(false);
  const [rackForm, setRackForm] = useState<RackForm>({ ...RACK_FORM_EMPTY });
  const [rackSaving, setRackSaving] = useState(false);
  const [rackZone, setRackZone] = useState<ZoneDTO | null>(null);
  const [defaultSavingZoneId, setDefaultSavingZoneId] = useState<number | null>(null);
  const [zoneSortColumn, setZoneSortColumn] = useState<ZoneSortColumn | null>(null);
  const [zoneSortDirection, setZoneSortDirection] = useState<SortDirection>('asc');
  const [rackSortColumn, setRackSortColumn] = useState<RackSortColumn | null>(null);
  const [rackSortDirection, setRackSortDirection] = useState<SortDirection>('asc');

  const loadAreas = useCallback(async () => {
    setLoading(true);
    const res = await fetchFacilityAreas();
    if (res.success) setAreas(res.data);
    else addToast('error', res.error || 'Failed to load areas');
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const warehouseAreas = useMemo(
    () => areas.filter((a) => a.areaType === 'warehouse'),
    [areas]
  );
  const manufacturingAreas = useMemo(
    () => areas.filter((a) => a.areaType === 'production' && a.code !== 'AREA-MU'),
    [areas]
  );
  const groupAreas = facilityGroup === 'warehouse' ? warehouseAreas : manufacturingAreas;

  useEffect(() => {
    if (loading) return;
    const inGroup = groupAreas.some((a) => a.id === selectedAreaId);
    if (!inGroup && groupAreas.length > 0) setSelectedAreaId(groupAreas[0].id);
    else if (!inGroup) setSelectedAreaId(null);
  }, [loading, facilityGroup, groupAreas, selectedAreaId]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  useEffect(() => {
    if (!selectedArea) {
      setSelectedZoneId(null);
      return;
    }
    const zoneStillValid = selectedArea.zones.some((z) => z.id === selectedZoneId);
    if (!zoneStillValid) setSelectedZoneId(null);
  }, [selectedArea, selectedZoneId]);

  const selectedZone =
    selectedArea?.zones.find((z) => z.id === selectedZoneId) ?? null;

  useEffect(() => {
    setZoneSortColumn(null);
    setZoneSortDirection('asc');
  }, [selectedAreaId]);

  useEffect(() => {
    setRackSortColumn(null);
    setRackSortDirection('asc');
  }, [selectedZoneId]);

  const sortedZones = useMemo(() => {
    if (!selectedArea) return [];
    return sortRows(
      selectedArea.zones,
      zoneSortColumn,
      zoneSortDirection,
      sortValueForZone,
      (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [selectedArea, zoneSortColumn, zoneSortDirection]);

  const sortedRacks = useMemo(() => {
    if (!selectedZone) return [];
    return sortRows(
      selectedZone.racks ?? [],
      rackSortColumn,
      rackSortDirection,
      sortValueForRack,
      (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [selectedZone, rackSortColumn, rackSortDirection]);

  const stats = useMemo(() => {
    const zoneCount = areas.reduce((s, a) => s + (a.zones?.length ?? 0), 0);
    const rackCount = areas.reduce((s, a) => s + countRacksInArea(a), 0);
    const whDefaults = defaultZonesInAreas(warehouseAreas);
    const prodDefaults = defaultZonesInAreas(manufacturingAreas);
    return {
      areaCount: areas.length,
      zoneCount,
      rackCount,
      whDefaultOk: whDefaults.length === 1,
      whDefaultLabel:
        whDefaults.length === 1
          ? `${whDefaults[0].name} (${whDefaults[0].code})`
          : whDefaults.length === 0
            ? 'Not configured'
            : 'Multiple defaults',
      prodDefaultOk: prodDefaults.length === 1,
      prodDefaultLabel:
        prodDefaults.length === 1
          ? `${prodDefaults[0].name} (${prodDefaults[0].code})`
          : prodDefaults.length === 0
            ? 'Not configured'
            : 'Multiple defaults',
    };
  }, [areas, warehouseAreas, manufacturingAreas]);

  const warehouseDefaultZones = useMemo(
    () => warehouseAreas.flatMap((a) => a.zones).filter((z) => z.isDefault),
    [warehouseAreas]
  );

  const openCreateArea = (presetType?: 'warehouse' | 'production') => {
    setAreaForm({
      ...AREA_FORM_EMPTY,
      area_type: presetType ?? facilityGroup,
    });
    setShowAreaModal(true);
  };

  const saveArea = async () => {
    if (!areaForm.code.trim() || !areaForm.name.trim()) {
      addToast('error', 'Code and Name are required');
      return;
    }
    setAreaSaving(true);
    const res = await createFacilityArea({
      code: areaForm.code.trim(),
      name: areaForm.name.trim(),
      area_type: areaForm.area_type,
      icon: areaForm.icon || undefined,
      description: areaForm.description || undefined,
    });
    setAreaSaving(false);
    setShowAreaModal(false);
    if (res.success) addToast('success', 'Area created');
    else addToast('error', res.error || 'Create failed');
    loadAreas();
  };

  const openCreateZone = () => {
    if (!selectedArea) return;
    setZoneForm({ ...ZONE_FORM_EMPTY });
    setShowZoneModal(true);
  };

  const saveZone = async () => {
    if (!selectedArea) return;
    if (!zoneForm.code.trim() || !zoneForm.name.trim()) {
      addToast('error', 'Code and Name are required');
      return;
    }
    setZoneSaving(true);
    const res = await createZone({
      code: zoneForm.code.trim(),
      name: zoneForm.name.trim(),
      area_id: selectedArea.id,
      location_type: selectedArea.areaType,
      zone_label: zoneForm.zone_label || undefined,
      icon: zoneForm.icon || undefined,
      area_sqm: zoneForm.area_sqm ? parseInt(zoneForm.area_sqm, 10) : undefined,
      description: zoneForm.description || undefined,
    });
    setZoneSaving(false);
    setShowZoneModal(false);
    if (res.success) addToast('success', 'Zone created');
    else addToast('error', res.error || 'Create failed');
    loadAreas();
  };

  const openCreateRack = (zone: ZoneDTO) => {
    setRackZone(zone);
    setRackForm({ ...RACK_FORM_EMPTY });
    setShowRackModal(true);
  };

  const saveRack = async () => {
    if (!rackZone) return;
    if (!rackForm.code.trim()) {
      addToast('error', 'Rack code is required');
      return;
    }
    setRackSaving(true);
    const res = await createRack({
      location_id: rackZone.id,
      code: rackForm.code.trim(),
      name: rackForm.name.trim() || undefined,
      description: rackForm.description.trim() || undefined,
      levels: rackForm.levels ? parseInt(rackForm.levels, 10) : 4,
      slots_total: rackForm.slots_total ? parseInt(rackForm.slots_total, 10) : 16,
    });
    setRackSaving(false);
    setShowRackModal(false);
    setRackZone(null);
    if (res.success) addToast('success', 'Rack created');
    else addToast('error', res.error || 'Create failed');
    loadAreas();
  };

  const handleSetDefaultZone = async (zone: ZoneDTO) => {
    if (zone.isDefault) return;
    setDefaultSavingZoneId(zone.id);
    const res = await setZoneAsDefault(zone.id);
    setDefaultSavingZoneId(null);
    if (res.success) {
      addToast(
        'success',
        `"${zone.name}" is now the default ${zone.locationType === 'production' ? 'manufacturing (MTR receive)' : 'warehouse (GRN inbound)'} zone.`
      );
      loadAreas();
    } else {
      addToast('error', res.error || 'Failed to set default');
    }
  };

  const selectArea = (area: FacilityAreaDTO) => {
    setFacilityGroup(area.areaType === 'production' ? 'production' : 'warehouse');
    setSelectedAreaId(area.id);
    setSelectedZoneId(null);
  };

  const selectZone = (zone: ZoneDTO) => {
    setSelectedZoneId(zone.id);
  };

  const goBackToZones = () => {
    setSelectedZoneId(null);
  };

  const toggleZoneSort = (column: ZoneSortColumn) => {
    if (zoneSortColumn === column) {
      setZoneSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setZoneSortColumn(column);
    setZoneSortDirection('asc');
  };

  const toggleRackSort = (column: RackSortColumn) => {
    if (rackSortColumn === column) {
      setRackSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setRackSortColumn(column);
    setRackSortDirection('asc');
  };

  const renderAreaNavItem = (area: FacilityAreaDTO) => {
    const zoneCount = area.zones.length;
    const rackCount = countRacksInArea(area);
    const isSelected = selectedAreaId === area.id;
    const isWh = area.areaType === 'warehouse';

    return (
      <button
        key={area.id}
        type="button"
        onClick={() => selectArea(area)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 ${
          isSelected
            ? isWh
              ? 'border-brand bg-brand-soft shadow-sm'
              : 'border-warn bg-warn-soft shadow-sm'
            : 'border-border bg-surface hover:border-border hover:bg-surface-2/80'
        }`}
      >
        <span className="text-base" aria-hidden>
          {area.icon || (isWh ? '🏭' : '⚙️')}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-sm text-ink truncate">{area.name}</span>
          <span className="block font-mono text-xs text-ink-3">
            {area.code} · {zoneCount}z · {rackCount}r
          </span>
        </span>
      </button>
    );
  };

  const switchFacilityGroup = (group: 'warehouse' | 'production') => {
    setFacilityGroup(group);
    setSelectedZoneId(null);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-bold text-ink">Facility Management</h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Define where stock lives in your operation: <strong>areas</strong> group buildings or sites,{' '}
            <strong>zones</strong> are stores or ML lines, and <strong>racks</strong> are physical putaway slots.
            Defaults drive GRN inbound and MTR transfers automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateArea()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-xl text-sm font-medium hover:bg-ink transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add area
        </button>
      </header>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : (
        <>
          {/* Overview */}
          <section aria-labelledby="facility-overview-heading">
            <h2 id="facility-overview-heading" className="sr-only">
              Facility overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Areas" value={stats.areaCount} hint="Warehouse + manufacturing buildings" />
              <StatCard label="Zones" value={stats.zoneCount} hint="Stores, ML lines, and storage rooms" />
              <StatCard
                label="Racks"
                value={stats.rackCount}
                hint="Putaway locations inside each zone"
              />
              <StatCard
                label="GRN default"
                value={stats.whDefaultLabel}
                hint="Where inbound goods receipt posts stock"
                tone={stats.whDefaultOk ? 'warehouse' : 'warning'}
              />
            </div>
          </section>

          {/* How it works */}
          <section
            className="rounded-xl border border-border bg-surface-2/60 p-5"
            aria-labelledby="facility-hierarchy-heading"
          >
            <h2 id="facility-hierarchy-heading" className="text-sm font-semibold text-ink">
              How locations are used
            </h2>
            <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  1
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">Warehouse areas</p>
                  <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                    RM, PM, and FG zones. One zone must be the <strong>GRN default</strong> — all inbound receipts
                    post there (DEFAULT rack if none specified).
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warn-soft text-sm font-bold text-warn">
                  2
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">Manufacturing units</p>
                  <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                    ML1 / ML2 zones per unit. Set an <strong>MTR default</strong> for transfers from warehouse when
                    Send MTR does not pick a destination.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-bold text-ink">
                  3
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">Area → Zone → Rack</p>
                  <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                    Pick an area below, then click a zone to view its racks. Codes appear on labels,
                    pick lists, and transfer orders.
                  </p>
                </div>
              </li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-ink-2">
                <span className="font-semibold text-warn">GRN default</span>
                {stats.whDefaultLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-ink-2">
                <span className="font-semibold text-warn">MTR default</span>
                {stats.prodDefaultLabel}
              </span>
            </div>
          </section>

          {/* Full-width layout */}
          <div className="space-y-4 w-full">
            <div className="rounded-xl border border-border bg-surface overflow-hidden w-full">
              <div className="px-4 py-3 border-b border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-lg border border-border p-0.5 flex">
                    <button
                      type="button"
                      onClick={() => switchFacilityGroup('warehouse')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border ${
                        facilityGroup === 'warehouse'
                          ? 'bg-brand text-white'
                          : 'text-ink-2 hover:bg-surface-2'
                      }`}
                    >
                      Warehouse
                    </button>
                    <button
                      type="button"
                      onClick={() => switchFacilityGroup('production')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border ${
                        facilityGroup === 'production'
                          ? 'bg-warn text-white'
                          : 'text-ink-2 hover:bg-surface-2'
                      }`}
                    >
                      Manufacturing
                    </button>
                  </div>
                  <span className="text-xs text-ink-3 hidden sm:inline">
                    {facilityGroup === 'warehouse'
                      ? 'GRN · storage · outbound pick'
                      : 'MTR receive · batch ML stock'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateArea(facilityGroup)}
                  className="text-sm font-medium text-ink-2 border border-border rounded-lg px-3 py-1.5 hover:bg-surface-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-border"
                >
                  + Add area
                </button>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {groupAreas.length === 0 ? (
                  <p className="text-sm text-ink-4 py-2 px-1">
                    No {facilityGroup === 'warehouse' ? 'warehouse' : 'manufacturing'} areas yet.{' '}
                    <button
                      type="button"
                      onClick={() => openCreateArea(facilityGroup)}
                      className="text-ink font-medium underline"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  groupAreas.map(renderAreaNavItem)
                )}
              </div>
            </div>

            {selectedArea ? (
              <div className="space-y-4 w-full">
                <div className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0" aria-hidden>
                      {selectedArea.icon || (selectedArea.areaType === 'warehouse' ? '🏭' : '⚙️')}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-ink truncate">{selectedArea.name}</h2>
                      <p className="font-mono text-xs text-ink-3">
                        {selectedArea.code} · {selectedArea.zones.length} zones ·{' '}
                        {countRacksInArea(selectedArea)} racks
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateZone}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
                  >
                    Add zone
                  </button>
                </div>

                  {selectedArea.areaType === 'warehouse' && warehouseDefaultZones.length !== 1 && (
                    <div
                      role="alert"
                      className={`rounded-xl px-4 py-3 text-sm border ${
                        warehouseDefaultZones.length === 0
                          ? 'bg-warn-soft text-warn border-warn'
                          : 'bg-err-soft text-err border-err'
                      }`}
                    >
                      {warehouseDefaultZones.length === 0 ? (
                        <>
                          <strong>GRN default missing.</strong> Inbound goods receipt needs exactly one warehouse
                          zone marked as default. Use &quot;Set as GRN default zone&quot; on the correct zone (e.g. RM
                          Store).
                        </>
                      ) : (
                        <>
                          <strong>Multiple GRN defaults.</strong> Only one warehouse zone may be default (
                          {warehouseDefaultZones.map((z) => z.code).join(', ')}). Fix by setting default on the
                          correct zone again.
                        </>
                      )}
                    </div>
                  )}

                  {selectedArea.areaType === 'warehouse' && warehouseDefaultZones.length === 1 && (
                    <p className="text-sm text-brand bg-brand-soft border border-brand rounded-xl px-4 py-3">
                      Inbound <strong>GRN</strong> posts to{' '}
                      <span className="font-mono">{warehouseDefaultZones[0].code}</span> —{' '}
                      {warehouseDefaultZones[0].name}.
                    </p>
                  )}

                  {selectedArea.areaType === 'production' && (
                    <p className="text-sm text-warn bg-warn-soft border border-warn rounded-xl px-4 py-3">
                      Outbound <strong>MTR</strong> transfers should specify Transfer To (ML zone) in Production.
                      The facility <strong>MTR default</strong> zone applies when that field is left empty:{' '}
                      <span className="font-medium">{stats.prodDefaultLabel}</span>.
                    </p>
                  )}

                  {selectedArea.zones.length === 0 ? (
                    <EmptyState
                      className="rounded-xl border border-dashed border-border bg-surface-2/50"
                      title="This area has no zones yet."
                      action={
                        <button
                          type="button"
                          onClick={openCreateZone}
                          className="text-sm font-medium text-ink underline focus:outline-none focus-visible:ring-2 focus-visible:ring-border rounded"
                        >
                          Create the first zone
                        </button>
                      }
                    />
                  ) : (
                    <div className="rounded-xl border border-border bg-surface overflow-hidden w-full">
                      <div className="px-4 py-3 border-b border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-3 mb-1" aria-label="Breadcrumb">
                            {selectedZone ? (
                              <button
                                type="button"
                                onClick={goBackToZones}
                                className="text-ink-2 font-medium hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-border rounded"
                              >
                                {selectedArea.name}
                              </button>
                            ) : (
                              <span className="text-ink font-semibold">{selectedArea.name}</span>
                            )}
                            {selectedZone && (
                              <>
                                <span aria-hidden>/</span>
                                <span className="text-ink font-semibold truncate">{selectedZone.name}</span>
                              </>
                            )}
                          </nav>
                          <h3 className="text-sm font-semibold text-ink">
                            {selectedZone
                              ? `Racks — ${selectedZone.code}`
                              : `Zones — ${selectedArea.name}`}
                          </h3>
                          <p className="text-xs text-ink-3 mt-0.5">
                            {selectedZone
                              ? 'Putaway slots in this zone'
                              : 'Click a zone row to view its racks'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {selectedZone ? (
                            <>
                              <button
                                type="button"
                                onClick={goBackToZones}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-ink-2 rounded-lg text-xs font-medium hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to zones
                              </button>
                              <button
                                type="button"
                                onClick={() => openCreateRack(selectedZone)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-lg text-xs font-medium hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
                              >
                                Add rack
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-ink-3">
                              {selectedArea.zones.length} zone{selectedArea.zones.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="overflow-auto max-h-[70vh]">
                        {!selectedZone ? (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20">
                              <tr className="[&_th]:bg-surface-2 bg-surface-2/80 border-b border-hairline">
                                <th scope="col" className="px-4 py-3 font-medium w-10" />
                                <SortableTableTh
                                  label="Code"
                                  column="code"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Name"
                                  column="name"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Status"
                                  column="status"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Label"
                                  column="label"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Area"
                                  column="areaSqm"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Racks"
                                  column="racks"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Default"
                                  column="default"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                                <SortableTableTh
                                  label="Description"
                                  column="description"
                                  sortColumn={zoneSortColumn}
                                  sortDirection={zoneSortDirection}
                                  onSort={toggleZoneSort}
                                />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                              {sortedZones.map((zone) => {
                                const isWh = selectedArea.areaType === 'warehouse';
                                const rackCount = zone.racks?.length ?? 0;
                                return (
                                  <tr
                                    key={zone.id}
                                    onClick={() => selectZone(zone)}
                                    className="cursor-pointer transition-colors hover:bg-surface-2/80"
                                  >
                                    <td className="px-4 py-3 text-lg">{zone.icon || (isWh ? '📦' : '⚙️')}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-ink-2">{zone.code}</td>
                                    <td className="px-4 py-3 font-medium text-ink">
                                      {zone.name}
                                      {zone.zohoWarehouseId && (
                                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-100 text-violet-700">
                                          Zoho
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          zone.isActive === false
                                            ? 'bg-surface-3 text-ink-2'
                                            : 'bg-ok-soft text-ok'
                                        }`}
                                      >
                                        {zone.isActive === false ? 'Inactive' : 'Active'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-ink-2">{zone.zoneLabel || '—'}</td>
                                    <td className="px-4 py-3 text-ink-2">
                                      {zone.areaSqm != null ? `${zone.areaSqm} m²` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-ink-2 tabular-nums">{rackCount}</td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                      {zone.isDefault ? (
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-warn-soft text-warn">
                                          {isWh ? 'GRN default' : 'MTR default'}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={defaultSavingZoneId === zone.id}
                                          onClick={() => handleSetDefaultZone(zone)}
                                          className="text-xs font-medium text-ink-2 hover:text-ink underline disabled:opacity-50"
                                        >
                                          {defaultSavingZoneId === zone.id
                                            ? 'Saving…'
                                            : isWh
                                              ? 'Set GRN default'
                                              : 'Set default'}
                                        </button>
                                      )}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-ink-3 max-w-xs truncate"
                                      title={zone.description || undefined}
                                    >
                                      {zone.description || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (selectedZone.racks ?? []).length === 0 ? (
                          <EmptyState
                            title={
                              <>
                                No racks in this zone yet. Add a{' '}
                                <span className="font-mono text-ink-2">DEFAULT</span> rack for inbound putaway.
                              </>
                            }
                            action={
                              <button
                                type="button"
                                onClick={() => openCreateRack(selectedZone)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-lg text-xs font-medium hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
                              >
                                Add rack
                              </button>
                            }
                          />
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20">
                              <tr className="[&_th]:bg-surface-2 bg-surface-2/50 border-b border-hairline">
                                <SortableTableTh
                                  label="Code"
                                  column="code"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                                <SortableTableTh
                                  label="Name"
                                  column="name"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                                <SortableTableTh
                                  label="Levels"
                                  column="levels"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                                <SortableTableTh
                                  label="Slots"
                                  column="slots"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                                <SortableTableTh
                                  label="Capacity"
                                  column="capacity"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                                <SortableTableTh
                                  label="Description"
                                  column="description"
                                  sortColumn={rackSortColumn}
                                  sortDirection={rackSortDirection}
                                  onSort={toggleRackSort}
                                />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                              {sortedRacks.map((rack) => (
                                <tr key={rack.id} className="hover:bg-surface-2/50">
                                  <td className="px-4 py-3 font-mono text-xs font-medium text-ink">
                                    {rack.code}
                                  </td>
                                  <td className="px-4 py-3 text-ink-2">{rack.name || '—'}</td>
                                  <td className="px-4 py-3 text-ink-2 tabular-nums">{rack.levels}</td>
                                  <td className="px-4 py-3 text-ink-2 tabular-nums">{rack.slotsTotal}</td>
                                  <td className="px-4 py-3 text-ink-2 text-xs">
                                    {rack.levels} × {rack.slotsTotal} slots
                                  </td>
                                  <td
                                    className="px-4 py-3 text-ink-3 max-w-xs truncate"
                                    title={rack.description || undefined}
                                  >
                                    {rack.description || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  className="rounded-xl border border-dashed border-border bg-surface-2/50 w-full"
                  title="Select an area above to view zones"
                  description="Choose Warehouse or Manufacturing, then pick an area chip."
                />
              )}
          </div>
        </>
      )}

      {/* Area Modal */}
      {showAreaModal && (
        <ModalOverlay onClose={() => setShowAreaModal(false)} z="z-50" dismissable={false} backdrop="default">
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-area-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-hairline">
              <h3 id="create-area-title" className="text-lg font-semibold text-ink">
                Create area
              </h3>
              <p className="text-xs text-ink-3 mt-1">Top-level building or site (warehouse or manufacturing).</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="area-code" className="block text-xs font-medium text-ink-2 mb-1">
                    Code *
                  </label>
                  <input
                    id="area-code"
                    type="text"
                    value={areaForm.code}
                    onChange={(e) => setAreaForm((f) => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                    placeholder="AREA-WH"
                  />
                </div>
                <div>
                  <label htmlFor="area-type" className="block text-xs font-medium text-ink-2 mb-1">
                    Type *
                  </label>
                  <select
                    id="area-type"
                    value={areaForm.area_type}
                    onChange={(e) =>
                      setAreaForm((f) => ({ ...f, area_type: e.target.value as 'warehouse' | 'production' }))
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  >
                    <option value="warehouse">Warehouse</option>
                    <option value="production">Manufacturing</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="area-name" className="block text-xs font-medium text-ink-2 mb-1">
                  Name *
                </label>
                <input
                  id="area-name"
                  type="text"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  placeholder="Main Warehouse"
                />
              </div>
              <div>
                <label htmlFor="area-icon" className="block text-xs font-medium text-ink-2 mb-1">
                  Icon (emoji)
                </label>
                <input
                  id="area-icon"
                  type="text"
                  value={areaForm.icon}
                  onChange={(e) => setAreaForm((f) => ({ ...f, icon: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  placeholder="🏭"
                />
              </div>
              <div>
                <label htmlFor="area-desc" className="block text-xs font-medium text-ink-2 mb-1">
                  Description
                </label>
                <textarea
                  id="area-desc"
                  value={areaForm.description}
                  onChange={(e) => setAreaForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400 resize-none"
                  rows={2}
                  placeholder="What is stored or produced here?"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAreaModal(false)}
                className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveArea}
                disabled={areaSaving}
                className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink disabled:opacity-50"
              >
                {areaSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Zone Modal */}
      {showZoneModal && selectedArea && (
        <ModalOverlay onClose={() => setShowZoneModal(false)} z="z-50" dismissable={false} backdrop="default">
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-zone-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-hairline">
              <h3 id="create-zone-title" className="text-lg font-semibold text-ink">
                Add zone — {selectedArea.name}
              </h3>
              <p className="text-xs text-ink-3 mt-1">A store, ML line, or room inside this area.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="zone-code" className="block text-xs font-medium text-ink-2 mb-1">
                    Code *
                  </label>
                  <input
                    id="zone-code"
                    type="text"
                    value={zoneForm.code}
                    onChange={(e) => setZoneForm((f) => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                    placeholder="LOC-RM"
                  />
                </div>
                <div>
                  <label htmlFor="zone-label" className="block text-xs font-medium text-ink-2 mb-1">
                    Label
                  </label>
                  <input
                    id="zone-label"
                    type="text"
                    value={zoneForm.zone_label}
                    onChange={(e) => setZoneForm((f) => ({ ...f, zone_label: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                    placeholder="Zone A"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="zone-name" className="block text-xs font-medium text-ink-2 mb-1">
                  Name *
                </label>
                <input
                  id="zone-name"
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  placeholder="RM Store"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="zone-icon" className="block text-xs font-medium text-ink-2 mb-1">
                    Icon
                  </label>
                  <input
                    id="zone-icon"
                    type="text"
                    value={zoneForm.icon}
                    onChange={(e) => setZoneForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label htmlFor="zone-sqm" className="block text-xs font-medium text-ink-2 mb-1">
                    Area (m²)
                  </label>
                  <input
                    id="zone-sqm"
                    type="number"
                    value={zoneForm.area_sqm}
                    onChange={(e) => setZoneForm((f) => ({ ...f, area_sqm: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="zone-desc" className="block text-xs font-medium text-ink-2 mb-1">
                  Description
                </label>
                <textarea
                  id="zone-desc"
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowZoneModal(false)}
                className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveZone}
                disabled={zoneSaving}
                className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink disabled:opacity-50"
              >
                {zoneSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Rack Modal */}
      {showRackModal && rackZone && (
        <ModalOverlay onClose={() => setShowRackModal(false)} z="z-50" dismissable={false} backdrop="default">
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-rack-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-hairline">
              <h3 id="create-rack-title" className="text-lg font-semibold text-ink">
                Add rack — {rackZone.name}
              </h3>
              <p className="text-xs text-ink-3 mt-1 font-mono">{rackZone.code}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="rack-code" className="block text-xs font-medium text-ink-2 mb-1">
                  Code *
                </label>
                <input
                  id="rack-code"
                  type="text"
                  value={rackForm.code}
                  onChange={(e) => setRackForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  placeholder="DEFAULT or A1"
                />
              </div>
              <div>
                <label htmlFor="rack-name" className="block text-xs font-medium text-ink-2 mb-1">
                  Name
                </label>
                <input
                  id="rack-name"
                  type="text"
                  value={rackForm.name}
                  onChange={(e) => setRackForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  placeholder="Default storage"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rack-levels" className="block text-xs font-medium text-ink-2 mb-1">
                    Levels
                  </label>
                  <input
                    id="rack-levels"
                    type="number"
                    min={1}
                    value={rackForm.levels}
                    onChange={(e) => setRackForm((f) => ({ ...f, levels: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label htmlFor="rack-slots" className="block text-xs font-medium text-ink-2 mb-1">
                    Slots total
                  </label>
                  <input
                    id="rack-slots"
                    type="number"
                    min={1}
                    value={rackForm.slots_total}
                    onChange={(e) => setRackForm((f) => ({ ...f, slots_total: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rack-desc" className="block text-xs font-medium text-ink-2 mb-1">
                  Description
                </label>
                <textarea
                  id="rack-desc"
                  value={rackForm.description}
                  onChange={(e) => setRackForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border/10 focus:border-gray-400 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRackModal(false);
                  setRackZone(null);
                }}
                className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRack}
                disabled={rackSaving}
                className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink disabled:opacity-50"
              >
                {rackSaving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

export default FacilityManagement;
