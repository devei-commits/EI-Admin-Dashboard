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
}: RmQualitySpecTableProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <QualitySpecTable
        title="Category specs (common)"
        subtitle={categoryLabel || '—'}
        addButtonLabel="+ Add Category Spec"
        emptyMessage="No category specs yet. Use “Add Category Spec” to define parameters even when no template exists."
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix="qs-common"
        enabled={categoryTableEnabled}
        disabledHint={categoryDisabledHint}
      />
      {showSubTable && onSubChange ? (
        <QualitySpecTable
          title="Sub-category specs"
          subtitle={subCategoryLabel || '—'}
          addButtonLabel="+ Add Sub-category Spec"
          emptyMessage="No sub-category specs yet. Use “Add Sub-category Spec” to add parameters for this sub-category path."
          rows={subRows}
          onChange={onSubChange}
          idPrefix="qs-sub"
          enabled={subTableEnabled}
          disabledHint={subTableDisabledHint}
        />
      ) : null}
    </div>
  );
}
