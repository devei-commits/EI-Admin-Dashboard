import type { FormulaBomPhase } from '../services/productsMaster.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import {
  kgToRmPrimaryQty,
  normRmPrimaryUom,
  parseSpecificGravity,
  resolveProcurementRmUnit,
  rmPrimaryQtyToKg,
  specificGravityFromBomLine,
} from './rmUnitConversion';
import { formatQtyExact } from '../utils/formatQty';

/** Std UoM suffix for SKU BOM display (matches kg column casing where applicable). */
export function skuBomStdUomSuffix(stdUom: string): string {
  const u = normRmPrimaryUom(stdUom);
  if (u === 'KG') return ' KG';
  if (u === 'GM') return ' g';
  if (u === 'L') return ' L';
  if (u === 'ML') return ' ml';
  return ` ${u}`;
}

/**
 * Std UoM column — same decimal precision as kg column (not 4dp procurement rounding).
 * Avoids tiny per-unit kg amounts displaying as "0 kg".
 */
export function formatSkuBomStdQtyWithUnit(qty: number, stdUom: string): string {
  if (!Number.isFinite(qty)) return '—';
  const qtyStr = formatQtyExact(qty, 'kg');
  return `${qtyStr}${skuBomStdUomSuffix(stdUom)}`;
}

export type SkuBomQtyDisplay = {
  kgQty: number;
  stdQty: number;
  stdUom: string;
  specificGravity: number;
};

type SkuLineRef = {
  raw_material_id?: number | null;
  rawMaterialId?: string | number | null;
  rm_code?: string;
  rmCode?: string;
};

type FormulaIngredientRef = {
  raw_material_id?: number | null;
  rawMaterialId?: string | number | null;
  rm_code?: string;
  rmCode?: string;
  specific_gravity?: number | null;
  specificGravity?: string | number | null;
};

function skuLineMatchesIngredient(row: SkuLineRef, ing: FormulaIngredientRef): boolean {
  const rowId = row.raw_material_id ?? row.rawMaterialId;
  const ingId = ing.raw_material_id ?? ing.rawMaterialId;
  const idMatch =
    rowId != null &&
    ingId != null &&
    String(rowId).trim() !== '' &&
    Number(rowId) === Number(ingId);
  const rowCode = String(row.rm_code ?? row.rmCode ?? '').trim();
  const ingCode = String(ing.rm_code ?? ing.rmCode ?? '').trim();
  const codeMatch = Boolean(rowCode) && Boolean(ingCode) && rowCode.toUpperCase() === ingCode.toUpperCase();
  return idMatch || codeMatch;
}

export function findFormulaSgForSkuLine(
  formulaBom: FormulaBomPhase[] | null | undefined,
  row: SkuLineRef
): number | null {
  const phases = Array.isArray(formulaBom) ? formulaBom : [];
  for (const phase of phases) {
    const ingredients = Array.isArray(phase.ingredients) ? phase.ingredients : [];
    for (const ing of ingredients) {
      if (skuLineMatchesIngredient(row, ing)) {
        const sg = specificGravityFromBomLine(ing);
        if (sg != null) return sg;
      }
    }
  }
  return null;
}

export function findFormulaSgFromFlatIngredients(
  ingredients: FormulaIngredientRef[] | null | undefined,
  row: SkuLineRef
): number | null {
  const arr = Array.isArray(ingredients) ? ingredients : [];
  for (const ing of arr) {
    if (skuLineMatchesIngredient(row, ing)) {
      const sg = specificGravityFromBomLine(ing);
      if (sg != null) return sg;
    }
  }
  return null;
}

export function resolveRmMasterForSkuLine(
  row: SkuLineRef,
  rmById: Map<number, RawMaterialRecord>,
  rmByCode: Map<string, RawMaterialRecord>
): RawMaterialRecord | null {
  const rowId = row.raw_material_id ?? row.rawMaterialId;
  if (rowId != null && String(rowId).trim() !== '') {
    const byId = rmById.get(Number(rowId));
    if (byId) return byId;
  }
  const code = String(row.rm_code ?? row.rmCode ?? '').trim();
  if (code) {
    const byCode = rmByCode.get(code.toUpperCase());
    if (byCode) return byCode;
  }
  return null;
}

type SkuBomQtyRow = SkuLineRef & {
  qty_per_unit?: number | string;
  qtyPerUnit?: number | string;
  uom?: string;
};

/** Per-unit SKU BOM line → planning kg + RM master standard UoM qty. */
export function computeSkuBomQtyDisplay(args: {
  row: SkuBomQtyRow;
  formulaBom?: FormulaBomPhase[] | null;
  formulaIngredients?: FormulaIngredientRef[] | null;
  rmMaster?: RawMaterialRecord | null;
}): SkuBomQtyDisplay {
  const qtyRaw = args.row.qty_per_unit ?? args.row.qtyPerUnit;
  const qty = Number(qtyRaw);
  const lineUom = args.row.uom || 'GM';
  const formulaSg =
    findFormulaSgForSkuLine(args.formulaBom, args.row) ??
    findFormulaSgFromFlatIngredients(args.formulaIngredients, args.row);
  const masterSg = args.rmMaster?.specificGravity;
  const sg = parseSpecificGravity(formulaSg ?? masterSg ?? 1);

  const kgQty = rmPrimaryQtyToKg(qty, lineUom, sg);
  const rowRmId = args.row.raw_material_id ?? args.row.rawMaterialId;
  const stdUom = resolveProcurementRmUnit(
    rowRmId != null && String(rowRmId).trim() !== '' ? Number(rowRmId) : null,
    lineUom,
    args.rmMaster?.uom
  );
  const stdQty = kgToRmPrimaryQty(kgQty, stdUom, sg);

  return {
    kgQty,
    stdQty,
    stdUom: normRmPrimaryUom(stdUom),
    specificGravity: sg,
  };
}
