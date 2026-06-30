/** Stable GRN line-item ids — legacy rows may lack `id`. Mirrors backend grnQcSpecs.resolveLineItemId. */

export interface GrnLineItemIdInput {
  id?: string | null;
  lineItemId?: string | null;
  line_item_id?: string | null;
  item?: string | null;
  item_text?: string | null;
  itemCode?: string | null;
  item_code?: string | null;
  raw_material_id?: number | null;
  pack_material_id?: number | null;
}

export function resolveGrnLineItemCode(line: GrnLineItemIdInput | null | undefined): string {
  const text = String(line?.item ?? line?.item_text ?? '');
  const ei = text.match(/EI-[A-Z0-9-]+/i);
  if (ei?.[0]) return String(ei[0]).trim().toUpperCase();
  const paren = text.match(/\(([A-Z0-9-]+)\)/);
  if (paren?.[1] && /[0-9]/.test(paren[1])) return String(paren[1]).trim().toUpperCase();
  return String(line?.itemCode ?? line?.item_code ?? '').trim();
}

export function resolveGrnLineItemId(line: GrnLineItemIdInput | null | undefined, index: number): string {
  const id = String(line?.id ?? line?.lineItemId ?? line?.line_item_id ?? '').trim();
  if (id) return id;
  const code = resolveGrnLineItemCode(line);
  if (code) return `grn-line-code-${code}`;
  const rmId = line?.raw_material_id;
  const pmId = line?.pack_material_id;
  if (rmId != null && !Number.isNaN(Number(rmId))) return `grn-line-rm-${Number(rmId)}`;
  if (pmId != null && !Number.isNaN(Number(pmId))) return `grn-line-pm-${Number(pmId)}`;
  return `grn-line-idx-${index}`;
}

export function normalizeGrnLineItemIds<T extends GrnLineItemIdInput>(lines: T[]): Array<T & { id: string }> {
  return (lines ?? []).map((line, index) => ({
    ...line,
    id: resolveGrnLineItemId(line, index),
  }));
}

export function findGrnLineItemByIdOrCode<T extends GrnLineItemIdInput & { itemCode?: string; item?: string }>(
  lines: T[],
  ref: { id?: string | null; itemCode?: string | null; item?: string | null } | null | undefined,
): T | undefined {
  if (!ref || !lines.length) return undefined;
  const refId = String(ref.id ?? '').trim();
  if (refId) {
    const byId = lines.find((li) => li.id === refId);
    if (byId) return byId;
  }
  const codeU = resolveGrnLineItemCode(ref).toUpperCase();
  if (codeU) {
    const byCode = lines.find((li) => resolveGrnLineItemCode(li).toUpperCase() === codeU);
    if (byCode) return byCode;
  }
  const nameU = String(ref.item ?? '').trim().toLowerCase();
  if (nameU) {
    const byName = lines.find((li) => String(li.item ?? '').trim().toLowerCase() === nameU);
    if (byName) return byName;
  }
  return undefined;
}
