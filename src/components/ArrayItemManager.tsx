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
  <div className="border border-gray-300 rounded-lg p-4 mb-4">
   <h3 className="font-semibold text-gray-800 mb-4 capitalize">{itemLabel} Manager</h3>

   {/* Input Fields */}
   <div className="bg-gray-50 p-4 rounded-lg mb-4">
    <div className="grid grid-cols-2 gap-4 mb-4">
     {displayColumns.map(col => (
      <div key={col.key}>
      <label htmlFor={`${itemType}-${col.key}`} className="block text-xs font-medium text-gray-600 mb-1">
        {col.label}
        {col.required ? <span className="text-red-600 ml-0.5" aria-hidden>*</span> : null}
       </label>
       {col.type === 'select' && col.options ? (
        <select
         id={`${itemType}-${col.key}`}
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-gray-300 rounded text-sm"
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
         className="w-full p-2 border border-gray-300 rounded text-sm"
        />
       ) : col.type === 'number' ? (
        <input
         id={`${itemType}-${col.key}`}
         type="number"
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-gray-300 rounded text-sm"
         placeholder="0"
        />
       ) : (
        <input
         id={`${itemType}-${col.key}`}
         type="text"
         value={tempFields[col.key] || ''}
         onChange={(e) => onTempFieldChange(col.key, e.target.value)}
         className="w-full p-2 border border-gray-300 rounded text-sm"
         placeholder={`Enter ${col.label.toLowerCase()}`}
        />
       )}
       {errors[col.key] && (
        <p className="text-red-500 text-xs mt-1">{errors[col.key]}</p>
       )}
      </div>
     ))}
    </div>

    <button
     onClick={onAdd}
     className="w-full py-2 px-4 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition font-medium"
    >
     + Add {itemLabel}
    </button>
   </div>

   {/* Items List */}
   {items.length > 0 && (
    <div className="overflow-x-auto">
     <table className="w-full text-sm">
      <thead>
       <tr className="bg-gray-100 border-b border-gray-300">
        {displayColumns.map(col => (
         <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 capitalize">
          {col.label}
         </th>
        ))}
        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-12">
         Action
        </th>
       </tr>
      </thead>
      <tbody>
       {items.map((item, idx) => (
        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
         {displayColumns.map(col => (
          <td key={col.key} className="px-3 py-2 text-gray-700">
           {typeof item[col.key] === 'object' ? JSON.stringify(item[col.key]) : String(item[col.key] || '-')}
          </td>
         ))}
         <td className="px-3 py-2 text-center">
          <button
           onClick={() => onRemove(idx)}
           className="text-red-600 hover:text-red-800 font-medium text-xs hover:underline"
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
    <p className="text-gray-500 text-sm text-center py-4">
     No {itemLabel}s added yet
    </p>
   )}
  </div>
 );
};

export default ArrayItemManager;
