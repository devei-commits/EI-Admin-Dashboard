import React from 'react';
import type { PmQualitySpecFieldDef } from '../../constants/pmQualitySpecFields';
import type { PmQualitySpecFieldGroup } from '../../lib/pmQualitySpecVisibility';

type PmQualitySpecSectionProps = {
  groups: PmQualitySpecFieldGroup[];
  categoryLabel: string;
  subCategoryLabel: string;
  specs: Record<string, string>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
};

export function PmQualitySpecSection({
  groups,
  categoryLabel,
  subCategoryLabel,
  specs,
  errors,
  onChange,
}: PmQualitySpecSectionProps): React.ReactElement | null {
  if (groups.length === 0) return null;

  return (
    <div className="border-t border-gray-200 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
        Category-specific quality
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        {categoryLabel}
        {subCategoryLabel ? ` → ${subCategoryLabel}` : ''}
        {' — optional quality attributes for this path.'}
      </p>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">{group.title}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.fields.map((field) => (
                <PmQualitySpecField
                  key={field.id}
                  field={field}
                  value={specs[field.id] ?? ''}
                  error={errors[field.id]}
                  onChange={onChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PmQualitySpecFieldProps = {
  field: PmQualitySpecFieldDef;
  value: string;
  error?: string;
  onChange: (fieldId: string, value: string) => void;
};

function PmQualitySpecField({ field, value, error, onChange }: PmQualitySpecFieldProps): React.ReactElement {
  const inputId = field.id;

  if (field.inputType === 'yesNo') {
    return (
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
        </label>
        <select
          id={inputId}
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
          }`}
        >
          <option value="">Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        {error ? (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
      </label>
      <input
        type="text"
        id={inputId}
        value={value || ''}
        onChange={(e) => onChange(field.id, e.target.value)}
        placeholder={field.placeholder}
        aria-invalid={error ? true : undefined}
        className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
