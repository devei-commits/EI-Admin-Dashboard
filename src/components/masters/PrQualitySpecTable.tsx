import React, { useState } from 'react';
import { PR_QUALITY_SPEC_SECTIONS } from '../../constants/prQualitySpecSections';
import type { PrQualitySpecSectionKey } from '../../constants/prQualitySpecSections';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import { QualitySpecTable } from './QualitySpecTable';

type SectionTablePairProps = {
  categoryLabel: string;
  subCategoryLabel: string;
  commonRows: QualitySpecTableRow[];
  subRows: QualitySpecTableRow[];
  onCommonChange: (rows: QualitySpecTableRow[]) => void;
  onSubChange: (rows: QualitySpecTableRow[]) => void;
  showSubTable: boolean;
  subDisabledHint?: string;
  idPrefix: string;
  scopeLabel: string;
  readOnly?: boolean;
};

function SectionCommonAndSubTables({
  categoryLabel,
  subCategoryLabel,
  commonRows,
  subRows,
  onCommonChange,
  onSubChange,
  showSubTable,
  subDisabledHint,
  idPrefix,
  scopeLabel,
  readOnly = false,
}: SectionTablePairProps): React.ReactElement {
  const tablesEnabled = !readOnly;
  return (
    <>
      <QualitySpecTable
        title="Common Specs"
        subtitle={categoryLabel ? `${categoryLabel} — applies to all` : 'Select category in Primary info'}
        addButtonLabel="+ Add Common Spec"
        emptyMessage={`No common ${scopeLabel.toLowerCase()} specs yet. Use “Add Common Spec” to define parameters that apply to all sub-categories.`}
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix={`${idPrefix}-common`}
        enabled={tablesEnabled && Boolean(categoryLabel && categoryLabel !== '—')}
        disabledHint={
          categoryLabel && categoryLabel !== '—'
            ? undefined
            : `Select PR category in Primary info to add ${scopeLabel.toLowerCase()} common specs.`
        }
      />
      {showSubTable ? (
        <QualitySpecTable
          title="Sub-category Specs"
          subtitle={subCategoryLabel ? `only for ${subCategoryLabel}` : 'Select sub-category in Primary info'}
          addButtonLabel="+ Add Specific Spec"
          emptyMessage={`No sub-category ${scopeLabel.toLowerCase()} specs yet. Use “Add Specific Spec” to add parameters for this sub-category.`}
          rows={subRows}
          onChange={onSubChange}
          idPrefix={`${idPrefix}-sub`}
          enabled={tablesEnabled && Boolean(subCategoryLabel && subCategoryLabel !== '—')}
          disabledHint={subDisabledHint}
        />
      ) : null}
    </>
  );
}

type PrQualitySpecTableProps = {
  categoryLabel: string;
  subCategoryLabel: string;
  rowsBySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>;
  bulkSubRows: QualitySpecTableRow[];
  finalSubRows: QualitySpecTableRow[];
  dispatchSubRows: QualitySpecTableRow[];
  onSectionChange: (section: PrQualitySpecSectionKey, rows: QualitySpecTableRow[]) => void;
  onBulkSubChange: (rows: QualitySpecTableRow[]) => void;
  onFinalSubChange: (rows: QualitySpecTableRow[]) => void;
  onDispatchSubChange: (rows: QualitySpecTableRow[]) => void;
  showBulkSubTable: boolean;
  showFinalSubTable: boolean;
  showDispatchSubTable: boolean;
  bulkSubDisabledHint?: string;
  finalSubDisabledHint?: string;
  dispatchSubDisabledHint?: string;
  /** When set, tabs/sections the user cannot edit are disabled (view-only). */
  sectionEditable?: (section: PrQualitySpecSectionKey) => boolean;
};

