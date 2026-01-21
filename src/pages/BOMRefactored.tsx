import React, { useState, useEffect } from 'react';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { getPrimaryFields, validatePrimaryFields } from '../utils/masterFormUtils';

const BOMRefactored: React.FC = () => {
  const { addItem } = useItems();
  const { addToast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  const [formData, setFormData] = useState({
    // Primary Info
    bomCode: '',
    bomSku: '',
    bomCategory: '',
    bomUnit: 'GM',
    bomHsn: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    
    // BOM Setup & Coding
    type: 'BULK',
    status: 'Draft',
    version: 'v1.0',
    client: '',
    name: '',
    dosage: '',
    packSize: '',
    site: '',
    category: '',
    claims: '',
    project: '',
    market: '',
    createdBy: '',
    reviewedBy: '',
    desc: '',
    
    // Specs & Yield
    specBulk: '',
    specProcess: '',
    specFg: '',
    specPack: '',
    specTests: '',
    specRelease: '',
    batch: '',
    yield: '',
    overage: '',
    line: '',
    notes: '',

    // Header / regulatory extras
    regulatory: '',
    phRange: '',
    description: '',

    // ARRAYS (no temp fields!)
    rmLines: [] as Array<{
      code: string;
      name: string;
      phase: string;
      func: string;
      pct: number;
      uom: string;
      spec: string;
      notes: string;
    }>,

    pmLines: [] as Array<{
      code: string;
      name: string;
      cat: string;
      qty: number;
      uom: string;
      notes: string;
    }>,
  });

  // Temp fields separated
  const [tempRMLine, setTempRMLine] = useState({ 
    code: '', name: '', phase: '', func: '', pct: '', uom: 'GM', spec: '', notes: '' 
  });
  const [tempPMLine, setTempPMLine] = useState({ 
    code: '', name: '', cat: '', qty: '', uom: 'PCS', notes: '' 
  });

  // Auto-save draft
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.values(formData).some(v => Boolean(v))) {
        localStorage.setItem('bom_draft_new', JSON.stringify(formData));
        addToast('info', 'BOM draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, addToast]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('bom_draft_new');
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, []);

  const stages = [
    'Primary Info',
    'BOM Setup & Coding',
    'Header Details',
    'Formulation (Bulk RM Items)',
    'Packaging (FG PM Items)',
    'Specifications',
    'Yield, Batch & Notes',
    'Review / JSON',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // RM Line operations
  const handleAddRMLine = () => {
    if (!tempRMLine.name.trim()) {
      setErrors(prev => ({ ...prev, rmName: 'RM Name is required' }));
      addToast('error', 'RM Name is required');
      return;
    }
    if (!tempRMLine.pct || Number(tempRMLine.pct) <= 0) {
      setErrors(prev => ({ ...prev, rmPct: 'Enter % w/w' }));
      addToast('error', 'Enter % w/w');
      return;
    }

    setFormData(prev => ({
      ...prev,
      rmLines: [...prev.rmLines, {
        code: tempRMLine.code,
        name: tempRMLine.name,
        phase: tempRMLine.phase,
        func: tempRMLine.func,
        pct: Number(tempRMLine.pct),
        uom: tempRMLine.uom,
        spec: tempRMLine.spec,
        notes: tempRMLine.notes,
      }]
    }));
    setTempRMLine({ code: '', name: '', phase: '', func: '', pct: '', uom: 'GM', spec: '', notes: '' });
    setErrors(prev => ({ ...prev, rmName: '', rmPct: '' }));
  };

  const handleRemoveRMLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      rmLines: prev.rmLines.filter((_, i) => i !== idx)
    }));
  };

  // PM Line operations
  const handleAddPMLine = () => {
    if (!tempPMLine.name.trim()) {
      setErrors(prev => ({ ...prev, pmName: 'PM Name is required' }));
      addToast('error', 'PM Name is required');
      return;
    }
    if (!tempPMLine.qty || Number(tempPMLine.qty) <= 0) {
      setErrors(prev => ({ ...prev, pmQty: 'Enter quantity' }));
      addToast('error', 'Enter quantity');
      return;
    }

    setFormData(prev => ({
      ...prev,
      pmLines: [...prev.pmLines, {
        code: tempPMLine.code,
        name: tempPMLine.name,
        cat: tempPMLine.cat,
        qty: Number(tempPMLine.qty),
        uom: tempPMLine.uom,
        notes: tempPMLine.notes,
      }]
    }));
    setTempPMLine({ code: '', name: '', cat: '', qty: '', uom: 'PCS', notes: '' });
    setErrors(prev => ({ ...prev, pmName: '', pmQty: '' }));
  };

  const handleRemovePMLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      pmLines: prev.pmLines.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = () => {
    const validation = validatePrimaryFields(formData, 'bom');
    if (!validation.valid) {
      setErrors(validation.errors);
      addToast('error', 'Please fill all primary fields');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      type: 'bom' as const,
      name: formData.name || 'Unnamed BOM',
      code: formData.bomCode || 'BOM-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      data: formData,
    };
    addItem(newItem);
    addToast('success', 'BOM saved successfully!');
    localStorage.removeItem('bom_draft_new');
  };

  // Stage content rendering
  const renderStageContent = () => {
    switch (currentStage) {
      case 0: // Primary Info
        return (
          <div className="space-y-4">
            <InputField label="BOM Code" id="bomCode" value={formData.bomCode} onChange={handleInputChange} />
            <InputField label="BOM SKU" id="bomSku" value={formData.bomSku} onChange={handleInputChange} />
            <InputField label="Category" id="bomCategory" value={formData.bomCategory} onChange={handleInputChange} />
            <SelectField label="Unit of Measure" id="bomUnit" value={formData.bomUnit} onChange={handleInputChange}
              options={['GM', 'ML', 'PCS', 'L', 'KG']} />
            <InputField label="HSN Code" id="bomHsn" value={formData.bomHsn} onChange={handleInputChange} />
            <SelectField label="Tax Preference" id="bomTaxPreference" value={formData.bomTaxPreference} onChange={handleInputChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']} />
            <CheckboxField label="Returnable Item" id="bomReturnable" checked={formData.bomReturnable} onChange={handleInputChange} />
            <TextareaField label="Associate Items" id="bomAssociateItems" value={formData.bomAssociateItems} onChange={handleInputChange} />
          </div>
        );

      case 1: // BOM Setup & Coding
        return (
          <div className="space-y-4">
            <SelectField label="Type" id="type" value={formData.type} onChange={handleInputChange}
              options={['BULK', 'FG', 'SEMI', 'INTERMEDIATE']} />
            <SelectField label="Status" id="status" value={formData.status} onChange={handleInputChange}
              options={['Draft', 'Approved', 'Archived', 'Deprecated']} />
            <InputField label="Version" id="version" value={formData.version} onChange={handleInputChange} />
            <InputField label="Client" id="client" value={formData.client} onChange={handleInputChange} />
            <InputField label="Name" id="name" value={formData.name} onChange={handleInputChange} />
            <InputField label="Dosage (e.g., 10% w/w)" id="dosage" value={formData.dosage} onChange={handleInputChange} />
            <InputField label="Pack Size" id="packSize" value={formData.packSize} onChange={handleInputChange} />
            <InputField label="Site/Plant" id="site" value={formData.site} onChange={handleInputChange} />
            <InputField label="Project" id="project" value={formData.project} onChange={handleInputChange} />
            <InputField label="Market" id="market" value={formData.market} onChange={handleInputChange} />
          </div>
        );

      case 2: // Header Details
        return (
          <div className="space-y-4">
            <InputField label="Category (FMCG, Pharma, etc.)" id="category" value={formData.category} onChange={handleInputChange} />
            <InputField label="Created By" id="createdBy" value={formData.createdBy} onChange={handleInputChange} />
            <InputField label="Reviewed By" id="reviewedBy" value={formData.reviewedBy} onChange={handleInputChange} />
            <TextareaField label="Description" id="desc" value={formData.desc} onChange={handleInputChange} />
            <TextareaField label="Claims" id="claims" value={formData.claims} onChange={handleInputChange} />
            <TextareaField label="Regulatory Notes" id="regulatory" value={formData.regulatory} onChange={handleInputChange} />
            <InputField label="pH Range" id="phRange" value={formData.phRange} onChange={handleInputChange} />
          </div>
        );

      case 3: // Formulation (RM Items)
        return (
          <ArrayItemManager
            masterType="bom"
            itemType="rmLine"
            items={formData.rmLines}
            tempFields={tempRMLine}
            onTempFieldChange={(field, value) => setTempRMLine(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddRMLine}
            onRemove={handleRemoveRMLine}
            errors={errors}
            itemLabel="Raw Material Line"
            columns={[
              { key: 'code', label: 'RM Code' },
              { key: 'name', label: 'RM Name' },
              { key: 'phase', label: 'Phase' },
              { key: 'func', label: 'Function' },
              { key: 'pct', label: '% w/w', type: 'number' },
              { key: 'uom', label: 'UoM' },
              { key: 'spec', label: 'Spec' },
              { key: 'notes', label: 'Notes' },
            ]}
          />
        );

      case 4: // Packaging (PM Items)
        return (
          <ArrayItemManager
            masterType="bom"
            itemType="pmLine"
            items={formData.pmLines}
            tempFields={tempPMLine}
            onTempFieldChange={(field, value) => setTempPMLine(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddPMLine}
            onRemove={handleRemovePMLine}
            errors={errors}
            itemLabel="Packaging Material Line"
            columns={[
              { key: 'code', label: 'PM Code' },
              { key: 'name', label: 'PM Name' },
              { key: 'cat', label: 'Category' },
              { key: 'qty', label: 'Qty', type: 'number' },
              { key: 'uom', label: 'UoM' },
              { key: 'notes', label: 'Notes' },
            ]}
          />
        );

      case 5: // Specifications
        return (
          <div className="space-y-4">
            <TextareaField label="Bulk Specification" id="specBulk" value={formData.specBulk} onChange={handleInputChange} />
            <TextareaField label="Process Specification" id="specProcess" value={formData.specProcess} onChange={handleInputChange} />
            <TextareaField label="FG Specification" id="specFg" value={formData.specFg} onChange={handleInputChange} />
            <TextareaField label="Packaging Specification" id="specPack" value={formData.specPack} onChange={handleInputChange} />
            <TextareaField label="Testing Requirements" id="specTests" value={formData.specTests} onChange={handleInputChange} />
            <TextareaField label="Release Criteria" id="specRelease" value={formData.specRelease} onChange={handleInputChange} />
          </div>
        );

      case 6: // Yield, Batch & Notes
        return (
          <div className="space-y-4">
            <InputField label="Batch Lot Size" id="batch" value={formData.batch} onChange={handleInputChange} />
            <InputField label="Yield %" id="yield" value={formData.yield} onChange={handleInputChange} />
            <InputField label="Overage %" id="overage" value={formData.overage} onChange={handleInputChange} />
            <InputField label="Production Line" id="line" value={formData.line} onChange={handleInputChange} />
            <TextareaField label="General Notes" id="notes" value={formData.notes} onChange={handleInputChange} />
          </div>
        );

      case 7: // Review / JSON
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
      title="Bill of Materials (BOM) - Refactored"
      stages={stages}
      currentStage={currentStage}
      onStageChange={setCurrentStage}
      errors={errors}
      formData={formData}
      onInputChange={handleInputChange}
      primaryFields={getPrimaryFields('bom')}
      onSave={() => {
        localStorage.setItem('bom_draft_new', JSON.stringify(formData));
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

export default BOMRefactored;
