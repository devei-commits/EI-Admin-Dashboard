import React, { useState } from 'react';
import { MasterAddCustomQualitySpecModal } from './MasterAddCustomQualitySpecModal';
import { PmQualitySpecTable } from './PmQualitySpecTable';
import { RmQualitySpecTable } from './RmQualitySpecTable';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';

export type MasterCustomQualitySpecsSectionProps = {
  variant: 'pm' | 'rm';
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
  const allowScopeSelection = showSubTable && Boolean(subCategoryLabel.trim());

  const handleSave = (row: QualitySpecTableRow, scope: 'common' | 'specific'): void => {
    if (scope === 'common') {
      onCommonChange([...commonRows, row]);
    } else {
      onSubChange([...subRows, row]);
    }
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
            Add custom QC parameters via the button — they appear in the tables below for review and edit.
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
