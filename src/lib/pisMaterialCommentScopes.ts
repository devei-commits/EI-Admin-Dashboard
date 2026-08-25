/**
 * RM/PM comment threads for a PIs Extracted row.
 *
 * Comments hang on the MATERIAL (raw_materials.id / pack_materials.id), not on the planning row, so
 * the same thread is reachable from Items Involved. The planning row's BOM entries already carry
 * `raw_material_id` / `pack_material_id`, so the id is taken from the line itself; the master lists
 * are only a fallback for older rows that stored a code but no id — depending on them alone meant
 * no chips appeared at all until those lists happened to be loaded.
 */
export type MaterialCommentScope = { type: 'rm' | 'pm'; id: number; label: string };

type BomLine = {
  raw_material_id?: number | null;
  pack_material_id?: number | null;
  code?: string | null;
  name?: string | null;
  id?: string | number | null;
};

type MasterLike = { id?: string | number | null; code?: string | null; name?: string | null; description?: string | null };

function resolveId(line: BomLine, type: 'rm' | 'pm', masters: MasterLike[]): number | null {
  const direct = Number(type === 'rm' ? line.raw_material_id : line.pack_material_id);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const key = String(line.code ?? line.id ?? '').trim();
  if (!key) return null;
  const hit =
    masters.find((m) => String(m.code ?? '').trim() === key) ??
    masters.find((m) => (m.name ?? m.description ?? '') === (line.name ?? ''));
  const id = Number(hit?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function buildPisMaterialScopes(
  rawMaterials: BomLine[] | undefined | null,
  packagingMaterials: BomLine[] | undefined | null,
  rmMasters: MasterLike[] = [],
  pmMasters: MasterLike[] = [],
): MaterialCommentScope[] {
  const out: MaterialCommentScope[] = [];
  const seen = new Set<string>();
  const push = (line: BomLine, type: 'rm' | 'pm', masters: MasterLike[]) => {
    const id = resolveId(line, type, masters);
    if (id == null) return;
    const key = `${type}-${id}`;
    // The same material can appear on several BOM lines; one chip per material is enough.
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, id, label: String(line.name ?? line.code ?? '').trim() || `${type.toUpperCase()} ${id}` });
  };
  for (const l of rawMaterials ?? []) push(l, 'rm', rmMasters);
  for (const l of packagingMaterials ?? []) push(l, 'pm', pmMasters);
  return out;
}
