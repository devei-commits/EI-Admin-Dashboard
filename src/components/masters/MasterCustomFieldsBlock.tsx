import React, { useMemo, useState } from 'react';
import { MasterSelectWithOptions } from './MasterSelectWithOptions';
import { MasterAddCustomFieldModal, type TechnicalSpecAddScope } from './MasterAddCustomFieldModal';
import { useOptionalMasterCustomFields } from '../../context/MasterCustomFieldsContext';
import {
  addFieldToTechnicalSpecRule,
  type TechnicalSpecRuleEntityType,
} from '../../services/technicalSpecRules.service';
import {
  addCustomField,
  buildItemScopedTaxonomyKey,
  customFieldFormKey,
  getCustomFieldsForModule,
  normCustomFieldLabel,
  removeCustomField,
  supportsCustomFieldButton,
  type MasterCustomFieldDef,
  type MasterCustomFieldModuleCode,
} from '../../lib/masterCustomFields';

type FormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

export type MasterCustomFieldsBlockProps = {
  moduleCode: MasterCustomFieldModuleCode;
  taxonomyLabel: string;
  formData: Record<string, string | undefined>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  onRemoveFieldValue?: (formKey: string) => void;
  /**
   * When set (TECH module only) the "+ Custom field" modal offers a category / sub-category /
   * item scope picker, saving category & sub-category fields to the shared technical-spec rule.
   * When omitted the block keeps its legacy item-only (localStorage) behavior.
   */
  technicalEntityType?: TechnicalSpecRuleEntityType;
  /** Resolved category rule scope key (functionalCategory). */
  categoryScopeKey?: string;
  /** Resolved sub-category rule scope key (functionalSub) — '' when there is none. */
  subCategoryKey?: string;
  /** Display label for the category scope option. */
  categoryScopeLabel?: string;
  /** Display label for the sub-category scope option. */
  subCategoryLabel?: string;
  /**
   * The loaded item's id/code. When set, item-scoped ("This item only") TECH fields are stored in
   * a per-item bucket keyed by this id, so they persist with and load back for ONLY this item and
   * never leak to other items in the same category. Empty for a brand-new (unsaved) item, where
   * item-scoped fields fall back to the shared taxonomy bucket until the item is first saved.
   */
  itemScopeId?: string;
};

const inputClass =
  'w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function selectOptionsForType(field: MasterCustomFieldDef): string[] {
  if (field.type === 'boolean') return ['Yes', 'No'];
  if (field.type === 'pass-fail') return ['Pass', 'Fail'];
  return field.options ?? [];
}

