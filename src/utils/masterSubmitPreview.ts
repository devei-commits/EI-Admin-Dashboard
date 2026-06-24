/**
 * Build read-only preview sections for master form submit (RM / PM / PR).
 */

export type MasterPreviewRow = {
  label: string;
  value: string;
  /** When true, value differs from the server baseline at submit time. */
  changed?: boolean;
  /** Formatted server value shown as "Previously — …" when changed. */
  previousValue?: string;
};
export type MasterPreviewSection = { title: string; rows: MasterPreviewRow[] };

export type MasterPreviewFieldDef = { key: string; label: string };

export type MasterPreviewSectionDef = {
  title: string;
  fields: MasterPreviewFieldDef[];
  /** When true, show rows even when value is empty (displays "—"). */
  includeEmpty?: boolean;
};

const SKIP_PREVIEW_KEYS = new Set(['id', 'seriesPrefix', 'rmType', 'rm_type', 'itemCategory']);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function isEmptyPreviewValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function formatVendorRows(vendors: unknown): string {
  if (!Array.isArray(vendors) || vendors.length === 0) return '—';
  return vendors
    .map((v, i) => {
      const row = v as Record<string, unknown>;
      const name = String(row.name ?? row.vendorName ?? '—');
      const moq = row.moq != null && row.moq !== '' ? ` MOQ ${row.moq}` : '';
      const price = row.unitPrice ?? row.price;
      const priceStr = price != null && price !== '' ? ` @ ${price}` : '';
      return `${i + 1}. ${name}${moq}${priceStr}`;
    })
    .join('\n');
}

function formatTestRows(tests: unknown): string {
  if (!Array.isArray(tests) || tests.length === 0) return '—';
  return tests
    .map((t, i) => {
      const row = t as Record<string, unknown>;
      const name = String(row.name ?? '—');
      const result = String(row.result ?? '—');
      const date = row.date ? ` (${row.date})` : '';
      return `${i + 1}. ${name}: ${result}${date}`;
    })
    .join('\n');
}

function formatFormulaLines(lines: unknown): string {
  if (!Array.isArray(lines) || lines.length === 0) return '—';
  return lines
    .map((line, i) => {
      const row = line as Record<string, unknown>;
      const name = String(row.inciName ?? row.inci_name ?? row.rmCode ?? row.rm_code ?? '—');
      const pct = row.percentWW ?? row.pct_w_w ?? '';
      const phase = row.phase ? ` [${row.phase}]` : '';
      const pctStr = pct !== '' && pct != null ? ` — ${pct}% w/w` : '';
      const sgRaw = row.specificGravity ?? row.specific_gravity;
      const sgStr =
        sgRaw !== '' && sgRaw != null && Number(sgRaw) > 0 ? ` — SG ${sgRaw}` : '';
      return `${i + 1}. ${name}${pctStr}${sgStr}${phase}`;
    })
    .join('\n');
}

function formatSkuBomLines(lines: unknown): string {
  if (!Array.isArray(lines) || lines.length === 0) return '—';
  return lines
    .map((line, i) => {
      const row = line as Record<string, unknown>;
      const name = String(row.inciName ?? row.inci_name ?? row.rmCode ?? '—');
      const qty = row.qtyPerUnit ?? row.qty_per_unit ?? '';
      const uom = row.uom ?? '';
      return `${i + 1}. ${name} — ${qty} ${uom}`.trim();
    })
    .join('\n');
}

function formatPackLines(lines: unknown): string {
  if (!Array.isArray(lines) || lines.length === 0) return '—';
  return lines
    .map((line, i) => {
      const row = line as Record<string, unknown>;
      const desc = String(row.pmDescription ?? row.description ?? row.pmCode ?? '—');
      const subSub = String(
        row.optionalPmSubSubCategory ??
          row.pm_sub_sub_category ??
          row.pmSubSubCategory ??
          ''
      ).trim();
      const subCat = String(
        row.optionalPmSubCategory ?? row.pm_sub_category ?? ''
      ).trim();
      const qty = row.qtyUnit ?? row.qty ?? '';
      const uom = row.uom ?? '';
      const subPart = [subCat, subSub].filter(Boolean).join(' · ');
      return `${i + 1}. ${desc}${subPart ? ` · ${subPart}` : ''} — ${qty} ${uom}`.trim();
    })
    .join('\n');
}

function formatProcessSteps(steps: unknown): string {
  if (!Array.isArray(steps) || steps.length === 0) return '—';
  return steps
    .map((step, i) => {
      const row = step as Record<string, unknown>;
      const num = row.stepNumber ?? i + 1;
      const instr = String(row.instruction ?? '—');
      const dur = row.duration ? ` (${row.duration})` : '';
      return `Step ${num}: ${instr}${dur}`;
    })
    .join('\n');
}

function formatVariants(variants: unknown): string {
  if (!Array.isArray(variants) || variants.length === 0) return '—';
  return variants
    .map((v, i) => {
      const row = v as Record<string, unknown>;
      const id = row.id ?? '—';
      const name = row.name ?? row.variantName ?? '—';
      const moq = row.moq ?? '—';
      const status = row.status ?? '—';
      const lt = row.leadTimeDays ?? row.leadTime;
      const ltPart = lt != null && String(lt) !== '' && Number(lt) !== 0 ? ` — ${lt}d LT` : '';
      const notes = row.notes ? ` — ${row.notes}` : '';
      return `${i + 1}. [${id}] ${name} — MOQ ${moq} (${status})${ltPart}${notes}`;
    })
    .join('\n');
}

function formatDocuments(docs: unknown): string {
  if (!Array.isArray(docs) || docs.length === 0) return '—';
  return docs
    .map((d, i) => {
      const row = d as Record<string, unknown>;
      return `${i + 1}. ${row.type ?? 'Doc'} — ${row.link ?? '—'}`;
    })
    .join('\n');
}

