import React, { useEffect, useState } from 'react';
import { Modal } from '../orders/Modal';
import { normCustomFieldLabel } from '../../lib/masterCustomFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../../types/qualitySpecTable';

export type MasterQualitySpecDataType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'number-range'
  | 'number-le'
  | 'number-ge'
  | 'number-match'
  | 'date'
  | 'select'
  | 'boolean'
  | 'pass-fail'
  | 'attachment';

export type MasterAddCustomQualitySpecModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taxonomyLabel: string;
  subCategoryLabel: string;
  allowScopeSelection: boolean;
  categoryScopeLabel: string;
  onSave: (row: QualitySpecTableRow, scope: 'common' | 'specific') => void;
};

const DATA_TYPES: { value: MasterQualitySpecDataType; label: string }[] = [
  { value: 'text', label: 'Text — single line' },
  { value: 'textarea', label: 'Text — long / textarea' },
  { value: 'number', label: 'Number — single value' },
  { value: 'number-range', label: 'Number — range (min–max)' },
  { value: 'number-le', label: 'Number — ≤ limit' },
  { value: 'number-ge', label: 'Number — ≥ limit' },
  { value: 'number-match', label: 'Number — target ± tolerance' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'pass-fail', label: 'Pass / Fail' },
  { value: 'attachment', label: 'Attachment / file ref' },
];

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
  allowScopeSelection,
  categoryScopeLabel,
  onSave,
}: MasterAddCustomQualitySpecModalProps): React.ReactElement {
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<MasterQualitySpecDataType>('text');
  const [mandatory, setMandatory] = useState(false);
  const [unit, setUnit] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [spec, setSpec] = useState('');
  const [method, setMethod] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [frequency, setFrequency] = useState('');
  const [sample, setSample] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [scope, setScope] = useState<'common' | 'specific'>('specific');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDataType('text');
    setMandatory(false);
    setUnit('');
    setOptionsText('');
    setSpec('');
    setMethod('');
    setTolerance('');
    setFrequency('');
    setSample('');
    setAcceptance('');
    setScope(allowScopeSelection ? 'specific' : 'common');
    setError('');
  }, [isOpen, allowScopeSelection]);

  const showOptions = dataType === 'select';
  const showUnit = NUMBER_TYPES.includes(dataType);

  const handleSave = (): void => {
    const parameter = normCustomFieldLabel(name);
    if (!parameter) {
      setError('Parameter / field name is required.');
      return;
    }
    const row = createEmptyQualitySpecRow({
      parameter,
      specLimit: spec.trim() || 'Per Master',
      method: method.trim() || '—',
      mandatory,
      tolerance: tolerance.trim() || '—',
      frequency: frequency.trim() || 'Per lot',
      sample: sample.trim() || '1',
      acceptance: acceptance.trim() || 'Within range',
      dataType: showUnit && unit.trim() ? `${dataType}|${unit.trim()}` : dataType,
      custom: true,
    });
    if (dataType === 'select' && optionsText.trim()) {
      row.specLimit = row.specLimit === 'Per Master' ? optionsText.trim() : row.specLimit;
    }
    onSave(row, allowScopeSelection ? scope : 'common');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`+ Add Custom Quality Spec · ${taxonomyLabel}`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Save QC spec
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="mqc-name" className="block text-sm font-medium text-gray-700 mb-1">
            Parameter / Field name <span className="text-red-600">*</span>
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
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="mqc-type" className="block text-sm font-medium text-gray-700 mb-1">
            Data type / Input method <span className="text-red-600">*</span>
          </label>
          <select
            id="mqc-type"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as MasterQualitySpecDataType)}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DATA_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {showOptions ? (
          <div>
            <label htmlFor="mqc-options" className="block text-sm font-medium text-gray-700 mb-1">
              Dropdown options (comma-separated)
            </label>
            <input
              id="mqc-options"
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Option A, Option B, Option C"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="mqc-mand" className="block text-sm font-medium text-gray-700 mb-1">
            Mandatory?
          </label>
          <select
            id="mqc-mand"
            value={mandatory ? 'true' : 'false'}
            onChange={(e) => setMandatory(e.target.value === 'true')}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="false">No · Optional</option>
            <option value="true">Yes · Mandatory</option>
          </select>
        </div>
        {showUnit ? (
          <div>
            <label htmlFor="mqc-unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit (mm / kg / Nm / % etc)
            </label>
            <input
              id="mqc-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : null}
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">QC Spec details</p>
          <div>
            <label htmlFor="mqc-spec" className="block text-sm font-medium text-gray-700 mb-1">
              Spec / Limit
            </label>
            <input
              id="mqc-spec"
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. 5.5–6.5 or ≤50"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="mqc-tol" className="block text-sm font-medium text-gray-700 mb-1">
              Tolerance
            </label>
            <input
              id="mqc-tol"
              type="text"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              placeholder="e.g. ±0.5 or ±5%"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="mqc-method" className="block text-sm font-medium text-gray-700 mb-1">
              Test Method
            </label>
            <input
              id="mqc-method"
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. pH meter @25°C"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mqc-freq" className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <input
                id="mqc-freq"
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g. Per lot"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="mqc-sample" className="block text-sm font-medium text-gray-700 mb-1">
                Sample size
              </label>
              <input
                id="mqc-sample"
                type="text"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                placeholder="e.g. 10/lot"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="mqc-accept" className="block text-sm font-medium text-gray-700 mb-1">
              Acceptance
            </label>
            <input
              id="mqc-accept"
              type="text"
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              placeholder="e.g. Within range"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {allowScopeSelection ? (
            <div>
              <label htmlFor="mqc-scope" className="block text-sm font-medium text-gray-700 mb-1">
                Add to group
              </label>
              <select
                id="mqc-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as 'common' | 'specific')}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="specific">
                  Sub-cat specific (only for {subCategoryLabel || 'this sub-category'})
                </option>
                <option value="common">Common (all sub-cats of {categoryScopeLabel || 'this category'})</option>
              </select>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
