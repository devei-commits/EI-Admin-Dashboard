import React, { useEffect, useState } from 'react';
import { Modal } from '../orders/Modal';
import {
  createCustomFieldId,
  normCustomFieldLabel,
  type MasterCustomFieldDef,
  type MasterCustomFieldModuleCode,
  type MasterCustomFieldType,
} from '../../lib/masterCustomFields';
import { useMasterCustomFields } from '../../context/MasterCustomFieldsContext';

/**
 * Where a new custom field is saved: the category / sub-category technical-spec rule (so it
 * applies to every item at that scope), or just this one item (client-side only). Mirrors
 * QualitySpecAddScope in MasterAddCustomQualitySpecModal.tsx.
 */
export type TechnicalSpecAddScope = 'category' | 'subCategory' | 'item';

export type MasterAddCustomFieldModalProps = {
  isOpen: boolean;
  onClose: () => void;
  moduleCode: MasterCustomFieldModuleCode;
  taxonomyLabel: string;
  onAdded?: (field: MasterCustomFieldDef) => void;
  /**
   * When provided the modal shows a scope picker and delegates persistence to the caller
   * (item vs category/sub-category rule). When omitted the modal keeps its legacy behavior:
   * item-only add via the custom-fields context (no scope picker).
   */
  onSave?: (
    field: MasterCustomFieldDef,
    scope: TechnicalSpecAddScope
  ) => boolean | void | Promise<boolean | void>;
  /** Whether a sub-category-scoped option should be offered (false when no sub-category is resolved). */
  allowSubCategoryScope?: boolean;
  /** Label shown next to the "Category" scope option. */
  categoryScopeLabel?: string;
  /** Label shown next to the "Sub-category" scope option. */
  subCategoryLabel?: string;
  /** True while onSave's async work (category/sub-category scopes hit the backend) is in flight. */
  saving?: boolean;
};

function defaultTechnicalAddScope(allowSubCategoryScope: boolean): TechnicalSpecAddScope {
  return allowSubCategoryScope ? 'subCategory' : 'category';
}

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

const NUMBER_TYPES: MasterCustomFieldType[] = ['number'];

export function MasterAddCustomFieldModal({
  isOpen,
  onClose,
  moduleCode,
  taxonomyLabel,
  onAdded,
  onSave,
  allowSubCategoryScope = false,
  categoryScopeLabel,
  subCategoryLabel,
  saving = false,
}: MasterAddCustomFieldModalProps): React.ReactElement {
  const { addField } = useMasterCustomFields();
  const scopeMode = Boolean(onSave);
  const [name, setName] = useState('');
  const [type, setType] = useState<MasterCustomFieldType>('text');
  const [mandatory, setMandatory] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [unit, setUnit] = useState('');
  const [scope, setScope] = useState<TechnicalSpecAddScope>('category');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setType('text');
    setMandatory(false);
    setOptionsText('');
    setUnit('');
    setScope(defaultTechnicalAddScope(allowSubCategoryScope));
    setError('');
  }, [isOpen, allowSubCategoryScope]);

  const showOptions = type === 'select';
  const showUnit = NUMBER_TYPES.includes(type);

  const handleSave = (): void => {
    const label = normCustomFieldLabel(name);
    if (!label) {
      setError('Field name is required.');
      return;
    }
    const options =
      type === 'select'
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    const field: MasterCustomFieldDef = {
      id: createCustomFieldId(),
      label,
      type,
      required: mandatory,
      options: options?.length ? options : type === 'select' ? ['Option 1', 'Option 2'] : undefined,
      unit: unit.trim() || undefined,
    };

    if (onSave) {
      const result = onSave(field, scope);
      if (result && typeof (result as Promise<boolean | void>).then === 'function') {
        (result as Promise<boolean | void>).then((shouldClose) => {
          if (shouldClose !== false) onClose();
        });
        return;
      }
      if (result !== false) onClose();
      return;
    }

    const result = addField(moduleCode, field);
    if (!result.ok) {
      setError(
        result.reason === 'duplicate' ? 'A field with this name already exists.' : 'Field name is required.'
      );
      return;
    }
    onAdded?.(field);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`+ Add Custom Field · ${taxonomyLabel}`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-border text-ink-2 rounded-lg text-sm font-medium hover:bg-surface-3 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-press disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save field'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="cf-name" className="block text-sm font-medium text-ink-2 mb-1">
            Parameter / field name <span className="text-err">*</span>
          </label>
          <input
            id="cf-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Neck finish torque spec"
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
        </div>
        <div>
          <label htmlFor="cf-type" className="block text-sm font-medium text-ink-2 mb-1">
            Data type / input method <span className="text-err">*</span>
          </label>
          <select
            id="cf-type"
            value={type}
            onChange={(e) => setType(e.target.value as MasterCustomFieldType)}
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          >
            {FIELD_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {showOptions ? (
          <div>
            <label htmlFor="cf-options" className="block text-sm font-medium text-ink-2 mb-1">
              Dropdown options (comma-separated)
            </label>
            <input
              id="cf-options"
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Option A, Option B, Option C"
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="cf-mand" className="block text-sm font-medium text-ink-2 mb-1">
            Mandatory?
          </label>
          <select
            id="cf-mand"
            value={mandatory ? 'true' : 'false'}
            onChange={(e) => setMandatory(e.target.value === 'true')}
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          >
            <option value="false">No · Optional</option>
            <option value="true">Yes · Mandatory</option>
          </select>
        </div>
        {showUnit ? (
          <div>
            <label htmlFor="cf-unit" className="block text-sm font-medium text-ink-2 mb-1">
              Unit (mm / kg / Nm / % etc)
            </label>
            <input
              id="cf-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
        ) : null}
        {scopeMode ? (
          <div>
            <label htmlFor="cf-scope" className="block text-sm font-medium text-ink-2 mb-1">
              Add to group
            </label>
            <select
              id="cf-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as TechnicalSpecAddScope)}
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            >
              <option value="category">Category (all of {categoryScopeLabel || 'this category'})</option>
              {allowSubCategoryScope ? (
                <option value="subCategory">
                  Sub-category (all of {subCategoryLabel || 'this sub-category'})
                </option>
              ) : null}
              <option value="item">Item specific (only this item)</option>
            </select>
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
