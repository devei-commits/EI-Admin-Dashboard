/** Single attachment on a quality-spec row (file name and/or external link). */
export type QualitySpecAttachment = {
  id: string;
  type: 'file' | 'link';
  name: string;
  url: string;
};

/** Tabular quality-spec row (RM / PM masters — Quality Specifications step). */
export type QualitySpecTableRow = {
  id: string;
  parameter: string;
  specLimit: string;
  method: string;
  mandatory: boolean;
  tolerance: string;
  frequency: string;
  sample: string;
  acceptance: string;
  attachments: QualitySpecAttachment[];
};

export function createQualitySpecAttachment(
  partial?: Partial<QualitySpecAttachment>
): QualitySpecAttachment {
  return {
    id: partial?.id ?? `qsa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: partial?.type ?? 'file',
    name: partial?.name ?? '',
    url: partial?.url ?? '',
  };
}

export function createEmptyQualitySpecRow(partial?: Partial<QualitySpecTableRow>): QualitySpecTableRow {
  return {
    id: partial?.id ?? `qs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    parameter: partial?.parameter ?? '',
    specLimit: partial?.specLimit ?? '',
    method: partial?.method ?? '',
    mandatory: partial?.mandatory ?? false,
    tolerance: partial?.tolerance ?? '',
    frequency: partial?.frequency ?? '',
    sample: partial?.sample ?? '',
    acceptance: partial?.acceptance ?? '',
    attachments: partial?.attachments ? [...partial.attachments] : [],
  };
}
