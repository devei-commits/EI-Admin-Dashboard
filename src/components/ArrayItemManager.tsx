import React from 'react';
import { TEMP_FIELD_MAPPINGS } from '../utils/masterFormUtils';

interface ArrayItemManagerProps {
 masterType: 'packaging' | 'rawMaterial' | 'bom';
 itemType: string; // e.g., 'variant', 'vendor', 'test', 'rmLine', 'pmLine'
 items: unknown[];
 tempFields: Record<string, string>;
 onTempFieldChange: (field: string, value: string) => void;
 onAdd: () => void;
 onRemove: (index: number) => void;
 errors?: Record<string, string>;
 itemLabel?: string;
 columns?: Array<{
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: Array<{ label: string; value: string }>;
  /** When true, shows a red asterisk — only for fields validated on add (e.g. test name + result). */
  required?: boolean;
 }>;
}

/**
 * Reusable component for managing array items (variants, vendors, tests, etc.)
 * Replaces inline temp field logic with a consistent UI pattern
 */
const ArrayItemManager: React.FC<ArrayItemManagerProps> = ({
 masterType,
 itemType,
 items,
 tempFields,
 onTempFieldChange,
 onAdd,
 onRemove,
 errors = {},
 itemLabel = itemType,
 columns = [],
}) => {
 const mapping = TEMP_FIELD_MAPPINGS[masterType]?.[itemType];
 if (!mapping) return null;

 const { tempFields: tempFieldNames } = mapping;

 // Default columns if not provided
 const defaultColumns = tempFieldNames.map(field => ({
  key: field,
  label: field.replace(/([A-Z])/g, ' $1').trim(),
  type: 'text' as const,
 }));

 const displayColumns = columns.length > 0 ? columns : defaultColumns;

 return (
  <div className="border border-border rounded-lg p-4 mb-4">
   <h3 className="font-semibold text-ink mb-4 capitalize">{itemLabel} Manager</h3>

   {/* Input Fields */}
   <div className="bg-surface-3 p-4 rounded-lg mb-4">
    <div className="grid grid-cols-2 gap-4 mb-4">
     {displayColumns.map(col => (
      <div key={col.key}>
      <label htmlFor={`${itemType}-${col.key}`} className="block text-xs font-medium text-ink-3 mb-1">
        {col.label}
        {col.required ? <span className="text-err ml-0.5" aria-hidden>*</span> : null}
       </label>
       {col.type === 'select' && col.options ? (
        <select
         id={`${itemType}-${col.key}`}
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-border rounded text-sm"
        >
         <option value="">Select {col.label}</option>
         {col.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
         ))}
        </select>
       ) : col.type === 'date' ? (
        <input
         id={`${itemType}-${col.key}`}
         type="date"
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-border rounded text-sm"
        />
       ) : col.type === 'number' ? (
        <input
         id={`${itemType}-${col.key}`}
         type="number"
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-border rounded text-sm"
         placeholder="0"
        />
       ) : (
        <input
         id={`${itemType}-${col.key}`}
         type="text"
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-border rounded text-sm"
         placeholder={`Enter ${col.label.toLowerCase()}`}
        />
       )}
       {errors[col.key] && (
        <p className="text-err text-xs mt-1">{errors[col.key]}</p>
       )}
      </div>
     ))}
    </div>

    <button
     onClick={onAdd}
     className="w-full py-2 px-4 bg-brand text-white rounded text-sm hover:bg-brand-press transition font-medium"
    >
     + Add {itemLabel}
    </button>
   </div>

   {/* Items List */}
   {items.length > 0 && (
    <div className="overflow-auto max-h-[70vh]">
     <table className="w-full text-sm">
      <thead className="sticky top-0 z-20">
       <tr className="[&_th]:bg-surface-3 bg-surface-3 border-b border-border">
        {displayColumns.map(col => (
         <th scope="col" key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-ink-2 capitalize">
          {col.label}
         </th>
        ))}
        <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-ink-2 w-12">
         Action
        </th>
       </tr>
      </thead>
      <tbody>
       {items.map((item, idx) => (
        <tr key={idx} className="border-b border-border hover:bg-surface-3 transition">
         {displayColumns.map(col => (
          <td key={col.key} className="px-3 py-2 text-ink-2">
           {typeof item[col.key] === 'object' ? JSON.stringify(item[col.key]) : String(item[col.key] || '-')}
          </td>
         ))}
         <td className="px-3 py-2 text-center">
          <button
           onClick={() => onRemove(idx)}
           className="text-err hover:brightness-90 font-medium text-xs hover:underline"
          >
           Remove
          </button>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   )}

   {items.length === 0 && (
    <p className="text-ink-3 text-sm text-center py-4">
     No {itemLabel}s added yet
    </p>
   )}
  </div>
 );
};

export default ArrayItemManager;
