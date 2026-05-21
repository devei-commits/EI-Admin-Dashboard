import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import FacilityItemLocationsPanel from './FacilityItemLocationsPanel';
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const AREA_FORM_EMPTY = { code: '', name: '', area_type: 'warehouse' as 'warehouse' | 'production', icon: '', description: '' };
const ZONE_FORM_EMPTY = { code: '', name: '', zone_label: '', icon: '', area_sqm: '', description: '' };
const RACK_FORM_EMPTY = { code: '', name: '', description: '', levels: '4', slots_total: '16' };

type AreaForm = typeof AREA_FORM_EMPTY;
type ZoneForm = typeof ZONE_FORM_EMPTY;
type RackForm = typeof RACK_FORM_EMPTY;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const FacilityManagement: React.FC = () => {
  const { addToast } = useToast();
  const [mainTab, setMainTab] = useState<'structure' | 'item_locations'>('structure');

  const [areas, setAreas] = useState<FacilityAreaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [facilityGroup, setFacilityGroup] = useState<'warehouse' | 'production'>('warehouse');

  // area modal (create only)
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState<AreaForm>({ ...AREA_FORM_EMPTY });
  const [areaSaving, setAreaSaving] = useState(false);

  // zone modal (create only)
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneForm, setZoneForm] = useState<ZoneForm>({ ...ZONE_FORM_EMPTY });
  const [zoneSaving, setZoneSaving] = useState(false);

  // rack modal (create only)
  const [showRackModal, setShowRackModal] = useState(false);
  const [rackForm, setRackForm] = useState<RackForm>({ ...RACK_FORM_EMPTY });
  const [rackSaving, setRackSaving] = useState(false);
  const [rackZone, setRackZone] = useState<ZoneDTO | null>(null);
  const [defaultSavingZoneId, setDefaultSavingZoneId] = useState<number | null>(null);

  /* --- Load -------------------------------------------------------- */

  const loadAreas = useCallback(async () => {
    setLoading(true);
    const res = await fetchFacilityAreas();
    if (res.success) setAreas(res.data);
    else addToast('error', res.error || 'Failed to load areas');
    setLoading(false);
  }, [addToast]);

  useEffect(() => { loadAreas(); }, [loadAreas]);

  const warehouseAreas = areas.filter((a) => a.areaType === 'warehouse');
  const manufacturingAreas = areas.filter((a) => a.areaType === 'production');
  const groupAreas = facilityGroup === 'warehouse' ? warehouseAreas : manufacturingAreas;

  useEffect(() => {
    if (loading) return;
    const inGroup = groupAreas.some((a) => a.id === selectedAreaId);
    if (!inGroup && groupAreas.length > 0) setSelectedAreaId(groupAreas[0].id);
    else if (!inGroup) setSelectedAreaId(null);
  }, [loading, facilityGroup, groupAreas, selectedAreaId]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  const renderAreaCard = (area: FacilityAreaDTO) => (
    <div
      key={area.id}
      onClick={() => {
        setFacilityGroup(area.areaType === 'production' ? 'production' : 'warehouse');
        setSelectedAreaId(area.id);
      }}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selectedAreaId === area.id
          ? area.areaType === 'warehouse'
            ? 'border-blue-600 bg-blue-50/80 shadow-sm'
            : 'border-amber-600 bg-amber-50/80 shadow-sm'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{area.icon || (area.areaType === 'warehouse' ? '🏭' : '⚙️')}</span>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{area.name}</h3>
            <p className="text-xs text-gray-500">{area.code}</p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            area.areaType === 'warehouse' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {area.areaType === 'warehouse' ? 'Warehouse' : 'Manufacturing'}
        </span>
      </div>
      {area.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{area.description}</p>}
      <div className="mt-3 text-xs text-gray-500">
        {area.zones.length} zone{area.zones.length !== 1 ? 's' : ''}
        {(area.zones || []).some((z) => z.isDefault) && (
          <span className="ml-2 text-amber-700 font-medium">· has default zone</span>
        )}
      </div>
    </div>
  );

  /* --- Area CRUD --------------------------------------------------- */

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

  /* --- Zone CRUD --------------------------------------------------- */

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

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facility Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mainTab === 'structure'
              ? 'Two facility types: Warehouse (GRN inbound, storage) and Manufacturing unit (MTR from WH). Each has areas → zones → racks; one default zone per type.'
              : 'Default warehouse and manufacturing storage per item for MTR / GRN routing.'}
          </p>
        </div>
        {mainTab === 'structure' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadAreas()}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => openCreateArea()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Area
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setMainTab('structure')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            mainTab === 'structure' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Warehouse & manufacturing locations
        </button>
        <button
          type="button"
          onClick={() => setMainTab('item_locations')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            mainTab === 'item_locations' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Item locations
        </button>
      </div>

      {mainTab === 'item_locations' && <FacilityItemLocationsPanel />}

      {mainTab === 'structure' && (
      <>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Areas grouped by facility type */}
          <div className="lg:col-span-1 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800">Warehouse facilities</h3>
                <span className="text-[10px] text-blue-600">GRN · storage · pick</span>
              </div>
              <div className="space-y-2">
                {warehouseAreas.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-blue-200 rounded-lg">
                    No warehouse areas
                  </p>
                ) : (
                  warehouseAreas.map(renderAreaCard)
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">Manufacturing unit</h3>
                <span className="text-[10px] text-amber-700">MTR · ML1 / ML2</span>
              </div>
              <div className="space-y-2">
                {manufacturingAreas.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-amber-200 rounded-lg">
                    No manufacturing areas
                  </p>
                ) : (
                  manufacturingAreas.map(renderAreaCard)
                )}
              </div>
            </div>
          </div>

          {/* Right: Zones for selected area */}
          <div className="lg:col-span-2">
            {selectedArea ? (
              <div className="border border-gray-200 rounded-xl">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      <span>{selectedArea.icon || (selectedArea.areaType === 'warehouse' ? '🏭' : '⚙️')}</span>
                      {selectedArea.name} — Zones
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          selectedArea.areaType === 'warehouse'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {selectedArea.areaType === 'warehouse' ? 'Warehouse facility' : 'Manufacturing facility'}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedArea.areaType === 'warehouse'
                        ? 'Inbound GRN posts to the default warehouse zone (and DEFAULT rack).'
                        : 'MTR from warehouse posts to default manufacturing zone / rack when MU zone is not specified.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{selectedArea.description || 'No description'}</p>
                  </div>
                  <button
                    onClick={openCreateZone}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Zone
                  </button>
                </div>
                {selectedArea.zones.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-sm">
                    No zones in this area yet. Click "Add Zone" to create one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50/50">
                          <th className="px-4 py-3 font-medium">Icon</th>
                          <th className="px-4 py-3 font-medium">Code</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Label</th>
                          <th className="px-4 py-3 font-medium">Area (sqm)</th>
                          <th className="px-4 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium">Default</th>
                          <th className="px-4 py-3 font-medium">Racks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedArea.zones.map((zone) => (
                          <tr key={zone.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-lg">{zone.icon || ''}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{zone.code}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">
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
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {zone.isActive === false ? 'Inactive' : 'Active'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{zone.zoneLabel || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{zone.areaSqm != null ? zone.areaSqm : '—'}</td>
                            <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{zone.description || '—'}</td>
                            <td className="px-4 py-3">
                              {zone.isDefault ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                  Default
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={defaultSavingZoneId === zone.id}
                                  onClick={() => handleSetDefaultZone(zone)}
                                  className="text-xs font-medium text-gray-700 hover:text-gray-900 underline disabled:opacity-50"
                                >
                                  {defaultSavingZoneId === zone.id ? 'Saving…' : 'Set as default'}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {(zone.racks || []).length === 0 ? (
                                  <span className="text-xs text-gray-400">No racks</span>
                                ) : (
                                  (zone.racks || []).map((r) => (
                                    <span key={r.id} className="text-xs font-mono text-gray-600">
                                      {r.code}
                                      {r.levels != null && r.slotsTotal != null ? ` (${r.levels}×${r.slotsTotal})` : ''}
                                    </span>
                                  ))
                                )}
                                <button
                                  type="button"
                                  onClick={() => openCreateRack(zone)}
                                  className="text-xs font-medium text-gray-700 hover:text-gray-900 mt-0.5"
                                >
                                  + Add Rack
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                <p className="text-sm">Select an area to view and manage its zones</p>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* Area Modal */}
      {showAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Create Area</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={areaForm.code}
                    onChange={(e) => setAreaForm((f) => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    placeholder="AREA-WH"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={areaForm.area_type}
                    onChange={(e) => setAreaForm((f) => ({ ...f, area_type: e.target.value as 'warehouse' | 'production' }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  >
                    <option value="warehouse">Warehouse location</option>
                    <option value="production">Manufacturing location</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  placeholder="Main Warehouse"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                <input
                  type="text"
                  value={areaForm.icon}
                  onChange={(e) => setAreaForm((f) => ({ ...f, icon: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  placeholder=""
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={areaForm.description}
                  onChange={(e) => setAreaForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 resize-none"
                  rows={2}
                  placeholder="Area description..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAreaModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveArea}
                disabled={areaSaving}
                className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {areaSaving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone Modal */}
      {showZoneModal && selectedArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add Zone — {selectedArea.name}</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={zoneForm.code}
                    onChange={(e) => setZoneForm((f) => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    placeholder="LOC-RM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                  <input
                    type="text"
                    value={zoneForm.zone_label}
                    onChange={(e) => setZoneForm((f) => ({ ...f, zone_label: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    placeholder="Zone A"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  placeholder="RM Store"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                  <input
                    type="text"
                    value={zoneForm.icon}
                    onChange={(e) => setZoneForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    placeholder=""
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Area (sqm)</label>
                  <input
                    type="number"
                    value={zoneForm.area_sqm}
                    onChange={(e) => setZoneForm((f) => ({ ...f, area_sqm: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 resize-none"
                  rows={2}
                  placeholder="Zone description..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowZoneModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveZone}
                disabled={zoneSaving}
                className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {zoneSaving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rack Modal (create only) */}
      {showRackModal && rackZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add Rack — {rackZone.name}</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={rackForm.code}
                  onChange={(e) => setRackForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  placeholder="A1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={rackForm.name}
                  onChange={(e) => setRackForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  placeholder="Rack A1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Levels</label>
                  <input
                    type="number"
                    min={1}
                    value={rackForm.levels}
                    onChange={(e) => setRackForm((f) => ({ ...f, levels: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Slots total</label>
                  <input
                    type="number"
                    min={1}
                    value={rackForm.slots_total}
                    onChange={(e) => setRackForm((f) => ({ ...f, slots_total: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={rackForm.description}
                  onChange={(e) => setRackForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 resize-none"
                  rows={2}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowRackModal(false); setRackZone(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRack}
                disabled={rackSaving}
                className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {rackSaving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityManagement;
