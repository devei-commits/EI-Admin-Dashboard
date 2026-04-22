/**
 * Utility functions for master data forms
 * Eliminates field duplication and enables dynamic population
 */

// Define primary vs derived field relationships
export const FIELD_DEPENDENCIES = {
 packaging: {
  // When these primary fields change, auto-populate derived fields
  pkgSku: { derivedFields: ['pkgCode'] },
  name: { derivedFields: ['pkgCode'] },
  matBody: { derivedFields: ['specWeight', 'compRisk'] }, // Material affects weight/risk
  matClosure: { derivedFields: ['specNeck'] },
 },
 rawMaterial: {
  rmSku: { derivedFields: ['vendorName'] },
  inciName: { derivedFields: ['synonyms', 'tradeCommercialName'] },
  grade: { derivedFields: ['assayPurity', 'apparanceSpec'] },
  compliance: { derivedFields: ['allergenRequired', 'gmoRequired'] },
 },
 bom: {
  client: { derivedFields: ['type', 'site'] },
  name: { derivedFields: ['bomCode'] },
  dosage: { derivedFields: ['specBulk'] },
 }
};

// Common fields across all masters that can be auto-populated
export const AUTO_POPULATE_RULES = {
 itemCode: (data: any) => {
  const prefix = data.type || 'ITEM';
  return `${prefix}-${Date.now().toString().slice(-6)}`;
 },
 version: () => 'v1.0',
 status: () => 'Draft',
 timestamp: () => new Date().toISOString(),
};

// Temp field to array mapping - prevent duplication
export const TEMP_FIELD_MAPPINGS = {
 packaging: {
  variant: {
   tempFields: ['varId', 'varVolume', 'varSameMold', 'varMoq', 'varStatus'],
   arrayField: 'variants',
   itemType: { id: '', volume: 0, sameMold: '', moq: 0, status: 'Active' }
  },
  vendor: {
   tempFields: ['venName', 'venLocation', 'venMoq', 'venPrice', 'venLT', 'venApproved', 'venPriceType', 'venValid', 'venSampleCost'],
   arrayField: 'vendors',
   itemType: { name: '', location: '', moq: 0, price: 0, leadTime: 0, approved: '', priceType: '', validTill: '', sampleCost: 0 }
  },
  test: {
   tempFields: ['testName', 'testResult', 'testDate', 'testBy', 'testRemarks'],
   arrayField: 'tests',
   itemType: { name: '', result: '', date: '', by: '', remarks: '' }
  },
 },
 rawMaterial: {
  vendor: {
   tempFields: ['vendorName', 'vendorLocation', 'moq', 'unitPrice', 'leadTime', 'approved', 'priceValidTill'],
   arrayField: 'vendors',
   itemType: { name: '', location: '', moq: 0, price: 0, leadTime: 0, approved: '', priceValidTill: '' }
  },
  document: {
   tempFields: ['documentType', 'documentLink', 'documentDate'],
   arrayField: 'documents',
   itemType: { type: '', link: '', date: '' }
  },
  test: {
   tempFields: ['testName', 'testResult', 'testDate', 'approvedBy', 'testRemarks'],
   arrayField: 'tests',
   itemType: { name: '', result: '', date: '', approvedBy: '', remarks: '' }
  },
 },
 bom: {
  rmLine: {
   tempFields: ['rmCode', 'rmName', 'rmPhase', 'rmFunc', 'rmPct', 'rmUom', 'rmSpec', 'rmNotes'],
   arrayField: 'rmLines',
   itemType: { code: '', name: '', phase: '', func: '', pct: 0, uom: 'GM', spec: '', notes: '' }
  },
  pmLine: {
   tempFields: ['pmCode', 'pmName', 'pmCat', 'pmQty', 'pmUom', 'pmNotes'],
   arrayField: 'pmLines',
   itemType: { code: '', name: '', cat: '', qty: 0, uom: 'PCS', notes: '' }
  },
 }
};

/**
 * Add an item to array using temp fields
 * Automatically clears temp fields after adding
 */
export const addToArray = (
 formData: any,
 masterType: 'packaging' | 'rawMaterial' | 'bom',
 itemType: string,
 setFormData: (updater: any) => void
) => {
 const mapping = TEMP_FIELD_MAPPINGS[masterType]?.[itemType];
 if (!mapping) return;

 const { tempFields, arrayField, itemType: template } = mapping;
 
 // Extract values from temp fields
 const newItem = { ...template };
 const templateKeys = Object.keys(template);
 
 tempFields.forEach((field, idx) => {
  const key = templateKeys[idx];
  if (key) newItem[key] = formData[field];
 });

 // Add to array and clear temp fields
 setFormData((prev: any) => {
  const updated = { ...prev };
  updated[arrayField] = [...(prev[arrayField] || []), newItem];
  tempFields.forEach(field => updated[field] = '');
  return updated;
 });
};

