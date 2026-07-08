import api from '../lib/apiClient';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

export type QualitySpecRuleEntityType =
  | 'RM'
  | 'PM'
  | 'PR_BULK_CLEARANCE'
  | 'PR_FINAL_CLEARANCE'
  | 'PR_DISPATCH_SPECS';

export const QUALITY_SPEC_RULE_ENTITY_TYPES: { value: QualitySpecRuleEntityType; label: string }[] = [
  { value: 'RM', label: 'Raw Materials' },
  { value: 'PM', label: 'Pack Materials' },
  { value: 'PR_BULK_CLEARANCE', label: 'PR — Bulk Clearance' },
  { value: 'PR_FINAL_CLEARANCE', label: 'PR — Final Clearance (FG Ready)' },
  { value: 'PR_DISPATCH_SPECS', label: 'PR — Dispatch Specs' },
];

export type QualitySpecRule = {
  id: number;
  entityType: QualitySpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory: string;
  rows: QualitySpecTableRow[];
  createdAt?: string;
  updatedAt?: string;
};

type QualitySpecRuleDTO = {
  id: number;
  entityType: QualitySpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory?: string;
  rows: Partial<QualitySpecTableRow>[];
  createdAt?: string;
  updatedAt?: string;
};

/** Backend rows may lack `id` (seeded from generated JSON) — backfill so React keys / edits stay stable. */
function hydrateRows(rows: Partial<QualitySpecTableRow>[] | undefined): QualitySpecTableRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => createEmptyQualitySpecRow(row));
}

function mapRule(dto: QualitySpecRuleDTO): QualitySpecRule {
  return { ...dto, subSubCategory: dto.subSubCategory ?? '', rows: hydrateRows(dto.rows) };
}

export async function fetchQualitySpecRules(
  entityType: QualitySpecRuleEntityType,
  filter?: { category?: string; subCategory?: string; subSubCategory?: string }
): Promise<QualitySpecRule[]> {
  const params = new URLSearchParams({ entityType });
  if (filter?.category) params.set('category', filter.category);
  if (filter?.subCategory != null) params.set('subCategory', filter.subCategory);
  if (filter?.subSubCategory != null) params.set('subSubCategory', filter.subSubCategory);
  const list = await api.get<QualitySpecRuleDTO[]>(`/api/v1/quality-spec-rules?${params.toString()}`);
  return Array.isArray(list) ? list.map(mapRule) : [];
}

export async function saveQualitySpecRule(input: {
  entityType: QualitySpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory?: string;
  rows: QualitySpecTableRow[];
}): Promise<QualitySpecRule> {
  const dto = await api.put<QualitySpecRuleDTO>('/api/v1/quality-spec-rules', input);
  return mapRule(dto);
}

export async function deleteQualitySpecRule(id: number): Promise<void> {
  await api.delete(`/api/v1/quality-spec-rules/${id}`);
}

function qualitySpecRuleParamKey(parameter: string): string {
  return parameter.trim().toLowerCase();
}

/**
 * Appends one row to the rule at an exact (category, subCategory, subSubCategory) scope —
 * fetches the current rule (if any), rejects a duplicate parameter name, then upserts the
 * merged row set. Used by the "Add Custom Quality Spec" modal's Category/Sub-category/
 * Sub-sub-category scope options (see MasterCustomQualitySpecsSection.tsx).
 */
export async function addRowToQualitySpecRule(
  entityType: QualitySpecRuleEntityType,
  category: string,
  subCategory: string,
  subSubCategory: string,
  row: QualitySpecTableRow
): Promise<{ ok: true } | { ok: false; reason: 'empty-key' | 'duplicate' }> {
  const cat = category.trim();
  const sub = subCategory.trim();
  const subSub = subSubCategory.trim();
  if (!cat || (subSub && !sub)) return { ok: false, reason: 'empty-key' };

  const existingRules = await fetchQualitySpecRules(entityType, { category: cat, subCategory: sub, subSubCategory: subSub });
  const existingRule = existingRules.find(
    (r) => r.category === cat && r.subCategory === sub && r.subSubCategory === subSub
  );
  const existingRows = existingRule?.rows ?? [];
  const paramKey = qualitySpecRuleParamKey(row.parameter);
  if (existingRows.some((r) => qualitySpecRuleParamKey(r.parameter) === paramKey)) {
    return { ok: false, reason: 'duplicate' };
  }

  await saveQualitySpecRule({
    entityType,
    category: cat,
    subCategory: sub,
    subSubCategory: subSub,
    rows: [...existingRows, row],
  });
  return { ok: true };
}
