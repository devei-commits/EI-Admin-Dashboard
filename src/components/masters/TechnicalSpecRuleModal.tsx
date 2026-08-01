import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  createCustomFieldId,
  normCustomFieldLabel,
  type MasterCustomFieldDef,
  type MasterCustomFieldType,
} from '../../lib/masterCustomFields';
import {
  saveTechnicalSpecRule,
  type TechnicalSpecRule,
  type TechnicalSpecRuleEntityType,
  TECHNICAL_SPEC_RULE_ENTITY_TYPES,
} from '../../services/technicalSpecRules.service';
import {
  taxonomyEntityFor,
  ruleCategoryOptions,
  ruleSubCategoryOptions,
  mergeOptions,
} from '../../lib/specRuleTaxonomy';
import { SpecScopeCombobox } from './SpecScopeCombobox';
import { ModalOverlay } from '../ui/ModalOverlay';

const FIELD_TYPES: { value: MasterCustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text — single line' },
  { value: 'textarea', label: 'Text — long / textarea' },
  { value: 'number', label: 'Number — single value' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'pass-fail', label: 'Pass / Fail' },
  { value: 'attachment', label: 'Attachment / file ref' },
];

const inputClass =
  'w-full rounded border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] disabled:bg-surface-3';

function typeLabel(type: MasterCustomFieldType): string {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

export type TechnicalSpecRuleModalProps = {
  isOpen: boolean;
  entityType: TechnicalSpecRuleEntityType;
  editingRule: TechnicalSpecRule | null;
  /** Extra category/sub-category values (e.g. scopes already saved) merged into the dropdowns. */
  existingCategories?: string[];
  existingSubCategoriesFor?: (category: string) => string[];
  onClose: () => void;
  onSaved: () => void;
};

/** Self-contained editor for a Technical Spec rule (TECH custom-field defs) at a category scope. */
export function TechnicalSpecRuleModal({
  isOpen,
  entityType,
  editingRule,
  existingCategories = [],
  existingSubCategoriesFor,
  onClose,
  onSaved,
}: TechnicalSpecRuleModalProps): React.ReactElement | null {
  const { addToast } = useToast();
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [fields, setFields] = useState<MasterCustomFieldDef[]>([]);
  const [saving, setSaving] = useState(false);

  // Inline add/edit field form
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftType, setDraftType] = useState<MasterCustomFieldType>('text');
  const [draftRequired, setDraftRequired] = useState(false);
  const [draftUnit, setDraftUnit] = useState('');
  const [draftOptions, setDraftOptions] = useState('');
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCategory(editingRule?.category ?? '');
    setSubCategory(editingRule?.subCategory ?? '');
    setFields(editingRule ? editingRule.rows.map((r) => ({ ...r })) : []);
    resetDraft();
  }, [isOpen, editingRule]);

  const resetDraft = (): void => {
    setDraftId(null);
    setDraftLabel('');
    setDraftType('text');
    setDraftRequired(false);
    setDraftUnit('');
    setDraftOptions('');
    setDraftError('');
  };

  const entityLabel = useMemo(
    () => TECHNICAL_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label ?? entityType,
    [entityType],
  );

  const taxEntity = taxonomyEntityFor(entityType);
  const categoryOpts = useMemo(
    () => mergeOptions(ruleCategoryOptions(taxEntity), existingCategories),
    [taxEntity, existingCategories],
  );
  const subCategoryOpts = useMemo(
    () =>
      mergeOptions(
        ruleSubCategoryOptions(taxEntity, category),
        existingSubCategoriesFor ? existingSubCategoriesFor(category) : [],
      ),
    [taxEntity, category, existingSubCategoriesFor],
  );

  if (!isOpen) return null;

  const startEditField = (field: MasterCustomFieldDef): void => {
    setDraftId(field.id);
    setDraftLabel(field.label);
    setDraftType(field.type);
    setDraftRequired(Boolean(field.required));
    setDraftUnit(field.unit ?? '');
    setDraftOptions((field.options ?? []).join(', '));
    setDraftError('');
  };

  const commitDraftField = (): void => {
    const label = normCustomFieldLabel(draftLabel);
    if (!label) {
      setDraftError('Field name is required.');
      return;
    }
    const dupe = fields.some(
      (f) => f.label.toLowerCase() === label.toLowerCase() && f.id !== draftId,
    );
    if (dupe) {
      setDraftError('A field with this name already exists in this rule.');
      return;
    }
    const options =
      draftType === 'select'
        ? draftOptions.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined;
    const next: MasterCustomFieldDef = {
      id: draftId ?? createCustomFieldId(),
      label,
      type: draftType,
      required: draftRequired || undefined,
      unit: draftType === 'number' && draftUnit.trim() ? draftUnit.trim() : undefined,
      options: draftType === 'select' ? (options?.length ? options : ['Option 1', 'Option 2']) : undefined,
    };
    setFields((prev) =>
      draftId ? prev.map((f) => (f.id === draftId ? next : f)) : [...prev, next],
    );
    resetDraft();
  };

  const removeField = (id: string): void => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (draftId === id) resetDraft();
  };

  const save = async (): Promise<void> => {
    const cat = category.trim();
    if (!cat) {
      addToast('error', 'Category is required');
      return;
    }
    if (fields.length === 0) {
      addToast('error', 'Add at least one technical field');
      return;
    }
    setSaving(true);
    try {
      await saveTechnicalSpecRule({
        entityType,
        category: cat,
        subCategory: subCategory.trim(),
        rows: fields,
      });
      addToast('success', editingRule ? 'Technical rule updated' : 'Technical rule created');
      onSaved();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const showOptions = draftType === 'select';
  const showUnit = draftType === 'number';

  return (
    <ModalOverlay onClose={onClose} z="z-[50]" dismissable={false} backdrop="default">
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="technical-spec-rule-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="technical-spec-rule-modal-title" className="text-lg font-bold text-ink">
              {editingRule ? 'Edit technical rule' : 'New technical rule'} — {entityLabel}
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Technical spec custom fields (TECH module) items of this category pull live.
            </p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            Technical
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-ink-3">
            Category
            <SpecScopeCombobox
              accent="indigo"
              options={categoryOpts}
              value={category}
              onChange={(v) => {
                setCategory(v);
                setSubCategory(''); // reset sub-category when category changes
              }}
              disabled={Boolean(editingRule)}
              placeholder="Select or type a category"
            />
          </label>
          <label className="block text-xs font-semibold text-ink-3">
            Sub-category (leave blank for a category-wide rule)
            <SpecScopeCombobox
              accent="indigo"
              options={subCategoryOpts}
              value={subCategory}
              onChange={setSubCategory}
              disabled={Boolean(editingRule) || !category.trim()}
              placeholder={category.trim() ? 'Select or type a sub-category' : 'Select a category first'}
            />
          </label>
        </div>

        {/* Field list */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink">Technical fields</h3>
          {fields.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-border bg-surface-3 p-3 text-xs text-ink-3">
              No fields yet — add the first technical spec field below.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-3 text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Label</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Unit</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Options</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Required</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {fields.map((f) => (
                    <tr key={f.id} className={draftId === f.id ? 'bg-brand-soft' : 'hover:bg-surface-3'}>
                      <td className="px-3 py-2 font-medium text-ink">{f.label}</td>
                      <td className="px-3 py-2 text-ink-3">{typeLabel(f.type)}</td>
                      <td className="px-3 py-2 text-ink-3">{f.unit || '—'}</td>
                      <td className="px-3 py-2 text-ink-3">{f.options?.length ? f.options.join(', ') : '—'}</td>
                      <td className="px-3 py-2 text-ink-3">{f.required ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                        <button type="button" onClick={() => startEditField(f)} className="text-brand hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => removeField(f.id)} className="text-err hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inline add/edit field form */}
        <div className="mt-4 rounded-lg border border-brand-soft bg-brand-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {draftId ? 'Edit field' : 'Add field'}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink-3">
              Field name *
              <input
                className={`mt-1 ${inputClass}`}
                value={draftLabel}
                onChange={(e) => {
                  setDraftLabel(e.target.value);
                  if (draftError) setDraftError('');
                }}
                placeholder="e.g. Bulk density"
              />
            </label>
            <label className="block text-xs font-semibold text-ink-3">
              Data type *
              <select
                className={`mt-1 ${inputClass}`}
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as MasterCustomFieldType)}
              >
                {FIELD_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {showUnit ? (
              <label className="block text-xs font-semibold text-ink-3">
                Unit (mm / kg / g·ml⁻¹ / % …)
                <input
                  className={`mt-1 ${inputClass}`}
                  value={draftUnit}
                  onChange={(e) => setDraftUnit(e.target.value)}
                  placeholder="e.g. g/ml"
                />
              </label>
            ) : null}
            {showOptions ? (
              <label className="block text-xs font-semibold text-ink-3">
                Dropdown options (comma-separated)
                <input
                  className={`mt-1 ${inputClass}`}
                  value={draftOptions}
                  onChange={(e) => setDraftOptions(e.target.value)}
                  placeholder="Option A, Option B"
                />
              </label>
            ) : null}
            <label className="block text-xs font-semibold text-ink-3">
              Mandatory?
              <select
                className={`mt-1 ${inputClass}`}
                value={draftRequired ? 'true' : 'false'}
                onChange={(e) => setDraftRequired(e.target.value === 'true')}
              >
                <option value="false">No · Optional</option>
                <option value="true">Yes · Mandatory</option>
              </select>
            </label>
          </div>
          {draftError ? <p className="mt-2 text-xs text-err">{draftError}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={commitDraftField}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-press"
            >
              {draftId ? 'Update field' : '+ Add field'}
            </button>
            {draftId ? (
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !category.trim() || fields.length === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
