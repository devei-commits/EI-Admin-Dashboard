import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { QualitySpecTable } from '../components/masters/QualitySpecTable';
import { MasterAddCustomQualitySpecModal } from '../components/masters/MasterAddCustomQualitySpecModal';
import { TechnicalSpecRuleModal } from '../components/masters/TechnicalSpecRuleModal';
import { SpecScopeCombobox } from '../components/masters/SpecScopeCombobox';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  fetchQualitySpecRules,
  saveQualitySpecRule,
  fetchRuleScopes,
  type PmRuleScope,
  deleteQualitySpecRule,
  QUALITY_SPEC_RULE_ENTITY_TYPES,
  type QualitySpecRule,
  type QualitySpecRuleEntityType,
} from '../services/qualitySpecRules.service';
import {
  fetchTechnicalSpecRules,
  deleteTechnicalSpecRule,
  type TechnicalSpecRule,
  type TechnicalSpecRuleEntityType,
} from '../services/technicalSpecRules.service';
import {
  taxonomyEntityFor,
  ruleCategoryOptions,
  ruleSubCategoryOptions,
  ruleSubSubCategoryOptions,
  mergeOptions,
  pmCategoryItemTypes,
} from '../lib/specRuleTaxonomy';
import {
  fetchRawMaterialsForPicker,
  fetchRawMaterialById,
  setRawMaterialItemQualitySpecs,
} from '../services/rawMaterials.service';
import {
  fetchPackMaterialsForPicker,
  fetchPackMaterialById,
  setPackMaterialItemQualitySpecs,
} from '../services/packMaterials.service';
import {
  fetchPRProducts,
  fetchPRProductDetail,
  setProductItemQualitySpecs,
  type PrItemQualitySpecSection,
} from '../services/productsMaster.service';
import { hydrateRmQualitySpecRows } from '../lib/rmQualitySpecVisibility';
import { hydratePmQualitySpecRows } from '../lib/pmQualitySpecVisibility';
import { TableSkeleton } from '../components/ui/Skeleton';
import RecordDetailModal from '../components/ui/RecordDetailModal';
import { EmptyState } from '../components/ui/EmptyState';
import { procBtnPrimary, procBtnSecondary, procInputClass, procChipClass } from '../components/procurement/ProcSection';

type SpecType = 'quality' | 'technical';

/** Item picker option — shared shape across RM / PM / PR. */
type ItemPick = { id: string; name: string; code: string };

/** Admin PR entity → the section the item-specific edit targets (and the detail key it seeds from). */
const PR_SECTION_BY_ENTITY: Partial<Record<QualitySpecRuleEntityType, PrItemQualitySpecSection>> = {
  PR_BULK_CLEARANCE: 'bulk',
  PR_FINAL_CLEARANCE: 'final',
  PR_DISPATCH_SPECS: 'dispatch',
};
const PR_SECTION_DETAIL_KEY: Record<PrItemQualitySpecSection, string> = {
  bulk: 'bulkClearance',
  final: 'finalClearance',
  dispatch: 'dispatchSpecs',
};

/** Technical specs are per material/product — all PR quality namespaces map to a single PR. */
function technicalEntityFor(entity: QualitySpecRuleEntityType): TechnicalSpecRuleEntityType {
  if (entity === 'RM') return 'RM';
  if (entity === 'PM') return 'PM';
  return 'PR';
}

type UnifiedRow =
  | { specType: 'quality'; rule: QualitySpecRule }
  | { specType: 'technical'; rule: TechnicalSpecRule };

