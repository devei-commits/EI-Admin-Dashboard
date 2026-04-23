import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchFacilityAreas,
  type FacilityAreaDTO,
  type RackDTO,
} from '../services/facilityAreas.service';
import {
  fetchItemDedicatedList,
  upsertItemDedicated,
  deleteItemDedicated,
  type ItemDedicatedRowDTO,
} from '../services/itemDedicatedFacilityLocations.service';
import { fetchRawMaterialsPage, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsPage, type PackMaterialRecord } from '../services/packMaterials.service';
import { fetchPRProductsPage, type PRProductListItem } from '../services/productsMaster.service';

function racksForZone(areas: FacilityAreaDTO[], zoneId: number | ''): RackDTO[] {
  if (!zoneId) return [];
  for (const a of areas) {
    const z = (a.zones || []).find((zz) => zz.id === zoneId);
    if (z?.racks?.length) return z.racks;
  }
  return [];
}

const FacilityItemLocationsPanel: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ItemDedicatedRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouseAreas, setWarehouseAreas] = useState<FacilityAreaDTO[]>([]);
  const [productionAreas, setProductionAreas] = useState<FacilityAreaDTO[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ItemDedicatedRowDTO | null>(null);
  const [itemType, setItemType] = useState<'rm' | 'pm' | 'product'>('rm');
  const [itemSearch, setItemSearch] = useState('');
  const [rmOptions, setRmOptions] = useState<RawMaterialRecord[]>([]);
  const [pmOptions, setPmOptions] = useState<PackMaterialRecord[]>([]);
  const [prodOptions, setProdOptions] = useState<PRProductListItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [whZoneId, setWhZoneId] = useState<number | ''>('');
  const [whRackId, setWhRackId] = useState<number | ''>('');
  const [prodZoneId, setProdZoneId] = useState<number | ''>('');
  const [prodRackId, setProdRackId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [dedicated, whRes, prodRes] = await Promise.all([
      fetchItemDedicatedList(),
      fetchFacilityAreas('warehouse'),
      fetchFacilityAreas('production'),
    ]);
    if (dedicated.success) setRows(dedicated.data);
    else addToast('error', dedicated.error || 'Failed to load mappings');
    setWarehouseAreas(whRes.success ? whRes.data : []);
    setProductionAreas(prodRes.success ? prodRes.data : []);
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const whZonesFlat = useMemo(
    () =>
      warehouseAreas.flatMap((a) =>
        (a.zones || []).map((z) => ({ z, areaLabel: `${a.name} (${a.code})` }))
      ),
    [warehouseAreas]
  );
  const prodZonesFlat = useMemo(
    () =>
      productionAreas.flatMap((a) =>
        (a.zones || []).map((z) => ({ z, areaLabel: `${a.name} (${a.code})` }))
      ),
    [productionAreas]
  );

  const whRackOpts = useMemo(() => racksForZone(warehouseAreas, whZoneId), [warehouseAreas, whZoneId]);
  const prodRackOpts = useMemo(() => racksForZone(productionAreas, prodZoneId), [productionAreas, prodZoneId]);

  const loadItemOptions = useCallback(async () => {
    const q = itemSearch.trim();
    if (itemType === 'rm') {
      const { rows: r } = await fetchRawMaterialsPage({ search: q, limit: 80, offset: 0 });
      setRmOptions(r);
    } else if (itemType === 'pm') {
      const { rows: r } = await fetchPackMaterialsPage({ search: q, limit: 80, offset: 0 });
      setPmOptions(r);
    } else {
      const { rows: all } = await fetchPRProductsPage({ limit: 200, offset: 0 });
      const ql = q.toLowerCase();
      const r = ql
        ? all.filter(
            (p) =>
              p.product_code.toLowerCase().includes(ql) ||
              (p.product_name || '').toLowerCase().includes(ql)
          )
        : all;
      setProdOptions(r.slice(0, 80));
    }
  }, [itemSearch, itemType]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadItemOptions();
    }, 250);
    return () => window.clearTimeout(t);
  }, [loadItemOptions]);

  const openCreate = () => {
    setEditing(null);
    setItemType('rm');
    setItemSearch('');
    setSelectedItemId('');
    setWhZoneId('');
    setWhRackId('');
    setProdZoneId('');
    setProdRackId('');
    setModalOpen(true);
  };

  const openEdit = (r: ItemDedicatedRowDTO) => {
    setEditing(r);
    if (r.rawMaterialId != null) setItemType('rm');
    else if (r.packMaterialId != null) setItemType('pm');
    else setItemType('product');
    setSelectedItemId(
      r.rawMaterialId ?? r.packMaterialId ?? r.productId ?? ''
    );
    setWhZoneId(r.whLocationId ?? '');
    setWhRackId(r.whRackId ?? '');
    setProdZoneId(r.prodLocationId ?? '');
    setProdRackId(r.prodRackId ?? '');
    setModalOpen(true);
  };

  const saveMapping = async () => {
    const idNum = typeof selectedItemId === 'number' ? selectedItemId : parseInt(String(selectedItemId), 10);
    if (!Number.isFinite(idNum)) {
      addToast('error', 'Select an item');
      return;
    }
    if (!whZoneId || !prodZoneId) {
      addToast('error', 'Select both a warehouse zone and a production zone');
      return;
    }
    setSaving(true);
    const res = await upsertItemDedicated({
      itemType,
      itemId: idNum,
      whLocationId: whZoneId || null,
      whRackId: whRackId || null,
      prodLocationId: prodZoneId || null,
      prodRackId: prodRackId || null,
    });
    setSaving(false);
    if (res.success) {
      addToast('success', editing ? 'Mapping updated' : 'Mapping saved');
      setModalOpen(false);
      loadAll();
    } else {
      addToast('error', res.error || 'Save failed');
    }
  };

  const removeRow = async (r: ItemDedicatedRowDTO) => {
    if (!window.confirm(`Remove dedicated locations for ${r.itemKey}?`)) return;
    const res = await deleteItemDedicated(r.id);
    if (res.success) {
      addToast('success', 'Removed');
      loadAll();
    } else addToast('error', res.error || 'Delete failed');
  };

  const itemLabelForRow = (r: ItemDedicatedRowDTO) => {
    if (r.rawMaterialId != null) return `RM #${r.rawMaterialId}`;
    if (r.packMaterialId != null) return `PM #${r.packMaterialId}`;
    if (r.productId != null) return `Product #${r.productId}`;
    return r.itemKey;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-600 max-w-2xl">
          Assign default <strong>warehouse</strong> zone/rack and <strong>production (MU)</strong> zone/rack per
          material or product. Outbound transfer orders use the production zone for ML destination when not set;
          receiving at production fills the MU rack when configured.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shrink-0"
        >
          Add mapping
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50/80">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Warehouse zone</th>
                <th className="px-4 py-3 font-medium">WH rack</th>
                <th className="px-4 py-3 font-medium">Production zone</th>
                <th className="px-4 py-3 font-medium">MU rack</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No item mappings yet. Add one to drive outbound and receive defaults.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{itemLabelForRow(r)}</div>
                      <div className="text-xs font-mono text-gray-500">{r.itemKey}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.whZoneCode || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.whRackCode || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.prodZoneCode || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.prodRackCode || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-xs font-medium text-gray-700 hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(r)}
                        className="text-xs font-medium text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit item locations' : 'Add item locations'}
              </h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!editing && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item type</label>
                    <select
                      value={itemType}
                      onChange={(e) => {
                        setItemType(e.target.value as 'rm' | 'pm' | 'product');
                        setSelectedItemId('');
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="rm">Raw material</option>
                      <option value="pm">Pack material</option>
                      <option value="product">Product (FG)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                    <input
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Code or name…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item</label>
                    <select
                      value={selectedItemId === '' ? '' : String(selectedItemId)}
                      onChange={(e) => setSelectedItemId(e.target.value ? parseInt(e.target.value, 10) : '')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">Select…</option>
                      {itemType === 'rm' &&
                        rmOptions.map((x) => (
                          <option key={x.id} value={parseInt(String(x.id), 10)}>
                            {x.code} — {x.name}
                          </option>
                        ))}
                      {itemType === 'pm' &&
                        pmOptions.map((x) => (
                          <option key={x.id} value={parseInt(String(x.id), 10)}>
                            {x.code} — {x.description || x.code}
                          </option>
                        ))}
                      {itemType === 'product' &&
                        prodOptions.map((x) => (
                          <option key={x.product_id} value={x.product_id}>
                            {x.product_code} — {x.product_name || ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
              {editing && (
                <div className="text-sm text-gray-600">
                  Editing <span className="font-mono font-medium">{editing.itemKey}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zone *</label>
                  <select
                    value={whZoneId === '' ? '' : String(whZoneId)}
                    onChange={(e) => {
                      setWhZoneId(e.target.value ? parseInt(e.target.value, 10) : '');
                      setWhRackId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select warehouse zone…</option>
                    {whZonesFlat.map(({ z, areaLabel }) => (
                      <option key={z.id} value={z.id}>
                        {z.code} — {z.name} · {areaLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rack</label>
                  <select
                    value={whRackId === '' ? '' : String(whRackId)}
                    onChange={(e) => setWhRackId(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Optional</option>
                    {whRackOpts.map((rk) => (
                      <option key={rk.id} value={rk.id}>
                        {rk.code}
                        {rk.name ? ` — ${rk.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Production (MU)</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zone *</label>
                  <select
                    value={prodZoneId === '' ? '' : String(prodZoneId)}
                    onChange={(e) => {
                      setProdZoneId(e.target.value ? parseInt(e.target.value, 10) : '');
                      setProdRackId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select production zone…</option>
                    {prodZonesFlat.map(({ z, areaLabel }) => (
                      <option key={z.id} value={z.id}>
                        {z.code} — {z.name} · {areaLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rack</label>
                  <select
                    value={prodRackId === '' ? '' : String(prodRackId)}
                    onChange={(e) => setProdRackId(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Optional</option>
                    {prodRackOpts.map((rk) => (
                      <option key={rk.id} value={rk.id}>
                        {rk.code}
                        {rk.name ? ` — ${rk.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMapping}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityItemLocationsPanel;
