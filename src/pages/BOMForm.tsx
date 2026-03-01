import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import { getPrimaryFields, validatePrimaryFields } from '../utils/masterFormUtils';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraftLoader } from '../hooks/useDraftLoader';
import { createBOM } from '../services/bom.service';

interface BOMFormState {
  [key: string]: unknown;
  bomCode: string;
  bomSku: string;
  bomCategory: string;
  bomUnit: string;
  bomHsn: string;
  bomTaxPreference: string;
  bomReturnable: boolean;
  bomAssociateItems: string;
  type: string;
  status: string;
  version: string;
  client: string;
  name: string;
  dosage: string;
  packSize: string;
  site: string;
  category: string;
  claims: string;
  project: string;
  market: string;
  createdBy: string;
  reviewedBy: string;
  desc: string;
  specBulk: string;
  specProcess: string;
  specFg: string;
  specPack: string;
  specTests: string;
  specRelease: string;
  batch: string;
  yield: string;
  overage: string;
  line: string;
  notes: string;
  regulatory: string;
  phRange: string;
  description: string;
  rmLines: Array<{ code: string; name: string; phase: string; func: string; pct: number; uom: string; spec: string; notes: string }>;
  pmLines: Array<{ code: string; name: string; cat: string; qty: number; uom: string; notes: string }>;
}

function emptyBomForm(): BOMFormState {
  return {
    bomCode: '',
    bomSku: '',
    bomCategory: '',
    bomUnit: 'GM',
    bomHsn: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
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
    regulatory: '',
    phRange: '',
    description: '',
    rmLines: [] as Array<{ code: string; name: string; phase: string; func: string; pct: number; uom: string; spec: string; notes: string }>,
    pmLines: [] as Array<{ code: string; name: string; cat: string; qty: number; uom: string; notes: string }>,
  };
}

/** Mock form data for BOM (Fill mock values). Matches schema used in seed. */
const BOM_MOCK_FORM: BOMFormState = {
  ...emptyBomForm(),
  bomCode: 'BOM-FG-001',
  bomSku: 'SKU-VC-SERUM-30',
  bomCategory: 'Skincare',
  bomUnit: 'GM',
  bomHsn: '330499',
  bomTaxPreference: 'Taxable',
  bomReturnable: false,
  bomAssociateItems: 'Sample Sachet, Gift Box',
  type: 'FG',
  status: 'Draft',
  version: 'v1.0',
  client: 'Esthetic Insights',
  name: 'Vitamin C Serum 30ml',
  dosage: '10% w/w',
  packSize: '30ml',
  site: 'Baddi Plant',
  category: 'FMCG',
  claims: 'Brightens skin, Reduces dark spots',
  project: 'Project Glow',
  market: 'India, USA',
  createdBy: 'John Doe',
  reviewedBy: 'Jane Smith',
  desc: 'Vitamin C serum with niacinamide and ferulic acid. Oil-free, suitable for all skin types.',
  specBulk: 'Clear to slightly yellow liquid; pH 3.0–3.5.',
  specProcess: 'Cold process; add actives below 40°C.',
  specFg: 'pH 3.0–3.5; viscosity 2000–4000 cPs.',
  specPack: '30ml amber dropper bottle; batch code on bottom.',
  specTests: 'Stability 3M/6M; preservative efficacy.',
  specRelease: 'All tests pass; QA sign-off.',
  batch: '100 KG',
  yield: '98',
  overage: '2',
  line: 'Line 1',
  notes: 'Store in cool place; avoid direct sunlight.',
  regulatory: 'EU Compliant; ISO 22716.',
  phRange: '3.0 - 3.5',
  description: 'Vitamin C Serum BOM for 30ml pack',
  rmLines: [
    { code: 'EI-RM-BASE-001', name: 'Aqua (Purified Water)', phase: 'A', func: 'Solvent', pct: 70, uom: 'GM', spec: 'BP/EP', notes: '' },
    { code: 'EI-RM-ACT-002', name: 'Niacinamide', phase: 'A', func: 'Active', pct: 5, uom: 'GM', spec: '98%', notes: '' },
    { code: 'EI-RM-ACT-003', name: 'Ascorbyl Glucoside', phase: 'A', func: 'Active', pct: 10, uom: 'GM', spec: '98%', notes: '' },
    { code: 'EI-RM-EMUL-001', name: 'Cetearyl Alcohol', phase: 'B', func: 'Emulsifier', pct: 2, uom: 'GM', spec: 'NF', notes: '' },
    { code: 'EI-RM-PRES-001', name: 'Phenoxyethanol', phase: 'C', func: 'Preservative', pct: 0.5, uom: 'GM', spec: 'EP', notes: '' },
  ],
  pmLines: [
    { code: 'EI-PM-BTL-001', name: '30ml Amber Dropper Bottle', cat: 'Primary', qty: 1, uom: 'PCS', notes: '' },
    { code: 'EI-PM-CAP-001', name: 'Dropper Cap', cat: 'Closure', qty: 1, uom: 'PCS', notes: '' },
    { code: 'EI-PM-LBL-001', name: 'Front Label 50x80mm', cat: 'Label', qty: 1, uom: 'PCS', notes: '' },
  ],
};

