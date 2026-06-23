import React from 'react';
import type { RmMasterFieldDef, RmMasterModuleSlug } from '../../constants/rmMasterFieldSchema';
import type { RmMasterFieldContext } from '../../lib/rmMasterFieldVisibility';
import { visibleRmFieldsForModule } from '../../lib/rmMasterFieldVisibility';
import { MasterSelectWithOptions } from '../masters/MasterSelectWithOptions';
import { MasterCustomFieldsBlock } from '../masters/MasterCustomFieldsBlock';
import { pmCustomFieldsModuleCode, supportsCustomFieldButton } from '../../lib/masterCustomFields';

type FormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

type RmSchemaFieldRendererProps = {
  module: RmMasterModuleSlug;
  context: RmMasterFieldContext;
  formData: Record<string, string | undefined>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  skipKeys?: string[];
  className?: string;
  primaryUomOptions?: readonly string[];
  taxonomyLabel?: string;
  onRemoveCustomFieldValue?: (formKey: string) => void;
};

const inputClass =
  'w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const RmSchemaFieldRenderer: React.FC<RmSchemaFieldRendererProps> = ({
  module,
  context,
  formData,
  errors,
  onChange,
  skipKeys = [],
  className = '',
  primaryUomOptions,
  taxonomyLabel = '',
  onRemoveCustomFieldValue,
}) => {
  const fields = visibleRmFieldsForModule(module, context, skipKeys);
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
            <RmSchemaField
              key={field.key}
              field={field}
              formData={formData}
              errors={errors}
              onChange={onChange}
              primaryUomOptions={field.key === 'primaryUom' ? primaryUomOptions : undefined}
            />
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

const RmSchemaField: React.FC<{
  field: RmMasterFieldDef;
  formData: Record<string, string | undefined>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  primaryUomOptions?: readonly string[];
}> = ({ field, formData, errors, onChange, primaryUomOptions }) => {
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
  const options = primaryUomOptions ?? field.options;

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

  if (field.type === 'select' && options?.length) {
    return (
      <MasterSelectWithOptions
        id={field.key}
        fieldLabel={field.label}
        label={selectLabel}
        value={value}
        options={options}
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
      <input type="text" id={field.key} value={value} onChange={onChange} className={inputClass} />
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default RmSchemaFieldRenderer;
