import React, { useState, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { 
  addToArray, 
  removeFromArray, 
  getPrimaryFields,
  validatePrimaryFields 
} from '../utils/masterFormUtils';

const PackagingRefactored: React.FC = () => {
  const { addItem } = useItems();
  const { addToast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  // Simplified primary data - no temp fields mixed in
  const [formData, setFormData] = useState({
    // Meta
    itemCode: '',
    status: 'Draft',
    version: 'v1.0',

    // Primary Info
    pkgSku: '',
    pkgUnit: 'PCS',
    pkgHsn: '',
    pkgTaxPreference: 'Taxable',
    pkgReturnable: false,
    pkgAssociateItems: '',

    // Categorisation
    pmCategory: '',
    qcGroup: '',
    subCategory: '',
    hazardClass: '',
    storeLoc: '',

    // Identity
    name: '',
    level: '',
    category: '',
    intendedUse: '',
    expectedProductTypes: '',
    reusability: '',
    regulatory: '',
    identityNotes: '',

    // Material & Specs
    matBody: '',
    matClosure: '',
    matInner: '',
    matRecycle: false,
    matBpa: false,
    matGrade: '',
    specNominal: '',
    specBrimful: '',
    specHeight: '',
    specDia: '',
    specNeck: '',
    specWeight: '',
    specWall: '',
    specLink: '',

    // Aesthetics
    colorType: '',
    colorCode: '',
    finish: '',
    deco: '',
    images: '',

    // Customization
    cusCustomizable: false,
    cusParams: '',
    cusStdMoq: '',
    cusCustomMoq: '',
    cusToolingReq: '',
    cusToolingCost: '',
    cusSamplingLT: '',
    cusBulkLTStd: '',
    cusBulkLTCustom: '',
    cusRemarks: '',

    // Compatibility
    compLow: false,
    compMed: false,
    compHigh: false,
    compOil: false,
    compAlc: false,
    compAirless: false,
    compPump: false,
    compLeak: false,
    compActives: '',
    compRisk: '',
    compRemarks: '',

    // Secondary Packaging
    secLabelType: '',
    secLabelSize: '',
    secAdhesive: '',
    secLabelCompat: '',
    secGsm: '',
    secCartonFinish: '',
    secFit: '',
    secArtLink: '',
    secNotes: '',

    // Tertiary Packaging
    terShipType: '',
    terUnits: '',
    terDrop: '',
    terStack: '',
    terNotes: '',

    // Approval flags
    apprPack: false,
    apprRd: false,
    apprFin: false,
    apprLock: false,

    // Catalogue
    catVisible: false,
    catShare: false,
    catWebName: '',
    catTags: '',
    catRecoTypes: '',
    catWebImages: '',

    // ARRAYS (no temp fields!)
    variants: [] as Array<{
      id: string;
      volume: number;
      sameMold: string;
      moq: number;
      status: string;
    }>,

    vendors: [] as Array<{
      name: string;
      location: string;
      moq: number;
      price: number;
      leadTime: number;
      approved: string;
      priceType: string;
      validTill: string;
      sampleCost: number;
    }>,

    tests: [] as Array<{
      name: string;
      result: string;
      date: string;
      by: string;
      remarks: string;
    }>,
  });

  // TEMP FIELDS - separated from main data (cleaner separation of concerns!)
  const [tempVariant, setTempVariant] = useState({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
  const [tempVendor, setTempVendor] = useState({ name: '', location: '', moq: '', price: '', leadTime: '', approved: '', priceType: '', validTill: '', sampleCost: '' });
  const [tempTest, setTempTest] = useState({ name: '', result: '', date: '', by: '', remarks: '' });

  // Auto-save draft
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.values(formData).some(v => Boolean(v))) {
        localStorage.setItem('packaging_draft_new', JSON.stringify(formData));
        addToast('info', 'Packaging draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, addToast]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('packaging_draft_new');
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
        addToast('info', 'Packaging draft loaded');
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, []);

  const stages = [
    'Primary Info',
    'Categorisation',
    'Identity',
    'Material & Specs',
    'Aesthetics',
    'Variants',
    'Customization',
    'Compatibility',
    'Vendors',
    'Secondary Packaging',
    'Tertiary Packaging',
    'Testing & Approval',
    'Catalogue',
    'Review / JSON',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // Variant operations
  const handleAddVariant = () => {
    if (!tempVariant.volume || Number(tempVariant.volume) <= 0) {
      setErrors(prev => ({ ...prev, varVolume: 'Fill volume is required' }));
      addToast('error', 'Fill volume is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: tempVariant.id || `V${prev.variants.length + 1}`,
        volume: Number(tempVariant.volume),
        sameMold: tempVariant.sameMold,
        moq: Number(tempVariant.moq),
        status: tempVariant.status,
      }]
    }));
    setTempVariant({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
    setErrors(prev => ({ ...prev, varVolume: '' }));
  };

  const handleRemoveVariant = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx)
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
        name: tempVendor.name,
        location: tempVendor.location,
        moq: Number(tempVendor.moq),
        price: Number(tempVendor.price),
        leadTime: Number(tempVendor.leadTime),
        approved: tempVendor.approved,
        priceType: tempVendor.priceType,
        validTill: tempVendor.validTill,
        sampleCost: Number(tempVendor.sampleCost),
      }]
    }));
    setTempVendor({ name: '', location: '', moq: '', price: '', leadTime: '', approved: '', priceType: '', validTill: '', sampleCost: '' });
    setErrors(prev => ({ ...prev, venName: '' }));
  };

  const handleRemoveVendor = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      vendors: prev.vendors.filter((_, i) => i !== idx)
    }));
  };

  // Test operations
  const handleAddTest = () => {
    if (!tempTest.name || !tempTest.result) {
      setErrors(prev => ({ ...prev, testName: 'Select test + result' }));
      addToast('error', 'Select test + result');
      return;
    }
    setFormData(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: tempTest.name,
        result: tempTest.result,
        date: tempTest.date,
        by: tempTest.by,
        remarks: tempTest.remarks,
      }]
    }));
    setTempTest({ name: '', result: '', date: '', by: '', remarks: '' });
    setErrors(prev => ({ ...prev, testName: '' }));
  };

  const handleRemoveTest = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      tests: prev.tests.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = () => {
    const validation = validatePrimaryFields(formData, 'packaging');
    if (!validation.valid) {
      setErrors(validation.errors);
      addToast('error', 'Please fill all primary fields');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      type: 'packaging' as const,
      name: formData.name || 'Unnamed Packaging',
      code: formData.itemCode || 'PKG-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      data: formData,
    };
    addItem(newItem);
    addToast('success', 'Packaging saved successfully!');
    localStorage.removeItem('packaging_draft_new');
  };

  // Stage content rendering
  const renderStageContent = () => {
    switch (currentStage) {
      case 0: // Primary Info
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Item Code *" id="itemCode" value={formData.itemCode} onChange={handleInputChange} />
              <InputField label="SKU / Internal Code" id="pkgSku" value={formData.pkgSku} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Unit of Measure *" id="pkgUnit" value={formData.pkgUnit} onChange={handleInputChange} 
                options={['PCS', 'GM', 'ML', 'L', 'KG']} />
              <InputField label="HSN Code" id="pkgHsn" value={formData.pkgHsn} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Tax Preference" id="pkgTaxPreference" value={formData.pkgTaxPreference} onChange={handleInputChange}
                options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']} />
              <CheckboxField label="Returnable Item" id="pkgReturnable" checked={formData.pkgReturnable} onChange={handleInputChange} />
            </div>
            <TextareaField label="Associate Items" id="pkgAssociateItems" value={formData.pkgAssociateItems} onChange={handleInputChange} />
          </div>
        );

      case 1: // Categorisation
        return (
          <div className="space-y-4">
            <InputField label="PM Category" id="pmCategory" value={formData.pmCategory} onChange={handleInputChange} />
            <InputField label="QC Group" id="qcGroup" value={formData.qcGroup} onChange={handleInputChange} />
            <InputField label="Sub Category" id="subCategory" value={formData.subCategory} onChange={handleInputChange} />
            <InputField label="Hazard Class" id="hazardClass" value={formData.hazardClass} onChange={handleInputChange} />
            <InputField label="Storage Location" id="storeLoc" value={formData.storeLoc} onChange={handleInputChange} />
          </div>
        );

      case 2: // Identity
        return (
          <div className="space-y-4">
            <InputField label="Name" id="name" value={formData.name} onChange={handleInputChange} />
            <InputField label="Level" id="level" value={formData.level} onChange={handleInputChange} />
            <InputField label="Category" id="category" value={formData.category} onChange={handleInputChange} />
            <InputField label="Intended Use" id="intendedUse" value={formData.intendedUse} onChange={handleInputChange} />
            <InputField label="Expected Product Types" id="expectedProductTypes" value={formData.expectedProductTypes} onChange={handleInputChange} />
            <InputField label="Reusability" id="reusability" value={formData.reusability} onChange={handleInputChange} />
            <TextareaField label="Regulatory Notes" id="regulatory" value={formData.regulatory} onChange={handleInputChange} />
            <TextareaField label="Identity Notes" id="identityNotes" value={formData.identityNotes} onChange={handleInputChange} />
          </div>
        );

      case 3: // Material & Specs
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Material</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Body Material" id="matBody" value={formData.matBody} onChange={handleInputChange} />
              <InputField label="Closure Material" id="matClosure" value={formData.matClosure} onChange={handleInputChange} />
              <InputField label="Inner Material" id="matInner" value={formData.matInner} onChange={handleInputChange} />
              <InputField label="Grade" id="matGrade" value={formData.matGrade} onChange={handleInputChange} />
            </div>
            <CheckboxField label="Recyclable" id="matRecycle" checked={formData.matRecycle} onChange={handleInputChange} />
            <CheckboxField label="BPA Free" id="matBpa" checked={formData.matBpa} onChange={handleInputChange} />
            
            <h3 className="font-semibold text-gray-700 mt-6">Specifications</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Nominal Volume" id="specNominal" value={formData.specNominal} onChange={handleInputChange} />
              <InputField label="Brimful Volume" id="specBrimful" value={formData.specBrimful} onChange={handleInputChange} />
              <InputField label="Height (mm)" id="specHeight" value={formData.specHeight} onChange={handleInputChange} />
              <InputField label="Diameter (mm)" id="specDia" value={formData.specDia} onChange={handleInputChange} />
              <InputField label="Neck (mm)" id="specNeck" value={formData.specNeck} onChange={handleInputChange} />
              <InputField label="Weight (g)" id="specWeight" value={formData.specWeight} onChange={handleInputChange} />
              <InputField label="Wall Thickness (mm)" id="specWall" value={formData.specWall} onChange={handleInputChange} />
            </div>
            <InputField label="Tech Link / Reference" id="specLink" value={formData.specLink} onChange={handleInputChange} />
          </div>
        );

      case 4: // Aesthetics
        return (
          <div className="space-y-4">
            <InputField label="Color Type" id="colorType" value={formData.colorType} onChange={handleInputChange} />
            <InputField label="Color Code" id="colorCode" value={formData.colorCode} onChange={handleInputChange} />
            <InputField label="Finish" id="finish" value={formData.finish} onChange={handleInputChange} />
            <InputField label="Decoration" id="deco" value={formData.deco} onChange={handleInputChange} />
            <TextareaField label="Images / References" id="images" value={formData.images} onChange={handleInputChange} />
          </div>
        );

      case 5: // Variants
        return (
          <ArrayItemManager
            masterType="packaging"
            itemType="variant"
            items={formData.variants}
            tempFields={tempVariant}
            onTempFieldChange={(field, value) => setTempVariant(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddVariant}
            onRemove={handleRemoveVariant}
            errors={errors}
            itemLabel="Variant"
            columns={[
              { key: 'id', label: 'Variant ID' },
              { key: 'volume', label: 'Volume (ml)', type: 'number' },
              { key: 'sameMold', label: 'Same Mold' },
              { key: 'moq', label: 'MOQ', type: 'number' },
              { key: 'status', label: 'Status' },
            ]}
          />
        );

      case 6: // Customization
        return (
          <div className="space-y-4">
            <InputField label="Customizable" id="cusCustomizable" value={formData.cusCustomizable} onChange={handleInputChange} />
            <TextareaField label="Customization Parameters" id="cusParams" value={formData.cusParams} onChange={handleInputChange} />
            <InputField label="Standard MOQ" id="cusStdMoq" value={formData.cusStdMoq} onChange={handleInputChange} />
            <InputField label="Custom MOQ" id="cusCustomMoq" value={formData.cusCustomMoq} onChange={handleInputChange} />
            <InputField label="Tooling Required" id="cusToolingReq" value={formData.cusToolingReq} onChange={handleInputChange} />
            <InputField label="Tooling Cost" id="cusToolingCost" value={formData.cusToolingCost} onChange={handleInputChange} />
            <InputField label="Sampling Lead Time" id="cusSamplingLT" value={formData.cusSamplingLT} onChange={handleInputChange} />
            <InputField label="Bulk Lead Time (Std)" id="cusBulkLTStd" value={formData.cusBulkLTStd} onChange={handleInputChange} />
            <InputField label="Bulk Lead Time (Custom)" id="cusBulkLTCustom" value={formData.cusBulkLTCustom} onChange={handleInputChange} />
            <TextareaField label="Customization Remarks" id="cusRemarks" value={formData.cusRemarks} onChange={handleInputChange} />
          </div>
        );

      case 7: // Compatibility
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Viscosity Compatibility</h3>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Low" id="compLow" value={formData.compLow} onChange={handleInputChange} />
              <InputField label="Medium" id="compMed" value={formData.compMed} onChange={handleInputChange} />
              <InputField label="High" id="compHigh" value={formData.compHigh} onChange={handleInputChange} />
            </div>
            <h3 className="font-semibold mt-4">Chemical Compatibility</h3>
            <div className="grid grid-cols-3 gap-4">
              <CheckboxField label="Oil Compatible" id="compOil" checked={formData.compOil} onChange={handleInputChange} />
              <CheckboxField label="Alcohol Compatible" id="compAlc" checked={formData.compAlc} onChange={handleInputChange} />
              <CheckboxField label="Airless Compatible" id="compAirless" checked={formData.compAirless} onChange={handleInputChange} />
            </div>
            <h3 className="font-semibold mt-4">Functional Compatibility</h3>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Pump Compatible" id="compPump" checked={formData.compPump} onChange={handleInputChange} />
              <CheckboxField label="Leak Proof" id="compLeak" checked={formData.compLeak} onChange={handleInputChange} />
              <InputField label="Actives Compatible" id="compActives" value={formData.compActives} onChange={handleInputChange} />
              <InputField label="Risk Level" id="compRisk" value={formData.compRisk} onChange={handleInputChange} />
            </div>
            <TextareaField label="Compatibility Remarks" id="compRemarks" value={formData.compRemarks} onChange={handleInputChange} />
          </div>
        );

      case 8: // Vendors
        return (
          <ArrayItemManager
            masterType="packaging"
            itemType="vendor"
            items={formData.vendors}
            tempFields={tempVendor}
            onTempFieldChange={(field, value) => setTempVendor(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddVendor}
            onRemove={handleRemoveVendor}
            errors={errors}
            itemLabel="Vendor"
            columns={[
              { key: 'name', label: 'Vendor Name' },
              { key: 'location', label: 'Location' },
              { key: 'moq', label: 'MOQ', type: 'number' },
              { key: 'price', label: 'Unit Price', type: 'number' },
              { key: 'leadTime', label: 'Lead Time (days)', type: 'number' },
              { key: 'approved', label: 'Approved' },
              { key: 'priceType', label: 'Price Type' },
              { key: 'validTill', label: 'Valid Till', type: 'date' },
              { key: 'sampleCost', label: 'Sample Cost', type: 'number' },
            ]}
          />
        );

      case 9: // Secondary Packaging
        return (
          <div className="space-y-4">
            <InputField label="Label Type" id="secLabelType" value={formData.secLabelType} onChange={handleInputChange} />
            <InputField label="Label Size" id="secLabelSize" value={formData.secLabelSize} onChange={handleInputChange} />
            <InputField label="Adhesive Type" id="secAdhesive" value={formData.secAdhesive} onChange={handleInputChange} />
            <InputField label="Label Compatibility" id="secLabelCompat" value={formData.secLabelCompat} onChange={handleInputChange} />
            <InputField label="Paper GSM" id="secGsm" value={formData.secGsm} onChange={handleInputChange} />
            <InputField label="Carton Finish" id="secCartonFinish" value={formData.secCartonFinish} onChange={handleInputChange} />
            <InputField label="Fit & Finish" id="secFit" value={formData.secFit} onChange={handleInputChange} />
            <InputField label="Art Link" id="secArtLink" value={formData.secArtLink} onChange={handleInputChange} />
            <TextareaField label="Secondary Packaging Notes" id="secNotes" value={formData.secNotes} onChange={handleInputChange} />
          </div>
        );

      case 10: // Tertiary Packaging
        return (
          <div className="space-y-4">
            <InputField label="Shipper Type" id="terShipType" value={formData.terShipType} onChange={handleInputChange} />
            <InputField label="Units per Shipper" id="terUnits" value={formData.terUnits} onChange={handleInputChange} />
            <InputField label="Drop Test (m)" id="terDrop" value={formData.terDrop} onChange={handleInputChange} />
            <InputField label="Stack Height (units)" id="terStack" value={formData.terStack} onChange={handleInputChange} />
            <TextareaField label="Tertiary Packaging Notes" id="terNotes" value={formData.terNotes} onChange={handleInputChange} />
          </div>
        );

      case 11: // Testing & Approval
        return (
          <>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-4">Testing & Approvals</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Approved by Packaging" id="apprPack" value={formData.apprPack} onChange={handleInputChange} />
                <InputField label="Approved by R&D" id="apprRd" value={formData.apprRd} onChange={handleInputChange} />
                <InputField label="Approved by Finance" id="apprFin" value={formData.apprFin} onChange={handleInputChange} />
                <CheckboxField label="Lock for Modification" id="apprLock" checked={formData.apprLock} onChange={handleInputChange} />
              </div>
            </div>
            <ArrayItemManager
              masterType="packaging"
              itemType="test"
              items={formData.tests}
              tempFields={tempTest}
              onTempFieldChange={(field, value) => setTempTest(prev => ({ ...prev, [field]: value }))}
              onAdd={handleAddTest}
              onRemove={handleRemoveTest}
              errors={errors}
              itemLabel="Test"
              columns={[
                { key: 'name', label: 'Test Name' },
                { key: 'result', label: 'Result' },
                { key: 'date', label: 'Test Date', type: 'date' },
                { key: 'by', label: 'Tested By' },
                { key: 'remarks', label: 'Remarks' },
              ]}
            />
          </>
        );

      case 12: // Catalogue
        return (
          <div className="space-y-4">
            <CheckboxField label="Visible on Catalogue" id="catVisible" checked={formData.catVisible} onChange={handleInputChange} />
            <CheckboxField label="Share with Clients" id="catShare" checked={formData.catShare} onChange={handleInputChange} />
            <InputField label="Web Display Name" id="catWebName" value={formData.catWebName} onChange={handleInputChange} />
            <InputField label="Tags (comma-separated)" id="catTags" value={formData.catTags} onChange={handleInputChange} />
            <InputField label="Recommended Product Types" id="catRecoTypes" value={formData.catRecoTypes} onChange={handleInputChange} />
            <TextareaField label="Web Images" id="catWebImages" value={formData.catWebImages} onChange={handleInputChange} />
          </div>
        );

      case 13: // Review / JSON
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
      title="Packaging Master Data (Refactored)"
      stages={stages}
      currentStage={currentStage}
      onStageChange={setCurrentStage}
      errors={errors}
      formData={formData}
      onInputChange={handleInputChange}
      primaryFields={getPrimaryFields('packaging')}
      onSave={() => {
        localStorage.setItem('packaging_draft_new', JSON.stringify(formData));
        addToast('success', 'Draft saved!');
      }}
      onSubmit={handleSubmit}
    >
      {renderStageContent()}
    </MasterFormBase>
  );
};

// Helper components for cleaner rendering
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

export default PackagingRefactored;
