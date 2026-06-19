import React from 'react';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import { QualitySpecTable } from './QualitySpecTable';

type PmQualitySpecTableProps = {
  categoryLabel: string;
  commonRows: QualitySpecTableRow[];
  onCommonChange: (rows: QualitySpecTableRow[]) => void;
  subCategoryLabel?: string;
  subRows?: QualitySpecTableRow[];
  onSubChange?: (rows: QualitySpecTableRow[]) => void;
  showSubTable?: boolean;
  categoryTableEnabled?: boolean;
  categoryDisabledHint?: string;
  subTableEnabled?: boolean;
  subTableDisabledHint?: string;
};

export function PmQualitySpecTable({
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
}: PmQualitySpecTableProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <QualitySpecTable
        title="Common Specs"
        subtitle={categoryLabel ? `${categoryLabel} — applies to all` : 'applies to all'}
        addButtonLabel="+ Add Common Spec"
        emptyMessage="No common specs yet. Use “Add Common Spec” to define parameters that apply to all sub-categories."
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix="pm-qs-common"
        enabled={categoryTableEnabled}
        disabledHint={categoryDisabledHint}
      />
      {showSubTable && onSubChange ? (
        <QualitySpecTable
          title="Sub-category Specs"
          subtitle={
            subCategoryLabel
              ? `only for ${subCategoryLabel}`
              : 'Select sub-category in Primary info'
          }
          addButtonLabel="+ Add Specific Spec"
          emptyMessage="No sub-category specs yet. Use “Add Specific Spec” to add parameters for this sub-category path."
          rows={subRows}
          onChange={onSubChange}
          idPrefix="pm-qs-sub"
          enabled={subTableEnabled}
          disabledHint={subTableDisabledHint}
        />
      ) : null}
    </div>
  );
}
