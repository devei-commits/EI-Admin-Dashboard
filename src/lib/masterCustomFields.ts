export type MasterCustomFieldsEntity = 'RM' | 'PM';

export type MasterCustomFieldModuleCode = 'TECH' | 'QUAL' | 'ART';

export type MasterCustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'
  | 'pass-fail'
  | 'attachment';

export type MasterCustomFieldDef = {
  id: string;
  label: string;
  type: MasterCustomFieldType;
  required?: boolean;
  options?: string[];
  unit?: string;
};

export type MasterCustomFieldsStore = Record<
  MasterCustomFieldsEntity,
  Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>>
>;

const STORAGE_KEY = 'ei-master-custom-fields';

function emptyStore(): MasterCustomFieldsStore {
  return { RM: {}, PM: {} };
}

function readStore(): MasterCustomFieldsStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const obj = parsed as Partial<MasterCustomFieldsStore>;
    return {
      RM: { ...(obj.RM ?? {}) },
      PM: { ...(obj.PM ?? {}) },
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: MasterCustomFieldsStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const listeners = new Set<() => void>();

export function subscribeMasterCustomFields(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMasterCustomFieldsChanged(): void {
  for (const listener of listeners) listener();
}

export function buildMasterCustomFieldsTaxonomyKey(
  cat: string,
  sub: string,
  subsub?: string
): string {
  return `${cat || '_'}|${sub || '_'}|${subsub || '_'}`;
}

export function customFieldFormKey(id: string): string {
  return `masterCustomField__${id}`;
}

export function normCustomFieldLabel(raw: string): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

export function createCustomFieldId(): string {
  return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getCustomFieldsForModule(
  entity: MasterCustomFieldsEntity,
  taxonomyKey: string,
  moduleCode: MasterCustomFieldModuleCode
): MasterCustomFieldDef[] {
  const key = taxonomyKey.trim();
  if (!key) return [];
  return [...(readStore()[entity][key]?.[moduleCode] ?? [])];
}

export function addCustomField(
  entity: MasterCustomFieldsEntity,
  taxonomyKey: string,
  moduleCode: MasterCustomFieldModuleCode,
  field: MasterCustomFieldDef
): { ok: true } | { ok: false; reason: 'empty-label' | 'duplicate' } {
  const label = normCustomFieldLabel(field.label);
  if (!label) return { ok: false, reason: 'empty-label' };
  const key = taxonomyKey.trim();
  if (!key) return { ok: false, reason: 'empty-label' };

  const store = readStore();
  const bucket = { ...(store[entity][key] ?? {}) };
  const existing = [...(bucket[moduleCode] ?? [])];
  if (existing.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
    return { ok: false, reason: 'duplicate' };
  }

  const nextField: MasterCustomFieldDef = {
    ...field,
    label,
    id: field.id || createCustomFieldId(),
  };
  bucket[moduleCode] = [...existing, nextField];
  store[entity] = { ...store[entity], [key]: bucket };
  writeStore(store);
  notifyMasterCustomFieldsChanged();
  return { ok: true };
}

export function removeCustomField(
  entity: MasterCustomFieldsEntity,
  taxonomyKey: string,
  moduleCode: MasterCustomFieldModuleCode,
  fieldId: string
): void {
  const key = taxonomyKey.trim();
  if (!key) return;
  const store = readStore();
  const bucket = store[entity][key];
  if (!bucket?.[moduleCode]) return;
  const next = bucket[moduleCode]!.filter((f) => f.id !== fieldId);
  if (next.length === 0) {
    const { [moduleCode]: _removed, ...rest } = bucket;
    if (Object.keys(rest).length === 0) delete store[entity][key];
    else store[entity][key] = rest;
  } else {
    store[entity][key] = { ...bucket, [moduleCode]: next };
  }
  writeStore(store);
  notifyMasterCustomFieldsChanged();
}

export function loadEntityCustomFields(
  entity: MasterCustomFieldsEntity
): Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>> {
  return { ...readStore()[entity] };
}

export function mergeEntityCustomFields(
  entity: MasterCustomFieldsEntity,
  incoming: Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>> | null | undefined
): void {
  if (!incoming || typeof incoming !== 'object') return;
  const store = readStore();
  const entityBucket = { ...store[entity] };

  for (const [taxonomyKey, modules] of Object.entries(incoming)) {
    if (!modules || typeof modules !== 'object') continue;
    const mergedModules: Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>> = {
      ...(entityBucket[taxonomyKey] ?? {}),
    };
    for (const mod of ['TECH', 'QUAL', 'ART'] as const) {
      const incomingFields = modules[mod];
      if (!Array.isArray(incomingFields)) continue;
      const byId = new Map<string, MasterCustomFieldDef>();
      for (const f of [...(mergedModules[mod] ?? []), ...incomingFields]) {
        if (!f?.id || !f.label) continue;
        byId.set(f.id, f);
      }
      if (byId.size > 0) mergedModules[mod] = [...byId.values()];
    }
    if (Object.keys(mergedModules).length > 0) entityBucket[taxonomyKey] = mergedModules;
  }

  store[entity] = entityBucket;
  writeStore(store);
  notifyMasterCustomFieldsChanged();
}

export function pmCustomFieldsModuleCode(
  slug: string
): MasterCustomFieldModuleCode | null {
  if (slug === 'dimensions' || slug === 'material' || slug === 'technical') return 'TECH';
  if (slug === 'aesthetics') return 'ART';
  if (slug === 'quality') return 'QUAL';
  return null;
}

export function supportsCustomFieldButton(moduleCode: MasterCustomFieldModuleCode | null): boolean {
  return moduleCode === 'TECH' || moduleCode === 'ART';
}

export function supportsCustomQcSpecButton(moduleCode: MasterCustomFieldModuleCode | null): boolean {
  return moduleCode === 'QUAL';
}