/**
 * Remove item from array
 */
export const removeFromArray = (
 formData: any,
 masterType: 'packaging' | 'rawMaterial' | 'bom',
 itemType: string,
 index: number,
 setFormData: (updater: any) => void
) => {
 const mapping = TEMP_FIELD_MAPPINGS[masterType]?.[itemType];
 if (!mapping) return;

 const { arrayField } = mapping;
 setFormData((prev: any) => ({
  ...prev,
  [arrayField]: prev[arrayField].filter((_: any, i: number) => i !== index)
 }));
};

/**
 * Get primary fields for a master type (what user should input first)
 */
export const getPrimaryFields = (masterType: 'packaging' | 'rawMaterial' | 'bom'): string[] => {
 const primaryMap = {
  packaging: ['pkgSku', 'name', 'level', 'matBody', 'matClosure'],
  rawMaterial: ['rmSku', 'inciName', 'tradeCommercialName'],
  bom: ['bomCode', 'client', 'name', 'dosage', 'type']
 };
 return primaryMap[masterType] || [];
};

/**
 * Auto-populate derived fields based on primary field values
 * Returns updated formData with auto-populated fields
 */
export const autoPopulateDerivedFields = (
 formData: any,
 masterType: 'packaging' | 'rawMaterial' | 'bom',
 changedField: string
): any => {
 const dependencies = FIELD_DEPENDENCIES[masterType];
 if (!dependencies[changedField]) return formData;

 const { derivedFields } = dependencies[changedField];
 const updated = { ...formData };

 derivedFields.forEach(field => {
  // Example logic - customize based on your rules
  if (changedField === 'pkgSku' && field === 'pkgCode') {
   updated[field] = `PKG-${formData.pkgSku}`;
  } else if (changedField === 'rmSku' && field === 'vendorName') {
   // Could auto-fetch from vendor DB based on SKU
  } else if (changedField === 'name' && field === 'bomCode') {
   updated[field] = `BOM-${formData.name?.substring(0, 3).toUpperCase()}`;
  }
 });

 return updated;
};

/**
 * When true, HSN (and RM: GST %) must be filled with valid values.
 * Exempted / NonGST preferences skip tax detail requirements.
 */
export function taxPreferenceRequiresDetails(preference: string | undefined): boolean {
 return String(preference ?? '').trim() === 'Taxable';
}

/** India HSN/SAC: typically 4–8 digits; allow up to 12 digits. */
export function isValidHsnOrSacCode(raw: string): boolean {
 const s = String(raw ?? '').replace(/\s/g, '');
 if (!s) return false;
 return /^\d{4,12}$/.test(s);
}

/** GST %: 0–100; allows optional % suffix in input. */
export function isValidGstPercent(raw: string | number | undefined): boolean {
 const s = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim().replace(/%/g, '').replace(/,/g, '');
 if (s === '') return false;
 const n = parseFloat(s);
 return Number.isFinite(n) && n >= 0 && n <= 100;
}

/** Supported GST rate options shown when Tax Preference is Taxable. */
export const GST_RATE_OPTIONS = ['0', '3', '5', '12', '18', '28'] as const;

/** True when the provided GST % matches one of the standard slab values. */
export function isAllowedGstRate(raw: string | number | undefined): boolean {
 const s = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim().replace(/%/g, '');
 if (!s) return false;
 return (GST_RATE_OPTIONS as readonly string[]).includes(s);
}

/**
 * Validate tax classification lines for masters that use Zoho-style tax preference.
 * - Both RM and PM: require `*TaxPreference` to be explicitly chosen (not blank).
 * - rawMaterial (Taxable): requires hsnCode + gst rate.
 * - packaging   (Taxable): requires pkgHsn + pkgGst rate.
 */
