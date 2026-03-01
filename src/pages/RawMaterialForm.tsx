import React, { useState, useEffect, useCallback } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { getPrimaryFields, validatePrimaryFields } from '../utils/masterFormUtils';
import { useAutoSave } from '../hooks/useAutoSave';
import { fetchRawMaterialsList, createRawMaterial, type RawMaterialRecord } from '../services/rawMaterials.service';

const RawMaterialRefactored: React.FC = () => {
 useItems(); // items list now loaded from API on dashboard
 const { addToast } = useToast();
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [currentStage, setCurrentStage] = useState(0);
 const [pageTab, setPageTab] = useState<'dashboard' | 'form'>('dashboard');
 const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

 const [formData, setFormData] = useState({
  // Primary Info
  rmSku: '',
  rmTaxPreference: 'Taxable',
  rmReturnable: false,
  rmAssociateItems: '',

  // QC Categorisation & Coding
  rmCategory: '',
  qcInspectionGroup: '',
  subCategory: '',
  hazardHandlingClass: '',
  seriesPrefix: '',
  
  // Identity
  inciName: '',
  tradeCommercialName: '',
  functionRole: '',
  rmType: '',
  casNo: '',
  einecs: '',
  countryOfOrigin: '',
  manufacturer: '',
  synonyms: '',
  internalNotes: '',
  
  // Units, Tax & Procurement
  primaryUom: '',
  issueUom: '',
  conversionFactor: '',
  standardPackSize: '',
  hsnCode: '',
  gst: '',
  accountingCategory: '',
  preferredCurrency: 'INR',
  
  // Technical & Regulatory
  grade: '',
  compliance: '',
  allergenRequired: false,
  gmoRequired: false,
  sdsAvailable: false,
  coaAvailable: false,
  regulatoryNotes: '',
  
  // Quality Specifications
  assayPurity: '',
  appearanceSpec: '',
  phSpec: '',
  moistureLod: '',
  heavyMetalsSpec: '',
  microbialSpec: '',
  odorColorSpec: '',
  otherSpecs: '',
  
  // Usage in Formulation
  recommendedUseLevel: '',
  maxUseLevel: '',
  solubility: '',
  processingGuidance: '',
  incompatibilities: '',
  stabilityNotes: '',
  claims: '',
  
  // Inventory, Storage & WH
  storageConditions: '',
  shelfLife: '',
  retestPeriod: '',
  warehouseLocation: '',
  batchTracking: '',
  fifoFefo: '',
  minimumStock: '',
  reorderLevel: '',
  handlingNotes: '',

  // ARRAYS (no temp fields mixed in!)
  vendors: [] as Array<{
   id: string;
   name: string;
   location: string;
   moq: number;
   unitPrice: number;
   leadTime: number;
   approved: string;
   priceValidTill: string;
  }>,

  documents: [] as Array<{
   id: string;
   type: string;
   link: string;
   date: string;
  }>,

  tests: [] as Array<{
   id: string;
   name: string;
   result: string;
   date: string;
   approvedBy: string;
   remarks: string;
  }>,
 });

 /** Mock form data for testing submit (Fill mock values). */
 const RM_MOCK_FORM = {
  rmSku: 'EI-RM-MOCK-001',
  rmTaxPreference: 'Taxable',
  rmReturnable: false,
  rmAssociateItems: '',
  rmCategory: 'ACTIVE',
  qcInspectionGroup: 'Chemical QC',
  subCategory: 'Actives',
  hazardHandlingClass: '',
  seriesPrefix: 'EI-RM-ACT',
  inciName: 'Glycerin',
  tradeCommercialName: 'Glycerin USP',
  functionRole: 'Humectant',
  rmType: 'Liquid',
  casNo: '56-81-5',
  einecs: '200-289-5',
  countryOfOrigin: 'IN',
  manufacturer: 'Mock Supplier',
  synonyms: '',
  internalNotes: 'Mock data for testing',
  primaryUom: 'KG',
  issueUom: 'KG',
  conversionFactor: '1',
  standardPackSize: '25',
  hsnCode: '29054500',
  gst: '12',
  accountingCategory: 'Raw Material',
  preferredCurrency: 'INR',
  grade: 'USP',
  compliance: 'ISO',
  allergenRequired: false,
  gmoRequired: false,
  sdsAvailable: true,
  coaAvailable: true,
  regulatoryNotes: '',
  assayPurity: '99.5% min',
  appearanceSpec: 'Clear colourless',
  phSpec: '5-7',
  moistureLod: '0.5% max',
  heavyMetalsSpec: '10 ppm max',
  microbialSpec: 'TAMC 1000',
  odorColorSpec: 'Odourless',
  otherSpecs: '',
  recommendedUseLevel: '2-5%',
  maxUseLevel: '10%',
  solubility: 'Water miscible',
  processingGuidance: 'Add to water phase',
  incompatibilities: '',
  stabilityNotes: '24M',
  claims: 'Hydrating',
  storageConditions: 'Cool dry',
  shelfLife: '36M',
  retestPeriod: '12M',
  warehouseLocation: 'A1',
  batchTracking: 'Yes',
  fifoFefo: 'FIFO',
  minimumStock: '100',
  reorderLevel: '500',
  handlingNotes: '',
  vendors: [] as Array<{ id: string; name: string; location: string; moq: number; unitPrice: number; leadTime: number; approved: string; priceValidTill: string }>,
  documents: [] as Array<{ id: string; type: string; link: string; date: string }>,
  tests: [] as Array<{ id: string; name: string; result: string; date: string; approvedBy: string; remarks: string }>,
 };

 // Temp fields separated
 const [tempVendor, setTempVendor] = useState({ 
  name: '', location: '', moq: '', unitPrice: '', leadTime: '', approved: '', priceValidTill: '' 
 });
 const [tempDocument, setTempDocument] = useState({ 
  type: '', link: '', date: '' 
 });
 const [tempTest, setTempTest] = useState({ 
  name: '', result: '', date: '', approvedBy: '', remarks: '' 
 });

useAutoSave('raw_material_draft_new', formData);

// Load draft on mount (single toast per session)
useEffect(() => {
 const draft = localStorage.getItem('raw_material_draft_new');
 if (!draft) return;

 try {
  setFormData(JSON.parse(draft));

  const toastFlagKey = 'raw_material_draft_toast_shown';
  if (!sessionStorage.getItem(toastFlagKey)) {
   sessionStorage.setItem(toastFlagKey, '1');
   addToast('info', 'Raw Material draft loaded');
  }
 } catch {
  // ignore parse errors
 }
}, [addToast]);

 const stages = [
  'Primary Info',
  'QC Categorisation & Coding',
  'Identity',
  'Units, Tax & Procurement',
  'Technical & Regulatory',
  'Quality Specifications',
  'Usage in Formulation (R&D)',
  'Vendors & Commercial',
  'QA Testing & Documents',
  'Inventory, Storage & WH',
  'Review / JSON',
 ];

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { id, value, type } = e.target;
  setFormData(prev => ({
   ...prev,
   [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
  }));
 };

 // Vendor operations
 const handleAddVendor = () => {
  if (!tempVendor.name.trim()) {
   setErrors(prev => ({ ...prev, venName: 'Vendor name required' }));
   addToast('error', 'Vendor name required');
   return;
  }
  setFormData(prev => ({
   ...prev,
   vendors: [...prev.vendors, {
    id: Date.now().toString(),
    name: tempVendor.name,
    location: tempVendor.location,
    moq: Number(tempVendor.moq),
    unitPrice: Number(tempVendor.unitPrice),
    leadTime: Number(tempVendor.leadTime),
    approved: tempVendor.approved,
    priceValidTill: tempVendor.priceValidTill,
   }]
  }));
  setTempVendor({ name: '', location: '', moq: '', unitPrice: '', leadTime: '', approved: '', priceValidTill: '' });
  setErrors(prev => ({ ...prev, venName: '' }));
 };

 const handleRemoveVendor = (id: string) => {
  setFormData(prev => ({
   ...prev,
   vendors: prev.vendors.filter(v => v.id !== id)
  }));
 };

 // Document operations
 const handleAddDocument = () => {
  if (!tempDocument.type || !tempDocument.link.trim()) {
   setErrors(prev => ({ ...prev, documentType: 'Document type and link are required' }));
   addToast('error', 'Document type and link are required');
   return;
  }
  setFormData(prev => ({
   ...prev,
   documents: [...prev.documents, {
    id: Date.now().toString(),
    type: tempDocument.type,
    link: tempDocument.link,
    date: tempDocument.date,
   }]
  }));
  setTempDocument({ type: '', link: '', date: '' });
  setErrors(prev => ({ ...prev, documentType: '' }));
 };

 const handleRemoveDocument = (id: string) => {
  setFormData(prev => ({
   ...prev,
   documents: prev.documents.filter(d => d.id !== id)
  }));
 };

 // Test operations
 const handleAddTest = () => {
  if (!tempTest.name || !tempTest.result) {
   setErrors(prev => ({ ...prev, testName: 'Test name and result are required' }));
   addToast('error', 'Test name and result are required');
   return;
  }
  setFormData(prev => ({
   ...prev,
   tests: [...prev.tests, {
    id: Date.now().toString(),
    name: tempTest.name,
    result: tempTest.result,
    date: tempTest.date,
    approvedBy: tempTest.approvedBy,
    remarks: tempTest.remarks,
   }]
  }));
  setTempTest({ name: '', result: '', date: '', approvedBy: '', remarks: '' });
  setErrors(prev => ({ ...prev, testName: '' }));
 };

 const handleRemoveTest = (id: string) => {
  setFormData(prev => ({
   ...prev,
   tests: prev.tests.filter(t => t.id !== id)
  }));
 };

 const handleSubmit = async () => {
  const validation = validatePrimaryFields(formData, 'rawMaterial');
  if (!validation.valid) {
   setErrors(validation.errors);
   addToast('error', 'Please fill all primary fields');
   return;
  }
  try {
   await createRawMaterial(formData as Record<string, unknown>);
   addToast('success', 'Raw Material saved successfully!');
   localStorage.removeItem('raw_material_draft_new');
   setDashboardRefreshKey(k => k + 1);
   setPageTab('dashboard');
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to save raw material');
  }
 };

 // Stage content rendering
 const renderStageContent = () => {
  switch (currentStage) {
  case 0: // Primary Info
  return (
   <div className="space-y-4">
    <InputField
     label="SKU"
     id="rmSku"
     value={formData.rmSku}
     onChange={handleInputChange}
     placeholder="Internal raw material code (e.g. RM-000123)"
    />
    <SelectField
     label="Tax Preference"
     id="rmTaxPreference"
     value={formData.rmTaxPreference}
     onChange={handleInputChange}
     options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
    />
    <CheckboxField
     label="Returnable Item"
     id="rmReturnable"
     checked={formData.rmReturnable}
     onChange={handleInputChange}
    />
    <TextareaField
     label="Associate Items"
     id="rmAssociateItems"
     value={formData.rmAssociateItems}
     onChange={handleInputChange}
     placeholder="Link related RM / PM / packaging codes if any"
    />
   </div>
  );

  case 1: // QC Categorisation
  return (
   <div className="space-y-4">
    <InputField
     label="Category"
     id="rmCategory"
     value={formData.rmCategory}
     onChange={handleInputChange}
     placeholder="e.g. Emollient, Active, Preservative"
    />
    <InputField
     label="QC Inspection Group"
     id="qcInspectionGroup"
     value={formData.qcInspectionGroup}
     onChange={handleInputChange}
     placeholder="Which QC lab evaluates this RM"
    />
    <InputField
     label="Sub Category"
     id="subCategory"
     value={formData.subCategory}
     onChange={handleInputChange}
     placeholder="Optional finer bucket (e.g. Silicone emollient)"
    />
    <InputField
     label="Hazard Handling Class"
     id="hazardHandlingClass"
     value={formData.hazardHandlingClass}
     onChange={handleInputChange}
     placeholder="e.g. Flammable, Corrosive, General"
    />
    <InputField
     label="Series Prefix"
     id="seriesPrefix"
     value={formData.seriesPrefix}
     onChange={handleInputChange}
     placeholder="Code prefix used in ERP / labels"
    />
   </div>
  );

  case 2: // Identity
  return (
   <div className="space-y-4">
    <InputField
     label="INCI Name"
     id="inciName"
     value={formData.inciName}
     onChange={handleInputChange}
     placeholder="Official INCI name as per supplier / standard"
    />
    <InputField
     label="Trade/Commercial Name"
     id="tradeCommercialName"
     value={formData.tradeCommercialName}
     onChange={handleInputChange}
     placeholder="What vendor calls this raw material"
    />
    <InputField
     label="Function/Role"
     id="functionRole"
     value={formData.functionRole}
     onChange={handleInputChange}
     placeholder="e.g. Emulsifier, Preservative, Fragrance"
    />
    <InputField
     label="Type"
     id="rmType"
     value={formData.rmType}
     onChange={handleInputChange}
     placeholder="e.g. Liquid, Powder, Paste"
    />
    <InputField
     label="CAS Number"
     id="casNo"
     value={formData.casNo}
     onChange={handleInputChange}
     placeholder="e.g. 9004-99-3"
    />
    <InputField
     label="EINECS Number"
     id="einecs"
     value={formData.einecs}
     onChange={handleInputChange}
     placeholder="If applicable"
    />
    <InputField
     label="Country of Origin"
     id="countryOfOrigin"
     value={formData.countryOfOrigin}
     onChange={handleInputChange}
     placeholder="e.g. India, France"
    />
    <InputField
     label="Manufacturer"
     id="manufacturer"
     value={formData.manufacturer}
     onChange={handleInputChange}
     placeholder="Manufacturer / principal supplier"
    />
    <TextareaField
     label="Synonyms"
     id="synonyms"
     value={formData.synonyms}
     onChange={handleInputChange}
     placeholder="Other names used internally or by vendors"
    />
    <TextareaField
     label="Internal Notes"
     id="internalNotes"
     value={formData.internalNotes}
     onChange={handleInputChange}
     placeholder="Any internal-only remarks for R&D, QC, or Purchase"
    />
   </div>
  );

   case 3: // Units, Tax & Procurement
    return (
     <div className="space-y-4">
    <InputField
     label="Primary UoM"
     id="primaryUom"
     value={formData.primaryUom}
     onChange={handleInputChange}
     placeholder="e.g. KG, GM, L"
    />
    <InputField
     label="Issue UoM"
     id="issueUom"
     value={formData.issueUom}
     onChange={handleInputChange}
     placeholder="Unit in which material is issued"
    />
    <InputField
     label="Conversion Factor"
     id="conversionFactor"
     value={formData.conversionFactor}
     onChange={handleInputChange}
     placeholder="e.g. 1 KG = 1000 GM → 1000"
    />
    <InputField
     label="Standard Pack Size"
     id="standardPackSize"
     value={formData.standardPackSize}
     onChange={handleInputChange}
     placeholder="e.g. 25 KG bag, 200 KG drum"
    />
    <InputField
     label="HSN Code"
     id="hsnCode"
     value={formData.hsnCode}
     onChange={handleInputChange}
     placeholder="Tax classification code"
    />
    <InputField
     label="GST %"
     id="gst"
     value={formData.gst}
     onChange={handleInputChange}
     placeholder="e.g. 18"
    />
    <InputField
     label="Accounting Category"
     id="accountingCategory"
     value={formData.accountingCategory}
     onChange={handleInputChange}
     placeholder="ERP / finance category mapping"
    />
      <SelectField label="Preferred Currency" id="preferredCurrency" value={formData.preferredCurrency} onChange={handleInputChange}
       options={['INR', 'USD', 'EUR', 'GBP']} />
     </div>
    );

   case 4: // Technical & Regulatory
    return (
     <div className="space-y-4">
    <InputField
     label="Grade"
     id="grade"
     value={formData.grade}
     onChange={handleInputChange}
     placeholder="e.g. Cosmetic Grade, Pharma Grade"
    />
    <InputField
     label="Compliance/Certificate"
     id="compliance"
     value={formData.compliance}
     onChange={handleInputChange}
     placeholder="e.g. COSMOS, ECOCERT, RSPO"
    />
      <CheckboxField label="Allergen Declaration Required" id="allergenRequired" checked={formData.allergenRequired} onChange={handleInputChange} />
      <CheckboxField label="GMO Test Required" id="gmoRequired" checked={formData.gmoRequired} onChange={handleInputChange} />
      <CheckboxField label="SDS Available" id="sdsAvailable" checked={formData.sdsAvailable} onChange={handleInputChange} />
      <CheckboxField label="CoA Available" id="coaAvailable" checked={formData.coaAvailable} onChange={handleInputChange} />
    <TextareaField
     label="Regulatory Notes"
     id="regulatoryNotes"
     value={formData.regulatoryNotes}
     onChange={handleInputChange}
     placeholder="Any specific restrictions, region notes, or regulatory info"
    />
     </div>
    );

   case 5: // Quality Specifications
    return (
     <div className="space-y-4">
    <InputField
     label="Assay/Purity %"
     id="assayPurity"
     value={formData.assayPurity}
     onChange={handleInputChange}
     placeholder="e.g. NLT 98%"
    />
    <InputField
     label="Appearance Spec"
     id="appearanceSpec"
     value={formData.appearanceSpec}
     onChange={handleInputChange}
     placeholder="e.g. Clear, colourless liquid"
    />
    <InputField
     label="pH Range"
     id="phSpec"
     value={formData.phSpec}
     onChange={handleInputChange}
     placeholder="e.g. 5.0 – 7.0"
    />
    <InputField
     label="Moisture / LOD %"
     id="moistureLod"
     value={formData.moistureLod}
     onChange={handleInputChange}
     placeholder="e.g. NMT 2%"
    />
    <InputField
     label="Heavy Metals Spec"
     id="heavyMetalsSpec"
     value={formData.heavyMetalsSpec}
     onChange={handleInputChange}
     placeholder="e.g. Pb, As, Cd limits"
    />
    <InputField
     label="Microbial Spec"
     id="microbialSpec"
     value={formData.microbialSpec}
     onChange={handleInputChange}
     placeholder="e.g. TAMC / TYMC limits"
    />
    <InputField
     label="Odor & Color Spec"
     id="odorColorSpec"
     value={formData.odorColorSpec}
     onChange={handleInputChange}
     placeholder="e.g. Characteristic odour, pale yellow"
    />
    <TextareaField
     label="Other Specifications"
     id="otherSpecs"
     value={formData.otherSpecs}
     onChange={handleInputChange}
     placeholder="Any additional quality criteria"
    />
     </div>
    );

   case 6: // Usage in Formulation
    return (
     <div className="space-y-4">
    <InputField
     label="Recommended Use Level %"
     id="recommendedUseLevel"
     value={formData.recommendedUseLevel}
     onChange={handleInputChange}
     placeholder="e.g. 1.0 – 3.0"
    />
    <InputField
     label="Max Use Level %"
     id="maxUseLevel"
     value={formData.maxUseLevel}
     onChange={handleInputChange}
     placeholder="Absolute maximum allowed in formula"
    />
    <InputField
     label="Solubility (in what?)"
     id="solubility"
     value={formData.solubility}
     onChange={handleInputChange}
     placeholder="e.g. Soluble in oils / water / glycols"
    />
    <TextareaField
     label="Processing Guidance"
     id="processingGuidance"
     value={formData.processingGuidance}
     onChange={handleInputChange}
     placeholder="Order of addition, temperature, special handling"
    />
    <TextareaField
     label="Incompatibilities"
     id="incompatibilities"
     value={formData.incompatibilities}
     onChange={handleInputChange}
     placeholder="Actives, pH ranges, or other materials to avoid"
    />
    <TextareaField
     label="Stability Notes"
     id="stabilityNotes"
     value={formData.stabilityNotes}
     onChange={handleInputChange}
     placeholder="Known stability observations from vendor / internal data"
    />
    <TextareaField
     label="Claims Supported"
     id="claims"
     value={formData.claims}
     onChange={handleInputChange}
     placeholder="e.g. Moisturizing, anti-aging, anti-dandruff (with evidence)"
    />
     </div>
    );

   case 7: // Vendors & Commercial
    return (
     <ArrayItemManager
      masterType="rawMaterial"
      itemType="vendor"
      items={formData.vendors}
      tempFields={tempVendor}
      onTempFieldChange={(field, value) => setTempVendor(prev => ({ ...prev, [field]: value }))}
      onAdd={handleAddVendor}
      onRemove={(idx) => handleRemoveVendor(formData.vendors[idx].id)}
      errors={errors}
      itemLabel="Vendor"
      columns={[
       { key: 'name', label: 'Vendor Name' },
       { key: 'location', label: 'Location' },
       { key: 'moq', label: 'MOQ', type: 'number' },
       { key: 'unitPrice', label: 'Unit Price', type: 'number' },
       { key: 'leadTime', label: 'Lead Time (days)', type: 'number' },
       { key: 'approved', label: 'Approved' },
       { key: 'priceValidTill', label: 'Price Valid Till', type: 'date' },
      ]}
     />
    );

   case 8: // QA Testing & Documents
    return (
     <div className="space-y-8">
      <div>
       <h3 className="font-semibold text-gray-700 mb-4">QA Testing Results</h3>
       <ArrayItemManager
        masterType="rawMaterial"
        itemType="test"
        items={formData.tests}
        tempFields={tempTest}
        onTempFieldChange={(field, value) => setTempTest(prev => ({ ...prev, [field]: value }))}
        onAdd={handleAddTest}
        onRemove={(idx) => handleRemoveTest(formData.tests[idx].id)}
        errors={errors}
        itemLabel="Test"
        columns={[
         { key: 'name', label: 'Test Name' },
         { key: 'result', label: 'Result' },
         { key: 'date', label: 'Test Date', type: 'date' },
         { key: 'approvedBy', label: 'Approved By' },
         { key: 'remarks', label: 'Remarks' },
        ]}
       />
      </div>
      <div>
       <h3 className="font-semibold text-gray-700 mb-4">QA Documents & Certificates</h3>
       <ArrayItemManager
        masterType="rawMaterial"
        itemType="document"
        items={formData.documents}
        tempFields={tempDocument}
        onTempFieldChange={(field, value) => setTempDocument(prev => ({ ...prev, [field]: value }))}
        onAdd={handleAddDocument}
        onRemove={(idx) => handleRemoveDocument(formData.documents[idx].id)}
        errors={errors}
        itemLabel="Document"
        columns={[
         { key: 'type', label: 'Document Type' },
         { key: 'link', label: 'Link / Path' },
         { key: 'date', label: 'Issue Date', type: 'date' },
        ]}
       />
      </div>
     </div>
    );

   case 9: // Inventory, Storage & WH
    return (
     <div className="space-y-4">
    <TextareaField
     label="Storage Conditions"
     id="storageConditions"
     value={formData.storageConditions}
     onChange={handleInputChange}
     placeholder="e.g. Store below 25°C, protect from light"
    />
    <InputField
     label="Shelf Life"
     id="shelfLife"
     value={formData.shelfLife}
     onChange={handleInputChange}
     placeholder="e.g. 24 months from DOM"
    />
    <InputField
     label="Re-test Period"
     id="retestPeriod"
     value={formData.retestPeriod}
     onChange={handleInputChange}
     placeholder="e.g. 12 months"
    />
    <InputField
     label="Warehouse Location"
     id="warehouseLocation"
     value={formData.warehouseLocation}
     onChange={handleInputChange}
     placeholder="Default bin / rack / zone"
    />
    <InputField
     label="Batch Tracking Required"
     id="batchTracking"
     value={formData.batchTracking}
     onChange={handleInputChange}
     placeholder="e.g. Batch-wise, Lot-wise, Not required"
    />
    <InputField
     label="FIFO / FEFO"
     id="fifoFefo"
     value={formData.fifoFefo}
     onChange={handleInputChange}
     placeholder="Policy used in WH (e.g. FIFO / FEFO)"
    />
    <InputField
     label="Minimum Stock"
     id="minimumStock"
     value={formData.minimumStock}
     onChange={handleInputChange}
     placeholder="Trigger level for planning / purchase"
    />
    <InputField
     label="Reorder Level"
     id="reorderLevel"
     value={formData.reorderLevel}
     onChange={handleInputChange}
     placeholder="When replenishment must be initiated"
    />
    <TextareaField
     label="Handling Notes"
     id="handlingNotes"
     value={formData.handlingNotes}
     onChange={handleInputChange}
     placeholder="Special handling instructions for stores / production"
    />
     </div>
    );

   case 10: // Review / JSON
    return (
     <div>
      <h3 className="font-semibold text-gray-700 mb-4">Complete Form Data (JSON)</h3>
      <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
       {JSON.stringify(formData, null, 2)}
      </pre>
     </div>
    );

   default:
    return <p>No content</p>;
  }
 };

 // If on dashboard tab, show dashboard instead of form
if (pageTab === 'dashboard') {
  return <RawMaterialDashboard refreshKey={dashboardRefreshKey} onSwitchToForm={() => setPageTab('form')} />;
}

 return (
  <MasterFormBase
   title="Raw Material Master Data"
   stages={stages}
   currentStage={currentStage}
   onStageChange={setCurrentStage}
   errors={errors}
   formData={formData}
   onInputChange={handleInputChange}
   primaryFields={getPrimaryFields('rawMaterial')}
   onFillMock={() => setFormData(RM_MOCK_FORM)}
   onSave={() => {
    localStorage.setItem('raw_material_draft_new', JSON.stringify(formData));
    addToast('success', 'Draft saved!');
   }}
   onSubmit={handleSubmit}
  >
   {renderStageContent()}
  </MasterFormBase>
 );
};

