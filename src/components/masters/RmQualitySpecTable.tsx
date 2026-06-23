import React from 'react';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import { QualitySpecTable } from './QualitySpecTable';

type RmQualitySpecTableProps = {
  categoryLabel: string;
  commonRows: QualitySpecTableRow[];
  onCommonChange: (rows: QualitySpecTableRow[]) => void;
  subCategoryLabel?: string;
  subRows?: QualitySpecTableRow[];
  onSubChange?: (rows: QualitySpecTableRow[]) => void;
  /** Always show sub-category section; use `subTableEnabled` to gate editing. */
  showSubTable?: boolean;
  categoryTableEnabled?: boolean;
  categoryDisabledHint?: string;
  subTableEnabled?: boolean;
  subTableDisabledHint?: string;
  showAddButton?: boolean;
};

export function RmQualitySpecTable({
  categoryLabel,
  commonRows,
  onCommonChange,
  subCategoryLabel,
  subRows = [],
  onSubChange,
  showSubTable = true,
  categoryTableEnabled = true,
  categoryDisabledHint,
  subTableEnabled = true,
  subTableDisabledHint,
  showAddButton = true,
}: RmQualitySpecTableProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <QualitySpecTable
        title="Category specs (common)"
        subtitle={categoryLabel || '—'}
        addButtonLabel="+ Add Category Spec"
        emptyMessage="No category specs yet. Use “+ Add Custom Quality Spec” above to add parameters."
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix="qs-common"
        enabled={categoryTableEnabled}
        disabledHint={categoryDisabledHint}
        showAddButton={showAddButton}
      />
      {showSubTable && onSubChange ? (
        <QualitySpecTable
          title="Sub-category specs"
          subtitle={subCategoryLabel || '—'}
          addButtonLabel="+ Add Sub-category Spec"
          emptyMessage="No sub-category specs yet. Use “+ Add Custom Quality Spec” above to add parameters."
          rows={subRows}
          onChange={onSubChange}
          idPrefix="qs-sub"
          enabled={subTableEnabled}
          disabledHint={subTableDisabledHint}
          showAddButton={showAddButton}
        />
      ) : null}
    </div>
  );
}
