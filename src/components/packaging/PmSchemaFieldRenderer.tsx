import React from 'react';
import type { PmMasterFieldDef } from '../../constants/pmMasterFieldSchema';
import type { PmMasterModuleSlug } from '../../constants/pmMasterFieldSchema';
import type { PmMasterFieldContext } from '../../lib/pmMasterFieldVisibility';
import { visiblePmFieldsForModule } from '../../lib/pmMasterFieldVisibility';
import { MasterSelectWithOptions } from '../masters/MasterSelectWithOptions';
import { MasterCustomFieldsBlock } from '../masters/MasterCustomFieldsBlock';
import { pmCustomFieldsModuleCode, supportsCustomFieldButton } from '../../lib/masterCustomFields';

type FormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

type PmSchemaFieldRendererProps = {
  module: PmMasterModuleSlug;
  context: PmMasterFieldContext;
  formData: Record<string, string | undefined>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  skipKeys?: string[];
  className?: string;
  taxonomyLabel?: string;
  onRemoveCustomFieldValue?: (formKey: string) => void;
};

const inputClass =
  'w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const PmSchemaFieldRenderer: React.FC<PmSchemaFieldRendererProps> = ({
  module,
  context,
  formData,
  errors,
  onChange,
  skipKeys = [],
  className = '',
  taxonomyLabel = '',
  onRemoveCustomFieldValue,
}) => {
  const fields = visiblePmFieldsForModule(module, context, skipKeys);
  const customModuleCode = pmCustomFieldsModuleCode(module);
  const showCustomFields = Boolean(customModuleCode && supportsCustomFieldButton(customModuleCode));

  return (
    <div className={className}>
      {fields.length === 0 ? (
        <p className="text-xs text-gray-500">
          No fields for this section with the current category / sub-category. Adjust selections above.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => (
            <PmSchemaField key={field.key} field={field} formData={formData} errors={errors} onChange={onChange} />
          ))}
        </div>
      )}
      {showCustomFields && customModuleCode ? (
        <MasterCustomFieldsBlock
          moduleCode={customModuleCode}
          taxonomyLabel={taxonomyLabel}
          formData={formData}
          errors={errors}
          onChange={onChange}
          onRemoveFieldValue={onRemoveCustomFieldValue}
        />
      ) : null}
    </div>
  );
};

const PmSchemaField: React.FC<{
  field: PmMasterFieldDef;
  formData: Record<string, string | undefined>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
}> = ({ field, formData, errors, onChange }) => {
  const value = String(formData[field.key] ?? '');
  const error = errors[field.key];
  const label = (
    <>
      {field.label}
      {field.required ? <span className="text-red-600 ml-0.5">*</span> : null}
      {field.cond ? (
        <span className="ml-1 text-[9px] font-bold uppercase text-amber-700">cond</span>
      ) : null}
    </>
  );
  const selectLabel = (
    <>
      {field.label}
      {field.cond ? (
        <span className="ml-1 text-[9px] font-bold uppercase text-amber-700">cond</span>
      ) : null}
    </>
  );

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <textarea
          id={field.key}
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

  if (field.type === 'select' && field.options?.length) {
    return (
      <MasterSelectWithOptions
        id={field.key}
        fieldLabel={field.label}
        label={selectLabel}
        value={value}
        options={field.options}
        onChange={onChange}
        error={error}
        requiredMark={field.required}
      />
    );
  }

  return (
    <div>
      <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        id={field.key}
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
};

export default PmSchemaFieldRenderer;
