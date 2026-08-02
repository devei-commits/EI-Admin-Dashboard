import React, { useEffect, useState } from 'react';
import { Modal } from '../orders/Modal';
import { normCustomFieldLabel } from '../../lib/masterCustomFields';
import {
  defaultGrnOutputTypeFromDataType,
  GRN_OUTPUT_TYPE_OPTIONS,
  MASTER_QUALITY_SPEC_TYPE_OPTIONS,
  parseQualitySpecDataType,
  type GrnQualitySpecOutputType,
  type MasterQualitySpecDataType,
} from '../../lib/qualitySpecDataType';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../../types/qualitySpecTable';
import { QualitySpecLimitInput } from './QualitySpecLimitInput';

export type { MasterQualitySpecDataType };

/**
 * Where a new/edited row is saved: the category/sub-category/sub-sub-category rule (so it
 * applies to every unlocked item at that scope), or just this one item (no shared rule at all —
 * only this item's own saved quality specs get it).
 */
export type QualitySpecAddScope = 'category' | 'subCategory' | 'subSubCategory' | 'item';

export type MasterAddCustomQualitySpecModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taxonomyLabel: string;
  subCategoryLabel: string;
  subSubCategoryLabel?: string;
  categoryScopeLabel: string;
  /** Whether a sub-category-scoped option should be offered (false when no sub-category is resolved). */
  allowSubCategoryScope: boolean;
  /** Whether a sub-sub-category-scoped option should be offered (RM only today). */
  allowSubSubCategoryScope?: boolean;
  /** Pre-select a scope when the modal opens. */
  initialScope?: QualitySpecAddScope;
  /** Hide the "Add to group" scope picker — for callers where the destination is already fixed
   * (e.g. adding a row directly to one already-selected rule) and there's no per-item scope. */
  hideScopeSelector?: boolean;
  /** When set, modal opens in edit mode with fields pre-filled from this row. */
  editRow?: QualitySpecTableRow | null;
  onSave: (row: QualitySpecTableRow, scope: QualitySpecAddScope) => boolean | void | Promise<boolean | void>;
  /** True while onSave's async work (category/sub-category scopes hit the backend) is in flight. */
  saving?: boolean;
};

function defaultAddScope(allowSubCategoryScope: boolean, allowSubSubCategoryScope: boolean): QualitySpecAddScope {
  if (allowSubSubCategoryScope) return 'subSubCategory';
  if (allowSubCategoryScope) return 'subCategory';
  return 'category';
}

const NUMBER_TYPES: MasterQualitySpecDataType[] = [
  'number',
  'number-range',
  'number-le',
  'number-ge',
  'number-match',
];

