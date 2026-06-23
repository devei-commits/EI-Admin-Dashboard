import React, { useState } from 'react';
import { Modal } from '../orders/Modal';
import { useMasterDropdownOptions } from '../../context/MasterDropdownOptionsContext';

export type MasterDropdownOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fieldLabel: string;
  baseOptions: readonly string[];
};

export function MasterDropdownOptionsModal({
  isOpen,
  onClose,
  fieldLabel,
  baseOptions,
}: MasterDropdownOptionsModalProps): JSX.Element {
  const { getCustomOptions, addOption, removeOption } = useMasterDropdownOptions();
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState('');

  const customOptions = getCustomOptions(fieldLabel);

  const handleAdd = (): void => {
    const result = addOption(fieldLabel, newOption);
    if (!result.ok) {
      setError(result.reason === 'duplicate' ? 'Option already exists.' : 'Enter a value.');
      return;
    }
    setNewOption('');
    setError('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage options · ${fieldLabel}`}
      size="sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Done
        </button>
      }
    >
      <p className="text-xs text-gray-600 mb-3">
        Built-in options cannot be removed. Custom options are saved for this browser and apply to all{' '}
        {fieldLabel} dropdowns in master forms.
      </p>
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {baseOptions.map((opt) => (
          <div key={`base-${opt}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{opt}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Built-in</span>
          </div>
        ))}
        {customOptions.map((opt) => (
          <div key={`custom-${opt}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{opt}</span>
            <button
              type="button"
              onClick={() => removeOption(fieldLabel, opt)}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        {baseOptions.length === 0 && customOptions.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No options yet.</p>
        ) : null}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={newOption}
          onChange={(e) => {
            setNewOption(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Type new option…"
          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          + Add
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
