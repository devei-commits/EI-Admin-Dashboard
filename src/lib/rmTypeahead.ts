import type { RawMaterialRecord } from '../services/rawMaterials.service';

export type RmTypeaheadOption = {
  id: string;
  code: string;
  label: string;
  /** Precomputed lowercase haystack for fast includes() filter */
  haystack: string;
  disabled: boolean;
};

export const RM_TYPEAHEAD_MAX_SUGGESTIONS = 50;

/** Build sorted RM picker options once per master list change (avoid re-sort on each keystroke). */
export function buildRmTypeaheadOptions(
  rawMaterials: RawMaterialRecord[],
  opts?: { excludeIds?: Set<string>; allowId?: string }
): RmTypeaheadOption[] {
  const exclude = opts?.excludeIds;
  const allowId = opts?.allowId != null ? String(opts.allowId) : '';
  const rows = rawMaterials.map((rm) => {
    const id = String(rm.id);
    const code = String(rm.code ?? '').trim();
    const name = String(rm.inci || rm.name || '').trim();
    const label = code ? `${code} — ${name || code}` : name || id;
    const haystack = `${code} ${name} ${id}`.trim().toLowerCase();
    const disabled = Boolean(exclude?.has(id) && id !== allowId);
    return { id, code, label, haystack, disabled };
  });
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function filterRmTypeaheadOptions(
  options: RmTypeaheadOption[],
  query: string,
  max = RM_TYPEAHEAD_MAX_SUGGESTIONS
): RmTypeaheadOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.filter((o) => !o.disabled).slice(0, max);
  const out: RmTypeaheadOption[] = [];
  for (let i = 0; i < options.length && out.length < max; i += 1) {
    const o = options[i];
    if (!o.haystack.includes(q)) continue;
    out.push(o);
  }
  return out;
}

export function rmTypeaheadLabelForId(
  rawMaterials: RawMaterialRecord[],
  id: string | undefined | null
): string {
  if (id == null || id === '') return '';
  const rm = rawMaterials.find((r) => String(r.id) === String(id));
  if (!rm) return '';
  const code = String(rm.code ?? '').trim();
  const name = String(rm.inci || rm.name || '').trim();
  return code ? `${code} — ${name || code}` : name;
}
