import React, { useCallback, useState } from 'react';
import { PR_QUALITY_SPEC_SECTIONS } from '../../constants/prQualitySpecSections';
import type { PrQualitySpecSectionKey } from '../../constants/prQualitySpecSections';
import { qualitySpecParameterKey } from '../../lib/masterSharedQualitySpecs';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import { MasterAddCustomQualitySpecModal, type QualitySpecAddScope } from './MasterAddCustomQualitySpecModal';
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
  onRequestAddCommon: () => void;
  onRequestAddSpecific: () => void;
  onEditCommonRow?: (row: QualitySpecTableRow) => void;
  onEditSubRow?: (row: QualitySpecTableRow) => void;
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
  onRequestAddCommon,
  onRequestAddSpecific,
  onEditCommonRow,
  onEditSubRow,
}: SectionTablePairProps): React.ReactElement {
  const categoryReady = Boolean(categoryLabel && categoryLabel !== '—');
  const subReady = Boolean(subCategoryLabel && subCategoryLabel !== '—');
  const tablesEnabled = !readOnly;

  return (
    <>
      <QualitySpecTable
        title="Common Specs"
        subtitle={categoryLabel ? `${categoryLabel} — applies to all` : 'Select category in Primary info'}
        addButtonLabel="+ Add Common Spec"
        emptyMessage={`No common ${scopeLabel.toLowerCase()} specs yet. Use “+ Add Common Spec” to open the quality spec form.`}
        rows={commonRows}
        onChange={onCommonChange}
        idPrefix={`${idPrefix}-common`}
        enabled={tablesEnabled && categoryReady}
        disabledHint={
          categoryReady
            ? undefined
            : `Select PR category in Primary info to add ${scopeLabel.toLowerCase()} common specs.`
        }
        onAddClick={onRequestAddCommon}
        onEditRow={onEditCommonRow}
      />
      {showSubTable ? (
        <QualitySpecTable
          title="Sub-category Specs"
          subtitle={subCategoryLabel ? `only for ${subCategoryLabel}` : 'Select sub-category in Primary info'}
          addButtonLabel="+ Add Specific Spec"
          emptyMessage={`No sub-category ${scopeLabel.toLowerCase()} specs yet. Use “+ Add Specific Spec” to open the quality spec form.`}
          rows={subRows}
          onChange={onSubChange}
          idPrefix={`${idPrefix}-sub`}
          enabled={tablesEnabled && subReady}
          disabledHint={subDisabledHint}
          onAddClick={onRequestAddSpecific}
          onEditRow={onEditSubRow}
        />
      ) : null}
    </>
  );
}