export default function QualitySpecRulesAdmin() {
  const { addToast } = useToast();
  const [entityType, setEntityType] = useState<QualitySpecRuleEntityType>('RM');
  const [detailRec, setDetailRec] = useState<UnifiedRow | null>(null);
  const [qualityRules, setQualityRules] = useState<QualitySpecRule[]>([]);
  const [technicalRules, setTechnicalRules] = useState<TechnicalSpecRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | SpecType>('all');
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Quality rule editor
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QualitySpecRule | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editSubCategory, setEditSubCategory] = useState('');
  /**
   * Item code for an item-scoped rule ('' = a category-ladder rule). An item rule is the most
   * specific rung and overrides every category rule that reaches that item, in the item's master
   * quality specification and in the GRN quality-test screen.
   */
  const [editItemCode, setEditItemCode] = useState('');
  /** Third scope level, matching the masters' sub-sub category (RM: 'ANIONIC'; PM: 'PET'). */
  const [editSubSubCategory, setEditSubSubCategory] = useState('');
  const [editRows, setEditRows] = useState<QualitySpecTableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpecRow, setEditingSpecRow] = useState<QualitySpecTableRow | null>(null);

  // Technical rule editor
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [editingTechRule, setEditingTechRule] = useState<TechnicalSpecRule | null>(null);

  // Item-specific quality-spec editor
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<ItemPick[]>([]);
  const [itemSearching, setItemSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemPick | null>(null);
  const [itemSeedLoading, setItemSeedLoading] = useState(false);
  const [itemRows, setItemRows] = useState<QualitySpecTableRow[]>([]);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemSpecModalOpen, setItemSpecModalOpen] = useState(false);
  const [editingItemSpecRow, setEditingItemSpecRow] = useState<QualitySpecTableRow | null>(null);

  const techEntity = technicalEntityFor(entityType);
  const isPrEntity = entityType.startsWith('PR');
  const entityLabel = QUALITY_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label ?? entityType;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ql, tl] = await Promise.all([
        fetchQualitySpecRules(entityType),
        fetchTechnicalSpecRules(techEntity),
      ]);
      setQualityRules(ql);
      setTechnicalRules(tl);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to load spec rules');
      setQualityRules([]);
      setTechnicalRules([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, techEntity, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const rows: UnifiedRow[] = [];
    if (typeFilter === 'all' || typeFilter === 'quality') {
      qualityRules.forEach((rule) => rows.push({ specType: 'quality', rule }));
    }
    if (typeFilter === 'all' || typeFilter === 'technical') {
      technicalRules.forEach((rule) => rows.push({ specType: 'technical', rule }));
    }
    return rows.sort((a, b) => {
      const c = a.rule.category.localeCompare(b.rule.category);
      if (c !== 0) return c;
      const s = a.rule.subCategory.localeCompare(b.rule.subCategory);
      if (s !== 0) return s;
      return a.specType.localeCompare(b.specType);
    });
  }, [qualityRules, technicalRules, typeFilter]);

  const counts = useMemo(
    () => ({ all: qualityRules.length + technicalRules.length, quality: qualityRules.length, technical: technicalRules.length }),
    [qualityRules.length, technicalRules.length],
  );

  // Scopes the pack materials themselves resolve to. Merged into the dropdowns so every scope a
  // master displays is pickable here — the static taxonomy alone omitted legacy imported values
  // ("Labels", "Packaging - Primary") that a large share of the PM catalogue actually uses.
  const [pmScopes, setPmScopes] = useState<PmRuleScope[]>([]);
  const [uncategorisedCount, setUncategorisedCount] = useState(0);
  useEffect(() => {
    if (entityType !== 'PM' && entityType !== 'RM') {
      setPmScopes([]); setUncategorisedCount(0); return;
    }
    let alive = true;
    void fetchRuleScopes(entityType).then((r) => {
      if (!alive) return;
      setPmScopes(r.scopes);
      setUncategorisedCount(r.uncategorisedItemCount);
    });
    return () => { alive = false; };
  }, [entityType]);

  // Category / sub-category dropdown options — taxonomy for this entity + scopes already saved.
  const taxEntity = taxonomyEntityFor(entityType);
  const allRuleScopes = useMemo(
    () => [
      ...qualityRules.map((r) => ({ category: r.category, subCategory: r.subCategory })),
      ...technicalRules.map((r) => ({ category: r.category, subCategory: r.subCategory })),
      ...pmScopes.map((s) => ({ category: s.category, subCategory: s.subCategory })),
    ],
    [qualityRules, technicalRules, pmScopes],
  );
  const categoryOptionList = useMemo(
    () => mergeOptions(ruleCategoryOptions(taxEntity), allRuleScopes.map((s) => s.category)),
    [taxEntity, allRuleScopes],
  );
  const subCategoryOptionsFor = useCallback(
    (category: string) =>
      mergeOptions(
        ruleSubCategoryOptions(taxEntity, category),
        allRuleScopes
          .filter((s) => s.category.trim().toLowerCase() === category.trim().toLowerCase())
          .map((s) => s.subCategory),
      ),
    [taxEntity, allRuleScopes],
  );
  const qualitySubOptions = useMemo(
    () => subCategoryOptionsFor(editCategory),
    [subCategoryOptionsFor, editCategory],
  );
  const qualitySubSubOptions = useMemo(
    () =>
      mergeOptions(
        ruleSubSubCategoryOptions(taxEntity, editCategory, editSubCategory),
        [...qualityRules, ...technicalRules]
          .filter(
            (r) =>
              r.category.trim().toLowerCase() === editCategory.trim().toLowerCase() &&
              r.subCategory.trim().toLowerCase() === editSubCategory.trim().toLowerCase(),
          )
          .map((r) => r.subSubCategory ?? ''),
      ),
    [taxEntity, editCategory, editSubCategory, qualityRules, technicalRules],
  );

  // ── Quality editor actions ──────────────────────────────────
  const openCreateQuality = () => {
    setEditingRule(null);
    setEditCategory('');
    setEditSubCategory('');
    setEditSubSubCategory('');
    setEditItemCode('');
    setEditRows([]);
    setModalOpen(true);
  };

  const openEditQuality = (rule: QualitySpecRule) => {
    setEditingRule(rule);
    setEditCategory(rule.category);
    setEditSubCategory(rule.subCategory);
    setEditSubSubCategory(rule.subSubCategory ?? '');
    setEditItemCode(rule.itemCode ?? '');
    setEditRows(rule.rows.map((row) => createEmptyQualitySpecRow(row)));
    setModalOpen(true);
  };

  const saveQuality = async () => {
    const category = editCategory.trim();
    const itemCode = editItemCode.trim();
    // An item rule is keyed by the item, so it does not need a category — and requiring one would
    // strand the rule the moment that item is recategorised.
    if (!category && !itemCode) {
      addToast('error', 'Pick a category, or an item code for an item-specific rule');
      return;
    }
    setSaving(true);
    try {
      await saveQualitySpecRule({
        entityType,
        category,
        subCategory: editSubCategory.trim(),
        subSubCategory: editSubSubCategory.trim(),
        itemCode,
        rows: editRows,
      });
      addToast('success', editingRule ? 'Quality rule updated' : 'Quality rule created');
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openAddSpecRow = (): void => {
    setEditingSpecRow(null);
    setSpecModalOpen(true);
  };
  const openEditSpecRow = (row: QualitySpecTableRow): void => {
    setEditingSpecRow(row);
    setSpecModalOpen(true);
  };
  const closeSpecModal = (): void => {
    setSpecModalOpen(false);
    setEditingSpecRow(null);
  };
  const saveSpecRow = (row: QualitySpecTableRow): void => {
    if (editingSpecRow) {
      setEditRows(editRows.map((existing) => (existing.id === editingSpecRow.id ? row : existing)));
    } else {
      setEditRows([...editRows, row]);
    }
  };

  // ── Technical editor actions ────────────────────────────────
  const openCreateTechnical = () => {
    setEditingTechRule(null);
    setTechModalOpen(true);
  };
  const openEditTechnical = (rule: TechnicalSpecRule) => {
    setEditingTechRule(rule);
    setTechModalOpen(true);
  };

  // ── Item-specific quality-spec editor ───────────────────────
  const openItemSpecific = () => {
    setSelectedItem(null);
    setItemSearch('');
    setItemResults([]);
    setItemRows([]);
    setItemModalOpen(true);
  };
  const closeItemSpecific = () => {
    setItemModalOpen(false);
    setSelectedItem(null);
    setItemSearch('');
    setItemResults([]);
    setItemRows([]);
  };

  /** Search the current entity's item list (RM/PM use the picker service; PR filters the list client-side). */
  const searchItems = useCallback(
    async (search: string): Promise<ItemPick[]> => {
      if (entityType === 'RM') {
        const rows = await fetchRawMaterialsForPicker(search);
        return rows.map((r) => ({ id: r.id, name: r.name || r.code, code: r.code }));
      }
      if (entityType === 'PM') {
        const rows = await fetchPackMaterialsForPicker(search);
        return rows.map((r) => ({ id: r.id, name: r.description || r.code, code: r.code }));
      }
      // PR — list endpoint has no server search; fetch and filter client-side.
      const res = await fetchPRProducts();
      const q = search.trim().toLowerCase();
      return (res.data ?? [])
        .filter(
          (p) =>
            !q ||
            String(p.product_name || '').toLowerCase().includes(q) ||
            String(p.product_code || '').toLowerCase().includes(q)
        )
        .slice(0, 50)
        .map((p) => ({
          id: String(p.product_id),
          name: p.product_name || p.product_code,
          code: p.product_code,
        }));
    },
    [entityType]
  );

  // Debounced item search while the picker is open (and no item selected yet).
  useEffect(() => {
    if (!itemModalOpen || selectedItem) return;
    let cancelled = false;
    setItemSearching(true);
    const handle = setTimeout(() => {
      void searchItems(itemSearch)
        .then((rows) => {
          if (!cancelled) setItemResults(rows);
        })
        .catch(() => {
          if (!cancelled) setItemResults([]);
        })
        .finally(() => {
          if (!cancelled) setItemSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [itemModalOpen, selectedItem, itemSearch, searchItems]);

  /** Seed the editor with the item's OWN current quality rows for the active entity/section. */
  const selectItem = async (item: ItemPick) => {
    setSelectedItem(item);
    setItemSeedLoading(true);
    try {
      let rows: QualitySpecTableRow[] = [];
      if (entityType === 'RM') {
        const full = await fetchRawMaterialById(item.id);
        rows = full?.form_data ? hydrateRmQualitySpecRows(full.form_data) : [];
      } else if (entityType === 'PM') {
        const rec = await fetchPackMaterialById(item.id);
        rows = rec?.form_data ? hydratePmQualitySpecRows(rec.form_data) : [];
      } else {
        const section = PR_SECTION_BY_ENTITY[entityType];
        const res = await fetchPRProductDetail(item.id);
        const bySection = res.data?.pr_quality_spec_rows_by_section as
          | Record<string, unknown>
          | undefined;
        const raw = section ? bySection?.[PR_SECTION_DETAIL_KEY[section]] : undefined;
        rows = Array.isArray(raw) ? raw.map((r) => createEmptyQualitySpecRow(r as Partial<QualitySpecTableRow>)) : [];
      }
      setItemRows(rows);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to load item specs');
      setItemRows([]);
    } finally {
      setItemSeedLoading(false);
    }
  };

  const clearSelectedItem = () => {
    setSelectedItem(null);
    setItemRows([]);
  };

  const openAddItemSpecRow = () => {
    setEditingItemSpecRow(null);
    setItemSpecModalOpen(true);
  };
  const openEditItemSpecRow = (row: QualitySpecTableRow) => {
    setEditingItemSpecRow(row);
    setItemSpecModalOpen(true);
  };
  const closeItemSpecModal = () => {
    setItemSpecModalOpen(false);
    setEditingItemSpecRow(null);
  };
  const saveItemSpecRow = (row: QualitySpecTableRow) => {
    if (editingItemSpecRow) {
      setItemRows(itemRows.map((existing) => (existing.id === editingItemSpecRow.id ? row : existing)));
    } else {
      setItemRows([...itemRows, row]);
    }
  };

  const saveItemSpecs = async () => {
    if (!selectedItem) return;
    setItemSaving(true);
    try {
      if (entityType === 'RM') {
        await setRawMaterialItemQualitySpecs(selectedItem.id, itemRows);
      } else if (entityType === 'PM') {
        await setPackMaterialItemQualitySpecs(selectedItem.id, itemRows);
      } else {
        const section = PR_SECTION_BY_ENTITY[entityType];
        if (!section) throw new Error('Unsupported PR section');
        const res = await setProductItemQualitySpecs(selectedItem.id, section, itemRows);
        if (!res.success) throw new Error(res.error || 'Save failed');
      }
      addToast('success', `Saved item-specific specs for ${selectedItem.code} — item is now locked to its own specs`);
      closeItemSpecific();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setItemSaving(false);
    }
  };

  // ── Delete (both types) ─────────────────────────────────────
  const removeRow = async (row: UnifiedRow) => {
    const { rule } = row;
    const scope = rule.subCategory ? `${rule.category} :: ${rule.subCategory}` : `${rule.category} (category rule)`;
    const kind = row.specType === 'quality' ? 'quality' : 'technical';
    if (!window.confirm(`Delete this ${kind} rule "${scope}"? Items unlocked for this category will stop resolving these ${kind} specs.`)) {
      return;
    }
    try {
      if (row.specType === 'quality') await deleteQualitySpecRule(rule.id);
      else await deleteTechnicalSpecRule(rule.id);
      addToast('success', 'Rule deleted');
      await load();
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-surface-2 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header — title + description only */}
        <header className="mb-4">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-ink">Spec Rules</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Category / sub-category templates for{' '}
            <span className="font-semibold text-ok">Quality</span> and{' '}
            <span className="font-semibold text-brand">Technical</span> specs. Items pull these live until a user
            edits an item&apos;s own specs — after that the item keeps its own saved specs and stops tracking rule
            changes.
          </p>
        </header>

        {/* Entity segmented control */}
        <div className="mb-4">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-4">
            Entity type
          </span>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm">
            {QUALITY_SPEC_RULE_ENTITY_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEntityType(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  entityType === opt.value ? 'bg-ink text-white shadow-sm' : 'text-ink-2 hover:bg-surface-3'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content card */}
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {/* Toolbar — filters (left) + Add rule (right) */}
          <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'all', label: 'All', n: counts.all },
                { key: 'quality', label: 'Quality', n: counts.quality },
                { key: 'technical', label: 'Technical', n: counts.technical },
              ] as const).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setTypeFilter(chip.key)}
                  className={procChipClass(typeFilter === chip.key)}
                >
                  {chip.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      typeFilter === chip.key ? 'bg-surface/20' : 'bg-surface-3 text-ink-3'
                    }`}
                  >
                    {chip.n}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              aria-expanded={addMenuOpen}
              className={procBtnPrimary}
            >
              + Add rule
              <span className={`text-xs transition-transform ${addMenuOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
          </div>

          {/* Inline type chooser — in-flow, no stacking conflict */}
          {addMenuOpen && (
            <div className="border-b border-hairline bg-surface-2/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  What do you want to add?
                </p>
                <button
                  type="button"
                  onClick={() => setAddMenuOpen(false)}
                  className="text-xs text-ink-4 hover:text-ink-2"
                >
                  ✕ Close
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setAddMenuOpen(false);
                    openCreateQuality();
                  }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-sm transition-colors hover:border-ok hover:bg-ok-soft/60"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-ok-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ok">
                    Quality
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Quality spec rule</span>
                    <span className="block text-xs leading-snug text-ink-3">
                      Test parameters (spec limit, method, tolerance…) for QC.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMenuOpen(false);
                    openCreateTechnical();
                  }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-sm transition-colors hover:border-brand hover:bg-brand-soft/60"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-brand-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                    Technical
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Technical spec (custom field)</span>
                    <span className="block text-xs leading-snug text-ink-3">
                      Material/product attributes — label, type, unit, options.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMenuOpen(false);
                    openItemSpecific();
                  }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-sm transition-colors hover:border-warn hover:bg-warn-soft/60"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-warn-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warn">
                    Item
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Item specific</span>
                    <span className="block text-xs leading-snug text-ink-3">
                      Override quality specs for ONE {entityLabel} item — locks it to its own specs.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {isPrEntity && (
            <p className="border-b border-hairline bg-brand-soft/40 px-4 py-2 text-[11px] text-brand/80">
              ℹ Technical specs are shared across all PR clearance stages.
            </p>
          )}

          {/* Table / empty / loading */}
          {loading ? (
            <div className="p-8">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : unifiedRows.length === 0 ? (
            <EmptyState
              icon={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-ink-4">📋</div>}
              title={`No ${typeFilter === 'all' ? '' : `${typeFilter} `}rules for this entity yet`}
              description={
                <>
                  Use <span className="font-semibold text-warn">+ Add rule</span> to create a Quality or Technical
                  spec rule for a category (or category + sub-category).
                </>
              }
            />
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-20 border-b border-hairline bg-surface-2/80">
                  <tr className="[&_th]:bg-surface-2 text-[11px] uppercase tracking-wide text-ink-3">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Sub-category</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Rows / fields</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Updated</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {unifiedRows.map((row) => (
                    <tr key={`${row.specType}-${row.rule.id}`} onClick={() => setDetailRec(row)} className="transition-colors hover:bg-surface-2/80 cursor-pointer">
                      <td className="px-4 py-3">
                        {row.specType === 'quality' ? (
                          <span className="inline-flex items-center rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ok ring-1 ring-inset ring-emerald-100">
                            Quality
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand ring-1 ring-inset ring-indigo-100">
                            Technical
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{row.rule.category}</td>
                      <td className="px-4 py-3 text-ink-2">
                        {row.rule.subCategory || (
                          <span className="italic text-ink-4">— all sub-categories</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-2">
                          {row.rule.rows.length} {row.specType === 'quality' ? 'rows' : 'fields'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-3">
                        {row.rule.updatedAt ? new Date(row.rule.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              row.specType === 'quality' ? openEditQuality(row.rule) : openEditTechnical(row.rule);
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-3"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void removeRow(row); }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-err transition-colors hover:bg-err-soft"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <RecordDetailModal
        open={!!detailRec}
        onClose={() => setDetailRec(null)}
        eyebrow={detailRec?.specType === 'quality' ? 'Quality Spec Rule' : 'Technical Spec Rule'}
        title={detailRec?.rule.category}
        subtitle={detailRec?.rule.subCategory || 'all sub-categories'}
        size="lg"
        sections={detailRec ? [
          {
            title: 'Rule Scope',
            fields: [
              { label: 'Spec Type', value: detailRec.specType === 'quality' ? 'Quality' : 'Technical' },
              { label: 'Entity Type', value: detailRec.rule.entityType },
              { label: 'Category', value: detailRec.rule.category },
              { label: 'Sub-category', value: detailRec.rule.subCategory },
              { label: 'Sub-sub category', value: detailRec.rule.subSubCategory },
              // Item scope is the deciding factor for where this rule applies, so it is stated
              // explicitly rather than left to be inferred from a blank category field.
              {
                label: 'Applies to',
                value:
                  ('itemCode' in detailRec.rule && detailRec.rule.itemCode)
                    ? `Item ${detailRec.rule.itemCode} only (overrides category rules)`
                    : detailRec.rule.subSubCategory
                      ? 'Every item in this sub-sub category'
                      : detailRec.rule.subCategory
                        ? 'Every item in this sub-category'
                        : 'Every item in this category',
              },
              { label: 'Updated', value: detailRec.rule.updatedAt ? new Date(detailRec.rule.updatedAt).toLocaleDateString() : '' },
            ],
          },
          {
            title: 'Parameters',
            content: detailRec.rule.rows.length > 0 ? (
              detailRec.specType === 'quality' ? (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="[&_th]:bg-surface-2 border-b border-hairline text-ink-4">
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Parameter</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Spec Limit</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Method</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Mandatory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRec.rule.rows.map((r) => (
                      <tr key={r.id} className="border-b border-hairline last:border-0">
                        <td className="py-1.5 px-2 font-medium text-ink">{r.parameter || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.specLimit || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.method || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.mandatory ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="[&_th]:bg-surface-2 border-b border-hairline text-ink-4">
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Label</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Type</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Unit</th>
                      <th scope="col" className="text-left py-1.5 px-2 text-[10px] font-bold uppercase">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRec.rule.rows.map((r) => (
                      <tr key={r.id} className="border-b border-hairline last:border-0">
                        <td className="py-1.5 px-2 font-medium text-ink">{r.label || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.type || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.unit || '—'}</td>
                        <td className="py-1.5 px-2 text-ink-2">{r.required ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : <p className="text-sm text-ink-4">No parameters.</p>,
          },
        ] : []}
      />

      {/* Quality rule editor */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-surface p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="quality-rule-modal-title">
            <div className="flex items-start justify-between gap-3">
              <h2 id="quality-rule-modal-title" className="text-lg font-bold text-ink">
                {editingRule ? 'Edit quality rule' : 'New quality rule'} —{' '}
                {QUALITY_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label}
              </h2>
              <span className="rounded-full bg-ok-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ok">
                Quality
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-ink-2">
                Category
                <SpecScopeCombobox
                  accent="emerald"
                  options={categoryOptionList}
                  value={editCategory}
                  onChange={(v) => {
                    setEditCategory(v);
                    setEditSubCategory('');
                    setEditSubSubCategory('');
                  }}
                  disabled={Boolean(editingRule)}
                  placeholder="Select or type a category"
                />
              </label>
              <label className="block text-xs font-semibold text-ink-2">
                Sub-category (leave blank for a category-wide rule)
                <SpecScopeCombobox
                  accent="emerald"
                  options={qualitySubOptions}
                  value={editSubCategory}
                  onChange={(v) => {
                    setEditSubCategory(v);
                    setEditSubSubCategory('');
                  }}
                  disabled={Boolean(editingRule) || !editCategory.trim()}
                  placeholder={editCategory.trim() ? 'Select or type a sub-category' : 'Select a category first'}
                />
                {/* The five PM category names appear nowhere in the PM master form, so the item
                    types each one covers are spelled out — otherwise there is no way to tell which
                    scope will match which item. */}
                {entityType === 'PM' && editCategory.trim() && (() => {
                  const inUse = pmScopes.filter(
                    (sc) => sc.category.trim().toLowerCase() === editCategory.trim().toLowerCase() && sc.subCategory,
                  );
                  const picked = editSubCategory.trim()
                    ? inUse.find((sc) => sc.subCategory.toLowerCase() === editSubCategory.trim().toLowerCase())
                    : null;
                  return (
                    <span className="mt-1 block text-[11px] font-normal text-ink-3">
                      {picked
                        ? `${picked.itemCount.toLocaleString('en-IN')} pack material${picked.itemCount === 1 ? '' : 's'} currently match this scope.`
                        : inUse.length > 0
                          ? `In use by your items: ${inUse
                              .slice()
                              .sort((a, b) => b.itemCount - a.itemCount)
                              .slice(0, 5)
                              .map((sc) => `${sc.subCategory} (${sc.itemCount})`)
                              .join(', ')}`
                          : pmCategoryItemTypes(editCategory).length > 0
                            ? `Covers master item types: ${pmCategoryItemTypes(editCategory).join(', ')}`
                            : ''}
                    </span>
                  );
                })()}
              </label>
              <label className="block text-xs font-semibold text-ink-2">
                Sub-sub category (optional)
                <SpecScopeCombobox
                  accent="emerald"
                  options={qualitySubSubOptions}
                  value={editSubSubCategory}
                  onChange={setEditSubSubCategory}
                  disabled={Boolean(editingRule) || !editSubCategory.trim() || qualitySubSubOptions.length === 0}
                  placeholder={
                    !editSubCategory.trim()
                      ? 'Select a sub-category first'
                      : qualitySubSubOptions.length === 0
                        ? 'No sub-sub options for this sub-category'
                        : 'Select or type a sub-sub category'
                  }
                />
              </label>
            </div>

            <label className="mt-3 block text-xs font-semibold text-ink-2">
              Item code (leave blank for a category rule)
              <input
                type="text"
                value={editItemCode}
                disabled={Boolean(editingRule)}
                onChange={(e) => setEditItemCode(e.target.value)}
                placeholder="e.g. 1001150 — applies to this item only"
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3"
              />
              <span className="mt-1 block text-[11px] font-normal text-ink-3">
                {editItemCode.trim()
                  ? `Applies to item ${editItemCode.trim()} only, overriding any category rule — in the item's master quality specification and in its quality tests.`
                  : 'Set an item code to override the category rules for one specific item.'}
              </span>
              {/* Confirm the chosen scope actually reaches items; only fall back to the
                  uncategorised warning when no category has been picked, since that is the case
                  where an item code really is the only option. */}
              {(() => {
                if (editItemCode.trim()) return null;
                const cat = editCategory.trim().toLowerCase();
                const sub = editSubCategory.trim().toLowerCase();
                if (cat) {
                  const reach = pmScopes
                    .filter((sc) => sc.category.trim().toLowerCase() === cat)
                    .filter((sc) => (sub ? sc.subCategory.trim().toLowerCase() === sub : true))
                    .reduce((n, sc) => n + sc.itemCount, 0);
                  const noun = entityType === 'RM' ? 'raw material' : 'pack material';
                  return (
                    <span className={`mt-1 block text-[11px] font-normal ${reach > 0 ? 'text-ok' : 'text-warn'}`}>
                      {reach > 0
                        ? `${reach.toLocaleString('en-IN')} ${noun}${reach === 1 ? '' : 's'} currently match this scope — no item code needed.`
                        : 'No items currently resolve to this scope. The rule saves, but reaches nothing until an item is categorised this way.'}
                    </span>
                  );
                }
                return uncategorisedCount > 0 ? (
                  <span className="mt-1 block text-[11px] font-normal text-ink-3">
                    {uncategorisedCount.toLocaleString('en-IN')} {entityType === 'RM' ? 'raw' : 'pack'} materials have
                    no category at all — those can only be given a spec by item code.
                  </span>
                ) : null;
              })()}
            </label>

            <div className="mt-5">
              <QualitySpecTable
                title="Quality spec rows"
                addButtonLabel="+ Add Custom Quality Spec"
                emptyMessage="No rows yet — add the first quality spec parameter."
                rows={editRows}
                onChange={setEditRows}
                idPrefix="rule"
                showAddButton
                onAddClick={openAddSpecRow}
                onEditRow={openEditSpecRow}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className={procBtnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveQuality()}
                // An item-scoped rule needs no category (it is keyed by the item), so gating Save on
                // category alone left the button dead after typing an item code.
                disabled={saving || (!editCategory.trim() && !editItemCode.trim())}
                className={procBtnPrimary}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MasterAddCustomQualitySpecModal
        isOpen={specModalOpen}
        onClose={closeSpecModal}
        taxonomyLabel={[
          QUALITY_SPEC_RULE_ENTITY_TYPES.find((o) => o.value === entityType)?.label,
          editCategory.trim(),
          editSubCategory.trim(),
        ]
          .filter(Boolean)
          .join(' → ')}
        categoryScopeLabel={editCategory.trim() || 'this category'}
        subCategoryLabel={editSubCategory.trim() || 'this sub-category'}
        allowSubCategoryScope={false}
        hideScopeSelector
        editRow={editingSpecRow}
        onSave={saveSpecRow}
      />

      {/* Item-specific quality-spec editor */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-surface p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="item-specific-modal-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="item-specific-modal-title" className="text-lg font-bold text-ink">Item-specific quality specs — {entityLabel}</h2>
                <p className="mt-1 text-sm text-ink-2">
                  Pick one item and set its own quality specs. Saving locks the item to these specs — it stops
                  tracking category / sub-category rule changes.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-warn-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-warn">
                Item
              </span>
            </div>

            {!selectedItem ? (
              <div className="mt-5">
                <label className="block text-xs font-semibold text-ink-2">
                  Search {entityLabel} by name or code
                  <input
                    type="text"
                    autoFocus
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Type to search…"
                    className={`mt-1 ${procInputClass}`}
                  />
                </label>
                <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
                  {itemSearching ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-ink-3">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-slate-600" />
                      Searching…
                    </div>
                  ) : itemResults.length === 0 ? (
                    <p className="p-4 text-sm text-ink-3">No matching items.</p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {itemResults.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => void selectItem(item)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-warn-soft/60"
                          >
                            <span className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</span>
                            <span className="shrink-0 rounded bg-surface-3 px-2 py-0.5 text-xs font-mono text-ink-2">
                              {item.code}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warn bg-warn-soft/60 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{selectedItem.name}</span>
                    <span className="text-xs font-mono text-ink-3">{selectedItem.code}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedItem}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-3"
                  >
                    Change item
                  </button>
                </div>

                {itemSeedLoading ? (
                  <div className="flex items-center gap-2 p-6 text-sm text-ink-3">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-slate-600" />
                    Loading this item&apos;s current specs…
                  </div>
                ) : (
                  <QualitySpecTable
                    title="Item quality spec rows"
                    addButtonLabel="+ Add Custom Quality Spec"
                    emptyMessage="No rows yet — add the first quality spec parameter for this item."
                    rows={itemRows}
                    onChange={setItemRows}
                    idPrefix="item"
                    showAddButton
                    onAddClick={openAddItemSpecRow}
                    onEditRow={openEditItemSpecRow}
                  />
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeItemSpecific}
                className={procBtnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveItemSpecs()}
                disabled={!selectedItem || itemSeedLoading || itemSaving}
                className={procBtnPrimary}
              >
                {itemSaving ? 'Saving…' : 'Save to item'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MasterAddCustomQualitySpecModal
        isOpen={itemSpecModalOpen}
        onClose={closeItemSpecModal}
        taxonomyLabel={[entityLabel, selectedItem?.name].filter(Boolean).join(' → ')}
        categoryScopeLabel={selectedItem?.name || 'this item'}
        subCategoryLabel={selectedItem?.code || 'this item'}
        allowSubCategoryScope={false}
        hideScopeSelector
        editRow={editingItemSpecRow}
        onSave={saveItemSpecRow}
      />

      {/* Technical rule editor */}
      <TechnicalSpecRuleModal
        isOpen={techModalOpen}
        entityType={techEntity}
        editingRule={editingTechRule}
        existingCategories={categoryOptionList}
        existingSubCategoriesFor={subCategoryOptionsFor}
        onClose={() => setTechModalOpen(false)}
        onSaved={() => {
          setTechModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}
