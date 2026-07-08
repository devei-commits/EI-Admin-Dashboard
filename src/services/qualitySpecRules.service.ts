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
  rows: QualitySpecTableRow[];
  createdAt?: string;
  updatedAt?: string;
};

type QualitySpecRuleDTO = {
  id: number;
  entityType: QualitySpecRuleEntityType;
  category: string;
  subCategory: string;
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
  return { ...dto, rows: hydrateRows(dto.rows) };
}

export async function fetchQualitySpecRules(entityType: QualitySpecRuleEntityType): Promise<QualitySpecRule[]> {
  const list = await api.get<QualitySpecRuleDTO[]>(
    `/api/v1/quality-spec-rules?entityType=${encodeURIComponent(entityType)}`
  );
  return Array.isArray(list) ? list.map(mapRule) : [];
}

export async function saveQualitySpecRule(input: {
  entityType: QualitySpecRuleEntityType;
  category: string;
  subCategory: string;
  rows: QualitySpecTableRow[];
}): Promise<QualitySpecRule> {
  const dto = await api.put<QualitySpecRuleDTO>('/api/v1/quality-spec-rules', input);
  return mapRule(dto);
}

export async function deleteQualitySpecRule(id: number): Promise<void> {
  await api.delete(`/api/v1/quality-spec-rules/${id}`);
}
