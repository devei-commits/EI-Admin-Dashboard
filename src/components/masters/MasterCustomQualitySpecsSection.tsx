import React, { useState } from 'react';
import { MasterAddCustomQualitySpecModal } from './MasterAddCustomQualitySpecModal';
import { PmQualitySpecTable } from './PmQualitySpecTable';
import { RmQualitySpecTable } from './RmQualitySpecTable';
import {
  addSharedQualitySpec,
  type MasterSharedQualitySpecEntity,
} from '../../lib/masterSharedQualitySpecs';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';

export type MasterCustomQualitySpecsSectionProps = {
  variant: 'pm' | 'rm';
  entity: MasterSharedQualitySpecEntity;
  categoryScopeKey: string;
  subScopePathKey: string;
  taxonomyLabel: string;
  categoryLabel: string;
  categoryScopeLabel: string;
  subCategoryLabel: string;
  commonRows: QualitySpecTableRow[];
  subRows: QualitySpecTableRow[];
  onCommonChange: (rows: QualitySpecTableRow[]) => void;
  onSubChange: (rows: QualitySpecTableRow[]) => void;
  showSubTable: boolean;
  categoryTableEnabled?: boolean;
  subTableEnabled?: boolean;
  categoryDisabledHint?: string;
  subTableDisabledHint?: string;
};

export function MasterCustomQualitySpecsSection({
  variant,
  entity,
  categoryScopeKey,
  subScopePathKey,
  taxonomyLabel,
  categoryLabel,
  categoryScopeLabel,
  subCategoryLabel,
  commonRows,
  subRows,
  onCommonChange,
  onSubChange,
  showSubTable,
  categoryTableEnabled = true,
  subTableEnabled = true,
  categoryDisabledHint,
  subTableDisabledHint,
}: MasterCustomQualitySpecsSectionProps): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const allowScopeSelection = showSubTable && Boolean(subCategoryLabel.trim());

  const handleSave = (row: QualitySpecTableRow, scope: 'common' | 'specific'): void => {
    setAddError(null);
    if (scope === 'common') {
      const scopeKey = categoryScopeKey.trim();
      if (!scopeKey) {
        setAddError('Select a category before adding a shared parameter.');
        return;
      }
      const result = addSharedQualitySpec(entity, 'common', scopeKey, row);
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          setAddError('This parameter already exists for this category.');
        }
        return;
      }
      onCommonChange([...commonRows, { ...row, custom: true }]);
      return;
    }
    const pathKey = subScopePathKey.trim();
    if (!pathKey) {
      setAddError('Select a sub-category before adding a shared parameter.');
      return;
    }
    const result = addSharedQualitySpec(entity, 'sub', pathKey, row);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        setAddError('This parameter already exists for this sub-category.');
      }
      return;
    }
    onSubChange([...subRows, { ...row, custom: true }]);
  };

  const tableProps = {
    categoryLabel,
    commonRows,
    onCommonChange,
    subCategoryLabel,
    subRows,
    onSubChange,
    showSubTable,
    categoryTableEnabled,
    subTableEnabled,
    categoryDisabledHint,
    subTableDisabledHint,
    showAddButton: false,
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Quality specifications</h3>
          <p className="text-xs text-gray-500 mt-1">
            Custom parameters are shared across all items in the same category or sub-category. Removing a
            parameter on this item hides it here only — other items keep it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
        >
          + Add Custom Quality Spec
        </button>
      </div>
      {addError ? (
        <p className="text-xs text-red-600" role="alert">
          {addError}
        </p>
      ) : null}
      {variant === 'pm' ? <PmQualitySpecTable {...tableProps} /> : <RmQualitySpecTable {...tableProps} />}
      <MasterAddCustomQualitySpecModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        taxonomyLabel={taxonomyLabel}
        subCategoryLabel={subCategoryLabel}
        categoryScopeLabel={categoryScopeLabel}
        allowScopeSelection={allowScopeSelection}
        onSave={handleSave}
      />
    </div>
  );
}
