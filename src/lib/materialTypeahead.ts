import type { PackMaterialRecord } from '../services/packMaterials.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import { buildPmTypeaheadOptions } from './pmTypeahead';
import { buildRmTypeaheadOptions } from './rmTypeahead';

export type MaterialKind = 'rm' | 'pm';

export type MaterialTypeaheadOption = {
  key: string;
  kind: MaterialKind;
  id: string;
  code: string;
  name: string;
  label: string;
  haystack: string;
  disabled: boolean;
  unit: string;
  rawMaterialId?: number;
  packMaterialId?: number;
};

export const MATERIAL_TYPEAHEAD_MAX_SUGGESTIONS = 50;

export function buildMaterialTypeaheadOptions(
  rawMaterials: RawMaterialRecord[],
  packMaterials: PackMaterialRecord[],
  opts?: { excludeKeys?: Set<string>; allowKey?: string },
): MaterialTypeaheadOption[] {
  const exclude = opts?.excludeKeys;
  const allowKey = opts?.allowKey ?? '';
  const rmOpts = buildRmTypeaheadOptions(rawMaterials).map((opt) => {
    const key = `rm:${opt.id}`;
    const rm = rawMaterials.find((row) => String(row.id) === opt.id);
    const name = String(rm?.inci || rm?.name || opt.code).trim();
    return {
      key,
      kind: 'rm' as const,
      id: opt.id,
      code: opt.code,
      name,
      label: `${name} · ${opt.code}`,
      haystack: opt.haystack,
      disabled: Boolean(exclude?.has(key) && key !== allowKey),
      unit: 'KG',
      rawMaterialId: Number(opt.id) || undefined,
    };
  });
  const pmOpts = buildPmTypeaheadOptions(packMaterials).map((opt) => {
    const key = `pm:${opt.id}`;
    const pm = packMaterials.find((row) => String(row.id) === opt.id);
    const name = String(pm?.description || opt.code).trim();
    return {
      key,
      kind: 'pm' as const,
      id: opt.id,
      code: opt.code,
      name,
      label: `${name} · ${opt.code}`,
      haystack: opt.haystack,
      disabled: Boolean(exclude?.has(key) && key !== allowKey),
      unit: 'PCS',
      packMaterialId: Number(opt.id) || undefined,
    };
  });
  return [...rmOpts, ...pmOpts].sort((a, b) => a.label.localeCompare(b.label));
}

export function filterMaterialTypeaheadOptions(
  options: MaterialTypeaheadOption[],
  query: string,
  max = MATERIAL_TYPEAHEAD_MAX_SUGGESTIONS,
): MaterialTypeaheadOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.filter((o) => !o.disabled).slice(0, max);
  const out: MaterialTypeaheadOption[] = [];
  for (let i = 0; i < options.length && out.length < max; i += 1) {
    const option = options[i];
    if (!option.haystack.includes(q)) continue;
    out.push(option);
  }
  return out;
}

export function materialTypeaheadLabelForKey(
  rawMaterials: RawMaterialRecord[],
  packMaterials: PackMaterialRecord[],
  key: string,
): string {
  if (key.startsWith('rm:')) {
    const id = key.slice(3);
    const rm = rawMaterials.find((row) => String(row.id) === id);
    if (!rm) return '';
    const name = String(rm.inci || rm.name || rm.code).trim();
    return `${name} · ${rm.code}`;
  }
  if (key.startsWith('pm:')) {
    const id = key.slice(3);
    const pm = packMaterials.find((row) => String(row.id) === id);
    if (!pm) return '';
    const name = String(pm.description || pm.code).trim();
    return `${name} · ${pm.code}`;
  }
  return '';
}
