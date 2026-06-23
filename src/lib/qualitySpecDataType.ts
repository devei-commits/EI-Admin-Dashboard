export type MasterQualitySpecDataType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'number-range'
  | 'number-le'
  | 'number-ge'
  | 'number-match'
  | 'date'
  | 'select'
  | 'boolean'
  | 'pass-fail'
  | 'attachment';

/** Shared labels for master spec input and GRN result input pickers. */
export const MASTER_QUALITY_SPEC_TYPE_OPTIONS: { value: MasterQualitySpecDataType; label: string }[] = [
  { value: 'text', label: 'Text — single line' },
  { value: 'textarea', label: 'Text — long / textarea' },
  { value: 'number', label: 'Number — single value' },
  { value: 'number-range', label: 'Number — range (min–max)' },
  { value: 'number-le', label: 'Number — ≤ limit' },
  { value: 'number-ge', label: 'Number — ≥ limit' },
  { value: 'number-match', label: 'Number — target ± tolerance' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'pass-fail', label: 'Pass / Fail' },
  { value: 'attachment', label: 'Attachment / file ref' },
];

/** GRN QC result input — how warehouse enters measured values at inbound. */
export type GrnQualitySpecOutputType = MasterQualitySpecDataType | 'text-match';

export const GRN_OUTPUT_TYPE_OPTIONS: { value: GrnQualitySpecOutputType; label: string }[] = [
  ...MASTER_QUALITY_SPEC_TYPE_OPTIONS,
];

const MASTER_QUALITY_SPEC_TYPES = new Set<MasterQualitySpecDataType>(
  MASTER_QUALITY_SPEC_TYPE_OPTIONS.map((o) => o.value)
);

const GRN_OUTPUT_TYPES = new Set<GrnQualitySpecOutputType>([
  ...MASTER_QUALITY_SPEC_TYPES,
  'text-match',
]);

export type ParsedQualitySpecDataType = {
  kind: MasterQualitySpecDataType | 'text';
  unit?: string;
};

const NUMBER_KINDS = new Set<MasterQualitySpecDataType>([
  'number',
  'number-range',
  'number-le',
  'number-ge',
  'number-match',
]);

export function parseQualitySpecDataType(dataType?: string): ParsedQualitySpecDataType {
  const raw = String(dataType ?? '').trim();
  if (!raw) return { kind: 'text' };
  const [base, unit] = raw.split('|');
  const kind = (base || 'text') as MasterQualitySpecDataType | 'text';
  return { kind, unit: unit?.trim() || undefined };
}

export function isNumberQualitySpecKind(kind: ParsedQualitySpecDataType['kind']): boolean {
  return NUMBER_KINDS.has(kind as MasterQualitySpecDataType);
}

export function parseGrnOutputType(raw: unknown): GrnQualitySpecOutputType | undefined {
  const value = String(raw ?? '').trim() as GrnQualitySpecOutputType;
  return GRN_OUTPUT_TYPES.has(value) ? value : undefined;
}

export function grnOutputTypeLabel(outputType?: GrnQualitySpecOutputType): string | undefined {
  if (!outputType) return undefined;
  if (outputType === 'text-match') return 'Text / match value';
  return MASTER_QUALITY_SPEC_TYPE_OPTIONS.find((o) => o.value === outputType)?.label ?? outputType;
}

/** Default GRN result input when adding a custom QC spec — same family as spec data type. */
export function defaultGrnOutputTypeFromDataType(dataType: MasterQualitySpecDataType): GrnQualitySpecOutputType {
  return dataType;
}

export function specLimitPlaceholder(kind: ParsedQualitySpecDataType['kind'], unit?: string): string {
  const unitSuffix = unit ? ` (${unit})` : '';
  switch (kind) {
    case 'number-range':
      return `min–max${unitSuffix}`;
    case 'number-le':
      return `≤ limit${unitSuffix}`;
    case 'number-ge':
      return `≥ limit${unitSuffix}`;
    case 'number-match':
      return `target ± tol${unitSuffix}`;
    case 'number':
      return `Value${unitSuffix}`;
    case 'date':
      return 'Select date';
    case 'attachment':
      return 'File name or URL';
    case 'textarea':
      return 'Long text value';
    case 'select':
      return 'Select option';
    case 'boolean':
      return 'Yes / No';
    case 'pass-fail':
      return 'Pass / Fail';
    default:
      return 'Spec / limit';
  }
}
