import React, { useState } from 'react';
import { MasterAddCustomQualitySpecModal, type QualitySpecAddScope } from './MasterAddCustomQualitySpecModal';
import { PmQualitySpecTable } from './PmQualitySpecTable';
import { RmQualitySpecTable } from './RmQualitySpecTable';
import { addRowToQualitySpecRule, type QualitySpecRuleEntityType } from '../../services/qualitySpecRules.service';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';

/** The 2-table UI only ever edits a row as belonging to the category or sub-category display —
 * sub-sub-category-scoped rows are folded into the sub-category table on read (see the backend's
 * resolveEntityQualitySpecs), so editing one re-saves it at sub-category scope. */
type EditScope = 'category' | 'subCategory';

export type MasterCustomQualitySpecsSectionProps = {
  variant: 'pm' | 'rm';
  entityType: QualitySpecRuleEntityType;
  /** Resolved category (functionalCategory) — the "category" rule scope key. */
  categoryScopeKey: string;
  /** Resolved sub-category (functionalSub) — the "sub-category" rule scope key. */
  subCategoryKey: string;
  /** Resolved sub-sub-category (RM only) — the "sub-sub-category" rule scope key. */
  subSubCategoryKey?: string;
  taxonomyLabel: string;
  categoryLabel: string;
  categoryScopeLabel: string;
  subCategoryLabel: string;
  subSubCategoryLabel?: string;
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
  entityType,
  categoryScopeKey,
  subCategoryKey,
  subSubCategoryKey = '',
  taxonomyLabel,
  categoryLabel,
  categoryScopeLabel,
  subCategoryLabel,
  subSubCategoryLabel,
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{
    row: QualitySpecTableRow;
    scope: EditScope;
  } | null>(null);
  const allowSubCategoryScope = showSubTable && Boolean(subCategoryKey.trim());
  const allowSubSubCategoryScope = allowSubCategoryScope && Boolean(subSubCategoryKey.trim());

  const closeModal = (): void => {
    setModalOpen(false);
    setEditing(null);
    setAddError(null);
  };

  const openAddModal = (): void => {
    setEditing(null);
    setAddError(null);
    setModalOpen(true);
  };

  const openEditModal = (row: QualitySpecTableRow, scope: EditScope): void => {
    setEditing({ row, scope });
    setAddError(null);
    setModalOpen(true);
  };

  const handleSave = async (row: QualitySpecTableRow, scope: QualitySpecAddScope): Promise<boolean> => {
    setAddError(null);

    if (editing) {
      // Edits always re-save at the table's own scope (category or sub-category) — see EditScope note above.
      const isCategory = editing.scope === 'category';
      const scopeKey = isCategory ? categoryScopeKey.trim() : subCategoryKey.trim();
      if (!scopeKey) {
        setAddError(`Select a ${isCategory ? 'category' : 'sub-category'} before updating this parameter.`);
        return false;
      }
      if (editing.row.custom) {
        setSaving(true);
        const result = await addRowToQualitySpecRule(
          entityType,
          categoryScopeKey.trim(),
          isCategory ? '' : scopeKey,
          '',
          row
        );
        setSaving(false);
        if (result.ok === false && result.reason === 'duplicate') {
          setAddError(`This parameter already exists for this ${isCategory ? 'category' : 'sub-category'}.`);
          return false;
        }
      }
      if (isCategory) {
        onCommonChange(
          commonRows.map((existing) =>
            existing.id === editing.row.id ? { ...row, custom: editing.row.custom ?? true } : existing
          )
        );
      } else {
        onSubChange(
          subRows.map((existing) =>
            existing.id === editing.row.id ? { ...row, custom: editing.row.custom ?? true } : existing
          )
        );
      }
      return true;
    }

    if (scope === 'item') {
      // No shared rule involved — just this item's own rows (existing per-item custom behavior).
      if (showSubTable) onSubChange([...subRows, { ...row, custom: true }]);
      else onCommonChange([...commonRows, { ...row, custom: true }]);
      return true;
    }

    const catKey = categoryScopeKey.trim();
    if (!catKey) {
      setAddError('Select a category before adding a shared parameter.');
      return false;
    }
    if (scope === 'category') {
      setSaving(true);
      const result = await addRowToQualitySpecRule(entityType, catKey, '', '', row);
      setSaving(false);
      if (result.ok === false) {
        if (result.reason === 'duplicate') setAddError('This parameter already exists for this category.');
        return false;
      }
      onCommonChange([...commonRows, { ...row, custom: true }]);
      return true;
    }

    const subKey = subCategoryKey.trim();
    if (!subKey) {
      setAddError('Select a sub-category before adding a shared parameter.');
      return false;
    }
    if (scope === 'subCategory') {
      setSaving(true);
      const result = await addRowToQualitySpecRule(entityType, catKey, subKey, '', row);
      setSaving(false);
      if (result.ok === false) {
        if (result.reason === 'duplicate') setAddError('This parameter already exists for this sub-category.');
        return false;
      }
      onSubChange([...subRows, { ...row, custom: true }]);
      return true;
    }

    // scope === 'subSubCategory'
    const subSubKey = subSubCategoryKey.trim();
    if (!subSubKey) {
      setAddError('Select a sub-sub-category before adding a shared parameter.');
      return false;
    }
    setSaving(true);
    const result = await addRowToQualitySpecRule(entityType, catKey, subKey, subSubKey, row);
    setSaving(false);
    if (result.ok === false) {
      if (result.reason === 'duplicate') setAddError('This parameter already exists for this sub-sub-category.');
      return false;
    }
    // Sub-sub-category rows are folded into the sub-category table on read — display them there too.
    onSubChange([...subRows, { ...row, custom: true }]);
    return true;
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
    onEditCommonRow: (row) => openEditModal(row, 'category'),
    onEditSubRow: (row) => openEditModal(row, 'subCategory'),
  };

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-3">Quality specifications</h3>
          <p className="text-xs text-ink-3 mt-1">
            Custom parameters are shared across all items in the same category or sub-category. Removing a
            parameter on this item hides it here only — other items keep it.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-2.5 py-1 text-xs font-semibold text-brand bg-brand-soft border border-brand-soft rounded-lg hover:bg-brand-soft"
        >
          + Add Custom Quality Spec
        </button>
      </div>
      {addError ? (
        <p className="text-xs text-err" role="alert">
          {addError}
        </p>
      ) : null}
      {variant === 'pm' ? <PmQualitySpecTable {...tableProps} /> : <RmQualitySpecTable {...tableProps} />}
      <MasterAddCustomQualitySpecModal
        isOpen={modalOpen}
        onClose={closeModal}
        taxonomyLabel={taxonomyLabel}
        subCategoryLabel={subCategoryLabel}
        subSubCategoryLabel={subSubCategoryLabel}
        categoryScopeLabel={categoryScopeLabel}
        allowSubCategoryScope={allowSubCategoryScope}
        allowSubSubCategoryScope={allowSubSubCategoryScope}
        initialScope={editing?.scope}
        editRow={editing?.row ?? null}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
