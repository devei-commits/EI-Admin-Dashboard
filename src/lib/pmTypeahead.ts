import type { PackMaterialRecord } from '../services/packMaterials.service';
import { masterPickerLabelSuffix } from '../constants/masterApprovalStatus';

export type PmTypeaheadOption = {
  id: string;
  code: string;
  label: string;
  haystack: string;
  disabled: boolean;
};

export const PM_TYPEAHEAD_MAX_SUGGESTIONS = 50;

export function buildPmTypeaheadOptions(
  packMaterials: PackMaterialRecord[],
  opts?: { excludeIds?: Set<string>; allowId?: string }
): PmTypeaheadOption[] {
  const exclude = opts?.excludeIds;
  const allowId = opts?.allowId != null ? String(opts.allowId) : '';
  const rows = packMaterials.map((pm) => {
    const id = String(pm.id);
    const code = String(pm.code ?? '').trim();
    const desc = String(pm.description || '').trim();
    const labelBase = code ? `${code} — ${desc || code}` : desc || id;
    const label = `${labelBase}${masterPickerLabelSuffix(pm.status)}`;
    const haystack = `${code} ${desc} ${pm.level || ''} ${id}`.trim().toLowerCase();
    const disabled = Boolean(exclude?.has(id) && id !== allowId);
    return { id, code, label, haystack, disabled };
  });
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function filterPmTypeaheadOptions(
  options: PmTypeaheadOption[],
  query: string,
  max = PM_TYPEAHEAD_MAX_SUGGESTIONS
): PmTypeaheadOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.filter((o) => !o.disabled).slice(0, max);
  const out: PmTypeaheadOption[] = [];
  for (let i = 0; i < options.length && out.length < max; i += 1) {
    const o = options[i];
    if (!o.haystack.includes(q)) continue;
    out.push(o);
  }
  return out;
}

export function pmTypeaheadLabelForId(
  packMaterials: PackMaterialRecord[],
  id: string | undefined | null
): string {
  if (id == null || id === '') return '';
  const pm = packMaterials.find((p) => String(p.id) === String(id));
  if (!pm) return '';
  const code = String(pm.code ?? '').trim();
  const desc = String(pm.description || '').trim();
  return code ? `${code} — ${desc || code}` : desc;
}