export function PrQualitySpecTable({
  categoryLabel,
  subCategoryLabel,
  rowsBySection,
  bulkSubRows,
  finalSubRows,
  dispatchSubRows,
  onSectionChange,
  onBulkSubChange,
  onFinalSubChange,
  onDispatchSubChange,
  showBulkSubTable,
  showFinalSubTable,
  showDispatchSubTable,
  bulkSubDisabledHint,
  finalSubDisabledHint,
  dispatchSubDisabledHint,
  sectionEditable,
}: PrQualitySpecTableProps): React.ReactElement {
  const [activeSection, setActiveSection] = useState<PrQualitySpecSectionKey>('bulkClearance');

  const activeMeta = PR_QUALITY_SPEC_SECTIONS.find((s) => s.key === activeSection) ?? PR_QUALITY_SPEC_SECTIONS[0];
  const canEditSection = (key: PrQualitySpecSectionKey): boolean =>
    sectionEditable ? sectionEditable(key) : true;
  const activeEditable = canEditSection(activeSection);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Quality specification sections"
      >
        {PR_QUALITY_SPEC_SECTIONS.map((section) => {
          const isActive = activeSection === section.key;
          const tabEditable = canEditSection(section.key);
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`pr-qs-panel-${section.key}`}
              id={`pr-qs-tab-${section.key}`}
              onClick={() => setActiveSection(section.key)}
              title={tabEditable ? undefined : 'View only — assigned to the other team'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                isActive
                  ? tabEditable
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-500 text-white shadow-sm'
                  : tabEditable
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                    : 'text-slate-400 bg-slate-100 border border-slate-200'
              }`}
            >
              <span aria-hidden="true">{section.emoji} </span>
              {section.title}
            </button>
          );
        })}
      </div>

      <div
        key={activeSection}
        id={`pr-qs-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`pr-qs-tab-${activeSection}`}
        className="space-y-1 rounded-lg border border-slate-200 bg-slate-50/40 p-3 sm:p-4"
      >
        {!activeEditable ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            View only — this quality section is maintained by the{' '}
            {activeSection === 'bulkClearance' ? 'product (RM)' : 'packaging'} team.
          </p>
        ) : null}
        <h4 className="text-sm font-semibold text-slate-800 mb-3">
          {activeMeta.emoji} {activeMeta.title}
        </h4>

        {activeSection === 'bulkClearance' ? (
          <SectionCommonAndSubTables
            categoryLabel={categoryLabel}
            subCategoryLabel={subCategoryLabel}
            commonRows={rowsBySection.bulkClearance ?? []}
            subRows={bulkSubRows}
            onCommonChange={(rows) => onSectionChange('bulkClearance', rows)}
            onSubChange={onBulkSubChange}
            showSubTable={showBulkSubTable}
            subDisabledHint={bulkSubDisabledHint}
            idPrefix="pr-qs-bulk"
            scopeLabel="bulk clearance"
            readOnly={!activeEditable}
          />
        ) : null}

        {activeSection === 'finalClearance' ? (
          <SectionCommonAndSubTables
            categoryLabel={categoryLabel}
            subCategoryLabel={subCategoryLabel}
            commonRows={rowsBySection.finalClearance ?? []}
            subRows={finalSubRows}
            onCommonChange={(rows) => onSectionChange('finalClearance', rows)}
            onSubChange={onFinalSubChange}
            showSubTable={showFinalSubTable}
            subDisabledHint={finalSubDisabledHint}
            idPrefix="pr-qs-final"
            scopeLabel="final clearance"
            readOnly={!activeEditable}
          />
        ) : null}

        {activeSection === 'dispatchSpecs' ? (
          <SectionCommonAndSubTables
            categoryLabel={categoryLabel}
            subCategoryLabel={subCategoryLabel}
            commonRows={rowsBySection.dispatchSpecs ?? []}
            subRows={dispatchSubRows}
            onCommonChange={(rows) => onSectionChange('dispatchSpecs', rows)}
            onSubChange={onDispatchSubChange}
            showSubTable={showDispatchSubTable}
            subDisabledHint={dispatchSubDisabledHint}
            idPrefix="pr-qs-dispatch"
            scopeLabel="dispatch"
            readOnly={!activeEditable}
          />
        ) : null}
      </div>
    </div>
  );
}
