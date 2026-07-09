import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { QualitySpecTable } from '../components/masters/QualitySpecTable';
import { MasterAddCustomQualitySpecModal } from '../components/masters/MasterAddCustomQualitySpecModal';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  fetchQualitySpecRules,
  saveQualitySpecRule,
  deleteQualitySpecRule,
  QUALITY_SPEC_RULE_ENTITY_TYPES,
  type QualitySpecRule,
  type QualitySpecRuleEntityType,
} from '../services/qualitySpecRules.service';

export default function QualitySpecRulesAdmin() {
  const { addToast } = useToast();
  const [entityType, setEntityType] = useState<QualitySpecRuleEntityType>('RM');
  const [rules, setRules] = useState<QualitySpecRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QualitySpecRule | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editSubCategory, setEditSubCategory] = useState('');
  const [editRows, setEditRows] = useState<QualitySpecTableRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpecRow, setEditingSpecRow] = useState<QualitySpecTableRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchQualitySpecRules(entityType);
      setRules(list);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to load quality spec rules');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingRule(null);
    setEditCategory('');
    setEditSubCategory('');
    setEditRows([]);
    setModalOpen(true);
  };

  const openEdit = (rule: QualitySpecRule) => {
    setEditingRule(rule);
    setEditCategory(rule.category);
    setEditSubCategory(rule.subCategory);
    setEditRows(rule.rows.map((row) => createEmptyQualitySpecRow(row)));
    setModalOpen(true);
  };

  const save = async () => {
    const category = editCategory.trim();
    if (!category) {
      addToast('error', 'Category is required');
      return;
    }
    setSaving(true);
    try {
      await saveQualitySpecRule({
        entityType,
        category,
        subCategory: editSubCategory.trim(),
        rows: editRows,
      });
      addToast('success', editingRule ? 'Rule updated' : 'Rule created');
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openAddSpecRow = (): void => {
    setEditingSpecRow(null);
    setSpecModalOpen(true);
  };

  const openEditSpecRow = (row: QualitySpecTableRow): void => {
    setEditingSpecRow(row);
    setSpecModalOpen(true);
  };

  const closeSpecModal = (): void => {
    setSpecModalOpen(false);
    setEditingSpecRow(null);
  };

  const saveSpecRow = (row: QualitySpecTableRow): void => {
    if (editingSpecRow) {
      setEditRows(editRows.map((existing) => (existing.id === editingSpecRow.id ? row : existing)));
    } else {
      setEditRows([...editRows, row]);
    }
  };

  const remove = async (rule: QualitySpecRule) => {
    const label = rule.subCategory ? `${rule.category} :: ${rule.subCategory}` : `${rule.category} (category rule)`;
    if (!window.confirm(`Delete "${label}"? Items currently unlocked for this category will stop resolving these specs.`)) {
      return;
    }
    try {
      await deleteQualitySpecRule(rule.id);
      addToast('success', 'Rule deleted');
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
            <h1 className="text-2xl font-bold text-gray-900">Quality Spec Rules</h1>
            <p className="mt-1 text-sm text-gray-600">
              Category / sub-category quality-spec templates. Items pull these live until a user edits an
              item&apos;s own quality specs — after that, the item keeps its own saved specs and stops
              tracking rule changes.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Add rule
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {QUALITY_SPEC_RULE_ENTITY_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEntityType(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                entityType === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold text-amber-900">No rules yet for this entity type</p>
            <p className="mt-2 text-amber-900/90">
              Items of this type will have no quality specs to pull until you add a category (or
              category + sub-category) rule here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Sub-category</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Rows</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Updated</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{rule.category}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.subCategory || <span className="italic text-gray-400">— (applies to all sub-categories)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rule.rows.length}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button type="button" onClick={() => openEdit(rule)} className="text-orange-600 hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(rule)} className="text-red-600 hover:underline">
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
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              {editingRule ? 'Edit rule' : 'New rule'} — {QUALITY_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                Category
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  disabled={Boolean(editingRule)}
                  placeholder="e.g. Surfactant"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Sub-category (leave blank for a category-wide rule)
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                  value={editSubCategory}
                  onChange={(e) => setEditSubCategory(e.target.value)}
                  disabled={Boolean(editingRule)}
                  placeholder="e.g. Anionic"
                />
              </label>
            </div>

            <div className="mt-5">
              <QualitySpecTable
                title="Quality spec rows"
                addButtonLabel="+ Add Custom Quality Spec"
                emptyMessage="No rows yet — add the first quality spec parameter."
                rows={editRows}
                onChange={setEditRows}
                idPrefix="rule"
                showAddButton
                onAddClick={openAddSpecRow}
                onEditRow={openEditSpecRow}
              />
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
                disabled={saving || !editCategory.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MasterAddCustomQualitySpecModal
        isOpen={specModalOpen}
        onClose={closeSpecModal}
        taxonomyLabel={
          [
            QUALITY_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label,
            editCategory.trim(),
            editSubCategory.trim(),
          ]
            .filter(Boolean)
            .join(' → ')
        }
        categoryScopeLabel={editCategory.trim() || 'this category'}
        subCategoryLabel={editSubCategory.trim() || 'this sub-category'}
        allowSubCategoryScope={false}
        hideScopeSelector
        editRow={editingSpecRow}
        onSave={saveSpecRow}
      />
    </div>
  );
}