const BOMRefactored: React.FC = () => {
  const navigate = useNavigate();
  const { addItem: _addItem } = useItems();
  const { addToast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [_isSaving, _setIsSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  const [formData, setFormData] = useState<BOMFormState>(() => emptyBomForm());

  // Temp fields separated
  const [tempRMLine, setTempRMLine] = useState({
    code: '', name: '', phase: '', func: '', pct: '', uom: 'GM', spec: '', notes: ''
  });
  const [tempPMLine, setTempPMLine] = useState({
    code: '', name: '', cat: '', qty: '', uom: 'PCS', notes: ''
  });

  useAutoSave('bom_draft_new', formData);
  useDraftLoader('bom_draft_new', (saved) => setFormData(prev => ({ ...prev, ...saved })));

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

  const handleSubmit = async () => {
    const validation = validatePrimaryFields(formData, 'bom');
    if (!validation.valid) {
      setErrors(validation.errors);
      addToast('error', 'Please fill all primary fields');
      return;
    }

    const payload = {
      bomCode: formData.bomCode,
      bomSku: formData.bomSku || undefined,
      bomCategory: formData.bomCategory || undefined,
      bomUnit: formData.bomUnit || undefined,
      bomHsn: formData.bomHsn || undefined,
      bomTaxPreference: formData.bomTaxPreference || undefined,
      bomReturnable: formData.bomReturnable,
      bomAssociateItems: formData.bomAssociateItems || undefined,
      type: formData.type || undefined,
      status: formData.status || undefined,
      version: formData.version || undefined,
      client: formData.client || undefined,
      name: formData.name || undefined,
      dosage: formData.dosage || undefined,
      packSize: formData.packSize || undefined,
      site: formData.site || undefined,
      category: formData.category || undefined,
      claims: formData.claims || undefined,
      project: formData.project || undefined,
      market: formData.market || undefined,
      createdBy: formData.createdBy || undefined,
      reviewedBy: formData.reviewedBy || undefined,
      desc: formData.desc || undefined,
      specBulk: formData.specBulk || undefined,
      specProcess: formData.specProcess || undefined,
      specFg: formData.specFg || undefined,
      specPack: formData.specPack || undefined,
      specTests: formData.specTests || undefined,
      specRelease: formData.specRelease || undefined,
      batch: formData.batch || undefined,
      yield: formData.yield || undefined,
      overage: formData.overage || undefined,
      line: formData.line || undefined,
      notes: formData.notes || undefined,
      regulatory: formData.regulatory || undefined,
      phRange: formData.phRange || undefined,
      description: formData.description || undefined,
      rmLines: formData.rmLines?.length ? formData.rmLines : undefined,
      pmLines: formData.pmLines?.length ? formData.pmLines : undefined,
    };

    const result = await createBOM(payload);
    if (result.success && result.data) {
      localStorage.removeItem('bom_draft_new');
      addToast('success', 'BOM saved successfully!');
      navigate('/bom');
    } else {
      addToast('error', result.error && typeof result.error === 'object' && 'message' in result.error ? result.error.message : 'Failed to save BOM');
    }
  };

  // Stage content rendering
  const renderStageContent = () => {
    switch (currentStage) {
      case 0: // Primary Info
        return (
          <div className="space-y-4">
            <InputField label="BOM Code" id="bomCode" value={formData.bomCode} onChange={handleInputChange} placeholder="e.g., BOM-FG-001" />
            <InputField label="BOM SKU" id="bomSku" value={formData.bomSku} onChange={handleInputChange} placeholder="e.g., SKU-PROD-001" />
            <InputField label="Category" id="bomCategory" value={formData.bomCategory} onChange={handleInputChange} placeholder="e.g., Skincare, Haircare" />
            <SelectField label="Unit of Measure" id="bomUnit" value={formData.bomUnit} onChange={handleInputChange}
              options={['GM', 'ML', 'PCS', 'L', 'KG']} />
            <InputField label="HSN Code" id="bomHsn" value={formData.bomHsn} onChange={handleInputChange} placeholder="e.g., 330499" />
            <SelectField label="Tax Preference" id="bomTaxPreference" value={formData.bomTaxPreference} onChange={handleInputChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']} />
            <CheckboxField label="Returnable Item" id="bomReturnable" checked={formData.bomReturnable} onChange={handleInputChange} />
            <TextareaField label="Associate Items" id="bomAssociateItems" value={formData.bomAssociateItems} onChange={handleInputChange} placeholder="e.g., Sample Sachet, Gift Box" />
          </div>
        );

      case 1: // BOM Setup & Coding
        return (
          <div className="space-y-4">
            <SelectField label="Type" id="type" value={formData.type} onChange={handleInputChange}
              options={['BULK', 'FG', 'SEMI', 'INTERMEDIATE']} />
            <SelectField label="Status" id="status" value={formData.status} onChange={handleInputChange}
              options={['Draft', 'Approved', 'Archived', 'Deprecated']} />
            <InputField label="Version" id="version" value={formData.version} onChange={handleInputChange} placeholder="e.g., v1.0" />
            <InputField label="Client" id="client" value={formData.client} onChange={handleInputChange} placeholder="e.g., Esthetic Insights" />
            <InputField label="Name" id="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Vitamin C Serum" />
            <InputField label="Dosage (e.g., 10% w/w)" id="dosage" value={formData.dosage} onChange={handleInputChange} placeholder="e.g., 10% w/w" />
            <InputField label="Pack Size" id="packSize" value={formData.packSize} onChange={handleInputChange} placeholder="e.g., 30ml" />
            <InputField label="Site/Plant" id="site" value={formData.site} onChange={handleInputChange} placeholder="e.g., Baddi Plant" />
            <InputField label="Project" id="project" value={formData.project} onChange={handleInputChange} placeholder="e.g., Project Glow" />
            <InputField label="Market" id="market" value={formData.market} onChange={handleInputChange} placeholder="e.g., India, USA" />
          </div>
        );

      case 2: // Header Details
        return (
          <div className="space-y-4">
            <InputField label="Category (FMCG, Pharma, etc.)" id="category" value={formData.category} onChange={handleInputChange} placeholder="e.g., FMCG, Pharma" />
            <InputField label="Created By" id="createdBy" value={formData.createdBy} onChange={handleInputChange} placeholder="e.g., John Doe" />
            <InputField label="Reviewed By" id="reviewedBy" value={formData.reviewedBy} onChange={handleInputChange} placeholder="e.g., Jane Smith" />
            <TextareaField label="Description" id="desc" value={formData.desc} onChange={handleInputChange} placeholder="A brief description of the BOM." />
            <TextareaField label="Claims" id="claims" value={formData.claims} onChange={handleInputChange} placeholder="e.g., Brightens skin, Reduces dark spots" />
            <TextareaField label="Regulatory Notes" id="regulatory" value={formData.regulatory} onChange={handleInputChange} placeholder="e.g., EU Compliant" />
            <InputField label="pH Range" id="phRange" value={formData.phRange} onChange={handleInputChange} placeholder="e.g., 5.5 - 6.5" />
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
            <TextareaField label="Bulk Specification" id="specBulk" value={formData.specBulk} onChange={handleInputChange} placeholder="e.g., Appearance, Color, Odor" />
            <TextareaField label="Process Specification" id="specProcess" value={formData.specProcess} onChange={handleInputChange} placeholder="e.g., Mixing speed, Temperature" />
            <TextareaField label="FG Specification" id="specFg" value={formData.specFg} onChange={handleInputChange} placeholder="e.g., pH, Viscosity" />
            <TextareaField label="Packaging Specification" id="specPack" value={formData.specPack} onChange={handleInputChange} placeholder="e.g., Label placement, Batch coding" />
            <TextareaField label="Testing Requirements" id="specTests" value={formData.specTests} onChange={handleInputChange} placeholder="e.g., Stability testing, Preservative efficacy" />
            <TextareaField label="Release Criteria" id="specRelease" value={formData.specRelease} onChange={handleInputChange} placeholder="e.g., All tests must pass" />
          </div>
        );

      case 6: // Yield, Batch & Notes
        return (
          <div className="space-y-4">
            <InputField label="Batch Lot Size" id="batch" value={formData.batch} onChange={handleInputChange} placeholder="e.g., 100 KG" />
            <InputField label="Yield %" id="yield" value={formData.yield} onChange={handleInputChange} placeholder="e.g., 98%" />
            <InputField label="Overage %" id="overage" value={formData.overage} onChange={handleInputChange} placeholder="e.g., 2%" />
            <InputField label="Production Line" id="line" value={formData.line} onChange={handleInputChange} placeholder="e.g., Line 1" />
            <TextareaField label="General Notes" id="notes" value={formData.notes} onChange={handleInputChange} placeholder="e.g., Any special instructions" />
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
      onFillMock={() => setFormData(BOM_MOCK_FORM)}
      onReset={() => setFormData(emptyBomForm())}
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
  value: string | number | boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, id, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      id={id}
      value={String(value ?? '')}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  id: string;
  value: string | number | boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}> = ({ label, id, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      id={id}
      value={String(value ?? '')}
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
  value: string | number | boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea
      id={id}
      value={String(value ?? '')}
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

export default BOMRefactored;
