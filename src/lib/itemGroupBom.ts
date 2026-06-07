import type { BOMRmLine } from '../services/bom.service';
import type { ItemGroupRecord } from '../services/itemGroups.service';

/** Planning BOM formula line — may reference an item group or a specific RM. */
export type PlanningBomFormulaItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  percentage: number;
  code?: string;
  phase?: string;
  raw_material_id?: number;
  specificGravity?: number;
  item_group_id?: number;
  item_group_name?: string;
};

export function isItemGroupFormulaLine(line: { item_group_id?: number | null } | null | undefined): boolean {
  const id = line?.item_group_id;
  return id != null && Number.isFinite(Number(id)) && Number(id) > 0;
}

export function mapBomRmLineToPlanningFormulaItem(
  line: BOMRmLine,
  index: number,
  resolveSg: (line: BOMRmLine) => number
): PlanningBomFormulaItem {
  const itemGroupId =
    line.item_group_id != null && Number.isFinite(Number(line.item_group_id))
      ? Number(line.item_group_id)
      : undefined;
  const itemGroupName =
    line.item_group_name != null && String(line.item_group_name).trim() !== ''
      ? String(line.item_group_name).trim()
      : undefined;
  const isGroup = isItemGroupFormulaLine({ item_group_id: itemGroupId });
  const rawMaterialId =
    line.raw_material_id != null && Number.isFinite(Number(line.raw_material_id))
      ? Number(line.raw_material_id)
      : undefined;

  const displayName =
    (isGroup ? itemGroupName || line.inci_name : line.inci_name) ??
    itemGroupName ??
    '';

  return {
    id: String(
      rawMaterialId ??
        (isGroup && itemGroupId != null ? `ig-${itemGroupId}` : line.rm_code ?? index)
    ),
    raw_material_id: rawMaterialId,
    name: String(displayName).trim(),
    quantity: 0,
    unit: line.uom ?? 'KG',
    percentage: line.pct_w_w ?? line.pct ?? 0,
    code: line.rm_code,
    phase: line.phase ?? 'Phase A',
    specificGravity: resolveSg(line),
    ...(isGroup && itemGroupId != null
      ? { item_group_id: itemGroupId, item_group_name: itemGroupName ?? displayName }
      : {}),
  };
}

export function mapPlanningFormulaItemToBomRmLine(
  item: PlanningBomFormulaItem,
  resolveSg: (item: PlanningBomFormulaItem) => number
): BOMRmLine {
  const isGroup = isItemGroupFormulaLine(item);
  const rawMaterialId =
    item.raw_material_id != null && Number.isFinite(Number(item.raw_material_id))
      ? Number(item.raw_material_id)
      : undefined;

  return {
    phase: item.phase ?? 'Phase A',
    inci_name: item.name,
    rm_code: item.code ?? item.id,
    pct_w_w: item.percentage,
    uom: 'KG',
    specific_gravity: resolveSg(item),
    ...(rawMaterialId != null ? { raw_material_id: rawMaterialId } : {}),
    ...(isGroup && item.item_group_id != null
      ? {
          item_group_id: item.item_group_id,
          item_group_name: item.item_group_name ?? item.name,
        }
      : {}),
  };
}

/** Item groups eligible for swap when the source BOM line is selected. */
export function resolveSwapTargetItemGroups(
  sourceLine: PlanningBomFormulaItem | null,
  itemGroupsRm: ItemGroupRecord[],
  lineMatchesMember: (
    line: PlanningBomFormulaItem,
    member: { id: string; code: string; name: string }
  ) => boolean
): ItemGroupRecord[] {
  if (!sourceLine || itemGroupsRm.length === 0) return [];

  if (isItemGroupFormulaLine(sourceLine)) {
    const grp = itemGroupsRm.find((g) => Number(g.id) === Number(sourceLine.item_group_id));
    return grp ? [grp] : [];
  }

  return itemGroupsRm.filter((grp) =>
    (grp.approvedMembers ?? []).some((m) => lineMatchesMember(sourceLine, m))
  );
}
