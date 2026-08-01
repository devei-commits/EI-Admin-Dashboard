import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchCustomizationPackagingCatalog,
  createCustomizationPackagingOption,
  updateCustomizationPackagingOption,
  deleteCustomizationPackagingOption,
  type CustomizationPackagingRow,
  type CustomizationPackagingSpecs,
} from '../services/customizationPackagingCatalog.service';

const emptySpecs = (): CustomizationPackagingSpecs => ({
  skuVol: '',
  material: '',
  color: '',
  pantone: '',
  dispensing: '',
  pumpMaterial: '',
  pumpColor: '',
  capMaterial: '',
  capColor: '',
  moq: 0,
});

export default function CustomizationPackagingCatalog() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<CustomizationPackagingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomizationPackagingRow | null>(null);
  const [form, setForm] = useState({
    optionId: '',
    title: '',
    subtitle: '',
    reviewLabel: '',
    skuCode: '',
    isCustom: false,
    sortOrder: 0,
    active: true,
    specs: emptySpecs(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchCustomizationPackagingCatalog();
      setRows(list);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to load packaging catalog');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      optionId: '',
      title: '',
      subtitle: '',
      reviewLabel: '',
      skuCode: '',
      isCustom: false,
      sortOrder: (rows[rows.length - 1]?.sortOrder ?? 0) + 10,
      active: true,
      specs: emptySpecs(),
    });
    setModalOpen(true);
  };

  const openEdit = (r: CustomizationPackagingRow) => {
    setEditing(r);
    setForm({
      optionId: r.id,
      title: r.title,
      subtitle: r.subtitle,
      reviewLabel: r.reviewLabel,
      skuCode: r.skuCode,
      isCustom: r.custom,
      sortOrder: r.sortOrder,
      active: r.active,
      specs: { ...emptySpecs(), ...r.specs },
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload: Record<string, unknown> = {
      option_id: form.optionId.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      review_label: form.reviewLabel.trim() || null,
      sku_code: form.skuCode.trim() || null,
      is_custom: form.isCustom,
      sort_order: form.sortOrder,
      active: form.active,
      specs: form.specs,
    };
    try {
      if (editing) {
        await updateCustomizationPackagingOption(editing.dbId, payload);
        addToast('success', 'Packaging option updated');
      } else {
        await createCustomizationPackagingOption(payload);
        addToast('success', 'Packaging option created');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Save failed');
    }
  };

  const remove = async (r: CustomizationPackagingRow) => {
    if (!window.confirm(`Delete "${r.title}" (${r.id})?`)) return;
    try {
      await deleteCustomizationPackagingOption(r.dbId);
      addToast('success', 'Deleted');
      await load();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Website customization packaging</h1>
            <p className="mt-1 text-sm text-gray-600">
              Presets shown on the public <strong>/customize</strong> packaging step. Active rows are exposed at{' '}
              <code className="rounded bg-gray-200 px-1 text-xs">GET /customization-packaging-options/public</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Add option
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold text-amber-900">No rows in the database yet</p>
            <p className="mt-2 text-amber-900/90">
              The public <strong>/customize</strong> page loads presets only from this table. If it is empty, visitors
              only see <strong>Custom</strong> packaging until you add rows here or restart the API (defaults are inserted
              when the table is empty).
            </p>
            <p className="mt-2 text-amber-900/90">
              <strong>Fix:</strong> restart the API (it auto-inserts defaults when the table is empty) or run your
              database seed, then refresh this page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Sort</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Option ID</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Title</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">SKU</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Custom</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Active</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.dbId} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 text-gray-600">{r.sortOrder}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{r.id}</td>
                    <td className="px-4 py-3 text-gray-900">{r.title}</td>
                    <td className="px-4 py-3 text-gray-600">{r.skuCode || '—'}</td>
                    <td className="px-4 py-3">{r.custom ? 'Yes' : '—'}</td>
                    <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-orange-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(r)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label={editing ? 'Edit option' : 'New option'} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit option' : 'New option'}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-gray-600">
                Option ID (slug, stored as packagingType)
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.optionId}
                  onChange={(e) => setForm((f) => ({ ...f, optionId: e.target.value }))}
                  disabled={Boolean(editing)}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Title
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Subtitle
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Review label
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.reviewLabel}
                  onChange={(e) => setForm((f) => ({ ...f, reviewLabel: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                SKU code
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.skuCode}
                  onChange={(e) => setForm((f) => ({ ...f, skuCode: e.target.value }))}
                />
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isCustom}
                    onChange={(e) => setForm((f) => ({ ...f, isCustom: e.target.checked }))}
                  />
                  Custom / upload path
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-600">
                Sort order
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                />
              </label>
              <p className="text-xs font-semibold text-gray-700">Specs</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ['skuVol', 'SKU vol'],
                    ['material', 'Material'],
                    ['color', 'Color'],
                    ['pantone', 'Pantone'],
                    ['dispensing', 'Dispensing'],
                    ['pumpMaterial', 'Pump / closure mat.'],
                    ['pumpColor', 'Pump / closure col.'],
                    ['capMaterial', 'Cap material'],
                    ['capColor', 'Cap color'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-[11px] font-medium text-gray-600">
                    {label}
                    <input
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={String(form.specs[key] ?? '')}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          specs: { ...f.specs, [key]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="block text-[11px] font-medium text-gray-600">
                  MOQ (number)
                  <input
                    type="number"
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={form.specs.moq}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        specs: { ...f.specs, moq: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!form.optionId.trim() || !form.title.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
