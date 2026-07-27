import api from '../lib/apiClient';
import {
  createCustomFieldId,
  normCustomFieldLabel,
  type MasterCustomFieldDef,
  type MasterCustomFieldType,
} from '../lib/masterCustomFields';

/**
 * Technical Spec Rules — the TECH-module custom fields defined centrally per category /
 * sub-category so RM / PM / PR items pull them live, mirroring Quality Spec Rules.
 * A rule's `rows` are MasterCustomFieldDef objects (label, type, unit, options, required).
 */
export type TechnicalSpecRuleEntityType = 'RM' | 'PM' | 'PR';

export const TECHNICAL_SPEC_RULE_ENTITY_TYPES: { value: TechnicalSpecRuleEntityType; label: string }[] = [
  { value: 'RM', label: 'Raw Materials' },
  { value: 'PM', label: 'Pack Materials' },
  { value: 'PR', label: 'Products (BOM)' },
];

export type TechnicalSpecRule = {
  id: number;
  entityType: TechnicalSpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory: string;
  rows: MasterCustomFieldDef[];
  createdAt?: string;
  updatedAt?: string;
};

type TechnicalSpecRuleDTO = {
  id: number;
  entityType: TechnicalSpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory?: string;
  rows: Partial<MasterCustomFieldDef>[];
  createdAt?: string;
  updatedAt?: string;
};

const VALID_FIELD_TYPES: MasterCustomFieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'boolean', 'pass-fail', 'attachment',
];

/** Backend rows are trusted but may be partial — coerce into a stable MasterCustomFieldDef. */
function hydrateRows(rows: Partial<MasterCustomFieldDef>[] | undefined): MasterCustomFieldDef[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const label = normCustomFieldLabel(row?.label ?? '');
      if (!label) return null;
      const type = VALID_FIELD_TYPES.includes(row?.type as MasterCustomFieldType)
        ? (row!.type as MasterCustomFieldType)
        : 'text';
      const def: MasterCustomFieldDef = {
        id: String(row?.id ?? '').trim() || createCustomFieldId(),
        label,
        type,
      };
      if (row?.required) def.required = true;
      if (typeof row?.unit === 'string' && row.unit.trim()) def.unit = row.unit.trim();
      if (Array.isArray(row?.options)) {
        const opts = row!.options!.map((o) => String(o ?? '').trim()).filter(Boolean);
        if (opts.length) def.options = opts;
      }
      return def;
    })
    .filter((d): d is MasterCustomFieldDef => d != null);
}

function mapRule(dto: TechnicalSpecRuleDTO): TechnicalSpecRule {
  return { ...dto, subSubCategory: dto.subSubCategory ?? '', rows: hydrateRows(dto.rows) };
}

export async function fetchTechnicalSpecRules(
  entityType: TechnicalSpecRuleEntityType,
  filter?: { category?: string; subCategory?: string; subSubCategory?: string }
): Promise<TechnicalSpecRule[]> {
  const params = new URLSearchParams({ entityType });
  if (filter?.category) params.set('category', filter.category);
  if (filter?.subCategory != null) params.set('subCategory', filter.subCategory);
  if (filter?.subSubCategory != null) params.set('subSubCategory', filter.subSubCategory);
  const list = await api.get<TechnicalSpecRuleDTO[]>(`/api/v1/technical-spec-rules?${params.toString()}`);
  return Array.isArray(list) ? list.map(mapRule) : [];
}

export async function saveTechnicalSpecRule(input: {
  entityType: TechnicalSpecRuleEntityType;
  category: string;
  subCategory: string;
  subSubCategory?: string;
  rows: MasterCustomFieldDef[];
}): Promise<TechnicalSpecRule> {
  const dto = await api.put<TechnicalSpecRuleDTO>('/api/v1/technical-spec-rules', input);
  return mapRule(dto);
}

export async function deleteTechnicalSpecRule(id: number): Promise<void> {
  await api.delete(`/api/v1/technical-spec-rules/${id}`);
}
