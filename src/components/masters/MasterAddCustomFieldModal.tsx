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

export type MasterAddCustomFieldModalProps = {
  isOpen: boolean;
  onClose: () => void;
  moduleCode: MasterCustomFieldModuleCode;
  taxonomyLabel: string;
  onAdded?: (field: MasterCustomFieldDef) => void;
};

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
}: MasterAddCustomFieldModalProps): React.ReactElement {
  const { addField } = useMasterCustomFields();
  const [name, setName] = useState('');
  const [type, setType] = useState<MasterCustomFieldType>('text');
  const [mandatory, setMandatory] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setType('text');
    setMandatory(false);
    setOptionsText('');
    setUnit('');
    setError('');
  }, [isOpen]);

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
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Save field
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="cf-name" className="block text-sm font-medium text-gray-700 mb-1">
            Parameter / field name <span className="text-red-600">*</span>
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
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="cf-type" className="block text-sm font-medium text-gray-700 mb-1">
            Data type / input method <span className="text-red-600">*</span>
          </label>
          <select
            id="cf-type"
            value={type}
            onChange={(e) => setType(e.target.value as MasterCustomFieldType)}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label htmlFor="cf-options" className="block text-sm font-medium text-gray-700 mb-1">
              Dropdown options (comma-separated)
            </label>
            <input
              id="cf-options"
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Option A, Option B, Option C"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="cf-mand" className="block text-sm font-medium text-gray-700 mb-1">
            Mandatory?
          </label>
          <select
            id="cf-mand"
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
            <label htmlFor="cf-unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit (mm / kg / Nm / % etc)
            </label>
            <input
              id="cf-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