function formatQualitySpecRowsByPath(byPath: unknown): string {
  if (!byPath || typeof byPath !== 'object' || Array.isArray(byPath)) return '—';
  const entries = Object.entries(byPath as Record<string, unknown>);
  if (entries.length === 0) return '—';
  return entries
    .map(([pathKey, rows]) => {
      const formatted = formatQualitySpecRows(rows);
      if (formatted === '—') return `${pathKey}: —`;
      return `${pathKey}:\n${formatted}`;
    })
    .join('\n\n');
}

function formatQualitySpecRows(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length === 0) return '—';
  return rows
    .map((item, i) => {
      const row = item as Record<string, unknown>;
      const parameter = String(row.parameter ?? '—');
      const specLimit = String(row.specLimit ?? row.spec_limit ?? '').trim();
      const method = String(row.method ?? '').trim();
      const tolerance = String(row.tolerance ?? '').trim();
      const attachments = Array.isArray(row.attachments) ? row.attachments.length : 0;
      const parts = [specLimit, method, tolerance].filter(Boolean);
      const attachPart = attachments > 0 ? ` · ${attachments} attachment(s)` : '';
      return `${i + 1}. ${parameter}${parts.length ? ` — ${parts.join(' · ')}` : ''}${attachPart}`;
    })
    .join('\n');
}

function formatArNumbers(entries: unknown): string {
  if (!Array.isArray(entries) || entries.length === 0) return '—';
  return entries
    .map((item, i) => {
      if (typeof item === 'string') return `${i + 1}. ${item}`;
      const row = item as Record<string, unknown>;
      return `${i + 1}. ${String(row.number ?? row.arNumber ?? '—')}`;
    })
    .join('\n');
}

/** Format a single form field for preview display. */
export function formatMasterPreviewValue(value: unknown, key?: string): string {
  if (isEmptyPreviewValue(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'vendors') return formatVendorRows(value);
  if (key === 'tests') return formatTestRows(value);
  if (key === 'documents') return formatDocuments(value);
  if (key === 'arNumbers') return formatArNumbers(value);
  if (key === 'rmQualitySpecRows' || key === 'pmQualitySpecRows') return formatQualitySpecRows(value);
  if (key === 'rmQualitySubSpecRowsByPath' || key === 'pmQualitySubSpecRowsByPath') {
    return formatQualitySpecRowsByPath(value);
  }
  if (key === 'formulaIngredients') return formatFormulaLines(value);
  if (key === 'skuBomLines') return formatSkuBomLines(value);
  if (key === 'packingComponents') return formatPackLines(value);
  if (key === 'processSteps') return formatProcessSteps(value);
  if (key === 'variants') return formatVariants(value);
  if (Array.isArray(value)) {
    return `${value.length} item(s)`;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

export function fieldDefs(keys: string[], labelOverrides: Partial<Record<string, string>> = {}): MasterPreviewFieldDef[] {
  return keys.map((key) => ({
    key,
    label: labelOverrides[key] ?? humanizeKey(key),
  }));
}

/**
 * Build preview sections from form data and section definitions.
 * Keys not listed in any section are grouped under "Other fields".
 */
export function areMasterPreviewValuesEqual(
  current: unknown,
  baseline: unknown,
  key?: string
): boolean {
  return formatMasterPreviewValue(current, key) === formatMasterPreviewValue(baseline, key);
}

function buildPreviewRow(
  label: string,
  key: string,
  raw: unknown,
  baselineFormData?: Record<string, unknown>
): MasterPreviewRow {
  const value = formatMasterPreviewValue(raw, key);
  if (!baselineFormData) {
    return { label, value };
  }
  const baselineRaw = baselineFormData[key];
  if (areMasterPreviewValuesEqual(raw, baselineRaw, key)) {
    return { label, value };
  }
  return {
    label,
    value,
    changed: true,
    previousValue: formatMasterPreviewValue(baselineRaw, key),
  };
}

export function buildMasterPreviewSections(
  formData: Record<string, unknown>,
  sectionDefs: MasterPreviewSectionDef[],
  options?: {
    includeEmpty?: boolean;
    omitKeys?: string[];
    /** Server-side form snapshot for edit submit preview diff highlighting. */
    baselineFormData?: Record<string, unknown>;
  }
): MasterPreviewSection[] {
  const includeEmpty = options?.includeEmpty ?? true;
  const omitKeys = new Set(options?.omitKeys ?? []);
  const baselineFormData = options?.baselineFormData;
  const used = new Set<string>();
  const sections: MasterPreviewSection[] = [];

  for (const def of sectionDefs) {
    const rows: MasterPreviewRow[] = [];
    for (const field of def.fields) {
      if (SKIP_PREVIEW_KEYS.has(field.key) || omitKeys.has(field.key)) continue;
      used.add(field.key);
      const raw = formData[field.key];
      if (!includeEmpty && !def.includeEmpty && isEmptyPreviewValue(raw)) continue;
      rows.push(buildPreviewRow(field.label, field.key, raw, baselineFormData));
    }
    if (rows.length > 0) sections.push({ title: def.title, rows });
  }

  const otherRows: MasterPreviewRow[] = [];
  for (const key of Object.keys(formData)) {
    if (used.has(key) || SKIP_PREVIEW_KEYS.has(key) || omitKeys.has(key)) continue;
    const raw = formData[key];
    if (!includeEmpty && isEmptyPreviewValue(raw)) continue;
    otherRows.push(buildPreviewRow(humanizeKey(key), key, raw, baselineFormData));
  }
  if (otherRows.length > 0) {
    sections.push({ title: 'Other fields', rows: otherRows });
  }

  return sections;
}
