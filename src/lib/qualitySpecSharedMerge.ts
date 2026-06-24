import {
  getSharedQualitySpecs,
  qualitySpecParameterKey,
  type MasterSharedQualitySpecEntity,
  type MasterSharedQualitySpecScope,
} from './masterSharedQualitySpecs';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

function cloneRow(row: QualitySpecTableRow): QualitySpecTableRow {
  return {
    ...row,
    attachments: [...(row.attachments ?? [])],
    selectOptions: row.selectOptions ? [...row.selectOptions] : undefined,
  };
}

export function readHiddenQualitySpecParameters(source: Record<string, unknown>, field: string): string[] {
  const raw = source[field];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => qualitySpecParameterKey(String(v ?? '')))
    .filter(Boolean);
}

export function readHiddenQualitySpecParametersByPath(
  source: Record<string, unknown>,
  field: string
): Record<string, string[]> {
  const raw = source[field];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [pathKey, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const keys = list
      .map((v) => qualitySpecParameterKey(String(v ?? '')))
      .filter(Boolean);
    if (keys.length > 0) out[pathKey] = keys;
  }
  return out;
}

/**
 * Merge taxonomy-shared parameter definitions with item-specific rows.
 * Item rows override shared defaults for the same parameter name.
 */
export function mergeSharedAndItemQualitySpecRows(
  sharedRows: QualitySpecTableRow[],
  itemRows: QualitySpecTableRow[],
  hiddenParameterKeys: readonly string[]
): QualitySpecTableRow[] {
  const hidden = new Set(hiddenParameterKeys);
  const itemByKey = new Map<string, QualitySpecTableRow>();
  for (const row of itemRows) {
    const key = qualitySpecParameterKey(row.parameter);
    if (key) itemByKey.set(key, cloneRow(row));
  }

  const merged: QualitySpecTableRow[] = [];
  const seen = new Set<string>();

  for (const shared of sharedRows) {
    const key = qualitySpecParameterKey(shared.parameter);
    if (!key || hidden.has(key) || seen.has(key)) continue;
    seen.add(key);
    merged.push(cloneRow(itemByKey.get(key) ?? shared));
  }

  for (const row of itemRows) {
    const key = qualitySpecParameterKey(row.parameter);
    if (!key || hidden.has(key) || seen.has(key)) continue;
    seen.add(key);
    merged.push(cloneRow(row));
  }

  return merged;
}

export function mergeDisplayQualitySpecRows(
  entity: MasterSharedQualitySpecEntity,
  scope: MasterSharedQualitySpecScope,
  scopeKey: string,
  itemRows: QualitySpecTableRow[],
  hiddenParameterKeys: readonly string[]
): QualitySpecTableRow[] {
  const shared = getSharedQualitySpecs(entity, scope, scopeKey);
  return mergeSharedAndItemQualitySpecRows(shared, itemRows, hiddenParameterKeys);
}

/** Parameters removed from the table that exist in the shared taxonomy store → hide on this item only. */
export function collectNewlyHiddenSharedParameters(
  entity: MasterSharedQualitySpecEntity,
  scope: MasterSharedQualitySpecScope,
  scopeKey: string,
  previousRows: QualitySpecTableRow[],
  nextRows: QualitySpecTableRow[]
): string[] {
  const key = scopeKey.trim();
  if (!key) return [];
  const shared = getSharedQualitySpecs(entity, scope, key);
  const sharedKeys = new Set(shared.map((r) => qualitySpecParameterKey(r.parameter)).filter(Boolean));
  const nextKeys = new Set(nextRows.map((r) => qualitySpecParameterKey(r.parameter)).filter(Boolean));
  const hidden: string[] = [];
  for (const row of previousRows) {
    const paramKey = qualitySpecParameterKey(row.parameter);
    if (!paramKey || nextKeys.has(paramKey)) continue;
    if (sharedKeys.has(paramKey)) hidden.push(paramKey);
  }
  return hidden;
}

export function appendHiddenParameters(
  existing: readonly string[],
  added: readonly string[]
): string[] {
  const set = new Set(existing);
  for (const key of added) {
    if (key) set.add(key);
  }
  return [...set];
}

export function appendHiddenParametersForPath(
  existing: Record<string, string[]>,
  pathKey: string,
  added: readonly string[]
): Record<string, string[]> {
  const key = pathKey.trim();
  if (!key || added.length === 0) return existing;
  return {
    ...existing,
    [key]: appendHiddenParameters(existing[key] ?? [], added),
  };
}
