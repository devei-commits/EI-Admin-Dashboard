import React, { useState, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { getPrimaryFields, validatePrimaryFields } from '../utils/masterFormUtils';

const RawMaterialRefactored: React.FC = () => {
 const { addItem } = useItems();
 const { addToast } = useToast();
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [currentStage, setCurrentStage] = useState(0);
 const [pageTab, setPageTab] = useState<'dashboard' | 'form'>('dashboard');

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

// Auto-save draft (silent)
useEffect(() => {
 const timer = setInterval(() => {
  if (Object.values(formData).some(v => Boolean(v))) {
   localStorage.setItem('raw_material_draft_new', JSON.stringify(formData));
  }
 }, 30000);
 return () => clearInterval(timer);
}, [formData]);

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

 const handleSubmit = () => {
  const validation = validatePrimaryFields(formData, 'rawMaterial');
  if (!validation.valid) {
   setErrors(validation.errors);
   addToast('error', 'Please fill all primary fields');
   return;
  }

  const newItem = {
   id: Date.now().toString(),
   type: 'raw-material' as const,
   name: formData.inciName || 'Unnamed Raw Material',
   code: formData.rmSku || 'RM-' + Date.now().toString().slice(-6),
   createdAt: new Date().toISOString(),
   lastModified: new Date().toISOString(),
   data: formData,
  };
  addItem(newItem);
  addToast('success', 'Raw Material saved successfully!');
  localStorage.removeItem('raw_material_draft_new');
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
  return <RawMaterialDashboard onSwitchToForm={() => setPageTab('form')} />;
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
 onSwitchToForm: () => void;
};

const RawMaterialDashboard: React.FC<RawMaterialDashboardProps> = ({ onSwitchToForm }) => {
 const { items, updateItem, deleteItem } = useItems();
 const safeItems = Array.isArray(items) ? (items as any[]) : [];
 const rawMaterials = safeItems.filter(i => i.type === 'raw-material');
 const [viewItem, setViewItem] = useState<any | null>(null);
 const [editItem, setEditItem] = useState<any | null>(null);
 const [openRowId, setOpenRowId] = useState<string | null>(null);
 const [editData, setEditData] = useState({
  name: '',
  code: '',
  unit: '',
  status: '',
  mappedItems: [] as Array<{ name: string; sku: string; quantity: string }>,
 });

 const openEdit = (item: any) => {
  const data = item?.data || {};
  setEditItem(item);
  setEditData({
   name: data.compositeItemName || item.name || '',
   code: data.sku || item.code || '',
   unit: data.unit || '',
   status: data.status || '',
   mappedItems: Array.isArray(data.mappedItems)
    ? data.mappedItems.map((mi: any) => ({
      name: String(mi?.name || ''),
      sku: String(mi?.sku || ''),
      quantity: String(mi?.quantity || ''),
     }))
    : [],
  });
 };

 const handleDelete = (item: any) => {
  if (!item) return;
  const ok = window.confirm('Delete this raw material entry?');
  if (!ok) return;
  deleteItem(item.id);
  if (viewItem?.id === item.id) setViewItem(null);
  if (editItem?.id === item.id) setEditItem(null);
 };

 const handleEditMappedItem = (idx: number, field: 'name' | 'sku' | 'quantity', value: string) => {
  setEditData((prev) => ({
   ...prev,
   mappedItems: prev.mappedItems.map((mi, i) => (i === idx ? { ...mi, [field]: value } : mi)),
  }));
 };

 const handleAddMappedItem = () => {
  setEditData((prev) => ({
   ...prev,
   mappedItems: [...prev.mappedItems, { name: '', sku: '', quantity: '' }],
  }));
 };

 const handleRemoveMappedItem = (idx: number) => {
  setEditData((prev) => ({
   ...prev,
   mappedItems: prev.mappedItems.filter((_, i) => i !== idx),
  }));
 };

 const handleSaveEdit = () => {
  if (!editItem) return;
  const updated = {
   ...editItem,
   name: editData.name || editItem.name,
   code: editData.code || editItem.code,
   lastModified: new Date().toISOString(),
   data: {
    ...(editItem.data || {}),
    compositeItemName: editData.name || editItem.name || '-',
    sku: editData.code || editItem.code || '-',
    unit: editData.unit || '-',
    status: editData.status || '-',
    mappedItems: editData.mappedItems.length
     ? editData.mappedItems.map((mi) => ({
       name: mi.name || '-',
       sku: mi.sku || '-',
       quantity: mi.quantity || '-',
      }))
     : [{ name: '-', sku: '-', quantity: '-' }],
   },
  };
  updateItem(editItem.id, updated);
  setEditItem(null);
 };

 const stats = {
  total: rawMaterials.length,
  withSds: rawMaterials.filter(i => i.data?.sdsAvailable).length,
  withCoa: rawMaterials.filter(i => i.data?.coaAvailable).length,
  withVendors: rawMaterials.filter(i => (i.data?.vendors || []).length > 0).length,
 };

 return (
  <div className="min-h-screen bg-gray-50/50">
   <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between gap-3 flex-wrap">
     <div className="min-w-0">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Raw Material Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">
       Track raw material masters, vendors, and QA docs.
      </p>
     </div>
     <div className="flex items-center gap-2">
      <button
       onClick={onSwitchToForm}
       className="inline-flex items-center gap-2 rounded-lg bg-black text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
      >
       <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-900 text-base leading-none">
        +
       </span>
       <span>New Raw Material Master</span>
      </button>
     </div>
    </div>

    {/* KPI strip */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
     <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">Total Raw Materials</p>
      <p className="text-3xl font-bold mt-1 text-gray-900">{stats.total}</p>
     </div>
     <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-4">
      <p className="text-xs text-blue-700 uppercase tracking-wide">With SDS</p>
      <p className="text-3xl font-bold mt-1 text-blue-800">{stats.withSds}</p>
     </div>
     <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-100 p-4">
      <p className="text-xs text-emerald-700 uppercase tracking-wide">With CoA</p>
      <p className="text-3xl font-bold mt-1 text-emerald-800">{stats.withCoa}</p>
     </div>
     <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-100 p-4">
      <p className="text-xs text-amber-700 uppercase tracking-wide">With Vendors</p>
      <p className="text-3xl font-bold mt-1 text-amber-800">{stats.withVendors}</p>
     </div>
    </div>

    {/* Table or empty state */}
    {rawMaterials.length === 0 ? (
     <div className="bg-white rounded-lg border border-dashed border-gray-300 p-10 text-center">
      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 7h16M4 7l2-3h12l2 3M4 7v11a2 2 0 002 2h12a2 2 0 002-2V7"
       />
      </svg>
      <p className="font-semibold text-gray-700 text-lg">No raw materials yet</p>
      <p className="text-sm text-gray-400 mt-1 mb-4">
       Use <span className="font-medium">New Raw Material Master</span> to onboard your first RM.
      </p>
     </div>
    ) : (
     <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
      <table className="w-full text-sm">
       <thead>
        <tr className="bg-gray-900">
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>Item Code</th>
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>Item Name</th>
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>Category</th>
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>Specification</th>
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>UOM</th>
         <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}>Default Vendors</th>
         <th className="px-6 py-4 text-right font-semibold uppercase text-xs tracking-wider" style={{ color: 'white' }}></th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-200">
        {rawMaterials.map((rm: any) => {
         const data = rm.data || {};
         const mappedItems = Array.isArray(data.mappedItems) ? data.mappedItems : [];
         const itemCode = data.sku || rm.code || '-';
         const itemName = data.compositeItemName || rm.name || data.tradeCommercialName || data.inciName || '-';
         const category = data.rmCategory || data['CF.ITEM CATEGORY'] || data.itemCategory || '-';
         const categoryBadge = category && category !== '-' ? String(category).charAt(0).toUpperCase() : '-';
         const specification = mappedItems.length > 0
          ? mappedItems
           .map((mi: any) => `${mi.name || '-'}${mi.quantity ? ` (${mi.quantity})` : ''}`)
           .join(', ')
          : '-';
         const uom = data.unit || data.primaryUom || data.issueUom || '-';
         const vendorNames = (data.vendors || []).map((v: any) => v.name).join(', ') || '-';
         
         return (
          <tr key={rm.id} className="hover:bg-gray-50/50 transition-colors">
           <td className="px-6 py-4 font-mono font-bold text-gray-900">{itemCode}</td>
           <td className="px-6 py-4 font-semibold text-gray-800">{itemName}</td>
           <td className="px-6 py-4" title={category}>
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gray-200 border border-gray-300 text-gray-600">
             {categoryBadge}
            </span>
           </td>
           <td className="px-6 py-4 text-gray-600 max-w-sm truncate" title={specification}>
            {specification}
           </td>
           <td className="px-6 py-4 font-medium text-gray-900">{uom}</td>
           <td className="px-6 py-4 text-gray-600">{vendorNames}</td>
           <td className="px-6 py-4 text-right overflow-visible">
            <div className="relative inline-block">
             <button
              type="button"
              onClick={() => setOpenRowId(openRowId === rm.id ? null : rm.id)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              aria-label="Row actions"
             >
              ...
             </button>
             {openRowId === rm.id && (
              <div
               className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20"
               onMouseLeave={() => setOpenRowId(null)}
              >
               <button
                type="button"
                onClick={() => {
                 setViewItem(rm);
                 setOpenRowId(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
               >
                View
               </button>
               <button
                type="button"
                onClick={() => {
                 openEdit(rm);
                 setOpenRowId(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
               >
                Edit
               </button>
               <button
                type="button"
                onClick={() => {
                 handleDelete(rm);
                 setOpenRowId(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
               >
                Delete
               </button>
              </div>
             )}
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    )}
    {viewItem && (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg border border-gray-200 overflow-hidden">
       <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
      <h3 className="text-base font-semibold text-gray-800">Raw Material Details</h3>
      <button
       type="button"
       onClick={() => setViewItem(null)}
       className="text-sm text-gray-500 hover:text-gray-700"
      >
       Close
      </button>
       </div>
       <div className="p-5 space-y-4 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <div>
        <p className="text-xs text-gray-500">Composite Item</p>
        <p className="font-medium text-gray-800">{viewItem?.data?.compositeItemName || viewItem?.name || '-'}</p>
       </div>
       <div>
        <p className="text-xs text-gray-500">SKU</p>
        <p className="font-medium text-gray-800">{viewItem?.data?.sku || viewItem?.code || '-'}</p>
       </div>
       <div>
        <p className="text-xs text-gray-500">Unit</p>
        <p className="font-medium text-gray-800">{viewItem?.data?.unit || '-'}</p>
       </div>
       <div>
        <p className="text-xs text-gray-500">Status</p>
        <p className="font-medium text-gray-800">{viewItem?.data?.status || '-'}</p>
       </div>
      </div>
      <div>
       <p className="text-xs text-gray-500 mb-2">Mapped Items</p>
       <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
         <thead className="bg-gray-50">
        <tr>
         <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
         <th className="px-3 py-2 text-left font-semibold text-gray-600">SKU</th>
         <th className="px-3 py-2 text-left font-semibold text-gray-600">Quantity</th>
        </tr>
         </thead>
         <tbody>
        {(viewItem?.data?.mappedItems || []).length > 0 ? (
         viewItem.data.mappedItems.map((mi: any, idx: number) => (
          <tr key={`${viewItem.id}-view-${idx}`} className="border-t border-gray-200">
           <td className="px-3 py-2">{mi.name || '-'}</td>
           <td className="px-3 py-2">{mi.sku || '-'}</td>
           <td className="px-3 py-2">{mi.quantity || '-'}</td>
          </tr>
         ))
        ) : (
         <tr>
          <td className="px-3 py-3 text-gray-400" colSpan={3}>-</td>
         </tr>
        )}
         </tbody>
        </table>
       </div>
      </div>
       </div>
      </div>
     </div>
    )}
    {editItem && (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-lg border border-gray-200 overflow-hidden">
       <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
      <h3 className="text-base font-semibold text-gray-800">Edit Raw Material</h3>
      <button
       type="button"
       onClick={() => setEditItem(null)}
       className="text-sm text-gray-500 hover:text-gray-700"
      >
       Close
      </button>
       </div>
       <div className="p-5 space-y-5 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Composite Item Name</label>
        <input
         value={editData.name}
         onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
         className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
       </div>
       <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">SKU</label>
        <input
         value={editData.code}
         onChange={(e) => setEditData((prev) => ({ ...prev, code: e.target.value }))}
         className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
       </div>
       <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
        <input
         value={editData.unit}
         onChange={(e) => setEditData((prev) => ({ ...prev, unit: e.target.value }))}
         className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
       </div>
       <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
        <input
         value={editData.status}
         onChange={(e) => setEditData((prev) => ({ ...prev, status: e.target.value }))}
         className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
       </div>
      </div>
      <div>
       <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700">Mapped Items</p>
        <button
         type="button"
         onClick={handleAddMappedItem}
         className="px-3 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
         + Add
        </button>
       </div>
       <div className="space-y-2">
        {editData.mappedItems.length > 0 ? (
         editData.mappedItems.map((mi, idx) => (
        <div key={`edit-mi-${idx}`} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
         <input
          value={mi.name}
          onChange={(e) => handleEditMappedItem(idx, 'name', e.target.value)}
          placeholder="Name"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
         />
         <input
          value={mi.sku}
          onChange={(e) => handleEditMappedItem(idx, 'sku', e.target.value)}
          placeholder="SKU"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
         />
         <input
          value={mi.quantity}
          onChange={(e) => handleEditMappedItem(idx, 'quantity', e.target.value)}
          placeholder="Quantity"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
         />
         <button
          type="button"
          onClick={() => handleRemoveMappedItem(idx)}
          className="px-3 py-2 text-xs border border-red-200 rounded-md text-red-600 hover:bg-red-50"
         >
          Remove
         </button>
        </div>
         ))
        ) : (
         <div className="text-xs text-gray-400">No mapped items.</div>
        )}
       </div>
      </div>
      <div className="flex items-center justify-end gap-2">
       <button
        type="button"
        onClick={() => setEditItem(null)}
        className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
       >
        Cancel
       </button>
       <button
        type="button"
        onClick={handleSaveEdit}
        className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800"
       >
        Save
       </button>
      </div>
       </div>
      </div>
     </div>
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