type PrQualitySpecTableProps = {
  categoryLabel: string;
  subCategoryLabel: string;
  taxonomyLabel?: string;
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
  taxonomyLabel,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalScope, setModalScope] = useState<'category' | 'subCategory'>('category');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    row: QualitySpecTableRow;
    scope: 'category' | 'subCategory';
  } | null>(null);

  const activeMeta = PR_QUALITY_SPEC_SECTIONS.find((s) => s.key === activeSection) ?? PR_QUALITY_SPEC_SECTIONS[0];
  const canEditSection = (key: PrQualitySpecSectionKey): boolean =>
    sectionEditable ? sectionEditable(key) : true;
  const activeEditable = canEditSection(activeSection);

  const showSubTableForSection =
    activeSection === 'bulkClearance'
      ? showBulkSubTable
      : activeSection === 'finalClearance'
        ? showFinalSubTable
        : showDispatchSubTable;

  const openAddModal = useCallback((scope: 'category' | 'subCategory'): void => {
    setAddError(null);
    setEditing(null);
    setModalScope(scope);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((row: QualitySpecTableRow, scope: 'category' | 'subCategory'): void => {
    setAddError(null);
    setEditing({ row, scope });
    setModalScope(scope);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback((): void => {
    setModalOpen(false);
    setEditing(null);
    setAddError(null);
  }, []);

  const getActiveCommonRows = (): QualitySpecTableRow[] => rowsBySection[activeSection] ?? [];

  const getActiveSubRows = (): QualitySpecTableRow[] => {
    if (activeSection === 'bulkClearance') return bulkSubRows;
    if (activeSection === 'finalClearance') return finalSubRows;
    return dispatchSubRows;
  };

  const appendToActiveSubRows = (rows: QualitySpecTableRow[]): void => {
    if (activeSection === 'bulkClearance') onBulkSubChange(rows);
    else if (activeSection === 'finalClearance') onFinalSubChange(rows);
    else onDispatchSubChange(rows);
  };

  const handleModalSave = (row: QualitySpecTableRow, scopeIn: QualitySpecAddScope): boolean => {
    setAddError(null);
    const paramKey = qualitySpecParameterKey(row.parameter);
    if (!paramKey) {
      setAddError('Parameter name is required.');
      return false;
    }
    // PR has no shared cross-item rule store — "item specific" just means "not shared beyond this
    // item," which is already true for both PR buckets, so it maps to whichever bucket the
    // sub-category table availability would otherwise pick.
    const scope: 'category' | 'subCategory' =
      scopeIn === 'category' || scopeIn === 'subCategory' ? scopeIn : showSubTableForSection ? 'subCategory' : 'category';

    if (editing) {
      if (scope === 'category') {
        if (!categoryLabel || categoryLabel === '—') {
          setAddError('Select a PR category before updating this parameter.');
          return false;
        }
        const existing = getActiveCommonRows();
        if (
          existing.some(
            (r) => r.id !== editing.row.id && qualitySpecParameterKey(r.parameter) === paramKey
          )
        ) {
          setAddError('This parameter already exists in common specs for this section.');
          return false;
        }
        onSectionChange(
          activeSection,
          existing.map((r) =>
            r.id === editing.row.id ? { ...row, custom: editing.row.custom ?? true } : r
          )
        );
        return true;
      }

      if (!showSubTableForSection || !subCategoryLabel || subCategoryLabel === '—') {
        setAddError('Select a PR sub-category before updating this parameter.');
        return false;
      }
      const existing = getActiveSubRows();
      if (
        existing.some(
          (r) => r.id !== editing.row.id && qualitySpecParameterKey(r.parameter) === paramKey
        )
      ) {
        setAddError('This parameter already exists in sub-category specs for this section.');
        return false;
      }
      appendToActiveSubRows(
        existing.map((r) =>
          r.id === editing.row.id ? { ...row, custom: editing.row.custom ?? true } : r
        )
      );
      return true;
    }

    if (scope === 'category') {
      if (!categoryLabel || categoryLabel === '—') {
        setAddError('Select a PR category before adding a common parameter.');
        return false;
      }
      const existing = getActiveCommonRows();
      if (existing.some((r) => qualitySpecParameterKey(r.parameter) === paramKey)) {
        setAddError('This parameter already exists in common specs for this section.');
        return false;
      }
      onSectionChange(activeSection, [...existing, { ...row, custom: true }]);
      return true;
    }

    if (!showSubTableForSection || !subCategoryLabel || subCategoryLabel === '—') {
      setAddError('Select a PR sub-category before adding a sub-category parameter.');
      return false;
    }
    const existing = getActiveSubRows();
    if (existing.some((r) => qualitySpecParameterKey(r.parameter) === paramKey)) {
      setAddError('This parameter already exists in sub-category specs for this section.');
      return false;
    }
    appendToActiveSubRows([...existing, { ...row, custom: true }]);
    return true;
  };

  const sectionTableProps = {
    categoryLabel,
    subCategoryLabel,
    readOnly: !activeEditable,
    onRequestAddCommon: () => openAddModal('category'),
    onRequestAddSpecific: () => openAddModal('subCategory'),
    onEditCommonRow: (row) => openEditModal(row, 'category'),
    onEditSubRow: (row) => openEditModal(row, 'subCategory'),
  };

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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 ${
                isActive
                  ? tabEditable
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-ink-3 text-white shadow-sm'
                  : tabEditable
                    ? 'text-ink-3 bg-surface border border-border hover:bg-surface-3'
                    : 'text-ink-4 bg-surface-3 border border-border'
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
        className="space-y-1 rounded-lg border border-border bg-surface-3 p-3 sm:p-4"
      >
        {!activeEditable ? (
          <p className="text-xs text-warn bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg px-3 py-2 mb-3">
            View only — this quality section is maintained by the{' '}
            {activeSection === 'bulkClearance' ? 'product (RM)' : 'packaging'} team.
          </p>
        ) : null}
        <h4 className="text-sm font-semibold text-ink mb-3">
          {activeMeta.emoji} {activeMeta.title}
        </h4>
        {addError ? (
          <p className="text-xs text-err mb-3" role="alert">
            {addError}
          </p>
        ) : null}

        {activeSection === 'bulkClearance' ? (
          <SectionCommonAndSubTables
            {...sectionTableProps}
            commonRows={rowsBySection.bulkClearance ?? []}
            subRows={bulkSubRows}
            onCommonChange={(rows) => onSectionChange('bulkClearance', rows)}
            onSubChange={onBulkSubChange}
            showSubTable={showBulkSubTable}
            subDisabledHint={bulkSubDisabledHint}
            idPrefix="pr-qs-bulk"
            scopeLabel="bulk clearance"
          />
        ) : null}

        {activeSection === 'finalClearance' ? (
          <SectionCommonAndSubTables
            {...sectionTableProps}
            commonRows={rowsBySection.finalClearance ?? []}
            subRows={finalSubRows}
            onCommonChange={(rows) => onSectionChange('finalClearance', rows)}
            onSubChange={onFinalSubChange}
            showSubTable={showFinalSubTable}
            subDisabledHint={finalSubDisabledHint}
            idPrefix="pr-qs-final"
            scopeLabel="final clearance"
          />
        ) : null}

        {activeSection === 'dispatchSpecs' ? (
          <SectionCommonAndSubTables
            {...sectionTableProps}
            commonRows={rowsBySection.dispatchSpecs ?? []}
            subRows={dispatchSubRows}
            onCommonChange={(rows) => onSectionChange('dispatchSpecs', rows)}
            onSubChange={onDispatchSubChange}
            showSubTable={showDispatchSubTable}
            subDisabledHint={dispatchSubDisabledHint}
            idPrefix="pr-qs-dispatch"
            scopeLabel="dispatch"
          />
        ) : null}
      </div>

      <MasterAddCustomQualitySpecModal
        isOpen={modalOpen}
        onClose={closeModal}
        taxonomyLabel={taxonomyLabel ?? (categoryLabel !== '—' ? categoryLabel : 'PR master')}
        subCategoryLabel={subCategoryLabel === '—' ? '' : subCategoryLabel}
        categoryScopeLabel={categoryLabel === '—' ? '' : categoryLabel}
        allowSubCategoryScope={showSubTableForSection && Boolean(subCategoryLabel && subCategoryLabel !== '—')}
        initialScope={editing?.scope ?? modalScope}
        editRow={editing?.row ?? null}
        onSave={handleModalSave}
      />
    </div>
  );
}