export function validateMasterTaxDetails(
 formData: Record<string, unknown>,
 masterType: 'rawMaterial' | 'packaging'
): { valid: boolean; errors: Record<string, string> } {
 const errors: Record<string, string> = {};

 /** RM and PM tax validation both point users to stage index 0. */
 const taxStepRm = 0;
 const taxStepPm = 0;

 if (masterType === 'rawMaterial') {
  const pref = String(formData.rmTaxPreference ?? '').trim();
  if (!pref) {
   errors.rmTaxPreference = formatStepFieldMessage(taxStepRm, 'Tax Preference');
   return { valid: false, errors };
  }
  if (!taxPreferenceRequiresDetails(pref)) {
   return { valid: true, errors: {} };
  }
  const hsn = String(formData.hsnCode ?? '').trim();
  if (!hsn) {
   errors.hsnCode = formatStepFieldMessage(
    taxStepRm,
    'HSN code',
    'is required when Tax Preference is Taxable'
   );
  } else if (!isValidHsnOrSacCode(hsn)) {
   errors.hsnCode = formatStepFieldMessage(taxStepRm, 'HSN code', 'must be 4–12 digits');
  }
  const gstRaw = formData.gst;
  const gstStr = gstRaw == null ? '' : String(gstRaw).trim();
  if (!gstStr) {
   errors.gst = formatStepFieldMessage(taxStepRm, 'GST %', 'is required when Tax Preference is Taxable');
  } else if (!isAllowedGstRate(gstStr)) {
   errors.gst = formatStepFieldMessage(taxStepRm, 'GST %', 'must be one of 0 / 3 / 5 / 12 / 18 / 28');
  }
  return { valid: Object.keys(errors).length === 0, errors };
 }

 if (masterType === 'packaging') {
  const pref = String(formData.pkgTaxPreference ?? '').trim();
  if (!pref) {
   errors.pkgTaxPreference = formatStepFieldMessage(taxStepPm, 'Tax Preference');
   return { valid: false, errors };
  }
  if (!taxPreferenceRequiresDetails(pref)) {
   return { valid: true, errors: {} };
  }
  const hsn = String(formData.pkgHsn ?? '').trim();
  if (!hsn) {
   errors.pkgHsn = formatStepFieldMessage(
    taxStepPm,
    'HSN code',
    'is required when Tax Preference is Taxable'
   );
  } else if (!isValidHsnOrSacCode(hsn)) {
   errors.pkgHsn = formatStepFieldMessage(taxStepPm, 'HSN code', 'must be 4–12 digits');
  }
  const gstRaw = formData.pkgGst;
  const gstStr = gstRaw == null ? '' : String(gstRaw).trim();
  if (!gstStr) {
   errors.pkgGst = formatStepFieldMessage(taxStepPm, 'GST %', 'is required when Tax Preference is Taxable');
  } else if (!isAllowedGstRate(gstStr)) {
   errors.pkgGst = formatStepFieldMessage(taxStepPm, 'GST %', 'must be one of 0 / 3 / 5 / 12 / 18 / 28');
  }
  return { valid: Object.keys(errors).length === 0, errors };
 }

 return { valid: true, errors: {} };
}

/** 0-based stage index on the master form → same number as sidebar labels (`0) …`, `1) …`). */
const PRIMARY_FIELD_STEP: Record<'packaging' | 'rawMaterial' | 'bom', Record<string, number>> = {
 rawMaterial: {
  rmSku: 0,
  inciName: 0,
  tradeCommercialName: 0,
 },
 packaging: {
  pkgSku: 0,
  name: 0,
  level: 0,
  matBody: 1,
  matClosure: 1,
 },
 bom: {
  bomCode: 0,
  client: 0,
  name: 0,
  dosage: 0,
  type: 0,
 },
};

const PRIMARY_FIELD_LABEL: Record<'packaging' | 'rawMaterial' | 'bom', Record<string, string>> = {
 rawMaterial: {
  rmSku: 'SKU / RM code',
  inciName: 'INCI Name',
  tradeCommercialName: 'Trade/Commercial Name',
 },
 packaging: {
  pkgSku: 'SKU',
  name: 'Item Name',
  level: 'Level',
  matBody: 'Material (Body)',
  matClosure: 'Material (Closure)',
 },
 bom: {
  bomCode: 'BOM code',
  client: 'Client',
  name: 'Name',
  dosage: 'Dosage',
  type: 'Type',
 },
};

/** Shown in inline errors and toasts: `Step 1 — HSN code is required` (matches sidebar index `1)`). */
export function formatStepFieldMessage(stepIndex0: number, label: string, suffix = 'is required'): string {
 return `Step ${stepIndex0} — ${label} ${suffix}`;
}

/**
 * Validate required primary fields
 */
export const validatePrimaryFields = (
 formData: any,
 masterType: 'packaging' | 'rawMaterial' | 'bom'
): { valid: boolean; errors: Record<string, string> } => {
 const primaryFields = getPrimaryFields(masterType);
 const errors: Record<string, string> = {};
 const stepMap = PRIMARY_FIELD_STEP[masterType];
 const labelMap = PRIMARY_FIELD_LABEL[masterType];

 primaryFields.forEach(field => {
  if (!formData[field]) {
   const step = stepMap[field] ?? 0;
   const label = labelMap[field] ?? field;
   errors[field] = formatStepFieldMessage(step, label);
  }
 });

 return {
  valid: Object.keys(errors).length === 0,
  errors
 };
};
