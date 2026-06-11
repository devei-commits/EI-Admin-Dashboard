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
  showSubTable?: boolean;
};

export function RmQualitySpecTable({
  categoryLabel,
  commonRows,
  onCommonChange,
  subCategoryLabel,
  subRows = [],
  onSubChange,
  showSubTable = false,
}: RmQualitySpecTableProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <QualitySpecTable
        title="Common Specs applies to all"
        subtitle={categoryLabel || '—'}
        addButtonLabel="+ Add Common Spec"
        emptyMessage='No common specs yet. Use "Add Common Spec" or pick a bulk RM category to load defaults.'
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix="qs-common"
      />
      {showSubTable && onSubChange ? (
        <QualitySpecTable
          title="Sub-category Specs only for"
          subtitle={subCategoryLabel || '—'}
          addButtonLabel="+ Add Specific Spec"
          emptyMessage='No sub-category specs yet. Use "Add Specific Spec" or pick a sub-category to load defaults.'
          rows={subRows}
          onChange={onSubChange}
          idPrefix="qs-sub"
        />
      ) : null}
    </div>
  );
}
