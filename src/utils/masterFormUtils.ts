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
    rawMaterial: ['rmSku', 'inciName', 'tradeCommercialName', 'grade', 'compliance'],
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
 * Validate required primary fields
 */
export const validatePrimaryFields = (
  formData: any,
  masterType: 'packaging' | 'rawMaterial' | 'bom'
): { valid: boolean; errors: Record<string, string> } => {
  const primaryFields = getPrimaryFields(masterType);
  const errors: Record<string, string> = {};

  primaryFields.forEach(field => {
    if (!formData[field]) {
      errors[field] = `${field} is required`;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};
