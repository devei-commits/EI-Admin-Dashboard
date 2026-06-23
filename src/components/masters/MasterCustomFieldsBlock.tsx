import React, { useMemo, useState } from 'react';
import { MasterSelectWithOptions } from './MasterSelectWithOptions';
import { MasterAddCustomFieldModal } from './MasterAddCustomFieldModal';
import { useOptionalMasterCustomFields } from '../../context/MasterCustomFieldsContext';
import {
  customFieldFormKey,
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
}: MasterCustomFieldsBlockProps): React.ReactElement | null {
  const customFieldsCtx = useOptionalMasterCustomFields();
  const [modalOpen, setModalOpen] = useState(false);

  const fields = useMemo(() => {
    if (!customFieldsCtx) return [];
    return customFieldsCtx.getFields(moduleCode);
  }, [customFieldsCtx, moduleCode, customFieldsCtx?.version]);

  if (!customFieldsCtx || !supportsCustomFieldButton(moduleCode)) {
    return null;
  }

  const handleRemove = (field: MasterCustomFieldDef): void => {
    const formKey = customFieldFormKey(field.id);
    customFieldsCtx.removeField(moduleCode, field.id);
    onRemoveFieldValue?.(formKey);
  };

  return (
    <div className="space-y-3 border-t border-dashed border-gray-200 pt-4 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Custom fields</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
        >
          + Custom field
        </button>
      </div>
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
      />
    </div>
  );
}
