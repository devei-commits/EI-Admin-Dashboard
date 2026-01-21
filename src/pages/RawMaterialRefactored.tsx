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
  const [isSaving, setIsSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

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
    allergenRequired: '',
    gmoRequired: '',
    sdsAvailable: '',
    coaAvailable: '',
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

  // Auto-save draft
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.values(formData).some(v => Boolean(v))) {
        localStorage.setItem('raw_material_draft_new', JSON.stringify(formData));
        addToast('info', 'Raw Material draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, addToast]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('raw_material_draft_new');
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
        addToast('info', 'Raw Material draft loaded');
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, []);

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
            <InputField label="SKU" id="rmSku" value={formData.rmSku} onChange={handleInputChange} />
            <SelectField label="Tax Preference" id="rmTaxPreference" value={formData.rmTaxPreference} onChange={handleInputChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']} />
            <CheckboxField label="Returnable Item" id="rmReturnable" checked={formData.rmReturnable} onChange={handleInputChange} />
            <TextareaField label="Associate Items" id="rmAssociateItems" value={formData.rmAssociateItems} onChange={handleInputChange} />
          </div>
        );

      case 1: // QC Categorisation
        return (
          <div className="space-y-4">
            <InputField label="Category" id="rmCategory" value={formData.rmCategory} onChange={handleInputChange} />
            <InputField label="QC Inspection Group" id="qcInspectionGroup" value={formData.qcInspectionGroup} onChange={handleInputChange} />
            <InputField label="Sub Category" id="subCategory" value={formData.subCategory} onChange={handleInputChange} />
            <InputField label="Hazard Handling Class" id="hazardHandlingClass" value={formData.hazardHandlingClass} onChange={handleInputChange} />
            <InputField label="Series Prefix" id="seriesPrefix" value={formData.seriesPrefix} onChange={handleInputChange} />
          </div>
        );

      case 2: // Identity
        return (
          <div className="space-y-4">
            <InputField label="INCI Name" id="inciName" value={formData.inciName} onChange={handleInputChange} />
            <InputField label="Trade/Commercial Name" id="tradeCommercialName" value={formData.tradeCommercialName} onChange={handleInputChange} />
            <InputField label="Function/Role" id="functionRole" value={formData.functionRole} onChange={handleInputChange} />
            <InputField label="Type" id="rmType" value={formData.rmType} onChange={handleInputChange} />
            <InputField label="CAS Number" id="casNo" value={formData.casNo} onChange={handleInputChange} />
            <InputField label="EINECS Number" id="einecs" value={formData.einecs} onChange={handleInputChange} />
            <InputField label="Country of Origin" id="countryOfOrigin" value={formData.countryOfOrigin} onChange={handleInputChange} />
            <InputField label="Manufacturer" id="manufacturer" value={formData.manufacturer} onChange={handleInputChange} />
            <TextareaField label="Synonyms" id="synonyms" value={formData.synonyms} onChange={handleInputChange} />
            <TextareaField label="Internal Notes" id="internalNotes" value={formData.internalNotes} onChange={handleInputChange} />
          </div>
        );

      case 3: // Units, Tax & Procurement
        return (
          <div className="space-y-4">
            <InputField label="Primary UoM" id="primaryUom" value={formData.primaryUom} onChange={handleInputChange} />
            <InputField label="Issue UoM" id="issueUom" value={formData.issueUom} onChange={handleInputChange} />
            <InputField label="Conversion Factor" id="conversionFactor" value={formData.conversionFactor} onChange={handleInputChange} />
            <InputField label="Standard Pack Size" id="standardPackSize" value={formData.standardPackSize} onChange={handleInputChange} />
            <InputField label="HSN Code" id="hsnCode" value={formData.hsnCode} onChange={handleInputChange} />
            <InputField label="GST %" id="gst" value={formData.gst} onChange={handleInputChange} />
            <InputField label="Accounting Category" id="accountingCategory" value={formData.accountingCategory} onChange={handleInputChange} />
            <SelectField label="Preferred Currency" id="preferredCurrency" value={formData.preferredCurrency} onChange={handleInputChange}
              options={['INR', 'USD', 'EUR', 'GBP']} />
          </div>
        );

      case 4: // Technical & Regulatory
        return (
          <div className="space-y-4">
            <InputField label="Grade" id="grade" value={formData.grade} onChange={handleInputChange} />
            <InputField label="Compliance/Certificate" id="compliance" value={formData.compliance} onChange={handleInputChange} />
            <CheckboxField label="Allergen Declaration Required" id="allergenRequired" checked={formData.allergenRequired === 'true'} onChange={handleInputChange} />
            <CheckboxField label="GMO Test Required" id="gmoRequired" checked={formData.gmoRequired === 'true'} onChange={handleInputChange} />
            <CheckboxField label="SDS Available" id="sdsAvailable" checked={formData.sdsAvailable === 'true'} onChange={handleInputChange} />
            <CheckboxField label="CoA Available" id="coaAvailable" checked={formData.coaAvailable === 'true'} onChange={handleInputChange} />
            <TextareaField label="Regulatory Notes" id="regulatoryNotes" value={formData.regulatoryNotes} onChange={handleInputChange} />
          </div>
        );

      case 5: // Quality Specifications
        return (
          <div className="space-y-4">
            <InputField label="Assay/Purity %" id="assayPurity" value={formData.assayPurity} onChange={handleInputChange} />
            <InputField label="Appearance Spec" id="appearanceSpec" value={formData.appearanceSpec} onChange={handleInputChange} />
            <InputField label="pH Range" id="phSpec" value={formData.phSpec} onChange={handleInputChange} />
            <InputField label="Moisture / LOD %" id="moistureLod" value={formData.moistureLod} onChange={handleInputChange} />
            <InputField label="Heavy Metals Spec" id="heavyMetalsSpec" value={formData.heavyMetalsSpec} onChange={handleInputChange} />
            <InputField label="Microbial Spec" id="microbialSpec" value={formData.microbialSpec} onChange={handleInputChange} />
            <InputField label="Odor & Color Spec" id="odorColorSpec" value={formData.odorColorSpec} onChange={handleInputChange} />
            <TextareaField label="Other Specifications" id="otherSpecs" value={formData.otherSpecs} onChange={handleInputChange} />
          </div>
        );

      case 6: // Usage in Formulation
        return (
          <div className="space-y-4">
            <InputField label="Recommended Use Level %" id="recommendedUseLevel" value={formData.recommendedUseLevel} onChange={handleInputChange} />
            <InputField label="Max Use Level %" id="maxUseLevel" value={formData.maxUseLevel} onChange={handleInputChange} />
            <InputField label="Solubility (in what?)" id="solubility" value={formData.solubility} onChange={handleInputChange} />
            <TextareaField label="Processing Guidance" id="processingGuidance" value={formData.processingGuidance} onChange={handleInputChange} />
            <TextareaField label="Incompatibilities" id="incompatibilities" value={formData.incompatibilities} onChange={handleInputChange} />
            <TextareaField label="Stability Notes" id="stabilityNotes" value={formData.stabilityNotes} onChange={handleInputChange} />
            <TextareaField label="Claims Supported" id="claims" value={formData.claims} onChange={handleInputChange} />
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
            <TextareaField label="Storage Conditions" id="storageConditions" value={formData.storageConditions} onChange={handleInputChange} />
            <InputField label="Shelf Life" id="shelfLife" value={formData.shelfLife} onChange={handleInputChange} />
            <InputField label="Re-test Period" id="retestPeriod" value={formData.retestPeriod} onChange={handleInputChange} />
            <InputField label="Warehouse Location" id="warehouseLocation" value={formData.warehouseLocation} onChange={handleInputChange} />
            <InputField label="Batch Tracking Required" id="batchTracking" value={formData.batchTracking} onChange={handleInputChange} />
            <InputField label="FIFO / FEFO" id="fifoFefo" value={formData.fifoFefo} onChange={handleInputChange} />
            <InputField label="Minimum Stock" id="minimumStock" value={formData.minimumStock} onChange={handleInputChange} />
            <InputField label="Reorder Level" id="reorderLevel" value={formData.reorderLevel} onChange={handleInputChange} />
            <TextareaField label="Handling Notes" id="handlingNotes" value={formData.handlingNotes} onChange={handleInputChange} />
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

  return (
    <MasterFormBase
      title="Raw Material Master Data (Refactored)"
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
}> = ({ label, id, value, onChange, rows = 3 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea
      id={id}
      value={value || ''}
      onChange={onChange}
      rows={rows}
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