const MasterCustomFieldInput: React.FC<{
  field: MasterCustomFieldDef;
  value: string;
  error?: string;
  onChange: FormChangeHandler;
  onRemove: () => void;
}> = ({ field, value, error, onChange, onRemove }) => {
  const formKey = customFieldFormKey(field.id);
  const unitSuffix = field.unit ? ` (${field.unit})` : '';
  const label = (
    <>
      {field.label}
      {unitSuffix}
      <span className="ml-1 text-[9px] font-bold uppercase text-violet-700">custom</span>
      {field.required ? <span className="text-red-600 ml-0.5">*</span> : null}
    </>
  );
  const selectLabel = (
    <>
      {field.label}
      {unitSuffix}
      <span className="ml-1 text-[9px] font-bold uppercase text-violet-700">custom</span>
    </>
  );

  const removeBtn = (
    <button
      type="button"
      onClick={onRemove}
      title="Remove custom field"
      className="shrink-0 px-2 py-1 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50"
      aria-label={`Remove custom field ${field.label}`}
    >
      ✕
    </button>
  );

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <label htmlFor={formKey} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          {removeBtn}
        </div>
        <textarea
          id={formKey}
          rows={2}
          value={value}
          onChange={onChange}
          className={inputClass}
        />
        {error ? (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.type === 'select' || field.type === 'boolean' || field.type === 'pass-fail') {
    return (
      <div className="relative">
        <div className="absolute right-0 top-0 z-10">{removeBtn}</div>
        <MasterSelectWithOptions
          id={formKey}
          fieldLabel={field.label}
          label={selectLabel}
          value={value}
          options={selectOptionsForType(field)}
          onChange={onChange}
          error={error}
          requiredMark={field.required}
          enableCustomOptions={field.type === 'select'}
        />
      </div>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <label htmlFor={formKey} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {removeBtn}
      </div>
      <input
        type={inputType}
        id={formKey}
        value={value}
        onChange={onChange}
        className={inputClass}
        placeholder={field.type === 'attachment' ? 'File name or URL' : undefined}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export function MasterCustomFieldsBlock({
  moduleCode,
  taxonomyLabel,
  formData,
  errors,
  onChange,
  onRemoveFieldValue,
  technicalEntityType,
  categoryScopeKey = '',
  subCategoryKey = '',
  categoryScopeLabel,
  subCategoryLabel,
  itemScopeId = '',
}: MasterCustomFieldsBlockProps): React.ReactElement | null {
  const customFieldsCtx = useOptionalMasterCustomFields();
  const [modalOpen, setModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Scope picker is TECH-only and needs a resolved category — otherwise the block keeps its
  // legacy item-only behavior (no picker, localStorage add via the custom-fields context).
  const scopeEnabled =
    moduleCode === 'TECH' && Boolean(technicalEntityType) && Boolean(categoryScopeKey.trim());
  const allowSubCategoryScope = scopeEnabled && Boolean(subCategoryKey.trim());
  // Per-item bucket for "item specific" TECH fields (see itemScopeId doc). Only used when we both
  // have a scope picker (TECH) and a real item id — otherwise everything stays in the shared bucket.
  const itemBucketKey =
    scopeEnabled && customFieldsCtx && itemScopeId.trim()
      ? buildItemScopedTaxonomyKey(customFieldsCtx.taxonomyKey, itemScopeId.trim())
      : '';

  const fields = useMemo(() => {
    if (!customFieldsCtx) return [];
    const shared = customFieldsCtx.getFields(moduleCode);
    if (!itemBucketKey) return shared;
    // Merge the shared (category/sub-category) fields with this item's own private fields,
    // deduping by id so a field never appears twice.
    const itemOnly = getCustomFieldsForModule(customFieldsCtx.entity, itemBucketKey, moduleCode);
    const byId = new Map<string, MasterCustomFieldDef>();
    for (const f of [...shared, ...itemOnly]) byId.set(f.id, f);
    return [...byId.values()];
  }, [customFieldsCtx, moduleCode, itemBucketKey, customFieldsCtx?.version]);

  if (!customFieldsCtx || !supportsCustomFieldButton(moduleCode)) {
    return null;
  }

  const handleRemove = (field: MasterCustomFieldDef): void => {
    const formKey = customFieldFormKey(field.id);
    // Route removal to whichever bucket actually holds the field so per-item fields don't linger.
    if (itemBucketKey && getCustomFieldsForModule(customFieldsCtx.entity, itemBucketKey, moduleCode).some((f) => f.id === field.id)) {
      removeCustomField(customFieldsCtx.entity, itemBucketKey, moduleCode, field.id);
    } else {
      customFieldsCtx.removeField(moduleCode, field.id);
    }
    onRemoveFieldValue?.(formKey);
  };

  const openAddModal = (): void => {
    setAddError(null);
    setModalOpen(true);
  };

  const handleScopedSave = async (
    field: MasterCustomFieldDef,
    scope: TechnicalSpecAddScope
  ): Promise<boolean> => {
    setAddError(null);

    if (scope === 'item') {
      // Item-scoped fields belong to THIS item only. When we have a real item id, store them in the
      // per-item bucket (persists with the item's form_data, loads back for only this item). Reject
      // a duplicate label against everything already shown for the item (shared + item buckets).
      if (itemBucketKey) {
        const labelKey = normCustomFieldLabel(field.label).toLowerCase();
        if (fields.some((f) => normCustomFieldLabel(f.label).toLowerCase() === labelKey)) {
          setAddError('A field with this name already exists.');
          return false;
        }
        addCustomField(customFieldsCtx.entity, itemBucketKey, moduleCode, field);
        return true;
      }
      // Brand-new (unsaved) item — no id yet — fall back to the shared context bucket.
      const result = customFieldsCtx.addField(moduleCode, field);
      if (!result.ok) {
        setAddError(
          result.reason === 'duplicate' ? 'A field with this name already exists.' : 'Field name is required.'
        );
        return false;
      }
      return true;
    }

    if (!technicalEntityType) return false;
    const catKey = categoryScopeKey.trim();
    if (!catKey) {
      setAddError('Select a category before adding a shared field.');
      return false;
    }
    const subKey = scope === 'subCategory' ? subCategoryKey.trim() : '';
    if (scope === 'subCategory' && !subKey) {
      setAddError('Select a sub-category before adding a shared field.');
      return false;
    }

    setSaving(true);
    const result = await addFieldToTechnicalSpecRule(technicalEntityType, catKey, subKey, '', field);
    setSaving(false);
    if (result.ok === false) {
      setAddError(
        result.reason === 'duplicate'
          ? `This field already exists for this ${scope === 'subCategory' ? 'sub-category' : 'category'}.`
          : 'Could not save the shared field. Please try again.'
      );
      return false;
    }
    // Saved to the shared rule — also add locally so it displays immediately on this item.
    customFieldsCtx.addField(moduleCode, field);
    return true;
  };

  return (
    <div className="space-y-3 border-t border-dashed border-gray-200 pt-4 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Custom fields</p>
        <button
          type="button"
          onClick={openAddModal}
          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
        >
          + Custom field
        </button>
      </div>
      {addError ? (
        <p className="text-xs text-red-600" role="alert">
          {addError}
        </p>
      ) : null}
      {fields.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => {
            const formKey = customFieldFormKey(field.id);
            return (
              <MasterCustomFieldInput
                key={field.id}
                field={field}
                value={String(formData[formKey] ?? '')}
                error={errors[formKey]}
                onChange={onChange}
                onRemove={() => handleRemove(field)}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          No custom fields yet for this category path. Use “+ Custom field” to add parameters like in the HTML master.
        </p>
      )}
      <MasterAddCustomFieldModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        moduleCode={moduleCode}
        taxonomyLabel={taxonomyLabel}
        onSave={scopeEnabled ? handleScopedSave : undefined}
        allowSubCategoryScope={allowSubCategoryScope}
        categoryScopeLabel={categoryScopeLabel}
        subCategoryLabel={subCategoryLabel}
        saving={saving}
      />
    </div>
  );
}