type RawMaterialDashboardProps = {
 refreshKey?: number;
 onSwitchToForm: () => void;
};

/** Palette of category badge styles; any category (including new ones from API) gets a stable style via hash. */
const CATEGORY_STYLE_PALETTE: { bg: string; text: string; border: string }[] = [
 { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
 { bg: 'bg-green-50',    text: 'text-green-700',    border: 'border-green-200' },
 { bg: 'bg-slate-100',   text: 'text-slate-600',    border: 'border-slate-200' },
 { bg: 'bg-orange-50',   text: 'text-orange-700',   border: 'border-orange-200' },
 { bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200' },
 { bg: 'bg-yellow-50',   text: 'text-yellow-700',   border: 'border-yellow-200' },
 { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200' },
 { bg: 'bg-pink-50',     text: 'text-pink-700',     border: 'border-pink-200' },
 { bg: 'bg-cyan-50',     text: 'text-cyan-700',     border: 'border-cyan-200' },
 { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200' },
 { bg: 'bg-indigo-50',   text: 'text-indigo-700',   border: 'border-indigo-200' },
 { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
 { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200' },
 { bg: 'bg-sky-50',      text: 'text-sky-700',     border: 'border-sky-200' },
 { bg: 'bg-gray-100',    text: 'text-gray-600',     border: 'border-gray-200' },
];

function getCategoryStyle(category: string): { bg: string; text: string; border: string } {
 if (!category) return CATEGORY_STYLE_PALETTE[CATEGORY_STYLE_PALETTE.length - 1];
 let hash = 0;
 for (let i = 0; i < category.length; i++) hash = ((hash << 5) - hash) + category.charCodeAt(i);
 const index = Math.abs(hash) % CATEGORY_STYLE_PALETTE.length;
 return CATEGORY_STYLE_PALETTE[index];
}

function formatPrice(n: number) {
 return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0 });
}

function GroupChip({ group }: { group: string }) {
 const isPrimary = group.startsWith('Primary');
 const isAlt     = group.startsWith('Alt');
 const dotColor  = isPrimary ? 'bg-blue-500' : isAlt ? 'bg-emerald-500' : 'bg-gray-400';
 const label     = group.replace(' +1','').replace(' +2','');
 const extra     = group.includes('+1') ? '+1' : group.includes('+2') ? '+2' : '';
 return (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
   <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
   {label}
   {extra && <span className="ml-0.5 px-1 py-0.5 text-[10px] font-semibold bg-gray-100 rounded">{extra}</span>}
  </span>
 );
}

const RawMaterialDashboard: React.FC<RawMaterialDashboardProps> = ({ refreshKey = 0, onSwitchToForm }) => {
 const [search, setSearch] = useState('');
 const [catFilter, setCatFilter] = useState('');
 const [sortAsc, setSortAsc] = useState(true);
 const [allRMs, setAllRMs] = useState<RawMaterialRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);

 const loadRawMaterials = useCallback(async () => {
  setLoading(true);
  setLoadError(null);
  try {
   const list = await fetchRawMaterialsList();
   setAllRMs(list);
  } catch (e) {
   setLoadError(e instanceof Error ? e.message : 'Failed to load raw materials');
   setAllRMs([]);
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => {
  loadRawMaterials();
 }, [loadRawMaterials, refreshKey]);

 const allCategories = Array.from(new Set(allRMs.map(r => r.category))).filter(Boolean).sort();

 const filtered = allRMs.filter(rm => {
  const q = search.toLowerCase();
  const matchQ = !q || rm.name.toLowerCase().includes(q) || rm.inci.toLowerCase().includes(q) || rm.code.toLowerCase().includes(q);
  const matchCat = !catFilter || rm.category === catFilter;
  return matchQ && matchCat;
 }).sort((a, b) => sortAsc ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code));

 const stats = {
  total:       allRMs.length,
  active:      allRMs.filter(r => r.status === 'Active').length,
  uvFilters:   allRMs.filter(r => r.category === 'UV FILTER').length,
  surfactants: allRMs.filter(r => r.category === 'SURFACTANT').length,
  categories:  new Set(allRMs.map(r => r.category)).size,
 };

 const statCards = [
  { label: 'TOTAL RMS',   value: stats.total,       sub: 'Unique raw materials',  accent: 'border-l-teal-500',   num: 'text-teal-600' },
  { label: 'ACTIVE',      value: stats.active,      sub: 'Approved status',        accent: 'border-l-orange-400', num: 'text-orange-500' },
  { label: 'UV FILTERS',  value: stats.uvFilters,   sub: 'Sunscreen actives',      accent: 'border-l-blue-500',   num: 'text-blue-600' },
  { label: 'SURFACTANTS', value: stats.surfactants, sub: 'Facewash actives',       accent: 'border-l-violet-500', num: 'text-violet-600' },
  { label: 'CATEGORIES',  value: stats.categories,  sub: 'Distinct types',         accent: 'border-l-rose-500',   num: 'text-rose-600' },
 ];

 return (
  <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
   <div className="px-6 md:px-10 py-8 space-y-6 max-w-400 mx-auto">

    {/* ── Page Header ── */}
    <div className="relative">
     <div className="absolute inset-0 bg-linear-to-r from-teal-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
     <div className="relative">
      <div className="inline-flex items-center gap-2 mb-3">
       <span className="text-3xl">🧪</span>
       <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">RM Masters</span>
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Raw Materials</h1>
      <p className="text-sm text-gray-600">Manage raw material masters, INCI details, pricing and item group assignments.</p>
     </div>
    </div>

    {/* ── Loading / Error ── */}
    {loading && (
     <div className="flex items-center justify-center py-12 text-gray-500">
      <span className="animate-pulse">Loading raw materials…</span>
     </div>
    )}
    {!loading && loadError && (
     <div className="py-8 text-center">
      <p className="text-red-600 mb-2">{loadError}</p>
      <button type="button" onClick={loadRawMaterials} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Retry</button>
     </div>
    )}

    {!loading && !loadError && (
     <>
    {/* ── Stat Cards ── */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
     {statCards.map(card => (
      <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
       <div className={`h-1 bg-linear-to-r from-teal-400 to-teal-600 ${card.accent}`} />
       <div className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
        <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
        <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
       </div>
      </div>
     ))}
    </div>

    {/* ── Table Card ── */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

     {/* toolbar */}
     <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
      <div className="flex items-center gap-2 min-w-0">
       <span className="text-sm font-semibold text-gray-900">Raw Material Masters</span>
       <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200/50">{filtered.length} / {allRMs.length}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
       {/* search */}
       <div className="relative group">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
        </svg>
        <input
         value={search}
         onChange={e => setSearch(e.target.value)}
         placeholder="Search name, INCI, code…"
         className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all w-52"
        />
       </div>
       {/* category filter */}
       <select
        value={catFilter}
        onChange={e => setCatFilter(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-3.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all hover:bg-gray-100"
       >
        <option value="">All Categories</option>
        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
       </select>
       {/* new RM button */}
       <button
        onClick={onSwitchToForm}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
       >
        <span className="text-base leading-none">+</span> New RM
       </button>
      </div>
     </div>

     {/* table */}
     <div className="overflow-x-auto">
      <table className="w-full text-xs">
       <thead>
        <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
         <th
          className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-gray-900 hover:bg-slate-100/50 transition-colors"
          onClick={() => setSortAsc(p => !p)}
         >
          CODE <span className="text-teal-500">{sortAsc ? '↑' : '↓'}</span>
         </th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Name / INCI</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Category</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Group</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Type</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">UOM</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Price/KG</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">GST</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">Shelf</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Status</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Products</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-50">
        {filtered.length === 0 ? (
         <tr>
          <td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">
           <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            No raw materials match your search.
           </div>
          </td>
         </tr>
        ) : filtered.map((rm, _idx) => {
         const catStyle = getCategoryStyle(rm.category);
         return (
          <tr key={rm.code} className="hover:bg-linear-to-r hover:from-teal-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
           {/* code */}
           <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-teal-700 whitespace-nowrap group-hover:text-teal-900">{rm.code}</td>
           {/* name / inci */}
           <td className="px-4 py-3.5 whitespace-nowrap">
            <p className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">{rm.name}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 italic">{rm.inci}</p>
           </td>
           {/* category badge */}
           <td className="px-4 py-3.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
             {rm.category}
            </span>
           </td>
           {/* group */}
           <td className="px-4 py-3.5">
            {rm.group ? <GroupChip group={rm.group} /> : <span className="text-gray-300 text-xs">—</span>}
           </td>
           {/* type */}
           <td className="px-4 py-3.5 text-gray-700 font-medium">{rm.rmType}</td>
           {/* uom */}
           <td className="px-4 py-3.5 text-gray-700 font-semibold">{rm.uom}</td>
           {/* price */}
           <td className="px-4 py-3.5 text-right font-bold text-amber-600 group-hover:text-amber-700">{formatPrice(rm.pricePerKg)}</td>
           {/* gst */}
           <td className="px-4 py-3.5 text-right text-gray-600 font-medium">{rm.gst}%</td>
           {/* shelf */}
           <td className="px-4 py-3.5 text-right text-gray-600">{rm.shelf}</td>
           {/* status */}
           <td className="px-4 py-3.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             {rm.status}
            </span>
           </td>
           {/* products */}
           <td className="px-4 py-3.5">
            <div className="flex flex-wrap gap-1">
             {rm.products.map(p => (
              <span key={p} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 group-hover:bg-teal-100 transition-colors">{p}</span>
             ))}
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    </div>

     </>
    )}

   </div>
  </div>
 );
};

// Helper components
const InputField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
 type?: string;
 placeholder?: string;
}> = ({ label, id, value, onChange, type = 'text', placeholder }) => (
 <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  <input
   type={type}
   id={id}
   value={value || ''}
   onChange={onChange}
   placeholder={placeholder}
   className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
 </div>
);

const SelectField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
 options: string[];
}> = ({ label, id, value, onChange, options }) => (
 <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  <select
   id={id}
   value={value || ''}
   onChange={onChange}
   className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
   <option value="">Select...</option>
   {options.map(opt => (
    <option key={opt} value={opt}>{opt}</option>
   ))}
  </select>
 </div>
);

const TextareaField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
 rows?: number;
 placeholder?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder }) => (
 <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  <textarea
   id={id}
   value={value || ''}
   onChange={onChange}
   rows={rows}
   placeholder={placeholder}
   className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
 </div>
);

const CheckboxField: React.FC<{
 label: string;
 id: string;
 checked: boolean;
 onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, checked, onChange }) => (
 <label className="flex items-center text-sm">
  <input
   type="checkbox"
   id={id}
   checked={checked}
   onChange={onChange}
   className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
  />
  <span className="ml-2 text-gray-700">{label}</span>
 </label>
);

export default RawMaterialRefactored;