export function MasterAddCustomQualitySpecModal({
  isOpen,
  onClose,
  taxonomyLabel,
  subCategoryLabel,
  subSubCategoryLabel,
  allowSubCategoryScope,
  allowSubSubCategoryScope = false,
  categoryScopeLabel,
  initialScope,
  hideScopeSelector = false,
  editRow,
  onSave,
  saving = false,
}: MasterAddCustomQualitySpecModalProps): React.ReactElement {
  const isEditing = Boolean(editRow);
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<MasterQualitySpecDataType>('text');
  const [outputType, setOutputType] = useState<GrnQualitySpecOutputType>('text');
  const [mandatory, setMandatory] = useState(false);
  const [unit, setUnit] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [spec, setSpec] = useState('');
  const [method, setMethod] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [frequency, setFrequency] = useState('');
  const [sample, setSample] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [scope, setScope] = useState<QualitySpecAddScope>('category');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editRow) {
      const parsed = parseQualitySpecDataType(editRow.dataType);
      const nextDataType =
        parsed.kind === 'text' ? 'text' : (parsed.kind as MasterQualitySpecDataType);
      setName(editRow.parameter);
      setDataType(nextDataType);
      setOutputType(
        editRow.outputType ?? defaultGrnOutputTypeFromDataType(nextDataType)
      );
      setMandatory(editRow.mandatory);
      setUnit(parsed.unit ?? '');
      setOptionsText(editRow.selectOptions?.join(', ') ?? '');
      setSpec(editRow.specLimit);
      setMethod(editRow.method);
      setTolerance(editRow.tolerance);
      setFrequency(editRow.frequency);
      setSample(editRow.sample);
      setAcceptance(editRow.acceptance);
      setScope(initialScope ?? defaultAddScope(allowSubCategoryScope, allowSubSubCategoryScope));
      setError('');
      return;
    }
    setName('');
    setDataType('text');
    setOutputType('text');
    setMandatory(false);
    setUnit('');
    setOptionsText('');
    setSpec('');
    setMethod('');
    setTolerance('');
    setFrequency('');
    setSample('');
    setAcceptance('');
    setScope(initialScope ?? defaultAddScope(allowSubCategoryScope, allowSubSubCategoryScope));
    setError('');
  }, [isOpen, allowSubCategoryScope, allowSubSubCategoryScope, initialScope, editRow]);

  const showOptions = dataType === 'select' || outputType === 'select';
  const showUnit = NUMBER_TYPES.includes(dataType);
  const modalInputCls =
    'w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]';
  const specDataType = showUnit && unit.trim() ? `${dataType}|${unit.trim()}` : dataType;
  const parsedOptions = optionsText
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const specSelectOptions = dataType === 'select' ? parsedOptions : [];

  const handleDataTypeChange = (next: MasterQualitySpecDataType): void => {
    setDataType(next);
    setSpec('');
    setOutputType(defaultGrnOutputTypeFromDataType(next));
  };

  const handleSave = (): void => {
    const parameter = normCustomFieldLabel(name);
    if (!parameter) {
      setError('Parameter / field name is required.');
      return;
    }
    const usesTypedInput = dataType === 'date' || dataType === 'boolean' || dataType === 'pass-fail' || dataType === 'select';
    const parsedOptions = optionsText
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const selectOptions =
      dataType === 'select' || outputType === 'select'
        ? parsedOptions.length
          ? parsedOptions
          : undefined
        : undefined;
    const row = createEmptyQualitySpecRow({
      id: editRow?.id,
      parameter,
      specLimit: usesTypedInput ? spec.trim() : spec.trim() || 'Per Master',
      method: method.trim() || '—',
      mandatory,
      tolerance: tolerance.trim() || '—',
      frequency: frequency.trim() || 'Per lot',
      sample: sample.trim() || '1',
      acceptance: acceptance.trim() || 'Within range',
      dataType: showUnit && unit.trim() ? `${dataType}|${unit.trim()}` : dataType,
      outputType,
      selectOptions: selectOptions?.length ? selectOptions : undefined,
      attachments: editRow?.attachments ? [...editRow.attachments] : [],
      custom: editRow?.custom ?? true,
    });
    const result = onSave(row, scope);
    if (result && typeof (result as Promise<boolean | void>).then === 'function') {
      (result as Promise<boolean | void>).then((shouldClose) => {
        if (shouldClose !== false) onClose();
      });
      return;
    }
    if (result !== false) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? `Edit Custom Quality Spec · ${taxonomyLabel}`
          : `+ Add Custom Quality Spec · ${taxonomyLabel}`
      }
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
            {saving ? 'Saving…' : isEditing ? 'Update QC spec' : 'Save QC spec'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="mqc-name" className="block text-sm font-medium text-ink-2 mb-1">
            Parameter / Field name <span className="text-err">*</span>
          </label>
          <input
            id="mqc-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Sodium Lauryl Sulphate Limit"
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
        </div>
        <div>
          <label htmlFor="mqc-type" className="block text-sm font-medium text-ink-2 mb-1">
            Data type / Input method <span className="text-err">*</span>
          </label>
          <select
            id="mqc-type"
            value={dataType}
            onChange={(e) => handleDataTypeChange(e.target.value as MasterQualitySpecDataType)}
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          >
            {MASTER_QUALITY_SPEC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {showOptions ? (
          <div>
            <label htmlFor="mqc-options" className="block text-sm font-medium text-ink-2 mb-1">
              Dropdown options (comma-separated)
            </label>
            <input
              id="mqc-options"
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Option A, Option B, Option C"
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="mqc-mand" className="block text-sm font-medium text-ink-2 mb-1">
            Mandatory?
          </label>
          <select
            id="mqc-mand"
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
            <label htmlFor="mqc-unit" className="block text-sm font-medium text-ink-2 mb-1">
              Unit (mm / kg / Nm / % etc)
            </label>
            <input
              id="mqc-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="mqc-output-type" className="block text-sm font-medium text-ink-2 mb-1">
            GRN output field / Input type <span className="text-err">*</span>
          </label>
          <select
            id="mqc-output-type"
            value={outputType}
            onChange={(e) => setOutputType(e.target.value as GrnQualitySpecOutputType)}
            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          >
            {GRN_OUTPUT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-3">
            How warehouse staff enter measured results during GRN QC (saved on the master for later use).
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-surface-3 p-3 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">QC Spec details</p>
          <div>
            <label htmlFor="mqc-spec" className="block text-sm font-medium text-ink-2 mb-1">
              Spec / Limit
            </label>
            <QualitySpecLimitInput
              id="mqc-spec"
              enabled
              inputCls={modalInputCls}
              value={spec}
              onChange={setSpec}
              dataType={specDataType}
              selectOptions={specSelectOptions}
            />
          </div>
          <div>
            <label htmlFor="mqc-tol" className="block text-sm font-medium text-ink-2 mb-1">
              Tolerance
            </label>
            <input
              id="mqc-tol"
              type="text"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              placeholder="e.g. ±0.5 or ±5%"
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
          <div>
            <label htmlFor="mqc-method" className="block text-sm font-medium text-ink-2 mb-1">
              Test Method
            </label>
            <input
              id="mqc-method"
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. pH meter @25°C"
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mqc-freq" className="block text-sm font-medium text-ink-2 mb-1">
                Frequency
              </label>
              <input
                id="mqc-freq"
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g. Per lot"
                className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>
            <div>
              <label htmlFor="mqc-sample" className="block text-sm font-medium text-ink-2 mb-1">
                Sample size
              </label>
              <input
                id="mqc-sample"
                type="text"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                placeholder="e.g. 10/lot"
                className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="mqc-accept" className="block text-sm font-medium text-ink-2 mb-1">
              Acceptance
            </label>
            <input
              id="mqc-accept"
              type="text"
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              placeholder="e.g. Within range"
              className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
          {!isEditing && !hideScopeSelector ? (
            <div>
              <label htmlFor="mqc-scope" className="block text-sm font-medium text-ink-2 mb-1">
                Add to group
              </label>
              <select
                id="mqc-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as QualitySpecAddScope)}
                className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                <option value="category">Category (all of {categoryScopeLabel || 'this category'})</option>
                {allowSubCategoryScope ? (
                  <option value="subCategory">
                    Sub-category (all of {subCategoryLabel || 'this sub-category'})
                  </option>
                ) : null}
                {allowSubCategoryScope && allowSubSubCategoryScope ? (
                  <option value="subSubCategory">
                    Sub-sub-category (only {subSubCategoryLabel || 'this sub-sub-category'})
                  </option>
                ) : null}
                <option value="item">Item specific (only this item)</option>
              </select>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs text-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
