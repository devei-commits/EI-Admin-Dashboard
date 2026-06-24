import { normCustomFieldLabel } from './masterCustomFields';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export type MasterSharedQualitySpecEntity = 'RM' | 'PM';

export type MasterSharedQualitySpecScope = 'common' | 'sub';

export type MasterSharedQualitySpecsEntityStore = {
  common: Record<string, QualitySpecTableRow[]>;
  sub: Record<string, QualitySpecTableRow[]>;
};

export type MasterSharedQualitySpecsStore = Record<
  MasterSharedQualitySpecEntity,
  MasterSharedQualitySpecsEntityStore
>;

const STORAGE_KEY = 'ei-master-shared-quality-specs';

function emptyEntityStore(): MasterSharedQualitySpecsEntityStore {
  return { common: {}, sub: {} };
}

function emptyStore(): MasterSharedQualitySpecsStore {
  return { RM: emptyEntityStore(), PM: emptyEntityStore() };
}

function readStore(): MasterSharedQualitySpecsStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const obj = parsed as Partial<MasterSharedQualitySpecsStore>;
    return {
      RM: {
        common: { ...(obj.RM?.common ?? {}) },
        sub: { ...(obj.RM?.sub ?? {}) },
      },
      PM: {
        common: { ...(obj.PM?.common ?? {}) },
        sub: { ...(obj.PM?.sub ?? {}) },
      },
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: MasterSharedQualitySpecsStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const listeners = new Set<() => void>();

export function subscribeMasterSharedQualitySpecs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMasterSharedQualitySpecsChanged(): void {
  for (const listener of listeners) listener();
}

/** Stable key for matching parameters across items (case-insensitive). */
export function qualitySpecParameterKey(parameter: string): string {
  return normCustomFieldLabel(parameter).toLowerCase();
}

function cloneRow(row: QualitySpecTableRow): QualitySpecTableRow {
  return {
    ...row,
    attachments: [...(row.attachments ?? [])],
    selectOptions: row.selectOptions ? [...row.selectOptions] : undefined,
  };
}

function mergeRowLists(existing: QualitySpecTableRow[], incoming: QualitySpecTableRow[]): QualitySpecTableRow[] {
  const byKey = new Map<string, QualitySpecTableRow>();
  for (const row of existing) {
    const key = qualitySpecParameterKey(row.parameter);
    if (key) byKey.set(key, cloneRow(row));
  }
  for (const row of incoming) {
    const key = qualitySpecParameterKey(row.parameter);
    if (!key) continue;
    byKey.set(key, cloneRow(row));
  }
  return [...byKey.values()];
}

export function getSharedQualitySpecs(
  entity: MasterSharedQualitySpecEntity,
  scope: MasterSharedQualitySpecScope,
  scopeKey: string
): QualitySpecTableRow[] {
  const key = scopeKey.trim();
  if (!key) return [];
  const bucket = readStore()[entity][scope === 'common' ? 'common' : 'sub'][key];
  return Array.isArray(bucket) ? bucket.map(cloneRow) : [];
}

export function addSharedQualitySpec(
  entity: MasterSharedQualitySpecEntity,
  scope: MasterSharedQualitySpecScope,
  scopeKey: string,
  row: QualitySpecTableRow
): { ok: true } | { ok: false; reason: 'empty-key' | 'empty-parameter' | 'duplicate' } {
  const key = scopeKey.trim();
  const parameter = normCustomFieldLabel(row.parameter);
  if (!key) return { ok: false, reason: 'empty-key' };
  if (!parameter) return { ok: false, reason: 'empty-parameter' };

  const paramKey = qualitySpecParameterKey(parameter);
  const store = readStore();
  const entityStore = store[entity];
  const scopeBucket = scope === 'common' ? entityStore.common : entityStore.sub;
  const existing = [...(scopeBucket[key] ?? [])];
  if (existing.some((r) => qualitySpecParameterKey(r.parameter) === paramKey)) {
    return { ok: false, reason: 'duplicate' };
  }

  const nextRow = cloneRow({ ...row, parameter, custom: true });
  scopeBucket[key] = [...existing, nextRow];
  store[entity] = {
    ...entityStore,
    [scope === 'common' ? 'common' : 'sub']: { ...scopeBucket },
  };
  writeStore(store);
  notifyMasterSharedQualitySpecsChanged();
  return { ok: true };
}

export function loadEntitySharedQualitySpecs(
  entity: MasterSharedQualitySpecEntity
): MasterSharedQualitySpecsEntityStore {
  const bucket = readStore()[entity];
  return {
    common: { ...bucket.common },
    sub: { ...bucket.sub },
  };
}

/** Merge shared definitions from saved form_data (cross-device / cross-user sync). */
export function mergeEntitySharedQualitySpecs(
  entity: MasterSharedQualitySpecEntity,
  incoming: MasterSharedQualitySpecsEntityStore | null | undefined
): void {
  if (!incoming || typeof incoming !== 'object') return;
  const store = readStore();
  const entityStore = store[entity];
  const nextCommon = { ...entityStore.common };
  const nextSub = { ...entityStore.sub };

  if (incoming.common && typeof incoming.common === 'object') {
    for (const [k, rows] of Object.entries(incoming.common)) {
      if (!Array.isArray(rows)) continue;
      nextCommon[k] = mergeRowLists(nextCommon[k] ?? [], rows);
    }
  }
  if (incoming.sub && typeof incoming.sub === 'object') {
    for (const [k, rows] of Object.entries(incoming.sub)) {
      if (!Array.isArray(rows)) continue;
      nextSub[k] = mergeRowLists(nextSub[k] ?? [], rows);
    }
  }

  store[entity] = { common: nextCommon, sub: nextSub };
  writeStore(store);
  notifyMasterSharedQualitySpecsChanged();
}
